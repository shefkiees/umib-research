import {
  BookOpen,
  ChevronDown,
  FileBadge2,
  FileText,
  History,
  Layers,
  Presentation as PresentationChart,
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
    { name: "Artikuj reviste", label: t("navigation.publicationJournalArticles"), icon: FileText },
    { name: "Punime të konferencave", label: t("navigation.publicationConferencePapers"), icon: PresentationChart },
    { name: "Libra / Kapituj", label: t("navigation.publicationBooksChapters"), icon: BookOpen },
    { name: "Të gjitha publikimet", label: t("navigation.publicationAll"), icon: Layers, legacyName: "Te gjithe Artikujt" },
  ];
  const publicationPages = publicationSubmenu.flatMap((item) => [item.name, item.legacyName].filter(Boolean));
  const [isPublicationMenuOpen, setIsPublicationMenuOpen] = useState(() => publicationPages.includes(activePage));
  const reimbursementSubmenu = [
    { name: "Rregullorja", label: t("navigation.regulation"), href: "/rregullorja-rimbursimeve.pdf", icon: FileText },
    { name: "Artikuj Shkencorë", label: `${t("navigation.reimbursementScientificArticles")} (F1)`, target: "Rimbursime", reimbursementType: "publication", icon: FileBadge2 },
    { name: "Konferenca dhe Simpoziume", label: `${t("navigation.reimbursementConferences")} (F2)`, target: "Rimbursime", reimbursementType: "conference", icon: PresentationChart },
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
      setIsPublicationMenuOpen(true);
      handleNavigate(itemName);
      return;
    }

    if (itemName === "Rimbursime") {
      setIsPublicationMenuOpen(false);
      setIsReimbursementMenuOpen((isOpen) => !isOpen);
      setActiveReimbursementSubmenu("");
      handleNavigate(itemName);
      return;
    }

    setIsReimbursementMenuOpen(false);
    setActiveReimbursementSubmenu("");
    setIsPublicationMenuOpen(false);
    handleNavigate(itemName);
  };

  const handleReimbursementSubmenuClick = (submenuItem) => {
    setIsReimbursementMenuOpen(true);

    if (submenuItem.href) {
      window.open(submenuItem.href, "_blank", "noopener,noreferrer");
      return;
    }

    setActiveReimbursementSubmenu(submenuItem.name);
    handleNavigate({
      page: submenuItem.target,
      reimbursementType: submenuItem.reimbursementType,
    });
  };

  const handlePublicationSubmenuClick = (page) => {
    setIsPublicationMenuOpen(true);
    setIsReimbursementMenuOpen(false);
    setActiveReimbursementSubmenu("");
    handleNavigate(page);
  };

  const handlePublicationChevronClick = (event) => {
    event.stopPropagation();
    setIsReimbursementMenuOpen(false);
    setActiveReimbursementSubmenu("");
    setIsPublicationMenuOpen((isOpen) => !isOpen);
  };

  const isPublicationSubmenuActive = (submenuItem) => activePage === submenuItem.name || activePage === submenuItem.legacyName;

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
                aria-expanded={item.name === "Rimbursime" ? isReimbursementMenuOpen : item.name === "Publikime" ? isPublicationMenuOpen : undefined}
              >
                <span className="prof-sidebar-icon">{item.icon}</span>
                <span className="prof-sidebar-text">{item.label}</span>
                {item.name === "Publikime" || item.name === "Rimbursime" ? (
                  <span
                    className={`prof-sidebar-chevron ${
                      (item.name === "Publikime" && isPublicationMenuOpen) || (item.name === "Rimbursime" && isReimbursementMenuOpen)
                        ? "is-open"
                        : ""
                    }`}
                    onClick={item.name === "Publikime" ? handlePublicationChevronClick : undefined}
                    aria-hidden="true"
                  >
                    <ChevronDown size={16} />
                  </span>
                ) : null}
              </button>

              {item.name === "Publikime" ? (
                <div
                  className={`prof-sidebar-submenu prof-sidebar-submenu--articles ${isPublicationMenuOpen ? "is-open" : ""}`}
                  aria-label="Nenkategorite e artikujve"
                >
                  {publicationSubmenu.map((submenuItem) => {
                    const SubmenuIcon = submenuItem.icon;

                    return (
                      <button
                        key={submenuItem.name}
                        type="button"
                        className={`prof-sidebar-sublink prof-sidebar-sublink--with-icon ${isPublicationSubmenuActive(submenuItem) ? "active" : ""}`}
                        onClick={() => handlePublicationSubmenuClick(submenuItem.name)}
                      >
                        <span className="prof-sidebar-subicon" aria-hidden="true">
                          <SubmenuIcon size={16} strokeWidth={1.9} />
                        </span>
                        <span>{submenuItem.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {item.name === "Rimbursime" && isReimbursementMenuOpen ? (
                <div className="prof-sidebar-submenu" aria-label="Nenkategorite e rimbursimeve">
                  {reimbursementSubmenu.map((submenuItem) => {
                    const SubmenuIcon = submenuItem.icon;

                    return (
                      <button
                        key={submenuItem.name}
                        type="button"
                        className={`prof-sidebar-sublink prof-sidebar-sublink--with-icon ${
                          activeReimbursementType
                            ? activeReimbursementType === submenuItem.reimbursementType ? "active" : ""
                            : activeReimbursementSubmenu === submenuItem.name ? "active" : ""
                        }`}
                        onClick={() => handleReimbursementSubmenuClick(submenuItem)}
                      >
                        <span className="prof-sidebar-subicon" aria-hidden="true">
                          <SubmenuIcon size={16} strokeWidth={1.9} />
                        </span>
                        <span>{submenuItem.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
