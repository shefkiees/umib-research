import React, { useState } from "react";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { apiUrl } from "../../utils/api";
import { useLanguage } from "../../i18n/LanguageContext";

export const PUBLICATION_TYPES = [
  { value: "", labelKey: "professor.dashboard.publicationForm.selectType" },
  { value: "journal_article", labelKey: "professor.dashboard.publicationForm.journalArticle" },
  { value: "conference_paper", labelKey: "professor.dashboard.publicationForm.conferencePaper" },
  { value: "book", labelKey: "professor.dashboard.publicationForm.book" },
];

const PROFESSOR_STATUS_OPTIONS = [
  { value: "draft", label: "Në draft" },
  { value: "submitted", label: "Dorëzuar" },
];

const REVIEW_STATUS_OPTIONS = [
  ...PROFESSOR_STATUS_OPTIONS,
  { value: "in_review", label: "Në shqyrtim" },
  { value: "approved", label: "Aprovuar" },
  { value: "rejected", label: "Refuzuar" },
];

const INDEXING_PLATFORM_OPTIONS = ["", "Scopus", "Web of Science", "SCIE", "SSCI", "AHCI", "Other"];
const INDEXING_CATEGORY_OPTIONS = ["", "Q1", "Q2", "Q3", "Q4", "SCIE", "SSCI", "AHCI", "Book/Chapter", "Other"];

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
  status: "draft",
  authors: [],
  indexing: [],
  evidenceLinks: [],
  metadataSource: "manual",
  metadataVerified: false,
  externalMetadataId: "",
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
      isCorrespondingAuthor: correspondingAuthorIndex >= 0 ? index === correspondingAuthorIndex : index === 0,
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

function supportsQuartile(publicationType) {
  return publicationType === "journal_article";
}

function normalizeIndexingPlatform(value) {
  const text = String(value || "").trim();
  const comparable = text.toLowerCase();

  if (!text) return "";
  if (comparable.includes("scopus") || comparable.includes("citescore") || comparable.includes("scimago")) return "Scopus";
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

  return INDEXING_CATEGORY_OPTIONS.includes(text) ? text : "";
}

export function publicationToDraft(publication = {}) {
  const publicationType = publication.publicationType || publication.publication_type || "";
  const normalizedAuthors = Array.isArray(publication.authors) ? normalizePublicationAuthors(publication.authors) : [];
  const indexing = Array.isArray(publication.indexing) && publication.indexing.length ? publication.indexing.map((item) => ({
    source: item.source || "",
    quartile: item.quartile || "",
    impactFactor: item.impactFactor || item.impact_factor || "",
    indexedUrl: item.indexedUrl || item.indexed_url || "",
  })) : publication.quartile ? [{ source: "Scopus", quartile: publication.quartile, impactFactor: "", indexedUrl: "" }] : [];

  return {
    ...createEmptyPublicationDraft(),
    title: publication.title || "",
    abstract: publication.abstract || "",
    publicationType,
    venue: publication.venue
      || publication.publishedIn
      || publication.published_in
      || publication.journal
      || publication.containerTitle
      || publication.container_title
      || "",
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
    indexingPlatform: normalizeIndexingPlatform(publication.indexingPlatform || publication.indexing_platform || indexing.find((item) => item?.source)?.source),
    indexingCategory: normalizeIndexingCategory(publication.indexingCategory || publication.indexing_category || publication.quartile || publication.indexing?.find?.((item) => item?.quartile)?.quartile),
    quartile: supportsQuartile(publicationType) ? publication.quartile || publication.indexing?.find?.((item) => item?.quartile)?.quartile || "" : "",
    status: publication.status || "draft",
    authors: normalizedAuthors,
    indexing: supportsQuartile(publicationType) ? indexing : [],
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
      ?? (index === mainAuthorIndex)
    ),
  };
}

