import React, { useEffect, useRef, useState } from "react";
import { Bell, Search, User, Settings, ArrowRight } from "lucide-react";

const fallbackProfileMenuItems = [
	{ id: "Njoftime", label: "Njoftime", icon: Bell },
	{ id: "Edit Profile", label: "Edit Profile", icon: User },
	{ id: "Settings", label: "Settings", icon: Settings },
	{ id: "Logout", label: "Logout", icon: ArrowRight, tone: "danger" },
];

export default function CommitteeTopBar({
	activePage,
	searchQuery,
	onSearchChange,
	resultCount,
	notificationCount,
	notifications = [],
	onMarkAllRead,
	onProfileAction,
	profileMenuItems,
	profile,
	onNotificationRead,
}) {
	const [isProfileOpen, setIsProfileOpen] = useState(false);
	const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
	const profileRef = useRef(null);
	const notificationsRef = useRef(null);

	useEffect(() => {
		const handlePointerDown = (event) => {
			if (profileRef.current && !profileRef.current.contains(event.target)) {
				setIsProfileOpen(false);
			}

			if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
				setIsNotificationsOpen(false);
			}
		};

		document.addEventListener("mousedown", handlePointerDown);

		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
		};
	}, []);

	const title = "UMIBRes";
	const profileName = profile?.name || "Komisioni Shkencor";
	const profileRole = profile?.role || "Paneli i vleresimit";
	const initials = profileName
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	const unreadCount = notifications.filter((item) => !item.isRead).length;
	const resolvedProfileMenu = Array.isArray(profileMenuItems) && profileMenuItems.length
		? profileMenuItems
		: fallbackProfileMenuItems;

	return (
		<header className="committee-topbar">
			<div className="committee-topbar-left">
				<span className="committee-topbar-kicker">{title}</span>
				<h1>{activePage}</h1>
			</div>

			<div className="committee-topbar-right">
				<label className="committee-search-wrap" htmlFor="committee-search-input">
					<Search size={20} />
					<input
						id="committee-search-input"
						type="text"
						className="committee-search"
						placeholder="Kërko dorëzime, autorë, DOI..."
						value={searchQuery}
						onChange={(event) => onSearchChange(event.target.value)}
					/>
				</label>

				<div className="committee-notification-wrap" ref={notificationsRef}>
					<button
						className="committee-icon-btn"
						type="button"
						aria-label="Njoftime"
						onClick={() => setIsNotificationsOpen((current) => !current)}
					>
						<Bell size={20} />
						{notificationCount > 0 ? (
							<span className="committee-dot">{notificationCount > 99 ? "99+" : notificationCount}</span>
						) : null}
					</button>

					{isNotificationsOpen ? (
						<div className="committee-popover" role="dialog" aria-label="Njoftimet">
							<div className="committee-popover-head">
								<div>
									<strong>Njoftimet</strong>
									<p>{unreadCount} pa lexuara</p>
								</div>
								<button type="button" onClick={onMarkAllRead} disabled={unreadCount === 0}>
									Shëno si të lexuara
								</button>
							</div>
							<ul>
								{notifications.map((item) => (
									<li key={item.id} className={item.isRead ? "is-read" : ""}>
										<button
											type="button"
											className="committee-notification-item-btn"
											onClick={() => onNotificationRead?.(item.id)}
										>
											<div className="committee-notification-meta">
												<span className="committee-notification-tag">{item.category || "Njoftim"}</span>
												<span>{item.createdAt}</span>
											</div>
											<p>{item.title || item.text}</p>
											<span>{item.description || item.text}</span>
										</button>
									</li>
								))}
								{notifications.length === 0 ? <li className="is-read"><p>Nuk ka njoftime aktualisht.</p></li> : null}
							</ul>
						</div>
					) : null}
				</div>

				<div className="committee-profile-wrap" ref={profileRef}>
					<button
						className="committee-profile-block"
						type="button"
						onClick={() => setIsProfileOpen((current) => !current)}
					>
						<div className="committee-profile-text">
							<h4>{profileName}</h4>
							<p>{profileRole}</p>
						</div>
						<span className="committee-avatar">{initials}</span>
					</button>

					{isProfileOpen ? (
						<div className="committee-popover committee-profile-menu" role="menu">
							{resolvedProfileMenu.map((item) => {
								const ItemIcon = item.icon || User;
								const actionId = item.id || item.label;
								const isDanger = item.tone === "danger" || String(actionId).toLowerCase() === "logout";

								return (
									<button
										key={actionId}
										type="button"
										className={isDanger ? "is-danger" : undefined}
										onClick={() => {
											setIsProfileOpen(false);
											onProfileAction?.(actionId);
										}}
									>
										<ItemIcon size={18} className="committee-popover-icon" />
										<span>{item.label || actionId}</span>
									</button>
								);
							})}
						</div>
					) : null}
				</div>
			</div>
		</header>
	);
}
