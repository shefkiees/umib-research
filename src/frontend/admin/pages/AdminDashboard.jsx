import { useCallback, useEffect, useState, useMemo } from "react";

import { useNavigate } from "react-router-dom";

import { ArrowRight, RotateCcw, Trash2, X, User, Settings, Bell, Users } from "lucide-react";

import AdminSidebar from "../components/AdminSidebar";

import AdminTopbar from "../components/AdminTopbar";

import {
    AdminAnalyticsSection,
    AdminNotificationsSection,
    AdminSettingsSection,
} from "../components/AdminFeatureSections";
import { apiUrl } from "../../utils/api";
import { useLanguage } from "../../i18n/LanguageContext";
import { getAdminText } from "../adminI18n";

import "../styles/AdminDashboard.css";
import "../styles/AdminSection.css";

const ROLE_OPTIONS = [
    { value: "admin", label: "Admin" },
    { value: "committee", label: "Komision" },
    { value: "professor", label: "Profesor" },
    { value: "prorector", label: "Prorektor" },
];

const ROLE_LABELS = ROLE_OPTIONS.reduce((labels, item) => ({
    ...labels,
    [item.value]: item.label,
}), {});

const STATUS_LABELS = {
    active: "Aktiv",
    inactive: "Joaktiv",
    suspended: "Pezulluar",
};



const AUDIT_ACTION_VALUES = [
    "",
    "admin.auth.login",
    "admin.access.unauthenticated",
    "admin.access.forbidden",
    "admin.user.role_update",
    "admin.user.status_update",
];



const getStatusClass = (status) => {

    if (status === "active") return "admin-chip admin-chip--active";

    if (status === "inactive" || status === "suspended") return "admin-chip admin-chip--inactive";

    return "admin-chip admin-chip--neutral";

};



const getRoleClass = (role) => {

    if (role === "admin") return "admin-chip admin-chip--admin";

    if (role === "committee") return "admin-chip admin-chip--commission";

    if (role === "prorector") return "admin-chip admin-chip--prorector";

    return "admin-chip admin-chip--professor";

};

const formatAdminDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleDateString("sq-AL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
};

const formatAdminDateTime = (value) => {
    if (!value) return "Asnjëherë";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Asnjëherë";
    }

    return date.toLocaleString("sq-AL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
};

