import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowLeft,
  CalendarDays,
  GitCommitHorizontal,
  GitPullRequest,
  MessageSquareText,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TicketCheck
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { AiPrReviewResponse, MemberPulse, MemberPulseHistoryResponse, RiskLevel } from "@sprintpulse/shared";
import { Badge } from "@/components/ui/badge";
import {
  EmptyPanel,
  MemberAvatar,
  PanelHeader,
  SectionPanel,
  StatusPill,
  WorkspaceError,
  WorkspaceLoading,
  workspacePageClass
} from "@/components/workspace/WorkspaceChrome";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import { projectCacheKey, readProjectCache, writeProjectCache } from "../lib/projectDataCache";
import { cn } from "../lib/utils";

const isHistoryResponse = (
  response: { member: MemberPulse } | MemberPulseHistoryResponse
): response is MemberPulseHistoryResponse => "recommendations" in response && "standups" in response;

function riskTone(level: RiskLevel) {
  if (level === "critical" || level === "high") {
    return "danger" as const;
  }
  if (level === "medium") {
    return "warning" as const;
  }
  return "success" as const;
}

type SignalTone = "primary" | "info" | "warning" | "danger" | "ai" | "neutral" | "success";

function signalChipClass(tone: SignalTone) {
  return cn(
    "!inline-flex !h-auto !w-auto !min-w-0 !aspect-auto items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-black shadow-sm",
    tone === "danger" && "border-danger-500/25 bg-danger-500/10 text-danger-700 dark:text-danger-100",
    tone === "warning" && "border-warning-500/30 bg-warning-500/10 text-warning-700 dark:text-warning-100",
    tone === "success" && "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100",
    tone === "info" && "border-info-500/25 bg-info-500/10 text-info-700 dark:text-info-100",
    tone === "primary" && "border-primary-500/25 bg-primary-500/10 text-primary-700 dark:text-primary-100",
    tone === "ai" && "border-ai-500/25 bg-ai-500/10 text-ai-700 dark:text-ai-100",
    tone === "neutral" && "border-slate-200 bg-white/80 text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
  );
}

function riskTextClass(level: RiskLevel) {
  if (level === "critical" || level === "high") {
    return "text-danger-700 dark:text-danger-100";
  }
  if (level === "medium") {
    return "text-warning-700 dark:text-warning-100";
  }
  return "text-emerald-700 dark:text-emerald-100";
}

function severityRank(level: RiskLevel) {
  if (level === "critical") {
    return 4;
  }
  if (level === "high") {
    return 3;
  }
  if (level === "medium") {
    return 2;
  }
  return 1;
}

function riskAccentClass(level: RiskLevel) {
  if (level === "critical" || level === "high") {
    return "border-danger-500/30 bg-danger-500/10";
  }
  if (level === "medium") {
    return "border-warning-500/30 bg-warning-500/10";
  }
  return "border-emerald-500/30 bg-emerald-500/10";
}

function repoPulseTone(badge: string) {
  const normalized = badge.toLowerCase();
  if (normalized.includes("blocked") || normalized.includes("churn") || normalized.includes("changes requested")) {
    return "danger" as const;
  }
  if (
    normalized.includes("quiet") ||
    normalized.includes("late") ||
    normalized.includes("drop") ||
    normalized.includes("bursty") ||
    normalized.includes("review notes")
  ) {
    return "warning" as const;
  }
  return "success" as const;
}

function codeReviewTone(state?: string) {
  if (state === "needs-fixes") {
    return "danger" as const;
  }
  if (state === "watch") {
    return "warning" as const;
  }
  return "success" as const;
}

