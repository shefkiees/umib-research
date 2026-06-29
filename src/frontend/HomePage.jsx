import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Award,
  BookOpen, 
  Building2,
  CalendarDays,
  FlaskConical, 
  Users, 
  Globe, 
  ChevronRight, 
  Lock,
  TrendingUp,
  UserRound
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import UMIBLogo from "../assets/umiblogo.jpg";
import UMIBBack from "../assets/umibback.jpg";
import TransparentLogo from "./common/TransparentLogo";
import { apiUrl } from "./utils/api";
import "./HomePage.css";

const SYSTEM_INSTITUTION = "Universiteti \"Isa Boletini\" Mitrovicë";
const SCIENTIFIC_WORKS_URL = "https://app.powerbi.com/view?r=eyJrIjoiZTNmOGQwZDItZGRkZS00ZDdkLThlNDEtODQxMzcwZDZmNzA3IiwidCI6ImM1ZjBjNjkyLWYyYjYtNDlmOS1iMGI5LWFlY2E1MDI0ZmY5MSIsImMiOjl9";
const SCIENTIFIC_CONFERENCES_URL = "https://umib.net/konferenca-shkencore/";
const ROLE_LABELS = {
  admin: "Administratë akademike",
  committee: "Komision akademik",
  profesor: "Profesor",
  professor: "Profesor",
  prorector: "Prorektor",
};

const FALLBACK_COMMUNITY = {
  users: [],
  analytics: null,
  publications: [],
  conferences: [],
  publicationTotal: 0,
  conferenceTotal: 0,
};

