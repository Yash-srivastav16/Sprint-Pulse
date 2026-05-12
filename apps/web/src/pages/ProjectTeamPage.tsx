import { FormEvent, useEffect, useState } from "react";
import { BadgeCheck, Check, Edit3, GitBranch, Loader2, MailPlus, Save, ShieldAlert, TicketCheck, UsersRound, X } from "lucide-react";
import { useParams } from "react-router-dom";
import type { AppRole, ProjectInvite, ProjectRole, TeamResponse } from "@sprintpulse/shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

const projectRoles: ProjectRole[] = ["product-owner", "scrum-master", "engineering-manager", "architect", "developer", "qa"];
type TeamEntryMode = "existing" | "invite";
type TeamMember = TeamResponse["members"][number];

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
  const [entryMode, setEntryMode] = useState<TeamEntryMode>("existing");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [projectRole, setProjectRole] = useState<ProjectRole>("developer");
  const [jiraAccountId, setJiraAccountId] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [memberDraft, setMemberDraft] = useState({
    role: "developer" as ProjectRole,
    jiraAccountId: "",
    githubUsername: ""
  });

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

  useEffect(() => {
    if (team?.canEditTeam && !(team.availableUsers ?? []).length) {
      setEntryMode("invite");
    }
  }, [team?.canEditTeam, team?.availableUsers]);

  const changeEntryMode = (nextMode: TeamEntryMode) => {
    setEntryMode(nextMode);
    setSelectedProfileId("");
    setError(null);
    setSuccess(null);
  };

  const inviteMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!persona || !projectId || !team) {
      return;
    }

    const selectedWorkspaceUser =
      entryMode === "existing" ? (team.availableUsers ?? []).find((user) => user.id === selectedProfileId) : undefined;
    const memberName = selectedWorkspaceUser?.name ?? name.trim();
    const memberEmail = selectedWorkspaceUser?.email ?? email.trim();
    const memberAppRole = selectedWorkspaceUser?.appRole ?? appRoleForProjectRole(projectRole);

    if (entryMode === "existing" && !selectedWorkspaceUser) {
      setError("Choose an existing SprintPulse account or switch to Invite by email.");
      return;
    }

    if (entryMode === "invite" && (!memberName || !memberEmail)) {
      setError("Enter the invitee name and email.");
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
      setSuccess(
        response.invite.status === "accepted"
          ? `${memberName} was added to this project. They can open it after signing in.`
          : `${memberName} is pending. Copy the signup link below and send it to ${memberEmail}.`
      );
      loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add team member");
    } finally {
      setSaving(false);
    }
  };

  const copySignupLink = async (invite: ProjectInvite) => {
    const link = `${window.location.origin}${signupLinkForInvite(invite)}`;

    setError(null);
    setSuccess(null);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(link);
      setSuccess(`Signup link copied for ${invite.email}. Send it to the invited user.`);
    } catch {
      setError(`Copy failed. Signup link: ${link}`);
    }
  };

  const startEditingMember = (member: TeamMember) => {
    setEditingMemberId(member.personaId);
    setMemberDraft({
      role: member.role,
      jiraAccountId: member.jiraAccountId ?? "",
      githubUsername: member.githubUsername ?? ""
    });
    setError(null);
    setSuccess(null);
  };

  const cancelEditingMember = () => {
    setEditingMemberId(null);
    setMemberDraft({ role: "developer", jiraAccountId: "", githubUsername: "" });
  };

  const saveMemberMapping = async (member: TeamMember) => {
    if (!persona || !projectId) {
      return;
    }

    setSavingMemberId(member.personaId);
    setError(null);
    setSuccess(null);
    try {
      const response = await api.updateProjectMember(projectId, member.personaId, {
        personaId: persona.id,
        role: memberDraft.role,
        jiraAccountId: memberDraft.jiraAccountId,
        githubUsername: memberDraft.githubUsername
      });
      setTeam(response);
      setEditingMemberId(null);
      setSuccess(`${member.name}'s Jira and GitHub mapping was updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update team mapping");
    } finally {
      setSavingMemberId(null);
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
  const selectedWorkspaceUser = entryMode === "existing" ? availableUsers.find((user) => user.id === selectedProfileId) : undefined;
  const pendingInvites = team.invites.filter((invite) => invite.status === "pending");
  const acceptedInvites = team.invites.filter((invite) => invite.status === "accepted");

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
            <strong>{pendingInvites.length}</strong>
            <span>pending</span>
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
              <p className="eyebrow">Team access</p>
              <h2>Add project member</h2>
              <span className="panel-subtitle">
                Add a signed-up SprintPulse user directly, or create a signup link for someone new.
              </span>
            </div>
            <MailPlus size={22} />
          </div>
          <div className="segmented-control team-entry-tabs" role="tablist" aria-label="Member entry mode">
            <button className={entryMode === "existing" ? "active" : ""} type="button" onClick={() => changeEntryMode("existing")}>
              Existing account
            </button>
            <button className={entryMode === "invite" ? "active" : ""} type="button" onClick={() => changeEntryMode("invite")}>
              Invite by email
            </button>
          </div>
          <div className="form-grid">
            {entryMode === "existing" ? (
              <>
                <label className="field-group wide">
                  <span>Add existing SprintPulse account</span>
                  <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)}>
                    <option value="">Choose an account</option>
                    {availableUsers.map((user) => (
                      <option value={user.id} key={user.id}>
                        {user.name} · {user.email} · {roleLabel(user.appRole)}
                      </option>
                    ))}
                  </select>
                  <small className="field-hint">
                    {availableUsers.length
                      ? "Only accounts not already in this project are listed."
                      : "No unassigned accounts are available yet. Use Invite by email for a new person."}
                  </small>
                </label>
                {selectedWorkspaceUser ? (
                  <div className="selected-user-card wide">
                    <strong>{selectedWorkspaceUser.initials}</strong>
                    <span>
                      <b>{selectedWorkspaceUser.name}</b>
                      <small>{selectedWorkspaceUser.email} · {roleLabel(selectedWorkspaceUser.appRole)}</small>
                    </span>
                  </div>
                ) : null}
              </>
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
              </>
            )}
            <label className="field-group wide">
              <span>Project role</span>
              <select value={projectRole} onChange={(event) => setProjectRole(event.target.value as ProjectRole)}>
                {projectRoles.map((role) => (
                  <option value={role} key={role}>{roleLabel(role)}</option>
                ))}
              </select>
              <small className="field-hint">This controls project permissions and how SprintPulse groups Jira, Git, and standup signals.</small>
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
            <span>{entryMode === "existing" ? "Add selected account" : "Create invite"}</span>
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
        <div className={`ops-table team-mapping-table ${team.canEditTeam ? "has-actions" : ""}`}>
          <div className="ops-table-head">
            <span>Person</span>
            <span>Role</span>
            <span>Jira</span>
            <span>GitHub</span>
            {team.canEditTeam ? <span>Actions</span> : null}
          </div>
          {team.members.map((member) => {
            const isEditing = editingMemberId === member.personaId;
            const isSavingMember = savingMemberId === member.personaId;

            return (
              <div className="ops-table-row" key={member.personaId}>
                <span className="member-cell">
                  <strong>{member.initials}</strong>
                  <span>
                    {member.name}
                    <small>{member.email}</small>
                  </span>
                </span>
                <span className="member-mapping-cell">
                  {isEditing ? (
                    <select
                      aria-label={`Project role for ${member.name}`}
                      value={memberDraft.role}
                      onChange={(event) => setMemberDraft((draft) => ({ ...draft, role: event.target.value as ProjectRole }))}
                    >
                      {projectRoles.map((role) => (
                        <option value={role} key={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    roleLabel(member.role)
                  )}
                </span>
                <span className="member-mapping-cell">
                  {isEditing ? (
                    <input
                      aria-label={`Jira account for ${member.name}`}
                      value={memberDraft.jiraAccountId}
                      onChange={(event) => setMemberDraft((draft) => ({ ...draft, jiraAccountId: event.target.value }))}
                      placeholder="Jira account id or email"
                    />
                  ) : (
                    member.jiraAccountId || <em>Not mapped</em>
                  )}
                </span>
                <span className="member-mapping-cell">
                  {isEditing ? (
                    <input
                      aria-label={`GitHub username for ${member.name}`}
                      value={memberDraft.githubUsername}
                      onChange={(event) => setMemberDraft((draft) => ({ ...draft, githubUsername: event.target.value }))}
                      placeholder="github-handle"
                    />
                  ) : (
                    member.githubUsername || <em>Not mapped</em>
                  )}
                </span>
                {team.canEditTeam ? (
                  <span className="member-actions">
                    {isEditing ? (
                      <>
                        <button
                          aria-label={`Save mappings for ${member.name}`}
                          className="table-icon-button is-save"
                          type="button"
                          onClick={() => void saveMemberMapping(member)}
                          disabled={Boolean(savingMemberId)}
                        >
                          {isSavingMember ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
                        </button>
                        <button
                          aria-label={`Cancel editing ${member.name}`}
                          className="table-icon-button"
                          type="button"
                          onClick={cancelEditingMember}
                          disabled={Boolean(savingMemberId)}
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <button className="icon-text-button table-edit-button" type="button" onClick={() => startEditingMember(member)}>
                        <Edit3 size={15} />
                        <span>{member.jiraAccountId && member.githubUsername ? "Edit" : "Map user"}</span>
                      </button>
                    )}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {pendingInvites.length ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Invites</p>
              <h2>{pendingInvites.length} pending signup {pendingInvites.length === 1 ? "link" : "links"}</h2>
            </div>
          </div>
          <div className="invite-list">
            {pendingInvites.map((invite) => (
              <span key={invite.id}>
                <strong>{invite.email}</strong>
                <small>
                  {roleLabel(invite.role)} · waiting for account signup
                </small>
                <button className="text-link invite-link-button" type="button" onClick={() => void copySignupLink(invite)}>
                  Copy signup link
                </button>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {acceptedInvites.length ? (
        <section className="panel compact-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Access history</p>
              <h2>{acceptedInvites.length} accepted {acceptedInvites.length === 1 ? "invite" : "invites"}</h2>
            </div>
          </div>
          <div className="invite-list">
            {acceptedInvites.slice(0, 4).map((invite) => (
              <span key={invite.id}>
                <strong>{invite.email}</strong>
                <small>{roleLabel(invite.role)} · accepted</small>
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
