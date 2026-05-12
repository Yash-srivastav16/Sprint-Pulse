import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  GitCommitHorizontal,
  GitPullRequest,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  TicketCheck
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { MemberPulse, MemberPulseHistoryResponse, RiskLevel } from "@sprintpulse/shared";
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

function riskTextClass(level: RiskLevel) {
  if (level === "critical" || level === "high") {
    return "text-danger-700 dark:text-danger-100";
  }
  if (level === "medium") {
    return "text-warning-700 dark:text-warning-100";
  }
  return "text-emerald-700 dark:text-emerald-100";
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

  useEffect(() => {
    if (!memberId) {
      return;
    }

    if (projectId && !persona) {
      return;
    }

    setLoading(true);
    setError(null);

    const request = projectId && persona
      ? api.getProjectMemberHistory(projectId, memberId, persona.id, selectedSprintId ?? undefined)
      : api.getMember(memberId);
    request
      .then((response) => {
        setMember(response.member);
        setHistory(isHistoryResponse(response) ? response : null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [memberId, persona, projectId, selectedSprintId]);

  if (loading) {
    return <WorkspaceLoading label="Loading member pulse" />;
  }

  if (error || !member) {
    return <WorkspaceError label={error ?? "Member unavailable"} />;
  }

  const activeIssues = history?.issues.length ?? member.tickets.length;
  const standupCount = history?.standups.length ?? member.standups.length;
  const commits = history?.commits ?? [];
  const tickets = history?.issues.length
    ? history.issues.map((issue) => ({
        key: issue.issueKey,
        title: issue.summary,
        status: issue.status,
        daysIdle: issue.daysIdle
      }))
    : member.tickets;
  const standups = history?.standups.length ? history.standups : member.standups;
  const blockerCount = standups.filter((standup) => hasBlocker(standup.blockers)).length;
  const staleTicketCount = tickets.filter((ticket) => ticket.daysIdle >= 3 && ticket.status !== "Done").length;
  const riskPressure = Math.max(0, 100 - member.healthScore);
  const proofCards = [
    {
      label: "Jira movement",
      value: activeIssues,
      detail: `${staleTicketCount} idle issue${staleTicketCount === 1 ? "" : "s"}`,
      icon: TicketCheck,
      tone: staleTicketCount ? ("warning" as const) : ("info" as const)
    },
    {
      label: "Git proof",
      value: member.git.commitsThisSprint,
      detail: `${member.git.pullRequestsOpen} open PR${member.git.pullRequestsOpen === 1 ? "" : "s"}`,
      icon: GitCommitHorizontal,
      tone: "ai" as const
    },
    {
      label: "Standups",
      value: standupCount,
      detail: `${blockerCount} blocker mention${blockerCount === 1 ? "" : "s"}`,
      icon: MessageSquareText,
      tone: blockerCount ? ("danger" as const) : ("primary" as const)
    },
    {
      label: "Risk pressure",
      value: riskPressure,
      detail: `${member.flags.length} active flag${member.flags.length === 1 ? "" : "s"}`,
      icon: ShieldAlert,
      tone: riskTone(member.riskLevel)
    }
  ];
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
    ...standups.map((standup) => ({
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
    ...tickets.slice(0, 8).map((ticket) => ({
      id: `jira-${ticket.key}`,
      title: `${ticket.key} · ${ticket.status}`,
      detail: ticket.title,
      meta: `${ticket.daysIdle}d idle`,
      dateLabel: ticket.daysIdle ? `${ticket.daysIdle}d idle` : "Jira",
      sortValue: Date.now() - ticket.daysIdle * 24 * 60 * 60 * 1000,
      tone: "jira" as const,
      icon: TicketCheck
    })),
    ...commits.slice(0, 8).map((commit) => ({
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

      <WorkspaceHero
        eyebrow={
          <>
            <StatusPill tone="primary">
              {member.title}
            </StatusPill>
            <StatusPill tone={riskTone(member.riskLevel)}>
              {member.riskLevel} risk
            </StatusPill>
          </>
        }
        title={member.name}
        description={member.currentFocus}
        score={member.healthScore}
        scoreLabel="Health score"
        scoreTone={riskTone(member.riskLevel)}
        scoreDetail={member.recommendation}
        action={<MemberAvatar initials={member.initials} size="lg" />}
        pills={
          <>
            <StatusPill icon={TicketCheck} tone="neutral">
              {activeIssues} issues
            </StatusPill>
            <StatusPill icon={GitCommitHorizontal} tone="neutral">
              {member.git.commitsThisSprint} commits
            </StatusPill>
            <StatusPill icon={MessageSquareText} tone="neutral">
              {standupCount} standups
            </StatusPill>
          </>
        }
      />

      <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <SectionPanel>
          <PanelHeader
            eyebrow="Investigation"
            title="Why this score moved"
            description="A concise flag board for the conversation a Scrum Master needs to have."
            icon={ShieldAlert}
            tone={riskTone(member.riskLevel)}
          />
          <div className="grid gap-3">
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
            title="Standup, Jira, and Git evidence"
            description="This is the say-do gap view from the hackathon plan."
            icon={Activity}
            tone="ai"
          />
          <div className="grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-4">
            {proofCards.map((card) => {
              const CardIcon = card.icon;
              return (
                <article className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]" key={card.label}>
                  <StatusPill icon={CardIcon} tone={card.tone}>
                    {card.label}
                  </StatusPill>
                  <strong className="mt-4 block text-3xl font-black text-slate-950 dark:text-white">{card.value}</strong>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{card.detail}</span>
                </article>
              );
            })}
          </div>

          <div className="mt-5 grid items-stretch gap-3 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.045]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <strong className="text-sm font-black text-slate-950 dark:text-white">Jira work</strong>
                <Badge variant="outline">{tickets.length} visible</Badge>
              </div>
              <div className="grid gap-2">
                {tickets.slice(0, 4).map((ticket) => (
                  <div className="grid grid-cols-[80px_minmax(0,1fr)_72px] items-center gap-3 rounded-xl bg-slate-950/[0.035] px-3 py-2 dark:bg-white/[0.045]" key={ticket.key}>
                    <strong className="font-mono text-xs text-slate-950 dark:text-white">{ticket.key}</strong>
                    <span className="truncate text-sm text-slate-600 dark:text-slate-300">{ticket.title}</span>
                    <small className="text-right text-xs font-black text-slate-500 dark:text-slate-400">{ticket.daysIdle}d</small>
                  </div>
                ))}
                {!tickets.length ? <p className="m-0 text-sm text-slate-500 dark:text-slate-400">No Jira issues mapped yet.</p> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.045]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <strong className="text-sm font-black text-slate-950 dark:text-white">Git movement</strong>
                <Badge variant="outline">{commits.length || member.git.commitsThisSprint} commits</Badge>
              </div>
              <div className="grid gap-2">
                {commits.slice(0, 4).map((commit) => (
                  <div className="grid grid-cols-[82px_minmax(0,1fr)_64px] items-center gap-3 rounded-xl bg-slate-950/[0.035] px-3 py-2 dark:bg-white/[0.045]" key={commit.id}>
                    <strong className="font-mono text-xs text-slate-950 dark:text-white">{commit.sha.slice(0, 7)}</strong>
                    <span className="truncate text-sm text-slate-600 dark:text-slate-300">{commit.message}</span>
                    <small className="text-right text-xs font-black text-slate-500 dark:text-slate-400">{formatDate(commit.committedAt)}</small>
                  </div>
                ))}
                {!commits.length ? <p className="m-0 text-sm text-slate-500 dark:text-slate-400">Commit preview appears after Git sync.</p> : null}
              </div>
            </div>
          </div>
        </SectionPanel>
      </section>

      {history?.recommendations.length ? (
        <SectionPanel>
          <PanelHeader eyebrow="Recommendations" title="Next best moves" icon={Sparkles} tone="ai" />
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

      <SectionPanel>
        <PanelHeader
          eyebrow="Profile timeline"
          title="Everything visible about this sprint"
          description="Standup history, risk detections, Jira movement, Git commits, and recommendations in one chronological trail."
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
            <EmptyPanel icon={MessageSquareText} title="No timeline yet" description="Standups, tickets, commits, and recommendations will appear here once this sprint has data." />
          )}
        </div>
      </SectionPanel>
    </div>
  );
}
