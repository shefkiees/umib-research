import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, BarChart3, Bell, CheckCircle2, CircleUserRound, Clock3, Eye, FileText, GitCompareArrows, LogOut, Settings } from "lucide-react";
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

const METADATA_REVIEW_STORAGE_KEY = "committeeMetadataReviewWorkflow";

const metadataReviewStatuses = {
  unchecked: {
    label: "Pa kontrolluar",
    description: "Publikimi nuk është hapur ende për kontroll metadata.",
    className: "is-neutral",
    Icon: Clock3,
  },
  in_review: {
    label: "Në kontroll",
    description: "Komisioni ka nisur kontrollin e metadata-s.",
    className: "is-info",
    Icon: Eye,
  },
  ok: {
    label: "Metadata OK",
    description: "Metadata është kontrolluar dhe është në rregull.",
    className: "is-ok",
    Icon: CheckCircle2,
  },
  correction: {
    label: "Kërkon korrigjim",
    description: "Publikimi kërkon korrigjim nga profesori.",
    className: "is-warning",
    Icon: AlertTriangle,
  },
};

const metadataReviewFilterOptions = [
  { value: "all", label: "Të gjitha" },
  { value: "issues", label: "Me mungesa" },
  { value: "missing-doi", label: "Pa DOI" },
  { value: "missing-uibm", label: "Pa UIBM affiliation" },
  { value: "in_review", label: "Në kontroll" },
  { value: "ready", label: "Gati për aprovim" },
  { value: "correction", label: "Kërkon korrigjim" },
];

const metadataChecklistItems = [
  { key: "doiOk", label: "DOI OK" },
  { key: "titleMatches", label: "Titulli përputhet me dokumentin" },
  { key: "venueOk", label: "Journal / Konferenca OK" },
  { key: "authorsOk", label: "Autorët OK" },
  { key: "uibmOk", label: "UIBM affiliation OK" },
  { key: "documentsOk", label: "Dokumentet OK" },
];

const correctionExamples = [
  "Mungon UIBM affiliation",
  "DOI nuk përputhet me titullin",
  "Journal nuk është i saktë",
  "Dokumenti i ngarkuar nuk është i plotë",
];

function normalizeCommitteeProfile(user = {}) {
  const displayName = user.name || user.displayName || user.full_name || user.fullName || user.email || "Komision";

  return {
    name: displayName,
    role: "Komision",
    systemRole: String(user.role || "").trim().toLowerCase(),
    email: user.email || "",
    unit: user.department || user.faculty || "Komision",
  };
}

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
  if (publication.metadataVerified || publication.metadata_verified) return "Nga DOI";
  if (publication.doi) return "DOI pa verifikim";
  return "Manual";
}

function getPublicationTypeLabel(value) {
  return publicationTypeLabels[value] || value || "-";
}

function getPublicationStatusLabel(value) {
  return publicationStatusLabels[value] || value || "-";
}

function getPublicationDocumentUrl(publication) {
  const evidence = Array.isArray(publication?.evidenceLinks) && publication.evidenceLinks.length
    ? publication.evidenceLinks
    : publication?.attachments || [];
  const firstDocument = evidence.find((item) => item?.url || item?.fileUrl || item?.file_url);

  return firstDocument?.url || firstDocument?.fileUrl || firstDocument?.file_url || publication?.sourceUrl || publication?.source_url || "";
}

function createDefaultChecklist(publication) {
  const authors = getPublicationAuthors(publication);

  return {
    doiOk: Boolean(publication?.doi),
    titleMatches: false,
    venueOk: Boolean(publication?.venue || publication?.publisher),
    authorsOk: authors.length > 0,
    uibmOk: hasUibmAffiliation(publication),
    documentsOk: Boolean(getPublicationDocumentUrl(publication)),
  };
}

function createInitialReview(publication) {
  return {
    status: "unchecked",
    checklist: createDefaultChecklist(publication),
    comment: "",
    history: [],
  };
}

