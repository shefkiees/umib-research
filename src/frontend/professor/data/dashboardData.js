import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CircleUserRound,
  Link2,
  LogOut,
  Settings,
  Wallet,
} from "lucide-react";

export const navigationItems = [
  { id: "Statistika", label: "Statistika", icon: BarChart3 },
  { id: "Publikime", label: "Artikujt", icon: BookOpen },
  { id: "Konferenca", label: "Konferenca", icon: CalendarDays },
  { id: "Rimbursime", label: "Rimbursime", icon: Wallet },
];

export const profileMenuItems = [
  { id: "EditProfile", label: "Edit Profile", icon: CircleUserRound },
  { id: "OrcidConnect", label: "Connect with ORCID", icon: Link2 },
  { id: "Njoftime", label: "Njoftime", icon: Bell },
  { id: "Settings", label: "Settings", icon: Settings },
  { id: "Integrime", label: "Integrime", icon: Link2 },
  { id: "Logout", label: "Logout", icon: LogOut, tone: "danger" },
];

export const professorProfile = {
  name: "",
  role: "Professor",
  academicTitle: "",
  scientificTitle: "",
  faculty: "",
  department: "",
  employeeId: "",
  email: "",
  office: "",
  orcidId: null,
  school: "",
  currentAffiliation: "",
  profilePhotoUrl: "",
  orcidProfile: {},
  orcidEducations: [],
  orcidEmployments: [],
  orcidLastSyncedAt: null,
};
