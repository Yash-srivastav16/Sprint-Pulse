import type {
  AppRole,
  ConfigureGitRequest,
  ConfigureGitResponse,
  ConfigureJiraRequest,
  ConfigureJiraResponse,
  CreateProjectSprintRequest,
  CreateProjectSprintResponse,
  GitCommit,
  GitConnection,
  GitSignal,
  IntegrationStatusResponse,
  InviteProjectMemberRequest,
  InviteProjectMemberResponse,
  JiraConnection,
  JiraIssue,
  MemberPulse,
  MemberPulseHistoryResponse,
  Permission,
  Persona,
  ProjectDashboardResponse,
  ProjectInvite,
  ProjectMember,
  ProjectOpsResponse,
  ProjectRole,
  ProjectStandupsResponse,
  RiskFlag,
  RiskLevel,
  SprintInfo,
  SprintListResponse,
  SprintProject,
  SprintRecommendation,
  SprintSummary,
  StandupEntry,
  StandupWithMember,
  SyncRun,
  TeamPreviewItem,
  TeamResponse,
  UpdateProjectMemberRequest
} from "@sprintpulse/shared";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { buildSupabaseProjectDetail } from "./supabaseProjects.js";
import { profilesTable, roleDefaults, toProfile, type ProfileRow } from "./supabaseProfiles.js";

type SprintRow = {
  id: string;
  project_id: string;
  name: string;
  goal: string;
  start_date: string;
  end_date: string;
  status: SprintInfo["status"];
};

type StandupRow = {
  id: string;
  project_id: string;
  sprint_id?: string | null;
  profile_id: string;
  date: string;
  yesterday: string;
  today: string;
  blockers: string;
  source: StandupEntry["source"];
  created_at: string;
};

type SyncRunRow = {
  id: string;
  project_id: string;
  source: SyncRun["source"];
  status: SyncRun["status"];
  requested_by: string;
  started_at: string;
  finished_at?: string | null;
  stats?: Record<string, string | number | boolean | null> | null;
  error_message?: string | null;
};

type JiraConnectionRow = {
  id: string;
  project_id: string;
  site_url: string;
  project_key: string;
  status: JiraConnection["status"];
  last_sync_at?: string | null;
};

type GitConnectionRow = {
  id: string;
  project_id: string;
  provider: "github";
  repo_owner: string;
  repo_name: string;
  default_branch: string;
  status: GitConnection["status"];
  last_sync_at?: string | null;
};

type JiraIssueRow = {
  id: string;
  project_id: string;
  sprint_id?: string | null;
  issue_key: string;
  summary: string;
  status: JiraIssue["status"];
  assignee_profile_id?: string | null;
  jira_assignee_id?: string | null;
  story_points?: number | null;
  updated_at_source?: string | null;
};

type GitCommitRow = {
  id: string;
  project_id: string;
  sprint_id?: string | null;
  sha: string;
  author_profile_id?: string | null;
  author_email: string;
  message: string;
  committed_at: string;
  additions?: number | null;
  deletions?: number | null;
};

type RecommendationRow = {
  id: string;
  project_id: string;
  sprint_id?: string | null;
  profile_id?: string | null;
  kind: SprintRecommendation["kind"];
  severity: RiskLevel;
  title: string;
  message: string;
  status: SprintRecommendation["status"];
  created_at: string;
};

type ProjectInviteRow = {
  id: string;
  project_id: string;
  email: string;
  role: ProjectRole;
  invited_by: string;
  status: ProjectInvite["status"];
  expires_at?: string | null;
  created_at: string;
};

type ProjectContext = {
  viewer: Persona;
  project: SprintProject;
  permissions: Permission[];
};

type ProjectSignals = {
  sprints: SprintRow[];
  sprint: SprintInfo;
  standups: StandupRow[];
  issues: JiraIssue[];
  commits: GitCommit[];
  recommendations: SprintRecommendation[];
  jira: JiraConnection | null;
  git: GitConnection | null;
  runs: SyncRun[];
};

const requireSupabaseAdmin = () => {
  if (!supabaseAdmin) {
    throw new Error("Backend Supabase Admin is not configured.");
  }

  return supabaseAdmin;
};

const permissionsForProject = (viewer: Persona, project: SprintProject): Permission[] => {
  const membership = project.members.find((member) => member.personaId === viewer.id);
  const canViewPortfolio = viewer.productPersona === "product-owner";
  const isMember = Boolean(membership);
  const projectVisible = canViewPortfolio || project.createdBy === viewer.id || isMember;
  const teamVisibility =
    canViewPortfolio ||
    project.createdBy === viewer.id ||
    Boolean(membership && ["product-owner", "scrum-master", "engineering-manager", "architect", "qa"].includes(membership.role));
  const canManage =
    project.createdBy === viewer.id ||
    Boolean(membership && ["product-owner", "scrum-master", "engineering-manager"].includes(membership.role));
  const permissions: Permission[] = [];

  if (projectVisible) {
    permissions.push("project:view", "dashboard:viewOwn", "member:viewOwn", "standup:submit");
  }
  if (teamVisibility) {
    permissions.push("dashboard:viewTeam", "member:viewTeam");
  }
  if (canManage) {
    permissions.push("project:create", "project:connect", "project:editTeam", "standup:sync");
  }

  return [...new Set(permissions)];
};

