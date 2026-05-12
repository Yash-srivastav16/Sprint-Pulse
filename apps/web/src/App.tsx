import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Shell } from "./components/Shell";
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="center-state">
        <span>Loading workspace</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<LoginPage />} />
      <Route path="/setup" element={<Navigate to="/projects" replace />} />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/new"
        element={
          <ProtectedRoute>
            <AddProjectPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/connect"
        element={
          <ProtectedRoute>
            <ConnectProjectPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <ProtectedRoute>
            <ProjectWorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/standups"
        element={
          <ProtectedRoute>
            <StandupPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/team"
        element={
          <ProtectedRoute>
            <ProjectTeamPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/sprints"
        element={
          <ProtectedRoute>
            <ProjectSprintsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/integrations"
        element={
          <ProtectedRoute>
            <ProjectIntegrationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId/members/:memberId"
        element={
          <ProtectedRoute>
            <MemberDetailPage />
          </ProtectedRoute>
        }
      />
      <Route path="/plan" element={<Navigate to="/projects" replace />} />
      <Route path="/standup" element={<Navigate to="/projects" replace />} />
      <Route path="/members/:memberId" element={<Navigate to="/projects" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
