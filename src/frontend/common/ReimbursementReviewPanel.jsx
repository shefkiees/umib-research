import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Loader2, RotateCcw, Search, Wallet, XCircle } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiUrl } from "../utils/api";
import "./ReimbursementReviewPanel.css";

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Dorezuar",
  received: "Pranuar",
  in_review: "Ne shqyrtim",
  needs_correction: "Kthyer per korrigjim",
  committee_approved: "Aprovuar nga komisioni",
  approved: "Aprovuar",
  rejected: "Refuzuar",
  paid: "Paguar",
};

const REVIEW_STATUS_FILTERS = [
  { value: "all", label: "Të gjitha" },
  { value: "received", label: "Të pranuara" },
  { value: "in_review", label: "Në shqyrtim" },
  { value: "needs_correction", label: "Korrigjim" },
  { value: "committee_approved", label: "Aprovim" },
  { value: "rejected", label: "Refuzim" },
];

const REVIEW_FORM_FILTERS = [
  { value: "all", label: "Të gjitha" },
  { value: "publication", label: "Artikuj Shkencorë" },
  { value: "conference", label: "Konferenca dhe simpoziume" },
  { value: "project", label: "Projekte shkencore" },
];
const REVIEW_CHART_COLORS = ["#1688f0", "#153a63", "#c9a24f", "#15803d", "#be123c", "#7c3aed"];

function normalizeDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("sq-AL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatAmount(request) {
  if (request.amount === null || request.amount === undefined || request.amount === "") {
    return "Pa shume";
  }

  return `${request.amount} ${request.currency || "EUR"}`;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value, currency = "EUR") {
  return new Intl.NumberFormat("sq-AL", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getRequestSearchText(request = {}) {
  const data = request.requestData || {};

  return normalizeSearchText([
    request.documentNumber,
    request.id,
    request.title,
    request.requestTypeLabel,
    request.status,
    request.statusLabel,
    request.owner?.name,
    request.owner?.email,
    request.owner?.faculty,
    request.owner?.department,
    request.requestType,
    data.requestType,
    data.doi,
    data.publicationLink,
    data.publicationTitle,
    data.articleTitle,
    data.paperTitle,
    data.abstractTitle,
    data.conferenceName,
    data.journalName,
    data.publishedIn,
    data.coauthors,
    data.coParticipant,
  ].filter(Boolean).join(" "));
}

function groupRequests(requests, getKey, getLabel) {
  const counts = new Map();

  requests.forEach((request) => {
    const key = getKey(request) || "unknown";
    const existing = counts.get(key) || {
      key,
      label: getLabel(request, key),
      count: 0,
      amount: 0,
    };

    existing.count += 1;
    existing.amount += toNumber(request.amount);
    counts.set(key, existing);
  });

  return Array.from(counts.values()).sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, "sq"));
}

function getRequestYear(request = {}) {
  const dateValue = request.submittedAt || request.createdAt || request.updatedAt;
  const date = dateValue ? new Date(dateValue) : null;
  return date && !Number.isNaN(date.getTime()) ? String(date.getFullYear()) : "-";
}

function getActions(role, status, canApprove = true) {
  if (role === "committee") {
    return [
      { status: "received", label: "Prano", icon: CheckCircle2 },
      { status: "in_review", label: "Ne shqyrtim", icon: Search },
      { status: "needs_correction", label: "Korrigjim", icon: RotateCcw, requiresNote: true },
      ...(canApprove && (status === "submitted" || status === "in_review")
        ? [{ status: "committee_approved", label: "Aprovo", icon: CheckCircle2 }]
        : []),
      { status: "rejected", label: "Refuzo", icon: XCircle, requiresNote: true, tone: "danger" },
    ].filter((item) => item.status !== status);
  }

  if (role === "prorector" && status === "approved") {
    return [{ status: "paid", label: "Paguar", icon: CheckCircle2 }];
  }

  if (role === "prorector") {
    return [
      { status: "approved", label: "Aprovo final", icon: CheckCircle2 },
      { status: "rejected", label: "Refuzo final", icon: XCircle, requiresNote: true, tone: "danger" },
    ];
  }

  return [];
}

