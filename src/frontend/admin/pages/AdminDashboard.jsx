import { useState, useMemo } from "react";

import { useNavigate } from "react-router-dom";

import { Filter, ArrowRight, CheckCircle2, Shield, FileText, LogOut as LogOutIcon, User, Settings, Link2, Bell } from "lucide-react";

import AdminSidebar from "../components/AdminSidebar";

import AdminTopbar from "../components/AdminTopbar";

import BackupSection from "../components/BackupSection";

import "../styles/AdminDashboard.css";
import "../styles/AdminSection.css";



const usersData = [

    { id: "USR-001", name: "Prof. Arben Hoxha", email: "a.hoxha@umib.edu", role: "Professor", status: "Active", faculty: "FSHN" },

    { id: "USR-002", name: "Dr. Mira Krasniqi", email: "m.krasniqi@umib.edu", role: "Commission", status: "Active", faculty: "FE" },

    { id: "USR-003", name: "Prof. Edon Berisha", email: "e.berisha@umib.edu", role: "Pro Rector", status: "Active", faculty: "Rektorati" },

    { id: "USR-004", name: "Dr. Lulzim Gashi", email: "l.gashi@umib.edu", role: "Professor", status: "Deactivated", faculty: "FIM" },

    { id: "USR-005", name: "Ana Rexhepi", email: "a.rexhepi@umib.edu", role: "Admin", status: "Active", faculty: "IT" },

    { id: "USR-006", name: "Dr. Burim Maliqi", email: "b.maliqi@umib.edu", role: "Professor", status: "Active", faculty: "FSHN" },

];



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



const auditData = [

    { id: "AUD-001", title: "Login", user: "a.hoxha@umib.edu", category: "Auth", time: "10:42", icon: "auth" },

    { id: "AUD-002", title: "Aprovoi punim #2241", user: "m.krasniqi@umib.edu", category: "Submissions", time: "10:31", icon: "success" },

    { id: "AUD-003", title: "Ndryshoi rolin e përdoruesit", user: "a.rexhepi@umib.edu", category: "Users", time: "10:18", icon: "shield" },

    { id: "AUD-004", title: "Edito metadata #1182", user: "e.berisha@umib.edu", category: "Metadata", time: "09:55", icon: "metadata" },

    { id: "AUD-005", title: "Logout", user: "l.gashi@umib.edu", category: "Auth", time: "09:40", icon: "logout" },

    { id: "AUD-006", title: "Deaktivizoi përdoruesin", user: "a.rexhepi@umib.edu", category: "Users", time: "09:12", icon: "shield" },

];



const auditIcons = {

    auth: ArrowRight,

    success: CheckCircle2,

    shield: Shield,

    metadata: FileText,

    logout: LogOutIcon,

};



const backupData = [

    { id: "BCK-001", type: "Full Backup", date: "2024-04-19", size: "2.5 GB", status: "Completed" },

    { id: "BCK-002", type: "Incremental", date: "2024-04-18", size: "500 MB", status: "Completed" },

    { id: "BCK-003", type: "Database", date: "2024-04-17", size: "1.2 GB", status: "Failed" },

];



const navLabels = ["Përdoruesit", "Rolet", "Audit Logs", "Backup"];



const getStatusClass = (status) => {

    if (status === "Active") return "admin-chip admin-chip--active";

    if (status === "Deactivated") return "admin-chip admin-chip--inactive";

    return "admin-chip admin-chip--neutral";

};



const getRoleClass = (role) => {

    if (role === "Admin") return "admin-chip admin-chip--admin";

    if (role === "Commission") return "admin-chip admin-chip--commission";

    if (role === "Pro Rector") return "admin-chip admin-chip--prorector";

    return "admin-chip admin-chip--professor";

};



