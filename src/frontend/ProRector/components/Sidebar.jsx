import React from "react";
import { BookOpen, Building2, FileText, LayoutDashboard, WalletCards } from "lucide-react";
import umibLogo from "../../../assets/umiblogo.jpg";
import TransparentLogo from "../../common/TransparentLogo";

const mainItems = [
  { label: "Permbledhje", route: "Dashboard", icon: LayoutDashboard },
  { label: "Artikujt", route: "Artikujt", icon: BookOpen },
  { label: "Fakultetet", route: "Fakultetet", icon: Building2 },
  { label: "Financimet", route: "Financimet", icon: WalletCards },
  { label: "Raportet", route: "Raportet", icon: FileText },
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
          <span className="prorector-sidebar-label">MENU ANALITIK</span>
          <nav className="prorector-nav" aria-label="Modulet e Prorektorit">
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
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}