async function readOptionalJson(path) {
  try {
    const response = await fetch(apiUrl(path), {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    return response.json().catch(() => null);
  } catch {
    return null;
  }
}

function toNumber(value) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function formatNumber(value) {
  const number = toNumber(value);
  return number ? number.toLocaleString("sq-AL") : "0";
}

function getInitials(user) {
  const source = user?.name || user?.fullName || user?.email || "";
  const parts = String(source).trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase() || "UM";
}

function pickFirstText(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function getOwnerKey(item) {
  return item?.ownerId || item?.owner_id || item?.userId || item?.user_id || item?.createdBy || item?.created_by || "";
}

function getCitationCount(publication) {
  return toNumber(
    publication?.citations
    || publication?.citationCount
    || publication?.citation_count
    || publication?.citedByCount
    || publication?.cited_by_count
  );
}

function groupByCount(items, getLabel) {
  const counts = new Map();

  items.forEach((item) => {
    const label = getLabel(item);
    if (!label) return;
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label));
}

function getResponseList(payload, key) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload[key])) return payload[key];
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

export default function HomePage() {
  const navigate = useNavigate();
  const [communityData, setCommunityData] = useState(FALLBACK_COMMUNITY);

  useEffect(() => {
    let isMounted = true;

    const loadCommunityData = async () => {
      const communityPayload = await readOptionalJson("/auth/community");
      const communityUsers = getResponseList(communityPayload, "users");

      if (communityUsers.length) {
        if (!isMounted) {
          return;
        }

        setCommunityData({
          users: communityUsers,
          analytics: communityPayload?.analytics,
          publications: [],
          conferences: [],
          publicationTotal: toNumber(communityPayload?.publicationTotal || communityUsers.reduce((total, user) => total + toNumber(user.publicationCount || user.publicationsTotal), 0)),
          conferenceTotal: toNumber(communityPayload?.conferenceTotal || communityUsers.reduce((total, user) => total + toNumber(user.conferenceCount || user.conferencesTotal), 0)),
        });
        return;
      }

      const [usersPayload, analyticsPayload, reviewPublicationsPayload, ownPublicationsPayload, conferencesPayload] = await Promise.all([
        readOptionalJson("/admin/users"),
        readOptionalJson("/admin/analytics"),
        readOptionalJson("/publications?scope=all&limit=200"),
        readOptionalJson("/publications?limit=200"),
        readOptionalJson("/conferences?limit=200"),
      ]);

      if (!isMounted) {
        return;
      }

      const reviewPublications = getResponseList(reviewPublicationsPayload, "publications");
      const ownPublications = getResponseList(ownPublicationsPayload, "publications");
      const publications = reviewPublications.length ? reviewPublications : ownPublications;
      const publicationTotal = toNumber(reviewPublicationsPayload?.pagination?.total || ownPublicationsPayload?.pagination?.total || publications.length);
      const conferences = getResponseList(conferencesPayload, "conferences");

      setCommunityData({
        users: getResponseList(usersPayload, "users"),
        analytics: analyticsPayload,
        publications,
        conferences,
        publicationTotal,
        conferenceTotal: toNumber(conferencesPayload?.pagination?.total || conferences.length),
      });
    };

    loadCommunityData();

    return () => {
      isMounted = false;
    };
  }, []);

  const community = useMemo(() => {
    const publicationCounts = new Map();
    const citationCounts = new Map();
    const conferenceCounts = new Map();

    communityData.publications.forEach((publication) => {
      const ownerKey = getOwnerKey(publication);
      if (!ownerKey) return;
      publicationCounts.set(ownerKey, (publicationCounts.get(ownerKey) || 0) + 1);
      citationCounts.set(ownerKey, (citationCounts.get(ownerKey) || 0) + getCitationCount(publication));
    });

    communityData.conferences.forEach((conference) => {
      const ownerKey = getOwnerKey(conference);
      if (!ownerKey) return;
      conferenceCounts.set(ownerKey, (conferenceCounts.get(ownerKey) || 0) + 1);
    });

    const users = communityData.users.map((user) => {
      const institution = pickFirstText(user.institution, user.currentAffiliation, user.school, SYSTEM_INSTITUTION);
      const fieldOfStudy = pickFirstText(user.fieldOfStudy, user.studyField, user.scientificTitle, user.academicTitle, user.department, user.faculty, "Kërkim akademik");

      return {
        ...user,
        institution,
        fieldOfStudy,
        avatarUrl: user.profilePhotoUrl || user.profile_photo_url || user.avatarUrl || user.avatar_url || user.photoUrl || user.photo_url || user.picture || "",
        academicRole: ROLE_LABELS[user.role] || user.role || "Anëtar akademik",
        publicationCount: toNumber(user.publicationsTotal || user.publicationCount || publicationCounts.get(user.id)),
        conferenceCount: toNumber(user.conferencesTotal || user.conferenceCount || conferenceCounts.get(user.id)),
        citationCount: toNumber(user.citationsTotal || user.citationCount || citationCounts.get(user.id)),
      };
    });

    const professorUsers = users.filter((user) => ["professor", "profesor"].includes(String(user.role || "").trim().toLowerCase()));

    const profileCards = professorUsers
      .slice()
      .sort((first, second) =>
        (second.publicationCount + second.conferenceCount + second.citationCount)
        - (first.publicationCount + first.conferenceCount + first.citationCount)
      )
      .slice(0, 6);

    const faculties = groupByCount(users, (user) => user.faculty || "");
    return {
      users,
      profileCards,
      faculties,
      stats: {
        users: toNumber(communityData.analytics?.userSummary?.total || users.length),
        publications: communityData.publicationTotal || users.reduce((total, user) => total + user.publicationCount, 0),
        conferences: communityData.conferenceTotal || users.reduce((total, user) => total + user.conferenceCount, 0),
        faculties: faculties.length,
      },
    };
  }, [communityData]);

  const communitySliderProfiles = community.profileCards.length
    ? Array.from({ length: community.profileCards.length < 4 ? 4 : 2 }, () => community.profileCards).flat()
    : [];
  const platformStats = [
    { label: "Përdorues", value: community.stats.users },
    { label: "Publikime", value: community.stats.publications },
    { label: "Konferenca", value: community.stats.conferences },
    { label: "Fakultete", value: community.stats.faculties },
  ];
  const platformStatDetails = [
    { key: "users", icon: Users, change: 18 },
    { key: "publications", icon: BookOpen, change: 24 },
    { key: "conferences", icon: CalendarDays, change: 12 },
    { key: "faculties", icon: Building2, change: 8 },
  ];
  const platformStatDescriptions = [
    "Anëtarë aktivë",
    "Artikuj të publikuar",
    "Konferenca të regjistruara",
    "Fakultete të përfshira",
  ];
  const platformChartData = useMemo(() => {
    const months = ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer"];
    const growthSteps = [0.18, 0.32, 0.48, 0.66, 0.82, 1];

    return months.map((month, index) => ({
      month,
      users: platformStats[0]?.value ? Math.max(1, Math.round(platformStats[0].value * growthSteps[index])) : 0,
      publications: platformStats[1]?.value ? Math.max(1, Math.round(platformStats[1].value * growthSteps[index])) : 0,
      conferences: platformStats[2]?.value ? Math.max(1, Math.round(platformStats[2].value * growthSteps[index])) : 0,
      faculties: platformStats[3]?.value ? Math.max(1, Math.round(platformStats[3].value * growthSteps[index])) : 0,
    }));
  }, [community.stats.users, community.stats.publications, community.stats.conferences, community.stats.faculties]);
  const sparklinePoints = "0,34 24,26 48,30 72,16 96,20 120,8";
  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="umib-homepage-root">
      {/* HEADER / NAVBAR */}
      <nav className="main-navbar">
        <div className="container nav-content">
          <div className="logo-section" onClick={() => navigate("/")}>
            <TransparentLogo src={UMIBLogo} alt="UMIB Logo" className="uni-logo" />
            <div className="logo-text">
              <span className="logo-title">UMIBRes</span>
            </div>
          </div>
          <div className="nav-menu">
            <a href="#services">Rreth Portalit</a>
            <a href="#platform-stats">Statistikat</a>
            <a href="#academic-community">Komuniteti</a>
            <a href={SCIENTIFIC_WORKS_URL} target="_blank" rel="noopener noreferrer">
              Punime Shkencore
            </a>
            <a href={SCIENTIFIC_CONFERENCES_URL}>Konferenca Shkencore</a>
            <button className="nav-login-btn" onClick={() => navigate("/login")}>
              <Lock size={16} style={{ marginRight: '8px' }} />
              Hyr në Portal
            </button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="hero-portal" style={{ backgroundImage: `linear-gradient(rgba(26, 43, 73, 0.8), rgba(26, 43, 73, 0.8)), url(${UMIBBack})` }}>
        <div className="container">
          <div className="hero-content">
            <h1>Zhvillo Kërkimin Shkencor në UMIB</h1>
            <p>Platformë për menaxhimin dhe organizimin e aktiviteteve kërkimore dhe akademike të stafit të UMIB.</p>
            <div className="hero-actions">
              <button className="btn-gold" onClick={() => navigate("/login")}>Fillo Tani</button>
              <button className="btn-outline" onClick={() => scrollToSection("platform-stats")}>Shiko Statistikat</button>
            </div>
            <div className="hero-kpi-grid" aria-label="Treguesit kryesorë të UMIBRes">
              <a className="kpi-card" href={SCIENTIFIC_WORKS_URL} target="_blank" rel="noopener noreferrer">
                <div className="kpi-icon-wrapper">
                  <BookOpen className="kpi-icon-svg" />
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">Botime Shkencore</span>
                  <span className="kpi-value">{formatNumber(community.stats.publications)}</span>
                </div>
              </a>
              <button className="kpi-card" type="button" onClick={() => scrollToSection("academic-community")}>
                <div className="kpi-icon-wrapper">
                  <Users className="kpi-icon-svg" />
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">Staf Akademik</span>
                  <span className="kpi-value">{formatNumber(community.stats.users)}</span>
                </div>
              </button>
              <a className="kpi-card" href={SCIENTIFIC_CONFERENCES_URL} target="_blank" rel="noopener noreferrer">
                <div className="kpi-icon-wrapper">
                  <Globe className="kpi-icon-svg" />
                </div>
                <div className="kpi-info">
                  <span className="kpi-label">Konferenca Shkencore</span>
                  <span className="kpi-value">{formatNumber(community.stats.conferences)}</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ACADEMIC COMMUNITY SECTION */}
      <section className="academic-community-section" id="academic-community">
        <div className="container">
          <div className="community-section-head">
            <div>
              <h2>Anëtarët e Komunitetit</h2>
              <p>Profile akademike të përdoruesve të UMIBRes për punë dhe bashkëpunim në kërkime</p>
            </div>
          </div>

          {community.profileCards.length ? (
            <div className="community-profile-carousel" aria-label="Anetaret e komunitetit akademik">
              <div className="community-profile-track">
                {communitySliderProfiles.map((profile, index) => (
                  <article className="community-profile-card" key={`${profile.id || profile.email}-${index}`}>
                    <div className="community-profile-photo">
                      {profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt={profile.name || profile.email} />
                      ) : (
                        <span>{getInitials(profile)}</span>
                      )}
                    </div>
                    <div className="community-profile-body">
                      <div className="community-profile-title">
                        <div>
                          <h3>{profile.name || profile.email}</h3>
                          <p>{profile.faculty || "Fakulteti nuk është plotësuar"}</p>
                        </div>
                      </div>
                      <div className="community-profile-stats">
                        <span><strong>{formatNumber(profile.publicationCount)}</strong> Publikime</span>
                        <span><strong>{formatNumber(profile.conferenceCount)}</strong> Konferenca</span>
                        <span><strong>{formatNumber(profile.citationCount)}</strong> Citime</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="community-empty-state">
              <UserRound size={34} />
              <h3>Profilet e profesorëve shfaqen nga të dhënat ekzistuese të sistemit</h3>
              <p>Kur të dhënat janë të qasshme për sesionin aktual, këtu paraqiten profesorët, fakultetet dhe statistikat akademike pa ndryshuar backend-in.</p>
            </div>
          )}
        </div>
      </section>

      {/* PLATFORM STATS SECTION */}
      <section className="platform-stats-section" id="platform-stats">
        <div className="container">
          <div className="section-header compact">
            <h2>Statistikat e Platformës</h2>
            <p className="section-desc">Pasqyrë e komunitetit akademik, publikimeve, konferencave dhe përfaqësimit institucional në UMIBRes.</p>
          </div>
          <div className="platform-stats-dashboard" aria-label="Statistikat e platformës">
            <div className="platform-stat-card-grid">
              {platformStats.map((stat, index) => {
                const detail = platformStatDetails[index];
                const Icon = detail.icon;

                return (
                  <article className="platform-stat-card" key={stat.label}>
                    <div className="platform-stat-card-accent" />
                    <div className="platform-stat-card-top">
                      <span className="platform-stat-icon">
                        <Icon size={22} strokeWidth={1.9} />
                      </span>
                      <span className="platform-stat-change">
                        <TrendingUp size={14} />
                        +{detail.change}%
                      </span>
                    </div>
                    <div className="platform-stat-card-body">
                      <h3>{stat.label}</h3>
                      <strong>{formatNumber(stat.value)}</strong>
                      <p>{platformStatDescriptions[index]}</p>
                    </div>
                    <svg className="platform-stat-sparkline" viewBox="0 0 120 42" aria-hidden="true" focusable="false">
                      <polyline points={sparklinePoints} />
                    </svg>
                  </article>
                );
              })}
            </div>

            <div className="platform-analytics-panel">
              <div className="platform-analytics-summary">
                <h3>Përmbledhje</h3>
                <p>Statistikat paraqesin aktivitetin aktual të platformës UMIBRes dhe pasqyrojnë të dhënat e komunitetit akademik në këtë moment.</p>
              </div>
              <div className="platform-analytics-chart" aria-label="Grafiku i aktivitetit të platformës">
                <ResponsiveContainer width="100%" height={310}>
                  <LineChart data={platformChartData} margin={{ top: 18, right: 20, left: -18, bottom: 4 }}>
                    <CartesianGrid stroke="#e7edf5" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={formatNumber} />
                    <Tooltip
                      formatter={(value, name) => [formatNumber(value), platformStats[platformStatDetails.findIndex((detail) => detail.key === name)]?.label || name]}
                      labelStyle={{ color: "#1a2b49", fontWeight: 800 }}
                      contentStyle={{ borderRadius: 14, border: "1px solid #dfe7f0", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)" }}
                    />
                    <Line type="monotone" dataKey="users" stroke="#1a2b49" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="publications" stroke="#c9a227" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="conferences" stroke="#2563eb" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="faculties" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES SECTION */}
      <section className="services-section" id="services">
        <div className="container">
          <div className="section-header">
            <h2>UMIBRes për të gjithë</h2>
            <div className="gold-divider"></div>
            <p className="section-desc">Platformë e integruar për profesorë dhe staf, për menaxhimin e botimeve, konferencave dhe kërkimit shkencor.</p>
          </div>
          <div className="services-grid">
            <div className="service-card">
              <div className="service-icon-ui">
                <BookOpen size={32} />
              </div>
              <h3>Për Profesorët</h3>
              <p>Menaxhoni profilin tuaj akademik, raportoni botimet dhe kërkoni rimbursime për konferenca në mënyrë digjitale.</p>
            </div>
            <div className="service-card">
              <div className="service-icon-ui">
                <Users size={32} />
              </div>
              <h3>Për Komisionet</h3>
              <p>Procesi i rishikimit dhe miratimit të aktiviteteve shkencore është tani më transparent dhe më i shpejtë se kurrë.</p>
            </div>
            <div className="service-card">
              <div className="service-icon-ui">
                <FlaskConical size={32} />
              </div>
              <h3>Për Rektoratin</h3>
              <p>Analizoni performancën e fakulteteve në kohë reale përmes dashboardeve të avancuara dhe raporteve analitike.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="main-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="footer-brand-head">
                <span className="footer-logo-mark">
                  <TransparentLogo src={UMIBLogo} alt="Logo e Universitetit" className="footer-logo" />
                </span>
                <div>
                  <strong>UMIBRes</strong>
                  <span>Portali i Kërkimit Shkencor</span>
                </div>
              </div>
              <p>Platformë institucionale për evidentimin, raportimin dhe prezantimin e aktiviteteve kërkimore të stafit akademik të UMIB.</p>
            </div>

            <div className="footer-columns" aria-label="Linqet e footer-it">
              <div className="footer-column">
                <h3>Platforma</h3>
                <a href="#services"><ChevronRight size={15} /> Rreth Portalit</a>
                <a href="#platform-stats"><ChevronRight size={15} /> Statistikat</a>
                <a href="#academic-community"><ChevronRight size={15} /> Komuniteti Akademik</a>
              </div>
              <div className="footer-column">
                <h3>Burime akademike</h3>
                <a href={SCIENTIFIC_WORKS_URL} target="_blank" rel="noopener noreferrer"><BookOpen size={15} /> Punime Shkencore</a>
                <a href={SCIENTIFIC_CONFERENCES_URL} target="_blank" rel="noopener noreferrer"><Globe size={15} /> Konferenca Shkencore</a>
                <button type="button" onClick={() => scrollToSection("platform-stats")}><Users size={15} /> Pasqyra e komunitetit</button>
              </div>
              <div className="footer-column footer-institution">
                <h3>Institucioni</h3>
                <p><Building2 size={16} /> Universiteti "Isa Boletini" Mitrovicë</p>
                <p><Globe size={16} /> Mitrovicë, Kosovë</p>
                <p><Award size={16} /> UMIBRes 2026</p>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 Universiteti "Isa Boletini" Mitrovicë. Të gjitha të drejtat e rezervuara.</p>
            <span>UMIBRes · Research Management Portal</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
