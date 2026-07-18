import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  GitCommitHorizontal,
  GitPullRequest,
  MessageSquareText,
  Sparkles,
  TicketCheck,
  UsersRound,
  X,
  Zap
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import type { DashboardResponse, MemberPulse, ProjectDashboardResponse, RiskLevel } from "@sprintpulse/shared";
import { api } from "../api";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
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
import { clearProjectCache, projectCacheKey, readProjectCache, writeProjectCache } from "../lib/projectDataCache";
import { cn } from "../lib/utils";

const roleLabels: Record<MemberPulse["hackathonRole"], string> = {
  frontend: "Frontend",
  backend: "Backend",
  architect: "Architecture",
  qa: "Quality"
};

type EvidenceTone = "danger" | "warning" | "success" | "info" | "primary" | "ai";

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

function daysSince(value?: string) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000)));
}

function hasBlockerSignal(value?: string) {
  return Boolean(value && !value.toLowerCase().includes("no blocker"));
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

function riskTone(level: RiskLevel) {
  if (level === "critical" || level === "high") {
    return "danger" as const;
  }
  if (level === "medium") {
    return "warning" as const;
  }
  return "success" as const;
}

function priorityRankClass(rank: number) {
  if (rank === 1) {
    return "border-rose-300/70 bg-rose-50 text-rose-700 shadow-rose-500/10 dark:border-rose-300/30 dark:bg-rose-400/10 dark:text-rose-100";
  }
  if (rank === 2) {
    return "border-amber-300/70 bg-amber-50 text-amber-700 shadow-amber-500/10 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100";
  }
  return "border-slate-300/80 bg-white text-slate-700 shadow-slate-900/5 dark:border-white/10 dark:bg-white/[0.07] dark:text-slate-200";
}

function velocityLabel(value?: string) {
  if (!value) {
    return "Steady";
  }

  return value
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
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

function flagTypeLabel(type: string): string {
  const map: Record<string, string> = {
    VAGUE_UPDATE: "Vague",
    STALE_WORK: "Stale",
    COPY_PASTE: "Copy-paste",
    SAY_DO_GAP: "Say-do gap",
    BLOCKER_ANOMALY: "Blocker",
    BURNOUT_SIGNAL: "Burnout",
    TEST_RISK: "Test risk",
    SPRINT_END_RISK: "Sprint risk"
  };
  return map[type] ?? type.replace(/_/g, " ").toLowerCase();
}

function flagChipClass(severity: RiskLevel): string {
  if (severity === "critical" || severity === "high") {
    return "bg-danger-500/[0.12] text-danger-700 dark:text-danger-200";
  }
  if (severity === "medium") {
    return "bg-warning-500/[0.12] text-warning-700 dark:text-warning-200";
  }
  return "bg-slate-200/80 text-slate-600 dark:bg-white/[0.09] dark:text-slate-300";
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

// SVG circular health-score gauge — scales gracefully from 36px (member rows) to 120px (hero)
function HealthRing({ score, size = 88 }: { score: number; size?: number }) {
  const sw = Math.max(3, Math.round(size * 0.1));
  const r = (size - sw * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * Math.min(1, Math.max(0, score / 100));
  const ringColor = score >= 80 ? "#10a99a" : score >= 60 ? "#e7a52e" : "#dc2626";
  const glowColor =
    score >= 80 ? "rgba(16,169,154,0.55)" : score >= 60 ? "rgba(231,165,46,0.55)" : "rgba(220,38,38,0.55)";
  const state = score >= 80 ? "Healthy" : score >= 60 ? "Watch" : "At Risk";
  const compact = size < 56;
  const scoreFontPx = Math.max(11, Math.round(size * 0.26));
  const stateFontPx = Math.max(6, Math.round(size * 0.092));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        aria-hidden="true"
        className="absolute inset-0"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle cx={cx} cy={cy} fill="none" r={r} stroke="rgba(148,163,184,0.15)" strokeWidth={sw} />
        <circle
          cx={cx}
          cy={cy}
          fill="none"
          r={r}
          stroke={ringColor}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          strokeWidth={sw}
          style={{ filter: `drop-shadow(0 0 ${Math.round(size * 0.06)}px ${glowColor})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
        <strong
          className="font-mono font-black leading-none"
          style={{ color: ringColor, fontSize: `${scoreFontPx}px`, fontVariantNumeric: "tabular-nums" }}
        >
          {score}
        </strong>
        {!compact ? (
          <small
            className="font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400"
            style={{ fontSize: `${stateFontPx}px` }}
          >
            {state}
          </small>
        ) : null}
      </div>
    </div>
  );
}

// Trend delta indicator — shows ↑ or ↓ vs last sync (cached client-side)
function TrendDelta({ delta, size = "sm" }: { delta: number | null | undefined; size?: "sm" | "xs" }) {
  if (delta === null || delta === undefined || delta === 0) return null;
  const isUp = delta > 0;
  const sizeClass = size === "xs" ? "text-[0.58rem]" : "text-[0.66rem]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono font-black",
        sizeClass,
        isUp ? "text-emerald-600 dark:text-emerald-300" : "text-danger-600 dark:text-danger-300"
      )}
      style={{ fontVariantNumeric: "tabular-nums" }}
      title={`${isUp ? "Up" : "Down"} ${Math.abs(delta)} vs last sync`}
    >
      {isUp ? "↑" : "↓"} {Math.abs(delta)}
    </span>
  );
}

export function DashboardPage() {
  const { projectId } = useParams();
  const { persona } = useAuth();
  const { project: selectedProject, selectedSprintId, selectProject } = useProject();
  const [dashboard, setDashboard] = useState<(DashboardResponse | ProjectDashboardResponse) | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingAi, setRefreshingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [p1Dismissed, setP1Dismissed] = useState(false);

  useEffect(() => {
    if (!persona) {
      return;
    }

    const cacheKey = projectCacheKey(projectId ? "project-dashboard" : "portfolio-dashboard", [
      projectId,
      persona.id,
      selectedSprintId
    ]);
    const cached = readProjectCache<DashboardResponse | ProjectDashboardResponse>(cacheKey);
    if (cached) {
      setDashboard(cached);
    }

    setLoading(!cached);
    setError(null);

    if (projectId) {
      api
        .getProjectDashboard(projectId, persona.id, selectedSprintId ?? undefined)
        .then((response) => {
          writeProjectCache(cacheKey, response);
          setDashboard(response);
          selectProject(response.project.id, {
            source: response.project.source === "manual" ? "manual" : "jira",
            projectName: response.project.name,
            projectKey: response.project.key,
            sprintName: response.summary.sprintName ?? response.project.sprint.name,
            sprintGoal: response.project.sprint.goal,
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
        writeProjectCache(cacheKey, response);
        setDashboard(response);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [persona?.id, projectId, selectedSprintId]);

  const activeFlags = useMemo(
    () => dashboard?.memberPulses.flatMap((pulse) => pulse.flags.map((flag) => ({ flag, pulse }))) ?? [],
    [dashboard]
  );

  // Previous-sync health snapshot (cached client-side for trend deltas)
  const [prevSnapshot, setPrevSnapshot] = useState<{ team: number | null; members: Record<string, number> }>({
    team: null,
    members: {}
  });

  useEffect(() => {
    if (!dashboard || !projectId) return;
    const key = `sprintpulse:prevHealth:${projectId}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as { team?: number; members?: Record<string, number> };
        setPrevSnapshot({
          team: typeof parsed?.team === "number" ? parsed.team : null,
          members: parsed?.members ?? {}
        });
      }
    } catch {
      // ignore parse errors
    }
    const snapshot = {
      team: dashboard.summary.teamHealthScore,
      members: Object.fromEntries(dashboard.memberPulses.map((m) => [m.id, m.healthScore]))
    };
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(snapshot));
      } catch {
        // localStorage might be disabled
      }
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [dashboard, projectId]);

  const detectionBreakdown = useMemo(() => {
    const counts: Record<string, { total: number; critical: number; high: number; medium: number }> = {};
    activeFlags.forEach(({ flag }) => {
      const bucket = counts[flag.type] ?? { total: 0, critical: 0, high: 0, medium: 0 };
      bucket.total += 1;
      if (flag.severity === "critical") bucket.critical += 1;
      else if (flag.severity === "high") bucket.high += 1;
      else if (flag.severity === "medium") bucket.medium += 1;
      counts[flag.type] = bucket;
    });
    const rows = [
      { type: "VAGUE_UPDATE", label: "Vague updates", color: "bg-warning-500" },
      { type: "SAY_DO_GAP", label: "Say-do gaps", color: "bg-danger-500" },
      { type: "STALE_WORK", label: "Stale work", color: "bg-ai-500" },
      { type: "BLOCKER_ANOMALY", label: "Blockers", color: "bg-danger-600" },
      { type: "COPY_PASTE", label: "Copy-paste", color: "bg-info-500" }
    ].map((row) => ({ ...row, ...counts[row.type] ?? { total: 0, critical: 0, high: 0, medium: 0 } }));
    const max = Math.max(1, ...rows.map((r) => r.total));
    const total = rows.reduce((sum, r) => sum + r.total, 0);
    return { rows, max, total };
  }, [activeFlags]);

  const refreshAiAnalysis = async () => {
    if (!projectId || !persona) {
      return;
    }

    setRefreshingAi(true);
    setError(null);
    try {
      const response = await api.refreshProjectAi(projectId, persona.id, selectedSprintId ?? undefined);
      setDashboard(response);
      clearProjectCache(projectId);
      window.dispatchEvent(new CustomEvent("sprintpulse:signals-updated", { detail: { projectId } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI analysis refresh failed");
    } finally {
      setRefreshingAi(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !dashboard) {
    return (
      <div className={workspacePageClass}>
        <EmptyState
          icon={AlertTriangle}
          title="Dashboard unavailable"
          description={error ?? "SprintPulse could not load this dashboard right now."}
        />
      </div>
    );
  }

  const { summary, viewerPulse } = dashboard;
  const project = "project" in dashboard ? dashboard.project : null;
  const aiOverlay = dashboard.ai;
  const highSignalCount = activeFlags.filter(
    ({ flag }) => flag.severity === "critical" || flag.severity === "high"
  ).length;
  const blockerCountFor = (pulse: MemberPulse) => pulse.standups.filter((standup) => hasBlockerSignal(standup.blockers)).length;
  const idleTicketCountFor = (pulse: MemberPulse) =>
    pulse.tickets.filter((ticket) => ticket.daysIdle >= 3 && ticket.status !== "Done").length;
  const reviewWaitDaysFor = (pulse: MemberPulse) =>
    pulse.git.pullRequestsOpen ? Math.max(0, pulse.git.oldestPullRequestDays ?? daysSince(pulse.git.lastCommitAt)) : 0;
  const priorityScoreFor = (pulse: MemberPulse) => {
    const blockerCount = blockerCountFor(pulse);
    const idleTicketCount = idleTicketCountFor(pulse);
    return pulse.flags.length * 20 + blockerCount * 8 + idleTicketCount * 6 + pulse.git.pullRequestsOpen * 3 + pulse.git.commitsThisSprint + pulse.standups.length;
  };
  const sortedMembers = [...dashboard.memberPulses].sort(
    (a, b) => a.healthScore - b.healthScore || priorityScoreFor(b) - priorityScoreFor(a) || a.name.localeCompare(b.name)
  );
  const attentionQueue = sortedMembers.map((member, index) => {
    const topReason = member.flags[0]?.title ?? member.recommendation ?? "No active risk signal";
    const blockerCount = blockerCountFor(member);
    const idleTicketCount = idleTicketCountFor(member);
    const reviewWaitDays = reviewWaitDaysFor(member);
    const standupProof = blockerCount
      ? `${blockerCount} blocker mention${blockerCount === 1 ? "" : "s"}`
      : member.standups.length
        ? "Standups unblocked"
        : "No standup signal";
    const jiraProof = idleTicketCount
      ? `${idleTicketCount} idle Jira item${idleTicketCount === 1 ? "" : "s"}`
      : member.tickets.length
        ? "Jira moving"
        : "No Jira mapping";
    const reviewProof = member.git.pullRequestsOpen
      ? `${member.git.pullRequestsOpen} PR${member.git.pullRequestsOpen === 1 ? "" : "s"}${reviewWaitDays ? `, ${reviewWaitDays}d waiting` : ""}`
      : member.git.lastCommitAt
        ? `Git ${toRelativeTime(member.git.lastCommitAt)}`
        : "No PR queue";

    return {
      ...member,
      rank: index + 1,
      topReason,
      blockerCount,
      idleTicketCount,
      standupProof,
      jiraProof,
      reviewProof,
      href: project ? `/projects/${project.id}/members/${member.id}` : `/members/${member.id}`
    };
  });
  const topRisk = attentionQueue.find((member) => member.flags.length > 0 || member.blockerCount > 0 || member.healthScore < 80);
  const scoreState = summary.teamHealthScore >= 80 ? "Healthy" : summary.teamHealthScore >= 60 ? "Watch" : "At risk";
  const primaryRecommendation =
    dashboard.recommendations[0] ??
    viewerPulse.recommendation ??
    "Review the selected sprint signals and clear the highest-risk blocker first.";
  const topRiskProof = topRisk
    ? [
        {
          label: "Standup",
          value: topRisk.standupProof,
          tone: topRisk.blockerCount ? ("danger" as const) : ("primary" as const)
        },
        {
          label: "Jira",
          value: topRisk.jiraProof,
          tone: topRisk.idleTicketCount ? ("warning" as const) : ("info" as const)
        },
        {
          label: "PR / Git",
          value: topRisk.reviewProof,
          tone: topRisk.git.pullRequestsOpen ? ("warning" as const) : ("success" as const)
        }
      ]
    : [];

  const evidenceChipClass = (tone: EvidenceTone) =>
    cn(
      "max-w-[72%] truncate rounded-full border px-2.5 py-1 text-right text-xs font-black",
      tone === "danger" && "border-rose-300/60 bg-rose-400/10 text-rose-700 dark:border-rose-300/40 dark:text-rose-100",
      tone === "warning" && "border-amber-300/70 bg-amber-300/10 text-amber-700 dark:border-amber-300/40 dark:text-amber-100",
      tone === "success" && "border-emerald-300/70 bg-emerald-300/10 text-emerald-700 dark:border-emerald-300/40 dark:text-emerald-100",
      tone === "info" && "border-sky-300/70 bg-sky-300/10 text-sky-700 dark:border-sky-300/40 dark:text-sky-100",
      tone === "primary" && "border-teal-300/70 bg-teal-300/10 text-teal-700 dark:border-teal-300/40 dark:text-teal-100",
      tone === "ai" && "border-violet-300/70 bg-violet-300/10 text-violet-700 dark:border-violet-300/40 dark:text-violet-100"
    );
  const prAgingRisks = dashboard.memberPulses
    .filter((pulse) => pulse.git.pullRequestsOpen > 0)
    .map((pulse) => {
      const reviewTickets = pulse.tickets.filter((ticket) => ticket.status === "Review");
      const oldestReviewDays = Math.max(0, pulse.git.oldestPullRequestDays ?? 0, ...reviewTickets.map((ticket) => ticket.daysIdle), daysSince(pulse.git.lastCommitAt));
      const pressure = pulse.git.reviewPressure ?? Math.min(100, pulse.git.pullRequestsOpen * 22 + oldestReviewDays * 12);

      return {
        pulse,
        oldestReviewDays,
        pressure
      };
    })
    .filter((item) => item.oldestReviewDays >= 2 || item.pressure >= 50 || item.pulse.git.pullRequestsOpen > 1)
    .sort((a, b) => b.pressure - a.pressure || b.oldestReviewDays - a.oldestReviewDays)
    .slice(0, 3);
  const storyPointStaleRisks = dashboard.memberPulses
    .flatMap((pulse) =>
      pulse.tickets
        .filter((ticket) => ticket.status !== "Done" && ticket.daysIdle >= 3)
        .map((ticket) => ({
          pulse,
          ticket,
          pressure: (ticket.storyPoints ?? (ticket.status === "Blocked" ? 5 : 3)) * Math.max(1, ticket.daysIdle)
        }))
    )
    .sort((a, b) => b.pressure - a.pressure || b.ticket.daysIdle - a.ticket.daysIdle)
    .slice(0, 3);
  const staleStoryPoints = storyPointStaleRisks.reduce((sum, item) => sum + (item.ticket.storyPoints ?? 0), 0);
  const sayDoGapCount = activeFlags.filter(({ flag }) => flag.type === "SAY_DO_GAP").length;
  const deliveryPressureCards = [
    {
      id: "pr-aging",
      title: prAgingRisks[0] ? "Assign reviewer before standup" : "Review queue is clean",
      proof: prAgingRisks[0]
        ? `${prAgingRisks[0].pulse.name}: ${prAgingRisks[0].pulse.git.pullRequestsOpen} open PR${prAgingRisks[0].pulse.git.pullRequestsOpen === 1 ? "" : "s"} · ${prAgingRisks[0].oldestReviewDays}d waiting`
        : "No PR queue needs attention",
      action: prAgingRisks[0] ? "Assign reviewer" : "Track review SLA",
      icon: GitPullRequest,
      tone: prAgingRisks.length ? "warning" as const : "success" as const
    },
    {
      id: "story-points",
      title: storyPointStaleRisks[0] ? "Split or unblock stale scope" : "Jira scope is moving",
      proof: storyPointStaleRisks[0]
        ? `${storyPointStaleRisks[0].ticket.key}: ${staleStoryPoints || storyPointStaleRisks.length} scope risk · ${storyPointStaleRisks[0].ticket.daysIdle}d idle`
        : "No high-scope Jira item is stale",
      action: storyPointStaleRisks[0] ? "Unblock scope" : "Sync Jira",
      icon: TicketCheck,
      tone: storyPointStaleRisks.length ? "danger" as const : "success" as const
    },
    {
      id: "say-do-gap",
      title: sayDoGapCount ? "Resolve say-do mismatch" : "Standup claims match movement",
      proof: sayDoGapCount
        ? `${sayDoGapCount} AI flag${sayDoGapCount === 1 ? "" : "s"} compare standup claims with Jira/Git movement`
        : "No active standup-versus-delivery mismatch",
      action: sayDoGapCount ? "Request proof" : "Use audit trail",
      icon: MessageSquareText,
      tone: sayDoGapCount ? "ai" as const : "success" as const
    }
  ];
  const recommendedActions = [
    {
      priority: "P1",
      label: "Blocker check-in",
      title: topRisk ? `Unblock ${topRisk.name}` : "Review sprint signals",
      action: topRisk?.blockerCount
        ? "Confirm blocker owner, Jira key, and ETA."
        : topRisk
          ? "Ask for concrete proof and next owner."
          : "Run the next sync and review team signals.",
      proof: topRisk ? `${topRisk.standupProof} · ${topRisk.jiraProof} · ${topRisk.reviewProof}` : "No urgent blocker is active.",
      owner: topRisk?.name ?? "Scrum Master",
      due: "Next standup",
      icon: AlertTriangle,
      tone: topRisk ? riskTone(topRisk.riskLevel) : ("success" as const),
      href: topRisk?.href
    },
    {
      priority: "P2",
      label: "Review queue",
      title: prAgingRisks[0] ? "Assign reviewer" : "Keep PR lane clean",
      action: prAgingRisks[0]
        ? "Move the oldest PR into review or reassign reviewer."
        : "Keep review SLA visible for the sprint.",
      proof: prAgingRisks[0]
        ? `${prAgingRisks[0].pulse.name}: ${prAgingRisks[0].pulse.git.pullRequestsOpen} open PR${prAgingRisks[0].pulse.git.pullRequestsOpen === 1 ? "" : "s"} · ${prAgingRisks[0].oldestReviewDays}d waiting`
        : "No aging PR queue is dominating the sprint.",
      owner: prAgingRisks[0]?.pulse.name ?? "Engineering",
      due: prAgingRisks[0] ? "Today" : "Watch",
      icon: GitPullRequest,
      tone: prAgingRisks[0] ? ("warning" as const) : ("success" as const),
      href: prAgingRisks[0] ? (project ? `/projects/${project.id}/members/${prAgingRisks[0].pulse.id}` : `/members/${prAgingRisks[0].pulse.id}`) : undefined
    },
    {
      priority: "P3",
      label: "Scope protection",
      title: storyPointStaleRisks[0] ? "Split or reassign stale Jira" : "Jira scope is moving",
      action: storyPointStaleRisks[0]
        ? "Reduce scope, reassign owner, or mark rollover risk."
        : "Keep Jira status aligned with standup claims.",
      proof: storyPointStaleRisks[0]
        ? `${storyPointStaleRisks[0].ticket.key}: ${storyPointStaleRisks[0].ticket.daysIdle}d idle${storyPointStaleRisks[0].ticket.storyPoints ? ` · ${storyPointStaleRisks[0].ticket.storyPoints} pts` : ""}`
        : "No high-scope Jira item is stuck.",
      owner: storyPointStaleRisks[0]?.pulse.name ?? "Scrum Master",
      due: storyPointStaleRisks[0] ? "Before sprint close" : "Watch",
      icon: TicketCheck,
      tone: storyPointStaleRisks[0] ? ("danger" as const) : ("info" as const),
      href: storyPointStaleRisks[0] ? (project ? `/projects/${project.id}/members/${storyPointStaleRisks[0].pulse.id}` : `/members/${storyPointStaleRisks[0].pulse.id}`) : undefined
    },
    {
      priority: "P4",
      label: "Say-do proof",
      title: sayDoGapCount ? "Ask for delivery evidence" : "Claims match movement",
      action: sayDoGapCount ? "Ask for Jira/Git proof where standup progress is claimed." : "Keep comparing standup claims against Jira/Git.",
      proof: sayDoGapCount ? `${sayDoGapCount} say-do gap${sayDoGapCount === 1 ? "" : "s"} detected` : compactTitle(primaryRecommendation, 90),
      owner: "Scrum Master",
      due: sayDoGapCount ? "Next sync" : "Monitor",
      icon: Sparkles,
      tone: sayDoGapCount ? ("ai" as const) : ("success" as const)
    }
  ].slice(0, 4);
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
    ...dashboard.memberPulses
      .filter((pulse) => pulse.git.pullRequestsOpen > 0)
      .map((pulse) => {
        const waitingDays = Math.max(0, pulse.git.oldestPullRequestDays ?? daysSince(pulse.git.lastCommitAt));
        return {
          id: `pr-${pulse.id}`,
          member: pulse.name,
          initials: pulse.initials,
          title: `${pulse.git.pullRequestsOpen} PR${pulse.git.pullRequestsOpen === 1 ? "" : "s"} need review`,
          detail: waitingDays ? `Oldest review signal is ${waitingDays}d old.` : "Review queue is open.",
          label: waitingDays ? `${waitingDays}d waiting` : "PR review",
          rawDate: pulse.git.lastCommitAt,
          tone: "git" as const,
          icon: GitPullRequest
        };
      }),
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
      const velocityState = pulse.git.velocityState ?? "steady";
      const velocityMovement = velocityState !== "steady" ? `Velocity ${velocityLabel(velocityState)}` : "";
      const prMovement =
        pulse.git.pullRequestsOpen && pulse.git.oldestPullRequestDays
          ? `PR review ${pulse.git.oldestPullRequestDays}d waiting`
          : "";
      const latestMovement =
        velocityMovement ||
        prMovement ||
        (pulse.git.lastCommitAt
          ? `Git ${toRelativeTime(pulse.git.lastCommitAt)}`
          : pulse.standups[0]?.date
            ? `Standup ${formatTimelineDate(pulse.standups[0].date)}`
            : pulse.tickets[0]
              ? `${pulse.tickets[0].key} in Jira`
              : "Waiting for signal");

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

  const showP1Banner = !p1Dismissed && topRisk && (topRisk.riskLevel === "critical" || topRisk.riskLevel === "high" || topRisk.blockerCount > 0);

  return (
    <div className={workspacePageClass}>
      <AnimatePresence>
        {showP1Banner ? (
          <motion.div
            key="p1-banner"
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.99 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative overflow-hidden rounded-2xl border border-danger-500/50 bg-danger-600 px-5 py-3.5 shadow-[0_4px_24px_rgba(220,38,38,0.35)] dark:border-danger-400/40 dark:bg-danger-700"
          >
            {/* Subtle noise overlay for depth */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-danger-500/20 via-transparent to-danger-800/30" />
            <div className="relative flex items-center gap-3">
              {/* Pulsing icon */}
              <div className="relative shrink-0">
                <span className="absolute inset-0 animate-ping rounded-full bg-white/30" />
                <div className="relative grid h-9 w-9 place-items-center rounded-full bg-white/20 ring-1 ring-white/40">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
              </div>
              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-white/25 px-1.5 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.16em] text-white">
                    P1
                  </span>
                  <span className="text-[0.65rem] font-bold uppercase tracking-widest text-white/75">
                    Immediate action required
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm font-semibold text-white">
                  <span className="font-black">{topRisk.name}</span>
                  <span className="mx-2 text-white/50">—</span>
                  <span className="text-white/85">
                    {topRisk.blockerCount > 0
                      ? `${topRisk.blockerCount} unresolved blocker${topRisk.blockerCount === 1 ? "" : "s"} · ${compactTitle(topRisk.topReason, 75)}`
                      : compactTitle(topRisk.topReason, 95)}
                  </span>
                </p>
              </div>
              {/* CTA — white pill so text is always dark-red on white, no inheritance issues */}
              <Link
                className="shrink-0 rounded-xl bg-white px-4 py-1.5 text-xs font-black shadow-sm transition hover:bg-danger-50 active:scale-95"
                style={{ color: '#b91c1c' }}
                to={topRisk.href}
              >
                View now →
              </Link>
              {/* Dismiss */}
              <button
                type="button"
                aria-label="Dismiss P1 alert"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/60 transition hover:bg-white/15 hover:text-white"
                onClick={() => setP1Dismissed(true)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
        className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-6 text-slate-950 shadow-[0_24px_70px_rgba(15,23,42,0.10)] dark:border-slate-800/70 dark:bg-slate-950 dark:text-white dark:shadow-elevated"
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(241,249,249,0.86)_48%,rgba(255,255,255,0.98)),radial-gradient(circle_at_18%_0%,rgba(16,169,154,0.13),transparent_35%),radial-gradient(circle_at_100%_8%,rgba(132,98,232,0.10),transparent_35%)] dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.86)_48%,rgba(15,23,42,0.98)),linear-gradient(90deg,rgba(16,169,154,0.16),transparent_34%,rgba(132,98,232,0.14)_72%,transparent)]" />
        <div className="absolute inset-0 opacity-[0.20] [background-image:linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:32px_32px] dark:opacity-[0.18] dark:[background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)]" />
        <div className="absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-primary-300/80 to-transparent" />

        <div className="relative grid items-stretch gap-8 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-primary-500/25 bg-primary-500/10 text-primary-700 hover:bg-primary-500/10 dark:border-primary-400/40 dark:bg-primary-400/10 dark:text-primary-100 dark:hover:bg-primary-400/10">
                  {project ? project.key : dashboard.scope}
                </Badge>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  <LiveIndicator status={highSignalCount ? "idle" : "online"} />
                  {highSignalCount ? `${highSignalCount} high-priority signals` : "Signals steady"}
                </span>
                <span className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  {summary.sprintWindow}
                </span>
                {project ? (
                  <Button
                    className="min-h-9 rounded-full border border-slate-200/80 bg-white/80 px-4 text-xs font-black text-slate-700 hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                    disabled={refreshingAi}
                    onClick={() => void refreshAiAnalysis()}
                    type="button"
                    variant="ghost"
                  >
                    {refreshingAi ? "Syncing AI..." : "Sync AI analysis"}
                  </Button>
                ) : null}
              </div>

              {/* Title row — HealthRing anchored next to the title block */}
              <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
                <div className="relative shrink-0">
                  <HealthRing score={summary.teamHealthScore} size={108} />
                  {prevSnapshot.team !== null && prevSnapshot.team !== summary.teamHealthScore ? (
                    <div className="absolute -right-1 -top-1 rounded-full border border-white bg-white px-1.5 py-0.5 shadow-sm dark:border-slate-900 dark:bg-slate-900">
                      <TrendDelta delta={summary.teamHealthScore - prevSnapshot.team} />
                    </div>
                  ) : null}
                </div>
                <span aria-hidden className="hidden h-[88px] w-px bg-gradient-to-b from-transparent via-slate-300/60 to-transparent dark:via-white/15 sm:block" />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.74rem] font-bold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-200">
                    {aiOverlay?.source === "ai" ? "AI sprint board" : "Sprint intelligence board"}
                  </p>
                  <h1 className="mt-2 max-w-4xl text-[1.85rem] font-extrabold leading-[1.1] tracking-normal sm:text-[2.4rem]">
                    {project ? project.name : "Project health, ranked by evidence"}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {aiOverlay?.summary ??
                      "Start with the attention queue, then open a profile timeline to explain exactly which standup, Jira, and Git signals changed the score."}
                  </p>
                </div>
              </div>

            </div>

            {/* Key metrics — full-width centered numbers */}
            <div className="grid w-full grid-cols-3 border-t border-slate-200/70 pt-5 dark:border-white/10">
              {([
                {
                  value: summary.atRiskCount > 0 ? String(summary.atRiskCount) : "0",
                  label: "At risk",
                  sub: `of ${dashboard.memberPulses.length} members`,
                  numClass: summary.atRiskCount > 0 ? "text-danger-600 dark:text-danger-200" : "text-emerald-600 dark:text-emerald-200"
                },
                {
                  value: summary.openBlockers > 0 ? String(summary.openBlockers) : "None",
                  label: "Blockers",
                  sub: summary.openBlockers > 0 ? "need owner" : "sprint clear",
                  numClass: summary.openBlockers > 0 ? "text-danger-600 dark:text-danger-200" : "text-emerald-600 dark:text-emerald-200"
                },
                {
                  value: `${summary.readinessScore}%`,
                  label: "Readiness",
                  sub: summary.readinessScore >= 70 ? "on track" : "needs attention",
                  numClass: summary.readinessScore >= 70 ? "text-emerald-600 dark:text-emerald-200" : "text-warning-600 dark:text-warning-200"
                }
              ] as Array<{ value: string; label: string; sub: string; numClass: string }>).map(({ value, label, sub, numClass }, idx) => (
                <div
                  key={label}
                  className={cn(
                    "min-w-0 px-6 text-center",
                    idx > 0 && "border-l border-slate-200/55 dark:border-white/[0.07]"
                  )}
                >
                  <strong
                    className={cn(
                      "block font-mono text-[2.15rem] font-black leading-none tracking-tight",
                      numClass
                    )}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {value}
                  </strong>
                  <span className="mt-2.5 block text-[0.66rem] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {label}
                  </span>
                  <small className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    {sub}
                  </small>
                </div>
              ))}
            </div>

            {/* Detection breakdown — full width with top margin */}
            <div className="mt-4 w-full rounded-2xl border border-slate-200/70 bg-white/65 p-6 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] dark:border-white/10 dark:bg-white/[0.035] dark:shadow-none">
              {/* Header */}
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-[22px] min-w-[26px] place-items-center rounded-md bg-ai-500/12 px-1.5 font-mono text-[0.58rem] font-black tracking-[0.18em] text-ai-700 dark:bg-ai-400/15 dark:text-ai-200">
                    AI
                  </span>
                  <span className="text-[0.7rem] font-black uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200">
                    Signal breakdown
                  </span>
                </div>
                <span
                  className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  <span className="text-slate-900 dark:text-white">{detectionBreakdown.total}</span>
                  <span className="ml-1.5 text-slate-400 dark:text-slate-500">{detectionBreakdown.total === 1 ? "flag" : "flags"}</span>
                </span>
              </div>

              {/* Bars */}
              {detectionBreakdown.total === 0 ? (
                <div className="grid place-items-center gap-1 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/[0.04] py-6 text-center dark:border-emerald-400/25 dark:bg-emerald-400/[0.06]">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-200">No detection flags raised this sprint</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Standup language matches Jira and Git movement across the team.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {detectionBreakdown.rows.map(({ type, label, color, total, critical }) => {
                    const widthPct = total === 0 ? 0 : Math.max(6, Math.round((total / detectionBreakdown.max) * 100));
                    const isEmpty = total === 0;
                    const tooltip = isEmpty
                      ? `${label}: no flags raised this sprint`
                      : `${label}: ${total} flag${total === 1 ? "" : "s"}${critical > 0 ? ` · ${critical} critical` : ""}`;
                    return (
                      <div
                        key={type}
                        className="grid grid-cols-[160px_minmax(0,1fr)_64px] items-center gap-5"
                        title={tooltip}
                      >
                        {/* Label */}
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            aria-hidden
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              color,
                              isEmpty && "opacity-30"
                            )}
                          />
                          <span
                            className={cn(
                              "truncate text-[0.78rem] font-bold",
                              isEmpty
                                ? "text-slate-400 dark:text-slate-500"
                                : "text-slate-700 dark:text-slate-200"
                            )}
                          >
                            {label}
                          </span>
                        </div>

                        {/* Bar */}
                        <div className="relative h-3 overflow-hidden rounded-full bg-slate-200/55 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] dark:bg-white/[0.06] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]">
                          <div
                            className={cn(
                              "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                              color
                            )}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>

                        {/* Count + critical indicator */}
                        <div className="flex items-center justify-end gap-1.5">
                          {critical > 0 ? (
                            <span
                              aria-label={`${critical} critical`}
                              title={`${critical} critical`}
                              className="h-1.5 w-1.5 rounded-full bg-danger-600 shadow-[0_0_0_2px_rgba(220,38,38,0.18)]"
                            />
                          ) : null}
                          <strong
                            className={cn(
                              "font-mono text-base font-black leading-none",
                              isEmpty
                                ? "text-slate-400 dark:text-slate-500"
                                : "text-slate-900 dark:text-white"
                            )}
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {total}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-200/55 pt-3.5 dark:border-white/[0.07]">
                <span className="inline-flex items-center gap-1.5 font-mono text-[0.58rem] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-danger-600 shadow-[0_0_0_2px_rgba(220,38,38,0.18)]"
                  />
                  Critical present
                </span>
                <span
                  className="font-mono text-[0.58rem] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {summary.sprintWindow}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/72 p-5 shadow-glass backdrop-blur dark:border-white/10 dark:bg-white/[0.06]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Decision brief</p>
                <h2 className="mt-1 text-[1.2rem] font-extrabold">{topRisk?.name ?? "No urgent owner"}</h2>
                {aiOverlay?.scoreExplanation ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{aiOverlay.scoreExplanation}</p>
                ) : null}
              </div>
              <span className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                topRisk
                  ? "border-warning-500/30 bg-warning-500/12 text-warning-700 dark:text-warning-200"
                  : "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200"
              )}>
                {topRisk ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              </span>
            </div>
            {topRisk ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/86 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.70)] dark:border-white/10 dark:bg-slate-950/55 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-rose-400 via-amber-300 to-primary-300" />
                <div className="relative mb-3 flex items-center gap-3">
                  <MemberAvatar initials={topRisk.initials} seed={topRisk.name} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate">{topRisk.title}</strong>
                    <small className="text-slate-500 dark:text-slate-300">{roleLabels[topRisk.hackathonRole]}</small>
                    {topRisk.flags.length > 0 ? (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {topRisk.flags.slice(0, 3).map((flag) => (
                          <span
                            key={flag.id}
                            className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.57rem] font-black uppercase tracking-[0.1em]", flagChipClass(flag.severity))}
                          >
                            {flagTypeLabel(flag.type)}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  <strong className="ml-auto rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[1.9rem] font-bold leading-none text-slate-950 dark:border-white/10 dark:bg-white/[0.07] dark:text-white">
                    {topRisk.healthScore}
                  </strong>
                </div>
                <p className="relative text-sm leading-6 text-slate-700 dark:text-slate-200">{compactTitle(topRisk.topReason, 130)}</p>
                <div className="relative mt-4 grid gap-2">
                  {topRiskProof.map((proof) => (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/85 px-3 py-2.5 dark:border-slate-700/70 dark:bg-slate-900/70" key={proof.label}>
                      <span className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">{proof.label}</span>
                      <span className={evidenceChipClass(proof.tone)}>
                        {proof.value}
                      </span>
                    </div>
                  ))}
                </div>
                {aiOverlay?.nextBestAction ? (
                  <p className="relative mt-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-200">
                    {aiOverlay.nextBestAction}
                  </p>
                ) : null}
                <Link
                  className="relative mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-info-500 px-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(16,169,154,0.22)] transition hover:-translate-y-0.5"
                  to={topRisk.href}
                >
                  Open profile timeline
                  <Zap className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <EmptyPanel icon={CheckCircle2} title="No urgent risk" description="Open the attention queue or profile timelines for the full evidence trail." />
            )}
          </div>
        </div>
      </motion.section>

      <SectionPanel className="overflow-hidden p-0" delay={0.12}>
        <div className="border-b border-slate-200/80 p-5 dark:border-white/10">
          <PanelHeader
            eyebrow={<><span className="font-mono opacity-70">01 /</span> Recommended actions</>}
            title="What should happen next"
            description="Ranked actions from standup blockers, Jira movement, PR age, and say-do proof gaps."
            icon={Sparkles}
            tone="ai"
            action={<Badge variant="outline">{recommendedActions.length} actions</Badge>}
          />
        </div>
        <div className="grid gap-3 p-5 xl:grid-cols-4">
          {recommendedActions.map((item) => {
            const ItemIcon = item.icon;
            const isP1 = item.priority === "P1";
            const accentBar =
              item.priority === "P1"
                ? "bg-danger-500"
                : item.priority === "P2"
                  ? "bg-warning-500"
                  : item.priority === "P3"
                    ? "bg-danger-600"
                    : "bg-ai-500";
            return (
              <article
                className={cn(
                  "group relative overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl",
                  isP1 ? "p-[18px] shadow-md ring-1 ring-danger-500/10" : "p-4 shadow-sm",
                  item.tone === "danger"
                    ? isP1
                      ? "border-danger-500/45 bg-gradient-to-br from-danger-500/[0.14] via-danger-500/[0.08] to-danger-500/[0.04]"
                      : "border-danger-500/30 bg-gradient-to-br from-danger-500/[0.08] to-danger-500/[0.04]"
                    : item.tone === "warning"
                      ? "border-warning-500/30 bg-gradient-to-br from-warning-500/[0.08] to-warning-500/[0.04]"
                      : item.tone === "ai"
                        ? "border-ai-500/30 bg-gradient-to-br from-ai-500/[0.08] to-ai-500/[0.04]"
                        : item.tone === "info"
                          ? "border-info-500/30 bg-gradient-to-br from-info-500/[0.08] to-info-500/[0.04]"
                          : "border-primary-500/25 bg-gradient-to-br from-primary-500/[0.07] to-primary-500/[0.03]"
                )}
                key={item.priority}
              >
                {/* Priority accent bar — P1 is thicker */}
                <div className={cn("absolute inset-y-0 left-0 rounded-l-2xl", accentBar, isP1 ? "w-[5px]" : "w-1")} />
                {/* P1 corner glow */}
                {isP1 ? (
                  <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-danger-500/10 blur-2xl" />
                ) : null}
                <div className={cn("relative flex items-start justify-between gap-3", isP1 ? "pl-3" : "pl-2")}>
                  <StatusPill icon={ItemIcon} tone={item.tone}>
                    {item.priority}
                  </StatusPill>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 font-black uppercase tracking-[0.12em]",
                      isP1
                        ? "border-danger-300/60 bg-danger-500/12 text-[0.7rem] text-danger-700 dark:border-danger-400/40 dark:text-danger-200"
                        : "border-white/40 bg-white/70 text-[0.68rem] text-slate-600 dark:border-white/10 dark:bg-white/[0.07] dark:text-slate-300"
                    )}
                  >
                    {item.due}
                  </span>
                </div>
                <div className={cn("relative mt-4", isP1 ? "pl-3" : "pl-2")}>
                  <span className={cn(
                    "block font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400",
                    isP1 ? "text-[0.72rem]" : "text-[0.7rem]"
                  )}>
                    {item.label}
                  </span>
                  <strong className={cn(
                    "mt-1 block font-black leading-6 text-slate-950 dark:text-white",
                    isP1 ? "text-[1.15rem] leading-[1.3]" : "text-[1.02rem]"
                  )}>
                    {item.title}
                  </strong>
                  <p className="m-0 mt-3 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
                    {item.action}
                  </p>
                  <p className="m-0 mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                    {compactTitle(item.proof, 100)}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-black text-slate-700 dark:text-slate-200">
                      {item.owner}
                    </span>
                    {item.href ? (
                      <Link
                        className={cn(
                          "shrink-0 font-black transition",
                          isP1
                            ? "text-sm text-danger-700 hover:text-danger-900 dark:text-danger-200 dark:hover:text-danger-100"
                            : "text-sm text-primary-700 hover:text-primary-900 dark:text-primary-200 dark:hover:text-primary-100"
                        )}
                        to={item.href}
                      >
                        Open →
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </SectionPanel>

      <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.28fr)_minmax(380px,0.72fr)]">
        <SectionPanel className="overflow-hidden p-0" delay={0.18}>
          <div className="border-b border-slate-200/80 p-5 dark:border-white/10">
            <PanelHeader
              eyebrow={<><span className="font-mono opacity-70">02 /</span> Attention queue</>}
              title="Lowest health first"
              description="Ordered by intervention priority so the first row has the clearest evidence for a Scrum Master conversation."
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
                    "group grid gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/10 dark:hover:shadow-black/25 lg:grid-cols-[48px_48px_minmax(0,1fr)_minmax(250px,0.8fr)_118px]",
                    riskAccentClass(member.riskLevel)
                  )}
                  key={member.id}
                  to={member.href}
                >
                  <span
                    className={cn(
                      "grid h-12 w-12 shrink-0 place-items-center rounded-2xl border font-mono shadow-sm transition group-hover:scale-[1.03]",
                      priorityRankClass(member.rank)
                    )}
                    title={`Priority ${member.rank}`}
                  >
                    <span className="grid text-center leading-none">
                      <small className="text-[0.56rem] font-black uppercase tracking-[0.14em] opacity-70">P</small>
                      <strong className="mt-0.5 text-[1.05rem] font-black">{member.rank}</strong>
                    </span>
                  </span>
                  <MemberAvatar initials={member.initials} seed={member.name} />
                  <span className="min-w-0">
                    <strong className="block truncate text-[1.02rem] font-extrabold text-slate-950 dark:text-white">{member.name}</strong>
                    {member.flags.length > 0 ? (
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {member.flags.slice(0, 2).map((flag) => (
                          <span
                            key={flag.id}
                            className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.57rem] font-black uppercase tracking-[0.1em]", flagChipClass(flag.severity))}
                          >
                            {flagTypeLabel(flag.type)}
                          </span>
                        ))}
                        <small className="text-[0.74rem] font-medium text-slate-500 dark:text-slate-400">{roleLabels[member.hackathonRole]}</small>
                      </span>
                    ) : (
                      <small className="text-[0.86rem] font-medium text-slate-500 dark:text-slate-400">
                        {roleLabels[member.hackathonRole]} · {compactTitle(member.topReason, 66)}
                      </small>
                    )}
                  </span>
                  <span className="grid content-center gap-2 text-sm">
                    <span className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-2">
                      <MessageSquareText className="h-4 w-4 text-primary-600 dark:text-primary-200" />
                      <span className="truncate font-semibold text-slate-600 dark:text-slate-300">{member.standupProof}</span>
                    </span>
                    <span className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-2">
                      <TicketCheck className="h-4 w-4 text-info-600 dark:text-info-200" />
                      <span className="truncate font-semibold text-slate-600 dark:text-slate-300">{member.jiraProof}</span>
                    </span>
                    <span className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-2">
                      <GitPullRequest className="h-4 w-4 text-ai-600 dark:text-ai-200" />
                      <span className="truncate font-semibold text-slate-600 dark:text-slate-300">{member.reviewProof}</span>
                    </span>
                  </span>
                  <span className="flex flex-col items-end justify-center gap-2 self-center text-right">
                    <div className="relative">
                      <HealthRing score={member.healthScore} size={52} />
                      {prevSnapshot.members[member.id] !== undefined && prevSnapshot.members[member.id] !== member.healthScore ? (
                        <div className="absolute -right-2 -top-1 rounded-full border border-white bg-white px-1 shadow-sm dark:border-slate-900 dark:bg-slate-900">
                          <TrendDelta delta={member.healthScore - prevSnapshot.members[member.id]} size="xs" />
                        </div>
                      ) : null}
                    </div>
                    <small className="text-[0.62rem] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Open timeline</small>
                  </span>
                </Link>
              ))
            ) : (
              <EmptyPanel icon={UsersRound} title="No members yet" description="Team members appear here after project setup." />
            )}
          </div>
        </SectionPanel>

        <SectionPanel delay={0.24}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="m-0 text-[0.72rem] font-black uppercase tracking-[0.18em] text-primary-700 dark:text-primary-200">
                <span className="font-mono opacity-70">03 /</span> Delivery pressure
              </p>
              <h2 className="m-0 mt-2 text-[1.45rem] font-black tracking-normal text-slate-950 dark:text-white">
                Review and scope risks
              </h2>
              <p className="m-0 mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                PRs waiting too long and high-scope Jira work that has stopped moving.
              </p>
            </div>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-warning-400/35 bg-warning-400/10 text-warning-700 shadow-sm dark:text-warning-100">
              <GitPullRequest className="h-5 w-5" />
            </span>
          </div>
          <div className="grid gap-3">
            {deliveryPressureCards.map((card) => {
              const CardIcon = card.icon;
              return (
                <article
                  className={cn(
                    "rounded-2xl border p-4",
                    card.tone === "danger"
                      ? "border-danger-500/25 bg-danger-500/10"
                      : card.tone === "warning"
                        ? "border-warning-500/25 bg-warning-500/10"
                        : card.tone === "ai"
                          ? "border-ai-500/25 bg-ai-500/10"
                          : "border-emerald-500/25 bg-emerald-500/10"
                  )}
                  key={card.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <StatusPill icon={CardIcon} tone={card.tone}>
                        {card.action}
                      </StatusPill>
                      <strong className="mt-3 block text-[0.95rem] font-extrabold text-slate-950 dark:text-white">{card.title}</strong>
                      <small className="mt-1 block text-sm font-semibold text-slate-600 dark:text-slate-300">{card.proof}</small>
                    </span>
                  </div>
                </article>
              );
            })}

            <div className="grid gap-2 rounded-2xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.045]">
              <strong className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Needs attention</strong>
              {prAgingRisks.length || storyPointStaleRisks.length ? (
                <>
                  {prAgingRisks.map(({ pulse, oldestReviewDays, pressure }) => (
                    <Link
                      className="grid gap-1 rounded-xl border border-warning-500/20 bg-warning-500/10 px-3 py-2 text-sm font-bold text-warning-700 transition hover:-translate-y-0.5 dark:text-warning-100"
                      key={`pr-${pulse.id}`}
                      to={project ? `/projects/${project.id}/members/${pulse.id}` : `/members/${pulse.id}`}
                    >
                      <span>{pulse.name} · {pulse.git.pullRequestsOpen} open PR{pulse.git.pullRequestsOpen === 1 ? "" : "s"}</span>
                      <small>{oldestReviewDays}d waiting · {pressure}% review pressure</small>
                    </Link>
                  ))}
                  {storyPointStaleRisks.map(({ pulse, ticket }) => (
                    <Link
                      className="grid gap-1 rounded-xl border border-danger-500/20 bg-danger-500/10 px-3 py-2 text-sm font-bold text-danger-700 transition hover:-translate-y-0.5 dark:text-danger-100"
                      key={`jira-${pulse.id}-${ticket.key}`}
                      to={project ? `/projects/${project.id}/members/${pulse.id}` : `/members/${pulse.id}`}
                    >
                      <span>{ticket.key} · {ticket.storyPoints ? `${ticket.storyPoints} pts` : "scope risk"}</span>
                      <small>{ticket.daysIdle}d idle · {pulse.name}</small>
                    </Link>
                  ))}
                </>
              ) : (
                <p className="m-0 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-100">
                  No aged PR or high-scope Jira risk is active.
                </p>
              )}
            </div>
          </div>
        </SectionPanel>
      </section>

      <SectionPanel delay={0.3}>
        <PanelHeader
          eyebrow={<><span className="font-mono opacity-70">04 /</span> Team activity</>}
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
        <div className="grid gap-2">
          {teamProgressRows.length ? (
            teamProgressRows.map((row) => {
              const memberPulse = dashboard.memberPulses.find((p) => p.id === row.id);
              const health = memberPulse?.healthScore ?? 0;
              const riskLvl = memberPulse?.riskLevel ?? "low";
              const dotColor =
                riskLvl === "critical" || riskLvl === "high"
                  ? "bg-danger-500"
                  : riskLvl === "medium"
                    ? "bg-warning-500"
                    : "bg-emerald-500";
              return (
                <Link
                  className="group grid gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-500/35 hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.07] lg:grid-cols-[200px_minmax(0,1fr)_180px_72px]"
                  key={row.id}
                  to={row.href}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <div className="relative shrink-0">
                      <MemberAvatar initials={row.initials} seed={row.name} size="sm" />
                      <span className={cn("absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-950", dotColor)} />
                    </div>
                    <span className="min-w-0">
                      <strong className="block truncate text-sm font-extrabold text-slate-950 dark:text-white">{row.name}</strong>
                      <small className="block truncate text-slate-500 dark:text-slate-400">{row.role}</small>
                    </span>
                  </span>

                  <span className="grid content-center gap-2">
                    <span className="grid grid-cols-14 gap-1" aria-label={`${row.name} sprint signal map`}>
                      {row.cells.map((source, index) => (
                        <span
                          className={cn(
                            "h-5 rounded-md ring-1 ring-black/5 transition-transform duration-150 group-hover:scale-110 dark:ring-white/10",
                            signalCellClass(source)
                          )}
                          key={`${row.id}-${index}`}
                          title={source === "empty" ? `Day ${index + 1} · no signal` : `Day ${index + 1} · ${source} activity`}
                        />
                      ))}
                    </span>
                  </span>

                  <span className="grid content-center gap-1 self-center text-sm">
                    <strong className="truncate text-slate-950 dark:text-white">{row.primarySignal}</strong>
                    <small className="truncate font-semibold text-slate-500 dark:text-slate-400">{row.latestMovement}</small>
                  </span>

                  <span className="hidden flex-col items-end justify-center gap-1 self-center lg:flex">
                    <strong
                      className={cn(
                        "font-mono text-lg font-black leading-none",
                        health >= 80 ? "text-emerald-600 dark:text-emerald-300" :
                        health >= 60 ? "text-warning-600 dark:text-warning-300" :
                        "text-danger-600 dark:text-danger-300"
                      )}
                    >
                      {health}
                    </strong>
                    <div className="h-1 w-10 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          health >= 80 ? "bg-emerald-500" : health >= 60 ? "bg-warning-500" : "bg-danger-500"
                        )}
                        style={{ width: `${health}%` }}
                      />
                    </div>
                  </span>
                </Link>
              );
            })
          ) : (
            <EmptyPanel icon={GitCommitHorizontal} title="No activity yet" description="Standups, Jira, and Git signals will build the team progress lanes." />
          )}
        </div>
      </SectionPanel>

      <section className="grid items-stretch gap-5">
        <SectionPanel delay={0.36}>
          <PanelHeader
            eyebrow={<><span className="font-mono opacity-70">05 /</span> Evidence trail</>}
            title="What changed the score"
            description="A readable trail of standups, Jira idle work, Git activity, and risk flags."
            icon={Activity}
          />
          {timelineEvents.length ? (
            <div className="relative pl-6">
              {/* Vertical connector line */}
              <div className="absolute left-[19px] top-4 bottom-4 w-px bg-gradient-to-b from-slate-300/60 via-slate-200/40 to-transparent dark:from-white/15 dark:via-white/8 dark:to-transparent" />
              <div className="grid gap-3">
                {timelineEvents.map((event, idx) => {
                  const EventIcon = event.icon;
                  return (
                    <article
                      className="relative grid gap-3 rounded-2xl border border-slate-200/80 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.045] md:grid-cols-[40px_minmax(0,1fr)_150px]"
                      key={event.id}
                    >
                      {/* Timeline node dot on the connector line */}
                      <span
                        aria-hidden="true"
                        title={`${event.tone === "risk" ? "Risk flag" : event.tone === "standup" ? "Standup" : event.tone === "git" ? "Git activity" : event.tone === "jira" ? "Jira movement" : "AI signal"} · ${event.label}`}
                        className={cn(
                          "absolute -left-6 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-slate-950",
                          event.tone === "risk" ? "bg-danger-500" :
                          event.tone === "standup" ? "bg-primary-500" :
                          event.tone === "git" ? "bg-ai-500" :
                          event.tone === "jira" ? "bg-info-500" :
                          "bg-warning-500"
                        )}
                        style={{ marginTop: idx === 0 ? 2 : 0 }}
                      />
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
                })}
              </div>
            </div>
          ) : (
            <EmptyPanel icon={Activity} title="No evidence yet" description="Standups, Jira issues, Git commits, and flags appear here as signals sync." />
          )}
        </SectionPanel>
      </section>
    </div>
  );
}
