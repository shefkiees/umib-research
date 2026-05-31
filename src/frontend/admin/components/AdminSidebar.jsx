import React from "react"; 

import { 

  Users, 

  ShieldCheck, 

  ClipboardList, 

  Database,

  KeyRound, 

  Bell,

  BarChart3,

  BookOpen,

  FileCheck2,

  FileText,

  Wallet,

  Settings,

} from "lucide-react"; 

import umibLogo from "../../../assets/umiblogo.jpg";

import TransparentLogo from "../../common/TransparentLogo";

 

const mainItems = [ 

  { label: "Përdoruesit", route: "Përdoruesit", icon: Users }, 

  { label: "Rolet", route: "Rolet", icon: ShieldCheck },

  { label: "Rivendosja e qasjes", route: "Rivendosja e qasjes", icon: KeyRound }, 

  { label: "Historiku i veprimeve", route: "Historiku i veprimeve", icon: ClipboardList }, 

  { label: "Njoftimet", route: "Njoftimet", icon: Bell }, 

  { label: "Analitika", route: "Analitika", icon: BarChart3 }, 

  { label: "Revistat", route: "Revistat", icon: BookOpen }, 

  { label: "Shqyrtimi i publikimeve", route: "Shqyrtimi i publikimeve", icon: FileCheck2 }, 

  { label: "Raportet", route: "Raportet", icon: FileText }, 

  { label: "Buxheti", route: "Buxheti", icon: Wallet }, 

  { label: "Konfigurimet", route: "Konfigurimet", icon: Settings }, 

  { label: "Rezervimi", route: "Rezervimi", icon: Database }, 

]; 

 

export default function AdminSidebar({ activePage, onNavigate, navLabels }) { 

  return ( 

    <aside className="admin-sidebar"> 

      <div className="admin-sidebar-top"> 

        <div className="admin-brand"> 

          <div className="admin-brand-icon"> 

            <TransparentLogo src={umibLogo} alt="UMIB logo" className="admin-brand-logo" threshold={196} /> 

          </div> 

          <span className="admin-brand-role">UMIBRes</span> 

        </div> 

 

        <div className="admin-sidebar-section"> 

          <span className="admin-sidebar-label">MODULET</span> 

 

          <nav className="admin-nav" aria-label="Modulet navigimi"> 

            {mainItems.map((item) => { 

              const Icon = item.icon; 

 

              return ( 

                <button 

                  key={item.route} 

                  className={`admin-nav-item ${ 

                    activePage === item.route ? "is-active" : "" 

                  }`} 

                  type="button" 

                  onClick={() => onNavigate(item.route)} 

                > 

                  <span className="admin-nav-left"> 

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
 
