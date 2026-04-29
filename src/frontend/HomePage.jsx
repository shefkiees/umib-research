import React from "react";
import { useNavigate } from "react-router-dom";
import { 
  BookOpen, 
  FlaskConical, 
  Users, 
  Globe, 
  ChevronRight, 
  Mail, 
  MapPin, 
  PhoneCall,
  Lock
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
            <a href="#about">Rreth Portalit</a>
            <a href="#services">Statistikat</a>
            <a href="#contact">Kontakti</a>
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
            <h1>Eksploro dhe Avanco Kërkimin në UMIB</h1>
            <p>Një platformë e integruar për profesorët, rektoratin dhe komisionet shkencore për të menaxhuar botimet, konferencat dhe performancën akademike.</p>
            <div className="hero-actions">
              <button className="btn-gold" onClick={() => navigate("/login")}>Fillo Tani</button>
              <button className="btn-outline" onClick={() => document.getElementById('services').scrollIntoView({ behavior: 'smooth' })}>Shiko Statistikat</button>
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

      {/* SERVICES SECTION */}
      <section className="services-section" id="services">
        <div className="container">
          <div className="section-header">
            <h2>Pse Portali UMIBRes?</h2>
            <div className="gold-divider"></div>
            <p className="section-desc">Platforma jonë ofron mjete të fuqishme për menaxhimin e të dhënave shkencore dhe monitorimin e performancës.</p>
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

      {/* CONTACT SECTION */}
      <section className="contact-section" id="contact">
        <div className="container">
          <div className="contact-card">
            <div className="contact-info">
              <h2>Na Kontaktoni</h2>
              <p>Keni pyetje rreth portalit apo keni nevojë për ndihmë teknike? Stafi ynë është këtu për t'ju mbështetur.</p>
              <div className="info-list">
                <div className="info-item">
                  <MapPin size={20} className="info-icon" />
                  <span>Mitrovicë, Kosovë</span>
                </div>
                <div className="info-item">
                  <Mail size={20} className="info-icon" />
                  <span>info@umib.net</span>
                </div>
                <div className="info-item">
                  <PhoneCall size={20} className="info-icon" />
                  <span>+383 (0) 28 535 725</span>
                </div>
              </div>
            </div>
            <form className="contact-form">
              <div className="form-group">
                <input type="text" placeholder="Emri dhe Mbiemri" className="form-input" />
              </div>
              <div className="form-group">
                <input type="email" placeholder="Email-i Zyrtar" className="form-input" />
              </div>
              <div className="form-group">
                <textarea placeholder="Mesazhi juaj..." className="form-textarea"></textarea>
              </div>
              <button type="submit" className="btn-navy">Dërgo Mesazhin</button>
            </form>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="main-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <TransparentLogo src={UMIBLogo} alt="UMIB Logo" className="footer-logo" />
              <p>Universiteti "Isa Boletini" Mitrovicë<br />Portali i Kërkimit Shkencor</p>
            </div>
            <div className="footer-links">
              <a href="#">Privatësia</a>
              <a href="#">Kushtet e Përdorimit</a>
              <a href="#">Help Desk</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 UMIB. Të gjitha të drejtat e rezervuara. Zhvilluar nga Ekipi IT.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}