import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiUrl } from "../../utils/api";
import { useLanguage } from "../../i18n/LanguageContext";

const COLORS = ["#1f5f99", "#2e7d32", "#c9a24f", "#b91c1c", "#6d5bd0", "#00838f"];

const tooltipFormatter = (value, name) => [value, name === "count" ? "Numri" : name];

const normalizeAnalyticsRows = (items, key, fallbackLabel) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      ...item,
      label: String(item?.[key] || fallbackLabel).trim() || fallbackLabel,
      count: Number(item?.count || 0),
    }))
    .filter((item) => item.count > 0);

const formatPersonName = (value) => {
  const rawValue = String(value || "").trim();
  const rawName = rawValue.includes("@") ? rawValue.split("@")[0] : rawValue;
  if (!rawName) return "Admin";

  return rawName
    .replace(/[._]+/g, " ")
    .split(/\s+/)
    .map((part) =>
      part
        .split("-")
        .map((segment) => (
          segment ? `${segment.charAt(0).toLocaleUpperCase("sq-AL")}${segment.slice(1).toLocaleLowerCase("sq-AL")}` : segment
        ))
        .join("-")
    )
    .join(" ");
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}, ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

async function requestJson(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Kërkesa nuk u krye.");
  return data;
}

function EmptyState({ text = "Nuk ka të dhëna për t'u shfaqur." }) {
  return <p className="admin-empty">{text}</p>;
}

const pickFirstText = (...values) =>
  values.find((value) => typeof value === "string" && value.trim())?.trim() || "";

const pickOrcidTitle = (items = []) => {
  const firstItem = Array.isArray(items) ? items.find(Boolean) : null;
  if (!firstItem) return "";
  return pickFirstText(firstItem.roleTitle, firstItem.title, firstItem.position, firstItem.department);
};

const normalizeSettingsProfile = (user = {}) => {
  const orcidEducations = Array.isArray(user.orcidEducations) ? user.orcidEducations : [];
  const orcidEmployments = Array.isArray(user.orcidEmployments) ? user.orcidEmployments : [];

  return {
    name: user.name || user.displayName || user.full_name || user.email || "",
    email: user.email || "",
    role: user.role || "",
    academicTitle: user.academicTitle || user.academic_title || user.role || pickOrcidTitle(orcidEmployments),
    scientificTitle: user.scientificTitle || user.scientific_title || pickOrcidTitle(orcidEducations),
    faculty: user.faculty || "",
    department: user.department || "",
    office: user.office || "",
    orcidId: user.orcidId || user.orcid_id || "",
    school: user.school || "",
    currentAffiliation: user.currentAffiliation || "",
  };
};

