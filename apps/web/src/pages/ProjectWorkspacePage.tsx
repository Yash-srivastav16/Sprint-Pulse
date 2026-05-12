import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, ClipboardCheck, Cloud, Gauge, GitBranch, Loader2, MessageSquareText, PlugZap, RefreshCw, UserRound, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { Persona, ProjectOpsResponse } from "@sprintpulse/shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";

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

  return (
    <div className="page-stack">
      <section className="page-heading workspace-heading">
        <div>
          <p className="eyebrow">{project.key} workspace</p>
          <h1>{project.name}</h1>
          <p>{project.sprint.goal}</p>
          <p className="workspace-role-copy">{workspaceCopy(persona)}</p>
        </div>
        <div className="workspace-score">
          <span>{summary.teamHealthScore || "--"}</span>
          <strong>Sprint health</strong>
          <small>{summary.participationRate}% participation</small>
        </div>
      </section>

      <section className="workspace-action-grid" aria-label="Workspace actions">
        <Link to={`/projects/${project.id}/standups`}>
          <ClipboardCheck size={22} />
          <strong>{isScrumMaster ? "Review standups" : "Submit standup"}</strong>
          <span>
            {canSyncStandups
              ? "Review team updates, add manual entries, and refresh connected standup data."
              : "Manual update, transcript paste, and uploaded text parsing."}
          </span>
        </Link>
        <Link to={`/projects/${project.id}/dashboard`}>
          <Gauge size={22} />
          <strong>{isProductOwner ? "Project health" : "Open dashboard"}</strong>
          <span>Review sprint health, risk flags, say-do gaps, and recommended actions.</span>
        </Link>
        {canSyncStandups ? (
          <Link to={`/projects/${project.id}/integrations`}>
            <RefreshCw size={22} />
            <strong>{isScrumMaster ? "Refresh delivery data" : "Refresh signals"}</strong>
            <span>{canConfigure ? "Configure Jira and GitHub, then sync sprint issues and commits." : "Review connected Jira and GitHub signal status."}</span>
          </Link>
        ) : (
          <Link to={`/projects/${project.id}/members/${workspace.viewer.id}`}>
            <UserRound size={22} />
            <strong>Your pulse</strong>
            <span>Open your delivery signals, flags, tickets, and latest standups.</span>
          </Link>
        )}
        <Link to={`/projects/${project.id}/team`}>
          <Users size={22} />
          <strong>Team mapping</strong>
          <span>Review project roles, invite access, and map Jira/GitHub identities.</span>
        </Link>
        <Link to={`/projects/${project.id}/sprints`}>
          <CalendarDays size={22} />
          <strong>Sprint history</strong>
          <span>Open the active sprint and compare older sprint signal history.</span>
        </Link>
      </section>

      <section className="metric-grid">
        <div className="metric-tile">
          <Users size={20} />
          <span>Participation</span>
          <strong>{summary.participationRate}%</strong>
        </div>
        <div className="metric-tile">
          <MessageSquareText size={20} />
          <span>Open blockers</span>
          <strong>{summary.openBlockers}</strong>
        </div>
        <div className="metric-tile">
          <Gauge size={20} />
          <span>At-risk members</span>
          <strong>{summary.atRiskCount}</strong>
        </div>
        <div className="metric-tile">
          <Cloud size={20} />
          <span>Jira issues</span>
          <strong>{summary.issueCount}</strong>
        </div>
        <div className="metric-tile">
          <GitBranch size={20} />
          <span>Git commits</span>
          <strong>{summary.commitCount}</strong>
        </div>
        <div className="metric-tile">
          <PlugZap size={20} />
          <span>Last sync</span>
          <strong>{summary.lastSyncAt ? "Ready" : "Pending"}</strong>
        </div>
      </section>

      <section className="content-grid">
        <article className="panel">
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
                <strong>{action.label}</strong>
                <span>{action.description}</span>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Team</p>
              <h2>{project.members.length} people in sprint</h2>
              <span>{currentSprint.name}</span>
            </div>
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
      </section>
    </div>
  );
}
