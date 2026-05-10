import React, { useCallback, useEffect, useState } from "react";
import "../styles/ConferenceManager.css";
import { apiUrl } from "../../utils/api";

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
const CONFERENCE_STATUS_LABELS = {
  Interested: "I interesuar",
  Planning: "Në planifikim",
  Submitted: "Dërguar",
  Accepted: "Pranuar",
  Attended: "Pjesëmarrë",
  Completed: "Përfunduar",
};
const WARNING_TRANSLATIONS = {
  "Metadata extraction failed. You can complete the form manually.": "Nxjerrja e të dhënave dështoi. Mund ta plotësoni formularin manualisht.",
};

function getConferenceErrorMessage(response, data, action) {
  if (response.status === 401) {
    return `Sesioni nuk është aktiv. Kyçuni me Google për të ${action} konferenca.`;
  }

  if (response.status === 403) {
    return "Nuk keni leje për këtë veprim.";
  }

  return data?.message || "Konferencat nuk u përditësuan.";
}

function getStatusLabel(status) {
  return CONFERENCE_STATUS_LABELS[status] || status || CONFERENCE_STATUS_LABELS.Interested;
}

function translateWarning(warning) {
  return WARNING_TRANSLATIONS[warning] || warning;
}

function formatConferenceDate(value) {
  if (!value) {
    return "Pa date";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getDateBadgeParts(value) {
  if (!value) {
    return { day: "--", month: "Pa datë" };
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return { day: "--", month: "Pa datë" };
  }

  return {
    day: new Intl.DateTimeFormat("sq-AL", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("sq-AL", { month: "short" }).format(date),
  };
}

function getWorkflowStatusClass(status) {
  return String(status || "Interested").toLowerCase();
}

function ConferenceManager({ searchQuery = "" }) {
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
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });

  const fetchConferences = useCallback(async ({ nextPage = page, query = searchQuery } = {}) => {
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

      const response = await fetch(apiUrl(`/conferences?${params.toString()}`), {
        credentials: "include",
      });
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(getConferenceErrorMessage(response, data, "parë"));
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
      setError(fetchError.message || "Konferencat nuk u ngarkuan.");
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    fetchConferences({ nextPage: page, query: searchQuery });
  }, [fetchConferences, page, searchQuery]);

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
      setExtractMessage("Shkruani linkun e konferencës.");
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
        setExtractMessage("Nxjerrja e të dhënave dështoi. Mund ta plotësoni formularin manualisht.");
        return;
      }

      if (result.missingFields?.length) {
        setExtractMessage("Disa të dhëna nuk u identifikuan. Ju lutem plotësojini manualisht.");
      } else {
        setExtractMessage("Të dhënat u gjetën. Ju lutem kontrolloni para ruajtjes.");
      }
    } catch {
      setForm((prev) => ({
        ...prev,
        website: url,
        status: prev.status || "Interested",
      }));
      setMissingFields(["title", "submission_deadline", "conference_date", "location"]);
      setExtractWarnings([]);
      setExtractMessage("Nxjerrja e të dhënave dështoi. Mund ta plotësoni formularin manualisht.");
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
        throw new Error(getConferenceErrorMessage(response, data, "shtuar"));
      }

      setForm(EMPTY_FORM);
      setEditingId("");
      await fetchConferences({ nextPage: page, query: searchQuery });
    } catch (submitError) {
      setError(submitError.message || "Konferenca nuk u ruajt.");
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
    const confirmed = window.confirm("A dëshironi ta fshini konferencën?");

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
        throw new Error(getConferenceErrorMessage(response, data, "fshirë"));
      }

      if (editingId === id) {
        cancelEdit();
      }

      await fetchConferences({ nextPage: page, query: searchQuery });
    } catch (deleteError) {
      setError(deleteError.message || "Konferenca nuk u fshi.");
    } finally {
      setDeletingId("");
    }
  };

  const getDeadlineStatus = (deadline) => {
    if (!deadline) {
      return "Pa afat";
    }

    const today = new Date();
    const deadlineDate = new Date(deadline);

    const difference = Math.ceil(
      (deadlineDate - today) / (1000 * 60 * 60 * 24)
    );

    if (Number.isNaN(deadlineDate.getTime())) return "Pa afat";
    if (difference < 0) return "Mbyllur";
    if (difference <= 7) return "Mbyllet së shpejti";

    return "Hapur";
  };

  return (
    <div className="conference-page">
      <section className="conference-panel">
        <div className="conference-import">
          <div className="conference-import-copy">
            <strong>Importo nga linku</strong>
            <span>Vendos faqen zyrtare të konferencës për të provuar plotësimin automatik.</span>
          </div>
          <div className="conference-import-controls">
            <input
              type="url"
              value={extractUrl}
              onChange={(event) => setExtractUrl(event.target.value)}
              placeholder="https://faqja-e-konferences.com"
            />
            <button type="button" onClick={handleExtract} disabled={isExtracting}>
              {isExtracting ? "Duke nxjerrë të dhënat..." : "Nxirr të dhënat"}
            </button>
          </div>
        </div>

        {extractMessage ? (
          <div className={`conference-extract-message ${missingFields.length ? "partial" : "success"}`}>
            <strong>{extractMessage}</strong>
            {extractWarnings.length ? <span>{extractWarnings.map(translateWarning).join(" ")}</span> : null}
          </div>
        ) : null}

        <div className="conference-form-heading">
          <div>
            <h3>Detajet e konferencës</h3>
            <p>Kontrolloni dhe plotësoni të dhënat para ruajtjes.</p>
          </div>
          {editingId ? <span>Duke edituar</span> : null}
        </div>

        <form onSubmit={handleSubmit} className="conference-form">
          <div className={getFieldClass("title")}>
            <label>Titulli i konferencës</label>
            <input
              name="title"
              type="text"
              placeholder="Shkruani titullin e konferencës"
              value={form.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className={getFieldClass("acronym")}>
            <label>Akronimi</label>
            <input
              name="acronym"
              type="text"
              placeholder="p.sh. ICIS"
              value={form.acronym}
              onChange={handleChange}
            />
          </div>

          <div className={getFieldClass("field")}>
            <label>Fusha kërkimore</label>
            <input
              name="field"
              type="text"
              placeholder="Shkenca kompjuterike"
              value={form.field}
              onChange={handleChange}
            />
          </div>

          <div className={getFieldClass("location")}>
            <label>Vendndodhja</label>
            <input
              name="location"
              type="text"
              placeholder="Vjenë, Austri"
              value={form.location}
              onChange={handleChange}
            />
          </div>

          <div className={getFieldClass("submission_deadline")}>
            <label>Afati i dorëzimit</label>
            <input
              name="submission_deadline"
              type="date"
              value={form.submission_deadline}
              onChange={handleChange}
              required={form.status !== "Interested"}
            />
          </div>

          <div className={getFieldClass("conference_date")}>
            <label>Data e konferencës</label>
            <input
              name="conference_date"
              type="date"
              value={form.conference_date}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Statusi</label>
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
            <label>Faqja zyrtare</label>
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
              {isSubmitting ? "Duke ruajtur..." : editingId ? "Ruaj ndryshimet" : "+ Shto konferencë"}
            </button>
            {editingId ? (
            <button
              type="button"
              className="conference-cancel-btn"
              onClick={cancelEdit}
              disabled={isSubmitting}
            >
              Anulo
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
            <h2>Konferencat ekzistuese</h2>
            <p>
              Pjesëmarrjet dhe afatet e ardhshme.
            </p>
          </div>
        </div>

        <div className="conference-list">
          {isLoading ? (
            <div className="conference-empty">Duke ngarkuar konferencat...</div>
          ) : conferences.length ? (
            conferences.map((conf) => {
              const status = getDeadlineStatus(conf.submission_deadline);
              const dateBadge = getDateBadgeParts(conf.conference_date || conf.submission_deadline);

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

                    <p>{conf.location || "Pa vendndodhje"}</p>

                    <div className="conference-meta">
                      <span>{conf.field || "Pa fushë"}</span>
                      <span>Afati: {formatConferenceDate(conf.submission_deadline)}</span>
                      <span>Data: {formatConferenceDate(conf.conference_date)}</span>
                    </div>

                    {conf.website && (
                      <a className="conference-link" href={conf.website} target="_blank" rel="noreferrer">
                        Vizito faqen
                      </a>
                    )}
                  </div>

                  <div className="conference-actions">
                    <span
                      className={`status-badge ${
                        status === "Hapur"
                          ? "open"
                          : status === "Mbyllet së shpejti"
                            ? "closing-soon"
                            : status === "Mbyllur"
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
                      Edito
                    </button>

                    <button
                      type="button"
                      className="conference-action-delete"
                      onClick={() => deleteConference(conf.id)}
                      disabled={deletingId === conf.id}
                    >
                      {deletingId === conf.id ? "Duke fshirë..." : "Fshij"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="conference-empty">
              Nuk u gjet asnjë konferencë.
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
              Mbrapa
            </button>
            <span>Faqja {pagination.page} / {pagination.totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.min(currentPage + 1, pagination.totalPages))}
              disabled={pagination.page >= pagination.totalPages || isLoading}
            >
              Para
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default ConferenceManager;
