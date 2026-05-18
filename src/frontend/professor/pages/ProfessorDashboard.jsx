import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Link2,
  Pencil,
  RefreshCw,
  Save,
  Settings,
  ShieldX,
  Trash2,
  Wallet,
  X,
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
import PublicationForm, {
  createEmptyPublicationDraft,
  publicationToDraft,
} from "../components/PublicationForm";
import { apiUrl } from "../../utils/api";
import { sendPasswordResetEmail } from "../../utils/supabaseAuth";
import { useLanguage } from "../../i18n/LanguageContext";

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
  received: "Pranuar",
  in_review: "Ne shqyrtim",
  needs_correction: "Kthyer per korrigjim",
  committee_approved: "Aprovuar nga komisioni",
  approved: "Aprovuar final",
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
  doi: row.doi || "",
  title: row.title || "Pa titull",
  abstract: row.abstract || "",
  publicationType: row.publicationType || row.publication_type || "",
  journal: row.venue || row.publisher || "Pa reviste/konference",
  venue: row.venue || "",
  publisher: row.publisher || "",
  publicationDate: row.publicationDate || row.publication_date || "",
  year: row.publicationYear || row.publication_year || "",
  publicationYear: row.publicationYear || row.publication_year || "",
  status: row.status || "draft",
  sourceUrl: row.sourceUrl || row.source_url || "",
  volume: row.volume || "",
  issue: row.issue || "",
  pages: row.pages || "",
  issn: row.issn || "",
  isbn: row.isbn || "",
  authors: Array.isArray(row.authors) ? row.authors : [],
  indexing: Array.isArray(row.indexing) ? row.indexing : [],
  attachments: Array.isArray(row.attachments) ? row.attachments : [],
  metadataSource: row.metadataSource || row.metadata_source || "manual",
  metadataVerified: Boolean(row.metadataVerified ?? row.metadata_verified),
  externalMetadataId: row.externalMetadataId || row.external_metadata_id || "",
  createdAt: row.createdAt || row.created_at || null,
});

