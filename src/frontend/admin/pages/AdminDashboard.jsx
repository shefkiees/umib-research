import { useEffect, useState, useMemo } from "react";

import { useNavigate } from "react-router-dom";

import { Filter, ArrowRight, User, Settings, Link2, Bell, Users } from "lucide-react";

import AdminSidebar from "../components/AdminSidebar";

import AdminTopbar from "../components/AdminTopbar";

import BackupSection from "../components/BackupSection";
import { apiUrl } from "../../utils/api";

import "../styles/AdminDashboard.css";
import "../styles/AdminSection.css";

const ROLE_OPTIONS = [
    { value: "admin", label: "Admin" },
    { value: "committee", label: "Committee" },
    { value: "professor", label: "Professor" },
    { value: "prorector", label: "ProRector" },
];

const ROLE_LABELS = ROLE_OPTIONS.reduce((labels, item) => ({
    ...labels,
    [item.value]: item.label,
}), {});

const STATUS_LABELS = {
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
};



const rolesData = [

    {

        id: "ROL-001",

        name: "Professor",

        users: 84,

        badge: "Aktiv",

        actions: [

            "Dorëzo punime",

            "Shiko statusin",

            "Edito profilin",

        ],

    },

    {

        id: "ROL-002",

        name: "Commission",

        users: 12,

        badge: "Aktiv",

        actions: [

            "Vlerëso punime",

            "Komento",

            "Aprovo / Refuzo",

        ],

    },

    {

        id: "ROL-003",

        name: "Pro Rector",

        users: 3,

        badge: "Aktiv",

        actions: [

            "Aprovim final",

            "Raporte",

            "Mbikëqyrje komisionesh",

        ],

    },

    {

        id: "ROL-004",

        name: "Admin",

        users: 2,

        badge: "Aktiv",

        actions: [

            "Akses i plotë",

            "Menaxhim përdoruesish",

            "Audit logs",

        ],

    },

];



const auditActionOptions = [
    { value: "", label: "Te gjitha veprimet" },
    { value: "admin.auth.login", label: "Login i adminit" },
    { value: "admin.access.unauthenticated", label: "Tentim qasjeje pa login" },
    { value: "admin.access.forbidden", label: "Tentim qasjeje pa leje" },
    { value: "admin.user.role_update", label: "Ndryshim roli" },
    { value: "admin.user.status_update", label: "Ndryshim statusi" },
    { value: "admin.access_reset.status_update", label: "Ndryshim qasjeje" },

];

const backupData = [

    { id: "BCK-001", type: "Full Backup", date: "2024-04-19", size: "2.5 GB", status: "Completed" },

    { id: "BCK-002", type: "Incremental", date: "2024-04-18", size: "500 MB", status: "Completed" },

    { id: "BCK-003", type: "Database", date: "2024-04-17", size: "1.2 GB", status: "Failed" },

];



const navLabels = ["Perdoruesit", "Rolet", "Rivendosja e qasjes", "Audit Logs", "Backup"];

const accessResetStatusLabels = {
    pending: "Ne pritje",
    in_progress: "Ne trajtim",
    completed: "Perfunduar",
    rejected: "Refuzuar",
};

const accessResetStatusClasses = {
    pending: "admin-chip admin-chip--neutral",
    in_progress: "admin-chip admin-chip--commission",
    completed: "admin-chip admin-chip--active",
    rejected: "admin-chip admin-chip--inactive",
};

const formatAccessResetDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("sq-AL", {
        dateStyle: "short",
        timeStyle: "short",
    });
};



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