function mapMetadataReviewFromPublication(publication) {
  const checklist = publication?.metadataReviewChecklist || publication?.metadata_review_checklist || createDefaultChecklist(publication);
  const history = publication?.reviewHistory || publication?.review_history || [];

  return {
    status: publication?.metadataReviewStatus || publication?.metadata_review_status || "unchecked",
    checklist: { ...createDefaultChecklist(publication), ...checklist },
    comment: publication?.metadataReviewComment || publication?.metadata_review_comment || "",
    history: history.map((entry) => ({
      id: entry.id || `${entry.created_at || entry.createdAt}-${entry.status}`,
      actor: entry.actor_name || entry.actorName || "UMIBRes",
      status: entry.status || "unchecked",
      statusLabel: getReviewStatusConfig(entry.status).label,
      comment: entry.comment || "",
      checklist: entry.checklist || {},
      createdAt: entry.created_at || entry.createdAt,
    })),
  };
}

function getReviewCompleteness(review, publication) {
  const checklist = review?.checklist || createDefaultChecklist(publication);
  const checkedCount = metadataChecklistItems.filter((item) => checklist[item.key]).length;

  return {
    checkedCount,
    total: metadataChecklistItems.length,
    isComplete: checkedCount === metadataChecklistItems.length,
  };
}

function getReviewStatusConfig(status) {
  return metadataReviewStatuses[status] || metadataReviewStatuses.unchecked;
}

function formatReviewDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("sq-AL", {
    dateStyle: "short",
    timeStyle: "short",
  });
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
  const [selectedMetadataPublication, setSelectedMetadataPublication] = useState(null);
  const [metadataReviewFilter, setMetadataReviewFilter] = useState("all");
  const [metadataReviews, setMetadataReviews] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(METADATA_REVIEW_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  });
  const [correctionComment, setCorrectionComment] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [metadataDrawerMode, setMetadataDrawerMode] = useState("details");
  const [committeeProfile, setCommitteeProfile] = useState({
    name: "Komision",
    role: "Komision",
    systemRole: "",
    email: "",
    unit: "Komision",
  });
  const [committeeDraft, setCommitteeDraft] = useState({
    name: "Komision",
    role: "Komision",
    systemRole: "",
    email: "",
    unit: "Komision",
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

  useEffect(() => {
    let isMounted = true;

    const loadCommitteeProfile = async () => {
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
        const nextProfile = normalizeCommitteeProfile(data.user || {});

        if (isMounted) {
          setCommitteeProfile(nextProfile);
          setCommitteeDraft(nextProfile);
        }
      } catch (error) {
        console.error("Committee profile load failed:", error);
      }
    };

    loadCommitteeProfile();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

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
    window.localStorage.setItem(METADATA_REVIEW_STORAGE_KEY, JSON.stringify(metadataReviews));
  }, [metadataReviews]);

  useEffect(() => {
    let isMounted = true;

    const loadMetadataPublications = async () => {
      setIsMetadataLoading(true);
      setMetadataError("");

      try {
        const response = await fetch(apiUrl("/publications?scope=review&limit=50"), {
          credentials: "include",
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || "Metadata e publikimeve nuk u ngarkua.");
        }

        if (isMounted) {
          const rows = Array.isArray(data.data) ? data.data : [];
          setMetadataPublications(rows);
          setMetadataReviews((prev) => rows.reduce((reviews, publication) => ({
            ...reviews,
            [publication.id]: mapMetadataReviewFromPublication(publication),
          }), prev));
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
    const filteredByReview = metadataPublications.filter((item) => {
      const review = metadataReviews[item.id] || createInitialReview(item);
      const completeness = getReviewCompleteness(review, item);

      if (metadataReviewFilter === "issues") return !item.doi || !hasUibmAffiliation(item) || !completeness.isComplete;
      if (metadataReviewFilter === "missing-doi") return !item.doi;
      if (metadataReviewFilter === "missing-uibm") return !hasUibmAffiliation(item);
      if (metadataReviewFilter === "in_review") return review.status === "in_review";
      if (metadataReviewFilter === "ready") return review.status === "ok" || completeness.isComplete;
      if (metadataReviewFilter === "correction") return review.status === "correction";
      return true;
    });

    if (!normalizedQuery) {
      return filteredByReview;
    }

    return filteredByReview.filter((item) => {
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
  }, [metadataPublications, metadataReviewFilter, metadataReviews, normalizedQuery]);

  const metadataSummary = useMemo(() => ({
    total: metadataPublications.length,
    verified: metadataPublications.filter((item) => metadataReviews[item.id]?.status === "ok").length,
    missingDoi: metadataPublications.filter((item) => !item.doi).length,
    missingUibm: metadataPublications.filter((item) => !hasUibmAffiliation(item)).length,
  }), [metadataPublications, metadataReviews]);

  const getReviewForPublication = (publication) =>
    metadataReviews[publication.id] || createInitialReview(publication);

  const syncPendingSubmissionStatus = (updatedRequest) => {
    if (!updatedRequest?.id) {
      return;
    }

    setPendingSubmissions((prev) => {
      if (updatedRequest.status !== "submitted") {
        return prev.filter((item) => item.id !== updatedRequest.id);
      }

      return prev.map((item) => (item.id === updatedRequest.id ? updatedRequest : item));
    });
  };

  const saveMetadataReview = (publication, updater) => {
    setMetadataReviews((prev) => {
      const current = prev[publication.id] || createInitialReview(publication);
      const nextReview = typeof updater === "function" ? updater(current) : updater;

      return {
        ...prev,
        [publication.id]: {
          ...current,
          ...nextReview,
        },
      };
    });
  };

  const addMetadataHistory = (publication, status, comment = "") => {
    const statusConfig = getReviewStatusConfig(status);
    const actor = committeeProfile.name || committeeProfile.email || "Komisioni";

    saveMetadataReview(publication, (current) => ({
      status,
      comment: comment || current.comment || "",
      history: [
        {
          id: `${Date.now()}-${status}`,
          actor,
          status,
          statusLabel: statusConfig.label,
          comment,
          createdAt: new Date().toISOString(),
        },
        ...(current.history || []),
      ],
    }));
  };

  const toggleChecklistItem = (publication, key) => {
    saveMetadataReview(publication, (current) => ({
      checklist: {
        ...current.checklist,
        [key]: !current.checklist?.[key],
      },
      status: current.status === "unchecked" ? "in_review" : current.status,
    }));
    setCorrectionError("");
  };

  const openMetadataDrawer = (publication, mode = "details") => {
    setSelectedMetadataPublication(publication);
    setMetadataDrawerMode(mode);
    setCorrectionComment(getReviewForPublication(publication).comment || "");
    setCorrectionError("");

    if (getReviewForPublication(publication).status === "unchecked") {
      addMetadataHistory(publication, "in_review", "Kontrolli i metadata-s u hap nga Komisioni.");
    }
  };

  const syncMetadataReviewResponse = (publication, data) => {
    const updatedPublication = data?.data || publication;
    const nextReview = mapMetadataReviewFromPublication(updatedPublication);

    setMetadataPublications((prev) =>
      prev.map((item) => (item.id === updatedPublication.id ? updatedPublication : item))
    );
    setSelectedMetadataPublication((current) =>
      current?.id === updatedPublication.id ? updatedPublication : current
    );
    setMetadataReviews((prev) => ({
      ...prev,
      [updatedPublication.id]: nextReview,
    }));
    setCorrectionComment(nextReview.comment || "");
  };

  const sendMetadataReview = async (publication, payload) => {
    const response = await fetch(apiUrl(`/publications/${publication.id}/metadata-review`), {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Kontrolli i metadata-s nuk u ruajt.");
    }

    syncMetadataReviewResponse(publication, data);
    return data;
  };

  const markMetadataOk = async (publication) => {
    const checklist = metadataChecklistItems.reduce((items, item) => ({
      ...items,
      [item.key]: true,
    }), {});

    try {
      setCorrectionError("");
      await sendMetadataReview(publication, {
        status: "ok",
        comment: "Metadata u verifikua si e plote.",
        checklist,
      });
    } catch (error) {
      setCorrectionError(error.message || "Metadata nuk u ruajt.");
    }
  };

  const requestMetadataCorrection = async (publication) => {
    const comment = correctionComment.trim();

    if (!comment) {
      setCorrectionError("Komenti eshte i detyrueshem per korrigjim.");
      return;
    }

    try {
      const review = getReviewForPublication(publication);
      await sendMetadataReview(publication, {
        status: "correction",
        comment,
        checklist: review.checklist || createDefaultChecklist(publication),
      });
      setCorrectionError("");
    } catch (error) {
      setCorrectionError(error.message || "Korrigjimi nuk u dergua te profesori.");
    }
  };

  const openPublicationDocument = (publication) => {
    const documentUrl = getPublicationDocumentUrl(publication);

    if (documentUrl) {
      window.open(documentUrl, "_blank", "noopener,noreferrer");
    }
  };

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
          <p>Review queue per kontrollin akademik te DOI, autoreve, affiliation dhe dokumenteve.</p>
        </div>
        <label className="committee-metadata-filter">
          <span>Filtro queue</span>
          <select value={metadataReviewFilter} onChange={(event) => setMetadataReviewFilter(event.target.value)}>
            {metadataReviewFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="committee-metadata-summary">
        <article>
          <span>Publikime</span>
          <strong>{metadataSummary.total}</strong>
        </article>
        <article>
          <span>Metadata OK</span>
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

      {metadataError ? <p className="committee-empty" role="alert">{metadataError}</p> : null}

      {isMetadataLoading ? (
        <div className="committee-metadata-skeleton" aria-label="Duke ngarkuar metadata">
          <span />
          <span />
          <span />
        </div>
      ) : (
        <div className="committee-table-wrap committee-metadata-table-wrap">
          <table className="committee-table committee-metadata-table">
            <thead>
              <tr>
                <th>Publikimi</th>
                <th>DOI</th>
                <th>Burimi</th>
                <th>Autoret / Affiliation</th>
                <th>Metadata</th>
                <th>Review</th>
                <th>Veprimet</th>
              </tr>
            </thead>
            <tbody>
              {filteredMetadataPublications.map((item) => {
                const authors = getPublicationAuthors(item);
                const firstAuthor = authors[0];
                const hasUibm = hasUibmAffiliation(item);
                const review = getReviewForPublication(item);
                const reviewStatus = getReviewStatusConfig(review.status);
                const ReviewIcon = reviewStatus.Icon;
                const completeness = getReviewCompleteness(review, item);
                const documentUrl = getPublicationDocumentUrl(item);

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
                      <span className="committee-metadata-muted">{getPublicationStatusLabel(item.status)}</span>
                    </td>
                    <td>
                      <span className={`committee-review-badge ${reviewStatus.className}`} title={reviewStatus.description}>
                        <ReviewIcon size={14} />
                        {reviewStatus.label}
                      </span>
                      <span className="committee-metadata-muted">{completeness.checkedCount}/{completeness.total} checklist</span>
                    </td>
                    <td>
                      <div className="committee-metadata-actions">
                        <button type="button" className="committee-details-btn" onClick={() => openMetadataDrawer(item, "details")}>
                          <Eye size={14} />
                          Detaje
                        </button>
                        <button type="button" className="committee-details-btn" onClick={() => openMetadataDrawer(item, "compare")}>
                          <GitCompareArrows size={14} />
                          Krahaso
                        </button>
                        <button type="button" className="committee-details-btn" onClick={() => openPublicationDocument(item)} disabled={!documentUrl}>
                          <FileText size={14} />
                          Dokument
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isMetadataLoading && !metadataError && filteredMetadataPublications.length === 0 ? (
        <div className="committee-metadata-empty">
          <strong>Nuk ka publikime per filtrin aktual.</strong>
          <span>Ndrysho filtrin ose kerko me titull, DOI, autor apo status.</span>
        </div>
      ) : null}

      {selectedMetadataPublication ? (() => {
        const selectedReview = getReviewForPublication(selectedMetadataPublication);
        const selectedStatus = getReviewStatusConfig(selectedReview.status);
        const SelectedIcon = selectedStatus.Icon;
        const selectedCompleteness = getReviewCompleteness(selectedReview, selectedMetadataPublication);
        const selectedDocumentUrl = getPublicationDocumentUrl(selectedMetadataPublication);
        const selectedAuthors = getPublicationAuthors(selectedMetadataPublication);
        const failedChecklistItems = metadataChecklistItems.filter((checkItem) => !selectedReview.checklist?.[checkItem.key]);
        const visibleHistory = (selectedReview.history || [])
          .filter((entry, index, history) => {
            const previous = history[index - 1];
            return !previous || previous.status !== entry.status || previous.comment !== entry.comment;
          })
          .slice(0, 3);

        return (
          <div className="committee-metadata-drawer-backdrop" role="presentation" onClick={() => setSelectedMetadataPublication(null)}>
            <aside className="committee-metadata-drawer" role="dialog" aria-label="Detajet e metadatave" onClick={(event) => event.stopPropagation()}>
              <div className="committee-review-hero">
                <div className="committee-review-hero-main">
                  <span className={`committee-review-badge ${selectedStatus.className}`} title={selectedStatus.description}>
                    <SelectedIcon size={14} />
                    {selectedStatus.label}
                  </span>
                  <h4>{selectedMetadataPublication.title || "Pa titull"}</h4>
                  <p>{selectedMetadataPublication.doi || "Pa DOI"}</p>
                </div>
                <button type="button" onClick={() => setSelectedMetadataPublication(null)} aria-label="Mbyll detajet">x</button>
              </div>

              <div className="committee-review-quick-summary">
                <span>Statusi: <strong>{getPublicationStatusLabel(selectedMetadataPublication.status)}</strong></span>
                <span>Checklist: <strong>{selectedCompleteness.checkedCount}/{selectedCompleteness.total}</strong></span>
                <span>UIBM: <strong className={hasUibmAffiliation(selectedMetadataPublication) ? "is-ok" : "is-warning"}>
                  {hasUibmAffiliation(selectedMetadataPublication) ? "OK" : "Mungon"}
                </strong></span>
              </div>

              <section className="committee-review-panel">
                <div className="committee-review-panel-head">
                  <h5>Checklist e Verifikimit</h5>
                  <span className={selectedCompleteness.isComplete ? "is-complete" : ""}>
                    {selectedCompleteness.isComplete ? "Gati per aprovim" : "Ne kontroll"}
                  </span>
                </div>
                <div className="committee-checklist-grid">
                  {metadataChecklistItems.map((checkItem) => (
                    <label key={checkItem.key} className={`committee-check-item ${selectedReview.checklist?.[checkItem.key] ? "is-checked" : ""}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedReview.checklist?.[checkItem.key])}
                        onChange={() => toggleChecklistItem(selectedMetadataPublication, checkItem.key)}
                      />
                      <span className="committee-checkmark"><CheckCircle2 size={14} /></span>
                      <span>{checkItem.label}</span>
                    </label>
                  ))}
                </div>
                {failedChecklistItems.length ? (
                  <p className="committee-checklist-note">
                    Pika qe kerkojne vemendje: {failedChecklistItems.map((item) => item.label).join(", ")}
                  </p>
                ) : null}
              </section>

              <section className="committee-review-panel committee-correction-panel">
                <h5>Koment per korrigjim</h5>
                <textarea
                  value={correctionComment}
                  onChange={(event) => {
                    setCorrectionComment(event.target.value);
                    setCorrectionError("");
                  }}
                  placeholder="Shkruaj arsyen para se te kerkosh korrigjim..."
                />
                <div className="committee-correction-examples">
                  {correctionExamples.map((example) => (
                    <button
                      type="button"
                      key={example}
                      className={correctionComment === example ? "is-selected" : ""}
                      onClick={() => setCorrectionComment(example)}
                    >
                      {example}
                    </button>
                  ))}
                </div>
                {correctionError ? <p className="committee-review-error" role="alert">{correctionError}</p> : null}
              </section>

              <section className="committee-review-panel committee-metadata-compact-panel">
                <h5>Metadata</h5>
                <dl className="committee-metadata-detail-grid">
                  <div><dt>Tipi</dt><dd>{getPublicationTypeLabel(selectedMetadataPublication.publicationType || selectedMetadataPublication.publication_type)}</dd></div>
                  <div><dt>Journal / Konferenca</dt><dd>{selectedMetadataPublication.venue || "-"}</dd></div>
                  <div><dt>Vendi i konferences</dt><dd>{selectedMetadataPublication.conferenceLocation || selectedMetadataPublication.conference_location || "-"}</dd></div>
                  <div><dt>Publisher</dt><dd>{selectedMetadataPublication.publisher || "-"}</dd></div>
                  <div><dt>Viti</dt><dd>{selectedMetadataPublication.publicationYear || selectedMetadataPublication.publication_year || formatDate(selectedMetadataPublication.publicationDate || selectedMetadataPublication.publication_date)}</dd></div>
                  <div><dt>Burimi</dt><dd>{selectedMetadataPublication.metadataSource || selectedMetadataPublication.metadata_source || "manual"}</dd></div>
                  <div><dt>Metadata</dt><dd>{getMetadataStatus(selectedMetadataPublication)}</dd></div>
                  <div><dt>Autoret</dt><dd>{selectedAuthors.map((author, index) => getAuthorName(author) || `Autori ${index + 1}`).join(", ") || "-"}</dd></div>
                  <div><dt>UIBM affiliation</dt><dd>{hasUibmAffiliation(selectedMetadataPublication) ? "Po" : "Jo"}</dd></div>
                </dl>
              </section>

              {metadataDrawerMode === "compare" ? (
                <section className="committee-review-panel committee-document-panel">
                  <h5>Dokumenti i ngarkuar</h5>
                  {selectedDocumentUrl ? (
                    <iframe title="Dokumenti i publikimit" src={selectedDocumentUrl} />
                  ) : (
                    <div className="committee-document-empty">
                      <FileText size={20} />
                      <strong>Nuk ka dokument te lidhur.</strong>
                      <span>Kontrollo metadata-n e regjistruar dhe kerko dokument shtese nese duhet.</span>
                    </div>
                  )}
                </section>
              ) : null}

              <section className="committee-review-history">
                <div className="committee-history-head">
                  <h5>Historik kontrolli</h5>
                  {selectedReview.history?.length ? <span>{selectedReview.history.length} veprime</span> : null}
                </div>
                {visibleHistory.length ? (
                  visibleHistory.map((entry) => (
                    <article key={entry.id}>
                      <span className={`committee-review-dot ${getReviewStatusConfig(entry.status).className}`} />
                      <div>
                        <strong>{entry.statusLabel}</strong>
                        <p>{entry.comment || "Pa koment shtese."}</p>
                        <small>{entry.actor} - {formatReviewDate(entry.createdAt)}</small>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="committee-history-empty">Ende nuk ka veprime ne kete kontroll.</p>
                )}
              </section>

              <div className="committee-review-action-bar">
                <button type="button" className="is-primary" onClick={() => markMetadataOk(selectedMetadataPublication)}>
                  <CheckCircle2 size={16} />
                  Metadata OK
                </button>
                <button type="button" className="is-warning" onClick={() => requestMetadataCorrection(selectedMetadataPublication)}>
                  <AlertTriangle size={16} />
                  Kerko korrigjim
                </button>
                <button type="button" onClick={() => openPublicationDocument(selectedMetadataPublication)} disabled={!selectedDocumentUrl}>
                  <FileText size={16} />
                  Shiko dokumentin
                </button>
                <button type="button" onClick={() => setMetadataDrawerMode((mode) => (mode === "compare" ? "details" : "compare"))}>
                  <GitCompareArrows size={16} />
                  {metadataDrawerMode === "compare" ? "Fsheh dokumentin" : "Krahaso metadata"}
                </button>
              </div>
            </aside>
          </div>
        );
      })() : null}
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
        canApprove={committeeProfile.systemRole === "committee"}
        onStatusUpdated={syncPendingSubmissionStatus}
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
        onStatusUpdated={syncPendingSubmissionStatus}
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
        onStatusUpdated={syncPendingSubmissionStatus}
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
