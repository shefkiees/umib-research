import express from "express";
import db from "../config/db.js";

const router = express.Router();
const VALID_PUBLICATION_STATUSES = new Set(["draft", "submitted", "in_review", "approved", "rejected"]);
const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i;
const MAX_LIMIT = 50;

function requireAuthenticatedUser(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "unauthorized", message: "Duhet te kyqeni per te ruajtur publikimin." });
    return;
  }

  next();
}

function normalizeDoi(input) {
  if (!input) {
    return "";
  }

  return decodeURIComponent(String(input))
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim()
    .toLowerCase();
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function isValidDoi(value) {
  return DOI_PATTERN.test(value);
}

function normalizeYear(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const year = Number(value);
  const currentYear = new Date().getUTCFullYear() + 1;
  return Number.isInteger(year) && year >= 1900 && year <= currentYear ? year : null;
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

function normalizeMetadata(metadata = {}, doi) {
  return {
    doi,
    title: normalizeText(metadata.title),
    authors: Array.isArray(metadata.authors) ? metadata.authors : [],
    container_title: normalizeText(metadata.container_title),
    publisher: normalizeText(metadata.publisher),
    published_date: normalizeText(metadata.published_date),
    year: normalizeYear(metadata.year),
    volume: normalizeText(metadata.volume),
    issue: normalizeText(metadata.issue),
    pages: normalizeText(metadata.pages),
    type: normalizeText(metadata.type),
    abstract: normalizeText(metadata.abstract),
    source_url: normalizeText(metadata.source_url) || `https://doi.org/${doi}`,
    raw_json: metadata.raw_json || metadata.rawJson || {},
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

async function upsertMetadata(client, metadata) {
  await client.query(
    `insert into publication_metadata
     (doi, title, authors, container_title, publisher, published_date, year, volume, issue, pages, type, abstract, source_url, raw_json)
     values ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
     on conflict (doi) do update set
       title = excluded.title,
       authors = excluded.authors,
       container_title = excluded.container_title,
       publisher = excluded.publisher,
       published_date = excluded.published_date,
       year = excluded.year,
       volume = excluded.volume,
       issue = excluded.issue,
       pages = excluded.pages,
       type = excluded.type,
       abstract = excluded.abstract,
       source_url = excluded.source_url,
       raw_json = excluded.raw_json,
       updated_at = now()`,
    [
      metadata.doi,
      metadata.title,
      JSON.stringify(metadata.authors),
      metadata.container_title,
      metadata.publisher,
      metadata.published_date,
      metadata.year,
      metadata.volume,
      metadata.issue,
      metadata.pages,
      metadata.type,
      metadata.abstract,
      metadata.source_url,
      JSON.stringify(metadata.raw_json),
    ]
  );
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

router.post("/from-doi", requireAuthenticatedUser, async (req, res) => {
  const doi = normalizeDoi(req.body?.doi || req.body?.metadata?.doi);

  if (!doi || !isValidDoi(doi)) {
    res.status(400).json({ error: "invalid_doi", message: "DOI nuk eshte valid." });
    return;
  }

  const metadata = normalizeMetadata(req.body?.metadata, doi);
  const client = await db.connect();

  try {
    await client.query("begin");

    if (metadata.title || metadata.container_title || metadata.publisher || metadata.year) {
      await upsertMetadata(client, metadata);
    }

    const metadataResult = await client.query(
      `select doi, title, container_title, publisher, year, source_url
       from publication_metadata
       where doi = $1
       limit 1`,
      [doi]
    );
    const storedMetadata = metadataResult.rows[0] || metadata;
    const title = normalizeText(storedMetadata.title) || doi;
    const venue = normalizeText(storedMetadata.container_title);
    const publicationYear = normalizeYear(storedMetadata.year);

    const result = await client.query(
      `insert into publications
       (owner_id, doi, title, venue, publication_year, status)
       values ($1, $2, $3, $4, $5, 'draft')
       on conflict (owner_id, doi) where doi is not null do update set
         title = excluded.title,
         venue = excluded.venue,
         publication_year = excluded.publication_year,
         updated_at = now()
       returning id, doi, title, venue, publication_year, status, created_at, updated_at`,
      [req.user.id, doi, title, venue || null, publicationYear]
    );

    await client.query("commit");

    res.status(201).json({ data: mapPublication(result.rows[0]) });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("POST /api/publications/from-doi failed:", error);
    res.status(500).json({ error: "save_failed" });
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
