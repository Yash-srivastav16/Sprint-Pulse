import { FormEvent, useEffect, useState } from "react";
import { BadgeCheck, Check, Edit3, GitBranch, Loader2, MailPlus, Save, Search, ShieldAlert, TicketCheck, UserCheck, UsersRound, X } from "lucide-react";
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
import { api, withAppRoute } from "../api";
import { useAuth } from "../context/AuthContext";
import { projectCacheKey, readProjectCache, writeProjectCache } from "../lib/projectDataCache";
import { cn } from "../lib/utils";

const projectRoles: ProjectRole[] = ["product-owner", "scrum-master", "engineering-manager", "architect", "developer", "qa"];
type TeamEntryMode = "existing" | "invite";
type TeamMember = TeamResponse["members"][number];

const roleLabel = (role: string) =>
  role === "qa"
    ? "QA"
    : role === "qa-lead"
      ? "QA Lead"
      : role
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

const isSyntheticJiraEmail = (email: string) => email.toLowerCase().endsWith("@jira.local");

const displayMemberEmail = (member: TeamMember) =>
  isSyntheticJiraEmail(member.email) ? "Imported Jira identity" : member.email;

const signalProfileForRole = (role: ProjectRole) => {
  const profiles: Record<ProjectRole, string> = {
    "product-owner": "Tracks signoff, blockers, and product risks",
    "scrum-master": "Tracks standups, blockers, and facilitation",
    "engineering-manager": "Tracks Jira ownership and delivery review",
    architect: "Tracks design decisions and architecture risks",
    developer: "Tracks standups, Jira tickets, commits, and PRs",
    qa: "Tracks validation, defects, and test-risk signals"
  };

  return profiles[role];
};

