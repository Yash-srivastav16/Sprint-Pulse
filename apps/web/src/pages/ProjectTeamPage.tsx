import { FormEvent, useEffect, useState } from "react";
import { BadgeCheck, GitBranch, Loader2, MailPlus, Save, ShieldAlert, TicketCheck, UsersRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { AppRole, ProjectInvite, ProjectRole, TeamResponse } from "@sprintpulse/shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

const projectRoles: ProjectRole[] = ["product-owner", "scrum-master", "engineering-manager", "architect", "developer", "qa"];
const appRoles: AppRole[] = ["product-owner", "scrum-master", "engineering-manager", "developer", "qa-lead"];

const roleLabel = (role: string) =>
  role
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");

const appRoleForProjectRole = (role: ProjectRole): AppRole => {
  if (role === "product-owner") {
    return "product-owner";
  }
  if (role === "scrum-master") {
    return "scrum-master";
  }
  if (role === "engineering-manager" || role === "architect") {
    return "engineering-manager";
  }
  if (role === "qa") {
    return "qa-lead";
  }
  return "developer";
};

const signupLinkForInvite = (invite: ProjectInvite, name?: string) => {
  const params = new URLSearchParams({
    email: invite.email,
    role: appRoleForProjectRole(invite.role)
  });

  if (name) {
    params.set("name", name);
  }

  return `/signup?${params.toString()}`;
};

export function ProjectTeamPage() {
  const { projectId } = useParams();
  const { persona } = useAuth();
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("");
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
    if (!persona || !projectId || !team) {
      return;
    }

    const selectedWorkspaceUser = (team.availableUsers ?? []).find((user) => user.id === selectedProfileId);
    const memberName = selectedWorkspaceUser?.name ?? name.trim();
    const memberEmail = selectedWorkspaceUser?.email ?? email.trim();
    const memberAppRole = selectedWorkspaceUser?.appRole ?? appRole;

    if (!memberName || !memberEmail) {
      setError("Choose a signed-in workspace user or enter a name and email.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await api.inviteProjectMember(projectId, {
        personaId: persona.id,
        name: memberName,
        email: memberEmail,
        appRole: memberAppRole,
        projectRole,
        jiraAccountId,
        githubUsername
      });
      setSelectedProfileId("");
      setName("");
      setEmail("");
      setJiraAccountId("");
      setGithubUsername("");
      setProjectRole("developer");
      setAppRole("developer");
      setSuccess(
        response.invite.status === "accepted"
          ? `${memberName} was added to this project. They can open it after signing in.`
          : `${memberName} was invited. They should create an account with ${memberEmail} and choose their own password.`
      );
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

  const jiraMapped = team.members.filter((member) => member.jiraAccountId).length;
  const gitMapped = team.members.filter((member) => member.githubUsername).length;
  const deliveryLeads = team.members.filter((member) => ["product-owner", "scrum-master", "architect"].includes(member.role)).length;
  const availableUsers = team.availableUsers ?? [];
  const selectedWorkspaceUser = availableUsers.find((user) => user.id === selectedProfileId);

  return (
    <div className="page-stack ops-page">
      <section className="page-heading ops-heading">
        <div>
          <p className="eyebrow">{team.project.key} team</p>
          <h1>Team management</h1>
          <p>Map people to project roles, Jira accounts, and GitHub usernames so sprint signals land on the right person.</p>
        </div>
        <div className="ops-hero-metrics">
          <div>
            <strong>{team.members.length}</strong>
            <span>members</span>
          </div>
          <div>
            <strong>{team.invites.length}</strong>
            <span>invites</span>
          </div>
          <div className="ops-heading-icon">
            <UsersRound size={28} />
          </div>
        </div>
      </section>

      <section className="ops-kpi-grid">
        <article className="ops-kpi-card">
          <BadgeCheck size={20} />
          <span>Leadership coverage</span>
          <strong>{deliveryLeads}</strong>
          <small>owner, scrum, architect roles</small>
        </article>
        <article className="ops-kpi-card">
          <TicketCheck size={20} />
          <span>Jira mapped</span>
          <strong>{jiraMapped}/{team.members.length}</strong>
          <small>issue ownership can resolve cleanly</small>
        </article>
        <article className="ops-kpi-card">
          <GitBranch size={20} />
          <span>Git mapped</span>
          <strong>{gitMapped}/{team.members.length}</strong>
          <small>commits can attach to people</small>
        </article>
      </section>

      {team.canEditTeam ? (
        <form className="panel setup-form compact-form" onSubmit={inviteMember}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Workspace users</p>
              <h2>Add project member</h2>
              <span className="panel-subtitle">
                Existing users are added immediately. New emails get a pending invite and choose their own password on signup.
              </span>
            </div>
            <MailPlus size={22} />
          </div>
          <div className="form-grid">
            <label className="field-group wide">
              <span>Signed-in workspace user</span>
              <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)}>
                <option value="">Invite with email instead</option>
                {availableUsers.map((user) => (
                  <option value={user.id} key={user.id}>
                    {user.name} · {user.email} · {roleLabel(user.appRole)}
                  </option>
                ))}
              </select>
              <small className="field-hint">People appear here after creating a SprintPulse account.</small>
            </label>
            {selectedWorkspaceUser ? (
              <div className="selected-user-card wide">
                <strong>{selectedWorkspaceUser.initials}</strong>
                <span>
                  <b>{selectedWorkspaceUser.name}</b>
                  <small>{selectedWorkspaceUser.email} · {roleLabel(selectedWorkspaceUser.appRole)}</small>
                </span>
              </div>
            ) : (
              <>
                <label className="field-group">
                  <span>Name</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Priya Sharma" required={!selectedWorkspaceUser} />
                </label>
                <label className="field-group">
                  <span>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="priya@company.com"
                    required={!selectedWorkspaceUser}
                  />
                </label>
                <label className="field-group">
                  <span>Workspace role</span>
                  <select value={appRole} onChange={(event) => setAppRole(event.target.value as AppRole)}>
                    {appRoles.map((role) => (
                      <option value={role} key={role}>{roleLabel(role)}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
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
            {team.invites.map((invite) => {
              const invitedMember = team.members.find((member) => member.email.toLowerCase() === invite.email.toLowerCase());

              return (
              <span key={invite.id}>
                <strong>{invite.email}</strong>
                <small>
                  {roleLabel(invite.role)} ·{" "}
                  {invite.status === "accepted" ? "accepted" : "waiting for account signup"}
                </small>
                {invite.status === "pending" ? (
                  <Link className="text-link" to={signupLinkForInvite(invite, invitedMember?.name)}>
                    Open signup link
                  </Link>
                ) : null}
              </span>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