const ADMIN_SETTINGS_TEXT = {
  sq: {
    title: "Cilësimet",
    description: "Konfigurimet kryesore për profilin dhe panelin kërkimor.",
    loading: "Cilësimet po ngarkohen.",
    loadError: "Cilësimet nuk u ngarkuan.",
    profileTitle: "Informacionet e Profilit",
    fullName: "Emri i plotë",
    academicTitle: "Thirrja akademike",
    email: "Adresa Email",
    orcidId: "ORCID iD",
    orcidSchool: "Shkolla nga ORCID",
    orcidAffiliation: "Affiliation nga ORCID",
    notConnected: "Nuk është lidhur",
    noPublicData: "Nuk ka të dhëna publike",
    faculty: "Fakulteti",
    department: "Departamenti",
    office: "Zyra",
    scientificTitle: "Thirrja shkencore",
    editProfile: "Ndrysho të dhënat",
    cancel: "Anulo",
    saveData: "Ruaj të dhënat",
    saving: "Duke ruajtur...",
    profileSaved: "Të dhënat u ruajtën.",
    profileSaveError: "Të dhënat nuk u ruajtën.",
    preferencesTitle: "Preferencat e Sistemit",
    emailNotifications: "Njoftime me email",
    emailDescription: "Merr njoftime për çdo publikim ose rimbursim",
    active: "Aktive",
    inactive: "Joaktive",
    savingPreference: "Duke ruajtur...",
    languageLabel: "Gjuha e ndërfaqes",
    languageDescription: "Zgjidh gjuhën e shfaqjes për dashboard-in.",
    languageHint: "Ndryshimi ruhet automatikisht dhe zbatohet në këtë dashboard.",
    currentLanguage: "Gjuha aktive",
    albanian: "Shqip",
    english: "Anglisht",
    preferencesSaved: "Preferencat u ruajtën.",
    preferencesSaveError: "Preferencat nuk u ruajtën.",
  },
  en: {
    title: "Settings",
    description: "Main preferences for the profile and research dashboard.",
    loading: "Settings are loading.",
    loadError: "Settings could not be loaded.",
    profileTitle: "Profile Information",
    fullName: "Full name",
    academicTitle: "Academic title",
    email: "Email address",
    orcidId: "ORCID iD",
    orcidSchool: "School from ORCID",
    orcidAffiliation: "Affiliation from ORCID",
    notConnected: "Not connected",
    noPublicData: "No public data",
    faculty: "Faculty",
    department: "Department",
    office: "Office",
    scientificTitle: "Scientific title",
    editProfile: "Edit details",
    cancel: "Cancel",
    saveData: "Save details",
    saving: "Saving...",
    profileSaved: "Details were saved.",
    profileSaveError: "Details could not be saved.",
    preferencesTitle: "System Preferences",
    emailNotifications: "Email notifications",
    emailDescription: "Receive notifications for every publication or reimbursement",
    active: "Active",
    inactive: "Inactive",
    savingPreference: "Saving...",
    languageLabel: "Interface language",
    languageDescription: "Choose the display language for the dashboard.",
    languageHint: "The change is saved automatically and applied to this dashboard.",
    currentLanguage: "Active language",
    albanian: "Albanian",
    english: "English",
    preferencesSaved: "Preferences were saved.",
    preferencesSaveError: "Preferences could not be saved.",
  },
};

export function AdminNotificationsSection({ onNotificationsChange } = {}) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await requestJson("/admin/notifications");
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setError("");
    } catch (err) {
      setError(err.message || "Njoftimet nuk u ngarkuan.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = items.filter((item) => {
    if (filter === "unread") return !item.isRead;
    if (filter === "read") return item.isRead;
    return true;
  });

  const markRead = async (item) => {
    if (item.source === "audit") return;
    await requestJson(`/admin/notifications/${item.id}/read`, { method: "PATCH" });
    await load();
    onNotificationsChange?.();
  };

  const markAllRead = async () => {
    await requestJson("/admin/notifications/read-all", { method: "PATCH" });
    await load();
    onNotificationsChange?.();
  };

  return (
    <section className="admin-page-card admin-feature-section">
      <div className="admin-page-head">
        <div>
          <h3>Njoftimet</h3>
        </div>
        <button type="button" className="admin-roles-config-button" onClick={markAllRead}>
          Shëno të gjitha si të lexuara
        </button>
      </div>
      <div className="admin-segmented">
        <button className={filter === "all" ? "is-active" : ""} type="button" onClick={() => setFilter("all")}>Të gjitha</button>
        <button className={filter === "unread" ? "is-active" : ""} type="button" onClick={() => setFilter("unread")}>Të palexuara</button>
        <button className={filter === "read" ? "is-active" : ""} type="button" onClick={() => setFilter("read")}>Të lexuara</button>
      </div>
      {error ? <p className="admin-inline-error">{error}</p> : null}
      <div className="admin-notification-list">
        {visible.map((item) => (
          <article key={item.id} className={`admin-notification-card${item.isRead ? " is-read" : ""}`}>
            <div>
              <span>{item.category || "Sistemi"}</span>
              <h4>{item.title}</h4>
              <p>{item.message}</p>
              <small>{formatDate(item.createdAt)}</small>
            </div>
            {!item.isRead && item.source !== "audit" ? (
              <button type="button" className="admin-small-btn" onClick={() => markRead(item)}>Shëno si të lexuar</button>
            ) : null}
          </article>
        ))}
      </div>
      {visible.length === 0 ? <EmptyState text="Nuk ka njoftime për filtrin aktual." /> : null}
    </section>
  );
}

