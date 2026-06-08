import React from "react";
import { useNavigate } from "react-router-dom";
import { 
  BarChart3,
  BookOpen, 
  FileCheck2,
  FlaskConical, 
  Users, 
  Globe, 
  ChevronRight, 
  Landmark,
  LineChart,
  Lock,
  ShieldCheck,
  WalletCards
} from "lucide-react";
import UMIBLogo from "../assets/umiblogo.jpg";
import UMIBBack from "../assets/umibback.jpg";
import TransparentLogo from "./common/TransparentLogo";
import "./HomePage.css";

export default function HomePage() {
  const navigate = useNavigate();

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
            <a href="#insights">Statistikat</a>
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
            <span className="hero-tag">Portali institucional i kërkimit</span>
            <h1>Zhvillo Kërkimin Shkencor në UMIB</h1>
            <p>Platformë për menaxhimin dhe organizimin e aktiviteteve kërkimore dhe akademike të stafit të UMIB.</p>
            <div className="hero-actions">
              <button className="btn-gold" onClick={() => navigate("/login")}>Fillo Tani</button>
              <button className="btn-outline" onClick={() => document.getElementById('insights').scrollIntoView({ behavior: 'smooth' })}>Shiko Statistikat</button>
            </div>
            <div className="hero-proof-strip" aria-label="Përmbledhje e portalit">
              <span><FileCheck2 size={17} /> Evidencë akademike</span>
              <span><WalletCards size={17} /> Rimbursime digjitale</span>
              <span><LineChart size={17} /> Raporte vendimmarrëse</span>
            </div>
          </div>
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

      {/* WORKFLOW SECTION */}
      <section className="portal-overview-section" id="overview">
        <div className="container portal-overview">
          <div className="portal-overview-copy">
            <span className="section-kicker">Proces i unifikuar</span>
            <h2>Nga publikimi te shqyrtimi, çdo hap në një vend</h2>
            <p>UMIBRes e bën rrjedhën e punës më të qartë për profesorët, komisionet dhe menaxhmentin akademik, duke lidhur evidencën shkencore me raportim dhe vendimmarrje.</p>
            <button className="overview-link" onClick={() => navigate("/login")}>
              Hyr në Portal <ChevronRight size={18} />
            </button>
          </div>
          <div className="workflow-list" aria-label="Rrjedha e punës në UMIBRes">
            <article className="workflow-item">
              <span className="workflow-step">01</span>
              <div className="workflow-card">
                <BookOpen size={24} />
                <h3>Regjistrim akademik</h3>
                <p>Publikimet, konferencat dhe aktivitetet ruhen si evidencë e strukturuar për secilin profil akademik.</p>
              </div>
            </article>
            <article className="workflow-item">
              <span className="workflow-step">02</span>
              <div className="workflow-card">
                <ShieldCheck size={24} />
                <h3>Shqyrtim transparent</h3>
                <p>Kërkesat përcillen në kanalet përkatëse për kontroll, komentim dhe miratim institucional.</p>
              </div>
            </article>
            <article className="workflow-item">
              <span className="workflow-step">03</span>
              <div className="workflow-card">
                <BarChart3 size={24} />
                <h3>Raportim i qartë</h3>
                <p>Të dhënat përmbledhen në pasqyra që ndihmojnë analizën e performancës dhe planifikimin akademik.</p>
              </div>
            </article>
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

      {/* INSIGHTS SECTION */}
      <section className="insights-section" id="insights">
        <div className="container">
          <div className="insights-shell">
            <div className="insights-header">
              <span className="section-kicker">Pasqyrë institucionale</span>
              <h2>Një platformë që lidh operacionet ditore me analizën strategjike</h2>
            </div>
            <div className="insights-grid">
              <article className="insight-card">
                <div className="insight-icon"><LineChart size={26} /></div>
                <h3>Dashboarde për vendimmarrje</h3>
                <p>Pasqyra për publikime, konferenca, rimbursime dhe performancë akademike sipas njësive.</p>
              </article>
              <article className="insight-card">
                <div className="insight-icon"><WalletCards size={26} /></div>
                <h3>Proces i qartë financiar</h3>
                <p>Kërkesat për rimbursim mbahen të gjurmueshme nga drafti deri te shqyrtimi final.</p>
              </article>
              <article className="insight-card">
                <div className="insight-icon"><Landmark size={26} /></div>
                <h3>Arkivë institucionale</h3>
                <p>Dokumentet dhe aktivitetet akademike ruhen në një strukturë të përbashkët për UMIB.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="main-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-links">
              <a href="#overview">Procesi</a>
              <a href="#services">Shërbimet</a>
              <a href="#insights">Statistikat</a>
              <a href="/login">Hyr në Portal</a>
            </div>
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
