import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
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

const formatEuro = (value) =>
  new Intl.NumberFormat("sq-AL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value || 0));

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
  const usersByFaculty = data?.usersByFaculty || [];
  const usersByDepartment = data?.usersByDepartment || [];
  const adminActivity = data?.adminActivity || [];

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
        <ChartCard title="Përdorues sipas rolit">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={usersByRole} dataKey="count" nameKey="role" outerRadius={82} label>
                {usersByRole.map((entry, index) => <Cell key={entry.role} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={tooltipFormatter} /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Përdorues sipas fakultetit">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={usersByFaculty}>
              <XAxis dataKey="faculty" /><YAxis allowDecimals={false} /><Tooltip formatter={tooltipFormatter} /><Legend />
              <Bar name="Përdorues" dataKey="count" fill="#1f5f99" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Përdorues sipas departamentit">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={usersByDepartment}>
              <XAxis dataKey="department" /><YAxis allowDecimals={false} /><Tooltip formatter={tooltipFormatter} /><Legend />
              <Bar name="Përdorues" dataKey="count" fill="#2e7d32" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Aktiviteti">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={adminActivity}>
              <XAxis dataKey="adminName" /><YAxis allowDecimals={false} /><Tooltip formatter={tooltipFormatter} /><Legend />
              <Bar name="Veprime" dataKey="count" fill="#c9a24f" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  );
}

function ChartCard({ title, children }) {
  return <article className="admin-chart-card"><h4>{title}</h4>{children}</article>;
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

export function AdminSystemStatusSection() {
  return (
    <StatusGridSection
      title="Gjendja e sistemit"
      description="Shiko statusin teknik të shërbimeve kryesore të platformës."
      path="/admin/system-status"
      itemsKey="services"
      emptyText="Nuk ka të dhëna për gjendjen e sistemit."
      showOverall
      canRefresh
    />
  );
}

export function AdminJournalsSection() {
  const emptyForm = { issn: "", name: "", publisher: "", quartile: "", wosCategory: "", ceeol: false, isPredatory: false };
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [search, setSearch] = useState("");
  const [csv, setCsv] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const data = await requestJson(`/admin/journals${search ? `?search=${encodeURIComponent(search)}` : ""}`);
    setItems(Array.isArray(data.journals) ? data.journals : []);
  };

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, [search]);

  const save = async () => {
    const path = editingId ? `/admin/journals/${editingId}` : "/admin/journals";
    const method = editingId ? "PATCH" : "POST";
    await requestJson(path, { method, body: JSON.stringify(form) });
    setForm(emptyForm);
    setEditingId("");
    setMessage("Revista u ruajt me sukses.");
    await load();
  };

  const remove = async (id) => {
    await requestJson(`/admin/journals/${id}`, { method: "DELETE" });
    await load();
  };

  const importCsv = async () => {
    const data = await requestJson("/admin/journals/import", { method: "POST", body: JSON.stringify({ csv }) });
    setMessage(`${data.imported || 0} revista u importuan.`);
    setCsv("");
    await load();
  };

  return (
    <section className="admin-page-card admin-feature-section">
      <div className="admin-page-head"><h3>Revistat</h3></div>
      {message ? <p className="admin-feature-message">{message}</p> : null}
      <div className="admin-feature-form">
        <input placeholder="ISSN" value={form.issn} onChange={(e) => setForm({ ...form, issn: e.target.value })} />
        <input placeholder="Emri i revistës" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Botuesi" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} />
        <input placeholder="Kuartili" value={form.quartile} onChange={(e) => setForm({ ...form, quartile: e.target.value })} />
        <input placeholder="Kategoria WoS" value={form.wosCategory} onChange={(e) => setForm({ ...form, wosCategory: e.target.value })} />
        <label><input type="checkbox" checked={form.ceeol} onChange={(e) => setForm({ ...form, ceeol: e.target.checked })} /> CEEOL</label>
        <label><input type="checkbox" checked={form.isPredatory} onChange={(e) => setForm({ ...form, isPredatory: e.target.checked })} /> Revistë predatore</label>
        <button className="admin-small-btn" type="button" onClick={save}>Ruaj</button>
      </div>
      <div className="admin-feature-toolbar">
        <input placeholder="Kërko revistë" value={search} onChange={(e) => setSearch(e.target.value)} />
        <textarea placeholder="Importo CSV: ISSN, Emri, Botuesi, Kuartili, Kategoria WoS, CEEOL, Predatore" value={csv} onChange={(e) => setCsv(e.target.value)} />
        <button className="admin-small-btn" type="button" onClick={importCsv}>Importo CSV</button>
      </div>
      <DataTable columns={["ISSN", "Emri i revistës", "Botuesi", "Kuartili", "Kategoria WoS", "CEEOL", "Revistë predatore", "Veprimet"]}>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.issn || "-"}</td><td>{item.name}</td><td>{item.publisher || "-"}</td><td>{item.quartile || "-"}</td><td>{item.wosCategory || "-"}</td><td>{item.ceeol ? "Po" : "Jo"}</td><td>{item.isPredatory ? "Po" : "Jo"}</td>
            <td><div className="admin-actions-row"><button className="admin-small-btn" type="button" onClick={() => { setForm(item); setEditingId(item.id); }}>Ndrysho</button><button className="admin-small-btn danger" type="button" onClick={() => remove(item.id)}>Fshij</button></div></td>
          </tr>
        ))}
      </DataTable>
      {items.length === 0 ? <EmptyState text="Nuk ka revista të regjistruara." /> : null}
    </section>
  );
}

