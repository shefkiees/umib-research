import React, { useCallback, useEffect, useState } from "react";
import "../styles/ConferenceManager.css";
import { apiUrl } from "../../utils/api";
import { useLanguage } from "../../i18n/LanguageContext";

const EMPTY_FORM = {
  title: "",
  acronym: "",
  field: "",
  location: "",
  submission_deadline: "",
  conference_date: "",
  website: "",
  status: "Interested",
};

const CONFERENCE_STATUSES = ["Interested", "Planning", "Submitted", "Accepted", "Attended", "Completed"];
const DEADLINE_FILTERS = ["all", "week", "month", "past", "none"];

function getConferenceErrorMessage(response, data, action, t) {
  if (response.status === 401) {
    return t("professor.conferences.unauthorized", { action });
  }

  if (response.status === 403) {
    return t("professor.conferences.noPermission");
  }

  return data?.message || t("professor.conferences.updateError");
}

function parseConferenceDate(value) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return null;
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)
    ? new Date(`${normalizedValue}T00:00:00`)
    : new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDisplayDate(date, language) {
  const locale = language === "en" ? "en-US" : "sq-AL";
  const formatted = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  return formatted.replace(/\p{L}+/gu, (word) => word.charAt(0).toLocaleUpperCase(locale) + word.slice(1));
}

function formatConferenceDate(value, fallback, language) {
  const date = parseConferenceDate(value);

  if (!date) {
    return fallback;
  }

  return formatDisplayDate(date, language);
}

function getDateBadgeParts(value, language, noDateLabel) {
  const date = parseConferenceDate(value);
  const locale = language === "en" ? "en-US" : "sq-AL";

  if (!date) {
    return { day: "--", month: noDateLabel };
  }

  return {
    day: new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat(locale, { month: "short" }).format(date).toLocaleUpperCase(locale),
  };
}

function getWorkflowStatusClass(status) {
  return String(status || "Interested").toLowerCase();
}

