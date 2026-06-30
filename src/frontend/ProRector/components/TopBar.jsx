import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Bell, Pencil, Search, Settings } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";

const TOPBAR_COPY = {
  sq: {
    fallbackRole: "Zëvendës Rektor",
    prorectorRole: "ProRector",
    searchPlaceholder: "Kërko statistika, autorë, fakultete...",
    notifications: "Njoftimet",
    unread: "pa lexuara",
    markAllRead: "Shëno si të lexuara",
    loadingNotifications: "Duke ngarkuar njoftimet...",
    notificationCategory: "Njoftim",
    noNotifications: "Nuk ka njoftime aktualisht.",
    profile: "Profili",
    editProfile: "Ndrysho profilin",
    settings: "Cilësimet",
    logout: "Dil",
  },
  en: {
    fallbackRole: "Vice Rector",
    prorectorRole: "ProRector",
    searchPlaceholder: "Search statistics, authors, faculties...",
    notifications: "Notifications",
    unread: "unread",
    markAllRead: "Mark all as read",
    loadingNotifications: "Loading notifications...",
    notificationCategory: "Notification",
    noNotifications: "No notifications right now.",
    profile: "Profile",
    editProfile: "Edit profile",
    settings: "Settings",
    logout: "Log out",
  },
};

function getDisplayRole(role, copy) {
  const normalized = String(role || "").trim().toLowerCase();

  if (["prorector", "prorektor", "pro-rector", "pro-rektor"].includes(normalized)) {
    return copy.prorectorRole;
  }

  return role || copy.fallbackRole;
}

export default function ProRectorTopBar({
  activePage = "Fakultetet",
  searchQuery = "",
  onSearchChange,
  resultCount,
  notificationCount,
  notifications = [],
  notificationsLoading = false,
  notificationsError = "",
  onNotificationsOpen,
  onMarkAllRead,
  onProfileAction,
  profileMenuItems,
  profile,
  onEditProfile,
  onNotificationRead,
}) {
  const { language } = useLanguage();
  const copy = TOPBAR_COPY[language] || TOPBAR_COPY.sq;
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

  const profileName = profile?.name || "Pro Rector for Research";
  const profileRole = getDisplayRole(profile?.role, copy);
  const profilePhotoUrl = profile?.profilePhotoUrl || profile?.avatarUrl || profile?.photoUrl || profile?.picture || "";
  const initials = profileName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  
  const unreadCount = Number.isFinite(notificationCount)
    ? notificationCount
    : notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = () => {
    if (typeof onMarkAllRead === "function") {
      onMarkAllRead();
      return;
    }

    notifications.forEach((n) => onNotificationRead?.(n.id));
  };

  return (
    <header className="prorector-topbar">
      <div className="prorector-topbar-right">
        <label className="prorector-search-wrap" htmlFor="prorector-search-input">
          <Search size={20} />
          <input
            id="prorector-search-input"
            type="text"
            className="prorector-search"
            placeholder={copy.searchPlaceholder}
            value={searchQuery}
            onChange={(event) => onSearchChange?.(event.target.value)}
          />
        </label>

        <div className="prorector-notification-wrap" ref={notificationsRef}>
          <button
            className="prorector-icon-btn"
            type="button"
            aria-label={copy.notifications}
            onClick={() => setIsNotificationsOpen((current) => {
              const next = !current;
              if (next) {
                onNotificationsOpen?.();
              }
              return next;
            })}
          >
            <Bell size={20} />
            {unreadCount > 0 ? (
              <span className="prorector-dot">{unreadCount > 99 ? "99+" : unreadCount}</span>
            ) : null}
          </button>

          {isNotificationsOpen ? (
            <div className="prorector-popover prorector-notification-popover" role="dialog" aria-label={copy.notifications}>
              <div className="prorector-popover-head">
                <div>
                  <strong>{copy.notifications}</strong>
                  <p>{unreadCount} {copy.unread}</p>
                </div>
                <button type="button" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
                  {copy.markAllRead}
                </button>
              </div>
              <ul className="prorector-notification-list">
                {notificationsLoading ? (
                  <li className="is-read prorector-notification-empty">
                    <p>{copy.loadingNotifications}</p>
                  </li>
                ) : null}
                {!notificationsLoading && notificationsError ? (
                  <li className="is-read prorector-notification-empty">
                    <p>{notificationsError}</p>
                  </li>
                ) : null}
                {!notificationsLoading && !notificationsError && notifications.map((item) => (
                  <li key={item.id} className={item.isRead ? "is-read" : "is-unread"}>
                    <button
                      type="button"
                      className="prorector-notification-item-btn"
                      onClick={() => onNotificationRead?.(item.id)}
                    >
                      <div className="prorector-notification-item-meta">
                        <span className="prorector-notification-badge">{item.category || copy.notificationCategory}</span>
                        <span>{item.createdAt}</span>
                      </div>
                      <p className="prorector-notification-title">{item.title || item.text}</p>
                      <p className="prorector-notification-text">{item.description || item.text}</p>
                    </button>
                  </li>
                ))}
                {!notificationsLoading && !notificationsError && notifications.length === 0 ? (
                  <li className="is-read prorector-notification-empty">
                    <p>{copy.noNotifications}</p>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="prorector-profile-wrap" ref={profileRef}>
          <button
            className="prorector-profile-btn"
            type="button"
            onClick={() => setIsProfileOpen((current) => !current)}
          >
            <div className="prorector-profile-copy">
              <h4>{profileName}</h4>
              <span>{profileRole}</span>
            </div>
            <span className="prorector-profile-avatar" aria-hidden="true">
              {profilePhotoUrl ? <img src={profilePhotoUrl} alt="" /> : initials}
            </span>
          </button>

          {isProfileOpen ? (
            <div className="prorector-popover" role="dialog" aria-label={copy.profile}>
              <button type="button" className="prorector-popover-item" onClick={() => {
                onEditProfile?.();
                setIsProfileOpen(false);
              }}>
                <Pencil size={18} className="prorector-popover-icon" />
                <span>{copy.editProfile}</span>
              </button>
              <button type="button" className="prorector-popover-item" onClick={() => {
                onProfileAction?.("Settings");
                setIsProfileOpen(false);
              }}>
                <Settings size={18} className="prorector-popover-icon" />
                <span>{copy.settings}</span>
              </button>
              <button type="button" className="prorector-popover-item prorector-popover-item--danger" onClick={() => {
                onProfileAction?.("Logout");
                setIsProfileOpen(false);
              }}>
                <ArrowRight size={18} className="prorector-popover-icon" />
                <span>{copy.logout}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
