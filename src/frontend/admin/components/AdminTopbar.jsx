import React, { useEffect, useRef, useState } from "react"; 

import { Bell, Search, User, Settings, Link2, ArrowRight } from "lucide-react"; 

import { apiUrl } from "../../utils/api";

const ROLE_LABELS = {
  admin: "Admin",
  committee: "Komisioni",
  professor: "Profesor",
  prorector: "Prorektor",
  ProRector: "Prorektor",
};

function getProfileName(user) {
  const firstLastName = [user?.first_name || user?.firstName, user?.last_name || user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return firstLastName || user?.full_name || user?.fullName || user?.name || user?.email || "Admin";
}

function getProfileInitial(name, email) {
  const source = name || email || "A";
  return source.trim().charAt(0).toUpperCase();
}

function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || "Admin";
}

function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}, ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function AdminTopbar({ 

  activePage, 

  searchQuery, 

  onSearchChange, 

  resultCount, 

  notificationCount, 

  notifications, 

  notificationsLoading = false,

  notificationsError = "",

  onMarkAllRead, 

  onNotificationRead,

  onProfileAction, 

  profileMenuItems, 

  profileRefreshKey = 0,

  labels,

}) { 

  const [isProfileOpen, setIsProfileOpen] = useState(false); 

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false); 

  const [profileUser, setProfileUser] = useState(null); 

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

  useEffect(() => {
    let isMounted = true;

    const loadProfileUser = async () => {
      try {
        const response = await fetch(apiUrl("/auth/me"), {
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (isMounted) {
          setProfileUser(data.user || null);
        }
      } catch (error) {
        console.warn("Admin profile user could not be loaded.", error);
      }
    };

    loadProfileUser();

    return () => {
      isMounted = false;
    };
  }, [profileRefreshKey]);

 

  const title = labels?.pages?.[activePage] || activePage; 

  const name = getProfileName(profileUser);
  const role = getRoleLabel(profileUser?.role);
  const initials = getProfileInitial(name, profileUser?.email);

 

  return ( 

    <header className="admin-topbar"> 

      <div className="admin-topbar-left"> 

        <h1>{title}</h1> 

      </div> 

 

      <div className="admin-topbar-right"> 

        <label className="admin-search" htmlFor="admin-search-input">

          <Search size={20} />

          <input 

            id="admin-search-input" 

            type="text" 

            placeholder={labels?.topbar?.search || "Kërko përdorues, veprim, rol..."} 

            value={searchQuery} 

            onChange={(event) => onSearchChange(event.target.value)} 

          /> 

        </label> 

 

        <div className="admin-notification-wrap" ref={notificationsRef}> 

          <button 

            className="admin-icon-btn" 

            type="button" 

            aria-label={labels?.topbar?.notifications || "Njoftimet"} 

            onClick={() => setIsNotificationsOpen((current) => !current)} 

          > 

            <Bell size={20} /> 

            {notificationCount > 0 ? ( 

              <span className="admin-bell-badge">{notificationCount > 99 ? "99+" : notificationCount}</span> 

            ) : null} 

          </button> 

 

          {isNotificationsOpen ? ( 

            <div className="admin-popover" role="dialog" aria-label={labels?.topbar?.notifications || "Njoftimet"}> 

              <div className="admin-popover-head"> 

                <strong>{labels?.topbar?.notifications || "Njoftimet"}</strong> 

                <button type="button" onClick={onMarkAllRead} disabled={notificationCount === 0 || notificationsLoading}> 

                  {labels?.topbar?.markRead || "Shëno si të lexuara"} 

                </button> 

              </div> 

              <ul> 

                {notificationsLoading ? (

                  <li className="is-read">

                    <p>{labels?.topbar?.loadingNotifications || "Duke ngarkuar njoftimet..."}</p>

                  </li>

                ) : null}

                {!notificationsLoading && notificationsError ? (

                  <li className="is-read">

                    <p>{notificationsError}</p>

                  </li>

                ) : null}

                {!notificationsLoading && !notificationsError && notifications.map((item) => ( 

                  <li key={item.id} className={item.isRead ? "is-read" : ""}> 

                    <button
                      type="button"
                      className="admin-notification-popover-item"
                      onClick={() => onNotificationRead?.(item)}
                      disabled={item.isRead || item.source === "audit"}
                    >

                      <p>{item.title || item.text || item.message || labels?.topbar?.fallbackNotification || "Njoftim"}</p>

                      <span>{formatNotificationTime(item.createdAt)}</span>

                    </button>

                  </li> 

                ))} 

                {!notificationsLoading && !notificationsError && notifications.length === 0 ? (

                  <li className="is-read">

                    <p>{labels?.topbar?.emptyNotifications || "Nuk ka njoftime aktualisht."}</p>

                  </li>

                ) : null}

              </ul> 

            </div> 

          ) : null} 

        </div> 

 

        <div className="admin-profile-wrap" ref={profileRef}> 

          <button 

            className="admin-profile-btn" 

            type="button" 

            onClick={() => setIsProfileOpen((current) => !current)} 

          > 

            <div className="admin-profile-identity"> 

              <div className="admin-profile-text"> 

                <strong>{name}</strong> 

                <span>{role}</span> 

              </div> 

              <div className="admin-avatar">{initials}</div> 

            </div> 

          </button> 

 

          {isProfileOpen ? ( 

            <div className="admin-popover admin-profile-menu" role="menu"> 

              {profileMenuItems.map((item) => { 

                const ItemIcon = item.icon || User; 

                const isDanger = item.tone === "danger" || String(item.id).toLowerCase() === "logout"; 

 

                return ( 

                  <button 

                    key={item.id} 

                    type="button" 

                    className={`admin-popover-item${isDanger ? " admin-popover-item--danger" : ""}`} 

                    onClick={() => { 

                      setIsProfileOpen(false); 

                      onProfileAction(item.id); 

                    }} 

                  > 

                    <ItemIcon size={18} className="admin-popover-icon" /> 

                    <span>{item.label}</span> 

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
