import { useEffect, useState } from "react";
import { ArrowLeft, GitCommitHorizontal, Loader2, TicketCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { MemberPulse, MemberPulseHistoryResponse } from "@sprintpulse/shared";
import { api } from "../api";
import { RiskBadge } from "../components/RiskBadge";
import { ScoreRing } from "../components/ScoreRing";
import { useAuth } from "../context/AuthContext";

const isHistoryResponse = (
  response: { member: MemberPulse } | MemberPulseHistoryResponse
): response is MemberPulseHistoryResponse => "recommendations" in response && "standups" in response;

export function MemberDetailPage() {
  const { projectId, memberId } = useParams();
  const { persona } = useAuth();
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

    const request = projectId && persona ? api.getProjectMemberHistory(projectId, memberId, persona.id) : api.getMember(memberId);
    request
      .then((response) => {
        setMember(response.member);
        setHistory(isHistoryResponse(response) ? response : null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [memberId, persona, projectId]);

  if (loading) {
    return (
      <div className="center-state">
        <Loader2 className="spin" size={26} />
        <span>Loading member pulse</span>
      </div>
    );
  }

  if (error || !member) {
    return <div className="center-state error-state">{error ?? "Member unavailable"}</div>;
  }

  return (
    <div className="page-stack">
      <Link className="back-link" to={projectId ? `/projects/${projectId}/dashboard` : "/projects"}>
        <ArrowLeft size={18} />
        <span>Back to pulse</span>
      </Link>

      <section className="page-heading member-heading">
        <div className="member-title">
          <span className="avatar large">{member.initials}</span>
          <div>
            <p className="eyebrow">{member.title}</p>
            <h1>{member.name}</h1>
            <p>{member.currentFocus}</p>
          </div>
        </div>
        <ScoreRing score={member.healthScore} label="health score" />
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Delivery signals</p>
              <h2>Git and tickets</h2>
            </div>
            <RiskBadge level={member.riskLevel} />
          </div>

          <div className="metric-grid compact">
            <div className="metric-tile">
              <GitCommitHorizontal size={20} />
              <span>Commits</span>
              <strong>{member.git.commitsThisSprint}</strong>
            </div>
            <div className="metric-tile">
              <TicketCheck size={20} />
              <span>Open PRs</span>
              <strong>{member.git.pullRequestsOpen}</strong>
            </div>
          </div>

          <div className="ticket-list">
            {(history?.issues.length ? history.issues.map((issue) => ({
              key: issue.issueKey,
              title: issue.summary,
              status: issue.status,
              daysIdle: issue.daysIdle
            })) : member.tickets).map((ticket) => (
              <div className="ticket-row" key={ticket.key}>
                <strong>{ticket.key}</strong>
                <span>{ticket.title}</span>
                <em>{ticket.status}</em>
                <small>{ticket.daysIdle}d idle</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Risk explanation</p>
              <h2>Flags</h2>
            </div>
          </div>
          <div className="flag-list">
            {member.flags.length ? (
              member.flags.map((flag) => (
                <div className="flag-item" key={flag.id}>
                  <div>
                    <strong>{flag.title}</strong>
                    <span>{flag.type}</span>
                  </div>
                  <p>{flag.message}</p>
                  <RiskBadge level={flag.severity} />
                </div>
              ))
            ) : (
              <div className="empty-state">No active risk flags for this member.</div>
            )}
          </div>
        </article>
      </section>

      {history?.recommendations.length ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Recommendations</p>
              <h2>Next best moves</h2>
            </div>
          </div>
          <div className="flag-list">
            {history.recommendations.map((recommendation) => (
              <div className="flag-item" key={recommendation.id}>
                <div>
                  <strong>{recommendation.title}</strong>
                  <span>{recommendation.kind}</span>
                </div>
                <p>{recommendation.message}</p>
                <RiskBadge level={recommendation.severity} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Communication history</p>
            <h2>Recent standups</h2>
          </div>
        </div>
        <div className="timeline-list">
          {(history?.standups.length ? history.standups : member.standups).map((entry) => (
            <div className="timeline-item" key={entry.id}>
              <time>{entry.date}</time>
              <div>
                <strong>Yesterday</strong>
                <p>{entry.yesterday}</p>
              </div>
              <div>
                <strong>Today</strong>
                <p>{entry.today}</p>
              </div>
              <div>
                <strong>Blockers</strong>
                <p>{entry.blockers}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
