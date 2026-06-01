import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Bell, CircleUserRound, LogOut, Settings } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
} from "recharts";
import "../styles/CommitteeDashboard.css";
import CommitteeSidebar from "../components/CommitteeSidebar";
import CommitteeTopBar from "../components/CommitteeTopBar";
import CommitteeSettings from "./CommitteeSettings";
import ReimbursementReviewPanel from "../../common/ReimbursementReviewPanel";
import { apiUrl } from "../../utils/api";

const facultyStatistics = [
  { faculty: "FG", label: "Fakulteti i Gjeoshkencave", department: "Fakulteti i Gjeoshkencave", publikime: 22, projekte: 8, rimbursime: 6 },
  { faculty: "FTU", label: "Fakulteti i Teknologjisë Ushqimore", department: "Fakulteti i Teknologjisë Ushqimore", publikime: 18, projekte: 6, rimbursime: 5 },
  { faculty: "FIMC", label: "Fakulteti i Inxhinierisë Mekanike dhe Kompjuterike", department: "Fakulteti i Inxhinierisë Mekanike dhe Kompjuterike", publikime: 26, projekte: 10, rimbursime: 7 },
  { faculty: "FJ", label: "Fakulteti Juridik", department: "Fakulteti Juridik", publikime: 14, projekte: 5, rimbursime: 4 },
  { faculty: "FE", label: "Fakulteti Ekonomik", department: "Fakulteti Ekonomik", publikime: 20, projekte: 7, rimbursime: 6 },
  { faculty: "FED", label: "Fakulteti i Edukimit", department: "Fakulteti i Edukimit", publikime: 16, projekte: 5, rimbursime: 5 },
];

const conferenceRows = [
  { id: "CF-032", event: "IEEE BalkanCom", unit: "FIMC", status: "Konfirmuar" },
  { id: "CF-027", event: "EduTech Europe", unit: "FED", status: "Ne pritje" },
  { id: "CF-018", event: "Legal Innovation Summit", unit: "FJ", status: "Konfirmuar" },
];

const navLabels = ["Dorëzimet në Pritje", "Shqyrtimi", "Metadata", "Vendimet", "Auditimi", "Raporte"];

const publicationStatusLabels = {
  draft: "Draft",
  submitted: "Në pritje",
  in_review: "Në shqyrtim",
  needs_correction: "Korrigjim",
  approved: "Aprovuar",
  rejected: "Refuzuar",
};

const publicationTypeLabels = {
  journal_article: "Artikull reviste",
  conference_paper: "Punim konference",
  book: "Libër / kapitull",
};

const metadataFilters = [
  { id: "all", label: "Të gjitha" },
  { id: "submitted", label: "Në pritje" },
  { id: "missing-doi", label: "Pa DOI" },
  { id: "verified", label: "Të verifikuara" },
  { id: "unverified", label: "Pa verifikim" },
  { id: "missing-uibm", label: "Pa UIBM affiliation" },
];

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("sq-AL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function normalizeForSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getPublicationAuthors(publication) {
  return Array.isArray(publication?.authors) ? publication.authors : [];
}

function getAuthorName(author) {
  return author?.fullName || author?.full_name || author?.name || "";
}

function getAuthorAffiliation(author) {
  return author?.affiliation || "";
}

function hasUibmAffiliation(publication) {
  const text = getPublicationAuthors(publication)
    .map((author) => getAuthorAffiliation(author))
    .join(" ");

  return /uibm|isa boletini|universiteti.*mitrovic|university.*mitrovic/i.test(text);
}

function getMetadataStatus(publication) {
  if (publication.metadataVerified || publication.metadata_verified) return "Verifikuar";
  if (publication.doi) return "DOI pa verifikim";
  return "Manual";
}

function getPublicationTypeLabel(value) {
  return publicationTypeLabels[value] || value || "-";
}

function getPublicationStatusLabel(value) {
  return publicationStatusLabels[value] || value || "-";
}

