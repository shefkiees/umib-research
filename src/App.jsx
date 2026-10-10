import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import LoginForm from "./frontend/LoginForm";
import HomePage from "./frontend/HomePage";
import LegalPage from "./frontend/LegalPage";
import { apiUrl } from "./frontend/utils/api";
import ProfessorDashboard from "./frontend/professor/pages/ProfessorDashboard";
import ResetPasswordPage from "./frontend/auth/ResetPasswordPage";
import ProRectorDashboard from "./frontend/ProRector/pages/ProRectorDashboard";
import FacultyDetails from "./frontend/ProRector/pages/Faculties";
import CommitteeDashboard from "./frontend/committee/pages/CommitteeDashboard";
import NotificationsPage from "./frontend/committee/pages/NotificationsPage";
import CommitteeSettings from "./frontend/committee/pages/CommitteeSettings";
import ProfessorConferences from "./frontend/professor/pages/ProfessorConferences";
import AdminDashboard from "./frontend/admin/pages/AdminDashboard";
import { LanguageProvider } from "./frontend/i18n/LanguageContext";

function GoogleAuthRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      try {
        const response = await fetch(apiUrl("/auth/me"), { credentials: "include", cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          const routes = { admin: "/admin/dashboard", professor: "/professor/dashboard", committee: "/committee/dashboard", prorector: "/prorector/dashboard" };
          const route = routes[data.user?.role];
          if (route && !cancelled) {
            navigate(route, { replace: true });
            return;
          }
        }
      } catch {
        // The backend validates the session again before OAuth.
      }
      if (!cancelled) window.location.replace(apiUrl("/auth/google"));
    };
    checkSession();
    return () => { cancelled = true; };
  }, [navigate]);

  return null;
}

function App() {
  return (
    <LanguageProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/*" element={<GoogleAuthRedirect />} />
          <Route path="/professor/dashboard" element={<ProfessorDashboard />} />
          <Route path="/prorector/dashboard" element={<ProRectorDashboard />} />
          <Route path="/prorector/faculties/:id" element={<FacultyDetails />} />
          <Route path="/ProRector/faculties/:id" element={<FacultyDetails />} />
          <Route path="/committee/dashboard" element={<CommitteeDashboard />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/committee/notifications" element={<NotificationsPage />} />
          <Route path="/committee/settings" element={<CommitteeSettings />} />
          <Route path="/professor/conferences" element={<ProfessorConferences />} />
          <Route path="/dashboard" element={<Navigate to="/professor/dashboard" replace />} />
        </Routes>
      </Router>
    </LanguageProvider>
  );
}

export default App;
