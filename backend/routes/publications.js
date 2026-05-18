import express from "express";
import db from "../config/db.js";
import {
  DoiLookupError,
  getVerifiedDoiMetadata,
  isValidDoi,
  normalizeDoi,
  normalizeYear,
} from "../services/doiMetadata.service.js";

const router = express.Router();
const VALID_PUBLICATION_STATUSES = new Set(["draft", "submitted", "in_review", "approved", "rejected"]);
const MAX_LIMIT = 50;
const DOI_IMPORT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DOI_IMPORT_RATE_LIMIT_MAX = 20;
const doiImportRateLimits = new Map();

function requireAuthenticatedUser(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "unauthorized", message: "Duhet te kyqeni per te ruajtur publikimin." });
    return;
  }

  next();
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function parsePagination(query = {}) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 25, 1), MAX_LIMIT);

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function validatePublicationPayload(body = {}, options = {}) {
  const title = normalizeText(body.title);
  const venue = normalizeText(body.venue || body.journal);
  const status = normalizeText(body.status || "draft");
  const publicationYear = normalizeYear(body.publicationYear ?? body.publication_year);
  const errors = [];

  if (!title) {
    errors.push({ field: "title", message: "Titulli i publikimit eshte obligativ." });
  }

  if (title.length > 500) {
    errors.push({ field: "title", message: "Titulli i publikimit eshte shume i gjate." });
  }

  if (venue.length > 300) {
    errors.push({ field: "venue", message: "Revista/konferenca eshte shume e gjate." });
  }

  if ((body.publicationYear ?? body.publication_year) && publicationYear === null) {
    errors.push({ field: "publicationYear", message: "Viti i publikimit nuk eshte valid." });
  }

  if (!VALID_PUBLICATION_STATUSES.has(status)) {
    errors.push({ field: "status", message: "Statusi i publikimit nuk eshte valid." });
  }

  if (options.requireDoi) {
    const doi = normalizeDoi(body.doi || body.metadata?.doi);

    if (!doi || !isValidDoi(doi)) {
      errors.push({ field: "doi", message: "DOI nuk eshte valid." });
    }
  }

  return {
    errors,
    values: {
      title,
      venue,
      publicationYear,
      status,
    },
  };
}

