import express from "express";
import db from "../config/db.js";

const router = express.Router();

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
    .trim();
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeYear(value) {
  const year = Number(value);
  return Number.isInteger(year) ? year : null;
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
  try {
    const { rows } = await db.query(
      `select p.id, p.doi, p.title, p.venue, p.publication_year, p.status, p.created_at, p.updated_at,
              m.container_title, m.publisher, m.year, m.source_url
       from publications p
       left join publication_metadata m on m.doi = p.doi
       where p.owner_id = $1
       order by p.updated_at desc, p.created_at desc`,
      [req.user.id]
    );

    res.json(rows.map(mapPublication));
  } catch (error) {
    console.error("GET /api/publications failed:", error);
    res.status(500).json({ error: "list_failed" });
  }
});

router.post("/from-doi", requireAuthenticatedUser, async (req, res) => {
  const doi = normalizeDoi(req.body?.doi || req.body?.metadata?.doi);

  if (!doi) {
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

    const existingResult = await client.query(
      `select id
       from publications
       where owner_id = $1 and doi = $2
       order by updated_at desc
       limit 1`,
      [req.user.id, doi]
    );

    const result = existingResult.rows[0]
      ? await client.query(
          `update publications
           set title = $3,
               venue = $4,
               publication_year = $5,
               updated_at = now()
           where id = $1 and owner_id = $2
           returning id, doi, title, venue, publication_year, status, created_at, updated_at`,
          [existingResult.rows[0].id, req.user.id, title, venue || null, publicationYear]
        )
      : await client.query(
          `insert into publications
           (owner_id, doi, title, venue, publication_year, status)
           values ($1, $2, $3, $4, $5, 'draft')
           returning id, doi, title, venue, publication_year, status, created_at, updated_at`,
          [req.user.id, doi, title, venue || null, publicationYear]
        );

    await client.query("commit");

    res.status(existingResult.rows[0] ? 200 : 201).json({ data: mapPublication(result.rows[0]) });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("POST /api/publications/from-doi failed:", error);
    res.status(500).json({ error: "save_failed" });
  } finally {
    client.release();
  }
});

export default router;
