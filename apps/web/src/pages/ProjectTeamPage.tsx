import { FormEvent, useEffect, useState } from "react";
import { BadgeCheck, Check, Edit3, GitBranch, Loader2, MailPlus, Save, ShieldAlert, TicketCheck, UsersRound, X } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import type { AppRole, ProjectInvite, ProjectRole, TeamResponse } from "@sprintpulse/shared";
import { Input } from "@/components/ui/input";
import {
  EmptyPanel,
  MemberAvatar,
  PanelHeader,
  SectionPanel,
  StatusPill,
  WorkspaceError,
  WorkspaceHero,
  WorkspaceLoading,
  workspacePageClass
} from "@/components/workspace/WorkspaceChrome";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";

const projectRoles: ProjectRole[] = ["product-owner", "scrum-master", "engineering-manager", "architect", "developer", "qa"];
type TeamEntryMode = "existing" | "invite";
type TeamMember = TeamResponse["members"][number];

const roleLabel = (role: string) =>
  role
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
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

function SelectField({
  value,
  onChange,
  children,
  ariaLabel
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className="min-h-10 rounded-md border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-950 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

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
      toast.success(response.invite.status === "accepted" ? "Member added" : "Invite created", {
        description: response.invite.status === "accepted" ? `${memberName} can open this project now.` : `Signup link is ready for ${memberEmail}.`
      });
      loadTeam();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to add team member";
      setError(message);
      toast.error("Unable to add member", { description: message });
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
      toast.success("Signup link copied", { description: invite.email });
    } catch {
      setError(`Copy failed. Signup link: ${link}`);
      toast.error("Copy failed", { description: "The signup link is shown inline." });
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
      toast.success("Member mapping updated", { description: member.name });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update team mapping";
      setError(message);
      toast.error("Mapping update failed", { description: message });
    } finally {
      setSavingMemberId(null);
    }
  };

  if (loading) {
    return <WorkspaceLoading label="Loading team" />;
  }

  if (error && !team) {
    return <WorkspaceError label={error} />;
  }

  if (!team) {
    return <WorkspaceError label="Team unavailable" />;
  }

  const jiraMapped = team.members.filter((member) => member.jiraAccountId).length;
  const gitMapped = team.members.filter((member) => member.githubUsername).length;
  const deliveryLeads = team.members.filter((member) => ["product-owner", "scrum-master", "architect"].includes(member.role)).length;
  const availableUsers = team.availableUsers ?? [];
  const selectedWorkspaceUser = entryMode === "existing" ? availableUsers.find((user) => user.id === selectedProfileId) : undefined;
  const pendingInvites = team.invites.filter((invite) => invite.status === "pending");
  const acceptedInvites = team.invites.filter((invite) => invite.status === "accepted");
  const teamStats = [
    {
      label: "Delivery leads",
      value: deliveryLeads,
      detail: "Product, scrum, and architecture owners",
      icon: BadgeCheck,
      tone: "primary" as const,
      progress: team.members.length ? (deliveryLeads / team.members.length) * 100 : 0
    },
    {
      label: "Jira mapped",
      value: `${jiraMapped}/${team.members.length}`,
      detail: "Needed for issue ownership",
      icon: TicketCheck,
      tone: "info" as const,
      progress: team.members.length ? (jiraMapped / team.members.length) * 100 : 0
    },
    {
      label: "GitHub mapped",
      value: `${gitMapped}/${team.members.length}`,
      detail: "Needed for commit and PR signals",
      icon: GitBranch,
      tone: "ai" as const,
      progress: team.members.length ? (gitMapped / team.members.length) * 100 : 0
    },
    {
      label: "Pending invites",
      value: pendingInvites.length,
      detail: "Signup links waiting for users",
      icon: MailPlus,
      tone: pendingInvites.length ? ("warning" as const) : ("success" as const),
      progress: team.members.length ? Math.max(8, Math.min(100, (pendingInvites.length / team.members.length) * 100)) : 0
    }
  ];

  return (
    <div className={workspacePageClass}>
      <WorkspaceHero
        eyebrow={
          <>
            <StatusPill icon={UsersRound} tone="primary">
              {team.project.key} team
            </StatusPill>
            <StatusPill icon={BadgeCheck} tone={team.canEditTeam ? "success" : "neutral"}>
              {team.canEditTeam ? "Editable" : "Read only"}
            </StatusPill>
          </>
        }
        title="Team management"
        description="Map people to project roles, Jira accounts, and GitHub usernames so sprint signals land on the right owner."
        score={team.members.length}
        scoreLabel="Project members"
        scoreTone="primary"
        scoreDetail={`${pendingInvites.length} pending invite${pendingInvites.length === 1 ? "" : "s"} · ${deliveryLeads} delivery lead${deliveryLeads === 1 ? "" : "s"}`}
      />

      <section className="grid auto-rows-fr items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
        {teamStats.map((stat) => {
          const StatIcon = stat.icon;
          return (
            <SectionPanel className="p-4" key={stat.label}>
              <div className="flex items-start justify-between gap-3">
                <StatusPill icon={StatIcon} tone={stat.tone}>
                  {stat.label}
                </StatusPill>
                <strong className="font-mono text-2xl font-bold text-slate-950 dark:text-white">{stat.value}</strong>
              </div>
              <p className="m-0 mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{stat.detail}</p>
              <span className="mt-4 block h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10" aria-hidden="true">
                <span
                  className={cn(
                    "block h-full rounded-full bg-gradient-to-r",
                    stat.tone === "warning"
                      ? "from-warning-500 to-amber-300"
                      : stat.tone === "ai"
                        ? "from-ai-500 to-info-400"
                        : stat.tone === "info"
                          ? "from-info-500 to-primary-400"
                          : "from-primary-500 to-emerald-400"
                  )}
                  style={{ width: `${Math.max(8, Math.min(100, stat.progress))}%` }}
                />
              </span>
            </SectionPanel>
          );
        })}
      </section>

      {team.canEditTeam ? (
        <SectionPanel>
          <form className="grid gap-5" onSubmit={inviteMember}>
            <PanelHeader
              eyebrow="Team access"
              title="Add project member"
              description="Add a signed-up SprintPulse user directly, or create a signup link for someone new."
              icon={MailPlus}
              action={
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/[0.055]">
                  {(["existing", "invite"] as TeamEntryMode[]).map((item) => (
                    <button
                      className={cn(
                        "min-h-9 rounded-lg px-3 text-sm font-black capitalize transition",
                        entryMode === item ? "bg-white text-primary-700 shadow-sm dark:bg-white/10 dark:text-primary-100" : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                      )}
                      key={item}
                      type="button"
                      onClick={() => changeEntryMode(item)}
                    >
                      {item === "existing" ? "Existing account" : "Invite by email"}
                    </button>
                  ))}
                </div>
              }
            />

            <div className="grid items-start gap-4 lg:grid-cols-2">
              {entryMode === "existing" ? (
                <>
                  <label className="grid gap-2 lg:col-span-2">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">Add existing SprintPulse account</span>
                    <SelectField value={selectedProfileId} onChange={setSelectedProfileId}>
                      <option value="">Choose an account</option>
                      {availableUsers.map((user) => (
                        <option value={user.id} key={user.id}>
                          {user.name} · {user.email} · {roleLabel(user.appRole)}
                        </option>
                      ))}
                    </SelectField>
                    <small className="text-sm text-slate-500 dark:text-slate-400">
                      {availableUsers.length
                        ? "Only accounts not already in this project are listed."
                        : "No unassigned accounts are available yet. Use Invite by email for a new person."}
                    </small>
                  </label>
                  {selectedWorkspaceUser ? (
                    <div className="flex items-center gap-3 rounded-xl border border-primary-500/20 bg-primary-500/10 p-4 lg:col-span-2">
                      <MemberAvatar initials={selectedWorkspaceUser.initials} />
                      <span className="min-w-0">
                        <strong className="block truncate text-sm font-black text-slate-950 dark:text-white">{selectedWorkspaceUser.name}</strong>
                        <small className="block truncate text-slate-500 dark:text-slate-400">{selectedWorkspaceUser.email} · {roleLabel(selectedWorkspaceUser.appRole)}</small>
                      </span>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">Name</span>
                    <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Priya Sharma" required={!selectedWorkspaceUser} />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">Email</span>
                    <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="priya@company.com" required={!selectedWorkspaceUser} />
                  </label>
                </>
              )}
              <label className="grid gap-2 lg:col-span-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Project role</span>
                <SelectField value={projectRole} onChange={(value) => setProjectRole(value as ProjectRole)}>
                  {projectRoles.map((role) => (
                    <option value={role} key={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </SelectField>
                <small className="text-sm text-slate-500 dark:text-slate-400">This controls project permissions and how SprintPulse groups Jira, Git, and standup signals.</small>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Jira account</span>
                <Input value={jiraAccountId} onChange={(event) => setJiraAccountId(event.target.value)} placeholder="Jira account id or email" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">GitHub username</span>
                <Input value={githubUsername} onChange={(event) => setGithubUsername(event.target.value)} placeholder="github-handle" />
              </label>
            </div>
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-6 text-sm font-black text-white shadow-[0_16px_40px_rgba(16,169,154,0.24)] transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60" type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {entryMode === "existing" ? "Add selected account" : "Create invite"}
            </button>
          </form>
        </SectionPanel>
      ) : (
        <SectionPanel className="border-warning-500/20 bg-warning-500/10">
          <div className="flex items-center gap-3 text-warning-700 dark:text-warning-100">
            <ShieldAlert className="h-5 w-5" />
            <span className="font-semibold">Team configuration is managed by the project Scrum Master or owner.</span>
          </div>
        </SectionPanel>
      )}

      {error ? <div className="rounded-xl border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm font-semibold text-danger-700 dark:text-danger-100">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-100">{success}</div> : null}

      <SectionPanel>
        <PanelHeader eyebrow="Members" title={`${team.members.length} people mapped to this project`} description="Edit role and delivery-system mappings from one compact roster." icon={UsersRound} />
        <div className="grid gap-3">
          {team.members.map((member) => {
            const isEditing = editingMemberId === member.personaId;
            const isSavingMember = savingMemberId === member.personaId;

            return (
              <article className="grid gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045] xl:grid-cols-[minmax(220px,1fr)_190px_minmax(180px,0.8fr)_minmax(180px,0.8fr)_auto]" key={member.personaId}>
                <div className="flex min-w-0 items-center gap-3">
                  <MemberAvatar initials={member.initials} />
                  <span className="min-w-0">
                    <strong className="block truncate text-sm font-black text-slate-950 dark:text-white">{member.name}</strong>
                    <small className="block truncate text-slate-500 dark:text-slate-400">{member.email}</small>
                  </span>
                </div>
                <div className="grid gap-1">
                  <small className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Role</small>
                  {isEditing ? (
                    <SelectField ariaLabel={`Project role for ${member.name}`} value={memberDraft.role} onChange={(value) => setMemberDraft((draft) => ({ ...draft, role: value as ProjectRole }))}>
                      {projectRoles.map((role) => (
                        <option value={role} key={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </SelectField>
                  ) : (
                    <strong className="text-sm text-slate-950 dark:text-white">{roleLabel(member.role)}</strong>
                  )}
                </div>
                <div className="grid gap-1">
                  <small className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Jira</small>
                  {isEditing ? (
                    <Input aria-label={`Jira account for ${member.name}`} value={memberDraft.jiraAccountId} onChange={(event) => setMemberDraft((draft) => ({ ...draft, jiraAccountId: event.target.value }))} placeholder="Jira account id or email" />
                  ) : (
                    <strong className={cn("text-sm", member.jiraAccountId ? "text-slate-950 dark:text-white" : "text-warning-700 dark:text-warning-100")}>{member.jiraAccountId || "Not mapped"}</strong>
                  )}
                </div>
                <div className="grid gap-1">
                  <small className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">GitHub</small>
                  {isEditing ? (
                    <Input aria-label={`GitHub username for ${member.name}`} value={memberDraft.githubUsername} onChange={(event) => setMemberDraft((draft) => ({ ...draft, githubUsername: event.target.value }))} placeholder="github-handle" />
                  ) : (
                    <strong className={cn("text-sm", member.githubUsername ? "text-slate-950 dark:text-white" : "text-warning-700 dark:text-warning-100")}>{member.githubUsername || "Not mapped"}</strong>
                  )}
                </div>
                {team.canEditTeam ? (
                  <div className="flex items-center justify-end gap-2">
                    {isEditing ? (
                      <>
                        <button className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 transition hover:bg-emerald-500/15 dark:text-emerald-100" type="button" onClick={() => void saveMemberMapping(member)} disabled={Boolean(savingMemberId)} aria-label={`Save mappings for ${member.name}`}>
                          {isSavingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white" type="button" onClick={cancelEditingMember} disabled={Boolean(savingMemberId)} aria-label={`Cancel editing ${member.name}`}>
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" type="button" onClick={() => startEditingMember(member)}>
                        <Edit3 className="h-4 w-4" />
                        {member.jiraAccountId && member.githubUsername ? "Edit" : "Map user"}
                      </button>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </SectionPanel>

      <section className="grid auto-rows-fr items-stretch gap-5 xl:grid-cols-2">
        {pendingInvites.length ? (
          <SectionPanel>
            <PanelHeader eyebrow="Invites" title={`${pendingInvites.length} pending signup ${pendingInvites.length === 1 ? "link" : "links"}`} icon={MailPlus} tone="warning" />
            <div className="grid gap-3">
              {pendingInvites.map((invite) => (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]" key={invite.id}>
                  <span>
                    <strong className="block text-sm font-black text-slate-950 dark:text-white">{invite.email}</strong>
                    <small className="text-slate-500 dark:text-slate-400">{roleLabel(invite.role)} · waiting for account signup</small>
                  </span>
                  <button className="inline-flex min-h-10 items-center rounded-xl bg-primary-500/10 px-4 text-sm font-black text-primary-700 dark:text-primary-100" type="button" onClick={() => void copySignupLink(invite)}>
                    Copy signup link
                  </button>
                </div>
              ))}
            </div>
          </SectionPanel>
        ) : (
          <EmptyPanel icon={MailPlus} title="No pending invites" description="Pending signup links will appear here when new people are invited by email." />
        )}

        {acceptedInvites.length ? (
          <SectionPanel>
            <PanelHeader eyebrow="Access history" title={`${acceptedInvites.length} accepted ${acceptedInvites.length === 1 ? "invite" : "invites"}`} icon={BadgeCheck} tone="success" />
            <div className="grid gap-3">
              {acceptedInvites.slice(0, 4).map((invite) => (
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]" key={invite.id}>
                  <strong className="block text-sm font-black text-slate-950 dark:text-white">{invite.email}</strong>
                  <small className="text-slate-500 dark:text-slate-400">{roleLabel(invite.role)} · accepted</small>
                </div>
              ))}
            </div>
          </SectionPanel>
        ) : (
          <EmptyPanel icon={BadgeCheck} title="No accepted invite history" description="Accepted project invitations will be listed here once users complete signup." />
        )}
      </section>
    </div>
  );
}
