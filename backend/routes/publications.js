import express from "express";
import db from "../config/db.js";
import {
  DoiLookupError,
  getVerifiedDoiMetadata,
  isValidDoi,
  normalizeAbstractText,
  normalizeDoi,
  normalizeYear,
} from "../services/doiMetadata.service.js";

const router = express.Router();
const VALID_PUBLICATION_STATUSES = new Set(["draft", "submitted", "in_review", "approved", "rejected"]);
const PROFESSOR_PUBLICATION_STATUSES = new Set(["draft", "submitted"]);
const PUBLICATION_REVIEW_ROLES = new Set(["admin", "committee", "prorector"]);
const VALID_PUBLICATION_TYPES = new Set(["", "journal_article", "conference_paper", "book"]);
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

function normalizeRole(value) {
  const normalized = normalizeText(value).toLowerCase();
  const roleAliases = {
    administrator: "admin",
    admin: "admin",
    committee: "committee",
    commission: "committee",
    komision: "committee",
    komisioni: "committee",
    prorektor: "prorector",
    prorector: "prorector",
    prorektorat: "prorector",
    professor: "professor",
  };

  return roleAliases[normalized] || normalized || "professor";
}

function canReviewPublications(user) {
  return PUBLICATION_REVIEW_ROLES.has(normalizeRole(user?.role));
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeOptionalDate(value) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : text;
}

function normalizeUrl(value) {
  const text = normalizeText(value);
  return /^https?:\/\//i.test(text) ? text : "";
}

function isValidHttpUrl(value) {
  return /^https?:\/\//i.test(normalizeText(value));
}

function normalizePublicationType(value) {
  const normalized = normalizeText(value).toLowerCase().replace(/[-\s]+/g, "_");
  const typeMap = {
    article_journal: "journal_article",
    journal: "journal_article",
    journal_article: "journal_article",
    paper_conference: "conference_paper",
    proceedings_article: "conference_paper",
    conference: "conference_paper",
    conference_paper: "conference_paper",
    book: "book",
    book_chapter: "book",
    chapter: "book",
    posted_content: "",
    preprint: "",
    accepted_in_press: "",
  };

  return typeMap[normalized] || normalized;
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

function normalizeAuthors(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((author, index) => {
      const fullName = normalizeText(author.full_name || author.fullName || author.name);
      const givenName = normalizeText(author.given_name || author.givenName);
      const familyName = normalizeText(author.family_name || author.familyName);
      const resolvedFullName = fullName || [givenName, familyName].filter(Boolean).join(" ");

      return {
        fullName: resolvedFullName,
        givenName,
        familyName,
        orcid: normalizeText(author.orcid),
        affiliation: normalizeText(author.affiliation),
        isMainAuthor: index === 0,
        isCorrespondingAuthor: normalizeBoolean(author.is_corresponding_author ?? author.isCorrespondingAuthor),
        authorOrder: index + 1,
      };
    })
    .filter((author) => author.fullName || author.givenName || author.familyName || author.orcid || author.affiliation);
}

function normalizeIndexing(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      source: normalizeText(item.source),
      quartile: normalizeText(item.quartile),
      impactFactor: normalizeText(item.impact_factor || item.impactFactor),
      indexedUrl: normalizeUrl(item.indexed_url || item.indexedUrl),
    }))
    .filter((item) => item.source || item.quartile || item.impactFactor || item.indexedUrl);
}

function normalizeEvidenceLinks(value, errors) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const rawUrl = normalizeText(item.file_url || item.fileUrl || item.url);
      const label = normalizeText(item.file_type || item.fileType || item.label);
      const rawUploadedAt = normalizeText(item.uploaded_at || item.uploadedAt);
      const uploadedAt = rawUploadedAt ? normalizeOptionalDate(rawUploadedAt) : null;

      if (!rawUrl && !label && !uploadedAt) {
        return null;
      }

      if (!rawUrl || !isValidHttpUrl(rawUrl)) {
        errors.push({
          field: `evidenceLinks.${index}.url`,
          message: "Evidence link duhet te filloje me http ose https.",
        });
        return null;
      }

      if (rawUploadedAt && !uploadedAt) {
        errors.push({
          field: `evidenceLinks.${index}.uploadedAt`,
          message: "Data e evidence link nuk eshte valide.",
        });
        return null;
      }

      return {
        fileUrl: rawUrl,
        fileType: label,
        uploadedAt,
      };
    })
    .filter(Boolean);
}

