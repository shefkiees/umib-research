import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Download,
  FileText,
  Languages,
  Minus,
  RefreshCw,
  Search,
  Save,
  TrendingUp,
  Users,
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
import { useLanguage } from "../../i18n/LanguageContext";
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

const DEFAULT_SYSTEM_PREFERENCES = {
  emailNotifications: true,
};

const PRORECTOR_COPY = {
  sq: {
    reports: {
      title: "Raportet",
      noResults: "Nuk ka raporte për kërkimin aktual.",
      publications: "Raport artikujsh",
      publicationsDescription: "Artikuj sipas vitit, fakultetit, indeksimit, kuartilit dhe statusit.",
      funding: "Raport financimesh",
      fundingDescription: "Kërkesa dhe financime sipas kategorive të rregullores.",
      faculties: "Raport fakultetesh",
      facultiesDescription: "Profesorë, artikuj, financime dhe status për çdo fakultet.",
      generate: "Gjenero",
    },
    settings: {
      title: "Cilësimet",
      noResults: "Nuk ka cilësime për kërkimin aktual.",
      languageTitle: "Gjuha",
      chooseLanguage: "Zgjedh gjuhën",
      languageDescription: "Përzgjidh shqip ose anglisht për pamjen e panelit.",
      albanian: "Shqip",
      english: "English",
      languageUpdated: "Gjuha u përditësua.",
      profile: "Profili",
      name: "Emri",
      role: "Roli",
      editProfile: "Ndrysho profilin",
    },
    dashboard: {
      loading: "Duke ngarkuar të dhënat...",
      empty: "Nuk ka të dhëna për t'u shfaqur.",
      chartEmpty: "Nuk ka të dhëna për këtë grafik.",
      searchEmpty: "Nuk ka rezultate për kërkimin aktual.",
      publicationsByYear: "Publikimet sipas vitit",
      authorsByFaculty: "Autorët sipas fakultetit",
      authors: "autorë",
      publicationsByFaculty: "Publikimet sipas fakultetit",
      scopusByQuartile: "Statistikat Scopus sipas kuartileve",
      webOfScience: "Statistikat Web of Science",
      noScopusData: "Nuk ka të dhëna për Scopus Q1-Q4.",
      noWosData: "Nuk ka të dhëna për SCIE, SSCI dhe AHCI.",
      publications: "Publikime",
      indexedPublications: "Publikime të indeksuara",
      totalPublications: "Numri total i publikimeve",
      publicationPercentageByFaculty: "Përqindja e publikimeve sipas fakultetit",
      category: "Kategoria",
      publicationCount: "Nr. i publikimeve",
      total: "Total",
      publicationsByYearsAndFaculties: "Publikimet sipas viteve dhe fakulteteve",
      publicationYear: "Viti i publikimit",
      active: "aktive",
      faculty: "Fakulteti",
      facultyList: "Lista e fakulteteve",
      facultySearchPlaceholder: "Kërko fakultetet...",
      noActiveFaculties: "Nuk ka fakultete aktive në sistem.",
      articlesTitle: "Artikujt",
      articlesDescription: "Raport i publikimeve sipas viteve, fakulteteve dhe platformave të indeksimit.",
      noFunding: "Nuk ka financime për filtrat aktualë.",
      requests: "Kërkesa",
      requestedAmount: "Shuma e kërkuar",
      approvedAmount: "Shuma e aprovuar",
      fundingByYear: "Financimet sipas viteve",
      fundingCategories: "Kategoritë e financimit",
      requestStatus: "Statusi i kërkesave",
      requested: "Kërkuar",
      approved: "Aprovuar",
      statusLabels: {
        draft: "Draft",
        submitted: "Në Shqyrtim",
        in_review: "Në Shqyrtim",
        correction: "Korrigjim",
        needs_correction: "Korrigjim",
        approved: "Aprovuar",
        rejected: "Refuzuar",
        paid: "Paguar",
      },
      noFaculty: "Pa fakultet",
      noYear: "Pa vit",
      noCategory: "Pa kategori",
      facultyNames: {
        "Fakulteti i Gjeoshkencave": "Fakulteti i Gjeoshkencave",
        "Fakulteti i Teknologjisë Ushqimore": "Fakulteti i Teknologjisë Ushqimore",
        "Fakulteti i Inxhinierisë Mekanike dhe Kompjuterike": "Fakulteti i Inxhinierisë Mekanike dhe Kompjuterike",
        "Fakulteti Juridik": "Fakulteti Juridik",
        "Fakulteti Ekonomik": "Fakulteti Ekonomik",
      },
      fullTimeFirstAuthor: "Autori i parë me orar të plotë",
      partTimeFirstAuthor: "Autori i parë me gjysmë orari",
      missingEmploymentStatus: "Pa të dhëna për statusin",
      fundingCategoriesMap: {
        "Konferenca/Simpoziume": "Konferenca/Simpoziume",
        "Libra/Kapituj": "Libra/Kapituj",
        "Pa verifikim": "Pa verifikim",
        "Scopus Q1": "Scopus Q1",
        "Scopus Q2": "Scopus Q2",
        "Scopus Q3": "Scopus Q3",
        "Scopus Q4": "Scopus Q4",
        "Financim për publikime shkencore": "Artikuj shkencorë",
        "Financim për konferenca/simpoziume": "Konferenca/Simpoziume",
        "Financim për projekte shkencore": "Projekte shkencore",
      },
    },
    profile: {
      editTitle: "Ndrysho profilin",
      editSubtitle: "Përditëso të dhënat bazë të profilit të Prorektorit.",
      close: "Mbyll",
    },
  },
  en: {
    reports: {
      title: "Reports",
      noResults: "No reports match the current search.",
      publications: "Article report",
      publicationsDescription: "Articles by year, faculty, indexing, quartile, and status.",
      funding: "Funding report",
      fundingDescription: "Requests and funding by regulation category.",
      faculties: "Faculty report",
      facultiesDescription: "Professors, articles, funding, and status for each faculty.",
      generate: "Generate",
    },
    settings: {
      title: "Settings",
      noResults: "No settings match the current search.",
      languageTitle: "Language",
      chooseLanguage: "Choose language",
      languageDescription: "Choose Albanian or English for the dashboard view.",
      albanian: "Shqip",
      english: "English",
      languageUpdated: "Language updated.",
      profile: "Profile",
      name: "Name",
      role: "Role",
      editProfile: "Edit profile",
    },
    dashboard: {
      loading: "Loading data...",
      empty: "No data to display.",
      chartEmpty: "No data for this chart.",
      searchEmpty: "No results match the current search.",
      publicationsByYear: "Publications by year",
      authorsByFaculty: "Authors by faculty",
      authors: "authors",
      publicationsByFaculty: "Publications by faculty",
      scopusByQuartile: "Scopus statistics by quartile",
      webOfScience: "Web of Science statistics",
      noScopusData: "No data for Scopus Q1-Q4.",
      noWosData: "No data for SCIE, SSCI, and AHCI.",
      publications: "Publications",
      indexedPublications: "Indexed publications",
      totalPublications: "Total publications",
      publicationPercentageByFaculty: "Publication percentage by faculty",
      category: "Category",
      publicationCount: "No. of publications",
      total: "Total",
      publicationsByYearsAndFaculties: "Publications by year and faculty",
      publicationYear: "Publication year",
      active: "active",
      faculty: "Faculty",
      facultyList: "Faculty list",
      facultySearchPlaceholder: "Search faculties...",
      noActiveFaculties: "No active faculties in the system.",
      articlesTitle: "Articles",
      articlesDescription: "Publication report by year, faculty, and indexing platform.",
      noFunding: "No funding matches the current filters.",
      requests: "Requests",
      requestedAmount: "Requested amount",
      approvedAmount: "Approved amount",
      fundingByYear: "Funding by year",
      fundingCategories: "Funding categories",
      requestStatus: "Request status",
      requested: "Requested",
      approved: "Approved",
      statusLabels: {
        draft: "Draft",
        submitted: "In Review",
        in_review: "In Review",
        correction: "Correction",
        needs_correction: "Correction",
        approved: "Approved",
        rejected: "Rejected",
        paid: "Paid",
      },
      noFaculty: "No faculty",
      noYear: "No year",
      noCategory: "No category",
      facultyNames: {
        "Fakulteti i Gjeoshkencave": "Faculty of Geosciences",
        "Fakulteti i Teknologjisë Ushqimore": "Faculty of Food Technology",
        "Fakulteti i Inxhinierisë Mekanike dhe Kompjuterike": "Faculty of Mechanical and Computer Engineering",
        "Fakulteti Juridik": "Faculty of Law",
        "Fakulteti Ekonomik": "Faculty of Economics",
      },
      fullTimeFirstAuthor: "First author full time",
      partTimeFirstAuthor: "First author part time",
      missingEmploymentStatus: "No employment status data",
      fundingCategoriesMap: {
        "Konferenca/Simpoziume": "Conferences/Symposiums",
        "Libra/Kapituj": "Books/Chapters",
        "Pa verifikim": "Unverified",
        "Scopus Q1": "Scopus Q1",
        "Scopus Q2": "Scopus Q2",
        "Scopus Q3": "Scopus Q3",
        "Scopus Q4": "Scopus Q4",
        "Financim për publikime shkencore": "Scientific articles",
        "Financim për konferenca/simpoziume": "Conferences/Symposiums",
        "Financim për projekte shkencore": "Scientific projects",
      },
    },
    profile: {
      editTitle: "Edit profile",
      editSubtitle: "Update the ProRector profile information.",
      close: "Close",
    },
  },
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("sq-AL").format(toNumber(value));
}

