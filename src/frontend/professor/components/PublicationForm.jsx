import React, { useState } from "react";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { apiUrl } from "../../utils/api";
import { useLanguage } from "../../i18n/LanguageContext";
import {
  INDEXING_PLATFORM_VALUES,
  PUBLICATION_STATUS_VALUES,
  PUBLICATION_TYPE_VALUES,
  QUARTILE_VALUES,
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
  venue: "",
  conferenceLocation: "",
  publisher: "",
  publicationDate: "",
  publicationYear: "",
  doi: "",
  sourceUrl: "",
  volume: "",
  issue: "",
  pages: "",
  issn: "",
  isbn: "",
  authorAffiliation: "",
  indexingPlatform: "",
  indexingCategory: "",
  quartile: "",
  quartileVerified: false,
  quartileSource: "manual",
  quartileVerificationStatus: "empty",
  sjr: "",
  citeScore: "",
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
      orcid: normalizedAuthor.orcid || "",
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

      return String(item.name || item.affiliation || item.institution || item.organization || item.value || "").trim();
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
  return true;
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
  if (["scie", "ssci", "ahci"].includes(comparable)) return text.toUpperCase();
  if (comparable === "other") return "Other";

  return INDEXING_PLATFORM_OPTIONS.includes(text) ? text : "";
}

function normalizeIndexingCategory(value) {
  const text = String(value || "").trim();
  const comparable = text.toLowerCase().replace(/\s+/g, "");

  if (!text) return "";
  if (/^q[1-4]$/i.test(text)) return text.toUpperCase();
  if (["scie", "ssci", "ahci"].includes(comparable)) return text.toUpperCase();
  if (["book/chapter", "bookchapter", "book", "chapter"].includes(comparable)) return "Book/Chapter";
  if (comparable === "other") return "Other";

  return text;
}

function normalizeQuartile(value) {
  const match = String(value || "").trim().toUpperCase().match(/\bQ[1-4]\b/);

  return match?.[0] || "";
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
      Boolean(item.quartileVerified ?? item.quartile_verified)
      || status === "verified"
      || status === "manual"
      || status === "historical"
      || !status
    );
}