function normalizePublicationPayload(body = {}, options = {}) {
  const hasIndexingInput = Object.prototype.hasOwnProperty.call(body, "indexing");
  const hasEvidenceLinksInput =
    Object.prototype.hasOwnProperty.call(body, "evidenceLinks")
    || Object.prototype.hasOwnProperty.call(body, "evidence_links")
    || Object.prototype.hasOwnProperty.call(body, "attachments");
  const doi = normalizeDoi(body.doi);
  const title = normalizeText(body.title);
  const publicationType = normalizePublicationType(body.publicationType || body.publication_type);
  const publicationYear = normalizeYear(body.publicationYear ?? body.publication_year);
  const publicationDate = normalizeOptionalDate(body.publicationDate || body.publication_date);
  const status = normalizeText(body.status || "draft");
  const sourceUrl = normalizeUrl(body.sourceUrl || body.source_url);
  const indexedMetadataSource = normalizeText(body.metadataSource || body.metadata_source);
  const metadataSource = indexedMetadataSource || "manual";
  const errors = [];

  if (!title) {
    errors.push({ field: "title", message: "Titulli i publikimit eshte obligativ." });
  }

  if (title.length > 500) {
    errors.push({ field: "title", message: "Titulli i publikimit eshte shume i gjate." });
  }

  if (publicationType && !VALID_PUBLICATION_TYPES.has(publicationType)) {
    errors.push({ field: "publicationType", message: "Tipi i publikimit nuk eshte valid." });
  }

  if ((body.publicationYear ?? body.publication_year) && publicationYear === null) {
    errors.push({ field: "publicationYear", message: "Viti i publikimit nuk eshte valid." });
  }

  if ((body.publicationDate || body.publication_date) && !publicationDate) {
    errors.push({ field: "publicationDate", message: "Data e publikimit nuk eshte valide." });
  }

  if (doi && !isValidDoi(doi)) {
    errors.push({ field: "doi", message: "DOI nuk eshte valid." });
  }

  if (options.requireDoi && !doi) {
    errors.push({ field: "doi", message: "DOI nuk eshte valid." });
  }

  if (!VALID_PUBLICATION_STATUSES.has(status)) {
    errors.push({ field: "status", message: "Statusi i publikimit nuk eshte valid." });
  }

  if (!canReviewPublications(options.user) && !PROFESSOR_PUBLICATION_STATUSES.has(status)) {
    errors.push({
      field: "status",
      message: "Profesori mund ta ruaje publikimin vetem si draft ose submitted.",
    });
  }

  if ((body.sourceUrl || body.source_url) && !sourceUrl) {
    errors.push({ field: "sourceUrl", message: "Linku i publikimit duhet te filloje me http ose https." });
  }

  if (publicationType === "conference_paper" && !normalizeText(body.venue || body.journal)) {
    errors.push({ field: "venue", message: "Konferenca eshte obligative per punim konference." });
  }

  if (publicationType === "book" && !normalizeText(body.publisher) && !normalizeText(body.isbn)) {
    errors.push({ field: "publisher", message: "Book / Chapter duhet te kete botues ose ISBN." });
  }

  const authors = normalizeAuthors(body.authors);
  const indexing = hasIndexingInput ? normalizeIndexing(body.indexing) : undefined;
  const evidenceLinks = hasEvidenceLinksInput
    ? normalizeEvidenceLinks(body.evidenceLinks || body.evidence_links || body.attachments, errors)
    : undefined;
  const metadataVerified = normalizeBoolean(body.metadataVerified ?? body.metadata_verified) || metadataSource === "doi";
  const externalMetadataId = normalizeDoi(body.externalMetadataId || body.external_metadata_id)
    || (metadataSource === "doi" ? doi : null);
  const correspondingAuthorCount = authors.filter((author) => author.isCorrespondingAuthor).length;

  if (!authors.length) {
    errors.push({ field: "authors", message: "Shto se paku nje autor per publikimin." });
  }

  if (correspondingAuthorCount > 1) {
    errors.push({ field: "authors", message: "Vetem nje autor mund te shenohet si autor korrespondent." });
  }

  return {
    errors,
    values: {
      doi: doi || null,
      title,
      abstract: normalizeAbstractText(body.abstract),
      publicationType,
      venue: normalizeText(body.venue || body.journal),
      publisher: normalizeText(body.publisher),
      publicationDate,
      publicationYear,
      sourceUrl,
      volume: normalizeText(body.volume),
      issue: normalizeText(body.issue),
      pages: normalizeText(body.pages),
      issn: normalizeText(body.issn),
      isbn: normalizeText(body.isbn),
      status,
      authors,
      indexing,
      evidenceLinks,
      attachments: evidenceLinks,
      hasIndexingInput,
      hasEvidenceLinksInput,
      metadataSource,
      metadataVerified,
      externalMetadataId,
    },
  };
}

