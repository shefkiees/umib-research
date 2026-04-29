import React, { useEffect, useRef, useState } from "react";
import { Bell, Search, User, Settings, Link2, ArrowRight } from "lucide-react";

const fallbackMenuItems = [
  { id: "EditProfile", label: "Edit Profile", icon: User },
  { id: "Settings", label: "Settings", icon: Settings },
  { id: "Integrime", label: "Integrime", icon: Link2 },
  { id: "Logout", label: "Logout", icon: ArrowRight, tone: "danger" },
];

export default function TopBar({
  activePage,
  profile,
  notificationCount = 0,
  menuItems = [],
  onMenuAction,
  searchQuery = "",
  onSearchChange,
  notifications = [],
  onMarkAllRead,
  onNotificationAction,
}) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const notificationsRef = useRef(null);
  const profileRef = useRef(null);

  const title = activePage || "Statistika";
  const name = profile?.name || "Prof. Ajete Ibishi";
  const role = profile?.role || "Professor i rregullt";
  const resolvedMenuItems = menuItems.length ? menuItems : fallbackMenuItems;
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  return (
    <header className="prof-topbar">
      <div className="prof-topbar-left">
        <h1>{title}</h1>
      </div>

      <div className="prof-topbar-right">
        <label className="prof-search-wrap" htmlFor="prof-search-input">
          <Search size={20} />
          <input
            id="prof-search-input"
            type="text"
            className="prof-search"
            placeholder="Kerko publikime, konferenca ose kerkesa..."
            value={searchQuery}
            onChange={(event) => {
              if (typeof onSearchChange === "function") {
                onSearchChange(event.target.value);
              }
            }}
          />
        </label>

        <div className="prof-notification-wrap" ref={notificationsRef}>
          <button
            className="prof-icon-btn"
            type="button"
            aria-label="Njoftime"
            onClick={() => setIsNotificationsOpen((current) => !current)}
          >
            <Bell size={20} />
            {notificationCount > 0 ? <span className="prof-bell-badge">{notificationCount > 99 ? "99+" : notificationCount}</span> : null}
          </button>

          {isNotificationsOpen ? (
            <div className="prof-notification-popover" role="dialog" aria-label="Njoftimet">
              <div className="prof-notification-popover-head">
                <div>
                  <strong>Njoftimet</strong>
                  <p>{unreadCount} pa lexuara</p>
                </div>
                <button
                  type="button"
                  disabled={unreadCount === 0}
                  onClick={() => {
                    if (typeof onMarkAllRead === "function") {
                      onMarkAllRead();
                    }
                  }}
                >
                  Sheno si te lexuara
                </button>
              </div>

              <ul className="prof-notification-list-mini">
                {notifications.map((item) => (
                  <li key={item.id} className={item.isRead ? "is-read" : ""}>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof onNotificationAction === "function") {
                          onNotificationAction(item.id);
                        }
                      }}
                    >
                      <div className="prof-notification-meta">
                        <span className="prof-notification-tag">{item.category || "Njoftim"}</span>
                        <span>{item.createdAt}</span>
                      </div>
                      <p className="prof-notification-title">{item.title || item.text}</p>
                      <p className="prof-notification-description">{item.description || item.text}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="prof-profile-wrap" ref={profileRef}>
          <button
            className="prof-profile-btn"
            type="button"
            onClick={() => setIsProfileOpen((current) => !current)}
          >
            <div>
              <h4>{name}</h4>
              <span>{role}</span>
            </div>
            <div className="prof-avatar">{initials}</div>
          </button>

          {isProfileOpen ? (
            <div className="prof-popover" role="dialog" aria-label="Profili">
              {resolvedMenuItems.map((item) => {
                const ItemIcon = item.icon || User;
                const actionId = item.id || item.label;
                const isDanger = item.tone === "danger" || String(actionId).toLowerCase() === "logout";

                return (
                  <button
                    key={actionId}
                    type="button"
                    className={`prof-popover-item${isDanger ? " prof-popover-item--danger" : ""}`}
                    onClick={() => {
                      onMenuAction?.(actionId);
                      setIsProfileOpen(false);
                    }}
                  >
                    <ItemIcon size={18} className="prof-popover-icon" />
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