const loadProjectContext = async (projectId: string, personaId: string): Promise<ProjectContext | undefined> => {
  const detail = await buildSupabaseProjectDetail(projectId, personaId);
  if (!detail) {
    return undefined;
  }

  return {
    viewer: detail.viewer,
    project: detail.project,
    permissions: permissionsForProject(detail.viewer, detail.project)
  };
};

const daysIdle = (updatedAt?: string) => {
  if (!updatedAt) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / (24 * 60 * 60 * 1000)));
};

const toSprintInfo = (row: SprintRow): SprintInfo => ({
  id: row.id,
  name: row.name,
  goal: row.goal,
  startDate: row.start_date,
  endDate: row.end_date,
  status: row.status
});

const toSyncRun = (row: SyncRunRow): SyncRun => ({
  id: row.id,
  projectId: row.project_id,
  source: row.source,
  status: row.status,
  requestedBy: row.requested_by,
  startedAt: row.started_at,
  finishedAt: row.finished_at ?? undefined,
  stats: row.stats ?? {},
  errorMessage: row.error_message ?? undefined
});

const toJiraConnection = (row: JiraConnectionRow): JiraConnection => ({
  id: row.id,
  projectId: row.project_id,
  siteUrl: row.site_url,
  projectKey: row.project_key,
  status: row.status,
  lastSyncAt: row.last_sync_at ?? undefined
});

const toGitConnection = (row: GitConnectionRow): GitConnection => ({
  id: row.id,
  projectId: row.project_id,
  provider: row.provider,
  repoOwner: row.repo_owner,
  repoName: row.repo_name,
  defaultBranch: row.default_branch,
  status: row.status,
  lastSyncAt: row.last_sync_at ?? undefined
});

const toJiraIssue = (row: JiraIssueRow): JiraIssue => ({
  id: row.id,
  projectId: row.project_id,
  sprintId: row.sprint_id ?? undefined,
  issueKey: row.issue_key,
  summary: row.summary,
  status: row.status,
  assigneeProfileId: row.assignee_profile_id ?? undefined,
  jiraAssigneeId: row.jira_assignee_id ?? undefined,
  storyPoints: row.story_points ?? undefined,
  daysIdle: daysIdle(row.updated_at_source ?? undefined),
  updatedAtSource: row.updated_at_source ?? undefined
});

const toGitCommit = (row: GitCommitRow): GitCommit => ({
  id: row.id,
  projectId: row.project_id,
  sprintId: row.sprint_id ?? undefined,
  sha: row.sha,
  authorProfileId: row.author_profile_id ?? undefined,
  authorEmail: row.author_email,
  message: row.message,
  committedAt: row.committed_at,
  additions: row.additions ?? 0,
  deletions: row.deletions ?? 0
});

const toRecommendation = (row: RecommendationRow): SprintRecommendation => ({
  id: row.id,
  projectId: row.project_id,
  sprintId: row.sprint_id ?? undefined,
  profileId: row.profile_id ?? undefined,
  kind: row.kind,
  severity: row.severity,
  title: row.title,
  message: row.message,
  status: row.status,
  createdAt: row.created_at
});

const toInvite = (row: ProjectInviteRow): ProjectInvite => ({
  id: row.id,
  projectId: row.project_id,
  email: row.email,
  role: row.role,
  invitedBy: row.invited_by,
  status: row.status,
  expiresAt: row.expires_at ?? undefined,
  createdAt: row.created_at
});

