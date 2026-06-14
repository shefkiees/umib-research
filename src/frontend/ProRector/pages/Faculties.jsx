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

function getPrimaryPublicationQuartile(row = {}) {
  if (row.quartile) {
    return row.quartile;
  }

  const indexedQuartile = Array.isArray(row.indexing)
    ? row.indexing.find((item) => item.quartile)?.quartile
    : "";

  return indexedQuartile || "";
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

        if (isMounted) {
          setFacultyRowsRaw(data.faculty ? [data.faculty] : []);
          setPublicationRows(Array.isArray(data.publications) ? data.publications : []);
          setReimbursementRows(Array.isArray(data.reimbursements) ? data.reimbursements : []);
        }
      } catch (error) {
        console.error("Faculty details load failed:", error);

        if (isMounted) {
          setDataError("Të dhënat e fakultetit nuk u ngarkuan. Ju lutemi provoni përsëri.");
          setFacultyRowsRaw([]);
          setPublicationRows([]);
          setReimbursementRows([]);
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

  const filteredPublications = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();

    if (!normalized) {
      return facultyPublications;
    }

    return facultyPublications.filter((row) =>
      [
        row.title,
        row.venue,
        row.publisher,
        row.doi,
        row.status,
        row.publicationType,
        row.publication_type,
        row.owner?.name,
        row.owner?.department,
      ].join(" ").toLowerCase().includes(normalized)
    );
  }, [facultyPublications, searchQuery]);

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
                    {publicationTypeData.length ? (
                      <ResponsiveContainer width="100%" height={270}>
                        <PieChart>
                          <Pie data={publicationTypeData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                            {publicationTypeData.map((entry, index) => (
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
                    {hasChartValues(quartileData) ? (
                      <ResponsiveContainer width="100%" height={270}>
                        <BarChart data={quartileData} margin={{ top: 14, right: 18, left: 0, bottom: 8 }}>
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
                    {selectedFaculty.departmentNames.length ? (
                      <div className="prorector-department-list">
                        {selectedFaculty.departmentNames.map((department) => (
                          <span key={department}>{department}</span>
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
                      <h3>Publikimet e fundit</h3>
                      <p>Rezultatet filtrohen nga kërkimi në shiritin e sipërm.</p>
                    </div>
                  </div>
                  {filteredPublications.slice(0, 8).length ? (
                    filteredPublications.slice(0, 8).map((row) => {
                      const status = row.status || "draft";
                      const type = row.publicationType || row.publication_type || "unknown";

                      return (
                        <article className="prorector-detail-publication-row" key={row.id}>
                          <div>
                            <strong>{row.title || "Publikim pa titull"}</strong>
                            <span>{row.venue || row.publisher || row.doi || "Pa burim"}</span>
                          </div>
                          <span>{PUBLICATION_TYPE_LABELS[type] || "Të tjera"}</span>
                          <span className={`status-badge status-${normalizeStatusClass(status)}`}>
                            {PUBLICATION_STATUS_LABELS[status] || status}
                          </span>
                        </article>
                      );
                    })
                  ) : (
                    <div className="prorector-faculty-empty">Nuk ka publikime për këtë fakultet.</div>
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
