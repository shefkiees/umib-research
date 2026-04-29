import React from "react";
import { AlertTriangle, Clock3, TimerReset } from "lucide-react";

export default function CommitteeSlaPanel({ slaSummary, onViewDetails, isStandalone = false }) {
	const slaItems = [
		{ title: "Brenda afatit", value: slaSummary.onTime, icon: Clock3, tone: "success" },
		{ title: "Afër afatit", value: slaSummary.nearDeadline, icon: AlertTriangle, tone: "warning" },
		{ title: "Tejkaluar", value: slaSummary.overdue, icon: TimerReset, tone: "danger" },
	];

	return (
		<section className={`committee-card-panel ${isStandalone ? "committee-standalone" : ""}`}>
			<div className="committee-panel-head">
				<h3>SLA dhe Afatet</h3>
				<button type="button" onClick={onViewDetails}>
					Detajet
				</button>
			</div>

			<div className="committee-mini-grid">
				{slaItems.map((item) => {
					const Icon = item.icon;

					return (
						<article className="committee-mini-card" key={item.title}>
							<span className={`committee-mini-icon tone-${item.tone}`}>
								<Icon size={18} />
							</span>
							<div>
								<h4>{item.value}</h4>
								<p>{item.title}</p>
							</div>
						</article>
					);
				})}
			</div>
		</section>
	);
}
