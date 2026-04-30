import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Link2,
  RefreshCw,
  Settings,
  ShieldX,
  Wallet,
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

import {
  conferenceRows,
  integrations,
  professorProfile,
  profileMenuItems,
  publicationRows,
  reimbursementRows,
  statisticsChartData,
  statisticsRows,
} from "../data/dashboardData";
import "../styles/ProfessorDashboard.css";

export default function ProfessorDashboard() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState("Statistika");
  const [searchQuery, setSearchQuery] = useState("");
  const [periodRange, setPeriodRange] = useState("2m");
  const [profile, setProfile] = useState(professorProfile);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState(professorProfile);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      category: "Raporte",
      title: "Raporti mujor u gjenerua",
      description: "Raporti i muajit aktual eshte gati dhe mund te shkarkohet nga paneli i raporteve.",
      text: "Raporti mujor u gjenerua me sukses",
      isRead: false,
      createdAt: "Sot, 10:12",
    },
    {
      id: 2,
      category: "Rimbursime",
      title: "Kerkesa e rimbursimit u perditesua",
      description: "Kerkesa per udhetim ne konference kaloi ne fazen e verifikimit financiar.",
      text: "Kerkesa e rimbursimit u perditesua",
      isRead: false,
      createdAt: "Sot, 08:45",
    },
    {
      id: 3,
      category: "Publikime",
      title: "Publikimi i ri eshte ne verifikim",
      description: "Artikulli i dorezuar tek European Computing Review po shqyrtohet nga redaksia.",
      text: "Publikimi i ri eshte ne verifikim",
      isRead: true,
      createdAt: "Dje, 17:20",
    },
  ]);
  const pageTitle = activePage;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const unreadNotifications = notifications.filter((item) => !item.isRead).length;

  const chartDataByPeriod = useMemo(() => {
    const monthsToShow = periodRange === "1m" ? 1 : 2;
    return statisticsChartData.slice(-monthsToShow);
  }, [periodRange]);

  const selectedMonths = useMemo(() => {
    return new Set(chartDataByPeriod.map((item) => item.month));
  }, [chartDataByPeriod]);

  const filteredPublications = useMemo(() => {
    const byPeriod = publicationRows.filter((row) => selectedMonths.has(row.month));

    if (!normalizedQuery) {
      return byPeriod;
    }

    return byPeriod.filter((row) =>
      `${row.title} ${row.journal} ${row.year} ${row.status} ${row.month}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, selectedMonths]);

  const filteredConferences = useMemo(() => {
    const byPeriod = conferenceRows.filter((row) => selectedMonths.has(row.month));

    if (!normalizedQuery) {
      return byPeriod;
    }

    return byPeriod.filter((row) =>
      `${row.event} ${row.location} ${row.date} ${row.status} ${row.month}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, selectedMonths]);

  const filteredReimbursements = useMemo(() => {
    const byPeriod = reimbursementRows.filter((row) => selectedMonths.has(row.month));

    if (!normalizedQuery) {
      return byPeriod;
    }

    return byPeriod.filter((row) =>
      `${row.request} ${row.amount} ${row.submitted} ${row.status} ${row.month}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, selectedMonths]);

  const filteredStatisticsChartData = useMemo(() => {
    if (!normalizedQuery) {
      return chartDataByPeriod;
    }

    return chartDataByPeriod.filter((row) =>
      `${row.month} ${row.publikime} ${row.citime} ${row.konferenca}`.toLowerCase().includes(normalizedQuery)
    );
  }, [chartDataByPeriod, normalizedQuery]);

  const filteredStatisticsRows = useMemo(() => {
    if (!normalizedQuery) {
      return statisticsRows;
    }

    return statisticsRows.filter((row) => `${row.label} ${row.value}`.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery]);

  const handleMenuAction = (action) => {
    const normalizedAction = String(action || "").trim().toLowerCase();

    if (normalizedAction === "logout") {
      handleLogout();
      return;
    }

    if (normalizedAction === "editprofile" || normalizedAction === "edit-profile") {
      setProfileDraft(profile);
      setIsEditProfileOpen(true);
      return;
    }

    if (normalizedAction === "orcidconnect" || normalizedAction === "orcid-connect") {
      window.location.href = `https://www.umibres.page/api/orcid/connect?userId=${profile.id}`;
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

  const handleProfileSave = (event) => {
    event.preventDefault();
    setProfile(profileDraft);
    setIsEditProfileOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    sessionStorage.removeItem("authToken");
    navigate("/", { replace: true });
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const markNotificationAsRead = (id) => {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
  };

  const renderStatus = (value) => {
    const statusClass = value.toLowerCase().replace(/\s+/g, "-");

    return <span className={`status-badge ${statusClass}`}>{value}</span>;
  };

  const integrationIcons = {
    Connected: CheckCircle2,
    "Not connected": ShieldX,
    Pending: RefreshCw,
  };

  const integrationTones = {
    Connected: "connected",
    "Not connected": "not-connected",
    Pending: "pending",
  };

  const renderOverview = () => {
    const quickStats = [
      {
        label: "Publikime aktive",
        value: publicationRows.length,
        change: "+2 kete semester",
        icon: <BookOpen size={22} />,
      },
      {
        label: "Konferenca te planifikuara",
        value: conferenceRows.length,
        change: "1 afat brenda 7 ditesh",
        icon: <CalendarDays size={22} />,
      },
      {
        label: "Rimbursime ne proces",
        value: reimbursementRows.filter((row) => row.status === "Ne proces").length,
        change: "2 kerkesa ne shqyrtim",
        icon: <Wallet size={22} />,
      },
      {
        label: "Integrime aktive",
        value: integrations.filter((item) => item.status === "Connected").length,
        change: "Crossref ne pritje",
        icon: <Link2 size={22} />,
      },
    ];

    const quickActions = [
      { title: "Regjistro publikim", icon: <BookOpen size={20} /> },
      { title: "Dergo kerkese rimbursimi", icon: <Wallet size={20} /> },
      { title: "Planifiko konference", icon: <CalendarDays size={20} /> },
      { title: "Perditeso profilin", icon: <Settings size={20} /> },
    ];

    const timelineItems = [
      {
        id: "pub",
        icon: <CheckCircle2 size={20} />,
        title: "Publikimi u aprovua",
        description: publicationRows[0]?.title || "Publikim i ri",
        time: "Sot",
      },
      {
        id: "conf",
        icon: <Clock3 size={20} />,
        title: "Konference ne shqyrtim",
        description: conferenceRows[1]?.event || "Konference e re",
        time: "Dje",
      },
      {
        id: "refund",
        icon: <Wallet size={20} />,
        title: "Kerkese rimbursimi",
        description: reimbursementRows[0]?.request || "Kerkese financiare",
        time: "2 dite me pare",
      },
    ];

    return (
      <>
        <section className="prof-hero">
          <div>
            <span className="prof-badge">Academic Research Workflow</span>
            <h2>Pershendetje {professorProfile.name}</h2>
            <p>
              Ke nje pasqyre te unifikuar per publikimet, konferencat, rimbursimet dhe
              integrimet akademike ne nje vend.
            </p>
          </div>
          <div className="prof-hero-actions">
            <button className="primary-btn" type="button" onClick={() => setActivePage("Publikime")}>
              Menaxho publikimet
            </button>
            <button className="secondary-btn" type="button" onClick={() => setActivePage("Statistika")}>
              Shiko statistikat
            </button>
          </div>
        </section>

        <section>
          <h3 className="prof-section-title">Pamje e shpejte</h3>
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
                <h3>Aktivitetet e fundit</h3>
                <p>Levizjet kryesore nga publikimet, konferencat dhe financat.</p>
              </div>
            </div>
            <div className="prof-list">
              {timelineItems.map((item) => (
                <div className="prof-list-item" key={item.id}>
                  <div className="prof-list-icon">{item.icon}</div>
                  <div className="prof-list-content">
                    <h4>{item.title}</h4>
                    <p>{item.description}</p>
                  </div>
                  <span className="prof-list-time">{item.time}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="prof-card">
            <div className="prof-card-header">
              <div>
                <h3>Veprime te shpejta</h3>
                <p>Aksione te perdorura shpesh.</p>
              </div>
            </div>
            <div className="prof-quick-grid">
              {quickActions.map((item) => (
                <button
                  key={item.title}
                  className="prof-quick-item"
                  type="button"
                  onClick={() => setActivePage(item.title.includes("publikim") ? "Publikime" : "Settings")}
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

  const renderListSection = (title, description, rows, rowKey, formatter) => (
    <article className="prof-card">
      <div className="prof-card-header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="prof-list">
        {rows.map((row) => (
          <div className="prof-list-item" key={row[rowKey]}>
            <div className="prof-list-icon">{formatter.icon}</div>
            <div className="prof-list-content">
              <h4>{formatter.title(row)}</h4>
              <p>{formatter.description(row)}</p>
            </div>
            <div>{renderStatus(formatter.status(row))}</div>
          </div>
        ))}
      </div>
    </article>
  );

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
                    Shkruani DOI e publikimit dhe sistemi do të marrë automatikisht
                    metadata si titulli, autorët, journal/conference, viti dhe të dhëna të tjera.
                  </p>
                </div>
              </div>

              <DoiLookup />
            </article>

            {renderListSection(
              "Publikime",
              "Regjistri i publikimeve me statusin aktual.",
              filteredPublications,
              "title",
              {
                icon: <BookOpen size={20} />,
                title: (row) => row.title,
                description: (row) => `${row.journal} • ${row.year}`,
                status: (row) => row.status,
              }
            )}
          </>
        );

      case "Konferenca":
        return (
          <>
            <article className="prof-card" style={{ marginBottom: "20px" }}>
              <div className="prof-card-header">
                <div>
                  <h3>Shto dhe Menaxho Konferenca</h3>
                  <p>
                    Regjistro konferenca, afate submissions dhe menaxho
                    pjesëmarrjet shkencore.
                  </p>
                </div>
              </div>

              <ConferenceManager />
            </article>
          </>
        );

      case "Rimbursime":
        return (
          <>
            {renderListSection(
              "Rimbursime",
              "Kerkesat financiare me statusin e perpunimit.",
              filteredReimbursements,
              "request",
              {
                icon: <Wallet size={20} />,
                title: (row) => row.request,
                description: (row) => `${row.amount} • Dorezuar: ${row.submitted}`,
                status: (row) => row.status,
              }
            )}
          </>
        );

      case "Statistika":
        return (
          <article className="prof-card">
            <div className="prof-card-header">
              <div>
                <h3>Statistika akademike</h3>
                <p>Ecuria mujore e publikimeve, citimeve dhe konferencave.</p>
              </div>
              <div className="prof-filter-wrap">
                <label htmlFor="prof-period-filter">Periudha</label>
                <select
                  id="prof-period-filter"
                  className="prof-filter-select"
                  value={periodRange}
                  onChange={(event) => setPeriodRange(event.target.value)}
                >
                  <option value="1m">1 muaj</option>
                  <option value="2m">2 muaj</option>
                </select>
              </div>
            </div>
            <div style={{ width: "100%", height: 248 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredStatisticsChartData} barGap={10}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8e0ea" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="publikime" name="Publikime" radius={[8, 8, 0, 0]} fill="#153a63" />
                  <Bar dataKey="citime" name="Citime" radius={[8, 8, 0, 0]} fill="#2e6aa6" />
                  <Bar dataKey="konferenca" name="Konferenca" radius={[8, 8, 0, 0]} fill="#7aa7d3" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        );

      case "Integrime":
        return (
          <article className="prof-card">
            <div className="prof-integration-header">
              <div>
                <h3>Integrime</h3>
                <p>Sherbimet e jashtme te lidhura.</p>
              </div>
              <button type="button" className="prof-integration-manage-btn" onClick={() => setActivePage("Settings")}>
                Menaxho
              </button>
            </div>
            <div className="prof-integration-list">
              {integrations.map((item) => (
                <article className="prof-integration-item" key={item.provider}>
                  <div className={`prof-integration-mark ${integrationTones[item.status]}`}>
                    {React.createElement(integrationIcons[item.status] || CheckCircle2, { size: 22 })}
                  </div>
                  <div className="prof-integration-copy">
                    <h4>{item.provider}</h4>
                    <p>{item.description}</p>
                  </div>
                  {renderStatus(item.status)}
                </article>
              ))}
            </div>
          </article>
        );

      case "Njoftime":
        return (
          <article className="prof-card">
            <div className="prof-card-header">
              <div>
                <h3>Njoftime</h3>
                <p>Perditesimet me te rendesishme per afatet dhe dokumentet.</p>
              </div>
              <button
                type="button"
                className="prof-integration-manage-btn"
                onClick={markAllNotificationsAsRead}
                disabled={unreadNotifications === 0}
              >
                Sheno te gjitha si te lexuara
              </button>
            </div>
            <div className="prof-notification-list">
              {notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`prof-notification-item ${item.isRead ? "neutral" : "info"}`}
                  onClick={() => markNotificationAsRead(item.id)}
                >
                  <div className="prof-notification-item-head">
                    <span className="prof-notification-pill">{item.category || "Njoftim"}</span>
                    <span>{item.createdAt}</span>
                  </div>
                  <h4>{item.title || item.text}</h4>
                  <p>{item.description || item.text}</p>
                </button>
              ))}
            </div>
          </article>
        );

      case "Settings":
        return (
          <div className="prorector-table-section">
            <h2>Settings</h2>
            <p>Konfigurimet kryesore për profilin dhe panelin kërkimor.</p>

            <div className="prorector-settings-grid">
              {/* Card: Informacionet e Profilit */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <Settings size={20} />
                  </div>
                  <h3>Informacionet e Profilit</h3>
                </div>
                <div className="prorector-settings-list">
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">Emri i plotë</span>
                    <strong className="prorector-settings-value">{profile.name}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">Titulli Akademik</span>
                    <strong className="prorector-settings-value">{profile.role}</strong>
                  </div>
                  <div className="prorector-settings-item">
                    <span className="prorector-settings-label">Adresa Email</span>
                    <strong className="prorector-settings-value">{profile.email}</strong>
                  </div>
                  <button className="prorector-settings-edit-btn" onClick={() => handleMenuAction("EditProfile")}>
                    Ndrysho të dhënat
                  </button>
                </div>
              </article>

              {/* Card: Preferencat e Sistemit */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <BookOpen size={20} />
                  </div>
                  <h3>Preferencat e Sistemit</h3>
                </div>
                <div className="prorector-settings-options">
                  <div className="prorector-settings-option-item">
                    <div className="prorector-settings-option-info">
                      <span className="prorector-settings-label">Njoftime me email</span>
                      <p className="prorector-settings-subtext">Merr njoftime për çdo publikim ose rimbursim</p>
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
                </div>
              </article>

              {/* Card: Siguria */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <ShieldX size={20} />
                  </div>
                  <h3>Siguria & Llogaria</h3>
                </div>
                <div className="prorector-settings-list">
                  <p className="prorector-settings-subtext">Menaxho sigurinë e dritares tuaj kërkimore.</p>
                  <button className="prorector-settings-action-btn">
                    Ndrysho fjalëkalimin
                  </button>
                </div>
              </article>

              {/* Card: API & Integrimet */}
              <article className="prorector-settings-card">
                <div className="prorector-settings-card-header">
                  <div className="prorector-settings-icon">
                    <Link2 size={20} />
                  </div>
                  <h3>API & Integrimet</h3>
                </div>
                <div className="prorector-settings-list">
                  <p className="prorector-settings-subtext">Lidh profilin tuaj me platformat ndërkombëtare.</p>
                  <a
                    className="prorector-settings-action-btn"
                    href="https://www.umibres.page/api/orcid/connect?userId=5bf8c645-3aba-4bfa-897e-e935d04664a1"
                  >
                    Connect with ORCID
                  </a>
                  <button className="prorector-settings-action-btn" onClick={() => setActivePage("Integrime")}>
                    Shiko Integrimet
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
          menuItems={profileMenuItems}
          notificationCount={unreadNotifications}
          onMenuAction={handleMenuAction}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          notifications={notifications}
          onMarkAllRead={markAllNotificationsAsRead}
          onNotificationAction={markNotificationAsRead}
        />

        <div className="prof-content">{renderContent()}</div>
      </div>

      {isEditProfileOpen ? (
        <div className="prof-modal-overlay" role="dialog" aria-modal="true">
          <div className="prof-modal">
            <div className="prof-modal-header">
              <div>
                <h3 className="prof-modal-title">Edit Profile</h3>
                <p className="prof-modal-subtitle">Përditësoni të dhënat bazë të profilit.</p>
              </div>
              <button
                className="prof-modal-close"
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                aria-label="Mbyll"
              >
                ×
              </button>
            </div>
            <form className="prof-modal-form" onSubmit={handleProfileSave}>
              <div className="prof-form-grid">
                <label className="prof-form-field">
                  <span>Emri dhe mbiemri</span>
                  <input value={profileDraft.name} onChange={handleProfileFieldChange("name")} />
                </label>
                <label className="prof-form-field">
                  <span>Roli</span>
                  <input value={profileDraft.role} onChange={handleProfileFieldChange("role")} />
                </label>
                <label className="prof-form-field">
                  <span>Email</span>
                  <input type="email" value={profileDraft.email} onChange={handleProfileFieldChange("email")} />
                </label>
                <label className="prof-form-field">
                  <span>Fakulteti</span>
                  <input value={profileDraft.faculty} onChange={handleProfileFieldChange("faculty")} />
                </label>
                <label className="prof-form-field">
                  <span>Departamenti</span>
                  <input value={profileDraft.department} onChange={handleProfileFieldChange("department")} />
                </label>
                <label className="prof-form-field">
                  <span>Zyra</span>
                  <input value={profileDraft.office} onChange={handleProfileFieldChange("office")} />
                </label>
              </div>
              <div className="prof-modal-actions">
                <button type="button" className="prof-btn-secondary" onClick={() => setIsEditProfileOpen(false)}>
                  Anulo
                </button>
                <button type="submit" className="prof-btn-primary">
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
