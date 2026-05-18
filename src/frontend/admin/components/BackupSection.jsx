import { Database, Clock3, RefreshCcw, ShieldAlert } from "lucide-react";

function BackupSection() {
  return (
    <section className="admin-section-card">
      <div className="admin-section-head">
        <div>
          <h2>Backup & Siguria</h2>
          <p>Kontrolli i të dhënave dhe aksesit në sistem</p>
        </div>

        <div className="admin-section-actions">
          <button className="admin-primary-btn">
            <Database size={18} />
            Backup manual
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
          <h3>Backup i fundit</h3>
          <p>I suksesshëm</p>
          <strong>24 orë më parë</strong>
        </div>

        <div className="admin-backup-card">
          <div className="admin-backup-card-top">
            <span className="admin-backup-card-icon admin-backup-card-icon--active">
              <RefreshCcw size={18} />
            </span>
          </div>
          <h3>Backup automatik</h3>
          <p>Çdo 24 orë</p>
          <strong>Aktiv</strong>
        </div>

        <div className="admin-backup-card">
          <div className="admin-backup-card-top admin-backup-card-top--end">
            <span className="admin-backup-card-icon admin-backup-card-icon--warning">
              <ShieldAlert size={18} />
            </span>
          </div>
          <h3>Alerts sigurie</h3>
          <div className="admin-backup-card-status">Kërkon vëmendje</div>
          <strong>2</strong>
        </div>
      </div>
    </section>
  );
}

export default BackupSection;