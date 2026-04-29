import React from "react";
import { ArrowRight, BarChart3 } from "lucide-react";

export default function HeroSection({ profile, onPrimaryAction, onSecondaryAction }) {
  return (
    <section className="prof-hero">
      <div className="prof-hero-copy">
        <span className="prof-hero-kicker">UMIBRes Research Dashboard</span>
        <h2>Panel institucional per aktivitetin akademik</h2>
        <p>
          Menaxhoni profilin shkencor, publikimet, konferencat dhe rimbursimet ne
          nje mjedis te thjeshte, profesional dhe te gatshem per API integration.
        </p>

        <div className="prof-hero-meta">
          <div>
            <span>Profesori</span>
            <strong>{profile.name}</strong>
          </div>
          <div>
            <span>Njesia</span>
            <strong>{profile.faculty}</strong>
          </div>
        </div>
      </div>

      <div className="prof-hero-actions">
        <button className="primary-btn" onClick={onPrimaryAction} type="button">
          Shiko publikimet
          <ArrowRight size={16} />
        </button>
        <button className="secondary-btn" onClick={onSecondaryAction} type="button">
          <BarChart3 size={16} />
          Hap statistikat
        </button>
      </div>
    </section>
  );
}
