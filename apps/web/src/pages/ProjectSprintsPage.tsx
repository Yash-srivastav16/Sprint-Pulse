import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, GitCommitHorizontal, Loader2, MessageSquareText, TicketCheck } from "lucide-react";
import { useParams } from "react-router-dom";
import type { SprintListResponse } from "@sprintpulse/shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

const statusLabel = (status: string) => status[0].toUpperCase() + status.slice(1);

export function ProjectSprintsPage() {
  const { projectId } = useParams();
  const { persona } = useAuth();
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
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [persona, projectId]);

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

  return (
    <div className="page-stack ops-page">
      <section className="page-heading ops-heading">
        <div>
          <p className="eyebrow">{data.project.key} sprint history</p>
          <h1>Sprints</h1>
          <p>Review the active sprint and older sprint signals without mixing project context.</p>
        </div>
        <div className="ops-heading-icon">
          <CalendarDays size={28} />
        </div>
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
        {data.sprints.map((sprint) => (
          <article className="sprint-card" key={sprint.id}>
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
          </article>
        ))}
      </section>
    </div>
  );
}