function formatPercent(value) {
  return `${toNumber(value).toFixed(2)}%`;
}

function formatNotificationDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesSearchText(query, ...values) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  return normalizeSearchText(values.filter(Boolean).join(" ")).includes(normalizedQuery);
}

function getLocalizedFacultyName(value, dashboardCopy = PRORECTOR_COPY.sq.dashboard) {
  const text = String(value || "").trim();
  if (!text) return dashboardCopy.noFaculty;

  if (normalizeSearchText(text) === normalizeSearchText(PRORECTOR_COPY.sq.dashboard.noFaculty)) {
    return dashboardCopy.noFaculty;
  }

  const localizedEntry = Object.entries(dashboardCopy.facultyNames || {}).find(
    ([name]) => normalizeSearchText(name) === normalizeSearchText(text)
  );

  return localizedEntry?.[1] || text;
}

function mapNotificationRow(row = {}) {
  const message = row.message || row.description || row.text || "";

  return {
    id: row.id,
    title: row.title || message || "Njoftim",
    text: message,
    description: message,
    category: row.category || "Njoftim",
    metadata: row.metadata || {},
    isRead: Boolean(row.is_read ?? row.isRead),
    createdAt: formatNotificationDate(row.created_at || row.createdAt),
  };
}

function normalizePublicationYear(value) {
  const year = Number.parseInt(value, 10);
  const maxYear = new Date().getFullYear() + 1;

  return Number.isInteger(year) && year >= 1980 && year <= maxYear ? String(year) : "";
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

function getPublicationStatusLabel(value, fallback, dashboardCopy = PRORECTOR_COPY.sq.dashboard) {
  const normalized = normalizeStatus(value);
  return dashboardCopy.statusLabels?.[normalized] || fallback || STATUS_LABELS[normalized] || value || "-";
}

function buildPublicationAnalytics(rows, dashboardCopy = PRORECTOR_COPY.sq.dashboard) {
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
  const employmentStatusCounts = new Map([
    [dashboardCopy.fullTimeFirstAuthor, 0],
    [dashboardCopy.partTimeFirstAuthor, 0],
    [dashboardCopy.missingEmploymentStatus, 0],
  ]);

  rows.forEach((row) => {
    const year = normalizePublicationYear(row.year);
    const faculty = getLocalizedFacultyName(row.faculty, dashboardCopy);
    const employmentStatus = String(row.employmentStatus || "").toLowerCase();

    if (year) byYear.set(year, (byYear.get(year) || 0) + 1);
    facultyCounts.set(faculty, (facultyCounts.get(faculty) || 0) + 1);
    if (employmentStatus === "part_time") {
      employmentStatusCounts.set(dashboardCopy.partTimeFirstAuthor, (employmentStatusCounts.get(dashboardCopy.partTimeFirstAuthor) || 0) + 1);
    } else if (employmentStatus === "full_time") {
      employmentStatusCounts.set(dashboardCopy.fullTimeFirstAuthor, (employmentStatusCounts.get(dashboardCopy.fullTimeFirstAuthor) || 0) + 1);
    } else {
      employmentStatusCounts.set(dashboardCopy.missingEmploymentStatus, (employmentStatusCounts.get(dashboardCopy.missingEmploymentStatus) || 0) + 1);
    }

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
  const employmentStatusRows = Array.from(employmentStatusCounts.entries()).map(([name, value], index) => ({
    name,
    value,
    percent: rows.length ? (value / rows.length) * 100 : 0,
    fill: index === 0 ? "#1e88e5" : index === 1 ? "#1b2a9b" : "#64748b",
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
    employmentStatusRows,
  };
}

function getLocalizedFundingCategory(value, dashboardCopy = PRORECTOR_COPY.sq.dashboard) {
  const text = String(value || "").trim();
  return dashboardCopy.fundingCategoriesMap?.[text] || text || dashboardCopy.noCategory;
}

function buildFundingAnalytics(rows, dashboardCopy = PRORECTOR_COPY.sq.dashboard) {
  const byYear = new Map();
  const byCategory = new Map();
  const byStatus = new Map();
  const totals = rows.reduce((summary, row) => {
    const requested = toNumber(row.requestedAmount);
    const approved = toNumber(row.approvedAmount);
    const date = row.applicationDate ? new Date(row.applicationDate) : null;
    const year = date && !Number.isNaN(date.getTime()) ? String(date.getFullYear()) : dashboardCopy.noYear;
    const category = getLocalizedFundingCategory(row.regulationCategory || row.fundingType || dashboardCopy.noCategory, dashboardCopy);
    const status = normalizeStatus(row.status);

    if (!byYear.has(year)) byYear.set(year, { name: year, requested: 0, approved: 0, count: 0 });
    const yearRow = byYear.get(year);
    yearRow.requested += requested;
    yearRow.approved += approved;
    yearRow.count += 1;

    byCategory.set(category, (byCategory.get(category) || 0) + 1);
    byStatus.set(status, (byStatus.get(status) || 0) + 1);

    return {
      count: summary.count + 1,
      requested: summary.requested + requested,
      approved: summary.approved + approved,
    };
  }, { count: 0, requested: 0, approved: 0 });

  const fundingByYear = Array.from(byYear.values())
    .sort((a, b) => {
      if (a.name === dashboardCopy.noYear) return 1;
      if (b.name === dashboardCopy.noYear) return -1;
      return Number(a.name) - Number(b.name);
    });

  const categoryRows = Array.from(byCategory.entries())
    .map(([name, value], index) => ({
      name,
      value,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "sq"));

  const statusRows = Array.from(byStatus.entries())
    .map(([name, value], index) => ({
      name,
      label: dashboardCopy.statusLabels?.[name] || STATUS_LABELS[name] || name,
      value,
      fill: CHART_COLORS[(index + 2) % CHART_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "sq"));

  return {
    totals,
    fundingByYear,
    categoryRows,
    statusRows,
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

function ChartEmpty({ message }) {
  return (
    <div className="prorector-chart-empty">
      <BarChart3 size={22} />
      <span>{message || PRORECTOR_COPY.sq.dashboard.chartEmpty}</span>
    </div>
  );
}

function StateBlock({ loading, error, empty, emptyText, loadingText }) {
  if (loading) {
    return (
      <div className="prorector-faculty-detail-loading">
        <RefreshCw size={18} className="prorector-spin" />
        <span>{loadingText || PRORECTOR_COPY.sq.dashboard.loading}</span>
      </div>
    );
  }

  if (error) return <div className="prorector-inline-alert" role="alert">{error}</div>;
  if (empty) return <div className="prorector-faculty-empty">{emptyText || PRORECTOR_COPY.sq.dashboard.empty}</div>;
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

function PublicationSnapshotCharts({ analytics, copy = PRORECTOR_COPY.sq.dashboard }) {
  return (
    <div className="prorector-publication-bi-grid">
      <article className="prorector-bi-card">
        <h3>{copy.publicationsByYear}</h3>
        {analytics.publicationsByYear.some((row) => toNumber(row.value) > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.publicationsByYear} margin={{ top: 18, right: 12, left: 8, bottom: 22 }} barCategoryGap="28%">
              <CartesianGrid stroke="#d6dce4" strokeDasharray="1 6" vertical={false} />
              <XAxis dataKey="name" angle={-42} textAnchor="end" height={54} tick={{ fill: "#555", fontSize: 12, fontWeight: 700 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#555", fontSize: 12, fontWeight: 700 }} />
              <Tooltip formatter={(value) => [formatNumber(value), copy.publications]} />
              <Bar dataKey="value" name={copy.publications} fill="#1e88e5" />
            </BarChart>
          </ResponsiveContainer>
        ) : <ChartEmpty message={copy.chartEmpty} />}
      </article>

      <article className="prorector-bi-card">
        <h3>{copy.publicationsByFaculty}</h3>
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
        ) : <ChartEmpty message={copy.chartEmpty} />}
      </article>

      <article className="prorector-bi-card">
        <h3>{copy.scopusByQuartile}</h3>
        {analytics.scopusQuartileRows.some((row) => toNumber(row.value) > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.scopusQuartileRows} margin={{ top: 18, right: 12, left: 8, bottom: 12 }}>
              <CartesianGrid stroke="#d6dce4" strokeDasharray="1 6" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 12, fontWeight: 700 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#555", fontSize: 12, fontWeight: 700 }} />
              <Tooltip formatter={(value) => [formatNumber(value), copy.publications]} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {analytics.scopusQuartileRows.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <ChartEmpty message={copy.noScopusData} />}
      </article>

      <article className="prorector-bi-card">
        <h3>{copy.webOfScience}</h3>
        {analytics.webOfScienceRows.some((row) => toNumber(row.value) > 0) ? (
          <div className="prorector-index-cards">
            {analytics.webOfScienceRows.map((row) => (
              <div className="prorector-index-card" key={row.name} style={{ "--index-accent": row.fill }}>
                <span>{row.name}</span>
                <strong>{formatNumber(row.value)}</strong>
                <small>{copy.indexedPublications}</small>
              </div>
            ))}
          </div>
        ) : <ChartEmpty message={copy.noWosData} />}
      </article>
    </div>
  );
}

function PublicationGauge({ total, copy = PRORECTOR_COPY.sq.dashboard }) {
  const maxValue = Math.max(total * 2, 1);
  const percent = Math.min(100, Math.round((total / maxValue) * 100));

  return (
    <article className="prorector-report-panel prorector-total-panel">
      <h3>{copy.totalPublications}</h3>
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

function FacultyPercentageChart({ rows, copy = PRORECTOR_COPY.sq.dashboard }) {
  const total = rows.reduce((sum, row) => sum + toNumber(row.value), 0);

  return (
    <article className="prorector-report-panel prorector-faculty-chart-panel">
      <h3>{copy.publicationPercentageByFaculty}</h3>
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
                <Tooltip formatter={(value, name, item) => [`${formatNumber(value)} (${item.payload.percent.toFixed(2)}%)`, copy.publications]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="prorector-faculty-pie-total" aria-hidden="true">
              <strong>{formatNumber(total)}</strong>
              <span>{copy.publications.toLowerCase()}</span>
            </div>
          </div>
          <div className="prorector-faculty-legend">
            {rows.map((row) => (
              <span key={row.name}><i style={{ background: row.fill }} /><b>{row.name}</b><em>{formatNumber(row.value)} ({row.percent.toFixed(2)}%)</em></span>
            ))}
          </div>
        </div>
      ) : <ChartEmpty message={copy.chartEmpty} />}
    </article>
  );
}

function IndexSummaryTable({ title, rows, copy = PRORECTOR_COPY.sq.dashboard }) {
  const total = rows.reduce((sum, row) => sum + toNumber(row.value), 0);

  return (
    <article className="prorector-index-summary">
      <h3>{title}</h3>
      <table>
        <thead><tr><th>{copy.category}</th><th>{copy.publicationCount}</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}><td>{row.name}</td><td>{formatNumber(row.value)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><th>{copy.total}</th><th>{formatNumber(total)}</th></tr></tfoot>
      </table>
    </article>
  );
}

function YearFacultyMatrix({ analytics, copy = PRORECTOR_COPY.sq.dashboard }) {
  const facultyTotals = Object.fromEntries(analytics.facultyColumns.map((faculty) => [
    faculty,
    analytics.yearFacultyRows.reduce((sum, row) => sum + toNumber(row.faculties[faculty]), 0),
  ]));

  return (
    <section className="prorector-report-panel prorector-year-faculty-panel">
      <h3>{copy.publicationsByYearsAndFaculties}</h3>
      <div className="prorector-report-table-wrap">
        <table className="prorector-report-table">
          <thead>
            <tr>
              <th>{copy.publicationYear}</th>
              {analytics.facultyColumns.map((faculty) => <th key={faculty}>{faculty}</th>)}
              <th>{copy.total}</th>
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
              <th>{copy.total}</th>
              {analytics.facultyColumns.map((faculty) => <th key={faculty}>{formatNumber(facultyTotals[faculty])}</th>)}
              <th>{formatNumber(analytics.totalPublications)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function FilterBar({ filters, onChange, faculties, publicationMode = false, fundingMode = false, copy = PRORECTOR_COPY.sq.dashboard }) {
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
            <option key={faculty.id || faculty.name} value={faculty.name}>{getLocalizedFacultyName(faculty.name, copy)}</option>
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
          <option key={faculty.id || faculty.name} value={faculty.name}>{getLocalizedFacultyName(faculty.name, copy)}</option>
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

function AnalyticsCharts({ analytics, faculties = [], copy = PRORECTOR_COPY.sq.dashboard }) {
  const publicationsByYear = analytics.publicationsByYear || [];
  const authorFacultyRows = (faculties || [])
    .map((faculty) => ({
      id: faculty.id || faculty.name,
      name: getLocalizedFacultyName(faculty.name, copy),
      value: toNumber(faculty.professorCount),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "sq"))
    .slice(0, 8);
  const maxAuthorCount = Math.max(...authorFacultyRows.map((row) => row.value), 1);

  return (
    <div className="prorector-dashboard-chart-stack">
      <article className="prorector-analytics-card prorector-dashboard-chart-card">
        <div className="prorector-card-head"><h3>{copy.publicationsByYear}</h3><TrendingUp size={20} /></div>
        {publicationsByYear.some((row) => toNumber(row.value) > 0) ? (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={publicationsByYear}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value) => [formatNumber(value), copy.publications]} />
              <Bar dataKey="value" name={copy.publications} fill="#1e88e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <ChartEmpty message={copy.chartEmpty} />}
      </article>

      <article className="prorector-analytics-card prorector-dashboard-chart-card">
        <div className="prorector-card-head"><h3>{copy.authorsByFaculty}</h3><Users size={20} /></div>
        {authorFacultyRows.length ? (
          <div className="prorector-author-faculty-chart" aria-label={copy.authorsByFaculty}>
            <div className="prorector-author-faculty-scale" aria-hidden="true">
              <span>0</span>
              <span>{formatNumber(maxAuthorCount)} {copy.authors}</span>
            </div>
            <div className="prorector-author-faculty-bars">
              {authorFacultyRows.map((row) => {
                const width = Math.max(18, Math.round((row.value / maxAuthorCount) * 100));

                return (
                  <div className="prorector-author-faculty-row" key={row.id}>
                    <span className="prorector-author-faculty-name" title={row.name}>{row.name}</span>
                    <div className="prorector-author-faculty-track">
                      <div className="prorector-author-faculty-bar" style={{ width: `${width}%` }}>
                        <strong>{formatNumber(row.value)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : <ChartEmpty message={copy.chartEmpty} />}
      </article>
    </div>
  );
}
export default function ProRectorDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage } = useLanguage();
  const copy = PRORECTOR_COPY[language] || PRORECTOR_COPY.sq;
  const [activePage, setActivePage] = useState(location.state?.activePage || "Dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ search: "", year: "", faculty: "", type: "", platform: "", quartile: "", status: "" });
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileDraft, setProfileDraft] = useState(EMPTY_PROFILE_DRAFT);
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [systemPreferences, setSystemPreferences] = useState(DEFAULT_SYSTEM_PREFERENCES);
  const [systemPreferencesMessage, setSystemPreferencesMessage] = useState("");

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
  const publicationAnalytics = useMemo(
    () => buildPublicationAnalytics(publicationRows, copy.dashboard),
    [copy.dashboard, publicationRows]
  );
  const fundingAnalytics = useMemo(
    () => buildFundingAnalytics(fundingRows, copy.dashboard),
    [copy.dashboard, fundingRows]
  );
  const normalizedSearchQuery = normalizeSearchText(searchQuery);

  const filteredFacultyRows = useMemo(() => {
    if (!normalizedSearchQuery) return facultyRows;
    return facultyRows.filter((row) => matchesSearchText(
      normalizedSearchQuery,
      row.name,
      getLocalizedFacultyName(row.name, copy.dashboard),
      row.code,
      row.statusLabel,
      row.status,
      row.professorCount,
      row.publicationCount,
      row.fundingCount
    ));
  }, [copy.dashboard, facultyRows, normalizedSearchQuery]);

  const activeFacultyRows = useMemo(
    () => filteredFacultyRows.filter((row) => row.status === "active"),
    [filteredFacultyRows]
  );

  const activeFacultyPieRows = useMemo(
    () => activeFacultyRows.map((row, index) => ({
      id: row.id,
      name: getLocalizedFacultyName(row.name, copy.dashboard),
      code: row.code,
      value: 1,
      fill: FACULTY_TREEMAP_COLORS[index % FACULTY_TREEMAP_COLORS.length],
    })),
    [activeFacultyRows, copy.dashboard]
  );

  const reportCards = useMemo(() => ([
    {
      id: "publications",
      title: copy.reports.publications,
      description: copy.reports.publicationsDescription,
      filename: "artikuj-prorektor.csv",
      rows: publicationRows,
    },
    {
      id: "funding",
      title: copy.reports.funding,
      description: copy.reports.fundingDescription,
      filename: "financime-prorektor.csv",
      rows: fundingRows,
    },
    {
      id: "faculties",
      title: copy.reports.faculties,
      description: copy.reports.facultiesDescription,
      filename: "fakultete-prorektor.csv",
      rows: filteredFacultyRows,
    },
  ]), [copy.reports, filteredFacultyRows, fundingRows, publicationRows]);

  const visibleReportCards = useMemo(
    () => reportCards.filter((item) => matchesSearchText(searchQuery, item.title, item.description, item.id)),
    [reportCards, searchQuery]
  );

  const visibleSettingsCards = useMemo(() => ({
    language: matchesSearchText(
      searchQuery,
      copy.settings.title,
      copy.settings.languageTitle,
      copy.settings.chooseLanguage,
      copy.settings.languageDescription,
      copy.settings.albanian,
      copy.settings.english
    ),
    profile: matchesSearchText(
      searchQuery,
      copy.settings.title,
      copy.settings.profile,
      copy.settings.name,
      copy.settings.role,
      copy.settings.editProfile,
      profile.name,
      profile.role
    ),
  }), [copy.settings, profile.name, profile.role, searchQuery]);

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
      role: ["prorector", "prorektor"].includes(String(user.role || "").toLowerCase()) ? "ProRector" : user.role || DEFAULT_PROFILE.role,
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

  const unreadNotifications = notifications.filter((item) => !item.isRead).length;

  const loadNotifications = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) {
      setIsNotificationsLoading(true);
    }
    setNotificationsError("");

    try {
      const response = await fetch(apiUrl("/notifications"), {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("notifications_load_failed");
      }

      const data = await response.json();
      setNotifications(Array.isArray(data) ? data.map(mapNotificationRow) : []);
    } catch (error) {
      console.error("Prorector notifications load failed:", error);
      setNotifications([]);
      setNotificationsError("Njoftimet nuk u ngarkuan.");
    } finally {
      if (showLoading) {
        setIsNotificationsLoading(false);
      }
    }
  }, []);

  const loadNotificationPreferences = useCallback(async () => {
    try {
      const response = await fetch(apiUrl("/notifications/preferences"), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("preferences_load_failed");
      }

      const data = await response.json();
      setSystemPreferences((prev) => ({
        ...prev,
        emailNotifications: Boolean(data.emailNotifications),
      }));
    } catch (error) {
      console.error("Prorector preferences load failed:", error);
    }
  }, []);

  const updateLanguagePreference = (event) => {
    const uiLanguage = event.target.value === "en" ? "en" : "sq";
    setLanguage(uiLanguage);
    setSystemPreferencesMessage(PRORECTOR_COPY[uiLanguage].settings.languageUpdated);
  };

  const markAllNotificationsAsRead = async () => {
    if (unreadNotifications === 0 || notifications.length === 0) {
      return;
    }

    const previousNotifications = notifications;
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setNotificationsError("");

    try {
      const response = await fetch(apiUrl("/notifications/read-all"), {
        method: "PATCH",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("notifications_read_all_failed");
      }
    } catch (error) {
      console.error("Prorector mark all notifications failed:", error);
      setNotifications(previousNotifications);
      setNotificationsError("Njoftimet nuk u përditësuan.");
    }
  };

  const markNotificationAsRead = async (id) => {
    const notification = notifications.find((item) => item.id === id);

    if (!notification || notification.isRead) {
      return;
    }

    const previousNotifications = notifications;
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setNotificationsError("");

    try {
      const response = await fetch(apiUrl(`/notifications/${id}/read`), {
        method: "PATCH",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("notification_read_failed");
      }

      const data = await response.json();
      const updatedNotification = mapNotificationRow(data);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updatedNotification, isRead: true } : item))
      );
    } catch (error) {
      console.error("Prorector mark notification failed:", error);
      setNotifications(previousNotifications);
      setNotificationsError("Njoftimi nuk u përditësua.");
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    loadNotifications();
    loadNotificationPreferences();

    const interval = window.setInterval(() => {
      loadNotifications({ showLoading: false });
    }, 15000);

    return () => window.clearInterval(interval);
  }, [loadNotificationPreferences, loadNotifications]);

  useEffect(() => {
    if (!systemPreferencesMessage) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setSystemPreferencesMessage(""), 2500);

    return () => window.clearTimeout(timeout);
  }, [systemPreferencesMessage]);

  const renderDashboard = () => (
    <div className="prorector-dashboard-stack">
      <StateBlock
        loading={publications.loading}
        error={publications.error}
        empty={Boolean(normalizedSearchQuery) && !publicationRows.length && !filteredFacultyRows.length}
        emptyText={copy.dashboard.searchEmpty}
        loadingText={copy.dashboard.loading}
      />
      <AnalyticsCharts analytics={publicationAnalytics} faculties={filteredFacultyRows} copy={copy.dashboard} />
    </div>
  );

  const renderFaculties = () => (
    <div className="prorector-faculty-pie-page">
      <section className="prorector-faculty-pie-panel">
        <div className="prorector-faculty-pie-head">
          <div>
            <h2>{copy.dashboard.facultyList}</h2>
          </div>
          <label className="prorector-faculty-head-search" htmlFor="prorector-faculty-search-input">
            <Search size={18} />
            <input
              id="prorector-faculty-search-input"
              type="text"
              placeholder={copy.dashboard.facultySearchPlaceholder}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
        </div>

        <StateBlock loading={faculties.loading} error={faculties.error} empty={!activeFacultyPieRows.length} emptyText={copy.dashboard.noActiveFaculties} loadingText={copy.dashboard.loading} />
        {!faculties.loading && !faculties.error && activeFacultyPieRows.length ? (
          <div className="prorector-active-faculty-pie-layout">
            <div className="prorector-active-faculty-pie-box">
              <ResponsiveContainer width="100%" height={360}>
                <PieChart margin={{ top: 14, right: 14, bottom: 14, left: 14 }}>
                  <Pie
                    data={activeFacultyPieRows}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={82}
                    outerRadius={132}
                    paddingAngle={3}
                    stroke="#ffffff"
                    strokeWidth={3}
                  >
                    {activeFacultyPieRows.map((row) => <Cell key={row.id} fill={row.fill} />)}
                  </Pie>
                  <Tooltip formatter={(_value, name) => [name, copy.dashboard.faculty]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="prorector-active-faculty-pie-total" aria-hidden="true">
                <strong>{formatNumber(activeFacultyPieRows.length)}</strong>
                <span>{copy.dashboard.active}</span>
              </div>
            </div>

            <div className="prorector-active-faculty-legend">
              {activeFacultyPieRows.map((row) => (
                <span key={row.id} style={{ "--faculty-color": row.fill }}>
                  <i />
                  <b>{row.name}</b>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
  const renderPublications = () => (
    <div className="prorector-publications-page">
      <section className="prorector-table-section prorector-publications-hero">
        <div className="prorector-section-head">
          <div><h2>{copy.dashboard.articlesTitle}</h2><p>{copy.dashboard.articlesDescription}</p></div>
        </div>
        <StateBlock loading={publications.loading} error={publications.error} empty={Boolean(normalizedSearchQuery) && !publicationRows.length} emptyText={copy.dashboard.searchEmpty} loadingText={copy.dashboard.loading} />
      </section>
      <section className="prorector-publication-grid prorector-publication-grid--full">
        <div className="prorector-publication-main">
          {!publications.loading && !publications.error ? (
            <>
              <section className="prorector-publication-report-top">
                <PublicationGauge total={publicationAnalytics.totalPublications} copy={copy.dashboard} />
                <FacultyPercentageChart rows={publicationAnalytics.facultyPercentRows} copy={copy.dashboard} />
                <div className="prorector-index-summary-stack">
                  <IndexSummaryTable title="Scopus" rows={publicationAnalytics.scopusQuartileRows} copy={copy.dashboard} />
                  <IndexSummaryTable title="Web of Science" rows={publicationAnalytics.webOfScienceRows} copy={copy.dashboard} />
                </div>
              </section>
              <YearFacultyMatrix analytics={publicationAnalytics} copy={copy.dashboard} />
            </>
          ) : null}
        </div>
      </section>
    </div>
  );

  const renderFunding = () => (
    <div className="prorector-funding-stat-page">
      <StateBlock loading={funding.loading} error={funding.error} empty={!fundingRows.length} emptyText={normalizedSearchQuery ? copy.dashboard.searchEmpty : copy.dashboard.noFunding} loadingText={copy.dashboard.loading} />
      {!funding.loading && !funding.error && fundingRows.length ? (
        <>
          <section className="prorector-funding-kpi-grid" aria-label="Përmbledhje e financimeve">
            <article>
              <WalletCards size={18} />
              <span>{copy.dashboard.requests}</span>
              <strong>{formatNumber(fundingAnalytics.totals.count)}</strong>
            </article>
            <article>
              <TrendingUp size={18} />
              <span>{copy.dashboard.requestedAmount}</span>
              <strong>{formatCurrency(fundingAnalytics.totals.requested)}</strong>
            </article>
            <article>
              <BarChart3 size={18} />
              <span>{copy.dashboard.approvedAmount}</span>
              <strong>{formatCurrency(fundingAnalytics.totals.approved)}</strong>
            </article>
          </section>

          <section className="prorector-funding-chart-grid">
            <article className="prorector-analytics-card is-wide prorector-funding-year-card">
              <div className="prorector-card-head"><h3>{copy.dashboard.fundingByYear}</h3><TrendingUp size={20} /></div>
              {fundingAnalytics.fundingByYear.some((row) => toNumber(row.requested) > 0 || toNumber(row.approved) > 0) ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={fundingAnalytics.fundingByYear}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => formatNumber(value)} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="requested" name={copy.dashboard.requested} fill="#1d4d7d" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="approved" name={copy.dashboard.approved} fill="#15803d" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <ChartEmpty message={copy.dashboard.chartEmpty} />}
            </article>

            <article className="prorector-analytics-card">
              <div className="prorector-card-head"><h3>{copy.dashboard.fundingCategories}</h3><WalletCards size={20} /></div>
              {fundingAnalytics.categoryRows.some((row) => toNumber(row.value) > 0) ? (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie data={fundingAnalytics.categoryRows} dataKey="value" nameKey="name" innerRadius={58} outerRadius={104} paddingAngle={3}>
                      {fundingAnalytics.categoryRows.map((row) => <Cell key={row.name} fill={row.fill} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [formatNumber(value), copy.dashboard.requests]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <ChartEmpty message={copy.dashboard.chartEmpty} />}
            </article>

            <article className="prorector-analytics-card">
              <div className="prorector-card-head"><h3>{copy.dashboard.requestStatus}</h3><FileText size={20} /></div>
              {fundingAnalytics.statusRows.some((row) => toNumber(row.value) > 0) ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={fundingAnalytics.statusRows} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={96} />
                    <Tooltip formatter={(value) => [formatNumber(value), copy.dashboard.requests]} />
                    <Bar dataKey="value" name={copy.dashboard.requests} radius={[0, 6, 6, 0]}>
                      {fundingAnalytics.statusRows.map((row) => <Cell key={row.name} fill={row.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <ChartEmpty message={copy.dashboard.chartEmpty} />}
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
  const renderReports = () => (
    <div className="prorector-table-section">
      <div className="prorector-section-head">
        <div><h2>{copy.reports.title}</h2></div>
      </div>
      <div className="prorector-reports-grid">
        {visibleReportCards.map((card) => (
          <article className="prorector-report-card" key={card.id}>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <button type="button" className="prorector-btn-primary" onClick={() => exportRows(card.filename, card.rows)}><Download size={16} /> {copy.reports.generate}</button>
          </article>
        ))}
      </div>
      {visibleReportCards.length === 0 ? <div className="prorector-faculty-empty">{copy.reports.noResults}</div> : null}
    </div>
  );

  const renderSettings = () => (
    <div className="prorector-table-section">
      <div className="prorector-section-head">
        <div>
          <h2>{copy.settings.title}</h2>
        </div>
      </div>

      <div className="prorector-settings-grid">
        {visibleSettingsCards.language ? (
        <article className="prorector-settings-card">
          <div className="prorector-settings-card-header">
            <Languages size={20} className="prorector-settings-icon" />
            <h3>{copy.settings.languageTitle}</h3>
          </div>
          <div className="prorector-settings-options">
            <div className="prorector-settings-option-item">
              <div className="prorector-settings-option-info">
                <span className="prorector-settings-label">{copy.settings.chooseLanguage}</span>
                <p className="prorector-settings-subtext">{copy.settings.languageDescription}</p>
              </div>
              <select
                className="prorector-settings-select"
                value={language}
                onChange={updateLanguagePreference}
                aria-label={copy.settings.chooseLanguage}
              >
                <option value="sq">{copy.settings.albanian}</option>
                <option value="en">{copy.settings.english}</option>
              </select>
            </div>
            {systemPreferencesMessage ? (
              <p className="prorector-settings-subtext" role="status">{systemPreferencesMessage}</p>
            ) : null}
          </div>
        </article>
        ) : null}

        {visibleSettingsCards.profile ? (
        <article className="prorector-settings-card">
          <div className="prorector-settings-card-header">
            <Users size={20} className="prorector-settings-icon" />
            <h3>{copy.settings.profile}</h3>
          </div>
          <div className="prorector-settings-list">
            <div className="prorector-settings-item">
              <span className="prorector-settings-label">{copy.settings.name}</span>
              <strong className="prorector-settings-value">{profile.name}</strong>
            </div>
            <div className="prorector-settings-item">
              <span className="prorector-settings-label">{copy.settings.role}</span>
              <strong className="prorector-settings-value">{profile.role}</strong>
            </div>
            <button type="button" className="prorector-settings-edit-btn" onClick={openProfileEditor}>
              {copy.settings.editProfile}
            </button>
          </div>
        </article>
        ) : null}
      </div>
      {!visibleSettingsCards.language && !visibleSettingsCards.profile ? <div className="prorector-faculty-empty">{copy.settings.noResults}</div> : null}
    </div>
  );

  const renderContent = () => {
    if (activePage === "Artikujt") return renderPublications();
    if (activePage === "Fakultetet") return renderFaculties();
    if (activePage === "Financimet") return renderFunding();
    if (activePage === "Raportet") return renderReports();
    if (activePage === "Cilësimet") return renderSettings();
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
          notificationCount={unreadNotifications}
          notifications={notifications}
          notificationsLoading={isNotificationsLoading}
          notificationsError={notificationsError}
          onMarkAllRead={markAllNotificationsAsRead}
          onNotificationRead={markNotificationAsRead}
          onNotificationsOpen={() => loadNotifications({ showLoading: false })}
          onEditProfile={openProfileEditor}
          onProfileAction={(action) => {
            if (action === "Settings") {
              setIsProfileModalOpen(false);
              setActivePage("Cilësimet");
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
          <section className="prorector-modal prorector-profile-modal" role="dialog" aria-label={copy.profile.editTitle} onClick={(event) => event.stopPropagation()}>
            <div className="prorector-modal-header">
              <div>
                <h3 className="prorector-modal-title">{copy.profile.editTitle}</h3>
                <p className="prorector-modal-subtitle">{copy.profile.editSubtitle}</p>
              </div>
              <button type="button" className="prorector-modal-close" onClick={() => setIsProfileModalOpen(false)} aria-label={copy.profile.close}>
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
