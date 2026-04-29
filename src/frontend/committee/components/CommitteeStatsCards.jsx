import React from "react";
import { CircleCheck, CircleX, RotateCcw, Inbox } from "lucide-react";

const stats = [
	{
		title: "DORËZIME NË PRITJE",
		key: "pending",
		note: "Në radhë për vlerësim nga komisioni",
		icon: Inbox,
		tone: "neutral",
	},
	{
		title: "TË APROVUARA",
		key: "approved",
		note: "Vendime pozitive të finalizuara",
		icon: CircleCheck,
		tone: "success",
	},
	{
		title: "TË REFUZUARA",
		key: "rejected",
		note: "Raste të mbyllura me refuzim",
		icon: CircleX,
		tone: "danger",
	},
	{
		title: "PËR RISHIKIM",
		key: "review",
		note: "Kthyer te autorët për përmirësim",
		icon: RotateCcw,
		tone: "warning",
	},
];

export default function CommitteeStatsCards({ statsValues }) {
	return (
		<section className="committee-stats-grid">
			{stats.map((item) => {
				const Icon = item.icon;

				return (
					<article className="committee-stat-card" key={item.title}>
						<div className="committee-stat-head">
							<span className="committee-stat-title">{item.title}</span>
							<span className={`committee-stat-icon tone-${item.tone}`}>
								<Icon size={20} />
							</span>
						</div>

						<h3>{statsValues[item.key]}</h3>
						<p>{item.note}</p>
					</article>
				);
			})}
		</section>
	);
}
