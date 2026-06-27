import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Building2,
  Download,
  FileText,
  Minus,
  RefreshCw,
  Search,
  Save,
  TrendingUp,
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
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import "../styles/ProRectorDashboard.css";
import ProRectorSidebar from "../components/Sidebar";
import ProRectorTopBar from "../components/TopBar";
import { apiUrl } from "../../utils/api";

const CHART_COLORS = ["#1d4d7d", "#15803d", "#c9a24f", "#be123c", "#6d5bd0", "#0f766e", "#b45309", "#475569"];
const FACULTY_TREEMAP_COLORS = ["#1e88e5", "#1b2a9b", "#ef6c35", "#7a007d", "#db3fa3", "#7451c4", "#0f766e", "#c9a24f"];

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

const PUBLICATION_STATUS_OPTIONS = ["approved", "in_review", "rejected"];

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

function getPublicationStatusLabel(value, fallback) {
  const normalized = normalizeStatus(value);
  if (normalized === "approved") return "Aprovuar";
  if (normalized === "in_review") return "Në Shqyrtim";
  if (normalized === "correction") return "Korrigjim";
  if (normalized === "rejected") return "Refuzuar";
  return fallback || STATUS_LABELS[normalized] || value || "-";
}

function buildPublicationAnalytics(rows) {
  const facultyCounts = new Map();
  const byYear = new Map();
  const yearFacultyCounts = new Map();
  const scopusQuartiles = new Map([
    ["Q1", 0],
    ["Q2", 0],
    ["Q3", 0],
    ["Q4", 0],
  ]);
  const webOfScience = new Map([
    ["SCIE", 0],
    ["SSCI", 0],
    ["AHCI", 0],
  ]);

  rows.forEach((row) => {
    const year = row.year ? String(row.year) : "";
    const faculty = row.faculty || "Pa fakultet";

    if (year) byYear.set(year, (byYear.get(year) || 0) + 1);
    facultyCounts.set(faculty, (facultyCounts.get(faculty) || 0) + 1);

    if (year) {
      if (!yearFacultyCounts.has(year)) yearFacultyCounts.set(year, new Map());
      yearFacultyCounts.get(year).set(faculty, (yearFacultyCounts.get(year).get(faculty) || 0) + 1);
    }

    const quartile = normalizeQuartile(row.quartile);
    if (/scopus/i.test(`${row.platform} ${row.regulationCategory}`) && scopusQuartiles.has(quartile)) {
      scopusQuartiles.set(quartile, (scopusQuartiles.get(quartile) || 0) + 1);
    }

    const indexingText = `${row.indexing} ${row.platform} ${row.regulationCategory}`.toUpperCase();
    if (/\bSCIE\b/.test(indexingText)) {
      webOfScience.set("SCIE", (webOfScience.get("SCIE") || 0) + 1);
    } else if (/\bSSCI\b/.test(indexingText)) {
      webOfScience.set("SSCI", (webOfScience.get("SSCI") || 0) + 1);
    } else if (/\bAHCI\b/.test(indexingText)) {
      webOfScience.set("AHCI", (webOfScience.get("AHCI") || 0) + 1);
    }
  });

  const publicationsByYear = Array.from(byYear.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => Number(a.name) - Number(b.name));
  const publicationsByFaculty = Array.from(facultyCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "sq"));
  const facultyPercentRows = publicationsByFaculty.map((row, index) => ({
    ...row,
    percent: rows.length ? (row.value / rows.length) * 100 : 0,
    fill: FACULTY_TREEMAP_COLORS[index % FACULTY_TREEMAP_COLORS.length],
  }));
  const facultyColumns = publicationsByFaculty.map((row) => row.name);
  const yearFacultyRows = publicationsByYear.map((yearRow) => {
    const facultyMap = yearFacultyCounts.get(yearRow.name) || new Map();

    return {
      year: yearRow.name,
      total: yearRow.value,
      faculties: Object.fromEntries(facultyColumns.map((faculty) => [faculty, facultyMap.get(faculty) || 0])),
    };
  });
  const scopusQuartileRows = Array.from(scopusQuartiles.entries()).map(([name, value]) => ({
    name,
    value,
    fill: name === "Q1" ? "#15803d" : name === "Q2" ? "#2563eb" : name === "Q3" ? "#d97706" : "#7c3aed",
  }));
  const webOfScienceRows = Array.from(webOfScience.entries()).map(([name, value]) => ({
    name,
    value,
    fill: name === "SCIE" ? "#1e88e5" : name === "SSCI" ? "#0f766e" : "#c2410c",
  }));

  return {
    totalPublications: rows.length,
    publicationsByYear,
    publicationsByFaculty,
    facultyPercentRows,
    facultyColumns,
    yearFacultyRows,
    scopusQuartileRows,
    webOfScienceRows,
  };
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

