import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  FileText,
  RefreshCw,
  UsersRound,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "../styles/ProRectorDashboard.css";
import ProRectorSidebar from "../components/Sidebar";
import ProRectorTopBar from "../components/TopBar";
import { apiUrl } from "../../utils/api";

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("sq-AL").format(toNumber(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("sq-AL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function ChartEmpty({ message }) {
  return (
    <div className="prorector-chart-empty">
      <BarChart3 size={22} />
      <span>{message}</span>
    </div>
  );
}

export default function FacultyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadFaculty() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(apiUrl(`/prorector/faculties/${encodeURIComponent(id || "")}`), {
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || "faculty_load_failed");
        }

        if (mounted) setPayload(data);
      } catch (err) {
        console.error("Faculty detail load failed:", err);
        if (mounted) {
          setPayload(null);
          setError("Detajet e fakultetit nuk u ngarkuan.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadFaculty();

    return () => {
      mounted = false;
    };
  }, [id]);

  const faculty = payload?.faculty;
  const summary = payload?.summary || {};
  const publicationsByYear = payload?.publicationsByYear || [];
  const fundingByYear = payload?.fundingByYear || [];

  const cards = [
    { label: "Artikuj reviste", value: summary.journalArticles, icon: BookOpen },
    { label: "Punime konferencash", value: summary.conferencePapers, icon: FileText },
    { label: "Libra/Kapituj", value: summary.booksChapters, icon: BookOpen },
    { label: "Autorë aktivë", value: summary.activeAuthors, icon: UsersRound },
    { label: "Kërkesa për financim", value: summary.fundingRequests, icon: FileText },
    { label: "Shuma totale e financuar", value: formatCurrency(summary.fundedTotal), icon: WalletCards },
  ];

  return (
    <div className="prorector-layout">
      <ProRectorSidebar
        activePage="Fakultetet"
        setActivePage={(page) => navigate("/prorector/dashboard", { state: { activePage: page } })}
      />
      <div className="prorector-main">
        <ProRectorTopBar
          activePage="Fakultetet"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          profile={{ name: "Prorektor për Kërkim Shkencor", role: "Monitorim dhe raporte" }}
          notifications={[]}
          onProfileAction={(action) => {
            if (action === "Logout") {
              fetch(apiUrl("/auth/logout"), { method: "POST", credentials: "include" }).finally(() => navigate("/"));
            }
          }}
        />

        <main className="prorector-content">
          <div className="prorector-table-section prorector-faculty-detail-page">
            <button
              type="button"
              className="prorector-back-btn"
              onClick={() => navigate("/prorector/dashboard", { state: { activePage: "Fakultetet" } })}
            >
              <ArrowLeft size={17} />
              Kthehu te Fakultetet
            </button>

            {loading ? (
              <div className="prorector-faculty-detail-loading">
                <RefreshCw size={18} className="prorector-spin" />
                <span>Duke ngarkuar detajet e fakultetit...</span>
              </div>
            ) : null}

            {error ? <div className="prorector-inline-alert" role="alert">{error}</div> : null}

            {!loading && !error && faculty ? (
              <>
                <div className="prorector-section-head prorector-faculty-detail-head">
                  <div>
                    <h2>{faculty.name}</h2>
                    <p>Analizë e aktivitetit kërkimor dhe financimeve të fakultetit.</p>
                  </div>
                  <span className="prorector-section-pill">{faculty.code || "Pa kod"} · {faculty.statusLabel || "Aktiv"}</span>
                </div>

                <div className="prorector-detail-kpi-grid">
                  {cards.map((card) => {
                    const Icon = card.icon;
                    const value = typeof card.value === "string" ? card.value : formatNumber(card.value);

                    return (
                      <article className="prorector-kpi-card" key={card.label}>
                        <div className="prorector-kpi-icon"><Icon size={21} /></div>
                        <div><strong>{value}</strong><span>{card.label}</span></div>
                      </article>
                    );
                  })}
                </div>

                <div className="prorector-analytics-grid">
                  <article className="prorector-analytics-card">
                    <div className="prorector-card-head"><h3>Artikujt sipas viteve</h3><BarChart3 size={20} /></div>
                    {publicationsByYear.some((row) => toNumber(row.value) > 0) ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={publicationsByYear}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="value" name="Artikuj" fill="#1d4d7d" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <ChartEmpty message="Nuk ka artikuj për këtë fakultet." />}
                  </article>

                  <article className="prorector-analytics-card">
                    <div className="prorector-card-head"><h3>Financimet sipas viteve</h3><WalletCards size={20} /></div>
                    {fundingByYear.some((row) => toNumber(row.value) > 0) ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={fundingByYear}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(value)} />
                          <Bar dataKey="value" name="Financime" fill="#15803d" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <ChartEmpty message="Nuk ka financime të aprovuara për këtë fakultet." />}
                  </article>
                </div>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
