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
import { createNotification } from "../services/notification.service.js";

const router = express.Router();
const VALID_PUBLICATION_STATUSES = new Set(["draft", "submitted", "in_review", "needs_correction", "approved", "rejected"]);
const PROFESSOR_PUBLICATION_STATUSES = new Set(["draft", "submitted"]);
const PUBLICATION_REVIEW_ROLES = new Set(["admin", "committee", "prorector"]);
const VALID_PUBLICATION_TYPES = new Set(["", "journal_article", "conference_paper", "book"]);
const VALID_METADATA_REVIEW_STATUSES = new Set(["unchecked", "in_review", "ok", "correction"]);
const VALID_INDEXING_PLATFORMS = new Set(["Scopus", "SCImago", "OpenAlex", "DOAJ", "Web of Science", "SCIE", "SSCI", "AHCI", "Other"]);
const VALID_INDEXING_SOURCES = new Set(["scopus", "scimago", "doaj", "openalex", "manual"]);
const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Dorezuar",
  in_review: "Ne shqyrtim",
  needs_correction: "Kthyer per korrigjim",
  approved: "Aprovuar",
  rejected: "Refuzuar",
};
const MAX_LIMIT = 50;
const DOI_IMPORT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DOI_IMPORT_RATE_LIMIT_MAX = 20;
const doiImportRateLimits = new Map();
let publicationReviewSchemaReady = false;

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

function normalizeAuthorAffiliation(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item?.name || item?.affiliation || item?.institution || item))
      .filter(Boolean)
      .join("; ");
  }

  return normalizeText(value?.name || value?.affiliation || value?.institution || value);
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

function supportsPublicationIndexing(publicationType) {
  return true;
}

function normalizeIndexingPlatform(value) {
  const text = normalizeText(value);
  const comparable = text.toLowerCase();

  if (!text) return "";
  if (comparable.includes("scopus") || comparable.includes("citescore")) return "Scopus";
  if (comparable.includes("scimago") || comparable.includes("sjr")) return "SCImago";
  if (comparable.includes("openalex")) return "OpenAlex";
  if (comparable.includes("doaj")) return "DOAJ";
  if (comparable.includes("web of science") || comparable.includes("clarivate")) return "Web of Science";
  if (["scie", "ssci", "ahci"].includes(comparable)) return text.toUpperCase();
  if (comparable === "other") return "Other";

  return text;
}

function normalizeIndexingCategory(value) {
  const text = normalizeText(value);
  const comparable = text.toLowerCase().replace(/\s+/g, "");

  if (!text) return "";
  if (/^q[1-4]$/i.test(text)) return text.toUpperCase();
  if (["scie", "ssci", "ahci"].includes(comparable)) return text.toUpperCase();
  if (["book/chapter", "bookchapter", "book", "chapter"].includes(comparable)) return "Book/Chapter";
  if (comparable === "other") return "Other";

  return text;
}

function normalizeQuartile(value) {
  const match = normalizeText(value).toUpperCase().match(/\bQ[1-4]\b/);

  return match?.[0] || "";
}

function normalizeIndexingSource(value) {
  const text = normalizeText(value).toLowerCase();

  if (!text) return "manual";
  if (text.includes("scopus") || text.includes("citescore")) return "scopus";
  if (text.includes("scimago") || text.includes("sjr")) return "scimago";
  if (text.includes("doaj")) return "doaj";
  if (text.includes("openalex")) return "openalex";

  return VALID_INDEXING_SOURCES.has(text) ? text : "manual";
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

  const authors = value
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
        affiliation: normalizeAuthorAffiliation(
          author.affiliation
          || author.affiliations
          || author.institution
          || author.organization
        ),
        isMainAuthor: index === 0,
        authorOrder: index + 1,
      };
    })
    .filter((author) => author.fullName || author.givenName || author.familyName || author.orcid || author.affiliation);

  return authors;
}

function normalizeIndexing(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      source: normalizeIndexingPlatform(item.source || item.platform),
      platform: normalizeIndexingPlatform(item.platform || item.source),
      sourceKey: normalizeIndexingSource(item.sourceKey || item.source_key || item.indexingSource || item.indexing_source || item.source),
      source_key: normalizeIndexingSource(item.sourceKey || item.source_key || item.indexingSource || item.indexing_source || item.source),
      category: normalizeText(item.category),
      quartile: normalizeQuartile(item.quartile),
      impactFactor: normalizeText(item.impact_factor || item.impactFactor),
      sjr: normalizeText(item.sjr),
      citeScore: normalizeText(item.cite_score || item.citeScore || item.citescore),
      indexedUrl: normalizeUrl(item.indexed_url || item.indexedUrl),
    }))
    .filter((item) => item.source || item.category || item.quartile || item.impactFactor || item.sjr || item.citeScore || item.indexedUrl);
}

function deriveAuthorAffiliation(authors = [], fallback = "") {
  return normalizeText(fallback)
    || (Array.isArray(authors) ? authors.map((author) => normalizeAuthorAffiliation(
      author?.affiliation
      || author?.affiliations
      || author?.institution
      || author?.organization
      || author?.currentAffiliation
      || author?.current_affiliation
    )).find(Boolean) : "")
    || "";
}

