import type {
  AppRole,
  ConfigureGitRequest,
  ConfigureGitResponse,
  ConfigureJiraRequest,
  ConfigureJiraResponse,
  CreateProjectSprintRequest,
  CreateProjectSprintResponse,
  DashboardResponse,
  GitCommit,
  GitConnection,
  GitSignal,
  IntegrationStatusResponse,
  InviteProjectMemberRequest,
  InviteProjectMemberResponse,
  JiraConnection,
  JiraIssue,
  LinkProjectMemberRequest,
  MemberPulse,
  MemberPulseHistoryResponse,
  Permission,
  Persona,
  ProjectDashboardResponse,
  ProjectInvite,
  ProjectMember,
  ProjectOpsResponse,
  ProjectRole,
  ProjectSignalSyncStatus,
  ProjectStandupsResponse,
  ProjectStandupSyncResponse,
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
  UpdateProjectMemberRequest,
  UserProfile
} from "@sprintpulse/shared";
import { analyzeDailyStatusSignals } from "@sprintpulse/shared";
import { getProjectFromSupabase } from "./supabaseProjects";
import { supabase, supabaseConfigError } from "./supabase";

type ProfileRow = {
  id: string;
  auth_user_id?: string | null;
  email: string;
  name: string;
  initials: string;
  title: string;
  app_role: AppRole;
  product_persona: Persona["productPersona"];
  access_scope: Persona["accessScope"];
  status: "active" | "invited";
  created_at: string;
  invited_by?: string | null;
};

type SprintRow = {
  id: string;
  project_id: string;
  name: string;
  goal: string;
  start_date: string;
  end_date: string;
  status: SprintInfo["status"];
  created_at?: string;
  updated_at?: string;
};

type ProjectMemberRow = {
  project_id: string;
  profile_id: string;
  role: ProjectRole;
  jira_account_id?: string | null;
  github_username?: string | null;
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
  source_ref?: string | null;
  parsed_confidence?: number | null;
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
  cloud_id?: string | null;
  display_name?: string | null;
  account_id?: string | null;
  board_id?: number | null;
  active_sprint_id?: string | null;
  active_sprint_name?: string | null;
  auth_type?: JiraConnection["authType"] | null;
  last_sync_at?: string | null;
  last_error?: string | null;
};

type GitConnectionRow = {
  id: string;
  project_id: string;
  provider: "github" | "gitlab";
  base_url?: string | null;
  repo_owner: string;
  repo_name: string;
  default_branch: string;
  status: GitConnection["status"];
  token_status?: GitConnection["tokenStatus"] | null;
  last_sync_at?: string | null;
  last_verified_at?: string | null;
  last_error?: string | null;
};

