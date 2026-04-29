import React, { useMemo, useState } from "react";
import { ArrowLeft, BellRing, CheckCheck, Filter, Inbox, ScanSearch, Search, Sparkles } from "lucide-react";
import "../styles/CommitteeDashboard.css";

const initialNotifications = [
	{ id: 1, title: "Raporti mujor është gjeneruar", message: "Raporti për fakultetet u përditësua sot në orën 09:20.", time: "Sot", timeDetail: "09:20", isRead: false },
	{ id: 2, title: "FShMN ka përditësuar të dhënat", message: "Të dhënat akademike për FShMN janë sinkronizuar.", time: "Sot", timeDetail: "08:05", isRead: false },
	{ id: 3, title: "Eksporti i statistikave përfundoi", message: "Eksporti i tabelave dhe grafikut u përfundua me sukses.", time: "Dje", timeDetail: "17:42", isRead: true },
	{ id: 4, title: "Kërkesë e re në pritje", message: "Një dorëzim i ri ka hyrë në shqyrtim nga komisioni.", time: "Dje", timeDetail: "11:18", isRead: true },
];

export default function NotificationsPage() {
	const [query, setQuery] = useState("");
	const [showUnreadOnly, setShowUnreadOnly] = useState(false);
	const [items, setItems] = useState(initialNotifications);

	const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

	const filteredItems = useMemo(() => {
		const normalized = query.trim().toLowerCase();

		return items.filter((item) => {
			if (showUnreadOnly && item.isRead) {
				return false;
			}

			if (!normalized) {
				return true;
			}

			return `${item.title} ${item.message} ${item.time}`.toLowerCase().includes(normalized);
		});
	}, [items, query, showUnreadOnly]);

	const markAllRead = () => {
		setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
	};

	const markRead = (id) => {
		setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
	};

	const summaryCards = [
		{ id: "total", label: "Totali i njoftimeve", value: items.length, icon: Inbox, tone: "total" },
		{ id: "unread", label: "Te palexuara", value: unreadCount, icon: BellRing, tone: "unread" },
		{ id: "filtered", label: "Te filtruara", value: filteredItems.length, icon: ScanSearch, tone: "filtered" },
	];

	return (
		<section className="committee-page-card committee-notifications-registry">
			<header className="committee-notifications-registry-head">
				<div className="committee-notifications-registry-title">
					<button type="button" className="committee-registry-back" onClick={() => window.history.back()}>
						<ArrowLeft size={16} />
						Kthehu
					</button>
					<BellRing size={18} />
					<h3>Regjistri i njoftimeve</h3>
				</div>
				<span className="committee-notifications-registry-sort">Renditur kronologjikisht</span>
			</header>

			<div className="committee-notifications-registry-list">
				{filteredItems.map((item) => (
					<article key={item.id} className="committee-notifications-registry-item">
						<div className="committee-notifications-registry-main">
							<strong>{item.title}</strong>
							<p>{item.message}</p>
						</div>
						<div className="committee-notifications-registry-time">{item.time} · {item.timeDetail}</div>
					</article>
				))}
				{filteredItems.length === 0 ? <p className="committee-empty">Nuk ka njoftime per filtrin aktual.</p> : null}
			</div>
		</section>
	);
}
