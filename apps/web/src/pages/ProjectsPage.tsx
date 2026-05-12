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
import { cn } from "../lib/utils";
import "../styles/project-flow.css";
import "../styles/projects.css";

function projectCopy(persona: Persona) {
  switch (persona.productPersona) {
    case "product-owner":
      return "Compare live sprint signal across every active initiative and open the project that needs attention.";
    case "scrum-master":
      return "Create projects, connect delivery systems, and keep each sprint ready for standups, Jira, Git, and team review.";
    case "engineering-manager":
      return "Architecture and delivery workspaces with team health, risk, and sprint continuity in one place.";
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
      return "Project intelligence";
    case "scrum-master":
      return "Project operations";
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

function healthAccentClass(score: number) {
  if (score >= 85) {
    return "from-primary-500 via-primary-400 to-info-400";
  }
  if (score >= 70) {
    return "from-warning-500 via-warning-400 to-primary-500";
  }
  if (score > 0) {
    return "from-danger-500 via-warning-500 to-warning-300";
  }
  return "from-slate-400 via-slate-300 to-slate-500";
}

function healthBadgeClass(score: number) {
  if (score >= 85) {
    return "border-primary-500/25 bg-primary-500/10 text-primary-700 dark:text-primary-200";
  }
  if (score >= 70) {
    return "border-warning-500/30 bg-warning-500/10 text-warning-700 dark:text-warning-200";
  }
  if (score > 0) {
    return "border-danger-500/25 bg-danger-500/10 text-danger-700 dark:text-danger-200";
  }
  return "border-slate-300/70 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300";
}

function sourcePillClass(source: ProjectSummary["source"]) {
  return source === "jira"
    ? "border-warning-500/25 bg-warning-500/10 text-warning-700 dark:text-warning-200"
    : "border-info-500/25 bg-info-500/10 text-info-700 dark:text-info-200";
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
    return "Ask a project lead to add you to a SprintPulse project workspace.";
  }

  if (canCreateProject && canConnectProject) {
    return "Create a new project or connect Jira so SprintPulse can start collecting sprint signal.";
  }

  if (canCreateProject) {
    return "Create a project workspace and add the first active sprint.";
  }

  if (canConnectProject) {
    return "Connect Jira to turn an existing delivery space into a SprintPulse workspace.";
  }

  return "Project creation is limited for this workspace.";
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
  const canUseSetupActions = data.canCreateProject || data.canConnectProject;
  const hasSetupActions = canUseSetupActions && (data.canCreateProject || data.canConnectProject);
  const scoredProjects = data.projects.filter((project) => project.healthScore > 0);
  const averageHealth = scoredProjects.length
    ? Math.round(scoredProjects.reduce((total, project) => total + project.healthScore, 0) / scoredProjects.length)
    : 0;
  const totalAtRisk = data.projects.reduce((total, project) => total + project.atRiskCount, 0);
  const totalMembers = data.uniqueMemberCount;
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
          <div className="flow-action-panel projects-command-panel">
            <span className="flow-action-label">Project setup</span>
            <div className="projects-setup-actions">
              {canUseSetupActions && data.canCreateProject ? (
                <Link className="projects-setup-card is-primary" to="/projects/new">
                  <span>
                    <Plus size={20} />
                  </span>
                  <strong>Create project</strong>
                  <small>Start with sprint name, goal, dates, and team context.</small>
                </Link>
              ) : null}
              {canUseSetupActions && data.canConnectProject ? (
                <Link className="projects-setup-card" to="/projects/connect">
                  <span>
                    <Cloud size={20} />
                  </span>
                  <strong>Connect existing</strong>
                  <small>Bring a Jira project into SprintPulse and sync delivery signal.</small>
                </Link>
              ) : null}
              {!canUseSetupActions ? (
                <div className="permission-note">
                  <ShieldAlert size={17} />
                  <span>{isProductOwner ? "Project setup is handled by the delivery lead." : "Project setup is handled by project leads."}</span>
                </div>
              ) : null}
              {canUseSetupActions && !hasSetupActions ? (
                <div className="permission-note">
                  <ShieldAlert size={17} />
                  <span>Project creation is not enabled for this account.</span>
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
          <span>{isProductOwner ? "Portfolio signal" : "Sprint signal"}</span>
          <strong>{averageHealth || "Collecting"}</strong>
        </div>
        <div>
          <Sparkles size={20} />
          <span>Active projects</span>
          <strong>{data.projects.length}</strong>
        </div>
        <div>
          <ShieldAlert size={20} />
          <span>Risk signals</span>
          <strong>{totalAtRisk}</strong>
        </div>
        <div>
          <Users size={20} />
          <span>Unique people</span>
          <strong>{totalMembers}</strong>
        </div>
      </motion.section>

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
                Workspace board
              </p>
              <h2 id="project-switcher-title">Select a project to inspect</h2>
              <p>Compare sprint signal, connected source, risk count, and team size before opening the project workspace.</p>
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

          <section
            className="grid gap-6 rounded-xl border border-slate-200/70 bg-white/80 p-6 shadow-[0_24px_74px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/55 dark:shadow-[0_24px_80px_rgba(0,0,0,0.32)]"
            aria-labelledby="projects-list-title"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow !mb-2">
                  <Rocket size={15} />
                  Workspace list
                </p>
                <h2 className="m-0 text-2xl font-black text-slate-950 dark:text-white" id="projects-list-title">
                  All accessible projects
                </h2>
              </div>
              <span className="inline-flex min-h-9 items-center rounded-full border border-primary-500/20 bg-primary-500/10 px-4 text-sm font-black text-primary-700 dark:text-primary-100">
                {data.projects.length} total
              </span>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2" aria-label="Available projects">
              {data.projects.map((project, index) => (
                <motion.article
                  className={cn(
                    "group relative flex min-h-[360px] overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 p-6 text-slate-950 shadow-[0_22px_64px_rgba(15,23,42,0.10)] transition duration-200 hover:-translate-y-1 hover:border-primary-500/40 hover:shadow-[0_30px_84px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:shadow-[0_26px_84px_rgba(0,0,0,0.32)]",
                    data.recommendedProjectId === project.id && "ring-1 ring-primary-500/30"
                  )}
                  key={project.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: 0.2 + index * 0.04, ease: "easeOut" }}
                >
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-info-500/10 opacity-80 dark:from-primary-400/10 dark:to-ai-500/10" />
                  <span
                    className={cn("absolute left-6 top-0 h-1.5 min-w-28 rounded-b-full bg-gradient-to-r", healthAccentClass(project.healthScore))}
                    style={{ width: progressWidth(project.healthScore, 12) }}
                    aria-hidden="true"
                  />
                  <div className="relative z-10 flex w-full flex-col gap-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-3 text-sm font-black text-primary-700 dark:text-primary-100">
                        <Layers3 size={14} />
                        {project.key}
                      </span>
                      <span className={cn("inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-black", sourcePillClass(project.source))}>
                        {sourceLabel(project.source)}
                      </span>
                    </div>

                    <div className="grid gap-3">
                      {data.recommendedProjectId === project.id ? (
                        <span className="inline-flex w-fit min-h-8 items-center gap-2 rounded-full border border-primary-500/25 bg-primary-500/10 px-3 text-xs font-black text-primary-700 dark:text-primary-100">
                          <CheckCircle2 size={14} />
                          Recommended
                        </span>
                      ) : null}
                      <div className="space-y-2">
                        <h2 className="m-0 text-2xl font-black leading-tight text-slate-950 dark:text-white">{project.name}</h2>
                        <p className="m-0 max-w-2xl text-[0.98rem] leading-7 text-slate-600 dark:text-slate-300">{project.sprintGoal}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                          <CalendarDays size={15} />
                          {project.sprintName}
                        </span>
                        <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                          <Clock3 size={15} />
                          {formatSyncDate(project.lastSyncAt)}
                        </span>
                      </div>
                    </div>

                    <div
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.055]"
                      aria-label={`${project.name} health`}
                    >
                      <span className="text-sm font-black text-slate-500 dark:text-slate-300">{healthLabel(project.healthScore)}</span>
                      <strong className="text-2xl font-black leading-none text-slate-950 dark:text-white">{formatHealth(project.healthScore)}</strong>
                      <div className="col-span-2 h-2.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10" aria-hidden="true">
                        <i
                          className={cn("block h-full rounded-full bg-gradient-to-r", healthAccentClass(project.healthScore))}
                          style={{ width: progressWidth(project.healthScore) }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        ["Health", formatHealth(project.healthScore)],
                        ["At risk", project.atRiskCount],
                        ["People", project.memberCount]
                      ].map(([label, value]) => (
                        <span
                          className="grid min-h-20 content-center gap-1 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm font-bold text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300"
                          key={label}
                        >
                          <strong className="text-2xl font-black leading-none text-slate-950 dark:text-white">{value}</strong>
                          {label}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-4">
                      <span className={cn("inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-black", healthBadgeClass(project.healthScore))}>
                        {formatRole(project.currentUserRole)}
                      </span>
                      <button
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary-500 to-info-500 px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(21,154,140,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(21,154,140,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950"
                        type="button"
                        onClick={() => openProject(project)}
                      >
                        <ArrowRight size={17} />
                        <span>{isProductOwner ? "View details" : "Open workspace"}</span>
                      </button>
                    </div>
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