export default function CommitteeDashboard() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState("Dorëzimet në Pritje");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [isPendingSubmissionsLoading, setIsPendingSubmissionsLoading] = useState(true);
  const [pendingSubmissionsError, setPendingSubmissionsError] = useState("");
  const [metadataPublications, setMetadataPublications] = useState([]);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState("");
  const [metadataFilter, setMetadataFilter] = useState("all");
  const [selectedMetadataPublication, setSelectedMetadataPublication] = useState(null);
  const [committeeProfile, setCommitteeProfile] = useState({
    name: "Komisioni Shkencor",
    role: "Paneli i vleresimit",
    email: "komisioni@umib.edu",
    unit: "Komisioni i Studimeve",
  });
  const [committeeDraft, setCommitteeDraft] = useState({
    name: "Komisioni Shkencor",
    role: "Paneli i vleresimit",
    email: "komisioni@umib.edu",
    unit: "Komisioni i Studimeve",
  });
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      category: "Raporte",
      title: "Raporti mujor u gjenerua",
      description: "Raporti per fakultetet u finalizua dhe eshte gati per verifikim nga komisioni.",
      text: "U gjenerua raporti mujor i fakulteteve",
      isRead: false,
      createdAt: "Sot, 09:30",
    },
    {
      id: 2,
      category: "Metadata",
      title: "Metadata u perditesua",
      description: "Te dhenat e FShMN u sinkronizuan nga sistemi qendror.",
      text: "Te dhenat e FShMN u perditesuan",
      isRead: false,
      createdAt: "Sot, 08:12",
    },
    {
      id: 3,
      category: "Eksport",
      title: "Eksporti i statistikave u kompletua",
      description: "Skedari CSV i statistikave mujore u ruajt ne arkive.",
      text: "Eksporti i statistikave u kompletua",
      isRead: true,
      createdAt: "Dje, 17:05",
    },
  ]);

  const normalizedQuery = normalizeForSearch(searchQuery.trim());

  const filteredFacultyStats = useMemo(() => {
    if (!normalizedQuery) {
      return facultyStatistics;
    }

    return facultyStatistics.filter((item) => {
      const row = `${item.faculty} ${item.department} ${item.publikime} ${item.projekte} ${item.rimbursime}`.toLowerCase();
      return row.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  useEffect(() => {
    let isMounted = true;

    const loadPendingSubmissions = async () => {
      setIsPendingSubmissionsLoading(true);
      setPendingSubmissionsError("");

      try {
        const response = await fetch(apiUrl("/reimbursements?scope=review"), {
          credentials: "include",
        });

        if (response.status === 401) {
          throw new Error("Sesioni nuk eshte aktiv.");
        }

        if (!response.ok) {
          throw new Error("Dorëzimet në pritje nuk u ngarkuan nga databaza.");
        }

        const data = await response.json();
        const rows = Array.isArray(data) ? data : [];

        if (isMounted) {
          setPendingSubmissions(rows.filter((item) => item.status === "submitted"));
        }
      } catch (error) {
        if (isMounted) {
          setPendingSubmissions([]);
          setPendingSubmissionsError(error.message || "Dorëzimet në pritje nuk u ngarkuan.");
        }
      } finally {
        if (isMounted) {
          setIsPendingSubmissionsLoading(false);
        }
      }
    };

    loadPendingSubmissions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadMetadataPublications = async () => {
      setIsMetadataLoading(true);
      setMetadataError("");

      try {
        const response = await fetch(apiUrl("/publications?scope=review&limit=50"), {
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || "Metadata e publikimeve nuk u ngarkua.");
        }

        if (isMounted) {
          setMetadataPublications(Array.isArray(data.data) ? data.data : []);
        }
      } catch (error) {
        if (isMounted) {
          setMetadataPublications([]);
          setMetadataError(error.message || "Metadata e publikimeve nuk u ngarkua.");
        }
      } finally {
        if (isMounted) {
          setIsMetadataLoading(false);
        }
      }
    };

    loadMetadataPublications();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPendingSubmissions = useMemo(() => {
    if (!normalizedQuery) {
      return pendingSubmissions;
    }

    return pendingSubmissions.filter((item) => {
      const row = [
        item.documentNumber,
        item.id,
        item.title,
        item.requestTypeLabel,
        item.owner?.name,
        item.owner?.email,
        item.owner?.faculty,
        item.owner?.department,
        item.statusLabel,
      ].filter(Boolean).join(" ").toLowerCase();

      return row.includes(normalizedQuery);
    });
  }, [normalizedQuery, pendingSubmissions]);

  const filteredConferences = useMemo(() => {
    if (!normalizedQuery) {
      return conferenceRows;
    }

    return conferenceRows.filter((item) =>
      `${item.id} ${item.event} ${item.unit} ${item.status}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const filteredMetadataPublications = useMemo(() => {
    const filteredByState = metadataPublications.filter((item) => {
      if (metadataFilter === "submitted") return item.status === "submitted";
      if (metadataFilter === "missing-doi") return !item.doi;
      if (metadataFilter === "verified") return Boolean(item.metadataVerified || item.metadata_verified);
      if (metadataFilter === "unverified") return !item.metadataVerified && !item.metadata_verified;
      if (metadataFilter === "missing-uibm") return !hasUibmAffiliation(item);
      return true;
    });

    if (!normalizedQuery) {
      return filteredByState;
    }

    return filteredByState.filter((item) => {
      const authorsText = getPublicationAuthors(item)
        .map((author) => `${getAuthorName(author)} ${getAuthorAffiliation(author)}`)
        .join(" ");
      const row = [
        item.title,
        item.doi,
        item.venue,
        item.publisher,
        item.publicationType,
        item.publication_type,
        item.publicationYear,
        item.publication_year,
        item.status,
        getPublicationStatusLabel(item.status),
        getMetadataStatus(item),
        authorsText,
      ].filter(Boolean).join(" ");

      return normalizeForSearch(row).includes(normalizedQuery);
    });
  }, [metadataFilter, metadataPublications, normalizedQuery]);

  const metadataSummary = useMemo(() => ({
    total: metadataPublications.length,
    verified: metadataPublications.filter((item) => item.metadataVerified || item.metadata_verified).length,
    missingDoi: metadataPublications.filter((item) => !item.doi).length,
    missingUibm: metadataPublications.filter((item) => !hasUibmAffiliation(item)).length,
  }), [metadataPublications]);

  const unreadNotifications = notifications.filter((item) => !item.isRead).length;

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const markNotificationAsRead = (id) => {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
  };

  const profileMenuItems = [
    { id: "Njoftime", label: "Njoftime", icon: Bell },
    { id: "Edit Profile", label: "Edit Profile", icon: CircleUserRound },
    { id: "Settings", label: "Settings", icon: Settings },
    { id: "Logout", label: "Logout", icon: LogOut, tone: "danger" },
  ];

  const handleProfileAction = (actionId) => {
    const normalizedAction = String(actionId || "").trim().toLowerCase();

    if (normalizedAction === "njoftime" || normalizedAction === "notifications") {
      setActivePage("Njoftime");
      return;
    }

    if (normalizedAction === "edit profile" || normalizedAction === "edit-profile") {
      setCommitteeDraft(committeeProfile);
      setIsEditProfileOpen(true);
      return;
    }

    if (normalizedAction === "settings") {
      setActivePage("Settings");
      return;
    }

    if (normalizedAction === "logout") {
      fetch(apiUrl("/auth/logout"), {
        method: "POST",
        credentials: "include",
      }).finally(() => {
        localStorage.removeItem("authToken");
        sessionStorage.removeItem("authToken");
        navigate("/", { replace: true });
      });
      return;
    }
  };

  const handleCommitteeFieldChange = (field) => (event) => {
    setCommitteeDraft((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCommitteeSave = (event) => {
    event.preventDefault();
    setCommitteeProfile(committeeDraft);
    setIsEditProfileOpen(false);
  };

  const totals = useMemo(() => {
    return filteredFacultyStats.reduce(
      (acc, item) => {
        acc.publikime += item.publikime;
        acc.projekte += item.projekte;
        acc.rimbursime += item.rimbursime;
        return acc;
      },
      { publikime: 0, projekte: 0, rimbursime: 0 }
    );
  }, [filteredFacultyStats]);

  const renderSimpleTable = (title, description, columns, rows) => (
    <section className="committee-page-card committee-stats-only-card">
      <div className="committee-page-head">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="committee-table-wrap">
        <table className="committee-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={`${row.id}-${column.key}`}>{row[column.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="committee-empty">Nuk ka rezultate per kerkimin aktual.</p> : null}
    </section>
  );

  const renderPendingSubmissions = () => (
    <section className="committee-page-card committee-stats-only-card">
      <div className="committee-page-head">
        <h3>Dorëzimet në Pritje</h3>
        <p>Kërkesat e dërguara nga profesorët që ende nuk janë marrë në shqyrtim nga Komisioni.</p>
      </div>

      {isPendingSubmissionsLoading ? (
        <p className="committee-empty">Duke ngarkuar dorëzimet në pritje...</p>
      ) : pendingSubmissionsError ? (
        <p className="committee-empty" role="alert">{pendingSubmissionsError}</p>
      ) : (
        <>
          <div className="committee-table-wrap">
            <table className="committee-table">
              <thead>
                <tr>
                  <th>ID / Dokumenti</th>
                  <th>Titulli / Lloji</th>
                  <th>Aplikanti</th>
                  <th>Njësia akademike</th>
                  <th>Data e dorëzimit</th>
                  <th>Statusi</th>
                </tr>
              </thead>
              <tbody>
                {filteredPendingSubmissions.map((row) => (
                  <tr key={row.id}>
                    <td>{row.documentNumber || row.id}</td>
                    <td>{row.title || row.requestTypeLabel || "-"}</td>
                    <td>{row.owner?.name || row.owner?.email || "-"}</td>
                    <td>{row.owner?.faculty || row.owner?.department || "-"}</td>
                    <td>{formatDate(row.submittedAt || row.createdAt)}</td>
                    <td>{row.statusLabel || row.status || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPendingSubmissions.length === 0 ? (
            <p className="committee-empty">Nuk ka dorëzime në pritje për momentin.</p>
          ) : null}
        </>
      )}
    </section>
  );

  const renderMetadata = () => (
    <section className="committee-page-card committee-stats-only-card committee-metadata-section">
      <div className="committee-page-head committee-metadata-head">
        <div>
          <h3>Metadata e publikimeve</h3>
          <p>Të dhëna reale nga publikimet: DOI, journal/konferenca, autorët, affiliation dhe statusi i verifikimit.</p>
        </div>
        <button className="committee-api-chip" type="button">
          Live data
        </button>
      </div>

      <div className="committee-metadata-summary">
        <article>
          <span>Publikime</span>
          <strong>{metadataSummary.total}</strong>
        </article>
        <article>
          <span>Metadata verifikuar</span>
          <strong>{metadataSummary.verified}</strong>
        </article>
        <article>
          <span>Pa DOI</span>
          <strong>{metadataSummary.missingDoi}</strong>
        </article>
        <article>
          <span>Pa UIBM affiliation</span>
          <strong>{metadataSummary.missingUibm}</strong>
        </article>
      </div>

      <div className="committee-metadata-filters" aria-label="Filtrat e metadatave">
        {metadataFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={metadataFilter === filter.id ? "is-active" : ""}
            onClick={() => setMetadataFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {metadataError ? <p className="committee-empty" role="alert">{metadataError}</p> : null}

      {isMetadataLoading ? (
        <p className="committee-empty">Duke ngarkuar metadata nga databaza...</p>
      ) : (
        <div className="committee-table-wrap committee-metadata-table-wrap">
          <table className="committee-table committee-metadata-table">
            <thead>
              <tr>
                <th>Publikimi</th>
                <th>DOI</th>
                <th>Burimi</th>
                <th>Autorët / Affiliation</th>
                <th>Metadata</th>
                <th>Statusi</th>
                <th>Detaje</th>
              </tr>
            </thead>
            <tbody>
              {filteredMetadataPublications.map((item) => {
                const authors = getPublicationAuthors(item);
                const firstAuthor = authors[0];
                const hasUibm = hasUibmAffiliation(item);

                return (
                  <tr key={item.id}>
                    <td>
                      <strong className="committee-metadata-title">{item.title || "Pa titull"}</strong>
                      <span className="committee-metadata-muted">{getPublicationTypeLabel(item.publicationType || item.publication_type)}</span>
                    </td>
                    <td>
                      {item.doi ? (
                        <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noreferrer">{item.doi}</a>
                      ) : (
                        <span className="committee-metadata-warning">Mungon</span>
                      )}
                    </td>
                    <td>
                      <strong>{item.venue || item.publisher || "-"}</strong>
                      <span className="committee-metadata-muted">{item.publicationYear || item.publication_year || formatDate(item.publicationDate || item.publication_date)}</span>
                    </td>
                    <td>
                      <strong>{getAuthorName(firstAuthor) || "-"}</strong>
                      <span className={hasUibm ? "committee-metadata-ok" : "committee-metadata-warning"}>
                        {hasUibm ? "UIBM affiliation OK" : "UIBM affiliation mungon"}
                      </span>
                    </td>
                    <td>
                      <span className={`committee-metadata-badge ${item.metadataVerified || item.metadata_verified ? "is-ok" : "is-warning"}`}>
                        {getMetadataStatus(item)}
                      </span>
                    </td>
                    <td>{getPublicationStatusLabel(item.status)}</td>
                    <td>
                      <button type="button" className="committee-details-btn" onClick={() => setSelectedMetadataPublication(item)}>
                        Shiko
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isMetadataLoading && !metadataError && filteredMetadataPublications.length === 0 ? (
        <p className="committee-empty">Nuk ka publikime për filtrin aktual.</p>
      ) : null}

      {selectedMetadataPublication ? (
        <div className="committee-metadata-drawer-backdrop" role="presentation" onClick={() => setSelectedMetadataPublication(null)}>
          <aside className="committee-metadata-drawer" role="dialog" aria-label="Detajet e metadatave" onClick={(event) => event.stopPropagation()}>
            <div className="committee-metadata-drawer-head">
              <div>
                <h4>{selectedMetadataPublication.title || "Pa titull"}</h4>
                <p>{selectedMetadataPublication.doi || "Pa DOI"}</p>
              </div>
              <button type="button" onClick={() => setSelectedMetadataPublication(null)} aria-label="Mbyll detajet">×</button>
            </div>
            <dl className="committee-metadata-detail-grid">
              <div><dt>Tipi</dt><dd>{getPublicationTypeLabel(selectedMetadataPublication.publicationType || selectedMetadataPublication.publication_type)}</dd></div>
              <div><dt>Journal / Konferenca</dt><dd>{selectedMetadataPublication.venue || "-"}</dd></div>
              <div><dt>Publisher</dt><dd>{selectedMetadataPublication.publisher || "-"}</dd></div>
              <div><dt>Viti / Data</dt><dd>{selectedMetadataPublication.publicationYear || selectedMetadataPublication.publication_year || formatDate(selectedMetadataPublication.publicationDate || selectedMetadataPublication.publication_date)}</dd></div>
              <div><dt>Metadata source</dt><dd>{selectedMetadataPublication.metadataSource || selectedMetadataPublication.metadata_source || "manual"}</dd></div>
              <div><dt>Metadata status</dt><dd>{getMetadataStatus(selectedMetadataPublication)}</dd></div>
              <div><dt>Statusi</dt><dd>{getPublicationStatusLabel(selectedMetadataPublication.status)}</dd></div>
              <div><dt>UIBM affiliation</dt><dd>{hasUibmAffiliation(selectedMetadataPublication) ? "Po" : "Jo"}</dd></div>
            </dl>
            <div className="committee-metadata-authors">
              <h5>Autorët dhe affiliation</h5>
              {getPublicationAuthors(selectedMetadataPublication).length ? (
                getPublicationAuthors(selectedMetadataPublication).map((author, index) => (
                  <article key={`${getAuthorName(author)}-${index}`}>
                    <strong>{getAuthorName(author) || `Autori ${index + 1}`}</strong>
                    <span>{getAuthorAffiliation(author) || "Pa affiliation"}</span>
                  </article>
                ))
              ) : (
                <p>Nuk ka autorë të regjistruar.</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );

  const renderStatistics = () => (
    <section className="committee-page-card committee-stats-only-card">
      <div className="committee-page-head committee-stats-head">
        <div className="committee-stats-title-wrap">
          <span className="committee-stats-icon">
            <BarChart3 size={20} />
          </span>
          <div>
            <h3>Statistika per Fakultete dhe Departamente</h3>
            <p>Pamje krahasuese e publikimeve, projekteve dhe rimbursimeve sipas njesive akademike.</p>
          </div>
        </div>
        <button className="committee-api-chip" type="button">
          API Ready
        </button>
      </div>

      <div className="committee-chart-wrap">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={filteredFacultyStats} barGap={8} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8e0ea" />
            <XAxis dataKey="faculty" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.05)" }} />
            <Legend wrapperStyle={{ paddingTop: "20px" }} />
            <Bar dataKey="publikime" name="Publikime" radius={[8, 8, 0, 0]} fill="#153a63" />
            <Bar dataKey="projekte" name="Projekte" radius={[8, 8, 0, 0]} fill="#2e6aa6" />
            <Bar dataKey="rimbursime" name="Rimbursime" radius={[8, 8, 0, 0]} fill="#7aa7d3" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="committee-summary-grid">
        <article className="committee-summary-card">
          <span>Publikime Totale</span>
          <strong>{totals.publikime}</strong>
        </article>
        <article className="committee-summary-card">
          <span>Projekte Aktive</span>
          <strong>{totals.projekte}</strong>
        </article>
        <article className="committee-summary-card">
          <span>Rimbursime</span>
          <strong>{totals.rimbursime}</strong>
        </article>
      </div>

      <div className="committee-table-wrap committee-dept-table-wrap">
        <table className="committee-table">
          <thead>
            <tr>
              <th>Fakulteti</th>
              <th>Departamenti</th>
              <th>Publikime</th>
              <th>Projekte</th>
              <th>Rimbursime</th>
            </tr>
          </thead>
          <tbody>
            {filteredFacultyStats.map((item) => (
              <tr key={item.faculty}>
                <td>{item.faculty}</td>
                <td>{item.department}</td>
                <td>{item.publikime}</td>
                <td>{item.projekte}</td>
                <td>{item.rimbursime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  let resultCount = filteredPendingSubmissions.length;
  let content = renderPendingSubmissions();
  if (activePage === "Shqyrtimi") {
    resultCount = 0;
    content = (
      <ReimbursementReviewPanel
        role="committee"
        scope="review"
        searchQuery={searchQuery}
        title="Shqyrtimi i rimbursimeve"
        description="Kerkesat reale nga databaza per pranim, shqyrtim, korrigjim, aprovim ose refuzim nga komisioni."
        showReviewFilters
      />
    );
  }

  if (activePage === "Metadata") {
    resultCount = filteredMetadataPublications.length;
    content = renderMetadata();
  }

  if (activePage === "Vendimet") {
    resultCount = filteredConferences.length;
    content = renderSimpleTable(
      "Vendimet",
      "Vendimet e komisionit për dorëzimet akademike.",
      [
        { key: "id", label: "ID" },
        { key: "event", label: "Vendimi" },
        { key: "unit", label: "Njesia" },
        { key: "status", label: "Statusi" },
      ],
      filteredConferences
    );
  }

  if (activePage === "Auditimi") {
    resultCount = 0;
    content = (
      <ReimbursementReviewPanel
        role="committee"
        scope="review"
        searchQuery={searchQuery}
        title="Auditimi i rimbursimeve"
        description="Historiku institucional i kerkesave qe jane ne fazen e komisionit."
      />
    );
  }

  if (activePage === "Raporte") {
    resultCount = 0;
    content = (
      <ReimbursementReviewPanel
        role="committee"
        scope="review"
        searchQuery={searchQuery}
        title="Raporte te rimbursimeve"
        description="Statistikat dhe lista reale e kerkesave financiare qe i takojne fazes se komisionit."
      />
    );
  }

  if (activePage === "Njoftime") {
    resultCount = notifications.length;
    content = (
      <section className="committee-page-card committee-stats-only-card">
        <div className="committee-page-head committee-settings-head">
          <div>
            <h3>Njoftime</h3>
            <p>Shiko njoftimet e fundit te komisionit dhe statusin e tyre.</p>
          </div>
          <button
            className="committee-settings-back"
            type="button"
            onClick={markAllNotificationsAsRead}
            disabled={unreadNotifications === 0}
          >
            Sheno te gjitha si te lexuara
          </button>
        </div>
        <div className="committee-notification-list-detailed">
          {notifications.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`committee-notification-card ${item.isRead ? "is-read" : "is-unread"}`}
              onClick={() => markNotificationAsRead(item.id)}
            >
              <div className="committee-notification-card-meta">
                <span className="committee-notification-pill">{item.category || "Njoftim"}</span>
                <span>{item.createdAt}</span>
              </div>
              <h4>{item.title || item.text}</h4>
              <p>{item.description || item.text}</p>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (activePage === "Settings") {
    content = <CommitteeSettings onBack={() => setActivePage("Dorëzimet në Pritje")} />;
  }

  return (
    <div className="committee-layout">
      <CommitteeSidebar activePage={activePage} onNavigate={setActivePage} navLabels={navLabels} />

      <div className="committee-main">
        <CommitteeTopBar
          activePage={activePage}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          resultCount={resultCount}
          notificationCount={unreadNotifications}
          notifications={notifications}
          onMarkAllRead={markAllNotificationsAsRead}
          onNotificationRead={markNotificationAsRead}
          onProfileAction={handleProfileAction}
          profileMenuItems={profileMenuItems}
          profile={committeeProfile}
        />
        <div className="committee-content">{content}</div>
      </div>

      {isEditProfileOpen ? (
        <div className="committee-modal-overlay" role="dialog" aria-modal="true">
          <div className="committee-modal">
            <div className="committee-modal-header">
              <div>
                <h3 className="committee-modal-title">Edit Profile</h3>
                <p className="committee-modal-subtitle">Përditësoni informacionin bazë të komisionit.</p>
              </div>
              <button
                className="committee-modal-close"
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                aria-label="Mbyll"
              >
                ×
              </button>
            </div>
            <form className="committee-modal-form" onSubmit={handleCommitteeSave}>
              <div className="committee-form-grid">
                <label className="committee-form-field">
                  <span>Emri</span>
                  <input value={committeeDraft.name} onChange={handleCommitteeFieldChange("name")} />
                </label>
                <label className="committee-form-field">
                  <span>Roli</span>
                  <input value={committeeDraft.role} onChange={handleCommitteeFieldChange("role")} />
                </label>
                <label className="committee-form-field">
                  <span>Email</span>
                  <input type="email" value={committeeDraft.email} onChange={handleCommitteeFieldChange("email")} />
                </label>
                <label className="committee-form-field">
                  <span>Njësia</span>
                  <input value={committeeDraft.unit} onChange={handleCommitteeFieldChange("unit")} />
                </label>
              </div>
              <div className="committee-modal-actions">
                <button type="button" className="committee-btn-secondary" onClick={() => setIsEditProfileOpen(false)}>
                  Anulo
                </button>
                <button type="submit" className="committee-btn-primary">
                  Ruaj ndryshimet
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
