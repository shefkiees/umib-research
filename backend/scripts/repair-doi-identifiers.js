import "../config/env.js";

import db, { checkDbConnection } from "../config/db.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function firstTextValue(value) {
  const values = Array.isArray(value) ? value : [value];
  return normalizeText(values.find((item) => normalizeText(item)) || "");
}

function getRawIdentifierValue(raw = {}, key) {
  const upperKey = key.toUpperCase();
  const lowerKey = key.toLowerCase();
  const candidates = [
    raw?.[upperKey],
    raw?.[lowerKey],
    raw?._crossref?.[upperKey],
    raw?._crossref?.[lowerKey],
    raw?._doi_org?.[upperKey],
    raw?._doi_org?.[lowerKey],
  ];

  for (const candidate of candidates) {
    const value = firstTextValue(candidate);

    if (value) {
      return value;
    }
  }

  return "";
}

function extractIssnByType(raw = {}, targetType = "") {
  const target = normalizeText(targetType).toLowerCase();
  const values = [
    raw?.["issn-type"],
    raw?.["ISSN-type"],
    raw?._crossref?.["issn-type"],
    raw?._crossref?.["ISSN-type"],
    raw?._doi_org?.["issn-type"],
    raw?._doi_org?.["ISSN-type"],
  ].flatMap((value) => (Array.isArray(value) ? value : [value]));
  const match = values.find((item) => {
    const type = normalizeText(item?.type || item?.issnType || item?.issn_type).toLowerCase();
    return type === target;
  });

  return normalizeText(match?.value || match?.issn);
}

async function backfillPublicationMetadata(client) {
  const { rows } = await client.query(
    `select doi, title, issn, e_issn, isbn, raw_json
     from publication_metadata
     where (issn = '' or e_issn = '' or isbn = '')
       and raw_json <> '{}'::jsonb
     order by doi`
  );
  const repaired = [];

  for (const row of rows) {
    const nextIssn = row.issn || extractIssnByType(row.raw_json, "print") || getRawIdentifierValue(row.raw_json, "ISSN");
    const nextEIssn = row.e_issn || extractIssnByType(row.raw_json, "electronic") || getRawIdentifierValue(row.raw_json, "EISSN");
    const nextIsbn = row.isbn || getRawIdentifierValue(row.raw_json, "ISBN");

    if (nextIssn === row.issn && nextEIssn === row.e_issn && nextIsbn === row.isbn) {
      continue;
    }

    await client.query(
      `update publication_metadata
       set issn = $2,
           e_issn = $3,
           isbn = $4,
           updated_at = now()
       where doi = $1`,
      [row.doi, nextIssn, nextEIssn, nextIsbn]
    );

    repaired.push({
      doi: row.doi,
      title: row.title || "",
      issnBefore: row.issn || "",
      issnAfter: nextIssn || "",
      eIssnBefore: row.e_issn || "",
      eIssnAfter: nextEIssn || "",
      isbnBefore: row.isbn || "",
      isbnAfter: nextIsbn || "",
    });
  }

  return repaired;
}

async function backfillPublications(client) {
  const { rows } = await client.query(
    `update publications p
     set issn = coalesce(nullif(p.issn, ''), m.issn, ''),
         e_issn = coalesce(nullif(p.e_issn, ''), m.e_issn, ''),
         isbn = coalesce(nullif(p.isbn, ''), m.isbn, ''),
         updated_at = now()
     from publication_metadata m
     where m.doi = coalesce(p.external_metadata_id, p.doi)
       and (
         (p.issn = '' and m.issn <> '')
         or (p.e_issn = '' and m.e_issn <> '')
         or (p.isbn = '' and m.isbn <> '')
       )
     returning p.id, p.doi, p.title, p.issn, p.e_issn, p.isbn`
  );

  return rows.map((row) => ({
    id: row.id,
    doi: row.doi || "",
    title: row.title || "",
    issn: row.issn || "",
    eIssn: row.e_issn || "",
    isbn: row.isbn || "",
  }));
}

async function insertMissingPublicationIdentifiers(client) {
  const { rows: publications } = await client.query(
    `select id, doi, issn, e_issn, isbn
     from publications
     where coalesce(doi, '') <> ''
        or issn <> ''
        or e_issn <> ''
        or isbn <> ''
     order by id`
  );
  const inserted = [];

  for (const publication of publications) {
    const identifiers = [
      ["doi", publication.doi],
      ["issn", publication.issn],
      ["e_issn", publication.e_issn],
      ["isbn", publication.isbn],
    ].filter(([, value]) => normalizeText(value));

    for (const [type, value] of identifiers) {
      const result = await client.query(
        `insert into publication_identifiers (publication_id, identifier_type, identifier_value)
         values ($1, $2, $3)
         on conflict do nothing
         returning publication_id, identifier_type, identifier_value`,
        [publication.id, type, value]
      );

      if (result.rows[0]) {
        inserted.push({
          publicationId: result.rows[0].publication_id,
          type: result.rows[0].identifier_type,
          value: result.rows[0].identifier_value,
        });
      }
    }
  }

  return inserted;
}

function countRecovered(repairedRows, key) {
  return repairedRows.filter((row) => !row[`${key}Before`] && row[`${key}After`]).length;
}

async function repairDoiIdentifiers() {
  const connected = await checkDbConnection();

  if (!connected) {
    process.exitCode = 1;
    return;
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const metadataRows = await backfillPublicationMetadata(client);
    const publicationRows = await backfillPublications(client);
    const identifierRows = await insertMissingPublicationIdentifiers(client);

    await client.query("commit");

    const report = {
      publicationMetadata: {
        repairedRows: metadataRows.length,
        recoveredIssn: countRecovered(metadataRows, "issn"),
        recoveredEIssn: countRecovered(metadataRows, "eIssn"),
        recoveredIsbn: countRecovered(metadataRows, "isbn"),
        rows: metadataRows,
      },
      publications: {
        repairedRows: publicationRows.length,
        rows: publicationRows,
      },
      publicationIdentifiers: {
        insertedRows: identifierRows.length,
        insertedIssn: identifierRows.filter((row) => row.type === "issn").length,
        insertedEIssn: identifierRows.filter((row) => row.type === "e_issn").length,
        insertedIsbn: identifierRows.filter((row) => row.type === "isbn").length,
        insertedDoi: identifierRows.filter((row) => row.type === "doi").length,
        rows: identifierRows,
      },
    };

    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("DOI identifier repair failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end().catch(() => {});
  }
}

repairDoiIdentifiers();