function getArrayField(row, field) {
  const value = row[field];
  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function getPublicationAuthors(row) {
  const authors = getArrayField(row, "authors");

  if (authors.length) {
    return authors;
  }

  return getArrayField(row, "metadata_authors").map((author, index) =>
    metadataAuthorToPublicationAuthor(author, index)
  );
}

function mapPublication(row) {
  const evidenceLinks = getArrayField(row, "evidence_links").length
    ? getArrayField(row, "evidence_links")
    : getArrayField(row, "attachments");
  const authors = getPublicationAuthors(row);
  const publicationType = normalizePublicationType(row.publication_type || row.metadata_type);

  return {
    id: row.id,
    ownerId: row.owner_id || null,
    owner_id: row.owner_id || null,
    title: row.title || "",
    abstract: normalizeAbstractText(row.abstract),
    publicationType,
    publication_type: publicationType,
    venue: row.venue || "",
    publisher: row.publisher || "",
    publicationDate: row.publication_date || null,
    publication_date: row.publication_date || null,
    publicationYear: row.publication_year || row.year || "",
    publication_year: row.publication_year || row.year || "",
    doi: row.doi || "",
    sourceUrl: row.source_url || "",
    source_url: row.source_url || "",
    volume: row.volume || "",
    issue: row.issue || "",
    pages: row.pages || "",
    issn: row.issn || "",
    isbn: row.isbn || "",
    authors: authors.map((author, index) => ({
      fullName: author.full_name || author.fullName || "",
      full_name: author.full_name || author.fullName || "",
      givenName: author.given_name || author.givenName || "",
      given_name: author.given_name || author.givenName || "",
      familyName: author.family_name || author.familyName || "",
      family_name: author.family_name || author.familyName || "",
      orcid: author.orcid || "",
      affiliation: author.affiliation || "",
      authorOrder: author.author_order || author.authorOrder || index + 1,
      author_order: author.author_order || author.authorOrder || index + 1,
      isMainAuthor: index === 0,
      is_main_author: index === 0,
      isCorrespondingAuthor: Boolean(author.is_corresponding_author ?? author.isCorrespondingAuthor),
      is_corresponding_author: Boolean(author.is_corresponding_author ?? author.isCorrespondingAuthor),
    })),
    indexing: getArrayField(row, "indexing").map((item) => ({
      source: item.source || "",
      quartile: item.quartile || "",
      impactFactor: item.impact_factor || item.impactFactor || "",
      impact_factor: item.impact_factor || item.impactFactor || "",
      indexedUrl: item.indexed_url || item.indexedUrl || "",
      indexed_url: item.indexed_url || item.indexedUrl || "",
    })),
    identifiers: getArrayField(row, "identifiers").map((item) => ({
      type: item.type || item.identifier_type || "",
      identifierType: item.type || item.identifier_type || "",
      identifier_type: item.type || item.identifier_type || "",
      value: item.value || item.identifier_value || "",
      identifierValue: item.value || item.identifier_value || "",
      identifier_value: item.value || item.identifier_value || "",
    })),
    evidenceLinks: evidenceLinks.map((item) => ({
      url: item.file_url || item.fileUrl || item.url || "",
      fileUrl: item.file_url || item.fileUrl || item.url || "",
      file_url: item.file_url || item.fileUrl || item.url || "",
      label: item.file_type || item.fileType || item.label || "",
      fileType: item.file_type || item.fileType || item.label || "",
      file_type: item.file_type || item.fileType || item.label || "",
      uploadedAt: item.uploaded_at || item.uploadedAt || null,
      uploaded_at: item.uploaded_at || item.uploadedAt || null,
    })),
    evidence_links: evidenceLinks.map((item) => ({
      url: item.file_url || item.fileUrl || item.url || "",
      file_url: item.file_url || item.fileUrl || item.url || "",
      label: item.file_type || item.fileType || item.label || "",
      file_type: item.file_type || item.fileType || item.label || "",
      uploaded_at: item.uploaded_at || item.uploadedAt || null,
    })),
    attachments: evidenceLinks.map((item) => ({
      fileUrl: item.file_url || item.fileUrl || "",
      file_url: item.file_url || item.fileUrl || "",
      fileType: item.file_type || item.fileType || "",
      file_type: item.file_type || item.fileType || "",
      uploadedAt: item.uploaded_at || item.uploadedAt || null,
      uploaded_at: item.uploaded_at || item.uploadedAt || null,
    })),
    metadataSource: row.metadata_source || "manual",
    metadata_source: row.metadata_source || "manual",
    metadataVerified: Boolean(row.metadata_verified),
    metadata_verified: Boolean(row.metadata_verified),
    externalMetadataId: row.external_metadata_id || "",
    external_metadata_id: row.external_metadata_id || "",
    status: row.status || "draft",
    createdAt: row.created_at || null,
    created_at: row.created_at || null,
    updatedAt: row.updated_at || null,
    updated_at: row.updated_at || null,
  };
}

const PUBLICATION_SELECT_SQL = `
  p.id, p.owner_id, p.doi, p.title, p.abstract, p.publication_type, p.venue,
  p.publisher, p.publication_date, p.publication_year, p.source_url, p.volume,
  p.issue, p.pages, p.issn, p.isbn, p.metadata_source, p.metadata_verified,
  p.external_metadata_id, p.status, p.created_at, p.updated_at,
  m.type as metadata_type, m.authors as metadata_authors,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'full_name', pa.full_name,
      'given_name', pa.given_name,
      'family_name', pa.family_name,
      'orcid', pa.orcid,
      'affiliation', pa.affiliation,
      'is_main_author', pa.is_main_author,
      'is_corresponding_author', pa.is_corresponding_author,
      'author_order', coalesce(pa.author_order, pa.position)
    ) order by coalesce(pa.author_order, pa.position), pa.created_at)
    from publication_authors pa
    where pa.publication_id = p.id
  ), '[]'::jsonb) as authors,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'source', pi.source,
      'quartile', pi.quartile,
      'impact_factor', pi.impact_factor,
      'indexed_url', pi.indexed_url
    ) order by pi.created_at)
    from publication_indexing pi
    where pi.publication_id = p.id
  ), '[]'::jsonb) as indexing,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'file_url', pat.file_url,
      'file_type', pat.file_type,
      'uploaded_at', pat.uploaded_at
    ) order by pat.uploaded_at desc)
    from publication_attachments pat
    where pat.publication_id = p.id
  ), '[]'::jsonb) as evidence_links,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'type', pi.identifier_type,
      'value', pi.identifier_value
    ) order by pi.identifier_type, pi.identifier_value)
    from publication_identifiers pi
    where pi.publication_id = p.id
  ), '[]'::jsonb) as identifiers
`;

const LEGACY_PUBLICATION_SELECT_SQL = `
  p.id, p.owner_id, p.doi, p.title, p.venue, p.publication_year, p.status, p.created_at, p.updated_at,
  m.container_title, m.publisher, m.year, m.type as metadata_type, m.authors as metadata_authors, m.source_url
`;

let unifiedPublicationSchemaCache = null;

async function hasUnifiedPublicationSchema(dbOrClient) {
  if (unifiedPublicationSchemaCache !== null) {
    return unifiedPublicationSchemaCache;
  }

  const columnsResult = await dbOrClient.query(
    `select column_name
     from information_schema.columns
     where table_schema = current_schema()
       and table_name = 'publications'
       and column_name in (
         'abstract',
         'publication_type',
         'publisher',
         'publication_date',
         'source_url',
         'volume',
         'issue',
         'pages',
         'issn',
         'isbn',
         'metadata_source',
         'metadata_verified',
         'external_metadata_id'
       )`
  );
  const tablesResult = await dbOrClient.query(
    `select table_name
     from information_schema.tables
     where table_schema = current_schema()
       and table_name in ('publication_authors', 'publication_indexing', 'publication_attachments', 'publication_identifiers')`
  );

  unifiedPublicationSchemaCache = columnsResult.rows.length === 13 && tablesResult.rows.length === 4;
  return unifiedPublicationSchemaCache;
}

async function replacePublicationChildren(client, publicationId, values) {
  await Promise.all([
    client.query("delete from publication_identifiers where publication_id = $1", [publicationId]),
    client.query("delete from publication_authors where publication_id = $1", [publicationId]),
    ...(values.hasIndexingInput ? [client.query("delete from publication_indexing where publication_id = $1", [publicationId])] : []),
    ...(values.hasEvidenceLinksInput ? [client.query("delete from publication_attachments where publication_id = $1", [publicationId])] : []),
  ]);

  for (const [index, author] of values.authors.entries()) {
    const authorOrder = index + 1;
    await client.query(
      `insert into publication_authors
       (publication_id, full_name, given_name, family_name, orcid, affiliation, is_main_author, is_corresponding_author, position, author_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        publicationId,
        author.fullName,
        author.givenName,
        author.familyName,
        author.orcid,
        author.affiliation,
        authorOrder === 1,
        author.isCorrespondingAuthor,
        authorOrder,
        authorOrder,
      ]
    );
  }

  for (const item of values.indexing || []) {
    await client.query(
      `insert into publication_indexing
       (publication_id, source, quartile, impact_factor, indexed_url)
       values ($1, $2, $3, $4, $5)`,
      [publicationId, item.source, item.quartile, item.impactFactor, item.indexedUrl]
    );
  }

  for (const item of values.evidenceLinks || []) {
    await client.query(
      `insert into publication_attachments
       (publication_id, file_url, file_type, uploaded_at)
       values ($1, $2, $3, coalesce($4::timestamptz, now()))`,
      [publicationId, item.fileUrl, item.fileType, item.uploadedAt || null]
    );
  }

  const identifiers = [
    ["doi", values.doi],
    ["issn", values.issn],
    ["isbn", values.isbn],
  ].filter(([, value]) => value);

  for (const [type, value] of identifiers) {
    await client.query(
      `insert into publication_identifiers (publication_id, identifier_type, identifier_value)
       values ($1, $2, $3)
       on conflict do nothing`,
      [publicationId, type, value]
    );
  }
}

async function fetchPublicationById(client, publicationId, ownerId) {
  const isUnified = await hasUnifiedPublicationSchema(client);

  const { rows } = await client.query(
    `select ${isUnified ? PUBLICATION_SELECT_SQL : LEGACY_PUBLICATION_SELECT_SQL}
     from publications p
     ${isUnified ? "left join publication_metadata m on m.doi = coalesce(p.external_metadata_id, p.doi)" : "left join publication_metadata m on m.doi = p.doi"}
     where p.id = $1
       and ($2::uuid is null or p.owner_id = $2)
     limit 1`,
    [publicationId, ownerId]
  );

  return rows[0] || null;
}

async function loadCurrentUser(userId) {
  const { rows } = await db.query(
    `select id, email, full_name, role
     from users
     where id = $1
     limit 1`,
    [userId]
  );

  return rows[0] || null;
}

async function fetchPublicationByDoi(client, ownerId, doi) {
  const isUnified = await hasUnifiedPublicationSchema(client);

  const { rows } = await client.query(
    `select ${isUnified ? PUBLICATION_SELECT_SQL : LEGACY_PUBLICATION_SELECT_SQL}
     from publications p
     ${isUnified ? "left join publication_metadata m on m.doi = coalesce(p.external_metadata_id, p.doi)" : "left join publication_metadata m on m.doi = p.doi"}
     where p.owner_id = $1 and p.doi = $2
     limit 1`,
    [ownerId, doi]
  );

  return rows[0] || null;
}

function sendPublicationError(res, status, error, message, extra = {}) {
  res.status(status).json({ error, message, ...extra });
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
  return { limited: false, retryAfterMs: 0 };
}

function extractFirstArrayValue(value) {
  return Array.isArray(value) ? normalizeText(value[0]) : normalizeText(value);
}

function normalizeComparableName(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function metadataAuthorName(author) {
  if (typeof author === "string") return normalizeText(author);
  return normalizeText(author?.fullName || author?.full_name || author?.name);
}

function metadataAuthorToPublicationAuthor(author, index, currentUser = {}, mainAuthorIndex = 0) {
  if (typeof author === "string") {
    return {
      fullName: normalizeText(author),
      givenName: "",
      familyName: "",
      orcid: "",
      affiliation: "",
      isMainAuthor: index === mainAuthorIndex,
      isCorrespondingAuthor: false,
      authorOrder: index + 1,
    };
  }

  return {
    fullName: normalizeText(author?.fullName || author?.full_name || author?.name),
    givenName: normalizeText(author?.givenName || author?.given_name),
    familyName: normalizeText(author?.familyName || author?.family_name),
    orcid: normalizeText(author?.orcid) || (index === mainAuthorIndex ? normalizeText(currentUser.orcid_id || currentUser.orcidId) : ""),
    affiliation: normalizeText(author?.affiliation),
    isMainAuthor: index === mainAuthorIndex,
    isCorrespondingAuthor: Boolean(author?.isCorrespondingAuthor ?? author?.is_corresponding_author),
    authorOrder: index + 1,
  };
}

function metadataToPublicationPayload(metadata = {}, currentUser = {}) {
  const raw = metadata.raw_json || {};
  const issn = metadata.issn || extractFirstArrayValue(raw.ISSN || raw.issn);
  const isbn = metadata.isbn || extractFirstArrayValue(raw.ISBN || raw.isbn);
  const metadataAuthors = Array.isArray(metadata.authors) ? metadata.authors : [];
  const currentUserName = normalizeComparableName(currentUser.full_name || currentUser.name);
  const matchedAuthorIndex = currentUserName
    ? metadataAuthors.findIndex((author) => normalizeComparableName(metadataAuthorName(author)) === currentUserName)
    : -1;
  const mainAuthorIndex = matchedAuthorIndex >= 0 ? matchedAuthorIndex : 0;

  return {
    doi: metadata.doi || "",
    title: metadata.title || "",
    abstract: metadata.abstract || "",
    publicationType: metadata.type || "",
    venue: metadata.container_title || "",
    publisher: metadata.publisher || "",
    publicationDate: /^\d{4}-\d{1,2}-\d{1,2}$/.test(metadata.published_date || "")
      ? metadata.published_date.split("-").map((part) => part.padStart(2, "0")).join("-")
      : "",
    publicationYear: metadata.year || "",
    sourceUrl: metadata.source_url || "",
    volume: metadata.volume || "",
    issue: metadata.issue || "",
    pages: metadata.pages || "",
    issn,
    isbn,
    status: "draft",
    authors: metadataAuthors.map((author, index) =>
      metadataAuthorToPublicationAuthor(author, index, currentUser, mainAuthorIndex)
    ),
    indexing: [],
    evidenceLinks: [],
    attachments: [],
    metadataSource: "doi",
    metadataVerified: true,
    externalMetadataId: metadata.doi || "",
  };
}

async function createPublication(client, ownerId, values) {
  const isUnified = await hasUnifiedPublicationSchema(client);

  if (!isUnified) {
    const existing = values.doi ? await fetchPublicationByDoi(client, ownerId, values.doi) : null;

    if (existing) {
      await client.query(
        `update publications
         set title = $3,
             venue = $4,
             publication_year = $5,
             status = $6,
             updated_at = now()
         where id = $1 and owner_id = $2`,
        [
          existing.id,
          ownerId,
          values.title,
          values.venue || null,
          values.publicationYear,
          values.status,
        ]
      );

      return fetchPublicationById(client, existing.id, ownerId);
    }

    const { rows } = await client.query(
      `insert into publications
       (owner_id, doi, title, venue, publication_year, status)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        ownerId,
        values.doi,
        values.title,
        values.venue || null,
        values.publicationYear,
        values.status,
      ]
    );

    return fetchPublicationById(client, rows[0].id, ownerId);
  }

  const { rows } = await client.query(
    `insert into publications
     (owner_id, doi, title, abstract, publication_type, venue, publisher, publication_date,
      publication_year, source_url, volume, issue, pages, issn, isbn, status,
      metadata_source, metadata_verified, external_metadata_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     returning id`,
    [
      ownerId,
      values.doi,
      values.title,
      values.abstract,
      values.publicationType,
      values.venue || null,
      values.publisher,
      values.publicationDate,
      values.publicationYear,
      values.sourceUrl,
      values.volume,
      values.issue,
      values.pages,
      values.issn,
      values.isbn,
      values.status,
      values.metadataSource,
      values.metadataVerified,
      values.externalMetadataId,
    ]
  );

  await replacePublicationChildren(client, rows[0].id, values);
  return fetchPublicationById(client, rows[0].id, ownerId);
}

