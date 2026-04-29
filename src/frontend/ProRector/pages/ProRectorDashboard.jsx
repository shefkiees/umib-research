import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Bell, CheckCircle2, CircleUserRound, Link2, LogOut, RefreshCw, Settings, ShieldX } from "lucide-react";
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
import "../styles/ProRectorDashboard.css";
import ProRectorSidebar from "../components/Sidebar";
import ProRectorTopBar from "../components/TopBar";

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

  const handleEditProfile = () => {
    setIsEditProfileOpen(true);
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

  const renderContent = () => {
    if (activePage === "Fakultetet") {
      return (
        <div className="prorector-table-section">
          <h2>Fakultetet</h2>
          <p>Përmbledhje e statistikave të të gjitha fakulteteve.</p>
          <table className="prorector-table">
            <thead>
              <tr>
                <th>FAKULTETI</th>
                <th>DEPARTAMENTI</th>
                <th>PUBLIKIME</th>
                <th>PROJEKTE</th>
                <th>RIMBURSIME</th>
              </tr>
            </thead>
            <tbody>
              {filteredFacultyStats.map((row) => (
                <tr key={row.faculty}>
                  <td>{row.faculty}</td>
                  <td>{row.department}</td>
                  <td>{row.publikime}</td>
                  <td>{row.projekte}</td>
                  <td>{row.rimbursime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activePage === "Publikime") {
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
        <div className="prorector-table-section">
          <h2>Rimbursime</h2>
          <p>Përmbledhje e kërkesave për rimbursim.</p>
          <table className="prorector-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>KËRKESA</th>
                <th>NJESIA</th>
                <th>STATUSI</th>
              </tr>
            </thead>
            <tbody>
              {filteredReimbursements.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.request}</td>
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

    if (activePage === "Aprovime") {
      return (
        <div className="prorector-table-section">
          <h2>Aprovime</h2>
          <p>Përmbledhje e aprovimeve të dorëzimeve.</p>
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

    if (activePage === "Raporte") {
      return (
        <div className="prorector-table-section">
          <h2>Raporte</h2>
          <p>Raporte të ndryshme të aktiviteteve kërkimore.</p>
          <div className="prorector-reports-grid">
            <div className="prorector-report-card">
              <h3>Raporti i Publikimeve</h3>
              <p>Raport mujor i publikimeve akademike</p>
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
                    <input type="checkbox" defaultChecked />
                    <span className="prorector-slider"></span>
                  </label>
                </div>

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
                <button className="prorector-settings-action-btn">
                  Ndrysho fjalëkalimin
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
              <th>DEPARTAMENTI</th>
              <th>PUBLIKIME</th>
              <th>PROJEKTE</th>
              <th>RIMBURSIME</th>
            </tr>
          </thead>
          <tbody>
            {filteredFacultyStats.map((row) => (
              <tr key={row.faculty}>
                <td>{row.faculty}</td>
                <td>{row.department}</td>
                <td>{row.publikime}</td>
                <td>{row.projekte}</td>
                <td>{row.rimbursime}</td>
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
              navigate("/");
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