const fetchSprints = async (projectId: string) => {
  const client = requireSupabaseAdmin();
  const { data, error } = await client
    .from("sprints")
    .select("*")
    .eq("project_id", projectId)
    .order("start_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SprintRow[];
};

const currentSprintFrom = (project: SprintProject, sprints: SprintRow[]): SprintRow =>
  sprints.find((sprint) => sprint.status === "active") ??
  sprints[0] ?? {
    id: project.sprint.id,
    project_id: project.id,
    name: project.sprint.name,
    goal: project.sprint.goal,
    start_date: project.sprint.startDate,
    end_date: project.sprint.endDate,
    status: project.sprint.status
  };

const fetchSignals = async (project: SprintProject, sprintId?: string): Promise<ProjectSignals> => {
  const client = requireSupabaseAdmin();
  const sprints = await fetchSprints(project.id);
  const selectedSprint = sprintId
    ? sprints.find((sprint) => sprint.id === sprintId) ?? currentSprintFrom(project, sprints)
    : currentSprintFrom(project, sprints);
  const [
    { data: standups, error: standupsError },
    { data: issues, error: issuesError },
    { data: commits, error: commitsError },
    { data: recommendations, error: recommendationsError },
    { data: jira, error: jiraError },
    { data: git, error: gitError },
    { data: runs, error: runsError }
  ] = await Promise.all([
    client
      .from("standups")
      .select("*")
      .eq("project_id", project.id)
      .eq("sprint_id", selectedSprint.id)
      .order("date", { ascending: false }),
    client.from("jira_issues").select("*").eq("project_id", project.id).eq("sprint_id", selectedSprint.id),
    client
      .from("git_commits")
      .select("*")
      .eq("project_id", project.id)
      .eq("sprint_id", selectedSprint.id)
      .order("committed_at", { ascending: false }),
    client
      .from("recommendations")
      .select("*")
      .eq("project_id", project.id)
      .eq("sprint_id", selectedSprint.id)
      .order("created_at", { ascending: false }),
    client.from("jira_connections").select("*").eq("project_id", project.id).maybeSingle(),
    client.from("git_connections").select("*").eq("project_id", project.id).maybeSingle(),
    client.from("sync_runs").select("*").eq("project_id", project.id).order("started_at", { ascending: false }).limit(8)
  ]);

  for (const error of [standupsError, issuesError, commitsError, recommendationsError, jiraError, gitError, runsError]) {
    if (error) {
      throw new Error(error.message);
    }
  }

  return {
    sprints,
    sprint: toSprintInfo(selectedSprint),
    standups: (standups ?? []) as StandupRow[],
    issues: ((issues ?? []) as JiraIssueRow[]).map(toJiraIssue),
    commits: ((commits ?? []) as GitCommitRow[]).map(toGitCommit),
    recommendations: ((recommendations ?? []) as RecommendationRow[]).map(toRecommendation),
    jira: jira ? toJiraConnection(jira as JiraConnectionRow) : null,
    git: git ? toGitConnection(git as GitConnectionRow) : null,
    runs: ((runs ?? []) as SyncRunRow[]).map(toSyncRun)
  };
};

const blockerIsOpen = (blockers: string) => {
  const normalized = blockers.trim().toLowerCase();
  return Boolean(normalized) && !["no blocker.", "no blocker", "no blockers", "none", "n/a", "na", "-"].includes(normalized);
};

const standupToMember = (row: StandupRow, project: SprintProject): StandupWithMember => {
  const member = project.members.find((item) => item.personaId === row.profile_id);
  return {
    id: row.id,
    projectId: row.project_id,
    sprintId: row.sprint_id ?? undefined,
    memberId: row.profile_id,
    date: row.date,
    yesterday: row.yesterday,
    today: row.today,
    blockers: row.blockers,
    source: row.source,
    memberName: member?.name ?? row.profile_id,
    memberInitials: member?.initials ?? row.profile_id.slice(0, 2).toUpperCase()
  };
};

const memberHackathonRole = (role: ProjectRole): MemberPulse["hackathonRole"] => {
  if (role === "qa") {
    return "qa";
  }
  if (role === "architect" || role === "engineering-manager" || role === "product-owner" || role === "scrum-master") {
    return "architect";
  }
  return "frontend";
};

const riskLevelFor = (score: number): RiskLevel => {
  if (score < 45) {
    return "critical";
  }
  if (score < 65) {
    return "high";
  }
  if (score < 78) {
    return "medium";
  }
  return "low";
};

const buildMemberPulse = (project: SprintProject, member: ProjectMember, signals: ProjectSignals): MemberPulse => {
  const standups = signals.standups
    .filter((standup) => standup.profile_id === member.personaId)
    .map((standup) => standupToMember(standup, project));
  const latestStandup = standups[0];
  const issues = signals.issues.filter((issue) => issue.assigneeProfileId === member.personaId);
  const commits = signals.commits.filter((commit) => commit.authorProfileId === member.personaId);
  const openIssues = issues.filter((issue) => issue.status !== "Done");
  const blockedIssues = issues.filter((issue) => issue.status === "Blocked");
  const hasOpenBlocker = standups.some((standup) => blockerIsOpen(standup.blockers));
  const noStandup = standups.length === 0;
  const idleIssueCount = openIssues.filter((issue) => issue.daysIdle >= 3).length;
  const flags: RiskFlag[] = [];
  let score = 90;

  if (noStandup) {
    score -= 16;
    flags.push({
      id: `${member.personaId}-missing-standup`,
      type: "STALE_WORK",
      severity: "medium",
      title: "No standup in active sprint",
      message: `${member.name} has not submitted an update for ${signals.sprint.name}.`
    });
  }
  if (hasOpenBlocker) {
    score -= 14;
    flags.push({
      id: `${member.personaId}-blocker`,
      type: "BLOCKER_ANOMALY",
      severity: "high",
      title: "Blocker needs attention",
      message: `${member.name} reported a blocker in the current sprint.`
    });
  }
  if (blockedIssues.length) {
    score -= 12;
    flags.push({
      id: `${member.personaId}-blocked-issue`,
      type: "SAY_DO_GAP",
      severity: "high",
      title: "Jira issue is blocked",
      message: `${blockedIssues[0].issueKey} is blocked and assigned to ${member.name}.`
    });
  }
  if (idleIssueCount) {
    score -= Math.min(18, idleIssueCount * 7);
    flags.push({
      id: `${member.personaId}-idle-issue`,
      type: "STALE_WORK",
      severity: idleIssueCount > 1 ? "high" : "medium",
      title: "Issue movement is stale",
      message: `${idleIssueCount} assigned issue${idleIssueCount > 1 ? "s" : ""} have not moved recently.`
    });
  }
  if (!commits.length && openIssues.length) {
    score -= 8;
    flags.push({
      id: `${member.personaId}-no-commits`,
      type: "SAY_DO_GAP",
      severity: "medium",
      title: "Ticket work has low Git activity",
      message: `${member.name} has active Jira work but no synced commits for this sprint.`
    });
  }

  score = Math.max(36, Math.min(98, score + Math.min(6, commits.length)));
  const riskLevel = riskLevelFor(score);
  const currentFocus = latestStandup?.today ?? openIssues[0]?.summary ?? "No current focus has been captured yet.";
  const recommendation =
    riskLevel === "low"
      ? `${member.name} looks steady. Keep the sprint signal fresh with daily updates.`
      : hasOpenBlocker
        ? `Have a focused blocker check-in with ${member.name} and agree on the next owner.`
        : idleIssueCount
          ? `Review stale Jira movement with ${member.name} and split work if needed.`
          : `Ask ${member.name} for a concrete next update and confirm delivery evidence.`;

  return {
    id: member.personaId,
    personaId: member.personaId,
    name: member.name,
    initials: member.initials,
    title: member.role
      .split("-")
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(" "),
    hackathonRole: memberHackathonRole(member.role),
    productPersona: member.role === "qa" ? "qa-lead" : member.role === "developer" ? "developer" : "scrum-master",
    healthScore: score,
    riskLevel,
    currentFocus,
    recommendation,
    tickets: issues.map((issue) => ({
      key: issue.issueKey,
      title: issue.summary,
      status: issue.status,
      daysIdle: issue.daysIdle
    })),
    git: {
      commitsThisSprint: commits.length,
      pullRequestsOpen: Math.max(0, Math.min(3, Math.floor(openIssues.length / 2))),
      lastCommitAt: commits[0]?.committedAt ?? new Date(0).toISOString(),
      codeChurn:
        commits.reduce((total, commit) => total + commit.additions + commit.deletions, 0) > 220
          ? "high"
          : commits.length > 2
            ? "medium"
            : "low"
    } satisfies GitSignal,
    flags,
    standups
  };
};

const buildPulses = (project: SprintProject, signals: ProjectSignals) =>
  project.members.map((member) => buildMemberPulse(project, member, signals));

const buildDashboard = (
  context: ProjectContext,
  signals: ProjectSignals,
  memberId?: string
): ProjectDashboardResponse => {
  const allPulses = buildPulses(context.project, signals);
  const hasTeamScope = context.permissions.includes("dashboard:viewTeam");
  const visiblePulses = hasTeamScope ? allPulses : allPulses.filter((pulse) => pulse.personaId === context.viewer.id);
  const memberPulses =
    memberId && (!hasTeamScope && memberId !== context.viewer.id)
      ? []
      : memberId
        ? allPulses.filter((pulse) => pulse.personaId === memberId)
        : visiblePulses;
  const viewerPulse = allPulses.find((pulse) => pulse.personaId === context.viewer.id) ?? memberPulses[0] ?? allPulses[0];

  if (!viewerPulse) {
    throw new Error("No project members found.");
  }

  const flags = memberPulses.flatMap((pulse) => pulse.flags);
  const teamHealthScore = memberPulses.length
    ? Math.round(memberPulses.reduce((total, pulse) => total + pulse.healthScore, 0) / memberPulses.length)
    : 0;
  const atRiskCount = memberPulses.filter((pulse) => pulse.healthScore < 70).length;
  const recommendations = memberPulses
    .filter((pulse) => pulse.riskLevel !== "low")
    .map((pulse) => pulse.recommendation)
    .slice(0, 4);

  return {
    viewer: context.viewer,
    scope: hasTeamScope ? "team" : "individual",
    project: context.project,
    summary: {
      sprintName: signals.sprint.name,
      sprintWindow: `${signals.sprint.startDate} to ${signals.sprint.endDate}`,
      teamHealthScore,
      atRiskCount,
      openBlockers: signals.standups.filter((standup) => blockerIsOpen(standup.blockers)).length,
      totalFlags: flags.length,
      readinessScore: Math.max(0, Math.min(100, teamHealthScore - atRiskCount * 4))
    },
    viewerPulse,
    memberPulses,
    teamPreview: memberPulses.map((pulse): TeamPreviewItem => ({
      id: pulse.personaId,
      name: pulse.name,
      initials: pulse.initials,
      role: pulse.hackathonRole,
      score: pulse.healthScore,
      riskLevel: pulse.riskLevel
    })),
    recommendations: recommendations.length
      ? recommendations
      : ["Sprint signal is clean. Keep daily standups and delivery sync current."]
  };
};

const toSprintSummary = (
  sprint: SprintRow,
  signals: Pick<ProjectSignals, "standups" | "issues" | "commits">
): SprintSummary => {
  const issueCount = signals.issues.filter((issue) => issue.sprintId === sprint.id).length;
  const standupCount = signals.standups.filter((standup) => standup.sprint_id === sprint.id).length;
  const commitCount = signals.commits.filter((commit) => commit.sprintId === sprint.id).length;
  const blockerCount = signals.standups.filter((standup) => standup.sprint_id === sprint.id && blockerIsOpen(standup.blockers)).length;

  return {
    ...toSprintInfo(sprint),
    issueCount,
    standupCount,
    commitCount,
    blockerCount,
    healthScore: Math.max(0, Math.min(100, 72 + commitCount * 2 + standupCount * 3 - blockerCount * 8))
  };
};

export const buildSupabaseProjectOps = async (
  projectId: string,
  personaId: string
): Promise<ProjectOpsResponse | undefined> => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context) {
    return undefined;
  }

  const signals = await fetchSignals(context.project);
  const pulses = buildPulses(context.project, signals);
  const memberCount = context.project.members.length || 1;

  return {
    viewer: context.viewer,
    project: context.project,
    permissions: context.permissions,
    currentSprint: toSprintSummary(currentSprintFrom(context.project, signals.sprints), signals),
    summary: {
      teamHealthScore: pulses.length
        ? Math.round(pulses.reduce((total, pulse) => total + pulse.healthScore, 0) / pulses.length)
        : 0,
      participationRate: Math.round((new Set(signals.standups.map((standup) => standup.profile_id)).size / memberCount) * 100),
      openBlockers: signals.standups.filter((standup) => blockerIsOpen(standup.blockers)).length,
      atRiskCount: pulses.filter((pulse) => pulse.healthScore < 70).length,
      issueCount: signals.issues.length,
      commitCount: signals.commits.length,
      standupCount: signals.standups.length,
      lastSyncAt: signals.runs[0]?.finishedAt ?? context.project.lastSyncAt
    },
    integrations: {
      jira: signals.jira,
      git: signals.git,
      recentRuns: signals.runs
    }
  };
};

