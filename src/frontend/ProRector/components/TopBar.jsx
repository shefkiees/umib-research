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
    notificationCategories: {
      Njoftim: "Njoftim",
      Publikime: "Publikime",
      Rimbursime: "Rimbursime",
      Sistem: "Sistem",
      UMIBRes: "UMIBRes",
    },
    notificationStatuses: {
      Draft: "Draft",
      Dorezuar: "Dorëzuar",
      Pranuar: "Pranuar",
      "Ne shqyrtim": "Në shqyrtim",
      "Kthyer per korrigjim": "Kthyer për korrigjim",
      "Aprovuar nga komisioni": "Aprovuar nga komisioni",
      Aprovuar: "Aprovuar",
      Refuzuar: "Refuzuar",
      Paguar: "Paguar",
    },
    notificationText: {
      publicationNeedsCorrection: "Publikimi juaj kërkon korrigjim",
      publicationRecommended: "Publikimi juaj është rekomanduar për aprovim",
      publicationRejected: "Publikimi juaj është refuzuar",
      publication: "Publikimi",
      reimbursement: "Rimbursimi",
      requestApprovedByCommittee: "Kërkesa u aprovua nga komisioni.",
      requestStatusChanged: "Statusi i kërkesës suaj u ndryshua në {{status}}.",
      statusChanged: "Statusi u ndryshua në {{status}}.",
      publicationStatusChanged: "Statusi i publikimit \"{{title}}\" u ndryshua në {{status}}.",
      metadataUpdateRequested: "Komisioni ka kërkuar përditësim të metadata-s për \"{{title}}\".",
      reviewItems: "Pikat për kontroll: {{items}}.",
      reviewPublicationAgain: "Ju lutem rishikoni publikimin dhe ridërgojeni.",
      notificationsLoadError: "Njoftimet nuk u ngarkuan.",
      notificationsUpdateError: "Njoftimet nuk u përditësuan.",
      notificationUpdateError: "Njoftimi nuk u përditësua.",
    },
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
    notificationCategories: {
      Njoftim: "Notification",
      Publikime: "Publications",
      Rimbursime: "Reimbursements",
      Sistem: "System",
      UMIBRes: "UMIBRes",
    },
    notificationStatuses: {
      Draft: "Draft",
      Dorezuar: "Submitted",
      Pranuar: "Received",
      "Ne shqyrtim": "In review",
      "Kthyer per korrigjim": "Returned for correction",
      "Aprovuar nga komisioni": "Approved by committee",
      Aprovuar: "Approved",
      Refuzuar: "Rejected",
      Paguar: "Paid",
    },
    notificationText: {
      publicationNeedsCorrection: "Your publication requires correction",
      publicationRecommended: "Your publication has been recommended for approval",
      publicationRejected: "Your publication has been rejected",
      publication: "Publication",
      reimbursement: "Reimbursement",
      requestApprovedByCommittee: "Your request was approved by the committee.",
      requestStatusChanged: "Your request status was changed to {{status}}.",
      statusChanged: "Status changed to {{status}}.",
      publicationStatusChanged: "Publication status for \"{{title}}\" was changed to {{status}}.",
      metadataUpdateRequested: "The committee requested metadata updates for \"{{title}}\".",
      reviewItems: "Items to check: {{items}}.",
      reviewPublicationAgain: "Please review the publication and resubmit it.",
      notificationsLoadError: "Notifications could not be loaded.",
      notificationsUpdateError: "Notifications could not be updated.",
      notificationUpdateError: "Notification could not be updated.",
    },
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

function normalizeNotificationText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function interpolateCopy(template, values = {}) {
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "");
}

function getNotificationStatusLabel(value, copy) {
  const text = String(value || "").trim();
  if (!text) return text;

  const match = Object.entries(copy.notificationStatuses || {}).find(
    ([status]) => normalizeNotificationText(status) === normalizeNotificationText(text)
  );

  return match?.[1] || text;
}

function getNotificationCategoryLabel(value, copy) {
  const text = String(value || "").trim();
  if (!text) return copy.notificationCategory;

  const match = Object.entries(copy.notificationCategories || {}).find(
    ([category]) => normalizeNotificationText(category) === normalizeNotificationText(text)
  );

  return match?.[1] || text;
}

function localizeNotificationText(value, copy) {
  const text = String(value || "").trim();
  if (!text) return text;

  const normalized = normalizeNotificationText(text);
  const notificationText = copy.notificationText || {};

  const exactMatches = [
    ["publikimi juaj kerkon korrigjim", notificationText.publicationNeedsCorrection],
    ["publikimi juaj eshte rekomanduar per aprovim", notificationText.publicationRecommended],
    ["publikimi juaj eshte refuzuar", notificationText.publicationRejected],
    ["kerkesa u aprovua nga komisioni.", notificationText.requestApprovedByCommittee],
    ["njoftimet nuk u ngarkuan.", notificationText.notificationsLoadError],
    ["njoftimet nuk u perditesuan.", notificationText.notificationsUpdateError],
    ["njoftimi nuk u perditesua.", notificationText.notificationUpdateError],
  ];
  const exactMatch = exactMatches.find(([source]) => source === normalized);
  if (exactMatch?.[1]) return exactMatch[1];

  const prefixedTitle = text.match(/^(Publikimi|Rimbursimi):\s*(.+)$/i);
  if (prefixedTitle) {
    const prefix = normalizeNotificationText(prefixedTitle[1]) === "rimbursimi"
      ? notificationText.reimbursement
      : notificationText.publication;
    return `${prefix}: ${getNotificationStatusLabel(prefixedTitle[2], copy)}`;
  }

  const requestStatusMatch = text.match(/^Statusi i kerkeses suaj u ndryshua ne (.+)\.$/i);
  if (requestStatusMatch) {
    return interpolateCopy(notificationText.requestStatusChanged, {
      status: getNotificationStatusLabel(requestStatusMatch[1], copy),
    });
  }

  const statusMatch = text.match(/^Statusi u ndryshua ne (.+)\.$/i);
  if (statusMatch) {
    return interpolateCopy(notificationText.statusChanged, {
      status: getNotificationStatusLabel(statusMatch[1], copy),
    });
  }

  const publicationStatusMatch = text.match(/^Statusi i publikimit "(.+)" u ndryshua ne (.+)\.$/i);
  if (publicationStatusMatch) {
    return interpolateCopy(notificationText.publicationStatusChanged, {
      title: publicationStatusMatch[1],
      status: getNotificationStatusLabel(publicationStatusMatch[2], copy),
    });
  }

  return text
    .replace(/Komisioni ka kerkuar perditesim te metadata-s per "([^"]+)"\./gi, (_, title) => (
      interpolateCopy(notificationText.metadataUpdateRequested, { title })
    ))
    .replace(/Pikat per kontroll: ([^.]+)\./gi, (_, items) => (
      interpolateCopy(notificationText.reviewItems, { items })
    ))
    .replace(/Ju lutem rishikoni publikimin dhe ridergojeni\./gi, notificationText.reviewPublicationAgain || "$&");
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
                    <p>{localizeNotificationText(notificationsError, copy)}</p>
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
                        <span className="prorector-notification-badge">{getNotificationCategoryLabel(item.category, copy)}</span>
                        <span>{item.createdAt}</span>
                      </div>
                      <p className="prorector-notification-title">{localizeNotificationText(item.title || item.text, copy)}</p>
                      <p className="prorector-notification-text">{localizeNotificationText(item.description || item.text, copy)}</p>
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
