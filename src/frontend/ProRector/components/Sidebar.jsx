import React from "react";
import { BookOpen, Building2, FileText, LayoutDashboard, WalletCards } from "lucide-react";
import umibLogo from "../../../assets/umiblogo.jpg";
import TransparentLogo from "../../common/TransparentLogo";
import { useLanguage } from "../../i18n/LanguageContext";

const mainItems = [
  { labelKey: "dashboard", route: "Dashboard", icon: LayoutDashboard },
  { labelKey: "articles", route: "Artikujt", icon: BookOpen },
  { labelKey: "faculties", route: "Fakultetet", icon: Building2 },
  { labelKey: "funding", route: "Financimet", icon: WalletCards },
  { labelKey: "reports", route: "Raportet", icon: FileText },
];

const SIDEBAR_COPY = {
  sq: {
    menuLabel: "Menu analitik",
    navLabel: "Modulet e Prorektorit",
    items: {
      dashboard: "Përmbledhje",
      articles: "Artikujt",
      faculties: "Fakultetet",
      funding: "Financimet",
      reports: "Raportet",
    },
  },
  en: {
    menuLabel: "Analytics menu",
    navLabel: "ProRector modules",
    items: {
      dashboard: "Overview",
      articles: "Articles",
      faculties: "Faculties",
      funding: "Funding",
      reports: "Reports",
    },
  },
};

export default function ProRectorSidebar({ activePage, setActivePage }) {
  const { language } = useLanguage();
  const copy = SIDEBAR_COPY[language] || SIDEBAR_COPY.sq;

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
          <span className="prorector-sidebar-label">{copy.menuLabel}</span>
          <nav className="prorector-nav" aria-label={copy.navLabel}>
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
                    <span>{copy.items[item.labelKey]}</span>
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
