import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GitPullRequest,
  MessageSquareText,
  Sparkles,
  Target,
  UsersRound
} from "lucide-react";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import type { DashboardResponse, MemberPulse, ProjectDashboardResponse } from "@sprintpulse/shared";
import { api } from "../api";
import { HealthGauge } from "../components/charts/HealthGauge";
import { HeatMap } from "../components/charts/HeatMap";
import { TrendChart } from "../components/charts/TrendChart";
import { ActivityFeed } from "../components/dashboard/ActivityFeed";
import { MetricCard } from "../components/dashboard/MetricCard";
import { RecommendationsPanel } from "../components/dashboard/RecommendationsPanel";
import { RiskFlagsList } from "../components/dashboard/RiskFlagsList";
import { TeamPulseGrid } from "../components/dashboard/TeamPulseGrid";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { DashboardSkeleton } from "../components/ui/loading-skeleton";
import { LiveIndicator } from "../components/ui/live-indicator";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";

const roleLabels: Record<MemberPulse["hackathonRole"], string> = {
  frontend: "Frontend",
  backend: "Backend",
  architect: "Architecture",
  qa: "Quality"
};

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

function compactTitle(text: string) {
  return text.length > 68 ? `${text.slice(0, 65)}...` : text;
}

function riskPriority(text: string): "high" | "medium" | "low" {
  const normalized = text.toLowerCase();
  if (normalized.includes("blocker") || normalized.includes("critical") || normalized.includes("risk")) {
    return "high";
  }

  if (normalized.includes("review") || normalized.includes("sync") || normalized.includes("focus")) {
    return "medium";
  }

  return "low";
}

