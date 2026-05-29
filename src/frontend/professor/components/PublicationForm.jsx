import React, { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { apiUrl } from "../../utils/api";
import { useLanguage } from "../../i18n/LanguageContext";

export const PUBLICATION_TYPES = [
  { value: "", label: "Select type" },
  { value: "journal_article", label: "Journal Article" },
  { value: "conference_paper", label: "Conference Paper" },
  { value: "book", label: "Book / Chapter" },
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

function normalizePublicationAuthors(authors = []) {
  const normalizedAuthors = authors.map((author) => (typeof author === "string" ? { fullName: author } : author || {}));
  const mainAuthorIndex = normalizedAuthors.findIndex((author) => Boolean(author.isMainAuthor ?? author.is_main_author));
  const correspondingAuthorIndex = normalizedAuthors.findIndex((author) => Boolean(author.isCorrespondingAuthor ?? author.is_corresponding_author));

  return normalizedAuthors.map((normalizedAuthor, index) => {
    return {
      fullName: normalizedAuthor.fullName || normalizedAuthor.full_name || normalizedAuthor.name || "",
      givenName: normalizedAuthor.givenName || normalizedAuthor.given_name || "",
      familyName: normalizedAuthor.familyName || normalizedAuthor.family_name || "",
      orcid: normalizedAuthor.orcid || "",
      affiliation: normalizedAuthor.affiliation || "",
      authorOrder: normalizedAuthor.authorOrder || normalizedAuthor.author_order || index + 1,
      isMainAuthor: mainAuthorIndex >= 0 ? index === mainAuthorIndex : index === 0,
      isCorrespondingAuthor: correspondingAuthorIndex >= 0 ? index === correspondingAuthorIndex : false,
    };
  });
}

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
    authors: Array.isArray(publication.authors) ? normalizePublicationAuthors(publication.authors) : [],
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
    affiliation: normalizedAuthor.affiliation || (matchesCurrentUser ? currentUserAuthor.affiliation : "") || "",
    authorOrder: index + 1,
    isMainAuthor: index === mainAuthorIndex,
    isCorrespondingAuthor: Boolean(normalizedAuthor.isCorrespondingAuthor ?? normalizedAuthor.is_corresponding_author),
  };
}

