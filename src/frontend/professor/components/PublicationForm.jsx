import React, { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { apiUrl } from "../../utils/api";
import { useLanguage } from "../../i18n/LanguageContext";

export const PUBLICATION_TYPES = [
  { value: "", label: "Select type" },
  { value: "journal_article", label: "Journal article" },
  { value: "conference_paper", label: "Conference paper" },
  { value: "book", label: "Book" },
  { value: "chapter", label: "Chapter" },
  { value: "accepted_in_press", label: "Accepted / in press" },
];

const PROFESSOR_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
];

const REVIEW_STATUS_OPTIONS = [
  ...PROFESSOR_STATUS_OPTIONS,
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export const createEmptyPublicationDraft = () => ({
  title: "",
  abstract: "",
  publicationType: "",
  venue: "",
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
  status: "draft",
  authors: [],
  indexing: [],
  evidenceLinks: [],
  metadataSource: "manual",
  metadataVerified: false,
  externalMetadataId: "",
});

export function publicationToDraft(publication = {}) {
  return {
    ...createEmptyPublicationDraft(),
    title: publication.title || "",
    abstract: publication.abstract || "",
    publicationType: publication.publicationType || publication.publication_type || "",
    venue: publication.venue || publication.journal || "",
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
    status: publication.status || "draft",
    authors: Array.isArray(publication.authors) ? publication.authors.map((author) => ({
      fullName: author.fullName || author.full_name || "",
      givenName: author.givenName || author.given_name || "",
      familyName: author.familyName || author.family_name || "",
      orcid: author.orcid || "",
      affiliation: author.affiliation || "",
      isMainAuthor: Boolean(author.isMainAuthor ?? author.is_main_author),
      isCorrespondingAuthor: Boolean(author.isCorrespondingAuthor ?? author.is_corresponding_author),
    })) : [],
    indexing: Array.isArray(publication.indexing) ? publication.indexing.map((item) => ({
      source: item.source || "",
      quartile: item.quartile || "",
      impactFactor: item.impactFactor || item.impact_factor || "",
      indexedUrl: item.indexedUrl || item.indexed_url || "",
    })) : [],
    evidenceLinks: (Array.isArray(publication.evidenceLinks) ? publication.evidenceLinks : publication.attachments || []).map((item) => ({
      url: item.url || item.fileUrl || item.file_url || "",
      label: item.label || item.fileType || item.file_type || "",
      uploadedAt: (item.uploadedAt || item.uploaded_at || "").slice(0, 10),
    })),
    metadataSource: publication.metadataSource || publication.metadata_source || "manual",
    metadataVerified: Boolean(publication.metadataVerified ?? publication.metadata_verified),
    externalMetadataId: publication.externalMetadataId || publication.external_metadata_id || "",
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
    book_chapter: "chapter",
    chapter: "chapter",
    posted_content: "accepted_in_press",
    preprint: "accepted_in_press",
  };

  return map[normalized] || "";
}

function metadataToDraft(metadata = {}) {
  return {
    title: metadata.title || "",
    abstract: metadata.abstract || "",
    publicationType: normalizeDoiType(metadata.type),
    venue: metadata.container_title || "",
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
    authors: Array.isArray(metadata.authors)
      ? metadata.authors.map((name) => ({ fullName: name, givenName: "", familyName: "", orcid: "", affiliation: "", isMainAuthor: false, isCorrespondingAuthor: false }))
      : [],
    metadataSource: "doi",
    metadataVerified: true,
    externalMetadataId: metadata.doi || "",
  };
}

function metadataBadgeLabel(source, verified) {
  if (source === "doi" && verified) return "DOI imported";
  if (source === "mixed") return "Mixed / manual override";
  return "Manual";
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
}) => {
  const { t } = useLanguage();
  const [doiLookupValue, setDoiLookupValue] = useState(value.doi || "");
  const [doiMessage, setDoiMessage] = useState("");
  const [doiError, setDoiError] = useState("");
  const [isLookingUpDoi, setIsLookingUpDoi] = useState(false);

  const updateField = (field) => (event) => {
    const nextValue = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    onChange({
      ...value,
      [field]: nextValue,
      metadataSource: value.metadataSource === "doi" ? "mixed" : value.metadataSource,
    });
  };

  const setCollectionItem = (collection, index, field, nextValue) => {
    const nextCollection = (value[collection] || []).map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: nextValue } : item
    );
    onChange({ ...value, [collection]: nextCollection, metadataSource: value.metadataSource === "doi" ? "mixed" : value.metadataSource });
  };

  const addCollectionItem = (collection, item) => {
    onChange({ ...value, [collection]: [...(value[collection] || []), item] });
  };

  const removeCollectionItem = (collection, index) => {
    onChange({ ...value, [collection]: (value[collection] || []).filter((_, itemIndex) => itemIndex !== index) });
  };

  const lookupDoi = async () => {
    const doi = doiLookupValue.trim() || value.doi.trim();

    if (!doi) {
      setDoiError("Enter a DOI to prefill metadata, or continue manually.");
      return;
    }

    setIsLookingUpDoi(true);
    setDoiError("");
    setDoiMessage("");

    try {
      const response = await fetch(apiUrl(`/doi/${encodeURIComponent(doi)}`));
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.data) {
        throw new Error(result.message || "DOI metadata could not be loaded. You can continue manually.");
      }

      onChange({
        ...value,
        ...metadataToDraft(result.data),
        status: canReview ? value.status || "draft" : PROFESSOR_STATUS_OPTIONS.some((item) => item.value === value.status) ? value.status : "draft",
      });
      setDoiLookupValue(result.data.doi || doi);
      setDoiMessage("Metadata loaded. Review and edit fields before saving.");
    } catch (error) {
      setDoiError(error.message || "DOI lookup failed. You can continue manually.");
      onChange({ ...value, doi, metadataSource: "manual", metadataVerified: false });
    } finally {
      setIsLookingUpDoi(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    onSubmit();
  };

  const statusOptions = canReview ? REVIEW_STATUS_OPTIONS : PROFESSOR_STATUS_OPTIONS;

  return (
    <form className="publication-form" onSubmit={submit}>
      <div className="publication-form-toolbar">
        <div>
          <span className={`publication-source-badge publication-source-badge--${value.metadataSource || "manual"}`}>
            {metadataBadgeLabel(value.metadataSource, value.metadataVerified)}
          </span>
        </div>
        <div className="publication-doi-lookup">
          <input
            value={doiLookupValue}
            onChange={(event) => setDoiLookupValue(event.target.value)}
            placeholder="10.xxxx/xxxxx"
            disabled={isLookingUpDoi || submitting}
          />
          <button type="button" className="prof-btn-secondary" onClick={lookupDoi} disabled={isLookingUpDoi || submitting}>
            <Search size={15} />
            {isLookingUpDoi ? t("common.loading") : "Prefill from DOI"}
          </button>
        </div>
      </div>

      {doiMessage ? <p className="publication-form-message success">{doiMessage}</p> : null}
      {doiError ? <p className="publication-form-message error">{doiError}</p> : null}

      <div className="prof-form-grid">
        <label className="prof-form-field reimbursement-wide">
          <span>Title</span>
          <input value={value.title} onChange={updateField("title")} required />
        </label>
        <label className="prof-form-field">
          <span>Publication type</span>
          <select value={value.publicationType} onChange={updateField("publicationType")}>
            {PUBLICATION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label className="prof-form-field">
          <span>Status</span>
          <select value={value.status} onChange={updateField("status")}>
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.value === "draft" ? t("professor.dashboard.draft") : status.label}
              </option>
            ))}
          </select>
        </label>
        <label className="prof-form-field">
          <span>DOI</span>
          <input value={value.doi} onChange={updateField("doi")} placeholder="Optional" />
        </label>
        <label className="prof-form-field">
          <span>Venue / Journal / Conference</span>
          <input value={value.venue} onChange={updateField("venue")} />
        </label>
        <label className="prof-form-field">
          <span>Publisher</span>
          <input value={value.publisher} onChange={updateField("publisher")} />
        </label>
        <label className="prof-form-field">
          <span>Publication date</span>
          <input type="date" value={value.publicationDate} onChange={updateField("publicationDate")} />
        </label>
        <label className="prof-form-field">
          <span>Publication year</span>
          <input value={value.publicationYear} onChange={updateField("publicationYear")} inputMode="numeric" />
        </label>
        <label className="prof-form-field">
          <span>Source URL</span>
          <input value={value.sourceUrl} onChange={updateField("sourceUrl")} placeholder="https://..." />
        </label>
        <label className="prof-form-field">
          <span>Volume</span>
          <input value={value.volume} onChange={updateField("volume")} />
        </label>
        <label className="prof-form-field">
          <span>Issue</span>
          <input value={value.issue} onChange={updateField("issue")} />
        </label>
        <label className="prof-form-field">
          <span>Pages</span>
          <input value={value.pages} onChange={updateField("pages")} />
        </label>
        <label className="prof-form-field">
          <span>ISSN</span>
          <input value={value.issn} onChange={updateField("issn")} />
        </label>
        <label className="prof-form-field">
          <span>ISBN</span>
          <input value={value.isbn} onChange={updateField("isbn")} />
        </label>
        <label className="prof-form-field reimbursement-wide">
          <span>Abstract</span>
          <textarea value={value.abstract} onChange={updateField("abstract")} rows={4} />
        </label>
      </div>

      <div className="publication-form-section">
        <div className="publication-form-section-header">
          <h4>Authors</h4>
          <button type="button" className="prof-btn-secondary" onClick={() => addCollectionItem("authors", { fullName: "", givenName: "", familyName: "", orcid: "", affiliation: "", isMainAuthor: false, isCorrespondingAuthor: false })}>
            <Plus size={15} /> Add author
          </button>
        </div>
        {value.authors.map((author, index) => (
          <div className="publication-nested-row" key={`author-${index}`}>
            <input value={author.fullName} onChange={(event) => setCollectionItem("authors", index, "fullName", event.target.value)} placeholder="Full name" />
            <input value={author.orcid} onChange={(event) => setCollectionItem("authors", index, "orcid", event.target.value)} placeholder="ORCID" />
            <input value={author.affiliation} onChange={(event) => setCollectionItem("authors", index, "affiliation", event.target.value)} placeholder="Affiliation" />
            <label><input type="checkbox" checked={author.isMainAuthor} onChange={(event) => setCollectionItem("authors", index, "isMainAuthor", event.target.checked)} /> Main</label>
            <label><input type="checkbox" checked={author.isCorrespondingAuthor} onChange={(event) => setCollectionItem("authors", index, "isCorrespondingAuthor", event.target.checked)} /> Corresponding</label>
            <button type="button" className="prof-btn-secondary" onClick={() => removeCollectionItem("authors", index)} aria-label="Remove author"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <div className="publication-form-section">
        <div className="publication-form-section-header">
          <h4>Indexing</h4>
          <button type="button" className="prof-btn-secondary" onClick={() => addCollectionItem("indexing", { source: "", quartile: "", impactFactor: "", indexedUrl: "" })}>
            <Plus size={15} /> Add indexing
          </button>
        </div>
        {value.indexing.map((item, index) => (
          <div className="publication-nested-row" key={`indexing-${index}`}>
            <input value={item.source} onChange={(event) => setCollectionItem("indexing", index, "source", event.target.value)} placeholder="Source" />
            <input value={item.quartile} onChange={(event) => setCollectionItem("indexing", index, "quartile", event.target.value)} placeholder="Quartile" />
            <input value={item.impactFactor} onChange={(event) => setCollectionItem("indexing", index, "impactFactor", event.target.value)} placeholder="Impact factor" />
            <input value={item.indexedUrl} onChange={(event) => setCollectionItem("indexing", index, "indexedUrl", event.target.value)} placeholder="Indexed URL" />
            <button type="button" className="prof-btn-secondary" onClick={() => removeCollectionItem("indexing", index)} aria-label="Remove indexing"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <div className="publication-form-section">
        <div className="publication-form-section-header">
          <h4>Evidence links</h4>
          <button type="button" className="prof-btn-secondary" onClick={() => addCollectionItem("evidenceLinks", { url: "", label: "", uploadedAt: "" })}>
            <Plus size={15} /> Add evidence
          </button>
        </div>
        {(value.evidenceLinks || []).map((item, index) => (
          <div className="publication-nested-row" key={`evidence-${index}`}>
            <input value={item.url} onChange={(event) => setCollectionItem("evidenceLinks", index, "url", event.target.value)} placeholder="Evidence URL (https://...)" />
            <input value={item.label} onChange={(event) => setCollectionItem("evidenceLinks", index, "label", event.target.value)} placeholder="Label / type" />
            <input type="date" value={item.uploadedAt} onChange={(event) => setCollectionItem("evidenceLinks", index, "uploadedAt", event.target.value)} />
            <button type="button" className="prof-btn-secondary" onClick={() => removeCollectionItem("evidenceLinks", index)} aria-label="Remove evidence"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <div className="prof-modal-actions">
        {onCancel ? <button type="button" className="prof-btn-secondary" onClick={onCancel} disabled={submitting}>{t("common.cancel")}</button> : null}
        <button type="submit" className="prof-btn-primary" disabled={submitting}>
          {submitting ? t("common.loading") : submitLabel || (mode === "edit" ? "Save changes" : "Save publication")}
        </button>
      </div>
    </form>
  );
};

export default PublicationForm;
