import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  History,
  List,
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
  const reimbursementSubmenu = [
    { name: "Artikuj Shkencorë", target: "Rimbursime", reimbursementType: "publication" },
    { name: "Konferenca dhe Simpoziume", target: "Rimbursime", reimbursementType: "conference" },
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

  const handleMainItemClick = (itemName) => {
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
                  activePage === item.name ? "active" : ""
                }`}
                onClick={() => handleMainItemClick(item.name)}
                aria-expanded={item.name === "Rimbursime" ? isReimbursementMenuOpen : undefined}
              >
                <span className="prof-sidebar-icon">{item.icon}</span>
                <span className="prof-sidebar-text">{item.label}</span>
                {item.name === "Rimbursime" ? (
                  <span className="prof-sidebar-chevron" aria-hidden="true">
                    {isReimbursementMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                ) : null}
              </button>

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
