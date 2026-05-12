import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileText,
  GitCommitHorizontal,
  GitPullRequest,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  Target,
  TicketCheck,
  UsersRound,
  Zap
} from "lucide-react";
import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import type { DashboardResponse, FlagType, MemberPulse, ProjectDashboardResponse, RiskLevel } from "@sprintpulse/shared";
import { api } from "../api";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { DashboardSkeleton } from "../components/ui/loading-skeleton";
import { LiveIndicator } from "../components/ui/live-indicator";
import {
  EmptyPanel,
  MemberAvatar,
  PanelHeader,
  SectionPanel,
  StatusPill,
  workspacePageClass
} from "../components/workspace/WorkspaceChrome";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import { cn } from "../lib/utils";

const roleLabels: Record<MemberPulse["hackathonRole"], string> = {
  frontend: "Frontend",
  backend: "Backend",
  architect: "Architecture",
  qa: "Quality"
};

const detectionBlueprint: Array<{
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  types: FlagType[];
  icon: typeof MessageSquareText;
  tone: "primary" | "info" | "warning" | "danger" | "ai" | "success" | "neutral";
}> = [
  {
    id: "standup-quality",
    label: "Standup specificity",
    shortLabel: "Vague",
    description: "Detects vague updates, repeated wording, and low-detail progress claims.",
    types: ["VAGUE_UPDATE", "COPY_PASTE"],
    icon: MessageSquareText,
    tone: "warning"
  },
  {
    id: "stale-work",
    label: "Stale work",
    shortLabel: "Stale",
    description: "Highlights people saying the same task while Jira movement is idle.",
    types: ["STALE_WORK"],
    icon: Clock3,
    tone: "danger"
  },
  {
    id: "say-do-gap",
    label: "Say-do gap",
    shortLabel: "Say-do",
    description: "Compares standup claims with Git commits, PRs, and Jira transitions.",
    types: ["SAY_DO_GAP"],
    icon: GitPullRequest,
    tone: "ai"
  },
  {
    id: "blocker-anomaly",
    label: "Blocker anomaly",
    shortLabel: "Blockers",
    description: "Finds repeated blockers, hidden blockers, and missing escalation signals.",
    types: ["BLOCKER_ANOMALY"],
    icon: ShieldAlert,
    tone: "danger"
  },
  {
    id: "delivery-risk",
    label: "Delivery quality risk",
    shortLabel: "Quality",
    description: "Surfaces burnout, late churn, test risk, and review pressure before demo day.",
    types: ["BURNOUT_SIGNAL", "TEST_RISK"],
    icon: Target,
    tone: "info"
  }
];

function toRelativeTime(value?: string) {
  if (!value) {
    return "Current sprint";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Current sprint";
  }

  const diffMs = date.getTime() - Date.now();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  return formatter.format(Math.round(diffHours / 24), "day");
}