function timelineToneClass(tone: "standup" | "flag" | "jira" | "git" | "recommendation") {
  const tones = {
    standup: "border-primary-500/30 bg-primary-500/10 text-primary-700 dark:text-primary-100",
    flag: "border-danger-500/30 bg-danger-500/10 text-danger-700 dark:text-danger-100",
    jira: "border-info-500/30 bg-info-500/10 text-info-700 dark:text-info-100",
    git: "border-ai-500/30 bg-ai-500/10 text-ai-700 dark:text-ai-100",
    recommendation: "border-warning-500/30 bg-warning-500/10 text-warning-700 dark:text-warning-100"
  } as const;

  return tones[tone];
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function timestampValue(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function compactText(value: string, max = 130) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function compactPrScopeLabel(pullRequest: { number: number; title: string }) {
  return `PR #${pullRequest.number} - ${compactText(pullRequest.title, 24)}`;
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

function hasBlocker(value: string) {
  return Boolean(value && !value.toLowerCase().includes("no blocker"));
}

export function MemberDetailPage() {
  const { projectId, memberId } = useParams();
  const { persona } = useAuth();
  const { selectedSprintId } = useProject();
  const [member, setMember] = useState<MemberPulse | null>(null);
  const [history, setHistory] = useState<MemberPulseHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prReview, setPrReview] = useState<AiPrReviewResponse | null>(null);
  const [prReviewLoading, setPrReviewLoading] = useState(false);
  const [prReviewError, setPrReviewError] = useState<string | null>(null);
  const [selectedPrNumber, setSelectedPrNumber] = useState("all");

  const handlePrReview = () => {
    if (!projectId || !memberId || !persona) return;
    const pullRequestNumber = selectedPrNumber === "all" ? undefined : Number(selectedPrNumber);
    setPrReviewLoading(true);
    setPrReviewError(null);
    api
      .runMemberPrReview(
        projectId,
        memberId,
        persona.id,
        selectedSprintId,
        Number.isFinite(pullRequestNumber) ? pullRequestNumber : undefined
      )
      .then(setPrReview)
      .catch((err: Error) => {
        const msg = err.message;
        if (msg.includes('not found') || msg.includes('Not Found') || msg.includes('token')) {
          setPrReviewError("Git repository not accessible. Check that the saved provider token is valid and has read access to this repository.");
        } else {
          setPrReviewError(msg);
        }
      })
      .finally(() => setPrReviewLoading(false));
  };

  const applyMemberResponse = (response: { member: MemberPulse } | MemberPulseHistoryResponse) => {
    setMember(response.member);
    setHistory(isHistoryResponse(response) ? response : null);
  };

  useEffect(() => {
    if (!memberId) {
      return;
    }

    if (projectId && !persona) {
      return;
    }

    const cacheKey = projectCacheKey(projectId ? "project-member" : "member", [
      projectId,
      memberId,
      persona?.id,
      selectedSprintId
    ]);
    const cached = readProjectCache<{ member: MemberPulse } | MemberPulseHistoryResponse>(cacheKey);
    if (cached) {
      applyMemberResponse(cached);
    }

    setLoading(!cached);
    setError(null);

    const request = projectId && persona
      ? api.getProjectMemberHistory(projectId, memberId, persona.id, selectedSprintId ?? undefined)
      : api.getMember(memberId);
    request
      .then((response) => {
        writeProjectCache(cacheKey, response);
        applyMemberResponse(response);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [memberId, persona?.id, projectId, selectedSprintId]);

  useEffect(() => {
    setPrReview(null);
    setPrReviewError(null);
    setSelectedPrNumber("all");
  }, [memberId, projectId, selectedSprintId]);

  if (loading) {
    return <WorkspaceLoading label="Loading member pulse" />;
  }

  if (error || !member) {
    return <WorkspaceError label={error ?? "Member unavailable"} />;
  }

  const activeIssues = history?.issues.length ?? member.tickets.length;
  const commits = history?.commits ?? [];
  const tickets = history?.issues.length
    ? history.issues.map((issue) => ({
        key: issue.issueKey,
        title: issue.summary,
        status: issue.status,
        daysIdle: issue.daysIdle,
        storyPoints: issue.storyPoints
      }))
    : member.tickets;
  const standups = history?.standups.length ? history.standups : member.standups;
  const blockerCount = standups.filter((standup) => hasBlocker(standup.blockers)).length;
  const staleTicketCount = tickets.filter((ticket) => ticket.daysIdle >= 3 && ticket.status !== "Done").length;
  const repoBadges = member.git.repoPulseBadges ?? [member.git.commitsThisSprint ? "Active" : "Quiet"];
  const deliveryConfidence = member.git.deliveryConfidence ?? member.healthScore;
  const churnLines = member.git.churnLines ?? commits.reduce((total, commit) => total + commit.additions + commit.deletions, 0);
  const stalePullRequests = member.git.stalePullRequests ?? 0;
  const reviewIssues = member.git.reviewIssues ?? 0;
  const reviewComments = member.git.reviewComments ?? 0;
  const reviewConversationComments = member.git.reviewConversationComments ?? 0;
  const reviewSubmissions = member.git.reviewSubmissions ?? 0;
  const reviewApprovals = member.git.reviewApprovals ?? 0;
  const requiredReviewers = 2;
  const reviewerGateMet = reviewApprovals >= requiredReviewers;
  const reviewChangeRequests = member.git.reviewChangeRequests ?? 0;
  const pullRequestChurn = member.git.pullRequestChurn ?? [];
  const pullRequestChurnLines = pullRequestChurn.reduce((total, pullRequest) => total + pullRequest.churnLines, 0);
  const codeReviewState = member.git.codeReviewState ?? "clean";
  const codeReviewSummary = member.git.codeReviewSummary ?? "No open PR review signal for this sprint.";
  const dailyActivity = member.git.dailyActivity ?? [];
  const maxDailyCommits = Math.max(1, ...dailyActivity.map((day) => day.commits));
  const velocityState = member.git.velocityState ?? "steady";
  const velocitySummary = member.git.velocitySummary ?? "Commit velocity is steady for the selected sprint.";
  const recentCommits = [...commits].sort((a, b) => timestampValue(b.committedAt) - timestampValue(a.committedAt));
  const recentStandups = [...standups].sort((a, b) => timestampValue(b.date) - timestampValue(a.date));
  const visibleTickets = [...tickets].sort(
    (a, b) =>
      Number(b.status === "Blocked") - Number(a.status === "Blocked") ||
      b.daysIdle - a.daysIdle ||
      (b.storyPoints ?? 0) - (a.storyPoints ?? 0)
  );
  const latestStandup = recentStandups[0];
  const highestRiskTicket = visibleTickets.find((ticket) => ticket.status === "Blocked" || (ticket.daysIdle >= 3 && ticket.status !== "Done")) ?? visibleTickets[0];
  const latestCommit = recentCommits[0];
  const reviewWaitDays = member.git.pullRequestsOpen ? Math.max(0, member.git.oldestPullRequestDays ?? 0) : 0;
  const sourceDossier = [
    {
      label: "Standup",
      title: blockerCount ? `${blockerCount} blocker mention${blockerCount === 1 ? "" : "s"}` : "Latest standup is unblocked",
      proof: latestStandup
        ? compactText(hasBlocker(latestStandup.blockers) ? `${latestStandup.blockers} / Today: ${latestStandup.today}` : latestStandup.today, 118)
        : "No standup has been captured for this sprint.",
      action: blockerCount ? "Clarify owner" : "Use as delivery context",
      icon: MessageSquareText,
      tone: blockerCount ? ("danger" as const) : ("primary" as const)
    },
    {
      label: "Jira",
      title: highestRiskTicket ? `${highestRiskTicket.key} / ${highestRiskTicket.status}` : "No Jira issue mapped",
      proof: highestRiskTicket
        ? `${highestRiskTicket.title} / ${highestRiskTicket.daysIdle}d idle${highestRiskTicket.storyPoints ? ` / ${highestRiskTicket.storyPoints} pts` : ""}`
        : `${activeIssues} issue${activeIssues === 1 ? "" : "s"} visible in this sprint.`,
      action: staleTicketCount ? "Move, split, or re-scope" : "Keep status aligned",
      icon: TicketCheck,
      tone: staleTicketCount ? ("warning" as const) : ("info" as const)
    },
    {
      label: "PR review",
      title: reviewIssues
        ? `${reviewIssues} review issue${reviewIssues === 1 ? "" : "s"} reported`
        : member.git.pullRequestsOpen
          ? "Review queue needs owner"
          : "Review queue clear",
      proof: codeReviewSummary,
      action: reviewChangeRequests
        ? "Triage review notes"
        : reviewIssues
          ? "Triage review notes"
          : member.git.pullRequestsOpen
            ? "Assign reviewer"
            : "Track review SLA",
      icon: GitPullRequest,
      tone: codeReviewTone(codeReviewState)
    },
    {
      label: "Git",
      title: latestCommit ? `Last commit ${formatDate(latestCommit.committedAt)}` : "No commit preview",
      proof: latestCommit ? compactText(`${latestCommit.sha.slice(0, 7)} / ${latestCommit.message}`, 118) : velocitySummary,
      action: velocityState === "steady" ? "Keep Git linked to Jira" : `Investigate ${velocityLabel(velocityState).toLowerCase()} velocity`,
      icon: GitCommitHorizontal,
      tone: repoPulseTone(velocityState)
    }
  ];
  const heroSignals = [
    {
      label: "Jira",
      value: staleTicketCount ? `${staleTicketCount} stale` : `${activeIssues} mapped`,
      icon: TicketCheck,
      tone: staleTicketCount ? ("warning" as const) : ("info" as const)
    },
    {
      label: "Git",
      value: velocityLabel(velocityState),
      icon: GitCommitHorizontal,
      tone: repoPulseTone(velocityState)
    },
    {
      label: "PR",
      value: member.git.pullRequestsOpen ? `${member.git.pullRequestsOpen} open` : "clear",
      icon: GitPullRequest,
      tone: member.git.pullRequestsOpen ? ("warning" as const) : ("success" as const)
    },
    {
      label: "Standup",
      value: blockerCount ? `${blockerCount} blocker` : "clear",
      icon: MessageSquareText,
      tone: blockerCount ? ("danger" as const) : ("neutral" as const)
    }
  ];
  const healthWidth = `${Math.max(5, Math.min(100, member.healthScore))}%`;
  const primaryAction = member.aiScore?.recommendation ?? member.recommendation;
  const profileTimeline = [
    ...member.flags.map((flag, index) => ({
      id: `flag-${flag.id}`,
      title: flag.title,
      detail: flag.message,
      meta: flag.type.replace(/_/g, " "),
      dateLabel: "Current sprint",
      sortValue: Date.now() - index,
      tone: "flag" as const,
      icon: ShieldAlert
    })),
    ...(history?.recommendations ?? []).slice(0, 4).map((recommendation) => ({
      id: `recommendation-${recommendation.id}`,
      title: recommendation.title,
      detail: recommendation.message,
      meta: recommendation.kind,
      dateLabel: formatDate(recommendation.createdAt),
      sortValue: timestampValue(recommendation.createdAt),
      tone: "recommendation" as const,
      icon: Sparkles
    })),
    ...recentStandups.map((standup) => ({
      id: `standup-${standup.id}`,
      title: hasBlocker(standup.blockers) ? "Standup with blocker" : "Standup update",
      detail: hasBlocker(standup.blockers)
        ? `${standup.blockers} · Today: ${standup.today}`
        : standup.today,
      meta: standup.source,
      dateLabel: formatDate(standup.date),
      sortValue: timestampValue(standup.date),
      tone: "standup" as const,
      icon: MessageSquareText
    })),
    ...visibleTickets.slice(0, 8).map((ticket) => ({
      id: `jira-${ticket.key}`,
      title: `${ticket.key} · ${ticket.status}`,
      detail: ticket.title,
      meta: `${ticket.daysIdle}d idle`,
      dateLabel: ticket.daysIdle ? `${ticket.daysIdle}d idle` : "Jira",
      sortValue: Date.now() - ticket.daysIdle * 24 * 60 * 60 * 1000,
      tone: "jira" as const,
      icon: TicketCheck
    })),
    ...recentCommits.slice(0, 8).map((commit) => ({
      id: `commit-${commit.id}`,
      title: "Commit pushed",
      detail: commit.message,
      meta: `${commit.sha.slice(0, 8)} · +${commit.additions} / -${commit.deletions}`,
      dateLabel: formatDate(commit.committedAt),
      sortValue: timestampValue(commit.committedAt),
      tone: "git" as const,
      icon: GitPullRequest
    }))
  ].sort((a, b) => b.sortValue - a.sortValue);

  return (
    <div className={workspacePageClass}>
      <Link className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:border-primary-500/35 hover:text-primary-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-primary-100" to={projectId ? `/projects/${projectId}/dashboard` : "/projects"}>
        <ArrowLeft className="h-4 w-4" />
        Back to attention queue
      </Link>

      <section className="premium-surface relative overflow-hidden rounded-2xl p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-400/80 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,169,154,0.08),transparent_38%,rgba(132,98,232,0.10)),linear-gradient(90deg,rgba(255,255,255,0.38),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(16,169,154,0.10),transparent_38%,rgba(132,98,232,0.15))]" />
        <div className="relative grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 gap-5">
            <MemberAvatar initials={member.initials} seed={member.name} size="lg" className="mt-1" />
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <StatusPill tone="primary">{member.title}</StatusPill>
                <StatusPill tone={riskTone(member.riskLevel)}>{member.riskLevel} risk</StatusPill>
              </div>
              <h1 className="m-0 text-[2.35rem] font-black leading-none tracking-normal text-slate-950 dark:text-white xl:text-[3rem]">
                {member.name}
              </h1>
              <p className="m-0 mt-3 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">{member.currentFocus}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-slate-950/55">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="m-0 text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Health score</p>
                <strong className="mt-2 block font-mono text-5xl font-black leading-none text-slate-950 dark:text-white">{member.healthScore}</strong>
              </div>
              <Badge className={cn("px-3 py-1.5", riskAccentClass(member.riskLevel), riskTextClass(member.riskLevel))} variant="outline">
                {member.riskLevel} risk
              </Badge>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10" aria-hidden="true">
              <span
                className={cn(
                  "block h-full rounded-full bg-gradient-to-r",
                  riskTone(member.riskLevel) === "danger"
                    ? "from-danger-500 to-warning-500"
                    : riskTone(member.riskLevel) === "warning"
                      ? "from-warning-500 to-primary-500"
                      : "from-emerald-500 to-primary-500"
                )}
                style={{ width: healthWidth }}
              />
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm font-semibold leading-6 text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
              <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Next action</span>
              {primaryAction}
            </div>
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {heroSignals.map((signal) => {
            const SignalIcon = signal.icon;
            return (
              <article className="grid min-h-20 gap-2 rounded-2xl border border-slate-200/80 bg-white/72 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.055]" key={signal.label}>
                <span className={signalChipClass(signal.tone)}>
                  <SignalIcon className="h-4 w-4 shrink-0" />
                  {signal.label}
                </span>
                <strong className="truncate text-lg font-black text-slate-950 dark:text-white">{signal.value}</strong>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <SectionPanel>
          <PanelHeader
            eyebrow="Investigation"
            title="Primary reason"
            description={member.aiScore ? "The highest-impact reason behind this member score, with the action a Scrum Master should take next." : "The clearest risk signal and action path for this sprint."}
            icon={ShieldAlert}
            tone={riskTone(member.riskLevel)}
          />
          <div className="grid gap-3">
            <article className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]">
              <StatusPill icon={Sparkles} tone={riskTone(member.riskLevel)}>
                Recommended action
              </StatusPill>
              <p className="m-0 mt-3 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
                {member.aiScore?.recommendation ?? member.recommendation}
              </p>
            </article>
            {member.flags.length ? (
              member.flags.map((flag) => (
                <article className={cn("rounded-2xl border p-4", riskAccentClass(flag.severity))} key={flag.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block text-sm font-black text-slate-950 dark:text-white">{flag.title}</strong>
                      <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{flag.type.replace(/_/g, " ")}</span>
                    </div>
                    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-black", riskTextClass(flag.severity))}>
                      {flag.severity}
                    </span>
                  </div>
                  <p className="m-0 mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{flag.message}</p>
                </article>
              ))
            ) : (
              <EmptyPanel icon={Sparkles} title="No active flags" description="This member has no active risk flags for the selected sprint." />
            )}
          </div>
        </SectionPanel>

        <SectionPanel>
          <PanelHeader
            eyebrow="Proof"
            title="Evidence dossier"
            description="Source-by-source proof for the member score, with an immediate action for each signal."
            icon={Activity}
            tone="ai"
          />
          <div className="grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-4">
            {sourceDossier.map((card) => {
              const CardIcon = card.icon;
              return (
                <article className="grid min-h-[258px] grid-rows-[auto_1fr_auto] rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]" key={card.label}>
                  <div className="flex items-start justify-between gap-3">
                    <StatusPill className="max-w-full truncate" icon={CardIcon} tone={card.tone}>
                      {card.label}
                    </StatusPill>
                    <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
                  </div>
                  <div className="min-w-0 py-4">
                    <strong className="line-clamp-2 block min-h-[3rem] text-[1rem] font-black leading-6 text-slate-950 dark:text-white">{card.title}</strong>
                    <p className="m-0 mt-2 line-clamp-3 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{card.proof}</p>
                  </div>
                  <span className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-200/80 bg-white/75 px-3 text-center text-sm font-black leading-5 text-slate-700 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-200">
                    {card.action}
                  </span>
                </article>
              );
            })}
          </div>

          <div className="mt-5 grid items-stretch gap-3 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.045]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <strong className="text-sm font-black text-slate-950 dark:text-white">Jira work</strong>
                <Badge variant="outline">Issue trail</Badge>
              </div>
              <div className="grid gap-2">
                {visibleTickets.slice(0, 4).map((ticket) => (
                  <div className="grid grid-cols-[80px_minmax(0,1fr)_112px] items-center gap-3 rounded-xl bg-slate-950/[0.035] px-3 py-2 dark:bg-white/[0.045]" key={ticket.key}>
                    <strong className="font-mono text-xs text-slate-950 dark:text-white">{ticket.key}</strong>
                    <span className="truncate text-sm text-slate-600 dark:text-slate-300">{ticket.title}</span>
                    <small className="text-right text-xs font-black text-slate-500 dark:text-slate-400">
                      {ticket.status} / {ticket.daysIdle}d
                    </small>
                  </div>
                ))}
                {!tickets.length ? <p className="m-0 text-sm text-slate-500 dark:text-slate-400">No Jira issues mapped yet.</p> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.045]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <strong className="text-sm font-black text-slate-950 dark:text-white">Git movement</strong>
                <Badge variant="outline">Repository proof</Badge>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {repoBadges.map((badge) => (
                  <StatusPill key={badge} tone={repoPulseTone(badge)}>
                    {badge}
                  </StatusPill>
                ))}
              </div>
              <div className="mb-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
                {[
                  ["Confidence", `${deliveryConfidence}%`],
                  ["Churn", `${churnLines} lines`],
                  ["Velocity", velocityLabel(velocityState)],
                  ["Late-night", member.git.lateNightCommits ?? 0]
                ].map(([label, value]) => (
                  <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]" key={label}>
                    <span className="block break-words text-[0.68rem] font-black uppercase leading-4 text-slate-500 dark:text-slate-400">{label}</span>
                    <strong className="mt-1 block break-words text-sm leading-5 text-slate-950 dark:text-white">{value}</strong>
                  </div>
                ))}
              </div>
              {dailyActivity.length ? (
                <div className="mb-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <strong className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Daily velocity</strong>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{velocitySummary}</span>
                  </div>
                  <div className="grid grid-flow-col auto-cols-fr items-end gap-1.5 overflow-x-auto pb-1">
                    {dailyActivity.map((day) => (
                      <span className="grid min-w-8 gap-1" key={day.date} title={`${day.date}: ${day.commits} commits, ${day.churnLines} lines`}>
                        <span className="flex h-16 items-end rounded-lg bg-slate-950/[0.04] p-1 dark:bg-white/[0.045]">
                          <span
                            className={cn(
                              "block w-full rounded-md transition",
                              day.commits ? "bg-primary-500 shadow-[0_0_14px_rgba(16,169,154,0.22)]" : "bg-slate-300/70 dark:bg-white/15"
                            )}
                            style={{ height: `${Math.max(8, Math.round((day.commits / maxDailyCommits) * 100))}%` }}
                          />
                        </span>
                        <small className="text-center text-[0.62rem] font-bold text-slate-500 dark:text-slate-400">{day.date.slice(5)}</small>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mb-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">PR code review</strong>
                    <StatusPill tone={codeReviewTone(codeReviewState)}>
                      {codeReviewState === "needs-fixes" ? "Needs fixes" : codeReviewState === "watch" ? "Watch" : "Clean"}
                    </StatusPill>
                    <StatusPill tone={reviewerGateMet ? "success" : "warning"} title="Repository branch protection requires two approving reviewers.">
                      Git: 2 reviewers required
                    </StatusPill>
                    <StatusPill tone={reviewerGateMet ? "success" : "warning"}>
                      {Math.min(reviewApprovals, requiredReviewers)}/{requiredReviewers} approved
                    </StatusPill>
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                    {pullRequestChurn.length > 1 ? (
                      <label className="inline-flex min-h-10 w-52 max-w-[48vw] shrink-0 items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 text-xs font-black text-slate-600 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200">
                        <span className="shrink-0 text-slate-500 dark:text-slate-400">Scope</span>
                        <select
                          className="min-w-0 flex-1 truncate rounded-lg bg-white px-1.5 py-1 text-xs font-black text-slate-800 outline-none dark:bg-slate-950 dark:text-slate-100"
                          disabled={prReviewLoading}
                          onChange={(event) => {
                            setSelectedPrNumber(event.target.value);
                            setPrReview(null);
                            setPrReviewError(null);
                          }}
                          value={selectedPrNumber}
                        >
                          <option className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100" value="all">All open PRs</option>
                          {pullRequestChurn.map((pullRequest) => (
                            <option className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100" key={pullRequest.number} value={pullRequest.number}>
                              {compactPrScopeLabel(pullRequest)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <button
                      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-primary-500/30 bg-primary-500/10 px-4 text-sm font-black text-primary-700 transition hover:bg-primary-500/20 disabled:pointer-events-none disabled:opacity-60 dark:text-primary-100"
                      disabled={prReviewLoading}
                      onClick={handlePrReview}
                      type="button"
                    >
                      <Sparkles className="h-4 w-4" />
                      {prReviewLoading ? "Reviewing..." : prReview ? "Refresh AI PR Review" : "AI PR Review"}
                    </button>
                  </div>
                </div>

                <p className="m-0 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {codeReviewSummary}
                </p>

                <div className="mt-4 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(7.75rem,1fr))]">
                  {[
                    ["Issues", reviewIssues],
                    ["PR comments", reviewComments],
                    ["Reviews", reviewSubmissions],
                    ["Conversation", reviewConversationComments],
                    ["PR churn", `${pullRequestChurnLines} lines`]
                  ].map(([label, value]) => (
                    <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]" key={label}>
                      <span className="block break-words text-[0.68rem] font-black uppercase leading-4 text-slate-500 dark:text-slate-400">{label}</span>
                      <strong className="mt-1 block break-words text-sm leading-5 text-slate-950 dark:text-white">{value}</strong>
                    </div>
                  ))}
                </div>

                {pullRequestChurn.length ? (
                  <div className="mt-3 grid gap-2">
                    {pullRequestChurn.slice(0, 3).map((pullRequest) => (
                      <a
                        className="grid gap-1 rounded-xl border border-slate-200/80 bg-white/75 px-4 py-3 text-sm transition hover:border-primary-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-primary-300/30"
                        href={pullRequest.url}
                        key={pullRequest.number}
                        rel="noopener noreferrer"
                        target={pullRequest.url ? "_blank" : undefined}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <strong className="min-w-0 truncate text-slate-950 dark:text-white">
                            PR #{pullRequest.number}: {pullRequest.title}
                          </strong>
                          <span className="shrink-0 font-black text-slate-600 dark:text-slate-300">
                            {pullRequest.churnLines} lines
                          </span>
                        </span>
                        <small className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {pullRequest.commits} commit{pullRequest.commits === 1 ? "" : "s"} / +{pullRequest.additions} / -{pullRequest.deletions}
                        </small>
                      </a>
                    ))}
                  </div>
                ) : null}

                {prReviewError ? (
                  <p className="m-0 mt-3 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-xs font-bold text-danger-700 dark:border-danger-400/20 dark:bg-danger-500/10 dark:text-danger-100">
                    {prReviewError}
                  </p>
                ) : null}
                {prReviewLoading && !prReview ? (
                  <p className="m-0 mt-3 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-xs font-bold text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                    Reading open pull requests and running AI analysis...
                  </p>
                ) : null}
                {prReview ? (
                  <div className="mt-4 rounded-xl border border-ai-200 bg-ai-50/70 p-4 dark:border-ai-400/20 dark:bg-ai-500/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-xs font-black uppercase text-ai-700 dark:text-ai-100">AI PR review</strong>
                      <span className="text-xs font-black text-ai-700 dark:text-ai-100">
                        {prReview.totals.issues} issue{prReview.totals.issues === 1 ? "" : "s"} / {prReview.totals.highRiskIssues} high risk
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        ["PRs", prReview.totals.pullRequests],
                        ["Issues", prReview.totals.issues],
                        ["High Severity", prReview.totals.highRiskIssues],
                        ["Comments", prReview.totals.suggestedComments]
                      ].map(([label, value]) => (
                        <span
                          className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-white/70 bg-white/75 px-2.5 text-xs font-black text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                          key={label}
                        >
                          <span className="uppercase text-slate-500 dark:text-slate-400">{label}</span>
                          <strong className="text-slate-950 dark:text-white">{value}</strong>
                        </span>
                      ))}
                    </div>
                    {prReview.warnings?.length ? (
                      <div className="mt-3 grid gap-1.5 rounded-lg border border-warning-500/20 bg-warning-500/10 px-3 py-2 text-xs font-bold leading-5 text-warning-800 dark:text-warning-100">
                        {prReview.warnings.slice(0, 3).map((warning) => (
                          <span key={warning}>{warning}</span>
                        ))}
                      </div>
                    ) : null}
                    {prReview.pullRequests.length ? (
                      <div className="mt-3 grid gap-2">
                        {prReview.pullRequests.slice(0, 3).map((pullRequest) => (
                          <div className="rounded-lg border border-white/70 bg-white/75 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]" key={pullRequest.number}>
                            <div className="flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                <strong className="block truncate text-sm text-slate-950 dark:text-white">
                                  PR #{pullRequest.number}: {pullRequest.title}
                                </strong>
                                <small className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                  {pullRequest.issueCount} issue{pullRequest.issueCount === 1 ? "" : "s"} / {pullRequest.churnLines} churn lines
                                </small>
                                <p className="m-0 mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{pullRequest.summary}</p>
                              </span>
                              <Badge className={cn("shrink-0", riskAccentClass(pullRequest.riskLevel), riskTextClass(pullRequest.riskLevel))} variant="outline">
                                {pullRequest.riskLevel}
                              </Badge>
                            </div>
                          </div>
                        ))}
                        {prReview.pullRequests.flatMap((pullRequest) =>
                          pullRequest.findings.map((finding) => ({
                            ...finding,
                            pullRequestNumber: pullRequest.number
                          }))
                        ).sort((left, right) => severityRank(right.severity) - severityRank(left.severity)).slice(0, 3).map((finding) => (
                          <div className={cn("rounded-lg border px-3 py-2", riskAccentClass(finding.severity))} key={finding.id}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <strong className="min-w-0 text-sm text-slate-950 dark:text-white">
                                PR #{finding.pullRequestNumber}: {finding.title}
                              </strong>
                              <span className={cn("rounded-full border px-2 py-0.5 text-[0.64rem] font-black uppercase", riskTextClass(finding.severity))}>
                                {finding.severity}
                              </span>
                            </div>
                            {finding.file ? (
                              <code className="mt-1 block truncate text-[0.68rem] font-bold text-slate-500 dark:text-slate-400">
                                {finding.file}
                                {finding.line ? `:${finding.line}` : ""}
                              </code>
                            ) : null}
                            <p className="m-0 mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{finding.message}</p>
                            <p className="m-0 mt-2 text-xs font-bold text-warning-800 dark:text-warning-100">
                              Suggested: {finding.suggestedComment}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="m-0 mt-2 text-sm text-slate-600 dark:text-slate-300">No open PRs are mapped to this member.</p>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-2">
                {recentCommits.slice(0, 4).map((commit) => (
                  <div className="grid grid-cols-[82px_minmax(0,1fr)_64px] items-center gap-3 rounded-xl bg-slate-950/[0.035] px-3 py-2 dark:bg-white/[0.045]" key={commit.id}>
                    <strong className="font-mono text-xs text-slate-950 dark:text-white">{commit.sha.slice(0, 7)}</strong>
                    <span className="truncate text-sm text-slate-600 dark:text-slate-300">{commit.message}</span>
                    <small className="text-right text-xs font-black text-slate-500 dark:text-slate-400">{formatDate(commit.committedAt)}</small>
                  </div>
                ))}
                {!recentCommits.length ? <p className="m-0 text-sm text-slate-500 dark:text-slate-400">Commit preview appears after Git sync.</p> : null}
              </div>
            </div>
          </div>
        </SectionPanel>
      </section>

      {history?.recommendations.length ? (
        <SectionPanel>
          <PanelHeader eyebrow="Actions" title="Next best moves" icon={Sparkles} tone="ai" />
          <div className="grid auto-rows-fr gap-3 md:grid-cols-2">
            {history.recommendations.map((recommendation) => (
              <article className={cn("rounded-2xl border p-4", riskAccentClass(recommendation.severity))} key={recommendation.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="block text-sm font-black text-slate-950 dark:text-white">{recommendation.title}</strong>
                    <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{recommendation.kind}</span>
                  </div>
                  <span className={cn("rounded-full border px-2.5 py-1 text-xs font-black", riskTextClass(recommendation.severity))}>
                    {recommendation.severity}
                  </span>
                </div>
                <p className="m-0 mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{recommendation.message}</p>
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}

      {(member.git.pullRequestsOpen || prReview || prReviewError) && projectId ? (
        <SectionPanel className="hidden">
          <div className="flex items-start justify-between gap-4">
            <PanelHeader
              eyebrow="AI code review"
              title="Pull request analysis"
              description="AI-generated findings for each open PR, with actionable suggested comments."
              icon={GitPullRequest}
              tone="ai"
            />
            {pullRequestChurn.length > 1 ? (
              <label className="mt-1 inline-flex min-h-10 shrink-0 items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/70 px-3 text-xs font-black text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-200">
                <span className="text-slate-500 dark:text-slate-400">Scope</span>
                <select
                  className="max-w-52 rounded-lg bg-white px-1.5 py-1 text-xs font-black text-slate-800 outline-none dark:bg-slate-950 dark:text-slate-100"
                  disabled={prReviewLoading}
                  onChange={(event) => {
                    setSelectedPrNumber(event.target.value);
                    setPrReview(null);
                    setPrReviewError(null);
                  }}
                  value={selectedPrNumber}
                >
                  <option className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100" value="all">All open PRs</option>
                  {pullRequestChurn.map((pullRequest) => (
                    <option className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100" key={pullRequest.number} value={pullRequest.number}>
                      {compactPrScopeLabel(pullRequest)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {!prReview ? (
              <button
                type="button"
                disabled={prReviewLoading}
                onClick={handlePrReview}
                className="mt-1 inline-flex shrink-0 items-center gap-2 rounded-2xl border border-primary-500/30 bg-primary-500/10 px-4 py-2.5 text-sm font-black text-primary-700 transition hover:bg-primary-500/20 disabled:opacity-60 dark:text-primary-200"
              >
                <RefreshCw className={cn("h-4 w-4", prReviewLoading && "animate-spin")} />
                {prReviewLoading ? "Reviewing..." : "Run AI review"}
              </button>
            ) : (
              <button
                type="button"
                disabled={prReviewLoading}
                onClick={handlePrReview}
                className="mt-1 inline-flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-white disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300"
              >
                <RefreshCw className={cn("h-4 w-4", prReviewLoading && "animate-spin")} />
                Refresh
              </button>
            )}
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={codeReviewTone(codeReviewState)}>
                {codeReviewState === "needs-fixes" ? "Needs fixes" : codeReviewState === "watch" ? "Watch" : "Clean"}
              </StatusPill>
              <span className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                {codeReviewSummary}
                {reviewWaitDays ? ` Oldest PR has waited about ${reviewWaitDays}d.` : ""}
              </span>
            </div>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(7.75rem,1fr))]">
              {[
                ["Issues", reviewIssues],
                ["PR comments", reviewComments],
                ["Reviews", reviewSubmissions],
                ["Conversation", reviewConversationComments],
                ["PR churn", `${pullRequestChurnLines} lines`]
              ].map(([label, value]) => (
                <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]" key={label}>
                  <span className="block break-words text-[0.68rem] font-black uppercase leading-4 text-slate-500 dark:text-slate-400">{label}</span>
                  <strong className="mt-1 block break-words text-sm leading-5 text-slate-950 dark:text-white">{value}</strong>
                </div>
              ))}
            </div>
          </div>

          {prReviewError ? (
            <div className="rounded-2xl border border-warning-500/30 bg-warning-500/10 p-4 text-sm font-semibold text-warning-700 dark:text-warning-100">
              {prReviewError}
            </div>
          ) : prReviewLoading && !prReview ? (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300">
              Reading open pull requests and running AI analysis...
            </div>
          ) : prReview ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-3 text-sm">
                {[
                  ["PRs reviewed", prReview.totals.pullRequests],
                  ["Issues found", prReview.totals.issues],
                  ["High risk", prReview.totals.highRiskIssues],
                  ["Suggested comments", prReview.totals.suggestedComments]
                ].map(([label, value]) => (
                  <span key={String(label)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/70 px-3.5 py-2 text-sm font-black text-slate-700 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-200">
                    {label}: <strong>{value}</strong>
                  </span>
                ))}
              </div>
              {prReview.pullRequests.map((pr) => (
                <article className={cn("rounded-2xl border p-4", riskAccentClass(pr.riskLevel))} key={pr.number}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-black text-slate-950 dark:text-white">
                          {pr.url ? (
                            <a href={pr.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              #{pr.number} {pr.title}
                            </a>
                          ) : (
                            `#${pr.number} ${pr.title}`
                          )}
                        </strong>
                        <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-black", riskTextClass(pr.riskLevel))}>
                          {pr.riskLevel}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {pr.commits} commits · {pr.filesChanged} files · +{pr.additions} / -{pr.deletions}
                        {pr.author ? ` · ${pr.author}` : ""}
                      </span>
                    </div>
                  </div>
                  <p className="m-0 mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{pr.summary}</p>
                  {pr.findings.length ? (
                    <div className="mt-3 grid gap-2">
                      {[...pr.findings].sort((left, right) => severityRank(right.severity) - severityRank(left.severity)).map((finding) => (
                        <div className="rounded-xl border border-slate-200/80 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.04]" key={finding.id}>
                          <div className="flex items-center gap-2">
                            <span className={cn("text-xs font-black uppercase", riskTextClass(finding.severity))}>{finding.severity}</span>
                            <strong className="text-sm font-black text-slate-950 dark:text-white">{finding.title}</strong>
                            {finding.file ? <code className="ml-auto shrink-0 text-xs text-slate-500 dark:text-slate-400">{finding.file}{finding.line ? `:${finding.line}` : ""}</code> : null}
                          </div>
                          <p className="m-0 mt-1.5 text-sm leading-5 text-slate-600 dark:text-slate-300">{finding.message}</p>
                          {finding.suggestedComment ? (
                            <p className="m-0 mt-2 rounded-lg bg-slate-950/[0.035] px-3 py-2 text-xs font-mono text-slate-700 dark:bg-white/[0.04] dark:text-slate-300">{finding.suggestedComment}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300">
              {member.git.pullRequestsOpen
                ? `${member.git.pullRequestsOpen} open PR${member.git.pullRequestsOpen === 1 ? "" : "s"} detected. Run AI review to see findings.`
                : "No open PRs to review for this sprint."}
            </div>
          )}
        </SectionPanel>
      ) : null}

      <SectionPanel>
        <PanelHeader
          eyebrow="Profile timeline"
          title="Everything visible about this sprint"
          description="Standup history, risk detections, Jira movement, Git commits, and action notes in one chronological trail."
          icon={CalendarDays}
        />
        <div className="relative grid gap-3">
          {profileTimeline.length ? (
            profileTimeline.map((entry) => {
              const EntryIcon = entry.icon;
              return (
                <article className="relative grid gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045] md:grid-cols-[48px_minmax(0,1fr)_130px]" key={entry.id}>
                  <span className={cn("relative z-10 grid h-10 w-10 place-items-center rounded-2xl border", timelineToneClass(entry.tone))}>
                    <EntryIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm font-black text-slate-950 dark:text-white">{entry.title}</strong>
                      <Badge variant="outline">{entry.meta}</Badge>
                    </div>
                    <p className="m-0 mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{compactText(entry.detail)}</p>
                  </div>
                  <time className="self-center text-sm font-black text-slate-500 dark:text-slate-400">{entry.dateLabel}</time>
                </article>
              );
            })
          ) : (
            <EmptyPanel icon={MessageSquareText} title="No timeline yet" description="Standups, tickets, commits, and action notes will appear here once this sprint has data." />
          )}
        </div>
      </SectionPanel>
    </div>
  );
}
