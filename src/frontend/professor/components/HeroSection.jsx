import React from "react";
import { ArrowRight, BarChart3 } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";

export default function HeroSection({ profile, onPrimaryAction, onSecondaryAction }) {
  const { t } = useLanguage();

  return (
    <section className="prof-hero">
      <div className="prof-hero-copy">
        <span className="prof-hero-kicker">{t("professor.dashboard.heroBadge")}</span>
        <h2>{t("professor.dashboard.heroTitle")}</h2>
        <p>{t("professor.dashboard.heroDescription")}</p>

        <div className="prof-hero-meta">
          <div>
            <span>{t("professor.dashboard.professor")}</span>
            <strong>{profile.name}</strong>
          </div>
          <div>
            <span>{t("professor.dashboard.faculty")}</span>
            <strong>{profile.faculty}</strong>
          </div>
        </div>
      </div>

      <div className="prof-hero-actions">
        <button className="primary-btn" onClick={onPrimaryAction} type="button">
          {t("professor.dashboard.viewPublications")}
          <ArrowRight size={16} />
        </button>
        <button className="secondary-btn" onClick={onSecondaryAction} type="button">
          <BarChart3 size={16} />
          {t("professor.dashboard.openStatistics")}
        </button>
      </div>
    </section>
  );
}