export const buildSupabaseSprintList = async (
  projectId: string,
  personaId: string
): Promise<SprintListResponse | undefined> => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context) {
    return undefined;
  }

  const signals = await fetchSignals(context.project);
  const summaries = signals.sprints.map((sprint) => toSprintSummary(sprint, signals));
  return {
    viewer: context.viewer,
    project: context.project,
    currentSprint: summaries.find((sprint) => sprint.status === "active"),
    sprints: summaries
  };
};

export const createSupabaseProjectSprint = async (
  projectId: string,
  input: CreateProjectSprintRequest
): Promise<CreateProjectSprintResponse | undefined> => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context) {
    return undefined;
  }

  if (!context.permissions.includes("project:connect")) {
    throw new Error("You do not have permission to manage sprints for this project.");
  }

  const client = requireSupabaseAdmin();
  const now = new Date().toISOString();
  const status = input.status === "active" ? "active" : "planned";

  if (status === "active") {
    const closeActive = await client
      .from("sprints")
      .update({ status: "closed", updated_at: now })
      .eq("project_id", projectId)
      .eq("status", "active");

    if (closeActive.error) {
      throw new Error(closeActive.error.message);
    }
  }

  const inserted = await client
    .from("sprints")
    .insert({
      project_id: projectId,
      name: input.name.trim(),
      goal: input.goal.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      status,
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (inserted.error) {
    throw new Error(inserted.error.message);
  }

  const sprintList = await buildSupabaseSprintList(projectId, input.personaId);
  if (!sprintList) {
    return undefined;
  }

  const createdSprint =
    sprintList.sprints.find((sprint) => sprint.id === (inserted.data as SprintRow).id) ??
    toSprintSummary(inserted.data as SprintRow, { standups: [], issues: [], commits: [] });

  return {
    ...sprintList,
    createdSprint
  };
};

export const buildSupabaseTeam = async (projectId: string, personaId: string): Promise<TeamResponse | undefined> => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context) {
    return undefined;
  }

  const client = requireSupabaseAdmin();
  const canEditTeam = context.permissions.includes("project:editTeam");
  const { data, error } = await client
    .from("project_invites")
    .select("*")
    .eq("project_id", context.project.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  let availableUsers: ReturnType<typeof toProfile>[] = [];
  if (canEditTeam) {
    const memberIds = new Set(context.project.members.map((member) => member.personaId));
    const profiles = await client
      .from(profilesTable)
      .select("*")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (profiles.error) {
      throw new Error(profiles.error.message);
    }

    availableUsers = ((profiles.data ?? []) as ProfileRow[])
      .map(toProfile)
      .filter((profile) => !memberIds.has(profile.id));
  }

  return {
    viewer: context.viewer,
    project: context.project,
    permissions: context.permissions,
    members: context.project.members,
    availableUsers,
    invites: ((data ?? []) as ProjectInviteRow[]).map(toInvite),
    canEditTeam
  };
};

