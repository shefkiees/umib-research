import ConferenceManager from "../components/ConferenceManager";
import "../styles/ProfessorDashboard.css";

export default function ProfessorConferences() {
  return (
    <main className="prof-content">
      <article className="prof-card">
        <div className="prof-card-header">
          <div>
            <h3>Konferenca</h3>
            <p>Menaxho konferencat dhe afatet e aplikimit.</p>
          </div>
        </div>

        <ConferenceManager />
      </article>
    </main>
  );
}