function timestampValue(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
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

  const sortedTeam = useMemo(
    () => [...(dashboard?.teamPreview ?? [])].sort((a, b) => a.score - b.score),
    [dashboard]
  );

  const activeFlags = useMemo(
    () => dashboard?.memberPulses.flatMap((pulse) => pulse.flags.map((flag) => ({ flag, pulse }))) ?? [],
    [dashboard]
  );

  const latestActivities = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    const events = dashboard.memberPulses.flatMap((pulse) => {
      const standups = pulse.standups.slice(0, 2).map((standup) => ({
        id: `standup-${standup.id}`,
        type: "standup" as const,
        user: pulse.name,
        action: standup.blockers
          ? "shared a standup with blockers to clear"
          : `shared progress on ${compactTitle(standup.today)}`,
        timestamp: toRelativeTime(standup.date),
        rawDate: standup.date
      }));

      const flags = pulse.flags.slice(0, 2).map((flag) => ({
        id: `flag-${pulse.id}-${flag.id}`,
        type: "risk" as const,
        user: pulse.name,
        action: `needs attention: ${flag.title}`,
        timestamp: "Current sprint",
        rawDate: ""
      }));

      const git = pulse.git.lastCommitAt
        ? [
            {
              id: `git-${pulse.id}`,
              type: "commit" as const,
              user: pulse.name,
              action: `${pulse.git.commitsThisSprint} commits this sprint`,
              timestamp: toRelativeTime(pulse.git.lastCommitAt),
              rawDate: pulse.git.lastCommitAt
            }
          ]
        : [];

      return [...standups, ...flags, ...git];
    });

    return events
      .sort((a, b) => timestampValue(b.rawDate) - timestampValue(a.rawDate))
      .slice(0, 7);
  }, [dashboard]);

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
  const criticalFlags = activeFlags.filter(({ flag }) => flag.severity === "critical").length;
  const totalCommits = dashboard.memberPulses.reduce((sum, pulse) => sum + pulse.git.commitsThisSprint, 0);
  const totalOpenPrs = dashboard.memberPulses.reduce((sum, pulse) => sum + pulse.git.pullRequestsOpen, 0);
  const totalStandups = dashboard.memberPulses.reduce((sum, pulse) => sum + pulse.standups.length, 0);
  const scoreData = sortedTeam.length
    ? sortedTeam.map((member) => ({ date: member.initials, value: member.score, label: member.name }))
    : [{ date: "Team", value: summary.teamHealthScore, label: "Team health" }];
  const participationHeat = dashboard.memberPulses.map((pulse) => ({
    day: pulse.initials,
    value: pulse.standups.length + pulse.tickets.length + pulse.git.commitsThisSprint,
    label: `${pulse.name}: ${pulse.standups.length} standups, ${pulse.tickets.length} tickets, ${pulse.git.commitsThisSprint} commits`
  }));
  const recommendationCards = dashboard.recommendations.map((recommendation, index) => ({
    id: `recommendation-${index}`,
    title: compactTitle(recommendation),
    description: recommendation,
    priority: riskPriority(recommendation),
    actionLabel: index === 0 ? "Review first" : undefined
  }));
  const riskFlagCards = activeFlags.map(({ flag, pulse }) => ({
    id: `${pulse.id}-${flag.id}`,
    title: flag.title,
    member: pulse.name,
    timestamp: "Current sprint",
    riskLevel: flag.severity,
    description: flag.message
  }));
  const teamCards = sortedTeam.map((member) => ({
    id: member.id,
    name: member.name,
    initials: member.initials,
    healthScore: member.score,
    riskLevel: member.riskLevel,
    status: `${roleLabels[member.role]} - ${member.riskLevel} risk`
  }));
  const healthTrend =
    summary.teamHealthScore >= summary.readinessScore ? "up" : summary.readinessScore >= 70 ? "neutral" : "down";
  const scoreState = summary.teamHealthScore >= 80 ? "Healthy" : summary.teamHealthScore >= 60 ? "Watch" : "At risk";
  const primaryRecommendation =
    dashboard.recommendations[0] ??
    viewerPulse.recommendation ??
    "Review the active sprint signals and clear the highest-risk blocker first.";
  const fallbackSignals = [
    {
      id: "standup-signal",
      label: "Standup",
      title: `${summary.openBlockers} blocker${summary.openBlockers === 1 ? "" : "s"} open`,
      detail: "Blocker language feeds the risk score.",
      icon: MessageSquareText,
      tone: "teal"
    },
    {
      id: "readiness-signal",
      label: "Readiness",
      title: `${summary.readinessScore}% sprint readiness`,
      detail: "Readiness compares team health with sprint delivery movement.",
      icon: Target,
      tone: "amber"
    },
    {
      id: "delivery-signal",
      label: "Delivery",
      title: `${totalOpenPrs} PR${totalOpenPrs === 1 ? "" : "s"} waiting`,
      detail: "Git movement keeps the dashboard tied to real work.",
      icon: GitPullRequest,
      tone: "blue"
    }
  ] as const;
  const dashboardSignals = activeFlags.length
    ? activeFlags.slice(0, 3).map(({ flag, pulse }) => ({
        id: `${pulse.id}-${flag.id}`,
        label: pulse.name,
        title: flag.title,
        detail: flag.message,
        icon: flag.severity === "critical" || flag.severity === "high" ? AlertTriangle : Activity,
        tone: flag.severity === "critical" || flag.severity === "high" ? "rose" : "amber"
      }))
    : fallbackSignals;
  const focusTeamCards = teamCards.slice(0, 3);

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-lg border border-slate-700/60 bg-slate-950 p-5 text-white shadow-elevated sm:p-6"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(21,154,140,0.18),transparent_26%),radial-gradient(circle_at_90%_8%,rgba(61,112,184,0.16),transparent_28%)]" />
        <div className="absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(520px,1.08fr)] xl:items-stretch">
          <div className="flex min-w-0 flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-primary-400/40 bg-primary-400/10 text-primary-100 hover:bg-primary-400/10">
                  {project ? project.key : dashboard.scope}
                </Badge>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                  <LiveIndicator status={highSignalCount ? "idle" : "online"} />
                  {highSignalCount ? `${highSignalCount} signals active` : "Sprint signals steady"}
                </span>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-200">Sprint command center</p>
                <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-5xl">
                  {project ? project.name : summary.sprintName}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                  The dashboard starts with the decision: health is {summary.teamHealthScore}, readiness is{" "}
                  {summary.readinessScore}%, and the next action is pulled from standups, Jira, and Git signals.
                </p>
              </div>
            </div>

            <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
              <span className="inline-flex min-h-12 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                <UsersRound className="h-4 w-4 text-primary-200" />
                {dashboard.scope} visibility
              </span>
              <span className="inline-flex min-h-12 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                <CalendarDays className="h-4 w-4 text-primary-200" />
                {summary.sprintWindow}
              </span>
              <span className="inline-flex min-h-12 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                <GitPullRequest className="h-4 w-4 text-primary-200" />
                {totalOpenPrs} open PRs
              </span>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.06] p-4 shadow-glass backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
                Live project dashboard
              </span>
              <span className="ml-auto rounded-full bg-primary-400/15 px-3 py-1 text-xs font-bold text-primary-100">
                {scoreState}
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
              <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                <HealthGauge value={summary.teamHealthScore} label="team health" size="md" />
                <p className="mt-1 text-center text-xs font-semibold text-slate-400">
                  {summary.atRiskCount} member{summary.atRiskCount === 1 ? "" : "s"} need attention
                </p>
              </div>

              <div className="grid gap-3">
                <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                        Why the score is {summary.teamHealthScore}
                      </p>
                      <h2 className="mt-2 text-xl font-black">Signals are already grouped into causes.</h2>
                    </div>
                    <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-100 hover:bg-amber-400/10">
                      {summary.openBlockers} blockers
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {summary.sprintName} has {totalStandups} standup updates, {totalCommits} commits, and{" "}
                    {dashboardSignals.length} visible score drivers.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {dashboardSignals.map((signal) => {
                    const SignalIcon = signal.icon;
                    const toneClass =
                      signal.tone === "rose"
                        ? "border-rose-400/25 bg-rose-400/10 text-rose-100"
                        : signal.tone === "amber"
                          ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
                          : signal.tone === "blue"
                            ? "border-blue-400/25 bg-blue-400/10 text-blue-100"
                            : "border-primary-400/25 bg-primary-400/10 text-primary-100";

                    return (
                      <article key={signal.id} className={`rounded-lg border p-3 ${toneClass}`}>
                        <SignalIcon className="h-4 w-4" />
                        <p className="mt-3 text-[0.68rem] font-black uppercase tracking-[0.12em] opacity-75">
                          {signal.label}
                        </p>
                        <h3 className="mt-1 text-sm font-black leading-5">{compactTitle(signal.title)}</h3>
                        <p className="mt-2 text-xs font-medium leading-5 opacity-75">{compactTitle(signal.detail)}</p>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-100">Recommended action</p>
                <h2 className="mt-2 text-lg font-black">{compactTitle(primaryRecommendation)}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Start here in standup, then use the member view for ticket and commit history.
                </p>
              </div>

              <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Team pulse</p>
                  <span className="text-xs font-bold text-slate-300">Lowest first</span>
                </div>
                <div className="grid gap-2">
                  {focusTeamCards.length ? (
                    focusTeamCards.map((member) => (
                      <span
                        key={member.id}
                        className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-white/10 bg-white/5 p-2"
                      >
                        <b className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xs">
                          {member.initials}
                        </b>
                        <span className="min-w-0">
                          <strong className="block truncate text-sm">{member.name}</strong>
                          <em className="block truncate text-xs not-italic text-slate-400">{member.status}</em>
                        </span>
                        <strong className="text-sm">{member.healthScore}</strong>
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Add members to see attention order.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Sprint readiness"
          value={summary.readinessScore}
          suffix="%"
          icon={Target}
          trend={healthTrend}
          trendValue={`${summary.teamHealthScore}% health baseline`}
          sparklineData={scoreData.map((point) => ({ value: point.value }))}
          color="#159a8c"
        />
        <MetricCard
          title="At-risk members"
          value={summary.atRiskCount}
          icon={AlertTriangle}
          trend={summary.atRiskCount > 0 ? "down" : "neutral"}
          trendValue={`${criticalFlags} critical flags`}
          color="#e4614f"
        />
        <MetricCard
          title="Standup signals"
          value={totalStandups}
          icon={MessageSquareText}
          trend="up"
          trendValue={`${summary.openBlockers} blockers open`}
          color="#3d70b8"
        />
        <MetricCard
          title="Delivery activity"
          value={totalCommits}
          icon={Activity}
          trend={totalCommits > 0 ? "up" : "neutral"}
          trendValue={`${totalOpenPrs} PRs open`}
          color="#7254b8"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <div className="space-y-6">
          <Card className="glass">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Team Pulse</CardTitle>
                <CardDescription>Lowest health scores appear first so the next conversation is obvious.</CardDescription>
              </div>
              <Badge variant="outline">{teamCards.length} members</Badge>
            </CardHeader>
            <CardContent>
              {teamCards.length ? (
                <TeamPulseGrid
                  members={teamCards}
                  getMemberHref={(member) =>
                    project ? `/projects/${project.id}/members/${member.id}` : `/members/${member.id}`
                  }
                />
              ) : (
                <EmptyState
                  icon={UsersRound}
                  title="No team signals yet"
                  description="Add project members and standups to populate this view."
                />
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Score Distribution</CardTitle>
              <CardDescription>Current visible member scores from the SprintPulse project tables.</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart data={scoreData} height={260} color="#159a8c" />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="glass border-primary-500/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-ai-500" />
                <CardTitle>Your Pulse</CardTitle>
              </div>
              <CardDescription>{viewerPulse.title}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <HealthGauge value={viewerPulse.healthScore} label="personal" size="sm" />
                <div className="min-w-0 space-y-2">
                  <h2 className="text-xl font-bold">{viewerPulse.name}</h2>
                  <p className="text-sm text-muted-foreground">{viewerPulse.currentFocus}</p>
                </div>
              </div>
              <div className="rounded-lg border border-ai-500/20 bg-ai-500/10 p-4 text-sm">
                <div className="mb-2 flex items-center gap-2 font-semibold text-ai-500">
                  <CheckCircle2 className="h-4 w-4" />
                  Recommended action
                </div>
                <p>{viewerPulse.recommendation}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Activity Density</CardTitle>
              <CardDescription>Standups, tickets, and commits by visible member.</CardDescription>
            </CardHeader>
            <CardContent>
              {participationHeat.length ? (
                <HeatMap data={participationHeat} maxValue={Math.max(...participationHeat.map((cell) => cell.value), 1)} />
              ) : (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No activity density yet"
                  description="Standups and synced delivery signals will appear here."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(320px,0.8fr)]">
        <RiskFlagsList flags={riskFlagCards} />
        <RecommendationsPanel recommendations={recommendationCards} />
        <ActivityFeed activities={latestActivities} />
      </section>
    </div>
  );
}
