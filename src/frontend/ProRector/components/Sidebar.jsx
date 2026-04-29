import React from "react";
import { Inbox, FileText, Database, CheckCircle, Shield, BarChart3 as ReportsIcon } from "lucide-react";
import umibLogo from "../../../assets/umiblogo.jpg";
import TransparentLogo from "../../common/TransparentLogo";

const mainItems = [
  { label: "Fakultetet", route: "Fakultetet", icon: Database },
  { label: "Publikime", route: "Publikime", icon: CheckCircle },
  { label: "Konferenca", route: "Konferenca", icon: Inbox },
  { label: "Rimbursime", route: "Rimbursime", icon: Shield },
  { label: "Aprovime", route: "Aprovime", icon: FileText },
  { label: "Raporte", route: "Raporte", icon: ReportsIcon },
];

export default function ProRectorSidebar({ activePage, setActivePage }) {
  return (
    <aside className="prorector-sidebar">
      <div className="prorector-sidebar-top">
        <div className="prorector-brand">
          <span className="prorector-brand-icon">
            <TransparentLogo src={umibLogo} alt="UMIB logo" className="prorector-brand-logo" threshold={196} />
          </span>
          <span className="prorector-brand-role">UMIBRes</span>
        </div>

        <div className="prorector-sidebar-section">
          <span className="prorector-sidebar-label">MENU STRATEGJIK</span>
          <nav className="prorector-nav" aria-label="Modulet navigimi">
            {mainItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.route}
                  className={`prorector-nav-item ${activePage === item.route ? "is-active" : ""}`}
                  type="button"
                  onClick={() => setActivePage(item.route)}
                >
                  <span className="prorector-nav-left">
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </span>
                  {item.badge ? <span className="prorector-badge">{item.badge}</span> : null}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}