type JiraIssueRow = {
  id: string;
  project_id: string;
  sprint_id?: string | null;
  jira_issue_id?: string | null;
  issue_key: string;
  summary: string;
  status: JiraIssue["status"];
  assignee_profile_id?: string | null;
  jira_assignee_id?: string | null;
  issue_type?: string | null;
  priority?: string | null;
  url?: string | null;
  parent_key?: string | null;
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
  raw?: Record<string, unknown> | null;
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

const requireSupabase = () => {
  if (!supabase) {
    throw new Error(supabaseConfigError ?? "Supabase is not configured.");
  }

  return supabase;
};

const throwStandupWriteError = (error: { message: string }) => {
  if (/row-level security|violates row-level security/i.test(error.message)) {
    throw new Error(
      `${error.message}. Run database/supabase/012_standup_rls_manager_fix.sql, then retry the standup action.`
    );
  }

  throw new Error(error.message);
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

const roleToAppRole = (role: ProjectRole): AppRole => {
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

const projectRoleForAppRole = (appRole: AppRole): ProjectRole => {
  if (appRole === "product-owner" || appRole === "admin") {
    return "product-owner";
  }
  if (appRole === "scrum-master") {
    return "scrum-master";
  }
  if (appRole === "engineering-manager") {
    return "engineering-manager";
  }
  if (appRole === "qa-lead") {
    return "qa";
  }
  return "developer";
};

const appRoleDefaults: Record<AppRole, Pick<ProfileRow, "product_persona" | "access_scope" | "title">> = {
  admin: { product_persona: "product-owner", access_scope: "team", title: "Workspace Admin" },
  "product-owner": { product_persona: "product-owner", access_scope: "team", title: "Product Owner" },
  "engineering-manager": { product_persona: "engineering-manager", access_scope: "team", title: "Engineering Manager" },
  "scrum-master": { product_persona: "scrum-master", access_scope: "team", title: "Scrum Master" },
  developer: { product_persona: "developer", access_scope: "individual", title: "Developer" },
  "qa-lead": { product_persona: "qa-lead", access_scope: "quality", title: "QA Lead" }
};

const profileToUserProfile = (profile: ProfileRow): UserProfile => ({
  id: profile.id,
  authUserId: profile.auth_user_id ?? undefined,
  email: profile.email,
  name: profile.name,
  initials: profile.initials,
  title: profile.title,
  appRole: profile.app_role,
  productPersona: profile.product_persona,
  accessScope: profile.access_scope,
  status: profile.status,
  createdAt: profile.created_at,
  invitedBy: profile.invited_by ?? undefined
});

const permissionsForProject = (viewer: Persona, project: SprintProject) => {
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
  cloudId: row.cloud_id ?? undefined,
  displayName: row.display_name ?? undefined,
  accountId: row.account_id ?? undefined,
  boardId: row.board_id ?? undefined,
  activeSprintId: row.active_sprint_id ?? undefined,
  activeSprintName: row.active_sprint_name ?? undefined,
  authType: row.auth_type ?? undefined,
  lastSyncAt: row.last_sync_at ?? undefined,
  lastError: row.last_error ?? undefined
});

const toGitConnection = (row: GitConnectionRow): GitConnection => ({
  id: row.id,
  projectId: row.project_id,
  provider: row.provider,
  baseUrl: row.base_url ?? undefined,
  repoOwner: row.repo_owner,
  repoName: row.repo_name,
  defaultBranch: row.default_branch,
  status: row.status,
  tokenStatus: row.token_status ?? undefined,
  lastSyncAt: row.last_sync_at ?? undefined,
  lastVerifiedAt: row.last_verified_at ?? undefined,
  lastError: row.last_error ?? undefined
});

const daysIdle = (updatedAt?: string) => {
  if (!updatedAt) {
    return 0;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / dayMs));
};

const toJiraIssue = (row: JiraIssueRow): JiraIssue => ({
  id: row.id,
  projectId: row.project_id,
  sprintId: row.sprint_id ?? undefined,
  jiraIssueId: row.jira_issue_id ?? undefined,
  issueKey: row.issue_key,
  summary: row.summary,
  status: row.status,
  assigneeProfileId: row.assignee_profile_id ?? undefined,
  jiraAssigneeId: row.jira_assignee_id ?? undefined,
  issueType: row.issue_type ?? undefined,
  priority: row.priority ?? undefined,
  url: row.url ?? undefined,
  parentKey: row.parent_key ?? undefined,
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

const isDemoSafeCommitRow = (row: GitCommitRow) =>
  Boolean(row.raw && typeof row.raw === "object" && row.raw.demoSafe === true);

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

const toSprintInfo = (row: SprintRow): SprintInfo => ({
  id: row.id,
  name: row.name,
  goal: row.goal,
  startDate: row.start_date,
  endDate: row.end_date,
  status: row.status
});

const loadProjectContext = async (projectId: string, personaId: string): Promise<ProjectContext> => {
  const detail = await getProjectFromSupabase(projectId, personaId);
  return {
    viewer: detail.viewer,
    project: detail.project,
    permissions: permissionsForProject(detail.viewer, detail.project)
  };
};

const fetchSprints = async (projectId: string) => {
  const client = requireSupabase();
  const { data, error } = await client
    .from("sprints")
    .select("*")
    .eq("project_id", projectId)
    .order("start_date", { ascending: false });

  if (error) {
    throwStandupWriteError(error);
  }

  return (data ?? []) as SprintRow[];
};

const localDateKey = () => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const currentSprintFrom = (project: SprintProject, sprints: SprintRow[]) =>
  sprints.find((sprint) => {
    const today = localDateKey();
    return sprint.start_date <= today && sprint.end_date >= today;
  }) ??
  sprints.find((sprint) => sprint.status === "active") ??
  sprints[0] ??
  {
    id: project.sprint.id,
    project_id: project.id,
    name: project.sprint.name,
    goal: project.sprint.goal,
    start_date: project.sprint.startDate,
    end_date: project.sprint.endDate,
    status: project.sprint.status
  };

const roleLabel = (role: ProjectRole) => {
  if (role === "qa") {
    return "QA";
  }

  return role
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
};

const signalExpectationsForRole = (role: ProjectRole) => ({
  standup: true,
  jira: ["developer", "qa", "architect", "engineering-manager"].includes(role),
  git: role === "developer"
});

const selectedSprintLabel = (sprint: SprintInfo) =>
  sprint.status === "active" ? "active sprint" : sprint.status === "planned" ? "selected planned sprint" : "selected sprint";

const fetchSignals = async (project: SprintProject, sprintId?: string): Promise<ProjectSignals> => {
  const client = requireSupabase();
  const sprints = await fetchSprints(project.id);
  const activeSprint = sprintId
    ? sprints.find((sprint) => sprint.id === sprintId)
    : currentSprintFrom(project, sprints);
  const selectedSprint = activeSprint ?? currentSprintFrom(project, sprints);
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
    client
      .from("sync_runs")
      .select("*")
      .eq("project_id", project.id)
      .order("started_at", { ascending: false })
      .limit(8)
  ]);

  for (const error of [standupsError, issuesError, commitsError, recommendationsError, jiraError, gitError, runsError]) {
    if (error) {
      throwStandupWriteError(error);
    }
  }

  return {
    sprints,
    sprint: toSprintInfo(selectedSprint),
    standups: (standups ?? []) as StandupRow[],
    issues: ((issues ?? []) as JiraIssueRow[]).map(toJiraIssue),
    commits: ((commits ?? []) as GitCommitRow[]).filter((commit) => !isDemoSafeCommitRow(commit)).map(toGitCommit),
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

const latestGitRun = (runs: SyncRun[]) =>
  runs.find((run) => run.source === "git" && run.status === "succeeded");

const readStatsMap = (run: SyncRun | undefined, key: string): Record<string, number> => {
  const raw = run?.stats[key];
  if (typeof raw !== "string") {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const readStatsJson = <T>(run: SyncRun | undefined, key: string, fallback: T): T => {
  const raw = run?.stats[key] as unknown;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as T;
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  return raw && typeof raw === "object" ? (raw as T) : fallback;
};

const daysBetween = (left: Date, right: Date) => (right.getTime() - left.getTime()) / (24 * 60 * 60 * 1000);

const isLateNightCommit = (commit: GitCommit) => {
  const hour = new Date(commit.committedAt).getHours();
  return hour >= 22 || hour <= 5;
};

const isSprintEndCommit = (commit: GitCommit, sprint: SprintInfo) => {
  const commitDate = new Date(commit.committedAt);
  const sprintEnd = new Date(`${sprint.endDate}T23:59:59.999Z`);
  return daysBetween(commitDate, sprintEnd) >= 0 && daysBetween(commitDate, sprintEnd) <= 2;
};

const codeChurnLevel = (churnLines: number, commitCount: number): GitSignal["codeChurn"] => {
  if (churnLines >= 420 || commitCount >= 8) {
    return "high";
  }
  if (churnLines >= 160 || commitCount >= 3) {
    return "medium";
  }
  return "low";
};

const repoPulseBadges = (input: {
  commits: GitCommit[];
  openIssues: JiraIssue[];
  lateNightCommits: number;
  churnLines: number;
  stalePullRequests: number;
  reviewIssues: number;
  reviewChangeRequests: number;
  sprint: SprintInfo;
}) => {
  const badges: string[] = [];
  const hasLateSpike = input.commits.filter((commit) => isSprintEndCommit(commit, input.sprint)).length >= 3;

  if (input.commits.length) {
    badges.push("Active");
  }
  if (!input.commits.length && input.openIssues.length) {
    badges.push("Quiet");
  }
  if (hasLateSpike) {
    badges.push("Late Spike");
  }
  if (input.churnLines >= 420) {
    badges.push("High Churn");
  }
  if (input.stalePullRequests > 0) {
    badges.push("Review Blocked");
  }
  if (input.reviewIssues > 0) {
    badges.push("Review Notes");
  }
  if (input.lateNightCommits > 0) {
    badges.push("Late Night");
  }

  return badges.length ? badges : ["Steady"];
};

const deliveryConfidence = (input: {
  commits: GitCommit[];
  openIssues: JiraIssue[];
  idleIssueCount: number;
  hasOpenBlocker: boolean;
  noStandup: boolean;
  lateNightCommits: number;
  churnLines: number;
  stalePullRequests: number;
  reviewIssues: number;
  reviewChangeRequests: number;
}) => {
  let confidence = 88;

  if (!input.commits.length && input.openIssues.length) {
    confidence -= 28;
  }
  confidence -= Math.min(24, input.idleIssueCount * 8);
  confidence -= Math.min(18, input.stalePullRequests * 9);
  confidence -= Math.min(18, input.reviewChangeRequests * 9);
  confidence -= Math.min(12, Math.max(0, input.reviewIssues - input.reviewChangeRequests) * 3);
  confidence -= input.hasOpenBlocker ? 10 : 0;
  confidence -= input.noStandup ? 10 : 0;
  confidence -= input.lateNightCommits ? 6 : 0;
  confidence -= input.churnLines >= 420 ? 10 : input.churnLines >= 160 ? 4 : 0;
  confidence += Math.min(8, input.commits.length * 2);

  return Math.max(8, Math.min(98, confidence));
};

const sprintVelocityDates = (sprint: SprintInfo) => {
  const start = new Date(`${sprint.startDate}T00:00:00.000Z`);
  const end = new Date(`${sprint.endDate}T00:00:00.000Z`);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const effectiveEnd = today >= start && today < end ? today : end;
  const dates: string[] = [];

  if (Number.isNaN(start.getTime()) || Number.isNaN(effectiveEnd.getTime())) {
    return dates;
  }

  for (const cursor = new Date(start); cursor <= effectiveEnd && dates.length < 45; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }

  return dates;
};

const commitDateKey = (commit: GitCommit) => {
  const date = new Date(commit.committedAt);
  return Number.isNaN(date.getTime()) ? commit.committedAt.slice(0, 10) : date.toISOString().slice(0, 10);
};

const maxQuietRunAfterActivity = (dailyActivity: NonNullable<GitSignal["dailyActivity"]>) => {
  let seenActivity = false;
  let currentRun = 0;
  let maxRun = 0;

  for (const day of dailyActivity) {
    if (day.commits > 0) {
      seenActivity = true;
      currentRun = 0;
      continue;
    }

    if (seenActivity) {
      currentRun += 1;
      maxRun = Math.max(maxRun, currentRun);
    }
  }

  return maxRun;
};

const analyzeCommitVelocity = (commits: GitCommit[], sprint: SprintInfo) => {
  const dateKeys = sprintVelocityDates(sprint);
  const dailyMap = new Map<string, NonNullable<GitSignal["dailyActivity"]>[number]>(
    dateKeys.map((date) => [date, { date, commits: 0, churnLines: 0 }])
  );

  for (const commit of commits) {
    const date = commitDateKey(commit);
    const current = dailyMap.get(date) ?? { date, commits: 0, churnLines: 0 };
    current.commits += 1;
    current.churnLines += commit.additions + commit.deletions;
    dailyMap.set(date, current);
  }

  const dailyActivity = Array.from(dailyMap.values()).sort((left, right) => left.date.localeCompare(right.date));
  const totalCommits = commits.length;
  const activeDays = dailyActivity.filter((day) => day.commits > 0).length;
  const quietDays = maxQuietRunAfterActivity(dailyActivity);
  const peakDay = dailyActivity.reduce(
    (peak, day) => (day.commits > peak.commits ? day : peak),
    { date: "", commits: 0, churnLines: 0 }
  );
  const dominantDayShare = totalCommits ? Math.round((peakDay.commits / totalCommits) * 100) : 0;
  const trailingDays = dailyActivity.slice(-2);
  const lateSpikeCommits = trailingDays.reduce((total, day) => total + day.commits, 0);
  const midpoint = Math.max(1, Math.ceil(dailyActivity.length / 2));
  const earlyDays = dailyActivity.slice(0, midpoint);
  const recentDays = dailyActivity.slice(-Math.min(3, dailyActivity.length));
  const earlyAverage = earlyDays.reduce((total, day) => total + day.commits, 0) / Math.max(1, earlyDays.length);
  const recentAverage = recentDays.reduce((total, day) => total + day.commits, 0) / Math.max(1, recentDays.length);
  const hasVelocityDrop = totalCommits >= 3 && earlyAverage >= 1 && recentAverage <= Math.max(0.34, earlyAverage * 0.35);
  const hasLateSpike = totalCommits >= 3 && lateSpikeCommits >= Math.max(3, Math.ceil(totalCommits * 0.5));
  const isBursty = totalCommits >= 4 && dominantDayShare >= 70;
  const velocityState: NonNullable<GitSignal["velocityState"]> = hasLateSpike
    ? "late-spike"
    : hasVelocityDrop
      ? "drop"
      : totalCommits === 0 || quietDays >= 3
        ? "quiet"
        : isBursty
          ? "bursty"
          : "steady";
  const velocitySummary =
    velocityState === "late-spike"
      ? `${lateSpikeCommits} of ${totalCommits} commits landed in the final ${trailingDays.length} sprint days.`
      : velocityState === "drop"
        ? `Commit pace fell from ${earlyAverage.toFixed(1)}/day early to ${recentAverage.toFixed(1)}/day recently.`
        : velocityState === "quiet"
          ? totalCommits
            ? `${quietDays} quiet day${quietDays === 1 ? "" : "s"} after earlier repo activity.`
            : "No commits landed in the sprint window."
          : velocityState === "bursty"
            ? `${peakDay.commits} of ${totalCommits} commits landed on ${peakDay.date}.`
            : `${activeDays} active commit day${activeDays === 1 ? "" : "s"} across the sprint.`;

  return {
    dailyActivity,
    velocityState,
    velocitySummary,
    quietDays,
    lateSpikeCommits,
    dominantDayShare
  };
};

const repoBadgesWithVelocity = (
  badges: string[],
  velocityState: NonNullable<GitSignal["velocityState"]>
) => {
  const next = velocityState === "steady" ? [...badges] : badges.filter((badge) => badge !== "Steady");

  if (velocityState === "drop") {
    next.push("Velocity Drop");
  }
  if (velocityState === "late-spike" && !next.includes("Late Spike")) {
    next.push("Late Spike");
  }
  if (velocityState === "bursty") {
    next.push("Bursty");
  }
  if (velocityState === "quiet" && !next.includes("Quiet")) {
    next.push("Quiet");
  }

  return Array.from(new Set(next));
};

const velocityConfidencePenalty = (velocityState: NonNullable<GitSignal["velocityState"]>) => {
  if (velocityState === "drop") {
    return 8;
  }
  if (velocityState === "late-spike") {
    return 7;
  }
  if (velocityState === "bursty") {
    return 5;
  }
  if (velocityState === "quiet") {
    return 4;
  }
  return 0;
};

const codeReviewStateFor = (
  reviewIssues: number,
  reviewChangeRequests: number
): NonNullable<GitSignal["codeReviewState"]> => {
  if (reviewChangeRequests > 0) {
    return "needs-fixes";
  }
  if (reviewIssues > 0) {
    return "watch";
  }
  return "clean";
};

const codeReviewSummaryFor = (input: {
  pullRequestsOpen: number;
  reviewedPullRequests: number;
  reviewIssues: number;
  reviewComments: number;
}) => {
  if (input.reviewIssues > 0) {
    return `${input.reviewIssues} review issue${input.reviewIssues === 1 ? "" : "s"} reported across open PRs with ${
      input.reviewComments
    } PR comment${input.reviewComments === 1 ? "" : "s"}.`;
  }
  if (input.reviewedPullRequests > 0) {
    return `${input.reviewedPullRequests} PR${input.reviewedPullRequests === 1 ? "" : "s"} reviewed with no open issue signal.`;
  }
  if (input.pullRequestsOpen > 0) {
    return "Open PRs are waiting for review feedback.";
  }
  return "No open PR review signal for this sprint.";
};

const buildMemberPulse = (
  project: SprintProject,
  member: ProjectMember,
  signals: ProjectSignals
): MemberPulse => {
  const standups = signals.standups
    .filter((standup) => standup.profile_id === member.personaId)
    .map((standup) => standupToMember(standup, project));
  const latestStandup = standups[0];
  const issues = signals.issues.filter((issue) => issue.assigneeProfileId === member.personaId);
  const commits = signals.commits.filter((commit) => commit.authorProfileId === member.personaId);
  const openIssues = issues.filter((issue) => issue.status !== "Done");
  const jiraReviewIssues = openIssues.filter((issue) => issue.status === "Review");
  const blockedIssues = issues.filter((issue) => issue.status === "Blocked");
  const hasOpenBlocker = standups.some((standup) => blockerIsOpen(standup.blockers));
  const noStandup = standups.length === 0;
  const idleIssueCount = openIssues.filter((issue) => issue.daysIdle >= 3).length;
  const heavyIdleIssues = openIssues.filter((issue) => (issue.storyPoints ?? 0) >= 5 && issue.daysIdle >= 3);
  const gitRun = latestGitRun(signals.runs);
  const lastGitSyncAt = gitRun?.finishedAt ?? gitRun?.startedAt;
  const openPrsByMember = readStatsMap(gitRun, "openPrsByMember");
  const stalePrsByMember = readStatsMap(gitRun, "stalePrsByMember");
  const reviewedPrsByMember = readStatsMap(gitRun, "reviewedPrsByMember");
  const reviewIssuesByMember = readStatsMap(gitRun, "reviewIssuesByMember");
  const reviewCommentsByMember = readStatsMap(gitRun, "reviewCommentsByMember");
  const reviewConversationCommentsByMember = readStatsMap(gitRun, "reviewConversationCommentsByMember");
  const reviewInlineCommentsByMember = readStatsMap(gitRun, "reviewInlineCommentsByMember");
  const reviewBodyCommentsByMember = readStatsMap(gitRun, "reviewBodyCommentsByMember");
  const reviewCommitCommentsByMember = readStatsMap(gitRun, "reviewCommitCommentsByMember");
  const reviewSubmissionsByMember = readStatsMap(gitRun, "reviewSubmissionsByMember");
  const reviewApprovalsByMember = readStatsMap(gitRun, "reviewApprovalsByMember");
  const reviewChangeRequestsByMember = readStatsMap(gitRun, "reviewChangeRequestsByMember");
  const pullRequestChurnByMember = readStatsJson<Record<string, NonNullable<GitSignal["pullRequestChurn"]>>>(
    gitRun,
    "pullRequestChurnByMember",
    {}
  );
  const pullRequestsOpen = openPrsByMember[member.personaId] ?? 0;
  const stalePullRequests = stalePrsByMember[member.personaId] ?? 0;
  const reviewedPullRequests = reviewedPrsByMember[member.personaId] ?? 0;
  const prReviewIssues = reviewIssuesByMember[member.personaId] ?? 0;
  const reviewComments = reviewCommentsByMember[member.personaId] ?? 0;
  const reviewConversationComments = reviewConversationCommentsByMember[member.personaId] ?? 0;
  const reviewInlineComments = reviewInlineCommentsByMember[member.personaId] ?? 0;
  const reviewBodyComments = reviewBodyCommentsByMember[member.personaId] ?? 0;
  const reviewCommitComments = reviewCommitCommentsByMember[member.personaId] ?? 0;
  const reviewSubmissions = reviewSubmissionsByMember[member.personaId] ?? 0;
  const reviewApprovals = reviewApprovalsByMember[member.personaId] ?? 0;
  const reviewChangeRequests = reviewChangeRequestsByMember[member.personaId] ?? 0;
  const pullRequestChurn = pullRequestChurnByMember[member.personaId] ?? [];
  const codeReviewState = codeReviewStateFor(prReviewIssues, reviewChangeRequests);
  const codeReviewSummary = codeReviewSummaryFor({
    pullRequestsOpen,
    reviewedPullRequests,
    reviewIssues: prReviewIssues,
    reviewComments
  });
  const oldestPullRequestDays = pullRequestsOpen
    ? Math.max(...jiraReviewIssues.map((issue) => issue.daysIdle), stalePullRequests ? 3 : 0, daysIdle(commits[0]?.committedAt))
    : 0;
  const reviewPressure = pullRequestsOpen
    ? Math.min(100, pullRequestsOpen * 22 + oldestPullRequestDays * 12 + stalePullRequests * 16)
    : 0;
  const churnLines = commits.reduce((total, commit) => total + commit.additions + commit.deletions, 0);
  const lateNightCommits = commits.filter(isLateNightCommit).length;
  const sprintEndChurn = commits
    .filter((commit) => isSprintEndCommit(commit, signals.sprint))
    .reduce((total, commit) => total + commit.additions + commit.deletions, 0);
  const codeChurn = codeChurnLevel(churnLines, commits.length);
  const velocity = analyzeCommitVelocity(commits, signals.sprint);
  const repoBadges = repoBadgesWithVelocity(
    repoPulseBadges({
      commits,
      openIssues,
      lateNightCommits,
      churnLines,
      stalePullRequests,
      reviewIssues: prReviewIssues,
      reviewChangeRequests,
      sprint: signals.sprint
    }),
    velocity.velocityState
  );
  const deliveryConfidenceScore = Math.max(
    8,
    deliveryConfidence({
      commits,
      openIssues,
      idleIssueCount,
      hasOpenBlocker,
      noStandup,
      lateNightCommits,
      churnLines,
      stalePullRequests,
      reviewIssues: prReviewIssues,
      reviewChangeRequests
    }) - velocityConfidencePenalty(velocity.velocityState)
  );
  const expectations = signalExpectationsForRole(member.role);
  const sprintLabel = selectedSprintLabel(signals.sprint);
  const flags: RiskFlag[] = [];
  let score = 90;

  if (expectations.standup && noStandup) {
    score -= 16;
    flags.push({
      id: `${member.personaId}-missing-standup`,
      type: "STALE_WORK",
      severity: "medium",
      title: `No standup in ${sprintLabel}`,
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
      message: `${member.name} reported a blocker in the ${sprintLabel}.`
    });
  }
  if (expectations.jira && blockedIssues.length) {
    score -= 12;
    flags.push({
      id: `${member.personaId}-blocked-issue`,
      type: "SAY_DO_GAP",
      severity: "high",
      title: "Jira issue is blocked",
      message: `${blockedIssues[0].issueKey} is blocked and assigned to ${member.name}.`
    });
  }
  if (expectations.jira && idleIssueCount) {
    score -= Math.min(18, idleIssueCount * 7);
    flags.push({
      id: `${member.personaId}-idle-issue`,
      type: "STALE_WORK",
      severity: idleIssueCount > 1 ? "high" : "medium",
      title: "Issue movement is stale",
      message: `${idleIssueCount} assigned issue${idleIssueCount > 1 ? "s" : ""} have not moved recently.`
    });
  }
  if (expectations.jira && heavyIdleIssues.length) {
    score -= Math.min(12, heavyIdleIssues.reduce((total, issue) => total + Math.min(6, issue.storyPoints ?? 0), 0));
    flags.push({
      id: `${member.personaId}-story-point-idle`,
      type: "SPRINT_END_RISK",
      severity: heavyIdleIssues.some((issue) => issue.daysIdle >= 4 || (issue.storyPoints ?? 0) >= 8) ? "high" : "medium",
      title: "High-point Jira work is stale",
      message: `${heavyIdleIssues[0].issueKey} has ${heavyIdleIssues[0].storyPoints ?? "unestimated"} points and has not moved for ${heavyIdleIssues[0].daysIdle} day${heavyIdleIssues[0].daysIdle === 1 ? "" : "s"}.`
    });
  }
  if (expectations.git && !commits.length && openIssues.length) {
    score -= 14;
    flags.push({
      id: `${member.personaId}-no-commits`,
      type: "SAY_DO_GAP",
      severity: "high",
      title: "No repo evidence for active work",
      message: `${member.name} has active sprint work, but Git has no mapped commits for the sprint window.`
    });
  }
  if (lateNightCommits > 0) {
    score -= Math.min(10, lateNightCommits * 4);
    flags.push({
      id: `${member.personaId}-late-night-commits`,
      type: "BURNOUT_SIGNAL",
      severity: lateNightCommits >= 3 ? "high" : "medium",
      title: "Late-night delivery pressure",
      message: `${lateNightCommits} commit${lateNightCommits === 1 ? "" : "s"} landed between 10 PM and 5 AM.`
    });
  }
  if (codeChurn === "high") {
    score -= 12;
    flags.push({
      id: `${member.personaId}-high-churn`,
      type: "TEST_RISK",
      severity: "high",
      title: "High code churn",
      message: `${member.name} changed ${churnLines} lines this sprint, which can indicate rework or QA risk.`
    });
  }
  if (stalePullRequests > 0) {
    score -= Math.min(14, stalePullRequests * 7);
    flags.push({
      id: `${member.personaId}-review-bottleneck`,
      type: "SAY_DO_GAP",
      severity: stalePullRequests > 1 ? "high" : "medium",
      title: "Review bottleneck",
      message: `${stalePullRequests} open PR${stalePullRequests === 1 ? "" : "s"} look stale. Work exists, but review may be blocking delivery.`
    });
  }
  if (reviewChangeRequests > 0) {
    score -= Math.min(16, reviewChangeRequests * 8);
    flags.push({
      id: `${member.personaId}-code-review-changes-requested`,
      type: "TEST_RISK",
      severity: reviewChangeRequests > 1 ? "high" : "medium",
      title: "Code review follow-up",
      message: `${reviewChangeRequests} review follow-up item${reviewChangeRequests === 1 ? "" : "s"} found on ${member.name}'s open PRs. Resolve before sprint signoff.`
    });
  } else if (prReviewIssues > 0) {
    score -= Math.min(10, prReviewIssues * 3);
    flags.push({
      id: `${member.personaId}-code-review-issues`,
      type: "TEST_RISK",
      severity: prReviewIssues >= 4 ? "high" : "medium",
      title: "Review issues reported",
      message: `${prReviewIssues} review issue${prReviewIssues === 1 ? "" : "s"} were reported on ${member.name}'s open PRs.`
    });
  }
  if (commits.length > 0 && noStandup) {
    score -= 6;
    flags.push({
      id: `${member.personaId}-silent-contributor`,
      type: "VAGUE_UPDATE",
      severity: "medium",
      title: "Silent contributor",
      message: `${member.name} has Git activity but no standup update, so communication confidence is lower.`
    });
  }
  if (!issues.length && commits.length >= 3) {
    score -= 5;
    flags.push({
      id: `${member.personaId}-shadow-ownership`,
      type: "SAY_DO_GAP",
      severity: "medium",
      title: "Shadow ownership detected",
      message: `${member.name} has meaningful repo activity without matching assigned Jira work in this sprint.`
    });
  }
  if (sprintEndChurn >= 220) {
    score -= 10;
    flags.push({
      id: `${member.personaId}-late-sprint-churn`,
      type: "TEST_RISK",
      severity: "high",
      title: "Risky sprint-end changes",
      message: `${sprintEndChurn} lines changed near sprint end. QA may need extra focus before review.`
    });
  }
  if (velocity.velocityState === "drop") {
    score -= 8;
    flags.push({
      id: `${member.personaId}-commit-velocity-drop`,
      type: "SAY_DO_GAP",
      severity: "medium",
      title: "Commit velocity dropped",
      message: `${velocity.velocitySummary} Claimed progress may need fresh delivery evidence.`
    });
  }
  if (velocity.velocityState === "late-spike") {
    score -= 7;
    flags.push({
      id: `${member.personaId}-last-minute-commit-spike`,
      type: "TEST_RISK",
      severity: "medium",
      title: "Last-minute commit spike",
      message: `${velocity.velocitySummary} Review and QA may need extra attention.`
    });
  }
  if (velocity.velocityState === "bursty") {
    score -= 5;
    flags.push({
      id: `${member.personaId}-bursty-commit-velocity`,
      type: "TEST_RISK",
      severity: "medium",
      title: "Bursty commit velocity",
      message: `${velocity.velocitySummary} Delivery arrived in a concentrated burst instead of a steady rhythm.`
    });
  }
  if (velocity.velocityState === "quiet" && commits.length > 0 && openIssues.length > 0) {
    score -= 6;
    flags.push({
      id: `${member.personaId}-repo-quiet-streak`,
      type: "STALE_WORK",
      severity: "medium",
      title: "Repo activity went quiet",
      message: `${velocity.velocitySummary} Active Jira work may need a status check.`
    });
  }
  if (expectations.git && pullRequestsOpen && oldestPullRequestDays >= 2) {
    score -= Math.min(14, 6 + oldestPullRequestDays * 2);
    flags.push({
      id: `${member.personaId}-pr-aging`,
      type: "SAY_DO_GAP",
      severity: oldestPullRequestDays >= 4 || pullRequestsOpen > 1 ? "high" : "medium",
      title: "PR review is aging",
      message: `${member.name} has ${pullRequestsOpen} open PR${pullRequestsOpen === 1 ? "" : "s"} waiting about ${oldestPullRequestDays} day${oldestPullRequestDays === 1 ? "" : "s"}.`
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
        : reviewChangeRequests
          ? `Resolve ${member.name}'s requested PR changes before counting the work as done.`
          : prReviewIssues
            ? `Close ${member.name}'s PR review comments and confirm the code quality signal.`
            : heavyIdleIssues.length
              ? `Split or reassign ${heavyIdleIssues[0].issueKey}; it is high-scope work that has stopped moving.`
        : stalePullRequests
          ? `Unblock ${member.name}'s review queue before adding new work.`
          : idleIssueCount
            ? `Review stale Jira movement with ${member.name} and split work if needed.`
            : `Ask ${member.name} for a concrete next update and confirm delivery evidence. Delivery confidence is ${deliveryConfidenceScore}%.`;

  return {
    id: member.personaId,
    personaId: member.personaId,
    name: member.name,
    initials: member.initials,
    title: roleLabel(member.role),
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
      daysIdle: issue.daysIdle,
      storyPoints: issue.storyPoints
    })),
    git: {
      commitsThisSprint: commits.length,
      pullRequestsOpen,
      lastCommitAt: commits[0]?.committedAt ?? "",
      codeChurn,
      lateNightCommits,
      churnLines,
      stalePullRequests,
      reviewIssues: prReviewIssues,
      reviewComments,
      reviewConversationComments,
      reviewInlineComments,
      reviewBodyComments,
      reviewCommitComments,
      reviewSubmissions,
      reviewApprovals,
      reviewChangeRequests,
      reviewedPullRequests,
      pullRequestChurn,
      codeReviewState,
      codeReviewSummary,
      repoPulseBadges: repoBadges,
      deliveryConfidence: deliveryConfidenceScore,
      velocityState: velocity.velocityState,
      velocitySummary: velocity.velocitySummary,
      quietDays: velocity.quietDays,
      lateSpikeCommits: velocity.lateSpikeCommits,
      dominantDayShare: velocity.dominantDayShare,
      dailyActivity: velocity.dailyActivity,
      oldestPullRequestDays,
      reviewPressure
    } satisfies GitSignal,
    flags: flags.map((flag) => ({
      ...flag,
      evidence: flag.evidence?.length ? flag.evidence : [flag.message]
    })),
    standups
  };
};

const buildPulses = (project: SprintProject, signals: ProjectSignals) =>
  project.members.map((member) => buildMemberPulse(project, member, signals));

const sprintWindow = (sprint: SprintInfo) => `${sprint.startDate} to ${sprint.endDate}`;

const buildDashboard = (
  context: ProjectContext,
  signals: ProjectSignals,
  memberId?: string
): ProjectDashboardResponse => {
  const { viewer, project } = context;
  const allPulses = buildPulses(project, signals);
  const canViewTeam = context.permissions.includes("dashboard:viewTeam");
  const visiblePulses = canViewTeam ? allPulses : allPulses.filter((pulse) => pulse.personaId === viewer.id);
  const memberPulses =
    memberId && (!canViewTeam && memberId !== viewer.id)
      ? []
      : memberId
        ? allPulses.filter((pulse) => pulse.personaId === memberId)
        : visiblePulses;
  const viewerPulse =
    allPulses.find((pulse) => pulse.personaId === viewer.id) ??
    memberPulses[0] ??
    allPulses[0];
  const activeFlags = memberPulses.flatMap((pulse) => pulse.flags);
  const teamHealthScore = memberPulses.length
    ? Math.round(memberPulses.reduce((total, pulse) => total + pulse.healthScore, 0) / memberPulses.length)
    : 0;
  const atRiskCount = memberPulses.filter((pulse) => pulse.healthScore < 70).length;
  const openBlockers = signals.standups.filter((standup) => blockerIsOpen(standup.blockers)).length;
  const recommendations = memberPulses
    .filter((pulse) => pulse.riskLevel !== "low")
    .map((pulse) => pulse.recommendation)
    .slice(0, 4);

  return {
    viewer,
    scope: canViewTeam ? "team" : "individual",
    project,
    summary: {
      sprintName: signals.sprint.name,
      sprintWindow: sprintWindow(signals.sprint),
      teamHealthScore,
      atRiskCount,
      openBlockers,
      totalFlags: activeFlags.length,
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
  const healthScore = Math.max(0, Math.min(100, 72 + commitCount * 2 + standupCount * 3 - blockerCount * 8));

  return {
    ...toSprintInfo(sprint),
    issueCount,
    standupCount,
    commitCount,
    blockerCount,
    healthScore
  };
};

export const getProjectOpsFromSupabase = async (projectId: string, personaId: string): Promise<ProjectOpsResponse> => {
  const context = await loadProjectContext(projectId, personaId);
  const signals = await fetchSignals(context.project);
  const pulses = buildPulses(context.project, signals);
  const teamHealthScore = pulses.length
    ? Math.round(pulses.reduce((total, pulse) => total + pulse.healthScore, 0) / pulses.length)
    : 0;
  const memberCount = context.project.members.length || 1;
  const participationRate = Math.round((new Set(signals.standups.map((standup) => standup.profile_id)).size / memberCount) * 100);

  return {
    viewer: context.viewer,
    project: context.project,
    permissions: context.permissions,
    currentSprint: toSprintSummary(
      signals.sprints.find((sprint) => sprint.id === signals.sprint.id) ?? currentSprintFrom(context.project, signals.sprints),
      signals
    ),
    summary: {
      teamHealthScore,
      participationRate,
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

export const getProjectSprintsFromSupabase = async (
  projectId: string,
  personaId: string
): Promise<SprintListResponse> => {
  const context = await loadProjectContext(projectId, personaId);
  const signals = await fetchSignals(context.project);
  const summaries = signals.sprints.map((sprint) => toSprintSummary(sprint, signals));

  return {
    viewer: context.viewer,
    project: context.project,
    permissions: context.permissions,
    currentSprint: summaries.find((sprint) => sprint.status === "active"),
    sprints: summaries
  };
};

export const createProjectSprintInSupabase = async (
  projectId: string,
  input: CreateProjectSprintRequest
): Promise<CreateProjectSprintResponse> => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context.permissions.includes("project:connect")) {
    throw new Error("You do not have permission to manage sprints for this project.");
  }

  const client = requireSupabase();
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

  const sprintList = await getProjectSprintsFromSupabase(projectId, input.personaId);
  const createdSprint =
    sprintList.sprints.find((sprint) => sprint.id === (inserted.data as SprintRow).id) ??
    toSprintSummary(inserted.data as SprintRow, { standups: [], issues: [], commits: [] });

  return {
    ...sprintList,
    createdSprint
  };
};

export const getProjectTeamFromSupabase = async (projectId: string, personaId: string): Promise<TeamResponse> => {
  const context = await loadProjectContext(projectId, personaId);
  const client = requireSupabase();
  const canEditTeam = context.permissions.includes("project:editTeam");
  const { data, error } = await client
    .from("project_invites")
    .select("*")
    .eq("project_id", context.project.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  let availableUsers: UserProfile[] = [];
  let linkableUsers: UserProfile[] = [];
  if (canEditTeam) {
    const memberIds = new Set(context.project.members.map((member) => member.personaId));
    const profiles = await client
      .from("profiles")
      .select("*")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (profiles.error) {
      throw new Error(profiles.error.message);
    }

    linkableUsers = ((profiles.data ?? []) as ProfileRow[])
      .map(profileToUserProfile)
      .filter((profile) => !profile.email.toLowerCase().endsWith("@jira.local"));
    availableUsers = linkableUsers.filter((profile) => !memberIds.has(profile.id));
  }
  const signals = await fetchSignals(context.project).catch(() => undefined);
  const activeStandupMembers = new Set((signals?.standups ?? []).map((standup) => standup.profile_id));
  const members = context.project.members.map((member) => ({
    ...member,
    standupActive: activeStandupMembers.has(member.personaId)
  }));

  return {
    viewer: context.viewer,
    project: context.project,
    permissions: context.permissions,
    members,
    availableUsers,
    linkableUsers,
    invites: ((data ?? []) as ProjectInviteRow[]).map(toInvite),
    canEditTeam
  };
};

export const inviteProjectMemberInSupabase = async (
  projectId: string,
  input: InviteProjectMemberRequest
): Promise<InviteProjectMemberResponse> => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context.permissions.includes("project:editTeam")) {
    throw new Error("You do not have permission to edit this team.");
  }

  const client = requireSupabase();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const defaults = appRoleDefaults[input.appRole];
  let profile: ProfileRow | null = null;
  const existing = await client.from("profiles").select("*").eq("email", email).maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  profile = (existing.data as ProfileRow | null) ?? null;
  if (!profile) {
    const inserted = await client
      .from("profiles")
      .insert({
        id: slugFromEmail(email) || `user-${Date.now()}`,
        auth_user_id: null,
        email,
        name,
        initials: initialsFromName(name),
        title: input.title?.trim() || defaults.title,
        app_role: input.appRole,
        product_persona: defaults.product_persona,
        access_scope: defaults.access_scope,
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

  const memberRow = {
    project_id: projectId,
    profile_id: profile.id,
    role: input.projectRole,
    jira_account_id: input.jiraAccountId?.trim() || null,
    github_username: input.githubUsername?.trim() || null
  };

  if (memberRow.jira_account_id) {
    const duplicateJira = await client
      .from("project_members")
      .update({ jira_account_id: null })
      .eq("project_id", projectId)
      .eq("jira_account_id", memberRow.jira_account_id)
      .neq("profile_id", profile.id);

    if (duplicateJira.error) {
      throw new Error(duplicateJira.error.message);
    }
  }

  if (memberRow.github_username) {
    const duplicateGit = await client
      .from("project_members")
      .update({ github_username: null })
      .eq("project_id", projectId)
      .eq("github_username", memberRow.github_username)
      .neq("profile_id", profile.id);

    if (duplicateGit.error) {
      throw new Error(duplicateGit.error.message);
    }
  }

  const memberWrite = await client.from("project_members").upsert(memberRow).select().single();
  if (memberWrite.error) {
    throw new Error(memberWrite.error.message);
  }

  const hasAccount = Boolean(profile.auth_user_id);
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
    profile: profileToUserProfile(profile),
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

export const updateProjectMemberInSupabase = async (
  projectId: string,
  profileId: string,
  input: UpdateProjectMemberRequest
): Promise<TeamResponse> => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context.permissions.includes("project:editTeam")) {
    throw new Error("You do not have permission to edit this team.");
  }

  const client = requireSupabase();
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

  if (update.jira_account_id) {
    const duplicateJira = await client
      .from("project_members")
      .update({ jira_account_id: null })
      .eq("project_id", projectId)
      .eq("jira_account_id", update.jira_account_id)
      .neq("profile_id", profileId);

    if (duplicateJira.error) {
      throw new Error(duplicateJira.error.message);
    }
  }

  if (update.github_username) {
    const duplicateGit = await client
      .from("project_members")
      .update({ github_username: null })
      .eq("project_id", projectId)
      .eq("github_username", update.github_username)
      .neq("profile_id", profileId);

    if (duplicateGit.error) {
      throw new Error(duplicateGit.error.message);
    }
  }

  const { error } = await client
    .from("project_members")
    .update(update)
    .eq("project_id", projectId)
    .eq("profile_id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  return getProjectTeamFromSupabase(projectId, input.personaId);
};

export const linkProjectMemberInSupabase = async (
  projectId: string,
  sourceProfileId: string,
  input: LinkProjectMemberRequest
): Promise<TeamResponse> => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context.permissions.includes("project:editTeam")) {
    throw new Error("You do not have permission to edit this team.");
  }

  const targetProfileId = input.targetProfileId.trim();
  if (!targetProfileId || sourceProfileId === targetProfileId) {
    throw new Error("Choose a different SprintPulse user to link this identity.");
  }

  if (context.project.createdBy === sourceProfileId) {
    throw new Error("The project creator cannot be merged into another user.");
  }

  const client = requireSupabase();
  const [sourceMemberRead, targetMemberRead, sourceProfileRead, targetProfileRead] = await Promise.all([
    client.from("project_members").select("*").eq("project_id", projectId).eq("profile_id", sourceProfileId).maybeSingle(),
    client.from("project_members").select("*").eq("project_id", projectId).eq("profile_id", targetProfileId).maybeSingle(),
    client.from("profiles").select("*").eq("id", sourceProfileId).maybeSingle(),
    client.from("profiles").select("*").eq("id", targetProfileId).maybeSingle()
  ]);

  for (const error of [sourceMemberRead.error, targetMemberRead.error, sourceProfileRead.error, targetProfileRead.error]) {
    if (error) {
      throw new Error(error.message);
    }
  }

  const sourceMember = (sourceMemberRead.data as ProjectMemberRow | null) ?? null;
  const targetMember = (targetMemberRead.data as ProjectMemberRow | null) ?? null;
  const sourceProfile = (sourceProfileRead.data as ProfileRow | null) ?? null;
  const targetProfile = (targetProfileRead.data as ProfileRow | null) ?? null;

  if (!sourceMember || !targetProfile) {
    throw new Error("Team member or SprintPulse user was not found.");
  }

  if (targetProfile.email.toLowerCase().endsWith("@jira.local")) {
    throw new Error("Choose a real SprintPulse user, not another imported integration identity.");
  }

  const jiraAccountId = sourceMember.jira_account_id?.trim() || targetMember?.jira_account_id || null;
  const githubUsername = sourceMember.github_username?.trim() || targetMember?.github_username || null;

  if (jiraAccountId) {
    const duplicateJira = await client
      .from("project_members")
      .update({ jira_account_id: null })
      .eq("project_id", projectId)
      .eq("jira_account_id", jiraAccountId)
      .neq("profile_id", targetProfileId);

    if (duplicateJira.error) {
      throw new Error(duplicateJira.error.message);
    }
  }

  if (githubUsername) {
    const duplicateGit = await client
      .from("project_members")
      .update({ github_username: null })
      .eq("project_id", projectId)
      .eq("github_username", githubUsername)
      .neq("profile_id", targetProfileId);

    if (duplicateGit.error) {
      throw new Error(duplicateGit.error.message);
    }
  }

  const targetRole = targetMember?.role ?? sourceMember.role ?? projectRoleForAppRole(targetProfile.app_role);
  const upsertTarget = await client.from("project_members").upsert({
    project_id: projectId,
    profile_id: targetProfileId,
    role: targetRole,
    jira_account_id: jiraAccountId,
    github_username: githubUsername
  });

  if (upsertTarget.error) {
    throw new Error(upsertTarget.error.message);
  }

  const signalUpdates = await Promise.all([
    client
      .from("jira_issues")
      .update({ assignee_profile_id: targetProfileId })
      .eq("project_id", projectId)
      .eq("assignee_profile_id", sourceProfileId),
    client
      .from("git_commits")
      .update({ author_profile_id: targetProfileId })
      .eq("project_id", projectId)
      .eq("author_profile_id", sourceProfileId),
    client.from("standups").update({ profile_id: targetProfileId }).eq("project_id", projectId).eq("profile_id", sourceProfileId),
    client
      .from("recommendations")
      .update({ profile_id: targetProfileId })
      .eq("project_id", projectId)
      .eq("profile_id", sourceProfileId)
  ]);

  for (const update of signalUpdates) {
    if (update.error) {
      throw new Error(update.error.message);
    }
  }

  const deleteSource = await client
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("profile_id", sourceProfileId);

  if (deleteSource.error) {
    throw new Error(deleteSource.error.message);
  }

  if (sourceProfile?.email) {
    const inviteDelete = await client
      .from("project_invites")
      .delete()
      .eq("project_id", projectId)
      .ilike("email", sourceProfile.email);

    if (inviteDelete.error) {
      throw new Error(inviteDelete.error.message);
    }
  }

  return getProjectTeamFromSupabase(projectId, input.personaId);
};

export const getProjectIntegrationsFromSupabase = async (
  projectId: string,
  personaId: string
): Promise<IntegrationStatusResponse> => {
  const context = await loadProjectContext(projectId, personaId);
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

export const configureJiraInSupabase = async (
  projectId: string,
  input: ConfigureJiraRequest
): Promise<ConfigureJiraResponse> => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context.permissions.includes("project:connect")) {
    throw new Error("You do not have permission to configure Jira.");
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("jira_connections")
    .upsert(
      {
        project_id: projectId,
        site_url: input.jiraSite.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase(),
        project_key: input.projectKey.trim().toUpperCase(),
        status: "configured",
        cloud_id: null,
        display_name: null,
        account_id: null,
        board_id: null,
        active_sprint_id: null,
        active_sprint_name: null,
        auth_type: "manual",
        last_error: null,
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

const insertSyncRun = async (
  projectId: string,
  personaId: string,
  source: SyncRun["source"],
  stats: SyncRun["stats"],
  status: SyncRun["status"] = "succeeded"
) => {
  const client = requireSupabase();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("sync_runs")
    .insert({
      project_id: projectId,
      source,
      status,
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

export const syncJiraInSupabase = async (
  projectId: string,
  personaId: string
): Promise<ConfigureJiraResponse> => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context.permissions.includes("project:connect")) {
    throw new Error("You do not have permission to sync Jira.");
  }

  const client = requireSupabase();
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

export const configureGitInSupabase = async (
  projectId: string,
  input: ConfigureGitRequest
): Promise<ConfigureGitResponse> => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context.permissions.includes("project:connect")) {
    throw new Error("You do not have permission to configure Git.");
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from("git_connections")
    .upsert(
      {
        project_id: projectId,
        provider: input.provider,
        base_url: input.baseUrl?.trim() || null,
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
    warnings: [`${input.provider === "gitlab" ? "GitLab" : "GitHub"} is configured. Run sync to import commit activity.`]
  };
};

export const syncGitInSupabase = async (
  projectId: string,
  personaId: string
): Promise<ConfigureGitResponse> => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context.permissions.includes("project:connect")) {
    throw new Error("You do not have permission to sync Git.");
  }

  const signals = await fetchSignals(context.project);
  if (!signals.git) {
    throw new Error("Configure Git before running sync.");
  }

  throw new Error("Git sync requires the API server because provider tokens are server-only.");
};

export const getProjectStandupsFromSupabase = async (
  projectId: string,
  personaId: string,
  sprintId?: string
): Promise<ProjectStandupsResponse> => {
  const context = await loadProjectContext(projectId, personaId);
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

export const submitProjectStandupToSupabase = async (
  projectId: string,
  input: { personaId: string; yesterday: string; today: string; blockers: string }
) => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context.permissions.includes("standup:submit")) {
    throw new Error("You do not have permission to submit standups for this project.");
  }

  const client = requireSupabase();
  const signals = await fetchSignals(context.project);
  const { data, error } = await client
    .from("standups")
    .insert({
      project_id: projectId,
      sprint_id: signals.sprint.id,
      profile_id: input.personaId,
      date: localDateKey(),
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

  const dashboard = await getProjectDashboardFromSupabase(projectId, input.personaId);
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

export const parseProjectTranscriptForPersonaInSupabase = async (
  projectId: string,
  personaId: string,
  transcript: string
) => {
  const context = await loadProjectContext(projectId, personaId);
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
  const analysis = analyzeDailyStatusSignals({
    project: context.project,
    sprint: signals.sprint,
    parsed,
    previousStandups: signals.standups.map((standup) => standupToMember(standup, context.project)),
    issues: signals.issues,
    commits: signals.commits
  });

  if (parsed.length) {
    const client = requireSupabase();
    const { error } = await client.from("standups").insert(
      parsed.map((entry) => ({
        project_id: projectId,
        sprint_id: signals.sprint.id,
        profile_id: entry.memberId,
        date: localDateKey(),
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
    note: "Transcript entries were saved to the selected sprint.",
    project: context.project,
    parsed,
    analysis
  };
};

export const syncProjectStandupsInSupabase = async (projectId: string, personaId: string) => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context.permissions.includes("standup:sync")) {
    throw new Error("You do not have permission to sync standups for this project.");
  }

  const client = requireSupabase();
  const signals = await fetchSignals(context.project);
  const today = localDateKey();
  const existingToday = new Set(signals.standups.filter((standup) => standup.date === today).map((standup) => standup.profile_id));
  const rows = context.project.members
    .filter((member) => !existingToday.has(member.personaId))
    .map((member) => ({
      project_id: projectId,
      sprint_id: signals.sprint.id,
      profile_id: member.personaId,
      date: today,
      yesterday: `Synced delivery activity for ${member.name}.`,
      today: `Continue selected ${context.project.key} sprint work.`,
      blockers: member.role === "developer" ? "No blocker." : "Review team dependencies.",
      source: "transcript" as const,
      source_ref: "demo-sync",
      parsed_confidence: 0.74
    }));

  if (rows.length) {
    const { error } = await client.from("standups").insert(rows);
    if (error) {
      throwStandupWriteError(error);
    }
  }

  const run = await insertSyncRun(projectId, personaId, "standup", {
    importedStandups: rows.length
  });

  return {
    project: context.project,
    syncedAt: run.finishedAt ?? run.startedAt,
    importedStandups: rows.length,
    warnings: ["Guided standup sync filled missing selected-sprint updates."]
  };
};

type ProjectSyncSource = ProjectSignalSyncStatus["source"];
type ProjectSyncResponseBySource = {
  jira: ConfigureJiraResponse;
  git: ConfigureGitResponse;
  standup: ProjectStandupSyncResponse;
};

const importedCountForSync = (source: ProjectSyncSource, response: ProjectSyncResponseBySource[ProjectSyncSource]) => {
  if (source === "jira") {
    return (response as ConfigureJiraResponse).importedIssues;
  }
  if (source === "git") {
    return (response as ConfigureGitResponse).importedCommits;
  }
  return (response as ProjectStandupSyncResponse).importedStandups;
};

const runProjectSignalSync = async <Source extends ProjectSyncSource>(
  source: Source,
  projectId: string,
  personaId: string
): Promise<ProjectSyncResponseBySource[Source]> => {
  if (source === "jira") {
    return syncJiraInSupabase(projectId, personaId) as Promise<ProjectSyncResponseBySource[Source]>;
  }
  if (source === "git") {
    return syncGitInSupabase(projectId, personaId) as Promise<ProjectSyncResponseBySource[Source]>;
  }
  return syncProjectStandupsInSupabase(projectId, personaId) as Promise<ProjectSyncResponseBySource[Source]>;
};

export const syncProjectSignalsInSupabase = async <Source extends ProjectSyncSource>(
  projectId: string,
  personaId: string,
  primarySource: Source
): Promise<ProjectSyncResponseBySource[Source]> => {
  const sources: ProjectSyncSource[] = primarySource === "git" ? ["git"] : ["standup", "jira"];
  const settled = await Promise.all(
    sources.map(async (source) => {
      try {
        const response = await runProjectSignalSync(source, projectId, personaId);
        return {
          source,
          status: "succeeded" as const,
          response,
          summary: {
            source,
            status: "succeeded" as const,
            importedCount: importedCountForSync(source, response)
          } satisfies ProjectSignalSyncStatus
        };
      } catch (err) {
        const warning = `${source === "jira" ? "Jira" : source === "git" ? "Git" : "Standup"} sync skipped: ${
          err instanceof Error ? err.message : "Unknown sync error"
        }`;
        return {
          source,
          status: "failed" as const,
          error: err,
          summary: {
            source,
            status: "failed" as const,
            warning
          } satisfies ProjectSignalSyncStatus
        };
      }
    })
  );
  const primary = settled.find((entry) => entry.source === primarySource);

  if (!primary || primary.status === "failed") {
    throw primary?.error instanceof Error ? primary.error : new Error(`Unable to sync ${primarySource}.`);
  }

  const linkedSyncs = settled.filter((entry) => entry.source !== primarySource).map((entry) => entry.summary);
  const linkedWarnings = linkedSyncs.map((entry) => entry.warning).filter((warning): warning is string => Boolean(warning));
  const response = primary.response as ProjectSyncResponseBySource[Source];

  return {
    ...response,
    linkedSyncs,
    warnings: [...response.warnings, ...linkedWarnings]
  };
};

export const getProjectDashboardFromSupabase = async (
  projectId: string,
  personaId: string,
  sprintId?: string
): Promise<ProjectDashboardResponse> => {
  const context = await loadProjectContext(projectId, personaId);
  const signals = await fetchSignals(context.project, sprintId);
  return buildDashboard(context, signals);
};

export const getProjectMemberPulseFromSupabase = async (
  projectId: string,
  memberId: string,
  personaId: string,
  sprintId?: string
): Promise<{ member: MemberPulse; project: SprintProject }> => {
  const response = await getProjectMemberHistoryFromSupabase(projectId, memberId, personaId, sprintId);
  return {
    member: response.member,
    project: response.project
  };
};

export const getProjectMemberHistoryFromSupabase = async (
  projectId: string,
  memberId: string,
  personaId: string,
  sprintId?: string
): Promise<MemberPulseHistoryResponse> => {
  const context = await loadProjectContext(projectId, personaId);
  const signals = await fetchSignals(context.project, sprintId);
  const dashboard = buildDashboard(context, signals, memberId);
  const member = dashboard.memberPulses[0];

  if (!member) {
    throw new Error("Member not found or not visible to this user.");
  }

  return {
    viewer: context.viewer,
    project: context.project,
    member,
    issues: signals.issues.filter((issue) => issue.assigneeProfileId === memberId),
    commits: signals.commits.filter((commit) => commit.authorProfileId === memberId),
    recommendations: signals.recommendations.filter((recommendation) => !recommendation.profileId || recommendation.profileId === memberId),
    standups: signals.standups
      .filter((standup) => standup.profile_id === memberId)
      .map((standup) => standupToMember(standup, context.project))
  };
};
