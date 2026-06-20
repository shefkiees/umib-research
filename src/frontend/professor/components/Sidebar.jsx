import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  History,
  Wallet,
  BarChart3,
} from "lucide-react";
import { useState } from "react";
import umibLogo from "../../../assets/umiblogo.jpg";
import TransparentLogo from "../../common/TransparentLogo";
import { useLanguage } from "../../i18n/LanguageContext";

export default function Sidebar({ activePage, activeReimbursementType = "", onNavigate, setActivePage, onLogout }) {
  const { t } = useLanguage();
  const [isReimbursementMenuOpen, setIsReimbursementMenuOpen] = useState(false);
  const [activeReimbursementSubmenu, setActiveReimbursementSubmenu] = useState("");
  const publicationSubmenu = [
    { name: "Artikuj reviste", label: "Artikuj reviste" },
    { name: "Punime konference", label: "Punime konference" },
    { name: "Libra / Kapituj", label: "Libra / Kapituj" },
    { name: "Të gjitha publikimet", label: "Të gjitha publikimet" },
  ];
  const publicationPages = publicationSubmenu.map((item) => item.name);
  const reimbursementSubmenu = [
    { name: "Artikuj Shkencorë", label: t("navigation.reimbursementScientificArticles"), target: "Rimbursime", reimbursementType: "publication" },
    { name: "Konferenca dhe Simpoziume", label: t("navigation.reimbursementConferences"), target: "Rimbursime", reimbursementType: "conference" },
  ];
  const menuMain = [
    { name: "Statistika", label: t("navigation.statistics"), icon: <BarChart3 size={18} /> },
    { name: "Publikime", label: t("navigation.publications"), icon: <BookOpen size={18} /> },
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

  const handleMainItemClick = (itemName) => {
    if (itemName === "Publikime") {
      setIsReimbursementMenuOpen(false);
      setActiveReimbursementSubmenu("");
      handleNavigate(itemName);
      return;
    }

    if (itemName === "Rimbursime") {
      setIsReimbursementMenuOpen((isOpen) => !isOpen);
      setActiveReimbursementSubmenu("");
      handleNavigate(itemName);
      return;
    }

    setIsReimbursementMenuOpen(false);
    setActiveReimbursementSubmenu("");
    handleNavigate(itemName);
  };

  const handleReimbursementSubmenuClick = (submenuItem) => {
    setIsReimbursementMenuOpen(true);
    setActiveReimbursementSubmenu(submenuItem.name);
    handleNavigate({
      page: submenuItem.target,
      reimbursementType: submenuItem.reimbursementType,
    });
  };

  const handlePublicationSubmenuClick = (page) => {
    setIsReimbursementMenuOpen(false);
    setActiveReimbursementSubmenu("");
    handleNavigate(page);
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
                type="button"
                className={`prof-sidebar-link ${
                  activePage === item.name || (item.name === "Publikime" && publicationPages.includes(activePage)) ? "active" : ""
                }`}
                onClick={() => handleMainItemClick(item.name)}
                aria-expanded={item.name === "Rimbursime" ? isReimbursementMenuOpen : item.name === "Publikime" ? true : undefined}
              >
                <span className="prof-sidebar-icon">{item.icon}</span>
                <span className="prof-sidebar-text">{item.label}</span>
                {item.name === "Publikime" || item.name === "Rimbursime" ? (
                  <span className="prof-sidebar-chevron" aria-hidden="true">
                    {item.name === "Publikime" || isReimbursementMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                ) : null}
              </button>

              {item.name === "Publikime" ? (
                <div className="prof-sidebar-submenu prof-sidebar-submenu--articles" aria-label="Nenkategorite e artikujve">
                  {publicationSubmenu.map((submenuItem) => (
                    <button
                      key={submenuItem.name}
                      type="button"
                      className={`prof-sidebar-sublink ${activePage === submenuItem.name ? "active" : ""}`}
                      onClick={() => handlePublicationSubmenuClick(submenuItem.name)}
                    >
                      {submenuItem.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {item.name === "Rimbursime" && isReimbursementMenuOpen ? (
                <div className="prof-sidebar-submenu" aria-label="Nenkategorite e rimbursimeve">
                  {reimbursementSubmenu.map((submenuItem) => (
                    <button
                      key={submenuItem.name}
                      type="button"
                      className={`prof-sidebar-sublink ${
                        activeReimbursementType
                          ? activeReimbursementType === submenuItem.reimbursementType ? "active" : ""
                          : activeReimbursementSubmenu === submenuItem.name ? "active" : ""
                      }`}
                      onClick={() => handleReimbursementSubmenuClick(submenuItem)}
                    >
                      {submenuItem.label}
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
