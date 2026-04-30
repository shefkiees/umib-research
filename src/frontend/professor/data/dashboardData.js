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
  { id: "Publikime", label: "Publikime", icon: BookOpen },
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
  name: "Prof. Dr. Ajete Ibishi",
  role: "Professor i rregullt",
  faculty: "Fakulteti i Inxhinierise Informatike",
  department: "Departamenti i Sistemeve te Informacionit",
  employeeId: "UMIB-PR-001",
  email: "ajete.ibishi@umib.edu",
  office: "Objekti A, Zyra 3.14",
};

export const publicationRows = [
  {
    title: "Machine Learning for Educational Analytics",
    journal: "Journal of Digital Research",
    year: "2026",
    month: "Mar",
    status: "Aprovuar",
  },
  {
    title: "AI Governance in Academic Systems",
    journal: "European Computing Review",
    year: "2025",
    month: "Maj",
    status: "Ne verifikim",
  },
  {
    title: "Knowledge Graphs for Faculty Reporting",
    journal: "Data Systems Quarterly",
    year: "2025",
    month: "Qer",
    status: "Aprovuar",
  },
];

export const conferenceRows = [
  {
    event: "International Conference on Applied Informatics",
    location: "Vienna, Austria",
    date: "12 Jun 2026",
    month: "Qer",
    status: "Konfirmuar",
  },
  {
    event: "Higher Education Research Forum",
    location: "Tirana, Albania",
    date: "04 Sep 2026",
    month: "Maj",
    status: "Ne shqyrtim",
  },
  {
    event: "Digital Universities Summit",
    location: "Berlin, Germany",
    date: "21 Oct 2026",
    month: "Pri",
    status: "Konfirmuar",
  },
];

export const reimbursementRows = [
  {
    request: "Udhetim konference - Vienna",
    amount: "EUR 420",
    submitted: "08 Qer 2026",
    month: "Qer",
    status: "Ne proces",
  },
  {
    request: "Akomodim - Tirana forum",
    amount: "EUR 180",
    submitted: "30 Mar 2026",
    month: "Mar",
    status: "Aprovuar",
  },
  {
    request: "Tarife regjistrimi - Digital Summit",
    amount: "EUR 250",
    submitted: "18 Mar 2026",
    month: "Mar",
    status: "Dokumente shtese",
  },
];

export const statisticsRows = [
  { label: "Publikime Scopus", value: "14" },
  { label: "Publikime WoS", value: "9" },
  { label: "Konferenca me prezantim", value: "6" },
  { label: "Rimbursime te aprovuara", value: "4" },
];

export const statisticsChartData = [
  { month: "Jan", publikime: 2, citime: 12, konferenca: 1 },
  { month: "Shk", publikime: 3, citime: 18, konferenca: 0 },
  { month: "Mar", publikime: 4, citime: 24, konferenca: 1 },
  { month: "Pri", publikime: 3, citime: 20, konferenca: 1 },
  { month: "Maj", publikime: 5, citime: 29, konferenca: 2 },
  { month: "Qer", publikime: 4, citime: 33, konferenca: 1 },
];

export const integrations = [
  {
    provider: "ORCID",
    description: "Sinkronizim automatik",
    status: "Connected",
  },

  {
    provider: "Crossref",
    description: "Sinkronizim automatik",
    status: "Not connected",
  },
  {
    provider: "Google Scholar",
    description: "Sinkronizim automatik",
    status: "Not connected",
  },
];
