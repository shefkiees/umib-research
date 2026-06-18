import React, { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { apiUrl } from "../../utils/api";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  INDEXING_PLATFORM_VALUES,
  PUBLICATION_STATUS_VALUES,
  PUBLICATION_TYPE_VALUES,
  QUARTILE_VALUES,
  WEB_OF_SCIENCE_INDEX_VALUES,
} from "../../../../shared/publicationConstants.js";

const PUBLICATION_TYPE_LABEL_KEYS = {
  "": "professor.dashboard.publicationForm.selectType",
  journal_article: "professor.dashboard.publicationForm.journalArticle",
  conference_paper: "professor.dashboard.publicationForm.conferencePaper",
  book: "professor.dashboard.publicationForm.book",
};

export const PUBLICATION_TYPES = PUBLICATION_TYPE_VALUES.map((value) => ({
  value,
  labelKey: PUBLICATION_TYPE_LABEL_KEYS[value] || "professor.dashboard.publicationForm.selectType",
}));

const INDEXING_PLATFORM_OPTIONS = ["", ...INDEXING_PLATFORM_VALUES];
const QUARTILE_OPTIONS = ["", ...QUARTILE_VALUES];
const WEB_OF_SCIENCE_INDEX_OPTIONS = ["", ...WEB_OF_SCIENCE_INDEX_VALUES];