function compactTitle(text: string, max = 82) {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function timestampValue(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function riskAccentClass(level: RiskLevel) {
  if (level === "critical" || level === "high") {
    return "border-danger-500/40 bg-danger-500/10 text-danger-700 dark:text-danger-100";
  }
  if (level === "medium") {
    return "border-warning-500/40 bg-warning-500/10 text-warning-700 dark:text-warning-100";
  }
  return "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100";
}

function riskBarClass(level: RiskLevel) {
  if (level === "critical" || level === "high") {
    return "from-danger-500 to-rose-400";
  }
  if (level === "medium") {
    return "from-warning-500 to-amber-300";
  }
  return "from-emerald-500 to-primary-400";
}

type SignalSource = "standup" | "jira" | "git" | "review" | "empty";

const signalLegend: Array<{ source: Exclude<SignalSource, "empty">; label: string }> = [
  { source: "standup", label: "Standup" },
  { source: "jira", label: "Jira" },
  { source: "git", label: "Git" },
  { source: "review", label: "PR review" }
];

function signalCellClass(source: SignalSource) {
  const cells: Record<SignalSource, string> = {
    standup: "bg-primary-500 shadow-[0_0_18px_rgba(16,169,154,0.24)]",
    jira: "bg-info-500 shadow-[0_0_18px_rgba(68,123,219,0.22)]",
    git: "bg-ai-500 shadow-[0_0_18px_rgba(132,98,232,0.22)]",
    review: "bg-warning-500 shadow-[0_0_18px_rgba(245,164,35,0.20)]",
    empty: "bg-slate-200/70 dark:bg-white/10"
  };

  return cells[source];
}

function buildSignalCells(counts: Array<{ source: Exclude<SignalSource, "empty">; count: number }>) {
  const sequence = counts.flatMap(({ source, count }) => Array.from({ length: Math.min(count, 5) }, () => source));
  const ordered = sequence.length ? sequence : [];

  return Array.from({ length: 14 }, (_, index): SignalSource => ordered[index] ?? "empty");
}

function formatTimelineDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function eventToneClass(tone: "standup" | "risk" | "git" | "jira" | "ai") {
  const tones = {
    standup: "border-primary-500/30 bg-primary-500/10 text-primary-700 dark:text-primary-100",
    risk: "border-danger-500/30 bg-danger-500/10 text-danger-700 dark:text-danger-100",
    git: "border-ai-500/30 bg-ai-500/10 text-ai-700 dark:text-ai-100",
    jira: "border-info-500/30 bg-info-500/10 text-info-700 dark:text-info-100",
    ai: "border-warning-500/30 bg-warning-500/10 text-warning-700 dark:text-warning-100"
  } as const;

  return tones[tone];
}

export function DashboardPage() {
  const { projectId } = useParams();
  const { persona } = useAuth();
  const { project: selectedProject, selectedSprintId, selectProject } = useProject();
  const [dashboard, setDashboard] = useState<(DashboardResponse | ProjectDashboardResponse) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!persona) {
      return;
    }

    setLoading(true);
    setError(null);

    if (projectId) {
      api
        .getProjectDashboard(projectId, persona.id, selectedSprintId ?? undefined)
        .then((response) => {
          setDashboard(response);
          selectProject(response.project.id, {
            source: response.project.source === "manual" ? "manual" : "jira",
            projectName: response.project.name,
            projectKey: response.project.key,
            sprintName: selectedSprintId ? selectedProject?.sprintName ?? response.summary.sprintName : response.project.sprint.name,
            sprintGoal: selectedSprintId ? selectedProject?.sprintGoal ?? response.project.sprint.goal : response.project.sprint.goal,
            jiraSite: response.project.jiraSite,
            importedAt: response.project.lastSyncAt
          });
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
      return;
    }

    api
      .getDashboard(persona.id)
      .then((response) => {
        setDashboard(response);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [persona, projectId, selectProject, selectedProject?.sprintGoal, selectedProject?.sprintName, selectedSprintId]);

  const activeFlags = useMemo(
    () => dashboard?.memberPulses.flatMap((pulse) => pulse.flags.map((flag) => ({ flag, pulse }))) ?? [],
    [dashboard]
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !dashboard) {
    return (
      <Card className="glass">
        <CardContent>
          <EmptyState
            icon={AlertTriangle}
            title="Dashboard unavailable"
            description={error ?? "SprintPulse could not load this dashboard right now."}
          />
        </CardContent>
      </Card>
    );
  }

  const { summary, viewerPulse } = dashboard;
  const project = "project" in dashboard ? dashboard.project : null;
  const highSignalCount = activeFlags.filter(
    ({ flag }) => flag.severity === "critical" || flag.severity === "high"
  ).length;
  const totalOpenPrs = dashboard.memberPulses.reduce((sum, pulse) => sum + pulse.git.pullRequestsOpen, 0);
  const totalStandups = dashboard.memberPulses.reduce((sum, pulse) => sum + pulse.standups.length, 0);
  const totalCommits = dashboard.memberPulses.reduce((sum, pulse) => sum + pulse.git.commitsThisSprint, 0);
  const staleTickets = dashboard.memberPulses.reduce(
    (sum, pulse) => sum + pulse.tickets.filter((ticket) => ticket.daysIdle >= 3 && ticket.status !== "Done").length,
    0
  );
  const sortedMembers = [...dashboard.memberPulses].sort((a, b) => a.healthScore - b.healthScore);
  const attentionQueue = sortedMembers.map((member, index) => {
    const riskPressure = Math.max(0, 100 - member.healthScore);
    const topReason = member.flags[0]?.title ?? member.recommendation ?? "No active risk signal";
    const blockerCount = member.standups.filter(
      (standup) => standup.blockers && !standup.blockers.toLowerCase().includes("no blocker")
    ).length;

    return {
      ...member,
      rank: index + 1,
      riskPressure,
      topReason,
      blockerCount,
      href: project ? `/projects/${project.id}/members/${member.id}` : `/members/${member.id}`
    };
  });
  const topRisk = attentionQueue[0];
  const scoreState = summary.teamHealthScore >= 80 ? "Healthy" : summary.teamHealthScore >= 60 ? "Watch" : "At risk";
  const primaryRecommendation =
    dashboard.recommendations[0] ??
    viewerPulse.recommendation ??
    "Review the active sprint signals and clear the highest-risk blocker first.";

  const detectionCards = detectionBlueprint.map((detection) => {
    const matchingFlags = activeFlags.filter(({ flag }) => detection.types.includes(flag.type));
    const impactedMembers = new Set(matchingFlags.map(({ pulse }) => pulse.id)).size;
    const extraSignal =
      detection.id === "say-do-gap"
        ? staleTickets
        : detection.id === "blocker-anomaly"
          ? summary.openBlockers
          : detection.id === "delivery-risk"
            ? totalOpenPrs
            : 0;
    const value = matchingFlags.length || extraSignal;

    return {
      ...detection,
      value,
      impactedMembers,
      matchingFlags
    };
  });
  const demoFocus = [
    {
      label: "Input",
      value: `${totalStandups} standups`,
      detail: "Manual, transcript, and upload capture stay sprint-scoped.",
      icon: FileText,
      tone: "primary" as const
    },
    {
      label: "AI parser",
      value: "Speaker split",
      detail: "Transcript text becomes per-person yesterday, today, blocker records.",
      icon: Bot,
      tone: "ai" as const
    },
    {
      label: "Delivery proof",
      value: `${totalCommits} commits`,
      detail: `${staleTickets} stale Jira issue${staleTickets === 1 ? "" : "s"} checked against Git movement.`,
      icon: GitCommitHorizontal,
      tone: "info" as const
    },
    {
      label: "Action",
      value: "Recommendation",
      detail: compactTitle(primaryRecommendation, 96),
      icon: Sparkles,
      tone: "warning" as const
    }
  ];
  const timelineEvents = [
    ...dashboard.memberPulses.flatMap((pulse) =>
      pulse.standups.slice(0, 2).map((standup) => ({
        id: `standup-${standup.id}`,
        member: pulse.name,
        initials: pulse.initials,
        title: standup.blockers && !standup.blockers.toLowerCase().includes("no blocker")
          ? "Blocker mentioned in standup"
          : "Standup captured",
        detail: standup.blockers && !standup.blockers.toLowerCase().includes("no blocker")
          ? standup.blockers
          : standup.today,
        label: formatTimelineDate(standup.date),
        rawDate: standup.date,
        tone: "standup" as const,
        icon: MessageSquareText
      }))
    ),
    ...activeFlags.map(({ flag, pulse }) => ({
      id: `flag-${pulse.id}-${flag.id}`,
      member: pulse.name,
      initials: pulse.initials,
      title: flag.title,
      detail: flag.message,
      label: flag.type.replace(/_/g, " "),
      rawDate: new Date().toISOString(),
      tone: "risk" as const,
      icon: AlertTriangle
    })),
    ...dashboard.memberPulses
      .filter((pulse) => pulse.git.lastCommitAt)
      .map((pulse) => ({
        id: `git-${pulse.id}`,
        member: pulse.name,
        initials: pulse.initials,
        title: `${pulse.git.commitsThisSprint} commits this sprint`,
        detail: `${pulse.git.pullRequestsOpen} open PR${pulse.git.pullRequestsOpen === 1 ? "" : "s"} · ${pulse.git.codeChurn} churn`,
        label: toRelativeTime(pulse.git.lastCommitAt),
        rawDate: pulse.git.lastCommitAt,
        tone: "git" as const,
        icon: GitCommitHorizontal
      })),
    ...dashboard.memberPulses.flatMap((pulse) =>
      pulse.tickets
        .filter((ticket) => ticket.daysIdle >= 3 && ticket.status !== "Done")
        .slice(0, 2)
        .map((ticket) => ({
          id: `jira-${pulse.id}-${ticket.key}`,
          member: pulse.name,
          initials: pulse.initials,
          title: `${ticket.key} idle for ${ticket.daysIdle} days`,
          detail: `${ticket.title} · ${ticket.status}`,
          label: "Jira evidence",
          rawDate: "",
          tone: "jira" as const,
          icon: TicketCheck
        }))
    )
  ]
    .sort((a, b) => timestampValue(b.rawDate) - timestampValue(a.rawDate))
    .slice(0, 9);
  const teamProgressRows = dashboard.memberPulses
    .map((pulse) => {
      const signalCounts = [
        { source: "standup" as const, count: pulse.standups.length, label: "Standup" },
        { source: "jira" as const, count: pulse.tickets.length, label: "Jira" },
        { source: "git" as const, count: pulse.git.commitsThisSprint, label: "Git" },
        { source: "review" as const, count: pulse.git.pullRequestsOpen, label: "PR review" }
      ];
      const activity = signalCounts.reduce((sum, signal) => sum + signal.count, 0);
      const primarySignal = [...signalCounts].sort((a, b) => b.count - a.count)[0];
      const latestMovement =
        pulse.git.lastCommitAt
          ? `Git ${toRelativeTime(pulse.git.lastCommitAt)}`
          : pulse.standups[0]?.date
            ? `Standup ${formatTimelineDate(pulse.standups[0].date)}`
            : pulse.tickets[0]
              ? `${pulse.tickets[0].key} in Jira`
              : "Waiting for signal";

      return {
        id: pulse.id,
        name: pulse.name,
        initials: pulse.initials,
        role: roleLabels[pulse.hackathonRole],
        activity,
        primarySignal: primarySignal.count ? primarySignal.label : "No dominant signal",
        latestMovement,
        href: project ? `/projects/${project.id}/members/${pulse.id}` : `/members/${pulse.id}`,
        cells: buildSignalCells(signalCounts)
      };
    })
    .sort((a, b) => b.activity - a.activity);

  return (
    <div className={workspacePageClass}>
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-950 p-6 text-white shadow-elevated"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(242,109,91,0.22),transparent_28%),radial-gradient(circle_at_64%_0%,rgba(132,98,232,0.20),transparent_30%),radial-gradient(circle_at_95%_82%,rgba(16,169,154,0.18),transparent_34%)]" />
        <div className="absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-primary-300/80 to-transparent" />

        <div className="relative grid items-stretch gap-8 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="flex min-w-0 flex-col justify-between gap-8">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-primary-400/40 bg-primary-400/10 text-primary-100 hover:bg-primary-400/10">
                  {project ? project.key : dashboard.scope}
                </Badge>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                  <LiveIndicator status={highSignalCount ? "idle" : "online"} />
                  {highSignalCount ? `${highSignalCount} high-priority signals` : "Signals steady"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                  {summary.sprintWindow}
                </span>
              </div>

              <div>
                <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary-200">SprintPulse demo board</p>
                <h1 className="mt-2 max-w-4xl text-[2.35rem] font-extrabold leading-[1.08] tracking-normal sm:text-[3.35rem]">
                  {project ? project.name : "Project health, ranked by evidence"}
                </h1>
                <p className="mt-4 max-w-3xl text-[0.95rem] leading-7 text-slate-300">
                  Start with the attention queue, then open a profile timeline to explain exactly which standup, Jira, and Git signals changed the score.
                </p>
              </div>
            </div>

            <div className="grid auto-rows-fr gap-3 sm:grid-cols-4">
              {[
                [summary.teamHealthScore, "Health", scoreState],
                [summary.atRiskCount, "At risk", `${dashboard.memberPulses.length} people`],
                [summary.openBlockers, "Blockers", "needs owner"],
                [summary.readinessScore, "Readiness", "% sprint"]
              ].map(([value, label, detail]) => (
                <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4" key={label}>
                  <strong className="block font-mono text-[1.85rem] font-bold leading-none">{value}</strong>
                  <span className="mt-2 block text-[0.7rem] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</span>
                  <small className="mt-2 block text-slate-300">{detail}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-glass backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-slate-400">Needs attention first</p>
                <h2 className="mt-2 text-[1.35rem] font-extrabold">{topRisk?.name ?? "No member yet"}</h2>
              </div>
              <AlertTriangle className="h-7 w-7 text-warning-300" />
            </div>
            {topRisk ? (
              <div className="rounded-2xl border border-danger-400/20 bg-danger-400/10 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <MemberAvatar initials={topRisk.initials} />
                  <span className="min-w-0">
                    <strong className="block truncate">{topRisk.title}</strong>
                    <small className="text-slate-300">{roleLabels[topRisk.hackathonRole]}</small>
                  </span>
                  <strong className="ml-auto font-mono text-[1.9rem] font-bold">{topRisk.healthScore}</strong>
                </div>
                <p className="text-sm leading-6 text-slate-200">{compactTitle(topRisk.topReason, 130)}</p>
                <Link
                  className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/15"
                  to={topRisk.href}
                >
                  Open profile timeline
                  <Zap className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <EmptyPanel icon={UsersRound} title="No members yet" description="Add project members to build the attention queue." />
            )}
          </div>
        </div>
      </motion.section>

      <section className="grid auto-rows-fr items-stretch gap-5 xl:grid-cols-4">
        {demoFocus.map((item) => {
          const ItemIcon = item.icon;
          return (
            <SectionPanel className="p-4" key={item.label}>
              <div className="flex items-start gap-3">
                <StatusPill icon={ItemIcon} tone={item.tone}>
                  {item.label}
                </StatusPill>
              </div>
              <strong className="mt-4 block text-[1.08rem] font-extrabold text-slate-950 dark:text-white">{item.value}</strong>
              <p className="m-0 mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</p>
            </SectionPanel>
          );
        })}
      </section>

      <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.28fr)_minmax(380px,0.72fr)]">
        <SectionPanel className="overflow-hidden p-0">
          <div className="border-b border-slate-200/80 p-5 dark:border-white/10">
            <PanelHeader
              eyebrow="Attention queue"
              title="Lowest health first"
              description="This is not a winners list. The top row is the person who needs the next Scrum Master conversation."
              icon={AlertTriangle}
              tone="danger"
              action={<Badge variant="outline">{attentionQueue.length} members</Badge>}
            />
          </div>

          <div className="grid gap-3 p-5">
            {attentionQueue.length ? (
              attentionQueue.map((member) => (
                <Link
                  className={cn(
                    "group grid gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10 dark:hover:shadow-black/25 lg:grid-cols-[48px_48px_minmax(0,1fr)_220px_72px]",
                    riskAccentClass(member.riskLevel)
                  )}
                  key={member.id}
                  to={member.href}
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 font-mono text-base font-bold text-white shadow-sm dark:bg-white/10">
                    {member.rank}
                  </span>
                  <MemberAvatar initials={member.initials} />
                  <span className="min-w-0">
                    <strong className="block truncate text-[1.02rem] font-extrabold text-slate-950 dark:text-white">{member.name}</strong>
                    <small className="text-[0.86rem] font-medium text-slate-500 dark:text-slate-400">
                      {roleLabels[member.hackathonRole]} · {compactTitle(member.topReason, 76)}
                    </small>
                    <span className="mt-3 flex flex-wrap gap-2">
                      <Badge className="border-white/10 bg-white/40 text-xs font-black dark:bg-white/10" variant="outline">
                        {member.flags.length} flags
                      </Badge>
                      <Badge className="border-white/10 bg-white/40 text-xs font-black dark:bg-white/10" variant="outline">
                        {member.blockerCount} blockers
                      </Badge>
                      <Badge className="border-white/10 bg-white/40 text-xs font-black dark:bg-white/10" variant="outline">
                        {member.git.commitsThisSprint} commits
                      </Badge>
                    </span>
                  </span>
                  <span className="self-center">
                    <span className="mb-2 flex items-center justify-between text-[0.7rem] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      Risk pressure
                      <b className="text-slate-950 dark:text-white">{member.riskPressure}</b>
                    </span>
                    <span className="block h-3 overflow-hidden rounded-full bg-slate-950/10 dark:bg-white/10">
                      <span
                        className={cn("block h-full rounded-full bg-gradient-to-r", riskBarClass(member.riskLevel))}
                        style={{ width: `${Math.min(100, Math.max(6, member.riskPressure))}%` }}
                      />
                    </span>
                  </span>
                  <span className="self-center text-right">
                    <strong className="block font-mono text-[1.95rem] font-bold leading-none text-slate-950 dark:text-white">{member.healthScore}</strong>
                    <small className="text-[0.7rem] font-bold uppercase text-slate-500 dark:text-slate-400">health</small>
                  </span>
                </Link>
              ))
            ) : (
              <EmptyPanel icon={UsersRound} title="No members yet" description="Team members appear here after project setup." />
            )}
          </div>
        </SectionPanel>

        <SectionPanel>
          <PanelHeader
            eyebrow="Analysis engine"
            title="Five detection types"
            description="This mirrors the Semicolon POC plan: text analysis plus Jira and Git proof."
            icon={BrainCircuit}
            tone="ai"
          />
          <div className="grid gap-3">
            {detectionCards.map((detection) => {
              const DetectionIcon = detection.icon;
              return (
                <article
                  className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.045]"
                  key={detection.id}
                >
                  <div className="flex items-start gap-3">
                    <StatusPill icon={DetectionIcon} tone={detection.tone}>
                      {detection.value}
                    </StatusPill>
                    <span className="min-w-0">
                      <strong className="block text-[0.92rem] font-extrabold text-slate-950 dark:text-white">{detection.label}</strong>
                      <small className="text-slate-500 dark:text-slate-400">
                        {detection.impactedMembers} impacted member{detection.impactedMembers === 1 ? "" : "s"}
                      </small>
                    </span>
                  </div>
                  <p className="m-0 mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{detection.description}</p>
                </article>
              );
            })}
          </div>
        </SectionPanel>
      </section>

      <SectionPanel>
        <PanelHeader
          eyebrow="Team progress"
          title="Team signal map"
          description="Each cell is a sprint signal by source. Empty cells show where the sprint has not produced synced activity yet."
          icon={GitCommitHorizontal}
          tone="ai"
          action={
            <div className="hidden flex-wrap items-center gap-2 md:flex">
              {signalLegend.map((item) => (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-1 text-[0.7rem] font-bold text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300" key={item.source}>
                  <span className={cn("h-2.5 w-2.5 rounded-[4px]", signalCellClass(item.source))} />
                  {item.label}
                </span>
              ))}
            </div>
          }
        />
        <div className="grid gap-2.5">
          {teamProgressRows.length ? (
            teamProgressRows.map((row) => (
              <Link
                className="group grid gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 transition hover:-translate-y-0.5 hover:border-primary-500/35 hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.07] lg:grid-cols-[220px_minmax(0,1fr)_210px]"
                key={row.id}
                to={row.href}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <MemberAvatar initials={row.initials} size="sm" />
                  <span className="min-w-0">
                    <strong className="block truncate text-sm font-extrabold text-slate-950 dark:text-white">{row.name}</strong>
                    <small className="block truncate text-slate-500 dark:text-slate-400">{row.role}</small>
                  </span>
                </span>

                <span className="grid content-center gap-2">
                  <span className="grid grid-cols-14 gap-1" aria-label={`${row.name} sprint signal map`}>
                    {row.cells.map((source, index) => (
                      <span
                        className={cn("h-5 rounded-md ring-1 ring-black/5 transition group-hover:scale-105 dark:ring-white/10", signalCellClass(source))}
                        key={`${row.id}-${index}`}
                      />
                    ))}
                  </span>
                </span>

                <span className="grid content-center gap-1 self-center text-sm">
                  <strong className="truncate text-slate-950 dark:text-white">{row.primarySignal}</strong>
                  <small className="truncate font-semibold text-slate-500 dark:text-slate-400">{row.latestMovement}</small>
                </span>
              </Link>
            ))
          ) : (
            <EmptyPanel icon={GitCommitHorizontal} title="No activity yet" description="Standups, Jira, and Git signals will build the team progress lanes." />
          )}
        </div>
      </SectionPanel>

      <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionPanel>
          <PanelHeader
            eyebrow="Evidence timeline"
            title="What changed the score"
            description="A readable trail of standups, Jira idle work, Git activity, and risk flags."
            icon={Activity}
          />
          <div className="relative grid gap-3">
            {timelineEvents.length ? (
              timelineEvents.map((event) => {
                const EventIcon = event.icon;
                return (
                  <article
                    className="relative grid gap-3 rounded-2xl border border-slate-200/80 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.045] md:grid-cols-[48px_minmax(0,1fr)_150px]"
                    key={event.id}
                  >
                    <span className={cn("relative z-10 grid h-10 w-10 place-items-center rounded-2xl border", eventToneClass(event.tone))}>
                      <EventIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="text-[0.92rem] font-extrabold text-slate-950 dark:text-white">{event.title}</strong>
                        <Badge variant="outline">{event.member}</Badge>
                      </span>
                      <p className="m-0 mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{compactTitle(event.detail, 140)}</p>
                    </span>
                    <span className="self-center text-[0.84rem] font-bold text-slate-500 dark:text-slate-400">{event.label}</span>
                  </article>
                );
              })
            ) : (
              <EmptyPanel icon={Activity} title="No evidence yet" description="Standups, Jira issues, Git commits, and flags appear here as signals sync." />
            )}
          </div>
        </SectionPanel>

        <SectionPanel>
          <PanelHeader
            eyebrow="Presenter card"
            title="Next action"
            description="Use this as the verbal handoff in the demo."
            icon={CheckCircle2}
            tone="success"
          />
          <div className="rounded-2xl border border-warning-500/25 bg-warning-500/10 p-4">
            <p className="m-0 text-[1.02rem] font-extrabold leading-7 text-slate-950 dark:text-white">{compactTitle(primaryRecommendation, 140)}</p>
          </div>
          <div className="mt-4 grid gap-3">
            {[
              ["Owner", topRisk?.name ?? "Scrum Master"],
              ["Proof", `${activeFlags.length} flags · ${staleTickets} stale Jira`],
              ["Demo path", "Attention queue → Profile timeline → Standup parse"]
            ].map(([label, value]) => (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.04]" key={label}>
                <span className="text-[0.7rem] font-bold uppercase text-slate-500 dark:text-slate-400">{label}</span>
                <strong className="mt-1 block text-[0.92rem] font-extrabold text-slate-950 dark:text-white">{value}</strong>
              </div>
            ))}
          </div>
        </SectionPanel>
      </section>
    </div>
  );
}
