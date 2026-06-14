import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Building2,
  FileText,
  PieChart as PieChartIcon,
  Quote,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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

const CHART_COLORS = ["#153a63", "#2e6aa6", "#c9a24f", "#15803d", "#be123c", "#7c3aed"];

const KNOWN_FACULTY_PATTERNS = [
  {
    code: "FIMK",
    name: "Fakulteti i Inxhinierisë Mekanike dhe Kompjuterike",
    matches: (value) => value.includes("mekanike") && value.includes("kompjuterike"),
  },
];

const PUBLICATION_TYPE_LABELS = {
  journal_article: "Artikull në revistë",
  conference_paper: "Punim konference",
  book_chapter: "Kapitull libri",
  book: "Libër",
};

const PUBLICATION_STATUS_LABELS = {
  draft: "Draft",
  submitted: "Dorëzuar",
  in_review: "Në shqyrtim",
  needs_correction: "Kthyer për korrigjim",
  approved: "Aprovuar",
  rejected: "Refuzuar",
};

const REIMBURSEMENT_STATUS_LABELS = {
  submitted: "Dorëzuar",
  received: "Pranuar",
  in_review: "Në shqyrtim",
  needs_correction: "Kërkon korrigjim",
  committee_approved: "Aprovuar nga komisioni",
  approved: "Aprovuar",
  rejected: "Refuzuar",
  paid: "Paguar",
};

function toNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatMetric(value) {
  return new Intl.NumberFormat("sq-AL").format(toNumber(value));
}

function normalizeFacultyKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCaseFaculty(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (!text) {
    return "Fakultet i pa emërtuar";
  }

  return text
    .toLocaleLowerCase("sq-AL")
    .split(" ")
    .map((word) => (["i", "e", "dhe", "në", "ne"].includes(word)
      ? word
      : word.charAt(0).toLocaleUpperCase("sq-AL") + word.slice(1)))
    .join(" ");
}

function getFacultyPresentation(row = {}) {
  const rawName = String(row.name || "").trim();
  const rawCode = String(row.code || "").trim();
  const lookupValue = normalizeFacultyKey(`${rawName} ${rawCode}`);
  const knownFaculty = KNOWN_FACULTY_PATTERNS.find((item) => item.matches(lookupValue));

  if (knownFaculty) {
    return knownFaculty;
  }

  const hasReadableName =
    rawName.length >= 8 &&
    /[aeiouyë]/i.test(rawName) &&
    !/^([a-z])\1{2,}$/i.test(rawName.replace(/[^a-z]/gi, ""));

  const name = hasReadableName ? titleCaseFaculty(rawName) : "Njësi akademike për verifikim";
  const generatedCode = rawCode.length > 8 || normalizeFacultyKey(rawCode) === normalizeFacultyKey(rawName);
  const code = generatedCode ? "" : rawCode.toLocaleUpperCase("sq-AL");

  return { code, name };
}

function getFacultyRouteId(row = {}) {
  return row.id || row.code || normalizeFacultyKey(row.name) || "faculty";
}

function normalizeFacultyRow(row = {}) {
  const presentation = getFacultyPresentation(row);

  return {
    ...row,
    ...presentation,
    activeUserCount: toNumber(row.activeUserCount),
    departmentCount: toNumber(row.departmentCount),
    publicationCount: toNumber(row.publicationCount),
    reimbursementCount: toNumber(row.reimbursementCount),
    citationCount: toNumber(row.citationCount ?? row.citations ?? row.totalCitations),
    q1Count: toNumber(row.q1Count ?? row.q1),
    q2Count: toNumber(row.q2Count ?? row.q2),
    q3Count: toNumber(row.q3Count ?? row.q3),
    q4Count: toNumber(row.q4Count ?? row.q4),
    departmentNames: Array.isArray(row.departmentNames) ? row.departmentNames.filter(Boolean) : [],
  };
}

