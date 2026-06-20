import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Building2,
  Download,
  ExternalLink,
  FileText,
  LibraryBig,
  Minus,
  RefreshCw,
  Search,
  Save,
  TrendingUp,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "../styles/ProRectorDashboard.css";
import ProRectorSidebar from "../components/Sidebar";
import ProRectorTopBar from "../components/TopBar";
import { apiUrl } from "../../utils/api";

const CHART_COLORS = ["#1d4d7d", "#15803d", "#c9a24f", "#be123c", "#6d5bd0", "#0f766e", "#b45309", "#475569"];
const QUARTILE_COLORS = {
  Q1: "#15803d",
  Q2: "#2563eb",
  Q3: "#d97706",
  Q4: "#64748b",
  "Pa verifikim": "#94a3b8",
};

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Në Shqyrtim",
  in_review: "Në Shqyrtim",
  correction: "Korrigjim",
  needs_correction: "Korrigjim",
  approved: "Aprovuar",
  rejected: "Refuzuar",
  paid: "Paguar",
};

const PUBLICATION_TYPES = {
  journal_article: "Artikull reviste",
  conference_paper: "Punim konference",
  book: "Libër",
  book_chapter: "Kapitull libri",
};

const PUBLICATION_STATUS_OPTIONS = ["approved", "in_review", "correction", "rejected"];

const DEFAULT_PROFILE = {
  name: "Prorektor për Kërkim Shkencor",
  role: "Monitorim dhe raporte",
};