const mappingBadgeClass = (mapped: boolean) =>
  cn(
    "inline-flex min-h-7 w-fit items-center gap-1.5 rounded-full text-xs font-black",
    mapped
      ? "border border-transparent px-0 text-emerald-700 dark:text-emerald-200"
      : "border border-warning-500/30 bg-warning-500/10 px-2.5 text-warning-700 dark:text-warning-100"
  );

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
      className="min-h-11 w-full rounded-xl border border-slate-200 bg-white/85 px-3 text-sm font-bold text-slate-950 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-white/10 dark:bg-slate-950/45 dark:text-white"
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
    githubUsername: "",
    linkProfileId: ""
  });
  const [linkSearch, setLinkSearch] = useState("");

  const loadTeam = () => {
    if (!persona || !projectId) {
      return;
    }

    const cacheKey = projectCacheKey("team", [projectId, persona.id]);
    const cached = readProjectCache<TeamResponse>(cacheKey);
    if (cached) {
      setTeam(cached);
    }

    setLoading(!cached);
    setError(null);
    api
      .getProjectTeam(projectId, persona.id)
      .then((response) => {
        writeProjectCache(cacheKey, response);
        setTeam(response);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadTeam, [persona?.id, projectId]);

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
    // withAppRoute ensures the link still routes to the right container on the
    // SemicoLabs deploy platform (which keys off ?app=<uuid>). No-op locally.
    const link = withAppRoute(`${window.location.origin}${signupLinkForInvite(invite)}`);

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
      githubUsername: member.githubUsername ?? "",
      linkProfileId: ""
    });
    setLinkSearch("");
    setError(null);
    setSuccess(null);
  };

  const cancelEditingMember = () => {
    setEditingMemberId(null);
    setMemberDraft({ role: "developer", jiraAccountId: "", githubUsername: "", linkProfileId: "" });
    setLinkSearch("");
  };

  const saveMemberMapping = async (member: TeamMember) => {
    if (!persona || !projectId) {
      return;
    }

    setSavingMemberId(member.personaId);
    setError(null);
    setSuccess(null);
    try {
      const linkedUser = memberDraft.linkProfileId
        ? team?.linkableUsers?.find((user) => user.id === memberDraft.linkProfileId)
        : undefined;
      const response = memberDraft.linkProfileId
        ? await api.linkProjectMember(projectId, member.personaId, {
            personaId: persona.id,
            targetProfileId: memberDraft.linkProfileId
          })
        : await api.updateProjectMember(projectId, member.personaId, {
            personaId: persona.id,
            role: memberDraft.role,
            jiraAccountId: memberDraft.jiraAccountId,
            githubUsername: memberDraft.githubUsername
          });
      setTeam(response);
      setEditingMemberId(null);
      setLinkSearch("");
      setSuccess(
        linkedUser
          ? `${member.name}'s integration identity was linked to ${linkedUser.name}.`
          : `${member.name}'s Jira and Git mapping was updated.`
      );
      toast.success(linkedUser ? "SprintPulse user linked" : "Member mapping updated", {
        description: linkedUser ? `${member.name} -> ${linkedUser.name}` : member.name
      });
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
  const attributionGapCount = team.members.reduce(
    (total, member) => total + (member.jiraAccountId ? 0 : 1) + (member.githubUsername ? 0 : 1),
    0
  );
  const deliveryLeads = team.members.filter((member) => ["product-owner", "scrum-master", "architect"].includes(member.role)).length;
  const availableUsers = team.availableUsers ?? [];
  const linkableUsers = team.linkableUsers ?? [];
  const selectedWorkspaceUser = entryMode === "existing" ? availableUsers.find((user) => user.id === selectedProfileId) : undefined;
  const pendingInvites = team.invites.filter((invite) => invite.status === "pending");
  const acceptedInvites = team.invites.filter((invite) => invite.status === "accepted");
  const pendingInviteEmails = new Set(pendingInvites.map((invite) => invite.email.toLowerCase()));
  const externalIdentities = team.members.filter(
    (member) => isSyntheticJiraEmail(member.email) || pendingInviteEmails.has(member.email.toLowerCase())
  ).length;
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
      label: "Git mapped",
      value: `${gitMapped}/${team.members.length}`,
      detail: "Needed for commit and PR signals",
      icon: GitBranch,
      tone: "ai" as const,
      progress: team.members.length ? (gitMapped / team.members.length) * 100 : 0
    },
    {
      label: "External identities",
      value: externalIdentities,
      detail: "Imported users or pending signups",
      icon: MailPlus,
      tone: externalIdentities ? ("warning" as const) : ("success" as const),
      progress: team.members.length ? (externalIdentities / team.members.length) * 100 : 0
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
        title="Project team"
        description="Keep every SprintPulse member, Jira owner, and Git identity mapped to the right project role so blockers and delivery signals reach the correct person."
        score={attributionGapCount}
        scoreLabel="Attribution gaps"
        scoreTone={attributionGapCount ? "warning" : "success"}
        scoreDetail={
          attributionGapCount
            ? `${team.members.length - jiraMapped} Jira and ${team.members.length - gitMapped} Git mappings still need an owner.`
            : "Every project member is mapped to Jira and Git evidence."
        }
      />

      <SectionPanel className="overflow-hidden p-0">
        <div className="border-b border-slate-200/80 p-5 dark:border-white/10">
          <PanelHeader
            eyebrow="Attribution gaps"
            title="Map people before reading risk"
            description="SprintPulse can only assign blocker, Jira, PR, and commit signals correctly when each person has the right identities."
            icon={UserCheck}
            tone={attributionGapCount ? "warning" : "success"}
          />
        </div>
        <div className="grid auto-rows-fr items-stretch gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          {teamStats.map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div className="grid min-h-[160px] grid-rows-[auto_1fr_auto] rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.045]" key={stat.label}>
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
                    style={{ width: stat.progress > 0 ? `${Math.max(8, Math.min(100, stat.progress))}%` : "0%" }}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </SectionPanel>

      {team.canEditTeam ? (
        <SectionPanel className="overflow-hidden p-0">
          <form onSubmit={inviteMember}>
            <div className="border-b border-slate-200/80 p-5 dark:border-white/10">
              <PanelHeader
                eyebrow="Team access"
                title="Add project member"
                description="Add an existing SprintPulse account or create a locked invite link for someone new."
                icon={MailPlus}
                action={
                  <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/[0.055]">
                    {(["existing", "invite"] as TeamEntryMode[]).map((item) => (
                      <button
                        className={cn(
                          "min-h-10 rounded-xl px-3.5 text-sm font-black capitalize transition",
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
            </div>

            <div className="grid items-start gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid items-start gap-4 lg:grid-cols-2">
              {entryMode === "existing" ? (
                <>
                  <label className="grid gap-2 lg:col-span-2">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">Add existing SprintPulse account</span>
                    <SelectField value={selectedProfileId} onChange={setSelectedProfileId}>
                      <option value="">Choose an account</option>
                      {availableUsers.map((user) => (
                        <option value={user.id} key={user.id}>
                          {user.name} - {user.email} - {roleLabel(user.appRole)}
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
                      <MemberAvatar initials={selectedWorkspaceUser.initials} seed={selectedWorkspaceUser.name} />
                      <span className="min-w-0">
                        <strong className="block truncate text-sm font-black text-slate-950 dark:text-white">{selectedWorkspaceUser.name}</strong>
                        <small className="block truncate text-slate-500 dark:text-slate-400">{selectedWorkspaceUser.email} - {roleLabel(selectedWorkspaceUser.appRole)}</small>
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
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Git username</span>
                <Input value={githubUsername} onChange={(event) => setGithubUsername(event.target.value)} placeholder="git-handle-or-email" />
              </label>
                <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-6 text-sm font-black text-white shadow-[0_16px_40px_rgba(16,169,154,0.24)] transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60 lg:col-span-2" type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {entryMode === "existing" ? "Add selected account" : "Create invite"}
                </button>
              </div>

              <aside className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-950/25">
                <p className="m-0 text-[0.72rem] font-black uppercase tracking-[0.16em] text-primary-700 dark:text-primary-200">
                  Signal routing
                </p>
                <h3 className="m-0 mt-2 text-lg font-black text-slate-950 dark:text-white">Why mapping matters</h3>
                <p className="m-0 mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  SprintPulse uses this page to connect standup updates, Jira ownership, Git commits, and review risk to a real person.
                </p>
                <div className="mt-4 grid gap-2">
                  {[
                    ["Role", "Controls project permissions and dashboard grouping"],
                    ["Jira", "Links stale issues and blocked story points"],
                    ["Git", "Links commits, PR/MR age, and review queues"]
                  ].map(([label, detail]) => (
                    <div className="rounded-2xl border border-slate-200/80 bg-white/75 p-3 dark:border-white/10 dark:bg-white/[0.045]" key={label}>
                      <strong className="text-sm font-black text-slate-950 dark:text-white">{label}</strong>
                      <p className="m-0 mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
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
        <PanelHeader eyebrow="Member roster" title={`${team.members.length} people mapped to this project`} description="Each row shows project role, Jira owner, Git identity, and whether SprintPulse can attribute signals to that person." icon={UsersRound} />
        <div className="grid gap-3">
          {team.members.map((member) => {
            const isEditing = editingMemberId === member.personaId;
            const isSavingMember = savingMemberId === member.personaId;
            const isImportedIdentity = isSyntheticJiraEmail(member.email);
            const isPendingInvite = pendingInviteEmails.has(member.email.toLowerCase());
            const canLinkToSprintPulse = isImportedIdentity || isPendingInvite;
            const linkTargets = linkableUsers.filter((user) => user.id !== member.personaId);
            const selectedLinkUser = memberDraft.linkProfileId
              ? linkTargets.find((user) => user.id === memberDraft.linkProfileId)
              : undefined;
            const normalizedLinkSearch = linkSearch.trim().toLowerCase();
            const filteredLinkTargets = normalizedLinkSearch
              ? linkTargets.filter((user) =>
                  [user.name, user.email, roleLabel(user.appRole)].join(" ").toLowerCase().includes(normalizedLinkSearch)
                )
              : linkTargets;
            const mappingSignals = [
              {
                label: member.githubUsername ? "Git mapped" : "Git missing",
                tone: member.githubUsername ? ("success" as const) : ("warning" as const),
                title: member.githubUsername
                  ? "Commits and reviews can map through this Git identity."
                  : "Add Git username or commit email so commits and reviews map to this member."
              },
              {
                label: member.jiraAccountId ? "Jira mapped" : "Jira missing",
                tone: member.jiraAccountId ? ("success" as const) : ("warning" as const),
                title: member.jiraAccountId
                  ? "Jira issues can map through this Jira account ID or email."
                  : "Add Jira account ID or email to connect issue ownership."
              },
              {
                label: member.standupActive ? "Standup active" : "Standup quiet",
                tone: member.standupActive ? ("success" as const) : ("neutral" as const),
                title: member.standupActive
                  ? "This member has a standup update in the selected sprint."
                  : "No selected-sprint standup found for this member yet."
              }
            ];

            return (
              <article
                className={cn(
                  "rounded-3xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm transition hover:border-primary-500/25 hover:bg-white/85 dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.065]",
                  isEditing && "ring-2 ring-primary-500/20"
                )}
                key={member.personaId}
              >
                <div className="grid items-center gap-4 xl:grid-cols-[minmax(260px,0.9fr)_minmax(420px,1.35fr)_auto]">
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar initials={member.initials} seed={member.name} />
                    <span className="min-w-0">
                      <strong className="block truncate text-base font-black text-slate-950 dark:text-white">{member.name}</strong>
                      <small className="block truncate text-slate-500 dark:text-slate-400">{displayMemberEmail(member)}</small>
                      <span className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex min-h-8 items-center rounded-full border border-primary-500/20 bg-primary-500/10 px-3 text-xs font-black text-primary-700 dark:text-primary-100">
                          {roleLabel(member.role)}
                        </span>
                        {isImportedIdentity || isPendingInvite ? (
                          <span className="inline-flex min-h-8 items-center rounded-full border border-info-500/20 bg-info-500/10 px-3 text-xs font-black text-info-700 dark:text-info-100">
                            {isImportedIdentity ? "Integration identity" : "Pending signup"}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {mappingSignals.map((signal) => (
                          <StatusPill className="px-2 py-0.5 text-[0.68rem]" key={signal.label} title={signal.title} tone={signal.tone}>
                            {signal.label}
                          </StatusPill>
                        ))}
                      </span>
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200/80 bg-white/75 p-3 dark:border-white/10 dark:bg-slate-950/25">
                      <small className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Project role</small>
                      {isEditing ? (
                        <div className="mt-2">
                          <SelectField ariaLabel={`Project role for ${member.name}`} value={memberDraft.role} onChange={(value) => setMemberDraft((draft) => ({ ...draft, role: value as ProjectRole }))}>
                            {projectRoles.map((role) => (
                              <option value={role} key={role}>
                                {roleLabel(role)}
                              </option>
                            ))}
                          </SelectField>
                        </div>
                      ) : (
                        <>
                          <strong className="mt-2 block text-sm text-slate-950 dark:text-white">{roleLabel(member.role)}</strong>
                          <small className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{signalProfileForRole(member.role)}</small>
                        </>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-white/75 p-3 dark:border-white/10 dark:bg-slate-950/25">
                      <div className="flex items-center justify-between gap-2">
                        <small className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Jira</small>
                        {!isEditing ? (
                          <span className={mappingBadgeClass(Boolean(member.jiraAccountId))}>
                            {member.jiraAccountId ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                Mapped
                              </>
                            ) : (
                              "Needs map"
                            )}
                          </span>
                        ) : null}
                      </div>
                      {isEditing ? (
                        <Input className="mt-2" aria-label={`Jira account for ${member.name}`} value={memberDraft.jiraAccountId} onChange={(event) => setMemberDraft((draft) => ({ ...draft, jiraAccountId: event.target.value }))} placeholder="Jira account id or email" />
                      ) : (
                        <strong className={cn("mt-2 block truncate text-sm", member.jiraAccountId ? "text-slate-950 dark:text-white" : "text-warning-700 dark:text-warning-100")}>{member.jiraAccountId || "Not mapped"}</strong>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-white/75 p-3 dark:border-white/10 dark:bg-slate-950/25">
                      <div className="flex items-center justify-between gap-2">
                        <small className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Git</small>
                        {!isEditing ? (
                          <span className={mappingBadgeClass(Boolean(member.githubUsername))}>
                            {member.githubUsername ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                Mapped
                              </>
                            ) : (
                              "Needs map"
                            )}
                          </span>
                        ) : null}
                      </div>
                      {isEditing ? (
                        <Input className="mt-2" aria-label={`Git username for ${member.name}`} value={memberDraft.githubUsername} onChange={(event) => setMemberDraft((draft) => ({ ...draft, githubUsername: event.target.value }))} placeholder="git-handle-or-email" />
                      ) : (
                        <strong className={cn("mt-2 block truncate text-sm", member.githubUsername ? "text-slate-950 dark:text-white" : "text-warning-700 dark:text-warning-100")}>{member.githubUsername || "Not mapped"}</strong>
                      )}
                    </div>
                  </div>

                  {team.canEditTeam ? (
                    <div className="flex items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <button className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 transition hover:bg-emerald-500/15 dark:text-emerald-100" type="button" onClick={() => void saveMemberMapping(member)} disabled={Boolean(savingMemberId)} aria-label={`Save mappings for ${member.name}`}>
                            {isSavingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </button>
                          <button className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white" type="button" onClick={cancelEditingMember} disabled={Boolean(savingMemberId)} aria-label={`Cancel editing ${member.name}`}>
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" type="button" onClick={() => startEditingMember(member)}>
                          <Edit3 className="h-4 w-4" />
                          {canLinkToSprintPulse ? "Link user" : member.jiraAccountId && member.githubUsername ? "Edit" : "Map user"}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
                {isEditing && canLinkToSprintPulse ? (
                  <div className="mt-4 min-w-0 border-t border-slate-200/80 pt-4 dark:border-white/10">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <span className="flex min-w-0 gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-info-500/10 text-info-700 ring-1 ring-info-500/20 dark:text-info-100">
                          <UserCheck className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <small className="text-xs font-black uppercase tracking-[0.18em] text-info-700 dark:text-info-100">SprintPulse user</small>
                          <strong className="mt-1 block truncate text-sm font-black text-slate-950 dark:text-white">
                            {selectedLinkUser ? selectedLinkUser.name : "Keep as external identity"}
                          </strong>
                          <small className="block max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {selectedLinkUser
                              ? `${selectedLinkUser.email} - ${roleLabel(selectedLinkUser.appRole)}`
                              : "Choose a signed-up SprintPulse user to absorb this Jira/Git identity, or keep it external until signup."}
                          </small>
                        </span>
                      </span>
                      <button
                        className={cn(
                          "inline-flex min-h-9 items-center rounded-xl border px-3 text-xs font-black uppercase tracking-[0.14em] transition",
                          memberDraft.linkProfileId
                            ? "border-slate-200 bg-white text-slate-600 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white"
                            : "border-info-500/30 bg-info-500/10 text-info-700 dark:text-info-100"
                        )}
                        type="button"
                        onClick={() => setMemberDraft((draft) => ({ ...draft, linkProfileId: "" }))}
                      >
                        Keep external
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <label className="grid max-w-2xl content-start gap-2">
                        <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Find account</span>
                        <span className="relative block">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            aria-label={`Search SprintPulse users for ${member.name}`}
                            className="h-11 pl-10"
                            value={linkSearch}
                            onChange={(event) => setLinkSearch(event.target.value)}
                            placeholder="Search by name, email, or role"
                          />
                        </span>
                      </label>

                      <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-slate-950/30">
                        <div className="max-h-64 overflow-y-auto p-2">
                          {linkTargets.length ? (
                            filteredLinkTargets.length ? (
                              <div className="grid gap-2">
                                {filteredLinkTargets.map((user) => {
                                  const isSelected = memberDraft.linkProfileId === user.id;

                                  return (
                                    <button
                                      className={cn(
                                        "grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2 text-left transition",
                                        isSelected
                                          ? "bg-info-500/15 text-info-800 ring-1 ring-info-500/30 dark:text-info-100"
                                          : "text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-white/5"
                                      )}
                                      key={user.id}
                                      type="button"
                                      onClick={() => setMemberDraft((draft) => ({ ...draft, linkProfileId: user.id }))}
                                    >
                                      <MemberAvatar initials={user.initials} />
                                      <span className="min-w-0">
                                        <strong className="block truncate text-sm font-black">{user.name}</strong>
                                        <small className="block truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</small>
                                      </span>
                                      <span className="flex items-center gap-2">
                                        <small className="hidden rounded-full border border-slate-200 px-2 py-1 text-[0.68rem] font-black uppercase text-slate-500 dark:border-white/10 dark:text-slate-300 sm:inline-flex">
                                          {roleLabel(user.appRole)}
                                        </small>
                                        {isSelected ? <Check className="h-4 w-4 text-info-700 dark:text-info-100" /> : null}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="px-3 py-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                No SprintPulse users match this search.
                              </div>
                            )
                          ) : (
                            <div className="px-3 py-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                              No eligible SprintPulse users are available to link right now.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <small className="mt-3 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Linking transfers Jira/Git ownership and removes this imported placeholder from the roster.
                    </small>
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
                    <small className="text-slate-500 dark:text-slate-400">{roleLabel(invite.role)} - waiting for account signup</small>
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
                  <small className="text-slate-500 dark:text-slate-400">{roleLabel(invite.role)} - accepted</small>
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