function buildFacultyRows(rows = []) {
  const groupedRows = new Map();

  rows.forEach((row) => {
    const nextRow = normalizeFacultyRow(row);
    const key = normalizeFacultyKey(nextRow.name);
    const existing = groupedRows.get(key);

    if (!existing) {
      groupedRows.set(key, nextRow);
      return;
    }

    groupedRows.set(key, {
      ...existing,
      activeUserCount: existing.activeUserCount + nextRow.activeUserCount,
      departmentCount: Math.max(existing.departmentCount, nextRow.departmentCount),
      publicationCount: existing.publicationCount + nextRow.publicationCount,
      reimbursementCount: existing.reimbursementCount + nextRow.reimbursementCount,
      citationCount: existing.citationCount + nextRow.citationCount,
      q1Count: existing.q1Count + nextRow.q1Count,
      q2Count: existing.q2Count + nextRow.q2Count,
      q3Count: existing.q3Count + nextRow.q3Count,
      q4Count: existing.q4Count + nextRow.q4Count,
      departmentNames: Array.from(new Set([...existing.departmentNames, ...nextRow.departmentNames])),
      isOfficial: existing.isOfficial || nextRow.isOfficial,
    });
  });

  return Array.from(groupedRows.values()).sort((first, second) => {
    const secondTotal = second.publicationCount + second.reimbursementCount + second.activeUserCount;
    const firstTotal = first.publicationCount + first.reimbursementCount + first.activeUserCount;

    return secondTotal - firstTotal || first.name.localeCompare(second.name, "sq");
  });
}

function getPublicationDate(row = {}) {
  return row.publicationDate || row.publication_date || row.updatedAt || row.updated_at || row.createdAt || row.created_at || "";
}

function normalizeQuartile(value) {
  const match = String(value || "").toUpperCase().match(/\bQ[1-4]\b/);
  return match?.[0] || "";
}

function getPrimaryPublicationQuartile(row = {}) {
  const directQuartile = normalizeQuartile(
    row.quartile
      || row.category
      || row.indexingCategory
      || row.indexing_category
      || row.quartileCategory
      || row.quartile_category
  );

  if (directQuartile) {
    return directQuartile;
  }

  const indexedQuartile = Array.isArray(row.indexing)
    ? row.indexing.map((item) => normalizeQuartile(item.quartile || item.category || item.indexingCategory || item.indexing_category)).find(Boolean)
    : "";

  return indexedQuartile || "";
}

function getPublicationFaculty(row = {}) {
  return row.owner?.faculty || row.faculty?.name || row.facultyName || row.faculty_name || "-";
}

function getPublicationDepartment(row = {}) {
  return row.department?.name || row.departmentName || row.department_name || row.owner?.department || "-";
}

