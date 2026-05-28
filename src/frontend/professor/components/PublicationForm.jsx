import React, { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { apiUrl } from "../../utils/api";
import { useLanguage } from "../../i18n/LanguageContext";

export const PUBLICATION_TYPES = [
  { value: "", label: "Zgjidh tipin" },
  { value: "journal_article", label: "Artikull në revistë" },
  { value: "conference_paper", label: "Punim konference" },
  { value: "book", label: "Libër" },
  { value: "chapter", label: "Kapitull libri" },
  { value: "accepted_in_press", label: "I pranuar / në botim" },
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
  isMainAuthor: false,
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
  let hasMainAuthor = false;
  let hasCorrespondingAuthor = false;

  return authors.map((author) => {
    const isMainAuthor = Boolean(author.isMainAuthor ?? author.is_main_author) && !hasMainAuthor;
    const isCorrespondingAuthor = Boolean(author.isCorrespondingAuthor ?? author.is_corresponding_author) && !hasCorrespondingAuthor;

    if (isMainAuthor) {
      hasMainAuthor = true;
    }

    if (isCorrespondingAuthor) {
      hasCorrespondingAuthor = true;
    }

    return {
      fullName: author.fullName || author.full_name || "",
      givenName: author.givenName || author.given_name || "",
      familyName: author.familyName || author.family_name || "",
      orcid: author.orcid || "",
      affiliation: author.affiliation || "",
      isMainAuthor,
      isCorrespondingAuthor,
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
      ? metadata.authors.map((name, index) => ({ ...EMPTY_AUTHOR, fullName: name, isMainAuthor: index === 0 }))
      : [],
    metadataSource: "doi",
    metadataVerified: true,
    externalMetadataId: metadata.doi || "",
  };
}

function metadataBadgeLabel(source, verified) {
  if (source === "doi" && verified) return "Importuar nga DOI";
  if (source === "mixed") return "DOI me ndryshime manuale";
  return "Manuale";
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
  const [formError, setFormError] = useState("");
  const [isLookingUpDoi, setIsLookingUpDoi] = useState(false);

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
      if ((field === "isMainAuthor" || field === "isCorrespondingAuthor") && nextValue) {
        return {
          ...author,
          [field]: authorIndex === index,
        };
      }

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
        {
          ...EMPTY_AUTHOR,
          isMainAuthor: authors.length === 0,
        },
      ],
    });
    setFormError("");
  };

  const removeAuthor = (index) => {
    const nextAuthors = (value.authors || []).filter((_, authorIndex) => authorIndex !== index);

    if (nextAuthors.length && !nextAuthors.some((author) => author.isMainAuthor)) {
      nextAuthors[0] = { ...nextAuthors[0], isMainAuthor: true };
    }

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
    setDoiMessage("");

    try {
      const response = await fetch(apiUrl(`/doi/${encodeURIComponent(doi)}`));
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.data) {
        throw new Error(result.message || "Metadatat për DOI nuk mund të ngarkohen. Mund të vazhdoni manualisht.");
      }

      onChange({
        ...value,
        ...metadataToDraft(result.data),
        status: canReview ? value.status || "draft" : PROFESSOR_STATUS_OPTIONS.some((item) => item.value === value.status) ? value.status : "draft",
      });
      setDoiLookupValue(result.data.doi || doi);
      setDoiMessage("Metadatat u ngarkuan. Kontrolloni fushat para ruajtjes.");
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
            aria-label="DOI për kërkim automatik"
            disabled={isLookingUpDoi || submitting}
          />
          <button type="button" className="prof-btn-secondary" onClick={lookupDoi} disabled={isLookingUpDoi || submitting}>
            <Search size={15} />
            {isLookingUpDoi ? t("common.loading") : "Merr metadata"}
          </button>
        </div>
      </div>

      {doiMessage ? <p className="publication-form-message success">{doiMessage}</p> : null}
      {doiError ? <p className="publication-form-message error">{doiError}</p> : null}

      <div className="prof-form-grid">
        <label className="prof-form-field reimbursement-wide">
          <span>Titulli i publikimit</span>
          <input value={value.title} onChange={updateField("title")} required />
        </label>
        <label className="prof-form-field">
          <span>Tipi i publikimit</span>
          <select value={value.publicationType} onChange={updateField("publicationType")}>
            {PUBLICATION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label className="prof-form-field">
          <span>Status</span>
          <select value={value.status} onChange={updateField("status")}>
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label className="prof-form-field">
          <span>DOI</span>
          <input value={value.doi} onChange={updateField("doi")} placeholder="Opsionale" />
        </label>
        <label className="prof-form-field">
          <span>Revista / Konferenca / Botimi</span>
          <input value={value.venue} onChange={updateField("venue")} />
        </label>
        <label className="prof-form-field">
          <span>Botuesi</span>
          <input value={value.publisher} onChange={updateField("publisher")} />
        </label>
        <label className="prof-form-field">
          <span>Data e publikimit</span>
          <input type="date" value={value.publicationDate} onChange={updateField("publicationDate")} />
        </label>
        <label className="prof-form-field">
          <span>Viti i publikimit</span>
          <input value={value.publicationYear} onChange={updateField("publicationYear")} inputMode="numeric" />
        </label>
        <label className="prof-form-field">
          <span>Vegëza e publikimit</span>
          <input value={value.sourceUrl} onChange={updateField("sourceUrl")} placeholder="https://..." />
        </label>
        <label className="prof-form-field">
          <span>Vëllimi</span>
          <input value={value.volume} onChange={updateField("volume")} />
        </label>
        <label className="prof-form-field">
          <span>Numri</span>
          <input value={value.issue} onChange={updateField("issue")} />
        </label>
        <label className="prof-form-field">
          <span>Faqet</span>
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
          <span>Abstrakti</span>
          <textarea value={value.abstract} onChange={updateField("abstract")} rows={4} />
        </label>
      </div>

      <div className="publication-form-section">
        <div className="publication-form-section-header">
          <div>
            <h4>Autorët</h4>
            <p>Regjistroni autorët sipas renditjes akademike të publikimit.</p>
          </div>
          <button type="button" className="prof-btn-secondary" onClick={addAuthor}>
            <Plus size={15} /> Shto autor
          </button>
        </div>
        {(value.authors || []).length ? (
          <div className="publication-authors-grid" role="group" aria-label="Lista e autorëve">
            <div className="publication-authors-head" aria-hidden="true">
              <span>Renditja</span>
              <span>Emri i plotë</span>
              <span>ORCID</span>
              <span>Institucioni / Afiliacioni</span>
              <span>Autor kryesor</span>
              <span>Autor korrespondent</span>
              <span>Veprim</span>
            </div>
            {(value.authors || []).map((author, index) => (
              <div className="publication-author-row" key={`author-${index}`}>
                <div className="publication-author-index">Autori {index + 1}</div>
                <input
                  value={author.fullName}
                  onChange={(event) => setAuthorField(index, "fullName", event.target.value)}
                  placeholder="Emri i plotë"
                  required={index === 0}
                />
                <input
                  value={author.orcid}
                  onChange={(event) => setAuthorField(index, "orcid", event.target.value)}
                  placeholder="ORCID"
                />
                <input
                  value={author.affiliation}
                  onChange={(event) => setAuthorField(index, "affiliation", event.target.value)}
                  placeholder="Institucioni / Afiliacioni"
                />
                <label className="publication-author-check">
                  <input
                    type="checkbox"
                    checked={author.isMainAuthor}
                    onChange={(event) => setAuthorField(index, "isMainAuthor", event.target.checked)}
                  />
                  <span>Autor kryesor</span>
                </label>
                <label className="publication-author-check">
                  <input
                    type="checkbox"
                    checked={author.isCorrespondingAuthor}
                    onChange={(event) => setAuthorField(index, "isCorrespondingAuthor", event.target.checked)}
                  />
                  <span>Autor korrespondent</span>
                </label>
                <button
                  type="button"
                  className="publication-remove-button"
                  onClick={() => removeAuthor(index)}
                  aria-label={`Largo autorin ${index + 1}`}
                >
                  <Trash2 size={14} /> Largo
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="publication-empty-authors">
            Nuk është shtuar ende asnjë autor.
          </div>
        )}
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