export function publicationToDraft(publication = {}) {
  const publicationType = publication.publicationType || publication.publication_type || "";
  const normalizedAuthors = Array.isArray(publication.authors) ? normalizePublicationAuthors(publication.authors) : [];
  const indexing = Array.isArray(publication.indexing) && publication.indexing.length ? publication.indexing.map((item) => ({
    source: normalizeIndexingPlatform(item.source || item.platform),
    platform: normalizeIndexingPlatform(item.platform || item.source),
    sourceKey: normalizeIndexingSource(item.sourceKey || item.source_key || item.indexingSource || item.indexing_source || item.source),
    category: item.category || "",
    quartile: normalizeQuartile(item.quartile),
    quartileVerified: Boolean(item.quartileVerified ?? item.quartile_verified),
    quartile_verified: Boolean(item.quartileVerified ?? item.quartile_verified),
    quartileSource: normalizeIndexingSource(item.quartileSource || item.quartile_source || item.sourceKey || item.source_key || item.source),
    quartile_source: normalizeIndexingSource(item.quartileSource || item.quartile_source || item.sourceKey || item.source_key || item.source),
    quartileVerificationStatus: item.quartileVerificationStatus || item.quartile_verification_status || (item.quartile ? "manual" : "empty"),
    quartile_verification_status: item.quartileVerificationStatus || item.quartile_verification_status || (item.quartile ? "manual" : "empty"),
    quartileSelectionReason: item.quartileSelectionReason || item.quartile_selection_reason || "",
    quartile_selection_reason: item.quartileSelectionReason || item.quartile_selection_reason || "",
    impactFactor: item.impactFactor || item.impact_factor || "",
    sjr: item.sjr || "",
    citeScore: normalizeCiteScoreForDisplay(item.citeScore || item.cite_score || item.citescore, { verifiedZero: Boolean(item.citeScoreVerified ?? item.cite_score_verified) }),
    citeScoreVerified: Boolean(item.citeScoreVerified ?? item.cite_score_verified),
    cite_score_verified: Boolean(item.citeScoreVerified ?? item.cite_score_verified),
    indexedUrl: item.indexedUrl || item.indexed_url || "",
  })) : publication.quartile ? [{ source: "", platform: "", sourceKey: "manual", category: "", quartile: normalizeQuartile(publication.quartile), impactFactor: "", sjr: "", citeScore: "", indexedUrl: "" }] : [];
  const primaryIndexing = indexing[0] || {};
  const displayablePrimaryQuartile = isDisplayableQuartile(primaryIndexing) ? primaryIndexing.quartile : "";

  return {
    ...createEmptyPublicationDraft(),
    title: publication.title || "",
    abstract: publication.abstract || "",
    publicationType,
    venue: publication.venue || publication.journal || "",
    conferenceLocation: publication.conferenceLocation || publication.conference_location || "",
    publisher: publication.publisher || "",
    publicationDate: (publication.publicationDate || publication.publication_date || "").slice(0, 10),
    publicationYear: publication.publicationYear || publication.publication_year || publication.year || "",
    doi: publication.doi || "",
    sourceUrl: publication.sourceUrl || publication.source_url || "",
    volume: publication.volume || "",
    issue: publication.issue || "",
    pages: publication.pages || "",
    issn: publication.issn || "",
    isbn: publication.isbn || "",
    authorAffiliation: publication.authorAffiliation
      || publication.author_affiliation
      || publication.affiliation
      || normalizedAuthors.find((author) => author.affiliation)?.affiliation
      || "",
    indexingPlatform: normalizeIndexingPlatform(publication.indexingPlatform || publication.indexing_platform || primaryIndexing.source),
    indexingCategory: normalizeIndexingCategory(publication.indexingCategory || publication.indexing_category || primaryIndexing.category || ""),
    quartile: normalizeQuartile(publication.quartile || displayablePrimaryQuartile),
    quartileVerified: Boolean(publication.quartileVerified ?? publication.quartile_verified ?? primaryIndexing.quartileVerified ?? primaryIndexing.quartile_verified),
    quartileSource: normalizeIndexingSource(publication.quartileSource || publication.quartile_source || primaryIndexing.quartileSource || primaryIndexing.quartile_source || primaryIndexing.sourceKey || primaryIndexing.source_key || primaryIndexing.source),
    quartileVerificationStatus: publication.quartileVerificationStatus || publication.quartile_verification_status || primaryIndexing.quartileVerificationStatus || primaryIndexing.quartile_verification_status || (publication.quartile || primaryIndexing.quartile ? "manual" : "empty"),
    sjr: publication.sjr || primaryIndexing.sjr || "",
    citeScore: normalizeCiteScoreForDisplay(
      publication.citeScore || publication.cite_score || primaryIndexing.citeScore || primaryIndexing.cite_score || "",
      { verifiedZero: Boolean(publication.citeScoreVerified ?? publication.cite_score_verified ?? primaryIndexing.citeScoreVerified ?? primaryIndexing.cite_score_verified) }
    ),
    indexingVerified: Boolean(publication.indexingVerified ?? publication.indexing_verified),
    indexingSource: normalizeIndexingSource(publication.indexingSource || publication.indexing_source || primaryIndexing.sourceKey || primaryIndexing.source_key || primaryIndexing.source),
    status: publication.status || "draft",
    authors: normalizedAuthors,
    indexing,
    evidenceLinks: (Array.isArray(publication.evidenceLinks) ? publication.evidenceLinks : publication.attachments || []).map((item) => ({
      url: item.url || item.fileUrl || item.file_url || "",
      label: item.label || item.fileType || item.file_type || "",
      uploadedAt: (item.uploadedAt || item.uploaded_at || "").slice(0, 10),
    })),
    metadataSource: publication.metadataSource || publication.metadata_source || "manual",
    metadataVerified: Boolean(publication.metadataVerified ?? publication.metadata_verified),
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
    journal_article: "journal_article",
    proceedings_article: "conference_paper",
    conference_paper: "conference_paper",
    book: "book",
    book_chapter: "book",
    chapter: "book",
  };

  return map[normalized] || "";
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
  const matchesCurrentUser = currentUserAuthor.name && normalizeName(fullName) === normalizeName(currentUserAuthor.name);

  return {
    ...EMPTY_AUTHOR,
    fullName,
    givenName: normalizedAuthor.givenName || normalizedAuthor.given_name || "",
    familyName: normalizedAuthor.familyName || normalizedAuthor.family_name || "",
    orcid: normalizedAuthor.orcid || (matchesCurrentUser ? currentUserAuthor.orcid : "") || "",
    affiliation: normalizeAuthorAffiliation(normalizedAuthor),
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
  const indexing = Array.isArray(metadata.indexing) ? metadata.indexing : [];
  const selectedQuartileIndexing = indexing.find((item) => item?.quartileVerified || item?.quartile_verified)
    || indexing.find((item) => String(item?.quartileVerificationStatus || item?.quartile_verification_status || "").toLowerCase() === "historical")
    || indexing.find((item) => normalizeQuartile(item?.quartile));
  const selectedQuartileStatus = String(metadata.quartileVerificationStatus || metadata.quartile_verification_status || selectedQuartileIndexing?.quartileVerificationStatus || selectedQuartileIndexing?.quartile_verification_status || "").toLowerCase();
  const quartileVerified = Boolean(metadata.quartileVerified ?? metadata.quartile_verified ?? selectedQuartileIndexing?.quartileVerified ?? selectedQuartileIndexing?.quartile_verified);
  const quartileHistorical = selectedQuartileStatus === "historical" || Boolean(metadata.quartileHistorical ?? metadata.quartile_historical);
  const quartile = quartileVerified || quartileHistorical ? normalizeQuartile(metadata.quartile || selectedQuartileIndexing?.quartile || "") : "";
  const quartileSource = quartileVerified || quartileHistorical
    ? normalizeIndexingSource(metadata.quartileSource || metadata.quartile_source || selectedQuartileIndexing?.quartileSource || selectedQuartileIndexing?.quartile_source || selectedQuartileIndexing?.sourceKey || selectedQuartileIndexing?.source_key || selectedQuartileIndexing?.source)
    : "manual";
  const quartileVerificationStatus = selectedQuartileStatus || "missing";
  const indexingPlatform = normalizeIndexingPlatform(metadata.indexingPlatform || metadata.indexing_platform || indexing.find((item) => item?.source)?.source);
  const indexingCategory = quartileVerified || quartileHistorical ? normalizeIndexingCategory(metadata.indexingCategory || metadata.indexing_category || selectedQuartileIndexing?.category || "") : "";
  const indexingVerified = Boolean(metadata.indexingVerified ?? metadata.indexing_verified);
  const indexingSource = normalizeIndexingSource(metadata.indexingSource || metadata.indexing_source || indexing.find((item) => item?.sourceKey || item?.source_key || item?.source)?.sourceKey || indexing.find((item) => item?.sourceKey || item?.source_key || item?.source)?.source_key || indexing.find((item) => item?.source)?.source);
  const sjr = metadata.sjr || indexing.find((item) => item?.sjr)?.sjr || "";
  const citeScoreIndexing = indexing.find((item) => item?.citeScore || item?.cite_score || item?.citescore) || {};
  const citeScore = normalizeCiteScoreForDisplay(
    metadata.citeScore || metadata.cite_score || citeScoreIndexing.citeScore || citeScoreIndexing.cite_score || citeScoreIndexing.citescore || "",
    { verifiedZero: Boolean(metadata.citeScoreVerified ?? metadata.cite_score_verified ?? citeScoreIndexing.citeScoreVerified ?? citeScoreIndexing.cite_score_verified) }
  );
  const matchedAuthorIndex = authors.findIndex((author) => {
    const normalizedAuthor = typeof author === "string" ? { fullName: author } : author || {};
    const fullName = normalizedAuthor.fullName || normalizedAuthor.full_name || normalizedAuthor.name || "";
    return currentUserAuthor.name && normalizeName(fullName) === normalizeName(currentUserAuthor.name);
  });
  const mainAuthorIndex = matchedAuthorIndex >= 0 ? matchedAuthorIndex : 0;
  const draftAuthors = authors.map((author, index) => metadataAuthorToDraft(author, index, currentUserAuthor, mainAuthorIndex));

  return {
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
    doi: metadata.doi || "",
    sourceUrl: metadata.source_url || "",
    volume: metadata.volume || "",
    issue: metadata.issue || "",
    pages: metadata.pages || "",
    issn: metadata.issn || metadata.raw_json?.ISSN?.[0] || "",
    isbn: metadata.isbn || metadata.raw_json?.ISBN?.[0] || "",
    authorAffiliation: metadata.authorAffiliation || metadata.author_affiliation || draftAuthors.find((author) => author.affiliation)?.affiliation || "",
    indexingPlatform,
    indexingCategory,
    quartile,
    quartileVerified,
    quartileHistorical,
    quartileSource,
    quartileVerificationStatus,
    sjr,
    citeScore,
    indexingVerified,
    indexingSource: indexingVerified ? indexingSource : "manual",
    authors: draftAuthors,
    indexing: indexing.length ? indexing.map((item, index) => ({
      source: item.source || (index === 0 ? indexingPlatform : ""),
      platform: item.platform || item.source || (index === 0 ? indexingPlatform : ""),
      sourceKey: normalizeIndexingSource(item.sourceKey || item.source_key || item.indexingSource || item.indexing_source || item.source || (index === 0 ? indexingSource : "")),
      category: item.category || (index === 0 ? indexingCategory : ""),
      quartile: normalizeQuartile(item.quartile || (index === 0 ? quartile : "")),
      quartileVerified: Boolean(item.quartileVerified ?? item.quartile_verified),
      quartile_verified: Boolean(item.quartileVerified ?? item.quartile_verified),
      quartileSource: normalizeIndexingSource(item.quartileSource || item.quartile_source || item.sourceKey || item.source_key || item.source || (index === 0 ? quartileSource : "")),
      quartile_source: normalizeIndexingSource(item.quartileSource || item.quartile_source || item.sourceKey || item.source_key || item.source || (index === 0 ? quartileSource : "")),
      quartileVerificationStatus: item.quartileVerificationStatus || item.quartile_verification_status || (item.quartile ? "manual_required" : "empty"),
      quartile_verification_status: item.quartileVerificationStatus || item.quartile_verification_status || (item.quartile ? "manual_required" : "empty"),
      quartileSelectionReason: item.quartileSelectionReason || item.quartile_selection_reason || "",
      quartile_selection_reason: item.quartileSelectionReason || item.quartile_selection_reason || "",
      impactFactor: item.impactFactor || item.impact_factor || "",
      sjr: item.sjr || (index === 0 ? sjr : ""),
      citeScore: normalizeCiteScoreForDisplay(item.citeScore || item.cite_score || item.citescore || (index === 0 ? citeScore : ""), { verifiedZero: Boolean(item.citeScoreVerified ?? item.cite_score_verified ?? metadata.citeScoreVerified ?? metadata.cite_score_verified) }),
      citeScoreVerified: Boolean(item.citeScoreVerified ?? item.cite_score_verified),
      cite_score_verified: Boolean(item.citeScoreVerified ?? item.cite_score_verified),
      indexedUrl: item.indexedUrl || item.indexed_url || "",
    })) : indexingPlatform || indexingCategory || quartile || sjr || citeScore
      ? [{ source: indexingPlatform, platform: indexingPlatform, sourceKey: indexingSource, category: indexingCategory, quartile, quartileVerified, quartile_verified: quartileVerified, quartileSource, quartile_source: quartileSource, quartileVerificationStatus, quartile_verification_status: quartileVerificationStatus, impactFactor: "", sjr, citeScore, citeScoreVerified: Boolean(metadata.citeScoreVerified ?? metadata.cite_score_verified), cite_score_verified: Boolean(metadata.citeScoreVerified ?? metadata.cite_score_verified), indexedUrl: "" }]
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
  const [doiLookupValue, setDoiLookupValue] = useState(value.doi || "");
  const [doiError, setDoiError] = useState("");
  const [formError, setFormError] = useState("");
  const [isLookingUpDoi, setIsLookingUpDoi] = useState(false);
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);
  const isDoiImported = value.metadataSource === "doi" && value.metadataVerified;
  const hasValue = (field) => String(value[field] || "").trim() !== "";
  const showVolumeField = !isDoiImported || hasValue("volume");
  const showIssueField = true;
  const showIdentifierField = !isDoiImported || hasValue("issn") || hasValue("isbn");
  const showIssnInput = !isDoiImported || hasValue("issn");
  const showIsbnInput = !isDoiImported || hasValue("isbn");
  const showAbstractField = !isDoiImported || hasValue("abstract");
  const publishedValue = formatPublishedValue(value.publicationDate, value.publicationYear);
  const isAbstractExpandable = String(value.abstract || "").trim().length > 260;
  const abstractRows = isAbstractExpandable && !isAbstractExpanded ? 3 : 6;
  const primaryIndexing = Array.isArray(value.indexing) && value.indexing.length ? value.indexing[0] : {};
  const fieldSources = normalizeFieldSources(value);
  const isTrustedSource = (field) => ["api", "lookup"].includes(fieldSources[field]?.source);
  const isFieldLocked = (field) => isDoiImported && isTrustedSource(field);
  const isQuartileVerified = Boolean(value.quartileVerified ?? value.quartile_verified ?? primaryIndexing.quartileVerified ?? primaryIndexing.quartile_verified);
  const quartileVerificationStatus = value.quartileVerificationStatus || value.quartile_verification_status || primaryIndexing.quartileVerificationStatus || primaryIndexing.quartile_verification_status || "";
  const normalizedQuartileStatus = String(quartileVerificationStatus || "").toLowerCase();
  const displayableQuartile = value.quartile || (isDisplayableQuartile(primaryIndexing) ? primaryIndexing.quartile : "");
  const isQuartileHistorical = !isQuartileVerified && normalizedQuartileStatus === "historical" && Boolean(displayableQuartile);
  const isQuartileManualRequired = !isQuartileVerified && !isQuartileHistorical && normalizedQuartileStatus === "manual_required";
  const isQuartileMissing = !isQuartileVerified && !isQuartileHistorical && !isQuartileManualRequired;
  const quartileBadgeLabel = isQuartileVerified
    ? t("professor.dashboard.publicationForm.quartileStatus.verified")
    : isQuartileHistorical
      ? t("professor.dashboard.publicationForm.quartileStatus.historical")
      : isQuartileManualRequired
        ? t("professor.dashboard.publicationForm.quartileStatus.manualRequired")
        : t("professor.dashboard.publicationForm.quartileStatus.missing");
  const quartileBadgeClass = isQuartileVerified
    ? "verified"
    : isQuartileHistorical
      ? "historical"
      : isQuartileManualRequired
        ? "manual-required"
        : "missing";
  const showQuartileBadge = isQuartileVerified || isQuartileHistorical || isQuartileManualRequired || isQuartileMissing;
  const hasIndexingPlatform = String(value.indexingPlatform || primaryIndexing.source || "").trim();
  const hasIndexingDetails = Boolean(
    String(value.indexingCategory || primaryIndexing.category || "").trim()
    || normalizeQuartile(displayableQuartile)
    || String(value.sjr || primaryIndexing.sjr || "").trim()
    || String(value.citeScore || primaryIndexing.citeScore || primaryIndexing.cite_score || "").trim()
    || Boolean(value.indexingVerified ?? value.indexing_verified)
  );

  const updateField = (field) => (event) => {
    const nextValue = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    const typeReset = field === "publicationType" && !supportsQuartile(nextValue)
      ? { quartile: "", indexing: [] }
      : {};

    onChange({
      ...value,
      [field]: nextValue,
      ...typeReset,
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

  const setCorrespondingAuthor = (index, checked) => {
    const nextAuthors = [...(value.authors || [])];

    while (nextAuthors.length <= index) {
      nextAuthors.push({ ...EMPTY_AUTHOR });
    }

    onChange({
      ...value,
      authors: nextAuthors.map((author, authorIndex) => ({
        ...author,
        isCorrespondingAuthor: checked ? authorIndex === index : false,
        is_corresponding_author: checked ? authorIndex === index : false,
      })),
      metadataSource: value.metadataSource === "doi" ? "mixed" : value.metadataSource,
    });
    setFormError("");
  };

  const updateIndexingField = (field) => (event) => {
    const nextValue = event.target.value;
    const indexing = Array.isArray(value.indexing) ? value.indexing : [];
    const [firstIndexing = {}, ...restIndexing] = indexing;
    const nextPlatform = field === "indexingPlatform" ? nextValue : value.indexingPlatform || primaryIndexing.source || "";
    const nextCategory = field === "indexingCategory" ? nextValue : value.indexingCategory || primaryIndexing.category || "";
    const nextQuartile = field === "quartile" ? normalizeQuartile(nextValue) : normalizeQuartile(displayableQuartile || "");
    const nextSjr = field === "sjr" ? nextValue : value.sjr || primaryIndexing.sjr || "";
    const nextCiteScore = field === "citeScore" ? nextValue : value.citeScore || primaryIndexing.citeScore || primaryIndexing.cite_score || "";
    const nextQuartileStatus = field === "quartile" && nextQuartile
      ? "manual"
      : primaryIndexing.quartileVerificationStatus || primaryIndexing.quartile_verification_status || (nextQuartile ? "manual" : "empty");
    const nextFirstIndexing = {
      ...firstIndexing,
      source: nextPlatform,
      platform: nextPlatform,
      sourceKey: "manual",
      category: nextCategory,
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
    };
    const nextIndexing = nextFirstIndexing.source || nextFirstIndexing.category || nextFirstIndexing.quartile || nextFirstIndexing.sjr || nextFirstIndexing.citeScore || nextFirstIndexing.impactFactor || nextFirstIndexing.indexedUrl
      ? [nextFirstIndexing, ...restIndexing]
      : restIndexing;

    onChange({
      ...value,
      [field]: nextValue,
      quartile: nextQuartile,
      quartileVerified: false,
      quartileSource: "manual",
      quartileVerificationStatus: nextQuartileStatus,
      sjr: nextSjr,
      citeScore: nextCiteScore,
      indexing: nextIndexing,
      indexingVerified: false,
      indexingSource: "manual",
      metadataSource: value.metadataSource === "doi" ? "mixed" : value.metadataSource,
    });
  };

  const lookupDoi = async () => {
    const doi = doiLookupValue.trim() || value.doi.trim();

    if (!doi) {
      setDoiError(t("professor.dashboard.publicationForm.doiRequired"));
      return;
    }

    setIsLookingUpDoi(true);
    setDoiError("");

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
      setDoiLookupValue(result.data.doi || doi);
    } catch (error) {
      setDoiError(error.message || t("professor.dashboard.publicationForm.doiLookupFailed"));
      onChange({ ...value, doi, metadataSource: "manual", metadataVerified: false });
    } finally {
      setIsLookingUpDoi(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    const validAuthors = (value.authors || []).filter((author) => String(author.fullName || "").trim());

    if (!String(value.venue || "").trim()) {
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
    onSubmit();
  };

  const authors = value.authors || [];
  const authorRows = authors.length ? authors : [{ ...EMPTY_AUTHOR }];
  const correspondingAuthorStatus = String(value.correspondingAuthorStatus || value.corresponding_author_status || "").toLowerCase();
  const hasCorrespondingAuthor = authors.some((author) => Boolean(author.isCorrespondingAuthor ?? author.is_corresponding_author));
  const showCorrespondingAuthorManualNotice = correspondingAuthorStatus === "manual_required" && !hasCorrespondingAuthor;
  const venuePlaceholderKey = value.publicationType === "conference_paper"
    ? "professor.dashboard.publicationForm.publishedInPlaceholderConference"
    : value.publicationType === "book"
      ? "professor.dashboard.publicationForm.publishedInPlaceholderBook"
      : value.publicationType === "journal_article"
        ? "professor.dashboard.publicationForm.publishedInPlaceholderJournal"
        : "professor.dashboard.publicationForm.publishedInPlaceholderDefault";
  const venuePlaceholder = t(venuePlaceholderKey);
  const mainAuthor = authorRows[0] || { ...EMPTY_AUTHOR };
  const coauthorRows = authorRows.slice(1);
  const renderAuthorFields = (author, index, { showRemove = false } = {}) => (
    <div className="publication-author-card" key={`publication-author-${index}`}>
      <label className="publication-author-field">
        <span>{t("professor.dashboard.publicationForm.author")}</span>
        {isFieldLocked("authors") ? (
          <span className="publication-author-readonly-text" title={author.fullName || ""}>
            {author.fullName || "-"}
          </span>
        ) : (
          <input
            value={author.fullName || ""}
            onChange={(event) => setAuthorField(index, "fullName", event.target.value)}
            placeholder={t("professor.dashboard.publicationForm.fullNamePlaceholder")}
            aria-label={t("professor.dashboard.publicationForm.author")}
            required={index === 0}
          />
        )}
      </label>
      <label className="publication-author-field publication-author-affiliation-field">
        <span>{t("professor.dashboard.publicationForm.affiliation")}</span>
        {isFieldLocked("authors") ? (
          <span className="publication-author-readonly-text" title={author.affiliation || ""}>
            {author.affiliation || "-"}
          </span>
        ) : (
          <input
            value={author.affiliation || ""}
            onChange={(event) => setAuthorField(index, "affiliation", event.target.value)}
            placeholder={t("professor.dashboard.publicationForm.affiliationPlaceholder")}
            aria-label={t("professor.dashboard.publicationForm.affiliation")}
          />
        )}
      </label>
      <label className="publication-author-field publication-author-orcid-field">
        <span>ORCID</span>
        {isFieldLocked("authors") ? (
          <span className="publication-author-readonly-text publication-author-orcid" title={author.orcid || ""}>
            {author.orcid || "-"}
          </span>
        ) : (
          <input
            value={author.orcid || ""}
            onChange={(event) => setAuthorField(index, "orcid", event.target.value)}
            placeholder="0000-0000-0000-0000"
            aria-label="ORCID"
          />
        )}
      </label>
      <div className="publication-author-inline-actions">
        <label className="publication-author-corresponding-option">
          <input
            type="checkbox"
            aria-label={t("professor.dashboard.publicationForm.correspondingAuthor")}
            checked={Boolean(author.isCorrespondingAuthor ?? author.is_corresponding_author)}
            onChange={(event) => setCorrespondingAuthor(index, event.target.checked)}
          />
          <span>{t("professor.dashboard.publicationForm.correspondingAuthor")}</span>
        </label>
        {showRemove && !isFieldLocked("authors") ? (
          <button
            type="button"
            className="publication-remove-button"
            onClick={() => removeAuthor(index)}
            aria-label={t("professor.dashboard.publicationForm.removeCoauthor", { index })}
          >
            <Trash2 size={14} aria-hidden="true" />
            <span>{t("professor.dashboard.publicationForm.remove")}</span>
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <form className="publication-form" onSubmit={submit}>
      <div className="publication-form-toolbar">
        <div className="publication-doi-lookup">
          <input
            value={doiLookupValue}
            onChange={(event) => setDoiLookupValue(event.target.value)}
            placeholder="10.xxxx/xxxxx"
            aria-label={t("professor.dashboard.publicationForm.doiLookupAria")}
            disabled={isLookingUpDoi || submitting}
          />
          <button
            type="button"
            className={`prof-btn-secondary publication-doi-action ${isLookingUpDoi ? "is-loading" : ""}`.trim()}
            onClick={lookupDoi}
            disabled={isLookingUpDoi || submitting}
          >
            {isLookingUpDoi ? <Loader2 size={16} className="publication-doi-action-spinner" /> : <Search size={16} />}
            {isLookingUpDoi ? t("common.loading") : t("professor.dashboard.publicationForm.getMetadata")}
          </button>
        </div>
      </div>

      {doiError ? <p className="publication-form-message error">{doiError}</p> : null}
      <div className="prof-form-grid">
        <label className="prof-form-field reimbursement-wide">
          <span>{t("professor.dashboard.publicationForm.title")}</span>
          <input value={value.title} onChange={updateField("title")} required readOnly={isFieldLocked("title")} />
        </label>
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.publicationType")}</span>
          <select value={value.publicationType} onChange={updateField("publicationType")} disabled={isFieldLocked("publicationType")}>
            {PUBLICATION_TYPES.map((type) => <option key={type.value} value={type.value}>{t(type.labelKey)}</option>)}
          </select>
        </label>
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.publishedIn")}</span>
          <input value={value.venue} onChange={updateField("venue")} placeholder={venuePlaceholder} required readOnly={isFieldLocked("venue")} />
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
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.publisher")}</span>
          <input value={value.publisher} onChange={updateField("publisher")} readOnly={isFieldLocked("publisher")} />
        </label>
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.publishedAt")}</span>
          <input
            value={publishedValue}
            onChange={updatePublishedField}
            placeholder={t("professor.dashboard.publicationForm.publishedAtPlaceholder")}
            readOnly={isFieldLocked("publicationDate") || isFieldLocked("publicationYear")}
          />
        </label>
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
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.indexingPlatform")}</span>
          <select
            value={value.indexingPlatform || primaryIndexing.source || ""}
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
        <label className="prof-form-field">
          <span className="publication-quartile-label">
            <span>{t("professor.dashboard.publicationForm.quartile")}</span>
            {showQuartileBadge ? (
              <span className={`publication-quartile-verification-badge ${quartileBadgeClass}`}>
                {quartileBadgeLabel}
              </span>
            ) : null}
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
            value={value.citeScore || primaryIndexing.citeScore || primaryIndexing.cite_score || ""}
            onChange={updateIndexingField("citeScore")}
            placeholder={t("common.noData")}
            readOnly={isFieldLocked("citeScore")}
          />
        </label>
        {showIdentifierField ? (
          <div className="prof-form-field publication-identifier-field">
            <span>ISSN / ISBN</span>
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
            {renderAuthorFields(mainAuthor, 0)}
          </section>
          <section className="publication-author-group">
            <h5>{t("professor.dashboard.publicationForm.coauthors")}</h5>
            <div className="publication-coauthors-list">
              {coauthorRows.length ? coauthorRows.map((author, coauthorIndex) =>
                renderAuthorFields(author, coauthorIndex + 1, { showRemove: true })
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
        {showCorrespondingAuthorManualNotice ? (
          <p className="publication-corresponding-info-alert">
            {t("professor.dashboard.publicationForm.correspondingAuthorManualNotice")}
          </p>
        ) : null}
        {formError ? <p className="publication-form-message error" role="alert">{formError}</p> : null}
      </div>

      <div className="prof-modal-actions">
        {onCancel ? <button type="button" className="prof-btn-secondary" onClick={onCancel} disabled={submitting}>{t("common.cancel")}</button> : null}
        <button type="submit" className="prof-btn-primary" disabled={submitting}>
          {submitting ? t("common.loading") : submitLabel || (mode === "edit" ? t("professor.dashboard.saveChanges") : t("professor.dashboard.savePublication"))}
        </button>
      </div>
    </form>
  );
};

export default PublicationForm;
