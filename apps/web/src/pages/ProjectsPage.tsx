import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Cloud,
  FolderKanban,
  Gauge,
  Layers3,
  ListChecks,
  Loader2,
  Plus,
  Rocket,
  ShieldAlert,
  Sparkles,
  Target,
  Users
} from "lucide-react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import type { Persona, ProjectsResponse, ProjectSummary } from "@sprintpulse/shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import "../styles/project-flow.css";
import "../styles/projects.css";

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

function healthTone(score: number) {
  if (score >= 85) {
    return "is-healthy";
  }
  if (score >= 70) {
    return "is-watch";
  }
  if (score > 0) {
    return "is-risk";
  }
  return "is-neutral";
}

function healthLabel(score: number) {
  if (score >= 85) {
    return "Healthy";
  }
  if (score >= 70) {
    return "Watch";
  }
  if (score > 0) {
    return "At risk";
  }
  return "No signal";
}

function formatSyncDate(lastSyncAt?: string) {
  if (!lastSyncAt) {
    return "No sync yet";
  }

  const syncDate = new Date(lastSyncAt);
  if (Number.isNaN(syncDate.getTime())) {
    return "Sync ready";
  }

  return syncDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function progressWidth(score: number, min = 4) {
  return `${Math.max(min, Math.min(100, score))}%`;
}

function emptyProjectCopy(canUseSetupActions: boolean, canCreateProject: boolean, canConnectProject: boolean) {
  if (!canUseSetupActions) {
    return "Ask your Scrum Master to create a SprintPulse workspace and add you to the project.";
  }

  if (canCreateProject && canConnectProject) {
    return "Create a manual project or connect Jira to give the team a focused SprintPulse workspace.";
  }

  if (canCreateProject) {
    return "Create a manual project to give the team a focused SprintPulse workspace.";
  }

  if (canConnectProject) {
    return "Connect Jira to turn an existing delivery space into a SprintPulse workspace.";
  }

  return "Setup permissions are limited for this workspace.";
}

export function ProjectsPage() {
  const { persona } = useAuth();
  const { selectProject } = useProject();
  const navigate = useNavigate();
  const [data, setData] = useState<ProjectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

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
  const hasSetupActions = canUseSetupActions && (data.canCreateProject || data.canConnectProject);
  const averageHealth = data.projects.length
    ? Math.round(data.projects.reduce((total, project) => total + project.healthScore, 0) / data.projects.length)
    : 0;
  const totalAtRisk = data.projects.reduce((total, project) => total + project.atRiskCount, 0);
  const totalMembers = data.projects.reduce((total, project) => total + project.memberCount, 0);
  const recommendedProject = data.projects.find((project) => project.id === data.recommendedProjectId);
  const activeProject = data.projects.find((project) => project.id === activeProjectId) ?? recommendedProject ?? data.projects[0];

  return (
    <motion.div
      className="page-stack project-flow-page projects-flow projects-modern"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
    >
      <motion.section
        className="page-heading projects-heading flow-hero projects-hero projects-hero-modern"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="flow-hero-copy">
          <div className="flow-kicker-row">
            <p className="eyebrow">{persona.title}</p>
            <span className="flow-live-chip">
              <Sparkles size={15} />
              {data.projects.length ? `${data.projects.length} active` : "Ready to start"}
            </span>
          </div>
          <h1>{projectHeading(persona)}</h1>
          <p className="flow-hero-lede">{projectCopy(persona)}</p>
          <div className="flow-hero-pills" aria-label="Project scope">
            <span>
              <Layers3 size={15} />
              {data.projects.length} projects
            </span>
            <span>
              <Target size={15} />
              {totalAtRisk} at risk
            </span>
            <span>
              <Users size={15} />
              {totalMembers} people
            </span>
          </div>
        </div>
        <div className="project-actions flow-hero-actions projects-hero-actions">
          <div className="flow-action-panel">
            <span className="flow-action-label">{activeProject ? "Current focus" : "Workspace setup"}</span>
            {activeProject ? (
              <div className="projects-focus-card">
                <div>
                  <span className="projects-focus-key">{activeProject.key}</span>
                  <strong>{activeProject.name}</strong>
                  <small>{activeProject.sprintName}</small>
                </div>
                <span className={`projects-health-chip ${healthTone(activeProject.healthScore)}`}>
                  {healthLabel(activeProject.healthScore)}
                  <b>{formatHealth(activeProject.healthScore)}</b>
                </span>
              </div>
            ) : null}
            <div className="flow-action-buttons">
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
              ) : null}
              {!canUseSetupActions ? (
                <div className="permission-note">
                  <ShieldAlert size={17} />
                  <span>{isProductOwner ? "Setup actions are handled by Scrum Masters." : "Project setup is managed by Scrum Masters."}</span>
                </div>
              ) : null}
              {canUseSetupActions && !hasSetupActions ? (
                <div className="permission-note">
                  <ShieldAlert size={17} />
                  <span>Setup permissions are limited for this workspace.</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="portfolio-strip flow-stat-strip projects-stat-strip"
        aria-label={isProductOwner ? "Portfolio health summary" : "Project operations summary"}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, delay: 0.08, ease: "easeOut" }}
      >
        <div className={healthTone(averageHealth)}>
          <Gauge size={20} />
          <span>{isProductOwner ? "Portfolio health" : "Average health"}</span>
          <strong>{averageHealth || "--"}</strong>
        </div>
        <div>
          <Sparkles size={20} />
          <span>{isScrumMaster ? "Setup access" : "Active projects"}</span>
          <strong>{isScrumMaster ? (hasSetupActions ? "Enabled" : "Limited") : data.projects.length}</strong>
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
      </motion.section>

      {isScrumMaster ? (
        <motion.section
          className="operations-band flow-operations-band projects-guidance-band"
          aria-label="Scrum Master operations"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, delay: 0.12, ease: "easeOut" }}
        >
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
        </motion.section>
      ) : isProductOwner ? (
        <motion.section
          className="operations-band product-owner-band flow-operations-band projects-guidance-band"
          aria-label="Product Owner overview"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, delay: 0.12, ease: "easeOut" }}
        >
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
        </motion.section>
      ) : null}

      {data.projects.length ? (
        <>
          <motion.section
            className="projects-switcher"
            aria-labelledby="project-switcher-title"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, delay: 0.16, ease: "easeOut" }}
          >
            <div className="projects-switcher-copy">
              <p className="eyebrow">
                <ListChecks size={15} />
                Project switcher
              </p>
              <h2 id="project-switcher-title">Choose the workspace to inspect</h2>
              <p>Pin a project in focus, compare its sprint signal, then open the workspace when you are ready to act.</p>
              <div className="projects-switch-list" aria-label="Project list">
                {data.projects.map((project) => {
                  const isActive = activeProject?.id === project.id;

                  return (
                    <button
                      className={`projects-switch-item ${isActive ? "is-active" : ""}`}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setActiveProjectId(project.id)}
                      key={project.id}
                    >
                      <span className="projects-switch-icon">
                        <FolderKanban size={18} />
                      </span>
                      <span className="projects-switch-copy">
                        <strong>{project.name}</strong>
                        <small>
                          {project.key} / {project.sprintName}
                        </small>
                      </span>
                      <span className={`projects-health-chip ${healthTone(project.healthScore)}`}>
                        {formatHealth(project.healthScore)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeProject ? (
              <div className="projects-active-panel">
                <div className="projects-active-header">
                  <span className="project-key">
                    <Layers3 size={14} />
                    {activeProject.key}
                  </span>
                  {data.recommendedProjectId === activeProject.id ? (
                    <span className="recommended-pill">
                      <CheckCircle2 size={14} />
                      Recommended
                    </span>
                  ) : null}
                </div>
                <div className="projects-active-copy">
                  <h2>{activeProject.name}</h2>
                  <p>{activeProject.sprintGoal}</p>
                </div>
                <div className="projects-active-meter" aria-label={`${activeProject.name} health`}>
                  <div>
                    <span>{healthLabel(activeProject.healthScore)}</span>
                    <strong>{formatHealth(activeProject.healthScore)}</strong>
                  </div>
                  <div className="flow-health-bar" aria-hidden="true">
                    <i style={{ width: progressWidth(activeProject.healthScore) }} />
                  </div>
                </div>
                <div className="projects-active-meta">
                  <span>
                    <CalendarDays size={15} />
                    {activeProject.sprintName}
                  </span>
                  <span>
                    <Clock3 size={15} />
                    {formatSyncDate(activeProject.lastSyncAt)}
                  </span>
                  <span>
                    <Users size={15} />
                    {activeProject.memberCount} people
                  </span>
                </div>
                <button className="primary-button projects-open-button" type="button" onClick={() => openProject(activeProject)}>
                  <ArrowUpRight size={17} />
                  <span>{isProductOwner ? "View project details" : "Open workspace"}</span>
                </button>
              </div>
            ) : null}
          </motion.section>

          <section className="projects-cards-section" aria-labelledby="projects-list-title">
            <div className="projects-section-heading">
              <div>
                <p className="eyebrow">
                  <Rocket size={15} />
                  Workspace list
                </p>
                <h2 id="projects-list-title">All accessible projects</h2>
              </div>
              <span>{data.projects.length} total</span>
            </div>
            <div className="project-grid projects-card-grid" aria-label="Available projects">
              {data.projects.map((project, index) => (
                <motion.article
                  className={`project-card flow-project-card projects-card ${data.recommendedProjectId === project.id ? "is-recommended" : ""}`}
                  key={project.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: 0.2 + index * 0.04, ease: "easeOut" }}
                >
                  <div className="project-card-accent" style={{ width: progressWidth(project.healthScore, 12) }} aria-hidden="true" />
                  <div className="project-card-top">
                    <span className="project-key">
                      <Layers3 size={14} />
                      {project.key}
                    </span>
                    <span className={`source-pill source-${project.source}`}>{sourceLabel(project.source)}</span>
                  </div>
                  <div className="project-card-main">
                    {data.recommendedProjectId === project.id ? (
                      <span className="recommended-pill">
                        <CheckCircle2 size={14} />
                        Recommended
                      </span>
                    ) : null}
                    <h2>{project.name}</h2>
                    <p>{project.sprintGoal}</p>
                    <div className="project-card-meta">
                      <span>
                        <CalendarDays size={15} />
                        {project.sprintName}
                      </span>
                      <span>
                        <Clock3 size={15} />
                        {formatSyncDate(project.lastSyncAt)}
                      </span>
                    </div>
                  </div>
                  <div className="project-health-row" aria-label={`${project.name} health`}>
                    <span>{healthLabel(project.healthScore)}</span>
                    <strong>{formatHealth(project.healthScore)}</strong>
                    <div className="flow-health-bar" aria-hidden="true">
                      <i style={{ width: progressWidth(project.healthScore) }} />
                    </div>
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
                </motion.article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <motion.section
          className="panel empty-project-panel projects-empty-panel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, delay: 0.16, ease: "easeOut" }}
        >
          <div className="projects-empty-icon">
            <FolderKanban size={28} />
          </div>
          <div>
            <p className="eyebrow">No workspaces yet</p>
            <h2>No projects yet</h2>
            <p>{emptyProjectCopy(canUseSetupActions, data.canCreateProject, data.canConnectProject)}</p>
          </div>
          {hasSetupActions ? (
            <div className="projects-empty-actions">
              {data.canCreateProject ? (
                <Link className="primary-button" to="/projects/new">
                  <Plus size={18} />
                  <span>Create project</span>
                </Link>
              ) : null}
              {data.canConnectProject ? (
                <Link className="icon-text-button" to="/projects/connect">
                  <Cloud size={18} />
                  <span>Connect Jira</span>
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="permission-note">
              <ShieldAlert size={17} />
              <span>{isProductOwner ? "Setup actions are handled by Scrum Masters." : "Project setup is managed by Scrum Masters."}</span>
            </div>
          )}
          <div className="projects-empty-checklist" aria-label="Project setup checklist">
            <span>
              <CheckCircle2 size={15} />
              Define sprint goal
            </span>
            <span>
              <CheckCircle2 size={15} />
              Add team members
            </span>
            <span>
              <CheckCircle2 size={15} />
              Connect delivery signals
            </span>
          </div>
        </motion.section>
      )}
    </motion.div>
  );
}
