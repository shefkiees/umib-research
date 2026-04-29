import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginForm from "./frontend/LoginForm";
import HomePage from "./frontend/HomePage";
import ProfessorDashboard from "./frontend/professor/pages/ProfessorDashboard";
import ProRectorDashboard from "./frontend/ProRector/pages/ProRectorDashboard";
import CommitteeDashboard from "./frontend/committee/pages/CommitteeDashboard";
import NotificationsPage from "./frontend/committee/pages/NotificationsPage";
import CommitteeSettings from "./frontend/committee/pages/CommitteeSettings";
import ProfessorConferences from "./frontend/professor/pages/ProfessorConferences";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/professor/dashboard" element={<ProfessorDashboard />} />
        <Route path="/prorector/dashboard" element={<ProRectorDashboard />} />
        <Route path="/committee/dashboard" element={<CommitteeDashboard />} />
        <Route path="/committee/notifications" element={<NotificationsPage />} />
        <Route path="/committee/settings" element={<CommitteeSettings />} />
        <Route path="/professor/conferences" element={<ProfessorConferences />} />
        <Route path="/dashboard" element={<Navigate to="/professor/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