export default function AdminDashboard() {

    const navigate = useNavigate();

    const [activePage, setActivePage] = useState("Përdoruesit");

    const [searchQuery, setSearchQuery] = useState("");

    const [notifications, setNotifications] = useState([

        { id: 1, text: "3 tentativa të pasuksesshme login", isRead: false, createdAt: "para 5 min" },

        { id: 2, text: "1 përdorues është çaktivizuar për siguri", isRead: false, createdAt: "para 1 ore" },

        { id: 3, text: "Integrimi me Crossref pati vonesë", isRead: true, createdAt: "para 3 ore" },

    ]);



    const normalizedQuery = searchQuery.trim().toLowerCase();



    const filteredUsers = useMemo(() => {

        if (!normalizedQuery) return usersData;

        return usersData.filter((item) =>

            `${item.id} ${item.name} ${item.email} ${item.role} ${item.status}`.toLowerCase().includes(normalizedQuery)

        );

    }, [normalizedQuery]);



    const filteredRoles = useMemo(() => {

        if (!normalizedQuery) return rolesData;

        return rolesData.filter((item) =>

            `${item.id} ${item.name} ${item.users} ${item.actions.join(" ")}`.toLowerCase().includes(normalizedQuery)

        );

    }, [normalizedQuery]);



    const filteredAudit = useMemo(() => {

        if (!normalizedQuery) return auditData;

        return auditData.filter((item) =>

            `${item.id} ${item.title} ${item.user} ${item.category} ${item.time}`.toLowerCase().includes(normalizedQuery)

        );

    }, [normalizedQuery]);



    const filteredBackup = useMemo(() => {

        if (!normalizedQuery) return backupData;

        return backupData.filter((item) =>

            `${item.id} ${item.type} ${item.date} ${item.size} ${item.status}`.toLowerCase().includes(normalizedQuery)

        );

    }, [normalizedQuery]);



    const unreadNotifications = notifications.filter((item) => !item.isRead).length;



    const markAllNotificationsAsRead = () => {

        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));

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

                    <h3>Audit Logs</h3>

                    <p>UC-14 • Aktivitetet në sistem</p>

                </div>

                <button type="button" className="admin-roles-config-button admin-filter-button">

                    <Filter size={16} />

                    Filtro

                </button>

            </div>

            <div className="admin-audit-list">

                {filteredAudit.map((item) => {

                    const Icon = auditIcons[item.icon] || ArrowRight;

                    return (

                        <article key={item.id} className="admin-audit-item">

                            <div className="admin-audit-item-main">

                                <span className={`admin-audit-item-icon admin-audit-item-icon--${item.category.toLowerCase()}`}>

                                    <Icon size={18} />

                                </span>

                                <div className="admin-audit-item-text">

                                    <h4>{item.title}</h4>

                                    <p>{item.user}</p>

                                </div>

                            </div>

                            <div className="admin-audit-item-meta">

                                <span className="admin-audit-item-badge">{item.category}</span>

                                <span className="admin-audit-item-time">{item.time}</span>

                            </div>

                        </article>

                    );

                })}

            </div>

            {filteredAudit.length === 0 ? <p className="admin-empty">Nuk ka rezultate për kërkimin aktual.</p> : null}

        </section>

    );



    const renderUsersTable = () => (

        <section className="admin-page-card admin-stats-only-card">

            <div className="admin-page-head">

                <div>

                    <h3>Menaxhimi i Përdoruesve</h3>

                    <p>UC-14 • Aktivizo, çaktivizo dhe ndrysho rolet për përdoruesit e sistemit.</p>

                </div>

                <div className="admin-page-figure">{filteredUsers.length} përdorues</div>

            </div>

            <div className="admin-table-wrap">

                <table className="admin-table admin-table-with-badges">

                    <thead>

                        <tr>

                            <th>Emri</th>

                            <th>Email</th>

                            <th>Roli</th>

                            <th>Statusi</th>

                            <th>Fakulteti</th>

                            <th>Veprimet</th>

                        </tr>

                    </thead>

                    <tbody>

                        {filteredUsers.map((item) => (

                            <tr key={item.id}>

                                <td>{item.name}</td>

                                <td>{item.email}</td>

                                <td>

                                    <span className={getRoleClass(item.role)}>{item.role}</span>

                                </td>

                                <td>

                                    <span className={getStatusClass(item.status)}>{item.status}</span>

                                </td>

                                <td>{item.faculty}</td>

                                <td>

                                    <button type="button" className="admin-action-button">

                                        ...

                                    </button>

                                </td>

                            </tr>

                        ))}

                    </tbody>

                </table>

            </div>

            {filteredUsers.length === 0 ? <p className="admin-empty">Nuk ka rezultate për kërkimin aktual.</p> : null}

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



    const renderBackupSection = () => <BackupSection />;



    let resultCount = filteredUsers.length;

    let content = renderUsersTable();



    if (activePage === "Rolet") {

        resultCount = rolesData.length;

        content = renderRolesSection();

    }



    if (activePage === "Audit Logs") {

        resultCount = filteredAudit.length;

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