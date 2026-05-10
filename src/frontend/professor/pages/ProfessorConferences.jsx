import ConferenceManager from "../components/ConferenceManager";
import { useLanguage } from "../../i18n/LanguageContext";
import "../styles/ProfessorDashboard.css";

export default function ProfessorConferences() {
  const { t } = useLanguage();

  return (
    <main className="prof-content">
      <article className="prof-card">
        <div className="prof-card-header">
          <div>
            <h3>{t("navigation.conferences")}</h3>
            <p>{t("professor.dashboard.addConferenceDescription")}</p>
          </div>
        </div>

        <ConferenceManager />
      </article>
    </main>
  );
}
