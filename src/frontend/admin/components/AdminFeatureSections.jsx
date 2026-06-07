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

const hasReadableCategoryName = (value) => {
  const label = String(value || "").trim();
  if (!label) return false;
  if (/^pa\s+/i.test(label)) return true;

  const lettersOnly = label.replace(/[^a-zA-ZÀ-ž]/g, "");
  const hasVowel = /[aeiouyëAEIOUYË]/.test(lettersOnly);
  const hasEnoughShape = label.length >= 3 && /[a-zA-ZÀ-ž]/.test(label);

  return hasEnoughShape && hasVowel;
};

const normalizeInstitutionRows = (items, key, fallbackLabel, unclearLabel) => {
  const grouped = new Map();

  normalizeAnalyticsRows(items, key, fallbackLabel).forEach((item) => {
    const label = hasReadableCategoryName(item.label) ? item.label : unclearLabel;
    grouped.set(label, (grouped.get(label) || 0) + item.count);
  });

  return Array.from(grouped, ([label, count]) => ({ label, count }))
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, "sq-AL"));
};

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

function CategoryTooltip({ active, payload, label, singularLabel }) {
  if (!active || !payload?.length) return null;

  const count = Number(payload[0]?.value || 0);

  return (
    <div className="admin-category-tooltip">
      <strong>{label}</strong>
      <span>{count} {singularLabel}</span>
    </div>
  );
}

function RolePieLabel({ cx, cy, midAngle, outerRadius, value, fill }) {
  const connectorStartRadius = outerRadius + 4;
  const connectorEndRadius = outerRadius + 22;
  const labelRadius = outerRadius + 32;
  const angle = -midAngle * (Math.PI / 180);
  const startX = cx + connectorStartRadius * Math.cos(angle);
  const startY = cy + connectorStartRadius * Math.sin(angle);
  const endX = cx + connectorEndRadius * Math.cos(angle);
  const endY = cy + connectorEndRadius * Math.sin(angle);
  const textX = cx + labelRadius * Math.cos(angle);
  const textY = cy + labelRadius * Math.sin(angle);
  const textAnchor = textX > cx ? "start" : "end";

  return (
    <g>
      <path d={`M${startX},${startY}L${endX},${endY}`} stroke={fill} strokeWidth={1.5} fill="none" />
      <text
        x={textX}
        y={textY}
        fill={fill}
        textAnchor={textAnchor}
        dominantBaseline="central"
        fontSize={13}
        fontWeight={800}
      >
        {value}
      </text>
    </g>
  );
}

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
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


export function AdminNotificationsSection({ onNotificationsChange } = {}) {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await requestJson("/admin/notifications");
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setError("");
    } catch (err) {
      setError(err.message || t("admin.notificationsPage.loadError"));
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
          <h3>{t("admin.notificationsPage.title")}</h3>
        </div>
        <button type="button" className="admin-roles-config-button" onClick={markAllRead}>
          {t("admin.notificationsPage.markAllRead")}
        </button>
      </div>
      <div className="admin-segmented">
        <button className={filter === "all" ? "is-active" : ""} type="button" onClick={() => setFilter("all")}>{t("admin.notificationsPage.all")}</button>
        <button className={filter === "unread" ? "is-active" : ""} type="button" onClick={() => setFilter("unread")}>{t("admin.notificationsPage.unread")}</button>
        <button className={filter === "read" ? "is-active" : ""} type="button" onClick={() => setFilter("read")}>{t("admin.notificationsPage.read")}</button>
      </div>
      {error ? <p className="admin-inline-error">{error}</p> : null}
      <div className="admin-notification-list">
        {visible.map((item) => (
          <article key={item.id} className={`admin-notification-card${item.isRead ? " is-read" : ""}`}>
            <div>
              <span>{item.category || t("admin.notificationsPage.system")}</span>
              <h4>{item.title}</h4>
              <p>{item.message}</p>
              <small>{formatDate(item.createdAt)}</small>
            </div>
            {!item.isRead && item.source !== "audit" ? (
              <button type="button" className="admin-small-btn" onClick={() => markRead(item)}>{t("admin.notificationsPage.markRead")}</button>
            ) : null}
          </article>
        ))}
      </div>
      {visible.length === 0 ? <EmptyState text={t("admin.notificationsPage.empty")} /> : null}
    </section>
  );
}

