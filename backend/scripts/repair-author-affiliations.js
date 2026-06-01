import "../config/env.js";

import db, { checkDbConnection } from "../config/db.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeComparableName(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metadataAuthorName(author = {}) {
  return normalizeText(
    author.fullName
      || author.full_name
      || author.name
      || [author.givenName || author.given, author.familyName || author.family].filter(Boolean).join(" ")
  );
}

function metadataAuthorAffiliation(author = {}) {
  return normalizeText(author.affiliation);
}

async function hasPublicationAuthorsUpdatedAt(client) {
  const { rows } = await client.query(
    `select count(*)::int as count
     from information_schema.columns
     where table_schema = current_schema()
       and table_name = 'publication_authors'
       and column_name = 'updated_at'`
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function loadRepairCandidates(client) {
  const { rows } = await client.query(
    `select p.id as publication_id,
            p.doi,
            p.title,
            pa.id as publication_author_id,
            pa.full_name,
            pa.affiliation as current_affiliation,
            coalesce(pa.author_order, pa.position) as author_order,
            m.authors as metadata_authors
     from publications p
     join publication_metadata m on m.doi = coalesce(p.external_metadata_id, p.doi)
     join publication_authors pa on pa.publication_id = p.id
     where coalesce(pa.affiliation, '') = ''
       and exists (
         select 1
         from jsonb_array_elements(m.authors) author
         where coalesce(author->>'affiliation', '') <> ''
       )
     order by p.doi, p.id, coalesce(pa.author_order, pa.position), pa.created_at`
  );

  return rows;
}

function matchCandidate(row) {
  const metadataAuthors = Array.isArray(row.metadata_authors) ? row.metadata_authors : [];
  const authorOrder = Number(row.author_order || 0);
  const currentName = normalizeComparableName(row.full_name);
  const metadataAuthor = metadataAuthors[authorOrder - 1];
  const metadataName = normalizeComparableName(metadataAuthorName(metadataAuthor));
  const affiliation = metadataAuthorAffiliation(metadataAuthor);

  if (!metadataAuthor || !currentName || !metadataName || currentName !== metadataName || !affiliation) {
    return {
      matched: false,
      row: {
        publicationId: row.publication_id,
        publicationAuthorId: row.publication_author_id,
        doi: row.doi || "",
        title: row.title || "",
        authorOrder,
        fullName: row.full_name || "",
        metadataName: metadataAuthorName(metadataAuthor),
        metadataAffiliation: affiliation,
      },
    };
  }

  return {
    matched: true,
    row: {
      publicationId: row.publication_id,
      publicationAuthorId: row.publication_author_id,
      doi: row.doi || "",
      title: row.title || "",
      authorOrder,
      fullName: row.full_name || "",
      metadataName: metadataAuthorName(metadataAuthor),
      affiliationBefore: row.current_affiliation || "",
      affiliationAfter: affiliation,
      matchMethod: "publication_id_author_order_name",
    },
  };
}

async function repairAuthorAffiliations() {
  const connected = await checkDbConnection();

  if (!connected) {
    process.exitCode = 1;
    return;
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const hasUpdatedAt = await hasPublicationAuthorsUpdatedAt(client);
    const candidates = await loadRepairCandidates(client);
    const matched = [];
    const skipped = [];

    for (const candidate of candidates) {
      const result = matchCandidate(candidate);

      if (result.matched) {
        matched.push(result.row);
      } else {
        skipped.push(result.row);
      }
    }

    const repaired = [];

    for (const row of matched) {
      const result = await client.query(
        `update publication_authors
         set affiliation = $2${hasUpdatedAt ? ", updated_at = now()" : ""}
         where id = $1
           and coalesce(affiliation, '') = ''
         returning id`,
        [row.publicationAuthorId, row.affiliationAfter]
      );

      if (result.rows[0]) {
        repaired.push(row);
      }
    }

    await client.query("commit");

    console.log(JSON.stringify({
      scannedRows: candidates.length,
      matchedRows: matched.length,
      repairedRows: repaired.length,
      skippedRows: skipped.length,
      skipped,
      repaired,
    }, null, 2));
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("Author affiliation repair failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end().catch(() => {});
  }
}

repairAuthorAffiliations();
