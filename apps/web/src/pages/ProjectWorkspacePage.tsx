import { useCallback, useEffect, useState } from "react";
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
  RadioTower,
  RefreshCw,
  Sparkles,
  Target,
  UserRound,
  Users
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { Persona, ProjectOpsResponse } from "@sprintpulse/shared";
import { Badge } from "@/components/ui/badge";
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
import { projectCacheKey, readProjectCache, writeProjectCache } from "../lib/projectDataCache";
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

    const cacheKey = projectCacheKey("workspace", [projectId, persona.id]);
    const cached = readProjectCache<ProjectOpsResponse>(cacheKey);
    if (cached) {
      applyWorkspace(cached);
    }

    setLoading(!cached);
    setError(null);
    try {
      const response = await api.getProjectOps(projectId, persona.id);
      writeProjectCache(cacheKey, response);
      applyWorkspace(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project workspace unavailable");
    } finally {
      setLoading(false);
    }
  }, [applyWorkspace, persona?.id, projectId]);

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
      label: integrations.git?.provider === "gitlab" ? "GitLab" : integrations.git?.provider === "github" ? "GitHub" : "Git",
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
              <span className="font-black text-slate-950 dark:text-white">{healthLabel(summary.teamHealthScore)}</span>
              <span className="text-slate-500 dark:text-slate-300">{summary.standupCount} updates · {summary.issueCount} issues</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" aria-hidden="true">
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
          description={canConfigure ? "Configure Jira and Git, then sync sprint evidence." : "Open delivery signals, flags, and recent history."}
          tone="warning"
        />
        <ActionTile
          to={`/projects/${project.id}/team`}
          icon={Users}
          title="Team"
          description="Roles, invite access, Jira IDs, Git identities, and ownership."
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
              { id: "IN", label: integrations.jira || integrations.git ? "Refresh integrations" : "Configure integrations", description: "Connect Jira and Git signals for issues, commits, and say-do gap scoring.", route: `/projects/${project.id}/integrations` },
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
                <MemberAvatar initials={member.initials} seed={member.name} />
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
