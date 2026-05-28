import React, { useEffect, useRef, useState } from "react"; 

import { Bell, Search, User, Settings, Link2, ArrowRight } from "lucide-react"; 

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

 

  const title = activePage; 

  const name = "Administrator"; 

  const role = "System Admin"; 

  const initials = name 

    .split(" ") 

    .map((part) => part[0]) 

    .join("") 

    .slice(0, 2) 

    .toUpperCase(); 

 

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

            placeholder="KÃ«rko pÃ«rdorues, log, rol..." 

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

              <span className="admin-bell-badge">{notificationCount > 99 ? "99+" : notificationCount}</span> 

            ) : null} 

          </button> 

 

          {isNotificationsOpen ? ( 

            <div className="admin-popover" role="dialog" aria-label="Njoftimet"> 

              <div className="admin-popover-head"> 

                <strong>Njoftimet</strong> 

                <button type="button" onClick={onMarkAllRead}> 

                  ShÃ«no si tÃ« lexuara 

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
