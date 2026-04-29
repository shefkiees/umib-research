import React from "react";
import { Inbox, FileText, Database, CheckCircle, Shield, BarChart3 as ReportsIcon } from "lucide-react";
import umibLogo from "../../../assets/umiblogo.jpg";
import TransparentLogo from "../../common/TransparentLogo";

const mainItems = [
	{ label: "Dorëzimet në Pritje", route: "Dorëzimet në Pritje", icon: Inbox },
	{ label: "Shqyrtimi", route: "Shqyrtimi", icon: FileText },
	{ label: "Metadata", route: "Metadata", icon: Database },
	{ label: "Vendimet", route: "Vendimet", icon: CheckCircle },
	{ label: "Auditimi", route: "Auditimi", icon: Shield },
	{ label: "Raporte", route: "Raporte", icon: ReportsIcon },
];

export default function CommitteeSidebar({ activePage, onNavigate, navLabels }) {
	return (
		<aside className="committee-sidebar">
			<div className="committee-sidebar-top">
				<div className="committee-brand">
					<span className="committee-brand-icon">
						<TransparentLogo src={umibLogo} alt="UMIB logo" className="committee-brand-logo" threshold={196} />
					</span>
					<span className="committee-brand-role">UMIBRes</span>
				</div>

				<div className="committee-sidebar-section">
					<span className="committee-sidebar-label">MODULET</span>
					<nav className="committee-nav" aria-label="Modulet navigimi">
						{mainItems.map((item) => {
							const Icon = item.icon;

							return (
								<button
									key={item.route}
									className={`committee-nav-item ${activePage === item.route ? "is-active" : ""}`}
									type="button"
									onClick={() => onNavigate(item.route)}
								>
									<span className="committee-nav-left">
										<Icon size={18} />
										<span>{item.label}</span>
									</span>
									{item.badge ? <span className="committee-badge">{item.badge}</span> : null}
								</button>
							);
						})}
					</nav>
				</div>
			</div>
		</aside>
	);
}
