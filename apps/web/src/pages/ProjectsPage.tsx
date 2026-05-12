import { useEffect, useState } from "react";
import { ArrowRight, Cloud, FolderKanban, Gauge, Loader2, Plus, ShieldAlert, Sparkles, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { Persona, ProjectsResponse, ProjectSummary } from "@sprintpulse/shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";

function projectCopy(persona: Persona) {
  switch (persona.productPersona) {
    case "product-owner":
      return "Portfolio health, sprint confidence, and delivery risk across every active initiative.";
    case "scrum-master":
      return "Create or connect delivery spaces, keep standups current, and unblock the next sprint move.";
    case "engineering-manager":
      return "Architecture and delivery workspaces with team health visibility.";
    case "qa-lead":
      return "Quality signals, validation scope, and release readiness across active sprint work.";
    case "presenter":
      return "Executive-ready sprint narratives with the delivery signals that matter.";
    case "developer":
    default:
      return "Your assigned sprint workspaces, standup inputs, and personal delivery signals.";
  }
}

function projectHeading(persona: Persona) {
  switch (persona.productPersona) {
    case "product-owner":
      return "Portfolio command center";
    case "scrum-master":
      return "Delivery operations";
    default:
      return "Projects";
  }
}

function sourceLabel(source: ProjectSummary["source"]) {
  return source === "manual" ? "Manual" : "Jira";
}

function formatRole(role: ProjectSummary["currentUserRole"]) {
  return role
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatHealth(score: number) {
  return score > 0 ? score : "--";
}

export function ProjectsPage() {
  const { persona } = useAuth();
  const { selectProject } = useProject();
  const navigate = useNavigate();
  const [data, setData] = useState<ProjectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!persona) {
      return;
    }

    api
      .getProjects(persona.id)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [persona]);

  const openProject = (project: ProjectSummary) => {
    selectProject(project.id, {
      source: project.source === "manual" ? "manual" : "jira",
      projectName: project.name,
      projectKey: project.key,
      sprintName: project.sprintName,
      sprintGoal: project.sprintGoal,
      importedAt: project.lastSyncAt
    });
    navigate(`/projects/${project.id}`);
  };

  if (loading) {
    return (
      <div className="center-state">
        <Loader2 className="spin" size={26} />
        <span>Loading projects</span>
      </div>
    );
  }

  if (error || !data || !persona) {
    return <div className="center-state error-state">{error ?? "Projects unavailable"}</div>;
  }

  const isProductOwner = persona.productPersona === "product-owner";
  const isScrumMaster = persona.productPersona === "scrum-master";
  const canUseSetupActions = isScrumMaster;
  const averageHealth = data.projects.length
    ? Math.round(data.projects.reduce((total, project) => total + project.healthScore, 0) / data.projects.length)
    : 0;
  const totalAtRisk = data.projects.reduce((total, project) => total + project.atRiskCount, 0);
  const totalMembers = data.projects.reduce((total, project) => total + project.memberCount, 0);

  return (
    <div className="page-stack">
      <section className="page-heading projects-heading">
        <div>
          <p className="eyebrow">{persona.title}</p>
          <h1>{projectHeading(persona)}</h1>
          <p>{projectCopy(persona)}</p>
        </div>
        <div className="project-actions">
          {canUseSetupActions && data.canCreateProject ? (
            <Link className="primary-button" to="/projects/new">
              <Plus size={18} />
              <span>Create project</span>
            </Link>
          ) : null}
          {canUseSetupActions && data.canConnectProject ? (
            <Link className="icon-text-button" to="/projects/connect">
              <Cloud size={18} />
              <span>Connect existing</span>
            </Link>
          ) : !canUseSetupActions ? (
            <div className="permission-note">
              <ShieldAlert size={17} />
              <span>{isProductOwner ? "Setup actions are handled by Scrum Masters." : "Project setup is managed by Scrum Masters."}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="portfolio-strip" aria-label={isProductOwner ? "Portfolio health summary" : "Project operations summary"}>
        <div>
          <Gauge size={20} />
          <span>{isProductOwner ? "Portfolio health" : "Average health"}</span>
          <strong>{averageHealth || "--"}</strong>
        </div>
        <div>
          <Sparkles size={20} />
          <span>{isScrumMaster ? "Setup access" : "Active projects"}</span>
          <strong>{isScrumMaster ? "Enabled" : data.projects.length}</strong>
        </div>
        <div>
          <ShieldAlert size={20} />
          <span>At-risk items</span>
          <strong>{totalAtRisk}</strong>
        </div>
        <div>
          <Users size={20} />
          <span>Team members</span>
          <strong>{totalMembers}</strong>
        </div>
      </section>

      {isScrumMaster ? (
        <section className="operations-band" aria-label="Scrum Master operations">
          <div>
            <p className="eyebrow">Scrum Master flow</p>
            <h2>Start with the right workspace</h2>
            <p>Create a new project for a fresh sprint or connect an existing Jira project before moving into standups and delivery health.</p>
          </div>
          <div className="operations-steps">
            <span>Create project</span>
            <span>Connect existing</span>
            <span>Run delivery operations</span>
          </div>
        </section>
      ) : isProductOwner ? (
        <section className="operations-band product-owner-band" aria-label="Product Owner overview">
          <div>
            <p className="eyebrow">Product Owner view</p>
            <h2>Every detail stays visible</h2>
            <p>Open any initiative to inspect sprint health, blockers, team participation, member risk, and the recommended delivery path.</p>
          </div>
          <div className="operations-steps">
            <span>Portfolio health</span>
            <span>Project details</span>
            <span>Delivery risk</span>
          </div>
        </section>
      ) : null}

      {data.projects.length ? (
        <section className="project-grid" aria-label="Available projects">
          {data.projects.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-card-accent" style={{ width: `${Math.max(12, project.healthScore)}%` }} aria-hidden="true" />
              <div className="project-card-top">
                <span className="project-key">{project.key}</span>
                <span className={`source-pill source-${project.source}`}>{sourceLabel(project.source)}</span>
              </div>
              <div>
                <h2>{project.name}</h2>
                <p>{project.sprintGoal}</p>
              </div>
              <div className="project-stat-row">
                <span>
                  <strong>{formatHealth(project.healthScore)}</strong>
                  Health
                </span>
                <span>
                  <strong>{project.atRiskCount}</strong>
                  At risk
                </span>
                <span>
                  <strong>{project.memberCount}</strong>
                  People
                </span>
              </div>
              <div className="project-card-footer">
                <span>{formatRole(project.currentUserRole)}</span>
                <button className="primary-button" type="button" onClick={() => openProject(project)}>
                  <ArrowRight size={17} />
                  <span>{isProductOwner ? "View details" : "Open workspace"}</span>
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel empty-project-panel">
          <FolderKanban size={24} />
          <h2>No projects yet</h2>
          <p>
            {canUseSetupActions && data.canCreateProject
              ? "Create a project manually or connect Jira to start the first SprintPulse workspace."
              : "Ask your Scrum Master to add you to a SprintPulse project."}
          </p>
        </section>
      )}
    </div>
  );
}
