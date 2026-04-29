import React from "react";
import { ClipboardCheck, ShieldCheck } from "lucide-react";

export default function CommitteeHero({ onOpenPending, onOpenAudit, filteredCount }) {
	return (
		<section className="committee-hero">
			<span className="committee-hero-tag">UMIBRES</span>
			<h2>Menaxhimi i Dorëzimeve Akademike</h2>
			<p>
				Shqyrtoni dorëzimet, regjistroni vendimet dhe mbani një proces transparent
				dhe të standardizuar për komisionin.
			</p>

			<div className="committee-hero-actions">
				<button className="committee-primary-btn" type="button" onClick={onOpenPending}>
					<ClipboardCheck size={18} />
					<span>Shiko Dorëzimet</span>
				</button>
				<button className="committee-secondary-btn" type="button" onClick={onOpenAudit}>
					<ShieldCheck size={18} />
					<span>Shiko Raportet</span>
				</button>
			</div>
		</section>
	);
}
