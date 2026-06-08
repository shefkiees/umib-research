import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Award,
  BookOpen, 
  Building2,
  FlaskConical, 
  Users, 
  Globe, 
  ChevronRight, 
  GraduationCap,
  LibraryBig,
  Lock,
  UserRound
} from "lucide-react";
import UMIBLogo from "../assets/umiblogo.jpg";
import UMIBBack from "../assets/umibback.jpg";
import TransparentLogo from "./common/TransparentLogo";
import { apiUrl } from "./utils/api";
import "./HomePage.css";

const SYSTEM_INSTITUTION = "Universiteti \"Isa Boletini\" Mitrovicë";
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
        avatarUrl: user.avatarUrl || user.photoUrl || user.picture || "",
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
    const institutions = groupByCount(users, (user) => user.institution || SYSTEM_INSTITUTION)
      .map((institution) => {
        const institutionUsers = users.filter((user) => (user.institution || SYSTEM_INSTITUTION) === institution.label);
        return {
          ...institution,
          publications: institutionUsers.reduce((total, user) => total + user.publicationCount, 0),
        };
      });

    const totalCitations = users.reduce((total, user) => total + user.citationCount, 0)
      || communityData.publications.reduce((total, publication) => total + getCitationCount(publication), 0);

    return {
      users,
      profileCards,
      faculties,
      institutions,
      stats: {
        users: toNumber(communityData.analytics?.userSummary?.total || users.length),
        publications: communityData.publicationTotal || users.reduce((total, user) => total + user.publicationCount, 0),
        conferences: communityData.conferenceTotal || users.reduce((total, user) => total + user.conferenceCount, 0),
        citations: totalCitations,
        institutions: institutions.length,
        faculties: faculties.length,
      },
    };
  }, [communityData]);

  const maxFacultyCount = Math.max(...community.faculties.map((faculty) => faculty.count), 1);
  const communitySliderProfiles = community.profileCards.length
    ? Array.from({ length: community.profileCards.length < 4 ? 4 : 2 }, () => community.profileCards).flat()
    : [];

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
            <a
              href="https://app.powerbi.com/view?r=eyJrIjoiZTNmOGQwZDItZGRkZS00ZDdkLThlNDEtODQxMzcwZDZmNzA3IiwidCI6ImM1ZjBjNjkyLWYyYjYtNDlmOS1iMGI5LWFlY2E1MDI0ZmY5MSIsImMiOjl9"
              target="_blank"
              rel="noopener noreferrer"
            >
              Punime Shkencore
            </a>
            <a href="https://umib.net/konferenca-shkencore/">Konferenca Shkencore</a>
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
              <button className="btn-outline" onClick={() => document.getElementById('platform-stats').scrollIntoView({ behavior: 'smooth' })}>Shiko Statistikat</button>
            </div>
          </div>
        </div>
      </section>

      {/* ACADEMIC COMMUNITY SECTION */}
      <section className="academic-community-section" id="academic-community">
        <div className="container">
          <div className="community-section-head">
            <div>
              <span className="section-kicker">Komuniteti Akademik</span>
              <h2>Anëtarët e Komunitetit</h2>
              <p>Profile akademike që përfaqësojnë stafin dhe rolet që përdorin UMIBRes për evidencë, raportim dhe bashkëpunim shkencor.</p>
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
                        <span className="academic-role-badge">{profile.academicRole}</span>
                      </div>
                      <dl className="community-profile-meta">
                        <div>
                          <dt>Institucioni</dt>
                          <dd>{profile.institution}</dd>
                        </div>
                        <div>
                          <dt>Fusha e studimit</dt>
                          <dd>{profile.fieldOfStudy}</dd>
                        </div>
                      </dl>
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

      {/* KPI SECTION */}
      <section className="kpi-section">
        <div className="container">
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon-wrapper">
                <BookOpen className="kpi-icon-svg" />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">Botime Shkencore</span>
                <span className="kpi-value">1,240+</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-wrapper">
                <FlaskConical className="kpi-icon-svg" />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">Projekte Aktive</span>
                <span className="kpi-value">45</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-wrapper">
                <Users className="kpi-icon-svg" />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">Staf Akademik</span>
                <span className="kpi-value">180+</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-wrapper">
                <Globe className="kpi-icon-svg" />
              </div>
              <div className="kpi-info">
                <span className="kpi-label">Konferenca Ndërkombëtare</span>
                <span className="kpi-value">32</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM STATS SECTION */}
      <section className="platform-stats-section" id="platform-stats">
        <div className="container">
          <div className="section-header compact">
            <span className="section-kicker">Madhësia e platformës</span>
            <h2>Statistikat e Platformës</h2>
            <p className="section-desc">Pasqyrë e komunitetit akademik, publikimeve, konferencave dhe përfaqësimit institucional në UMIBRes.</p>
          </div>
          <div className="platform-stats-grid">
            <article className="platform-stat-card">
              <Users size={24} />
              <span>Numri total i përdoruesve</span>
              <strong>{formatNumber(community.stats.users)}</strong>
            </article>
            <article className="platform-stat-card">
              <BookOpen size={24} />
              <span>Numri total i publikimeve</span>
              <strong>{formatNumber(community.stats.publications)}</strong>
            </article>
            <article className="platform-stat-card">
              <GraduationCap size={24} />
              <span>Numri total i konferencave</span>
              <strong>{formatNumber(community.stats.conferences)}</strong>
            </article>
            <article className="platform-stat-card">
              <Award size={24} />
              <span>Numri total i citimeve</span>
              <strong>{formatNumber(community.stats.citations)}</strong>
            </article>
            <article className="platform-stat-card">
              <Building2 size={24} />
              <span>Numri i institucioneve</span>
              <strong>{formatNumber(community.stats.institutions)}</strong>
            </article>
            <article className="platform-stat-card">
              <LibraryBig size={24} />
              <span>Numri i fakulteteve</span>
              <strong>{formatNumber(community.stats.faculties)}</strong>
            </article>
          </div>
        </div>
      </section>

      {/* REPRESENTATION SECTION */}
      <section className="representation-section">
        <div className="container representation-grid">
          <div className="representation-panel">
            <div className="representation-head">
              <span className="section-kicker">Përfaqësimi</span>
              <h2>Fakultetet më të Përfaqësuara</h2>
            </div>
            <div className="faculty-progress-list">
              {community.faculties.slice(0, 5).map((faculty) => {
                const percentage = Math.round((faculty.count / maxFacultyCount) * 100);
                return (
                  <article className="faculty-progress-row" key={faculty.label}>
                    <div>
                      <strong>{faculty.label}</strong>
                      <span>{faculty.count} anëtarë · {percentage}%</span>
                    </div>
                    <div className="faculty-progress-track" aria-hidden="true">
                      <span style={{ width: `${percentage}%` }} />
                    </div>
                  </article>
                );
              })}
              {!community.faculties.length ? <p className="community-muted">Fakultetet shfaqen kur të dhënat janë të qasshme.</p> : null}
            </div>
          </div>

          <div className="representation-panel institution-panel">
            <div className="representation-head">
              <span className="section-kicker">Institucionet</span>
              <h2>Institucionet Kryesore</h2>
            </div>
            <div className="institution-card-list">
              {community.institutions.slice(0, 3).map((institution) => (
                <article className="institution-card" key={institution.label}>
                  <Building2 size={24} />
                  <div>
                    <h3>{institution.label}</h3>
                    <p>{institution.count} anëtarë</p>
                  </div>
                  <span>{formatNumber(institution.publications)} publikime</span>
                </article>
              ))}
              {!community.institutions.length ? <p className="community-muted">Institucionet shfaqen kur të dhënat janë të qasshme.</p> : null}
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
              <button className="service-link">Mëso më shumë <ChevronRight size={16} /></button>
            </div>
            <div className="service-card">
              <div className="service-icon-ui">
                <Users size={32} />
              </div>
              <h3>Për Komisionet</h3>
              <p>Procesi i rishikimit dhe miratimit të aktiviteteve shkencore është tani më transparent dhe më i shpejtë se kurrë.</p>
              <button className="service-link">Mëso më shumë <ChevronRight size={16} /></button>
            </div>
            <div className="service-card">
              <div className="service-icon-ui">
                <FlaskConical size={32} />
              </div>
              <h3>Për Rektoratin</h3>
              <p>Analizoni performancën e fakulteteve në kohë reale përmes dashboardeve të avancuara dhe raporteve analitike.</p>
              <button className="service-link">Mëso më shumë <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="main-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <TransparentLogo src={UMIBLogo} alt="Logo e Fakultetit" className="footer-logo" />
              <p>Universiteti "Isa Boletini" Mitrovicë<br />Portali i Kërkimit Shkencor</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 UMIB. Të gjitha të drejtat e rezervuara.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
