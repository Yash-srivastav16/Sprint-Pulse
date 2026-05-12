import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, GitCommitHorizontal, Loader2, MessageSquareText, TicketCheck } from "lucide-react";
import { useParams } from "react-router-dom";
import type { SprintListResponse } from "@sprintpulse/shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";

const statusLabel = (status: string) => status[0].toUpperCase() + status.slice(1);

export function ProjectSprintsPage() {
  const { projectId } = useParams();
  const { persona } = useAuth();
  const { selectedSprintId, selectProject, selectSprint } = useProject();
  const [data, setData] = useState<SprintListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!persona || !projectId) {
      return;
    }

    setLoading(true);
    setError(null);
    api
      .getProjectSprints(projectId, persona.id)
      .then((response) => {
        setData(response);
        const contextSprint =
          (selectedSprintId ? response.sprints.find((sprint) => sprint.id === selectedSprintId) : null) ??
          response.currentSprint ??
          response.project.sprint;
        selectProject(response.project.id, {
          source: response.project.source === "manual" ? "manual" : "jira",
          projectName: response.project.name,
          projectKey: response.project.key,
          sprintName: contextSprint.name,
          sprintGoal: contextSprint.goal,
          jiraSite: response.project.jiraSite,
          importedAt: response.project.lastSyncAt
        });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [persona, projectId, selectProject, selectedSprintId]);

  if (loading) {
    return (
      <div className="center-state">
        <Loader2 className="spin" size={26} />
        <span>Loading sprints</span>
      </div>
    );
  }

  if (error || !data) {
    return <div className="center-state error-state">{error ?? "Sprints unavailable"}</div>;
  }

  const totalIssues = data.sprints.reduce((sum, sprint) => sum + sprint.issueCount, 0);
  const totalStandups = data.sprints.reduce((sum, sprint) => sum + sprint.standupCount, 0);
  const totalCommits = data.sprints.reduce((sum, sprint) => sum + sprint.commitCount, 0);

  return (
    <div className="page-stack ops-page">
      <section className="page-heading ops-heading">
        <div>
          <p className="eyebrow">{data.project.key} sprint history</p>
          <h1>Sprints</h1>
          <p>Review the active sprint and older sprint signals without mixing project context.</p>
        </div>
        <div className="ops-hero-metrics">
          <div>
            <strong>{data.sprints.length}</strong>
            <span>sprints</span>
          </div>
          <div>
            <strong>{data.currentSprint?.healthScore ?? "--"}</strong>
            <span>active health</span>
          </div>
          <div className="ops-heading-icon">
            <CalendarDays size={28} />
          </div>
        </div>
      </section>

      <section className="ops-kpi-grid">
        <article className="ops-kpi-card">
          <TicketCheck size={20} />
          <span>Issues tracked</span>
          <strong>{totalIssues}</strong>
          <small>across sprint history</small>
        </article>
        <article className="ops-kpi-card">
          <MessageSquareText size={20} />
          <span>Standups captured</span>
          <strong>{totalStandups}</strong>
          <small>daily context preserved</small>
        </article>
        <article className="ops-kpi-card">
          <GitCommitHorizontal size={20} />
          <span>Commits synced</span>
          <strong>{totalCommits}</strong>
          <small>delivery evidence attached</small>
        </article>
      </section>

      {data.currentSprint ? (
        <section className="current-sprint-band">
          <div>
            <p className="eyebrow">Active sprint</p>
            <h2>{data.currentSprint.name}</h2>
            <span>{data.currentSprint.startDate} to {data.currentSprint.endDate}</span>
          </div>
          <div className="sprint-health-chip">
            <strong>{data.currentSprint.healthScore}</strong>
            <span>health</span>
          </div>
        </section>
      ) : null}

      <section className="sprint-grid">
        {data.sprints.map((sprint) => {
          const isSelected = (selectedSprintId ?? data.currentSprint?.id) === sprint.id;
          return (
          <article className={`sprint-card ${isSelected ? "selected" : ""}`} key={sprint.id}>
            <div className="sprint-card-top">
              <span className={`source-pill source-${sprint.status}`}>{statusLabel(sprint.status)}</span>
              {sprint.status === "active" ? <CheckCircle2 size={18} /> : null}
            </div>
            <h2>{sprint.name}</h2>
            <p>{sprint.goal}</p>
            <div className="project-stat-row">
              <span>
                <strong>{sprint.issueCount}</strong>
                <TicketCheck size={15} />
                Issues
              </span>
              <span>
                <strong>{sprint.standupCount}</strong>
                <MessageSquareText size={15} />
                Standups
              </span>
              <span>
                <strong>{sprint.commitCount}</strong>
                <GitCommitHorizontal size={15} />
                Commits
              </span>
            </div>
            <div className="sprint-card-footer">
              <span>{sprint.startDate}</span>
              <span>{sprint.endDate}</span>
            </div>
            <button
              className="ghost-action-button sprint-switch-button"
              type="button"
              onClick={() => selectSprint(sprint.id, { sprintName: sprint.name, sprintGoal: sprint.goal })}
            >
              {isSelected ? "Selected sprint" : "View this sprint"}
            </button>
          </article>
          );
        })}
      </section>
    </div>
  );
}