function deriveIndexingPlatform(indexing = [], fallback = "") {
  return normalizeIndexingPlatform(fallback)
    || (Array.isArray(indexing) ? indexing.map((item) => normalizeIndexingPlatform(item?.source || item?.platform || item?.sourceKey || item?.source_key)).find(Boolean) : "")
    || "";
}

function deriveIndexingCategory(indexing = [], publicationType = "", fallback = "") {
  return normalizeIndexingCategory(fallback)
    || (Array.isArray(indexing) ? indexing.map((item) => normalizeIndexingCategory(item?.category)).find(Boolean) : "")
    || "";
}

function createFieldSource(value, sourceWhenPresent = "manual") {
  const normalizedValue = Array.isArray(value)
    ? value.filter(Boolean)
    : normalizeText(value);

  return {
    value: normalizedValue,
    source: Array.isArray(normalizedValue) ? normalizedValue.length ? sourceWhenPresent : "empty" : normalizedValue ? sourceWhenPresent : "empty",
  };
}

function buildPublicationFieldSources(values = {}, metadataSource = "manual") {
  const baseSource = metadataSource === "doi" ? "api" : metadataSource === "mixed" ? "manual" : "manual";
  const indexing = Array.isArray(values.indexing) ? values.indexing : [];
  const firstIndexing = indexing.find((item) => item?.source || item?.category || item?.quartile || item?.impactFactor || item?.impact_factor || item?.sjr || item?.citeScore || item?.cite_score) || {};
  const indexingSource = values.indexingVerified || values.indexing_verified || firstIndexing.indexingVerified || firstIndexing.indexing_verified
    ? "lookup"
    : "manual";

  return {
    doi: createFieldSource(values.doi, baseSource),
    title: createFieldSource(values.title, baseSource),
    authors: createFieldSource((Array.isArray(values.authors) ? values.authors : []).map((author) => author?.fullName || author?.full_name || author?.name).filter(Boolean), baseSource),
    authorAffiliation: createFieldSource(values.authorAffiliation || values.author_affiliation || values.affiliation, baseSource),
    publicationType: createFieldSource(values.publicationType || values.publication_type, baseSource),
    venue: createFieldSource(values.venue || values.publishedIn || values.published_in || values.journal, baseSource),
    publisher: createFieldSource(values.publisher, baseSource),
    publicationDate: createFieldSource(values.publicationDate || values.publication_date, baseSource),
    publicationYear: createFieldSource(values.publicationYear || values.publication_year || values.year, baseSource),
    sourceUrl: createFieldSource(values.sourceUrl || values.source_url, baseSource),
    volume: createFieldSource(values.volume, baseSource),
    issue: createFieldSource(values.issue, baseSource),
    pages: createFieldSource(values.pages, baseSource),
    issn: createFieldSource(values.issn, baseSource),
    isbn: createFieldSource(values.isbn, baseSource),
    abstract: createFieldSource(values.abstract, baseSource),
    conferenceLocation: createFieldSource(values.conferenceLocation || values.conference_location, baseSource),
    indexingPlatform: createFieldSource(values.indexingPlatform || values.indexing_platform || firstIndexing.source, indexingSource),
    indexingCategory: createFieldSource(values.indexingCategory || values.indexing_category || firstIndexing.category, indexingSource),
    quartile: createFieldSource(values.quartile || firstIndexing.quartile, indexingSource),
    sjr: createFieldSource(values.sjr || firstIndexing.sjr, indexingSource),
    citeScore: createFieldSource(values.citeScore || values.cite_score || firstIndexing.citeScore || firstIndexing.cite_score, indexingSource),
    impactFactor: createFieldSource(firstIndexing.impactFactor || firstIndexing.impact_factor, indexingSource),
  };
}

function normalizeIndexingInput(value, publicationType) {
  const indexing = normalizeIndexing(value);
  const platform = deriveIndexingPlatform(indexing);
  const category = deriveIndexingCategory(indexing, publicationType);

  return indexing.map((item, index) => index === 0
    ? {
        ...item,
        source: item.source || platform,
        platform: item.platform || item.source || platform,
        category: item.category || category,
      }
    : item);
}

