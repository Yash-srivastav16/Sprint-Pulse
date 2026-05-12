import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  Gauge,
  GitBranch,
  Layers3,
  Loader2,
  MessageSquareText,
  Plus,
  RadioTower,
  RefreshCw,
  Sparkles,
  Target,
  UserRound,
  Users
} from "lucide-react";
import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import type { CreateProjectSprintRequest, Persona, ProjectOpsResponse } from "@sprintpulse/shared";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  EmptyPanel,
  MemberAvatar,
  PanelHeader,
  SectionPanel,
  StatusPill,
  WorkspaceError,
  WorkspaceHero,
  WorkspaceLoading,
  workspacePageClass
} from "@/components/workspace/WorkspaceChrome";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import { cn } from "../lib/utils";

function workspaceCopy(persona: Persona | null) {
  switch (persona?.productPersona) {
    case "product-owner":
      return "Health, participation, blockers, sprint context, and the next delivery decision for this project.";
    case "scrum-master":
      return "The operational home for keeping sprint signal current, visible, and ready for action.";
    case "developer":
      return "Your project context, active sprint, standup route, and delivery pulse in one place.";
    default:
      return "Sprint health, delivery signals, and team context for this project.";
  }
}

function formatShortDate(value?: string) {
  if (!value) {
    return "Date pending";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "Date pending";
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatSyncDateTime(value?: string) {
  if (!value) {
    return "Pending";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatStatus(status: string) {
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sourceLabel(source: ProjectOpsResponse["project"]["source"]) {
  return source === "manual" ? "Manual" : "Jira";
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

function healthTone(score: number) {
  if (score >= 85) {
    return "success" as const;
  }
  if (score >= 70) {
    return "warning" as const;
  }
  if (score > 0) {
    return "danger" as const;
  }
  return "neutral" as const;
}

function progressWidth(score: number, min = 5) {
  return `${Math.max(min, Math.min(100, score))}%`;
}

const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const nextSprintName = (name: string) => {
  const match = name.match(/^(.*?)(\d+)$/);
  if (!match) {
    return `${name} 2`;
  }

  return `${match[1]}${Number(match[2]) + 1}`;
};

function ActionTile({
  to,
  icon: Icon,
  title,
  description,
  tone = "primary"
}: {
  to: string;
  icon: typeof Gauge;
  title: string;
  description: string;
  tone?: "primary" | "info" | "warning" | "ai";
}) {
  const toneClass =
    tone === "info"
      ? "from-info-500/14 to-primary-500/10 text-info-700 dark:text-info-100"
      : tone === "warning"
        ? "from-warning-500/14 to-primary-500/10 text-warning-700 dark:text-warning-100"
        : tone === "ai"
          ? "from-ai-500/14 to-info-500/10 text-ai-700 dark:text-ai-100"
          : "from-primary-500/14 to-info-500/10 text-primary-700 dark:text-primary-100";

  return (
    <Link
      className="group relative flex h-full min-h-[188px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/86 p-5 shadow-[0_16px_46px_rgba(15,23,42,0.08)] transition duration-200 hover:-translate-y-1 hover:border-primary-500/35 hover:shadow-[0_24px_68px_rgba(15,23,42,0.13)] dark:border-white/10 dark:bg-white/[0.055]"
      to={to}
    >
      <span className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", toneClass)} />
      <span className={cn("grid h-11 w-11 place-items-center rounded-xl border bg-gradient-to-br", toneClass)}>
        <Icon className="h-5 w-5" />
      </span>
      <strong className="mt-5 block text-lg font-black tracking-normal text-slate-950 dark:text-white">{title}</strong>
      <span className="mt-2 block text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</span>
      <em className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-black not-italic text-primary-700 transition group-hover:gap-3 dark:text-primary-100">
        Open <ArrowRight className="h-4 w-4" />
      </em>
    </Link>
  );
}

export function ProjectWorkspacePage() {
  const { projectId } = useParams();
  const { persona } = useAuth();
  const { selectProject } = useProject();
  const [workspace, setWorkspace] = useState<ProjectOpsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSprintForm, setShowSprintForm] = useState(false);
  const [savingSprint, setSavingSprint] = useState(false);
  const [sprintFeedback, setSprintFeedback] = useState<string | null>(null);
  const [sprintDraft, setSprintDraft] = useState({
    name: "",
    goal: "",
    startDate: "",
    endDate: "",
    status: "planned" as CreateProjectSprintRequest["status"]
  });

  const applyWorkspace = useCallback(
    (response: ProjectOpsResponse) => {
      setWorkspace(response);
      selectProject(response.project.id, {
        source: response.project.source === "manual" ? "manual" : "jira",
        projectName: response.project.name,
        projectKey: response.project.key,
        sprintName: response.project.sprint.name,
        sprintGoal: response.project.sprint.goal,
        jiraSite: response.project.jiraSite,
        importedAt: response.project.lastSyncAt
      });
    },
    [selectProject]
  );

  const loadWorkspace = useCallback(async () => {
    if (!persona || !projectId) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.getProjectOps(projectId, persona.id);
      applyWorkspace(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project workspace unavailable");
    } finally {
      setLoading(false);
    }
  }, [applyWorkspace, persona, projectId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  if (loading) {
    return <WorkspaceLoading label="Loading project workspace" />;
  }

  if (error || !workspace) {
    return <WorkspaceError label={error ?? "Project workspace unavailable"} />;
  }

  const { project, summary, integrations, currentSprint } = workspace;
  const canSyncStandups = workspace.permissions.includes("standup:sync");
  const canConfigure = workspace.permissions.includes("project:connect");
  const isProductOwner = persona?.productPersona === "product-owner";
  const isScrumMaster = persona?.productPersona === "scrum-master";
  const boundedHealthScore = Math.max(0, Math.min(100, summary.teamHealthScore));
  const lastSyncLabel = formatSyncDateTime(summary.lastSyncAt ?? project.lastSyncAt);
  const recentRuns = integrations.recentRuns.slice(0, 3);
  const integrationCards = [
    {
      id: "jira",
      label: "Jira",
      status: integrations.jira?.status ?? "not-configured",
      detail: integrations.jira ? integrations.jira.siteUrl : "Not configured",
      Icon: Cloud
    },
    {
      id: "git",
      label: "GitHub",
      status: integrations.git?.status ?? "not-configured",
      detail: integrations.git ? `${integrations.git.repoOwner}/${integrations.git.repoName}` : "Not configured",
      Icon: GitBranch
    },
    {
      id: "sync",
      label: "Sync runs",
      status: recentRuns[0]?.status ?? "queued",
      detail: `${integrations.recentRuns.length} run${integrations.recentRuns.length === 1 ? "" : "s"}`,
      Icon: RadioTower
    }
  ];

  const openSprintDraft = (status: CreateProjectSprintRequest["status"]) => {
    const startDate = addDays(currentSprint.endDate, 1);
    setSprintDraft({
      name: nextSprintName(currentSprint.name),
      goal: currentSprint.goal,
      startDate,
      endDate: addDays(startDate, 13),
      status
    });
    setSprintFeedback(null);
    setShowSprintForm(true);
  };

  const createSprint = async (event: FormEvent) => {
    event.preventDefault();
    if (!persona) {
      return;
    }

    setSavingSprint(true);
    setError(null);
    setSprintFeedback(null);
    try {
      const response = await api.createProjectSprint(project.id, {
        personaId: persona.id,
        ...sprintDraft
      });
      setSprintFeedback(
        sprintDraft.status === "active"
          ? `${response.createdSprint.name} is now the active sprint.`
          : `${response.createdSprint.name} is planned for this project.`
      );
      toast.success(sprintDraft.status === "active" ? "Active sprint started" : "Sprint planned", {
        description: response.createdSprint.name
      });
      setShowSprintForm(false);
      await loadWorkspace();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create sprint";
      setError(message);
      toast.error("Sprint update failed", { description: message });
    } finally {
      setSavingSprint(false);
    }
  };

  return (
    <div className={workspacePageClass}>
      <WorkspaceHero
        eyebrow={
          <>
            <StatusPill icon={Layers3} tone="primary">
              {project.key} workspace
            </StatusPill>
            <StatusPill icon={project.source === "manual" ? Sparkles : Cloud} tone={project.source === "manual" ? "info" : "warning"}>
              {sourceLabel(project.source)}
            </StatusPill>
          </>
        }
        title={project.name}
        description={workspaceCopy(persona)}
        score={summary.teamHealthScore || "--"}
        scoreLabel="Project signal"
        scoreTone={healthTone(summary.teamHealthScore)}
        scoreDetail={
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-black text-white">{healthLabel(summary.teamHealthScore)}</span>
              <span className="text-slate-300">{summary.standupCount} updates · {summary.issueCount} issues</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-primary-400 via-info-400 to-ai-400"
                style={{ width: progressWidth(boundedHealthScore) }}
              />
            </div>
          </div>
        }
        pills={
          <>
            <StatusPill icon={Sparkles} tone="neutral">
              {currentSprint.name}
            </StatusPill>
            <StatusPill icon={CalendarDays} tone="neutral">
              {formatShortDate(currentSprint.startDate)} - {formatShortDate(currentSprint.endDate)}
            </StatusPill>
            <StatusPill icon={RefreshCw} tone="neutral">
              {lastSyncLabel}
            </StatusPill>
          </>
        }
      >
        <p className="m-0 max-w-4xl rounded-2xl border border-slate-200/80 bg-white/65 p-4 text-sm leading-6 text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
          {project.sprint.goal}
        </p>
      </WorkspaceHero>

      <SectionPanel>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <StatusPill icon={CalendarDays} tone="primary">
                Sprint control
              </StatusPill>
              <StatusPill tone={currentSprint.status === "active" ? "success" : "neutral"}>
                {formatStatus(currentSprint.status)}
              </StatusPill>
            </div>
            <h2 className="m-0 text-2xl font-black tracking-normal text-slate-950 dark:text-white">{currentSprint.name}</h2>
            <p className="m-0 mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {formatShortDate(currentSprint.startDate)} - {formatShortDate(currentSprint.endDate)}
            </p>
          </div>
          {canConfigure ? (
            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-500/35 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                type="button"
                onClick={() => openSprintDraft("planned")}
              >
                <Plus className="h-4 w-4" />
                Plan next sprint
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(16,169,154,0.22)] transition hover:-translate-y-0.5"
                type="button"
                onClick={() => openSprintDraft("active")}
              >
                <ArrowRight className="h-4 w-4" />
                Start active sprint
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-warning-500/20 bg-warning-500/10 px-4 py-3 text-sm font-semibold text-warning-700 dark:text-warning-100">
              Project leads manage sprint planning.
            </div>
          )}
        </div>
      </SectionPanel>

      {sprintFeedback ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-100">
          {sprintFeedback}
        </div>
      ) : null}

      {showSprintForm ? (
        <SectionPanel>
          <form className="grid gap-5" onSubmit={createSprint}>
            <PanelHeader
              eyebrow={sprintDraft.status === "active" ? "New active sprint" : "Planned sprint"}
              title={sprintDraft.status === "active" ? "Start sprint" : "Plan sprint"}
              description="Create a sprint record inside the selected project so dashboards, standups, and history stay scoped correctly."
              icon={CalendarDays}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Sprint name</span>
                <Input value={sprintDraft.name} onChange={(event) => setSprintDraft((draft) => ({ ...draft, name: event.target.value }))} required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Status</span>
                <select
                  className="min-h-10 rounded-md border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-950 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                  value={sprintDraft.status}
                  onChange={(event) =>
                    setSprintDraft((draft) => ({
                      ...draft,
                      status: event.target.value as CreateProjectSprintRequest["status"]
                    }))
                  }
                >
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Start date</span>
                <Input type="date" value={sprintDraft.startDate} onChange={(event) => setSprintDraft((draft) => ({ ...draft, startDate: event.target.value }))} required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">End date</span>
                <Input type="date" value={sprintDraft.endDate} onChange={(event) => setSprintDraft((draft) => ({ ...draft, endDate: event.target.value }))} required />
              </label>
              <label className="grid gap-2 lg:col-span-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Goal</span>
                <textarea
                  className="min-h-28 rounded-md border border-slate-200 bg-white/80 px-3 py-3 text-sm font-semibold leading-6 text-slate-950 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                  value={sprintDraft.goal}
                  onChange={(event) => setSprintDraft((draft) => ({ ...draft, goal: event.target.value }))}
                  required
                />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100" type="button" onClick={() => setShowSprintForm(false)}>
                Cancel
              </button>
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(16,169,154,0.22)] disabled:pointer-events-none disabled:opacity-60" type="submit" disabled={savingSprint}>
                {savingSprint ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {sprintDraft.status === "active" ? "Start sprint" : "Save planned sprint"}
              </button>
            </div>
          </form>
        </SectionPanel>
      ) : null}

      <section className="grid auto-rows-fr items-stretch gap-4 md:grid-cols-2 xl:grid-cols-5" aria-label="Workspace actions">
        <ActionTile
          to={`/projects/${project.id}/dashboard`}
          icon={Gauge}
          title={isProductOwner ? "Project health" : "Dashboard"}
          description="Structured health, risk drivers, recommendations, and team pulse."
        />
        <ActionTile
          to={`/projects/${project.id}/standups`}
          icon={ClipboardCheck}
          title={isScrumMaster ? "Review standups" : "Submit standup"}
          description={canSyncStandups ? "Review updates and refresh connected standup data." : "Capture manual, transcript, or uploaded standup text."}
          tone="info"
        />
        <ActionTile
          to={canSyncStandups ? `/projects/${project.id}/integrations` : `/projects/${project.id}/members/${workspace.viewer.id}`}
          icon={canSyncStandups ? RefreshCw : UserRound}
          title={canSyncStandups ? "Refresh signals" : "Your pulse"}
          description={canConfigure ? "Configure Jira and GitHub, then sync sprint evidence." : "Open delivery signals, flags, and recent history."}
          tone="warning"
        />
        <ActionTile
          to={`/projects/${project.id}/team`}
          icon={Users}
          title="Team"
          description="Roles, invite access, Jira IDs, GitHub handles, and ownership."
          tone="ai"
        />
        <ActionTile
          to={`/projects/${project.id}/sprints`}
          icon={CalendarDays}
          title="Sprints"
          description="Active sprint plus historical sprint signal for this project."
        />
      </section>

      <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SectionPanel>
          <PanelHeader
            eyebrow="Next actions"
            title={isScrumMaster ? "Delivery operations" : isProductOwner ? "Product review path" : "Recommended flow"}
            description="The workspace keeps actions small and project-scoped so the demo story stays easy to follow."
            icon={Activity}
          />
          <div className="grid gap-3">
            {[
              { id: "ST", label: "Capture standups", description: "Manual, transcript, upload, and guided sync all write to this sprint.", route: `/projects/${project.id}/standups` },
              { id: "IN", label: integrations.jira || integrations.git ? "Refresh integrations" : "Configure integrations", description: "Connect Jira and GitHub signals for issues, commits, and say-do gap scoring.", route: `/projects/${project.id}/integrations` },
              { id: "DB", label: "Review health", description: "Open team risk, member pulse, blockers, and recommendations.", route: `/projects/${project.id}/dashboard` }
            ].map((action) => (
              <Link
                className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 transition hover:-translate-y-0.5 hover:border-primary-500/35 dark:border-white/10 dark:bg-white/[0.045]"
                key={action.id}
                to={action.route}
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-500/10 text-sm font-black text-primary-700 dark:text-primary-100">{action.id}</span>
                <span className="min-w-0">
                  <strong className="block text-base font-black text-slate-950 dark:text-white">{action.label}</strong>
                  <small className="mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400">{action.description}</small>
                </span>
                <ArrowRight className="h-4 w-4 text-primary-600 dark:text-primary-200" />
              </Link>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel>
          <PanelHeader eyebrow="Signals" title="Integration readiness" description={lastSyncLabel} icon={RadioTower} tone="info" />
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {integrationCards.map((card) => (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]" key={card.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
                    <card.Icon className="h-4 w-4 text-primary-600 dark:text-primary-200" />
                    {card.label}
                  </span>
                  <Badge className="border-slate-200 bg-white/70 text-xs font-black text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300" variant="outline">
                    {formatStatus(card.status)}
                  </Badge>
                </div>
                <p className="m-0 mt-2 truncate text-sm text-slate-500 dark:text-slate-400">{card.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {recentRuns.length ? (
              recentRuns.map((run) => (
                <span className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.045]" key={run.id}>
                  <CheckCircle2 className="h-4 w-4 text-primary-600 dark:text-primary-200" />
                  <strong className="truncate text-slate-950 dark:text-white">{formatStatus(run.source)}</strong>
                  <small className="font-bold text-slate-500 dark:text-slate-400">{formatStatus(run.status)}</small>
                </span>
              ))
            ) : (
              <EmptyPanel icon={RefreshCw} title="No sync runs yet" description="Configure or sync Jira/Git to populate recent run history." />
            )}
          </div>
        </SectionPanel>
      </section>

      <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <SectionPanel>
          <PanelHeader eyebrow="Team" title={`${project.members.length} people in sprint`} description={currentSprint.name} icon={Users} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {project.members.map((member) => (
              <Link
                className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 transition hover:-translate-y-0.5 hover:border-primary-500/35 dark:border-white/10 dark:bg-white/[0.045]"
                key={member.personaId}
                to={`/projects/${project.id}/members/${member.personaId}`}
              >
                <MemberAvatar initials={member.initials} />
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-black text-slate-950 dark:text-white">{member.name}</strong>
                  <small className="block truncate text-sm text-slate-500 dark:text-slate-400">{formatStatus(member.role)}</small>
                </span>
              </Link>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel>
          <PanelHeader eyebrow="Sprint" title={currentSprint.name} description={`${formatShortDate(currentSprint.startDate)} - ${formatShortDate(currentSprint.endDate)}`} icon={Target} tone="warning" />
          <div className="grid gap-3">
            {[
              [Layers3, formatStatus(currentSprint.status), "Status"],
              [ClipboardCheck, currentSprint.standupCount, "Standups"],
              [Gauge, currentSprint.healthScore, "Health"]
            ].map(([Icon, value, label]) => {
              const ItemIcon = Icon as typeof Layers3;
              return (
                <div className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]" key={label as string}>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-warning-500/10 text-warning-700 dark:text-warning-100">
                    <ItemIcon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{label as string}</span>
                  <strong className="text-lg font-black text-slate-950 dark:text-white">{value as string | number}</strong>
                </div>
              );
            })}
          </div>
        </SectionPanel>
      </section>
    </div>
  );
}