export function AdminAnalyticsSection() {
  const { language, t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    requestJson("/admin/analytics")
      .then((payload) => {
        setData(payload);
        setError("");
      })
      .catch((err) => setError(err.message || t("admin.analytics.loadError")));
  }, [t]);

  const roleLabels = {
    admin: t("admin.users.roles.admin"),
    committee: t("admin.users.roles.committee"),
    professor: t("admin.users.roles.professor"),
    prorector: t("admin.users.roles.prorector"),
  };
  const summary = data?.userSummary || { total: 0, active: 0, inactive: 0, suspended: 0 };
  const access = data?.accessAttempts || { total: 0, unauthenticated: 0, forbidden: 0 };
  const usersByRole = (data?.usersByRole || []).map((item) => ({ ...item, role: roleLabels[item.role] || item.role || "Pa rol" }));
  const usersByFaculty = normalizeInstitutionRows(data?.usersByFaculty, "faculty", "Pa fakultet", "Fakultet i paqartë");
  const usersByDepartment = normalizeInstitutionRows(data?.usersByDepartment, "department", "Pa departament", "Departament i paqartë");
  const adminActivity = normalizeAnalyticsRows(data?.adminActivity, "adminName", "Admin")
    .map((item) => ({ ...item, label: formatPersonName(item.label) }));

  return (
    <section className="admin-page-card admin-feature-section">
      <div className="admin-page-head">
        <div>
          <h3>{t("admin.analytics.title")}</h3>
        </div>
      </div>
      {error ? <p className="admin-inline-error">{error}</p> : null}

      <div className="admin-feature-cards admin-operational-stats">
        <article><span>{t("admin.analytics.totalUsers")}</span><strong>{summary.total}</strong></article>
        <article><span>{t("admin.analytics.activeUsers")}</span><strong>{summary.active}</strong></article>
        <article><span>{t("admin.analytics.inactiveUsers")}</span><strong>{summary.inactive}</strong></article>
        <article><span>{t("admin.analytics.suspendedUsers")}</span><strong>{summary.suspended}</strong></article>
        <article><span>{t("admin.analytics.unauthorizedAttempts")}</span><strong>{access.total}</strong><p>{t("admin.analytics.unauthenticated")}: {access.unauthenticated} • {t("admin.analytics.forbidden")}: {access.forbidden}</p></article>
      </div>

      <div className="admin-analytics-grid">
        <ChartCard title={t("admin.analytics.usersByRole")}>
          <ResponsiveContainer width="100%" height={270}>
            <PieChart margin={{ top: 30, right: 58, bottom: 10, left: 58 }}>
              <Pie
                data={usersByRole}
                dataKey="count"
                nameKey="role"
                outerRadius={68}
                labelLine={false}
                label={RolePieLabel}
              >
                {usersByRole.map((entry, index) => <Cell key={entry.role} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={tooltipFormatter} /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title={t("admin.analytics.usersByFaculty")}
          description={t("admin.analytics.usersByFacultyDescription")}
          className="admin-chart-card--clean admin-faculty-card"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={usersByFaculty} margin={{ top: 12, right: 12, bottom: 4, left: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="#edf2f7" strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12, fontWeight: 700 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip cursor={{ fill: "rgba(31, 95, 153, 0.07)" }} content={<CategoryTooltip singularLabel={t("admin.analytics.users").toLocaleLowerCase(language === "en" ? "en-US" : "sq-AL")} />} />
              <Bar name={t("admin.analytics.users")} dataKey="count" fill="#1f5f99" radius={[8, 8, 0, 0]} maxBarSize={44} className="admin-category-bar" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t("admin.analytics.usersByDepartment")}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={usersByDepartment}>
              <XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip formatter={tooltipFormatter} /><Legend />
              <Bar name={t("admin.analytics.users")} dataKey="count" fill="#2e7d32" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title={t("admin.analytics.mostActiveUsers")}
          description={t("admin.analytics.mostActiveUsersDescription")}
          className="admin-chart-card--premium admin-activity-card"
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={adminActivity} margin={{ top: 12, right: 12, bottom: 4, left: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="#eef2f7" strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12, fontWeight: 700 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip cursor={{ fill: "rgba(201, 162, 79, 0.08)" }} content={<ActivityTooltip />} />
              <Bar name={t("admin.analytics.actions")} dataKey="count" fill="#b88a2d" radius={[8, 8, 0, 0]} maxBarSize={44} className="admin-activity-bar" />
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

export function AdminSettingsSection() {
  const { language, setLanguage, t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
          setError(err.message || t("admin.settings.loadError"));
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [t]);

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
        {error ? <p className="admin-inline-error">{error}</p> : <EmptyState text={t("admin.settings.loading")} />}
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
      setMessage(t("admin.settings.profileSaved"));
    } catch (err) {
      setError(err.message || t("admin.settings.profileSaveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const updateLanguage = (value) => {
    setLanguage(value);
  };

  return (
    <section className="admin-page-card admin-feature-section admin-settings-page">
      <div className="admin-page-head">
        <div>
          <h3>{t("admin.settings.title")}</h3>
        </div>
      </div>
      {message ? <p className="admin-feature-message admin-settings-message" role="status">{message}</p> : null}
      {error ? <p className="admin-inline-error">{error}</p> : null}

      <div className="admin-settings-grid">
        <article className="admin-settings-card">
          <h4>{t("admin.settings.profileTitle")}</h4>
          <div className="admin-settings-list">
            <div>
              <span>{t("admin.settings.fullName")}</span>
              {isEditing ? <input value={draft.name} onChange={setDraftValue("name")} /> : <strong>{profile.name || "-"}</strong>}
            </div>
            <div>
              <span>{t("admin.settings.academicTitle")}</span>
              {isEditing ? <input value={draft.academicTitle} onChange={setDraftValue("academicTitle")} /> : <strong>{profile.academicTitle || profile.role || "-"}</strong>}
            </div>
            <div>
              <span>{t("admin.settings.email")}</span>
              <strong>{profile.email || "-"}</strong>
            </div>
            <div>
              <span>{t("admin.settings.orcidId")}</span>
              <strong>{profile.orcidId || t("admin.settings.notConnected")}</strong>
            </div>
            <div>
              <span>{t("admin.settings.orcidSchool")}</span>
              <strong>{profile.school || t("admin.settings.noPublicData")}</strong>
            </div>
            <div>
              <span>{t("admin.settings.orcidAffiliation")}</span>
              <strong>{profile.currentAffiliation || t("admin.settings.noPublicData")}</strong>
            </div>
            {isEditing ? (
              <>
                <div>
                  <span>{t("admin.settings.faculty")}</span>
                  <input value={draft.faculty} onChange={setDraftValue("faculty")} />
                </div>
                <div>
                  <span>{t("admin.settings.department")}</span>
                  <input value={draft.department} onChange={setDraftValue("department")} />
                </div>
                <div>
                  <span>{t("admin.settings.office")}</span>
                  <input value={draft.office} onChange={setDraftValue("office")} />
                </div>
                <div>
                  <span>{t("admin.settings.scientificTitle")}</span>
                  <input value={draft.scientificTitle} onChange={setDraftValue("scientificTitle")} />
                </div>
              </>
            ) : null}
          </div>
          <div className="admin-settings-actions">
            {isEditing ? (
              <>
                <button className="admin-small-btn" type="button" onClick={() => { setDraft(profile); setIsEditing(false); }} disabled={isSaving}>{t("admin.settings.cancel")}</button>
                <button className="admin-primary-btn" type="button" onClick={saveProfile} disabled={isSaving}>
                  {isSaving ? t("admin.settings.saving") : t("admin.settings.saveData")}
                </button>
              </>
            ) : (
              <button className="admin-small-btn" type="button" onClick={() => setIsEditing(true)}>{t("admin.settings.editProfile")}</button>
            )}
          </div>
        </article>

        <article className="admin-settings-card admin-settings-card--preferences">
          <div className="admin-settings-card-head">
            <h4>{t("admin.settings.preferencesTitle")}</h4>
            <span>{t("admin.settings.currentLanguage")}: {t(`admin.settings.languages.${language}`)}</span>
          </div>
          <div className="admin-settings-options">
            <div className="admin-settings-option admin-settings-option--language">
              <div className="admin-settings-option-copy">
                <span>{t("admin.settings.languageLabel")}</span>
                <p>{t("admin.settings.languageDescription")}</p>
              </div>
              <select value={language} onChange={(event) => updateLanguage(event.target.value)} aria-label={t("admin.settings.languageLabel")}>
                <option value="sq">{t("admin.settings.languages.sq")}</option>
                <option value="en">{t("admin.settings.languages.en")}</option>
              </select>
            </div>
          </div>
        </article>

      </div>
    </section>
  );
}