export default function AdminDashboard() {

    const navigate = useNavigate();

    const [activePage, setActivePage] = useState("Perdoruesit");

    const [searchQuery, setSearchQuery] = useState("");

    const [accessResetRequests, setAccessResetRequests] = useState([]);

    const [isAccessResetLoading, setIsAccessResetLoading] = useState(false);

    const [accessResetError, setAccessResetError] = useState("");

    const [auditLogs, setAuditLogs] = useState([]);

    const [isAuditLoading, setIsAuditLoading] = useState(false);

    const [auditError, setAuditError] = useState("");

    const [auditRefreshKey, setAuditRefreshKey] = useState(0);

    const [auditFilters, setAuditFilters] = useState({
        adminEmail: "",
        targetEmail: "",
        action: "",
        startDate: "",
        endDate: "",
    });

    const [users, setUsers] = useState([]);

    const [isUsersLoading, setIsUsersLoading] = useState(false);

    const [usersError, setUsersError] = useState("");

    const [updatingUserId, setUpdatingUserId] = useState("");

    const [selectedUser, setSelectedUser] = useState(null);

    const [notifications, setNotifications] = useState([

        { id: 1, text: "3 tentativa të pasuksesshme login", isRead: false, createdAt: "para 5 min" },

        { id: 2, text: "1 përdorues është çaktivizuar për siguri", isRead: false, createdAt: "para 1 ore" },

        { id: 3, text: "Integrimi me Crossref pati vonesë", isRead: true, createdAt: "para 3 ore" },

    ]);

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
                    setUsersError("Perdoruesit nuk u ngarkuan.");
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

        const loadAccessResetRequests = async () => {

            setIsAccessResetLoading(true);

            setAccessResetError("");

            try {

                const response = await fetch(apiUrl("/admin/access-reset-requests"), {
                    credentials: "include",
                });

                if (!response.ok) {
                    throw new Error("access_reset_requests_failed");
                }

                const data = await response.json();

                if (isMounted) {
                    setAccessResetRequests(Array.isArray(data.requests) ? data.requests : []);
                }

            } catch (error) {

                console.error("Access reset requests load failed:", error);

                if (isMounted) {
                    setAccessResetRequests([]);
                    setAccessResetError("Kerkesat per rivendosje qasjeje nuk u ngarkuan.");
                }

            } finally {

                if (isMounted) {
                    setIsAccessResetLoading(false);
                }

            }

        };

        loadAccessResetRequests();

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
                    setAuditError("Historiku i veprimeve nuk u ngarkua.");
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

    }, [auditFilters, auditRefreshKey]);



    const normalizedQuery = searchQuery.trim().toLowerCase();



    const filteredUsers = useMemo(() => {

        if (!normalizedQuery) return users;

        return users.filter((item) =>

            `${item.id} ${item.name} ${item.email} ${item.role} ${item.status} ${item.faculty} ${item.department}`.toLowerCase().includes(normalizedQuery)

        );

    }, [normalizedQuery, users]);



    const filteredRoles = useMemo(() => {

        if (!normalizedQuery) return rolesData;

        return rolesData.filter((item) =>

            `${item.id} ${item.name} ${item.users} ${item.actions.join(" ")}`.toLowerCase().includes(normalizedQuery)

        );

    }, [normalizedQuery]);



    const filteredAuditLogs = useMemo(() => {

        if (!normalizedQuery) return auditLogs;

        return auditLogs.filter((item) =>

            `${item.id} ${item.actionLabel} ${item.admin?.email || ""} ${item.admin?.name || ""} ${item.target?.email || ""} ${item.target?.name || ""} ${item.oldValue || ""} ${item.newValue || ""} ${item.ipAddress || ""}`.toLowerCase().includes(normalizedQuery)

        );

    }, [auditLogs, normalizedQuery]);

    const filteredBackup = useMemo(() => {

        if (!normalizedQuery) return backupData;

        return backupData.filter((item) =>

            `${item.id} ${item.type} ${item.date} ${item.size} ${item.status}`.toLowerCase().includes(normalizedQuery)

        );

    }, [normalizedQuery]);


    const filteredAccessResetRequests = useMemo(() => {

        if (!normalizedQuery) return accessResetRequests;

        return accessResetRequests.filter((item) =>

            `${item.id} ${item.email} ${item.status} ${item.user?.name || ""} ${item.user?.role || ""} ${item.user?.faculty || ""}`.toLowerCase().includes(normalizedQuery)

        );

    }, [accessResetRequests, normalizedQuery]);



    const unreadNotifications = notifications.filter((item) => !item.isRead).length;



    const markAllNotificationsAsRead = () => {

        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));

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
            startDate: "",
            endDate: "",
        });
    };



    const profileMenuItems = [

        { id: "Njoftime", label: "Njoftime", icon: Bell },

        { id: "Edit Profile", label: "Edit Profile", icon: User },

        { id: "Settings", label: "Settings", icon: Settings },

        { id: "Integrime", label: "Integrime", icon: Link2 },

        { id: "Logout", label: "Logout", icon: ArrowRight, tone: "danger" },

    ];



    const handleProfileAction = (actionId) => {

        if (actionId === "Njoftime") {

            navigate("/admin/notifications");

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
                throw new Error(data.message || "Roli nuk u perditesua.");
            }

            replaceUser(data.user);
            setAuditRefreshKey((prev) => prev + 1);

        } catch (error) {

            console.error("Admin user role update failed:", error);
            setUsersError(error.message || "Roli nuk u perditesua.");

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
                throw new Error(data.message || "Statusi nuk u perditesua.");
            }

            replaceUser(data.user);
            setAuditRefreshKey((prev) => prev + 1);

        } catch (error) {

            console.error("Admin user status update failed:", error);
            setUsersError(error.message || "Statusi nuk u perditesua.");

        } finally {

            setUpdatingUserId("");

        }

    };


    const updateAccessResetStatus = async (requestId, status) => {

        try {

            const response = await fetch(apiUrl(`/admin/access-reset-requests/${requestId}`), {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || "access_reset_request_update_failed");
            }

            setAccessResetRequests((prev) =>
                prev.map((item) =>
                    item.id === requestId
                        ? { ...item, ...data.request, user: item.user }
                        : item
                )
            );
            setAuditRefreshKey((prev) => prev + 1);

        } catch (error) {

            console.error("Access reset request update failed:", error);
            setAccessResetError("Statusi i kerkeses nuk u perditesua.");

        }

    };



    const renderSimpleTable = (title, description, columns, rows) => (

        <section className="admin-page-card admin-stats-only-card">

            <div className="admin-page-head">

                <h3>{title}</h3>

                <p>{description}</p>

            </div>

            <div className="admin-table-wrap">

                <table className="admin-table">

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

            {rows.length === 0 ? <p className="admin-empty">Nuk ka rezultate për kërkimin aktual.</p> : null}

        </section>

    );



    const renderAuditLogs = () => (

        <section className="admin-page-card admin-stats-only-card admin-audit-section">

            <div className="admin-page-head admin-page-head--roles">

                <div>

                    <h3>Historiku i veprimeve</h3>

                    <p>Veprimet administrative dhe tentimet e qasjes ne panelin admin</p>

                </div>

                <button type="button" className="admin-roles-config-button admin-filter-button" onClick={clearAuditFilters}>

                    <Filter size={16} />

                    Pastro filtrat

                </button>

            </div>

            <div className="admin-audit-filters">
                <label>
                    <span>Admin email</span>
                    <input type="search" value={auditFilters.adminEmail} onChange={updateAuditFilter("adminEmail")} placeholder="admin@umib.net" />
                </label>
                <label>
                    <span>Target email</span>
                    <input type="search" value={auditFilters.targetEmail} onChange={updateAuditFilter("targetEmail")} placeholder="perdoruesi@umib.net" />
                </label>
                <label>
                    <span>Veprimi</span>
                    <select value={auditFilters.action} onChange={updateAuditFilter("action")}>
                        {auditActionOptions.map((option) => (
                            <option key={option.value || "all"} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>
                <label>
                    <span>Nga data</span>
                    <input type="date" value={auditFilters.startDate} onChange={updateAuditFilter("startDate")} />
                </label>
                <label>
                    <span>Deri me</span>
                    <input type="date" value={auditFilters.endDate} onChange={updateAuditFilter("endDate")} />
                </label>
            </div>

            {auditError ? <p className="admin-inline-error" role="alert">{auditError}</p> : null}

            {isAuditLoading ? (
                <p className="admin-empty">Duke ngarkuar historikun...</p>
            ) : (
                <div className="admin-table-wrap admin-audit-table-wrap">
                    <table className="admin-table admin-audit-table">
                        <thead>
                            <tr>
                                <th>Data/Ora</th>
                                <th>Admini</th>
                                <th>Veprimi</th>
                                <th>Target/User</th>
                                <th>Vlera e vjeter</th>
                                <th>Vlera e re</th>
                                <th>IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAuditLogs.map((item) => (
                                <tr key={item.id}>
                                    <td className="admin-audit-date-cell">{formatAdminDateTime(item.createdAt)}</td>
                                    <td>
                                        <strong className="admin-audit-primary">{item.admin?.name || "-"}</strong>
                                        <span className="admin-audit-muted">{item.admin?.email || "-"}</span>
                                    </td>
                                    <td>{item.actionLabel || item.action}</td>
                                    <td>
                                        <strong className="admin-audit-primary">{item.target?.name || item.target?.email || "-"}</strong>
                                        <span className="admin-audit-muted">{item.target?.email || item.entityId || "-"}</span>
                                    </td>
                                    <td>{item.oldValue || "-"}</td>
                                    <td>{item.newValue || "-"}</td>
                                    <td className="admin-audit-ip-cell">{item.ipAddress || "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!isAuditLoading && filteredAuditLogs.length === 0 ? <p className="admin-empty">Nuk ka audit logs per filtrat aktuale.</p> : null}

        </section>

    );



    const renderUsersTable = () => (

        <section className="admin-page-card admin-stats-only-card">

            <div className="admin-page-head">

                <div>

                    <h3>Menaxhimi i perdoruesve</h3>

                </div>

                <div className="admin-page-figure admin-user-total" aria-label="Totali i perdoruesve">
                    <span className="admin-user-total-icon">
                        <Users size={18} />
                    </span>
                    <span>{filteredUsers.length}</span>
                </div>

            </div>

            {usersError ? <p className="admin-inline-error" role="alert">{usersError}</p> : null}

            {isUsersLoading ? (

                <p className="admin-empty">Duke ngarkuar perdoruesit...</p>

            ) : (

            <div className="admin-table-wrap admin-users-table-wrap">

                <table className="admin-table admin-table-with-badges admin-users-table">

                    <thead>

                        <tr>

                            <th>Emri</th>

                            <th>Email</th>

                            <th>Fakulteti</th>

                            <th>Departamenti</th>

                            <th>Roli</th>

                            <th>Statusi</th>

                            <th>Kyçja e fundit</th>

                            <th>Krijuar</th>

                            <th>Veprimet</th>

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
                                        aria-label={`Ndrysho rolin per ${item.email}`}
                                    >
                                        {ROLE_OPTIONS.map((role) => (
                                            <option key={role.value} value={role.value}>{role.label}</option>
                                        ))}
                                    </select>

                                </td>

                                <td>

                                    <span className={getStatusClass(item.status)}>{STATUS_LABELS[item.status] || item.status}</span>

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
                                            {item.status === "active" ? "Deaktivizo" : "Aktivizo"}
                                        </button>

                                        <button
                                            type="button"
                                            className="admin-small-btn"
                                            onClick={() => setSelectedUser(item)}
                                        >
                                            Shiko
                                        </button>

                                    </div>

                                </td>

                            </tr>

                        ))}

                    </tbody>

                </table>

            </div>

            )}

            {!isUsersLoading && filteredUsers.length === 0 ? <p className="admin-empty">Nuk ka rezultate per kerkimin aktual.</p> : null}

            {selectedUser ? (
                <div className="admin-user-details" role="dialog" aria-label="Detajet e perdoruesit">
                    <div>
                        <h4>{selectedUser.name}</h4>
                        <p>{selectedUser.email}</p>
                    </div>
                    <dl>
                        <div>
                            <dt>Fakulteti</dt>
                            <dd>{selectedUser.faculty || "-"}</dd>
                        </div>
                        <div>
                            <dt>Departamenti</dt>
                            <dd>{selectedUser.department || "-"}</dd>
                        </div>
                        <div>
                            <dt>Roli</dt>
                            <dd>{ROLE_LABELS[selectedUser.role] || selectedUser.role}</dd>
                        </div>
                        <div>
                            <dt>Statusi</dt>
                            <dd>{STATUS_LABELS[selectedUser.status] || selectedUser.status}</dd>
                        </div>
                        <div>
                            <dt>Kyçja e fundit</dt>
                            <dd>{formatAdminDateTime(selectedUser.lastLoginAt || selectedUser.last_login_at)}</dd>
                        </div>
                        <div>
                            <dt>Krijuar</dt>
                            <dd>{formatAdminDate(selectedUser.createdAt)}</dd>
                        </div>
                    </dl>
                    <button type="button" className="admin-small-btn" onClick={() => setSelectedUser(null)}>
                        Mbyll
                    </button>
                </div>
            ) : null}

        </section>

    );



    const renderRolesSection = () => (

        <section className="admin-page-card admin-stats-only-card admin-roles-section">

            <div className="admin-page-head admin-page-head--roles">

                <div>

                    <h3>Rolet & Lejet</h3>

                    <p>Cakto role dhe kontrollo privilegjet</p>

                </div>

                <button type="button" className="admin-roles-config-button">

                    Konfiguro

                </button>

            </div>

            <div className="admin-roles-grid">

                {filteredRoles.map((role) => (

                    <article key={role.id} className="admin-role-card">

                        <div className="admin-role-card-header">

                            <div>

                                <h4>{role.name}</h4>

                                <p>{role.users} përdorues</p>

                            </div>

                            <span className="admin-chip admin-chip--active">{role.badge}</span>

                        </div>

                        <div className="admin-role-actions">

                            {role.actions.map((action) => (

                                <span key={action} className="admin-role-action">

                                    {action}

                                </span>

                            ))}

                        </div>

                    </article>

                ))}

            </div>

            {filteredRoles.length === 0 ? <p className="admin-empty">Nuk ka rezultate për kërkimin aktual.</p> : null}

        </section>

    );


    const renderAccessResetRequests = () => (

        <section className="admin-page-card admin-stats-only-card">

            <div className="admin-page-head">

                <div>

                    <h3>Rivendosja e qasjes</h3>

                    <p>Kerkesat e ardhura per rivendosje qasjeje trajtohen manualisht nga administratori ose IT.</p>

                </div>

                <div className="admin-page-figure">{filteredAccessResetRequests.length} kerkesa</div>

            </div>

            {accessResetError ? <p className="admin-inline-error" role="alert">{accessResetError}</p> : null}

            {isAccessResetLoading ? (

                <p className="admin-empty">Duke ngarkuar kerkesat...</p>

            ) : (

                <div className="admin-table-wrap">

                    <table className="admin-table admin-table-with-badges">

                        <thead>

                            <tr>

                                <th>Email</th>

                                <th>Perdoruesi</th>

                                <th>Roli</th>

                                <th>Data</th>

                                <th>Statusi</th>

                                <th>Veprimet</th>

                            </tr>

                        </thead>

                        <tbody>

                            {filteredAccessResetRequests.map((item) => (

                                <tr key={item.id}>

                                    <td>{item.email}</td>

                                    <td>{item.user?.name || "-"}</td>

                                    <td>{item.user?.role || "-"}</td>

                                    <td>{formatAccessResetDate(item.requestedAt)}</td>

                                    <td>

                                        <span className={accessResetStatusClasses[item.status] || "admin-chip admin-chip--neutral"}>

                                            {accessResetStatusLabels[item.status] || item.status}

                                        </span>

                                    </td>

                                    <td>

                                        <div className="admin-actions-row">

                                            <button
                                                type="button"
                                                className="admin-small-btn"
                                                onClick={() => updateAccessResetStatus(item.id, "in_progress")}
                                                disabled={item.status === "in_progress" || item.status === "completed"}
                                            >
                                                Ne trajtim
                                            </button>

                                            <button
                                                type="button"
                                                className="admin-small-btn"
                                                onClick={() => updateAccessResetStatus(item.id, "completed")}
                                                disabled={item.status === "completed"}
                                            >
                                                Perfunduar
                                            </button>

                                        </div>

                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>

            )}

            {!isAccessResetLoading && filteredAccessResetRequests.length === 0 ? <p className="admin-empty">Nuk ka kerkesa per rivendosje qasjeje.</p> : null}

        </section>

    );



    const renderBackupSection = () => <BackupSection />;



    let resultCount = filteredUsers.length;

    let content = renderUsersTable();



    if (activePage === "Rolet") {

        resultCount = rolesData.length;

        content = renderRolesSection();

    }


    if (activePage === "Rivendosja e qasjes") {

        resultCount = filteredAccessResetRequests.length;

        content = renderAccessResetRequests();

    }



    if (activePage === "Audit Logs") {

        resultCount = filteredAuditLogs.length;

        content = renderAuditLogs();

    }



    if (activePage === "Backup") {

        resultCount = 3;

        content = renderBackupSection();

    }



    return (

        <div className="admin-layout">

            <AdminSidebar activePage={activePage} onNavigate={setActivePage} navLabels={navLabels} />



            <div className="admin-main">

                <AdminTopbar

                    activePage={activePage}

                    searchQuery={searchQuery}

                    onSearchChange={setSearchQuery}

                    resultCount={resultCount}

                    notificationCount={unreadNotifications}

                    notifications={notifications}

                    onMarkAllRead={markAllNotificationsAsRead}

                    onProfileAction={handleProfileAction}

                    profileMenuItems={profileMenuItems}

                />

                <div className="admin-content">{content}</div>

            </div>

        </div>

    );

} 
