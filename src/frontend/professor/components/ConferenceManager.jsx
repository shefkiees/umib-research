import React, { useEffect, useState } from "react";
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

function ConferenceManager() {
  const [conferences, setConferences] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  const fetchConferences = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(apiUrl("/conferences"), {
        credentials: "include",
      });
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(getConferenceErrorMessage(response, data, "pare"));
      }

      setConferences(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      setConferences([]);
      setError(fetchError.message || "Konferencat nuk u ngarkuan.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConferences();
  }, []);

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
      const response = await fetch(apiUrl("/conferences"), {
        method: "POST",
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
      await fetchConferences();
    } catch (submitError) {
      setError(submitError.message || "Konferenca nuk u ruajt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteConference = async (id) => {
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

      await fetchConferences();
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
            {isSubmitting ? "Duke ruajtur..." : "+ Shto Konference"}
          </button>
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
      </section>
    </div>
  );
}

export default ConferenceManager;