router.get("/", requireAuthenticatedUser, async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const q = normalizeText(req.query.q || req.query.search);
  const status = normalizeText(req.query.status);
  const filters = ["p.owner_id = $1"];
  const params = [req.user.id];

  if (status) {
    if (!VALID_PUBLICATION_STATUSES.has(status)) {
      res.status(400).json({ error: "invalid_status", message: "Statusi i publikimit nuk eshte valid." });
      return;
    }

    params.push(status);
    filters.push(`p.status = $${params.length}`);
  }

  try {
    const isUnified = await hasUnifiedPublicationSchema(db);

    if (q) {
      params.push(`%${q}%`);
      const qParam = params.length;
      filters.push(isUnified
        ? `(
            p.title ilike $${qParam}
            or p.venue ilike $${qParam}
            or p.publisher ilike $${qParam}
            or p.doi ilike $${qParam}
            or p.abstract ilike $${qParam}
            or p.publication_type ilike $${qParam}
            or cast(p.publication_year as text) ilike $${qParam}
            or exists (select 1 from publication_authors pa where pa.publication_id = p.id and pa.full_name ilike $${qParam})
            or exists (select 1 from publication_indexing pi where pi.publication_id = p.id and pi.source ilike $${qParam})
          )`
        : `(p.title ilike $${qParam} or p.venue ilike $${qParam} or p.doi ilike $${qParam} or m.publisher ilike $${qParam} or m.container_title ilike $${qParam})`);
    }

    const resolvedWhereClause = filters.join(" and ");
    const dataParams = [...params, limit, offset];
    const limitParam = dataParams.length - 1;
    const offsetParam = dataParams.length;
    const [listResult, countResult] = await Promise.all([
      db.query(
        `select ${isUnified ? PUBLICATION_SELECT_SQL : LEGACY_PUBLICATION_SELECT_SQL}
         from publications p
         ${isUnified ? "left join publication_metadata m on m.doi = coalesce(p.external_metadata_id, p.doi)" : "left join publication_metadata m on m.doi = p.doi"}
         where ${resolvedWhereClause}
         order by p.updated_at desc, p.created_at desc
         limit $${limitParam} offset $${offsetParam}`,
        dataParams
      ),
      db.query(
        `select count(*)::int as total
         from publications p
         ${isUnified ? "left join publication_metadata m on m.doi = coalesce(p.external_metadata_id, p.doi)" : "left join publication_metadata m on m.doi = p.doi"}
         where ${resolvedWhereClause}`,
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
    res.status(500).json({ error: "list_failed", message: "Publikimet nuk u ngarkuan." });
  }
});

router.post("/", requireAuthenticatedUser, async (req, res) => {
  const currentUser = (await loadCurrentUser(req.user.id)) || req.user;
  const { errors, values } = normalizePublicationPayload(req.body, { user: currentUser });

  if (errors.length) {
    res.status(400).json({ error: "validation_failed", message: errors[0].message, errors });
    return;
  }

  const client = await db.connect();

  try {
    await client.query("begin");
    const row = await createPublication(client, req.user.id, values);
    await client.query("commit");
    res.status(201).json({ data: mapPublication(row) });
  } catch (error) {
    await client.query("rollback").catch(() => {});

    if (error.code === "23505") {
      sendPublicationError(res, 409, "duplicate_publication", "Ky publikim ekziston tashme ne listen tuaj.");
      return;
    }

    console.error("POST /api/publications failed:", error);
    sendPublicationError(res, 500, "save_failed", "Publikimi nuk u ruajt.");
  } finally {
    client.release();
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

    const existingPublication = await fetchPublicationByDoi(client, req.user.id, doi);

    if (existingPublication) {
      await client.query("commit");
      res.status(200).json({
        data: mapPublication(existingPublication),
        duplicate: true,
      });
      return;
    }

    const currentUser = (await loadCurrentUser(req.user.id)) || req.user;
    const { metadata } = await getVerifiedDoiMetadata(client, doi);
    const prefill = metadataToPublicationPayload(metadata, currentUser);
    const { errors, values } = normalizePublicationPayload(
      { ...prefill, ...(req.body?.publication || {}) },
      { user: currentUser }
    );

    if (errors.length) {
      await client.query("rollback");
      res.status(400).json({ error: "validation_failed", message: errors[0].message, errors });
      return;
    }

    const row = await createPublication(client, req.user.id, values);
    await client.query("commit");
    res.status(201).json({ data: mapPublication(row) });
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

router.get("/:id", requireAuthenticatedUser, async (req, res) => {
  try {
    const currentUser = (await loadCurrentUser(req.user.id)) || req.user;
    const row = await fetchPublicationById(db, req.params.id, canReviewPublications(currentUser) ? null : req.user.id);

    if (!row) {
      res.status(404).json({ error: "not_found", message: "Publikimi nuk u gjet." });
      return;
    }

    res.json({ data: mapPublication(row) });
  } catch (error) {
    console.error("GET /api/publications/:id failed:", error);
    res.status(500).json({ error: "load_failed", message: "Publikimi nuk u ngarkua." });
  }
});

router.put("/:id", requireAuthenticatedUser, async (req, res) => {
  const currentUser = (await loadCurrentUser(req.user.id)) || req.user;
  const { errors, values } = normalizePublicationPayload(req.body, { user: currentUser });

  if (errors.length) {
    res.status(400).json({ error: "validation_failed", message: errors[0].message, errors });
    return;
  }

  const client = await db.connect();

  try {
    await client.query("begin");

    const isUnified = await hasUnifiedPublicationSchema(client);
    const { rows } = isUnified
      ? await client.query(
          `update publications
           set doi = $3,
               title = $4,
               abstract = $5,
               publication_type = $6,
               venue = $7,
               publisher = $8,
               publication_date = $9::date,
               publication_year = $10,
               source_url = $11,
               volume = $12,
               issue = $13,
               pages = $14,
               issn = $15,
               isbn = $16,
               status = $17,
               metadata_source = $18,
               metadata_verified = $19,
               external_metadata_id = $20,
               updated_at = now()
           where id = $1
             and ($2::uuid is null or owner_id = $2)
           returning id`,
          [
            req.params.id,
            canReviewPublications(currentUser) ? null : req.user.id,
            values.doi,
            values.title,
            values.abstract,
            values.publicationType,
            values.venue || null,
            values.publisher,
            values.publicationDate,
            values.publicationYear,
            values.sourceUrl,
            values.volume,
            values.issue,
            values.pages,
            values.issn,
            values.isbn,
            values.status,
            values.metadataSource,
            values.metadataVerified,
            values.externalMetadataId,
          ]
        )
      : await client.query(
          `update publications
           set title = $3,
               venue = $4,
               publication_year = $5,
               status = $6,
               updated_at = now()
           where id = $1
             and ($2::uuid is null or owner_id = $2)
           returning id`,
          [
            req.params.id,
            canReviewPublications(currentUser) ? null : req.user.id,
            values.title,
            values.venue || null,
            values.publicationYear,
            values.status,
          ]
        );

    if (!rows[0]) {
      await client.query("rollback");
      res.status(404).json({ error: "not_found", message: "Publikimi nuk u gjet." });
      return;
    }

    if (isUnified) {
      await replacePublicationChildren(client, rows[0].id, values);
    }
    const row = await fetchPublicationById(client, rows[0].id, canReviewPublications(currentUser) ? null : req.user.id);
    await client.query("commit");
    res.json({ data: mapPublication(row) });
  } catch (error) {
    await client.query("rollback").catch(() => {});

    if (error.code === "23505") {
      sendPublicationError(res, 409, "duplicate_publication", "Ky publikim ekziston tashme ne listen tuaj.");
      return;
    }

    console.error("PUT /api/publications/:id failed:", error);
    res.status(500).json({ error: "update_failed", message: "Publikimi nuk u perditesua." });
  } finally {
    client.release();
  }
});

router.patch("/:id/status", requireAuthenticatedUser, async (req, res) => {
  const currentUser = (await loadCurrentUser(req.user.id)) || req.user;

  if (!canReviewPublications(currentUser)) {
    res.status(403).json({
      error: "forbidden",
      message: "Vetem admini, komisioni ose prorektorati mund te aprovoje/refuzoje publikime.",
    });
    return;
  }

  const status = normalizeText(req.body?.status);

  if (!VALID_PUBLICATION_STATUSES.has(status)) {
    res.status(400).json({ error: "invalid_status", message: "Statusi i publikimit nuk eshte valid." });
    return;
  }

  const client = await db.connect();

  try {
    await client.query("begin");
    const { rows } = await client.query(
      `update publications
       set status = $2,
           updated_at = now()
       where id = $1
       returning id`,
      [req.params.id, status]
    );

    if (!rows[0]) {
      await client.query("rollback");
      res.status(404).json({ error: "not_found", message: "Publikimi nuk u gjet." });
      return;
    }

    const row = await fetchPublicationById(client, rows[0].id, null);
    await client.query("commit");
    res.json({ data: mapPublication(row) });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("PATCH /api/publications/:id/status failed:", error);
    res.status(500).json({ error: "status_update_failed", message: "Statusi i publikimit nuk u perditesua." });
  } finally {
    client.release();
  }
});

router.delete("/:id", requireAuthenticatedUser, async (req, res) => {
  const client = await db.connect();

  try {
    await client.query("begin");
    const publication = await fetchPublicationById(client, req.params.id, req.user.id);

    if (!publication) {
      await client.query("rollback");
      res.status(404).json({ error: "not_found", message: "Publikimi nuk u gjet." });
      return;
    }

    const usageResult = await client.query(
      `select count(*)::int as count
       from reimbursements
       where publication_id = $1`,
      [req.params.id]
    );

    if (Number(usageResult.rows[0]?.count || 0) > 0) {
      await client.query("rollback");
      res.status(409).json({
        error: "publication_in_use",
        message: "Publikimi nuk mund te fshihet sepse eshte i lidhur me rimbursim.",
      });
      return;
    }

    const result = await client.query(
      `delete from publications
       where id = $1
         and owner_id = $2
       returning id`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      await client.query("rollback");
      res.status(404).json({ error: "not_found", message: "Publikimi nuk u gjet." });
      return;
    }

    await client.query("commit");
    res.json({ message: "Deleted" });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("DELETE /api/publications/:id failed:", error);
    res.status(500).json({ error: "delete_failed", message: "Publikimi nuk u fshi." });
  } finally {
    client.release();
  }
});

export default router;
