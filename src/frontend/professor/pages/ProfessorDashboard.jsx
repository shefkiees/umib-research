import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Link2,
  RefreshCw,
  Settings,
  ShieldX,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import DoiLookup from "../components/DoiLookup";
import ConferenceManager from "../components/ConferenceManager";
import ReimbursementManager from "../components/ReimbursementManager";
import { apiUrl } from "../../utils/api";

import {
  professorProfile,
  profileMenuItems,
} from "../data/dashboardData";
import "../styles/ProfessorDashboard.css";

const normalizeProfile = (user = {}) => ({
  name: user.name || user.displayName || user.full_name || professorProfile.name || "Professor",
  role: user.academicTitle || user.academic_title || professorProfile.role || "Professor",
  appRole: user.role || "professor",
  email: user.email || professorProfile.email,
  faculty: user.faculty || professorProfile.faculty,
  department: user.department || professorProfile.department,
  office: user.office || professorProfile.office,
  orcidId: user.orcidId || user.orcid_id || null,
  school: user.school || "",
  currentAffiliation: user.currentAffiliation || "",
  orcidProfile: user.orcidProfile || {},
  orcidEducations: Array.isArray(user.orcidEducations) ? user.orcidEducations : [],
  orcidEmployments: Array.isArray(user.orcidEmployments) ? user.orcidEmployments : [],
  orcidLastSyncedAt: user.orcidLastSyncedAt || null,
});

const formatAffiliation = (item = {}) => {
  const location = [item.city, item.region, item.country].filter(Boolean).join(", ");
  const dates = [item.startDate, item.endDate].filter(Boolean).join(" - ");

  return [item.organization, item.roleTitle, item.department, location, dates]
    .filter(Boolean)
    .join(" | ");
};

const DEFAULT_PROFESSOR_STATISTICS = {
  period: { range: "6m", months: 6, startMonth: null },
  summary: {
    publicationsTotal: 0,
    publicationsApproved: 0,
    publicationsInReview: 0,
    publicationsDraft: 0,
    citationsTotal: 0,
    conferencesTotal: 0,
    upcomingConferences: 0,
    reimbursementsTotal: 0,
    reimbursementsInReview: 0,
    reimbursementsApproved: 0,
    unreadNotifications: 0,
    requestedAmounts: [],
  },
  monthly: [],
  publicationsByStatus: [],
  reimbursementsByStatus: [],
  reimbursementsByType: [],
  generatedAt: null,
};

const MONTH_LABELS = ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nen", "Dhj"];

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Dorezuar",
  in_review: "Ne shqyrtim",
  approved: "Aprovuar",
  rejected: "Refuzuar",
  paid: "Paguar",
  unknown: "Pa status",
};

const REQUEST_TYPE_LABELS = {
  publication: "Publikime",
  conference: "Konferenca",
  project: "Projekte",
  unknown: "Te tjera",
};

const formatDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString().slice(0, 10);
};

const mapPublicationRow = (row = {}) => ({
  id: row.id || row.doi || row.title,
  title: row.title || "Pa titull",
  journal: row.venue || row.publisher || "Pa reviste/konference",
  year: row.publicationYear || row.publication_year || "",
  status: row.status || "draft",
  createdAt: row.createdAt || row.created_at || null,
});

const normalizeStatisticsPayload = (payload = {}) => ({
  ...DEFAULT_PROFESSOR_STATISTICS,
  ...payload,
  period: {
    ...DEFAULT_PROFESSOR_STATISTICS.period,
    ...(payload.period || {}),
  },
  summary: {
    ...DEFAULT_PROFESSOR_STATISTICS.summary,
    ...(payload.summary || {}),
    requestedAmounts: Array.isArray(payload.summary?.requestedAmounts)
      ? payload.summary.requestedAmounts
      : [],
  },
  monthly: Array.isArray(payload.monthly) ? payload.monthly : [],
  publicationsByStatus: Array.isArray(payload.publicationsByStatus) ? payload.publicationsByStatus : [],
  reimbursementsByStatus: Array.isArray(payload.reimbursementsByStatus) ? payload.reimbursementsByStatus : [],
  reimbursementsByType: Array.isArray(payload.reimbursementsByType) ? payload.reimbursementsByType : [],
});

const formatMonthLabel = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value || "");
  }

  return MONTH_LABELS[date.getUTCMonth()] || String(value || "");
};

const formatAmount = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "0";
  }

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
};

