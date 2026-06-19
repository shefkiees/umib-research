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
import {
  INDEXING_PLATFORM_VALUES,
  INDEXING_SOURCE_VALUES,
  METADATA_REVIEW_STATUS_VALUES,
  PROFESSOR_PUBLICATION_STATUS_VALUES,
  PUBLICATION_REVIEW_ROLE_VALUES,
  PUBLICATION_STATUS_VALUES,
  PUBLICATION_TYPE_VALUES,
  WEB_OF_SCIENCE_INDEX_VALUES,
} from "../../shared/publicationConstants.js";

const router = express.Router();
const VALID_PUBLICATION_STATUSES = new Set(PUBLICATION_STATUS_VALUES);
const PROFESSOR_PUBLICATION_STATUSES = new Set(PROFESSOR_PUBLICATION_STATUS_VALUES);
const PUBLICATION_REVIEW_ROLES = new Set(PUBLICATION_REVIEW_ROLE_VALUES);
const VALID_PUBLICATION_TYPES = new Set(PUBLICATION_TYPE_VALUES);
const VALID_METADATA_REVIEW_STATUSES = new Set(METADATA_REVIEW_STATUS_VALUES);
const VALID_INDEXING_PLATFORMS = new Set(INDEXING_PLATFORM_VALUES);
const VALID_INDEXING_SOURCES = new Set(INDEXING_SOURCE_VALUES);
const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Dorezuar",
  in_review: "Ne shqyrtim",
  needs_correction: "Kthyer per korrigjim",
  approved: "Aprovuar",
  rejected: "Refuzuar",
};
const METADATA_REVIEW_CHECKLIST_LABELS = {
  doiOk: "DOI / link i verifikueshem",
  titleMatches: "Titulli perputhet me dokumentin",
  venueOk: "Journal / Konferenca OK",
  journalNameOk: "Emri i revistes",
  publisherOk: "Botuesi / publisher",
  publicationDateOk: "Viti / data e publikimit",
  authorsOk: "Autoret OK",
  uibmOk: "Affiliation UIBM",
  documentsOk: "Dokumentet mbeshtetese",
  issnOk: "ISSN / eISSN",
  volumeIssuePagesOk: "Volume / issue / faqe",
  abstractOk: "Abstrakti",
  indexingOk: "Indeksimi i kontrolluar",
  quartileMetricsOk: "Quartile / SJR / CiteScore / Impakt",
  form2Ok: "Formulari 2",
  abstractPresentationOk: "Prezantimi / abstrakti",
  eventNameOk: "Emri i konferences",
  eventDateOk: "Data dhe vendi i ngjarjes",
  presentationPurposeOk: "Qellimi i pjesemarrjes",
  programEvidenceOk: "Programi i ngjarjes",
  acceptanceDocumentOk: "Pranimi i punimit / abstraktit",
  invitationLetterOk: "Letra e fteses / pranimit",
  speakerInvitationOk: "Ftesa si foles / instruktor",
  benefitLetterOk: "Letra e perfitimit shkencor",
  deadlineOk: "Afati 1 muaj para ngjarjes",
  travelTicketsOk: "Biletat e udhetimit",
  ticketInvoicesOk: "Faturat e biletave",
  accommodationInvoiceOk: "Fatura e akomodimit",
  registrationInvoiceOk: "Fatura e regjistrimit",
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

function normalizeImpactFactorValue(value) {
  const text = normalizeText(value);
  const match = text.match(/\b\d+(?:[.,]\d+)?\b/);

  if (!match) {
    return "";
  }

  const normalized = match[0].replace(",", ".");
  const numericValue = Number(normalized);

  return Number.isFinite(numericValue) && numericValue > 0 ? normalized : "";
}

function normalizeNullableText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function nullableConferenceText(publicationType, value) {
  return publicationType === "conference_paper" ? normalizeNullableText(value) : normalizeText(value);
}

function nullableConferenceAbstract(publicationType, value) {
  const abstract = normalizeAbstractText(value);

  return publicationType === "conference_paper" ? abstract || null : abstract;
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

function normalizeOrcid(value) {
  const normalized = normalizeText(value).replace(/^https?:\/\/orcid\.org\//i, "");

  return /^0000-0000-0000-0000$/.test(normalized) ? "" : normalized;
}

function normalizeAuthorAffiliation(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item?.name || item?.affiliation || item?.institution || item?.organization || item?.display_name || item?.displayName || item))
      .filter(Boolean)
      .join("; ");
  }

  return normalizeText(value?.name || value?.affiliation || value?.institution || value?.organization || value?.display_name || value?.displayName || value);
}

function normalizeContributor(value = {}) {
  if (!value) {
    return null;
  }

  if (typeof value !== "object") {
    const fullName = normalizeText(value);
    return fullName ? { fullName, full_name: fullName, givenName: "", given_name: "", familyName: "", family_name: "", orcid: "" } : null;
  }

  const givenName = normalizeText(value.givenName || value.given_name || value.given);
  const familyName = normalizeText(value.familyName || value.family_name || value.family);
  const fullName = normalizeText(
    value.fullName
    || value.full_name
    || value.name
    || value.literal
    || [givenName, familyName].filter(Boolean).join(" ")
  );
  const rawIdentifiers = [
    value.ORCID,
    value.orcid,
    value.nameIdentifier,
    value.name_identifier,
    ...(Array.isArray(value.nameIdentifiers) ? value.nameIdentifiers.map((item) => item?.nameIdentifier || item?.name_identifier || item?.value) : []),
    ...(Array.isArray(value.name_identifiers) ? value.name_identifiers.map((item) => item?.nameIdentifier || item?.name_identifier || item?.value) : []),
  ];
  const orcid = normalizeOrcid(rawIdentifiers
    .map((item) => (item && typeof item === "object" ? item.nameIdentifier || item.name_identifier || item.value : item))
    .find((item) => normalizeText(item)));
  const resolvedFullName = fullName || [givenName, familyName].filter(Boolean).join(" ");

  return resolvedFullName || orcid ? {
    fullName: resolvedFullName,
    full_name: resolvedFullName,
    givenName,
    given_name: givenName,
    familyName,
    family_name: familyName,
    orcid,
  } : null;
}

function uniqueContributors(values = []) {
  const seen = new Set();
  const contributors = [];

  for (const value of values) {
    const contributor = normalizeContributor(value);
    const key = normalizeText(contributor?.orcid || contributor?.fullName || contributor?.full_name).toLowerCase();

    if (contributor && key && !seen.has(key)) {
      seen.add(key);
      contributors.push(contributor);
    }
  }

  return contributors;
}

function getBookChapterEditorsFromRaw(raw = {}) {
  const sources = [raw, raw._crossref || {}, raw._doi_org || {}, raw._datacite || {}];
  const values = sources.flatMap((source) => [
    source.editors,
    source.editor,
    source.bookEditors,
    source.book_editors,
    source.bookEditor,
    source.book_editor,
    source["book-editors"],
    source["book-editor"],
  ]).flatMap((value) => (Array.isArray(value) ? value : [value]));

  return uniqueContributors(values);
}

function getBookChapterSeriesTitleFromRaw(raw = {}) {
  const sources = [raw, raw._crossref || {}, raw._doi_org || {}, raw._datacite || {}];
  const values = sources.flatMap((source) => [
    source.book_series_title,
    source.bookSeriesTitle,
    source.series_title,
    source.seriesTitle,
    source["series-title"],
    source.collection_title,
    source.collectionTitle,
    source["collection-title"],
  ]);

  return values.map(normalizeText).find(Boolean) || "";
}

function getBookChapterEditionFromRaw(raw = {}) {
  const sources = [raw, raw._crossref || {}, raw._doi_org || {}, raw._datacite || {}];
  const values = sources.flatMap((source) => [
    source.edition,
    source.editionNumber,
    source.edition_number,
    source["edition-number"],
  ]);

  return values.map(normalizeText).find(Boolean) || "";
}

function normalizeTitleValues(value) {
  const values = Array.isArray(value) ? value : [value];

  return values.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [normalizeText(item)];
    }

    return [
      item.title,
      item.name,
      item.display_name,
      item.displayName,
      item.value,
    ].map(normalizeText);
  }).filter(Boolean);
}

function getConferenceProceedingsTitleFromRaw(raw = {}, conferenceName = "") {
  const sources = [raw, raw._crossref || {}, raw._doi_org || {}, raw._datacite || {}, raw._openalex || {}];
  const conferenceKey = normalizeComparableName(conferenceName);
  const values = sources.flatMap((source) => [
    source.proceedingsTitle,
    source.proceedings_title,
    source["proceedings-title"],
    source.proceedings?.title,
    source.proceedings?.name,
    source.proceedings?.display_name,
    source.proceedings?.displayName,
    source.source_title,
    source.sourceTitle,
    source["source-title"],
    source.book_title,
    source.bookTitle,
    source["book-title"],
    source.volume_title,
    source.volumeTitle,
    source["volume-title"],
    source.container_title,
    source.containerTitle,
    source["container-title"],
  ]).flatMap(normalizeTitleValues);
  const uniqueValues = [...new Map(values.map((value) => [normalizeComparableName(value), value])).values()]
    .filter(Boolean);

  return uniqueValues.find((value) => normalizeComparableName(value) && normalizeComparableName(value) !== conferenceKey)
    || uniqueValues[0]
    || "";
}

