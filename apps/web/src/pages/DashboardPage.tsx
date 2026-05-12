import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GitPullRequest,
  Loader2,
  Target,
  UsersRound
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { DashboardResponse, MemberPulse, ProjectDashboardResponse } from "@sprintpulse/shared";
import { api } from "../api";
import { RiskBadge } from "../components/RiskBadge";
import { ScoreRing } from "../components/ScoreRing";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import "../styles/dashboard.css";

const roleLabels: Record<MemberPulse["hackathonRole"], string> = {
  frontend: "FE",
  backend: "BE",
  architect: "Architect",
  qa: "QA"
};

export function DashboardPage() {
  const { projectId } = useParams();
  const { persona } = useAuth();
  const { selectProject } = useProject();
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
        .getProjectDashboard(projectId, persona.id)
        .then((response) => {
          setDashboard(response);
          selectProject(response.project.id, {
            source: response.project.source === "manual" ? "manual" : "jira",
            projectName: response.project.name,
            projectKey: response.project.key,
            sprintName: response.project.sprint.name,
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
        setDashboard(response);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [persona, projectId, selectProject]);

  const sortedTeam = useMemo(
    () => [...(dashboard?.teamPreview ?? [])].sort((a, b) => a.score - b.score),
    [dashboard]
  );

  const activeFlags = useMemo(
    () => dashboard?.memberPulses.flatMap((pulse) => pulse.flags.map((flag) => ({ flag, pulse }))) ?? [],
    [dashboard]
  );

  if (loading) {
    return (
      <div className="center-state">
        <Loader2 className="spin" size={26} />
        <span>Loading sprint pulse</span>
      </div>
    );
  }

  if (error || !dashboard) {
    return <div className="center-state error-state">{error ?? "Dashboard unavailable"}</div>;
  }

  const { summary, viewerPulse } = dashboard;
  const project = "project" in dashboard ? dashboard.project : null;
  const criticalFlags = activeFlags.filter(({ flag }) => flag.severity === "critical").length;
  const highSignalCount = activeFlags.filter(
    ({ flag }) => flag.severity === "critical" || flag.severity === "high"
  ).length;
  const healthiestMember = [...sortedTeam].sort((a, b) => b.score - a.score)[0];
  const healthLabel = dashboard.scope === "individual" ? "visible health" : "team health";
  const teamPanelTitle = sortedTeam.length > 1 ? "Lowest scores first" : "Your visible pulse";
  const teamPanelHelp =
    sortedTeam.length > 1 ? "Click a teammate to inspect their pulse." : "This role can open its own detailed pulse.";

  return (
    <div className="dashboard-shell" data-scope={dashboard.scope}>
      <section className="dashboard-hero" aria-labelledby="dashboard-title">
        <div className="dashboard-hero-main">
          <div className="dashboard-title-block">
            <div className="dashboard-kicker">
              <span>{project ? project.key : summary.sprintWindow}</span>
              <span>{dashboard.viewer.title}</span>
            </div>
            <h1 id="dashboard-title">{summary.sprintName}</h1>
            <p>
              A focused sprint command view for health, delivery drift, risk signals, and the next actions that matter.
            </p>
          </div>

          <div className="dashboard-health-card" aria-label="Team health summary">
            <ScoreRing score={summary.teamHealthScore} label={healthLabel} />
            <div>
              <span>Readiness</span>
              <strong>{summary.readinessScore}%</strong>
              <small>{summary.atRiskCount} members need attention</small>
            </div>
          </div>
        </div>

        <div className="dashboard-context-bar" aria-label="Dashboard context">
          <span>
            <UsersRound size={15} />
            {dashboard.scope} visibility
          </span>
          <span>
            <Activity size={15} />
            {project ? project.name : `${dashboard.viewer.name}'s team view`}
          </span>
          <span>
            <AlertTriangle size={15} />
            {highSignalCount} high-priority signals
          </span>
        </div>
      </section>

      <section className="dashboard-metrics" aria-label="Sprint metrics">
        <div className="dashboard-metric dashboard-metric-ready">
          <span className="dashboard-metric-icon">
            <Target size={20} />
          </span>
          <span className="dashboard-metric-label">Sprint readiness</span>
          <strong>{summary.readinessScore}%</strong>
          <small>Delivery confidence</small>
        </div>
        <div className="dashboard-metric dashboard-metric-risk">
          <span className="dashboard-metric-icon">
            <AlertTriangle size={20} />
          </span>
          <span className="dashboard-metric-label">At-risk members</span>
          <strong>{summary.atRiskCount}</strong>
          <small>Ranked by lowest health first</small>
        </div>
        <div className="dashboard-metric dashboard-metric-flags">
          <span className="dashboard-metric-icon">
            <GitPullRequest size={20} />
          </span>
          <span className="dashboard-metric-label">Total risk flags</span>
          <strong>{summary.totalFlags}</strong>
          <small>{criticalFlags} critical signals</small>
        </div>
        <div className="dashboard-metric dashboard-metric-blockers">
          <span className="dashboard-metric-icon">
            <CalendarDays size={20} />
          </span>
          <span className="dashboard-metric-label">Open blockers</span>
          <strong>{summary.openBlockers}</strong>
          <small>Standup friction to resolve</small>
        </div>
      </section>

      <section className="dashboard-primary-grid">
        <article className="dashboard-panel dashboard-viewer-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-eyebrow">Your pulse</p>
              <h2>{viewerPulse.name}</h2>
              <span>{viewerPulse.title}</span>
            </div>
            <RiskBadge level={viewerPulse.riskLevel} />
          </div>

          <div className="dashboard-pulse-layout">
            <ScoreRing score={viewerPulse.healthScore} label="personal score" />
            <div className="dashboard-signal-stack">
              <p>{viewerPulse.currentFocus}</p>
              <div className="dashboard-signal-row">
                <span>Commits</span>
                <strong>{viewerPulse.git.commitsThisSprint}</strong>
              </div>
              <div className="dashboard-signal-row">
                <span>Open PRs</span>
                <strong>{viewerPulse.git.pullRequestsOpen}</strong>
              </div>
              <div className="dashboard-signal-row">
                <span>Code churn</span>
                <strong>{viewerPulse.git.codeChurn}</strong>
              </div>
            </div>
          </div>

          <div className="dashboard-callout">
            <CheckCircle2 size={18} />
            <span>{viewerPulse.recommendation}</span>
          </div>
        </article>

        <article className="dashboard-panel dashboard-team-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-eyebrow">Team risk order</p>
              <h2>{teamPanelTitle}</h2>
              <span>{teamPanelHelp}</span>
            </div>
          </div>
          <div className="dashboard-team-list">
            {sortedTeam.map((member) => (
              <Link
                className="dashboard-team-row"
                key={member.id}
                to={project ? `/projects/${project.id}/members/${member.id}` : `/members/${member.id}`}
              >
                <span className="dashboard-avatar">{member.initials}</span>
                <span className="dashboard-team-member">
                  <strong>{member.name}</strong>
                  <small>
                    {roleLabels[member.role]} <RiskBadge level={member.riskLevel} compact />
                  </small>
                </span>
                <span className="dashboard-score-track" aria-hidden="true">
                  <i style={{ width: `${member.score}%` }} />
                </span>
                <strong className="dashboard-team-score">{member.score}</strong>
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            ))}
          </div>
          {healthiestMember ? (
            <div className="dashboard-team-footer">
              <Activity size={17} />
              <span>
                {sortedTeam.length > 1
                  ? `${healthiestMember.name} is the strongest current health signal.`
                  : `${healthiestMember.name} is the visible health signal for this role.`}
              </span>
            </div>
          ) : null}
        </article>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="dashboard-panel dashboard-flags-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-eyebrow">Flags visible to this persona</p>
              <h2>Current signals</h2>
              <span>Risk explanations are grouped for fast scanning.</span>
            </div>
          </div>
          <div className="dashboard-flag-list">
            {activeFlags.length ? (
              activeFlags.map(({ flag, pulse }) => (
                <div className="dashboard-flag-item" key={flag.id}>
                  <div className="dashboard-flag-topline">
                    <span className="dashboard-flag-type">{flag.type.replaceAll("_", " ")}</span>
                    <RiskBadge level={flag.severity} compact />
                  </div>
                  <div>
                    <strong>{flag.title}</strong>
                    <span>{pulse.name}</span>
                  </div>
                  <p>{flag.message}</p>
                </div>
              ))
            ) : (
              <div className="dashboard-empty-state">
                <ClipboardCheck size={20} />
                <span>No active risk flags in this view.</span>
              </div>
            )}
          </div>
        </article>

        <article className="dashboard-panel dashboard-recommendations-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-eyebrow">Next best moves</p>
              <h2>Recommendations</h2>
              <span>Actions that raise sprint confidence.</span>
            </div>
          </div>
          <ol className="dashboard-recommendation-list">
            {dashboard.recommendations.map((recommendation) => (
              <li key={recommendation}>
                <span>
                  <CheckCircle2 size={17} />
                </span>
                <p>{recommendation}</p>
              </li>
            ))}
          </ol>
        </article>
      </section>
    </div>
  );
}