function getPrimaryQuartile(indexing = []) {
  const primary = (Array.isArray(indexing) ? indexing : [])
    .map((item) => normalizeText(item?.quartile))
    .find(Boolean);

  return primary || "";
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
  const hasIndexingInput =
    Object.prototype.hasOwnProperty.call(body, "indexing")
    || Object.prototype.hasOwnProperty.call(body, "quartile")
    || Object.prototype.hasOwnProperty.call(body, "indexingPlatform")
    || Object.prototype.hasOwnProperty.call(body, "indexing_platform")
    || Object.prototype.hasOwnProperty.call(body, "indexingCategory")
    || Object.prototype.hasOwnProperty.call(body, "indexing_category");
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

  if (publicationType === "conference_paper" && !normalizeText(body.venue || body.publishedIn || body.published_in || body.journal)) {
    errors.push({ field: "venue", message: "Konferenca eshte obligative per punim konference." });
  }

  if (publicationType === "book" && !normalizeText(body.publisher) && !normalizeText(body.isbn)) {
    errors.push({ field: "publisher", message: "Book / Chapter duhet te kete botues ose ISBN." });
  }

  const authors = normalizeAuthors(body.authors);
  const rawIndexing = supportsPublicationIndexing(publicationType)
    ? Array.isArray(body.indexing) && body.indexing.length
      ? body.indexing
      : (body.quartile || body.indexingPlatform || body.indexing_platform || body.indexingCategory || body.indexing_category)
        ? [{
            source: body.indexingPlatform || body.indexing_platform || body.indexingSource || body.indexing_source,
            sourceKey: body.indexingSource || body.indexing_source,
            category: body.indexingCategory || body.indexing_category,
            quartile: body.quartile,
            sjr: body.sjr,
            citeScore: body.citeScore || body.cite_score || body.citescore,
          }]
        : Array.isArray(body.indexing)
          ? body.indexing
          : []
    : (body.indexingPlatform || body.indexing_platform || body.indexingCategory || body.indexing_category)
      ? [{
          source: body.indexingPlatform || body.indexing_platform,
          category: body.indexingCategory || body.indexing_category,
          quartile: body.quartile,
        }]
      : [];
  const indexing = hasIndexingInput
    ? normalizeIndexingInput(rawIndexing, publicationType)
    : undefined;
  const authorAffiliation = deriveAuthorAffiliation(authors, body.authorAffiliation || body.author_affiliation || body.affiliation);
  const indexingPlatform = deriveIndexingPlatform(indexing, body.indexingPlatform || body.indexing_platform);
  const indexingCategory = deriveIndexingCategory(indexing, publicationType, body.indexingCategory || body.indexing_category);
  const evidenceLinks = hasEvidenceLinksInput
    ? normalizeEvidenceLinks(body.evidenceLinks || body.evidence_links || body.attachments, errors)
    : undefined;
  const metadataVerified = normalizeBoolean(body.metadataVerified ?? body.metadata_verified) || metadataSource === "doi";
  const externalMetadataId = normalizeDoi(body.externalMetadataId || body.external_metadata_id)
    || (metadataSource === "doi" ? doi : null);
  const requestedIndexingSource = normalizeIndexingSource(body.indexingSource || body.indexing_source || indexing?.[0]?.sourceKey || indexing?.[0]?.source_key || indexing?.[0]?.source);
  const indexingVerified = normalizeBoolean(body.indexingVerified ?? body.indexing_verified)
    && requestedIndexingSource !== "manual"
    && Boolean(indexingPlatform || indexing?.some((item) => item.source || item.category || item.quartile || item.sjr || item.citeScore));
  const indexingSource = indexingVerified ? requestedIndexingSource : "manual";

  if (!authors.length) {
    errors.push({ field: "authors", message: "Shto se paku nje autor per publikimin." });
  }

  if (!indexingPlatform) {
    errors.push({ field: "indexingPlatform", message: "Indeksimi ne platforme eshte obligativ." });
  } else if (!VALID_INDEXING_PLATFORMS.has(indexingPlatform)) {
    errors.push({ field: "indexingPlatform", message: "Indeksimi ne platforme nuk eshte valid." });
  }

  if (indexingCategory.length > 200) {
    errors.push({ field: "indexingCategory", message: "Kategoria / grupi i indeksimit eshte shume e gjate." });
  }

  const authorsWithAffiliation = authors.map((author, index) => index === 0 && !author.affiliation
    ? { ...author, affiliation: authorAffiliation }
    : author);
  const normalizedIndexing = indexing !== undefined
    ? indexing.length
      ? indexing.map((item, index) => index === 0
        ? {
            ...item,
            source: item.source || indexingPlatform,
            platform: item.platform || item.source || indexingPlatform,
            sourceKey: item.sourceKey || item.source_key || indexingSource,
            source_key: item.source_key || item.sourceKey || indexingSource,
            category: item.category || indexingCategory,
            quartile: item.quartile || normalizeQuartile(body.quartile),
          }
        : item)
      : [{ source: indexingPlatform, platform: indexingPlatform, sourceKey: indexingSource, source_key: indexingSource, category: indexingCategory, quartile: normalizeQuartile(body.quartile), impactFactor: "", sjr: normalizeText(body.sjr), citeScore: normalizeText(body.citeScore || body.cite_score || body.citescore), indexedUrl: "" }]
    : undefined;

  return {
    errors,
    values: {
      doi: doi || null,
      title,
      abstract: normalizeAbstractText(body.abstract),
      publicationType,
      venue: normalizeText(body.venue || body.publishedIn || body.published_in || body.journal),
      conferenceLocation: normalizeText(body.conferenceLocation ?? body.conference_location),
      publisher: normalizeText(body.publisher),
      publicationDate,
      publicationYear,
      sourceUrl,
      volume: normalizeText(body.volume),
      issue: normalizeText(body.issue),
      pages: normalizeText(body.pages),
      issn: normalizeText(body.issn),
      isbn: normalizeText(body.isbn),
      authorAffiliation,
      indexingPlatform,
      indexingCategory,
      indexingVerified,
      indexingSource,
      status,
      authors: authorsWithAffiliation,
      indexing: normalizedIndexing,
      evidenceLinks,
      attachments: evidenceLinks,
      hasIndexingInput,
      hasEvidenceLinksInput,
      metadataSource,
      metadataVerified,
      externalMetadataId,
      fieldSources: buildPublicationFieldSources({
        ...body,
        authorAffiliation,
        indexingPlatform,
        indexingCategory,
        indexingVerified,
        indexingSource,
        indexing: normalizedIndexing,
        authors: authorsWithAffiliation,
      }, metadataSource),
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
  const indexing = getArrayField(row, "indexing").map((item) => ({
    source: normalizeIndexingPlatform(item.source || item.platform),
    platform: normalizeIndexingPlatform(item.platform || item.source),
    sourceKey: normalizeIndexingSource(item.source_key || item.sourceKey || item.indexing_source || item.indexingSource || item.source),
    source_key: normalizeIndexingSource(item.source_key || item.sourceKey || item.indexing_source || item.indexingSource || item.source),
    category: item.category || "",
    quartile: normalizeQuartile(item.quartile),
    impactFactor: item.impact_factor || item.impactFactor || "",
    impact_factor: item.impact_factor || item.impactFactor || "",
    sjr: item.sjr || "",
    citeScore: item.cite_score || item.citeScore || item.citescore || "",
    cite_score: item.cite_score || item.citeScore || item.citescore || "",
    citescore: item.cite_score || item.citeScore || item.citescore || "",
    indexedUrl: item.indexed_url || item.indexedUrl || "",
    indexed_url: item.indexed_url || item.indexedUrl || "",
  }));
  const authorAffiliation = row.author_affiliation || deriveAuthorAffiliation(authors);
  const indexingPlatform = row.indexing_platform || deriveIndexingPlatform(indexing);
  const indexingCategory = row.indexing_category || deriveIndexingCategory(indexing, publicationType);
  const indexingVerified = Boolean(row.indexing_verified);
  const indexingSource = normalizeIndexingSource(row.indexing_source || indexing.find((item) => item.sourceKey)?.sourceKey || indexing.find((item) => item.source)?.source);
  const fieldSources = buildPublicationFieldSources({
    doi: row.doi || "",
    title: row.title || "",
    abstract: normalizeAbstractText(row.abstract),
    publicationType,
    venue: row.venue || "",
    conferenceLocation: row.conference_location || "",
    publisher: row.publisher || "",
    publicationDate: row.publication_date || null,
    publicationYear: row.publication_year || row.year || "",
    sourceUrl: row.source_url || "",
    volume: row.volume || "",
    issue: row.issue || "",
    pages: row.pages || "",
    issn: row.issn || "",
    isbn: row.isbn || "",
    authorAffiliation,
    indexingPlatform,
    indexingCategory,
    indexingVerified,
    indexingSource,
    indexing,
    authors,
    quartile: getPrimaryQuartile(indexing),
  }, row.metadata_source || "manual");

  return {
    id: row.id,
    ownerId: row.owner_id || null,
    owner_id: row.owner_id || null,
    title: row.title || "",
    abstract: normalizeAbstractText(row.abstract),
    publicationType,
    publication_type: publicationType,
    venue: row.venue || "",
    publishedIn: row.venue || "",
    published_in: row.venue || "",
    conferenceLocation: row.conference_location || "",
    conference_location: row.conference_location || "",
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
    authorAffiliation,
    author_affiliation: authorAffiliation,
    affiliation: authorAffiliation,
    indexingPlatform,
    indexing_platform: indexingPlatform,
    indexingCategory,
    indexing_category: indexingCategory,
    indexingVerified,
    indexing_verified: indexingVerified,
    indexingSource,
    indexing_source: indexingSource,
    quartile: getPrimaryQuartile(indexing),
    authors: authors.map((author, index) => ({
      fullName: author.full_name || author.fullName || "",
      full_name: author.full_name || author.fullName || "",
      givenName: author.given_name || author.givenName || "",
      given_name: author.given_name || author.givenName || "",
      familyName: author.family_name || author.familyName || "",
      family_name: author.family_name || author.familyName || "",
      orcid: author.orcid || "",
      affiliation: normalizeAuthorAffiliation(
        author.affiliation
        || author.affiliations
        || author.institution
        || author.organization
        || author.currentAffiliation
        || author.current_affiliation
      ) || (index === 0 ? authorAffiliation : ""),
      authorOrder: author.author_order || author.authorOrder || index + 1,
      author_order: author.author_order || author.authorOrder || index + 1,
      isMainAuthor: index === 0,
      is_main_author: index === 0,
    })),
    indexing,
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
    fieldSources,
    field_sources: fieldSources,
    metadataReviewStatus: row.metadata_review_status || "unchecked",
    metadata_review_status: row.metadata_review_status || "unchecked",
    metadataReviewChecklist: row.metadata_review_checklist || {},
    metadata_review_checklist: row.metadata_review_checklist || {},
    metadataReviewComment: row.metadata_review_comment || "",
    metadata_review_comment: row.metadata_review_comment || "",
    revisionRequestedBy: row.revision_requested_by || null,
    revision_requested_by: row.revision_requested_by || null,
    revisionRequestedAt: row.revision_requested_at || null,
    revision_requested_at: row.revision_requested_at || null,
    resubmittedAt: row.resubmitted_at || null,
    resubmitted_at: row.resubmitted_at || null,
    reviewHistory: getArrayField(row, "review_history"),
    review_history: getArrayField(row, "review_history"),
    status: row.status || "draft",
    createdAt: row.created_at || null,
    created_at: row.created_at || null,
    updatedAt: row.updated_at || null,
    updated_at: row.updated_at || null,
  };
}

const PUBLICATION_SELECT_SQL = `
  p.id, p.owner_id, p.doi, p.title, p.abstract, p.publication_type, p.venue, p.conference_location,
  p.publisher, p.publication_date, p.publication_year, p.source_url, p.volume,
  p.issue, p.pages, p.issn, p.isbn, p.author_affiliation, p.indexing_platform, p.indexing_category,
  p.indexing_verified, p.indexing_source, p.metadata_source, p.metadata_verified,
  p.external_metadata_id, p.status, p.created_at, p.updated_at,
  p.metadata_review_status, p.metadata_review_checklist, p.metadata_review_comment,
  p.revision_requested_by, p.revision_requested_at, p.resubmitted_at,
  m.type as metadata_type, m.authors as metadata_authors,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'full_name', pa.full_name,
      'given_name', pa.given_name,
      'family_name', pa.family_name,
      'orcid', pa.orcid,
      'affiliation', pa.affiliation,
      'is_main_author', pa.is_main_author,
      'author_order', coalesce(pa.author_order, pa.position)
    ) order by coalesce(pa.author_order, pa.position), pa.created_at)
    from publication_authors pa
    where pa.publication_id = p.id
  ), '[]'::jsonb) as authors,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'source', pi.source,
      'platform', pi.source,
      'source_key', pi.source_key,
      'category', pi.category,
      'quartile', pi.quartile,
      'impact_factor', pi.impact_factor,
      'sjr', pi.sjr,
      'cite_score', pi.cite_score,
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
  ), '[]'::jsonb) as identifiers,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', prh.id,
      'previous_status', prh.previous_status,
      'status', prh.status,
      'actor_id', prh.actor_id,
      'actor_role', prh.actor_role,
      'actor_name', prh.actor_name,
      'comment', prh.comment,
      'checklist', prh.checklist,
      'created_at', prh.created_at
    ) order by prh.created_at desc)
    from publication_review_history prh
    where prh.publication_id = p.id
  ), '[]'::jsonb) as review_history
`;

const LEGACY_PUBLICATION_SELECT_SQL = `
  p.id, p.owner_id, p.doi, p.title, p.venue, p.publication_year, p.status, p.created_at, p.updated_at,
  p.metadata_review_status, p.metadata_review_checklist, p.metadata_review_comment,
  p.revision_requested_by, p.revision_requested_at, p.resubmitted_at,
  '[]'::jsonb as review_history,
  m.container_title, m.publisher, m.year, m.type as metadata_type, m.authors as metadata_authors, m.source_url
`;

let unifiedPublicationSchemaCache = null;

async function hasUnifiedPublicationSchema(dbOrClient) {
  await ensurePublicationReviewSchema(dbOrClient);

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
         'conference_location',
         'publisher',
         'publication_date',
         'source_url',
         'volume',
         'issue',
         'pages',
         'issn',
         'isbn',
         'author_affiliation',
         'indexing_platform',
         'indexing_category',
         'indexing_verified',
         'indexing_source',
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

  unifiedPublicationSchemaCache = columnsResult.rows.length === 19 && tablesResult.rows.length === 4;
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
       (publication_id, full_name, given_name, family_name, orcid, affiliation, is_main_author, position, author_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        publicationId,
        author.fullName,
        author.givenName,
        author.familyName,
        author.orcid,
        author.affiliation,
        authorOrder === 1,
        authorOrder,
        authorOrder,
      ]
    );
  }

  for (const item of values.indexing || []) {
    await client.query(
      `insert into publication_indexing
       (publication_id, source, source_key, category, quartile, impact_factor, sjr, cite_score, indexed_url)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        publicationId,
        item.source,
        item.sourceKey || item.source_key || values.indexingSource,
        item.category,
        item.quartile,
        item.impactFactor,
        item.sjr,
        item.citeScore || item.cite_score,
        item.indexedUrl,
      ]
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

async function ensurePublicationReviewSchema(client) {
  if (publicationReviewSchemaReady) {
    return;
  }

  await client.query(`
    alter table publications add column if not exists metadata_review_status text not null default 'unchecked';
    alter table publications add column if not exists conference_location text not null default '';
    alter table publications add column if not exists author_affiliation text not null default '';
    alter table publications add column if not exists indexing_platform text not null default '';
    alter table publications add column if not exists indexing_category text not null default '';
    alter table publications add column if not exists indexing_verified boolean not null default false;
    alter table publications add column if not exists indexing_source text not null default 'manual';
    alter table publications add column if not exists metadata_review_checklist jsonb not null default '{}'::jsonb;
    alter table publications add column if not exists metadata_review_comment text not null default '';
    alter table publications add column if not exists revision_requested_by uuid references users(id) on delete set null;
    alter table publications add column if not exists revision_requested_at timestamptz;
    alter table publications add column if not exists resubmitted_at timestamptz;
    alter table if exists publication_authors add column if not exists is_corresponding_author boolean not null default false;
    alter table if exists publication_indexing add column if not exists source_key text not null default 'manual';
    alter table if exists publication_indexing add column if not exists category text not null default '';
    alter table if exists publication_indexing add column if not exists sjr text not null default '';
    alter table if exists publication_indexing add column if not exists cite_score text not null default '';
    alter table publications drop constraint if exists publications_indexing_source_check;
    alter table publications add constraint publications_indexing_source_check
      check (indexing_source in ('scopus', 'scimago', 'doaj', 'openalex', 'manual'));
    alter table publications drop constraint if exists publications_status_check;
    alter table publications add constraint publications_status_check
      check (status in ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'needs_correction'));
    alter table publications drop constraint if exists publications_metadata_review_status_check;
    alter table publications add constraint publications_metadata_review_status_check
      check (metadata_review_status in ('unchecked', 'in_review', 'ok', 'correction'));
    create table if not exists publication_review_history (
      id uuid primary key default gen_random_uuid(),
      publication_id uuid not null references publications(id) on delete cascade,
      previous_status text,
      status text not null,
      actor_id uuid references users(id) on delete set null,
      actor_role text,
      actor_name text,
      comment text not null default '',
      checklist jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create index if not exists publication_review_history_publication_idx
      on publication_review_history (publication_id, created_at desc);
    create index if not exists publications_metadata_review_status_idx
      on publications (metadata_review_status, updated_at desc);
  `);

  publicationReviewSchemaReady = true;
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

function normalizeMetadataReviewChecklist(value = {}) {
  const checklist = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return {
    doiOk: Boolean(checklist.doiOk ?? checklist.doi_ok),
    titleMatches: Boolean(checklist.titleMatches ?? checklist.title_matches),
    venueOk: Boolean(checklist.venueOk ?? checklist.venue_ok),
    authorsOk: Boolean(checklist.authorsOk ?? checklist.authors_ok),
    uibmOk: Boolean(checklist.uibmOk ?? checklist.uibm_ok),
    documentsOk: Boolean(checklist.documentsOk ?? checklist.documents_ok),
  };
}

function getMetadataReviewIssueLabels(checklist = {}) {
  const labels = {
    doiOk: "DOI OK",
    titleMatches: "Titulli perputhet me dokumentin",
    venueOk: "Journal / Konferenca OK",
    authorsOk: "Autoret OK",
    uibmOk: "Perkatesia institucionale UIBM OK",
    documentsOk: "Dokumentet OK",
  };

  return Object.entries(labels)
    .filter(([key]) => !checklist[key])
    .map(([, label]) => label);
}

function getActorName(user = {}) {
  return normalizeText(user.full_name || user.name || user.email) || "UMIBRes";
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
      authorOrder: index + 1,
    };
  }

  return {
    fullName: normalizeText(author?.fullName || author?.full_name || author?.name),
    givenName: normalizeText(author?.givenName || author?.given_name),
    familyName: normalizeText(author?.familyName || author?.family_name),
    orcid: normalizeText(author?.orcid) || (index === mainAuthorIndex ? normalizeText(currentUser.orcid_id || currentUser.orcidId) : ""),
    affiliation: normalizeAuthorAffiliation(
      author?.affiliation
      || author?.affiliations
      || author?.institution
      || author?.organization
    ),
    isMainAuthor: index === mainAuthorIndex,
    authorOrder: index + 1,
  };
}

function metadataToPublicationPayload(metadata = {}, currentUser = {}) {
  const raw = metadata.raw_json || {};
  const issn = metadata.issn || extractFirstArrayValue(raw.ISSN || raw.issn);
  const isbn = metadata.isbn || extractFirstArrayValue(raw.ISBN || raw.isbn);
  const publicationType = normalizePublicationType(metadata.type);
  const indexing = Array.isArray(metadata.indexing) ? metadata.indexing : [];
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
    publicationType,
    venue: metadata.container_title || "",
    conferenceLocation: metadata.conferenceLocation || metadata.conference_location || "",
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
    authorAffiliation: deriveAuthorAffiliation(metadataAuthors),
    indexingPlatform: deriveIndexingPlatform(indexing),
    indexingCategory: deriveIndexingCategory(indexing, publicationType),
    indexingVerified: Boolean(metadata.indexingVerified ?? metadata.indexing_verified),
    indexingSource: normalizeIndexingSource(metadata.indexingSource || metadata.indexing_source || indexing.find((item) => item?.sourceKey || item?.source_key || item?.source)?.sourceKey || indexing.find((item) => item?.sourceKey || item?.source_key || item?.source)?.source_key || indexing.find((item) => item?.source)?.source),
    quartile: metadata.quartile || getPrimaryQuartile(indexing),
    status: "draft",
    authors: metadataAuthors.map((author, index) =>
      metadataAuthorToPublicationAuthor(author, index, currentUser, mainAuthorIndex)
    ),
    indexing,
    evidenceLinks: [],
    attachments: [],
    metadataSource: "doi",
    metadataVerified: true,
    externalMetadataId: metadata.doi || "",
  };
}

function hasMeaningfulPublicationInput(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return normalizeText(value) !== "";
}

function mergePublicationMetadataDefaults(defaults = {}, input = {}) {
  const merged = { ...defaults, ...input };

  for (const [key, value] of Object.entries(defaults)) {
    if (!hasMeaningfulPublicationInput(input[key]) && hasMeaningfulPublicationInput(value)) {
      merged[key] = value;
    }
  }

  return merged;
}

async function applyDoiMetadataDefaults(dbOrClient, body = {}, currentUser = {}) {
  const doi = normalizeDoi(body.doi || body.metadata?.doi);

  if (!doi || !isValidDoi(doi)) {
    return body;
  }

  try {
    const { metadata } = await getVerifiedDoiMetadata(dbOrClient, doi);
    return mergePublicationMetadataDefaults(metadataToPublicationPayload(metadata, currentUser), body);
  } catch (error) {
    console.warn("publication_metadata_prefill_failed", {
      doi,
      message: error.message,
    });

    return body;
  }
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
      conference_location, publication_year, source_url, volume, issue, pages, issn, isbn, status,
      author_affiliation, indexing_platform, indexing_category, indexing_verified, indexing_source,
      metadata_source, metadata_verified, external_metadata_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
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
      values.conferenceLocation,
      values.publicationYear,
      values.sourceUrl,
      values.volume,
      values.issue,
      values.pages,
      values.issn,
      values.isbn,
      values.status,
      values.authorAffiliation,
      values.indexingPlatform,
      values.indexingCategory,
      values.indexingVerified,
      values.indexingSource,
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
  const scope = normalizeText(req.query.scope).toLowerCase();
  const isReviewScope = ["review", "committee", "all"].includes(scope);
  const currentUser = (await loadCurrentUser(req.user.id)) || req.user;
  const canSeeReviewScope = canReviewPublications(currentUser);
  const filters = [];
  const params = [];

  if (isReviewScope && !canSeeReviewScope) {
    res.status(403).json({ error: "forbidden", message: "Nuk keni leje per te pare publikimet per shqyrtim." });
    return;
  }

  if (!isReviewScope) {
    params.push(req.user.id);
    filters.push(`p.owner_id = $${params.length}`);
  }

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
            or p.conference_location ilike $${qParam}
            or p.publisher ilike $${qParam}
            or p.doi ilike $${qParam}
            or p.abstract ilike $${qParam}
            or p.publication_type ilike $${qParam}
            or cast(p.publication_year as text) ilike $${qParam}
            or exists (select 1 from publication_authors pa where pa.publication_id = p.id and pa.full_name ilike $${qParam})
            or exists (
              select 1 from publication_indexing pi
              where pi.publication_id = p.id
                and (
                  pi.source ilike $${qParam}
                  or pi.category ilike $${qParam}
                  or pi.quartile ilike $${qParam}
                  or pi.sjr ilike $${qParam}
                  or pi.cite_score ilike $${qParam}
                )
            )
          )`
        : `(p.title ilike $${qParam} or p.venue ilike $${qParam} or p.doi ilike $${qParam} or m.publisher ilike $${qParam} or m.container_title ilike $${qParam})`);
    }

    const resolvedWhereClause = filters.length ? filters.join(" and ") : "true";
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
  const client = await db.connect();

  try {
    await client.query("begin");
    const hydratedBody = await applyDoiMetadataDefaults(client, req.body, currentUser);
    const { errors, values } = normalizePublicationPayload(hydratedBody, { user: currentUser });

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
      mergePublicationMetadataDefaults(prefill, req.body?.publication || {}),
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
               conference_location = $8,
               publisher = $9,
               publication_date = $10::date,
               publication_year = $11,
               source_url = $12,
               volume = $13,
               issue = $14,
               pages = $15,
               issn = $16,
               isbn = $17,
               status = $18,
               author_affiliation = $19,
               indexing_platform = $20,
               indexing_category = $21,
               indexing_verified = $22,
               indexing_source = $23,
               metadata_source = $24,
               metadata_verified = $25,
               external_metadata_id = $26,
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
            values.conferenceLocation,
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
            values.authorAffiliation,
            values.indexingPlatform,
            values.indexingCategory,
            values.indexingVerified,
            values.indexingSource,
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

router.patch("/:id/metadata-review", requireAuthenticatedUser, async (req, res) => {
  const currentUser = (await loadCurrentUser(req.user.id)) || req.user;

  if (!canReviewPublications(currentUser)) {
    res.status(403).json({
      error: "forbidden",
      message: "Vetem Komisioni mund te kontrolloje metadata per publikime.",
    });
    return;
  }

  const status = normalizeText(req.body?.status || req.body?.metadataReviewStatus || req.body?.metadata_review_status);
  const comment = normalizeText(req.body?.comment || req.body?.metadataReviewComment || req.body?.metadata_review_comment);
  const checklist = normalizeMetadataReviewChecklist(req.body?.checklist || req.body?.metadataReviewChecklist || req.body?.metadata_review_checklist);

  if (!VALID_METADATA_REVIEW_STATUSES.has(status)) {
    res.status(400).json({ error: "invalid_metadata_review_status", message: "Statusi i metadata-s nuk eshte valid." });
    return;
  }

  if (status === "correction" && !comment) {
    res.status(400).json({ error: "comment_required", message: "Komenti eshte i detyrueshem per korrigjim." });
    return;
  }

  const client = await db.connect();

  try {
    await client.query("begin");
    await ensurePublicationReviewSchema(client);

    const existing = await fetchPublicationById(client, req.params.id, null);

    if (!existing) {
      await client.query("rollback");
      res.status(404).json({ error: "not_found", message: "Publikimi nuk u gjet." });
      return;
    }

    const nextPublicationStatus = status === "correction"
      ? "needs_correction"
      : existing.status || "in_review";
    const issueLabels = getMetadataReviewIssueLabels(checklist);

    const { rows } = await client.query(
      `update publications
       set metadata_review_status = $2,
           metadata_review_checklist = $3::jsonb,
           metadata_review_comment = $4,
           status = $5,
           revision_requested_by = case when $2 = 'correction' then $6 else revision_requested_by end,
           revision_requested_at = case when $2 = 'correction' then now() else revision_requested_at end,
           updated_at = now()
       where id = $1
       returning id`,
      [
        req.params.id,
        status,
        JSON.stringify(checklist),
        comment,
        nextPublicationStatus,
        req.user.id,
      ]
    );

    await client.query(
      `insert into publication_review_history
       (publication_id, previous_status, status, actor_id, actor_role, actor_name, comment, checklist)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        req.params.id,
        existing.metadata_review_status || existing.metadataReviewStatus || "unchecked",
        status,
        req.user.id,
        normalizeRole(currentUser.role),
        getActorName(currentUser),
        comment,
        JSON.stringify({ ...checklist, issues: issueLabels }),
      ]
    );

    const row = await fetchPublicationById(client, rows[0].id, null);

    if (status === "correction") {
      await createNotification(client, {
        userId: row.ownerId || row.owner_id,
        title: "Publikimi juaj kerkon korrigjim",
        message: [
          `Komisioni ka kerkuar perditesim te metadata-s per "${row.title || row.doi || "publikimin"}".`,
          comment,
          issueLabels.length ? `Pikat per kontroll: ${issueLabels.join(", ")}.` : "",
          "Ju lutem rishikoni publikimin dhe ridergojeni.",
        ].filter(Boolean).join(" "),
        category: "Publikime",
        metadata: {
          type: "publication_revision",
          publicationId: row.id,
        },
      });
    }

    await client.query("commit");
    res.json({ data: mapPublication(row) });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("PATCH /api/publications/:id/metadata-review failed:", error);
    res.status(500).json({ error: "metadata_review_failed", message: "Kontrolli i metadata-s nuk u ruajt." });
  } finally {
    client.release();
  }
});

router.post("/:id/resubmit", requireAuthenticatedUser, async (req, res) => {
  const currentUser = (await loadCurrentUser(req.user.id)) || req.user;
  const comment = normalizeText(req.body?.comment || "Publikimi u ridergua pas korrigjimit.");
  const client = await db.connect();

  try {
    await client.query("begin");
    await ensurePublicationReviewSchema(client);

    const existing = await fetchPublicationById(client, req.params.id, req.user.id);

    if (!existing) {
      await client.query("rollback");
      res.status(404).json({ error: "not_found", message: "Publikimi nuk u gjet." });
      return;
    }

    const { rows } = await client.query(
      `update publications
       set status = 'in_review',
           metadata_review_status = 'in_review',
           resubmitted_at = now(),
           updated_at = now()
       where id = $1 and owner_id = $2
       returning id`,
      [req.params.id, req.user.id]
    );

    await client.query(
      `insert into publication_review_history
       (publication_id, previous_status, status, actor_id, actor_role, actor_name, comment, checklist)
       values ($1, $2, 'in_review', $3, $4, $5, $6, $7::jsonb)`,
      [
        req.params.id,
        existing.metadata_review_status || existing.metadataReviewStatus || "correction",
        req.user.id,
        normalizeRole(currentUser.role),
        getActorName(currentUser),
        comment,
        JSON.stringify(existing.metadata_review_checklist || existing.metadataReviewChecklist || {}),
      ]
    );

    const row = await fetchPublicationById(client, rows[0].id, req.user.id);
    await client.query("commit");
    res.json({ data: mapPublication(row) });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("POST /api/publications/:id/resubmit failed:", error);
    res.status(500).json({ error: "resubmit_failed", message: "Publikimi nuk u ridergua." });
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
    await createNotification(client, {
      userId: row.ownerId || row.owner_id,
      title: `Publikimi: ${STATUS_LABELS[status] || status}`,
      message: `Statusi i publikimit "${row.title || row.doi || "Pa titull"}" u ndryshua ne ${STATUS_LABELS[status] || status}.`,
      category: "Publikime",
    });
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
