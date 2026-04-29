import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Bell, CircleUserRound, LogOut, Settings } from "lucide-react";
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

const facultyStatistics = [
  { faculty: "FG", label: "Fakulteti i Gjeoshkencave", department: "Fakulteti i Gjeoshkencave", publikime: 22, projekte: 8, rimbursime: 6 },
  { faculty: "FTU", label: "Fakulteti i Teknologjisë Ushqimore", department: "Fakulteti i Teknologjisë Ushqimore", publikime: 18, projekte: 6, rimbursime: 5 },
  { faculty: "FIMC", label: "Fakulteti i Inxhinierisë Mekanike dhe Kompjuterike", department: "Fakulteti i Inxhinierisë Mekanike dhe Kompjuterike", publikime: 26, projekte: 10, rimbursime: 7 },
  { faculty: "FJ", label: "Fakulteti Juridik", department: "Fakulteti Juridik", publikime: 14, projekte: 5, rimbursime: 4 },
  { faculty: "FE", label: "Fakulteti Ekonomik", department: "Fakulteti Ekonomik", publikime: 20, projekte: 7, rimbursime: 6 },
  { faculty: "FED", label: "Fakulteti i Edukimit", department: "Fakulteti i Edukimit", publikime: 16, projekte: 5, rimbursime: 5 },
];

const publicationRows = [
  { id: "PB-120", title: "Smart Grids in Emerging Markets", unit: "FIMC", status: "Aprovuar" },
  { id: "PB-115", title: "Applied Data Ethics in Education", unit: "FG", status: "Ne shqyrtim" },
  { id: "PB-108", title: "Supply Chain Risk in Balkans", unit: "FTU", status: "Aprovuar" },
];

const conferenceRows = [
  { id: "CF-032", event: "IEEE BalkanCom", unit: "FIMC", status: "Konfirmuar" },
  { id: "CF-027", event: "EduTech Europe", unit: "FED", status: "Ne pritje" },
  { id: "CF-018", event: "Legal Innovation Summit", unit: "FJ", status: "Konfirmuar" },
];

const reimbursementRows = [
  { id: "RB-012", request: "Article Processing Charge", unit: "FE", status: "Procesuar" },
  { id: "RB-009", request: "Conference Travel", unit: "FTU", status: "Ne verifikim" },
  { id: "RB-006", request: "Research Equipment", unit: "FIMC", status: "Procesuar" },
];

const navLabels = ["Dorëzimet në Pritje", "Shqyrtimi", "Metadata", "Vendimet", "Auditimi", "Raporte"];

export default function CommitteeDashboard() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState("Dorëzimet në Pritje");
  const [searchQuery, setSearchQuery] = useState("");
  const [committeeProfile, setCommitteeProfile] = useState({
    name: "Komisioni Shkencor",
    role: "Paneli i vleresimit",
    email: "komisioni@umib.edu",
    unit: "Komisioni i Studimeve",
  });
  const [committeeDraft, setCommitteeDraft] = useState({
    name: "Komisioni Shkencor",
    role: "Paneli i vleresimit",
    email: "komisioni@umib.edu",
    unit: "Komisioni i Studimeve",
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

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredFacultyStats = useMemo(() => {
    if (!normalizedQuery) {
      return facultyStatistics;
    }

    return facultyStatistics.filter((item) => {
      const row = `${item.faculty} ${item.department} ${item.publikime} ${item.projekte} ${item.rimbursime}`.toLowerCase();
      return row.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  const filteredPublications = useMemo(() => {
    if (!normalizedQuery) {
      return publicationRows;
    }

    return publicationRows.filter((item) =>
      `${item.id} ${item.title} ${item.unit} ${item.status}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const filteredConferences = useMemo(() => {
    if (!normalizedQuery) {
      return conferenceRows;
    }

    return conferenceRows.filter((item) =>
      `${item.id} ${item.event} ${item.unit} ${item.status}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const filteredReimbursements = useMemo(() => {
    if (!normalizedQuery) {
      return reimbursementRows;
    }

    return reimbursementRows.filter((item) =>
      `${item.id} ${item.request} ${item.unit} ${item.status}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

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
      localStorage.removeItem("authToken");
      sessionStorage.removeItem("authToken");
      navigate("/", { replace: true });
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

  let resultCount = filteredPublications.length;
  let content = renderSimpleTable(
    "Dorëzimet në Pritje",
    "Permbledhje e dorëzimeve akademike ne pritje e shqyrtimi.",
    [
      { key: "id", label: "ID" },
      { key: "title", label: "Titulli" },
      { key: "unit", label: "Njesia" },
      { key: "status", label: "Statusi" },
    ],
    filteredPublications
  );

  if (activePage === "Shqyrtimi") {
    resultCount = filteredPublications.length;
    content = renderSimpleTable(
      "Shqyrtimi",
      "Procesi i shqyrtimit të dorëzimeve akademike.",
      [
        { key: "id", label: "ID" },
        { key: "title", label: "Dorëzimi" },
        { key: "unit", label: "Njesia" },
        { key: "status", label: "Statusi" },
      ],
      filteredPublications
    );
  }

  if (activePage === "Metadata") {
    resultCount = filteredConferences.length;
    content = renderSimpleTable(
      "Metadata",
      "Informacione të detajuara rreth dorëzimeve akademike.",
      [
        { key: "id", label: "ID" },
        { key: "event", label: "Përshkrimi" },
        { key: "unit", label: "Njesia" },
        { key: "status", label: "Statusi" },
      ],
      filteredConferences
    );
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
    resultCount = filteredReimbursements.length;
    content = renderSimpleTable(
      "Auditimi",
      "Regjistrimi i auditimit për të gjitha aktivitetet.",
      [
        { key: "id", label: "ID" },
        { key: "request", label: "Aktiviteti" },
        { key: "unit", label: "Njesia" },
        { key: "status", label: "Statusi" },
      ],
      filteredReimbursements
    );
  }

  if (activePage === "Raporte") {
    resultCount = filteredReimbursements.length;
    content = renderSimpleTable(
      "Raporte",
      "Raportet mujore dhe vjetore te komisionit.",
      [
        { key: "id", label: "ID" },
        { key: "request", label: "Raporti" },
        { key: "unit", label: "Perioda" },
        { key: "status", label: "Statusi" },
      ],
      filteredReimbursements
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
