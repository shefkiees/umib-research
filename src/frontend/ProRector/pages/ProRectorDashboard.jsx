import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpenCheck,
  Building2,
  CheckCircle2,
  CircleUserRound,
  Layers3,
  Link2,
  ReceiptText,
  RefreshCw,
  Settings,
  ShieldX,
  UsersRound,
} from "lucide-react";
import "../styles/ProRectorDashboard.css";
import ProRectorSidebar from "../components/Sidebar";
import ProRectorTopBar from "../components/TopBar";
import ReimbursementReviewPanel from "../../common/ReimbursementReviewPanel";
import { apiUrl } from "../../utils/api";

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

  const normalizedQuery = searchQuery.trim().toLowerCase();

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
      const nextRow = {
        ...row,
        ...presentation,
        activeUserCount: toNumber(row.activeUserCount),
        departmentCount: toNumber(row.departmentCount),
        publicationCount: toNumber(row.publicationCount),
        reimbursementCount: toNumber(row.reimbursementCount),
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
        isOfficial: existing.isOfficial || nextRow.isOfficial,
      });
    });

    return Array.from(groupedRows.values()).sort((first, second) => {
      const secondTotal = second.publicationCount + second.reimbursementCount + second.activeUserCount;
      const firstTotal = first.publicationCount + first.reimbursementCount + first.activeUserCount;

      return secondTotal - firstTotal || first.name.localeCompare(second.name, "sq");
    });
  }, [filteredFacultyStats]);

  const facultyOverview = useMemo(() => {
    const totals = facultyDashboardRows.reduce(
      (totals, row) => ({
        facultyCount: totals.facultyCount + 1,
        activeUserCount: totals.activeUserCount + row.activeUserCount,
        departmentCount: totals.departmentCount + row.departmentCount,
        publicationCount: totals.publicationCount + row.publicationCount,
        reimbursementCount: totals.reimbursementCount + row.reimbursementCount,
      }),
      { facultyCount: 0, activeUserCount: 0, departmentCount: 0, publicationCount: 0, reimbursementCount: 0 }
    );

    const activityCount = totals.publicationCount + totals.reimbursementCount;
    const averageActivity = totals.facultyCount > 0 ? Math.round(activityCount / totals.facultyCount) : 0;

    return {
      ...totals,
      activityCount,
      averageActivity,
    };
  }, [facultyDashboardRows]);

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

  const renderContent = () => {
    if (activePage === "Fakultetet") {
      return (
        <div className="prorector-table-section prorector-faculties-section">
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
          <div className="prorector-overview-grid">
            <article className="prorector-overview-card is-blue">
              <Building2 size={20} />
              <span>Fakultete</span>
              <strong>{facultyOverview.facultyCount}</strong>
            </article>
            <article className="prorector-overview-card is-gold">
              <UsersRound size={20} />
              <span>Staf aktiv</span>
              <strong>{facultyOverview.activeUserCount}</strong>
            </article>
            <article className="prorector-overview-card is-green">
              <BookOpenCheck size={20} />
              <span>Publikime</span>
              <strong>{facultyOverview.publicationCount}</strong>
            </article>
            <article className="prorector-overview-card is-rose">
              <ReceiptText size={20} />
              <span>Rimbursime</span>
              <strong>{facultyOverview.reimbursementCount}</strong>
            </article>
          </div>

          <div className="prorector-insight-strip">
            <article>
              <span>Aktivitet total</span>
              <strong>{facultyOverview.activityCount}</strong>
              <p>Publikime dhe rimbursime gjithsej</p>
            </article>
            <article>
              <span>Departamente</span>
              <strong>{facultyOverview.departmentCount}</strong>
              <p>Struktura akademike aktive</p>
            </article>
            <article>
              <span>Mesatare / fakultet</span>
              <strong>{facultyOverview.averageActivity}</strong>
              <p>Aktivitet akademik i shpërndarë</p>
            </article>
          </div>

          {facultyStatsLoading ? (
            <div className="prorector-faculty-empty">Duke i ngarkuar fakultetet aktive...</div>
          ) : null}

          {!facultyStatsLoading && facultyDashboardRows.length > 0 ? (
            <div className="prorector-faculty-grid">
              {facultyDashboardRows.map((row) => (
                <article className="prorector-faculty-card" key={row.id || row.code || row.name}>
                  <div className="prorector-faculty-card-head">
                    <span className="prorector-faculty-avatar">
                      <Building2 size={22} />
                    </span>
                    <div>
                      <h3>{row.name}</h3>
                      <div className="prorector-faculty-meta">
                        {row.code ? <span>{row.code}</span> : null}
                        <span>{row.isOfficial ? "Zyrtar" : "Nga profilet"}</span>
                      </div>
                    </div>
                    <span className="status-badge status-aprovuar">
                      {row.statusLabel || "Aktiv"}
                    </span>
                  </div>

                  <div className="prorector-faculty-metrics">
                    <div className="is-staff">
                      <UsersRound size={17} />
                      <span>Staf</span>
                      <strong>{row.activeUserCount}</strong>
                    </div>
                    <div className="is-departments">
                      <Layers3 size={17} />
                      <span>Depart.</span>
                      <strong>{row.departmentCount}</strong>
                    </div>
                    <div className="is-publications">
                      <BookOpenCheck size={17} />
                      <span>Publ.</span>
                      <strong>{row.publicationCount}</strong>
                    </div>
                    <div className="is-reimbursements">
                      <ReceiptText size={17} />
                      <span>Rimb.</span>
                      <strong>{row.reimbursementCount}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {!facultyStatsLoading && facultyDashboardRows.length === 0 ? (
            <div className="prorector-faculty-empty">Nuk u gjet asnjë fakultet aktiv për këtë kërkim.</div>
          ) : null}
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
              <th>PUBLIKIME</th>
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