function normalizeDoiInput(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .split(/[?#]/)[0]
    .replace(/[.,;:]+$/g, "")
    .trim();
}

function isValidDoiInput(value) {
  return value.toLowerCase().startsWith("10.") && value.includes("/");
}

const EMPTY_AUTHOR = {
  fullName: "",
  givenName: "",
  familyName: "",
  orcid: "",
  affiliation: "",
  isCorrespondingAuthor: false,
};

export const createEmptyPublicationDraft = () => ({
  title: "",
  abstract: "",
  publicationType: "",
  publicationSubtype: "",
  venue: "",
  conferenceLocation: "",
  publisher: "",
  editors: [],
  bookSeriesTitle: "",
  edition: "",
  proceedingsTitle: "",
  eventDate: "",
  acceptanceDate: "",
  publicationDate: "",
  publicationYear: "",
  doi: "",
  sourceUrl: "",
  volume: "",
  issue: "",
  pages: "",
  pageStart: "",
  pageEnd: "",
  issn: "",
  eIssn: "",
  e_issn: "",
  isbn: "",
  authorAffiliation: "",
  indexingPlatform: "",
  customIndexingPlatform: "",
  custom_indexing_platform: "",
  webOfScienceIndex: "",
  web_of_science_index: "",
  indexingCategory: "",
  quartile: "",
  quartileVerified: false,
  quartileSource: "manual",
  quartileVerificationStatus: "empty",
  sjr: "",
  citeScore: "",
  impactFactor: "",
  impact_factor: "",
  indexingVerified: false,
  indexingSource: "manual",
  status: "draft",
  authors: [],
  indexing: [],
  evidenceLinks: [],
  fieldSources: {},
  metadataSource: "manual",
  metadataVerified: false,
  externalMetadataId: "",
  correspondingAuthorStatus: "",
  correspondingAuthorSource: "",
  correspondingAuthorConfidence: "",
  correspondingAuthorReason: "",
});

function hasPublicationDraftContent(value = {}) {
  return Boolean(
    String(value.title || "").trim()
    || String(value.doi || "").trim()
    || String(value.publicationType || "").trim()
    || String(value.venue || "").trim()
    || String(value.sourceUrl || value.source_url || "").trim()
    || String(value.acceptanceDate || value.acceptance_date || "").trim()
    || String(value.abstract || "").trim()
    || String(value.publisher || "").trim()
    || String(value.pages || "").trim()
    || String(value.isbn || "").trim()
    || String(value.issn || "").trim()
    || String(value.eIssn || value.e_issn || "").trim()
    || (Array.isArray(value.authors) && value.authors.length > 0)
  );
}

function normalizePublicationAuthors(authors = []) {
  const normalizedAuthors = authors.map((author) => (typeof author === "string" ? { fullName: author } : author || {}));
  const mainAuthorIndex = normalizedAuthors.findIndex((author) => Boolean(author.isMainAuthor ?? author.is_main_author));
  const correspondingAuthorIndex = normalizedAuthors.findIndex((author) => normalizeBoolean(
    author.isCorrespondingAuthor
    ?? author.is_corresponding_author
    ?? author.correspondingAuthor
    ?? author.corresponding_author
    ?? author.isCorresponding
    ?? author.is_corresponding
    ?? author.corresponding
  ));

  return normalizedAuthors.map((normalizedAuthor, index) => {
    return {
      fullName: normalizedAuthor.fullName || normalizedAuthor.full_name || normalizedAuthor.name || "",
      givenName: normalizedAuthor.givenName || normalizedAuthor.given_name || "",
      familyName: normalizedAuthor.familyName || normalizedAuthor.family_name || "",
      orcid: normalizeOrcid(normalizedAuthor.orcid || normalizedAuthor.ORCID),
      affiliation: normalizeAuthorAffiliation(normalizedAuthor),
      authorOrder: normalizedAuthor.authorOrder || normalizedAuthor.author_order || index + 1,
      isMainAuthor: mainAuthorIndex >= 0 ? index === mainAuthorIndex : index === 0,
      isCorrespondingAuthor: correspondingAuthorIndex >= 0 ? index === correspondingAuthorIndex : false,
      correspondingAuthorSource: normalizedAuthor.correspondingAuthorSource || normalizedAuthor.corresponding_author_source || "",
      correspondingAuthorConfidence: normalizedAuthor.correspondingAuthorConfidence || normalizedAuthor.corresponding_author_confidence || "",
    };
  });
}

function normalizeAuthorAffiliation(author = {}) {
  const rawValue = author.affiliation
    || author.affiliations
    || author.institution
    || author.organization
    || author.currentAffiliation
    || author.current_affiliation
    || "";
  const values = Array.isArray(rawValue) ? rawValue : [rawValue];

  return values
    .map((item) => {
      if (!item || typeof item !== "object") {
        return String(item || "").trim();
      }

      return String(item.name || item.affiliation || item.institution || item.organization || item.display_name || item.displayName || item.value || "").trim();
    })
    .filter(Boolean)
    .join("; ");
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeFieldSources(value = {}) {
  const sources = value.fieldSources || value.field_sources || {};

  return sources && typeof sources === "object" ? sources : {};
}

function supportsQuartile(publicationType) {
  return publicationType === "journal_article";
}

function normalizeIndexingPlatform(value) {
  const text = String(value || "").trim();
  const comparable = text.toLowerCase();

  if (!text) return "";
  if (comparable.includes("scopus") || comparable.includes("citescore")) return "Scopus";
  if (comparable.includes("scimago") || comparable.includes("sjr")) return "SCImago";
  if (comparable.includes("openalex")) return "OpenAlex";
  if (comparable.includes("doaj")) return "DOAJ";
  if (comparable.includes("web of science") || comparable.includes("clarivate")) return "Web of Science";
  if (["scie", "ssci", "ahci", "esci"].includes(comparable)) return "Web of Science";
  if (comparable === "other") return "Other";

  return INDEXING_PLATFORM_OPTIONS.includes(text) ? text : "";
}

function normalizeCustomIndexingPlatform(value) {
  return String(value || "").trim();
}

function firstTextValue(value) {
  if (Array.isArray(value)) {
    return firstTextValue(value[0]);
  }

  return String(value || "").trim();
}

function nthTextValue(value, index = 0) {
  const values = Array.isArray(value) ? value : [value];
  return String(values[index] || "").trim();
}

function uniqueTextValues(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function formatIssnPair(issn, eIssn, options = {}) {
  const { includeLabels = false } = options;
  const printIssn = String(issn || "").trim();
  const electronicIssn = String(eIssn || "").trim();

  if (includeLabels) {
    return [
      printIssn ? `${printIssn} (Print)` : "",
      electronicIssn ? `${electronicIssn} (Online)` : "",
    ].filter(Boolean).join(", ");
  }

  return uniqueTextValues([printIssn, electronicIssn]).join(", ");
}

function getMetadataIssnValues(metadata = {}) {
  const raw = metadata.raw_json || {};
  const issn = metadata.issn || extractIssnByType(raw, "print") || firstTextValue(raw.ISSN || raw.issn);
  const eIssn = metadata.eIssn
    || metadata.e_issn
    || metadata.eissn
    || extractIssnByType(raw, "electronic")
    || firstTextValue(raw.eISSN || raw.eissn || raw.EISSN)
    || nthTextValue(raw.ISSN || raw.issn, 1);

  return { issn, eIssn };
}

function splitIssnPair(value = "") {
  const cleaned = String(value || "")
    .replace(/\((?:print|online|electronic|e-?issn|p-?issn)\)/gi, "")
    .trim();
  const parts = uniqueTextValues(cleaned.split(/\s*(?:,|\/|;|\|)\s*/));

  return {
    issn: parts[0] || "",
    eIssn: parts[1] || "",
  };
}

function extractIssnByType(raw = {}, targetType = "") {
  const target = String(targetType || "").trim().toLowerCase();
  const values = [
    raw["issn-type"],
    raw["ISSN-type"],
    raw._crossref?.["issn-type"],
    raw._crossref?.["ISSN-type"],
  ].flatMap((value) => (Array.isArray(value) ? value : [value]));
  const match = values.find((item) => {
    const type = String(item?.type || item?.issnType || item?.issn_type || "").trim().toLowerCase();
    return type === target;
  });

  return String(match?.value || match?.issn || "").trim();
}

function normalizeIndexingCategory(value) {
  const text = String(value || "").trim();
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
  const match = String(value || "").trim().toUpperCase().match(/\bQ[1-4]\b/);

  return match?.[0] || "";
}

function normalizeOrcid(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/^https?:\/\/orcid\.org\//i, "");

  return /^0000-0000-0000-0000$/.test(normalized) ? "" : normalized;
}

function normalizeCiteScoreForDisplay(value, { verifiedZero = false } = {}) {
  const text = String(value || "").trim();
  const match = text.match(/\b\d+(?:[.,]\d+)?\b/);
  const normalized = match ? match[0].replace(",", ".") : text;
  const numericValue = Number(normalized);

  if (!text) {
    return "";
  }

  if (Number.isFinite(numericValue) && numericValue === 0 && !verifiedZero) {
    return "";
  }

  return normalized;
}

function normalizeIndexingSource(value) {
  const text = String(value || "").trim().toLowerCase();

  if (!text) return "manual";
  if (text.includes("scopus") || text.includes("citescore")) return "scopus";
  if (text.includes("scimago") || text.includes("sjr")) return "scimago";
  if (text.includes("doaj")) return "doaj";
  if (text.includes("openalex")) return "openalex";

  return ["scopus", "scimago", "doaj", "openalex", "manual"].includes(text) ? text : "manual";
}

function isDisplayableQuartile(item = {}) {
  const status = String(item.quartileVerificationStatus || item.quartile_verification_status || "").toLowerCase();

  return Boolean(normalizeQuartile(item.quartile))
    && (
      normalizeBoolean(item.quartileVerified ?? item.quartile_verified)
      || status === "verified"
      || status === "manual"
      || status === "historical"
      || !status
    );
}

function getIndexingYear(item = {}) {
  const year = Number.parseInt(item.year || item.indexing_year || item.coverYear || item.cover_year, 10);

  return Number.isFinite(year) ? year : 0;
}

function isSelectedQuartileIndexing(item = {}) {
  const status = String(item.quartileVerificationStatus || item.quartile_verification_status || "").toLowerCase();
  const source = normalizeIndexingSource(item.quartileSource || item.quartile_source || item.sourceKey || item.source_key || item.source);

  return Boolean(normalizeQuartile(item.quartile))
    && (
      normalizeBoolean(item.quartileVerified ?? item.quartile_verified)
      || status === "verified"
      || status === "manual"
      || (status === "historical" && source !== "manual")
      || (!status && source !== "manual")
    );
}

function getSelectedIndexingItem(indexing = [], fallbackQuartile = "") {
  const items = Array.isArray(indexing) ? indexing : [];
  const selected = items.find(isSelectedQuartileIndexing);

  if (selected) {
    return selected;
  }

  const fallback = normalizeQuartile(fallbackQuartile);
  const quartileMatches = fallback
    ? items.filter((item) => normalizeQuartile(item.quartile) === fallback)
    : items.filter((item) => normalizeQuartile(item.quartile));

  return quartileMatches
    .sort((first, second) => getIndexingYear(second) - getIndexingYear(first))
    .find((item) => item?.quartile || item?.sjr || item?.citeScore || item?.cite_score || item?.citescore || item?.impactFactor || item?.impact_factor)
    || items.find((item) => item?.source || item?.category || item?.quartile || item?.sjr || item?.citeScore || item?.cite_score || item?.citescore || item?.impactFactor || item?.impact_factor)
    || {};
}

function getIndexingCiteScore(item = {}) {
  return item.citeScore || item.cite_score || item.citescore || "";
}

export function publicationToDraft(publication = {}) {
  const publicationType = publication.publicationType || publication.publication_type || "";
  const publicationSubtype = getMetadataPublicationSubtype(publication);
  const isBookChapter = isBookChapterPublication(publicationType, publicationSubtype);
  const hasIndexing = supportsQuartile(publicationType);
  const isBookPublication = isBookPublicationType(publicationType);
  const hideJournalSpecificFields = isBookPublication;
  const hideVolumeField = isBookPublication && !isBookChapter;
  const normalizedAuthors = Array.isArray(publication.authors) ? normalizePublicationAuthors(publication.authors) : [];
  const indexing = hasIndexing && Array.isArray(publication.indexing) && publication.indexing.length ? publication.indexing.map((item) => ({
    source: normalizeIndexingPlatform(item.source || item.platform),
    platform: normalizeIndexingPlatform(item.platform || item.source),
    sourceKey: normalizeIndexingSource(item.sourceKey || item.source_key || item.indexingSource || item.indexing_source || item.source),
    category: item.category || "",
    webOfScienceIndex: normalizeWebOfScienceIndex(item.webOfScienceIndex || item.web_of_science_index || item.category),
    web_of_science_index: normalizeWebOfScienceIndex(item.web_of_science_index || item.webOfScienceIndex || item.category),
    quartile: normalizeQuartile(item.quartile),
    quartileVerified: normalizeBoolean(item.quartileVerified ?? item.quartile_verified),
    quartile_verified: normalizeBoolean(item.quartileVerified ?? item.quartile_verified),
    quartileSource: normalizeIndexingSource(item.quartileSource || item.quartile_source || item.sourceKey || item.source_key || item.source),
    quartile_source: normalizeIndexingSource(item.quartileSource || item.quartile_source || item.sourceKey || item.source_key || item.source),
    quartileVerificationStatus: item.quartileVerificationStatus || item.quartile_verification_status || (item.quartile ? "manual" : "empty"),
    quartile_verification_status: item.quartileVerificationStatus || item.quartile_verification_status || (item.quartile ? "manual" : "empty"),
    quartileSelectionReason: item.quartileSelectionReason || item.quartile_selection_reason || "",
    quartile_selection_reason: item.quartileSelectionReason || item.quartile_selection_reason || "",
    impactFactor: item.impactFactor || item.impact_factor || "",
    impact_factor: item.impact_factor || item.impactFactor || "",
    sjr: item.sjr || "",
    citeScore: normalizeCiteScoreForDisplay(item.citeScore || item.cite_score || item.citescore, { verifiedZero: normalizeBoolean(item.citeScoreVerified ?? item.cite_score_verified) }),
    citeScoreVerified: normalizeBoolean(item.citeScoreVerified ?? item.cite_score_verified),
    cite_score_verified: normalizeBoolean(item.citeScoreVerified ?? item.cite_score_verified),
    indexedUrl: item.indexedUrl || item.indexed_url || "",
  })) : hasIndexing && (publication.quartile || publication.impactFactor || publication.impact_factor) ? [{ source: "", platform: "", sourceKey: "manual", category: "", quartile: normalizeQuartile(publication.quartile), impactFactor: publication.impactFactor || publication.impact_factor || "", impact_factor: publication.impact_factor || publication.impactFactor || "", sjr: "", citeScore: "", indexedUrl: "" }] : [];
  const primaryIndexing = getSelectedIndexingItem(indexing, publication.quartile);
  const impactFactorIndexing = indexing.find((item) => item?.impactFactor || item?.impact_factor) || {};
  const displayablePrimaryQuartile = isDisplayableQuartile(primaryIndexing) ? primaryIndexing.quartile : "";

  return {
    ...createEmptyPublicationDraft(),
    title: publication.title || "",
    abstract: publication.abstract || "",
    publicationType,
    publicationSubtype,
    publication_subtype: publicationSubtype,
    venue: publication.venue || publication.journal || "",
    conferenceLocation: publication.conferenceLocation || publication.conference_location || "",
    publisher: publication.publisher || "",
    editors: Array.isArray(publication.editors) ? publication.editors : [],
    bookSeriesTitle: publication.bookSeriesTitle || publication.book_series_title || publication.seriesTitle || publication.series_title || "",
    edition: publication.edition || "",
    proceedingsTitle: publication.proceedingsTitle || publication.proceedings_title || "",
    eventDate: publication.eventDate || publication.event_date || "",
    acceptanceDate: (publication.acceptanceDate || publication.acceptance_date || "").slice(0, 10),
    publicationDate: isBookPublication && !isBookChapter ? "" : (publication.publicationDate || publication.publication_date || "").slice(0, 10),
    publicationYear: isBookPublication && !isBookChapter ? "" : publication.publicationYear || publication.publication_year || publication.year || "",
    doi: publication.doi || "",
    sourceUrl: publication.sourceUrl || publication.source_url || "",
    volume: hideVolumeField ? "" : publication.volume || "",
    issue: hideJournalSpecificFields ? "" : publication.issue || "",
    pages: publication.pages || "",
    pageStart: publication.pageStart || publication.page_start || publication.pagesStart || publication.pages_start || "",
    pageEnd: publication.pageEnd || publication.page_end || publication.pagesEnd || publication.pages_end || "",
    issn: hideJournalSpecificFields ? "" : publication.issn || "",
    eIssn: publicationType === "journal_article" ? publication.eIssn || publication.e_issn || publication.eissn || "" : "",
    e_issn: publicationType === "journal_article" ? publication.e_issn || publication.eIssn || publication.eissn || "" : "",
    isbn: publicationType === "journal_article" ? "" : publication.isbn || "",
    authorAffiliation: "",
    indexingPlatform: hasIndexing ? normalizeIndexingPlatform(publication.indexingPlatform || publication.indexing_platform || primaryIndexing.source) : "",
    customIndexingPlatform: hasIndexing ? normalizeCustomIndexingPlatform(publication.customIndexingPlatform || publication.custom_indexing_platform || "") : "",
    custom_indexing_platform: hasIndexing ? normalizeCustomIndexingPlatform(publication.custom_indexing_platform || publication.customIndexingPlatform || "") : "",
    webOfScienceIndex: hasIndexing ? normalizeWebOfScienceIndex(publication.webOfScienceIndex || publication.web_of_science_index || primaryIndexing.webOfScienceIndex || primaryIndexing.web_of_science_index || primaryIndexing.category || "") : "",
    web_of_science_index: hasIndexing ? normalizeWebOfScienceIndex(publication.web_of_science_index || publication.webOfScienceIndex || primaryIndexing.web_of_science_index || primaryIndexing.webOfScienceIndex || primaryIndexing.category || "") : "",
    indexingCategory: hasIndexing ? normalizeIndexingCategory(publication.indexingCategory || publication.indexing_category || primaryIndexing.category || "") : "",
    quartile: hasIndexing ? normalizeQuartile(publication.quartile || displayablePrimaryQuartile) : "",
    quartileVerified: hasIndexing && normalizeBoolean(publication.quartileVerified ?? publication.quartile_verified ?? primaryIndexing.quartileVerified ?? primaryIndexing.quartile_verified),
    quartileSource: hasIndexing ? normalizeIndexingSource(publication.quartileSource || publication.quartile_source || primaryIndexing.quartileSource || primaryIndexing.quartile_source || primaryIndexing.sourceKey || primaryIndexing.source_key || primaryIndexing.source) : "manual",
    quartileVerificationStatus: hasIndexing ? publication.quartileVerificationStatus || publication.quartile_verification_status || primaryIndexing.quartileVerificationStatus || primaryIndexing.quartile_verification_status || (publication.quartile || primaryIndexing.quartile ? "manual" : "empty") : "empty",
    sjr: hasIndexing ? publication.sjr || primaryIndexing.sjr || "" : "",
    impactFactor: hasIndexing ? publication.impactFactor || publication.impact_factor || primaryIndexing.impactFactor || primaryIndexing.impact_factor || impactFactorIndexing.impactFactor || impactFactorIndexing.impact_factor || "" : "",
    impact_factor: hasIndexing ? publication.impact_factor || publication.impactFactor || primaryIndexing.impact_factor || primaryIndexing.impactFactor || impactFactorIndexing.impact_factor || impactFactorIndexing.impactFactor || "" : "",
    citeScore: normalizeCiteScoreForDisplay(
      hasIndexing ? publication.citeScore || publication.cite_score || getIndexingCiteScore(primaryIndexing) : "",
      { verifiedZero: normalizeBoolean(publication.citeScoreVerified ?? publication.cite_score_verified ?? primaryIndexing.citeScoreVerified ?? primaryIndexing.cite_score_verified) }
    ),
    indexingVerified: hasIndexing && normalizeBoolean(publication.indexingVerified ?? publication.indexing_verified),
    indexingSource: hasIndexing ? normalizeIndexingSource(publication.indexingSource || publication.indexing_source || primaryIndexing.sourceKey || primaryIndexing.source_key || primaryIndexing.source) : "manual",
    status: publication.status || "draft",
    authors: normalizedAuthors,
    indexing,
    evidenceLinks: (Array.isArray(publication.evidenceLinks) ? publication.evidenceLinks : publication.attachments || []).map((item) => ({
      url: item.url || item.fileUrl || item.file_url || "",
      label: item.label || item.fileType || item.file_type || "",
      uploadedAt: (item.uploadedAt || item.uploaded_at || "").slice(0, 10),
    })),
    metadataSource: publication.metadataSource || publication.metadata_source || "manual",
    metadataVerified: normalizeBoolean(publication.metadataVerified ?? publication.metadata_verified),
    externalMetadataId: publication.externalMetadataId || publication.external_metadata_id || "",
    metadataReviewStatus: publication.metadataReviewStatus || publication.metadata_review_status || "unchecked",
    metadataReviewChecklist: publication.metadataReviewChecklist || publication.metadata_review_checklist || {},
    metadataReviewComment: publication.metadataReviewComment || publication.metadata_review_comment || "",
    correspondingAuthorStatus: publication.correspondingAuthorStatus || publication.corresponding_author_status || "",
    correspondingAuthorSource: publication.correspondingAuthorSource || publication.corresponding_author_source || "",
    correspondingAuthorConfidence: publication.correspondingAuthorConfidence || publication.corresponding_author_confidence || "",
    correspondingAuthorReason: publication.correspondingAuthorReason || publication.corresponding_author_reason || "",
    fieldSources: normalizeFieldSources(publication),
  };
}

function normalizeDoiType(value) {
  const normalized = String(value || "").toLowerCase().replace(/[-\s]+/g, "_");
  const map = {
    article_journal: "journal_article",
    journal: "journal_article",
    journal_article: "journal_article",
    conference: "conference_paper",
    conference_proceeding: "conference_paper",
    conference_proceedings: "conference_paper",
    paper_conference: "conference_paper",
    proceedings: "conference_paper",
    proceedings_article: "conference_paper",
    proceedings_series: "conference_paper",
    conference_paper: "conference_paper",
    book: "book",
    book_chapter: "book",
    chapter: "book",
  };

  return map[normalized] || "";
}

function isConferencePaperType(value) {
  return normalizeDoiType(value) === "conference_paper" || value === "conference_paper";
}

function isBookPublicationType(value) {
  return normalizeDoiType(value) === "book" || value === "book";
}

function normalizePublicationSubtype(value) {
  const normalized = String(value || "").toLowerCase().replace(/[-\s]+/g, "_");

  return normalized === "book_chapter" || normalized === "chapter" ? "book_chapter" : "";
}

function isBookChapterPublication(publicationType, publicationSubtype) {
  return isBookPublicationType(publicationType) && normalizePublicationSubtype(publicationSubtype) === "book_chapter";
}

function getMetadataPublicationSubtype(value = {}) {
  return normalizePublicationSubtype(
    value.publicationSubtype
    || value.publication_subtype
    || value.raw_json?.publication_subtype
    || value.raw_json?.publicationSubtype
    || value.raw_json?._crossref?.publication_subtype
    || value.raw_json?._crossref?.publicationSubtype
    || value.raw_json?._crossref?.type
    || value.raw_json?._doi_org?.publication_subtype
    || value.raw_json?._doi_org?.publicationSubtype
    || value.raw_json?._doi_org?.type
    || value.raw_json?._openalex?.publication_subtype
    || value.raw_json?._openalex?.publicationSubtype
    || value.raw_json?._openalex?.type_crossref
    || value.raw_json?._openalex?.type
  );
}

function formatContributorList(value = []) {
  const contributors = Array.isArray(value) ? value : [value];

  return contributors
    .map((item) => {
      if (!item || typeof item !== "object") {
        return String(item || "").trim();
      }

      return String(item.fullName || item.full_name || item.name || [item.givenName || item.given_name || item.given, item.familyName || item.family_name || item.family].filter(Boolean).join(" ")).trim();
    })
    .filter(Boolean)
    .join(", ");
}

function getConferencePaperReset() {
  return {
    indexingPlatform: "",
    customIndexingPlatform: "",
    custom_indexing_platform: "",
    webOfScienceIndex: "",
    web_of_science_index: "",
    indexingCategory: "",
    indexingVerified: false,
    indexingSource: "manual",
    quartile: "",
    quartileVerified: false,
    quartileHistorical: false,
    quartileSource: "manual",
    quartileVerificationStatus: "empty",
    sjr: "",
    citeScore: "",
    impactFactor: "",
    impact_factor: "",
    indexing: [],
  };
}

function getBookPublicationReset() {
  return {
    conferenceLocation: "",
    publicationDate: "",
    publicationYear: "",
    volume: "",
    issue: "",
    issn: "",
    eIssn: "",
    e_issn: "",
    indexingPlatform: "",
    customIndexingPlatform: "",
    custom_indexing_platform: "",
    webOfScienceIndex: "",
    web_of_science_index: "",
    indexingCategory: "",
    indexingVerified: false,
    indexingSource: "manual",
    quartile: "",
    quartileVerified: false,
    quartileHistorical: false,
    quartileSource: "manual",
    quartileVerificationStatus: "empty",
    sjr: "",
    citeScore: "",
    impactFactor: "",
    impact_factor: "",
    indexing: [],
  };
}

function isTrustedAuthorFieldSource(value) {
  return ["api", "doi", "lookup"].includes(String(value || "").trim().toLowerCase());
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPublishedValue(dateValue, yearValue) {
  const date = String(dateValue || "").trim();
  const year = String(yearValue || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-");
    return `${day}-${month}-${year}`;
  }

  if (/^\d{4}$/.test(year)) {
    return `xx-xx-${year}`;
  }

  return date || year;
}

function getMetadataDateParts(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value?.["date-parts"])) {
    return Array.isArray(value["date-parts"][0]) ? value["date-parts"][0] : value["date-parts"];
  }

  if (Array.isArray(value)) {
    return Array.isArray(value[0]) ? value[0] : value;
  }

  if (typeof value === "object") {
    return [value.year, value.month, value.day].filter((part) => part !== undefined && part !== null && part !== "");
  }

  const text = String(value).trim();
  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const dayMonthYear = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);

  if (isoDate) {
    return [isoDate[1], isoDate[2], isoDate[3]];
  }

  if (dayMonthYear) {
    return [dayMonthYear[3], dayMonthYear[2], dayMonthYear[1]];
  }

  return [];
}

function formatMetadataDate(value) {
  const parts = getMetadataDateParts(value);
  const [year, month, day] = parts.map((part) => Number(part));

  if (!year || !month || !day) {
    return "";
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMetadataAcceptanceDate(metadata = {}) {
  const raw = metadata.raw_json || {};
  const crossref = raw._crossref || {};
  const doiOrg = raw._doi_org || {};
  const candidates = [
    metadata.acceptanceDate,
    metadata.acceptance_date,
    raw.acceptanceDate,
    raw.acceptance_date,
    raw.accepted,
    raw["accepted-date"],
    raw["date-accepted"],
    crossref.accepted,
    crossref["accepted-date"],
    crossref["date-accepted"],
    doiOrg.accepted,
    doiOrg["accepted-date"],
    doiOrg["date-accepted"],
  ];

  return candidates.map(formatMetadataDate).find(Boolean) || "";
}

function getMetadataArticleLink(metadata = {}) {
  const raw = metadata.raw_json || {};
  const crossref = raw._crossref || {};
  const doiOrg = raw._doi_org || {};
  const candidates = [
    metadata.source_url,
    metadata.sourceUrl,
    raw.source_url,
    raw.sourceUrl,
    raw.URL,
    raw.url,
    raw.link?.[0]?.URL,
    raw.link?.[0]?.url,
    raw.resource?.primary?.URL,
    raw.publisherUrl,
    raw.publisher_url,
    crossref.URL,
    crossref.url,
    crossref.link?.[0]?.URL,
    crossref.resource?.primary?.URL,
    crossref.publisherUrl,
    crossref.publisher_url,
    doiOrg.URL,
    doiOrg.url,
    doiOrg.link?.[0]?.URL,
    doiOrg.publisherUrl,
    doiOrg.publisher_url,
  ];
  const urls = candidates.map((candidate) => String(candidate || "").trim()).filter((candidate) => /^https?:\/\//i.test(candidate));
  const articleUrl = urls.find((candidate) => !/^https?:\/\/(?:dx\.)?doi\.org\//i.test(candidate)) || urls[0];

  return articleUrl || (metadata.doi ? `https://doi.org/${metadata.doi}` : "");
}

function parsePublishedValue(input) {
  const value = String(input || "").trim();
  const dayMonthYear = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const unknownDayMonthYear = value.match(/^x{2}-x{2}-(\d{4})$/i);

  if (/^\d{4}$/.test(value)) {
    return { publicationDate: "", publicationYear: value };
  }

  if (unknownDayMonthYear) {
    return { publicationDate: "", publicationYear: unknownDayMonthYear[1] };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { publicationDate: value, publicationYear: value.slice(0, 4) };
  }

  if (dayMonthYear) {
    return {
      publicationDate: `${dayMonthYear[3]}-${dayMonthYear[2]}-${dayMonthYear[1]}`,
      publicationYear: dayMonthYear[3],
    };
  }

  return { publicationDate: value, publicationYear: "" };
}

function metadataAuthorToDraft(author, index, currentUserAuthor = {}, mainAuthorIndex = 0) {
  const normalizedAuthor = typeof author === "string" ? { fullName: author } : author || {};
  const fullName = normalizedAuthor.fullName || normalizedAuthor.full_name || normalizedAuthor.name || "";
  const affiliation = normalizeAuthorAffiliation(normalizedAuthor);
  const affiliationSource = "";
  const metadataOrcid = normalizeOrcid(normalizedAuthor.orcid || normalizedAuthor.ORCID);
  const matchesCurrentUser = currentUserAuthor.name && normalizeName(fullName) === normalizeName(currentUserAuthor.name);
  const currentUserOrcid = normalizeOrcid(currentUserAuthor.orcid || currentUserAuthor.orcidId || currentUserAuthor.orcid_id);

  return {
    ...EMPTY_AUTHOR,
    fullName,
    givenName: normalizedAuthor.givenName || normalizedAuthor.given_name || "",
    familyName: normalizedAuthor.familyName || normalizedAuthor.family_name || "",
    orcid: metadataOrcid || (matchesCurrentUser ? currentUserOrcid : "") || "",
    orcidSource: metadataOrcid ? "doi" : "",
    orcid_source: metadataOrcid ? "doi" : "",
    affiliation,
    affiliationSource,
    affiliation_source: affiliationSource,
    authorOrder: index + 1,
    isMainAuthor: index === mainAuthorIndex,
    isCorrespondingAuthor: normalizeBoolean(
      normalizedAuthor.isCorrespondingAuthor
      ?? normalizedAuthor.is_corresponding_author
      ?? normalizedAuthor.correspondingAuthor
      ?? normalizedAuthor.corresponding_author
      ?? normalizedAuthor.isCorresponding
      ?? normalizedAuthor.is_corresponding
      ?? normalizedAuthor.corresponding
    ),
    correspondingAuthorSource: normalizedAuthor.correspondingAuthorSource || normalizedAuthor.corresponding_author_source || "",
    correspondingAuthorConfidence: normalizedAuthor.correspondingAuthorConfidence || normalizedAuthor.corresponding_author_confidence || "",
  };
}

function metadataToDraft(metadata = {}, currentUserAuthor = {}) {
  const authors = Array.isArray(metadata.authors) ? metadata.authors : [];
  const publicationType = normalizeDoiType(metadata.type);
  const publicationSubtype = getMetadataPublicationSubtype(metadata);
  const isConferencePaper = publicationType === "conference_paper";
  const isBookPublication = publicationType === "book";
  const isBookChapter = isBookChapterPublication(publicationType, publicationSubtype);
  const indexing = Array.isArray(metadata.indexing) ? metadata.indexing : [];
  const selectedQuartileIndexing = getSelectedIndexingItem(indexing, metadata.quartile);
  const selectedQuartileStatus = String(metadata.quartileVerificationStatus || metadata.quartile_verification_status || selectedQuartileIndexing?.quartileVerificationStatus || selectedQuartileIndexing?.quartile_verification_status || "").toLowerCase();
  const quartileVerified = normalizeBoolean(metadata.quartileVerified ?? metadata.quartile_verified ?? selectedQuartileIndexing?.quartileVerified ?? selectedQuartileIndexing?.quartile_verified);
  const quartileHistorical = selectedQuartileStatus === "historical" || normalizeBoolean(metadata.quartileHistorical ?? metadata.quartile_historical);
  const quartile = supportsQuartile(publicationType) ? normalizeQuartile(metadata.quartile || selectedQuartileIndexing?.quartile || "") : "";
  const hasMetadataQuartile = Boolean(quartile);
  const quartileSource = hasMetadataQuartile
    ? normalizeIndexingSource(metadata.quartileSource || metadata.quartile_source || selectedQuartileIndexing?.quartileSource || selectedQuartileIndexing?.quartile_source || selectedQuartileIndexing?.sourceKey || selectedQuartileIndexing?.source_key || selectedQuartileIndexing?.source)
    : "manual";
  const quartileVerificationStatus = selectedQuartileStatus || "missing";
  const indexingPlatform = supportsQuartile(publicationType) ? normalizeIndexingPlatform(metadata.indexingPlatform || metadata.indexing_platform || indexing.find((item) => item?.source)?.source) : "";
  const indexingCategory = hasMetadataQuartile ? normalizeIndexingCategory(metadata.indexingCategory || metadata.indexing_category || selectedQuartileIndexing?.category || "") : "";
  const indexingVerified = supportsQuartile(publicationType) ? normalizeBoolean(metadata.indexingVerified ?? metadata.indexing_verified) : false;
  const indexingSource = supportsQuartile(publicationType) ? normalizeIndexingSource(metadata.indexingSource || metadata.indexing_source || indexing.find((item) => item?.sourceKey || item?.source_key || item?.source)?.sourceKey || indexing.find((item) => item?.sourceKey || item?.source_key || item?.source)?.source_key || indexing.find((item) => item?.source)?.source) : "manual";
  const sjr = supportsQuartile(publicationType) ? metadata.sjr || selectedQuartileIndexing.sjr || indexing.find((item) => item?.sjr)?.sjr || "" : "";
  const citeScoreIndexing = getIndexingCiteScore(selectedQuartileIndexing)
    ? selectedQuartileIndexing
    : indexing.find((item) => item?.citeScore || item?.cite_score || item?.citescore) || {};
  const citeScore = supportsQuartile(publicationType) ? normalizeCiteScoreForDisplay(
    metadata.citeScore || metadata.cite_score || getIndexingCiteScore(citeScoreIndexing),
    { verifiedZero: normalizeBoolean(metadata.citeScoreVerified ?? metadata.cite_score_verified ?? citeScoreIndexing.citeScoreVerified ?? citeScoreIndexing.cite_score_verified) }
  ) : "";
  const impactFactorIndexing = selectedQuartileIndexing?.impactFactor || selectedQuartileIndexing?.impact_factor
    ? selectedQuartileIndexing
    : indexing.find((item) => item?.impactFactor || item?.impact_factor) || {};
  const impactFactor = supportsQuartile(publicationType)
    ? metadata.impactFactor || metadata.impact_factor || impactFactorIndexing.impactFactor || impactFactorIndexing.impact_factor || ""
    : "";
  const draftAuthors = authors.map((author, index) => metadataAuthorToDraft(author, index, currentUserAuthor, 0));

  return {
    title: metadata.chapter_title || metadata.chapterTitle || metadata.title || "",
    abstract: metadata.abstract || "",
    publicationType,
    publicationSubtype,
    publication_subtype: publicationSubtype,
    venue: publicationType === "book"
      ? metadata.book_title || metadata.bookTitle || metadata.container_title || ""
      : metadata.conferenceName || metadata.conference_name || metadata.container_title || "",
    conferenceLocation: metadata.conferenceLocation || metadata.conference_location || "",
    publisher: metadata.publisher || "",
    editors: Array.isArray(metadata.editors) ? metadata.editors : [],
    bookSeriesTitle: metadata.bookSeriesTitle || metadata.book_series_title || metadata.seriesTitle || metadata.series_title || metadata.raw_json?.book_series_title || metadata.raw_json?.series_title || "",
    edition: metadata.edition || metadata.raw_json?.edition || "",
    proceedingsTitle: isConferencePaper ? metadata.proceedingsTitle || metadata.proceedings_title || metadata.raw_json?.proceedings_title || "" : "",
    eventDate: isConferencePaper ? metadata.eventDate || metadata.event_date || metadata.raw_json?.event_date || "" : "",
    acceptanceDate: publicationType === "journal_article" ? getMetadataAcceptanceDate(metadata) : "",
    publicationDate: (!isBookPublication || isBookChapter) && /^\d{4}-\d{1,2}-\d{1,2}$/.test(metadata.published_date || "")
      ? metadata.published_date.split("-").map((part) => part.padStart(2, "0")).join("-")
      : "",
    publicationYear: isBookPublication && !isBookChapter ? "" : metadata.year || "",
    doi: metadata.doi || "",
    sourceUrl: getMetadataArticleLink(metadata),
    volume: isBookPublication && !isBookChapter ? "" : metadata.volume || "",
    issue: isBookPublication ? "" : metadata.issue || "",
    pages: metadata.pages || "",
    pageStart: isConferencePaper ? metadata.pageStart || metadata.page_start || metadata.pagesStart || metadata.pages_start || metadata.raw_json?.pageStart || metadata.raw_json?.pages_start || "" : "",
    pageEnd: isConferencePaper ? metadata.pageEnd || metadata.page_end || metadata.pagesEnd || metadata.pages_end || metadata.raw_json?.pageEnd || metadata.raw_json?.pages_end || "" : "",
    issn: isBookPublication ? "" : getMetadataIssnValues(metadata).issn,
    eIssn: publicationType === "journal_article" ? getMetadataIssnValues(metadata).eIssn : "",
    e_issn: publicationType === "journal_article" ? getMetadataIssnValues(metadata).eIssn : "",
    isbn: publicationType === "journal_article" ? "" : metadata.isbn || firstTextValue(metadata.raw_json?.ISBN || metadata.raw_json?.isbn),
    authorAffiliation: "",
    indexingPlatform,
    indexingCategory,
    quartile,
    quartileVerified,
    quartileHistorical,
    quartileSource,
    quartileVerificationStatus,
    sjr,
    impactFactor,
    citeScore,
    indexingVerified,
    indexingSource: indexingVerified ? indexingSource : "manual",
    authors: draftAuthors,
    indexing: !supportsQuartile(publicationType) ? [] : indexing.length ? indexing.map((item, index) => ({
      source: item.source || (index === 0 ? indexingPlatform : ""),
      platform: item.platform || item.source || (index === 0 ? indexingPlatform : ""),
      sourceKey: normalizeIndexingSource(item.sourceKey || item.source_key || item.indexingSource || item.indexing_source || item.source || (index === 0 ? indexingSource : "")),
      category: item.category || (index === 0 ? indexingCategory : ""),
      quartile: normalizeQuartile(item.quartile || (index === 0 ? quartile : "")),
      quartileVerified: normalizeBoolean(item.quartileVerified ?? item.quartile_verified),
      quartile_verified: normalizeBoolean(item.quartileVerified ?? item.quartile_verified),
      quartileSource: normalizeIndexingSource(item.quartileSource || item.quartile_source || item.sourceKey || item.source_key || item.source || (index === 0 ? quartileSource : "")),
      quartile_source: normalizeIndexingSource(item.quartileSource || item.quartile_source || item.sourceKey || item.source_key || item.source || (index === 0 ? quartileSource : "")),
      quartileVerificationStatus: item.quartileVerificationStatus || item.quartile_verification_status || (item.quartile ? "manual_required" : "empty"),
      quartile_verification_status: item.quartileVerificationStatus || item.quartile_verification_status || (item.quartile ? "manual_required" : "empty"),
      quartileSelectionReason: item.quartileSelectionReason || item.quartile_selection_reason || "",
      quartile_selection_reason: item.quartileSelectionReason || item.quartile_selection_reason || "",
      impactFactor: item.impactFactor || item.impact_factor || (index === 0 ? impactFactor : ""),
      impact_factor: item.impact_factor || item.impactFactor || (index === 0 ? impactFactor : ""),
      sjr: item.sjr || (index === 0 ? sjr : ""),
      citeScore: normalizeCiteScoreForDisplay(item.citeScore || item.cite_score || item.citescore || (index === 0 ? citeScore : ""), { verifiedZero: normalizeBoolean(item.citeScoreVerified ?? item.cite_score_verified ?? metadata.citeScoreVerified ?? metadata.cite_score_verified) }),
      citeScoreVerified: normalizeBoolean(item.citeScoreVerified ?? item.cite_score_verified),
      cite_score_verified: normalizeBoolean(item.citeScoreVerified ?? item.cite_score_verified),
      indexedUrl: item.indexedUrl || item.indexed_url || "",
    })) : indexingPlatform || indexingCategory || quartile || sjr || citeScore || impactFactor
      ? [{ source: indexingPlatform, platform: indexingPlatform, sourceKey: indexingSource, category: indexingCategory, quartile, quartileVerified, quartile_verified: quartileVerified, quartileSource, quartile_source: quartileSource, quartileVerificationStatus, quartile_verification_status: quartileVerificationStatus, impactFactor, impact_factor: impactFactor, sjr, citeScore, citeScoreVerified: normalizeBoolean(metadata.citeScoreVerified ?? metadata.cite_score_verified), cite_score_verified: normalizeBoolean(metadata.citeScoreVerified ?? metadata.cite_score_verified), indexedUrl: "" }]
      : [],
    metadataSource: "doi",
    metadataVerified: true,
    externalMetadataId: metadata.doi || "",
    correspondingAuthorStatus: metadata.correspondingAuthorStatus || metadata.corresponding_author_status || "",
    correspondingAuthorSource: metadata.correspondingAuthorSource || metadata.corresponding_author_source || "",
    correspondingAuthorConfidence: metadata.correspondingAuthorConfidence || metadata.corresponding_author_confidence || "",
    correspondingAuthorReason: metadata.correspondingAuthorReason || metadata.corresponding_author_reason || "",
    fieldSources: normalizeFieldSources(metadata),
  };
}

const PublicationForm = ({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  submitting = false,
  mode = "create",
  currentUserAuthor = {},
}) => {
  const { t } = useLanguage();
  const formRef = useRef(null);
  const [doiLookupValue, setDoiLookupValue] = useState(value.doi || "");
  const [showPublicationFields, setShowPublicationFields] = useState(() => mode === "edit" || hasPublicationDraftContent(value));
  const [doiError, setDoiError] = useState("");
  const [formError, setFormError] = useState("");
  const [isLookingUpDoi, setIsLookingUpDoi] = useState(false);
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);
  const isDoiImported = value.metadataSource === "doi" && value.metadataVerified;
  const isConferencePaper = isConferencePaperType(value.publicationType);
  const isJournalArticle = value.publicationType === "journal_article";
  const isBookPublication = isBookPublicationType(value.publicationType);
  const isBookChapter = isBookChapterPublication(value.publicationType, value.publicationSubtype || value.publication_subtype);
  const hasValue = (field) => String(value[field] || "").trim() !== "";
  const showPublisherField = isConferencePaper ? hasValue("publisher") : true;
  const showPublishedDateField = !isBookPublication || isBookChapter;
  const showVolumeField = isConferencePaper
    ? hasValue("volume")
    : (!isBookPublication || isBookChapter) && (!isDoiImported || hasValue("volume"));
  const showIssueField = isConferencePaper ? hasValue("issue") : !isBookPublication;
  const showIndexingFields = supportsQuartile(value.publicationType);
  const showIdentifierField = isConferencePaper
    ? hasValue("issn") || hasValue("isbn")
    : isJournalArticle || isBookPublication || (!isDoiImported || hasValue("issn") || hasValue("eIssn") || hasValue("e_issn") || hasValue("isbn"));
  const showIssnInput = isConferencePaper
    ? hasValue("issn")
    : isJournalArticle || (!isBookPublication && (!isDoiImported || hasValue("issn")));
  const showIsbnInput = isConferencePaper
    ? hasValue("isbn")
    : isBookPublication || (!isJournalArticle && (!isDoiImported || hasValue("isbn")));
  const showAbstractField = isConferencePaper || isBookPublication || !isDoiImported || hasValue("abstract");
  const journalIssnDisplayValue = formatIssnPair(value.issn, value.eIssn || value.e_issn);
  const publishedValue = formatPublishedValue(value.publicationDate, value.publicationYear);
  const hasFormDoi = Boolean(normalizeDoiInput(value.doi));
  const editorsValue = formatContributorList(value.editors || value.editor);
  const bookSeriesTitleValue = value.bookSeriesTitle || value.book_series_title || value.seriesTitle || value.series_title || "";
  const editionValue = value.edition || "";
  const proceedingsTitleValue = value.proceedingsTitle || value.proceedings_title || "";
  const eventDateValue = value.eventDate || value.event_date || "";
  const showConferenceProceedingsTitle = isConferencePaper && Boolean(String(proceedingsTitleValue || "").trim());
  const showConferenceEventDate = isConferencePaper && Boolean(String(eventDateValue || "").trim());
  const showBookChapterEditors = isBookChapter && Boolean(editorsValue);
  const showBookChapterSeriesTitle = isBookChapter && Boolean(String(bookSeriesTitleValue || "").trim());
  const showBookChapterEdition = isBookChapter && Boolean(String(editionValue || "").trim());
  const isAbstractExpandable = String(value.abstract || "").trim().length > 260;
  const abstractRows = isAbstractExpandable && !isAbstractExpanded ? 3 : 6;
  const indexingItems = Array.isArray(value.indexing) ? value.indexing : [];
  const primaryIndexing = getSelectedIndexingItem(indexingItems, value.quartile);
  const fieldSources = normalizeFieldSources(value);
  const isTrustedSource = (field) => ["api", "lookup"].includes(fieldSources[field]?.source);
  const isFieldLocked = (field) => {
    if (field === "abstract" && isConferencePaper) {
      return false;
    }

    return isTrustedSource(field);
  };
  const displayableQuartile = value.quartile || (isDisplayableQuartile(primaryIndexing) ? primaryIndexing.quartile : "");
  const selectedIndexingPlatform = normalizeIndexingPlatform(value.indexingPlatform || primaryIndexing.source || "");
  const isScopusIndexing = selectedIndexingPlatform === "Scopus";
  const isWebOfScienceIndexing = selectedIndexingPlatform === "Web of Science";
  const isOtherIndexing = selectedIndexingPlatform === "Other";
  const selectedWebOfScienceIndex = normalizeWebOfScienceIndex(value.webOfScienceIndex || value.web_of_science_index || primaryIndexing.webOfScienceIndex || primaryIndexing.web_of_science_index || primaryIndexing.category || "");
  const selectedCustomIndexingPlatform = normalizeCustomIndexingPlatform(value.customIndexingPlatform || value.custom_indexing_platform || "");
  const hasIndexingPlatform = String(selectedIndexingPlatform).trim();
  const hasIndexingDetails = Boolean(
    (isWebOfScienceIndexing && selectedWebOfScienceIndex)
    || (isOtherIndexing && selectedCustomIndexingPlatform)
    || (isScopusIndexing && normalizeQuartile(displayableQuartile))
    || (isScopusIndexing && String(value.sjr || primaryIndexing.sjr || "").trim())
    || (isScopusIndexing && String(value.citeScore || getIndexingCiteScore(primaryIndexing)).trim())
    || (isWebOfScienceIndexing && String(value.impactFactor || primaryIndexing.impactFactor || primaryIndexing.impact_factor || "").trim())
    || normalizeBoolean(value.indexingVerified ?? value.indexing_verified)
  );

  useEffect(() => {
    if (mode === "edit" || hasPublicationDraftContent(value)) {
      setShowPublicationFields(true);
      return;
    }

    setShowPublicationFields(false);
  }, [
    mode,
    value.title,
    value.doi,
    value.publicationType,
    value.venue,
    value.sourceUrl,
    value.source_url,
    value.acceptanceDate,
    value.acceptance_date,
    value.abstract,
    value.publisher,
    value.pages,
    value.isbn,
    value.issn,
    value.eIssn,
    value.e_issn,
    value.authors,
  ]);

  const updateDoiLookupValue = (event) => {
    setDoiLookupValue(event.target.value);
  };

  const updateField = (field) => (event) => {
    const nextValue = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    const typeReset = field === "publicationType"
      ? isConferencePaperType(nextValue)
        ? getConferencePaperReset()
        : isBookPublicationType(nextValue)
          ? getBookPublicationReset()
          : !supportsQuartile(nextValue)
            ? { eIssn: "", e_issn: "", quartile: "", indexing: [] }
            : {}
      : {};

    onChange({
      ...value,
      [field]: nextValue,
      ...(field === "eIssn" ? { e_issn: nextValue } : {}),
      ...typeReset,
      metadataSource: value.metadataSource === "doi" ? "mixed" : value.metadataSource,
    });
  };

  const updateJournalIssnField = (event) => {
    const nextIssns = splitIssnPair(event.target.value);

    onChange({
      ...value,
      issn: nextIssns.issn,
      eIssn: nextIssns.eIssn,
      e_issn: nextIssns.eIssn,
      metadataSource: value.metadataSource === "doi" ? "mixed" : value.metadataSource,
    });
  };

  const updatePublishedField = (event) => {
    onChange({
      ...value,
      ...parsePublishedValue(event.target.value),
      metadataSource: value.metadataSource === "doi" ? "mixed" : value.metadataSource,
    });
  };

  const setAuthorField = (index, field, nextValue) => {
    const nextAuthors = [...(value.authors || [])];

    while (nextAuthors.length <= index) {
      nextAuthors.push({ ...EMPTY_AUTHOR });
    }

    nextAuthors[index] = { ...nextAuthors[index], [field]: nextValue };

    onChange({
      ...value,
      authors: nextAuthors,
      metadataSource: value.metadataSource === "doi" ? "mixed" : value.metadataSource,
    });
    setFormError("");
  };

  const addAuthor = () => {
    const authors = value.authors || [];

    onChange({
      ...value,
      authors: authors.length
        ? [...authors, { ...EMPTY_AUTHOR }]
        : [{ ...EMPTY_AUTHOR }, { ...EMPTY_AUTHOR }],
    });
    setFormError("");
  };

  const removeAuthor = (index) => {
    const nextAuthors = (value.authors || []).filter((_, authorIndex) => authorIndex !== index);

    onChange({
      ...value,
      authors: nextAuthors,
    });
  };

  const updateIndexingField = (field) => (event) => {
    const nextValue = event.target.value;
    const indexing = Array.isArray(value.indexing) ? value.indexing : [];
    const [firstIndexing = {}, ...restIndexing] = indexing;
    const nextPlatform = normalizeIndexingPlatform(field === "indexingPlatform" ? nextValue : value.indexingPlatform || primaryIndexing.source || "");
    const nextCustomIndexingPlatform = nextPlatform === "Other"
      ? field === "customIndexingPlatform"
        ? normalizeCustomIndexingPlatform(nextValue)
        : selectedCustomIndexingPlatform
      : "";
    const nextWebOfScienceIndex = nextPlatform === "Web of Science"
      ? field === "webOfScienceIndex"
        ? normalizeWebOfScienceIndex(nextValue)
        : selectedWebOfScienceIndex
      : "";
    const nextCategory = nextPlatform === "Web of Science" ? nextWebOfScienceIndex : "";
    const nextQuartile = nextPlatform === "Scopus"
      ? field === "quartile"
        ? normalizeQuartile(nextValue)
        : normalizeQuartile(displayableQuartile || "")
      : "";
    const nextSjr = nextPlatform === "Scopus" ? field === "sjr" ? nextValue : value.sjr || primaryIndexing.sjr || "" : "";
    const nextCiteScore = nextPlatform === "Scopus" ? field === "citeScore" ? nextValue : value.citeScore || getIndexingCiteScore(primaryIndexing) : "";
    const nextImpactFactor = nextPlatform === "Web of Science" ? field === "impactFactor" ? nextValue : value.impactFactor || primaryIndexing.impactFactor || primaryIndexing.impact_factor || "" : "";
    const nextQuartileStatus = field === "quartile" && nextQuartile
      ? "manual"
      : primaryIndexing.quartileVerificationStatus || primaryIndexing.quartile_verification_status || (nextQuartile ? "manual" : "empty");
    const nextFirstIndexing = {
      ...firstIndexing,
      source: nextPlatform,
      platform: nextPlatform,
      sourceKey: "manual",
      category: nextCategory,
      webOfScienceIndex: nextWebOfScienceIndex,
      web_of_science_index: nextWebOfScienceIndex,
      quartile: nextQuartile,
      quartileVerified: false,
      quartile_verified: false,
      quartileSource: "manual",
      quartile_source: "manual",
      quartileVerificationStatus: nextQuartileStatus,
      quartile_verification_status: nextQuartileStatus,
      quartileSelectionReason: field === "quartile" ? "manual_edit" : primaryIndexing.quartileSelectionReason || primaryIndexing.quartile_selection_reason || "",
      quartile_selection_reason: field === "quartile" ? "manual_edit" : primaryIndexing.quartileSelectionReason || primaryIndexing.quartile_selection_reason || "",
      sjr: nextSjr,
      citeScore: nextCiteScore,
      impactFactor: nextImpactFactor,
      impact_factor: nextImpactFactor,
    };
    const nextIndexing = nextFirstIndexing.source || nextFirstIndexing.category || nextFirstIndexing.quartile || nextFirstIndexing.sjr || nextFirstIndexing.citeScore || nextFirstIndexing.impactFactor || nextFirstIndexing.indexedUrl
      ? [nextFirstIndexing, ...restIndexing]
      : restIndexing;

    onChange({
      ...value,
      [field]: nextValue,
      indexingPlatform: nextPlatform,
      indexing_platform: nextPlatform,
      customIndexingPlatform: nextCustomIndexingPlatform,
      custom_indexing_platform: nextCustomIndexingPlatform,
      webOfScienceIndex: nextWebOfScienceIndex,
      web_of_science_index: nextWebOfScienceIndex,
      indexingCategory: nextCategory,
      indexing_category: nextCategory,
      quartile: nextQuartile,
      quartileVerified: false,
      quartileSource: "manual",
      quartileVerificationStatus: nextQuartileStatus,
      sjr: nextSjr,
      citeScore: nextCiteScore,
      impactFactor: nextImpactFactor,
      impact_factor: nextImpactFactor,
      indexing: nextIndexing,
      indexingVerified: false,
      indexingSource: "manual",
      metadataSource: value.metadataSource === "doi" ? "mixed" : value.metadataSource,
    });
  };

  const lookupDoi = async () => {
    const doi = normalizeDoiInput(doiLookupValue || value.doi);

    if (!doi) {
      setDoiError(t("professor.dashboard.publicationForm.doiRequired"));
      return;
    }

    if (!isValidDoiInput(doi)) {
      setDoiError(t("professor.doi.invalid"));
      return;
    }

    setIsLookingUpDoi(true);
    setDoiError("");
    setDoiLookupValue(doi);

    try {
      const response = await fetch(apiUrl(`/doi/${encodeURIComponent(doi)}`));
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.data) {
        throw new Error(result.message || t("professor.dashboard.publicationForm.doiLoadFailed"));
      }

      onChange({
        ...value,
        ...metadataToDraft(result.data, currentUserAuthor),
        status: PUBLICATION_STATUS_VALUES.includes(value.status) ? value.status : "draft",
      });
      setShowPublicationFields(true);
      setDoiLookupValue(result.data.doi || doi);
    } catch (error) {
      setDoiError(error.message || t("professor.dashboard.publicationForm.doiLookupFailed"));
      onChange({ ...value, doi, metadataSource: "manual", metadataVerified: false });
    } finally {
      setIsLookingUpDoi(false);
    }
  };

  const focusManualFields = () => {
    setShowPublicationFields(true);

    window.setTimeout(() => {
      const target = formRef.current?.querySelector(
        ".prof-form-grid input:not([readonly]), .prof-form-grid select:not(:disabled), .prof-form-grid textarea:not([readonly])"
      );

      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    }, 0);
  };

  const submit = async (event) => {
    event.preventDefault();
    const validAuthors = (value.authors || []).filter((author) => String(author.fullName || "").trim());

    if (value.publicationType === "conference_paper" && !String(value.venue || "").trim()) {
      setFormError(t("professor.dashboard.publicationForm.conferenceNameRequired"));
      return;
    }

    if (value.publicationType !== "conference_paper" && !String(value.venue || "").trim()) {
      setFormError(t("professor.dashboard.publicationForm.publishedInRequired"));
      return;
    }

    if (value.publicationType === "journal_article" && hasIndexingDetails && !hasIndexingPlatform) {
      setFormError(t("professor.dashboard.publicationForm.indexingPlatformRequiredWhenIndexed"));
      return;
    }

    if (value.publicationType === "conference_paper" && !String(value.conferenceLocation || "").trim()) {
      setFormError(t("professor.dashboard.publicationForm.conferenceLocationRequired"));
      return;
    }

    if (!validAuthors.length) {
      setFormError(t("professor.dashboard.publicationForm.authorRequired"));
      return;
    }

    setFormError("");
    await onSubmit();
  };

  const authors = value.authors || [];
  const authorRows = authors.length ? authors : [{ ...EMPTY_AUTHOR }];
  const venuePlaceholderKey = value.publicationType === "conference_paper"
    ? "professor.dashboard.publicationForm.publishedInPlaceholderConference"
    : value.publicationType === "book"
      ? "professor.dashboard.publicationForm.publishedInPlaceholderBook"
      : value.publicationType === "journal_article"
        ? "professor.dashboard.publicationForm.publishedInPlaceholderJournal"
        : "professor.dashboard.publicationForm.publishedInPlaceholderDefault";
  const venuePlaceholder = t(venuePlaceholderKey);
  const venueLabelKey = value.publicationType === "conference_paper"
    ? "professor.dashboard.publicationForm.conferenceName"
    : value.publicationType === "book"
      ? "professor.dashboard.publicationForm.bookTitle"
      : value.publicationType === "journal_article"
        ? "professor.dashboard.publicationForm.journalName"
    : "professor.dashboard.publicationForm.publishedIn";
  const authorEntries = authorRows.map((author, index) => ({ author, index }));
  const mainAuthorEntry = authorEntries.find(({ author }) => normalizeBoolean(author.isMainAuthor ?? author.is_main_author)) || authorEntries[0] || { author: { ...EMPTY_AUTHOR }, index: 0 };
  const correspondingAuthorEntry = authorEntries.find(({ author, index }) =>
    index !== mainAuthorEntry.index
    && normalizeBoolean(author.isCorrespondingAuthor ?? author.is_corresponding_author)
  );
  const coauthorEntries = authorEntries.filter(({ author, index }) =>
    index !== mainAuthorEntry.index
    && index !== correspondingAuthorEntry?.index
    && !normalizeBoolean(author.isCorrespondingAuthor ?? author.is_corresponding_author)
  );
  const renderAuthorFields = (author, index, { showRemove = false, required = false } = {}) => {
    const authorsLocked = isFieldLocked("authors");
    const orcidLocked = authorsLocked && isTrustedAuthorFieldSource(author.orcidSource || author.orcid_source);
    const hasOrcid = Boolean(String(author.orcid || "").trim());

    return (
      <div className="publication-author-row" key={`publication-author-${index}`}>
        <div className="publication-author-field publication-author-name-field">
          {authorsLocked ? (
            <span className="publication-author-name" title={author.fullName || ""}>
              {author.fullName || "-"}
            </span>
          ) : (
            <input
              value={author.fullName || ""}
              onChange={(event) => setAuthorField(index, "fullName", event.target.value)}
              placeholder={t("professor.dashboard.publicationForm.fullNamePlaceholder")}
              aria-label={t("professor.dashboard.publicationForm.author")}
              required={required}
            />
          )}
        </div>
        <div className="publication-author-field publication-author-affiliation-field">
          <span className="publication-author-field-label">{t("professor.dashboard.publicationForm.affiliation")}</span>
          <input
            value={author.affiliation || ""}
            onChange={(event) => setAuthorField(index, "affiliation", event.target.value)}
            placeholder={t("professor.dashboard.publicationForm.affiliationPlaceholder")}
            aria-label={t("professor.dashboard.publicationForm.affiliation")}
          />
        </div>
        <div className="publication-author-field publication-author-orcid-field">
          <span className="publication-author-field-label">ORCID</span>
          {orcidLocked && hasOrcid ? (
            <span className="publication-author-readonly-text publication-author-orcid" title={author.orcid || ""}>
              {author.orcid}
            </span>
          ) : (
            <input
              value={author.orcid || ""}
              onChange={(event) => setAuthorField(index, "orcid", event.target.value)}
              placeholder="0000-0000-0000-0000"
              aria-label="ORCID"
            />
          )}
        </div>
        {showRemove && !authorsLocked ? (
          <div className="publication-author-inline-actions">
            <button
              type="button"
              className="publication-remove-button"
              onClick={() => removeAuthor(index)}
              aria-label={t("professor.dashboard.publicationForm.removeCoauthor", { index })}
            >
              <Trash2 size={14} aria-hidden="true" />
              <span>{t("professor.dashboard.publicationForm.remove")}</span>
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <form className="publication-form" onSubmit={submit} ref={formRef}>
      {!showPublicationFields && !hasFormDoi ? (
      <div className="publication-doi-card">
        <div className="publication-doi-card-copy">
          <p>{t("professor.dashboard.publicationForm.doiLookupDescription")}</p>
        </div>
        <div className="publication-form-toolbar">
          <div className="publication-doi-lookup">
            <Search size={18} className="publication-doi-input-icon" aria-hidden="true" />
            <input
              value={doiLookupValue}
              onChange={updateDoiLookupValue}
              placeholder="10.xxxx/xxxxx"
              aria-label={t("professor.dashboard.publicationForm.doiLookupAria")}
              disabled={isLookingUpDoi || submitting}
            />
          </div>
          <button
            type="button"
            className={`publication-doi-action ${isLookingUpDoi ? "is-loading" : ""}`.trim()}
            onClick={lookupDoi}
            disabled={isLookingUpDoi || submitting}
          >
            {isLookingUpDoi ? <Loader2 size={16} className="publication-doi-action-spinner" /> : <Search size={16} />}
            {isLookingUpDoi ? t("common.loading") : t("professor.dashboard.publicationForm.getMetadata")}
          </button>
          <button
            type="button"
            className="publication-manual-action"
            onClick={focusManualFields}
            disabled={submitting}
          >
            <Plus size={17} aria-hidden="true" />
            {t("professor.dashboard.publicationForm.addManually")}
          </button>
        </div>
        <div className="publication-doi-hint">
          <FileText size={16} aria-hidden="true" />
          <span>{t("professor.dashboard.publicationForm.doiHint")}</span>
        </div>
      </div>
      ) : null}

      {doiError ? <p className="publication-form-message error">{doiError}</p> : null}
      {showPublicationFields ? (
        <>
      <div className="prof-form-grid">
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.publicationType")}</span>
          <select value={value.publicationType} onChange={updateField("publicationType")} disabled={isFieldLocked("publicationType")}>
            {PUBLICATION_TYPES.map((type) => <option key={type.value} value={type.value}>{t(type.labelKey)}</option>)}
          </select>
        </label>
        <label className="prof-form-field reimbursement-wide">
          <span>{t("professor.dashboard.publicationForm.title")}</span>
          <input value={value.title} onChange={updateField("title")} required readOnly={isFieldLocked("title")} />
        </label>
        <label className="prof-form-field">
          <span>DOI</span>
          <input
            value={value.doi || ""}
            onChange={updateField("doi")}
            onBlur={(event) => {
              const normalizedDoi = normalizeDoiInput(event.target.value);
              if (normalizedDoi !== event.target.value) {
                updateField("doi")({ target: { value: normalizedDoi } });
              }
            }}
            placeholder="10.xxxx/xxxxx ose https://doi.org/10.xxxx/xxxxx"
            readOnly={isFieldLocked("doi")}
          />
        </label>
        <label className="prof-form-field">
          <span>{t(venueLabelKey)}</span>
          <input value={value.venue} onChange={updateField("venue")} placeholder={venuePlaceholder} required readOnly={isFieldLocked("venue")} />
        </label>
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.sourceUrl")}</span>
          <input
            value={value.sourceUrl || ""}
            onChange={updateField("sourceUrl")}
            placeholder="https://..."
            readOnly={isFieldLocked("sourceUrl")}
          />
        </label>
        {value.publicationType === "conference_paper" ? (
          <label className="prof-form-field">
            <span>{t("professor.dashboard.publicationForm.conferenceLocation")}</span>
            <input
              value={value.conferenceLocation || ""}
              onChange={updateField("conferenceLocation")}
              placeholder="Berlin, Germany"
              required
              readOnly={isFieldLocked("conferenceLocation")}
            />
          </label>
        ) : null}
        {showPublisherField ? (
          <label className="prof-form-field">
            <span>{t("professor.dashboard.publicationForm.publisher")}</span>
            <input value={value.publisher} onChange={updateField("publisher")} readOnly={isFieldLocked("publisher")} />
          </label>
        ) : null}
        {showConferenceProceedingsTitle ? (
          <label className="prof-form-field">
            <span>{t("professor.dashboard.publicationForm.proceedingsTitle")}</span>
            <input value={proceedingsTitleValue} readOnly aria-readonly="true" />
          </label>
        ) : null}
        {showConferenceEventDate ? (
          <label className="prof-form-field">
            <span>{t("professor.dashboard.publicationForm.eventDate")}</span>
            <input value={formatPublishedValue(eventDateValue, "")} readOnly aria-readonly="true" />
          </label>
        ) : null}
        {showBookChapterEditors ? (
          <label className="prof-form-field">
            <span>{t("professor.dashboard.publicationForm.editors")}</span>
            <input value={editorsValue} readOnly aria-readonly="true" />
          </label>
        ) : null}
        {showBookChapterSeriesTitle ? (
          <label className="prof-form-field">
            <span>{t("professor.dashboard.publicationForm.bookSeriesTitle")}</span>
            <input value={bookSeriesTitleValue} readOnly aria-readonly="true" />
          </label>
        ) : null}
        {showBookChapterEdition ? (
          <label className="prof-form-field">
            <span>{t("professor.dashboard.publicationForm.edition")}</span>
            <input value={editionValue} readOnly aria-readonly="true" />
          </label>
        ) : null}
        {showPublishedDateField ? (
          <label className="prof-form-field">
            <span>{t(isConferencePaper ? "professor.dashboard.publicationForm.publicationDate" : "professor.dashboard.publicationForm.publishedAt")}</span>
            <input
              value={publishedValue}
              onChange={updatePublishedField}
              placeholder={t("professor.dashboard.publicationForm.publishedAtPlaceholder")}
              readOnly={isFieldLocked("publicationDate") || isFieldLocked("publicationYear")}
            />
          </label>
        ) : null}
        {value.publicationType === "journal_article" ? (
          <label className="prof-form-field">
            <span>{t("professor.dashboard.publicationForm.acceptanceDate")}</span>
            <input
              type="date"
              value={value.acceptanceDate || ""}
              onChange={updateField("acceptanceDate")}
              readOnly={isFieldLocked("acceptanceDate")}
            />
          </label>
        ) : null}
        {showVolumeField ? (
          <label className="prof-form-field">
            <span>{t("professor.dashboard.publicationForm.volume")}</span>
            <input value={value.volume} onChange={updateField("volume")} readOnly={isFieldLocked("volume")} />
          </label>
        ) : null}
        {showIssueField ? (
          <label className="prof-form-field">
            <span>{t("professor.dashboard.publicationForm.issue")}</span>
            <input value={value.issue} onChange={updateField("issue")} readOnly={isFieldLocked("issue")} />
          </label>
        ) : null}
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.pages")}</span>
          <input value={value.pages} onChange={updateField("pages")} readOnly={isFieldLocked("pages")} />
        </label>
        {showIndexingFields ? (
          <>
            <label className="prof-form-field">
              <span>{t("professor.dashboard.publicationForm.indexingPlatform")}</span>
              <select
                value={selectedIndexingPlatform}
                onChange={updateIndexingField("indexingPlatform")}
                required
                disabled={isFieldLocked("indexingPlatform")}
              >
                {INDEXING_PLATFORM_OPTIONS.map((option) => (
                  <option key={option || "empty-platform"} value={option}>
                    {option || t("professor.dashboard.publicationForm.selectIndexingPlatform")}
                  </option>
                ))}
              </select>
            </label>
            {isOtherIndexing ? (
              <label className="prof-form-field">
                <span>{t("professor.dashboard.publicationForm.customIndexingPlatform")}</span>
                <input
                  value={selectedCustomIndexingPlatform}
                  onChange={updateIndexingField("customIndexingPlatform")}
                  readOnly={isFieldLocked("customIndexingPlatform")}
                />
              </label>
            ) : null}
            {isScopusIndexing ? (
              <>
                <label className="prof-form-field">
                  <span className="publication-quartile-label">
                    <span>{t("professor.dashboard.publicationForm.quartile")}</span>
                  </span>
                  <select
                    value={displayableQuartile}
                    onChange={updateIndexingField("quartile")}
                    disabled={isFieldLocked("quartile") || submitting}
                  >
                    {QUARTILE_OPTIONS.map((option) => (
                      <option key={option || "empty-quartile"} value={option}>
                        {option || t("professor.dashboard.publicationForm.selectQuartile")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="prof-form-field">
                  <span>{t("professor.dashboard.publicationForm.citeScore")}</span>
                  <input
                    value={value.citeScore || getIndexingCiteScore(primaryIndexing)}
                    onChange={updateIndexingField("citeScore")}
                    readOnly={isFieldLocked("citeScore")}
                  />
                </label>
              </>
            ) : null}
            {isWebOfScienceIndexing ? (
              <>
                <label className="prof-form-field">
                  <span>{t("professor.dashboard.publicationForm.webOfScienceIndex")}</span>
                  <select
                    value={selectedWebOfScienceIndex}
                    onChange={updateIndexingField("webOfScienceIndex")}
                    disabled={isFieldLocked("webOfScienceIndex") || submitting}
                  >
                    {WEB_OF_SCIENCE_INDEX_OPTIONS.map((option) => (
                      <option key={option || "empty-wos-index"} value={option}>
                        {option || t("professor.dashboard.publicationForm.selectWebOfScienceIndex")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="prof-form-field">
                  <span>{t("professor.dashboard.publicationForm.impactFactor")}</span>
                  <input
                    value={value.impactFactor || primaryIndexing.impactFactor || primaryIndexing.impact_factor || ""}
                    onChange={updateIndexingField("impactFactor")}
                    readOnly={isFieldLocked("impactFactor")}
                  />
                </label>
              </>
            ) : null}
          </>
        ) : null}
        {showIdentifierField && isJournalArticle ? (
          <label className="prof-form-field">
            <span>ISSN / E-ISSN</span>
            <input
              value={journalIssnDisplayValue}
              onChange={updateJournalIssnField}
              placeholder="2576-8484 (Print), 2576-8492 (Online)"
              aria-label="ISSN / E-ISSN"
              readOnly={isFieldLocked("issn") || isFieldLocked("eIssn")}
            />
          </label>
        ) : showIdentifierField ? (
          <div className="prof-form-field publication-identifier-field">
            <span>{isBookPublication ? "ISBN" : "ISSN / ISBN"}</span>
            <div className="publication-identifier-inputs">
              {showIssnInput ? (
                <input
                  value={value.issn}
                  onChange={updateField("issn")}
                  placeholder="ISSN"
                  aria-label="ISSN"
                  readOnly={isFieldLocked("issn")}
                />
              ) : null}
              {showIsbnInput ? (
                <input
                  value={value.isbn}
                  onChange={updateField("isbn")}
                  placeholder="ISBN"
                  aria-label="ISBN"
                  readOnly={isFieldLocked("isbn")}
                />
              ) : null}
            </div>
          </div>
        ) : null}
        {showAbstractField ? (
          <label className="prof-form-field reimbursement-wide publication-abstract-field">
            <span>{t("professor.dashboard.publicationForm.abstract")}</span>
            <textarea value={value.abstract} onChange={updateField("abstract")} rows={abstractRows} readOnly={isFieldLocked("abstract")} />
            {isAbstractExpandable ? (
              <button
                type="button"
                className="publication-abstract-toggle"
                onClick={() => setIsAbstractExpanded((expanded) => !expanded)}
              >
                {isAbstractExpanded ? t("professor.dashboard.publicationForm.showLess") : t("professor.dashboard.publicationForm.readMore")}
              </button>
            ) : null}
          </label>
        ) : null}
      </div>

      <div className="publication-form-section">
        <div className="publication-form-section-header">
          <div>
            <h4>{t("professor.dashboard.publicationForm.authorsTitle")}</h4>
            <p>{t("professor.dashboard.publicationForm.authorsDescription")}</p>
          </div>
        </div>
        <div className={`publication-authors-groups ${isFieldLocked("authors") ? "publication-authors-groups--readonly" : ""}`} role="group" aria-label={t("professor.dashboard.publicationForm.authorsListAria")}>
          <section className="publication-author-group">
            <h5>{t("professor.dashboard.publicationForm.mainAuthor")}</h5>
            {renderAuthorFields(mainAuthorEntry.author, mainAuthorEntry.index, { required: true })}
          </section>
          {correspondingAuthorEntry ? (
            <section className="publication-author-group">
              <h5>{t("professor.dashboard.publicationForm.correspondingAuthor")}</h5>
              {renderAuthorFields(correspondingAuthorEntry.author, correspondingAuthorEntry.index)}
            </section>
          ) : null}
          <section className="publication-author-group">
            <h5>{t("professor.dashboard.publicationForm.coauthors")}</h5>
            <div className="publication-coauthors-list">
              {coauthorEntries.length ? coauthorEntries.map(({ author, index }) =>
                renderAuthorFields(author, index, { showRemove: true })
              ) : (
                <p className="publication-no-coauthors">{t("professor.dashboard.publicationForm.noCoauthors")}</p>
              )}
            </div>
          </section>
          {!isFieldLocked("authors") ? (
            <button type="button" className="publication-add-coauthor" onClick={addAuthor}>
              <Plus size={14} aria-hidden="true" />
              {t("professor.dashboard.publicationForm.addCoauthor")}
            </button>
          ) : null}
        </div>
        {formError ? <p className="publication-form-message error" role="alert">{formError}</p> : null}
      </div>

      <div className="prof-modal-actions">
        {onCancel ? <button type="button" className="prof-btn-secondary" onClick={onCancel} disabled={submitting}>{t("common.cancel")}</button> : null}
        <button type="submit" className="prof-btn-primary" disabled={submitting}>
          {submitting ? t("common.loading") : submitLabel || (mode === "edit" ? t("professor.dashboard.saveChanges") : t("professor.dashboard.savePublication"))}
        </button>
      </div>
        </>
      ) : null}
    </form>
  );
};

export default PublicationForm;
