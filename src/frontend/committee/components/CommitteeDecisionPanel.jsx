import React from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";

export default function CommitteeDecisionPanel({
	decisions,
	onApprove,
	onReject,
	onReview,
	onViewAll,
	isStandalone = false,
	panelTitle = "Vendimet e Fundit",
}) {
	const getStatusClass = (status) => {
		if (status === "Në shqyrtim") return "in-review";
		if (status === "Gati për vendim") return "ready";
		if (status === "Për rishikim") return "revision";
		return "default";
	};

	return (
		<section className={`committee-card-panel ${isStandalone ? "committee-standalone" : ""}`}>
			<div className="committee-panel-head">
				<h3>{panelTitle}</h3>
				<button type="button" onClick={onViewAll}>
					Shiko të gjitha
				</button>
			</div>

			<div className="committee-decision-list">
				{decisions.map((item) => (
					<article className="committee-decision-item" key={item.id}>
						<div>
							<span className="committee-decision-id">{item.id}</span>
							<h4>{item.title}</h4>
							<p className={`committee-status-badge ${getStatusClass(item.status)}`}>{item.status}</p>
						</div>

						<div className="committee-decision-actions">
							<button
								className="review"
								type="button"
								aria-label="Kthe për rishikim"
								onClick={() => onReview(item.id)}
							>
								<RotateCcw size={17} />
							</button>
							<button
								className="approve"
								type="button"
								aria-label="Aprovo"
								onClick={() => onApprove(item.id)}
							>
								<CheckCircle2 size={17} />
							</button>
							<button
								className="reject"
								type="button"
								aria-label="Refuzo"
								onClick={() => onReject(item.id)}
							>
								<XCircle size={17} />
							</button>
						</div>
					</article>
				))}
				{decisions.length === 0 ? (
					<p className="committee-empty">Nuk ka dorëzime aktive për vendim.</p>
				) : null}
			</div>
		</section>
	);
}
