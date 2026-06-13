import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  BookOpen,
  CheckCircle2,
  CircleUserRound,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Link2,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  RefreshCw,
  Search,
  Settings,
  ShieldX,
  TrendingUp,
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
import ReimbursementReviewPanel from "../../common/ReimbursementReviewPanel";

const conferenceRows = [
  { id: "CF-032", event: "IEEE BalkanCom", unit: "FIMC", status: "Konfirmuar" },
  { id: "CF-027", event: "EduTech Europe", unit: "FED", status: "Ne pritje" },
  { id: "CF-018", event: "Legal Innovation Summit", unit: "FJ", status: "Konfirmuar" },
];

const KNOWN_FACULTY_PATTERNS = [
  {
    code: "FIMK",
    name: "Fakulteti i Inxhinierisë Mekanike dhe Kompjuterike",
    matches: (value) => value.includes("mekanike") && value.includes("kompjuterike"),
  },
];

function toNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
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
    .map((word) => {
      if (["i", "e", "dhe", "në", "ne"].includes(word)) {
        return word;
      }

      return word.charAt(0).toLocaleUpperCase("sq-AL") + word.slice(1);
    })
    .join(" ");
}

function formatMetric(value) {
  return new Intl.NumberFormat("sq-AL").format(toNumber(value));
}

function getInitials(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase("sq-AL"))
    .join("");
}

function getActivityScore(row) {
  const score =
    toNumber(row.publicationCount) * 4 +
    toNumber(row.reimbursementCount) * 3 +
    toNumber(row.activeUserCount) * 1.5 +
    toNumber(row.departmentCount) * 2 +
    toNumber(row.citationCount) * 0.25;

  if (score >= 80) {
    return { label: "Excellent", className: "is-excellent", score: Math.round(score) };
  }

  if (score >= 42) {
    return { label: "Good", className: "is-good", score: Math.round(score) };
  }

  if (score >= 16) {
    return { label: "Average", className: "is-average", score: Math.round(score) };
  }

  return { label: "Low", className: "is-low", score: Math.round(score) };
}

const FACULTY_CHART_COLORS = ["#153a63", "#2e6aa6", "#c9a24f", "#15803d", "#be123c", "#7c3aed"];
const PUBLICATION_STATUS_LABELS = {
  draft: "Draft",
  submitted: "Dorezuar",
  in_review: "Ne shqyrtim",
  needs_correction: "Kthyer per korrigjim",
  approved: "Aprovuar",
  rejected: "Refuzuar",
};
const PUBLICATION_TYPE_LABELS = {
  journal_article: "Artikull ne reviste",
  conference_paper: "Punim konference",
  book_chapter: "Kapitull libri",
  book: "Liber",
};

function normalizeStatusClass(value) {
  return String(value || "draft").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("sq-AL").format(date);
}

function getPublicationYear(row) {
  const explicitYear = row.publicationYear || row.publication_year;

  if (explicitYear) {
    return String(explicitYear);
  }

  const dateValue = row.publicationDate || row.publication_date || row.createdAt || row.created_at;
  const date = dateValue ? new Date(dateValue) : null;
  return date && !Number.isNaN(date.getTime()) ? String(date.getFullYear()) : "-";
}

function getPublicationUnit(row) {
  return row.owner?.faculty || row.owner?.department || row.authorAffiliation || row.author_affiliation || "-";
}

function getPublicationAuthorNames(row) {
  const authorNames = Array.isArray(row.authors)
    ? row.authors.map((author) => author.fullName || author.full_name).filter(Boolean)
    : [];

  if (authorNames.length) {
    return authorNames.join(", ");
  }

  return row.owner?.name || row.owner?.email || "-";
}

function getPrimaryPublicationQuartile(row) {
  if (row.quartile) {
    return row.quartile;
  }

  const indexedQuartile = Array.isArray(row.indexing)
    ? row.indexing.find((item) => item.quartile)?.quartile
    : "";

  return indexedQuartile || "-";
}