const formatRequestedAmounts = (amounts = []) => {
  if (!amounts.length) {
    return "0 EUR";
  }

  return amounts
    .filter((item) => Number(item.requested) > 0)
    .map((item) => `${formatAmount(item.requested)} ${item.currency || "EUR"}`)
    .join(" / ") || "0 EUR";
};

const getStatusLabel = (status) => STATUS_LABELS[status] || status;
const getRequestTypeLabel = (type) => REQUEST_TYPE_LABELS[type] || type;
const STATISTIC_METRIC_KEYS = ["publikime", "citime", "konferenca", "rimbursime"];

const hasStatisticMetricData = (rows = []) =>
  rows.some((row) =>
    STATISTIC_METRIC_KEYS.some((key) => Number(row[key] || 0) > 0)
  );

export default function ProfessorDashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orcidStatus = params.get("orcid");

    if (!orcidStatus) return;

    if (orcidStatus === "connected") {
      alert("ORCID u lidh me sukses!");
    } else if (orcidStatus === "user_not_found") {
      alert("User nuk u gjet në databazë.");
    } else {
      alert("Ndodhi një gabim gjatë lidhjes me ORCID.");
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);


  const [activePage, setActivePage] = useState("Statistika");
  const [searchQuery, setSearchQuery] = useState("");
  const [periodRange, setPeriodRange] = useState("6m");
  const [profile, setProfile] = useState(professorProfile);
  const [statisticsData, setStatisticsData] = useState(DEFAULT_PROFESSOR_STATISTICS);
  const [isStatisticsLoading, setIsStatisticsLoading] = useState(true);
  const [statisticsError, setStatisticsError] = useState("");
  const [publications, setPublications] = useState([]);
  const [isPublicationsLoading, setIsPublicationsLoading] = useState(true);
  const [publicationsError, setPublicationsError] = useState("");
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState(professorProfile);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const response = await fetch(apiUrl("/auth/me"), {
          credentials: "include",
        });

        if (response.status === 401) {
          navigate("/login", { replace: true });
          return;
        }

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const nextProfile = normalizeProfile(data.user);

        if (isMounted) {
          setProfile(nextProfile);
          setProfileDraft(nextProfile);
        }
      } catch (error) {
        console.error("Profile load failed:", error);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    let isMounted = true;

    const loadStatistics = async () => {
      setIsStatisticsLoading(true);
      setStatisticsError("");

      try {
        const response = await fetch(apiUrl(`/professor/stats?range=${periodRange}`), {
          credentials: "include",
        });

        if (response.status === 401) {
          throw new Error("stats_unauthorized");
        }

        if (!response.ok) {
          throw new Error("stats_load_failed");
        }

        const data = await response.json();

        if (isMounted) {
          setStatisticsData(normalizeStatisticsPayload(data));
        }
      } catch (error) {
        console.error("Statistics load failed:", error);

        if (isMounted) {
          setStatisticsError(
            error.message === "stats_unauthorized"
              ? "Statistikat nuk u ngarkuan sepse sesioni nuk u pranua nga API."
              : "Statistikat nuk u ngarkuan nga Supabase. Provoni perseri."
          );
          setStatisticsData(DEFAULT_PROFESSOR_STATISTICS);
        }
      } finally {
        if (isMounted) {
          setIsStatisticsLoading(false);
        }
      }
    };

    loadStatistics();

    return () => {
      isMounted = false;
    };
  }, [navigate, periodRange]);

  useEffect(() => {
    let isMounted = true;

    const loadPublications = async () => {
      setIsPublicationsLoading(true);
      setPublicationsError("");

      try {
        const response = await fetch(apiUrl("/publications"), {
          credentials: "include",
        });

        if (response.status === 401) {
          throw new Error("publications_unauthorized");
        }

        if (!response.ok) {
          throw new Error("publications_load_failed");
        }

        const data = await response.json();

        if (isMounted) {
          setPublications(Array.isArray(data) ? data.map(mapPublicationRow) : []);
        }
      } catch (error) {
        console.error("Publications load failed:", error);

        if (isMounted) {
          setPublications([]);
          setPublicationsError(
            error.message === "publications_unauthorized"
              ? "Publikimet nuk u ngarkuan sepse sesioni nuk u pranua nga API."
              : "Publikimet nuk u ngarkuan nga Supabase."
          );
        }
      } finally {
        if (isMounted) {
          setIsPublicationsLoading(false);
        }
      }
    };

    loadPublications();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const pageTitle = activePage;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const unreadNotifications = statisticsData.summary.unreadNotifications;

  const filteredPublications = useMemo(() => {
    if (!normalizedQuery) {
      return publications;
    }

    return publications.filter((row) =>
      `${row.title} ${row.journal} ${row.year} ${row.status}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, publications]);

  const statisticsChartData = useMemo(() => {
    return statisticsData.monthly.map((row) => ({
      ...row,
      month: formatMonthLabel(row.month),
      rawMonth: row.month,
    }));
  }, [statisticsData.monthly]);

  const filteredStatisticsChartData = useMemo(() => {
    if (!normalizedQuery) {
      return statisticsChartData;
    }

    return statisticsChartData.filter((row) =>
      `${row.month} ${row.publikime} ${row.citime} ${row.konferenca} ${row.rimbursime}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, statisticsChartData]);
  const hasStatisticsChartData = useMemo(
    () => hasStatisticMetricData(statisticsChartData),
    [statisticsChartData]
  );
  const hasFilteredStatisticsChartData = useMemo(
    () => hasStatisticMetricData(filteredStatisticsChartData),
    [filteredStatisticsChartData]
  );

  const filteredPublicationStatuses = useMemo(() => {
    if (!normalizedQuery) {
      return statisticsData.publicationsByStatus;
    }

    return statisticsData.publicationsByStatus.filter((row) =>
      `${getStatusLabel(row.status)} ${row.count}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, statisticsData.publicationsByStatus]);

  const filteredReimbursementStatuses = useMemo(() => {
    if (!normalizedQuery) {
      return statisticsData.reimbursementsByStatus;
    }

    return statisticsData.reimbursementsByStatus.filter((row) =>
      `${getStatusLabel(row.status)} ${row.count}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, statisticsData.reimbursementsByStatus]);

  const filteredReimbursementTypes = useMemo(() => {
    if (!normalizedQuery) {
      return statisticsData.reimbursementsByType;
    }

    return statisticsData.reimbursementsByType.filter((row) =>
      `${getRequestTypeLabel(row.type)} ${row.count}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, statisticsData.reimbursementsByType]);

  const handleMenuAction = (action) => {
    const normalizedAction = String(action || "").trim().toLowerCase();

    if (normalizedAction === "logout") {
      handleLogout();
      return;
    }

    if (normalizedAction === "editprofile" || normalizedAction === "edit-profile") {
      setProfileDraft(profile);
      setProfileError("");
      setIsEditProfileOpen(true);
      return;
    }

    if (normalizedAction === "orcidconnect" || normalizedAction === "orcid-connect") {
      window.location.href = apiUrl("/orcid/connect");
      return;
    }

    if (normalizedAction === "settings") {
      setActivePage("Settings");
      return;
    }

    if (normalizedAction === "integrime") {
      setActivePage("Integrime");
      return;
    }

    if (normalizedAction === "njoftime" || normalizedAction === "notifications") {
      setActivePage("Njoftime");
      return;
    }

    setActivePage(action);
  };

  const handleProfileFieldChange = (field) => (event) => {
    setProfileDraft((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setIsProfileSaving(true);
    setProfileError("");

    try {
      const response = await fetch(apiUrl("/auth/me"), {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: profileDraft.name,
          faculty: profileDraft.faculty,
          department: profileDraft.department,
          office: profileDraft.office,
        }),
      });

      if (response.status === 401) {
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error("profile_save_failed");
      }

      const data = await response.json();
      const nextProfile = normalizeProfile(data.user);

      setProfile(nextProfile);
      setProfileDraft(nextProfile);
      setIsEditProfileOpen(false);
    } catch (error) {
      console.error("Profile save failed:", error);
      setProfileError("Profili nuk u ruajt. Provoni perseri.");
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    sessionStorage.removeItem("authToken");
    navigate("/", { replace: true });
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const markNotificationAsRead = (id) => {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
  };

  const renderStatus = (value) => {
    const statusValue = String(value || "unknown");
    const statusClass = statusValue.toLowerCase().replace(/\s+/g, "-");

    return <span className={`status-badge ${statusClass}`}>{getStatusLabel(statusValue)}</span>;
  };


  const renderOverview = () => {
    const summary = statisticsData.summary;
    const quickStats = [
      {
        label: "Publikime aktive",
        value: summary.publicationsTotal,
        change: `${summary.publicationsApproved} aprovuar | ${summary.publicationsInReview} ne shqyrtim`,
        icon: <BookOpen size={22} />,
      },
      {
        label: "Konferenca te planifikuara",
        value: summary.conferencesTotal,
        change: `${summary.upcomingConferences} te ardhshme`,
        icon: <CalendarDays size={22} />,
      },
      {
        label: "Rimbursime ne proces",
        value: summary.reimbursementsInReview,
        change: `${summary.reimbursementsApproved} aprovuar | ${summary.reimbursementsTotal} gjithsej`,
        icon: <Wallet size={22} />,
      },
      {
        label: "ORCID",
        value: profile.orcidId ? 1 : 0,
        change: profile.orcidId ? "Profil i lidhur" : "Nuk eshte lidhur",
        icon: <Link2 size={22} />,
      },
    ];

    const quickActions = [
      { title: "Regjistro publikim", icon: <BookOpen size={20} />, page: "Publikime" },
      { title: "Dergo kerkese rimbursimi", icon: <Wallet size={20} />, page: "Rimbursime" },
      { title: "Planifiko konference", icon: <CalendarDays size={20} />, page: "Konferenca" },
      { title: "Perditeso profilin", icon: <Settings size={20} />, page: "Settings" },
    ];

    const latestPublications = publications.slice(0, 3).map((item) => ({
      id: item.id,
      icon: <BookOpen size={20} />,
      title: item.title,
      description: [item.journal, item.year].filter(Boolean).join(" | ") || "Publikim nga Supabase",
      time: formatDate(item.createdAt),
    }));

    return (
      <>
        <section className="prof-hero">
          <div>
            <span className="prof-badge">Academic Research Workflow</span>
            <h2>Pershendetje {profile.name}</h2>
            <p>
              Ke nje pasqyre te unifikuar per publikimet, konferencat, rimbursimet dhe
              integrimet akademike ne nje vend.
            </p>
          </div>
          <div className="prof-hero-actions">
            <button className="primary-btn" type="button" onClick={() => setActivePage("Publikime")}>
              Menaxho publikimet
            </button>
            <button className="secondary-btn" type="button" onClick={() => setActivePage("Statistika")}>
              Shiko statistikat
            </button>
          </div>
        </section>

        <section>
          <h3 className="prof-section-title">Pamje e shpejte</h3>
          <div className="prof-stats-grid">
            {quickStats.map((stat) => (
              <article key={stat.label} className="prof-stat-card">
                <div className="prof-stat-top">
                  <div>
                    <span className="prof-stat-title">{stat.label}</span>
                    <h3>{stat.value}</h3>
                    <p className="prof-stat-change">{stat.change}</p>
                  </div>
                  <div className="prof-stat-icon">{stat.icon}</div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="prof-grid-two">
          <article className="prof-card">
            <div className="prof-card-header">
              <div>
                <h3>Aktivitetet e fundit</h3>
                <p>Levizjet kryesore nga publikimet, konferencat dhe financat.</p>
              </div>
            </div>
            <div className="prof-list">
              {latestPublications.length ? (
                latestPublications.map((item) => (
                  <div className="prof-list-item" key={item.id}>
                    <div className="prof-list-icon">{item.icon}</div>
                    <div className="prof-list-content">
                      <h4>{item.title}</h4>
                      <p>{item.description}</p>
                    </div>
                    <span className="prof-list-time">{item.time}</span>
                  </div>
                ))
              ) : (
                <div className="prof-stats-empty">
                  {isPublicationsLoading ? "Duke ngarkuar te dhenat..." : "No data available yet."}
                </div>
              )}
            </div>
          </article>

          <article className="prof-card">
            <div className="prof-card-header">
              <div>
                <h3>Veprime te shpejta</h3>
                <p>Aksione te perdorura shpesh.</p>
              </div>
            </div>
            <div className="prof-quick-grid">
              {quickActions.map((item) => (
                <button
                  key={item.title}
                  className="prof-quick-item"
                  type="button"
                  onClick={() => setActivePage(item.page)}
                >
                  <div className="prof-quick-icon">{item.icon}</div>
                  <h4>{item.title}</h4>
                </button>
              ))}
            </div>
          </article>
        </section>
      </>
    );
  };

  const renderListSection = (title, description, rows, rowKey, formatter, emptyText = "No data available yet.") => (
    <article className="prof-card">
      <div className="prof-card-header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="prof-list">
        {rows.length ? (
          rows.map((row) => (
            <div className="prof-list-item" key={row[rowKey]}>
              <div className="prof-list-icon">{formatter.icon}</div>
              <div className="prof-list-content">
                <h4>{formatter.title(row)}</h4>
                <p>{formatter.description(row)}</p>
              </div>
              <div>{renderStatus(formatter.status(row))}</div>
            </div>
          ))
        ) : (
          <div className="prof-stats-empty">{emptyText}</div>
        )}
      </div>
    </article>
  );

  const renderStatisticsBreakdown = (title, description, rows, getLabel, emptyText, hasUnfilteredRows = rows.length > 0) => {
    const total = rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
    const resolvedEmptyText = normalizedQuery && hasUnfilteredRows
      ? "No results match your search"
      : emptyText;

    return (
      <article className="prof-card prof-stat-breakdown-card">
        <div className="prof-card-header">
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        </div>
        {rows.length ? (
          <div className="prof-stat-breakdown-list">
            {rows.map((row) => {
              const count = Number(row.count || 0);
              const percent = total > 0 ? Math.round((count / total) * 100) : 0;
              const label = getLabel(row);

              return (
                <div className="prof-stat-breakdown-row" key={label}>
                  <div className="prof-stat-breakdown-top">
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </div>
                  <div className="prof-stat-progress" aria-hidden="true">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="prof-stats-empty">{resolvedEmptyText}</div>
        )}
      </article>
    );
  };

  const renderStatistics = () => {
    const summary = statisticsData.summary;
    const statCards = [
      {
        label: "Publikime totale",
        value: summary.publicationsTotal,
        change: `${summary.publicationsApproved} aprovuar | ${summary.publicationsInReview} ne shqyrtim`,
        icon: <BookOpen size={22} />,
      },
      {
        label: "Citime nga metadata",
        value: summary.citationsTotal,
        change: "Nga DOI/Crossref kur ekziston fusha e citimeve",
        icon: <CheckCircle2 size={22} />,
      },
      {
        label: "Konferenca",
        value: summary.conferencesTotal,
        change: `${summary.upcomingConferences} te ardhshme`,
        icon: <CalendarDays size={22} />,
      },
      {
        label: "Rimbursime",
        value: summary.reimbursementsTotal,
        change: `${formatRequestedAmounts(summary.requestedAmounts)} te kerkuara`,
        icon: <Wallet size={22} />,
      },
    ];

    return (
      <div className="prof-statistics-layout">
        {statisticsError ? (
          <div className="prof-stats-message error" role="alert">
            {statisticsError}
          </div>
        ) : null}

        <section className="prof-stats-grid">
          {statCards.map((stat) => (
            <article key={stat.label} className="prof-stat-card">
              <div className="prof-stat-top">
                <div>
                  <span className="prof-stat-title">{stat.label}</span>
                  <h3>{isStatisticsLoading ? "..." : stat.value}</h3>
                  <p className="prof-stat-change">{stat.change}</p>
                </div>
                <div className="prof-stat-icon">{stat.icon}</div>
              </div>
            </article>
          ))}
        </section>

        <article className="prof-card prof-stat-chart-card">
          <div className="prof-card-header">
            <div>
              <h3>Statistika akademike</h3>
              <p>Ecuria reale nga Supabase per publikime, citime, konferenca dhe rimbursime.</p>
            </div>
            <div className="prof-filter-wrap">
              <label htmlFor="prof-period-filter">Periudha</label>
              <select
                id="prof-period-filter"
                className="prof-filter-select"
                value={periodRange}
                onChange={(event) => setPeriodRange(event.target.value)}
              >
                <option value="1m">1 muaj</option>
                <option value="2m">2 muaj</option>
                <option value="6m">6 muaj</option>
                <option value="12m">12 muaj</option>
              </select>
            </div>
          </div>

          {isStatisticsLoading ? (
            <div className="prof-stats-empty">
              <RefreshCw size={18} className="prof-stats-spin" />
              {statisticsData.generatedAt ? "Updating statistics..." : "Loading statistics..."}
            </div>
          ) : statisticsError ? (
            <div className="prof-stats-empty">
              Statistics could not be loaded. Please try again.
            </div>
          ) : normalizedQuery && hasStatisticsChartData && !hasFilteredStatisticsChartData ? (
            <div className="prof-stats-empty">
              No results match your search
            </div>
          ) : hasFilteredStatisticsChartData ? (
            <div className="prof-stat-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredStatisticsChartData} barGap={10}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8e0ea" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="publikime" name="Publikime" radius={[8, 8, 0, 0]} fill="#153a63" />
                  <Bar dataKey="citime" name="Citime" radius={[8, 8, 0, 0]} fill="#2e6aa6" />
                  <Bar dataKey="konferenca" name="Konferenca" radius={[8, 8, 0, 0]} fill="#7aa7d3" />
                  <Bar dataKey="rimbursime" name="Rimbursime" radius={[8, 8, 0, 0]} fill="#c9a24f" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="prof-stats-empty">
              No statistics data available yet
            </div>
          )}
        </article>

        <section className="prof-status-grid">
          {renderStatisticsBreakdown(
            "Publikime sipas statusit",
            "Shperndarja e publikimeve te ruajtura nga profesori.",
            filteredPublicationStatuses,
            (row) => getStatusLabel(row.status),
            "Nuk ka publikime te ruajtura.",
            statisticsData.publicationsByStatus.length > 0
          )}

          {renderStatisticsBreakdown(
            "Rimbursime sipas statusit",
            "Gjendja aktuale e kerkesave financiare.",
            filteredReimbursementStatuses,
            (row) => getStatusLabel(row.status),
            "Nuk ka rimbursime te ruajtura.",
            statisticsData.reimbursementsByStatus.length > 0
          )}

          {renderStatisticsBreakdown(
            "Rimbursime sipas llojit",
            "Kategorite e kerkesave te dorezuara.",
            filteredReimbursementTypes,
            (row) => getRequestTypeLabel(row.type),
            "Nuk ka lloje rimbursimi per t'u shfaqur.",
            statisticsData.reimbursementsByType.length > 0
          )}
        </section>
      </div>
    );
  };

  const renderContent = () => {
    switch (activePage) {
      case "Overview":
        return renderOverview();
      case "Publikime":
        return (
          <>
            <article className="prof-card" style={{ marginBottom: "20px" }}>
              <div className="prof-card-header">
                <div>
                  <h3>Shto publikim me DOI</h3>
                  <p>
                    Shkruani DOI e publikimit dhe sistemi do të marrë automatikisht
                    metadata si titulli, autorët, journal/conference, viti dhe të dhëna të tjera.
                  </p>
                </div>
              </div>

              <DoiLookup />
            </article>

            {renderListSection(
              "Publikime",
              "Regjistri i publikimeve me statusin aktual.",
              filteredPublications,
              "id",
              {
                icon: <BookOpen size={20} />,
                title: (row) => row.title,
                description: (row) => `${row.journal} • ${row.year}`,
                status: (row) => row.status,
              },
              publicationsError || (isPublicationsLoading ? "Duke ngarkuar publikimet nga Supabase..." : "No data available yet.")
            )}
          </>
        );

      case "Konferenca":
        return (
          <>
            <article className="prof-card" style={{ marginBottom: "20px" }}>
              <div className="prof-card-header">
                <div>
                  <h3>Shto dhe Menaxho Konferenca</h3>
                  <p>
                    Regjistro konferenca, afate submissions dhe menaxho
                    pjesëmarrjet shkencore.
                  </p>
                </div>
              </div>

              <ConferenceManager />
            </article>
          </>
        );

      case "Rimbursime":
        return (
          <ReimbursementManager
            profile={profile}
            searchQuery={searchQuery}
          />
        );

      case "Statistika":
        return renderStatistics();

      case "Integrime":
        return (
          <article className="prof-card">
            <div className="prof-integration-header">
              <div>
                <h3>Integrime</h3>
                <p>Sherbimet e jashtme te lidhura.</p>
              </div>
              <button type="button" className="prof-integration-manage-btn" onClick={() => setActivePage("Settings")}>
                Menaxho
              </button>
            </div>
            <div className="prof-integration-list">
              <article className="prof-integration-item">
                <div className={`prof-integration-mark ${profile.orcidId ? "connected" : "not-connected"}`}>
                  {profile.orcidId ? <CheckCircle2 size={22} /> : <ShieldX size={22} />}
                </div>
                <div className="prof-integration-copy">
                  <h4>ORCID</h4>
                  <p>{profile.orcidId || "No data available yet."}</p>
                </div>
                <span className={`status-badge ${profile.orcidId ? "connected" : "not-connected"}`}>
                  {profile.orcidId ? "Connected" : "Not connected"}
                </span>
              </article>
            </div>
          </article>
        );

      case "Njoftime":
        return (
          <article className="prof-card">
            <div className="prof-card-header">
              <div>
                <h3>Njoftime</h3>
                <p>Perditesimet me te rendesishme per afatet dhe dokumentet.</p>
              </div>
              <button
                type="button"
                className="prof-integration-manage-btn"
                onClick={markAllNotificationsAsRead}
                disabled={unreadNotifications === 0 || notifications.length === 0}
              >
                Sheno te gjitha si te lexuara
              </button>
            </div>
            <div className="prof-notification-list">
              {notifications.length ? (
                notifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`prof-notification-item ${item.isRead ? "neutral" : "info"}`}
                    onClick={() => markNotificationAsRead(item.id)}
                  >
                    <div className="prof-notification-item-head">
                      <span className="prof-notification-pill">{item.category || "Njoftim"}</span>
                      <span>{item.createdAt}</span>
                    </div>
                    <h4>{item.title || item.text}</h4>
                    <p>{item.description || item.text}</p>
                  </button>
                ))
              ) : (
                <div className="prof-stats-empty">No data available yet.</div>
              )}
            </div>
          </article>
        );

      case "Settings":
        return (
          <div className="prorector-table-section">
            <h2>Settings</h2>
            <p>Konfigurimet kryesore për profilin dhe panelin kërkimor.</p>

            <div className="prorector-settings-grid">
              {/* Card: Informacionet e Profilit */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <Settings size={20} />
                  </div>
                  <h3>Informacionet e Profilit</h3>
                </div>
                <div className="prorector-settings-list">
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">Emri i plotë</span>
                    <strong className="prorector-settings-value">{profile.name}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">Titulli Akademik</span>
                    <strong className="prorector-settings-value">{profile.role}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">Adresa Email</span>
                    <strong className="prorector-settings-value">{profile.email}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">ORCID iD</span>
                    <strong className="prorector-settings-value">{profile.orcidId || "Nuk eshte lidhur"}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">Shkolla nga ORCID</span>
                    <strong className="prorector-settings-value">{profile.school || "Nuk ka te dhena publike"}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">Affiliation nga ORCID</span>
                    <strong className="prorector-settings-value">{profile.currentAffiliation || "Nuk ka te dhena publike"}</strong>
                  </div>
                  <button className="prorector-settings-edit-btn" onClick={() => handleMenuAction("EditProfile")}>
                    Ndrysho të dhënat
                  </button>
                </div>
              </article>

              {/* Card: Preferencat e Sistemit */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <BookOpen size={20} />
                  </div>
                  <h3>Preferencat e Sistemit</h3>
                </div>
                <div className="prorector-settings-options">
                  <div className="prorector-settings-option-item">
                    <div className="prorector-settings-option-info">
                      <span className="prorector-settings-label">Njoftime me email</span>
                      <p className="prorector-settings-subtext">Merr njoftime për çdo publikim ose rimbursim</p>
                    </div>
                    <label className="prorector-switch">
                      <input type="checkbox" defaultChecked />
                      <span className="prorector-slider"></span>
                    </label>
                  </div>

                  <div className="prorector-settings-option-item">
                    <div className="prorector-settings-option-info">
                      <span className="prorector-settings-label">Gjuha e Ndërfaqes</span>
                    </div>
                    <select className="prorector-settings-select" defaultValue="Shqip">
                      <option>Shqip</option>
                      <option>English</option>
                    </select>
                  </div>
                </div>
              </article>

              {/* Card: Siguria */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <ShieldX size={20} />
                  </div>
                  <h3>Siguria & Llogaria</h3>
                </div>
                <div className="prorector-settings-list">
                  <p className="prorector-settings-subtext">Menaxho sigurinë e dritares tuaj kërkimore.</p>
                  <button className="prorector-settings-action-btn">
                    Ndrysho fjalëkalimin
                  </button>
                </div>
              </article>

              {/* Card: API & Integrimet */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <Link2 size={20} />
                  </div>
                  <h3>API & Integrimet</h3>
                </div>
                <div className="prorector-settings-list">
                  <p className="prorector-settings-subtext">Lidh profilin tuaj me platformat ndërkombëtare.</p>
                  <button
                    type="button"
                    className="prorector-settings-action-btn"
                    onClick={() => {
                      window.location.href = apiUrl("/orcid/connect");
                    }}
                  >
                    {profile.orcidId ? "Rifresko nga ORCID" : "Connect with ORCID"}
                  </button>
                  <button className="prorector-settings-action-btn" onClick={() => setActivePage("Integrime")}>
                    Shiko Integrimet
                  </button>
                </div>
              </article>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="prof-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        onLogout={handleLogout}
      />

      <div className="prof-main">
        <TopBar
          activePage={pageTitle}
          profile={profile}
          menuItems={profileMenuItems}
          notificationCount={unreadNotifications}
          onMenuAction={handleMenuAction}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          notifications={notifications}
          onMarkAllRead={markAllNotificationsAsRead}
          onNotificationAction={markNotificationAsRead}
        />

        <div className="prof-content">{renderContent()}</div>
      </div>

      {isEditProfileOpen ? (
        <div className="prof-modal-overlay" role="dialog" aria-modal="true">
          <div className="prof-modal">
            <div className="prof-modal-header">
              <div>
                <h3 className="prof-modal-title">Edit Profile</h3>
                <p className="prof-modal-subtitle">Përditësoni të dhënat bazë të profilit.</p>
              </div>
              <button
                className="prof-modal-close"
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                aria-label="Mbyll"
              >
                ×
              </button>
            </div>
            <form className="prof-modal-form" onSubmit={handleProfileSave}>
              <p className="prof-modal-note">
                Emri, email-i dhe ORCID iD merren automatikisht nga ORCID/llogaria. Ketu ruhen vetem te dhenat lokale te profilit.
              </p>
              <div className="prof-form-grid">
                <label className="prof-form-field">
                  <span>Emri dhe mbiemri</span>
                  <input value={profileDraft.name} readOnly />
                </label>
                <label className="prof-form-field">
                  <span>Roli</span>
                  <input value={profileDraft.role} readOnly />
                </label>
                <label className="prof-form-field">
                  <span>Email</span>
                  <input type="email" value={profileDraft.email} readOnly />
                </label>
                <label className="prof-form-field">
                  <span>ORCID iD</span>
                  <input value={profileDraft.orcidId || "Nuk eshte lidhur"} readOnly />
                </label>
                <label className="prof-form-field">
                  <span>Shkolla nga ORCID</span>
                  <input value={profileDraft.school || "Nuk ka te dhena publike"} readOnly />
                </label>
                <label className="prof-form-field">
                  <span>Affiliation nga ORCID</span>
                  <input value={profileDraft.currentAffiliation || "Nuk ka te dhena publike"} readOnly />
                </label>
                <label className="prof-form-field">
                  <span>Fakulteti</span>
                  <input value={profileDraft.faculty} onChange={handleProfileFieldChange("faculty")} />
                </label>
                <label className="prof-form-field">
                  <span>Departamenti</span>
                  <input value={profileDraft.department} onChange={handleProfileFieldChange("department")} />
                </label>
                <label className="prof-form-field">
                  <span>Zyra</span>
                  <input value={profileDraft.office} onChange={handleProfileFieldChange("office")} />
                </label>
              </div>
              {profileDraft.orcidEducations.length || profileDraft.orcidEmployments.length || profileDraft.orcidProfile?.biography || profileDraft.orcidProfile?.keywords?.length || profileDraft.orcidProfile?.researcherUrls?.length ? (
                <div className="prof-orcid-details">
                  {profileDraft.orcidProfile?.biography || profileDraft.orcidProfile?.keywords?.length || profileDraft.orcidProfile?.researcherUrls?.length ? (
                    <div>
                      <h4>Detaje nga ORCID</h4>
                      {profileDraft.orcidProfile?.biography ? <p>{profileDraft.orcidProfile.biography}</p> : null}
                      {profileDraft.orcidProfile?.keywords?.length ? (
                        <p>Keywords: {profileDraft.orcidProfile.keywords.slice(0, 8).join(", ")}</p>
                      ) : null}
                      {profileDraft.orcidProfile?.researcherUrls?.slice(0, 3).map((item) => (
                        <p key={`url-${item.url || item.name}`}>{[item.name, item.url].filter(Boolean).join(" | ")}</p>
                      ))}
                    </div>
                  ) : null}
                  {profileDraft.orcidEducations.length ? (
                    <div>
                      <h4>Edukimi nga ORCID</h4>
                      {profileDraft.orcidEducations.slice(0, 3).map((item) => (
                        <p key={`education-${item.putCode || formatAffiliation(item)}`}>{formatAffiliation(item)}</p>
                      ))}
                    </div>
                  ) : null}
                  {profileDraft.orcidEmployments.length ? (
                    <div>
                      <h4>Punesimi nga ORCID</h4>
                      {profileDraft.orcidEmployments.slice(0, 3).map((item) => (
                        <p key={`employment-${item.putCode || formatAffiliation(item)}`}>{formatAffiliation(item)}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {profileError ? <p className="prof-modal-error" role="alert">{profileError}</p> : null}
              {!profileDraft.orcidId ? (
                <button type="button" className="prof-orcid-link-btn" onClick={() => handleMenuAction("OrcidConnect")}>
                  Lidhe me ORCID per te mbushur profilin automatikisht
                </button>
              ) : null}
              <div className="prof-modal-actions">
                <button type="button" className="prof-btn-secondary" onClick={() => setIsEditProfileOpen(false)} disabled={isProfileSaving}>
                  Anulo
                </button>
                <button type="submit" className="prof-btn-primary" disabled={isProfileSaving}>
                  {isProfileSaving ? "Duke ruajtur..." : "Ruaj ndryshimet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
