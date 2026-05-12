import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Cloud,
  FolderKanban,
  Layers3,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  Zap
} from "lucide-react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import type { Persona, ProjectsResponse, ProjectSummary } from "@sprintpulse/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { workspacePageClass } from "@/components/workspace/WorkspaceChrome";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import { cn } from "../lib/utils";

function projectCopy(persona: Persona) {
  switch (persona.productPersona) {
    case "product-owner":
      return "See every active initiative with enough signal to decide where product attention should go next.";
    case "scrum-master":
      return "Create workspaces, connect delivery systems, and keep sprint operations ready for team execution.";
    case "engineering-manager":
      return "Track architecture, delivery load, and team risk across the projects you support.";
    case "qa-lead":
      return "Scan release readiness, blockers, and validation pressure across active sprint work.";
    case "presenter":
      return "Open clean project narratives backed by sprint, Jira, Git, and standup signal.";
    case "developer":
    default:
      return "Open your assigned sprint spaces and keep your delivery updates tied to the right project.";
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
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatHealth(score: number) {
  return score > 0 ? score : "--";
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
  return "Collecting";
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

function progressWidth(score: number, min = 5) {
  return `${Math.max(min, Math.min(100, score))}%`;
}

function emptyProjectCopy(canUseSetupActions: boolean, canCreateProject: boolean, canConnectProject: boolean) {
  if (!canUseSetupActions) {
    return "Ask a project lead to add you to a SprintPulse project workspace.";
  }

  if (canCreateProject && canConnectProject) {
    return "Create a fresh project or connect Jira to begin collecting sprint signal.";
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
      <div className="grid min-h-[360px] place-items-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/85 px-5 py-3 text-sm font-semibold text-slate-600 shadow-lg shadow-slate-900/5 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
          <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
          Loading projects
        </div>
      </div>
    );
  }

  if (error || !data || !persona) {
    return (
      <Card className="border-danger-500/20 bg-danger-500/10 text-danger-700 dark:text-danger-100">
        <CardContent className="flex min-h-[220px] items-center gap-3 p-6">
          <ShieldAlert className="h-5 w-5" />
          <span className="font-semibold">{error ?? "Projects unavailable"}</span>
        </CardContent>
      </Card>
    );
  }

  const isProductOwner = persona.productPersona === "product-owner";
  const canUseSetupActions = data.canCreateProject || data.canConnectProject;
  const hasSetupActions = canUseSetupActions && (data.canCreateProject || data.canConnectProject);
  const totalAtRisk = data.projects.reduce((total, project) => total + project.atRiskCount, 0);
  const totalMembers = data.uniqueMemberCount;
  const recommendedProject = data.projects.find((project) => project.id === data.recommendedProjectId);
  const activeProject = data.projects.find((project) => project.id === activeProjectId) ?? recommendedProject ?? data.projects[0];

  return (
    <motion.div
      className={workspacePageClass}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
    >
      <section className="premium-surface relative rounded-2xl p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-400/70 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,169,154,0.08),transparent_38%,rgba(132,98,232,0.10)),linear-gradient(90deg,rgba(255,255,255,0.38),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(16,169,154,0.11),transparent_38%,rgba(132,98,232,0.15))]" />
        <div className="relative grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="grid content-between gap-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="gap-2 border-primary-500/20 bg-primary-500/10 px-3 py-1 text-primary-700 dark:text-primary-100" variant="outline">
                  <Sparkles className="h-3.5 w-3.5" />
                  {persona.title}
                </Badge>
                <Badge className="gap-2 border-slate-200 bg-white/70 px-3 py-1 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300" variant="outline">
                  <Activity className="h-3.5 w-3.5" />
                  {data.projects.length ? `${data.projects.length} active` : "Ready to start"}
                </Badge>
              </div>
              <div className="max-w-3xl space-y-3">
                <h1 className="m-0 text-4xl font-black leading-[1.04] tracking-normal text-slate-950 dark:text-white">{projectHeading(persona)}</h1>
                <p className="m-0 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">{projectCopy(persona)}</p>
              </div>
            </div>

            <div className="grid auto-rows-fr gap-3 sm:grid-cols-3">
              {[
                [Layers3, `${data.projects.length}`, "Projects"],
                [Target, `${totalAtRisk}`, "Risk signals"],
                [Users, `${totalMembers}`, "People"]
              ].map(([Icon, value, label]) => {
                const MetricIcon = Icon as typeof Layers3;
                return (
                  <div
                    className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/72 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.055]"
                    key={label as string}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-500/10 text-primary-700 dark:text-primary-100">
                      <MetricIcon className="h-4 w-4" />
                    </span>
                    <span className="grid gap-0.5">
                      <strong className="text-2xl font-black leading-none text-slate-950 dark:text-white">{value as string}</strong>
                      <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{label as string}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <Card className="relative overflow-hidden rounded-2xl border-slate-200/80 bg-slate-950 text-white shadow-[0_18px_60px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-white/[0.055]">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,169,154,0.25),transparent_42%,rgba(68,123,219,0.25)),linear-gradient(180deg,rgba(255,255,255,0.10),transparent)]" />
            <CardContent className="relative grid gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="m-0 text-xs font-black uppercase text-primary-100/80">Project setup</p>
                  <h2 className="m-0 mt-1 text-xl font-black tracking-normal text-white">Build or connect</h2>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/10 text-primary-100">
                  <Zap className="h-5 w-5" />
                </span>
              </div>
              <div className="grid gap-3">
                {canUseSetupActions && data.canCreateProject ? (
                  <Link
                    className="group grid gap-2 rounded-2xl border border-white/10 bg-white/[0.08] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary-300/50 hover:bg-white/[0.12]"
                    to="/projects/new"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-sm font-black text-white">
                        <Plus className="h-4 w-4 text-primary-200" />
                        Create project
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-primary-200 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                    <small className="text-sm leading-6 text-slate-300">Start a sprint workspace with name, dates, goal, and ownership.</small>
                  </Link>
                ) : null}
                {canUseSetupActions && data.canConnectProject ? (
                  <Link
                    className="group grid gap-2 rounded-2xl border border-white/10 bg-white/[0.08] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-info-300/50 hover:bg-white/[0.12]"
                    to="/projects/connect"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-sm font-black text-white">
                        <Cloud className="h-4 w-4 text-info-200" />
                        Connect existing
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-info-200 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                    <small className="text-sm leading-6 text-slate-300">Import Jira project context and prepare sprint signal.</small>
                  </Link>
                ) : null}
                {!canUseSetupActions ? (
                  <div className="flex gap-3 rounded-2xl border border-warning-300/20 bg-warning-300/10 p-4 text-sm leading-6 text-warning-100">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{isProductOwner ? "Project setup is handled by delivery leads." : "Project setup is handled by project leads."}</span>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {data.projects.length ? (
        <>
          {activeProject ? (
            <motion.section
              className="premium-surface grid items-stretch gap-5 rounded-2xl p-5 lg:grid-cols-[minmax(0,1fr)_320px]"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.14, ease: "easeOut" }}
            >
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="gap-2 border-primary-500/20 bg-primary-500/10 px-3 py-1 text-primary-700 dark:text-primary-100" variant="outline">
                    <ListChecks className="h-3.5 w-3.5" />
                    Focus workspace
                  </Badge>
                </div>
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="m-0 text-2xl font-black tracking-normal text-slate-950 dark:text-white">{activeProject.name}</h2>
                      <p className="m-0 mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{activeProject.sprintGoal}</p>
                    </div>
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-5 text-sm font-black text-white shadow-[0_14px_36px_rgba(16,169,154,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(16,169,154,0.30)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                      type="button"
                      onClick={() => openProject(activeProject)}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      {isProductOwner ? "View details" : "Open workspace"}
                    </button>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between text-sm font-black text-slate-600 dark:text-slate-300">
                      <span>{healthLabel(activeProject.healthScore)}</span>
                      <span>{formatHealth(activeProject.healthScore)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10" aria-hidden="true">
                      <span
                        className={cn("block h-full rounded-full bg-gradient-to-r", healthAccentClass(activeProject.healthScore))}
                        style={{ width: progressWidth(activeProject.healthScore) }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-950/30">
                {[
                  [Layers3, activeProject.key, "Project key"],
                  [CalendarDays, activeProject.sprintName, "Active sprint"],
                  [RefreshCw, formatSyncDate(activeProject.lastSyncAt), "Last sync"],
                  [Users, `${activeProject.memberCount} people`, "Team"]
                ].map(([Icon, value, label]) => {
                  const MetaIcon = Icon as typeof Layers3;
                  return (
                    <span className="flex items-center gap-3" key={label as string}>
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-primary-700 shadow-sm dark:bg-white/10 dark:text-primary-100">
                        <MetaIcon className="h-4 w-4" />
                      </span>
                      <span className="grid">
                        <strong className="text-sm font-black text-slate-950 dark:text-white">{value as string}</strong>
                        <small className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{label as string}</small>
                      </span>
                    </span>
                  );
                })}
              </div>
            </motion.section>
          ) : null}

          <section
            className="premium-surface grid gap-5 rounded-2xl p-5"
            aria-labelledby="projects-list-title"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <Badge className="mb-3 gap-2 border-danger-500/20 bg-danger-500/10 px-3 py-1 text-danger-600 dark:text-danger-100" variant="outline">
                  <FolderKanban className="h-3.5 w-3.5" />
                  Workspace list
                </Badge>
                <h2 className="m-0 text-2xl font-black tracking-normal text-slate-950 dark:text-white" id="projects-list-title">
                  All accessible projects
                </h2>
              </div>
              <Badge className="border-primary-500/20 bg-primary-500/10 px-4 py-2 text-sm font-black text-primary-700 dark:text-primary-100" variant="outline">
                {data.projects.length} total
              </Badge>
            </div>

            <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-5 xl:grid-cols-2" aria-label="Available projects">
              {data.projects.map((project, index) => (
                <motion.article
                  className={cn(
                    "premium-surface group relative h-full rounded-2xl text-slate-950 transition duration-200 hover:-translate-y-1 hover:border-primary-500/35 dark:text-white",
                    data.recommendedProjectId === project.id && "border-primary-500/35"
                  )}
                  key={project.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.18 + index * 0.04, ease: "easeOut" }}
                >
                  <div className="absolute inset-x-0 top-0 h-1.5 bg-slate-200 dark:bg-white/10" aria-hidden="true">
                    <span
                      className={cn("block h-full rounded-r-full bg-gradient-to-r", healthAccentClass(project.healthScore))}
                      style={{ width: progressWidth(project.healthScore, 12) }}
                    />
                  </div>
                  <CardContent className="relative grid h-full min-h-[276px] gap-4 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className="gap-2 border-primary-500/20 bg-primary-500/10 px-2.5 py-1 text-primary-700 dark:text-primary-100" variant="outline">
                        <Layers3 className="h-3.5 w-3.5" />
                        {project.key}
                      </Badge>
                      <Badge className={cn("px-2.5 py-1", sourcePillClass(project.source))} variant="outline">
                        {sourceLabel(project.source)}
                      </Badge>
                    </div>

                    <div className="grid gap-2">
                      <button className="grid gap-2 text-left" type="button" onClick={() => setActiveProjectId(project.id)}>
                        <h3 className="m-0 text-xl font-black leading-tight tracking-normal text-slate-950 transition group-hover:text-primary-700 dark:text-white dark:group-hover:text-primary-100">
                          {project.name}
                        </h3>
                        <p className="m-0 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{project.sprintGoal}</p>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {project.sprintName}
                      </span>
                      <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        <RefreshCw className="h-3.5 w-3.5" />
                        {formatSyncDate(project.lastSyncAt)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        ["Health", formatHealth(project.healthScore)],
                        ["At risk", project.atRiskCount],
                        ["People", project.memberCount]
                      ].map(([label, value]) => (
                        <span
                          className="grid min-h-[58px] content-center gap-1 rounded-xl border border-slate-200/80 bg-white/78 px-3 py-2 text-xs font-bold text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300"
                          key={label}
                        >
                          <strong className="text-xl font-black leading-none text-slate-950 dark:text-white">{value}</strong>
                          {label}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                      <Badge className={cn("px-2.5 py-1", healthBadgeClass(project.healthScore))} variant="outline">
                        {formatRole(project.currentUserRole)}
                      </Badge>
                      <button
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-info-500 px-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(16,169,154,0.20)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(16,169,154,0.26)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                        type="button"
                        onClick={() => openProject(project)}
                      >
                        <ArrowRight className="h-4 w-4" />
                        {isProductOwner ? "View details" : "Open workspace"}
                      </button>
                    </div>
                  </CardContent>
                </motion.article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <motion.section
          className="premium-surface grid gap-5 rounded-2xl p-8 text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, delay: 0.16, ease: "easeOut" }}
        >
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-100">
            <FolderKanban className="h-6 w-6" />
          </span>
          <div className="mx-auto max-w-xl space-y-2">
            <p className="m-0 text-xs font-black uppercase text-primary-700 dark:text-primary-100">No workspaces yet</p>
            <h2 className="m-0 text-2xl font-black tracking-normal text-slate-950 dark:text-white">Create the first project space</h2>
            <p className="m-0 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {emptyProjectCopy(canUseSetupActions, data.canCreateProject, data.canConnectProject)}
            </p>
          </div>
          {hasSetupActions ? (
            <div className="flex flex-wrap justify-center gap-3">
              {data.canCreateProject ? (
                <Link className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(16,169,154,0.22)]" to="/projects/new">
                  <Plus className="h-4 w-4" />
                  Create project
                </Link>
              ) : null}
              {data.canConnectProject ? (
                <Link className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100" to="/projects/connect">
                  <Cloud className="h-4 w-4" />
                  Connect Jira
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto flex max-w-xl gap-3 rounded-2xl border border-warning-500/20 bg-warning-500/10 p-4 text-left text-sm leading-6 text-warning-700 dark:text-warning-100">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{isProductOwner ? "Setup actions are handled by Scrum Masters." : "Project setup is managed by Scrum Masters."}</span>
            </div>
          )}
        </motion.section>
      )}
    </motion.div>
  );
}