function getDatePartsFromRaw(value) {
  if (Array.isArray(value)) {
    return value.map(Number).filter((part) => Number.isInteger(part));
  }

  if (value && typeof value === "object") {
    const dateParts = value["date-parts"]?.[0];

    if (Array.isArray(dateParts)) {
      return dateParts.map(Number).filter((part) => Number.isInteger(part));
    }

    return getDatePartsFromRaw(value.date || value.start || value.end || value.startDate || value.start_date || value.endDate || value.end_date);
  }

  const text = normalizeText(value);
  const isoMatch = text.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/);
  const dayMonthYearMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);

  if (isoMatch) {
    return [
      Number(isoMatch[1]),
      isoMatch[2] ? Number(isoMatch[2]) : undefined,
      isoMatch[3] ? Number(isoMatch[3]) : undefined,
    ].filter((part) => Number.isInteger(part));
  }

  if (dayMonthYearMatch) {
    return [Number(dayMonthYearMatch[3]), Number(dayMonthYearMatch[2]), Number(dayMonthYearMatch[1])];
  }

  return [];
}

function formatRawDateParts(parts = []) {
  const year = normalizeYear(parts[0]);

  if (!year) {
    return "";
  }

  if (Number.isInteger(parts[1]) && parts[1] >= 1 && parts[1] <= 12 && Number.isInteger(parts[2]) && parts[2] >= 1 && parts[2] <= 31) {
    return `${year}-${String(parts[1]).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}`;
  }

  if (Number.isInteger(parts[1]) && parts[1] >= 1 && parts[1] <= 12) {
    return `${year}-${String(parts[1]).padStart(2, "0")}`;
  }

  return String(year);
}

function getConferenceEventDateFromRaw(raw = {}) {
  const sources = [raw, raw._crossref || {}, raw._doi_org || {}, raw._datacite || {}, raw._publisher_html_metadata || {}];
  const candidates = sources.flatMap((source) => [
    source.eventDate,
    source.event_date,
    source["event-date"],
    source.event?.date,
    source.event?.dates,
    source.event?.start,
    source.event?.end,
    source.event?.startDate,
    source.event?.start_date,
    source.event?.endDate,
    source.event?.end_date,
    source.conference?.date,
    source.conference?.start,
    source.conference?.end,
  ]);

  for (const candidate of candidates) {
    const formatted = formatRawDateParts(getDatePartsFromRaw(candidate)) || normalizeText(candidate);

    if (formatted) {
      return formatted;
    }
  }

  return "";
}

function getAcceptanceDateFromRaw(raw = {}) {
  const sources = [raw, raw._crossref || {}, raw._doi_org || {}, raw._datacite || {}, raw._publisher_html_metadata || {}];
  const candidates = sources.flatMap((source) => [
    source.acceptanceDate,
    source.acceptance_date,
    source.accepted,
    source["accepted-date"],
    source["date-accepted"],
  ]);

  for (const candidate of candidates) {
    const formatted = formatRawDateParts(getDatePartsFromRaw(candidate));

    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  }

  return "";
}

function getArticleLinkFromMetadata(metadata = {}) {
  const raw = metadata.raw_json || {};
  const sources = [metadata, raw, raw._crossref || {}, raw._doi_org || {}, raw._datacite || {}, raw._publisher_html_metadata || {}];
  const candidates = sources.flatMap((source) => [
    source.source_url,
    source.sourceUrl,
    source.URL,
    source.url,
    source.link?.[0]?.URL,
    source.link?.[0]?.url,
    source.resource?.primary?.URL,
    source.resource?.primary?.url,
    source.publisherUrl,
    source.publisher_url,
  ]);
  const urls = candidates.map(normalizeText).filter((candidate) => /^https?:\/\//i.test(candidate));
  const articleUrl = urls.find((candidate) => !/^https?:\/\/(?:dx\.)?doi\.org\//i.test(candidate)) || urls[0];
  const doi = normalizeDoi(metadata.doi || raw.DOI || raw.doi);

  return articleUrl || (doi ? `https://doi.org/${doi}` : "");
}

function parsePageRange(value) {
  const text = normalizeText(value);

  if (!text) {
    return { pageStart: "", pageEnd: "", pagesStart: "", pagesEnd: "", pages_start: "", pages_end: "" };
  }

  const match = text.match(/([A-Za-z]?\d+)\s*(?:-|--|–|—|to)\s*([A-Za-z]?\d+)/i)
    || text.match(/^([A-Za-z]?\d+)$/);
  const pageStart = match?.[1] || "";
  const pageEnd = match?.[2] || pageStart;

  return {
    pageStart,
    pageEnd,
    pagesStart: pageStart,
    pagesEnd: pageEnd,
    pages_start: pageStart,
    pages_end: pageEnd,
  };
}

function getConferencePageRangeFromRaw(raw = {}, pages = "") {
  const pageStart = normalizeText(raw.pageStart || raw.pagesStart || raw.page_start || raw.pages_start);
  const pageEnd = normalizeText(raw.pageEnd || raw.pagesEnd || raw.page_end || raw.pages_end);

  if (pageStart || pageEnd) {
    return {
      pageStart,
      pageEnd: pageEnd || pageStart,
      pagesStart: pageStart,
      pagesEnd: pageEnd || pageStart,
      pages_start: pageStart,
      pages_end: pageEnd || pageStart,
    };
  }

  return parsePageRange(pages || raw.page || raw.pages);
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
    conference_proceeding: "conference_paper",
    conference_proceedings: "conference_paper",
    paper_conference: "conference_paper",
    proceedings: "conference_paper",
    proceedings_article: "conference_paper",
    proceedings_series: "conference_paper",
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

function normalizePublicationSubtype(value) {
  const normalized = normalizeText(value).toLowerCase().replace(/[-\s]+/g, "_");

  if (normalized === "book_chapter" || normalized === "chapter") {
    return "book_chapter";
  }

  return "";
}

function getPublicationSubtypeFromRaw(raw = {}) {
  return normalizePublicationSubtype(
    raw.publication_subtype
    || raw.publicationSubtype
    || raw.subtype
    || raw.type
    || raw._crossref?.publication_subtype
    || raw._crossref?.publicationSubtype
    || raw._crossref?.subtype
    || raw._crossref?.type
    || raw._doi_org?.publication_subtype
    || raw._doi_org?.publicationSubtype
    || raw._doi_org?.subtype
    || raw._doi_org?.type
    || raw._openalex?.publication_subtype
    || raw._openalex?.publicationSubtype
    || raw._openalex?.type
    || raw._openalex?.type_crossref
  );
}

function isBookChapterPublication(publicationType, publicationSubtype) {
  return publicationType === "book" && normalizePublicationSubtype(publicationSubtype) === "book_chapter";
}

function supportsPublicationIndexing(publicationType) {
  return publicationType === "journal_article";
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
  if (["scie", "ssci", "ahci", "esci"].includes(comparable)) return "Web of Science";
  if (comparable === "other") return "Other";

  return text;
}

function normalizeCustomIndexingPlatform(value) {
  return normalizeText(value);
}

function normalizeIndexingCategory(value) {
  const text = normalizeText(value);
  const comparable = text.toLowerCase().replace(/\s+/g, "");

  if (!text) return "";
  if (/^q[1-4]$/i.test(text)) return text.toUpperCase();
  if (["scie", "ssci", "ahci", "esci"].includes(comparable)) return text.toUpperCase();
  if (["book/chapter", "bookchapter", "book", "chapter"].includes(comparable)) return "Book/Chapter";
  if (comparable === "other") return "Other";

  return text;
}

function normalizeWebOfScienceIndex(value) {
  const normalized = normalizeIndexingCategory(value);

  return WEB_OF_SCIENCE_INDEX_VALUES.includes(normalized) ? normalized : "";
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
        orcid: normalizeOrcid(author.orcid),
        affiliation: normalizeAuthorAffiliation(
          author.affiliation
          || author.affiliations
          || author.institution
          || author.organization
        ),
        isMainAuthor: index === 0,
        isCorrespondingAuthor: normalizeBoolean(
          author.is_corresponding_author
          ?? author.corresponding_author
          ?? author.isCorrespondingAuthor
          ?? author.correspondingAuthor
          ?? author.is_corresponding
          ?? author.isCorresponding
          ?? author.corresponding
        ),
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
      webOfScienceIndex: normalizeWebOfScienceIndex(item.webOfScienceIndex || item.web_of_science_index || item.category),
      web_of_science_index: normalizeWebOfScienceIndex(item.web_of_science_index || item.webOfScienceIndex || item.category),
      quartile: normalizeQuartile(item.quartile),
      impactFactor: normalizeImpactFactorValue(item.impact_factor || item.impactFactor),
      sjr: normalizeText(item.sjr),
      citeScore: normalizeText(item.cite_score || item.citeScore || item.citescore),
      indexedUrl: normalizeUrl(item.indexed_url || item.indexedUrl),
      quartileVerified: normalizeBoolean(item.quartileVerified ?? item.quartile_verified),
      quartile_verified: normalizeBoolean(item.quartileVerified ?? item.quartile_verified),
      quartileSource: normalizeIndexingSource(item.quartileSource || item.quartile_source || item.sourceKey || item.source_key || item.source),
      quartile_source: normalizeIndexingSource(item.quartileSource || item.quartile_source || item.sourceKey || item.source_key || item.source),
      quartileVerificationStatus: normalizeText(item.quartileVerificationStatus || item.quartile_verification_status || (item.quartile ? "manual" : "empty")),
      quartile_verification_status: normalizeText(item.quartileVerificationStatus || item.quartile_verification_status || (item.quartile ? "manual" : "empty")),
      quartileSelectionReason: normalizeText(item.quartileSelectionReason || item.quartile_selection_reason),
      quartile_selection_reason: normalizeText(item.quartileSelectionReason || item.quartile_selection_reason),
    }))
    .filter((item) => item.source || item.category || item.webOfScienceIndex || item.quartile || item.impactFactor || item.sjr || item.citeScore || item.indexedUrl);
}