const formatAuditDateTime = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day}.${month}.${year}, ${hours}:${minutes}`;
};

const AUDIT_PAGE_SIZE = 25;

const getAuditStatusClass = (status) => {
    if (status === "success") return "admin-audit-status admin-audit-status--success";
    if (status === "failed") return "admin-audit-status admin-audit-status--failed";
    return "admin-audit-status";
};

const getAuditPersonLabel = (person) => {
    if (!person) return "-";
    return person.name || person.email || "-";
};

const getAuditTargetLabel = (item) => {
    if (!item) return "-";
    if (String(item.action || "").startsWith("admin.access.")) return "-";
    return item.target?.name || item.target?.email || item.entityId || "-";
};

const normalizeSearchValue = (value) =>
    String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();



export default function AdminDashboard() {

    const navigate = useNavigate();
    const { language } = useLanguage();
    const adminText = useMemo(() => getAdminText(language), [language]);

    const [activePage, setActivePage] = useState("Përdoruesit");

    const [searchQuery, setSearchQuery] = useState("");

    const [auditLogs, setAuditLogs] = useState([]);

    const [isAuditLoading, setIsAuditLoading] = useState(false);

    const [auditError, setAuditError] = useState("");

    const [auditRefreshKey, setAuditRefreshKey] = useState(0);

    const [auditFilters, setAuditFilters] = useState({
        adminEmail: "",
        targetEmail: "",
        action: "",
        status: "",
        startDate: "",
        endDate: "",
    });

    const [selectedAuditLog, setSelectedAuditLog] = useState(null);

    const [auditVisibleCount, setAuditVisibleCount] = useState(AUDIT_PAGE_SIZE);

    const [deletingAuditLogId, setDeletingAuditLogId] = useState("");

    const [users, setUsers] = useState([]);

    const [isUsersLoading, setIsUsersLoading] = useState(false);

    const [usersError, setUsersError] = useState("");

    const [updatingUserId, setUpdatingUserId] = useState("");

    const [selectedUser, setSelectedUser] = useState(null);

    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const [profileDraft, setProfileDraft] = useState({
        name: "",
        email: "",
        role: "",
        faculty: "",
        department: "",
        office: "",
        academicTitle: "",
        scientificTitle: "",
    });

    const [profileError, setProfileError] = useState("");

    const getAuditActionLabel = useCallback((action) => {
        const labels = adminText.audit?.actions || {};
        const actionLabels = {
            "": labels.all,
            "admin.auth.login": labels.login,
            "admin.access.unauthenticated": labels.unauthenticated,
            "admin.access.forbidden": labels.forbidden,
            "admin.user.role_update": labels.roleUpdate,
            "admin.user.status_update": labels.statusUpdate,
        };

        return actionLabels[action] || action || "-";
    }, [adminText.audit]);

    const getAuditStatusLabel = useCallback((status) => (
        adminText.audit?.statuses?.[status] || status || "-"
    ), [adminText.audit]);

    const [isProfileSaving, setIsProfileSaving] = useState(false);

    const [profileRefreshKey, setProfileRefreshKey] = useState(0);

    const [notifications, setNotifications] = useState([]);

    const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);

    const [notificationsError, setNotificationsError] = useState("");

    const loadAdminNotifications = useCallback(async () => {
        setIsNotificationsLoading(true);
        setNotificationsError("");

        try {
            const response = await fetch(apiUrl("/admin/notifications"), {
                credentials: "include",
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || "notifications_failed");
            }

            setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        } catch (error) {
            console.error("Admin notifications load failed:", error);
            setNotifications([]);
            setNotificationsError("Njoftimet nuk u ngarkuan.");
        } finally {
            setIsNotificationsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAdminNotifications();
    }, [loadAdminNotifications]);
    useEffect(() => {

        let isMounted = true;

        const loadUsers = async () => {

            setIsUsersLoading(true);

            setUsersError("");

            try {

                const response = await fetch(apiUrl("/admin/users"), {
                    credentials: "include",
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.message || "admin_users_failed");
                }

                if (isMounted) {
                    setUsers(Array.isArray(data.users) ? data.users : []);
                }

            } catch (error) {

                console.error("Admin users load failed:", error);

                if (isMounted) {
                    setUsers([]);
                    setUsersError("Përdoruesit nuk u ngarkuan.");
                }

            } finally {

                if (isMounted) {
                    setIsUsersLoading(false);
                }

            }

        };

        loadUsers();

        return () => {
            isMounted = false;
        };

    }, []);


    useEffect(() => {

        let isMounted = true;

        const loadAuditLogs = async () => {

            setIsAuditLoading(true);

            setAuditError("");

            try {

                const params = new URLSearchParams();

                Object.entries(auditFilters).forEach(([key, value]) => {
                    if (key === "status") return;
                    const trimmedValue = String(value || "").trim();
                    if (trimmedValue) {
                        params.set(key, trimmedValue);
                    }
                });

                const queryString = params.toString();
                const response = await fetch(apiUrl(`/admin/audit-logs${queryString ? `?${queryString}` : ""}`), {
                    credentials: "include",
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.message || "audit_logs_failed");
                }

                if (isMounted) {
                    setAuditLogs(Array.isArray(data.logs) ? data.logs : []);
                }

            } catch (error) {

                console.error("Admin audit logs load failed:", error);

                if (isMounted) {
                    setAuditLogs([]);
                    setAuditError(adminText.audit.loadError);
                }

            } finally {

                if (isMounted) {
                    setIsAuditLoading(false);
                }

            }

        };

        loadAuditLogs();

        return () => {
            isMounted = false;
        };

    }, [adminText.audit.loadError, auditFilters, auditRefreshKey]);

    const normalizedQuery = normalizeSearchValue(searchQuery.trim());

    useEffect(() => {
        setAuditVisibleCount(AUDIT_PAGE_SIZE);
    }, [auditFilters, normalizedQuery, auditLogs]);



    const filteredUsers = useMemo(() => {

        if (!normalizedQuery) return users;

        return users.filter((item) =>

            `${item.id} ${item.name} ${item.email} ${item.role} ${item.status} ${item.faculty} ${item.department}`.toLowerCase().includes(normalizedQuery)

        );

    }, [normalizedQuery, users]);

    const formatAuditValue = useCallback((value) => {
        const rawValue = String(value ?? "").trim();

        if (!rawValue || rawValue === "-") return "-";

        const normalizedValue = rawValue.toLowerCase();
        const roleLabel = adminText.users?.roles?.[normalizedValue] || ROLE_LABELS[normalizedValue];
        const statusLabel = adminText.users?.statuses?.[normalizedValue] || STATUS_LABELS[normalizedValue];

        return roleLabel || statusLabel || rawValue;
    }, [adminText]);

    const getAuditSearchText = useCallback((item) => {
        const detailsText = item.details && typeof item.details === "object"
            ? JSON.stringify(item.details)
            : item.details;

        return normalizeSearchValue([
            item.id,
            item.action,
            item.actionLabel,
            item.admin?.name,
            item.admin?.email,
            getAuditTargetLabel(item),
            item.target?.name,
            item.target?.email,
            item.entityId,
            item.oldValue,
            item.newValue,
            formatAuditValue(item.oldValue),
            formatAuditValue(item.newValue),
            item.status,
            getAuditStatusLabel(item.status),
            getAuditActionLabel(item.action),
            item.ipAddress,
            detailsText,
        ].filter(Boolean).join(" "));
    }, [formatAuditValue, getAuditActionLabel, getAuditStatusLabel]);

    const filteredAuditLogs = useMemo(() => {

        const statusFilter = auditFilters.status;
        const sourceLogs = statusFilter
            ? auditLogs.filter((item) => item.status === statusFilter)
            : auditLogs;

        if (!normalizedQuery) return sourceLogs;

        return sourceLogs.filter((item) => getAuditSearchText(item).includes(normalizedQuery));

    }, [auditFilters.status, auditLogs, getAuditSearchText, normalizedQuery]);

    const visibleAuditLogs = filteredAuditLogs.slice(0, auditVisibleCount);

    const hasMoreAuditLogs = filteredAuditLogs.length > visibleAuditLogs.length;



    const unreadNotifications = notifications.filter((item) => !item.isRead).length;



    const markNotificationAsRead = async (item) => {
        if (!item || item.isRead || item.source === "audit") return;

        const previousNotifications = notifications;
        setNotifications((prev) => prev.map((notification) =>
            notification.id === item.id ? { ...notification, isRead: true } : notification
        ));

        try {
            const response = await fetch(apiUrl(`/admin/notifications/${item.id}/read`), {
                method: "PATCH",
                credentials: "include",
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || "notification_update_failed");
            }

            await loadAdminNotifications();
        } catch (error) {
            console.error("Admin notification mark read failed:", error);
            setNotifications(previousNotifications);
            setNotificationsError("Njoftimi nuk u perditesua.");
        }
    };

    const markAllNotificationsAsRead = async () => {
        if (!notifications.some((item) => !item.isRead && item.source !== "audit")) return;

        const previousNotifications = notifications;
        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));

        try {
            const response = await fetch(apiUrl("/admin/notifications/read-all"), {
                method: "PATCH",
                credentials: "include",
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || "notifications_update_failed");
            }

            await loadAdminNotifications();
        } catch (error) {
            console.error("Admin notifications mark all read failed:", error);
            setNotifications(previousNotifications);
            setNotificationsError("Njoftimet nuk u perditesuan.");
        }
    };

    const updateAuditFilter = (field) => (event) => {
        setAuditFilters((prev) => ({
            ...prev,
            [field]: event.target.value,
        }));
    };

    const clearAuditFilters = () => {
        setAuditFilters({
            adminEmail: "",
            targetEmail: "",
            action: "",
            status: "",
            startDate: "",
            endDate: "",
        });
    };

    const deleteAuditLog = async (item) => {
        if (!item?.id) return;

        const confirmed = window.confirm("A je i sigurt qe deshiron ta fshish kete veprim nga historiku?");
        if (!confirmed) return;

        setDeletingAuditLogId(item.id);
        setAuditError("");

        try {
            const response = await fetch(apiUrl(`/admin/audit-logs/${item.id}`), {
                method: "DELETE",
                credentials: "include",
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || "audit_log_delete_failed");
            }

            setAuditLogs((prev) => prev.filter((log) => log.id !== item.id));
            setSelectedAuditLog((prev) => (prev?.id === item.id ? null : prev));
        } catch (error) {
            console.error("Audit log delete failed:", error);
            setAuditError(error.message || "Veprimi nuk u fshi.");
        } finally {
            setDeletingAuditLogId("");
        }
    };

    const profileMenuItems = [
        { id: "Njoftime", label: adminText.profileMenu.notifications, icon: Bell },
        { id: "Ndrysho profilin", label: adminText.profileMenu.editProfile, icon: User },
        { id: "Cilësimet", label: adminText.profileMenu.settings, icon: Settings },
        { id: "Logout", label: adminText.profileMenu.logout, icon: ArrowRight, tone: "danger" },
    ];



    const openProfileEditor = async () => {
        setProfileError("");
        setIsProfileModalOpen(true);

        try {
            const response = await fetch(apiUrl("/auth/me"), {
                credentials: "include",
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.user) {
                throw new Error("profile_load_failed");
            }

            setProfileDraft({
                name: data.user.name || "",
                email: data.user.email || "",
                role: ROLE_LABELS[data.user.role] || data.user.role || "",
                faculty: data.user.faculty || "",
                department: data.user.department || "",
                office: data.user.office || "",
                academicTitle: data.user.academicTitle || "",
                scientificTitle: data.user.scientificTitle || "",
            });
        } catch (error) {
            setProfileError("Profili nuk u ngarkua.");
        }
    };

    const handleProfileFieldChange = (field) => (event) => {
        setProfileDraft((prev) => ({
            ...prev,
            [field]: event.target.value,
        }));
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

            setProfileDraft((prev) => ({
                ...prev,
                name: data.user.name || prev.name,
                faculty: data.user.faculty || "",
                department: data.user.department || "",
                office: data.user.office || "",
                academicTitle: data.user.academicTitle || "",
                scientificTitle: data.user.scientificTitle || "",
            }));
            setIsProfileModalOpen(false);
            setProfileRefreshKey((prev) => prev + 1);
        } catch (error) {
            setProfileError("Profili nuk u ruajt.");
        } finally {
            setIsProfileSaving(false);
        }
    };

    const handleProfileAction = (actionId) => {
        if (actionId === "Njoftime") {

            setActivePage("Njoftimet");

            return;

        }

        if (actionId === "Ndrysho profilin") {

            openProfileEditor();

            return;

        }

        if (actionId === "Cilësimet") {

            setActivePage("Cilësimet");

            return;

        }

        if (actionId === "Logout") {

            localStorage.removeItem("authToken");

            sessionStorage.removeItem("authToken");

            navigate("/login", { replace: true });

            return;

        }

    };

    const replaceUser = (nextUser) => {

        setUsers((prev) => prev.map((item) => (item.id === nextUser.id ? nextUser : item)));

        setSelectedUser((prev) => (prev?.id === nextUser.id ? nextUser : prev));

    };


    const updateUserRole = async (userId, role) => {

        setUpdatingUserId(userId);

        setUsersError("");

        try {

            const response = await fetch(apiUrl(`/admin/users/${userId}/role`), {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ role }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || "Roli nuk u përditësua.");
            }

            replaceUser(data.user);
            setAuditRefreshKey((prev) => prev + 1);

        } catch (error) {

            console.error("Admin user role update failed:", error);
            setUsersError(error.message || "Roli nuk u përditësua.");

        } finally {

            setUpdatingUserId("");

        }

    };


    const updateUserStatus = async (userId, status) => {

        setUpdatingUserId(userId);

        setUsersError("");

        try {

            const response = await fetch(apiUrl(`/admin/users/${userId}/status`), {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || "Statusi nuk u përditësua.");
            }

            replaceUser(data.user);
            setAuditRefreshKey((prev) => prev + 1);

        } catch (error) {

            console.error("Admin user status update failed:", error);
            setUsersError(error.message || "Statusi nuk u përditësua.");

        } finally {

            setUpdatingUserId("");

        }

    };

    const renderAuditLogs = () => (

        <section className="admin-page-card admin-stats-only-card admin-audit-section">

            <div className="admin-page-head admin-page-head--roles">

                <div>

                    <h3>{adminText.audit.title}</h3>

                </div>

                <button type="button" className="admin-roles-config-button admin-filter-button" onClick={clearAuditFilters}>

                    <RotateCcw size={16} />

                    {adminText.audit.clearFilters}

                </button>

            </div>

            <div className="admin-audit-filters">
                <label>
                    <span>{adminText.audit.adminEmail}</span>
                    <input type="search" value={auditFilters.adminEmail} onChange={updateAuditFilter("adminEmail")} placeholder="admin@umib.net" />
                </label>
                <label>
                    <span>{adminText.audit.targetEmail}</span>
                    <input type="search" value={auditFilters.targetEmail} onChange={updateAuditFilter("targetEmail")} placeholder="perdoruesi@umib.net" />
                </label>
                <label>
                    <span>{adminText.audit.action}</span>
                    <select value={auditFilters.action} onChange={updateAuditFilter("action")}>
                        {AUDIT_ACTION_VALUES.map((value) => (
                            <option key={value || "all"} value={value}>{getAuditActionLabel(value)}</option>
                        ))}
                    </select>
                </label>
                <label>
                    <span>{adminText.audit.status}</span>
                    <select value={auditFilters.status} onChange={updateAuditFilter("status")}>
                        <option value="">{adminText.audit.all}</option>
                        <option value="success">{getAuditStatusLabel("success")}</option>
                        <option value="failed">{getAuditStatusLabel("failed")}</option>
                    </select>
                </label>
                <label>
                    <span>{adminText.audit.fromDate}</span>
                    <input type="date" value={auditFilters.startDate} onChange={updateAuditFilter("startDate")} />
                </label>
                <label>
                    <span>{adminText.audit.toDate}</span>
                    <input type="date" value={auditFilters.endDate} onChange={updateAuditFilter("endDate")} />
                </label>
            </div>

            {auditError ? <p className="admin-inline-error" role="alert">{auditError}</p> : null}

            {isAuditLoading ? (
                <p className="admin-empty">{adminText.audit.loading}</p>
            ) : (
                <div className="admin-table-wrap admin-audit-table-wrap">
                    <table className="admin-table admin-audit-table">
                        <thead>
                            <tr>
                                <th>{adminText.audit.columns.dateTime}</th>
                                <th>{adminText.audit.columns.admin}</th>
                                <th>{adminText.audit.columns.action}</th>
                                <th>{adminText.audit.columns.user}</th>
                                <th>{adminText.audit.columns.oldValue}</th>
                                <th>{adminText.audit.columns.newValue}</th>
                                <th>{adminText.audit.columns.status}</th>
                                <th>{adminText.audit.columns.ip}</th>
                                <th>{adminText.audit.columns.details}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleAuditLogs.map((item) => (
                                <tr key={item.id}>
                                    <td className="admin-audit-date-cell">{formatAuditDateTime(item.createdAt)}</td>
                                    <td>
                                        <strong className="admin-audit-primary">{item.admin?.name || "-"}</strong>
                                        <span className="admin-audit-muted">{item.admin?.email || "-"}</span>
                                    </td>
                                    <td>{getAuditActionLabel(item.action) || item.actionLabel || item.action}</td>
                                    <td>
                                        <strong className="admin-audit-primary">{getAuditTargetLabel(item)}</strong>
                                        {!String(item.action || "").startsWith("admin.access.") ? (
                                            <span className="admin-audit-muted">{item.target?.email || item.entityId || "-"}</span>
                                        ) : null}
                                    </td>
                                    <td>{formatAuditValue(item.oldValue)}</td>
                                    <td>{formatAuditValue(item.newValue)}</td>
                                    <td>
                                        {item.status ? (
                                            <span className={getAuditStatusClass(item.status)}>
                                                {getAuditStatusLabel(item.status)}
                                            </span>
                                        ) : "-"}
                                    </td>
                                    <td className="admin-audit-ip-cell">{item.ipAddress || "-"}</td>
                                    <td>
                                        <div className="admin-audit-row-actions">
                                            {item.details ? (
                                                <button type="button" className="admin-small-btn admin-audit-view-btn" onClick={() => setSelectedAuditLog(item)}>
                                                    {adminText.audit.actions.view}
                                                </button>
                                            ) : null}
                                            <button
                                                type="button"
                                                className="admin-audit-delete-btn"
                                                onClick={() => deleteAuditLog(item)}
                                                disabled={deletingAuditLogId === item.id}
                                                aria-label={adminText.audit.actions.delete}
                                                title={adminText.audit.actions.delete}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {hasMoreAuditLogs ? (
                        <div className="admin-audit-load-more">
                            <button type="button" className="admin-small-btn" onClick={() => setAuditVisibleCount((prev) => prev + AUDIT_PAGE_SIZE)}>
                                {adminText.audit.actions.loadMore}
                            </button>
                            <span>{adminText.audit.actions.shownOf(visibleAuditLogs.length, filteredAuditLogs.length)}</span>
                        </div>
                    ) : null}
                </div>
            )}

            {!isAuditLoading && filteredAuditLogs.length === 0 ? <p className="admin-empty">{adminText.audit.empty}</p> : null}

            {selectedAuditLog ? (
                <div className="admin-audit-drawer-backdrop" role="presentation" onClick={() => setSelectedAuditLog(null)}>
                    <aside className="admin-audit-details admin-audit-drawer" role="dialog" aria-label={adminText.audit.details.aria} onClick={(event) => event.stopPropagation()}>
                        <div className="admin-audit-details-head">
                            <div>
                                <h4>{adminText.audit.details.title}</h4>
                                <p>{getAuditActionLabel(selectedAuditLog.action) || selectedAuditLog.actionLabel || selectedAuditLog.action}</p>
                            </div>
                            <button type="button" className="admin-audit-close-btn" onClick={() => setSelectedAuditLog(null)} aria-label={adminText.audit.details.close}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="admin-audit-detail-grid">
                            <article>
                                <span>{adminText.audit.details.admin}</span>
                                <strong>{getAuditPersonLabel(selectedAuditLog.admin)}</strong>
                                <small>{selectedAuditLog.admin?.email || "-"}</small>
                            </article>
                            <article>
                                <span>{adminText.audit.details.action}</span>
                                <strong>{getAuditActionLabel(selectedAuditLog.action) || selectedAuditLog.actionLabel || selectedAuditLog.action || "-"}</strong>
                            </article>
                            <article>
                            <span>{adminText.audit.details.subject}</span>
                                <strong>{getAuditTargetLabel(selectedAuditLog)}</strong>
                                <small>{selectedAuditLog.target?.email || selectedAuditLog.entityId || "-"}</small>
                            </article>
                            <article>
                                <span>{adminText.audit.details.oldValue}</span>
                                <strong>{formatAuditValue(selectedAuditLog.oldValue)}</strong>
                            </article>
                            <article>
                                <span>{selectedAuditLog.action === "admin.user.status_update" ? adminText.audit.details.newStatus : adminText.audit.details.newValue}</span>
                                <strong>{formatAuditValue(selectedAuditLog.newValue)}</strong>
                            </article>
                            <article>
                                <span>{adminText.audit.details.status}</span>
                                <strong>{getAuditStatusLabel(selectedAuditLog.status)}</strong>
                            </article>
                            <article>
                                <span>IP</span>
                                <strong>{selectedAuditLog.ipAddress || "-"}</strong>
                            </article>
                            <article>
                                <span>{adminText.audit.details.date}</span>
                                <strong>{formatAuditDateTime(selectedAuditLog.createdAt)}</strong>
                            </article>
                        </div>
                    </aside>
                </div>
            ) : null}

        </section>

    );



    const renderUsersTable = () => (

        <section className="admin-page-card admin-stats-only-card">

            <div className="admin-page-head">

                <div>

                    <h3>{adminText.users.title}</h3>

                </div>

                <div className="admin-page-figure admin-user-total" aria-label={adminText.users.totalAria}>
                    <span className="admin-user-total-icon">
                        <Users size={18} />
                    </span>
                    <span>{adminText.users.total(filteredUsers.length)}</span>
                </div>

            </div>

            {usersError ? <p className="admin-inline-error" role="alert">{usersError}</p> : null}

            {isUsersLoading ? (

                <p className="admin-empty">{adminText.users.loading}</p>

            ) : (

            <div className="admin-table-wrap admin-users-table-wrap">

                <table className="admin-table admin-table-with-badges admin-users-table">

                    <thead>

                        <tr>

                            <th>{adminText.users.columns.name}</th>

                            <th>{adminText.users.columns.email}</th>

                            <th>{adminText.users.columns.faculty}</th>

                            <th>{adminText.users.columns.department}</th>

                            <th>{adminText.users.columns.role}</th>

                            <th>{adminText.users.columns.status}</th>

                            <th>{adminText.users.columns.lastLogin}</th>

                            <th>{adminText.users.columns.created}</th>

                            <th>{adminText.users.columns.actions}</th>

                        </tr>

                    </thead>

                    <tbody>

                        {filteredUsers.map((item) => (

                            <tr key={item.id}>

                                <td>{item.name}</td>

                                <td className="admin-user-email-cell" title={item.email}>{item.email}</td>

                                <td className="admin-user-faculty-cell">{item.faculty || "-"}</td>

                                <td className="admin-user-department-cell">{item.department || "-"}</td>

                                <td>

                                    <select
                                        className="admin-select admin-role-select"
                                        value={item.role}
                                        onChange={(event) => updateUserRole(item.id, event.target.value)}
                                        disabled={updatingUserId === item.id}
                                        aria-label={adminText.users.actions.changeRole(item.email)}
                                    >
                                        {ROLE_OPTIONS.map((role) => (
                                            <option key={role.value} value={role.value}>{adminText.users.roles[role.value] || role.label}</option>
                                        ))}
                                    </select>

                                </td>

                                <td>

                                    <span className={getStatusClass(item.status)}>{adminText.users.statuses[item.status] || STATUS_LABELS[item.status] || item.status}</span>

                                </td>

                                <td className="admin-last-login-cell">{formatAdminDateTime(item.lastLoginAt || item.last_login_at)}</td>

                                <td className="admin-created-at-cell">{formatAdminDate(item.createdAt)}</td>

                                <td className="admin-user-actions-cell">

                                    <div className="admin-actions-row admin-user-actions">

                                        <button
                                            type="button"
                                            className={`admin-small-btn${item.status === "active" ? " danger" : ""}`}
                                            onClick={() => updateUserStatus(item.id, item.status === "active" ? "inactive" : "active")}
                                            disabled={updatingUserId === item.id}
                                        >
                                            {item.status === "active" ? adminText.users.actions.deactivate : adminText.users.actions.activate}
                                        </button>

                                        <button
                                            type="button"
                                            className="admin-small-btn admin-view-user-btn"
                                            onClick={() => setSelectedUser(item)}
                                        >
                                            {adminText.users.actions.view}
                                        </button>

                                    </div>

                                </td>

                            </tr>

                        ))}

                    </tbody>

                </table>

            </div>

            )}

            {!isUsersLoading && filteredUsers.length === 0 ? <p className="admin-empty">{adminText.users.noResults}</p> : null}

            {selectedUser ? (
                <div className="admin-user-details" role="dialog" aria-label={adminText.users.detailsAria}>
                    <div>
                        <h4>{selectedUser.name}</h4>
                        <p>{selectedUser.email}</p>
                    </div>
                    <dl>
                        <div>
                            <dt>{adminText.users.columns.faculty}</dt>
                            <dd>{selectedUser.faculty || "-"}</dd>
                        </div>
                        <div>
                            <dt>{adminText.users.columns.department}</dt>
                            <dd>{selectedUser.department || "-"}</dd>
                        </div>
                        <div>
                            <dt>{adminText.users.columns.role}</dt>
                            <dd>{adminText.users.roles[selectedUser.role] || ROLE_LABELS[selectedUser.role] || selectedUser.role}</dd>
                        </div>
                        <div>
                            <dt>{adminText.users.columns.status}</dt>
                            <dd>{adminText.users.statuses[selectedUser.status] || STATUS_LABELS[selectedUser.status] || selectedUser.status}</dd>
                        </div>
                        <div>
                            <dt>{adminText.users.columns.lastLogin}</dt>
                            <dd>{formatAdminDateTime(selectedUser.lastLoginAt || selectedUser.last_login_at)}</dd>
                        </div>
                        <div>
                            <dt>{adminText.users.columns.created}</dt>
                            <dd>{formatAdminDate(selectedUser.createdAt)}</dd>
                        </div>
                    </dl>
                    <button type="button" className="admin-small-btn" onClick={() => setSelectedUser(null)}>
                        {adminText.users.actions.close}
                    </button>
                </div>
            ) : null}

        </section>

    );
    let resultCount = filteredUsers.length;

    let content = renderUsersTable();

    if (activePage === "Historiku i veprimeve") {

        resultCount = filteredAuditLogs.length;

        content = renderAuditLogs();

    }

    if (activePage === "Njoftimet") {

        resultCount = 0;

        content = <AdminNotificationsSection onNotificationsChange={loadAdminNotifications} />;

    }

    if (activePage === "Statistikat") {

        resultCount = 0;

        content = <AdminAnalyticsSection searchQuery={searchQuery} />;

    }

    if (activePage === "Cilësimet") {

        resultCount = 0;

        content = <AdminSettingsSection />;

    }

    return (

        <div className="admin-layout">

            <AdminSidebar activePage={activePage} onNavigate={setActivePage} labels={adminText} />



            <div className="admin-main">

                <AdminTopbar

                    activePage={activePage}

                    searchQuery={searchQuery}

                    onSearchChange={setSearchQuery}

                    resultCount={resultCount}

                    notificationCount={unreadNotifications}

                    notifications={notifications}

                    notificationsLoading={isNotificationsLoading}

                    notificationsError={notificationsError}

                    onMarkAllRead={markAllNotificationsAsRead}

                    onNotificationRead={markNotificationAsRead}

                    onProfileAction={handleProfileAction}

                    profileMenuItems={profileMenuItems}

                    profileRefreshKey={profileRefreshKey}

                    labels={adminText}

                />

                <div className="admin-content">{content}</div>

            </div>

            {isProfileModalOpen ? (
                <div className="admin-modal-backdrop" role="presentation" onClick={() => setIsProfileModalOpen(false)}>
                    <section className="admin-profile-modal" role="dialog" aria-label="Ndrysho profilin" onClick={(event) => event.stopPropagation()}>
                        <div className="admin-profile-modal-head">
                            <div>
                                <h3>Ndrysho profilin</h3>
                                <p>Perditeso te dhenat baze te profilit.</p>
                            </div>
                            <button type="button" className="admin-modal-close-btn" onClick={() => setIsProfileModalOpen(false)} aria-label="Mbyll">
                                <X size={18} />
                            </button>
                        </div>

                        <form className="admin-profile-form" onSubmit={handleProfileSave}>
                            <label>
                                <span>Emri</span>
                                <input value={profileDraft.name} onChange={handleProfileFieldChange("name")} placeholder="Emri dhe mbiemri" />
                            </label>
                            <label>
                                <span>Email</span>
                                <input value={profileDraft.email} readOnly />
                            </label>
                            <label>
                                <span>Roli</span>
                                <input value={profileDraft.role} readOnly />
                            </label>
                            <label>
                                <span>Fakulteti</span>
                                <input value={profileDraft.faculty} onChange={handleProfileFieldChange("faculty")} placeholder="Fakulteti" />
                            </label>
                            <label>
                                <span>Departamenti</span>
                                <input value={profileDraft.department} onChange={handleProfileFieldChange("department")} placeholder="Departamenti" />
                            </label>
                            <label>
                                <span>Zyra</span>
                                <input value={profileDraft.office} onChange={handleProfileFieldChange("office")} placeholder="Zyra" />
                            </label>
                            <label>
                                <span>Titulli akademik</span>
                                <input value={profileDraft.academicTitle} onChange={handleProfileFieldChange("academicTitle")} placeholder="Titulli akademik" />
                            </label>
                            <label>
                                <span>Titulli shkencor</span>
                                <input value={profileDraft.scientificTitle} onChange={handleProfileFieldChange("scientificTitle")} placeholder="Titulli shkencor" />
                            </label>

                            {profileError ? <p className="admin-inline-error admin-profile-error" role="alert">{profileError}</p> : null}

                            <div className="admin-profile-modal-actions">
                                <button type="button" className="admin-small-btn" onClick={() => setIsProfileModalOpen(false)} disabled={isProfileSaving}>
                                    Anulo
                                </button>
                                <button type="submit" className="admin-primary-btn" disabled={isProfileSaving}>
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