function getSuccessMessage(status) {
  if (status === "approved") {
    return "Kerkesa u aprovua nga komisioni.";
  }

  if (status === "committee_approved") {
    return "Kërkesa u aprovua nga Komisioni dhe u largua nga lista e shqyrtimit.";
  }

  if (status === "rejected") {
    return "Kërkesa u refuzua nga Komisioni dhe u largua nga lista e shqyrtimit.";
  }

  return `Statusi u ndryshua ne ${STATUS_LABELS[status] || status}.`;
}

export default function ReimbursementReviewPanel({
  role,
  scope,
  searchQuery = "",
  title = "Rimbursime",
  description = "Kerkesat akademike per shqyrtim institucional.",
  showReviewFilters = false,
  showAnalytics = true,
  showActions = true,
  canApprove = true,
  onStatusUpdated,
}) {
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [notes, setNotes] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [formFilter, setFormFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState("");
  const [downloadingKey, setDownloadingKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const normalizedQuery = normalizeSearchText(searchQuery.trim());

  const visibleRequests = useMemo(() => {
    return requests.filter((request) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const requestType = request.requestType || request.requestData?.requestType || "";
      const matchesForm = formFilter === "all" || requestType === formFilter;
      const matchesQuery = !normalizedQuery || getRequestSearchText(request).includes(normalizedQuery);

      return matchesStatus && matchesForm && matchesQuery;
    });
  }, [formFilter, normalizedQuery, requests, statusFilter]);

  const dashboardStats = useMemo(() => {
    const sourceStats = stats || {};
    const fallback = requests.reduce(
      (totals, request) => {
        totals.total += 1;
        totals.pending += ["submitted", "received", "in_review", "needs_correction", "committee_approved"].includes(request.status) ? 1 : 0;
        totals.approved += ["committee_approved", "approved", "paid"].includes(request.status) ? 1 : 0;
        totals.rejected += request.status === "rejected" ? 1 : 0;
        totals.paid += request.status === "paid" ? 1 : 0;
        totals.totalAmount += toNumber(request.amount);
        totals.approvedAmount += ["committee_approved", "approved", "paid"].includes(request.status) ? toNumber(request.amount) : 0;
        totals.paidAmount += request.status === "paid" ? toNumber(request.amount) : 0;
        return totals;
      },
      { total: 0, pending: 0, approved: 0, rejected: 0, paid: 0, totalAmount: 0, approvedAmount: 0, paidAmount: 0 }
    );

    return {
      total: toNumber(sourceStats.total ?? fallback.total),
      pending: toNumber(sourceStats.pending ?? fallback.pending),
      approved: toNumber(sourceStats.approved ?? fallback.approved),
      rejected: toNumber(sourceStats.rejected ?? fallback.rejected),
      paid: toNumber(sourceStats.paid ?? fallback.paid),
      totalAmount: toNumber(sourceStats.total_amount ?? sourceStats.totalAmount ?? fallback.totalAmount),
      approvedAmount: toNumber(sourceStats.approved_amount ?? sourceStats.approvedAmount ?? fallback.approvedAmount),
      paidAmount: toNumber(sourceStats.paid_amount ?? sourceStats.paidAmount ?? fallback.paidAmount),
    };
  }, [requests, stats]);

  const statusBreakdown = useMemo(
    () => groupRequests(
      requests,
      (request) => request.status,
      (request, key) => request.statusLabel || STATUS_LABELS[key] || key
    ),
    [requests]
  );

  const formBreakdown = useMemo(
    () => groupRequests(
      requests,
      (request) => request.requestType || request.requestData?.requestType,
      (request, key) => request.requestTypeLabel || key || "Pa kategori"
    ),
    [requests]
  );

  const reimbursementsByYear = useMemo(
    () => groupRequests(requests, getRequestYear, (request, key) => key).map((row) => ({ ...row, reimbursements: row.count })).sort((first, second) => String(first.key).localeCompare(String(second.key))),
    [requests]
  );

  const reimbursementsByFaculty = useMemo(
    () => groupRequests(
      requests,
      (request) => request.owner?.faculty || "Pa fakultet",
      (request, key) => key
    ).slice(0, 8),
    [requests]
  );

  const latestRequests = useMemo(
    () => [...requests]
      .sort((first, second) => String(second.submittedAt || second.createdAt || "").localeCompare(String(first.submittedAt || first.createdAt || "")))
      .slice(0, 5),
    [requests]
  );

  const loadData = async () => {
    setIsLoading(true);
    setError("");

    try {
      const [listResponse, statsResponse] = await Promise.all([
        fetch(apiUrl(`/reimbursements?scope=${scope}`), { credentials: "include" }),
        fetch(apiUrl(`/reimbursements/stats/summary?scope=${scope}`), { credentials: "include" }),
      ]);

      if (listResponse.status === 401 || statsResponse.status === 401) {
        throw new Error("Sesioni nuk eshte aktiv.");
      }

      if (!listResponse.ok || !statsResponse.ok) {
        throw new Error("Rimbursimet nuk u ngarkuan nga databaza.");
      }

      const [listData, statsData] = await Promise.all([listResponse.json(), statsResponse.json()]);
      setRequests(Array.isArray(listData) ? listData : []);
      setStats(statsData.data || null);
    } catch (loadError) {
      setError(loadError.message || "Nuk u ngarkuan rimbursimet.");
      setRequests([]);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [scope]);

  const handleNoteChange = (requestId) => (event) => {
    setNotes((prev) => ({ ...prev, [requestId]: event.target.value }));
  };

  const updateStatus = async (request, action) => {
    const note = String(notes[request.id] || "").trim();

    if (action.requiresNote && !note) {
      setError("Komenti institucional është obligativ për këtë veprim.");
      return;
    }

    const key = `${request.id}-${action.status}`;
    setUpdatingKey(key);
    setError("");
    setMessage("");

    try {
      const response = await fetch(apiUrl(`/reimbursements/${request.id}/status`), {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: action.status,
          note,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Statusi nuk u perditesua.");
      }

      const updatedRequest = result.data || { ...request, status: action.status };
      setRequests((prev) => prev.map((item) => (item.id === updatedRequest.id ? updatedRequest : item)));
      onStatusUpdated?.(updatedRequest);
      setNotes((prev) => ({ ...prev, [request.id]: "" }));
      await loadData();

      if (action.status === "committee_approved" && result.email?.error) {
        setMessage("");
        setError("Statusi u aprovua, por emaili njoftues nuk u dergua.");
        return;
      }

      setError("");
      setMessage(
        result.email?.error
          ? `${getSuccessMessage(updatedRequest.status)} Emaili njoftues nuk u dërgua.`
          : getSuccessMessage(updatedRequest.status)
      );
    } catch (updateError) {
      setError(updateError.message || "Ndodhi nje gabim gjate ndryshimit te statusit.");
    } finally {
      setUpdatingKey("");
    }
  };

  const downloadFile = async (url, fallbackName, key) => {
    setDownloadingKey(key);
    setError("");

    try {
      const response = await fetch(apiUrl(url.replace(/^\/api/, "")), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Dokumenti nuk u shkarkua.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fallbackName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (downloadError) {
      setError(downloadError.message || "Shkarkimi deshtoi.");
    } finally {
      setDownloadingKey("");
    }
  };

  const renderTimeline = (history = []) => (
    <div className="review-timeline">
      {history.map((item) => (
        <div className="review-timeline-item" key={item.id || `${item.status}-${item.createdAt}`}>
          <span className="review-timeline-dot" />
          <div>
            <strong>{item.statusLabel || STATUS_LABELS[item.status] || item.status}</strong>
            <p>{[normalizeDate(item.createdAt), item.actorRoleLabel || item.actorRole, item.actorName].filter(Boolean).join(" | ")}</p>
            {item.note ? <p>{item.note}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );

  const renderStats = () => {
    const rows = [
      ["Total", dashboardStats.total],
      ["Ne pritje", dashboardStats.pending],
      ["Aprovuar", dashboardStats.approved],
      ["Refuzuar", dashboardStats.rejected],
      ["Paguar", dashboardStats.paid],
      ["Shuma totale", formatCurrency(dashboardStats.totalAmount)],
      ["Shuma aprovuar", formatCurrency(dashboardStats.approvedAmount)],
      ["Shuma paguar", formatCurrency(dashboardStats.paidAmount)],
    ];

    return (
      <div className="review-stats-grid">
        {rows.map(([label, value]) => (
          <article className="review-stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    );
  };

  const renderBreakdown = (heading, rows) => {
    const maxCount = Math.max(...rows.map((row) => row.count), 1);

    return (
      <article className="review-breakdown-card">
        <h3>{heading}</h3>
        {rows.length ? (
          <div className="review-breakdown-list">
            {rows.map((row) => (
              <div className="review-breakdown-row" key={row.key}>
                <div className="review-breakdown-label">
                  <span>{row.label}</span>
                  <strong>{row.count}</strong>
                </div>
                <div className="review-breakdown-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max((row.count / maxCount) * 100, 6)}%` }} />
                </div>
                <small>{formatCurrency(row.amount)}</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="review-empty">Nuk ka te dhena per statistika.</div>
        )}
      </article>
    );
  };

  const renderFilterGroup = (label, options, selectedValue, onChange) => (
    <div className="review-filter-group">
      <span>{label}</span>
      <div className="review-filter-chips">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={selectedValue === option.value ? "active" : ""}
            onClick={() => onChange(option.value)}
            aria-pressed={selectedValue === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className="review-panel">
      <div className="review-panel-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <button type="button" className="review-secondary-btn" onClick={loadData} disabled={isLoading}>
          {isLoading ? <Loader2 size={16} className="review-spin" /> : null}
          Rifresko
        </button>
      </div>

      {renderStats()}

      {showAnalytics ? (
        <div className="review-analytics-grid review-analytics-grid--wide" aria-label="Statistikat e rimbursimeve">
          <article className="review-breakdown-card">
            <h3>Statuset e workflow-it</h3>
            {statusBreakdown.length ? (
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="count" nameKey="label" innerRadius={52} outerRadius={84} paddingAngle={3}>
                    {statusBreakdown.map((entry, index) => (
                      <Cell key={entry.key} fill={REVIEW_CHART_COLORS[index % REVIEW_CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="review-empty">Nuk ka të dhëna për këtë periudhë.</div>
            )}
          </article>
          <article className="review-breakdown-card">
            <h3>Rimbursimet sipas vitit</h3>
            {reimbursementsByYear.length ? (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={reimbursementsByYear}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8e0ea" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="reimbursements" name="Kërkesa" radius={[8, 8, 0, 0]} fill="#1688f0" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="review-empty">Nuk ka të dhëna për këtë periudhë.</div>
            )}
          </article>
          <article className="review-breakdown-card">
            <h3>Shuma sipas fakultetit</h3>
            {reimbursementsByFaculty.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={reimbursementsByFaculty} layout="vertical" margin={{ top: 8, right: 24, left: 18, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#d8e0ea" />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" width={140} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="amount" name="Shuma" radius={[0, 8, 8, 0]} fill="#153a63" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="review-empty">Nuk ka të dhëna për këtë periudhë.</div>
            )}
          </article>
          {renderBreakdown("Sipas formularit", formBreakdown)}
          <article className="review-breakdown-card review-latest-card">
            <h3>5 kërkesat e fundit</h3>
            {latestRequests.length ? (
              <div className="review-latest-list">
                {latestRequests.map((request) => (
                  <div className="review-latest-row" key={request.id}>
                    <strong>{request.title || request.requestTypeLabel || "Kërkesë"}</strong>
                    <span>{[request.owner?.name || request.owner?.email, request.statusLabel || STATUS_LABELS[request.status], formatAmount(request)].filter(Boolean).join(" | ")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="review-empty">Nuk ka të dhëna për këtë periudhë.</div>
            )}
          </article>
        </div>
      ) : null}

      {showReviewFilters ? (
        <div className="review-filters" aria-label="Filtrat e shqyrtimit">
          {renderFilterGroup("Statusi", REVIEW_STATUS_FILTERS, statusFilter, setStatusFilter)}
          {renderFilterGroup("Formulari", REVIEW_FORM_FILTERS, formFilter, setFormFilter)}
        </div>
      ) : null}

      {error ? <p className="review-message error">{error}</p> : null}
      {message ? <p className="review-message success">{message}</p> : null}

      {isLoading ? (
        <div className="review-empty">
          <Loader2 size={18} className="review-spin" />
          Duke ngarkuar rimbursimet...
        </div>
      ) : visibleRequests.length ? (
        <div className="review-list">
          {visibleRequests.map((request) => {
            const actions = showActions ? getActions(role, request.status, canApprove) : [];

            return (
              <article className="review-item" key={request.id}>
                <div className="review-item-main">
                  <div className="review-item-title">
                    <span className="review-icon"><Wallet size={18} /></span>
                    <div>
                      <h3>{request.title}</h3>
                      <p>
                        {[request.requestTypeLabel, request.owner?.name, request.owner?.faculty, formatAmount(request)]
                          .filter(Boolean)
                          .join(" | ")}
                      </p>
                    </div>
                  </div>
                  <span className={`review-status ${request.status}`}>
                    {request.statusLabel || STATUS_LABELS[request.status] || request.status}
                  </span>
                </div>

                <div className="review-downloads">
                  <button
                    type="button"
                    onClick={() => downloadFile(request.downloadUrl, request.documentFilename || "rimbursim.pdf", `${request.id}-pdf`)}
                    disabled={downloadingKey === `${request.id}-pdf`}
                  >
                    <Download size={15} />
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadFile(request.docxDownloadUrl, request.documentDocxFilename || "rimbursim.docx", `${request.id}-docx`)}
                    disabled={downloadingKey === `${request.id}-docx`}
                  >
                    <Download size={15} />
                    DOCX
                  </button>
                  {request.attachments?.map((attachment) => (
                    <button
                      key={attachment.id}
                      type="button"
                      onClick={() => downloadFile(`/reimbursements/${request.id}/attachments/${attachment.id}`, attachment.filename || "dokument", `${request.id}-${attachment.id}`)}
                      disabled={downloadingKey === `${request.id}-${attachment.id}`}
                    >
                      <Download size={15} />
                      {attachment.filename || "Dokument"}
                    </button>
                  ))}
                </div>

                {actions.length ? (
                  <div className="review-decision-box">
                    <textarea
                      value={notes[request.id] || ""}
                      onChange={handleNoteChange(request.id)}
                      placeholder="Koment institucional per profesorin..."
                    />
                    <div className="review-actions">
                      {actions.map((action) => {
                        const Icon = action.icon;
                        const key = `${request.id}-${action.status}`;

                        return (
                          <button
                            key={action.status}
                            type="button"
                            className={action.tone === "danger" ? "danger" : ""}
                            onClick={() => updateStatus(request, action)}
                            disabled={updatingKey === key}
                          >
                            {updatingKey === key ? <Loader2 size={15} className="review-spin" /> : <Icon size={15} />}
                            {action.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {renderTimeline(request.statusHistory)}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="review-empty">Nuk ka kerkesa per kete faze te workflow-it.</div>
      )}
    </section>
  );
}