export function AdminAnalyticsSection() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    requestJson("/admin/analytics")
      .then((payload) => {
        setData(payload);
        setError("");
      })
      .catch((err) => setError(err.message || "Statistikat nuk u ngarkuan."));
  }, []);

  const roleLabels = {
    admin: "Admin",
    committee: "Komisioni",
    professor: "Profesor",
    prorector: "Prorektor",
  };
  const summary = data?.userSummary || { total: 0, active: 0, inactive: 0, suspended: 0 };
  const access = data?.accessAttempts || { total: 0, unauthenticated: 0, forbidden: 0 };
  const usersByRole = (data?.usersByRole || []).map((item) => ({ ...item, role: roleLabels[item.role] || item.role || "Pa rol" }));
  const usersByFaculty = normalizeAnalyticsRows(data?.usersByFaculty, "faculty", "Pa fakultet");
  const usersByDepartment = normalizeAnalyticsRows(data?.usersByDepartment, "department", "Pa departament");
  const adminActivity = normalizeAnalyticsRows(data?.adminActivity, "adminName", "Admin")
    .map((item) => ({ ...item, label: formatPersonName(item.label) }));

  return (
    <section className="admin-page-card admin-feature-section">
      <div className="admin-page-head">
        <div>
          <h3>Statistikat</h3>
        </div>
      </div>
      {error ? <p className="admin-inline-error">{error}</p> : null}

      <div className="admin-feature-cards admin-operational-stats">
        <article><span>Përdorues gjithsej</span><strong>{summary.total}</strong></article>
        <article><span>Përdorues aktivë</span><strong>{summary.active}</strong></article>
        <article><span>Përdorues joaktivë</span><strong>{summary.inactive}</strong></article>
        <article><span>Të pezulluar</span><strong>{summary.suspended}</strong></article>
        <article><span>Tentime pa leje</span><strong>{access.total}</strong><p>Pa kyçje: {access.unauthenticated} • Pa rol: {access.forbidden}</p></article>
      </div>

      <div className="admin-analytics-grid">
        <ChartCard title="Përdoruesit sipas rolit">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={usersByRole} dataKey="count" nameKey="role" outerRadius={82} label>
                {usersByRole.map((entry, index) => <Cell key={entry.role} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={tooltipFormatter} /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Përdoruesit sipas fakultetit">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={usersByFaculty}>
              <XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip formatter={tooltipFormatter} /><Legend />
              <Bar name="Përdorues" dataKey="count" fill="#1f5f99" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Përdoruesit sipas departamentit">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={usersByDepartment}>
              <XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip formatter={tooltipFormatter} /><Legend />
              <Bar name="Përdorues" dataKey="count" fill="#2e7d32" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Përdoruesit më aktivë"
          description="Bazuar në aktivitetin administrativ të 30 ditëve të fundit"
          className="admin-chart-card--premium admin-activity-card"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={adminActivity} margin={{ top: 12, right: 12, bottom: 4, left: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="#eef2f7" strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12, fontWeight: 700 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip cursor={{ fill: "rgba(201, 162, 79, 0.08)" }} content={<ActivityTooltip />} />
              <Bar name="Veprime" dataKey="count" fill="#b88a2d" radius={[8, 8, 0, 0]} maxBarSize={44} className="admin-activity-bar" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  );
}

function ChartCard({ title, description, className = "", children }) {
  return (
    <article className={`admin-chart-card${className ? ` ${className}` : ""}`}>
      <h4>{title}</h4>
      {description ? <p className="admin-chart-description">{description}</p> : null}
      {children}
    </article>
  );
}

function ActivityTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const count = Number(payload[0]?.value || 0);

  return (
    <div className="admin-activity-tooltip">
      <strong>{formatPersonName(label)}</strong>
      <span>{count} veprime administrative</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized =
    status === "Aktiv" || status === "Online"
      ? "ok"
      : status === "Problem"
        ? "problem"
        : status === "Paralajmërim"
          ? "warning"
          : "empty";
  return <span className={`admin-status-badge admin-status-badge--${normalized}`}>{status || "Nuk ka të dhëna"}</span>;
}

function getOverallSystemStatus(items) {
  if (items.some((item) => item.status === "Problem")) return "Ka probleme teknike";
  if (items.some((item) => item.status === "Nuk ka të dhëna" || item.status === "Paralajmërim")) return "Ka shërbime pa të dhëna";
  return "Sistemi është stabil";
}

function StatusGridSection({ title, description, path, itemsKey, emptyText, showOverall = false, canRefresh = false }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const load = () => {
    setIsLoading(true);
    return requestJson(path)
      .then((payload) => {
        setItems(Array.isArray(payload[itemsKey]) ? payload[itemsKey] : []);
        setError("");
      })
      .catch((err) => {
        setItems([]);
        setError(err.message || "Të dhënat nuk u ngarkuan.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, [itemsKey, path]);

  const overallStatus = getOverallSystemStatus(items);

  return (
    <section className="admin-page-card admin-feature-section">
      <div className="admin-page-head">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {canRefresh ? (
          <button type="button" className="admin-roles-config-button" onClick={load} disabled={isLoading}>
            {isLoading ? "Duke rifreskuar..." : "Rifresko kontrollin"}
          </button>
        ) : null}
      </div>
      {error ? <p className="admin-inline-error">{error}</p> : null}
      {showOverall ? (
        <div className="admin-system-overview">
          <span>Statusi i përgjithshëm</span>
          <strong>{isLoading ? "Duke kontrolluar..." : overallStatus}</strong>
        </div>
      ) : null}
      <div className="admin-status-grid">
        {items.map((item) => (
          <article className="admin-status-card" key={item.id || item.name}>
            <div className="admin-status-card-head">
              <h4>{item.name}</h4>
              <StatusBadge status={item.status} />
            </div>
            <p>{item.description}</p>
            <small>Kontrolli i fundit: {item.checkedAt ? formatDateTime(item.checkedAt) : "Nuk ka të dhëna"}</small>
            <small>Koha e përgjigjes: {Number.isFinite(item.responseTimeMs) ? `${item.responseTimeMs} ms` : "Nuk ka të dhëna"}</small>
            {Array.isArray(item.errors) && item.errors.length ? (
              <div className="admin-status-errors">
                {item.errors.slice(0, 5).map((entry, index) => (
                  <div key={`${entry.message || "gabim"}-${index}`}>
                    <span>{entry.createdAt ? formatDateTime(entry.createdAt) : "-"}</span>
                    <strong>{entry.message || "Gabim i panjohur"}</strong>
                    <small>{entry.endpoint || "-"}</small>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {items.length === 0 ? <EmptyState text={emptyText} /> : null}
    </section>
  );
}

export function AdminIntegrationsSection() {
  return (
    <StatusGridSection
      title="Integrimet"
      description="Monitoro lidhjet me shërbimet e jashtme akademike dhe institucionale."
      path="/admin/integrations/status"
      itemsKey="integrations"
      emptyText="Nuk ka të dhëna për integrimet."
    />
  );
}

export function AdminSettingsSection() {
  const { language, setLanguage } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const text = ADMIN_SETTINGS_TEXT[language] || ADMIN_SETTINGS_TEXT.sq;

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const profileData = await requestJson("/auth/me");
        const nextProfile = normalizeSettingsProfile(profileData.user || {});

        if (isMounted) {
          setProfile(nextProfile);
          setDraft(nextProfile);
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || text.loadError);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!message) return undefined;

    const timeoutId = window.setTimeout(() => {
      setMessage("");
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  if (!profile || !draft) {
    return (
      <section className="admin-page-card admin-feature-section">
        {error ? <p className="admin-inline-error">{error}</p> : <EmptyState text={text.loading} />}
      </section>
    );
  }

  const setDraftValue = (field) => (event) => {
    setDraft((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const saveProfile = async () => {
    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const data = await requestJson("/auth/me", {
        method: "PUT",
        body: JSON.stringify({
          name: draft.name,
          faculty: draft.faculty,
          department: draft.department,
          office: draft.office,
          academicTitle: draft.academicTitle,
          scientificTitle: draft.scientificTitle,
        }),
      });
      const nextProfile = normalizeSettingsProfile(data.user || {});
      setProfile(nextProfile);
      setDraft(nextProfile);
      setIsEditing(false);
      setMessage(text.profileSaved);
    } catch (err) {
      setError(err.message || text.profileSaveError);
    } finally {
      setIsSaving(false);
    }
  };

  const updateLanguage = (value) => {
    setLanguage(value);
    setMessage((ADMIN_SETTINGS_TEXT[value] || ADMIN_SETTINGS_TEXT.sq).preferencesSaved);
  };

  return (
    <section className="admin-page-card admin-feature-section admin-settings-page">
      <div className="admin-page-head">
        <div>
          <h3>{text.title}</h3>
        </div>
      </div>
      {message ? <p className="admin-feature-message admin-settings-message" role="status">{message}</p> : null}
      {error ? <p className="admin-inline-error">{error}</p> : null}

      <div className="admin-settings-grid">
        <article className="admin-settings-card">
          <h4>{text.profileTitle}</h4>
          <div className="admin-settings-list">
            <div>
              <span>{text.fullName}</span>
              {isEditing ? <input value={draft.name} onChange={setDraftValue("name")} /> : <strong>{profile.name || "-"}</strong>}
            </div>
            <div>
              <span>{text.academicTitle}</span>
              {isEditing ? <input value={draft.academicTitle} onChange={setDraftValue("academicTitle")} /> : <strong>{profile.academicTitle || profile.role || "-"}</strong>}
            </div>
            <div>
              <span>{text.email}</span>
              <strong>{profile.email || "-"}</strong>
            </div>
            <div>
              <span>{text.orcidId}</span>
              <strong>{profile.orcidId || text.notConnected}</strong>
            </div>
            <div>
              <span>{text.orcidSchool}</span>
              <strong>{profile.school || text.noPublicData}</strong>
            </div>
            <div>
              <span>{text.orcidAffiliation}</span>
              <strong>{profile.currentAffiliation || text.noPublicData}</strong>
            </div>
            {isEditing ? (
              <>
                <div>
                  <span>{text.faculty}</span>
                  <input value={draft.faculty} onChange={setDraftValue("faculty")} />
                </div>
                <div>
                  <span>{text.department}</span>
                  <input value={draft.department} onChange={setDraftValue("department")} />
                </div>
                <div>
                  <span>{text.office}</span>
                  <input value={draft.office} onChange={setDraftValue("office")} />
                </div>
                <div>
                  <span>{text.scientificTitle}</span>
                  <input value={draft.scientificTitle} onChange={setDraftValue("scientificTitle")} />
                </div>
              </>
            ) : null}
          </div>
          <div className="admin-settings-actions">
            {isEditing ? (
              <>
                <button className="admin-small-btn" type="button" onClick={() => { setDraft(profile); setIsEditing(false); }} disabled={isSaving}>{text.cancel}</button>
                <button className="admin-primary-btn" type="button" onClick={saveProfile} disabled={isSaving}>
                  {isSaving ? text.saving : text.saveData}
                </button>
              </>
            ) : (
              <button className="admin-small-btn" type="button" onClick={() => setIsEditing(true)}>{text.editProfile}</button>
            )}
          </div>
        </article>

        <article className="admin-settings-card admin-settings-card--preferences">
          <div className="admin-settings-card-head">
            <h4>{text.preferencesTitle}</h4>
            <span>{text.currentLanguage}: {language === "en" ? text.english : text.albanian}</span>
          </div>
          <div className="admin-settings-options">
            <div className="admin-settings-option admin-settings-option--language">
              <div className="admin-settings-option-copy">
                <span>{text.languageLabel}</span>
                <p>{text.languageDescription}</p>
                <small>{text.languageHint}</small>
              </div>
              <select value={language} onChange={(event) => updateLanguage(event.target.value)} aria-label={text.languageLabel}>
                <option value="sq">{text.albanian}</option>
                <option value="en">{text.english}</option>
              </select>
            </div>
          </div>
        </article>

      </div>
    </section>
  );
}