const slugFromEmail = (email: string) =>
  email
    .trim()
    .toLowerCase()
    .split("@")[0]
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const initialsFromName = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "SP";

export const inviteSupabaseProjectMember = async (
  projectId: string,
  input: InviteProjectMemberRequest
): Promise<InviteProjectMemberResponse> => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context?.permissions.includes("project:editTeam")) {
    throw new Error("You do not have permission to edit this team.");
  }

  const client = requireSupabaseAdmin();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const defaults = roleDefaults[input.appRole];
  const existing = await client.from(profilesTable).select("*").eq("email", email).maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  let profile = (existing.data as ProfileRow | null) ?? null;
  if (!profile) {
    const inserted = await client
      .from(profilesTable)
      .insert({
        id: slugFromEmail(email) || `user-${Date.now()}`,
        auth_user_id: null,
        email,
        name,
        initials: initialsFromName(name),
        title: input.title?.trim() || defaults.title,
        app_role: input.appRole,
        product_persona: defaults.productPersona,
        access_scope: defaults.accessScope,
        status: "invited",
        created_at: new Date().toISOString(),
        invited_by: input.personaId
      })
      .select()
      .single();

    if (inserted.error) {
      throw new Error(inserted.error.message);
    }
    profile = inserted.data as ProfileRow;
  }

  const hasAccount = Boolean(profile.auth_user_id);
  const memberRow = {
    project_id: projectId,
    profile_id: profile.id,
    role: input.projectRole,
    jira_account_id: input.jiraAccountId?.trim() || null,
    github_username: input.githubUsername?.trim() || null
  };

  if (hasAccount) {
    const memberWrite = await client.from("project_members").upsert(memberRow).select().single();
    if (memberWrite.error) {
      throw new Error(memberWrite.error.message);
    }
  }

  const inviteWrite = await client
    .from("project_invites")
    .upsert(
      {
        project_id: projectId,
        email,
        role: input.projectRole,
        invited_by: input.personaId,
        status: hasAccount ? "accepted" : "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      { onConflict: "project_id,email" }
    )
    .select()
    .single();

  if (inviteWrite.error) {
    throw new Error(inviteWrite.error.message);
  }

  return {
    profile: toProfile(profile),
    member: {
      personaId: profile.id,
      name: profile.name,
      email: profile.email,
      initials: profile.initials,
      role: input.projectRole,
      jiraAccountId: input.jiraAccountId,
      githubUsername: input.githubUsername
    },
    invite: toInvite(inviteWrite.data as ProjectInviteRow),
    warnings: []
  };
};

