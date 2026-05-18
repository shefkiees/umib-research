import React, { useEffect, useRef, useState } from "react";
import { Bell, Search } from "lucide-react";

export default function AdminTopbar({
  activePage,
  searchQuery,
  onSearchChange,
  resultCount,
  notificationCount,
  notifications,
  onMarkAllRead,
  onProfileAction,
  profileMenuItems,
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

  const title = "Paneli i Administratorit";
  const subtitle = `${resultCount} rezultate`;

  return (
    <header className="admin-topbar">
      <div className="admin-topbar-left">
        <span className="admin-topbar-kicker">{title}</span>
        <h1>{activePage}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="admin-topbar-right">
        <label className="admin-search" htmlFor="admin-search-input">
          <Search size={18} />
          <input
            id="admin-search-input"
            type="text"
            placeholder="Kërko përdorues, log, rol..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <div className="admin-notification-wrap" ref={notificationsRef}>
          <button
            className="admin-icon-btn"
            type="button"
            aria-label="Njoftime"
            onClick={() => setIsNotificationsOpen((current) => !current)}
          >
            <Bell size={20} />
            {notificationCount > 0 ? (
              <span className="admin-dot">{notificationCount > 99 ? "99+" : notificationCount}</span>
            ) : null}
          </button>

          {isNotificationsOpen ? (
            <div className="admin-popover" role="dialog" aria-label="Njoftimet">
              <div className="admin-popover-head">
                <strong>Njoftimet</strong>
                <button type="button" onClick={onMarkAllRead}>
                  Shëno si të lexuara
                </button>
              </div>
              <ul>
                {notifications.map((item) => (
                  <li key={item.id} className={item.isRead ? "is-read" : ""}>
                    <p>{item.text}</p>
                    <span>{item.createdAt}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="admin-profile-wrap" ref={profileRef}>
          <button
            className="admin-profile-block"
            type="button"
            onClick={() => setIsProfileOpen((current) => !current)}
          >
            <div className="admin-profile-text">
              <h4>Administrator</h4>
              <p>System Admin</p>
            </div>
            <span className="admin-avatar">AD</span>
          </button>

          {isProfileOpen ? (
            <div className="admin-popover admin-profile-menu" role="menu">
              {profileMenuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onProfileAction(item.id);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}