function countBy(rows, getKey) {
  const counts = new Map();

  rows.forEach((row) => {
    const key = getKey(row);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts, ([name, value]) => ({ name, value }));
}

function hasChartValues(rows = [], keys = ["value"]) {
  return rows.some((row) => keys.some((key) => toNumber(row[key]) > 0));
}

function normalizeStatusClass(value) {
  return String(value || "draft").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function FacultyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [facultyRowsRaw, setFacultyRowsRaw] = useState([]);
  const [publicationRows, setPublicationRows] = useState([]);
  const [reimbursementRows, setReimbursementRows] = useState([]);
  const [facultyAnalytics, setFacultyAnalytics] = useState({
    totalPublications: 0,
    quartileDistribution: [],
    departments: [],
    publicationTypes: [],
    recentPublications: [],
    attentionPublications: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const routeId = decodeURIComponent(id || "");

  useEffect(() => {
    let isMounted = true;

    const loadDetails = async () => {
      setIsLoading(true);
      setDataError("");

      try {
        const response = await fetch(apiUrl(`/prorector/faculties/${encodeURIComponent(routeId)}`), {
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || "faculty_details_load_failed");
        }

        console.log("[ProRector FacultyDetails API]", {
          faculty: data.faculty,
          totalPublications: data.totalPublications,
          quartileDistribution: data.quartileDistribution,
          departments: data.departments,
          publicationTypes: data.publicationTypes,
          recentPublications: data.recentPublications,
          attentionPublications: data.attentionPublications,
        });

        if (isMounted) {
          setFacultyRowsRaw(data.faculty ? [data.faculty] : []);
          setPublicationRows(Array.isArray(data.publications) ? data.publications : []);
          setReimbursementRows(Array.isArray(data.reimbursements) ? data.reimbursements : []);
          setFacultyAnalytics({
            totalPublications: toNumber(data.totalPublications),
            quartileDistribution: Array.isArray(data.quartileDistribution) ? data.quartileDistribution : [],
            departments: Array.isArray(data.departments) ? data.departments : [],
            publicationTypes: Array.isArray(data.publicationTypes) ? data.publicationTypes : [],
            recentPublications: Array.isArray(data.recentPublications) ? data.recentPublications : [],
            attentionPublications: Array.isArray(data.attentionPublications) ? data.attentionPublications : [],
          });
        }
      } catch (error) {
        console.error("Faculty details load failed:", error);

        if (isMounted) {
          setDataError("Të dhënat e fakultetit nuk u ngarkuan. Ju lutemi provoni përsëri.");
          setFacultyRowsRaw([]);
          setPublicationRows([]);
          setReimbursementRows([]);
          setFacultyAnalytics({
            totalPublications: 0,
            quartileDistribution: [],
            departments: [],
            publicationTypes: [],
            recentPublications: [],
            attentionPublications: [],
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDetails();

    return () => {
      isMounted = false;
    };
  }, [routeId]);

  const facultyRows = useMemo(() => buildFacultyRows(facultyRowsRaw), [facultyRowsRaw]);

  const selectedFaculty = useMemo(() => {
    const matchesRoute = (row = {}) => {
      const routeKeys = [getFacultyRouteId(row), row.id, row.code, normalizeFacultyKey(row.name)]
        .filter(Boolean)
        .map(String);

      return routeKeys.some((key) => key === routeId);
    };

    return facultyRows.find(matchesRoute) || null;
  }, [facultyRows, routeId]);

  const facultyPublications = useMemo(
    () => (selectedFaculty ? publicationRows : []),
    [publicationRows, selectedFaculty]
  );

  const facultyReimbursements = useMemo(
    () => (selectedFaculty ? reimbursementRows : []),
    [reimbursementRows, selectedFaculty]
  );

  const publicationTypeData = useMemo(
    () => countBy(facultyPublications, (row) => PUBLICATION_TYPE_LABELS[row.publicationType || row.publication_type] || "Të tjera"),
    [facultyPublications]
  );

  const reimbursementStatusData = useMemo(
    () => countBy(facultyReimbursements, (row) => REIMBURSEMENT_STATUS_LABELS[row.status] || row.statusLabel || row.status || "Pa status"),
    [facultyReimbursements]
  );

  const quartileData = useMemo(() => {
    const counts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

    facultyPublications.forEach((row) => {
      const quartile = getPrimaryPublicationQuartile(row);
      if (counts[quartile] !== undefined) {
        counts[quartile] += 1;
      }
    });

    if (!facultyPublications.length && selectedFaculty) {
      counts.Q1 = selectedFaculty.q1Count;
      counts.Q2 = selectedFaculty.q2Count;
      counts.Q3 = selectedFaculty.q3Count;
      counts.Q4 = selectedFaculty.q4Count;
    }

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [facultyPublications, selectedFaculty]);

  const publicationTypeChartData = useMemo(() => {
    if (facultyAnalytics.publicationTypes.length) {
      return facultyAnalytics.publicationTypes.map((row) => ({
        name: PUBLICATION_TYPE_LABELS[row.type] || row.name || row.type || "TÃ« tjera",
        value: toNumber(row.count ?? row.value),
      }));
    }

    return publicationTypeData;
  }, [facultyAnalytics.publicationTypes, publicationTypeData]);

  const quartileChartData = useMemo(() => {
    if (facultyAnalytics.quartileDistribution.length) {
      const counts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

      facultyAnalytics.quartileDistribution.forEach((row) => {
        const quartile = normalizeQuartile(row.quartile || row.name);
        if (counts[quartile] !== undefined) {
          counts[quartile] += toNumber(row.count ?? row.value);
        }
      });

      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }

    return quartileData;
  }, [facultyAnalytics.quartileDistribution, quartileData]);

  const departmentData = useMemo(() => {
    if (facultyAnalytics.departments.length) {
      return facultyAnalytics.departments.map((row) => ({
        departmentName: row.departmentName || row.department_name || row.name || "Pa departament",
        publicationCount: toNumber(row.publicationCount ?? row.publication_count ?? row.count),
        q1Count: toNumber(row.q1Count ?? row.q1_count ?? row.q1),
        q2Count: toNumber(row.q2Count ?? row.q2_count ?? row.q2),
        q3Count: toNumber(row.q3Count ?? row.q3_count ?? row.q3),
        q4Count: toNumber(row.q4Count ?? row.q4_count ?? row.q4),
      }));
    }

    return selectedFaculty?.departmentNames.map((departmentName) => ({
      departmentName,
      publicationCount: 0,
      q1Count: 0,
      q2Count: 0,
      q3Count: 0,
      q4Count: 0,
    })) || [];
  }, [facultyAnalytics.departments, selectedFaculty]);

  const attentionPublications = useMemo(() => {
    const sourceRows = facultyAnalytics.attentionPublications.length
      ? facultyAnalytics.attentionPublications
      : facultyPublications.filter((row) => ["needs_correction", "in_review", "submitted", "rejected"].includes(row.status || ""));
    const normalized = searchQuery.trim().toLowerCase();
    const rows = normalized
      ? sourceRows.filter((row) =>
        [
          row.title,
          getPublicationFaculty(row),
          getPublicationDepartment(row),
          row.publicationType,
          row.publication_type,
          getPrimaryPublicationQuartile(row),
          row.status,
        ].join(" ").toLowerCase().includes(normalized)
      )
      : sourceRows;

    return rows.slice(0, 10);
  }, [facultyAnalytics.attentionPublications, facultyPublications, searchQuery]);

  const monthlyTrendData = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat("sq-AL", { month: "short" });
    const currentDate = new Date();

    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - index), 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;

      return {
        month: monthFormatter.format(monthDate),
        publikime: facultyPublications.filter((row) => String(getPublicationDate(row)).startsWith(monthKey)).length,
        rimbursime: facultyReimbursements.filter((row) => String(row.submittedAt || row.submitted_at || row.createdAt || row.created_at || "").startsWith(monthKey)).length,
      };
    });
  }, [facultyPublications, facultyReimbursements]);

  const totalCitations = useMemo(() => {
    const publicationCitations = facultyPublications.reduce(
      (sum, row) => sum + toNumber(row.citationCount ?? row.citations ?? row.totalCitations),
      0
    );

    return publicationCitations || toNumber(selectedFaculty?.citationCount);
  }, [facultyPublications, selectedFaculty]);

  const detailCards = useMemo(() => {
    if (!selectedFaculty) {
      return [];
    }

    return [
      { label: "Staf akademik", value: selectedFaculty.activeUserCount, icon: UsersRound },
      { label: "Artikuj", value: selectedFaculty.publicationCount || facultyPublications.length, icon: BookOpen },
      { label: "Rimbursime", value: selectedFaculty.reimbursementCount || facultyReimbursements.length, icon: FileText },
      { label: "Citime", value: totalCitations, icon: Quote },
      { label: "Departamente", value: selectedFaculty.departmentCount, icon: Building2 },
    ];
  }, [facultyPublications.length, facultyReimbursements.length, selectedFaculty, totalCitations]);

  const handleSidebarPage = (page) => {
    navigate("/prorector/dashboard", { state: { activePage: page } });
  };

  const handleProfileAction = (action) => {
    if (action === "Logout") {
      fetch(apiUrl("/auth/logout"), {
        method: "POST",
        credentials: "include",
      }).finally(() => navigate("/"));
      return;
    }

    navigate("/prorector/dashboard", { state: { activePage: action } });
  };

  const renderChartEmpty = (message) => (
    <div className="prorector-chart-empty">
      <BarChart3 size={22} />
      <span>{message}</span>
    </div>
  );

  return (
    <div className="prorector-layout">
      <ProRectorSidebar activePage="Fakultetet" setActivePage={handleSidebarPage} />
      <div className="prorector-main">
        <ProRectorTopBar
          activePage="Fakultetet"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          notifications={[]}
          onProfileAction={handleProfileAction}
          onEditProfile={() => navigate("/prorector/dashboard", { state: { activePage: "Settings" } })}
        />

        <div className="prorector-content">
          <div className="prorector-table-section prorector-faculty-detail-page">
            <button
              type="button"
              className="prorector-back-btn"
              onClick={() => navigate("/prorector/dashboard", { state: { activePage: "Fakultetet" } })}
            >
              <ArrowLeft size={17} />
              Kthehu te Fakultetet
            </button>

            {dataError ? (
              <div className="prorector-inline-alert" role="alert">
                {dataError}
              </div>
            ) : null}

            {isLoading ? (
              <div className="prorector-faculty-detail-loading">
                <RefreshCw size={20} className="prorector-spin" />
                <span>Duke ngarkuar detajet e fakultetit...</span>
              </div>
            ) : null}

            {!isLoading && !selectedFaculty ? (
              <div className="prorector-faculty-empty">Fakulteti nuk u gjet.</div>
            ) : null}

            {!isLoading && selectedFaculty ? (
              <>
                <div className="prorector-section-head prorector-faculty-detail-head">
                  <div>
                    <h2>{selectedFaculty.name}</h2>
                    <p>Analizë e detajuar e aktivitetit kërkimor, publikimeve, rimbursimeve dhe departamenteve.</p>
                  </div>
                  <span className="prorector-section-pill">
                    {selectedFaculty.code || "Pa kod"} · {selectedFaculty.statusLabel || "Aktiv"}
                  </span>
                </div>

                <div className="prorector-detail-kpi-grid" aria-label="Treguesit e detajuar të fakultetit">
                  {detailCards.map((card) => {
                    const Icon = card.icon;

                    return (
                      <article className="prorector-kpi-card" key={card.label}>
                        <div className="prorector-kpi-icon">
                          <Icon size={21} />
                        </div>
                        <div>
                          <strong>{formatMetric(card.value)}</strong>
                          <span>{card.label}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="prorector-analytics-grid prorector-faculty-detail-grid">
                  <article className="prorector-analytics-card is-wide">
                    <div className="prorector-card-head">
                      <div>
                        <h3>Trendi mujor i aktivitetit</h3>
                        <p>Publikime dhe rimbursime gjatë gjashtë muajve të fundit.</p>
                      </div>
                      <BarChart3 size={20} />
                    </div>
                    {hasChartValues(monthlyTrendData, ["publikime", "rimbursime"]) ? (
                      <ResponsiveContainer width="100%" height={290}>
                        <LineChart data={monthlyTrendData} margin={{ top: 14, right: 18, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8e0ea" />
                          <XAxis dataKey="month" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="publikime" name="Publikime" stroke="#153a63" strokeWidth={3} dot={{ r: 4 }} />
                          <Line type="monotone" dataKey="rimbursime" name="Rimbursime" stroke="#c9a24f" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      renderChartEmpty("Nuk ka të dhëna mujore për këtë fakultet.")
                    )}
                  </article>

                  <article className="prorector-analytics-card">
                    <div className="prorector-card-head">
                      <div>
                        <h3>Publikime sipas kategorisë</h3>
                        <p>Struktura e publikimeve shkencore.</p>
                      </div>
                      <PieChartIcon size={20} />
                    </div>
                    {publicationTypeChartData.length ? (
                      <ResponsiveContainer width="100%" height={270}>
                        <PieChart>
                          <Pie data={publicationTypeChartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                            {publicationTypeChartData.map((entry, index) => (
                              <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      renderChartEmpty("Nuk ka publikime të kategorizuara.")
                    )}
                  </article>

                  <article className="prorector-analytics-card">
                    <div className="prorector-card-head">
                      <div>
                        <h3>Statusi i rimbursimeve</h3>
                        <p>Gjendja e kërkesave të lidhura me fakultetin.</p>
                      </div>
                      <BadgeCheck size={20} />
                    </div>
                    {reimbursementStatusData.length ? (
                      <ResponsiveContainer width="100%" height={270}>
                        <PieChart>
                          <Pie data={reimbursementStatusData} dataKey="value" nameKey="name" outerRadius={92}>
                            {reimbursementStatusData.map((entry, index) => (
                              <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      renderChartEmpty("Nuk ka rimbursime të regjistruara për këtë fakultet.")
                    )}
                  </article>

                  <article className="prorector-analytics-card">
                    <div className="prorector-card-head">
                      <div>
                        <h3>Q1/Q2/Q3/Q4</h3>
                        <p>Shpërndarja sipas kuartileve.</p>
                      </div>
                      <BookOpen size={20} />
                    </div>
                    {hasChartValues(quartileChartData) ? (
                      <ResponsiveContainer width="100%" height={270}>
                        <BarChart data={quartileChartData} margin={{ top: 14, right: 18, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8e0ea" />
                          <XAxis dataKey="name" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Bar dataKey="value" name="Publikime" radius={[8, 8, 0, 0]} fill="#153a63" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      renderChartEmpty("Nuk ka të dhëna për kuartilet.")
                    )}
                  </article>

                  <article className="prorector-analytics-card">
                    <div className="prorector-card-head">
                      <div>
                        <h3>Departamente</h3>
                        <p>Njësitë e brendshme akademike.</p>
                      </div>
                      <Building2 size={20} />
                    </div>
                    {departmentData.length ? (
                      <div className="prorector-department-analytics-list">
                        {departmentData.map((department) => (
                          <article key={department.departmentName} className="prorector-department-analytics-row">
                            <div>
                              <strong>{department.departmentName}</strong>
                              <span>{formatMetric(department.publicationCount)} publikime</span>
                            </div>
                            <small>
                              Q1 {formatMetric(department.q1Count)} · Q2 {formatMetric(department.q2Count)} · Q3 {formatMetric(department.q3Count)} · Q4 {formatMetric(department.q4Count)}
                            </small>
                          </article>
                        ))}
                      </div>
                    ) : (
                      renderChartEmpty("Nuk ka departamente të regjistruara.")
                    )}
                  </article>
                </div>

                <div className="prorector-faculty-detail-list">
                  <div className="prorector-card-head">
                    <div>
                      <h3>Publikimet që kërkojnë vëmendje</h3>
                      <p>Në shqyrtim, për korrigjim, të refuzuara dhe të aprovuara këtë muaj.</p>
                    </div>
                  </div>
                  {attentionPublications.length ? (
                    <div className="prorector-faculty-table-wrap prorector-attention-publications-wrap">
                      <table className="prorector-table prorector-faculty-table prorector-attention-publications-table">
                        <thead>
                          <tr>
                            <th>Titulli</th>
                            <th>Fakulteti</th>
                            <th>Departamenti</th>
                            <th>Tipi</th>
                            <th>Quartile</th>
                            <th>Statusi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attentionPublications.map((row) => {
                            const status = row.status || "draft";
                            const type = row.publicationType || row.publication_type || "unknown";

                            return (
                              <tr key={row.id}>
                                <td>
                                  <strong>{row.title || "Publikim pa titull"}</strong>
                                  <span className="prorector-table-muted">{row.venue || row.publisher || row.doi || "Pa burim"}</span>
                                </td>
                                <td>{getPublicationFaculty(row)}</td>
                                <td>{getPublicationDepartment(row)}</td>
                                <td>{PUBLICATION_TYPE_LABELS[type] || "Të tjera"}</td>
                                <td>{getPrimaryPublicationQuartile(row) || "-"}</td>
                                <td>
                                  <span className={`status-badge status-${normalizeStatusClass(status)}`}>
                                    {PUBLICATION_STATUS_LABELS[status] || status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="prorector-faculty-empty">Nuk ka publikime që kërkojnë vëmendje për këtë fakultet.</div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