export const updateSupabaseProjectMember = async (
  projectId: string,
  profileId: string,
  input: UpdateProjectMemberRequest
): Promise<TeamResponse | undefined> => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context?.permissions.includes("project:editTeam")) {
    throw new Error("You do not have permission to edit this team.");
  }

  const client = requireSupabaseAdmin();
  const update: Record<string, string | null> = {};
  if (input.role) {
    update.role = input.role;
  }
  if (input.jiraAccountId !== undefined) {
    update.jira_account_id = input.jiraAccountId.trim() || null;
  }
  if (input.githubUsername !== undefined) {
    update.github_username = input.githubUsername.trim() || null;
  }

  const { error } = await client.from("project_members").update(update).eq("project_id", projectId).eq("profile_id", profileId);
  if (error) {
    throw new Error(error.message);
  }

  return buildSupabaseTeam(projectId, input.personaId);
};

export const buildSupabaseIntegrations = async (
  projectId: string,
  personaId: string
): Promise<IntegrationStatusResponse | undefined> => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context) {
    return undefined;
  }

  const signals = await fetchSignals(context.project);
  return {
    viewer: context.viewer,
    project: context.project,
    permissions: context.permissions,
    jira: signals.jira,
    git: signals.git,
    recentRuns: signals.runs,
    issuePreview: signals.issues.slice(0, 8),
    commitPreview: signals.commits.slice(0, 8)
  };
};

const insertSyncRun = async (
  projectId: string,
  personaId: string,
  source: SyncRun["source"],
  stats: SyncRun["stats"]
) => {
  const client = requireSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("sync_runs")
    .insert({
      project_id: projectId,
      source,
      status: "succeeded",
      requested_by: personaId,
      started_at: now,
      finished_at: now,
      stats
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toSyncRun(data as SyncRunRow);
};

export const configureSupabaseJira = async (
  projectId: string,
  input: ConfigureJiraRequest
): Promise<ConfigureJiraResponse> => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context?.permissions.includes("project:connect")) {
    throw new Error("You do not have permission to configure Jira.");
  }

  const client = requireSupabaseAdmin();
  const { data, error } = await client
    .from("jira_connections")
    .upsert(
      {
        project_id: projectId,
        site_url: input.jiraSite.trim().replace(/^https?:\/\//, ""),
        project_key: input.projectKey.trim().toUpperCase(),
        status: "configured",
        created_by: input.personaId,
        updated_at: new Date().toISOString()
      },
      { onConflict: "project_id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    connection: toJiraConnection(data as JiraConnectionRow),
    importedIssues: 0,
    warnings: ["Jira is configured. Run sync to import sprint issues."]
  };
};

export const syncSupabaseJira = async (projectId: string, personaId: string): Promise<ConfigureJiraResponse> => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context?.permissions.includes("project:connect")) {
    throw new Error("You do not have permission to sync Jira.");
  }

  const client = requireSupabaseAdmin();
  const signals = await fetchSignals(context.project);
  if (!signals.jira) {
    throw new Error("Configure Jira before running sync.");
  }

  const statuses: JiraIssue["status"][] = ["In Progress", "Review", "Blocked", "Todo", "Done"];
  const rows = context.project.members.flatMap((member, memberIndex) =>
    [0, 1].map((offset) => {
      const status = statuses[(memberIndex + offset) % statuses.length];
      return {
        project_id: projectId,
        sprint_id: signals.sprint.id,
        issue_key: `${signals.jira?.projectKey ?? context.project.key}-${100 + memberIndex * 2 + offset}`,
        summary:
          offset === 0
            ? `Deliver ${context.project.key} sprint task for ${member.name}`
            : `Review and stabilize ${member.role.replace("-", " ")} workflow`,
        status,
        assignee_profile_id: member.personaId,
        jira_assignee_id: member.jiraAccountId ?? member.email,
        story_points: offset === 0 ? 5 : 3,
        updated_at_source: new Date(Date.now() - (status === "Blocked" ? 4 : offset + 1) * 24 * 60 * 60 * 1000).toISOString(),
        raw: { demoSafe: true }
      };
    })
  );

  const { error } = await client.from("jira_issues").upsert(rows, { onConflict: "project_id,issue_key" });
  if (error) {
    throw new Error(error.message);
  }

  const now = new Date().toISOString();
  await Promise.all([
    client.from("jira_connections").update({ status: "synced", last_sync_at: now, updated_at: now }).eq("project_id", projectId),
    client.from("projects").update({ last_sync_at: now, updated_at: now }).eq("id", projectId)
  ]);
  const run = await insertSyncRun(projectId, personaId, "jira", {
    importedIssues: rows.length,
    importedMembers: context.project.members.length
  });

  return {
    connection: { ...signals.jira, status: "synced", lastSyncAt: now },
    run,
    importedIssues: rows.length,
    warnings: ["Guided Jira sync imported sprint issues without storing external tokens."]
  };
};

