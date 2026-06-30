import React, { useEffect, useRef, useState } from "react";
import { Bell, Search, User, Settings, ArrowRight } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";

const fallbackProfileMenuItems = [
	{ id: "Njoftime", labelKey: "notifications", icon: Bell },
	{ id: "Profili", labelKey: "profile", icon: User },
	{ id: "Settings", labelKey: "settings", icon: Settings },
	{ id: "Logout", labelKey: "logout", icon: ArrowRight, tone: "danger" },
];

const activePageLabelKeys = {
	Statistikat: "statistics",
	"Kërkesat për Shqyrtim": "pendingReview",
	Shqyrtimi: "review",
	Vendimet: "decisions",
	Njoftime: "notifications",
	Settings: "settings",
};

const profileMenuLabelKeys = {
	Njoftime: "notifications",
	Profili: "profile",
	Settings: "settings",
	Logout: "logout",
};

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
	const { t } = useLanguage();
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
	const activePageTitle = activePageLabelKeys[activePage]
		? t(`committee.navigation.${activePageLabelKeys[activePage]}`)
		: activePage;
	const profileName = profile?.name || "Komision";
	const profileRole = profile?.role || "Komision";
	const profileAvatarUrl = profile?.avatarUrl || profile?.avatar_url || profile?.profileImage || profile?.profile_image || "";
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

	const getProfileMenuLabel = (item) => {
		const actionId = item.id || item.label;
		const labelKey = item.labelKey || profileMenuLabelKeys[actionId];

		return labelKey ? t(`committee.topbar.${labelKey}`) : (item.label || actionId);
	};

	return (
		<header className="committee-topbar">
			<div className="committee-topbar-left">
				<span className="committee-topbar-kicker">{title}</span>
				<h1>{activePageTitle}</h1>
			</div>

			<div className="committee-topbar-right">
				<label className="committee-search-wrap" htmlFor="committee-search-input">
					<Search size={20} />
					<input
						id="committee-search-input"
						type="text"
						className="committee-search"
						placeholder={t("committee.topbar.searchPlaceholder")}
						value={searchQuery}
						onChange={(event) => onSearchChange(event.target.value)}
					/>
				</label>

				<div className="committee-notification-wrap" ref={notificationsRef}>
					<button
						className="committee-icon-btn"
						type="button"
						aria-label={t("committee.topbar.notifications")}
						onClick={() => setIsNotificationsOpen((current) => !current)}
					>
						<Bell size={20} />
						{notificationCount > 0 ? (
							<span className="committee-dot">{notificationCount > 99 ? "99+" : notificationCount}</span>
						) : null}
					</button>

					{isNotificationsOpen ? (
						<div className="committee-popover" role="dialog" aria-label={t("committee.topbar.notificationsTitle")}>
							<div className="committee-popover-head">
								<div>
									<strong>{t("committee.topbar.notificationsTitle")}</strong>
									<p>{unreadCount} {t("committee.topbar.unreadLabel")}</p>
								</div>
								<button type="button" onClick={onMarkAllRead} disabled={unreadCount === 0}>
									{t("committee.topbar.markAllRead")}
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
												<span className="committee-notification-tag">{item.category || t("committee.topbar.notifications")}</span>
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
						<span className="committee-avatar">
							{profileAvatarUrl ? <img src={profileAvatarUrl} alt="" /> : initials}
						</span>
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
										<span>{getProfileMenuLabel(item)}</span>
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
