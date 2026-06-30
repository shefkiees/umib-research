import React from "react";
import { Inbox, FileText, CheckCircle, LayoutDashboard } from "lucide-react";
import umibLogo from "../../../assets/umiblogo.jpg";
import TransparentLogo from "../../common/TransparentLogo";
import { useLanguage } from "../../i18n/LanguageContext";

const mainItems = [
	{ labelKey: "statistics", route: "Statistikat", icon: LayoutDashboard },
	{ labelKey: "pendingReview", route: "Kërkesat për Shqyrtim", icon: Inbox },
	{ labelKey: "review", route: "Shqyrtimi", icon: FileText },
	{ labelKey: "decisions", route: "Vendimet", icon: CheckCircle },
];

export default function CommitteeSidebar({ activePage, onNavigate, navLabels }) {
	const { t } = useLanguage();

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
					<span className="committee-sidebar-label">{t("committee.navigation.modules")}</span>
					<nav className="committee-nav" aria-label={t("committee.navigation.modules")}>
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
										<span>{t(`committee.navigation.${item.labelKey}`)}</span>
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