function ConferenceManager({ searchQuery = "" }) {
  const { language, t } = useLanguage();
  const [conferences, setConferences] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [extractUrl, setExtractUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractMessage, setExtractMessage] = useState("");
  const [extractWarnings, setExtractWarnings] = useState([]);
  const [missingFields, setMissingFields] = useState([]);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState("all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const getStatusLabel = useCallback(
    (status) => t(`professor.conferences.statuses.${status || "Interested"}`),
    [t]
  );

  const fetchConferences = useCallback(async ({
    nextPage = page,
    query = searchQuery,
    status = statusFilter,
    deadline = deadlineFilter,
  } = {}) => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: "25",
      });
      const trimmedQuery = query.trim();

      if (trimmedQuery) {
        params.set("q", trimmedQuery);
      }

      if (status !== "all") {
        params.set("status", status);
      }

      if (deadline !== "all") {
        params.set("deadline", deadline);
      }

      const response = await fetch(apiUrl(`/conferences?${params.toString()}`), {
        credentials: "include",
      });
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(getConferenceErrorMessage(response, data, language === "en" ? "view" : "pare", t));
      }

      const rows = Array.isArray(data) ? data : data.data;
      setConferences(Array.isArray(rows) ? rows : []);
      setPagination({
        page: data.pagination?.page || nextPage,
        limit: data.pagination?.limit || 25,
        total: data.pagination?.total || (Array.isArray(rows) ? rows.length : 0),
        totalPages: data.pagination?.totalPages || 1,
      });
    } catch (fetchError) {
      setConferences([]);
      setError(fetchError.message || t("professor.conferences.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [deadlineFilter, language, page, searchQuery, statusFilter, t]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    fetchConferences({
      nextPage: page,
      query: searchQuery,
      status: statusFilter,
      deadline: deadlineFilter,
    });
  }, [fetchConferences, page, searchQuery, statusFilter, deadlineFilter]);

  const handleChange = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
    setMissingFields((prev) => prev.filter((field) => field !== event.target.name));
  };

  const getFieldClass = (field) =>
    `form-group${missingFields.includes(field) ? " conference-field-missing" : ""}`;

  const handleExtract = async () => {
    const url = extractUrl.trim();

    if (!url) {
      setExtractMessage(t("professor.conferences.enterUrl"));
      setExtractWarnings([]);
      return;
    }

    setIsExtracting(true);
    setError("");
    setExtractMessage("");
    setExtractWarnings([]);
    setMissingFields([]);

    try {
      const response = await fetch(apiUrl("/conferences/extract"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });
      const result = await response.json().catch(() => ({}));
      const extracted = result.data || {};

      setForm((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(extracted).filter(([, value]) => value !== undefined && value !== null && value !== "")
        ),
        website: extracted.website || url,
        status: extracted.status || prev.status || "Interested",
      }));
      setMissingFields(Array.isArray(result.missingFields) ? result.missingFields : []);
      setExtractWarnings(Array.isArray(result.warnings) ? result.warnings : []);

      if (!response.ok) {
        setExtractMessage(t("professor.conferences.extractFailed"));
        return;
      }

      if (result.missingFields?.length) {
        setExtractMessage(t("professor.conferences.missingExtracted"));
      } else {
        setExtractMessage(t("professor.conferences.extracted"));
      }
    } catch {
      setForm((prev) => ({
        ...prev,
        website: url,
        status: prev.status || "Interested",
      }));
      setMissingFields(["title", "submission_deadline", "conference_date", "location"]);
      setExtractWarnings([]);
      setExtractMessage(t("professor.conferences.extractFailed"));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(apiUrl(editingId ? `/conferences/${editingId}` : "/conferences"), {
        method: editingId ? "PUT" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(getConferenceErrorMessage(response, data, language === "en" ? "save" : "shtuar", t));
      }

      setForm(EMPTY_FORM);
      setEditingId("");
      await fetchConferences({
        nextPage: page,
        query: searchQuery,
        status: statusFilter,
        deadline: deadlineFilter,
      });
    } catch (submitError) {
      setError(submitError.message || t("professor.conferences.saveError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const editConference = (conference) => {
    setEditingId(conference.id);
    setForm({
      title: conference.title || "",
      acronym: conference.acronym || "",
      field: conference.field || "",
      location: conference.location || "",
      submission_deadline: conference.submission_deadline || "",
      conference_date: conference.conference_date || "",
      website: conference.website || "",
      status: conference.status || "Interested",
    });
    setError("");
    setMissingFields([]);
  };

  const cancelEdit = () => {
    setEditingId("");
    setForm(EMPTY_FORM);
    setError("");
    setMissingFields([]);
  };

  const deleteConference = async (id) => {
    const confirmed = window.confirm(t("professor.conferences.confirmDelete"));

    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    setError("");

    try {
      const response = await fetch(apiUrl(`/conferences/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(getConferenceErrorMessage(response, data, language === "en" ? "delete" : "fshire", t));
      }

      if (editingId === id) {
        cancelEdit();
      }

      await fetchConferences({
        nextPage: page,
        query: searchQuery,
        status: statusFilter,
        deadline: deadlineFilter,
      });
    } catch (deleteError) {
      setError(deleteError.message || t("professor.conferences.deleteError"));
    } finally {
      setDeletingId("");
    }
  };

  const getDeadlineStatus = (deadline) => {
    if (!deadline) {
      return t("common.noDeadline");
    }

    const today = new Date();
    const deadlineDate = new Date(deadline);

    const difference = Math.ceil(
      (deadlineDate - today) / (1000 * 60 * 60 * 24)
    );

    if (Number.isNaN(deadlineDate.getTime())) return t("common.noDeadline");
    if (difference < 0) return t("common.closed");
    if (difference <= 7) return t("professor.conferences.closingSoon");

    return t("common.open");
  };

  return (
    <div className="conference-page">
      <section className="conference-panel">
        <div className="conference-import">
          <div className="conference-import-copy">
            <strong>{t("professor.conferences.importTitle")}</strong>
            <span>{t("professor.conferences.importDescription")}</span>
          </div>
          <div className="conference-import-controls">
            <input
              type="url"
              value={extractUrl}
              onChange={(event) => setExtractUrl(event.target.value)}
              placeholder="https://faqja-e-konferences.com"
            />
            <button type="button" onClick={handleExtract} disabled={isExtracting}>
              {isExtracting ? t("professor.conferences.extracting") : t("professor.conferences.extract")}
            </button>
          </div>
        </div>

        {extractMessage ? (
          <div className={`conference-extract-message ${missingFields.length ? "partial" : "success"}`}>
            <strong>{extractMessage}</strong>
            {extractWarnings.length ? <span>{extractWarnings.join(" ")}</span> : null}
          </div>
        ) : null}

        <div className="conference-form-heading">
          <div>
            <h3>{t("professor.conferences.detailsTitle")}</h3>
            <p>{t("professor.conferences.detailsDescription")}</p>
          </div>
          {editingId ? <span>{t("professor.conferences.editing")}</span> : null}
        </div>

        <form onSubmit={handleSubmit} className="conference-form">
          <div className={getFieldClass("title")}>
            <label>{t("professor.conferences.title")}</label>
            <input
              name="title"
              type="text"
              placeholder={t("professor.conferences.titlePlaceholder")}
              value={form.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className={getFieldClass("acronym")}>
            <label>{t("professor.conferences.acronym")}</label>
            <input
              name="acronym"
              type="text"
              placeholder="p.sh. ICIS"
              value={form.acronym}
              onChange={handleChange}
            />
          </div>

          <div className={getFieldClass("field")}>
            <label>{t("professor.conferences.field")}</label>
            <input
              name="field"
              type="text"
              placeholder={t("professor.conferences.fieldPlaceholder")}
              value={form.field}
              onChange={handleChange}
            />
          </div>

          <div className={getFieldClass("location")}>
            <label>{t("professor.conferences.location")}</label>
            <input
              name="location"
              type="text"
              placeholder={t("professor.conferences.locationPlaceholder")}
              value={form.location}
              onChange={handleChange}
            />
          </div>

          <div className={getFieldClass("submission_deadline")}>
            <label>{t("professor.conferences.submissionDeadline")}</label>
            <input
              name="submission_deadline"
              type="date"
              value={form.submission_deadline}
              onChange={handleChange}
              required={form.status !== "Interested"}
            />
          </div>

          <div className={getFieldClass("conference_date")}>
            <label>{t("professor.conferences.conferenceDate")}</label>
            <input
              name="conference_date"
              type="date"
              value={form.conference_date}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>{t("professor.conferences.status")}</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
            >
              {CONFERENCE_STATUSES.map((status) => (
                <option key={status} value={status}>{getStatusLabel(status)}</option>
              ))}
            </select>
          </div>

          <div className={`${getFieldClass("website")} form-wide`}>
            <label>{t("professor.conferences.website")}</label>
            <input
              name="website"
              type="url"
              placeholder="https://konferenca.com"
              value={form.website}
              onChange={handleChange}
            />
          </div>

          <div className="conference-form-actions">
            <button
              type="submit"
              className="conference-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("professor.conferences.saving") : editingId ? t("professor.conferences.saveChanges") : t("professor.conferences.add")}
            </button>
            {editingId ? (
            <button
              type="button"
              className="conference-cancel-btn"
              onClick={cancelEdit}
              disabled={isSubmitting}
            >
              {t("professor.conferences.cancel")}
            </button>
            ) : null}
          </div>
        </form>

        {error ? (
          <p className="conference-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="conference-panel">
        <div className="conference-header">
          <div>
            <h2>{t("professor.conferences.existingTitle")}</h2>
            <p>{t("professor.conferences.existingDescription")}</p>
          </div>
          <div className="conference-filters" aria-label={t("professor.conferences.filtersLabel")}>
            <label>
              <span>{t("common.status")}</span>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">{t("common.all")}</option>
                {CONFERENCE_STATUSES.map((status) => (
                  <option key={status} value={status}>{getStatusLabel(status)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("common.deadline")}</span>
              <select
                value={deadlineFilter}
                onChange={(event) => {
                  setDeadlineFilter(event.target.value);
                  setPage(1);
                }}
              >
                {DEADLINE_FILTERS.map((filter) => (
                  <option key={filter} value={filter}>{t(`professor.conferences.deadlineFilters.${filter}`)}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="conference-list">
          {isLoading ? (
            <div className="conference-empty">{t("professor.conferences.loading")}</div>
          ) : conferences.length ? (
            conferences.map((conf) => {
              const status = getDeadlineStatus(conf.submission_deadline);
              const dateBadge = getDateBadgeParts(conf.conference_date, language, t("common.noDeadline"));

              return (
                <div className="conference-card" key={conf.id}>
                  <div className="conference-date-badge" aria-hidden="true">
                    <strong>{dateBadge.day}</strong>
                    <span>{dateBadge.month}</span>
                  </div>

                  <div className="conference-details">
                    <h3>
                      {conf.title}
                      {conf.acronym && <span>({conf.acronym})</span>}
                    </h3>

                    <p>{t("professor.conferences.locationLabel")}: {conf.location || t("professor.conferences.noLocation")}</p>

                    <div className="conference-meta">
                      <span>{t("professor.conferences.fieldLabel")}: {conf.field || t("professor.conferences.noField")}</span>
                      <span>{t("professor.conferences.deadlineLabel")}: {formatConferenceDate(conf.submission_deadline, t("common.noDeadline"), language)}</span>
                      <span>{t("professor.conferences.dateLabel")}: {formatConferenceDate(conf.conference_date, t("common.noDeadline"), language)}</span>
                    </div>

                    {conf.website && (
                      <a className="conference-link" href={conf.website} target="_blank" rel="noreferrer">
                        {t("professor.conferences.visitWebsite")}
                      </a>
                    )}
                  </div>

                  <div className="conference-actions">
                    <span
                      className={`status-badge ${
                        status === t("common.open")
                          ? "open"
                          : status === t("professor.conferences.closingSoon")
                            ? "closing-soon"
                            : status === t("common.closed")
                              ? "closed"
                              : "neutral"
                      }`}
                    >
                      {status}
                    </span>
                    <span className={`conference-workflow-status ${getWorkflowStatusClass(conf.status)}`}>
                      {getStatusLabel(conf.status)}
                    </span>

                    <button
                      type="button"
                      className="conference-action-edit"
                      onClick={() => editConference(conf)}
                      disabled={deletingId === conf.id}
                    >
                      {t("common.edit")}
                    </button>

                    <button
                      type="button"
                      className="conference-action-delete"
                      onClick={() => deleteConference(conf.id)}
                      disabled={deletingId === conf.id}
                    >
                      {deletingId === conf.id ? t("professor.conferences.deleting") : t("common.delete")}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="conference-empty">
              {t("professor.conferences.notFound")}
            </div>
          )}
        </div>
        {pagination.totalPages > 1 ? (
          <div className="conference-pagination">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
              disabled={pagination.page <= 1 || isLoading}
            >
              {t("common.back")}
            </button>
            <span>{t("professor.conferences.pageOf", { page: pagination.page, total: pagination.totalPages })}</span>
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.min(currentPage + 1, pagination.totalPages))}
              disabled={pagination.page >= pagination.totalPages || isLoading}
            >
              {t("common.next")}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default ConferenceManager;
