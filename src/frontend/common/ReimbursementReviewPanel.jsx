import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Loader2, RotateCcw, Search, Wallet, XCircle } from "lucide-react";
import { apiUrl } from "../utils/api";
import "./ReimbursementReviewPanel.css";

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Dorezuar",
  received: "Pranuar",
  in_review: "Ne shqyrtim",
  needs_correction: "Kthyer per korrigjim",
  committee_approved: "Aprovuar nga komisioni",
  approved: "Aprovuar final",
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
  { value: "publication", label: "Publikime shkencore" },
  { value: "conference", label: "Konferenca dhe simpoziume" },
  { value: "project", label: "Projekte shkencore" },
];

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

function getActions(role, status) {
  if (role === "committee") {
    return [
      { status: "received", label: "Prano", icon: CheckCircle2 },
      { status: "in_review", label: "Ne shqyrtim", icon: Search },
      { status: "needs_correction", label: "Korrigjim", icon: RotateCcw, requiresNote: true },
      { status: "committee_approved", label: "Aprovo", icon: CheckCircle2 },
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

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleRequests = useMemo(() => {
    return requests.filter((request) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const requestType = request.requestType || request.requestData?.requestType || "";
      const matchesForm = formFilter === "all" || requestType === formFilter;
      const matchesQuery =
        !normalizedQuery ||
        `${request.title} ${request.requestTypeLabel} ${request.owner?.name} ${request.owner?.faculty} ${request.statusLabel}`
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStatus && matchesForm && matchesQuery;
    });
  }, [formFilter, normalizedQuery, requests, statusFilter]);

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
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Statusi nuk u perditesua.");
      }

      const updatedRequest = result.data || { ...request, status: action.status };
      setRequests((prev) => prev.map((item) => (item.id === updatedRequest.id ? updatedRequest : item)));
      setNotes((prev) => ({ ...prev, [request.id]: "" }));
      await loadData();
      setError("");
      setMessage(getSuccessMessage(updatedRequest.status));
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
      ["Total", stats?.total || 0],
      ["Ne pritje", stats?.pending || 0],
      ["Aprovuar", stats?.approved || 0],
      ["Refuzuar", stats?.rejected || 0],
      ["Paguar", stats?.paid || 0],
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
            const actions = getActions(role, request.status);

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
