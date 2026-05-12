import { FormEvent, useEffect, useState } from "react";
import { Loader2, MailPlus, Save, ShieldAlert, UsersRound } from "lucide-react";
import { useParams } from "react-router-dom";
import type { AppRole, ProjectRole, TeamResponse } from "@sprintpulse/shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

const projectRoles: ProjectRole[] = ["product-owner", "scrum-master", "engineering-manager", "architect", "developer", "qa"];
const appRoles: AppRole[] = ["product-owner", "scrum-master", "engineering-manager", "developer", "qa-lead"];

const roleLabel = (role: string) =>
  role
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");

export function ProjectTeamPage() {
  const { projectId } = useParams();
  const { persona } = useAuth();
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [appRole, setAppRole] = useState<AppRole>("developer");
  const [projectRole, setProjectRole] = useState<ProjectRole>("developer");
  const [jiraAccountId, setJiraAccountId] = useState("");
  const [githubUsername, setGithubUsername] = useState("");

  const loadTeam = () => {
    if (!persona || !projectId) {
      return;
    }

    setLoading(true);
    setError(null);
    api
      .getProjectTeam(projectId, persona.id)
      .then(setTeam)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadTeam, [persona, projectId]);

  const inviteMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!persona || !projectId) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.inviteProjectMember(projectId, {
        personaId: persona.id,
        name,
        email,
        appRole,
        projectRole,
        jiraAccountId,
        githubUsername
      });
      setName("");
      setEmail("");
      setJiraAccountId("");
      setGithubUsername("");
      setProjectRole("developer");
      setAppRole("developer");
      setSuccess("Team member added. They can sign up with this email and land in the project.");
      loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add team member");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="center-state">
        <Loader2 className="spin" size={26} />
        <span>Loading team</span>
      </div>
    );
  }

  if (error && !team) {
    return <div className="center-state error-state">{error}</div>;
  }

  if (!team) {
    return <div className="center-state error-state">Team unavailable</div>;
  }

  return (
    <div className="page-stack ops-page">
      <section className="page-heading ops-heading">
        <div>
          <p className="eyebrow">{team.project.key} team</p>
          <h1>Team management</h1>
          <p>Map people to project roles, Jira accounts, and GitHub usernames so sprint signals land on the right person.</p>
        </div>
        <div className="ops-heading-icon">
          <UsersRound size={28} />
        </div>
      </section>

      {team.canEditTeam ? (
        <form className="panel setup-form compact-form" onSubmit={inviteMember}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Invite or add</p>
              <h2>Add project member</h2>
            </div>
            <MailPlus size={22} />
          </div>
          <div className="form-grid">
            <label className="field-group">
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Priya Sharma" required />
            </label>
            <label className="field-group">
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="priya@company.com" required />
            </label>
            <label className="field-group">
              <span>Workspace role</span>
              <select value={appRole} onChange={(event) => setAppRole(event.target.value as AppRole)}>
                {appRoles.map((role) => (
                  <option value={role} key={role}>{roleLabel(role)}</option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Project role</span>
              <select value={projectRole} onChange={(event) => setProjectRole(event.target.value as ProjectRole)}>
                {projectRoles.map((role) => (
                  <option value={role} key={role}>{roleLabel(role)}</option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span>Jira account</span>
              <input value={jiraAccountId} onChange={(event) => setJiraAccountId(event.target.value)} placeholder="Jira account id or email" />
            </label>
            <label className="field-group">
              <span>GitHub username</span>
              <input value={githubUsername} onChange={(event) => setGithubUsername(event.target.value)} placeholder="github-handle" />
            </label>
          </div>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            <span>Add member</span>
          </button>
        </form>
      ) : (
        <section className="panel permission-panel">
          <ShieldAlert size={20} />
          <span>Team configuration is managed by the project Scrum Master or owner.</span>
        </section>
      )}

      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Members</p>
            <h2>{team.members.length} people mapped to this project</h2>
          </div>
        </div>
        <div className="ops-table">
          <div className="ops-table-head">
            <span>Person</span>
            <span>Role</span>
            <span>Jira</span>
            <span>GitHub</span>
          </div>
          {team.members.map((member) => (
            <div className="ops-table-row" key={member.personaId}>
              <span className="member-cell">
                <strong>{member.initials}</strong>
                <span>
                  {member.name}
                  <small>{member.email}</small>
                </span>
              </span>
              <span>{roleLabel(member.role)}</span>
              <span>{member.jiraAccountId || "Not mapped"}</span>
              <span>{member.githubUsername || "Not mapped"}</span>
            </div>
          ))}
        </div>
      </section>

      {team.invites.length ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Invites</p>
              <h2>Pending access</h2>
            </div>
          </div>
          <div className="invite-list">
            {team.invites.map((invite) => (
              <span key={invite.id}>
                <strong>{invite.email}</strong>
                <small>{roleLabel(invite.role)} · {invite.status}</small>
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
