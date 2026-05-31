import { Clock3, Database, RefreshCcw, ShieldAlert } from "lucide-react";

function BackupSection() {
  return (
    <section className="admin-section-card">
      <div className="admin-section-head">
        <div>
          <h2>Rezervimi dhe siguria</h2>
          <p>Kontrolli i të dhënave dhe qasjes në sistem</p>
        </div>

        <div className="admin-section-actions">
          <button className="admin-primary-btn" type="button">
            <Database size={18} />
            Rezervim manual
          </button>
        </div>
      </div>

      <div className="admin-backup-grid">
        <div className="admin-backup-card">
          <div className="admin-backup-card-top">
            <span className="admin-backup-card-icon admin-backup-card-icon--success">
              <Clock3 size={18} />
            </span>
          </div>
          <h3>Rezervimi i fundit</h3>
          <p>I suksesshëm</p>
          <strong>24 orë më parë</strong>
        </div>

        <div className="admin-backup-card">
          <div className="admin-backup-card-top">
            <span className="admin-backup-card-icon admin-backup-card-icon--active">
              <RefreshCcw size={18} />
            </span>
          </div>
          <h3>Rezervimi automatik</h3>
          <p>Çdo 24 orë</p>
          <strong>Aktiv</strong>
        </div>

        <div className="admin-backup-card">
          <div className="admin-backup-card-top admin-backup-card-top--end">
            <span className="admin-backup-card-icon admin-backup-card-icon--warning">
              <ShieldAlert size={18} />
            </span>
          </div>
          <h3>Paralajmërime sigurie</h3>
          <div className="admin-backup-card-status">Kërkon vëmendje</div>
          <strong>2</strong>
        </div>
      </div>
    </section>
  );
}

export default BackupSection;
