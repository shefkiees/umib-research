import React from "react"; 

import { 

  Users, 

  ShieldCheck, 

  ClipboardList, 

  Database, 

} from "lucide-react"; 

import umibLogo from "../../../assets/umiblogo.jpg";

import TransparentLogo from "../../common/TransparentLogo";

 

const mainItems = [ 

  { label: "Përdoruesit", route: "Përdoruesit", icon: Users }, 

  { label: "Rolet", route: "Rolet", icon: ShieldCheck }, 

  { label: "Audit Logs", route: "Audit Logs", icon: ClipboardList }, 

  { label: "Backup", route: "Backup", icon: Database }, 

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
 