import {
  BookOpen,
  Calendar,
  History,
  List,
  Wallet,
  BarChart3,
} from "lucide-react";
import umibLogo from "../../../assets/umiblogo.jpg";
import TransparentLogo from "../../common/TransparentLogo";
import { useLanguage } from "../../i18n/LanguageContext";

export default function Sidebar({ activePage, onNavigate, setActivePage, onLogout }) {
  const { t } = useLanguage();
  const reimbursementSubmenu = [
    { name: "Publikime Shkencore", target: "Rimbursime" },
    { name: "Konferenca dhe Simpoziume", target: "Rimbursime" },
  ];
  const menuMain = [
    { name: "Statistika", label: t("navigation.statistics"), icon: <BarChart3 size={18} /> },
    { name: "Publikime", label: t("navigation.publications"), icon: <BookOpen size={18} /> },
    { name: "Lista e Publikimeve", label: t("navigation.publicationList"), icon: <List size={18} /> },
    { name: "Konferenca", label: t("navigation.conferences"), icon: <Calendar size={18} /> },
    { name: "Rimbursime", label: t("navigation.reimbursements"), icon: <Wallet size={18} /> },
    { name: "Historiku i Rimbursimeve", label: t("navigation.reimbursementHistory"), icon: <History size={18} /> },
  ];

  const handleNavigate = (page) => {
    if (typeof onNavigate === "function") {
      onNavigate(page);
      return;
    }

    if (typeof setActivePage === "function") {
      setActivePage(page);
    }
  };

  return (
    <aside className="prof-sidebar">
      <div className="prof-sidebar-top">
        <div className="prof-sidebar-brand">
          <div className="prof-brand-icon">
            <TransparentLogo src={umibLogo} alt="UMIB logo" className="prof-brand-logo" threshold={196} />
          </div>
          <span className="prof-brand-role">UMIBRes</span>
        </div>

        <div className="prof-sidebar-section">
          <span className="prof-sidebar-label">{t("navigation.modules")}</span>

          {menuMain.map((item) => (
            <div className="prof-sidebar-item" key={item.name}>
              <button
                className={`prof-sidebar-link ${
                  activePage === item.name ? "active" : ""
                }`}
                onClick={() => handleNavigate(item.name)}
              >
                <span className="prof-sidebar-icon">{item.icon}</span>
                <span className="prof-sidebar-text">{item.label}</span>
              </button>

              {item.name === "Rimbursime" ? (
                <div className="prof-sidebar-submenu" aria-label="Nenkategorite e rimbursimeve">
                  {reimbursementSubmenu.map((submenuItem) => (
                    <button
                      key={submenuItem.name}
                      type="button"
                      className="prof-sidebar-sublink"
                      onClick={() => handleNavigate(submenuItem.target)}
                    >
                      {submenuItem.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
