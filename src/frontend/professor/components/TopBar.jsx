import React, { useEffect, useRef, useState } from "react";
import { Bell, Search, User, Settings, Link2, ArrowRight } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";

export default function TopBar({
  activePage,
  profile,
  notificationCount = 0,
  menuItems = [],
  onMenuAction,
  searchQuery = "",
  onSearchChange,
  searchResults = [],
  onSearchResultSelect,
  notifications = [],
  onMarkAllRead,
  onNotificationAction,
  onNotificationsOpen,
  searchPlaceholder = "Kerko publikime, konferenca ose kerkesa...",
  notificationsAriaLabel = "Njoftime",
  notificationsTitle = "Njoftimet",
  unreadLabel = "pa lexuara",
  markAllReadLabel = "Sheno si te lexuara",
  emptyNotificationsLabel = "No notifications available yet.",
  profileDialogLabel,
}) {
  const { t } = useLanguage();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const notificationsRef = useRef(null);
  const profileRef = useRef(null);
  const searchRef = useRef(null);

  const title = activePage || t("navigation.statistics");
  const name = profile?.name || t("professor.profileFallbackName");
  const role = profile?.role || t("professor.profileFallbackRole");
  const fallbackMenuItems = [
    { id: "EditProfile", label: t("topbar.menuEditProfile"), icon: User },
    { id: "Settings", label: t("topbar.menuSettings"), icon: Settings },
    { id: "Integrime", label: t("topbar.menuIntegrations"), icon: Link2 },
    { id: "Logout", label: t("topbar.menuLogout"), icon: ArrowRight, tone: "danger" },
  ];
  const resolvedMenuItems = menuItems.length ? menuItems : fallbackMenuItems;
  const unreadCount = notifications.length
    ? notifications.filter((item) => !item.isRead).length
    : notificationCount;
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
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
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
        <div className="prof-search-area" ref={searchRef}>
          <label className="prof-search-wrap" htmlFor="prof-search-input">
            <Search size={20} />
            <input
              id="prof-search-input"
              type="text"
              className="prof-search"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(event) => {
                setIsSearchOpen(true);
                if (typeof onSearchChange === "function") {
                  onSearchChange(event.target.value);
                }
              }}
            />
          </label>

          {isSearchOpen && searchResults.length ? (
            <div className="prof-search-dropdown" role="listbox" aria-label="Rezultatet e kerkimit">
              {searchResults.map((item) => (
                <button
                  type="button"
                  className="prof-search-result"
                  key={item.id}
                  onClick={() => {
                    setIsSearchOpen(false);
                    if (typeof onSearchResultSelect === "function") {
                      onSearchResultSelect(item);
                    }
                  }}
                >
                  <span className="prof-search-result-title">{item.title}</span>
                  <span className="prof-search-result-meta">{item.meta}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="prof-notification-wrap" ref={notificationsRef}>
          <button
            className="prof-icon-btn"
            type="button"
            aria-label={notificationsAriaLabel}
            onClick={() => {
              setIsNotificationsOpen((current) => {
                const next = !current;
                if (next && typeof onNotificationsOpen === "function") {
                  onNotificationsOpen();
                }
                return next;
              });
            }}
          >
            <Bell size={20} />
            {notificationCount > 0 ? <span className="prof-bell-badge">{notificationCount > 99 ? "99+" : notificationCount}</span> : null}
          </button>

          {isNotificationsOpen ? (
            <div className="prof-notification-popover" role="dialog" aria-label={notificationsTitle}>
              <div className="prof-notification-popover-head">
                <div>
                  <strong>{notificationsTitle}</strong>
                  <p>{unreadCount} {unreadLabel}</p>
                </div>
                <button
                  type="button"
                  disabled={unreadCount === 0 || notifications.length === 0}
                  onClick={() => {
                    if (typeof onMarkAllRead === "function") {
                      onMarkAllRead();
                    }
                  }}
                >
                  {markAllReadLabel}
                </button>
              </div>

              <ul className="prof-notification-list-mini">
                {notifications.length ? (
                  notifications.map((item) => (
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
                          <span className="prof-notification-tag">{item.category || notificationsAriaLabel}</span>
                          <span>{item.createdAt}</span>
                        </div>
                        <p className="prof-notification-title">{item.title}</p>
                        <p className="prof-notification-description">{item.message}</p>
                      </button>
                    </li>
                  ))
                ) : (
                  <li>
                    <button type="button" disabled>
                      <p className="prof-notification-title">{emptyNotificationsLabel}</p>
                    </button>
                  </li>
                )}
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
            <div className="prof-popover" role="dialog" aria-label={profileDialogLabel || t("topbar.profileDialog")}>
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
