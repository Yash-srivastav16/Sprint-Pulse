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
      return "Create projects, connect delivery systems, and keep sprint operations ready for team execution.";
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

function priorityCopy(project: ProjectSummary) {
  if (project.healthScore <= 0) {
    return {
      label: "Signal setup needed",
      detail: "Sync standups, Jira, and GitHub before SprintPulse can explain delivery risk."
    };
  }

  if (project.atRiskCount > 0) {
    return {
      label: `${project.atRiskCount} risk signal${project.atRiskCount === 1 ? "" : "s"}`,
      detail: "Open the dashboard to see the evidence, owner, and next action."
    };
  }

  if (!project.lastSyncAt) {
    return {
      label: "Sync evidence",
      detail: "Connect the latest Jira/Git movement before the next standup review."
    };
  }

  return {
    label: "Ready for review",
    detail: "Health is stable; keep standup and integration signals fresh."
  };
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
    return "Ask a project lead to add you to a SprintPulse project.";
  }

  if (canCreateProject && canConnectProject) {
    return "Create a fresh project or connect Jira to begin collecting sprint signals.";
  }

  if (canCreateProject) {
    return "Create a project and add the first active sprint.";
  }

  if (canConnectProject) {
    return "Connect Jira to turn an existing delivery space into SprintPulse.";
  }

  return "Project creation is limited for your role.";
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
  }, [persona?.id]);

  const openProject = (project: ProjectSummary) => {
    selectProject(project.id, {
      source: project.source === "manual" ? "manual" : "jira",
      projectName: project.name,
      projectKey: project.key,
      sprintName: project.sprintName,
      sprintGoal: project.sprintGoal,
      importedAt: project.lastSyncAt
    });
    navigate(`/projects/${project.id}/dashboard`);
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
  const activePriority = activeProject ? priorityCopy(activeProject) : null;
  const attentionProjects = [...data.projects]
    .sort((left, right) => {
      const leftHealth = left.healthScore > 0 ? left.healthScore : 101;
      const rightHealth = right.healthScore > 0 ? right.healthScore : 101;
      return right.atRiskCount - left.atRiskCount || leftHealth - rightHealth || left.name.localeCompare(right.name);
    })
    .slice(0, 3);

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
        <div className="relative grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="grid content-start gap-6">
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

            {attentionProjects.length ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge className="gap-2 border-warning-500/25 bg-warning-500/10 px-3 py-1 text-warning-700 dark:text-warning-100" variant="outline">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Attention queue
                  </Badge>
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Highest risk first
                  </span>
                </div>
                <div className="grid gap-2">
                  {attentionProjects.map((project) => {
                    const priority = priorityCopy(project);
                    const isSelected = activeProject?.id === project.id;

                    return (
                      <button
                        className={cn(
                          "group grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                          isSelected
                            ? "border-primary-500/35 bg-white/88 shadow-[0_14px_34px_rgba(16,169,154,0.12)] dark:border-primary-300/30 dark:bg-white/[0.09]"
                            : "border-slate-200/80 bg-white/62 hover:border-primary-500/25 hover:bg-white/82 dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.07]"
                        )}
                        key={project.id}
                        type="button"
                        onClick={() => setActiveProjectId(project.id)}
                      >
                        <span className="min-w-0">
                          <strong className="block truncate text-sm font-black text-slate-950 dark:text-white">
                            {project.name}
                          </strong>
                          <span className="mt-1 block truncate text-sm font-semibold text-slate-600 dark:text-slate-300">
                            {priority.label} · {project.sprintName}
                          </span>
                        </span>
                        <span className="grid justify-items-end gap-1">
                          <span className={cn("rounded-full border px-2.5 py-1 text-xs font-black", healthBadgeClass(project.healthScore))}>
                            {formatHealth(project.healthScore)}
                          </span>
                          <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                            health
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <Card className="relative overflow-hidden rounded-2xl border-slate-200/80 bg-white/90 text-slate-950 shadow-[0_18px_60px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-white/[0.055] dark:text-white">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,169,154,0.10),transparent_42%,rgba(68,123,219,0.12)),linear-gradient(180deg,rgba(255,255,255,0.72),transparent)] dark:bg-[linear-gradient(135deg,rgba(16,169,154,0.18),transparent_42%,rgba(68,123,219,0.20)),linear-gradient(180deg,rgba(255,255,255,0.08),transparent)]" />
            <CardContent className="relative grid gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="m-0 text-xs font-black uppercase tracking-[0.14em] text-primary-700 dark:text-primary-100/80">
                    {activeProject ? "Needs attention now" : "Project setup"}
                  </p>
                  <h2 className="m-0 mt-1 text-xl font-black tracking-normal text-slate-950 dark:text-white">
                    {activeProject ? activeProject.name : "Build or connect"}
                  </h2>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-primary-500/20 bg-primary-500/10 text-primary-700 dark:border-white/10 dark:bg-white/10 dark:text-primary-100">
                  {activeProject ? <ShieldAlert className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                </span>
              </div>
              {activeProject && activePriority ? (
                <div className="rounded-2xl border border-slate-200/80 bg-white/76 p-4 text-sm leading-6 text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300">
                  <Badge className={cn("mb-3 px-2.5 py-1", healthBadgeClass(activeProject.healthScore))} variant="outline">
                    {activePriority.label}
                  </Badge>
                  <p className="m-0 font-semibold">{activePriority.detail}</p>
                  <button
                    className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-info-500 px-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(16,169,154,0.20)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    type="button"
                    onClick={() => openProject(activeProject)}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    Open risk board
                  </button>
                </div>
              ) : null}
              <div className="grid gap-3">
                {canUseSetupActions && data.canCreateProject ? (
                  <Link
                    className="group grid gap-2 rounded-2xl border border-slate-200/80 bg-white/72 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary-500/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:border-white/10 dark:bg-white/[0.08] dark:hover:border-primary-300/50 dark:hover:bg-white/[0.12]"
                    to="/projects/new"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
                        <Plus className="h-4 w-4 text-primary-600 dark:text-primary-200" />
                        Create project
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-primary-600 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 dark:text-primary-200" />
                    </span>
                    <small className="text-sm leading-6 text-slate-600 dark:text-slate-300">Start a sprint project with name, dates, goal, and ownership.</small>
                  </Link>
                ) : null}
                {canUseSetupActions && data.canConnectProject ? (
                  <Link
                    className="group grid gap-2 rounded-2xl border border-slate-200/80 bg-white/72 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-info-500/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-400 dark:border-white/10 dark:bg-white/[0.08] dark:hover:border-info-300/50 dark:hover:bg-white/[0.12]"
                    to="/projects/connect"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
                        <Cloud className="h-4 w-4 text-info-600 dark:text-info-200" />
                        Connect existing
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-info-600 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 dark:text-info-200" />
                    </span>
                    <small className="text-sm leading-6 text-slate-600 dark:text-slate-300">Import Jira project context and prepare sprint signal.</small>
                  </Link>
                ) : null}
                {!canUseSetupActions ? (
                  <div className="flex gap-3 rounded-2xl border border-warning-300/30 bg-warning-300/10 p-4 text-sm leading-6 text-warning-700 dark:text-warning-100">
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
          {/* ─── 02 / Spotlight ──────────────────────────────────────────── */}
          {activeProject ? (
            <>
              <div className="flex items-baseline gap-4 pt-2">
                <span className="font-mono text-[0.72rem] font-black tracking-wider text-primary-500 dark:text-primary-400">02</span>
                <span className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-primary-700 dark:text-primary-200">Spotlight</span>
                <span className="h-px flex-1 bg-gradient-to-r from-primary-500/40 via-primary-500/10 to-transparent dark:from-primary-400/30 dark:via-primary-400/[0.05]" />
              </div>

              <motion.section
                className="premium-surface relative overflow-hidden rounded-2xl p-6 shadow-[0_18px_60px_rgba(15,23,42,0.05)]"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: 0.14, ease: "easeOut" }}
              >
                {/* Soft gradient accent stripe down the left edge — fades at top and bottom
                    so it reads as a focused highlight rather than a flat border. Paired
                    with a faint top hairline for editorial elegance. */}
                <span aria-hidden className="pointer-events-none absolute inset-y-5 left-0 w-[3px] rounded-full bg-gradient-to-b from-primary-500/10 via-primary-500/85 to-primary-500/10 dark:from-primary-400/10 dark:via-primary-400/85 dark:to-primary-400/10" />
                <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/35 to-transparent dark:via-primary-400/35" />

                <div className="relative grid gap-5">
                  {/* Top row: badges on left + role chip on right */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-500/30 bg-primary-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-primary-700 dark:text-primary-100">
                        <ListChecks className="h-3 w-3" />
                        Start here
                      </span>
                      {activePriority ? (
                        <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em]", healthBadgeClass(activeProject.healthScore))}>
                          <span className="relative inline-flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                          </span>
                          {activePriority.label}
                        </span>
                      ) : null}
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/60 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                      Role &middot; {formatRole(activeProject.currentUserRole)}
                    </span>
                  </div>

                  {/* Title + sprint goal */}
                  <div className="min-w-0">
                    <h2 className="m-0 text-[1.9rem] font-black leading-[1.08] tracking-[-0.01em] text-slate-950 dark:text-white">{activeProject.name}</h2>
                    <p className="m-0 mt-2 max-w-3xl text-[0.95rem] leading-7 text-slate-600 dark:text-slate-300">{activeProject.sprintGoal}</p>
                  </div>

                  {/* Inline meta strip with vertical hairline dividers between columns */}
                  <div className="grid divide-y divide-slate-200/70 overflow-hidden rounded-xl border border-slate-200/80 bg-white/55 dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.035] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                    {[
                      { Icon: Layers3, value: activeProject.key, label: "Key", mono: true },
                      { Icon: CalendarDays, value: activeProject.sprintName, label: "Sprint", mono: false },
                      { Icon: RefreshCw, value: formatSyncDate(activeProject.lastSyncAt), label: "Last sync", mono: true },
                      { Icon: Users, value: `${activeProject.memberCount} people`, label: "Team", mono: false }
                    ].map(({ Icon, value, label, mono }) => (
                      <div className="flex items-center gap-2.5 px-4 py-3" key={label}>
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100/80 text-slate-500 dark:bg-white/[0.07] dark:text-slate-400">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="grid min-w-0">
                          <strong className={cn("truncate text-sm font-black text-slate-950 dark:text-white", mono && "font-mono tabular-nums")}>{value}</strong>
                          <small className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</small>
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Health bar */}
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.22em]">
                      <span className="text-slate-500 dark:text-slate-400">{healthLabel(activeProject.healthScore)} &middot; health</span>
                      <span className="font-mono text-slate-600 tabular-nums dark:text-slate-300">{formatHealth(activeProject.healthScore)}</span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10" aria-hidden>
                      {activeProject.healthScore > 0 ? (
                        <span
                          className={cn("block h-full rounded-full bg-gradient-to-r shadow-[0_0_12px_rgba(16,169,154,0.25)]", healthAccentClass(activeProject.healthScore))}
                          style={{ width: progressWidth(activeProject.healthScore) }}
                        />
                      ) : (
                        <span className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(148,163,184,0.22)_0_6px,transparent_6px_12px)]" />
                      )}
                    </div>
                  </div>

                  {/* Priority callout — flat strip with a tinted icon chip */}
                  {activePriority ? (
                    <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/55 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary-500/10 text-primary-700 dark:bg-primary-400/15 dark:text-primary-100">
                        <ShieldAlert className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <strong className="block text-sm font-black text-slate-950 dark:text-white">{activePriority.label}</strong>
                        <p className="m-0 text-sm leading-6 text-slate-600 dark:text-slate-300">{activePriority.detail}</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Single CTA — right-aligned, arrow nudges on hover */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => openProject(activeProject)}
                      className="group/cta inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-info-500 px-5 text-sm font-black text-white shadow-[0_14px_36px_rgba(16,169,154,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(16,169,154,0.30)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                      {isProductOwner ? "View details" : "Open dashboard"}
                      <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
                    </button>
                  </div>
                </div>
              </motion.section>
            </>
          ) : null}

          {/* ─── 03 / All projects ───────────────────────────────────────── */}
          <div className="flex items-baseline gap-4 pt-2">
            <span className="font-mono text-[0.72rem] font-black tracking-wider text-slate-400 dark:text-slate-500">03</span>
            <span className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-700 dark:text-slate-300">All projects</span>
            <span className="font-mono text-[10px] font-bold tabular-nums text-slate-500 dark:text-slate-400">{data.projects.length} total</span>
            <span className="h-px flex-1 bg-gradient-to-r from-slate-300/70 via-slate-200/30 to-transparent dark:from-white/15 dark:via-white/[0.04]" />
          </div>

          <section className="grid auto-rows-fr grid-cols-1 items-stretch gap-5 xl:grid-cols-2" aria-label="Available projects">
            {data.projects.map((project, index) => {
              const isRecommended = data.recommendedProjectId === project.id;
              const isAtRisk = project.atRiskCount > 0 || (project.healthScore > 0 && project.healthScore < 70);
              const isWatch = !isAtRisk && project.healthScore > 0 && project.healthScore < 85;
              const isHealthy = project.healthScore >= 85;
              const stripeClass = isRecommended
                ? "border-l-primary-500/80 dark:border-l-primary-400/80"
                : isAtRisk
                  ? "border-l-danger-500/70 dark:border-l-danger-400/70"
                  : isWatch
                    ? "border-l-warning-500/55 dark:border-l-warning-400/55"
                    : isHealthy
                      ? "border-l-success-500/45 dark:border-l-success-400/45"
                      : "border-l-slate-300/60 dark:border-l-white/15";
              const priority = priorityCopy(project);

              return (
                <motion.article
                  key={project.id}
                  className={cn(
                    "group relative h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_60px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-white/[0.045]",
                    "border-l-[3px]",
                    stripeClass,
                    isRecommended && "ring-1 ring-primary-500/20 dark:ring-primary-300/20"
                  )}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.18 + index * 0.04, ease: "easeOut" }}
                >
                  {/* Subtle corner glow on hover — distinct halo color per tone */}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100",
                      isRecommended ? "bg-primary-500/15 dark:bg-primary-400/15" :
                      isAtRisk ? "bg-danger-500/12 dark:bg-danger-400/12" :
                      isWatch ? "bg-warning-500/12 dark:bg-warning-400/12" :
                      isHealthy ? "bg-success-500/10 dark:bg-success-400/10" :
                      "bg-slate-400/10 dark:bg-white/10"
                    )}
                  />

                  {isRecommended ? (
                    <span className="absolute right-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-primary-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-primary-700 dark:text-primary-100">
                      <Sparkles className="h-2.5 w-2.5" />
                      Recommended
                    </span>
                  ) : null}

                  <CardContent className="relative grid h-full gap-4 p-5">
                    {/* Header: key + source pills */}
                    <div className="flex items-start justify-between gap-3 pr-24">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-50/80 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
                          {project.key}
                        </span>
                        <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider", sourcePillClass(project.source))}>
                          {sourceLabel(project.source)}
                        </span>
                      </div>
                    </div>

                    {/* Title + goal */}
                    <button className="grid gap-1.5 text-left" type="button" onClick={() => setActiveProjectId(project.id)}>
                      <h3 className="m-0 text-[1.35rem] font-black leading-[1.1] tracking-[-0.01em] text-slate-950 transition group-hover:text-primary-700 dark:text-white dark:group-hover:text-primary-100">
                        {project.name}
                      </h3>
                      <p className="m-0 line-clamp-2 text-[0.92rem] leading-6 text-slate-600 dark:text-slate-300">{project.sprintGoal}</p>
                    </button>

                    {/* Unified metadata row — all 4 dimensions inline with vertical hairlines */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3 w-3" />
                        <span className="font-mono tracking-wider normal-case text-slate-700 dark:text-slate-200">{project.sprintName}</span>
                      </span>
                      <span className="h-3 w-px bg-slate-200 dark:bg-white/15" aria-hidden />
                      <span className="inline-flex items-center gap-1.5">
                        <RefreshCw className="h-3 w-3" />
                        <span className="font-mono tracking-wider normal-case text-slate-700 dark:text-slate-200">{formatSyncDate(project.lastSyncAt)}</span>
                      </span>
                      <span className="h-3 w-px bg-slate-200 dark:bg-white/15" aria-hidden />
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3 w-3" />
                        <span className="font-mono tabular-nums normal-case text-slate-700 dark:text-slate-200">{project.memberCount}</span>
                        <span>people</span>
                      </span>
                      <span className="h-3 w-px bg-slate-200 dark:bg-white/15" aria-hidden />
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldAlert className="h-3 w-3" />
                        <span className="font-mono tabular-nums normal-case text-slate-700 dark:text-slate-200">{project.atRiskCount}</span>
                        <span>risks</span>
                      </span>
                    </div>

                    {/* Priority — flat section with top hairline, no nested card */}
                    <div className="grid gap-2 border-t border-slate-200/70 pt-3 dark:border-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Priority signal</span>
                          <strong className="mt-1 block truncate text-[0.95rem] font-black text-slate-950 dark:text-white">{priority.label}</strong>
                        </div>
                        <span className={cn("inline-flex shrink-0 items-baseline gap-1 rounded-md border px-2 py-0.5", healthBadgeClass(project.healthScore))}>
                          <span className="font-mono text-xs font-black tabular-nums">{formatHealth(project.healthScore)}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">health</span>
                        </span>
                      </div>
                      <p className="m-0 text-xs leading-5 text-slate-600 dark:text-slate-300">{priority.detail}</p>
                    </div>

                    {/* Footer */}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Role &middot; <span className="text-slate-700 dark:text-slate-200">{formatRole(project.currentUserRole)}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => openProject(project)}
                        className="group/cta inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-info-500 px-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(16,169,154,0.20)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(16,169,154,0.26)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                      >
                        {isProductOwner ? "View" : "Open"}
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
                      </button>
                    </div>
                  </CardContent>
                </motion.article>
              );
            })}
          </section>
        </>
      ) : (
        <motion.section
          className="premium-surface grid gap-5 rounded-2xl p-10 text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, delay: 0.16, ease: "easeOut" }}
        >
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-100">
            <FolderKanban className="h-6 w-6" />
          </span>
          <div className="mx-auto max-w-xl space-y-2">
            <p className="m-0 text-[10px] font-black uppercase tracking-[0.22em] text-primary-700 dark:text-primary-100">No projects yet</p>
            <h2 className="m-0 text-2xl font-black tracking-tight text-slate-950 dark:text-white">Create the first project space</h2>
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
                <Link className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-info-500/30 bg-info-500/10 px-5 text-sm font-black text-info-700 dark:text-info-100" to="/projects/connect">
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
