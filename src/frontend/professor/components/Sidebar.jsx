import {
  BookOpen,
  Calendar,
  Wallet,
  BarChart3,
} from "lucide-react";
import umibLogo from "../../../assets/umiblogo.jpg";
import TransparentLogo from "../../common/TransparentLogo";

export default function Sidebar({ activePage, onNavigate, setActivePage, onLogout }) {
  const menuMain = [
    { name: "Statistika", icon: <BarChart3 size={18} /> },
    { name: "Publikime", icon: <BookOpen size={18} /> },
    { name: "Konferenca", icon: <Calendar size={18} /> },
    { name: "Rimbursime", icon: <Wallet size={18} /> },
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
          <span className="prof-sidebar-label">MODULET</span>

          {menuMain.map((item) => (
            <button
              key={item.name}
              className={`prof-sidebar-link ${
                activePage === item.name ? "active" : ""
              }`}
              onClick={() => handleNavigate(item.name)}
            >
              <span className="prof-sidebar-icon">{item.icon}</span>
              <span className="prof-sidebar-text">{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}