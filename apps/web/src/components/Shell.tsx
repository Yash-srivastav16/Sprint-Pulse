import { Activity, CalendarDays, ClipboardCheck, FolderKanban, Gauge, LogOut, Menu, PlugZap, Users } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";

export function Shell({ children }: { children: React.ReactNode }) {
  const { persona, logout } = useAuth();
  const { project, selectedProjectId, clearProject } = useProject();
  const navigate = useNavigate();
  const projectBase = selectedProjectId ? `/projects/${selectedProjectId}` : "/projects";

  const handleLogout = () => {
    clearProject();
    logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <Activity size={24} />
          <div>
            <strong>SprintPulse</strong>
            <span>Delivery intelligence</span>
          </div>
        </div>

        <nav className="side-nav">
          <NavLink to="/projects">
            <FolderKanban size={18} />
            <span>Projects</span>
          </NavLink>
          <NavLink to={projectBase}>
            <Activity size={18} />
            <span>Workspace</span>
          </NavLink>
          <NavLink to={selectedProjectId ? `${projectBase}/standups` : "/projects"}>
            <ClipboardCheck size={18} />
            <span>Standups</span>
          </NavLink>
          <NavLink to={selectedProjectId ? `${projectBase}/dashboard` : "/projects"}>
            <Gauge size={18} />
            <span>Dashboard</span>
          </NavLink>
          {selectedProjectId ? (
            <>
              <NavLink to={`${projectBase}/team`}>
                <Users size={18} />
                <span>Team</span>
              </NavLink>
              <NavLink to={`${projectBase}/sprints`}>
                <CalendarDays size={18} />
                <span>Sprints</span>
              </NavLink>
              <NavLink to={`${projectBase}/integrations`}>
                <PlugZap size={18} />
                <span>Integrations</span>
              </NavLink>
            </>
          ) : null}
        </nav>

        <div className="viewer-card">
          <div className="avatar">{persona?.initials}</div>
          <div>
            <strong>{persona?.name}</strong>
            <span>{persona?.title}</span>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand">
            <Menu size={18} />
            <span>SprintPulse</span>
          </div>
          <div className="topbar-context">
            <Users size={18} />
            <span>{project ? `${project.projectKey} workspace` : selectedProjectId ? "project workspace" : "choose project"}</span>
          </div>
          <div className="topbar-actions">
            <span className="workspace-mode-pill">{project ? "Project selected" : "No project selected"}</span>
            <button aria-label="Logout" className="icon-text-button" type="button" onClick={handleLogout}>
              <LogOut size={17} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