function mapPublication(row) {
  return {
    id: row.id,
    doi: row.doi || "",
    title: row.title || "",
    venue: row.venue || row.container_title || "",
    publisher: row.publisher || "",
    publicationYear: row.publication_year || row.year || "",
    status: row.status || "draft",
    sourceUrl: row.source_url || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function getDoiImportRateLimitKey(req) {
  return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
}

function checkDoiImportRateLimit(req) {
  const now = Date.now();
  const key = getDoiImportRateLimitKey(req);
  const existing = doiImportRateLimits.get(key) || [];
  const recent = existing.filter((timestamp) => now - timestamp < DOI_IMPORT_RATE_LIMIT_WINDOW_MS);

  if (recent.length >= DOI_IMPORT_RATE_LIMIT_MAX) {
    doiImportRateLimits.set(key, recent);
    return {
      limited: true,
      retryAfterMs: DOI_IMPORT_RATE_LIMIT_WINDOW_MS - (now - recent[0]),
    };
  }

  recent.push(now);
  doiImportRateLimits.set(key, recent);

  if (doiImportRateLimits.size > 1000) {
    for (const [entryKey, timestamps] of doiImportRateLimits.entries()) {
      const active = timestamps.filter((timestamp) => now - timestamp < DOI_IMPORT_RATE_LIMIT_WINDOW_MS);

      if (active.length) {
        doiImportRateLimits.set(entryKey, active);
      } else {
        doiImportRateLimits.delete(entryKey);
      }
    }
  }

  return { limited: false, retryAfterMs: 0 };
}

function sendPublicationError(res, status, error, message, extra = {}) {
  res.status(status).json({ error, message, ...extra });
}

router.get("/", requireAuthenticatedUser, async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const q = normalizeText(req.query.q || req.query.search);
  const status = normalizeText(req.query.status);
  const filters = ["p.owner_id = $1"];
  const params = [req.user.id];

  if (q) {
    params.push(`%${q}%`);
    filters.push(`(p.title ilike $${params.length} or p.venue ilike $${params.length} or p.doi ilike $${params.length} or m.publisher ilike $${params.length} or m.container_title ilike $${params.length})`);
  }

  if (status) {
    if (!VALID_PUBLICATION_STATUSES.has(status)) {
      res.status(400).json({ error: "invalid_status", message: "Statusi i publikimit nuk eshte valid." });
      return;
    }

    params.push(status);
    filters.push(`p.status = $${params.length}`);
  }

  const whereClause = filters.join(" and ");

  try {
    const dataParams = [...params, limit, offset];
    const limitParam = dataParams.length - 1;
    const offsetParam = dataParams.length;
    const [listResult, countResult] = await Promise.all([
      db.query(
        `select p.id, p.doi, p.title, p.venue, p.publication_year, p.status, p.created_at, p.updated_at,
                m.container_title, m.publisher, m.year, m.source_url
         from publications p
         left join publication_metadata m on m.doi = p.doi
         where ${whereClause}
         order by p.updated_at desc, p.created_at desc
         limit $${limitParam} offset $${offsetParam}`,
        dataParams
      ),
      db.query(
        `select count(*)::int as total
       from publications p
       left join publication_metadata m on m.doi = p.doi
       where ${whereClause}`,
        params
      ),
    ]);

    const total = Number(countResult.rows[0]?.total || 0);

    res.json({
      data: listResult.rows.map(mapPublication),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    console.error("GET /api/publications failed:", error);
    res.status(500).json({ error: "list_failed" });
  }
});

router.post("/", requireAuthenticatedUser, async (req, res) => {
  const { errors, values } = validatePublicationPayload(req.body);

  if (errors.length) {
    res.status(400).json({ error: "validation_failed", message: errors[0].message, errors });
    return;
  }

  try {
    const { rows } = await db.query(
      `insert into publications
       (owner_id, doi, title, venue, publication_year, status)
       values ($1, null, $2, $3, $4, $5)
       returning id, doi, title, venue, publication_year, status, created_at, updated_at`,
      [
        req.user.id,
        values.title,
        values.venue || null,
        values.publicationYear,
        values.status,
      ]
    );

    res.status(201).json({ data: mapPublication(rows[0]) });
  } catch (error) {
    console.error("POST /api/publications failed:", error);
    sendPublicationError(res, 500, "save_failed", "Publikimi nuk u ruajt.");
  }
});

router.post("/from-doi", requireAuthenticatedUser, async (req, res) => {
  const rateLimit = checkDoiImportRateLimit(req);

  if (rateLimit.limited) {
    const retryAfterSeconds = Math.max(Math.ceil(rateLimit.retryAfterMs / 1000), 1);
    res.set("Retry-After", String(retryAfterSeconds));
    sendPublicationError(res, 429, "rate_limited", "Keni bere shume kerkesa per import nga DOI. Provoni perseri me vone.");
    return;
  }

  const doi = normalizeDoi(req.body?.doi || req.body?.metadata?.doi);

  if (!doi || !isValidDoi(doi)) {
    sendPublicationError(res, 400, "invalid_doi", "DOI nuk eshte valid.");
    return;
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const existingResult = await client.query(
      `select id, doi, title, venue, publication_year, status, created_at, updated_at
       from publications
       where owner_id = $1 and doi = $2
       limit 1`,
      [req.user.id, doi]
    );

    if (existingResult.rows[0]) {
      await client.query("commit");
      sendPublicationError(res, 409, "duplicate_publication", "Ky publikim ekziston tashme ne listen tuaj.", {
        data: mapPublication(existingResult.rows[0]),
        duplicate: true,
      });
      return;
    }

    const { metadata } = await getVerifiedDoiMetadata(client, doi);
    const title = normalizeText(metadata.title) || doi;
    const venue = normalizeText(metadata.container_title);
    const publicationYear = normalizeYear(metadata.year);

    const result = await client.query(
      `insert into publications
       (owner_id, doi, title, venue, publication_year, status)
       values ($1, $2, $3, $4, $5, 'draft')
       returning id, doi, title, venue, publication_year, status, created_at, updated_at`,
      [req.user.id, doi, title, venue || null, publicationYear]
    );

    await client.query("commit");

    res.status(201).json({ data: mapPublication(result.rows[0]) });
  } catch (error) {
    await client.query("rollback").catch(() => {});

    if (error instanceof DoiLookupError) {
      sendPublicationError(res, error.status, error.code, error.message);
      return;
    }

    if (error.code === "23505") {
      sendPublicationError(res, 409, "duplicate_publication", "Ky publikim ekziston tashme ne listen tuaj.");
      return;
    }

    console.error("POST /api/publications/from-doi failed:", error);
    sendPublicationError(res, 500, "save_failed", "Publikimi nuk u ruajt.");
  } finally {
    client.release();
  }
});

router.put("/:id", requireAuthenticatedUser, async (req, res) => {
  const { errors, values } = validatePublicationPayload(req.body);

  if (errors.length) {
    res.status(400).json({ error: "validation_failed", message: errors[0].message, errors });
    return;
  }

  try {
    const { rows } = await db.query(
      `update publications
       set title = $3,
           venue = $4,
           publication_year = $5,
           status = $6,
           updated_at = now()
       where id = $1 and owner_id = $2
       returning id, doi, title, venue, publication_year, status, created_at, updated_at`,
      [
        req.params.id,
        req.user.id,
        values.title,
        values.venue || null,
        values.publicationYear,
        values.status,
      ]
    );

    if (!rows[0]) {
      res.status(404).json({ error: "not_found", message: "Publikimi nuk u gjet." });
      return;
    }

    res.json({ data: mapPublication(rows[0]) });
  } catch (error) {
    console.error("PUT /api/publications/:id failed:", error);
    res.status(500).json({ error: "update_failed" });
  }
});

router.delete("/:id", requireAuthenticatedUser, async (req, res) => {
  try {
    const result = await db.query(
      `delete from publications
       where id = $1 and owner_id = $2
       returning id`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "not_found", message: "Publikimi nuk u gjet." });
      return;
    }

    res.json({ message: "Deleted" });
  } catch (error) {
    console.error("DELETE /api/publications/:id failed:", error);
    res.status(500).json({ error: "delete_failed" });
  }
});

export default router;