function FacultyTreemapTile({ x, y, width, height, name, value, fill }) {
  if (width <= 0 || height <= 0) return null;

  const canShowName = width > 92 && height > 42;
  const canShowValue = width > 44 && height > 30;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill || "#1e88e5"} stroke="#ffffff" strokeWidth={2} />
      {canShowName ? (
        <text x={x + 8} y={y + 20} fill="#ffffff" fontSize={13} fontWeight={700}>
          {String(name).length > 28 ? `${String(name).slice(0, 25)}...` : name}
        </text>
      ) : null}
      {canShowValue ? (
        <text x={x + 8} y={y + height - 9} fill="#ffffff" fontSize={13} fontWeight={900}>
          {formatNumber(value)}
        </text>
      ) : null}
    </g>
  );
}

function PublicationSnapshotCharts({ analytics }) {
  return (
    <div className="prorector-publication-bi-grid">
      <article className="prorector-bi-card">
        <h3>Publikimet sipas viteve</h3>
        {analytics.publicationsByYear.some((row) => toNumber(row.value) > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.publicationsByYear} margin={{ top: 18, right: 12, left: 8, bottom: 22 }} barCategoryGap="28%">
              <CartesianGrid stroke="#d6dce4" strokeDasharray="1 6" vertical={false} />
              <XAxis dataKey="name" angle={-42} textAnchor="end" height={54} tick={{ fill: "#555", fontSize: 12, fontWeight: 700 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#555", fontSize: 12, fontWeight: 700 }} />
              <Tooltip formatter={(value) => [formatNumber(value), "Publikime"]} />
              <Bar dataKey="value" name="Publikime" fill="#1e88e5" />
            </BarChart>
          </ResponsiveContainer>
        ) : <ChartEmpty />}
      </article>

      <article className="prorector-bi-card">
        <h3>Publikimet sipas Fakulteteve</h3>
        {analytics.facultyTreemap.some((row) => toNumber(row.value) > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <Treemap
              data={analytics.facultyTreemap}
              dataKey="value"
              nameKey="name"
              aspectRatio={4 / 3}
              stroke="#ffffff"
              content={<FacultyTreemapTile />}
            />
          </ResponsiveContainer>
        ) : <ChartEmpty />}
      </article>

      <article className="prorector-bi-card">
        <h3>Statistikat Scopus sipas Kuartileve</h3>
        {analytics.scopusQuartileRows.some((row) => toNumber(row.value) > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.scopusQuartileRows} margin={{ top: 18, right: 12, left: 8, bottom: 12 }}>
              <CartesianGrid stroke="#d6dce4" strokeDasharray="1 6" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 12, fontWeight: 700 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#555", fontSize: 12, fontWeight: 700 }} />
              <Tooltip formatter={(value) => [formatNumber(value), "Publikime"]} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {analytics.scopusQuartileRows.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <ChartEmpty message="Nuk ka të dhëna për Scopus Q1-Q4." />}
      </article>

      <article className="prorector-bi-card">
        <h3>Statistikat Web of Science</h3>
        {analytics.webOfScienceRows.some((row) => toNumber(row.value) > 0) ? (
          <div className="prorector-index-cards">
            {analytics.webOfScienceRows.map((row) => (
              <div className="prorector-index-card" key={row.name} style={{ "--index-accent": row.fill }}>
                <span>{row.name}</span>
                <strong>{formatNumber(row.value)}</strong>
                <small>Publikime të indeksuara</small>
              </div>
            ))}
          </div>
        ) : <ChartEmpty message="Nuk ka të dhëna për SCIE, SSCI dhe AHCI." />}
      </article>
    </div>
  );
}

function PublicationGauge({ total }) {
  const maxValue = Math.max(total * 2, 1);
  const percent = Math.min(100, Math.round((total / maxValue) * 100));

  return (
    <article className="prorector-report-panel prorector-total-panel">
      <h3>Numri total i publikimeve</h3>
      <div className="prorector-total-gauge" style={{ "--gauge-value": `${percent}%` }}>
        <div className="prorector-total-gauge-value">{formatNumber(total)}</div>
      </div>
      <div className="prorector-gauge-scale">
        <span>0</span>
        <span>{formatNumber(maxValue)}</span>
      </div>
    </article>
  );
}

function FacultyPercentageChart({ rows }) {
  const total = rows.reduce((sum, row) => sum + toNumber(row.value), 0);

  return (
    <article className="prorector-report-panel prorector-faculty-chart-panel">
      <h3>Përqindja e publikimeve sipas fakultetit</h3>
      {rows.some((row) => toNumber(row.value) > 0) ? (
        <div className="prorector-faculty-chart-layout">
          <div className="prorector-faculty-pie-box">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={102}
                  paddingAngle={1}
                  isAnimationActive={false}
                >
                  {rows.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(value, name, item) => [`${formatNumber(value)} (${item.payload.percent.toFixed(2)}%)`, "Publikime"]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="prorector-faculty-pie-total" aria-hidden="true">
              <strong>{formatNumber(total)}</strong>
              <span>publikime</span>
            </div>
          </div>
          <div className="prorector-faculty-legend">
            <strong>Fakulteti</strong>
            {rows.map((row) => (
              <span key={row.name}><i style={{ background: row.fill }} /><b>{row.name}</b><em>{formatNumber(row.value)} ({row.percent.toFixed(2)}%)</em></span>
            ))}
          </div>
        </div>
      ) : <ChartEmpty />}
    </article>
  );
}

function IndexSummaryTable({ title, rows }) {
  const total = rows.reduce((sum, row) => sum + toNumber(row.value), 0);

  return (
    <article className="prorector-index-summary">
      <h3>{title}</h3>
      <table>
        <thead><tr><th>Kategoria</th><th>Nr. i publikimeve</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}><td>{row.name}</td><td>{formatNumber(row.value)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><th>Total</th><th>{formatNumber(total)}</th></tr></tfoot>
      </table>
    </article>
  );
}

function YearFacultyMatrix({ analytics }) {
  const facultyTotals = Object.fromEntries(analytics.facultyColumns.map((faculty) => [
    faculty,
    analytics.yearFacultyRows.reduce((sum, row) => sum + toNumber(row.faculties[faculty]), 0),
  ]));

  return (
    <section className="prorector-report-panel prorector-year-faculty-panel">
      <h3>Publikimet sipas viteve dhe fakulteteve</h3>
      <div className="prorector-report-table-wrap">
        <table className="prorector-report-table">
          <thead>
            <tr>
              <th>Viti i publikimit</th>
              {analytics.facultyColumns.map((faculty) => <th key={faculty}>{faculty}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {analytics.yearFacultyRows.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                {analytics.facultyColumns.map((faculty) => <td key={faculty}>{row.faculties[faculty] || ""}</td>)}
                <td><strong>{formatNumber(row.total)}</strong></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>Total</th>
              {analytics.facultyColumns.map((faculty) => <th key={faculty}>{formatNumber(facultyTotals[faculty])}</th>)}
              <th>{formatNumber(analytics.totalPublications)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
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
          <option value="Financim për publikime shkencore">Artikuj shkencorë</option>
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
        <div className="prorector-card-head"><h3>Artikujt sipas viteve</h3><TrendingUp size={20} /></div>
        {publicationsByYear.some((row) => toNumber(row.value) > 0) ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={publicationsByYear}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Artikuj" fill="#1d4d7d" radius={[6, 6, 0, 0]} />
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
        <div className="prorector-card-head"><h3>Artikujt sipas kategorive</h3><BookOpen size={20} /></div>
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
  const charts = overview.data.charts || {};
  const publicationAnalytics = useMemo(
    () => buildPublicationAnalytics(publicationRows),
    [publicationRows]
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
      profilePhotoUrl: user.profilePhotoUrl || user.profile_photo_url || user.avatarUrl || user.avatar_url || user.photoUrl || user.photo_url || user.picture || "",
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
      <AnalyticsCharts charts={charts} />
    </div>
  );

  const renderFaculties = () => (
    <div className="prorector-table-section">
      <div className="prorector-section-head">
        <div><h2>Fakultetet</h2><p>Të dhëna reale nga fakultetet, përdoruesit, artikujt dhe financimet.</p></div>
      </div>
      <StateBlock loading={faculties.loading} error={faculties.error} empty={!filteredFacultyRows.length} emptyText="Nuk ka fakultete të regjistruara." />
      {!faculties.loading && !faculties.error && filteredFacultyRows.length ? (
        <div className="prorector-faculty-table-wrap">
          <table className="prorector-table">
            <thead><tr><th>Fakulteti</th><th>Profesorë</th><th>Artikuj</th><th>Financime (€)</th><th>Statusi</th></tr></thead>
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
    <div className="prorector-publications-page">
      <section className="prorector-table-section prorector-publications-hero">
        <div className="prorector-section-head">
          <div><h2>Artikujt</h2><p>Raport i publikimeve sipas viteve, fakulteteve dhe platformave të indeksimit.</p></div>
        </div>
        <StateBlock loading={publications.loading} error={publications.error} />
      </section>
      <section className="prorector-publication-grid prorector-publication-grid--full">
        <div className="prorector-publication-main">
          {!publications.loading && !publications.error ? (
            <>
              <section className="prorector-publication-report-top">
                <PublicationGauge total={publicationAnalytics.totalPublications} />
                <FacultyPercentageChart rows={publicationAnalytics.facultyPercentRows} />
                <div className="prorector-index-summary-stack">
                  <IndexSummaryTable title="Scopus sipas kuartileve" rows={publicationAnalytics.scopusQuartileRows} />
                  <IndexSummaryTable title="Web of Science" rows={publicationAnalytics.webOfScienceRows} />
                </div>
              </section>
              <YearFacultyMatrix analytics={publicationAnalytics} />
            </>
          ) : null}
        </div>
      </section>
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
          <h3>Raport artikujsh</h3>
          <p>Artikuj sipas vitit, fakultetit, indeksimit, kuartilit dhe statusit.</p>
          <button type="button" className="prorector-btn-primary" onClick={() => exportRows("artikuj-prorektor.csv", publicationRows)}><Download size={16} /> Gjenero</button>
        </article>
        <article className="prorector-report-card">
          <h3>Raport financimesh</h3>
          <p>Kërkesa dhe financime sipas kategorive të rregullores.</p>
          <button type="button" className="prorector-btn-primary" onClick={() => exportRows("financime-prorektor.csv", fundingRows)}><Download size={16} /> Gjenero</button>
        </article>
        <article className="prorector-report-card">
          <h3>Raport fakultetesh</h3>
          <p>Profesorë, artikuj, financime dhe status për çdo fakultet.</p>
          <button type="button" className="prorector-btn-primary" onClick={() => exportRows("fakultete-prorektor.csv", facultyRows)}><Download size={16} /> Gjenero</button>
        </article>
      </div>
    </div>
  );

  const renderContent = () => {
    if (activePage === "Artikujt") return renderPublications();
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