function metadataToDraft(metadata = {}, currentUserAuthor = {}) {
  const authors = Array.isArray(metadata.authors) ? metadata.authors : [];
  const matchedAuthorIndex = authors.findIndex((author) => {
    const normalizedAuthor = typeof author === "string" ? { fullName: author } : author || {};
    const fullName = normalizedAuthor.fullName || normalizedAuthor.full_name || normalizedAuthor.name || "";
    return currentUserAuthor.name && normalizeName(fullName) === normalizeName(currentUserAuthor.name);
  });
  const mainAuthorIndex = matchedAuthorIndex >= 0 ? matchedAuthorIndex : 0;

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
    authors: authors.map((author, index) => metadataAuthorToDraft(author, index, currentUserAuthor, mainAuthorIndex)),
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
  const isDoiImported = value.metadataSource === "doi" && value.metadataVerified;

  const updateField = (field) => (event) => {
    const nextValue = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    onChange({
      ...value,
      [field]: nextValue,
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
      ? authors.map((author, index) => (index === 0 ? { ...author, fullName } : author))
      : [{ ...EMPTY_AUTHOR, fullName }];

    onChange({
      ...value,
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

  const lookupDoi = async () => {
    const doi = doiLookupValue.trim() || value.doi.trim();

    if (!doi) {
      setDoiError("Shënoni DOI për t'i marrë metadatat, ose vazhdoni manualisht.");
      return;
    }

    setIsLookingUpDoi(true);
    setDoiError("");

    try {
      const response = await fetch(apiUrl(`/doi/${encodeURIComponent(doi)}`));
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.data) {
        throw new Error(result.message || "Metadatat për DOI nuk mund të ngarkohen. Mund të vazhdoni manualisht.");
      }

      onChange({
        ...value,
        ...metadataToDraft(result.data, currentUserAuthor),
        status: canReview ? value.status || "draft" : PROFESSOR_STATUS_OPTIONS.some((item) => item.value === value.status) ? value.status : "draft",
      });
      setDoiLookupValue(result.data.doi || doi);
    } catch (error) {
      setDoiError(error.message || "Kërkimi i DOI dështoi. Mund të vazhdoni manualisht.");
      onChange({ ...value, doi, metadataSource: "manual", metadataVerified: false });
    } finally {
      setIsLookingUpDoi(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    const validAuthors = (value.authors || []).filter((author) => String(author.fullName || "").trim());

    if (!validAuthors.length) {
      setFormError("Shto se paku një autor me emër të plotë.");
      return;
    }

    setFormError("");
    onSubmit();
  };

  const authors = value.authors || [];
  const primaryAuthor = authors[0] || EMPTY_AUTHOR;
  const coauthors = authors.slice(1);

  return (
    <form className="publication-form" onSubmit={submit}>
      <div className="publication-form-toolbar">
        <div className="publication-doi-lookup">
          <input
            value={doiLookupValue}
            onChange={(event) => setDoiLookupValue(event.target.value)}
            placeholder="10.xxxx/xxxxx"
            aria-label="DOI për kërkim automatik"
            disabled={isLookingUpDoi || submitting}
          />
          <button type="button" className="prof-btn-secondary" onClick={lookupDoi} disabled={isLookingUpDoi || submitting}>
            <Search size={15} />
            {isLookingUpDoi ? t("common.loading") : "Merr metadata"}
          </button>
        </div>
      </div>

      {doiError ? <p className="publication-form-message error">{doiError}</p> : null}

      <div className="prof-form-grid">
        <label className="prof-form-field reimbursement-wide">
          <span>Titulli i publikimit</span>
          <input value={value.title} onChange={updateField("title")} required readOnly={isDoiImported} />
        </label>
        <label className="prof-form-field">
          <span>Tipi i publikimit</span>
          <select value={value.publicationType} onChange={updateField("publicationType")} disabled={isDoiImported}>
            {PUBLICATION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label className="prof-form-field">
          <span>DOI</span>
          <input value={value.doi} onChange={updateField("doi")} placeholder="Opsionale" readOnly={isDoiImported} />
        </label>
        <label className="prof-form-field">
          <span>Revista / Konferenca / Botimi</span>
          <input value={value.venue} onChange={updateField("venue")} readOnly={isDoiImported} />
        </label>
        <label className="prof-form-field">
          <span>Botuesi</span>
          <input value={value.publisher} onChange={updateField("publisher")} readOnly={isDoiImported} />
        </label>
        <label className="prof-form-field">
          <span>Data e publikimit</span>
          <input type="date" value={value.publicationDate} onChange={updateField("publicationDate")} readOnly={isDoiImported} />
        </label>
        <label className="prof-form-field">
          <span>Viti i publikimit</span>
          <input value={value.publicationYear} onChange={updateField("publicationYear")} inputMode="numeric" readOnly={isDoiImported} />
        </label>
        <label className="prof-form-field">
          <span>Vëllimi</span>
          <input value={value.volume} onChange={updateField("volume")} readOnly={isDoiImported} />
        </label>
        <label className="prof-form-field">
          <span>Numri i artikullit</span>
          <input value={value.issue} onChange={updateField("issue")} readOnly={isDoiImported} />
        </label>
        <label className="prof-form-field">
          <span>Faqet</span>
          <input value={value.pages} onChange={updateField("pages")} readOnly={isDoiImported} />
        </label>
        <div className="prof-form-field publication-identifier-field">
          <span>ISSN / ISBN</span>
          <div className="publication-identifier-inputs">
            <input
              value={value.issn}
              onChange={updateField("issn")}
              placeholder="ISSN"
              aria-label="ISSN"
              readOnly={isDoiImported}
            />
            <input
              value={value.isbn}
              onChange={updateField("isbn")}
              placeholder="ISBN"
              aria-label="ISBN"
              readOnly={isDoiImported}
            />
          </div>
        </div>
        <label className="prof-form-field reimbursement-wide">
          <span>Abstrakti</span>
          <textarea value={value.abstract} onChange={updateField("abstract")} rows={4} readOnly={isDoiImported} />
        </label>
      </div>

      <div className="publication-form-section">
        <div className="publication-form-section-header">
          <div>
            <h4>Autorët dhe Bashkautorët</h4>
            <p>Shto autorët që kanë kontribuar në këtë publikim shkencor.</p>
          </div>
        </div>
        <div className={`publication-authors-list ${isDoiImported ? "publication-authors-list--readonly" : ""}`} role="group" aria-label="Lista e autorëve">
          <label className="publication-author-field">
            <span>Autori</span>
            <input
              value={primaryAuthor.fullName}
              onChange={(event) => setPrimaryAuthorName(event.target.value)}
              placeholder="Emri i plotë"
              required
              readOnly={isDoiImported}
            />
          </label>

          <div className="publication-coauthors-block">
            <div className="publication-coauthors-header">
              <span>Bashkautorët</span>
              {!isDoiImported ? (
                <button type="button" className="publication-add-coauthor" onClick={addAuthor}>
                  <Plus size={14} aria-hidden="true" />
                  Shto bashkautor
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
                        placeholder="Emri i plotë"
                        readOnly={isDoiImported}
                      />
                      {!isDoiImported ? (
                        <button
                          type="button"
                          className="publication-remove-button"
                          onClick={() => removeAuthor(authorIndex)}
                          aria-label={`Largo bashkautorin ${index + 1}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          <span>Largo</span>
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="publication-empty-coauthors">Nuk ka bashkautorë të shtuar.</p>
            )}
          </div>
        </div>
        {formError ? <p className="publication-form-message error" role="alert">{formError}</p> : null}
      </div>

      <div className="prof-modal-actions">
        {onCancel ? <button type="button" className="prof-btn-secondary" onClick={onCancel} disabled={submitting}>{t("common.cancel")}</button> : null}
        <button type="submit" className="prof-btn-primary" disabled={submitting}>
          {submitting ? t("common.loading") : submitLabel || (mode === "edit" ? "Ruaj ndryshimet" : "Ruaj publikimin")}
        </button>
      </div>
    </form>
  );
};

export default PublicationForm;
