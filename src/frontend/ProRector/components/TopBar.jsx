import React, { useEffect, useRef, useState } from "react";
import { Bell, Search, User, Settings, Link2, ArrowRight } from "lucide-react";

export default function ProRectorTopBar({
  activePage = "Fakultetet",
  searchQuery = "",
  onSearchChange,
  resultCount,
  notificationCount,
  notifications = [],
  onMarkAllRead,
  onProfileAction,
  profileMenuItems,
  profile,
  onEditProfile,
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

  const profileName = profile?.name || "Pro Rector for Research";
  const profileRole = profile?.role || "Zëvendës Rektor";
  const initials = profileName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  
  const unreadCount = notifications.filter((n) => !n.isRead).length;

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
            placeholder="Kërko dorëzime, autorë, DOI..."
            value={searchQuery}
            onChange={(event) => onSearchChange?.(event.target.value)}
          />
        </label>

        <div className="prorector-notification-wrap" ref={notificationsRef}>
          <button
            className="prorector-icon-btn"
            type="button"
            aria-label="Njoftime"
            onClick={() => setIsNotificationsOpen((current) => !current)}
          >
            <Bell size={20} />
            {unreadCount > 0 ? (
              <span className="prorector-dot">{unreadCount > 99 ? "99+" : unreadCount}</span>
            ) : null}
          </button>

          {isNotificationsOpen ? (
            <div className="prorector-popover prorector-notification-popover" role="dialog" aria-label="Njoftimet">
              <div className="prorector-popover-head">
                <div>
                  <strong>Njoftimet</strong>
                  <p>{unreadCount} pa lexuara</p>
                </div>
                <button type="button" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
                  Shëno si të lexuara
                </button>
              </div>
              <ul className="prorector-notification-list">
                {notifications.map((item) => (
                  <li key={item.id} className={item.isRead ? "is-read" : "is-unread"}>
                    <button
                      type="button"
                      className="prorector-notification-item-btn"
                      onClick={() => onNotificationRead?.(item.id)}
                    >
                      <div className="prorector-notification-item-meta">
                        <span className="prorector-notification-badge">{item.category || "Njoftim"}</span>
                        <span>{item.createdAt}</span>
                      </div>
                      <p className="prorector-notification-title">{item.title || item.text}</p>
                      <p className="prorector-notification-text">{item.description || item.text}</p>
                    </button>
                  </li>
                ))}
                {notifications.length === 0 ? (
                  <li className="is-read prorector-notification-empty">
                    <p>Nuk ka njoftime aktualisht.</p>
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
            <div>
              <h4>{profileName}</h4>
              <span>{profileRole}</span>
            </div>
          </button>

          {isProfileOpen ? (
            <div className="prorector-popover" role="dialog" aria-label="Profili">
              <button type="button" className="prorector-popover-item" onClick={() => {
                onEditProfile?.();
                setIsProfileOpen(false);
              }}>
                <User size={18} className="prorector-popover-icon" />
                <span>Edit Profile</span>
              </button>
              <button type="button" className="prorector-popover-item" onClick={() => {
                onProfileAction?.("Settings");
                setIsProfileOpen(false);
              }}>
                <Settings size={18} className="prorector-popover-icon" />
                <span>Settings</span>
              </button>
              <button type="button" className="prorector-popover-item" onClick={() => {
                onProfileAction?.("Integrime");
                setIsProfileOpen(false);
              }}>
                <Link2 size={18} className="prorector-popover-icon" />
                <span>Integrime</span>
              </button>
              <button type="button" className="prorector-popover-item prorector-popover-item--danger" onClick={() => {
                onProfileAction?.("Logout");
                setIsProfileOpen(false);
              }}>
                <ArrowRight size={18} className="prorector-popover-icon" />
                <span>Logout</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}