function normalizeEIssn(value) {
  return normalizeText(value);
}

function extractIssnByType(raw = {}, targetType = "") {
  const target = normalizeText(targetType).toLowerCase();
  const values = [
    raw["issn-type"],
    raw["ISSN-type"],
    raw._crossref?.["issn-type"],
    raw._crossref?.["ISSN-type"],
  ].flatMap((value) => (Array.isArray(value) ? value : [value]));
  const match = values.find((item) => {
    const type = normalizeText(item?.type || item?.issnType || item?.issn_type).toLowerCase();
    return type === target;
  });

  return normalizeText(match?.value || match?.issn);
}

function normalizeComparableAffiliation(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeConferenceAuthorAffiliations(authors = [], publicationType = "", metadataSource = "manual") {
  const normalizedAuthors = (Array.isArray(authors) ? authors : []).map((author) => ({
    ...author,
    affiliation: publicationType === "conference_paper" ? normalizeNullableText(author?.affiliation) : author?.affiliation,
  }));

  if (publicationType !== "conference_paper" || metadataSource !== "doi") {
    return normalizedAuthors;
  }

  const affiliationCounts = normalizedAuthors.reduce((counts, author) => {
    const key = normalizeComparableAffiliation(author.affiliation);

    return key ? counts.set(key, (counts.get(key) || 0) + 1) : counts;
  }, new Map());

  return normalizedAuthors.map((author) => {
    const key = normalizeComparableAffiliation(author.affiliation);

    return key && affiliationCounts.get(key) > 1
      ? { ...author, affiliation: null }
      : author;
  });
}

function deriveIndexingPlatform(indexing = [], fallback = "") {
  return normalizeIndexingPlatform(fallback)
    || (Array.isArray(indexing) ? indexing.map((item) => normalizeIndexingPlatform(item?.source || item?.platform || item?.sourceKey || item?.source_key)).find(Boolean) : "")
    || "";
}

function deriveIndexingCategory(indexing = [], publicationType = "", fallback = "") {
  const selectedIndexing = getSelectedIndexingItem(indexing);

  return normalizeIndexingCategory(fallback)
    || normalizeIndexingCategory(selectedIndexing.category)
    || (Array.isArray(indexing) ? indexing
      .filter((item) => {
        const status = normalizeText(item?.quartileVerificationStatus || item?.quartile_verification_status).toLowerCase();
        return normalizeBoolean(item?.quartileVerified ?? item?.quartile_verified)
          || (status === "historical" && normalizeIndexingSource(item?.quartileSource || item?.quartile_source || item?.sourceKey || item?.source_key || item?.source) !== "manual")
          || status === "manual"
          || !status;
      })
      .map((item) => normalizeIndexingCategory(item?.category))
      .find(Boolean) : "")
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
  const selectedIndexing = getSelectedIndexingItem(indexing, values.quartile);
  const indexingSource = normalizeBoolean(values.indexingVerified ?? values.indexing_verified ?? selectedIndexing.indexingVerified ?? selectedIndexing.indexing_verified)
    ? "lookup"
    : "manual";
  const selectedQuartileStatus = normalizeText(selectedIndexing.quartileVerificationStatus || selectedIndexing.quartile_verification_status).toLowerCase();
  const selectedQuartileSource = normalizeIndexingSource(selectedIndexing.quartileSource || selectedIndexing.quartile_source || selectedIndexing.sourceKey || selectedIndexing.source_key || selectedIndexing.source);
  const hasLookupQuartile = normalizeBoolean(values.quartileVerified ?? values.quartile_verified ?? selectedIndexing.quartileVerified ?? selectedIndexing.quartile_verified)
    || selectedQuartileStatus === "verified"
    || (selectedQuartileStatus === "historical" && selectedQuartileSource !== "manual");
  const quartileSource = hasLookupQuartile
    ? "lookup"
    : "manual";

  return {
    doi: createFieldSource(values.doi, baseSource),
    title: createFieldSource(values.title, baseSource),
    authors: createFieldSource((Array.isArray(values.authors) ? values.authors : []).map((author) => author?.fullName || author?.full_name || author?.name).filter(Boolean), baseSource),
    authorAffiliation: createFieldSource(null, baseSource),
    publicationType: createFieldSource(values.publicationType || values.publication_type, baseSource),
    publicationSubtype: createFieldSource(values.publicationSubtype || values.publication_subtype, baseSource),
    venue: createFieldSource(values.venue || values.publishedIn || values.published_in || values.journal, baseSource),
    publisher: createFieldSource(values.publisher, baseSource),
    editors: createFieldSource(Array.isArray(values.editors) ? values.editors.map((editor) => editor?.fullName || editor?.full_name || editor?.name).filter(Boolean) : [], baseSource),
    bookSeriesTitle: createFieldSource(values.bookSeriesTitle || values.book_series_title || values.seriesTitle || values.series_title, baseSource),
    edition: createFieldSource(values.edition, baseSource),
    acceptanceDate: createFieldSource(values.acceptanceDate || values.acceptance_date, baseSource),
    publicationDate: createFieldSource(values.publicationDate || values.publication_date, baseSource),
    publicationYear: createFieldSource(values.publicationYear || values.publication_year || values.year, baseSource),
    sourceUrl: createFieldSource(values.sourceUrl || values.source_url, baseSource),
    volume: createFieldSource(values.volume, baseSource),
    issue: createFieldSource(values.issue, baseSource),
    pages: createFieldSource(values.pages, baseSource),
    pageStart: createFieldSource(values.pageStart || values.pagesStart || values.page_start || values.pages_start, baseSource),
    pageEnd: createFieldSource(values.pageEnd || values.pagesEnd || values.page_end || values.pages_end, baseSource),
    issn: createFieldSource(values.issn, baseSource),
    eIssn: createFieldSource(values.eIssn || values.e_issn, baseSource),
    isbn: createFieldSource(values.isbn, baseSource),
    abstract: createFieldSource(values.abstract, baseSource),
    conferenceLocation: createFieldSource(values.conferenceLocation || values.conference_location, baseSource),
    proceedingsTitle: createFieldSource(values.proceedingsTitle || values.proceedings_title, baseSource),
    eventDate: createFieldSource(values.eventDate || values.event_date, baseSource),
    indexingPlatform: createFieldSource(values.indexingPlatform || values.indexing_platform || selectedIndexing.source, indexingSource),
    customIndexingPlatform: createFieldSource(values.customIndexingPlatform || values.custom_indexing_platform, indexingSource),
    webOfScienceIndex: createFieldSource(values.webOfScienceIndex || values.web_of_science_index || selectedIndexing.webOfScienceIndex || selectedIndexing.web_of_science_index, indexingSource),
    indexingCategory: createFieldSource(values.indexingCategory || values.indexing_category || selectedIndexing.category, indexingSource),
    quartile: createFieldSource(values.quartile || selectedIndexing.quartile, quartileSource),
    sjr: createFieldSource(values.sjr || selectedIndexing.sjr, indexingSource),
    citeScore: createFieldSource(values.citeScore || values.cite_score || selectedIndexing.citeScore || selectedIndexing.cite_score, indexingSource),
    impactFactor: createFieldSource(values.impactFactor || values.impact_factor || selectedIndexing.impactFactor || selectedIndexing.impact_factor, indexingSource),
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
  const primary = getSelectedIndexingItem(indexing)?.quartile;

  return normalizeText(primary);
}

function getIndexingYear(item = {}) {
  return normalizeYear(item.year || item.indexing_year || item.coverYear || item.cover_year) || 0;
}

function isSelectedIndexingItem(item = {}) {
  const status = normalizeText(item?.quartileVerificationStatus || item?.quartile_verification_status).toLowerCase();
  const source = normalizeIndexingSource(item?.quartileSource || item?.quartile_source || item?.sourceKey || item?.source_key || item?.source);

  return Boolean(normalizeText(item?.quartile))
    && (
      normalizeBoolean(item?.quartileVerified ?? item?.quartile_verified)
      || status === "verified"
      || status === "manual"
      || (status === "historical" && source !== "manual")
      || (!status && source !== "manual")
    );
}

function getSelectedIndexingItem(indexing = [], fallbackQuartile = "") {
  const items = Array.isArray(indexing) ? indexing : [];
  const normalizedFallbackQuartile = normalizeQuartile(fallbackQuartile);
  const selected = items.find(isSelectedIndexingItem);

  if (selected) {
    return selected;
  }

  const quartileMatches = normalizedFallbackQuartile
    ? items.filter((item) => normalizeQuartile(item?.quartile) === normalizedFallbackQuartile)
    : items.filter((item) => normalizeQuartile(item?.quartile));

  return quartileMatches
    .sort((first, second) => getIndexingYear(second) - getIndexingYear(first))
    .find((item) => item?.quartile || item?.sjr || item?.citeScore || item?.cite_score || item?.impactFactor || item?.impact_factor)
    || items.find((item) => item?.source || item?.category || item?.quartile || item?.sjr || item?.citeScore || item?.cite_score || item?.impactFactor || item?.impact_factor)
    || {};
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
    || Object.prototype.hasOwnProperty.call(body, "customIndexingPlatform")
    || Object.prototype.hasOwnProperty.call(body, "custom_indexing_platform")
    || Object.prototype.hasOwnProperty.call(body, "webOfScienceIndex")
    || Object.prototype.hasOwnProperty.call(body, "web_of_science_index")
    || Object.prototype.hasOwnProperty.call(body, "indexingCategory")
    || Object.prototype.hasOwnProperty.call(body, "indexing_category")
    || Object.prototype.hasOwnProperty.call(body, "citeScore")
    || Object.prototype.hasOwnProperty.call(body, "cite_score")
    || Object.prototype.hasOwnProperty.call(body, "impactFactor")
    || Object.prototype.hasOwnProperty.call(body, "impact_factor");
  const hasEvidenceLinksInput =
    Object.prototype.hasOwnProperty.call(body, "evidenceLinks")
    || Object.prototype.hasOwnProperty.call(body, "evidence_links")
    || Object.prototype.hasOwnProperty.call(body, "attachments");
  const doi = normalizeDoi(body.doi);
  const title = normalizeText(body.title);
  const publicationType = normalizePublicationType(body.publicationType || body.publication_type);
  const publicationSubtype = normalizePublicationSubtype(body.publicationSubtype || body.publication_subtype);
  const canIndexPublication = supportsPublicationIndexing(publicationType);
  const isBookPublication = publicationType === "book";
  const isBookChapter = isBookChapterPublication(publicationType, publicationSubtype);
  const publicationYear = normalizeYear(body.publicationYear ?? body.publication_year);
  const publicationDate = normalizeOptionalDate(body.publicationDate || body.publication_date);
  const acceptanceDate = publicationType === "journal_article"
    ? normalizeOptionalDate(body.acceptanceDate || body.acceptance_date)
    : null;
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

  if ((body.acceptanceDate || body.acceptance_date) && !acceptanceDate) {
    errors.push({ field: "acceptanceDate", message: "Data e pranimit nuk eshte valide." });
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

  if (publicationType === "conference_paper" && !normalizeText(body.conferenceLocation ?? body.conference_location)) {
    errors.push({ field: "conferenceLocation", message: "Vendi i konferences eshte obligativ per punim konference." });
  }

  if (publicationType === "book" && !normalizeText(body.publisher) && !normalizeText(body.isbn)) {
    errors.push({ field: "publisher", message: "Book / Chapter duhet te kete botues ose ISBN." });
  }

  const authors = normalizeAuthors(body.authors);
  const requestedIndexingPlatform = canIndexPublication ? normalizeIndexingPlatform(body.indexingPlatform || body.indexing_platform) : "";
  const bodyCustomIndexingPlatform = canIndexPublication && requestedIndexingPlatform === "Other"
    ? normalizeCustomIndexingPlatform(body.customIndexingPlatform || body.custom_indexing_platform)
    : "";
  const bodyWebOfScienceIndex = canIndexPublication && requestedIndexingPlatform === "Web of Science"
    ? normalizeWebOfScienceIndex(body.webOfScienceIndex || body.web_of_science_index || body.indexingCategory || body.indexing_category)
    : "";
  const bodyImpactFactor = canIndexPublication && requestedIndexingPlatform === "Web of Science" ? normalizeImpactFactorValue(body.impactFactor || body.impact_factor) : "";
  const bodyQuartile = canIndexPublication && requestedIndexingPlatform === "Scopus" ? normalizeQuartile(body.quartile) : "";
  const bodyCiteScore = canIndexPublication && requestedIndexingPlatform === "Scopus" ? normalizeText(body.citeScore || body.cite_score || body.citescore) : "";
  const rawIndexing = canIndexPublication
    ? Array.isArray(body.indexing) && body.indexing.length
      ? body.indexing
      : (bodyQuartile || requestedIndexingPlatform || bodyCustomIndexingPlatform || bodyWebOfScienceIndex || bodyCiteScore || bodyImpactFactor)
        ? [{
            source: requestedIndexingPlatform || body.indexingSource || body.indexing_source,
            sourceKey: body.indexingSource || body.indexing_source,
            category: bodyWebOfScienceIndex,
            webOfScienceIndex: bodyWebOfScienceIndex,
            web_of_science_index: bodyWebOfScienceIndex,
            quartile: bodyQuartile,
            quartileVerified: body.quartileVerified ?? body.quartile_verified,
            quartileSource: body.quartileSource || body.quartile_source,
            quartileVerificationStatus: body.quartileVerificationStatus || body.quartile_verification_status || (bodyQuartile ? "manual" : "empty"),
            sjr: body.sjr,
            citeScore: bodyCiteScore,
            impactFactor: bodyImpactFactor,
          }]
        : Array.isArray(body.indexing)
          ? body.indexing
          : []
    : [];
  const indexing = hasIndexingInput
    ? normalizeIndexingInput(rawIndexing, publicationType)
    : undefined;
  const authorAffiliation = null;
  const indexingPlatform = canIndexPublication ? deriveIndexingPlatform(indexing, body.indexingPlatform || body.indexing_platform) : "";
  const customIndexingPlatform = canIndexPublication && indexingPlatform === "Other"
    ? normalizeCustomIndexingPlatform(body.customIndexingPlatform || body.custom_indexing_platform || bodyCustomIndexingPlatform)
    : "";
  const webOfScienceIndex = canIndexPublication && indexingPlatform === "Web of Science"
    ? normalizeWebOfScienceIndex(body.webOfScienceIndex || body.web_of_science_index || bodyWebOfScienceIndex || deriveIndexingCategory(indexing, publicationType))
    : "";
  const indexingCategory = webOfScienceIndex;
  const evidenceLinks = hasEvidenceLinksInput
    ? normalizeEvidenceLinks(body.evidenceLinks || body.evidence_links || body.attachments, errors)
    : undefined;
  const metadataVerified = normalizeBoolean(body.metadataVerified ?? body.metadata_verified) || metadataSource === "doi";
  const externalMetadataId = normalizeDoi(body.externalMetadataId || body.external_metadata_id)
    || (metadataSource === "doi" ? doi : null);
  const requestedIndexingSource = normalizeIndexingSource(body.indexingSource || body.indexing_source || indexing?.[0]?.sourceKey || indexing?.[0]?.source_key || indexing?.[0]?.source);
  const indexingVerified = canIndexPublication && normalizeBoolean(body.indexingVerified ?? body.indexing_verified)
    && requestedIndexingSource !== "manual"
    && Boolean(indexingPlatform || indexing?.some((item) => item.source || item.category || item.quartile || item.sjr || item.citeScore));
  const indexingSource = indexingVerified ? requestedIndexingSource : "manual";
  const hasIndexingClaim = canIndexPublication && Boolean(
    indexingCategory
    || customIndexingPlatform
    || bodyQuartile
    || normalizeText(body.sjr)
    || bodyCiteScore
    || bodyImpactFactor
    || indexingVerified
    || indexing?.some((item) =>
      item.category
      || item.webOfScienceIndex
      || item.web_of_science_index
      || item.quartile
      || item.sjr
      || item.citeScore
      || item.cite_score
      || item.impactFactor
      || item.impact_factor
      || item.indexedUrl
      || item.indexed_url
    )
  );
  const shouldRequireIndexingPlatform = publicationType === "journal_article" && hasIndexingClaim && !indexingPlatform;

  if (!authors.length) {
    errors.push({ field: "authors", message: "Shto se paku nje autor per publikimin." });
  }

  if (shouldRequireIndexingPlatform) {
    errors.push({ field: "indexingPlatform", message: "Indeksimi ne platforme kerkohet kur publikimi shenohet si i indeksuar." });
  } else if (indexingPlatform && !VALID_INDEXING_PLATFORMS.has(indexingPlatform)) {
    errors.push({ field: "indexingPlatform", message: "Indeksimi ne platforme nuk eshte valid." });
  }

  if (indexingCategory.length > 200) {
    errors.push({ field: "indexingCategory", message: "Kategoria / grupi i indeksimit eshte shume e gjate." });
  }

  const authorsWithAffiliation = sanitizeConferenceAuthorAffiliations(authors.map((author) => {
    return {
      ...author,
      affiliation: normalizeNullableText(author.affiliation),
      isCorrespondingAuthor: Boolean(author.isCorrespondingAuthor),
    };
  }), publicationType, metadataSource);
  const normalizedIndexing = !canIndexPublication
    ? []
    : indexing !== undefined
    ? indexing.length
      ? indexing.map((item, index) => index === 0
        ? {
            ...item,
            source: indexingPlatform,
            platform: indexingPlatform,
            sourceKey: item.sourceKey || item.source_key || indexingSource,
            source_key: item.source_key || item.sourceKey || indexingSource,
            category: indexingCategory,
            webOfScienceIndex,
            web_of_science_index: webOfScienceIndex,
            quartile: bodyQuartile,
            quartileVerified: normalizeBoolean(item.quartileVerified ?? item.quartile_verified),
            quartile_verified: normalizeBoolean(item.quartileVerified ?? item.quartile_verified),
            quartileSource: normalizeIndexingSource(item.quartileSource || item.quartile_source || indexingSource),
            quartile_source: normalizeIndexingSource(item.quartileSource || item.quartile_source || indexingSource),
            quartileVerificationStatus: item.quartileVerificationStatus || item.quartile_verification_status || (bodyQuartile ? "manual" : "empty"),
            quartile_verification_status: item.quartileVerificationStatus || item.quartile_verification_status || (bodyQuartile ? "manual" : "empty"),
            quartileSelectionReason: item.quartileSelectionReason || item.quartile_selection_reason || "",
            quartile_selection_reason: item.quartileSelectionReason || item.quartile_selection_reason || "",
            impactFactor: bodyImpactFactor,
            impact_factor: bodyImpactFactor,
            citeScore: bodyCiteScore,
            cite_score: bodyCiteScore,
          }
        : item)
      : hasIndexingClaim || indexingPlatform
        ? [{ source: indexingPlatform, platform: indexingPlatform, sourceKey: indexingSource, source_key: indexingSource, category: indexingCategory, webOfScienceIndex, web_of_science_index: webOfScienceIndex, quartile: bodyQuartile, quartileVerified: normalizeBoolean(body.quartileVerified ?? body.quartile_verified), quartile_verified: normalizeBoolean(body.quartileVerified ?? body.quartile_verified), quartileSource: normalizeIndexingSource(body.quartileSource || body.quartile_source || indexingSource), quartile_source: normalizeIndexingSource(body.quartileSource || body.quartile_source || indexingSource), quartileVerificationStatus: body.quartileVerificationStatus || body.quartile_verification_status || (bodyQuartile ? "manual" : "empty"), quartile_verification_status: body.quartileVerificationStatus || body.quartile_verification_status || (bodyQuartile ? "manual" : "empty"), quartileSelectionReason: body.quartileSelectionReason || body.quartile_selection_reason || "", quartile_selection_reason: body.quartileSelectionReason || body.quartile_selection_reason || "", impactFactor: bodyImpactFactor, impact_factor: bodyImpactFactor, sjr: indexingPlatform === "Scopus" ? normalizeText(body.sjr) : "", citeScore: bodyCiteScore, indexedUrl: "" }]
        : []
    : undefined;

  return {
    errors,
    values: {
      doi: doi || null,
      title,
      abstract: nullableConferenceAbstract(publicationType, body.abstract),
      publicationType,
      publicationSubtype,
      venue: normalizeText(body.venue || body.publishedIn || body.published_in || body.journal),
      conferenceLocation: publicationType === "conference_paper" ? normalizeText(body.conferenceLocation ?? body.conference_location) : "",
      publisher: normalizeText(body.publisher),
      acceptanceDate,
      publicationDate: isBookPublication && !isBookChapter ? null : publicationDate,
      publicationYear: isBookPublication && !isBookChapter ? null : publicationYear,
      sourceUrl,
      volume: isBookPublication && !isBookChapter ? "" : normalizeText(body.volume),
      issue: isBookPublication ? "" : normalizeText(body.issue),
      pages: nullableConferenceText(publicationType, body.pages),
      issn: isBookPublication ? "" : nullableConferenceText(publicationType, body.issn),
      eIssn: publicationType === "journal_article" ? normalizeEIssn(body.eIssn || body.e_issn) : "",
      e_issn: publicationType === "journal_article" ? normalizeEIssn(body.eIssn || body.e_issn) : "",
      isbn: publicationType === "journal_article" ? "" : nullableConferenceText(publicationType, body.isbn),
      authorAffiliation,
      indexingPlatform,
      customIndexingPlatform,
      custom_indexing_platform: customIndexingPlatform,
      webOfScienceIndex,
      web_of_science_index: webOfScienceIndex,
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
        customIndexingPlatform,
        custom_indexing_platform: customIndexingPlatform,
        webOfScienceIndex,
        web_of_science_index: webOfScienceIndex,
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
  const metadataRaw = row.metadata_raw_json && typeof row.metadata_raw_json === "object" ? row.metadata_raw_json : {};
  const publicationType = normalizePublicationType(row.publication_type || row.metadata_type);
  const publicationSubtype = getPublicationSubtypeFromRaw(metadataRaw);
  const isBookPublication = publicationType === "book";
  const isBookChapter = isBookChapterPublication(publicationType, publicationSubtype);
  const isConferencePaper = publicationType === "conference_paper";
  const hideJournalSpecificFields = isBookPublication;
  const hideVolumeField = isBookPublication && !isBookChapter;
  const indexing = supportsPublicationIndexing(publicationType) ? getArrayField(row, "indexing").map((item) => ({
    source: normalizeIndexingPlatform(item.source || item.platform),
    platform: normalizeIndexingPlatform(item.platform || item.source),
    sourceKey: normalizeIndexingSource(item.source_key || item.sourceKey || item.indexing_source || item.indexingSource || item.source),
    source_key: normalizeIndexingSource(item.source_key || item.sourceKey || item.indexing_source || item.indexingSource || item.source),
    category: item.category || "",
    webOfScienceIndex: normalizeWebOfScienceIndex(item.web_of_science_index || item.webOfScienceIndex || item.category),
    web_of_science_index: normalizeWebOfScienceIndex(item.web_of_science_index || item.webOfScienceIndex || item.category),
    quartile: normalizeQuartile(item.quartile),
    quartileVerified: normalizeBoolean(item.quartile_verified ?? item.quartileVerified),
    quartile_verified: normalizeBoolean(item.quartile_verified ?? item.quartileVerified),
    quartileSource: normalizeIndexingSource(item.quartile_source || item.quartileSource || item.source_key || item.sourceKey || item.source),
    quartile_source: normalizeIndexingSource(item.quartile_source || item.quartileSource || item.source_key || item.sourceKey || item.source),
    quartileVerificationStatus: item.quartile_verification_status || item.quartileVerificationStatus || (item.quartile ? "manual" : "empty"),
    quartile_verification_status: item.quartile_verification_status || item.quartileVerificationStatus || (item.quartile ? "manual" : "empty"),
    quartileSelectionReason: item.quartile_selection_reason || item.quartileSelectionReason || "",
    quartile_selection_reason: item.quartile_selection_reason || item.quartileSelectionReason || "",
    impactFactor: normalizeImpactFactorValue(item.impact_factor || item.impactFactor),
    impact_factor: normalizeImpactFactorValue(item.impact_factor || item.impactFactor),
    sjr: item.sjr || "",
    citeScore: item.cite_score || item.citeScore || item.citescore || "",
    cite_score: item.cite_score || item.citeScore || item.citescore || "",
    citescore: item.cite_score || item.citeScore || item.citescore || "",
    indexedUrl: item.indexed_url || item.indexedUrl || "",
    indexed_url: item.indexed_url || item.indexedUrl || "",
  })) : [];
  const authorAffiliation = null;
  const indexingPlatform = supportsPublicationIndexing(publicationType) ? row.indexing_platform || deriveIndexingPlatform(indexing) : "";
  const customIndexingPlatform = supportsPublicationIndexing(publicationType) && indexingPlatform === "Other" ? normalizeCustomIndexingPlatform(row.custom_indexing_platform) : "";
  const webOfScienceIndex = supportsPublicationIndexing(publicationType) && indexingPlatform === "Web of Science" ? normalizeWebOfScienceIndex(row.web_of_science_index || deriveIndexingCategory(indexing, publicationType)) : "";
  const indexingCategory = supportsPublicationIndexing(publicationType) ? webOfScienceIndex : "";
  const indexingVerified = supportsPublicationIndexing(publicationType) && Boolean(row.indexing_verified);
  const indexingSource = supportsPublicationIndexing(publicationType) ? normalizeIndexingSource(row.indexing_source || indexing.find((item) => item.sourceKey)?.sourceKey || indexing.find((item) => item.source)?.source) : "manual";
  const selectedIndexing = getSelectedIndexingItem(indexing, row.quartile);
  const selectedQuartile = supportsPublicationIndexing(publicationType) ? getPrimaryQuartile(indexing) : "";
  const selectedCiteScore = supportsPublicationIndexing(publicationType)
    ? normalizeText(row.cite_score || row.citeScore || selectedIndexing.citeScore || selectedIndexing.cite_score || selectedIndexing.citescore)
    : "";
  const selectedSjr = supportsPublicationIndexing(publicationType) ? normalizeText(row.sjr || selectedIndexing.sjr) : "";
  const impactFactorIndexing = indexing.find((item) => normalizeImpactFactorValue(item.impactFactor || item.impact_factor)) || {};
  const selectedImpactFactor = supportsPublicationIndexing(publicationType)
    ? normalizeImpactFactorValue(row.impact_factor || row.impactFactor || selectedIndexing.impactFactor || selectedIndexing.impact_factor || impactFactorIndexing.impactFactor || impactFactorIndexing.impact_factor)
    : "";
  const selectedCiteScoreVerified = supportsPublicationIndexing(publicationType)
    && normalizeBoolean(row.cite_score_verified ?? row.citeScoreVerified ?? selectedIndexing.citeScoreVerified ?? selectedIndexing.cite_score_verified);
  const bookChapterEditors = isBookChapter ? getBookChapterEditorsFromRaw(metadataRaw) : [];
  const bookChapterSeriesTitle = isBookChapter ? getBookChapterSeriesTitleFromRaw(metadataRaw) : "";
  const bookChapterEdition = isBookChapter ? getBookChapterEditionFromRaw(metadataRaw) : "";
  const conferenceProceedingsTitle = isConferencePaper ? getConferenceProceedingsTitleFromRaw(metadataRaw, row.venue || row.container_title || "") : "";
  const conferenceEventDate = isConferencePaper ? getConferenceEventDateFromRaw(metadataRaw) : "";
  const conferencePageRange = isConferencePaper ? getConferencePageRangeFromRaw(metadataRaw, row.pages) : {};
  const fieldSources = buildPublicationFieldSources({
    doi: row.doi || "",
    title: row.title || "",
    abstract: nullableConferenceAbstract(publicationType, row.abstract),
    publicationType,
    venue: row.venue || "",
    conferenceLocation: publicationType === "conference_paper" ? row.conference_location || "" : "",
    publisher: row.publisher || "",
    publicationSubtype,
    acceptanceDate: publicationType === "journal_article" ? row.acceptance_date || null : null,
    publicationDate: isBookPublication && !isBookChapter ? null : row.publication_date || null,
    publicationYear: isBookPublication && !isBookChapter ? "" : row.publication_year || row.year || "",
    sourceUrl: row.source_url || "",
    volume: hideVolumeField ? "" : row.volume || "",
    issue: hideJournalSpecificFields ? "" : row.issue || "",
    pages: nullableConferenceText(publicationType, row.pages),
    pageStart: conferencePageRange.pageStart || "",
    pageEnd: conferencePageRange.pageEnd || "",
    issn: hideJournalSpecificFields ? "" : nullableConferenceText(publicationType, row.issn),
    eIssn: publicationType === "journal_article" ? normalizeEIssn(row.e_issn) : "",
    e_issn: publicationType === "journal_article" ? normalizeEIssn(row.e_issn) : "",
    isbn: publicationType === "journal_article" ? "" : nullableConferenceText(publicationType, row.isbn),
    authorAffiliation,
    proceedingsTitle: conferenceProceedingsTitle,
    eventDate: conferenceEventDate,
    indexingPlatform,
    customIndexingPlatform,
    webOfScienceIndex,
    indexingCategory,
    indexingVerified,
    indexingSource,
    indexing,
    authors,
    quartile: selectedQuartile,
    sjr: selectedSjr,
    citeScore: selectedCiteScore,
    impactFactor: selectedImpactFactor,
  }, row.metadata_source || "manual");

  return {
    id: row.id,
    ownerId: row.owner_id || null,
    owner_id: row.owner_id || null,
    title: row.title || "",
    abstract: normalizeAbstractText(row.abstract),
    publicationType,
    publication_type: publicationType,
    publicationSubtype,
    publication_subtype: publicationSubtype,
    venue: row.venue || "",
    publishedIn: row.venue || "",
    published_in: row.venue || "",
    conferenceLocation: publicationType === "conference_paper" ? row.conference_location || "" : "",
    conference_location: publicationType === "conference_paper" ? row.conference_location || "" : "",
    publisher: row.publisher || "",
    acceptanceDate: publicationType === "journal_article" ? row.acceptance_date || null : null,
    acceptance_date: publicationType === "journal_article" ? row.acceptance_date || null : null,
    editors: bookChapterEditors,
    editor: bookChapterEditors,
    bookSeriesTitle: bookChapterSeriesTitle,
    book_series_title: bookChapterSeriesTitle,
    seriesTitle: bookChapterSeriesTitle,
    series_title: bookChapterSeriesTitle,
    edition: bookChapterEdition,
    proceedingsTitle: conferenceProceedingsTitle,
    proceedings_title: conferenceProceedingsTitle,
    eventDate: conferenceEventDate,
    event_date: conferenceEventDate,
    publicationDate: isBookPublication && !isBookChapter ? null : row.publication_date || null,
    publication_date: isBookPublication && !isBookChapter ? null : row.publication_date || null,
    publicationYear: isBookPublication && !isBookChapter ? "" : row.publication_year || row.year || "",
    publication_year: isBookPublication && !isBookChapter ? "" : row.publication_year || row.year || "",
    doi: row.doi || "",
    sourceUrl: row.source_url || "",
    source_url: row.source_url || "",
    volume: hideVolumeField ? "" : row.volume || "",
    issue: hideJournalSpecificFields ? "" : row.issue || "",
    pages: row.pages || "",
    pageStart: conferencePageRange.pageStart || "",
    page_start: conferencePageRange.pageStart || "",
    pagesStart: conferencePageRange.pagesStart || "",
    pages_start: conferencePageRange.pages_start || "",
    pageEnd: conferencePageRange.pageEnd || "",
    page_end: conferencePageRange.pageEnd || "",
    pagesEnd: conferencePageRange.pagesEnd || "",
    pages_end: conferencePageRange.pages_end || "",
    issn: hideJournalSpecificFields ? "" : row.issn || "",
    eIssn: publicationType === "journal_article" ? row.e_issn || "" : "",
    e_issn: publicationType === "journal_article" ? row.e_issn || "" : "",
    isbn: publicationType === "journal_article" ? "" : row.isbn || "",
    authorAffiliation,
    author_affiliation: authorAffiliation,
    affiliation: authorAffiliation,
    indexingPlatform,
    indexing_platform: indexingPlatform,
    customIndexingPlatform,
    custom_indexing_platform: customIndexingPlatform,
    webOfScienceIndex,
    web_of_science_index: webOfScienceIndex,
    indexingCategory,
    indexing_category: indexingCategory,
    indexingVerified,
    indexing_verified: indexingVerified,
    indexingSource,
    indexing_source: indexingSource,
    quartile: selectedQuartile,
    sjr: selectedSjr,
    impactFactor: selectedImpactFactor,
    impact_factor: selectedImpactFactor,
    citeScore: selectedCiteScore,
    cite_score: selectedCiteScore,
    citescore: selectedCiteScore,
    citeScoreVerified: selectedCiteScoreVerified,
    cite_score_verified: selectedCiteScoreVerified,
    authors: sanitizeConferenceAuthorAffiliations(authors.map((author, index) => ({
      fullName: author.full_name || author.fullName || "",
      full_name: author.full_name || author.fullName || "",
      givenName: author.given_name || author.givenName || "",
      given_name: author.given_name || author.givenName || "",
      familyName: author.family_name || author.familyName || "",
      family_name: author.family_name || author.familyName || "",
      orcid: author.orcid || "",
      affiliation: normalizeNullableText(normalizeAuthorAffiliation(
        author.affiliation
        || author.affiliations
        || author.institution
        || author.organization
        || author.currentAffiliation
        || author.current_affiliation
      )),
      authorOrder: author.author_order || author.authorOrder || index + 1,
      author_order: author.author_order || author.authorOrder || index + 1,
      isMainAuthor: index === 0,
      is_main_author: index === 0,
      isCorrespondingAuthor: normalizeBoolean(author.is_corresponding_author ?? author.isCorrespondingAuthor),
      is_corresponding_author: normalizeBoolean(author.is_corresponding_author ?? author.isCorrespondingAuthor),
    })), publicationType, row.metadata_source || "manual"),
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
    owner: {
      id: row.owner_id || null,
      name: row.owner_name || "",
      email: row.owner_email || "",
      faculty: row.owner_faculty || "",
      department: row.owner_department || "",
      academicTitle: row.owner_academic_title || "",
      academic_title: row.owner_academic_title || "",
    },
  };
}

const PUBLICATION_SELECT_SQL = `
  p.id, p.owner_id, p.doi, p.title, p.abstract, p.publication_type, p.venue, p.conference_location,
  p.publisher, p.acceptance_date, p.publication_date, p.publication_year, p.source_url, p.volume,
  p.issue, p.pages, p.issn, p.e_issn, p.isbn, p.author_affiliation, p.indexing_platform,
  p.custom_indexing_platform, p.web_of_science_index, p.indexing_category,
  p.indexing_verified, p.indexing_source, p.metadata_source, p.metadata_verified,
  p.external_metadata_id, p.status, p.created_at, p.updated_at,
  p.metadata_review_status, p.metadata_review_checklist, p.metadata_review_comment,
  p.revision_requested_by, p.revision_requested_at, p.resubmitted_at,
  u.full_name as owner_name, u.email as owner_email, u.faculty as owner_faculty,
  u.department as owner_department, u.academic_title as owner_academic_title,
  m.type as metadata_type, m.authors as metadata_authors, m.raw_json as metadata_raw_json,
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
      'platform', pi.source,
      'source_key', pi.source_key,
      'category', pi.category,
      'web_of_science_index', pi.web_of_science_index,
      'quartile', pi.quartile,
      'quartile_verified', pi.quartile_verified,
      'quartile_source', pi.quartile_source,
      'quartile_verification_status', pi.quartile_verification_status,
      'quartile_selection_reason', pi.quartile_selection_reason,
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
  u.full_name as owner_name, u.email as owner_email, u.faculty as owner_faculty,
  u.department as owner_department, u.academic_title as owner_academic_title,
  '[]'::jsonb as review_history,
  m.container_title, m.publisher, m.year, m.type as metadata_type, m.authors as metadata_authors, m.source_url,
  m.raw_json as metadata_raw_json
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
         'acceptance_date',
         'publication_date',
         'source_url',
         'volume',
         'issue',
         'pages',
         'issn',
         'e_issn',
         'isbn',
         'author_affiliation',
         'indexing_platform',
         'custom_indexing_platform',
         'web_of_science_index',
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

  unifiedPublicationSchemaCache = columnsResult.rows.length === 23 && tablesResult.rows.length === 4;
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
        Boolean(author.isCorrespondingAuthor),
        authorOrder,
        authorOrder,
      ]
    );
  }

  for (const item of values.indexing || []) {
    await client.query(
      `insert into publication_indexing
       (publication_id, source, source_key, category, web_of_science_index, quartile, quartile_verified, quartile_source, quartile_verification_status, quartile_selection_reason, impact_factor, sjr, cite_score, indexed_url)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        publicationId,
        item.source,
        item.sourceKey || item.source_key || values.indexingSource,
        item.category,
        item.webOfScienceIndex || item.web_of_science_index || "",
        item.quartile,
        Boolean(item.quartileVerified ?? item.quartile_verified),
        item.quartileSource || item.quartile_source || "manual",
        item.quartileVerificationStatus || item.quartile_verification_status || (item.quartile ? "manual" : "empty"),
        item.quartileSelectionReason || item.quartile_selection_reason || "",
        item.impactFactor,
        item.sjr,
        normalizeNullableText(item.citeScore || item.cite_score || item.citescore),
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
    ["e_issn", values.eIssn || values.e_issn],
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
     left join users u on u.id = p.owner_id
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
    alter table publications add column if not exists acceptance_date date;
    alter table publications add column if not exists author_affiliation text not null default '';
    alter table publications add column if not exists indexing_platform text not null default '';
    alter table publications add column if not exists custom_indexing_platform text not null default '';
    alter table publications add column if not exists web_of_science_index text not null default '';
    alter table publications add column if not exists indexing_category text not null default '';
    alter table publications add column if not exists indexing_verified boolean not null default false;
    alter table publications add column if not exists indexing_source text not null default 'manual';
    alter table publications add column if not exists metadata_review_checklist jsonb not null default '{}'::jsonb;
    alter table publications add column if not exists metadata_review_comment text not null default '';
    alter table publications add column if not exists revision_requested_by uuid references users(id) on delete set null;
    alter table publications add column if not exists revision_requested_at timestamptz;
    alter table publications add column if not exists resubmitted_at timestamptz;
    alter table if exists publication_authors add column if not exists is_corresponding_author boolean not null default false;
    alter table publications alter column abstract drop not null;
    alter table publications alter column abstract drop default;
    alter table publications alter column pages drop not null;
    alter table publications alter column pages drop default;
    alter table publications alter column issn drop not null;
    alter table publications alter column issn drop default;
    alter table publications add column if not exists e_issn text;
    alter table publications alter column e_issn drop not null;
    alter table publications alter column e_issn drop default;
    alter table publications alter column isbn drop not null;
    alter table publications alter column isbn drop default;
    alter table publications alter column author_affiliation drop not null;
    alter table publications alter column author_affiliation drop default;
    alter table if exists publication_authors alter column affiliation drop not null;
    alter table if exists publication_authors alter column affiliation drop default;
    alter table if exists publication_indexing add column if not exists source_key text not null default 'manual';
    alter table if exists publication_indexing add column if not exists category text not null default '';
    alter table if exists publication_indexing add column if not exists web_of_science_index text not null default '';
    alter table if exists publication_indexing add column if not exists sjr text not null default '';
    alter table if exists publication_indexing add column if not exists cite_score text;
    alter table if exists publication_indexing alter column cite_score drop not null;
    alter table if exists publication_indexing alter column cite_score drop default;
    alter table if exists publication_indexing add column if not exists quartile_verified boolean not null default false;
    alter table if exists publication_indexing add column if not exists quartile_source text not null default 'manual';
    alter table if exists publication_indexing add column if not exists quartile_verification_status text not null default 'empty';
    alter table if exists publication_indexing add column if not exists quartile_selection_reason text not null default '';
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
     left join users u on u.id = p.owner_id
     where p.owner_id = $1 and p.doi = $2
     limit 1`,
    [ownerId, doi]
  );

  return rows[0] || null;
}

async function resolveExistingExternalMetadataId(client, doi) {
  const normalizedDoi = normalizeDoi(doi);

  if (!normalizedDoi) {
    return null;
  }

  const { rows } = await client.query(
    `select doi
     from publication_metadata
     where doi = $1
     limit 1`,
    [normalizedDoi]
  );

  return rows[0]?.doi || null;
}

function sendPublicationError(res, status, error, message, extra = {}) {
  res.status(status).json({ error, message, ...extra });
}

function formatPublicationSqlError(error, fallbackMessage) {
  const details = [
    error?.message,
    error?.detail,
    error?.constraint ? `constraint: ${error.constraint}` : "",
    error?.table ? `table: ${error.table}` : "",
    error?.column ? `column: ${error.column}` : "",
  ].filter(Boolean);

  return details.length ? `Gabim SQL: ${details.join(" | ")}` : fallbackMessage;
}

function getPublicationSqlErrorDetails(error) {
  return {
    code: error?.code || "",
    detail: error?.detail || "",
    constraint: error?.constraint || "",
    table: error?.table || "",
    column: error?.column || "",
  };
}

function normalizeMetadataReviewChecklist(value = {}) {
  const checklist = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return Object.keys(METADATA_REVIEW_CHECKLIST_LABELS).reduce((items, key) => {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

    if (!Object.prototype.hasOwnProperty.call(checklist, key) && !Object.prototype.hasOwnProperty.call(checklist, snakeKey)) {
      return items;
    }

    return {
      ...items,
      [key]: Boolean(checklist[key] ?? checklist[snakeKey]),
    };
  }, {});
}

function getMetadataReviewIssueLabels(checklist = {}) {
  return Object.entries(METADATA_REVIEW_CHECKLIST_LABELS)
    .filter(([key]) => Object.prototype.hasOwnProperty.call(checklist, key) && !checklist[key])
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

function extractNthArrayValue(value, index = 0) {
  return Array.isArray(value) ? normalizeText(value[index]) : "";
}

function normalizeComparableName(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function metadataAuthorToPublicationAuthor(author, index, currentUser = {}, mainAuthorIndex = 0) {
  const currentUserName = normalizeComparableName(currentUser.full_name || currentUser.name);

  if (typeof author === "string") {
    const matchesCurrentUser = currentUserName && normalizeComparableName(author) === currentUserName;

    return {
      fullName: normalizeText(author),
      givenName: "",
      familyName: "",
      orcid: matchesCurrentUser ? normalizeOrcid(currentUser.orcid_id || currentUser.orcidId) : "",
      affiliation: null,
      isMainAuthor: index === mainAuthorIndex,
      isCorrespondingAuthor: false,
      authorOrder: index + 1,
    };
  }

  const fullName = normalizeText(author?.fullName || author?.full_name || author?.name);
  const matchesCurrentUser = currentUserName && normalizeComparableName(fullName) === currentUserName;

  return {
    fullName,
    givenName: normalizeText(author?.givenName || author?.given_name),
    familyName: normalizeText(author?.familyName || author?.family_name),
    orcid: normalizeOrcid(author?.orcid) || (matchesCurrentUser ? normalizeOrcid(currentUser.orcid_id || currentUser.orcidId) : ""),
    affiliation: normalizeAuthorAffiliation(
      author?.affiliation
      || author?.affiliations
      || author?.institution
      || author?.organization
    ) || null,
    isMainAuthor: index === mainAuthorIndex,
    isCorrespondingAuthor: normalizeBoolean(
      author?.isCorrespondingAuthor
      ?? author?.is_corresponding_author
      ?? author?.corresponding_author
      ?? author?.correspondingAuthor
      ?? author?.is_corresponding
      ?? author?.isCorresponding
      ?? author?.corresponding
    ),
    authorOrder: index + 1,
  };
}

function metadataToPublicationPayload(metadata = {}, currentUser = {}) {
  const raw = metadata.raw_json || {};
  const eIssn = metadata.eIssn || metadata.e_issn || metadata.eissn || extractIssnByType(raw, "electronic") || raw.eISSN || raw.eissn || raw.EISSN || extractNthArrayValue(raw.ISSN || raw.issn, 1) || "";
  const issn = metadata.issn || extractIssnByType(raw, "print") || extractFirstArrayValue(raw.ISSN || raw.issn);
  const isbn = metadata.isbn || extractFirstArrayValue(raw.ISBN || raw.isbn);
  const publicationType = normalizePublicationType(metadata.type);
  const publicationSubtype = normalizePublicationSubtype(metadata.publicationSubtype || metadata.publication_subtype || getPublicationSubtypeFromRaw(raw));
  const indexing = Array.isArray(metadata.indexing) ? metadata.indexing : [];
  const metadataAuthors = Array.isArray(metadata.authors) ? metadata.authors : [];
  const editors = Array.isArray(metadata.editors) && metadata.editors.length ? metadata.editors : getBookChapterEditorsFromRaw(raw);
  const bookSeriesTitle = metadata.bookSeriesTitle || metadata.book_series_title || metadata.seriesTitle || metadata.series_title || getBookChapterSeriesTitleFromRaw(raw);
  const edition = metadata.edition || getBookChapterEditionFromRaw(raw);
  const proceedingsTitle = publicationType === "conference_paper"
    ? metadata.proceedingsTitle || metadata.proceedings_title || getConferenceProceedingsTitleFromRaw(raw, metadata.conferenceName || metadata.conference_name || metadata.container_title)
    : "";
  const eventDate = publicationType === "conference_paper"
    ? metadata.eventDate || metadata.event_date || getConferenceEventDateFromRaw(raw)
    : "";
  const pageRange = publicationType === "conference_paper" ? getConferencePageRangeFromRaw(raw, metadata.pages) : {};

  return {
    doi: metadata.doi || "",
    title: metadata.chapter_title || metadata.chapterTitle || metadata.title || "",
    abstract: nullableConferenceAbstract(publicationType, metadata.abstract),
    publicationType,
    publicationSubtype,
    publication_subtype: publicationSubtype,
    venue: publicationType === "book"
      ? metadata.book_title || metadata.bookTitle || metadata.container_title || ""
      : metadata.conferenceName || metadata.conference_name || metadata.container_title || "",
    conferenceLocation: metadata.conferenceLocation || metadata.conference_location || "",
    publisher: metadata.publisher || "",
    editors,
    editor: editors,
    bookSeriesTitle,
    book_series_title: bookSeriesTitle,
    seriesTitle: bookSeriesTitle,
    series_title: bookSeriesTitle,
    edition,
    proceedingsTitle,
    proceedings_title: proceedingsTitle,
    eventDate,
    event_date: eventDate,
    acceptanceDate: publicationType === "journal_article" ? metadata.acceptanceDate || metadata.acceptance_date || getAcceptanceDateFromRaw(raw) : "",
    acceptance_date: publicationType === "journal_article" ? metadata.acceptanceDate || metadata.acceptance_date || getAcceptanceDateFromRaw(raw) : "",
    publicationDate: /^\d{4}-\d{1,2}-\d{1,2}$/.test(metadata.published_date || "")
      ? metadata.published_date.split("-").map((part) => part.padStart(2, "0")).join("-")
      : "",
    publicationYear: metadata.year || "",
    sourceUrl: getArticleLinkFromMetadata(metadata),
    volume: metadata.volume || "",
    issue: metadata.issue || "",
    pages: nullableConferenceText(publicationType, metadata.pages),
    pageStart: pageRange.pageStart || "",
    page_start: pageRange.pageStart || "",
    pagesStart: pageRange.pagesStart || "",
    pages_start: pageRange.pages_start || "",
    pageEnd: pageRange.pageEnd || "",
    page_end: pageRange.pageEnd || "",
    pagesEnd: pageRange.pagesEnd || "",
    pages_end: pageRange.pages_end || "",
    issn: nullableConferenceText(publicationType, issn),
    eIssn: publicationType === "journal_article" ? normalizeEIssn(eIssn) : "",
    e_issn: publicationType === "journal_article" ? normalizeEIssn(eIssn) : "",
    isbn: publicationType === "journal_article" ? "" : nullableConferenceText(publicationType, isbn),
    authorAffiliation: null,
    indexingPlatform: deriveIndexingPlatform(indexing),
    indexingCategory: deriveIndexingCategory(indexing, publicationType),
    indexingVerified: Boolean(metadata.indexingVerified ?? metadata.indexing_verified),
    indexingSource: normalizeIndexingSource(metadata.indexingSource || metadata.indexing_source || indexing.find((item) => item?.sourceKey || item?.source_key || item?.source)?.sourceKey || indexing.find((item) => item?.sourceKey || item?.source_key || item?.source)?.source_key || indexing.find((item) => item?.source)?.source),
    quartile: metadata.quartile || "",
    quartileVerified: Boolean(metadata.quartileVerified ?? metadata.quartile_verified),
    quartileSource: normalizeIndexingSource(metadata.quartileSource || metadata.quartile_source),
    quartileVerificationStatus: metadata.quartileVerificationStatus || metadata.quartile_verification_status || "manual_required",
    status: "draft",
    authors: metadataAuthors.map((author, index) =>
      metadataAuthorToPublicationAuthor(author, index, currentUser, 0)
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

function hasSubmittedPublicationDetails(body = {}) {
  const hasTitle = Boolean(normalizeText(body.title));
  const hasVenue = Boolean(normalizeText(body.venue || body.publishedIn || body.published_in || body.journal));
  const hasAuthors = Array.isArray(body.authors)
    && body.authors.some((author) =>
      normalizeText(author?.fullName || author?.full_name || author?.name || author?.givenName || author?.given_name || author?.familyName || author?.family_name)
    );

  return hasTitle && hasVenue && hasAuthors;
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

  if (hasSubmittedPublicationDetails(body)) {
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

  const externalMetadataId = await resolveExistingExternalMetadataId(client, values.externalMetadataId);
  const { rows } = await client.query(
    `insert into publications
     (owner_id, doi, title, abstract, publication_type, venue, publisher, acceptance_date, publication_date,
      conference_location, publication_year, source_url, volume, issue, pages, issn, e_issn, isbn, status,
      author_affiliation, indexing_platform, custom_indexing_platform, web_of_science_index, indexing_category, indexing_verified, indexing_source,
      metadata_source, metadata_verified, external_metadata_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
     returning id`,
    [
      ownerId,
      values.doi,
      values.title,
      values.abstract,
      values.publicationType,
      values.venue || null,
      values.publisher,
      values.acceptanceDate,
      values.publicationDate,
      values.conferenceLocation,
      values.publicationYear,
      values.sourceUrl,
      values.volume,
      values.issue,
      values.pages,
      values.issn,
      values.eIssn || values.e_issn,
      values.isbn,
      values.status,
      values.authorAffiliation,
      values.indexingPlatform,
      values.customIndexingPlatform,
      values.webOfScienceIndex,
      values.indexingCategory,
      values.indexingVerified,
      values.indexingSource,
      values.metadataSource,
      values.metadataVerified,
      externalMetadataId,
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
         left join users u on u.id = p.owner_id
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
    sendPublicationError(
      res,
      500,
      "save_failed",
      formatPublicationSqlError(error, "Publikimi nuk u ruajt."),
      { sql: getPublicationSqlErrorDetails(error) }
    );
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
    const externalMetadataId = isUnified
      ? await resolveExistingExternalMetadataId(client, values.externalMetadataId)
      : null;
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
               acceptance_date = $10::date,
               publication_date = $11::date,
               publication_year = $12,
               source_url = $13,
               volume = $14,
               issue = $15,
               pages = $16,
               issn = $17,
               e_issn = $18,
               isbn = $19,
               status = $20,
               author_affiliation = $21,
               indexing_platform = $22,
               custom_indexing_platform = $23,
               web_of_science_index = $24,
               indexing_category = $25,
               indexing_verified = $26,
               indexing_source = $27,
               metadata_source = $28,
               metadata_verified = $29,
               external_metadata_id = $30,
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
            values.acceptanceDate,
            values.publicationDate,
            values.publicationYear,
            values.sourceUrl,
            values.volume,
            values.issue,
            values.pages,
            values.issn,
            values.eIssn || values.e_issn,
            values.isbn,
            values.status,
            values.authorAffiliation,
            values.indexingPlatform,
            values.customIndexingPlatform,
            values.webOfScienceIndex,
            values.indexingCategory,
            values.indexingVerified,
            values.indexingSource,
            values.metadataSource,
            values.metadataVerified,
            externalMetadataId,
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
    sendPublicationError(
      res,
      500,
      "update_failed",
      formatPublicationSqlError(error, "Publikimi nuk u perditesua."),
      { sql: getPublicationSqlErrorDetails(error) }
    );
  } finally {
    client.release();
  }
});

router.patch("/:id/metadata-review", requireAuthenticatedUser, async (req, res) => {
  if (req) {
    res.status(410).json({ error: "metadata_review_removed", message: "Kontrolli i metadata-s nga komisioni eshte larguar." });
    return;
  }

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
