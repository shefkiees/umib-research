export const ADMIN_TEXT = {
  sq: {
    modules: "MODULET",
    navAria: "Modulet navigimi",
    pages: {
      "Përdoruesit": "Përdoruesit",
      Rolet: "Rolet",
      "Rivendosja e qasjes": "Rivendosja e qasjes",
      "Historiku i veprimeve": "Historiku i veprimeve",
      Njoftimet: "Njoftimet",
      Statistikat: "Statistikat",
      Integrimet: "Integrimet",
      "Gjendja e sistemit": "Gjendja e sistemit",
      Revistat: "Revistat",
      "Shqyrtimi i publikimeve": "Shqyrtimi i publikimeve",
      Raportet: "Raportet",
      Buxheti: "Buxheti",
      Cilësimet: "Cilësimet",
      Rezervimi: "Rezervimi",
    },
    topbar: {
      search: "Kërko përdorues, veprim, rol...",
      notifications: "Njoftimet",
      markRead: "Shëno si të lexuara",
      loadingNotifications: "Duke ngarkuar njoftimet...",
      emptyNotifications: "Nuk ka njoftime aktualisht.",
      fallbackNotification: "Njoftim",
    },
    profileMenu: {
      notifications: "Njoftime",
      editProfile: "Ndrysho profilin",
      settings: "Cilësimet",
      integrations: "Integrime",
      logout: "Dil",
    },
  },
  en: {
    modules: "MODULES",
    navAria: "Navigation modules",
    pages: {
      "Përdoruesit": "Users",
      Rolet: "Roles",
      "Rivendosja e qasjes": "Access recovery",
      "Historiku i veprimeve": "Activity history",
      Njoftimet: "Notifications",
      Statistikat: "Statistics",
      Integrimet: "Integrations",
      "Gjendja e sistemit": "System status",
      Revistat: "Journals",
      "Shqyrtimi i publikimeve": "Publication review",
      Raportet: "Reports",
      Buxheti: "Budget",
      Cilësimet: "Settings",
      Rezervimi: "Backup",
    },
    topbar: {
      search: "Search users, action, role...",
      notifications: "Notifications",
      markRead: "Mark as read",
      loadingNotifications: "Loading notifications...",
      emptyNotifications: "No notifications right now.",
      fallbackNotification: "Notification",
    },
    profileMenu: {
      notifications: "Notifications",
      editProfile: "Edit profile",
      settings: "Settings",
      integrations: "Integrations",
      logout: "Sign out",
    },
  },
};

export function getAdminText(language) {
  return ADMIN_TEXT[language] || ADMIN_TEXT.sq;
}

