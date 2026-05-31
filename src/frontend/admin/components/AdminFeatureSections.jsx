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

const COLORS = ["#1f5f99", "#2e7d32", "#c9a24f", "#b91c1c", "#6d5bd0", "#00838f"];

const tooltipFormatter = (value, name) => [value, name === "count" ? "Numri" : name];

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
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

export function AdminNotificationsSection() {
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
  };

  const markAllRead = async () => {
    await requestJson("/admin/notifications/read-all", { method: "PATCH" });
    await load();
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
  const normalized = status === "Aktiv" || status === "Online" ? "ok" : status === "Problem" ? "problem" : "empty";
  return <span className={`admin-status-badge admin-status-badge--${normalized}`}>{status || "Nuk ka të dhëna"}</span>;
}

function StatusGridSection({ title, description, path, itemsKey, emptyText }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    requestJson(path)
      .then((payload) => {
        setItems(Array.isArray(payload[itemsKey]) ? payload[itemsKey] : []);
        setError("");
      })
      .catch((err) => {
        setItems([]);
        setError(err.message || "Të dhënat nuk u ngarkuan.");
      });
  }, [itemsKey, path]);

  return (
    <section className="admin-page-card admin-feature-section">
      <div className="admin-page-head">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      {error ? <p className="admin-inline-error">{error}</p> : null}
      <div className="admin-status-grid">
        {items.map((item) => (
          <article className="admin-status-card" key={item.id || item.name}>
            <div className="admin-status-card-head">
              <h4>{item.name}</h4>
              <StatusBadge status={item.status} />
            </div>
            <p>{item.description}</p>
            <small>Kontrolli i fundit: {item.checkedAt ? formatDate(item.checkedAt) : "Nuk ka të dhëna"}</small>
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
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => { requestJson("/admin/settings").then((data) => setSettings(data.settings)).catch((err) => setMessage(err.message)); }, []);

  if (!settings) return <section className="admin-page-card admin-feature-section"><EmptyState text="Konfigurimet po ngarkohen." /></section>;

  const setValue = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));
  const setReimbursementLimit = (quartile, value) =>
    setSettings((prev) => ({
      ...prev,
      reimbursementLimits: {
        ...(prev.reimbursementLimits || {}),
        [quartile]: value,
      },
    }));
  const save = async () => {
    const data = await requestJson("/admin/settings", { method: "PATCH", body: JSON.stringify(settings) });
    setSettings(data.settings);
    setMessage("Konfigurimet u ruajtën.");
  };

  return (
    <section className="admin-page-card admin-feature-section">
      <div className="admin-page-head"><h3>Konfigurimet</h3></div>
      {message ? <p className="admin-feature-message">{message}</p> : null}
      <div className="admin-feature-form admin-settings-form">
        <label>Ditët e shqyrtimit SLA<input type="number" value={settings.reviewSlaDays} onChange={(e) => setValue("reviewSlaDays", Number(e.target.value))} /></label>
        <label>Madhësia maksimale e ngarkimit<input type="number" value={settings.maxUploadMb} onChange={(e) => setValue("maxUploadMb", Number(e.target.value))} /></label>
        <label>Gjuha e parazgjedhur<input value={settings.defaultLanguage} onChange={(e) => setValue("defaultLanguage", e.target.value)} /></label>
        <label>Llojet e lejuara të fajllave<input value={(settings.allowedFileTypes || []).join(", ")} onChange={(e) => setValue("allowedFileTypes", e.target.value.split(",").map((item) => item.trim()))} /></label>
        {["Q1", "Q2", "Q3", "Q4"].map((quartile) => (
          <label key={quartile}>
            Shuma maksimale për rimbursim {quartile}
            <input
              type="number"
              value={settings.reimbursementLimits?.[quartile] ?? 0}
              onChange={(e) => setReimbursementLimit(quartile, Number(e.target.value))}
            />
          </label>
        ))}
        <label><input type="checkbox" checked={settings.notificationsEnabled} onChange={(e) => setValue("notificationsEnabled", e.target.checked)} /> Njoftimet</label>
        <label><input type="checkbox" checked={settings.maintenanceMode} onChange={(e) => setValue("maintenanceMode", e.target.checked)} /> Modaliteti i mirëmbajtjes</label>
      </div>
      <button className="admin-small-btn" type="button" onClick={save}>Ruaj</button>
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