export const configureSupabaseGit = async (
  projectId: string,
  input: ConfigureGitRequest
): Promise<ConfigureGitResponse> => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context?.permissions.includes("project:connect")) {
    throw new Error("You do not have permission to configure Git.");
  }

  const client = requireSupabaseAdmin();
  const { data, error } = await client
    .from("git_connections")
    .upsert(
      {
        project_id: projectId,
        provider: input.provider,
        repo_owner: input.repoOwner.trim(),
        repo_name: input.repoName.trim(),
        default_branch: input.defaultBranch?.trim() || "main",
        status: "configured",
        created_by: input.personaId,
        updated_at: new Date().toISOString()
      },
      { onConflict: "project_id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    connection: toGitConnection(data as GitConnectionRow),
    importedCommits: 0,
    warnings: ["GitHub is configured. Run sync to import commit activity."]
  };
};

export const syncSupabaseGit = async (projectId: string, personaId: string): Promise<ConfigureGitResponse> => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context?.permissions.includes("project:connect")) {
    throw new Error("You do not have permission to sync Git.");
  }

  const client = requireSupabaseAdmin();
  const signals = await fetchSignals(context.project);
  if (!signals.git) {
    throw new Error("Configure Git before running sync.");
  }

  const todayKey = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const rows = context.project.members.flatMap((member, memberIndex) => {
    const commitCount = memberIndex % 3 === 0 ? 0 : 2 + (memberIndex % 2);
    return Array.from({ length: commitCount }, (_, index) => ({
      project_id: projectId,
      sprint_id: signals.sprint.id,
      sha: `${context.project.key.toLowerCase()}-${todayKey}-${member.personaId}-${index}`,
      author_profile_id: member.personaId,
      author_email: member.email,
      message: index === 0 ? `Implement ${context.project.key} flow for ${member.name}` : `Refine sprint task ${index + 1}`,
      committed_at: new Date(Date.now() - (index + memberIndex + 1) * 8 * 60 * 60 * 1000).toISOString(),
      additions: 24 + index * 12,
      deletions: 5 + memberIndex,
      raw: { demoSafe: true, repo: `${signals.git?.repoOwner}/${signals.git?.repoName}` }
    }));
  });

  if (rows.length) {
    const { error } = await client.from("git_commits").upsert(rows, { onConflict: "project_id,sha" });
    if (error) {
      throw new Error(error.message);
    }
  }

  const now = new Date().toISOString();
  await Promise.all([
    client.from("git_connections").update({ status: "synced", last_sync_at: now, updated_at: now }).eq("project_id", projectId),
    client.from("projects").update({ last_sync_at: now, updated_at: now }).eq("id", projectId)
  ]);
  const run = await insertSyncRun(projectId, personaId, "git", {
    importedCommits: rows.length,
    repo: `${signals.git.repoOwner}/${signals.git.repoName}`
  });

  return {
    connection: { ...signals.git, status: "synced", lastSyncAt: now },
    run,
    importedCommits: rows.length,
    warnings: ["Guided Git sync imported commits without storing external tokens."]
  };
};

export const buildSupabaseProjectStandups = async (
  projectId: string,
  personaId: string,
  sprintId?: string
): Promise<ProjectStandupsResponse | undefined> => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context) {
    return undefined;
  }

  const signals = await fetchSignals(context.project, sprintId);
  return {
    viewer: context.viewer,
    project: context.project,
    sprint: signals.sprint,
    standups: signals.standups.map((standup) => standupToMember(standup, context.project)),
    canSubmit: context.permissions.includes("standup:submit"),
    canSync: context.permissions.includes("standup:sync")
  };
};