const mapNotificationRow = (row = {}) => ({
  id: row.id,
  userId: row.user_id || row.userId || null,
  title: row.title || "",
  message: row.message || "",
  category: row.category || "",
  isRead: Boolean(row.is_read ?? row.isRead),
  createdAt: formatDate(row.created_at || row.createdAt),
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

const STATISTIC_METRIC_KEYS = ["publikime", "citime", "konferenca", "rimbursime"];

const DEFAULT_PROFESSOR_SYSTEM_PREFERENCES = {
  emailNotifications: true,
};

const PASSWORD_RESET_TOAST_DURATION_MS = 2500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hasStatisticMetricData = (rows = []) =>
  rows.some((row) =>
    STATISTIC_METRIC_KEYS.some((key) => Number(row[key] || 0) > 0)
  );

export default function ProfessorDashboard() {
  const navigate = useNavigate();
  const { language, setLanguage, t, tx } = useLanguage();

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
  const [publicationsPage, setPublicationsPage] = useState(1);
  const [publicationsPagination, setPublicationsPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [editingPublicationId, setEditingPublicationId] = useState("");
  const [isManualPublicationOpen, setIsManualPublicationOpen] = useState(false);
  const [publicationDraft, setPublicationDraft] = useState(createEmptyPublicationDraft);
  const [manualPublicationDraft, setManualPublicationDraft] = useState(createEmptyPublicationDraft);
  const [publicationActionId, setPublicationActionId] = useState("");
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState(professorProfile);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [passwordResetEmail, setPasswordResetEmail] = useState("");
  const [isPasswordResetSending, setIsPasswordResetSending] = useState(false);
  const [passwordResetToast, setPasswordResetToast] = useState("");
  const [passwordResetError, setPasswordResetError] = useState("");
  const [hasAuthenticatedSession, setHasAuthenticatedSession] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [systemPreferences, setSystemPreferences] = useState(DEFAULT_PROFESSOR_SYSTEM_PREFERENCES);
  const [systemPreferencesMessage, setSystemPreferencesMessage] = useState("");

  const settingsText = t("professor.settings");

  const translatedProfileMenuItems = useMemo(
    () =>
      profileMenuItems.map((item) => {
        const translatedLabels = {
          EditProfile: t("topbar.menuEditProfile"),
          OrcidConnect: t("topbar.menuOrcidConnect"),
          Njoftime: t("topbar.menuNotifications"),
          Settings: t("topbar.menuSettings"),
          Integrime: t("topbar.menuIntegrations"),
          Logout: t("topbar.menuLogout"),
        };

        return {
          ...item,
          label: translatedLabels[item.id] || item.label,
        };
      }),
    [t]
  );

  const updateSystemPreference = useCallback((field, value) => {
    const next = { ...systemPreferences, [field]: value };

    setSystemPreferences(next);

    if (field === "language") {
      setLanguage(value);
    }

    setSystemPreferencesMessage(t("professor.settings.preferencesSaved"));
  }, [setLanguage, systemPreferences, t]);

  useEffect(() => {
    if (!systemPreferencesMessage) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setSystemPreferencesMessage(""), 2500);

    return () => window.clearTimeout(timeout);
  }, [systemPreferencesMessage]);

  useEffect(() => {
    if (!passwordResetToast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setPasswordResetToast(""), PASSWORD_RESET_TOAST_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [passwordResetToast]);

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
          setHasAuthenticatedSession(true);
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
    if (!hasAuthenticatedSession) {
      return undefined;
    }

    let isMounted = true;

    const loadNotifications = async () => {
      setIsNotificationsLoading(true);
      setNotificationsError("");

      try {
        const response = await fetch(apiUrl("/notifications"), {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("notifications_load_failed");
        }

        const data = await response.json();

        if (isMounted) {
          setNotifications(Array.isArray(data) ? data.map(mapNotificationRow) : []);
        }
      } catch (error) {
        console.error("Notifications load failed:", error);

        if (isMounted) {
          setNotifications([]);
          setNotificationsError("Notifications could not be loaded. Please try again.");
        }
      } finally {
        if (isMounted) {
          setIsNotificationsLoading(false);
        }
      }
    };

    loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [hasAuthenticatedSession]);

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
              ? "professor.dashboard.statsUnauthorized"
              : "professor.dashboard.statsLoadError"
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
    setPublicationsPage(1);
  }, [searchQuery]);

  const loadPublications = useCallback(async ({ page = publicationsPage, query = searchQuery } = {}) => {
    setIsPublicationsLoading(true);
    setPublicationsError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
      });
      const trimmedQuery = query.trim();

      if (trimmedQuery) {
        params.set("q", trimmedQuery);
      }

      const response = await fetch(apiUrl(`/publications?${params.toString()}`), {
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        throw new Error("publications_unauthorized");
      }

      if (!response.ok) {
        throw new Error(data.message || "publications_load_failed");
      }

      const rows = Array.isArray(data) ? data : data.data;

      setPublications(Array.isArray(rows) ? rows.map(mapPublicationRow) : []);
      setPublicationsPagination({
        page: data.pagination?.page || page,
        limit: data.pagination?.limit || 25,
        total: data.pagination?.total || (Array.isArray(rows) ? rows.length : 0),
        totalPages: data.pagination?.totalPages || 1,
      });
    } catch (error) {
      console.error("Publications load failed:", error);

      setPublications([]);
      setPublicationsError(
        error.message === "publications_unauthorized"
          ? "professor.dashboard.publicationsUnauthorized"
          : error.message || "professor.dashboard.publicationsLoadError"
      );
    } finally {
      setIsPublicationsLoading(false);
    }
  }, [publicationsPage, searchQuery]);

  useEffect(() => {
    loadPublications({ page: publicationsPage, query: searchQuery });
  }, [loadPublications, publicationsPage, searchQuery]);

  const pageTitleMap = {
    Statistika: t("navigation.statistics"),
    Publikime: t("navigation.publications"),
    Konferenca: t("navigation.conferences"),
    Rimbursime: t("navigation.reimbursements"),
    Njoftime: t("navigation.notifications"),
    Settings: t("navigation.settings"),
    Integrime: t("navigation.integrations"),
  };
  const pageTitle = pageTitleMap[activePage] || activePage;
  const getStatusLabel = useCallback((status) => tx(STATUS_LABELS[status] || status), [tx]);
  const getRequestTypeLabel = useCallback((type) => tx(REQUEST_TYPE_LABELS[type] || type), [tx]);
  const formatUiMessage = useCallback(
    (message) => (String(message || "").includes(".") ? t(message) : tx(message)),
    [t, tx]
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const unreadNotifications = notifications.filter((item) => !item.isRead).length;

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
  }, [getStatusLabel, normalizedQuery, statisticsData.publicationsByStatus]);

  const filteredReimbursementStatuses = useMemo(() => {
    if (!normalizedQuery) {
      return statisticsData.reimbursementsByStatus;
    }

    return statisticsData.reimbursementsByStatus.filter((row) =>
      `${getStatusLabel(row.status)} ${row.count}`.toLowerCase().includes(normalizedQuery)
    );
  }, [getStatusLabel, normalizedQuery, statisticsData.reimbursementsByStatus]);

  const filteredReimbursementTypes = useMemo(() => {
    if (!normalizedQuery) {
      return statisticsData.reimbursementsByType;
    }

    return statisticsData.reimbursementsByType.filter((row) =>
      `${getRequestTypeLabel(row.type)} ${row.count}`.toLowerCase().includes(normalizedQuery)
    );
  }, [getRequestTypeLabel, normalizedQuery, statisticsData.reimbursementsByType]);

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
      setProfileError("profile_save_failed");
    } finally {
      setIsProfileSaving(false);
    }
  };

  const openPasswordResetModal = () => {
    setPasswordResetEmail(profile.email || "");
    setPasswordResetError("");
    setIsPasswordResetOpen(true);
  };

  const getPasswordResetErrorMessage = (error) => {
    const rawMessage = String(error?.message || "");
    const message = rawMessage.toLowerCase();
    const code = String(error?.code || "").toLowerCase();
    const status = Number(error?.status || 0);

    if (rawMessage === "supabase_not_configured") {
      return settingsText.supabaseNotConfigured;
    }

    if (rawMessage === "invalid_redirect_url" || message.includes("redirect") || message.includes("url")) {
      return settingsText.invalidRedirectUrl;
    }

    if (status === 429 || code.includes("rate") || message.includes("rate") || message.includes("too many")) {
      return settingsText.resetRateLimited;
    }

    if (message.includes("invalid email") || message.includes("email address") || message.includes("valid email")) {
      return settingsText.emailInvalid;
    }

    if (status === 404 || code.includes("not_found") || message.includes("not found") || message.includes("user not found")) {
      return settingsText.authUserNotFound;
    }

    if (message.includes("smtp") || message.includes("provider") || message.includes("email") || message.includes("send")) {
      return settingsText.resetProviderError;
    }

    return rawMessage || settingsText.resetLinkError;
  };

  const handlePasswordResetSubmit = async (event) => {
    event.preventDefault();
    setPasswordResetError("");

    const trimmedEmail = passwordResetEmail.trim();

    if (!trimmedEmail) {
      setPasswordResetError(settingsText.emailRequired);
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setPasswordResetError(settingsText.emailInvalid);
      return;
    }

    if (profile.email && trimmedEmail.toLowerCase() !== profile.email.toLowerCase()) {
      setPasswordResetError(settingsText.emailMustMatchAccount);
      return;
    }

    setIsPasswordResetSending(true);

    try {
      await sendPasswordResetEmail(trimmedEmail);
      setPasswordResetToast(settingsText.resetLinkSent);
      setPasswordResetEmail("");
      setIsPasswordResetOpen(false);
    } catch (error) {
      setPasswordResetError(getPasswordResetErrorMessage(error));
    } finally {
      setIsPasswordResetSending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(apiUrl("/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      localStorage.removeItem("authToken");
      sessionStorage.removeItem("authToken");
      navigate("/", { replace: true });
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (unreadNotifications === 0 || notifications.length === 0) {
      return;
    }

    setNotificationsError("");

    try {
      const response = await fetch(apiUrl("/notifications/read-all"), {
        method: "PATCH",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("notifications_read_all_failed");
      }

      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      console.error("Mark all notifications as read failed:", error);
      setNotificationsError("Notifications could not be marked as read. Please try again.");
    }
  };

  const markNotificationAsRead = async (id) => {
    const notification = notifications.find((item) => item.id === id);

    if (!notification || notification.isRead) {
      return;
    }

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
      console.error("Mark notification as read failed:", error);
      setNotificationsError("Notification could not be marked as read. Please try again.");
    }
  };

  const startPublicationEdit = (publication) => {
    setEditingPublicationId(publication.id);
    setPublicationDraft(publicationToDraft(publication));
    setPublicationsError("");
  };

  const cancelPublicationEdit = () => {
    setEditingPublicationId("");
    setPublicationDraft(createEmptyPublicationDraft());
  };

  const resetManualPublicationDraft = () => {
    setManualPublicationDraft(createEmptyPublicationDraft());
  };

  const saveManualPublication = async () => {
    setPublicationActionId("manual");
    setPublicationsError("");

    try {
      const response = await fetch(apiUrl("/publications"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(manualPublicationDraft),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Publikimi nuk u ruajt.");
      }

      resetManualPublicationDraft();
      setIsManualPublicationOpen(false);
      setPublicationsPage(1);
      await loadPublications({ page: 1, query: searchQuery });
    } catch (error) {
      setPublicationsError(error.message || "Publikimi nuk u ruajt.");
    } finally {
      setPublicationActionId("");
    }
  };

  const savePublicationEdit = async (id) => {
    setPublicationActionId(id);
    setPublicationsError("");

    try {
      const response = await fetch(apiUrl(`/publications/${id}`), {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(publicationDraft),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Publikimi nuk u ruajt.");
      }

      cancelPublicationEdit();
      await loadPublications({ page: publicationsPage, query: searchQuery });
    } catch (error) {
      setPublicationsError(error.message || "Publikimi nuk u ruajt.");
    } finally {
      setPublicationActionId("");
    }
  };

  const deletePublication = async (id) => {
    const confirmed = window.confirm("A jeni te sigurt qe doni ta fshini kete publikim?");

    if (!confirmed) {
      return;
    }

    setPublicationActionId(id);
    setPublicationsError("");

    try {
      const response = await fetch(apiUrl(`/publications/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Publikimi nuk u fshi.");
      }

      if (editingPublicationId === id) {
        cancelPublicationEdit();
      }

      await loadPublications({ page: publicationsPage, query: searchQuery });
    } catch (error) {
      setPublicationsError(error.message || "Publikimi nuk u fshi.");
    } finally {
      setPublicationActionId("");
    }
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
        label: t("professor.dashboard.activePublications"),
        value: summary.publicationsTotal,
        change: t("professor.dashboard.approvedInReview", {
          approved: summary.publicationsApproved,
          review: summary.publicationsInReview,
        }),
        icon: <BookOpen size={22} />,
      },
      {
        label: t("professor.dashboard.plannedConferences"),
        value: summary.conferencesTotal,
        change: t("professor.dashboard.upcomingCount", { count: summary.upcomingConferences }),
        icon: <CalendarDays size={22} />,
      },
      {
        label: t("professor.dashboard.reimbursementsInProcess"),
        value: summary.reimbursementsInReview,
        change: t("professor.dashboard.approvedTotal", {
          approved: summary.reimbursementsApproved,
          total: summary.reimbursementsTotal,
        }),
        icon: <Wallet size={22} />,
      },
      {
        label: "ORCID",
        value: profile.orcidId ? 1 : 0,
        change: profile.orcidId ? t("professor.dashboard.orcidConnected") : t("common.notConnected"),
        icon: <Link2 size={22} />,
      },
    ];

    const quickActions = [
      { title: t("professor.dashboard.registerPublication"), icon: <BookOpen size={20} />, page: "Publikime" },
      { title: t("professor.dashboard.submitReimbursement"), icon: <Wallet size={20} />, page: "Rimbursime" },
      { title: t("professor.dashboard.planConference"), icon: <CalendarDays size={20} />, page: "Konferenca" },
      { title: t("professor.dashboard.updateProfileAction"), icon: <Settings size={20} />, page: "Settings" },
    ];

    const latestPublications = publications.slice(0, 3).map((item) => ({
      id: item.id,
      icon: <BookOpen size={20} />,
      title: item.title,
      description: [tx(item.journal), item.year].filter(Boolean).join(" | ") || t("professor.dashboard.publicationFromSupabase"),
      time: formatDate(item.createdAt),
    }));

    return (
      <>
        <section className="prof-hero">
          <div>
            <span className="prof-badge">{t("professor.dashboard.heroBadge")}</span>
            <h2>{t("professor.dashboard.greeting", { name: profile.name })}</h2>
            <p>{t("professor.dashboard.heroDescription")}</p>
          </div>
          <div className="prof-hero-actions">
            <button className="primary-btn" type="button" onClick={() => setActivePage("Publikime")}>
              {t("professor.dashboard.managePublications")}
            </button>
            <button className="secondary-btn" type="button" onClick={() => setActivePage("Statistika")}>
              {t("professor.dashboard.viewStats")}
            </button>
          </div>
        </section>

        <section>
          <h3 className="prof-section-title">{t("professor.dashboard.quickView")}</h3>
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
                <h3>{t("professor.dashboard.recentActivity")}</h3>
                <p>{t("professor.dashboard.recentActivityDescription")}</p>
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
                  {isPublicationsLoading ? t("common.loading") : t("professor.dashboard.noData")}
                </div>
              )}
            </div>
          </article>

          <article className="prof-card">
            <div className="prof-card-header">
              <div>
                <h3>{t("professor.dashboard.quickActions")}</h3>
                <p>{t("professor.dashboard.quickActionsDescription")}</p>
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

  const renderListSection = (title, description, rows, rowKey, formatter, emptyText = t("professor.dashboard.noData")) => (
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
              <div>{formatter.actions ? formatter.actions(row) : renderStatus(formatter.status(row))}</div>
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
      ? t("professor.dashboard.noSearchResults")
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
        label: t("professor.dashboard.totalPublicationsCard"),
        value: summary.publicationsTotal,
        change: t("professor.dashboard.approvedInReview", {
          approved: summary.publicationsApproved,
          review: summary.publicationsInReview,
        }),
        icon: <BookOpen size={22} />,
      },
      {
        label: t("professor.dashboard.citationsFromMetadata"),
        value: summary.citationsTotal,
        change: t("professor.dashboard.citationsDescription"),
        icon: <CheckCircle2 size={22} />,
      },
      {
        label: t("professor.dashboard.conferences"),
        value: summary.conferencesTotal,
        change: t("professor.dashboard.upcomingCount", { count: summary.upcomingConferences }),
        icon: <CalendarDays size={22} />,
      },
      {
        label: t("professor.dashboard.reimbursements"),
        value: summary.reimbursementsTotal,
        change: t("professor.dashboard.requestedAmountChange", {
          amount: formatRequestedAmounts(summary.requestedAmounts),
        }),
        icon: <Wallet size={22} />,
      },
    ];

    return (
      <div className="prof-statistics-layout">
        {statisticsError ? (
          <div className="prof-stats-message error" role="alert">
            {formatUiMessage(statisticsError)}
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
              <h3>{t("professor.dashboard.academicStatistics")}</h3>
              <p>{t("professor.dashboard.academicStatisticsDescription")}</p>
            </div>
            <div className="prof-filter-wrap">
              <label htmlFor="prof-period-filter">{t("professor.dashboard.period")}</label>
              <select
                id="prof-period-filter"
                className="prof-filter-select"
                value={periodRange}
                onChange={(event) => setPeriodRange(event.target.value)}
              >
                <option value="1m">{t("professor.dashboard.periodOneMonth")}</option>
                <option value="2m">{t("professor.dashboard.periodTwoMonths")}</option>
                <option value="6m">{t("professor.dashboard.periodSixMonths")}</option>
                <option value="12m">{t("professor.dashboard.periodTwelveMonths")}</option>
              </select>
            </div>
          </div>

          {isStatisticsLoading ? (
            <div className="prof-stats-empty">
              <RefreshCw size={18} className="prof-stats-spin" />
              {statisticsData.generatedAt ? t("professor.dashboard.updatingStatistics") : t("professor.dashboard.loadingStatistics")}
            </div>
          ) : statisticsError ? (
            <div className="prof-stats-empty">
              {t("professor.dashboard.statisticsUnavailable")}
            </div>
          ) : normalizedQuery && hasStatisticsChartData && !hasFilteredStatisticsChartData ? (
            <div className="prof-stats-empty">
              {t("professor.dashboard.noSearchResults")}
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
                  <Bar dataKey="publikime" name={t("professor.dashboard.publications")} radius={[8, 8, 0, 0]} fill="#153a63" />
                  <Bar dataKey="citime" name={t("professor.dashboard.citations")} radius={[8, 8, 0, 0]} fill="#2e6aa6" />
                  <Bar dataKey="konferenca" name={t("professor.dashboard.conferences")} radius={[8, 8, 0, 0]} fill="#7aa7d3" />
                  <Bar dataKey="rimbursime" name={t("professor.dashboard.reimbursements")} radius={[8, 8, 0, 0]} fill="#c9a24f" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="prof-stats-empty">
              {t("professor.dashboard.noStatsData")}
            </div>
          )}
        </article>

        <section className="prof-status-grid">
          {renderStatisticsBreakdown(
            t("professor.dashboard.publicationsByStatus"),
            t("professor.dashboard.publicationsByStatusDescription"),
            filteredPublicationStatuses,
            (row) => getStatusLabel(row.status),
            t("professor.dashboard.noSavedPublications"),
            statisticsData.publicationsByStatus.length > 0
          )}

          {renderStatisticsBreakdown(
            t("professor.dashboard.reimbursementsByStatus"),
            t("professor.dashboard.reimbursementsByStatusDescription"),
            filteredReimbursementStatuses,
            (row) => getStatusLabel(row.status),
            t("professor.dashboard.noSavedReimbursements"),
            statisticsData.reimbursementsByStatus.length > 0
          )}

          {renderStatisticsBreakdown(
            t("professor.dashboard.reimbursementsByType"),
            t("professor.dashboard.reimbursementsByTypeDescription"),
            filteredReimbursementTypes,
            (row) => getRequestTypeLabel(row.type),
            t("professor.dashboard.noReimbursementTypes"),
            statisticsData.reimbursementsByType.length > 0
          )}
        </section>
      </div>
    );
  };

  const renderPublicationTitle = (row) => {
    return row.title;
  };

  const renderPublicationActions = (row) => {
    if (editingPublicationId === row.id) {
      return (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="prof-btn-primary"
            onClick={() => savePublicationEdit(row.id)}
            disabled={publicationActionId === row.id}
            aria-label={t("common.save")}
          >
            <Save size={15} />
          </button>
          <button
            type="button"
            className="prof-btn-secondary"
            onClick={cancelPublicationEdit}
            disabled={publicationActionId === row.id}
            aria-label={t("professor.dashboard.cancelEdit")}
          >
            <X size={15} />
          </button>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {renderStatus(row.status)}
        <button
          type="button"
          className="prof-btn-secondary"
          onClick={() => startPublicationEdit(row)}
          aria-label={t("common.edit")}
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          className="prof-btn-secondary"
          onClick={() => deletePublication(row.id)}
          disabled={publicationActionId === row.id}
          aria-label={t("common.delete")}
        >
          <Trash2 size={15} />
        </button>
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
                    Shkruani DOI e publikimit dhe sistemi do te marre automatikisht
                    metadata si titulli, autoret, journal/conference, viti dhe te dhena te tjera.
                  </p>
                </div>
              </div>

              <DoiLookup onPublicationSaved={() => loadPublications({ page: 1, query: searchQuery })} />
            </article>

            {editingPublicationId ? (
              <article className="prof-card" style={{ marginBottom: "20px" }}>
                <div className="prof-card-header">
                  <div>
                    <h3>Edit publication</h3>
                    <p>All publication records use the same metadata fields, whether DOI-assisted or manual.</p>
                  </div>
                </div>
                <PublicationForm
                  value={publicationDraft}
                  onChange={setPublicationDraft}
                  onSubmit={() => savePublicationEdit(editingPublicationId)}
                  onCancel={cancelPublicationEdit}
                  submitLabel="Save changes"
                  submitting={publicationActionId === editingPublicationId}
                  mode="edit"
                />
              </article>
            ) : null}

            {renderListSection(
              t("navigation.publications"),
              t("professor.dashboard.publicationRegistryDescription"),
              filteredPublications,
              "id",
              {
                icon: <BookOpen size={20} />,
                title: renderPublicationTitle,
                description: (row) => `${tx(row.journal)} • ${row.year}`,
                status: (row) => row.status,
                actions: renderPublicationActions,
              },
              publicationsError
                ? formatUiMessage(publicationsError)
                : (isPublicationsLoading ? t("common.loading") : t("professor.dashboard.noData"))
            )}
            {publicationsPagination.totalPages > 1 ? (
              <div className="prof-modal-actions" style={{ marginTop: "12px" }}>
                <button
                  type="button"
                  className="prof-btn-secondary"
                  onClick={() => setPublicationsPage((page) => Math.max(page - 1, 1))}
                  disabled={publicationsPagination.page <= 1 || isPublicationsLoading}
                >
                  {t("common.back")}
                </button>
                <span style={{ alignSelf: "center", color: "#64748b", fontWeight: 700 }}>
                  {t("professor.dashboard.pageOf", {
                    page: publicationsPagination.page,
                    total: publicationsPagination.totalPages,
                  })}
                </span>
                <button
                  type="button"
                  className="prof-btn-secondary"
                  onClick={() => setPublicationsPage((page) => Math.min(page + 1, publicationsPagination.totalPages))}
                  disabled={publicationsPagination.page >= publicationsPagination.totalPages || isPublicationsLoading}
                >
                  {t("common.next")}
                </button>
              </div>
            ) : null}
          </>
        );

      case "Konferenca":
        return (
          <>
            <article className="prof-card" style={{ marginBottom: "20px" }}>
              <div className="prof-card-header">
                <div>
                  <h3>{t("professor.dashboard.addConferenceTitle")}</h3>
                  <p>{t("professor.dashboard.addConferenceDescription")}</p>
                </div>
              </div>

              <ConferenceManager searchQuery={searchQuery} />
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
                <h3>{t("professor.dashboard.integrationsTitle")}</h3>
                <p>{t("professor.dashboard.integrationsDescription")}</p>
              </div>
              <button type="button" className="prof-integration-manage-btn" onClick={() => setActivePage("Settings")}>
                {t("professor.dashboard.manage")}
              </button>
            </div>
            <div className="prof-integration-list">
              <article className="prof-integration-item">
                <div className={`prof-integration-mark ${profile.orcidId ? "connected" : "not-connected"}`}>
                  {profile.orcidId ? <CheckCircle2 size={22} /> : <ShieldX size={22} />}
                </div>
                <div className="prof-integration-copy">
                  <h4>ORCID</h4>
                  <p>{profile.orcidId || t("professor.dashboard.noIntegrationData")}</p>
                </div>
                <span className={`status-badge ${profile.orcidId ? "connected" : "not-connected"}`}>
                  {profile.orcidId ? t("common.connected") : t("common.notConnected")}
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
                <h3>{t("topbar.notificationsTitle")}</h3>
                <p>{t("professor.dashboard.notificationsDescription")}</p>
              </div>
              <button
                type="button"
                className="prof-integration-manage-btn"
                onClick={markAllNotificationsAsRead}
                disabled={unreadNotifications === 0 || notifications.length === 0}
              >
                {t("topbar.markAllReadPage")}
              </button>
            </div>
            <div className="prof-notification-list">
              {notificationsError ? (
                <div className="prof-stats-empty" role="alert">{formatUiMessage(notificationsError)}</div>
              ) : isNotificationsLoading ? (
                <div className="prof-stats-empty">
                  <RefreshCw size={18} className="prof-stats-spin" />
                  {t("professor.dashboard.loadingNotifications")}
                </div>
              ) : notifications.length ? (
                notifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`prof-notification-item ${item.isRead ? "neutral" : "info"}`}
                    onClick={() => markNotificationAsRead(item.id)}
                  >
                    <div className="prof-notification-item-head">
                      <span className="prof-notification-pill">{item.category || t("topbar.notificationsAriaLabel")}</span>
                      <span>{item.createdAt}</span>
                    </div>
                    <h4>{item.title}</h4>
                    <p>{item.message}</p>
                  </button>
                ))
              ) : (
                <div className="prof-stats-empty">{t("topbar.emptyNotifications")}</div>
              )}
            </div>
          </article>
        );

      case "Settings":
        return (
          <div className="prorector-table-section">
            <h2>{settingsText.pageTitle}</h2>
            <p>{settingsText.pageDescription}</p>

            <div className="prorector-settings-grid">
              {/* Card: Profile information */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <Settings size={20} />
                  </div>
                  <h3>{settingsText.profileTitle}</h3>
                </div>
                <div className="prorector-settings-list">
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">{settingsText.fullName}</span>
                    <strong className="prorector-settings-value">{profile.name}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">{settingsText.academicTitle}</span>
                    <strong className="prorector-settings-value">{profile.role}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">{settingsText.emailAddress}</span>
                    <strong className="prorector-settings-value">{profile.email}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">{settingsText.orcidId}</span>
                    <strong className="prorector-settings-value">{profile.orcidId || settingsText.notConnected}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">{settingsText.orcidSchool}</span>
                    <strong className="prorector-settings-value">{profile.school || settingsText.noPublicData}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">{settingsText.orcidAffiliation}</span>
                    <strong className="prorector-settings-value">{profile.currentAffiliation || settingsText.noPublicData}</strong>
                  </div>
                  <button className="prorector-settings-edit-btn" onClick={() => handleMenuAction("EditProfile")}>
                    {settingsText.updateProfile}
                  </button>
                </div>
              </article>

              {/* Card: System preferences */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <BookOpen size={20} />
                  </div>
                  <h3>{settingsText.systemTitle}</h3>
                </div>
                <div className="prorector-settings-options">
                  <div className="prorector-settings-option-item">
                    <div className="prorector-settings-option-info">
                      <span className="prorector-settings-label">{settingsText.emailLabel}</span>
                      <p className="prorector-settings-subtext">{settingsText.emailSubtext}</p>
                      <p className="prorector-settings-subtext">
                        {systemPreferences.emailNotifications
                          ? settingsText.enabledStatus
                          : settingsText.disabledStatus}
                      </p>
                    </div>
                    <label className="prorector-switch">
                      <input
                        type="checkbox"
                        checked={systemPreferences.emailNotifications}
                        aria-label={settingsText.emailLabel}
                        onChange={(event) => updateSystemPreference("emailNotifications", event.target.checked)}
                      />
                      <span className="prorector-slider"></span>
                    </label>
                  </div>

                  <div className="prorector-settings-option-item">
                    <div className="prorector-settings-option-info">
                      <span className="prorector-settings-label">{settingsText.languageLabel}</span>
                      <p className="prorector-settings-subtext">{settingsText.languageSubtext}</p>
                    </div>
                    <select
                      className="prorector-settings-select"
                      value={language}
                      aria-label={settingsText.languageLabel}
                      onChange={(event) => updateSystemPreference("language", event.target.value)}
                    >
                      <option value="sq">{settingsText.albanian}</option>
                      <option value="en">{settingsText.english}</option>
                    </select>
                  </div>
                  {systemPreferencesMessage ? (
                    <p className="prorector-settings-subtext" role="status" aria-live="polite">
                      {systemPreferencesMessage}
                    </p>
                  ) : null}
                </div>
              </article>

              {/* Card: Security */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <ShieldX size={20} />
                  </div>
                  <h3>{settingsText.securityTitle}</h3>
                </div>
                <div className="prorector-settings-list">
                  <p className="prorector-settings-subtext">{settingsText.securityDescription}</p>
                  <button
                    type="button"
                    className="prorector-settings-action-btn"
                    onClick={openPasswordResetModal}
                  >
                    {settingsText.changePassword}
                  </button>
                </div>
              </article>

              {/* Card: API and integrations */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <Link2 size={20} />
                  </div>
                  <h3>{settingsText.integrationsTitle}</h3>
                </div>
                <div className="prorector-settings-list">
                  <p className="prorector-settings-subtext">{settingsText.integrationsDescription}</p>
                  <button
                    type="button"
                    className="prorector-settings-action-btn"
                    onClick={() => {
                      window.location.href = apiUrl("/orcid/connect");
                    }}
                  >
                    {profile.orcidId ? settingsText.refreshOrcid : settingsText.connectOrcid}
                  </button>
                  <button className="prorector-settings-action-btn" onClick={() => setActivePage("Integrime")}>
                    {settingsText.viewIntegrations}
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
          menuItems={translatedProfileMenuItems}
          notificationCount={unreadNotifications}
          onMenuAction={handleMenuAction}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          notifications={notifications}
          onMarkAllRead={markAllNotificationsAsRead}
          onNotificationAction={markNotificationAsRead}
          searchPlaceholder={t("topbar.searchPlaceholder")}
          notificationsAriaLabel={t("topbar.notificationsAriaLabel")}
          notificationsTitle={t("topbar.notificationsTitle")}
          unreadLabel={t("topbar.unreadLabel")}
          markAllReadLabel={t("topbar.markAllRead")}
          emptyNotificationsLabel={t("topbar.emptyNotifications")}
          profileDialogLabel={t("topbar.profileDialog")}
        />

        <div className="prof-content">{renderContent()}</div>
      </div>

      {passwordResetToast ? (
        <div className="prof-toast success" role="status" aria-live="polite">
          {passwordResetToast}
        </div>
      ) : null}

      {isEditProfileOpen ? (
        <div className="prof-modal-overlay" role="dialog" aria-modal="true">
          <div className="prof-modal">
            <div className="prof-modal-header">
              <div>
                <h3 className="prof-modal-title">{settingsText.editProfileTitle}</h3>
                <p className="prof-modal-subtitle">{settingsText.editProfileSubtitle}</p>
              </div>
              <button
                className="prof-modal-close"
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                aria-label={settingsText.closeModal}
              >
                ×
              </button>
            </div>
            <form className="prof-modal-form" onSubmit={handleProfileSave}>
              <p className="prof-modal-note">
                {settingsText.profileNote}
              </p>
              <div className="prof-form-grid">
                <label className="prof-form-field">
                  <span>{settingsText.nameAndSurname}</span>
                  <input value={profileDraft.name} readOnly />
                </label>
                <label className="prof-form-field">
                  <span>{settingsText.role}</span>
                  <input value={profileDraft.role} readOnly />
                </label>
                <label className="prof-form-field">
                  <span>{settingsText.email}</span>
                  <input type="email" value={profileDraft.email} readOnly />
                </label>
                <label className="prof-form-field">
                  <span>{settingsText.orcidId}</span>
                  <input value={profileDraft.orcidId || settingsText.notConnected} readOnly />
                </label>
                <label className="prof-form-field">
                  <span>{settingsText.orcidSchool}</span>
                  <input value={profileDraft.school || settingsText.noPublicData} readOnly />
                </label>
                <label className="prof-form-field">
                  <span>{settingsText.orcidAffiliation}</span>
                  <input value={profileDraft.currentAffiliation || settingsText.noPublicData} readOnly />
                </label>
                <label className="prof-form-field">
                  <span>{settingsText.faculty}</span>
                  <input value={profileDraft.faculty} onChange={handleProfileFieldChange("faculty")} />
                </label>
                <label className="prof-form-field">
                  <span>{settingsText.department}</span>
                  <input value={profileDraft.department} onChange={handleProfileFieldChange("department")} />
                </label>
                <label className="prof-form-field">
                  <span>{settingsText.office}</span>
                  <input value={profileDraft.office} onChange={handleProfileFieldChange("office")} />
                </label>
              </div>
              {profileDraft.orcidEducations.length || profileDraft.orcidEmployments.length || profileDraft.orcidProfile?.biography || profileDraft.orcidProfile?.keywords?.length || profileDraft.orcidProfile?.researcherUrls?.length ? (
                <div className="prof-orcid-details">
                  {profileDraft.orcidProfile?.biography || profileDraft.orcidProfile?.keywords?.length || profileDraft.orcidProfile?.researcherUrls?.length ? (
                    <div>
                      <h4>{settingsText.orcidDetails}</h4>
                      {profileDraft.orcidProfile?.biography ? <p>{profileDraft.orcidProfile.biography}</p> : null}
                      {profileDraft.orcidProfile?.keywords?.length ? (
                        <p>{settingsText.keywords}: {profileDraft.orcidProfile.keywords.slice(0, 8).join(", ")}</p>
                      ) : null}
                      {profileDraft.orcidProfile?.researcherUrls?.slice(0, 3).map((item) => (
                        <p key={`url-${item.url || item.name}`}>{[item.name, item.url].filter(Boolean).join(" | ")}</p>
                      ))}
                    </div>
                  ) : null}
                  {profileDraft.orcidEducations.length ? (
                    <div>
                      <h4>{settingsText.orcidEducation}</h4>
                      {profileDraft.orcidEducations.slice(0, 3).map((item) => (
                        <p key={`education-${item.putCode || formatAffiliation(item)}`}>{formatAffiliation(item)}</p>
                      ))}
                    </div>
                  ) : null}
                  {profileDraft.orcidEmployments.length ? (
                    <div>
                      <h4>{settingsText.orcidEmployment}</h4>
                      {profileDraft.orcidEmployments.slice(0, 3).map((item) => (
                        <p key={`employment-${item.putCode || formatAffiliation(item)}`}>{formatAffiliation(item)}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {profileError ? <p className="prof-modal-error" role="alert">{settingsText.profileSaveError}</p> : null}
              {!profileDraft.orcidId ? (
                <button type="button" className="prof-orcid-link-btn" onClick={() => handleMenuAction("OrcidConnect")}>
                  {settingsText.linkOrcidForAutofill}
                </button>
              ) : null}
              <div className="prof-modal-actions">
                <button type="button" className="prof-btn-secondary" onClick={() => setIsEditProfileOpen(false)} disabled={isProfileSaving}>
                  {settingsText.cancel}
                </button>
                <button type="submit" className="prof-btn-primary" disabled={isProfileSaving}>
                  {isProfileSaving ? settingsText.saving : settingsText.saveChanges}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isPasswordResetOpen ? (
        <div className="prof-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="password-reset-title">
          <div className="prof-modal prof-password-reset-modal">
            <div className="prof-modal-header">
              <div>
                <h3 className="prof-modal-title" id="password-reset-title">{settingsText.changePassword}</h3>
                <p className="prof-modal-subtitle">{settingsText.changePasswordSubtitle}</p>
              </div>
              <button
                className="prof-modal-close"
                type="button"
                onClick={() => setIsPasswordResetOpen(false)}
                aria-label={settingsText.closeModal}
                disabled={isPasswordResetSending}
              >
                ×
              </button>
            </div>

            <form className="prof-modal-form" onSubmit={handlePasswordResetSubmit}>
              <label className="prof-form-field">
                <span>{settingsText.enterEmail}</span>
                <input
                  type="email"
                  value={passwordResetEmail}
                  autoComplete="email"
                  onChange={(event) => setPasswordResetEmail(event.target.value)}
                  disabled={isPasswordResetSending}
                  required
                />
              </label>

              {passwordResetError ? <p className="prof-modal-error" role="alert">{passwordResetError}</p> : null}
              <div className="prof-modal-actions">
                <button
                  type="button"
                  className="prof-btn-secondary"
                  onClick={() => setIsPasswordResetOpen(false)}
                  disabled={isPasswordResetSending}
                >
                  {settingsText.cancel}
                </button>
                <button
                  type="submit"
                  className="prof-btn-primary"
                  disabled={isPasswordResetSending || !passwordResetEmail.trim()}
                >
                  {isPasswordResetSending ? settingsText.sendingResetLink : settingsText.sendResetLink}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