export function AdminPublicationReviewSection() {
  const [items, setItems] = useState([]);
  const [commentById, setCommentById] = useState({});
  const [message, setMessage] = useState("");

  const load = async () => {
    const data = await requestJson("/admin/publication-review");
    setItems(Array.isArray(data.publications) ? data.publications : []);
  };

  useEffect(() => { load().catch((err) => setMessage(err.message)); }, []);

  const act = async (id, action) => {
    await requestJson(`/admin/publication-review/${id}`, { method: "PATCH", body: JSON.stringify({ action, comment: commentById[id] || "" }) });
    setMessage("Publikimi u përditësua.");
    await load();
  };

  return (
    <section className="admin-page-card admin-feature-section">
      <div className="admin-page-head"><h3>Shqyrtimi i publikimeve</h3></div>
      {message ? <p className="admin-feature-message">{message}</p> : null}
      <DataTable columns={["Publikimi", "Autori", "Lloji", "Statusi", "Koment", "Veprimet"]}>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.title}</td><td>{item.author || "-"}</td><td>{item.type || "-"}</td><td>{item.statusLabel}</td>
            <td><input placeholder="Shto koment" value={commentById[item.id] || ""} onChange={(e) => setCommentById({ ...commentById, [item.id]: e.target.value })} /></td>
            <td><div className="admin-actions-row"><button className="admin-small-btn" type="button" onClick={() => act(item.id, "approve")}>Aprovo</button><button className="admin-small-btn danger" type="button" onClick={() => act(item.id, "reject")}>Refuzo</button><button className="admin-small-btn" type="button" onClick={() => act(item.id, "request_changes")}>Kthe për përmirësim</button>{item.documentUrl ? <a className="admin-small-btn" href={item.documentUrl} target="_blank" rel="noreferrer">Shiko dokumentin</a> : null}</div></td>
          </tr>
        ))}
      </DataTable>
      {items.length === 0 ? <EmptyState text="Nuk ka publikime për shqyrtim." /> : null}
    </section>
  );
}

export function AdminReportsSection() {
  const [data, setData] = useState({ reports: [] });

  useEffect(() => { requestJson("/admin/reports").then(setData).catch(() => setData({ reports: [] })); }, []);

  return (
    <section className="admin-page-card admin-feature-section">
      <div className="admin-page-head"><h3>Raportet</h3></div>
      <div className="admin-feature-filters">
        <input placeholder="Fakulteti" /><input placeholder="Departamenti" /><input placeholder="Periudha" /><input placeholder="Lloji i publikimit" /><input placeholder="Kuartili" />
      </div>
      <div className="admin-feature-cards">
        {(data.reports || []).map((report) => <article key={report.id}><span>{report.title}</span><strong>{report.amount ? formatEuro(report.amount) : report.count}</strong></article>)}
      </div>
      <div className="admin-actions-row admin-feature-actions">
        <a className="admin-small-btn" href={apiUrl("/admin/reports/export?format=pdf")}>Eksporto PDF</a>
        <a className="admin-small-btn" href={apiUrl("/admin/reports/export?format=excel")}>Eksporto Excel</a>
      </div>
    </section>
  );
}

export function AdminBudgetSection() {
  const [budget, setBudget] = useState({ total: 0, committed: 0, spent: 0, remaining: 0, warnings: [75, 90, 100] });

  useEffect(() => { requestJson("/admin/budget").then(setBudget).catch(() => {}); }, []);

  return (
    <section className="admin-page-card admin-feature-section">
      <div className="admin-page-head"><h3>Buxheti</h3></div>
      <div className="admin-feature-cards">
        <article><span>Buxheti total</span><strong>{formatEuro(budget.total)}</strong></article>
        <article><span>I zotuar</span><strong>{formatEuro(budget.committed)}</strong></article>
        <article><span>I shpenzuar</span><strong>{formatEuro(budget.spent)}</strong></article>
        <article><span>I mbetur</span><strong>{formatEuro(budget.remaining)}</strong></article>
      </div>
      <div className="admin-budget-warnings">
        {(budget.warnings || []).map((warning) => <span key={warning}>Paralajmërim buxheti {warning}%</span>)}
      </div>
    </section>
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
          <p>{text.description}</p>
        </div>
      </div>
      {message ? <p className="admin-feature-message">{message}</p> : null}
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

        <article className="admin-settings-card">
          <h4>{text.preferencesTitle}</h4>
          <div className="admin-settings-options">
            <div className="admin-settings-option admin-settings-option--stacked">
              <div>
                <span>{text.languageLabel}</span>
                <p>{text.languageDescription}</p>
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
function DataTable({ columns, children }) {
  return (
    <div className="admin-table-wrap admin-feature-table-wrap">
      <table className="admin-table admin-feature-table">
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
