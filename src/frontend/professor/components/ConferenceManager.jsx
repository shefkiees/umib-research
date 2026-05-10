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
};

function getConferenceErrorMessage(response, data, action) {
  if (response.status === 401) {
    return `Sesioni nuk eshte aktiv. Kyquni me Google per te ${action} konferenca.`;
  }

  if (response.status === 403) {
    return "Nuk keni leje per kete veprim.";
  }

  return data?.message || "Konferencat nuk u perditesuan.";
}

function ConferenceManager({ searchQuery = "" }) {
  const [conferences, setConferences] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
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
        throw new Error(getConferenceErrorMessage(response, data, "pare"));
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
    });
    setError("");
  };

  const cancelEdit = () => {
    setEditingId("");
    setForm(EMPTY_FORM);
    setError("");
  };

  const deleteConference = async (id) => {
    const confirmed = window.confirm("A jeni te sigurt qe doni ta fshini kete konference?");

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
        throw new Error(getConferenceErrorMessage(response, data, "fshire"));
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
    const today = new Date();
    const deadlineDate = new Date(deadline);

    const difference = Math.ceil(
      (deadlineDate - today) / (1000 * 60 * 60 * 24)
    );

    if (difference < 0) return "Mbyllur";
    if (difference <= 7) return "Mbyllet se shpejti";

    return "Hapur";
  };

  return (
    <div className="conference-page">
      <section className="conference-panel">
        <div className="conference-header">
          <div>
            <h2>Shto dhe Menaxho Konferenca</h2>
            <p>
              Regjistro konferenca, afate aplikimi
              dhe menaxho pjesemarrjet shkencore.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="conference-form">
          <div className="form-group">
            <label>Titulli i Konferences</label>
            <input
              name="title"
              type="text"
              placeholder="Shkruaj titullin e konferences"
              value={form.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Akronimi</label>
            <input
              name="acronym"
              type="text"
              placeholder="p.sh ICIS"
              value={form.acronym}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Fusha Kerkimore</label>
            <input
              name="field"
              type="text"
              placeholder="Shkenca Kompjuterike"
              value={form.field}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Lokacioni</label>
            <input
              name="location"
              type="text"
              placeholder="Viene, Austri"
              value={form.location}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Afati i Aplikimit</label>
            <input
              name="submission_deadline"
              type="date"
              value={form.submission_deadline}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Data e Konferences</label>
            <input
              name="conference_date"
              type="date"
              value={form.conference_date}
              onChange={handleChange}
            />
          </div>

          <div className="form-group form-wide">
            <label>Web Faqja</label>
            <input
              name="website"
              type="url"
              placeholder="https://konferenca.com"
              value={form.website}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            className="conference-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Duke ruajtur..." : editingId ? "Ruaj ndryshimet" : "+ Shto Konference"}
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
              Pjesemarrjet dhe afatet e ardhshme.
            </p>
          </div>
        </div>

        <div className="conference-list">
          {isLoading ? (
            <div className="conference-empty">Duke ngarkuar konferencat...</div>
          ) : conferences.length ? (
            conferences.map((conf) => {
              const status = getDeadlineStatus(conf.submission_deadline);

              return (
                <div className="conference-card" key={conf.id}>
                  <div className="conference-icon">Cal</div>

                  <div className="conference-details">
                    <h3>
                      {conf.title}
                      {conf.acronym && <span>({conf.acronym})</span>}
                    </h3>

                    <p>{conf.location || "Pa lokacion"}</p>

                    <div className="conference-meta">
                      <span>{conf.field || "Pa fushe"}</span>
                      <span>Afati: {conf.submission_deadline}</span>
                    </div>

                    {conf.website && (
                      <a href={conf.website} target="_blank" rel="noreferrer">
                        Vizito Faqen
                      </a>
                    )}
                  </div>

                  <div className="conference-actions">
                    <span
                      className={`status-badge ${
                        status === "Hapur"
                          ? "open"
                          : status === "Mbyllet se shpejti"
                            ? "closing-soon"
                            : "closed"
                      }`}
                    >
                      {status}
                    </span>

                    <button
                      type="button"
                      onClick={() => editConference(conf)}
                      disabled={deletingId === conf.id}
                    >
                      Edito
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteConference(conf.id)}
                      disabled={deletingId === conf.id}
                    >
                      {deletingId === conf.id ? "Duke fshire..." : "Fshij"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="conference-empty">
              Nuk ka ende konferenca per kete profesor.
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
