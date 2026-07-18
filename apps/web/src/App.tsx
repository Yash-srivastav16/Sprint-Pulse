import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { EnhancedShell } from "./components/layout/EnhancedShell";
import { AddProjectPage } from "./pages/AddProjectPage";
import { ConnectProjectPage } from "./pages/ConnectProjectPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MemberDetailPage } from "./pages/MemberDetailPage";
import { ProjectIntegrationsPage } from "./pages/ProjectIntegrationsPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectSprintsPage } from "./pages/ProjectSprintsPage";
import { ProjectTeamPage } from "./pages/ProjectTeamPage";
import { ProjectWorkspacePage } from "./pages/ProjectWorkspacePage";
import { StandupPage } from "./pages/StandupPage";

function ProtectedRoute() {
  const { isAuthenticated, isLoading, persona, session } = useAuth();
  const hasResolvedAuth = Boolean(persona) || Boolean(session);

  if (isLoading && !hasResolvedAuth) {
    return (
      <div className="center-state">
        <span>Loading SprintPulse</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <EnhancedShell>
      <Outlet />
    </EnhancedShell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<LoginPage />} />
      <Route path="/setup" element={<Navigate to="/projects" replace />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<AddProjectPage />} />
        <Route path="/projects/connect" element={<ConnectProjectPage />} />
        <Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
        <Route path="/projects/:projectId/dashboard" element={<DashboardPage />} />
        <Route path="/projects/:projectId/standups" element={<StandupPage />} />
        <Route path="/projects/:projectId/team" element={<ProjectTeamPage />} />
        <Route path="/projects/:projectId/sprints" element={<ProjectSprintsPage />} />
        <Route path="/projects/:projectId/integrations" element={<ProjectIntegrationsPage />} />
        <Route path="/projects/:projectId/members/:memberId" element={<MemberDetailPage />} />
      </Route>
      <Route path="/plan" element={<Navigate to="/projects" replace />} />
      <Route path="/standup" element={<Navigate to="/projects" replace />} />
      <Route path="/members/:memberId" element={<Navigate to="/projects" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