const EMPTY_PROFILE_DRAFT = {
  name: "",
  email: "",
  role: "",
  faculty: "",
  department: "",
  office: "",
  academicTitle: "",
  scientificTitle: "",
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("sq-AL").format(toNumber(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("sq-AL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function normalizeStatus(value) {
  if (value === "needs_correction") return "correction";
  if (value === "submitted") return "in_review";
  return value || "draft";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("sq-AL").format(date);
}

function statusClass(value) {
  return String(normalizeStatus(value)).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function normalizeQuartile(value) {
  const quartile = String(value || "").trim().toUpperCase();
  return ["Q1", "Q2", "Q3", "Q4"].includes(quartile) ? quartile : "Pa verifikim";
}

function trendMeta(current, previous) {
  if (!previous && !current) return { label: "Pa ndryshim", direction: "flat", icon: Minus };
  if (!previous) return { label: "Vit i ri", direction: current ? "up" : "flat", icon: current ? TrendingUp : Minus };
  const diff = current - previous;
  const percent = Math.round((diff / previous) * 100);
  return {
    label: `${diff >= 0 ? "+" : ""}${percent}% ndaj vitit të kaluar`,
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
    icon: diff === 0 ? Minus : TrendingUp,
  };
}

function getPublicationTypeLabel(value, fallback) {
  return fallback || PUBLICATION_TYPES[value] || value || "-";
}

function getPublicationStatusLabel(value, fallback) {
  const normalized = normalizeStatus(value);
  if (normalized === "approved") return "Aprovuar";
  if (normalized === "in_review") return "Në Shqyrtim";
  if (normalized === "correction") return "Korrigjim";
  if (normalized === "rejected") return "Refuzuar";
  return fallback || STATUS_LABELS[normalized] || value || "-";
}

function getPublicationVenue(row) {
  return row.venue || row.publishedIn || row.publisher || "-";
}

function buildPublicationAnalytics(rows, faculties) {
  const nowYear = new Date().getFullYear();
  const previousYear = nowYear - 1;
  const countWhere = (predicate, year) => rows.filter((row) => predicate(row) && (!year || toNumber(row.year) === year)).length;
  const activeFaculties = new Set(rows.map((row) => row.faculty).filter(Boolean));
  const authorCounts = new Map();
  const facultyCounts = new Map();
  const byYear = new Map();
  const byQuartile = new Map([["Q1", 0], ["Q2", 0], ["Q3", 0], ["Q4", 0], ["Pa verifikim", 0]]);

  rows.forEach((row) => {
    if (row.year) byYear.set(String(row.year), (byYear.get(String(row.year)) || 0) + 1);
    if (row.faculty) facultyCounts.set(row.faculty, (facultyCounts.get(row.faculty) || 0) + 1);
    byQuartile.set(normalizeQuartile(row.quartile), (byQuartile.get(normalizeQuartile(row.quartile)) || 0) + 1);

    const authors = Array.isArray(row.authors) && row.authors.length
      ? row.authors.map((author) => author.fullName).filter(Boolean)
      : [row.mainAuthor || row.authorNames?.split(",")[0]].filter(Boolean);
    authors.forEach((name) => authorCounts.set(name, (authorCounts.get(name) || 0) + 1));
  });

  const sciePredicate = (row) => /SCI|SCIE|SSCI|AHCI/i.test(`${row.indexing} ${row.platform} ${row.regulationCategory}`);
  const scopusQ1Q2Predicate = (row) => /scopus/i.test(`${row.platform} ${row.regulationCategory}`) && ["Q1", "Q2"].includes(normalizeQuartile(row.quartile));
  const conferencePredicate = (row) => row.type === "conference_paper" || /konference/i.test(row.typeLabel || "");
  const booksPredicate = (row) => ["book", "book_chapter"].includes(row.type) || /lib|kapitull/i.test(row.typeLabel || "");

  const kpis = [
    { label: "Publikime Totale", value: rows.length, predicate: () => true, icon: BookOpen },
    { label: "Publikime SCI/SCIE/SSCI/AHCI", value: countWhere(sciePredicate), predicate: sciePredicate, icon: TrendingUp },
    { label: "Publikime Scopus Q1-Q2", value: countWhere(scopusQ1Q2Predicate), predicate: scopusQ1Q2Predicate, icon: BarChart3 },
    { label: "Punime Konference", value: countWhere(conferencePredicate), predicate: conferencePredicate, icon: FileText },
    { label: "Libra / Kapituj", value: countWhere(booksPredicate), predicate: booksPredicate, icon: LibraryBig },
    { label: "Fakultete Aktive", value: activeFaculties.size || faculties.filter((faculty) => faculty.status === "active").length, predicate: () => false, icon: Building2, noYearCompare: true },
    { label: "Autorë Aktivë", value: authorCounts.size, predicate: () => false, icon: UsersRound, noYearCompare: true },
    { label: "Publikime këtë vit", value: countWhere(() => true, nowYear), predicate: (row) => toNumber(row.year) === nowYear, icon: TrendingUp },
  ].map((card) => ({
    ...card,
    trend: card.noYearCompare
      ? { label: "Nga të dhënat aktive", direction: "flat", icon: Minus }
      : trendMeta(countWhere(card.predicate, nowYear), countWhere(card.predicate, previousYear)),
  }));

  const publicationsByYear = Array.from(byYear.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => Number(a.name) - Number(b.name));
  const publicationsByFaculty = Array.from(facultyCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const publicationsByQuartile = Array.from(byQuartile.entries()).map(([name, value]) => ({ name, value }));
  const topAuthors = Array.from(authorCounts.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  const topFaculties = Array.from(facultyCounts.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  return { kpis, publicationsByYear, publicationsByFaculty, publicationsByQuartile, topAuthors, topFaculties };
}

function useProrectorResource(path, fallback) {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(apiUrl(path), { credentials: "include" });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.message || "load_failed");
        }

        if (mounted) setData(payload);
      } catch (err) {
        console.error(`Prorector resource failed: ${path}`, err);
        if (mounted) {
          setData(fallback);
          setError("Të dhënat nuk u ngarkuan. Provoni përsëri.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [path]);

  return { data, loading, error };
}

function ChartEmpty({ message = "Nuk ka të dhëna për këtë grafik." }) {
  return (
    <div className="prorector-chart-empty">
      <BarChart3 size={22} />
      <span>{message}</span>
    </div>
  );
}

function StateBlock({ loading, error, empty, emptyText = "Nuk ka të dhëna për t'u shfaqur." }) {
  if (loading) {
    return (
      <div className="prorector-faculty-detail-loading">
        <RefreshCw size={18} className="prorector-spin" />
        <span>Duke ngarkuar të dhënat...</span>
      </div>
    );
  }

  if (error) return <div className="prorector-inline-alert" role="alert">{error}</div>;
  if (empty) return <div className="prorector-faculty-empty">{emptyText}</div>;
  return null;
}

function FilterBar({ filters, onChange, faculties, publicationMode = false, fundingMode = false }) {
  if (publicationMode) {
    return (
      <div className="prorector-publication-filterbar">
        <input
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Kërko publikim, autor ose DOI"
        />
        <select value={filters.faculty} onChange={(event) => onChange({ ...filters, faculty: event.target.value })}>
          <option value="">Fakulteti</option>
          {faculties.map((faculty) => (
            <option key={faculty.id || faculty.name} value={faculty.name}>{faculty.name}</option>
          ))}
        </select>
        <input
          value={filters.year}
          onChange={(event) => onChange({ ...filters, year: event.target.value })}
          placeholder="Viti"
        />
        <select value={filters.type} onChange={(event) => onChange({ ...filters, type: event.target.value })}>
          <option value="">Tipi</option>
          {Object.entries(PUBLICATION_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input
          value={filters.platform}
          onChange={(event) => onChange({ ...filters, platform: event.target.value })}
          placeholder="Platforma e indeksimit"
        />
        <select value={filters.quartile} onChange={(event) => onChange({ ...filters, quartile: event.target.value })}>
          <option value="">Kuartili</option>
          {["Q1", "Q2", "Q3", "Q4"].map((value) => <option key={value} value={value}>{value}</option>)}
          <option value="Pa verifikim">Pa verifikim</option>
        </select>
        <select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
          <option value="">Statusi</option>
          {PUBLICATION_STATUS_OPTIONS.map((value) => (
            <option key={value} value={value}>{STATUS_LABELS[value]}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="prorector-bi-filterbar">
      <span className="prorector-bi-filter-title"><Search size={16} /> Filtra</span>
      <input
        value={filters.search}
        onChange={(event) => onChange({ ...filters, search: event.target.value })}
        placeholder="Kërko..."
      />
      <input
        value={filters.year}
        onChange={(event) => onChange({ ...filters, year: event.target.value })}
        placeholder="Vit"
      />
      <select value={filters.faculty} onChange={(event) => onChange({ ...filters, faculty: event.target.value })}>
        <option value="">Të gjitha fakultetet</option>
        {faculties.map((faculty) => (
          <option key={faculty.id || faculty.name} value={faculty.name}>{faculty.name}</option>
        ))}
      </select>
      {publicationMode ? (
        <>
          <select value={filters.type} onChange={(event) => onChange({ ...filters, type: event.target.value })}>
            <option value="">Tipi i publikimit</option>
            {Object.entries(PUBLICATION_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input
            value={filters.platform}
            onChange={(event) => onChange({ ...filters, platform: event.target.value })}
            placeholder="Platformë indeksimi"
          />
          <select value={filters.quartile} onChange={(event) => onChange({ ...filters, quartile: event.target.value })}>
            <option value="">Kuartili</option>
            {["Q1", "Q2", "Q3", "Q4"].map((value) => <option key={value} value={value}>{value}</option>)}
            <option value="Pa verifikim">Pa verifikim</option>
          </select>
        </>
      ) : null}
      {fundingMode ? (
        <select value={filters.type} onChange={(event) => onChange({ ...filters, type: event.target.value })}>
          <option value="">Lloji i financimit</option>
          <option value="Financim për publikime shkencore">Publikime shkencore</option>
          <option value="Financim për konferenca/simpoziume">Konferenca/Simpoziume</option>
          <option value="Financim për projekte shkencore">Projekte shkencore</option>
        </select>
      ) : null}
      <select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
        <option value="">Statusi</option>
        {["draft", "submitted", "in_review", "correction", "approved", "rejected"].map((value) => (
          <option key={value} value={value}>{STATUS_LABELS[value]}</option>
        ))}
      </select>
    </div>
  );
}

function AnalyticsCharts({ charts = {} }) {
  const categoryRows = charts.publicationsByCategory || [];
  const statusRows = charts.requestsByStatus || [];
  const publicationsByYear = charts.publicationsByYear || [];
  const fundingByYear = charts.fundingByYear || [];

  return (
    <div className="prorector-analytics-grid">
      <article className="prorector-analytics-card">
        <div className="prorector-card-head"><h3>Publikimet sipas viteve</h3><TrendingUp size={20} /></div>
        {publicationsByYear.some((row) => toNumber(row.value) > 0) ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={publicationsByYear}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Publikime" fill="#1d4d7d" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <ChartEmpty />}
      </article>

      <article className="prorector-analytics-card">
        <div className="prorector-card-head"><h3>Financimet sipas viteve</h3><WalletCards size={20} /></div>
        {fundingByYear.some((row) => toNumber(row.value) > 0) ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={fundingByYear}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="value" name="Financime" fill="#15803d" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <ChartEmpty />}
      </article>

      <article className="prorector-analytics-card">
        <div className="prorector-card-head"><h3>Publikimet sipas kategorive</h3><BookOpen size={20} /></div>
        {categoryRows.some((row) => toNumber(row.value) > 0) ? (
          <ResponsiveContainer width="100%" height={310}>
            <PieChart>
              <Pie data={categoryRows} dataKey="value" nameKey="name" outerRadius={95}>
                {categoryRows.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : <ChartEmpty />}
      </article>

      <article className="prorector-analytics-card">
        <div className="prorector-card-head"><h3>Kërkesat sipas statusit</h3><FileText size={20} /></div>
        {statusRows.some((row) => toNumber(row.value) > 0) ? (
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={statusRows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickFormatter={(value) => STATUS_LABELS[value] || value} />
              <YAxis allowDecimals={false} />
              <Tooltip labelFormatter={(value) => STATUS_LABELS[value] || value} />
              <Bar dataKey="value" name="Kërkesa" fill="#c9a24f" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <ChartEmpty />}
      </article>
    </div>
  );
}

export default function ProRectorDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activePage, setActivePage] = useState(location.state?.activePage || "Dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ search: "", year: "", faculty: "", type: "", platform: "", quartile: "", status: "" });
  const [selectedPublication, setSelectedPublication] = useState(null);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileDraft, setProfileDraft] = useState(EMPTY_PROFILE_DRAFT);

  const overview = useProrectorResource("/prorector/overview", { kpis: {}, charts: {} });
  const faculties = useProrectorResource("/prorector/faculties", { faculties: [] });
  const publications = useProrectorResource(`/prorector/publications?${new URLSearchParams({
    search: filters.search || searchQuery,
    year: filters.year,
    faculty: filters.faculty,
    type: filters.type,
    platform: filters.platform,
    quartile: filters.quartile,
    status: filters.status,
  }).toString()}`, { publications: [] });
  const funding = useProrectorResource(`/prorector/funding?${new URLSearchParams({
    search: filters.search || searchQuery,
    year: filters.year,
    faculty: filters.faculty,
    type: filters.type,
    status: filters.status,
  }).toString()}`, { funding: [] });

  const facultyRows = faculties.data.faculties || [];
  const publicationRows = publications.data.publications || [];
  const fundingRows = funding.data.funding || [];
  const kpis = overview.data.kpis || {};
  const charts = overview.data.charts || {};
  const publicationAnalytics = useMemo(
    () => buildPublicationAnalytics(publicationRows, facultyRows),
    [publicationRows, facultyRows]
  );

  const filteredFacultyRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return facultyRows;
    return facultyRows.filter((row) => `${row.name} ${row.code} ${row.statusLabel}`.toLowerCase().includes(query));
  }, [facultyRows, searchQuery]);

  const exportRows = (filename, rows) => {
    const csv = rows.length
      ? [Object.keys(rows[0]).join(","), ...rows.map((row) => Object.values(row).map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))].join("\n")
      : "";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const applyProfileUser = (user = {}) => {
    const nextProfile = {
      name: user.name || user.fullName || DEFAULT_PROFILE.name,
      role: user.role === "prorector" ? "Prorektor për Kërkim Shkencor" : user.role || DEFAULT_PROFILE.role,
    };

    setProfile(nextProfile);
    setProfileDraft({
      name: user.name || user.fullName || "",
      email: user.email || "",
      role: nextProfile.role,
      faculty: user.faculty || "",
      department: user.department || "",
      office: user.office || "",
      academicTitle: user.academicTitle || user.academic_title || "",
      scientificTitle: user.scientificTitle || user.scientific_title || "",
    });
  };

  const loadProfile = async ({ openModal = false } = {}) => {
    if (openModal) setIsProfileModalOpen(true);
    setIsProfileLoading(true);
    setProfileError("");

    try {
      const response = await fetch(apiUrl("/auth/me"), { credentials: "include" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.user) {
        throw new Error("profile_load_failed");
      }

      applyProfileUser(data.user);
    } catch (error) {
      console.error("Prorector profile load failed:", error);
      setProfileError("Profili nuk u ngarkua.");
    } finally {
      setIsProfileLoading(false);
    }
  };

  const openProfileEditor = () => {
    loadProfile({ openModal: true });
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileDraft.name,
          faculty: profileDraft.faculty,
          department: profileDraft.department,
          office: profileDraft.office,
          academicTitle: profileDraft.academicTitle,
          scientificTitle: profileDraft.scientificTitle,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.user) {
        throw new Error("profile_save_failed");
      }

      applyProfileUser(data.user);
      setIsProfileModalOpen(false);
    } catch (error) {
      console.error("Prorector profile save failed:", error);
      setProfileError("Profili nuk u ruajt.");
    } finally {
      setIsProfileSaving(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const renderDashboard = () => (
    <div className="prorector-dashboard-stack">
      <StateBlock loading={overview.loading} error={overview.error} />
      <div className="prorector-kpi-grid">
        {[
          { label: "Publikime totale", value: formatNumber(kpis.totalPublications), icon: BookOpen },
          { label: "Publikime Scopus Q1-Q2", value: formatNumber(kpis.scopusQ1Q2Publications), icon: TrendingUp },
          { label: "Financime të aprovuara", value: formatCurrency(kpis.approvedFundingTotal), icon: WalletCards },
          { label: "Kërkesa aktive", value: formatNumber(kpis.activeRequests), icon: FileText },
          { label: "Profesorë aktivë", value: formatNumber(kpis.activeResearchProfessors), icon: UsersRound },
          { label: "Fakulteti lider", value: kpis.leadingFaculty || "Pa të dhëna", icon: Building2 },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <article className="prorector-kpi-card" key={card.label}>
              <div className="prorector-kpi-icon"><Icon size={21} /></div>
              <div><strong>{card.value}</strong><span>{card.label}</span></div>
            </article>
          );
        })}
      </div>
      <AnalyticsCharts charts={charts} />
    </div>
  );

  const renderFaculties = () => (
    <div className="prorector-table-section">
      <div className="prorector-section-head">
        <div><h2>Fakultetet</h2><p>Të dhëna reale nga fakultetet, përdoruesit, publikimet dhe financimet.</p></div>
      </div>
      <StateBlock loading={faculties.loading} error={faculties.error} empty={!filteredFacultyRows.length} emptyText="Nuk ka fakultete të regjistruara." />
      {!faculties.loading && !faculties.error && filteredFacultyRows.length ? (
        <div className="prorector-faculty-table-wrap">
          <table className="prorector-table">
            <thead><tr><th>Fakulteti</th><th>Profesorë</th><th>Publikime</th><th>Financime (€)</th><th>Statusi</th></tr></thead>
            <tbody>
              {filteredFacultyRows.map((row) => (
                <tr key={row.id} className="prorector-clickable-row" onClick={() => navigate(`/prorector/faculties/${encodeURIComponent(row.id)}`)}>
                  <td><strong>{row.name}</strong><span className="prorector-table-muted">{row.code || "-"}</span></td>
                  <td>{formatNumber(row.professorCount)}</td>
                  <td>{formatNumber(row.publicationCount)}</td>
                  <td>{formatCurrency(row.approvedFundingTotal)}</td>
                  <td><span className={`status-badge status-${row.status}`}>{row.statusLabel}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );

  const renderPublicationDetails = () => {
    const row = selectedPublication;
    if (!row) return null;

    const authors = Array.isArray(row.authors) && row.authors.length
      ? row.authors.map((author) => author.fullName).filter(Boolean).join(", ")
      : row.authorNames || "-";
    const identifier = [row.issn, row.eIssn].filter(Boolean).join(" / ") || row.isbn || "-";
    const details = [
      ["DOI", row.doi || "-"],
      ["Autorët", authors],
      ["Autori Korrespondent", row.correspondingAuthor || "-"],
      ["Fakulteti", row.faculty || "-"],
      ["Revista/Konferenca/Libri", getPublicationVenue(row)],
      ["Shtëpia Botuese", row.publisher || "-"],
      ["Data e Publikimit", formatDate(row.date)],
      ["ISSN/E-ISSN ose ISBN", identifier],
      ["Platforma e Indeksimit", row.platform || row.indexing || "Pa verifikim"],
      ["Kuartili", normalizeQuartile(row.quartile)],
      ["CiteScore", row.citeScore || "-"],
      ["Statusi", getPublicationStatusLabel(row.status, row.statusLabel)],
      ["Shuma e financimit", row.fundingAmount ? formatCurrency(row.fundingAmount) : "-"],
    ];

    return (
      <div className="prorector-drawer-backdrop" role="presentation" onClick={() => setSelectedPublication(null)}>
        <aside className="prorector-publication-drawer" role="dialog" aria-modal="true" aria-label="Detajet e publikimit" onClick={(event) => event.stopPropagation()}>
          <div className="prorector-drawer-head">
            <div><span>Detajet e publikimit</span><h3>{row.title || "Publikim pa titull"}</h3></div>
            <button type="button" onClick={() => setSelectedPublication(null)} aria-label="Mbyll detajet"><X size={20} /></button>
          </div>
          <div className="prorector-drawer-body">
            <div className="prorector-drawer-grid">
              {details.map(([label, value]) => (
                <div key={label} className="prorector-drawer-field"><span>{label}</span><strong>{value}</strong></div>
              ))}
            </div>
            <div className="prorector-drawer-field is-wide"><span>Abstrakti</span><p>{row.abstract || "Abstrakti nuk është i disponueshëm."}</p></div>
            <div className="prorector-drawer-field is-wide">
              <span>Linku i Publikimit</span>
              {row.sourceUrl ? <a href={row.sourceUrl} target="_blank" rel="noreferrer">Hap publikimin <ExternalLink size={15} /></a> : <strong>-</strong>}
            </div>
          </div>
        </aside>
      </div>
    );
  };

  const renderPublications = () => (
    <div className="prorector-publications-page">
      <section className="prorector-table-section prorector-publications-hero">
        <div className="prorector-section-head">
          <div><h2>Publikimet</h2><p>Monitorim i cilësisë, indeksimit dhe produktivitetit shkencor nga të dhënat reale të sistemit.</p></div>
          <span className="prorector-section-pill">Prorektor për Kërkim Shkencor</span>
        </div>
        <StateBlock loading={publications.loading} error={publications.error} />
        <div className="prorector-publication-kpis">
          {publicationAnalytics.kpis.map((card) => {
            const Icon = card.icon;
            const TrendIcon = card.trend.icon;
            return (
              <article className="prorector-publication-kpi" key={card.label}>
                <div className="prorector-publication-kpi-top">
                  <span><Icon size={17} /></span>
                  <small className={`trend-${card.trend.direction}`}><TrendIcon size={14} /> {card.trend.label}</small>
                </div>
                <strong>{formatNumber(card.value)}</strong>
                <p>{card.label}</p>
              </article>
            );
          })}
        </div>
      </section>
      <section className="prorector-publication-grid">
        <div className="prorector-publication-main">
          <div className="prorector-publication-charts">
            <article className="prorector-analytics-card">
              <div className="prorector-card-head"><h3>Publikimet sipas viteve</h3><BarChart3 size={20} /></div>
              {publicationAnalytics.publicationsByYear.some((row) => toNumber(row.value) > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={publicationAnalytics.publicationsByYear}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip />
                    <Bar dataKey="value" name="Publikime" fill="#1d4d7d" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <ChartEmpty />}
            </article>
            <article className="prorector-analytics-card">
              <div className="prorector-card-head"><h3>Publikimet sipas fakulteteve</h3><Building2 size={20} /></div>
              {publicationAnalytics.publicationsByFaculty.some((row) => toNumber(row.value) > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={publicationAnalytics.publicationsByFaculty} layout="vertical" margin={{ top: 8, right: 18, bottom: 8, left: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} /><Tooltip />
                    <Bar dataKey="value" name="Publikime" fill="#15803d" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <ChartEmpty />}
            </article>
            <article className="prorector-analytics-card">
              <div className="prorector-card-head"><h3>Shpërndarja sipas kuartileve</h3><TrendingUp size={20} /></div>
              {publicationAnalytics.publicationsByQuartile.some((row) => toNumber(row.value) > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={publicationAnalytics.publicationsByQuartile} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={2}>
                      {publicationAnalytics.publicationsByQuartile.map((entry) => <Cell key={entry.name} fill={QUARTILE_COLORS[entry.name]} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <ChartEmpty />}
            </article>
          </div>
          <section className="prorector-table-section prorector-publications-table-card">
            <FilterBar filters={filters} onChange={setFilters} faculties={facultyRows} publicationMode />
            <StateBlock loading={publications.loading} error={publications.error} empty={!publicationRows.length} emptyText="Nuk ka publikime për filtrat aktualë." />
            {!publications.loading && !publications.error && publicationRows.length ? (
              <div className="prorector-publication-table-wrap">
                <table className="prorector-table prorector-publication-table">
                  <thead><tr><th>Publikimi</th><th>Autori Kryesor</th><th>Fakulteti</th><th>Tipi</th><th>Indeksimi</th><th>Kuartili</th><th>Statusi</th></tr></thead>
                  <tbody>
                    {publicationRows.map((row) => (
                      <tr key={row.id} className="prorector-clickable-row" onClick={() => setSelectedPublication(row)}>
                        <td><strong>{row.title || "-"}</strong><span className="prorector-table-muted">{row.year || "Pa vit"}</span></td>
                        <td>{row.mainAuthor || row.authorNames?.split(",")[0] || "-"}</td>
                        <td>{row.faculty || "-"}</td>
                        <td>{getPublicationTypeLabel(row.type, row.typeLabel)}</td>
                        <td>{row.platform || row.indexing || "Pa verifikim"}</td>
                        <td><span className={`quartile-badge quartile-${normalizeQuartile(row.quartile).toLowerCase().replace(/\s+/g, "-")}`}>{normalizeQuartile(row.quartile)}</span></td>
                        <td><span className={`status-badge status-${statusClass(row.status)}`}>{getPublicationStatusLabel(row.status, row.statusLabel)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>
        <aside className="prorector-publication-sidebar">
          <article className="prorector-side-widget"><h3>Top Autorët</h3><ol>{publicationAnalytics.topAuthors.length ? publicationAnalytics.topAuthors.map((item) => <li key={item.name}><span>{item.name}</span><strong>{formatNumber(item.value)}</strong></li>) : <li><span>Pa të dhëna</span><strong>0</strong></li>}</ol></article>
          <article className="prorector-side-widget"><h3>Top Fakultetet</h3><ol>{publicationAnalytics.topFaculties.length ? publicationAnalytics.topFaculties.map((item) => <li key={item.name}><span>{item.name}</span><strong>{formatNumber(item.value)}</strong></li>) : <li><span>Pa të dhëna</span><strong>0</strong></li>}</ol></article>
        </aside>
      </section>
      {renderPublicationDetails()}
    </div>
  );

  const renderFunding = () => (
    <div className="prorector-table-section">
      <div className="prorector-section-head"><div><h2>Financimet</h2><p>Pasqyrë lexuese sipas kategorive të rregullores. Pa aprovim/refuzim nga Prorektori.</p></div></div>
      <FilterBar filters={filters} onChange={setFilters} faculties={facultyRows} fundingMode />
      <StateBlock loading={funding.loading} error={funding.error} empty={!fundingRows.length} emptyText="Nuk ka financime për filtrat aktualë." />
      {!funding.loading && !funding.error && fundingRows.length ? (
        <div className="prorector-faculty-table-wrap">
          <table className="prorector-table prorector-wide-table">
            <thead><tr><th>Aplikuesi</th><th>Fakulteti</th><th>Lloji i financimit</th><th>Titulli</th><th>Shuma e kërkuar</th><th>Shuma e aprovuar</th><th>Statusi</th><th>Data e aplikimit</th></tr></thead>
            <tbody>
              {fundingRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.applicant || "-"}</td>
                  <td>{row.faculty || "-"}</td>
                  <td><strong>{row.fundingType}</strong><span className="prorector-table-muted">{row.regulationCategory}</span></td>
                  <td>{row.title || "-"}</td>
                  <td>{formatCurrency(row.requestedAmount)}</td>
                  <td>{formatCurrency(row.approvedAmount)}</td>
                  <td><span className={`status-badge status-${statusClass(row.status)}`}>{row.statusLabel || STATUS_LABELS[row.status] || row.status}</span></td>
                  <td>{formatDate(row.applicationDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );

  const renderReports = () => (
    <div className="prorector-table-section">
      <div className="prorector-section-head">
        <div><h2>Raportet</h2><p>Eksporte analitike nga të dhënat reale të sistemit.</p></div>
      </div>
      <div className="prorector-reports-grid">
        <article className="prorector-report-card">
          <h3>Raport publikimesh</h3>
          <p>Publikime sipas vitit, fakultetit, indeksimit, kuartilit dhe statusit.</p>
          <button type="button" className="prorector-btn-primary" onClick={() => exportRows("publikime-prorektor.csv", publicationRows)}><Download size={16} /> Gjenero</button>
        </article>
        <article className="prorector-report-card">
          <h3>Raport financimesh</h3>
          <p>Kërkesa dhe financime sipas kategorive të rregullores.</p>
          <button type="button" className="prorector-btn-primary" onClick={() => exportRows("financime-prorektor.csv", fundingRows)}><Download size={16} /> Gjenero</button>
        </article>
        <article className="prorector-report-card">
          <h3>Raport fakultetesh</h3>
          <p>Profesorë, publikime, financime dhe status për çdo fakultet.</p>
          <button type="button" className="prorector-btn-primary" onClick={() => exportRows("fakultete-prorektor.csv", facultyRows)}><Download size={16} /> Gjenero</button>
        </article>
      </div>
    </div>
  );

  const renderContent = () => {
    if (activePage === "Publikimet") return renderPublications();
    if (activePage === "Fakultetet") return renderFaculties();
    if (activePage === "Financimet") return renderFunding();
    if (activePage === "Raportet") return renderReports();
    return renderDashboard();
  };

  return (
    <div className="prorector-layout">
      <ProRectorSidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="prorector-main">
        <ProRectorTopBar
          activePage={activePage}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          profile={profile}
          notifications={[]}
          onEditProfile={openProfileEditor}
          onProfileAction={(action) => {
            if (action === "Settings") {
              openProfileEditor();
              return;
            }
            if (action === "Logout") {
              fetch(apiUrl("/auth/logout"), { method: "POST", credentials: "include" }).finally(() => navigate("/"));
            }
          }}
        />
        <main className="prorector-content">{renderContent()}</main>
      </div>
      {isProfileModalOpen ? (
        <div className="prorector-modal-overlay" role="presentation" onClick={() => setIsProfileModalOpen(false)}>
          <section className="prorector-modal prorector-profile-modal" role="dialog" aria-label="Ndrysho profilin" onClick={(event) => event.stopPropagation()}>
            <div className="prorector-modal-header">
              <div>
                <h3 className="prorector-modal-title">Ndrysho profilin</h3>
                <p className="prorector-modal-subtitle">Përditëso të dhënat bazë të profilit të Prorektorit.</p>
              </div>
              <button type="button" className="prorector-modal-close" onClick={() => setIsProfileModalOpen(false)} aria-label="Mbyll">
                <X size={20} />
              </button>
            </div>

            <form className="prorector-modal-form prorector-profile-form" onSubmit={handleProfileSave}>
              {isProfileLoading ? (
                <div className="prorector-faculty-detail-loading">
                  <RefreshCw size={18} className="prorector-spin" />
                  <span>Duke ngarkuar profilin...</span>
                </div>
              ) : null}

              <div className="prorector-form-grid">
                <label className="prorector-form-field">
                  <span>Emri</span>
                  <input value={profileDraft.name} onChange={handleProfileFieldChange("name")} placeholder="Emri dhe mbiemri" />
                </label>
                <label className="prorector-form-field">
                  <span>Email</span>
                  <input value={profileDraft.email} readOnly />
                </label>
                <label className="prorector-form-field">
                  <span>Roli</span>
                  <input value={profileDraft.role} readOnly />
                </label>
                <label className="prorector-form-field">
                  <span>Fakulteti</span>
                  <input value={profileDraft.faculty} onChange={handleProfileFieldChange("faculty")} placeholder="Fakulteti" />
                </label>
                <label className="prorector-form-field">
                  <span>Departamenti</span>
                  <input value={profileDraft.department} onChange={handleProfileFieldChange("department")} placeholder="Departamenti" />
                </label>
                <label className="prorector-form-field">
                  <span>Zyra</span>
                  <input value={profileDraft.office} onChange={handleProfileFieldChange("office")} placeholder="Zyra" />
                </label>
                <label className="prorector-form-field">
                  <span>Titulli akademik</span>
                  <input value={profileDraft.academicTitle} onChange={handleProfileFieldChange("academicTitle")} placeholder="Titulli akademik" />
                </label>
                <label className="prorector-form-field">
                  <span>Titulli shkencor</span>
                  <input value={profileDraft.scientificTitle} onChange={handleProfileFieldChange("scientificTitle")} placeholder="Titulli shkencor" />
                </label>
              </div>

              {profileError ? <p className="prorector-inline-alert prorector-profile-error" role="alert">{profileError}</p> : null}

              <div className="prorector-modal-actions">
                <button type="button" className="prorector-btn-secondary" onClick={() => setIsProfileModalOpen(false)} disabled={isProfileSaving}>
                  Anulo
                </button>
                <button type="submit" className="prorector-btn-primary" disabled={isProfileSaving || isProfileLoading}>
                  <Save size={16} />
                  {isProfileSaving ? "Duke ruajtur..." : "Ruaj"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