function getFacultyPresentation(row) {
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

export default function ProRectorDashboard() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState("Fakultetet");
  const [searchQuery, setSearchQuery] = useState("");
  const [prProfile, setPrProfile] = useState({
    name: "Pro Rector for Research",
    role: "Zëvendës Rektor",
    email: "prorector@umib.edu",
    unit: "Rektori për Kërkimin",
  });
  const [prDraft, setPrDraft] = useState({
    name: "Pro Rector for Research",
    role: "Zëvendës Rektor",
    email: "prorector@umib.edu",
    unit: "Rektori për Kërkimin",
  });
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [systemPreferences, setSystemPreferences] = useState({ emailNotifications: true });
  const [systemPreferencesMessage, setSystemPreferencesMessage] = useState("");
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      category: "Raporte",
      title: "Raporti mujor është gati",
      description: "Raporti për performancën e fakulteteve u gjenerua dhe është i disponueshëm për shqyrtim.",
      text: "U gjenerua raporti mujor i fakulteteve",
      isRead: false,
      createdAt: "Sot, 09:24",
    },
    {
      id: 2,
      category: "Përditësim",
      title: "Të dhënat u sinkronizuan",
      description: "Statistikat e publikimeve dhe projekteve u përditësuan nga sistemi qendror.",
      text: "Te dhenat e fakulteteve u perditesuan",
      isRead: false,
      createdAt: "Sot, 08:10",
    },
    {
      id: 3,
      category: "Eksport",
      title: "Eksporti përfundoi me sukses",
      description: "Skedari CSV për statistikat e përgjithshme u krijua dhe ruajt në arkivë.",
      text: "Eksporti i statistikave u kompletua",
      isRead: true,
      createdAt: "Dje, 17:40",
    },
  ]);
  const [integrationItems, setIntegrationItems] = useState([
    {
      provider: "ORCID",
      description: "Sinkronizim automatik",
      status: "Connected",
    },
    {
      provider: "Crossref",
      description: "Sinkronizim automatik",
      status: "Not connected",
    },
    {
      provider: "Google Scholar",
      description: "Sinkronizim automatik",
      status: "Pending",
    },
  ]);
  const [facultyStats, setFacultyStats] = useState([]);
  const [facultyStatsLoading, setFacultyStatsLoading] = useState(true);
  const [facultyStatsError, setFacultyStatsError] = useState("");
  const [facultySearchQuery, setFacultySearchQuery] = useState("");
  const [facultySortBy, setFacultySortBy] = useState("publications");
  const [facultyStatusFilter, setFacultyStatusFilter] = useState("all");
  const [publicationStats, setPublicationStats] = useState([]);
  const [publicationStatsLoading, setPublicationStatsLoading] = useState(true);
  const [publicationStatsError, setPublicationStatsError] = useState("");

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const normalizedFacultyQuery = facultySearchQuery.trim().toLowerCase();

  useEffect(() => {
    let isMounted = true;

    const loadFacultyStats = async () => {
      setFacultyStatsLoading(true);
      setFacultyStatsError("");

      try {
        const response = await fetch(apiUrl("/prorector/faculties"), {
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || "faculties_load_failed");
        }

        if (isMounted) {
          setFacultyStats(Array.isArray(data.faculties) ? data.faculties : []);
        }
      } catch (error) {
        console.error("Faculty stats load failed:", error);

        if (isMounted) {
          setFacultyStatsError("Fakultetet aktive nuk u ngarkuan. Provoni perseri.");
        }
      } finally {
        if (isMounted) {
          setFacultyStatsLoading(false);
        }
      }
    };

    loadFacultyStats();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPublicationStats = async () => {
      setPublicationStatsLoading(true);
      setPublicationStatsError("");

      try {
        const response = await fetch(apiUrl("/publications?scope=all&limit=200"), {
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
          throw new Error("unauthorized");
        }

        if (!response.ok) {
          throw new Error(data.message || "publications_load_failed");
        }

        const rows = Array.isArray(data) ? data : data.data;

        if (isMounted) {
          setPublicationStats(Array.isArray(rows) ? rows : []);
        }
      } catch (error) {
        console.error("Pro rector publications load failed:", error);

        if (isMounted) {
          setPublicationStats([]);
          setPublicationStatsError(
            error.message === "unauthorized"
              ? "Artikujt nuk u ngarkuan sepse sesioni nuk u pranua nga API."
              : "Artikujt nuk u ngarkuan nga te dhenat reale. Provoni perseri."
          );
        }
      } finally {
        if (isMounted) {
          setPublicationStatsLoading(false);
        }
      }
    };

    loadPublicationStats();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        const response = await fetch(apiUrl("/notifications/preferences"), {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("preferences_load_failed");
        }

        const data = await response.json();

        if (isMounted) {
          setSystemPreferences((prev) => ({
            ...prev,
            emailNotifications: Boolean(data.emailNotifications),
          }));
        }
      } catch (error) {
        console.error("Preferences load failed:", error);
      }
    };

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!systemPreferencesMessage) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setSystemPreferencesMessage(""), 2500);

    return () => window.clearTimeout(timeout);
  }, [systemPreferencesMessage]);

  const filteredFacultyStats = useMemo(() => {
    if (!normalizedQuery) {
      return facultyStats;
    }

    return facultyStats.filter((item) => {
      const row = `${item.code} ${item.name} ${item.statusLabel} ${item.departmentCount} ${item.activeUserCount} ${item.publicationCount} ${item.reimbursementCount}`.toLowerCase();
      return row.includes(normalizedQuery);
    });
  }, [facultyStats, normalizedQuery]);

  const facultyDashboardRows = useMemo(() => {
    const groupedRows = new Map();

    filteredFacultyStats.forEach((row) => {
      const presentation = getFacultyPresentation(row);
      const key = normalizeFacultyKey(presentation.name);
      const existing = groupedRows.get(key);
      const explicitCitationCount = row.citationCount ?? row.citations ?? row.totalCitations ?? 0;
      const explicitQ1 = row.q1Count ?? row.q1 ?? 0;
      const explicitQ2 = row.q2Count ?? row.q2 ?? 0;
      const explicitQ3 = row.q3Count ?? row.q3 ?? 0;
      const explicitQ4 = row.q4Count ?? row.q4 ?? 0;
      const nextRow = {
        ...row,
        ...presentation,
        activeUserCount: toNumber(row.activeUserCount),
        departmentCount: toNumber(row.departmentCount),
        publicationCount: toNumber(row.publicationCount),
        reimbursementCount: toNumber(row.reimbursementCount),
        citationCount: toNumber(explicitCitationCount),
        q1Count: toNumber(explicitQ1),
        q2Count: toNumber(explicitQ2),
        q3Count: toNumber(explicitQ3),
        q4Count: toNumber(explicitQ4),
      };

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
        isOfficial: existing.isOfficial || nextRow.isOfficial,
      });
    });

    return Array.from(groupedRows.values()).sort((first, second) => {
      const secondTotal = second.publicationCount + second.reimbursementCount + second.activeUserCount;
      const firstTotal = first.publicationCount + first.reimbursementCount + first.activeUserCount;

      return secondTotal - firstTotal || first.name.localeCompare(second.name, "sq");
    });
  }, [filteredFacultyStats]);

  const facultyPerformanceRows = useMemo(() => {
    const rows = facultyDashboardRows
      .filter((row) => {
        if (!normalizedFacultyQuery) {
          return true;
        }

        const searchable = `${row.name} ${row.code} ${row.statusLabel} ${row.departmentNames?.join(" ")}`.toLowerCase();
        return searchable.includes(normalizedFacultyQuery);
      })
      .map((row) => ({
        ...row,
        activity: getActivityScore(row),
      }))
      .filter((row) => {
        if (facultyStatusFilter === "all") {
          return true;
        }

        return row.activity.className === `is-${facultyStatusFilter}`;
      });

    return [...rows].sort((first, second) => {
      const sorters = {
        publications: second.publicationCount - first.publicationCount,
        citations: second.citationCount - first.citationCount,
        reimbursements: second.reimbursementCount - first.reimbursementCount,
      };

      return sorters[facultySortBy] || first.name.localeCompare(second.name, "sq");
    });
  }, [facultyDashboardRows, facultySortBy, facultyStatusFilter, normalizedFacultyQuery]);

  const facultyOverview = useMemo(() => {
    const totals = facultyDashboardRows.reduce(
      (totals, row) => ({
        facultyCount: totals.facultyCount + 1,
        activeUserCount: totals.activeUserCount + row.activeUserCount,
        departmentCount: totals.departmentCount + row.departmentCount,
        publicationCount: totals.publicationCount + row.publicationCount,
        reimbursementCount: totals.reimbursementCount + row.reimbursementCount,
        citationCount: totals.citationCount + row.citationCount,
        q1Count: totals.q1Count + row.q1Count,
        q2Count: totals.q2Count + row.q2Count,
        q3Count: totals.q3Count + row.q3Count,
        q4Count: totals.q4Count + row.q4Count,
      }),
      {
        facultyCount: 0,
        activeUserCount: 0,
        departmentCount: 0,
        publicationCount: 0,
        reimbursementCount: 0,
        citationCount: 0,
        q1Count: 0,
        q2Count: 0,
        q3Count: 0,
        q4Count: 0,
      }
    );

    const activityCount = totals.publicationCount + totals.reimbursementCount;
    const averageActivity = totals.facultyCount > 0 ? Math.round(activityCount / totals.facultyCount) : 0;

    return {
      ...totals,
      activityCount,
      averageActivity,
    };
  }, [facultyDashboardRows]);

  const facultyKpiCards = useMemo(
    () => [
      {
        label: "Fakultete Aktive",
        value: facultyOverview.facultyCount,
        trend: `${facultyPerformanceRows.length} ne pamje`,
        icon: BadgeCheck,
        tone: "is-blue",
      },
      {
        label: "Staf Akademik Aktiv",
        value: facultyOverview.activeUserCount,
        trend: "profile aktive",
        icon: UsersRound,
        tone: "is-green",
      },
      {
        label: "Artikuj Shkencore",
        value: facultyOverview.publicationCount,
        trend: `${facultyOverview.averageActivity} mes. aktivitet`,
        icon: BookOpen,
        tone: "is-gold",
      },
      {
        label: "Rimbursime Totale",
        value: facultyOverview.reimbursementCount,
        trend: "kerkesa jo draft",
        icon: FileText,
        tone: "is-rose",
      },
      {
        label: "Citime Totale",
        value: facultyOverview.citationCount,
        trend: facultyOverview.citationCount ? "nga profili" : "pa te dhena",
        icon: TrendingUp,
        tone: "is-indigo",
      },
      {
        label: "Aktivitete Akademike",
        value: facultyOverview.activityCount,
        trend: "artikuj + rimbursime",
        icon: Activity,
        tone: "is-teal",
      },
    ],
    [facultyOverview, facultyPerformanceRows.length]
  );

  const publicationsByFaculty = useMemo(
    () =>
      facultyDashboardRows
        .filter((row) => row.publicationCount > 0)
        .slice(0, 10)
        .map((row) => ({
          faculty: row.code || getInitials(row.name) || "N/A",
          publications: row.publicationCount,
          name: row.name,
        })),
    [facultyDashboardRows]
  );

  const publicationDistribution = useMemo(() => {
    return [
      {
        name: "Journal Articles",
        value: facultyDashboardRows.reduce((sum, row) => sum + toNumber(row.journalArticleCount ?? row.journalArticles), 0),
      },
      {
        name: "Conference Papers",
        value: facultyDashboardRows.reduce((sum, row) => sum + toNumber(row.conferencePaperCount ?? row.conferencePapers), 0),
      },
      {
        name: "Book Chapters",
        value: facultyDashboardRows.reduce((sum, row) => sum + toNumber(row.bookChapterCount ?? row.bookChapters), 0),
      },
      {
        name: "Books",
        value: facultyDashboardRows.reduce((sum, row) => sum + toNumber(row.bookCount ?? row.books), 0),
      },
    ].filter((item) => item.value > 0);
  }, [facultyDashboardRows]);

  const reimbursementStatusData = useMemo(() => {
    return [
      {
        name: "Approved",
        value: facultyDashboardRows.reduce((sum, row) => sum + toNumber(row.approvedReimbursementCount ?? row.approvedReimbursements), 0),
      },
      {
        name: "Pending",
        value: facultyDashboardRows.reduce((sum, row) => sum + toNumber(row.pendingReimbursementCount ?? row.pendingReimbursements), 0),
      },
      {
        name: "Rejected",
        value: facultyDashboardRows.reduce((sum, row) => sum + toNumber(row.rejectedReimbursementCount ?? row.rejectedReimbursements), 0),
      },
    ].filter((item) => item.value > 0);
  }, [facultyDashboardRows]);

  const monthlyActivityTrend = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat("sq-AL", { month: "short" });
    const currentDate = new Date();

    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - index), 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
      const rowsForMonth = facultyDashboardRows.filter((row) => String(row.updatedAt || "").startsWith(monthKey));

      return {
        month: monthFormatter.format(monthDate),
        publications: rowsForMonth.reduce((sum, row) => sum + row.publicationCount, 0),
        reimbursements: rowsForMonth.reduce((sum, row) => sum + row.reimbursementCount, 0),
      };
    });
  }, [facultyDashboardRows]);

  const hasMonthlyActivityTrend = useMemo(
    () => monthlyActivityTrend.some((row) => row.publications > 0 || row.reimbursements > 0),
    [monthlyActivityTrend]
  );

  const filteredPublications = useMemo(() => {
    if (!normalizedQuery) {
      return publicationStats;
    }

    return publicationStats.filter((item) =>
      [
        item.id,
        item.title,
        item.venue,
        item.publisher,
        item.doi,
        item.status,
        item.publicationType,
        item.publication_type,
        item.owner?.name,
        item.owner?.email,
        item.owner?.faculty,
        item.owner?.department,
        getPublicationAuthorNames(item),
      ].join(" ").toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, publicationStats]);

  const publicationOverview = useMemo(() => {
    return publicationStats.reduce(
      (totals, row) => {
        const status = row.status || "draft";
        const quartile = getPrimaryPublicationQuartile(row);

        return {
          ...totals,
          total: totals.total + 1,
          approved: totals.approved + (status === "approved" ? 1 : 0),
          review: totals.review + (["submitted", "in_review", "needs_correction"].includes(status) ? 1 : 0),
          indexed: totals.indexed + (row.indexingPlatform || row.indexing_platform || row.indexing?.length ? 1 : 0),
          q1: totals.q1 + (quartile === "Q1" ? 1 : 0),
        };
      },
      { total: 0, approved: 0, review: 0, indexed: 0, q1: 0 }
    );
  }, [publicationStats]);

  const publicationsByUnit = useMemo(() => {
    const counts = new Map();

    publicationStats.forEach((row) => {
      const unit = getPublicationUnit(row);
      counts.set(unit, (counts.get(unit) || 0) + 1);
    });

    return Array.from(counts, ([unit, articles]) => ({ unit, articles }))
      .sort((first, second) => second.articles - first.articles || first.unit.localeCompare(second.unit, "sq"))
      .slice(0, 8);
  }, [publicationStats]);

  const publicationsByStatus = useMemo(() => {
    const counts = new Map();

    publicationStats.forEach((row) => {
      const status = row.status || "draft";
      const label = PUBLICATION_STATUS_LABELS[status] || status;
      counts.set(label, (counts.get(label) || 0) + 1);
    });

    return Array.from(counts, ([name, value]) => ({ name, value }));
  }, [publicationStats]);

  const publicationsByType = useMemo(() => {
    const counts = new Map();

    publicationStats.forEach((row) => {
      const type = row.publicationType || row.publication_type || "unknown";
      const label = PUBLICATION_TYPE_LABELS[type] || "Te tjera";
      counts.set(label, (counts.get(label) || 0) + 1);
    });

    return Array.from(counts, ([name, value]) => ({ name, value }));
  }, [publicationStats]);

  const filteredConferences = useMemo(() => {
    if (!normalizedQuery) {
      return conferenceRows;
    }

    return conferenceRows.filter((item) =>
      `${item.id} ${item.event} ${item.unit} ${item.status}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const handleEditProfile = () => {
    setIsEditProfileOpen(true);
  };

  const updateEmailNotificationsPreference = async (value) => {
    const previousValue = systemPreferences.emailNotifications;

    setSystemPreferences((prev) => ({
      ...prev,
      emailNotifications: value,
    }));

    try {
      const response = await fetch(apiUrl("/notifications/preferences"), {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emailNotifications: value }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error("preferences_update_failed");
      }

      setSystemPreferences((prev) => ({
        ...prev,
        emailNotifications: Boolean(data.emailNotifications),
      }));
      setSystemPreferencesMessage("Preferencat u ruajten me sukses.");
    } catch (error) {
      console.error("Preferences save failed:", error);
      setSystemPreferences((prev) => ({
        ...prev,
        emailNotifications: previousValue,
      }));
      setSystemPreferencesMessage("Preferencat nuk u ruajten. Provoni perseri.");
    }
  };

  const handleSaveProfile = () => {
    setPrProfile(prDraft);
    setIsEditProfileOpen(false);
  };

  const handleCancelProfile = () => {
    setPrDraft(prProfile);
    setIsEditProfileOpen(false);
  };

  const markNotificationAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, isRead: true })));
  };

  const toggleIntegrationStatus = (provider) => {
    const nextStatusByCurrentStatus = {
      Connected: "Not connected",
      "Not connected": "Pending",
      Pending: "Connected",
    };

    setIntegrationItems((prev) =>
      prev.map((item) =>
        item.provider === provider
          ? { ...item, status: nextStatusByCurrentStatus[item.status] || "Pending" }
          : item
      )
    );
  };

  const renderIntegrationStatus = (status) => {
    const statusConfig = {
      Connected: {
        label: "Connected",
        icon: CheckCircle2,
        className: "is-connected",
      },
      "Not connected": {
        label: "Not connected",
        icon: ShieldX,
        className: "is-not-connected",
      },
      Pending: {
        label: "Pending",
        icon: RefreshCw,
        className: "is-pending",
      },
    };

    const config = statusConfig[status] || statusConfig.Pending;
    const Icon = config.icon;

    return (
      <span className={`prorector-integration-status ${config.className}`}>
        <Icon size={16} />
        {config.label}
      </span>
    );
  };

  const renderIntegrations = () => {
    return (
      <div className="prorector-table-section">
        <div className="prorector-integrations-panel">
          <div className="prorector-integrations-head">
            <div>
              <h2>Integrime me Platformat</h2>
              <p>Menaxho lidhjet me shërbimet e jashtme kërkimore</p>
            </div>
            <button type="button" className="prorector-btn-outline">
              Shto Integrim të Ri
            </button>
          </div>

          <div className="prorector-integrations-list">
            {integrationItems.map((item) => (
              <article className="prorector-integration-card" key={item.provider}>
                <div className={`prorector-integration-flag ${item.status.toLowerCase().replace(/\s+/g, "-")}`}>
                  <Link2 size={26} />
                </div>
                <div className="prorector-integration-copy">
                  <h3>{item.provider}</h3>
                  <p>{item.description}</p>
                </div>
                <button
                  type="button"
                  className="prorector-integration-action"
                  onClick={() => toggleIntegrationStatus(item.provider)}
                >
                  {item.status === "Connected" ? "Shkëput" : item.status === "Not connected" ? "Lidhe" : "Rifillo"}
                </button>
                {renderIntegrationStatus(item.status)}
              </article>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const exportFacultyCsv = () => {
    const headers = [
      "Faculty Name",
      "Code",
      "Academic Staff",
      "Departments",
      "Artikuj",
      "Q1",
      "Q2",
      "Q3",
      "Q4",
      "Citations",
      "Reimbursements",
      "Activity Score",
      "Status",
    ];
    const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = facultyPerformanceRows.map((row) => [
      row.name,
      row.code || "-",
      row.activeUserCount,
      row.departmentCount,
      row.publicationCount,
      row.q1Count,
      row.q2Count,
      row.q3Count,
      row.q4Count,
      row.citationCount,
      row.reimbursementCount,
      row.activity.label,
      row.statusLabel || "Aktiv",
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "faculty-performance-analytics.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportFacultyPdf = () => {
    window.print();
  };

  const renderChartEmpty = (message) => (
    <div className="prorector-chart-empty">
      <BarChart3 size={22} />
      <span>{message}</span>
    </div>
  );

  const renderFacultySkeletons = () => (
    <div className="prorector-faculty-skeletons" aria-label="Duke ngarkuar analitikat e fakulteteve">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="prorector-skeleton-card" key={`faculty-skeleton-${index}`}>
          <span />
          <strong />
          <small />
        </div>
      ))}
    </div>
  );

  const renderPublicationsPage = () => (
    <div className="prorector-table-section prorector-analytics-dashboard">
      <div className="prorector-section-head">
        <div>
          <h2>Artikujt</h2>
          <p>Statistika reale nga regjistri i artikujve akademike.</p>
        </div>
        <span className="prorector-section-pill">
          {publicationOverview.total} artikuj
        </span>
      </div>

      {publicationStatsError ? (
        <div className="prorector-inline-alert" role="alert">
          {publicationStatsError}
        </div>
      ) : null}

      {publicationStatsLoading ? renderFacultySkeletons() : null}

      {!publicationStatsLoading ? (
        <div className="prorector-kpi-grid" aria-label="Treguesit kryesore te artikujve">
          {[
            { label: "Artikuj gjithsej", value: publicationOverview.total, trend: "nga Supabase", icon: BookOpen, tone: "is-blue" },
            { label: "Te aprovuar", value: publicationOverview.approved, trend: "status final", icon: BadgeCheck, tone: "is-green" },
            { label: "Ne shqyrtim", value: publicationOverview.review, trend: "komision/prorektor", icon: RefreshCw, tone: "is-gold" },
            { label: "Te indeksuar", value: publicationOverview.indexed, trend: "me platforme", icon: LineChartIcon, tone: "is-indigo" },
            { label: "Q1", value: publicationOverview.q1, trend: "kuartili me i larte", icon: TrendingUp, tone: "is-teal" },
            { label: "Ne pamje", value: filteredPublications.length, trend: "pas kerkimit", icon: Search, tone: "is-rose" },
          ].map((card) => {
            const Icon = card.icon;

            return (
              <article className={`prorector-kpi-card ${card.tone}`} key={card.label}>
                <div className="prorector-kpi-icon">
                  <Icon size={22} />
                </div>
                <div>
                  <strong>{formatMetric(card.value)}</strong>
                  <span>{card.label}</span>
                </div>
                <small>
                  <TrendingUp size={14} />
                  {card.trend}
                </small>
              </article>
            );
          })}
        </div>
      ) : null}

      {!publicationStatsLoading ? (
        <div className="prorector-analytics-grid">
          <article className="prorector-analytics-card is-wide">
            <div className="prorector-card-head">
              <div>
                <h3>Artikuj sipas njesise</h3>
                <p>Shperndarja reale sipas fakultetit ose departamentit.</p>
              </div>
              <BarChart3 size={20} />
            </div>
            {publicationsByUnit.length ? (
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={publicationsByUnit} margin={{ top: 14, right: 18, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8e0ea" />
                  <XAxis dataKey="unit" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "rgba(15, 23, 42, 0.05)" }} />
                  <Bar dataKey="articles" name="Artikuj" radius={[8, 8, 0, 0]} fill="#153a63" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              renderChartEmpty("Nuk ka artikuj te regjistruar per grafikun.")
            )}
          </article>

          <article className="prorector-analytics-card">
            <div className="prorector-card-head">
              <div>
                <h3>Statusi i artikujve</h3>
                <p>Draft, shqyrtim, aprovuar ose refuzuar.</p>
              </div>
              <PieChartIcon size={20} />
            </div>
            {publicationsByStatus.length ? (
              <ResponsiveContainer width="100%" height={270}>
                <PieChart>
                  <Pie data={publicationsByStatus} dataKey="value" nameKey="name" outerRadius={92}>
                    {publicationsByStatus.map((entry, index) => (
                      <Cell key={entry.name} fill={FACULTY_CHART_COLORS[index % FACULTY_CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              renderChartEmpty("Nuk ka status per raportim.")
            )}
          </article>

          <article className="prorector-analytics-card">
            <div className="prorector-card-head">
              <div>
                <h3>Lloji i artikujve</h3>
                <p>Revista, konferenca, libra dhe kategori tjera.</p>
              </div>
              <FileText size={20} />
            </div>
            {publicationsByType.length ? (
              <ResponsiveContainer width="100%" height={270}>
                <PieChart>
                  <Pie data={publicationsByType} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                    {publicationsByType.map((entry, index) => (
                      <Cell key={entry.name} fill={FACULTY_CHART_COLORS[index % FACULTY_CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              renderChartEmpty("Nuk ka lloje artikujsh per raportim.")
            )}
          </article>
        </div>
      ) : null}

      {!publicationStatsLoading && filteredPublications.length > 0 ? (
        <div className="prorector-faculty-table-wrap">
          <table className="prorector-table prorector-faculty-table prorector-publications-table">
            <thead>
              <tr>
                <th>Artikulli</th>
                <th>Autoret</th>
                <th>Njesia</th>
                <th>Lloji</th>
                <th>Viti</th>
                <th>Kuartili</th>
                <th>Statusi</th>
                <th>Perditesuar</th>
              </tr>
            </thead>
            <tbody>
              {filteredPublications.map((row) => {
                const status = row.status || "draft";
                const type = row.publicationType || row.publication_type || "unknown";

                return (
                  <tr key={row.id}>
                    <td>
                      <strong className="prorector-faculty-name">{row.title || "Artikull pa titull"}</strong>
                      <span className="prorector-table-muted">{row.venue || row.publisher || row.doi || "-"}</span>
                    </td>
                    <td>{getPublicationAuthorNames(row)}</td>
                    <td>{getPublicationUnit(row)}</td>
                    <td>{PUBLICATION_TYPE_LABELS[type] || "Te tjera"}</td>
                    <td>{getPublicationYear(row)}</td>
                    <td>{getPrimaryPublicationQuartile(row)}</td>
                    <td>
                      <span className={`status-badge status-${normalizeStatusClass(status)}`}>
                        {PUBLICATION_STATUS_LABELS[status] || status}
                      </span>
                    </td>
                    <td>{formatDate(row.updatedAt || row.updated_at || row.createdAt || row.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!publicationStatsLoading && !filteredPublications.length ? (
        <div className="prorector-faculty-empty">Nuk u gjet asnje artikull per kerkimin aktual.</div>
      ) : null}
    </div>
  );

  const renderContent = () => {
    if (activePage === "Artikujt") {
      return renderPublicationsPage();
    }

    if (activePage === "Fakultetet") {
      return (
        <div className="prorector-table-section prorector-faculties-section prorector-analytics-dashboard">
          <div className="prorector-section-head">
            <div>
              <h2>Fakultetet</h2>
              <p>Përmbledhje e pastër e njësive akademike dhe aktivitetit të tyre.</p>
            </div>
            <span className="prorector-section-pill">
              {facultyOverview.facultyCount} fakultete aktive
            </span>
          </div>
          {facultyStatsError ? (
            <div className="prorector-inline-alert" role="alert">
              {facultyStatsError}
            </div>
          ) : null}
          {facultyStatsLoading ? renderFacultySkeletons() : null}

          {!facultyStatsLoading ? (
            <div className="prorector-kpi-grid" aria-label="Treguesit kryesore te fakulteteve">
              {facultyKpiCards.map((card) => {
                const Icon = card.icon;

                return (
                  <article className={`prorector-kpi-card ${card.tone}`} key={card.label}>
                    <div className="prorector-kpi-icon">
                      <Icon size={22} />
                    </div>
                    <div>
                      <strong>{formatMetric(card.value)}</strong>
                      <span>{card.label}</span>
                    </div>
                    <small>
                      <TrendingUp size={14} />
                      {card.trend}
                    </small>
                  </article>
                );
              })}
            </div>
          ) : null}

          {!facultyStatsLoading ? (
            <div className="prorector-analytics-grid">
              <article className="prorector-analytics-card is-wide">
                <div className="prorector-card-head">
                  <div>
                    <h3>Artikuj sipas fakultetit</h3>
                    <p>Numri i artikujve sipas fakultetit.</p>
                  </div>
                  <BarChart3 size={20} />
                </div>
                {publicationsByFaculty.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={publicationsByFaculty} margin={{ top: 14, right: 18, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8e0ea" />
                      <XAxis dataKey="faculty" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: "rgba(15, 23, 42, 0.05)" }} />
                      <Bar dataKey="publications" name="Artikuj" radius={[8, 8, 0, 0]} fill="#153a63" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  renderChartEmpty("Nuk ka artikuj te regjistruar per grafikun.")
                )}
              </article>

              <article className="prorector-analytics-card">
                <div className="prorector-card-head">
                  <div>
                    <h3>Publication Distribution</h3>
                    <p>Struktura e artikujve shkencore.</p>
                  </div>
                  <PieChartIcon size={20} />
                </div>
                {publicationDistribution.length ? (
                  <ResponsiveContainer width="100%" height={270}>
                    <PieChart>
                      <Pie data={publicationDistribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                        {publicationDistribution.map((entry, index) => (
                          <Cell key={entry.name} fill={FACULTY_CHART_COLORS[index % FACULTY_CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  renderChartEmpty("Nuk ka ndarje te artikujve per raportim.")
                )}
              </article>

              <article className="prorector-analytics-card">
                <div className="prorector-card-head">
                  <div>
                    <h3>Reimbursement Status</h3>
                    <p>Aprovuar, ne pritje dhe refuzuar.</p>
                  </div>
                  <BadgeCheck size={20} />
                </div>
                {reimbursementStatusData.length ? (
                  <ResponsiveContainer width="100%" height={270}>
                    <PieChart>
                      <Pie data={reimbursementStatusData} dataKey="value" nameKey="name" outerRadius={92}>
                        {reimbursementStatusData.map((entry, index) => (
                          <Cell key={entry.name} fill={["#15803d", "#c9a24f", "#be123c"][index]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  renderChartEmpty("Nuk ka rimbursime per status.")
                )}
              </article>

              <article className="prorector-analytics-card is-wide">
                <div className="prorector-card-head">
                  <div>
                    <h3>Monthly Activity Trend</h3>
                    <p>Artikuj dhe rimbursime sipas muajit.</p>
                  </div>
                  <LineChartIcon size={20} />
                </div>
                {hasMonthlyActivityTrend ? (
                  <ResponsiveContainer width="100%" height={290}>
                    <LineChart data={monthlyActivityTrend} margin={{ top: 14, right: 18, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8e0ea" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="publications" name="Artikuj" stroke="#153a63" strokeWidth={3} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="reimbursements" name="Reimbursements" stroke="#c9a24f" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  renderChartEmpty("Nuk ka te dhena mujore per aktivitetin.")
                )}
              </article>
            </div>
          ) : null}

          {!facultyStatsLoading ? (
            <div className="prorector-faculty-toolbar">
              <label className="prorector-faculty-search">
                <Search size={17} />
                <input
                  value={facultySearchQuery}
                  onChange={(event) => setFacultySearchQuery(event.target.value)}
                  placeholder="Kerko fakultet, kod ose departament"
                />
              </label>
              <label className="prorector-faculty-control">
                <Filter size={16} />
                <select value={facultyStatusFilter} onChange={(event) => setFacultyStatusFilter(event.target.value)}>
                  <option value="all">Te gjitha statuset</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="average">Average</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="prorector-faculty-control">
                <BarChart3 size={16} />
                <select value={facultySortBy} onChange={(event) => setFacultySortBy(event.target.value)}>
                  <option value="publications">Sorto: artikuj</option>
                  <option value="citations">Sorto: citime</option>
                  <option value="reimbursements">Sorto: rimbursime</option>
                </select>
              </label>
              <div className="prorector-export-actions">
                <button type="button" onClick={exportFacultyCsv}>
                  <FileSpreadsheet size={16} />
                  Excel
                </button>
                <button type="button" onClick={exportFacultyPdf}>
                  <Download size={16} />
                  PDF
                </button>
              </div>
            </div>
          ) : null}

          {!facultyStatsLoading && facultyPerformanceRows.length > 0 ? (
            <div className="prorector-faculty-table-wrap">
              <table className="prorector-table prorector-faculty-table prorector-performance-table">
                <thead>
                  <tr>
                    <th>Faculty Name</th>
                    <th>Code</th>
                    <th>Academic Staff</th>
                    <th>Departments</th>
                    <th>Artikuj</th>
                    <th>Q1</th>
                    <th>Q2</th>
                    <th>Q3</th>
                    <th>Q4</th>
                    <th>Citations</th>
                    <th>Reimbursements</th>
                    <th>Activity Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {facultyPerformanceRows.map((row) => (
                    <tr key={row.id || row.code || row.name}>
                      <td>
                        <div className="prorector-faculty-identity">
                          <span>{getInitials(row.name) || "FA"}</span>
                          <div>
                            <strong className="prorector-faculty-name">{row.name}</strong>
                            <small>{row.departmentNames?.slice(0, 2).join(", ") || "Njesi akademike"}</small>
                          </div>
                        </div>
                      </td>
                      <td><span className="prorector-table-muted">{row.code || "-"}</span></td>
                      <td>{formatMetric(row.activeUserCount)}</td>
                      <td>{formatMetric(row.departmentCount)}</td>
                      <td>{formatMetric(row.publicationCount)}</td>
                      <td>{formatMetric(row.q1Count)}</td>
                      <td>{formatMetric(row.q2Count)}</td>
                      <td>{formatMetric(row.q3Count)}</td>
                      <td>{formatMetric(row.q4Count)}</td>
                      <td>{formatMetric(row.citationCount)}</td>
                      <td>{formatMetric(row.reimbursementCount)}</td>
                      <td>
                        <span className={`prorector-activity-badge ${row.activity.className}`}>
                          {row.activity.label}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge status-aprovuar">
                          {row.statusLabel || "Aktiv"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!facultyStatsLoading && facultyDashboardRows.length > 0 && facultyPerformanceRows.length === 0 ? (
            <div className="prorector-faculty-empty">Nuk ka fakultete qe perputhen me kerkimin ose filtrat aktuale.</div>
          ) : null}

          {!facultyStatsLoading && facultyDashboardRows.length === 0 ? (
            <div className="prorector-faculty-empty">Nuk u gjet asnjë fakultet aktiv për këtë kërkim.</div>
          ) : null}
        </div>
      );
    }

    if (activePage === "PublikimeLegacy") {
      return (
        <div className="prorector-table-section">
          <h2>Publikime</h2>
          <p>Përmbledhje e të gjitha publikimeve akademike.</p>
          <table className="prorector-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>TITULL</th>
                <th>NJESIA</th>
                <th>STATUSI</th>
              </tr>
            </thead>
            <tbody>
              {filteredPublications.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.title}</td>
                  <td>{row.unit}</td>
                  <td>
                    <span className={`status-badge status-${row.status.toLowerCase().replace(" ", "-")}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activePage === "Konferenca") {
      return (
        <div className="prorector-table-section">
          <h2>Konferenca</h2>
          <p>Përmbledhje e konferencave akademike.</p>
          <table className="prorector-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>EVENT</th>
                <th>NJESIA</th>
                <th>STATUSI</th>
              </tr>
            </thead>
            <tbody>
              {filteredConferences.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.event}</td>
                  <td>{row.unit}</td>
                  <td>
                    <span className={`status-badge status-${row.status.toLowerCase().replace(" ", "-")}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activePage === "Rimbursime") {
      return (
        <ReimbursementReviewPanel
          role="prorector"
          scope="final"
          searchQuery={searchQuery}
          title="Rimbursime per aprovim final"
          description="Kerkesat reale qe jane aprovuar nga komisioni dhe presin vendimin final te prorektorit."
        />
      );
    }

    if (activePage === "Aprovime") {
      return (
        <ReimbursementReviewPanel
          role="prorector"
          scope="final"
          searchQuery={searchQuery}
          title="Aprovime finale"
          description="Vendimi final, refuzimi final ose shenimi i pageses per kerkesat qe kaluan komisionin."
        />
      );
    }

    if (activePage === "Raporte") {
      return (
        <div className="prorector-table-section">
          <h2>Raporte</h2>
          <p>Raporte të ndryshme të aktiviteteve kërkimore.</p>
          <div className="prorector-reports-grid">
            <div className="prorector-report-card">
              <h3>Raporti i Artikujve</h3>
              <p>Raport mujor i artikujve akademike</p>
              <button className="prorector-btn-primary\">Shko</button>
            </div>
            <div className="prorector-report-card">
              <h3>Raporti i Projekteve</h3>
              <p>Raport mujor i projekteve kërkimore</p>
              <button className="prorector-btn-primary\">Shko</button>
            </div>
            <div className="prorector-report-card">
              <h3>Raporti Financiar</h3>
              <p>Raport i shpenzimeve dhe buxhetit</p>
              <button className="prorector-btn-primary\">Shko</button>
            </div>
            <div className="prorector-report-card">
              <h3>Raporti i Performancës</h3>
              <p>Raport i performancës akademike</p>
              <button className="prorector-btn-primary\">Shko</button>
            </div>
          </div>
        </div>
      );
    }

    if (activePage === "Settings") {
      return (
        <div className="prorector-table-section">
          <h2>Settings</h2>
          <p>Konfigurimet kryesore për profilin dhe panelin.</p>
          
          <div className="prorector-settings-grid">
            {/* Card: Informacionet e Profilit */}
            <article className="prorector-settings-card">
              <div className="prorector-settings-card-header">
                <CircleUserRound size={20} className="prorector-settings-icon" />
                <h3>Informacionet e Profilit</h3>
              </div>
              <div className="prorector-settings-list">
                <div className="prorector-settings-item">
                  <span className="prorector-settings-label">Emri i plotë</span>
                  <strong className="prorector-settings-value">{prProfile.name}</strong>
                </div>
                <div className="prorector-settings-item">
                  <span className="prorector-settings-label">Roli Zyrtar</span>
                  <strong className="prorector-settings-value">{prProfile.role}</strong>
                </div>
                <div className="prorector-settings-item">
                  <span className="prorector-settings-label">Adresa Email</span>
                  <strong className="prorector-settings-value">{prProfile.email}</strong>
                </div>
                <div className="prorector-settings-item">
                  <span className="prorector-settings-label">Njësia Akademike</span>
                  <strong className="prorector-settings-value">{prProfile.unit}</strong>
                </div>
                <button className="prorector-settings-edit-btn" onClick={handleEditProfile}>
                  Ndrysho të dhënat
                </button>
              </div>
            </article>

            {/* Card: Preferencat e Sistemit */}
            <article className="prorector-settings-card">
              <div className="prorector-settings-card-header">
                <Settings size={20} className="prorector-settings-icon" />
                <h3>Preferencat e Sistemit</h3>
              </div>
              <div className="prorector-settings-options">
                <div className="prorector-settings-option-item">
                  <div className="prorector-settings-option-info">
                    <span className="prorector-settings-label">Njoftime me email</span>
                    <p className="prorector-settings-subtext">Merr njoftime për çdo aprovim të ri</p>
                  </div>
                  <label className="prorector-switch">
                    <input
                      type="checkbox"
                      checked={systemPreferences.emailNotifications}
                      onChange={(event) => updateEmailNotificationsPreference(event.target.checked)}
                    />
                    <span className="prorector-slider"></span>
                  </label>
                </div>
                {systemPreferencesMessage ? (
                  <p className="prorector-settings-subtext" role="status" aria-live="polite">
                    {systemPreferencesMessage}
                  </p>
                ) : null}

                <div className="prorector-settings-option-item">
                  <div className="prorector-settings-option-info">
                    <span className="prorector-settings-label">Gjuha e Ndërfaqes</span>
                  </div>
                  <select className="prorector-settings-select" defaultValue="Shqip">
                    <option>Shqip</option>
                    <option>English</option>
                  </select>
                </div>

                <div className="prorector-settings-option-item">
                  <div className="prorector-settings-option-info">
                    <span className="prorector-settings-label">Frekuenca e Raporteve</span>
                  </div>
                  <select className="prorector-settings-select" defaultValue="Mujore">
                    <option>Mujore</option>
                    <option>Javore</option>
                    <option>Ditore</option>
                  </select>
                </div>
              </div>
            </article>

            {/* Card: Siguria & Llogaria */}
            <article className="prorector-settings-card">
              <div className="prorector-settings-card-header">
                <ShieldX size={20} className="prorector-settings-icon" />
                <h3>Siguria & Llogaria</h3>
              </div>
              <div className="prorector-settings-list">
                <p className="prorector-settings-subtext">Menaxho sigurinë e llogarisë tuaj dhe qasjen ne sistem.</p>
                <button className="prorector-settings-action-btn" onClick={() => navigate("/auth/reset-password")}>
                  Rivendosja e qasjes
                </button>
                <button className="prorector-settings-action-btn danger">
                  Çaktivizo llogarinë
                </button>
              </div>
            </article>

            {/* Card: Lidhjet e Jashtme */}
            <article className="prorector-settings-card">
              <div className="prorector-settings-card-header">
                <Link2 size={20} className="prorector-settings-icon" />
                <h3>Lidhjet e Jashtme</h3>
              </div>
              <div className="prorector-settings-list">
                <p className="prorector-settings-subtext">Shiko dhe menaxho integrimet me platformat kërkimore.</p>
                <button className="prorector-settings-action-btn" onClick={() => setActivePage("Integrime")}>
                  Menaxho Integrimet
                </button>
              </div>
            </article>
          </div>
        </div>
      );
    }

    if (activePage === "Integrime") {
      return renderIntegrations();
    }

    return (
      <div className="prorector-table-section">
        <h2>Statistika e Fakulteteve</h2>
        <p>Përmbledhje e statistikave akademike sipas fakulteteve.</p>
        <table className="prorector-table">
          <thead>
            <tr>
              <th>FAKULTETI</th>
              <th>STATUSI</th>
              <th>STAF AKTIV</th>
              <th>DEPARTAMENTE</th>
              <th>ARTIKUJ</th>
              <th>RIMBURSIME</th>
            </tr>
          </thead>
          <tbody>
            {filteredFacultyStats.map((row) => (
              <tr key={row.id || row.code || row.name}>
                <td>
                  <strong>{row.code || "-"}</strong>
                  <span className="prorector-table-muted">{row.name}</span>
                </td>
                <td>{row.statusLabel || "Aktiv"}</td>
                <td>{row.activeUserCount}</td>
                <td>{row.departmentCount}</td>
                <td>{row.publicationCount}</td>
                <td>{row.reimbursementCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="prorector-layout">
      <ProRectorSidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="prorector-main">
        <ProRectorTopBar
          activePage={activePage}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          profile={prProfile}
          notifications={notifications}
          onEditProfile={handleEditProfile}
          onProfileAction={(action) => {
            if (action === "Integrime") {
              setActivePage("Integrime");
              return;
            }

            if (action === "Settings") {
              setActivePage("Settings");
              return;
            }

            if (action === "Logout") {
              fetch(apiUrl("/auth/logout"), {
                method: "POST",
                credentials: "include",
              }).finally(() => navigate("/"));
            }
          }}
          onNotificationRead={markNotificationAsRead}
          onMarkAllRead={markAllNotificationsAsRead}
        />
        <div className="prorector-content">
          {renderContent()}
        </div>
      </div>

      {isEditProfileOpen ? (
        <div className="prorector-modal-overlay" role="dialog" aria-modal="true">
          <div className="prorector-modal">
            <div className="prorector-modal-header">
              <div>
                <h3 className="prorector-modal-title">Edit Profile</h3>
                <p className="prorector-modal-subtitle">Përditësoni të dhënat e profilit të Pro Rektor</p>
              </div>
              <button
                className="prorector-modal-close"
                type="button"
                onClick={handleCancelProfile}
                aria-label="Mbyll"
              >
                ×
              </button>
            </div>
            <form className="prorector-modal-form" onSubmit={(event) => {
              event.preventDefault();
              handleSaveProfile();
            }}>
              <div className="prorector-form-grid">
                <label className="prorector-form-field">
                  <span>Emri</span>
                  <input value={prDraft.name} onChange={(event) => setPrDraft((prev) => ({ ...prev, name: event.target.value }))} />
                </label>
                <label className="prorector-form-field">
                  <span>Roli</span>
                  <input value={prDraft.role} onChange={(event) => setPrDraft((prev) => ({ ...prev, role: event.target.value }))} />
                </label>
                <label className="prorector-form-field">
                  <span>Email</span>
                  <input type="email" value={prDraft.email} onChange={(event) => setPrDraft((prev) => ({ ...prev, email: event.target.value }))} />
                </label>
                <label className="prorector-form-field">
                  <span>Njësia</span>
                  <input value={prDraft.unit} onChange={(event) => setPrDraft((prev) => ({ ...prev, unit: event.target.value }))} />
                </label>
              </div>
              <div className="prorector-modal-actions">
                <button type="button" className="prorector-btn-secondary" onClick={handleCancelProfile}>
                  Anulo
                </button>
                <button type="submit" className="prorector-btn-primary">
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
