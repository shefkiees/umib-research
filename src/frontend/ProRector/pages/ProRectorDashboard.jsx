import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Building2,
  Download,
  FileText,
  RefreshCw,
  Search,
  TrendingUp,
  UsersRound,
  WalletCards,
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

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Dorëzuar",
  in_review: "Në shqyrtim",
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

const DEFAULT_PROFILE = {
  name: "Prorektor për Kërkim Shkencor",
  role: "Monitorim dhe raporte",
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

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("sq-AL").format(date);
}

function statusClass(value) {
  return String(value || "draft").toLowerCase().replace(/[^a-z0-9]+/g, "-");
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

  const renderPublications = () => (
    <div className="prorector-table-section">
      <div className="prorector-section-head"><div><h2>Publikimet</h2><p>Publikime reale me autorë, indeksim, kuartil dhe status.</p></div></div>
      <FilterBar filters={filters} onChange={setFilters} faculties={facultyRows} publicationMode />
      <StateBlock loading={publications.loading} error={publications.error} empty={!publicationRows.length} emptyText="Nuk ka publikime për filtrat aktualë." />
      {!publications.loading && !publications.error && publicationRows.length ? (
        <div className="prorector-faculty-table-wrap">
          <table className="prorector-table prorector-wide-table">
            <thead><tr><th>Titulli</th><th>Autorët</th><th>Fakulteti</th><th>Tipi</th><th>Publikuar në</th><th>Indeksimi</th><th>Kuartili</th><th>Data</th><th>DOI</th><th>Statusi</th></tr></thead>
            <tbody>
              {publicationRows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.title || "-"}</strong></td>
                  <td>{row.authorNames || "-"}</td>
                  <td>{row.faculty || "-"}</td>
                  <td>{row.typeLabel || PUBLICATION_TYPES[row.type] || "-"}</td>
                  <td>{row.publishedIn || "-"}</td>
                  <td>{row.indexing || "Pa verifikim"}</td>
                  <td>{row.quartile || "Pa verifikim"}</td>
                  <td>{formatDate(row.date)}</td>
                  <td>{row.doi || "-"}</td>
                  <td><span className={`status-badge status-${statusClass(row.status)}`}>{row.statusLabel || STATUS_LABELS[row.status] || row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
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
    if (activePage === "Analitika") return <div className="prorector-table-section"><h2>Analitika</h2><p>Grafiqet kryesore të kërkimit shkencor dhe financimeve.</p><AnalyticsCharts charts={charts} /></div>;
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
          profile={DEFAULT_PROFILE}
          notifications={[]}
          onProfileAction={(action) => {
            if (action === "Logout") {
              fetch(apiUrl("/auth/logout"), { method: "POST", credentials: "include" }).finally(() => navigate("/"));
            }
          }}
        />
        <main className="prorector-content">{renderContent()}</main>
      </div>
    </div>
  );
}