function metadataToDraft(metadata = {}, currentUserAuthor = {}) {
  const authors = Array.isArray(metadata.authors) ? metadata.authors : [];
  const publicationType = normalizeDoiType(metadata.type);
  const supportsMetadataQuartile = supportsQuartile(publicationType);
  const indexing = supportsMetadataQuartile && Array.isArray(metadata.indexing) ? metadata.indexing : [];
  const quartile = supportsMetadataQuartile ? metadata.quartile || indexing.find((item) => item?.quartile)?.quartile || "" : "";
  const indexingPlatform = normalizeIndexingPlatform(metadata.indexingPlatform || metadata.indexing_platform || indexing.find((item) => item?.source)?.source);
  const indexingCategory = normalizeIndexingCategory(metadata.indexingCategory || metadata.indexing_category || quartile);
  const matchedAuthorIndex = authors.findIndex((author) => {
    const normalizedAuthor = typeof author === "string" ? { fullName: author } : author || {};
    const fullName = normalizedAuthor.fullName || normalizedAuthor.full_name || normalizedAuthor.name || "";
    return currentUserAuthor.name && normalizeName(fullName) === normalizeName(currentUserAuthor.name);
  });
  const mainAuthorIndex = matchedAuthorIndex >= 0 ? matchedAuthorIndex : 0;
  const draftAuthors = authors.map((author, index) => metadataAuthorToDraft(author, index, currentUserAuthor, mainAuthorIndex));
  const hasCorrespondingAuthor = draftAuthors.some((author) => author.isCorrespondingAuthor);

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
    authors: hasCorrespondingAuthor
      ? draftAuthors
      : draftAuthors.map((author, index) => ({
        ...author,
        isCorrespondingAuthor: index === mainAuthorIndex,
      })),
    indexing: indexing.length ? indexing.map((item, index) => ({
      source: item.source || (index === 0 ? indexingPlatform : ""),
      quartile: item.quartile || (index === 0 ? indexingCategory : ""),
      impactFactor: item.impactFactor || item.impact_factor || "",
      indexedUrl: item.indexedUrl || item.indexed_url || "",
    })) : indexingPlatform || indexingCategory ? [{ source: indexingPlatform, quartile: indexingCategory, impactFactor: "", indexedUrl: "" }] : [],
    metadataSource: "doi",
    metadataVerified: true,
    externalMetadataId: metadata.doi || "",
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
  canReview = false,
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
  const showIssueField = !isDoiImported || hasValue("issue");
  const showIdentifierField = !isDoiImported || hasValue("issn") || hasValue("isbn");
  const showIssnInput = !isDoiImported || hasValue("issn");
  const showIsbnInput = !isDoiImported || hasValue("isbn");
  const showAbstractField = !isDoiImported || hasValue("abstract");
  const publishedValue = formatPublishedValue(value.publicationDate, value.publicationYear);
  const isAbstractExpandable = String(value.abstract || "").trim().length > 260;
  const abstractRows = isAbstractExpandable && !isAbstractExpanded ? 3 : 6;
  const primaryIndexing = Array.isArray(value.indexing) && value.indexing.length ? value.indexing[0] : {};

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
    const nextAuthors = (value.authors || []).map((author, authorIndex) => {
      return authorIndex === index ? { ...author, [field]: nextValue } : author;
    });

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
      authors: [
        ...authors,
        { ...EMPTY_AUTHOR },
      ],
    });
    setFormError("");
  };

  const setPrimaryAuthorName = (fullName) => {
    const authors = value.authors || [];
    const nextAuthors = authors.length
      ? authors.map((author, index) => (index === 0 ? {
        ...author,
        fullName,
        affiliation: value.authorAffiliation || author.affiliation || "",
        isCorrespondingAuthor: true,
      } : {
        ...author,
        isCorrespondingAuthor: false,
      }))
      : [{
        ...EMPTY_AUTHOR,
        fullName,
        affiliation: value.authorAffiliation || "",
        isCorrespondingAuthor: true,
      }];

    onChange({
      ...value,
      authors: nextAuthors,
      metadataSource: value.metadataSource === "doi" ? "mixed" : value.metadataSource,
    });
    setFormError("");
  };

  const updateAuthorAffiliation = (event) => {
    const authorAffiliation = event.target.value;
    const authors = value.authors || [];
    const nextAuthors = authors.length
      ? authors.map((author, index) => (index === 0 ? { ...author, affiliation: authorAffiliation } : author))
      : [{ ...EMPTY_AUTHOR, affiliation: authorAffiliation, isCorrespondingAuthor: true }];

    onChange({
      ...value,
      authorAffiliation,
      authors: nextAuthors,
      metadataSource: value.metadataSource === "doi" ? "mixed" : value.metadataSource,
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
    const nextPlatform = field === "indexingPlatform" ? nextValue : value.indexingPlatform || primaryIndexing.source || "";
    const nextCategory = field === "indexingCategory" ? nextValue : value.indexingCategory || value.quartile || primaryIndexing.quartile || "";
    const nextFirstIndexing = {
      ...firstIndexing,
      source: nextPlatform,
      quartile: nextCategory,
    };
    const nextIndexing = nextFirstIndexing.source || nextFirstIndexing.quartile || nextFirstIndexing.impactFactor || nextFirstIndexing.indexedUrl
      ? [nextFirstIndexing, ...restIndexing]
      : restIndexing;

    onChange({
      ...value,
      [field]: nextValue,
      quartile: field === "indexingCategory" && /^Q[1-4]$/.test(nextValue) ? nextValue : value.quartile,
      indexing: nextIndexing,
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
        status: canReview ? value.status || "draft" : PROFESSOR_STATUS_OPTIONS.some((item) => item.value === value.status) ? value.status : "draft",
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

    if (!String(value.authorAffiliation || primaryAuthor.affiliation || "").trim()) {
      setFormError(t("professor.dashboard.publicationForm.affiliationRequired"));
      return;
    }

    if (!String(value.indexingPlatform || primaryIndexing.source || "").trim()) {
      setFormError(t("professor.dashboard.publicationForm.indexingPlatformRequired"));
      return;
    }

    if (!String(value.indexingCategory || primaryIndexing.quartile || "").trim()) {
      setFormError(t("professor.dashboard.publicationForm.indexingCategoryRequired"));
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
  const primaryAuthor = authors[0] || EMPTY_AUTHOR;
  const coauthors = authors.slice(1);
  const venuePlaceholder = value.publicationType === "conference_paper"
    ? "IEEE International Conference on Computer Vision"
    : value.publicationType === "book"
      ? "Lecture Notes in Computer Science"
      : "Journal of Artificial Intelligence Research";

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
          <input value={value.title} onChange={updateField("title")} required readOnly={isDoiImported} />
        </label>
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.publicationType")}</span>
          <select value={value.publicationType} onChange={updateField("publicationType")} disabled={isDoiImported}>
            {PUBLICATION_TYPES.map((type) => <option key={type.value} value={type.value}>{t(type.labelKey)}</option>)}
          </select>
        </label>
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.publishedIn")}</span>
          <input value={value.venue} onChange={updateField("venue")} placeholder={venuePlaceholder} required readOnly={isDoiImported && hasValue("venue")} />
        </label>
        {value.publicationType === "conference_paper" ? (
          <label className="prof-form-field">
            <span>{t("professor.dashboard.publicationForm.conferenceLocation")}</span>
            <input
              value={value.conferenceLocation || ""}
              onChange={updateField("conferenceLocation")}
              placeholder="Berlin, Germany"
              required
              readOnly={isDoiImported && hasValue("conferenceLocation")}
            />
          </label>
        ) : null}
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.publisher")}</span>
          <input value={value.publisher} onChange={updateField("publisher")} readOnly={isDoiImported} />
        </label>
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.publishedAt")}</span>
          <input
            value={publishedValue}
            onChange={updatePublishedField}
            placeholder={t("professor.dashboard.publicationForm.publishedAtPlaceholder")}
            readOnly={isDoiImported}
          />
        </label>
        {showVolumeField ? (
          <label className="prof-form-field">
            <span>{t("professor.dashboard.publicationForm.volume")}</span>
            <input value={value.volume} onChange={updateField("volume")} readOnly={isDoiImported} />
          </label>
        ) : null}
        {showIssueField ? (
          <label className="prof-form-field">
            <span>{t("professor.dashboard.publicationForm.issue")}</span>
            <input value={value.issue} onChange={updateField("issue")} readOnly={isDoiImported} />
          </label>
        ) : null}
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.pages")}</span>
          <input value={value.pages} onChange={updateField("pages")} readOnly={isDoiImported} />
        </label>
        <label className="prof-form-field reimbursement-wide">
          <span>{t("professor.dashboard.publicationForm.affiliation")}</span>
          <input
            value={value.authorAffiliation || primaryAuthor.affiliation || ""}
            onChange={updateAuthorAffiliation}
            placeholder={t("professor.dashboard.publicationForm.affiliationPlaceholder")}
            required
            readOnly={isDoiImported && Boolean(value.authorAffiliation || primaryAuthor.affiliation)}
          />
        </label>
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.indexingPlatform")}</span>
          <select
            value={value.indexingPlatform || primaryIndexing.source || ""}
            onChange={updateIndexingField("indexingPlatform")}
            required
            disabled={isDoiImported && Boolean(value.indexingPlatform || primaryIndexing.source)}
          >
            {INDEXING_PLATFORM_OPTIONS.map((option) => (
              <option key={option || "empty-platform"} value={option}>
                {option || t("professor.dashboard.publicationForm.selectIndexingPlatform")}
              </option>
            ))}
          </select>
        </label>
        <label className="prof-form-field">
          <span>{t("professor.dashboard.publicationForm.indexingCategory")}</span>
          <select
            value={value.indexingCategory || primaryIndexing.quartile || ""}
            onChange={updateIndexingField("indexingCategory")}
            required
            disabled={isDoiImported && Boolean(value.indexingCategory || primaryIndexing.quartile)}
          >
            {INDEXING_CATEGORY_OPTIONS.map((option) => (
              <option key={option || "empty-category"} value={option}>
                {option || t("professor.dashboard.publicationForm.selectIndexingCategory")}
              </option>
            ))}
            </select>
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
                  readOnly={isDoiImported}
                />
              ) : null}
              {showIsbnInput ? (
                <input
                  value={value.isbn}
                  onChange={updateField("isbn")}
                  placeholder="ISBN"
                  aria-label="ISBN"
                  readOnly={isDoiImported}
                />
              ) : null}
            </div>
          </div>
        ) : null}
        {showAbstractField ? (
          <label className="prof-form-field reimbursement-wide publication-abstract-field">
            <span>{t("professor.dashboard.publicationForm.abstract")}</span>
            <textarea value={value.abstract} onChange={updateField("abstract")} rows={abstractRows} readOnly={isDoiImported} />
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
        <div className={`publication-authors-list ${isDoiImported ? "publication-authors-list--readonly" : ""}`} role="group" aria-label={t("professor.dashboard.publicationForm.authorsListAria")}>
          <label className="publication-author-field">
            <span>{t("professor.dashboard.publicationForm.author")}</span>
            <input
              value={primaryAuthor.fullName}
              onChange={(event) => setPrimaryAuthorName(event.target.value)}
              placeholder={t("professor.dashboard.publicationForm.fullNamePlaceholder")}
              required
              readOnly={isDoiImported}
            />
          </label>

          <div className="publication-coauthors-block">
            <div className="publication-coauthors-header">
              <span>{t("professor.dashboard.publicationForm.coauthors")}</span>
              {!isDoiImported ? (
                <button type="button" className="publication-add-coauthor" onClick={addAuthor}>
                  <Plus size={14} aria-hidden="true" />
                  {t("professor.dashboard.publicationForm.addCoauthor")}
                </button>
              ) : null}
            </div>

            {coauthors.length ? (
              <div className="publication-coauthors-list">
                {coauthors.map((author, index) => {
                  const authorIndex = index + 1;

                  return (
                    <div className="publication-coauthor-row" key={`coauthor-${authorIndex}`}>
                      <input
                        value={author.fullName}
                        onChange={(event) => setAuthorField(authorIndex, "fullName", event.target.value)}
                        placeholder={t("professor.dashboard.publicationForm.fullNamePlaceholder")}
                        readOnly={isDoiImported}
                      />
                      {!isDoiImported ? (
                        <button
                          type="button"
                          className="publication-remove-button"
                          onClick={() => removeAuthor(authorIndex)}
                          aria-label={t("professor.dashboard.publicationForm.removeCoauthor", { index: index + 1 })}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          <span>{t("professor.dashboard.publicationForm.remove")}</span>
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="publication-empty-coauthors">{t("professor.dashboard.publicationForm.noCoauthors")}</p>
            )}
          </div>
        </div>
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
