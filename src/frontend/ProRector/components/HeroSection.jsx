import React from "react";

export default function HeroSection() {
  return (
    <section className="pr-hero">
      <div className="pr-hero-content">
        <span className="pr-badge">VR-001 · Dashboard Institucional</span>
        <h2>Mirëseerdhët, Prof. Dr. Zëvendës Rektor</h2>
        <p>
          Monitoroni performancën e kërkimeve, analizoni KPI-të dhe merrni
          vendime strategjike.
        </p>
      </div>

      <div className="pr-hero-actions">
        <button className="primary-btn">Shiko Raportet</button>
        <button className="secondary-btn">Aprovo Kërkesat</button>
      </div>
    </section>
  );
}