export const submitSupabaseProjectStandup = async (
  projectId: string,
  input: { personaId: string; yesterday: string; today: string; blockers: string }
) => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context?.permissions.includes("standup:submit")) {
    throw new Error("You do not have permission to submit standups for this project.");
  }

  const client = requireSupabaseAdmin();
  const signals = await fetchSignals(context.project);
  const { data, error } = await client
    .from("standups")
    .insert({
      project_id: projectId,
      sprint_id: signals.sprint.id,
      profile_id: input.personaId,
      date: new Date().toISOString().slice(0, 10),
      yesterday: input.yesterday.trim(),
      today: input.today.trim(),
      blockers: input.blockers.trim() || "No blocker.",
      source: "manual"
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const dashboard = buildDashboard(context, await fetchSignals(context.project));
  const member = dashboard.memberPulses.find((pulse) => pulse.personaId === input.personaId) ?? dashboard.viewerPulse;

  return {
    entry: standupToMember(data as StandupRow, context.project),
    member,
    project: context.project
  };
};

const parsedFields = (line: string) => {
  const clean = line.replace(/\s+/g, " ").trim();
  const yesterday = clean.match(/yesterday[^.:-]*[:,-]?\s*([^.;]+)/i)?.[1] ?? "Shared previous progress in standup.";
  const today =
    clean.match(/today[^.:-]*[:,-]?\s*([^.;]+)/i)?.[1] ??
    (clean.split(":").slice(1).join(":").trim() || "Continue planned sprint work.");
  const blockers = clean.match(/blockers?[^.:-]*[:,-]?\s*([^.;]+)/i)?.[1] ?? "No blocker.";

  return { yesterday, today, blockers };
};

export const parseSupabaseProjectTranscript = async (
  projectId: string,
  personaId: string,
  transcript: string
) => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context) {
    throw new Error("Project not found or not visible to this user.");
  }

  const client = requireSupabaseAdmin();
  const signals = await fetchSignals(context.project);
  const lines = transcript
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parseMembers = context.permissions.includes("standup:sync")
    ? context.project.members
    : context.project.members.filter((member) => member.personaId === personaId);
  const parsed = parseMembers
    .map((member, index) => {
      const memberLine =
        lines.find((line) => line.toLowerCase().startsWith(`${member.name.toLowerCase()}:`)) ??
        lines.find((line) => line.toLowerCase().startsWith(`${member.name.split(" ")[0].toLowerCase()}:`));
      if (!memberLine && index > 3) {
        return null;
      }

      const fields = parsedFields(memberLine ?? `${member.name}: ${lines[index] ?? "Today I continued sprint work. No blockers."}`);
      return {
        memberId: member.personaId,
        name: member.name,
        yesterday: fields.yesterday,
        today: fields.today,
        blockers: fields.blockers,
        confidence: memberLine ? 0.86 : 0.68
      };
    })
    .filter((entry): entry is { memberId: string; name: string; yesterday: string; today: string; blockers: string; confidence: number } =>
      Boolean(entry)
    );

  if (parsed.length) {
    const { error } = await client.from("standups").insert(
      parsed.map((entry) => ({
        project_id: projectId,
        sprint_id: signals.sprint.id,
        profile_id: entry.memberId,
        date: new Date().toISOString().slice(0, 10),
        yesterday: entry.yesterday,
        today: entry.today,
        blockers: entry.blockers || "No blocker.",
        source: "transcript",
        source_ref: "transcript-paste",
        parsed_confidence: entry.confidence
      }))
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  return {
    mode: "transcript-parser",
    note: "Transcript entries were saved to the active sprint.",
    project: context.project,
    parsed
  };
};

export const syncSupabaseProjectStandups = async (projectId: string, personaId: string) => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context?.permissions.includes("standup:sync")) {
    throw new Error("You do not have permission to sync standups for this project.");
  }

  const client = requireSupabaseAdmin();
  const signals = await fetchSignals(context.project);
  const today = new Date().toISOString().slice(0, 10);
  const existingToday = new Set(signals.standups.filter((standup) => standup.date === today).map((standup) => standup.profile_id));
  const rows = context.project.members
    .filter((member) => !existingToday.has(member.personaId))
    .map((member) => ({
      project_id: projectId,
      sprint_id: signals.sprint.id,
      profile_id: member.personaId,
      date: today,
      yesterday: `Synced delivery activity for ${member.name}.`,
      today: `Continue active ${context.project.key} sprint work.`,
      blockers: member.role === "developer" ? "No blocker." : "Review team dependencies.",
      source: "transcript" as const,
      source_ref: "demo-sync",
      parsed_confidence: 0.74
    }));

  if (rows.length) {
    const { error } = await client.from("standups").insert(rows);
    if (error) {
      throw new Error(error.message);
    }
  }

  const run = await insertSyncRun(projectId, personaId, "standup", { importedStandups: rows.length });
  return {
    project: context.project,
    syncedAt: run.finishedAt ?? run.startedAt,
    importedStandups: rows.length,
    warnings: ["Guided standup sync filled missing active-sprint updates."]
  };
};

export const buildSupabaseProjectDashboard = async (
  projectId: string,
  personaId: string,
  sprintId?: string
): Promise<ProjectDashboardResponse | undefined> => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context) {
    return undefined;
  }

  return buildDashboard(context, await fetchSignals(context.project, sprintId));
};

export const buildSupabaseProjectMemberHistory = async (
  projectId: string,
  memberId: string,
  personaId: string,
  sprintId?: string
): Promise<MemberPulseHistoryResponse | undefined> => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context) {
    return undefined;
  }

  const signals = await fetchSignals(context.project, sprintId);
  const dashboard = buildDashboard(context, signals, memberId);
  const member = dashboard.memberPulses[0];

  if (!member) {
    return undefined;
  }

  return {
    viewer: context.viewer,
    project: context.project,
    member,
    issues: signals.issues.filter((issue) => issue.assigneeProfileId === memberId),
    commits: signals.commits.filter((commit) => commit.authorProfileId === memberId),
    recommendations: signals.recommendations.filter((recommendation) => !recommendation.profileId || recommendation.profileId === memberId),
    standups: signals.standups.filter((standup) => standup.profile_id === memberId).map((standup) => standupToMember(standup, context.project))
  };
};
