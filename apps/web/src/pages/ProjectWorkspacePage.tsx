import { type CSSProperties, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Cloud,
  Gauge,
  GitBranch,
  Layers3,
  Loader2,
  MessageSquareText,
  PlugZap,
  RadioTower,
  RefreshCw,
  Sparkles,
  Target,
  UserRound,
  Users
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { Persona, ProjectOpsResponse } from "@sprintpulse/shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import "../styles/project-flow.css";

function workspaceCopy(persona: Persona | null) {
  switch (persona?.productPersona) {
    case "product-owner":
      return "Complete sprint detail: health, participation, risk, blockers, and the next delivery decision.";
    case "scrum-master":
      return "Delivery operations for keeping the sprint current, visible, and moving.";
    case "developer":
      return "Your standup, delivery pulse, assignments, and blockers for this sprint.";
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
    .map((part) => part[0].toUpperCase() + part.slice(1))
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

export function ProjectWorkspacePage() {
  const { projectId } = useParams();
  const { persona } = useAuth();
  const { selectProject } = useProject();
  const [workspace, setWorkspace] = useState<ProjectOpsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!persona || !projectId) {
      return;
    }

    api
      .getProjectOps(projectId, persona.id)
      .then((response) => {
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
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [persona, projectId, selectProject]);

  if (loading) {
    return (
      <div className="center-state">
        <Loader2 className="spin" size={26} />
        <span>Loading project workspace</span>
      </div>
    );
  }

  if (error || !workspace) {
    return <div className="center-state error-state">{error ?? "Project workspace unavailable"}</div>;
  }

  const { project, summary, integrations, currentSprint } = workspace;
  const canSyncStandups = workspace.permissions.includes("standup:sync");
  const canConfigure = workspace.permissions.includes("project:connect");
  const isProductOwner = persona?.productPersona === "product-owner";
  const isScrumMaster = persona?.productPersona === "scrum-master";
  const boundedHealthScore = Math.max(0, Math.min(100, summary.teamHealthScore));
  const scoreStyle = { "--score": `${boundedHealthScore}%` } as CSSProperties;
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

  return (
    <div className="page-stack project-flow-page workspace-flow">
      <section className="page-heading workspace-heading flow-hero workspace-hero">
        <div className="flow-hero-copy">
          <div className="flow-kicker-row">
            <p className="eyebrow">{project.key} workspace</p>
            <span className={`source-pill source-${project.source}`}>{sourceLabel(project.source)}</span>
          </div>
          <h1>{project.name}</h1>
          <p className="workspace-sprint-goal">{project.sprint.goal}</p>
          <p className="workspace-role-copy flow-hero-lede">{workspaceCopy(persona)}</p>
          <div className="flow-hero-pills workspace-hero-pills" aria-label="Workspace summary">
            <span>
              <Sparkles size={15} />
              {currentSprint.name}
            </span>
            <span>
              <CalendarDays size={15} />
              {formatShortDate(currentSprint.startDate)} - {formatShortDate(currentSprint.endDate)}
            </span>
            <span>
              <Clock3 size={15} />
              {lastSyncLabel}
            </span>
          </div>
        </div>
        <div className="workspace-score flow-score-dial" style={scoreStyle}>
          <span>{summary.teamHealthScore || "--"}</span>
          <strong>Sprint health</strong>
          <em>{healthLabel(summary.teamHealthScore)}</em>
          <small>{summary.participationRate}% participation</small>
        </div>
      </section>

      <section className="workspace-action-grid flow-action-grid" aria-label="Workspace actions">
        <Link className="workspace-action-card" to={`/projects/${project.id}/standups`}>
          <span className="workspace-action-icon">
            <ClipboardCheck size={22} />
          </span>
          <strong>{isScrumMaster ? "Review standups" : "Submit standup"}</strong>
          <span>
            {canSyncStandups
              ? "Review team updates, add manual entries, and refresh connected standup data."
              : "Manual update, transcript paste, and uploaded text parsing."}
          </span>
          <em>
            Open <ArrowRight size={15} />
          </em>
        </Link>
        <Link className="workspace-action-card" to={`/projects/${project.id}/dashboard`}>
          <span className="workspace-action-icon">
            <Gauge size={22} />
          </span>
          <strong>{isProductOwner ? "Project health" : "Open dashboard"}</strong>
          <span>Review sprint health, risk flags, say-do gaps, and recommended actions.</span>
          <em>
            Open <ArrowRight size={15} />
          </em>
        </Link>
        {canSyncStandups ? (
          <Link className="workspace-action-card" to={`/projects/${project.id}/integrations`}>
            <span className="workspace-action-icon">
              <RefreshCw size={22} />
            </span>
            <strong>{isScrumMaster ? "Refresh delivery data" : "Refresh signals"}</strong>
            <span>{canConfigure ? "Configure Jira and GitHub, then sync sprint issues and commits." : "Review connected Jira and GitHub signal status."}</span>
            <em>
              Open <ArrowRight size={15} />
            </em>
          </Link>
        ) : (
          <Link className="workspace-action-card" to={`/projects/${project.id}/members/${workspace.viewer.id}`}>
            <span className="workspace-action-icon">
              <UserRound size={22} />
            </span>
            <strong>Your pulse</strong>
            <span>Open your delivery signals, flags, tickets, and latest standups.</span>
            <em>
              Open <ArrowRight size={15} />
            </em>
          </Link>
        )}
        <Link className="workspace-action-card" to={`/projects/${project.id}/team`}>
          <span className="workspace-action-icon">
            <Users size={22} />
          </span>
          <strong>Team mapping</strong>
          <span>Review project roles, invite access, and map Jira/GitHub identities.</span>
          <em>
            Open <ArrowRight size={15} />
          </em>
        </Link>
        <Link className="workspace-action-card" to={`/projects/${project.id}/sprints`}>
          <span className="workspace-action-icon">
            <CalendarDays size={22} />
          </span>
          <strong>Sprint history</strong>
          <span>Open the active sprint and compare older sprint signal history.</span>
          <em>
            Open <ArrowRight size={15} />
          </em>
        </Link>
      </section>

      <section className="metric-grid flow-metric-grid">
        <div className="metric-tile flow-metric-tile">
          <Users size={20} />
          <span>Participation</span>
          <strong>{summary.participationRate}%</strong>
        </div>
        <div className="metric-tile flow-metric-tile">
          <MessageSquareText size={20} />
          <span>Open blockers</span>
          <strong>{summary.openBlockers}</strong>
        </div>
        <div className="metric-tile flow-metric-tile">
          <Gauge size={20} />
          <span>At-risk members</span>
          <strong>{summary.atRiskCount}</strong>
        </div>
        <div className="metric-tile flow-metric-tile">
          <Cloud size={20} />
          <span>Jira issues</span>
          <strong>{summary.issueCount}</strong>
        </div>
        <div className="metric-tile flow-metric-tile">
          <GitBranch size={20} />
          <span>Git commits</span>
          <strong>{summary.commitCount}</strong>
        </div>
        <div className="metric-tile flow-metric-tile">
          <PlugZap size={20} />
          <span>Last sync</span>
          <strong>{summary.lastSyncAt ? "Ready" : "Pending"}</strong>
        </div>
      </section>

      <section className="workspace-detail-grid">
        <article className="panel workspace-command-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Next actions</p>
              <h2>{isScrumMaster ? "Delivery operations" : isProductOwner ? "Product review path" : "Recommended flow"}</h2>
            </div>
          </div>
          <div className="workspace-next-list">
            {[
              { id: "standups", label: "Capture standups", description: "Manual, transcript, upload, and guided sync all write to this active sprint.", route: `/projects/${project.id}/standups` },
              { id: "integrations", label: integrations.jira || integrations.git ? "Refresh integrations" : "Configure integrations", description: "Connect Jira and GitHub signal sources for issues, commits, and say-do gap scoring.", route: `/projects/${project.id}/integrations` },
              { id: "dashboard", label: "Review health", description: "Open team risk, member pulse, blockers, and recommendations.", route: `/projects/${project.id}/dashboard` }
            ].map((action) => (
              <Link key={action.id} to={action.route}>
                <span className="next-action-index">{action.id.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{action.label}</strong>
                  <span>{action.description}</span>
                </div>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        </article>

        <article className="panel workspace-signal-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Signals</p>
              <h2>Integration readiness</h2>
              <span>{lastSyncLabel}</span>
            </div>
            <Activity size={21} />
          </div>
          <div className="integration-status-grid">
            {integrationCards.map((card) => (
              <div className="integration-status-card" key={card.id}>
                <span className="integration-status-icon">
                  <card.Icon size={18} />
                </span>
                <strong>{card.label}</strong>
                <small className={`status-chip status-${card.status}`}>{formatStatus(card.status)}</small>
                <p>{card.detail}</p>
              </div>
            ))}
          </div>
          <div className="sync-run-list">
            {recentRuns.length ? (
              recentRuns.map((run) => (
                <span key={run.id}>
                  <CheckCircle2 size={15} />
                  <strong>{formatStatus(run.source)}</strong>
                  <small>{formatStatus(run.status)}</small>
                  <em>{formatSyncDateTime(run.finishedAt ?? run.startedAt)}</em>
                </span>
              ))
            ) : (
              <p className="quiet-empty">No recent sync runs.</p>
            )}
          </div>
        </article>

        <article className="panel workspace-team-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Team</p>
              <h2>{project.members.length} people in sprint</h2>
              <span>{currentSprint.name}</span>
            </div>
            <Users size={21} />
          </div>
          <div className="workspace-member-list">
            {project.members.map((member) => (
              <span key={member.personaId}>
                <strong>{member.initials}</strong>
                {member.name}
                <small>{member.role}</small>
              </span>
            ))}
          </div>
        </article>

        <article className="panel workspace-sprint-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Sprint</p>
              <h2>{currentSprint.name}</h2>
              <span>
                {formatShortDate(currentSprint.startDate)} - {formatShortDate(currentSprint.endDate)}
              </span>
            </div>
            <Target size={21} />
          </div>
          <div className="sprint-signal-list">
            <span>
              <Layers3 size={16} />
              <strong>{currentSprint.status}</strong>
              Status
            </span>
            <span>
              <ClipboardCheck size={16} />
              <strong>{currentSprint.standupCount}</strong>
              Standups
            </span>
            <span>
              <Gauge size={16} />
              <strong>{currentSprint.healthScore}</strong>
              Health
            </span>
          </div>
        </article>
      </section>
    </div>
  );
}
