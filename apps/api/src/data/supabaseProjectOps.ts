import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import type {
  AppRole,
  AiChatRequest,
  AiChatResponse,
  AiNotification,
  AiNotificationAudience,
  AiPrReviewResponse,
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
  JiraOAuthCallbackResponse,
  JiraOAuthStartRequest,
  JiraOAuthStartResponse,
  LinkProjectMemberRequest,
  MemberPulse,
  MemberPulseHistoryResponse,
  Permission,
  Persona,
  ProjectDashboardResponse,
  ProjectInvite,
  ProjectMember,
  ProjectNotificationsResponse,
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
  UpdateProjectMemberRequest
} from "@sprintpulse/shared";
import {
  answerProjectQuestion,
  analyzeDailyStatusWithAi,
  enhanceDashboardWithAi,
  generateAiNotifications,
  parseTranscriptWithAi,
  reviewPullRequestsWithAi
} from "../ai/sprintpulseAi.js";
import { jiraOAuthConfig, jiraOAuthConfigError, jiraOAuthConfigured } from "../config/jira.js";
import {
  buildJiraAuthorizationUrl,
  exchangeJiraAuthorizationCode,
  getActiveJiraSprint,
  getJiraAccessibleResources,
  getJiraCurrentUser,
  listJiraBoards,
  listJiraAssignableUsers,
  refreshJiraAccessToken,
  searchJiraIssues,
  type JiraAccessibleResource,
  type JiraCloudIssue,
  type JiraOAuthTokenResponse,
  type JiraUser
} from "../integrations/jiraCloud.js";
import {
  fetchGitCommitDetails,
  fetchGitCommits,
  fetchGitPullRequestCommits,
  fetchGitPullRequestFiles,
  fetchGitPullRequestReviewSignals,
  fetchGitPullRequests,
  configuredGitProvider,
  gitCommitInSprint,
  gitMaxPagesLimit,
  gitProviderLabel,
  gitReviewName,
  mergeGitCommits,
  type GitProvider,
  type GitProviderCommit,
  type GitProviderConnection,
  type GitProviderPullRequest,
  type GitProviderPullRequestFile,
  type PullRequestReviewSignal
} from "../integrations/gitProviders.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  AI_DASHBOARD_SNAPSHOT_TITLE,
  persistAiAnalysisRun,
  readAiDashboardSnapshot,
  writeAiDashboardSnapshot
} from "./supabaseAiSnapshots.js";
import { buildSupabaseProjectDetail } from "./supabaseProjects.js";
import { profilesTable, roleDefaults, toProfile, type ProfileRow } from "./supabaseProfiles.js";
import { insertSyncRun, toSyncRun, type SyncRunRow } from "./supabaseSyncRuns.js";

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

type JiraOAuthTokenRow = {
  connection_id: string;
  access_token: string;
  refresh_token?: string | null;
  token_type?: string | null;
  scopes?: string[] | null;
  expires_at?: string | null;
};

type JiraOAuthStateRow = {
  state: string;
  project_id: string;
  persona_id: string;
  jira_site?: string | null;
  project_key?: string | null;
  expires_at: string;
};

type ProjectMemberRow = {
  project_id: string;
  profile_id: string;
  role: ProjectRole;
  jira_account_id?: string | null;
  github_username?: string | null;
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
  token_ciphertext?: string | null;
  token_nonce?: string | null;
  token_tag?: string | null;
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

const gitTokenEncryptionKey = () => {
  const secret = (process.env.GIT_TOKEN_ENCRYPTION_KEY ?? process.env.SPRINTPULSE_API_KEY ?? "").trim();
  if (!secret) {
    throw new Error("Set GIT_TOKEN_ENCRYPTION_KEY in apps/api env before storing per-project Git tokens.");
  }

  return createHash("sha256").update(secret).digest();
};

const encryptGitToken = (token: string) => {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", gitTokenEncryptionKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);

  return {
    token_ciphertext: ciphertext.toString("base64"),
    token_nonce: nonce.toString("base64"),
    token_tag: cipher.getAuthTag().toString("base64")
  };
};

const decryptGitToken = (row: Pick<GitConnectionRow, "token_ciphertext" | "token_nonce" | "token_tag">) => {
  if (!row.token_ciphertext || !row.token_nonce || !row.token_tag) {
    return undefined;
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", gitTokenEncryptionKey(), Buffer.from(row.token_nonce, "base64"));
    decipher.setAuthTag(Buffer.from(row.token_tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(row.token_ciphertext, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw new Error("Stored Git token could not be decrypted. Re-save the repository token for this project.");
  }
};

const toGitRuntimeConnection = (row: GitConnectionRow): GitProviderConnection => ({
  ...toGitConnection(row),
  accessToken: decryptGitToken(row)
});

const normalizeGitProvider = (provider?: ConfigureGitRequest["provider"] | null): GitProvider =>
  provider === "gitlab" || provider === "github" ? provider : configuredGitProvider();

const normalizeGitBaseUrl = (provider: GitProvider, value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return provider === "gitlab" ? "https://gitlab.com/api/v4" : null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const withoutTrailingSlash = withProtocol.replace(/\/+$/, "");
  if (provider === "gitlab" && !/\/api\/v4$/i.test(withoutTrailingSlash)) {
    return `${withoutTrailingSlash}/api/v4`;
  }

  return withoutTrailingSlash;
};

const gitTokenStatusFromError = (message: string): GitConnection["tokenStatus"] =>
  /revoked/i.test(message) ? "revoked" : /auth|token|401|403/i.test(message) ? "invalid" : "unchecked";

const loadGitRuntimeConnection = async (projectId: string) => {
  const client = requireSupabaseAdmin();
  const { data, error } = await client.from("git_connections").select("*").eq("project_id", projectId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Configure Git before running sync.");
  }

  return toGitRuntimeConnection(data as GitConnectionRow);
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

const notificationAudienceForViewer = (viewer: Persona): AiNotificationAudience => {
  if (viewer.productPersona === "developer") return "developer";
  if (viewer.productPersona === "qa-lead") return "qa";
  if (viewer.productPersona === "presenter") return "team";
  return "manager";
};

const recommendationToNotification = (
  recommendation: SprintRecommendation,
  dashboard: ProjectDashboardResponse
): AiNotification => {
  const target = recommendation.profileId
    ? dashboard.project.members.find((member) => member.personaId === recommendation.profileId)
    : undefined;
  const isOwnPulse = recommendation.profileId === dashboard.viewer.id;

  return {
    id: `recommendation-${recommendation.id}`,
    projectId: recommendation.projectId,
    sprintId: recommendation.sprintId,
    personaId: recommendation.profileId,
    audience: notificationAudienceForViewer(dashboard.viewer),
    severity: recommendation.severity,
    title: recommendation.title,
    message: target && !isOwnPulse ? `${target.name}: ${recommendation.message}` : recommendation.message,
    actionLabel: recommendation.profileId ? (isOwnPulse ? "Open my pulse" : "Open member pulse") : "Open dashboard",
    actionHref: recommendation.profileId
      ? `/projects/${dashboard.project.id}/members/${recommendation.profileId}`
      : `/projects/${dashboard.project.id}/dashboard`,
    source: "recommendation",
    createdAt: recommendation.createdAt
  };
};

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

const localDateKey = () => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const currentSprintFrom = (project: SprintProject, sprints: SprintRow[]): SprintRow =>
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
      .neq("title", AI_DASHBOARD_SNAPSHOT_TITLE)
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

const buildMemberPulse = (project: SprintProject, member: ProjectMember, signals: ProjectSignals): MemberPulse => {
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
    permissions: context.permissions,
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
  let linkableUsers: ReturnType<typeof toProfile>[] = [];
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

    linkableUsers = ((profiles.data ?? []) as ProfileRow[])
      .map(toProfile)
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

const slugFromJiraAccountId = (accountId: string) =>
  accountId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const jiraProfileIdFrom = (user: JiraUser) => {
  const accountSlug = user.accountId ? slugFromJiraAccountId(user.accountId) : "";
  const emailSlug = user.emailAddress ? slugFromEmail(user.emailAddress) : "";
  return accountSlug ? `jira-${accountSlug}` : emailSlug ? `jira-${emailSlug}` : `jira-${randomUUID()}`;
};

const jiraUserEmail = (user: JiraUser, profileId: string) =>
  user.emailAddress?.trim().toLowerCase() || `${profileId}@jira.local`;

const isSyntheticJiraEmail = (email: string) => email.trim().toLowerCase().endsWith("@jira.local");

const jiraUserName = (user: JiraUser) =>
  user.displayName?.trim() || user.emailAddress?.trim() || user.accountId?.trim() || "Jira teammate";

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

  const { error } = await client.from("project_members").update(update).eq("project_id", projectId).eq("profile_id", profileId);
  if (error) {
    throw new Error(error.message);
  }

  return buildSupabaseTeam(projectId, input.personaId);
};

export const linkSupabaseProjectMember = async (
  projectId: string,
  sourceProfileId: string,
  input: LinkProjectMemberRequest
): Promise<TeamResponse | undefined> => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context?.permissions.includes("project:editTeam")) {
    throw new Error("You do not have permission to edit this team.");
  }

  const targetProfileId = input.targetProfileId.trim();
  if (!targetProfileId || sourceProfileId === targetProfileId) {
    throw new Error("Choose a different SprintPulse user to link this identity.");
  }

  if (context.project.createdBy === sourceProfileId) {
    throw new Error("The project creator cannot be merged into another user.");
  }

  const client = requireSupabaseAdmin();
  const [sourceMemberRead, targetMemberRead, sourceProfileRead, targetProfileRead] = await Promise.all([
    client.from("project_members").select("*").eq("project_id", projectId).eq("profile_id", sourceProfileId).maybeSingle(),
    client.from("project_members").select("*").eq("project_id", projectId).eq("profile_id", targetProfileId).maybeSingle(),
    client.from(profilesTable).select("*").eq("id", sourceProfileId).maybeSingle(),
    client.from(profilesTable).select("*").eq("id", targetProfileId).maybeSingle()
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
    return undefined;
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

  const targetRole = targetMember?.role ?? sourceMember.role ?? roleDefaults[targetProfile.app_role].projectRole;
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

const normalizeJiraSite = (site: string) =>
  site
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();

const jiraBrowseUrl = (siteUrl: string, issueKey: string) => `https://${normalizeJiraSite(siteUrl)}/browse/${issueKey}`;

const tokenExpiryFrom = (tokens: JiraOAuthTokenResponse) =>
  tokens.expires_in ? new Date(Date.now() + Math.max(0, tokens.expires_in - 60) * 1000).toISOString() : null;

const scopesFrom = (tokens: JiraOAuthTokenResponse) =>
  (tokens.scope ?? jiraOAuthConfig.scopes.join(" "))
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

const saveJiraToken = async (
  connectionId: string,
  tokens: JiraOAuthTokenResponse,
  existingRefreshToken?: string | null
) => {
  const client = requireSupabaseAdmin();
  const { error } = await client.from("jira_oauth_tokens").upsert(
    {
      connection_id: connectionId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? existingRefreshToken ?? null,
      token_type: tokens.token_type ?? "Bearer",
      scopes: scopesFrom(tokens),
      expires_at: tokenExpiryFrom(tokens),
      updated_at: new Date().toISOString()
    },
    { onConflict: "connection_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
};

const selectJiraResource = (resources: JiraAccessibleResource[], requestedSite?: string | null) => {
  const requestedHost = requestedSite ? normalizeJiraSite(requestedSite) : "";
  const matched = requestedHost
    ? resources.find((resource) => normalizeJiraSite(resource.url) === requestedHost)
    : undefined;

  return {
    resource: matched ?? resources[0] ?? null,
    warning:
      requestedHost && !matched && resources[0]
        ? `Authorized Jira site did not exactly match ${requestedHost}; using ${resources[0].url}.`
        : undefined
  };
};

const getJiraToken = async (connectionId: string) => {
  const client = requireSupabaseAdmin();
  const { data, error } = await client
    .from("jira_oauth_tokens")
    .select("*")
    .eq("connection_id", connectionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as JiraOAuthTokenRow | null) ?? null;
};

const getFreshJiraAccessToken = async (connection: JiraConnection) => {
  const token = await getJiraToken(connection.id);
  if (!token) {
    throw new Error("Connect Jira with OAuth before running sync.");
  }

  const expiresAt = token.expires_at ? new Date(token.expires_at).getTime() : 0;
  if (!expiresAt || expiresAt > Date.now() + 60 * 1000) {
    return token.access_token;
  }

  if (!token.refresh_token) {
    throw new Error("Jira OAuth access has expired. Reconnect Jira to refresh authorization.");
  }

  const refreshed = await refreshJiraAccessToken(token.refresh_token);
  await saveJiraToken(connection.id, refreshed, token.refresh_token);

  return refreshed.access_token;
};

const mapJiraStatus = (issue: JiraCloudIssue): JiraIssue["status"] => {
  const name = issue.fields?.status?.name?.toLowerCase() ?? "";
  const category = issue.fields?.status?.statusCategory?.key?.toLowerCase() ?? "";

  if (category === "done" || name.includes("done") || name.includes("closed") || name.includes("resolved")) {
    return "Done";
  }
  if (name.includes("block")) {
    return "Blocked";
  }
  if (name.includes("review") || name.includes("qa") || name.includes("test")) {
    return "Review";
  }
  if (category === "indeterminate" || name.includes("progress") || name.includes("doing")) {
    return "In Progress";
  }

  return "Todo";
};

const storyPointsFrom = (issue: JiraCloudIssue) => {
  const value = issue.fields?.[jiraOAuthConfig.storyPointsField];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const jiraUsersFromIssues = (issues: JiraCloudIssue[]): JiraUser[] =>
  issues
    .map((issue) => issue.fields?.assignee)
    .filter((assignee): assignee is NonNullable<JiraCloudIssue["fields"]>["assignee"] => Boolean(assignee))
    .map((assignee) => ({
      accountId: assignee?.accountId,
      displayName: assignee?.displayName,
      emailAddress: assignee?.emailAddress,
      active: true
    }));

const uniqueJiraUsers = (users: JiraUser[]) => {
  const seen = new Set<string>();
  const unique: JiraUser[] = [];

  for (const user of users) {
    if (user.active === false || user.accountType === "app") {
      continue;
    }

    const key =
      user.accountId?.trim() ||
      user.emailAddress?.trim().toLowerCase() ||
      user.displayName?.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(user);
  }

  return unique;
};

const fetchProfileRowById = async (profileId: string) => {
  const client = requireSupabaseAdmin();
  const { data, error } = await client.from(profilesTable).select("*").eq("id", profileId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ProfileRow | null) ?? null;
};

const fetchProfileRowByEmail = async (email: string) => {
  const client = requireSupabaseAdmin();
  const { data, error } = await client.from(profilesTable).select("*").eq("email", email).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ProfileRow | null) ?? null;
};

const createJiraProfile = async (user: JiraUser, requestedBy: string) => {
  const client = requireSupabaseAdmin();
  const profileId = jiraProfileIdFrom(user);
  const email = jiraUserEmail(user, profileId);
  const name = jiraUserName(user);
  const defaults = roleDefaults.developer;
  const { data, error } = await client
    .from(profilesTable)
    .insert({
      id: profileId,
      auth_user_id: null,
      email,
      name,
      initials: initialsFromName(name),
      title: "Jira teammate",
      app_role: "developer",
      product_persona: defaults.productPersona,
      access_scope: defaults.accessScope,
      status: "invited",
      created_at: new Date().toISOString(),
      invited_by: requestedBy
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ProfileRow;
};

const mergeProjectMemberIdentity = async (
  projectId: string,
  sourceProfileId: string,
  targetProfileId: string,
  options: { projectCreatedBy?: string; throwIfMissing?: boolean } = {}
) => {
  if (!sourceProfileId || !targetProfileId || sourceProfileId === targetProfileId) {
    return false;
  }

  if (options.projectCreatedBy && options.projectCreatedBy === sourceProfileId) {
    throw new Error("The project creator cannot be merged into another user.");
  }

  const client = requireSupabaseAdmin();
  const [sourceMemberRead, targetMemberRead, sourceProfileRead, targetProfileRead] = await Promise.all([
    client.from("project_members").select("*").eq("project_id", projectId).eq("profile_id", sourceProfileId).maybeSingle(),
    client.from("project_members").select("*").eq("project_id", projectId).eq("profile_id", targetProfileId).maybeSingle(),
    client.from(profilesTable).select("*").eq("id", sourceProfileId).maybeSingle(),
    client.from(profilesTable).select("*").eq("id", targetProfileId).maybeSingle()
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
    if (options.throwIfMissing) {
      throw new Error("Team member or SprintPulse user was not found.");
    }
    return false;
  }

  if (isSyntheticJiraEmail(targetProfile.email)) {
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

  const targetRole = targetMember?.role ?? sourceMember.role ?? roleDefaults[targetProfile.app_role].projectRole;
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

  return true;
};

const resolveJiraUserProfile = async (
  user: JiraUser,
  requestedBy: string,
  authorizedAccountId: string | undefined,
  existingMemberByJiraAccountId: Map<string, ProjectMemberRow>
) => {
  const accountId = user.accountId?.trim();
  const email = user.emailAddress?.trim().toLowerCase();

  if (accountId && authorizedAccountId && accountId === authorizedAccountId) {
    const authorizedProfile = await fetchProfileRowById(requestedBy);
    if (authorizedProfile) {
      return authorizedProfile;
    }
  }

  const existingMember = accountId ? existingMemberByJiraAccountId.get(accountId) : undefined;
  const existingProfile = existingMember ? await fetchProfileRowById(existingMember.profile_id) : null;
  const profileByEmail = email ? await fetchProfileRowByEmail(email) : null;

  if (
    profileByEmail &&
    (!existingProfile || existingProfile.id === profileByEmail.id || existingProfile.status !== "active" || isSyntheticJiraEmail(existingProfile.email))
  ) {
    return profileByEmail;
  }

  if (existingProfile) {
    return existingProfile;
  }

  if (profileByEmail) {
    return profileByEmail;
  }

  const profileId = jiraProfileIdFrom(user);
  const profileById = await fetchProfileRowById(profileId);
  return profileById ?? createJiraProfile(user, requestedBy);
};

const autoLinkGitCommitsByEmail = async (projectId: string) => {
  const client = requireSupabaseAdmin();
  const commitsRead = await client.from("git_commits").select("author_email").eq("project_id", projectId);

  if (commitsRead.error) {
    throw new Error(commitsRead.error.message);
  }

  const commitEmails = [
    ...new Set(
      ((commitsRead.data ?? []) as Array<{ author_email?: string | null }>)
        .map((commit) => commit.author_email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email && !isSyntheticJiraEmail(email)))
    )
  ];

  if (!commitEmails.length) {
    return { linkedCommitEmails: 0, linkedMembers: 0 };
  }

  const [profilesRead, membersRead] = await Promise.all([
    client.from(profilesTable).select("*").eq("status", "active"),
    client.from("project_members").select("*").eq("project_id", projectId)
  ]);

  if (profilesRead.error) {
    throw new Error(profilesRead.error.message);
  }
  if (membersRead.error) {
    throw new Error(membersRead.error.message);
  }

  const profilesByEmail = new Map(
    ((profilesRead.data ?? []) as ProfileRow[])
      .filter((profile) => !isSyntheticJiraEmail(profile.email))
      .map((profile) => [profile.email.trim().toLowerCase(), profile])
  );
  const existingMemberIds = new Set(((membersRead.data ?? []) as ProjectMemberRow[]).map((member) => member.profile_id));
  const matchedProfiles = commitEmails
    .map((email) => profilesByEmail.get(email))
    .filter((profile): profile is ProfileRow => Boolean(profile));

  if (!matchedProfiles.length) {
    return { linkedCommitEmails: 0, linkedMembers: 0 };
  }

  const newMemberRows = matchedProfiles
    .filter((profile) => !existingMemberIds.has(profile.id))
    .map((profile) => ({
      project_id: projectId,
      profile_id: profile.id,
      role: roleDefaults[profile.app_role].projectRole,
      jira_account_id: null,
      github_username: null
    }));

  if (newMemberRows.length) {
    const memberWrite = await client.from("project_members").upsert(newMemberRows, { onConflict: "project_id,profile_id" });
    if (memberWrite.error) {
      throw new Error(memberWrite.error.message);
    }
  }

  for (const profile of matchedProfiles) {
    const commitWrite = await client
      .from("git_commits")
      .update({ author_profile_id: profile.id })
      .eq("project_id", projectId)
      .ilike("author_email", profile.email.trim().toLowerCase());

    if (commitWrite.error) {
      throw new Error(commitWrite.error.message);
    }
  }

  return { linkedCommitEmails: matchedProfiles.length, linkedMembers: newMemberRows.length };
};

const importJiraProjectMembers = async (
  projectId: string,
  requestedBy: string,
  users: JiraUser[],
  authorizedAccountId?: string
) => {
  const client = requireSupabaseAdmin();
  const jiraUsers = uniqueJiraUsers(users);
  if (!jiraUsers.length) {
    return { importedMembers: 0, autoLinkedMembers: 0 };
  }

  const { data: existingMembers, error: existingMembersError } = await client
    .from("project_members")
    .select("*")
    .eq("project_id", projectId);

  if (existingMembersError) {
    throw new Error(existingMembersError.message);
  }

  const existingMemberRows = (existingMembers ?? []) as ProjectMemberRow[];
  const existingMemberByProfileId = new Map(existingMemberRows.map((member) => [member.profile_id, member]));
  const existingMemberByJiraAccountId = new Map(
    existingMemberRows
      .filter((member) => member.jira_account_id)
      .map((member) => [member.jira_account_id as string, member])
  );
  const memberRowByProfileId = new Map<string, ProjectMemberRow>();
  let autoLinkedMembers = 0;

  for (const user of jiraUsers) {
    const accountId = user.accountId?.trim();
    const profile = await resolveJiraUserProfile(user, requestedBy, authorizedAccountId, existingMemberByJiraAccountId);
    const previouslyMappedMember = accountId ? existingMemberByJiraAccountId.get(accountId) : undefined;
    if (previouslyMappedMember && previouslyMappedMember.profile_id !== profile.id) {
      const merged = await mergeProjectMemberIdentity(projectId, previouslyMappedMember.profile_id, profile.id);
      if (merged) {
        autoLinkedMembers += 1;
        existingMemberByProfileId.delete(previouslyMappedMember.profile_id);
        existingMemberByJiraAccountId.delete(accountId as string);
      }
    }

    const existingMember =
      existingMemberByProfileId.get(profile.id) ??
      (previouslyMappedMember?.profile_id !== profile.id ? previouslyMappedMember : undefined);
    memberRowByProfileId.set(profile.id, {
      project_id: projectId,
      profile_id: profile.id,
      role: existingMember?.role ?? roleDefaults[profile.app_role].projectRole,
      jira_account_id: accountId || existingMember?.jira_account_id || null,
      github_username: existingMember?.github_username ?? null
    });
  }

  const memberRows = [...memberRowByProfileId.values()];
  if (!memberRows.length) {
    return { importedMembers: 0, autoLinkedMembers };
  }

  const { error } = await client.from("project_members").upsert(memberRows);

  if (error) {
    throw new Error(error.message);
  }

  return { importedMembers: memberRows.length, autoLinkedMembers };
};

const memberForJiraAssignee = (project: SprintProject, issue: JiraCloudIssue) => {
  const assignee = issue.fields?.assignee;
  if (!assignee) {
    return undefined;
  }

  const accountId = assignee.accountId?.trim();
  const email = assignee.emailAddress?.trim().toLowerCase();

  return project.members.find(
    (member) =>
      (accountId && member.jiraAccountId?.trim() === accountId) ||
      (email && member.email.trim().toLowerCase() === email)
  );
};

const toJiraIssueUpsertRow = (
  project: SprintProject,
  sprintId: string,
  connection: JiraConnection,
  issue: JiraCloudIssue
) => {
  const assignee = issue.fields?.assignee;
  const member = memberForJiraAssignee(project, issue);

  return {
    project_id: project.id,
    sprint_id: sprintId,
    jira_issue_id: issue.id,
    issue_key: issue.key,
    summary: issue.fields?.summary ?? issue.key,
    status: mapJiraStatus(issue),
    assignee_profile_id: member?.personaId ?? null,
    jira_assignee_id: assignee?.accountId ?? null,
    issue_type: issue.fields?.issuetype?.name ?? null,
    priority: issue.fields?.priority?.name ?? null,
    url: jiraBrowseUrl(connection.siteUrl, issue.key),
    parent_key: issue.fields?.parent?.key ?? null,
    story_points: storyPointsFrom(issue),
    updated_at_source: issue.fields?.updated ?? null,
    raw: issue,
    updated_at: new Date().toISOString()
  };
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
        site_url: normalizeJiraSite(input.jiraSite),
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

  await client.from("jira_oauth_tokens").delete().eq("connection_id", (data as JiraConnectionRow).id);

  return {
    connection: toJiraConnection(data as JiraConnectionRow),
    importedIssues: 0,
    warnings: jiraOAuthConfigured
      ? ["Jira project details are saved. Connect with Atlassian OAuth before running sync."]
      : ["Jira project details are saved. Add Jira OAuth API credentials before running sync."]
  };
};

export const startSupabaseJiraOAuth = async (
  projectId: string,
  input: JiraOAuthStartRequest
): Promise<JiraOAuthStartResponse> => {
  if (!jiraOAuthConfigured) {
    throw new Error(jiraOAuthConfigError ?? "Jira OAuth is not configured.");
  }

  const context = await loadProjectContext(projectId, input.personaId);
  if (!context?.permissions.includes("project:connect")) {
    throw new Error("You do not have permission to connect Jira.");
  }

  const jiraSite = normalizeJiraSite(input.jiraSite);
  const projectKey = input.projectKey.trim().toUpperCase();
  if (!jiraSite || !projectKey) {
    throw new Error("Jira site and project key are required.");
  }

  const client = requireSupabaseAdmin();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const state = randomUUID();

  await client.from("jira_oauth_states").delete().lt("expires_at", now);

  const connectionWrite = await client.from("jira_connections").upsert(
    {
      project_id: projectId,
      site_url: jiraSite,
      project_key: projectKey,
      status: "configured",
      auth_type: "oauth",
      last_error: null,
      created_by: input.personaId,
      updated_at: now
    },
    { onConflict: "project_id" }
  );
  if (connectionWrite.error) {
    throw new Error(connectionWrite.error.message);
  }

  const stateWrite = await client.from("jira_oauth_states").insert({
    state,
    project_id: projectId,
    persona_id: input.personaId,
    jira_site: jiraSite,
    project_key: projectKey,
    expires_at: expiresAt
  });
  if (stateWrite.error) {
    throw new Error(stateWrite.error.message);
  }

  return {
    authorizationUrl: buildJiraAuthorizationUrl(state),
    state,
    expiresAt,
    warnings: ["Atlassian authorization expires in 10 minutes."]
  };
};

export const completeSupabaseJiraOAuth = async (
  code: string,
  state: string
): Promise<JiraOAuthCallbackResponse> => {
  if (!jiraOAuthConfigured) {
    throw new Error(jiraOAuthConfigError ?? "Jira OAuth is not configured.");
  }

  const client = requireSupabaseAdmin();
  const { data: stateData, error: stateError } = await client
    .from("jira_oauth_states")
    .select("*")
    .eq("state", state)
    .maybeSingle();

  if (stateError) {
    throw new Error(stateError.message);
  }

  const savedState = (stateData as JiraOAuthStateRow | null) ?? null;
  if (!savedState || new Date(savedState.expires_at).getTime() < Date.now()) {
    throw new Error("Jira OAuth state expired. Start the connection flow again.");
  }

  const tokens = await exchangeJiraAuthorizationCode(code);
  const resources = await getJiraAccessibleResources(tokens.access_token);
  const { resource, warning } = selectJiraResource(resources, savedState.jira_site);
  if (!resource) {
    throw new Error("No Jira Cloud site was granted to this authorization.");
  }

  const currentUser = await getJiraCurrentUser(tokens.access_token, resource.id).catch(() => null);
  const now = new Date().toISOString();
  const connectionWrite = await client
    .from("jira_connections")
    .upsert(
      {
        project_id: savedState.project_id,
        site_url: normalizeJiraSite(resource.url),
        project_key: (savedState.project_key ?? "").toUpperCase(),
        status: "configured",
        cloud_id: resource.id,
        display_name: resource.name,
        account_id: currentUser?.accountId ?? null,
        auth_type: "oauth",
        last_error: null,
        created_by: savedState.persona_id,
        updated_at: now
      },
      { onConflict: "project_id" }
    )
    .select()
    .single();

  if (connectionWrite.error) {
    throw new Error(connectionWrite.error.message);
  }

  const connection = toJiraConnection(connectionWrite.data as JiraConnectionRow);
  await saveJiraToken(connection.id, tokens);
  await client.from("jira_oauth_states").delete().eq("state", state);

  return {
    projectId: savedState.project_id,
    connection,
    redirectTo: `${jiraOAuthConfig.frontendBaseUrl.replace(/\/+$/, "")}/projects/${savedState.project_id}/integrations?jira=connected`,
    warnings: warning ? [warning] : []
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

  const cloudId = signals.jira.cloudId;
  if (!cloudId) {
    throw new Error("Connect Jira with Atlassian OAuth before running sync.");
  }

  const jiraConnection = signals.jira;

  try {
    const accessToken = await getFreshJiraAccessToken(jiraConnection);
    let boardWarning: string | undefined;
    let sprintWarning: string | undefined;
    let memberWarning: string | undefined;
    const boards = jiraConnection.boardId
      ? [{ id: jiraConnection.boardId, name: "Saved Jira board", type: "scrum" }]
      : await listJiraBoards(accessToken, cloudId, jiraConnection.projectKey).catch((err) => {
          boardWarning = err instanceof Error ? err.message : "Unable to discover Jira boards.";
          return [];
        });
    const board = boards[0] ?? null;
    const activeSprint = board
      ? await getActiveJiraSprint(accessToken, cloudId, board.id).catch((err) => {
          sprintWarning = err instanceof Error ? err.message : "Unable to discover the active Jira sprint.";
          return null;
        })
      : null;
    const issues = await searchJiraIssues(accessToken, cloudId, {
      projectKey: jiraConnection.projectKey,
      sprintId: activeSprint?.id ? String(activeSprint.id) : undefined
    });
    const assignableUsers = await listJiraAssignableUsers(accessToken, cloudId, jiraConnection.projectKey).catch((err) => {
      memberWarning = err instanceof Error ? err.message : "Unable to discover Jira project members.";
      return [];
    });
    let importedMembers = 0;
    let autoLinkedMembers = 0;
    let syncContext = context;
    try {
      const memberImport = await importJiraProjectMembers(
        projectId,
        personaId,
        [...assignableUsers, ...jiraUsersFromIssues(issues)],
        jiraConnection.accountId
      );
      importedMembers = memberImport.importedMembers;
      autoLinkedMembers = memberImport.autoLinkedMembers;
      syncContext = (await loadProjectContext(projectId, personaId)) ?? context;
    } catch (err) {
      memberWarning = err instanceof Error ? err.message : "Unable to import Jira project members.";
    }

    const rows = issues.map((issue) => toJiraIssueUpsertRow(syncContext.project, signals.sprint.id, jiraConnection, issue));

    if (rows.length) {
      const { error } = await client.from("jira_issues").upsert(rows, { onConflict: "project_id,issue_key" });
      if (error) {
        throw new Error(error.message);
      }
    }

    const now = new Date().toISOString();
    const connectionUpdate = {
      status: "synced",
      board_id: board?.id ?? null,
      active_sprint_id: activeSprint?.id ? String(activeSprint.id) : null,
      active_sprint_name: activeSprint?.name ?? null,
      last_error: null,
      last_sync_at: now,
      updated_at: now
    };
    const [connectionWrite, projectWrite] = await Promise.all([
      client.from("jira_connections").update(connectionUpdate).eq("project_id", projectId).select().single(),
      client.from("projects").update({ last_sync_at: now, updated_at: now }).eq("id", projectId)
    ]);

    if (connectionWrite.error) {
      throw new Error(connectionWrite.error.message);
    }
    if (projectWrite.error) {
      throw new Error(projectWrite.error.message);
    }

    const run = await insertSyncRun(projectId, personaId, "jira", {
      importedIssues: rows.length,
      importedMembers,
      autoLinkedMembers,
      jiraProjectKey: jiraConnection.projectKey,
      jiraBoardId: board?.id ?? null,
      jiraSprintId: activeSprint?.id ?? null
    });

    return {
      connection: toJiraConnection(connectionWrite.data as JiraConnectionRow),
      run,
      importedIssues: rows.length,
      warnings: [
        boardWarning ? `Jira board discovery skipped: ${boardWarning}` : null,
        sprintWarning ? `Jira sprint discovery skipped: ${sprintWarning}` : null,
        memberWarning ? `Jira member import skipped: ${memberWarning}` : null,
        importedMembers ? `${importedMembers} Jira team member${importedMembers === 1 ? "" : "s"} linked to SprintPulse.` : null,
        autoLinkedMembers ? `${autoLinkedMembers} Jira placeholder ${autoLinkedMembers === 1 ? "was" : "were"} auto-linked by email.` : null,
        activeSprint ? null : "No active Jira sprint was found; imported the latest project issues instead."
      ].filter((warning): warning is string => Boolean(warning))
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Jira sync failed.";
    const now = new Date().toISOString();
    await client
      .from("jira_connections")
      .update({ status: "failed", last_error: message, updated_at: now })
      .eq("project_id", projectId);
    await insertSyncRun(projectId, personaId, "jira", { importedIssues: 0 }, "failed", message).catch(() => undefined);
    throw err;
  }
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
  const provider = normalizeGitProvider(input.provider);
  const baseUrl = normalizeGitBaseUrl(provider, input.baseUrl);
  const token = input.accessToken?.trim();
  const { data: existingConnection, error: existingError } = await client
    .from("git_connections")
    .select("provider")
    .eq("project_id", projectId)
    .maybeSingle();
  if (existingError) {
    throw new Error(existingError.message);
  }
  const providerChanged = Boolean(existingConnection && (existingConnection as Pick<GitConnectionRow, "provider">).provider !== provider);
  const tokenPatch = token
    ? {
        ...encryptGitToken(token),
        token_status: "unchecked" as const,
        last_verified_at: null,
        last_error: null
      }
    : providerChanged
      ? {
          token_ciphertext: null,
          token_nonce: null,
          token_tag: null,
          token_status: "unchecked" as const,
          last_verified_at: null,
          last_error: null
        }
    : {};

  const { data, error } = await client
    .from("git_connections")
    .upsert(
      {
        project_id: projectId,
        provider,
        base_url: baseUrl,
        repo_owner: input.repoOwner.trim(),
        repo_name: input.repoName.trim(),
        default_branch: input.defaultBranch?.trim() || "main",
        status: "configured",
        created_by: input.personaId,
        updated_at: new Date().toISOString(),
        ...tokenPatch
      },
      { onConflict: "project_id" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  let connectionRow = data as GitConnectionRow;
  const warnings: string[] = [];
  const providerLabel = gitProviderLabel(provider);

  if (input.verify) {
    const now = new Date().toISOString();
    try {
      const runtimeConnection = toGitRuntimeConnection(connectionRow);
      await fetchGitPullRequests(provider, runtimeConnection);
      const { data: verifiedRow, error: verifyUpdateError } = await client
        .from("git_connections")
        .update({
          status: "configured",
          token_status: runtimeConnection.accessToken ? "valid" : "unchecked",
          last_verified_at: now,
          last_error: null,
          updated_at: now
        })
        .eq("project_id", projectId)
        .select()
        .single();

      if (verifyUpdateError) {
        throw new Error(verifyUpdateError.message);
      }
      connectionRow = verifiedRow as GitConnectionRow;
      warnings.push(`${providerLabel} repository access verified.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : `${providerLabel} verification failed.`;
      const { data: failedRow } = await client
        .from("git_connections")
        .update({
          status: "failed",
          token_status: gitTokenStatusFromError(message),
          last_verified_at: now,
          last_error: message,
          updated_at: now
        })
        .eq("project_id", projectId)
        .select()
        .single();
      connectionRow = (failedRow as GitConnectionRow | null) ?? connectionRow;
      warnings.push(`${providerLabel} verification failed: ${message}`);
    }
  }

  return {
    connection: toGitConnection(connectionRow),
    importedCommits: 0,
    warnings: warnings.length ? warnings : [`${providerLabel} is configured. Run sync to import commit activity.`]
  };
};

type GitCommitInsertRow = {
  project_id: string;
  sprint_id: string;
  sha: string;
  author_profile_id: string;
  author_email: string;
  message: string;
  committed_at: string;
  additions: number;
  deletions: number;
  raw: Record<string, string | number | boolean | null>;
};

const normalizedGitValue = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const commitMember = (commit: GitProviderCommit, members: ProjectMember[]) => {
  const login = normalizedGitValue(commit.author?.login);
  const authorEmail = normalizedGitValue(commit.commit.author?.email);
  const committerEmail = normalizedGitValue(commit.commit.committer?.email);

  return members.find((member) => {
    const gitIdentity = normalizedGitValue(member.githubUsername);
    const memberEmail = normalizedGitValue(member.email);

    return (
      Boolean(gitIdentity && (login === gitIdentity || authorEmail === gitIdentity || committerEmail === gitIdentity)) ||
      Boolean(memberEmail && (authorEmail === memberEmail || committerEmail === memberEmail))
    );
  });
};

const gitCommitRows = (
  projectId: string,
  sprint: SprintInfo,
  members: ProjectMember[],
  commits: GitProviderCommit[],
  providerLabel: string
): GitCommitInsertRow[] =>
  commits.flatMap((commit) => {
    const member = commitMember(commit, members);
    if (!member) {
      return [];
    }

    const committedAt = commit.commit.author?.date ?? commit.commit.committer?.date ?? new Date().toISOString();
    const rawMessage = commit.commit.message?.trim() || `${providerLabel} commit`;
    const message = rawMessage.split("\n")[0].slice(0, 240);

    return [
      {
        project_id: projectId,
        sprint_id: sprint.id,
        sha: commit.sha,
        author_profile_id: member.personaId,
        author_email: commit.commit.author?.email ?? member.email,
        message,
        committed_at: committedAt,
        additions: commit.stats?.additions ?? 0,
        deletions: commit.stats?.deletions ?? 0,
        raw: {
          source: "git",
          repo: null,
          url: commit.html_url ?? null,
          gitAuthor: commit.author?.login ?? null
        }
      }
    ];
  });

const stalePullRequestDays = () => {
  const parsed = Number(process.env.GIT_STALE_REVIEW_DAYS ?? process.env.GITLAB_STALE_MR_DAYS ?? process.env.GITHUB_STALE_PR_DAYS ?? 2);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 2;
};

const pullRequestMember = (
  pullRequest: GitProviderPullRequest,
  members: ProjectMember[],
  pullRequestCommits: Map<number, GitProviderCommit[]>
) => {
  const commits = pullRequestCommits.get(pullRequest.number) ?? [];
  const commitMappedMember = [...commits]
    .reverse()
    .map((commit) => commitMember(commit, members))
    .find((member): member is ProjectMember => Boolean(member));
  if (commitMappedMember) {
    return commitMappedMember;
  }

  const login = normalizedGitValue(pullRequest.user?.login);
  const loginMember = members.find((member) => Boolean(member.githubUsername && normalizedGitValue(member.githubUsername) === login));
  return loginMember;
};

const gitPullRequestStats = (
  members: ProjectMember[],
  pullRequests: GitProviderPullRequest[],
  pullRequestCommits: Map<number, GitProviderCommit[]>,
  sprint: SprintInfo,
  reviewSignals: Map<number, PullRequestReviewSignal>
) => {
  const openPrsByMember: Record<string, number> = {};
  const stalePrsByMember: Record<string, number> = {};
  const reviewedPrsByMember: Record<string, number> = {};
  const pullRequestChurnByMember: Record<string, NonNullable<GitSignal["pullRequestChurn"]>> = {};
  const reviewSubmissionsByMember: Record<string, number> = {};
  const reviewApprovalsByMember: Record<string, number> = {};
  const reviewCommentsByMember: Record<string, number> = {};
  const reviewConversationCommentsByMember: Record<string, number> = {};
  const reviewInlineCommentsByMember: Record<string, number> = {};
  const reviewBodyCommentsByMember: Record<string, number> = {};
  const reviewCommitCommentsByMember: Record<string, number> = {};
  const reviewChangeRequestsByMember: Record<string, number> = {};
  const reviewIssuesByMember: Record<string, number> = {};
  const staleDays = stalePullRequestDays();

  for (const pullRequest of pullRequests) {
    const member = pullRequestMember(pullRequest, members, pullRequestCommits);
    if (!member) {
      continue;
    }

    const isOpen = (pullRequest.state ?? "open") === "open";
    if (isOpen) {
      openPrsByMember[member.personaId] = (openPrsByMember[member.personaId] ?? 0) + 1;

      const updatedAt = new Date(pullRequest.updated_at).getTime();
      const ageDays = Number.isNaN(updatedAt) ? 0 : Math.floor((Date.now() - updatedAt) / (24 * 60 * 60 * 1000));
      if (!pullRequest.draft && ageDays >= staleDays) {
        stalePrsByMember[member.personaId] = (stalePrsByMember[member.personaId] ?? 0) + 1;
      }

      const sprintCommits = (pullRequestCommits.get(pullRequest.number) ?? []).filter((commit) =>
        gitCommitInSprint(commit, sprint)
      );
      const additions = sprintCommits.reduce((total, commit) => total + (commit.stats?.additions ?? 0), 0);
      const deletions = sprintCommits.reduce((total, commit) => total + (commit.stats?.deletions ?? 0), 0);
      const current = pullRequestChurnByMember[member.personaId] ?? [];
      pullRequestChurnByMember[member.personaId] = [
        ...current,
        {
          number: pullRequest.number,
          title: pullRequest.title,
          url: pullRequest.html_url,
          state: pullRequest.state ?? "open",
          updatedAt: pullRequest.updated_at,
          commits: sprintCommits.length,
          additions,
          deletions,
          churnLines: additions + deletions
        }
      ].sort((left, right) => right.churnLines - left.churnLines || right.number - left.number);
    }

    const reviewSignal = reviewSignals.get(pullRequest.number);
    if (reviewSignal?.reviewCount || reviewSignal?.reviewComments) {
      reviewedPrsByMember[member.personaId] = (reviewedPrsByMember[member.personaId] ?? 0) + 1;
    }
    if (reviewSignal?.reviewCount) {
      reviewSubmissionsByMember[member.personaId] =
        (reviewSubmissionsByMember[member.personaId] ?? 0) + reviewSignal.reviewCount;
    }
    if (reviewSignal?.approvals) {
      reviewApprovalsByMember[member.personaId] =
        (reviewApprovalsByMember[member.personaId] ?? 0) + reviewSignal.approvals;
    }
    if (reviewSignal?.reviewComments) {
      reviewCommentsByMember[member.personaId] =
        (reviewCommentsByMember[member.personaId] ?? 0) + reviewSignal.reviewComments;
    }
    if (reviewSignal?.conversationComments) {
      reviewConversationCommentsByMember[member.personaId] =
        (reviewConversationCommentsByMember[member.personaId] ?? 0) + reviewSignal.conversationComments;
    }
    if (reviewSignal?.inlineComments) {
      reviewInlineCommentsByMember[member.personaId] =
        (reviewInlineCommentsByMember[member.personaId] ?? 0) + reviewSignal.inlineComments;
    }
    if (reviewSignal?.reviewBodyComments) {
      reviewBodyCommentsByMember[member.personaId] =
        (reviewBodyCommentsByMember[member.personaId] ?? 0) + reviewSignal.reviewBodyComments;
    }
    if (reviewSignal?.commitComments) {
      reviewCommitCommentsByMember[member.personaId] =
        (reviewCommitCommentsByMember[member.personaId] ?? 0) + reviewSignal.commitComments;
    }
    if (reviewSignal?.changeRequests) {
      reviewChangeRequestsByMember[member.personaId] =
        (reviewChangeRequestsByMember[member.personaId] ?? 0) + reviewSignal.changeRequests;
    }
    if (reviewSignal?.issueCount) {
      reviewIssuesByMember[member.personaId] =
        (reviewIssuesByMember[member.personaId] ?? 0) + reviewSignal.issueCount;
    }
  }

  return {
    openPrsByMember,
    stalePrsByMember,
    reviewedPrsByMember,
    pullRequestChurnByMember,
    reviewSubmissionsByMember,
    reviewApprovalsByMember,
    reviewCommentsByMember,
    reviewConversationCommentsByMember,
    reviewInlineCommentsByMember,
    reviewBodyCommentsByMember,
    reviewCommitCommentsByMember,
    reviewChangeRequestsByMember,
    reviewIssuesByMember
  };
};

const pullRequestFilesForAi = (files: GitProviderPullRequestFile[]) => {
  let remainingPatchBudget = 12_000;

  return files.slice(0, 25).map((file) => {
    const rawPatch = file.patch ?? "";
    const patch = remainingPatchBudget > 0 ? rawPatch.slice(0, Math.min(1_500, remainingPatchBudget)) : "";
    remainingPatchBudget -= patch.length;

    return {
      filename: file.filename,
      status: file.status,
      additions: file.additions ?? 0,
      deletions: file.deletions ?? 0,
      patch
    };
  });
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
  const gitConnection = await loadGitRuntimeConnection(projectId);
  const provider = normalizeGitProvider(gitConnection.provider);
  const providerLabel = gitProviderLabel(provider);
  const reviewName = gitReviewName(provider);

  let gitCommitList: GitProviderCommit[];
  let gitPullRequests: GitProviderPullRequest[];
  let branchCommits: GitProviderCommit[];
  let pullRequestCommits: Map<number, GitProviderCommit[]>;
  let pullRequestReviewResult: Awaited<ReturnType<typeof fetchGitPullRequestReviewSignals>>;

  try {
    [gitCommitList, gitPullRequests] = await Promise.all([
      fetchGitCommits(provider, gitConnection, signals.sprint),
      fetchGitPullRequests(provider, gitConnection)
    ]);
    branchCommits = await fetchGitCommitDetails(provider, gitConnection, gitCommitList);
    [pullRequestCommits, pullRequestReviewResult] = await Promise.all([
      fetchGitPullRequestCommits(provider, gitConnection, gitPullRequests),
      fetchGitPullRequestReviewSignals(provider, gitConnection, gitPullRequests)
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : `${providerLabel} sync failed.`;
    const now = new Date().toISOString();
    await client
      .from("git_connections")
      .update({
        status: "failed",
        token_status: gitTokenStatusFromError(message),
        last_error: message,
        updated_at: now
      })
      .eq("project_id", projectId);
    await insertSyncRun(projectId, personaId, "git", { importedCommits: 0, repo: `${gitConnection.repoOwner}/${gitConnection.repoName}` }, "failed", message).catch(
      () => undefined
    );
    throw err;
  }

  const pullRequestCommitList = Array.from(pullRequestCommits.values()).flat().filter((commit) =>
    gitCommitInSprint(commit, signals.sprint)
  );
  const gitCommits = mergeGitCommits([...branchCommits, ...pullRequestCommitList]);
  const pullRequestStats = gitPullRequestStats(
    context.project.members,
    gitPullRequests,
    pullRequestCommits,
    signals.sprint,
    pullRequestReviewResult.reviewSignals
  );
  const rows = gitCommitRows(projectId, signals.sprint, context.project.members, gitCommits, providerLabel).map((row) => ({
    ...row,
    raw: {
      ...row.raw,
      source: provider,
      repo: `${gitConnection.repoOwner}/${gitConnection.repoName}`
    }
  }));

  const { error: demoDeleteError } = await client
    .from("git_commits")
    .delete()
    .eq("project_id", projectId)
    .eq("sprint_id", signals.sprint.id)
    .contains("raw", { demoSafe: true });
  if (demoDeleteError) {
    throw new Error(demoDeleteError.message);
  }

  const staleGitDeletes = await Promise.all(
    (["github", "gitlab"] as GitProvider[]).map((source) =>
      client
        .from("git_commits")
        .delete()
        .eq("project_id", projectId)
        .eq("sprint_id", signals.sprint.id)
        .contains("raw", { source })
    )
  );
  const staleGitDeleteError = staleGitDeletes.find((result) => result.error)?.error;
  if (staleGitDeleteError) {
    throw new Error(staleGitDeleteError.message);
  }

  if (rows.length) {
    const { error } = await client.from("git_commits").upsert(rows, { onConflict: "project_id,sha" });
    if (error) {
      throw new Error(error.message);
    }
  }

  let gitEmailLinkWarning: string | undefined;
  const gitEmailLinks = await autoLinkGitCommitsByEmail(projectId).catch((err) => {
    gitEmailLinkWarning = err instanceof Error ? err.message : `Unable to auto-link ${providerLabel} commit emails.`;
    return { linkedCommitEmails: 0, linkedMembers: 0 };
  });

  const now = new Date().toISOString();
  await Promise.all([
    client
      .from("git_connections")
      .update({
        status: "synced",
        token_status: gitConnection.accessToken ? "valid" : "unchecked",
        last_sync_at: now,
        last_verified_at: now,
        last_error: null,
        updated_at: now
      })
      .eq("project_id", projectId),
    client.from("projects").update({ last_sync_at: now, updated_at: now }).eq("id", projectId)
  ]);
  const openPullRequests = gitPullRequests.filter((pullRequest) => pullRequest.state === "open").length;
  const run = await insertSyncRun(projectId, personaId, "git", {
    importedCommits: rows.length,
    fetchedCommits: gitCommits.length,
    fetchedBranchCommits: branchCommits.length,
    fetchedPrCommits: pullRequestCommitList.length,
    openPullRequests,
    openPrsByMember: JSON.stringify(pullRequestStats.openPrsByMember),
    stalePrsByMember: JSON.stringify(pullRequestStats.stalePrsByMember),
    reviewedPrsByMember: JSON.stringify(pullRequestStats.reviewedPrsByMember),
    pullRequestChurnByMember: JSON.stringify(pullRequestStats.pullRequestChurnByMember),
    pullRequestChurnLines: Object.values(pullRequestStats.pullRequestChurnByMember)
      .flat()
      .reduce((total, pullRequest) => total + pullRequest.churnLines, 0),
    reviewSubmissionsByMember: JSON.stringify(pullRequestStats.reviewSubmissionsByMember),
    reviewApprovalsByMember: JSON.stringify(pullRequestStats.reviewApprovalsByMember),
    reviewCommentsByMember: JSON.stringify(pullRequestStats.reviewCommentsByMember),
    reviewConversationCommentsByMember: JSON.stringify(pullRequestStats.reviewConversationCommentsByMember),
    reviewInlineCommentsByMember: JSON.stringify(pullRequestStats.reviewInlineCommentsByMember),
    reviewBodyCommentsByMember: JSON.stringify(pullRequestStats.reviewBodyCommentsByMember),
    reviewCommitCommentsByMember: JSON.stringify(pullRequestStats.reviewCommitCommentsByMember),
    reviewChangeRequestsByMember: JSON.stringify(pullRequestStats.reviewChangeRequestsByMember),
    reviewIssuesByMember: JSON.stringify(pullRequestStats.reviewIssuesByMember),
    reviewSubmissions: Object.values(pullRequestStats.reviewSubmissionsByMember).reduce((total, count) => total + count, 0),
    reviewApprovals: Object.values(pullRequestStats.reviewApprovalsByMember).reduce((total, count) => total + count, 0),
    reviewComments: Object.values(pullRequestStats.reviewCommentsByMember).reduce((total, count) => total + count, 0),
    reviewConversationComments: Object.values(pullRequestStats.reviewConversationCommentsByMember).reduce((total, count) => total + count, 0),
    reviewInlineComments: Object.values(pullRequestStats.reviewInlineCommentsByMember).reduce((total, count) => total + count, 0),
    reviewBodyComments: Object.values(pullRequestStats.reviewBodyCommentsByMember).reduce((total, count) => total + count, 0),
    reviewCommitComments: Object.values(pullRequestStats.reviewCommitCommentsByMember).reduce((total, count) => total + count, 0),
    reviewChangeRequests: Object.values(pullRequestStats.reviewChangeRequestsByMember).reduce((total, count) => total + count, 0),
    reviewIssues: Object.values(pullRequestStats.reviewIssuesByMember).reduce((total, count) => total + count, 0),
    repo: `${gitConnection.repoOwner}/${gitConnection.repoName}`,
    autoLinkedCommitEmails: gitEmailLinks.linkedCommitEmails,
    autoLinkedMembers: gitEmailLinks.linkedMembers
  });
  const hasProviderToken = Boolean(
    gitConnection.accessToken ||
      (provider === "gitlab" ? process.env.GITLAB_TOKEN || process.env.GIT_TOKEN : process.env.GITHUB_TOKEN || process.env.GITHUB_PAT)
  );
  const warnings = [
    ...(hasProviderToken
      ? []
      : [`No ${providerLabel} token is saved for this project, so sync used unauthenticated public-repo access.`]),
    ...(rows.length
      ? [`${providerLabel} sync imported real default-branch and open-${reviewName} commit activity for mapped project members.`]
      : [`${providerLabel} sync found no commits mapped to project members. Check Git identity mapping on the Team page.`]),
    ...(gitPullRequests.length
      ? [`${providerLabel} sync also checked open ${reviewName}s for conversation comments and review feedback.`]
      : []),
    ...pullRequestReviewResult.warnings,
    ...(gitCommits.length >= gitMaxPagesLimit() * 100
      ? [`${providerLabel} sync hit the page cap. Increase GIT_MAX_PAGES if this sprint has more commit history.`]
      : []),
    ...(gitEmailLinks.linkedCommitEmails
      ? [
          `${gitEmailLinks.linkedCommitEmails} ${providerLabel} email ${
            gitEmailLinks.linkedCommitEmails === 1 ? "match was" : "matches were"
          } linked to SprintPulse users.`
        ]
      : []),
    ...(gitEmailLinkWarning ? [`${providerLabel} email auto-link skipped: ${gitEmailLinkWarning}`] : [])
  ];

  return {
    connection: {
      id: gitConnection.id,
      projectId: gitConnection.projectId,
      provider: gitConnection.provider,
      baseUrl: gitConnection.baseUrl,
      repoOwner: gitConnection.repoOwner,
      repoName: gitConnection.repoName,
      defaultBranch: gitConnection.defaultBranch,
      status: "synced",
      tokenStatus: gitConnection.accessToken ? "valid" : "unchecked",
      lastSyncAt: now,
      lastVerifiedAt: now,
      lastError: undefined
    },
    run,
    importedCommits: rows.length,
    warnings
  };
};

export const reviewSupabaseMemberPullRequests = async (
  projectId: string,
  memberId: string,
  personaId: string,
  sprintId?: string,
  pullRequestNumber?: number
): Promise<AiPrReviewResponse | undefined> => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context) {
    return undefined;
  }

  const signals = await fetchSignals(context.project, sprintId);
  const dashboard = buildDashboard(context, signals, memberId);
  const visibleMember = dashboard.memberPulses[0];
  const targetMember = context.project.members.find((member) => member.personaId === memberId);
  if (!visibleMember || !targetMember) {
    return undefined;
  }

  if (!signals.git) {
    throw new Error("Configure Git before running AI PR review.");
  }
  const gitConnection = await loadGitRuntimeConnection(projectId);
  const provider = normalizeGitProvider(gitConnection.provider);

  const gitPullRequests = await fetchGitPullRequests(provider, gitConnection);
  const openPullRequests = gitPullRequests.filter((pullRequest) => (pullRequest.state ?? "open") === "open");
  const pullRequestCommits = await fetchGitPullRequestCommits(provider, gitConnection, openPullRequests);
  const mappedMemberPullRequests = openPullRequests.filter(
    (pullRequest) => pullRequestMember(pullRequest, context.project.members, pullRequestCommits)?.personaId === memberId
  );
  const memberPullRequests = pullRequestNumber
    ? openPullRequests.filter((pullRequest) => pullRequest.number === pullRequestNumber)
    : mappedMemberPullRequests.slice(0, 3);
  const fileWarnings: string[] = [];
  const fileGroups = await Promise.all(
    memberPullRequests.map((pullRequest) => {
      return fetchGitPullRequestFiles(provider, gitConnection, pullRequest).catch((err) => {
        const message = err instanceof Error ? err.message : `${gitProviderLabel(provider)} diff fetch failed.`;
        fileWarnings.push(`${gitReviewName(provider)} #${pullRequest.number} diff metadata skipped: ${message}`);
        return [];
      });
    })
  );
  const reviewPullRequests = memberPullRequests.map((pullRequest, index) => {
    const allCommits = pullRequestCommits.get(pullRequest.number) ?? [];
    const commits = allCommits.filter((commit) => gitCommitInSprint(commit, signals.sprint));
    const files = fileGroups[index] ?? [];
    const fileAdditions = files.reduce((total, file) => total + (file.additions ?? 0), 0);
    const fileDeletions = files.reduce((total, file) => total + (file.deletions ?? 0), 0);
    const commitAdditions = allCommits.reduce((total, commit) => total + (commit.stats?.additions ?? 0), 0);
    const commitDeletions = allCommits.reduce((total, commit) => total + (commit.stats?.deletions ?? 0), 0);
    const fileChurn = fileAdditions + fileDeletions;
    const commitChurn = commitAdditions + commitDeletions;
    const useCommitChurn = commitChurn > fileChurn && commitChurn - fileChurn >= 50;
    const additions = useCommitChurn ? commitAdditions : fileAdditions;
    const deletions = useCommitChurn ? commitDeletions : fileDeletions;

    return {
      number: pullRequest.number,
      title: pullRequest.title,
      url: pullRequest.html_url,
      author: pullRequest.user?.login ?? undefined,
      commits: allCommits.length || commits.length,
      filesChanged: files.length,
      additions,
      deletions,
      churnLines: additions + deletions,
      commitMessages: commits
        .map((commit) => commit.commit.message?.split("\n")[0]?.slice(0, 180) ?? `${gitProviderLabel(provider)} commit`)
        .slice(0, 20),
      files: pullRequestFilesForAi(files)
    };
  });

  const response = await reviewPullRequestsWithAi({
    project: context.project,
    sprint: signals.sprint,
    member: { personaId: targetMember.personaId, name: targetMember.name, email: targetMember.email },
    pullRequests: reviewPullRequests
  });

  return fileWarnings.length ? { ...response, warnings: [...(response.warnings ?? []), ...fileWarnings] } : response;
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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isTranscriptNoiseLine = (line: string) =>
  !line ||
  /^WEBVTT$/i.test(line) ||
  /^\d+$/.test(line) ||
  /^(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[\.,]\d{1,3})?\s*-->\s*(?:\d{1,2}:)?\d{1,2}:\d{2}/.test(line) ||
  /^NOTE\b/i.test(line);

const findTranscriptSpeaker = (line: string, members: ProjectMember[]) => {
  const clean = line.replace(/<[^>]+>/g, "").trim();
  return members.find((member) => {
    const fullName = escapeRegExp(member.name);
    const firstName = escapeRegExp(member.name.split(" ")[0]);
    return new RegExp(`^${fullName}\\b:?$`, "i").test(clean) || new RegExp(`^${firstName}\\b:?$`, "i").test(clean);
  });
};

const buildTranscriptBlocksByMember = (transcript: string, members: ProjectMember[]) => {
  const blocks = new Map<string, string[]>();
  let currentMember: ProjectMember | null = null;

  for (const rawLine of transcript.split(/\n+/)) {
    const line = rawLine.trim();
    if (isTranscriptNoiseLine(line)) {
      continue;
    }

    const inlineSpeaker = members.find((member) => {
      const fullName = escapeRegExp(member.name);
      const firstName = escapeRegExp(member.name.split(" ")[0]);
      return new RegExp(`^(?:${fullName}|${firstName})\\s*:`, "i").test(line);
    });

    if (inlineSpeaker) {
      currentMember = inlineSpeaker;
      const text = line.replace(new RegExp(`^(?:${escapeRegExp(inlineSpeaker.name)}|${escapeRegExp(inlineSpeaker.name.split(" ")[0])})\\s*:\\s*`, "i"), "").trim();
      if (text) {
        blocks.set(inlineSpeaker.personaId, [...(blocks.get(inlineSpeaker.personaId) ?? []), text]);
      }
      continue;
    }

    const speakerOnly = findTranscriptSpeaker(line, members);
    if (speakerOnly) {
      currentMember = speakerOnly;
      continue;
    }

    if (currentMember) {
      blocks.set(currentMember.personaId, [...(blocks.get(currentMember.personaId) ?? []), line]);
    }
  }

  return blocks;
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
  const transcriptBlocksByMember = buildTranscriptBlocksByMember(transcript, parseMembers);
  const parsed = parseMembers
    .map((member, index) => {
      const transcriptBlock = transcriptBlocksByMember.get(member.personaId)?.join(" ");
      const memberLine =
        transcriptBlock ??
        lines.find((line) => line.toLowerCase().startsWith(`${member.name.toLowerCase()}:`)) ??
        lines.find((line) => line.toLowerCase().startsWith(`${member.name.split(" ")[0].toLowerCase()}:`));
      if (!memberLine && index > 3) {
        return null;
      }

      const fields = parsedFields(memberLine ? `${member.name}: ${memberLine}` : `${member.name}: ${lines[index] ?? "Today I continued sprint work. No blockers."}`);
      return {
        memberId: member.personaId,
        name: member.name,
        yesterday: fields.yesterday,
        today: fields.today,
        blockers: fields.blockers,
        confidence: memberLine ? 0.88 : 0.68
      };
    })
    .filter((entry): entry is { memberId: string; name: string; yesterday: string; today: string; blockers: string; confidence: number } =>
      Boolean(entry)
    );
  const aiParsed = await parseTranscriptWithAi(
    context.project,
    personaId,
    transcript,
    parseMembers.map((member) => ({ personaId: member.personaId, name: member.name, email: member.email }))
  );
  const entriesToSave = aiParsed.parsed.length ? aiParsed.parsed : parsed;
  const analysis = await analyzeDailyStatusWithAi({
    project: context.project,
    sprint: signals.sprint,
    parsed: entriesToSave,
    previousStandups: signals.standups.map((standup) => standupToMember(standup, context.project)),
    issues: signals.issues,
    commits: signals.commits
  });

  if (entriesToSave.length) {
    const { error } = await client.from("standups").insert(
      entriesToSave.map((entry) => ({
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
    parsed: entriesToSave,
    analysis,
    aiMeta: aiParsed.meta
  };
};

export const syncSupabaseProjectStandups = async (projectId: string, personaId: string) => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context?.permissions.includes("standup:sync")) {
    throw new Error("You do not have permission to sync standups for this project.");
  }

  const client = requireSupabaseAdmin();
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
      throw new Error(error.message);
    }
  }

  const run = await insertSyncRun(projectId, personaId, "standup", { importedStandups: rows.length });
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
    return syncSupabaseJira(projectId, personaId) as Promise<ProjectSyncResponseBySource[Source]>;
  }
  if (source === "git") {
    return syncSupabaseGit(projectId, personaId) as Promise<ProjectSyncResponseBySource[Source]>;
  }
  return syncSupabaseProjectStandups(projectId, personaId) as Promise<ProjectSyncResponseBySource[Source]>;
};

export const syncSupabaseProjectSignals = async <Source extends ProjectSyncSource>(
  projectId: string,
  personaId: string,
  primarySource: Source
): Promise<ProjectSyncResponseBySource[Source]> => {
  const sources: ProjectSyncSource[] = ["standup", "jira", "git"];
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

export const buildSupabaseProjectDashboard = async (
  projectId: string,
  personaId: string,
  sprintId?: string
): Promise<ProjectDashboardResponse | undefined> => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context) {
    return undefined;
  }

  const signals = await fetchSignals(context.project, sprintId);
  const cachedDashboard = await readAiDashboardSnapshot(projectId, signals.sprint.id, personaId);
  if (cachedDashboard) {
    return cachedDashboard;
  }

  const dashboard = await enhanceDashboardWithAi(buildDashboard(context, signals));
  if (context.permissions.includes("dashboard:viewTeam")) {
    await persistAiAnalysisRun(projectId, personaId, dashboard, signals, "daily").catch(() => undefined);
  }
  return dashboard;
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
  const dashboard = await enhanceDashboardWithAi(buildDashboard(context, signals, memberId));
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

export const buildSupabaseProjectNotifications = async (
  projectId: string,
  personaId: string,
  sprintId?: string
): Promise<ProjectNotificationsResponse | undefined> => {
  const dashboard = await buildSupabaseProjectDashboard(projectId, personaId, sprintId);
  if (!dashboard) {
    return undefined;
  }

  const generated = await generateAiNotifications(dashboard);
  const client = requireSupabaseAdmin();
  const { data, error } = await client
    .from("recommendations")
    .select("*")
    .eq("project_id", projectId)
    .eq("sprint_id", dashboard.project.sprint.id)
    .eq("status", "open")
    .neq("title", AI_DASHBOARD_SNAPSHOT_TITLE)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    throw new Error(error.message);
  }

  const canViewTeam = dashboard.scope === "team";
  const persisted = ((data ?? []) as RecommendationRow[])
    .map(toRecommendation)
    .filter((recommendation) => canViewTeam || !recommendation.profileId || recommendation.profileId === personaId)
    .map((recommendation) => recommendationToNotification(recommendation, dashboard));
  const generatedIds = new Set(persisted.map((notification) => notification.id));
  const notifications = [
    ...persisted,
    ...generated.notifications.filter((notification) => !generatedIds.has(notification.id))
  ].slice(0, 8);

  return {
    viewer: dashboard.viewer,
    project: dashboard.project,
    notifications,
    unreadCount: notifications.filter((notification) => notification.severity !== "info").length,
    meta: generated.meta
  };
};

export const createSupabaseAppNotification = async (
  projectId: string,
  input: {
    personaId: string;
    targetPersonaId?: string;
    title: string;
    message: string;
    severity?: RiskLevel;
    kind?: SprintRecommendation["kind"];
    sprintId?: string;
    issueKeys?: string[];
  }
): Promise<{ viewer: Persona; project: SprintProject; recommendation: SprintRecommendation } | undefined> => {
  const context = await loadProjectContext(projectId, input.personaId);
  if (!context) {
    return undefined;
  }
  if (!context.permissions.includes("project:editTeam")) {
    throw new Error("You do not have permission to create project notifications.");
  }

  const title = input.title.trim();
  const message = input.message.trim();
  if (!title || !message) {
    throw new Error("Title and message are required.");
  }

  const severity = input.severity ?? "medium";
  const validSeverities: RiskLevel[] = ["low", "medium", "high", "critical"];
  if (!validSeverities.includes(severity)) {
    throw new Error("Invalid notification severity.");
  }

  const kind = input.kind ?? "team";
  const validKinds: Array<SprintRecommendation["kind"]> = ["standup", "jira", "git", "delivery", "team"];
  if (!validKinds.includes(kind)) {
    throw new Error("Invalid notification kind.");
  }

  const targetPersonaId = input.targetPersonaId?.trim();
  if (targetPersonaId && !context.project.members.some((member) => member.personaId === targetPersonaId)) {
    throw new Error("Target member is not part of this project.");
  }

  const sprints = await fetchSprints(projectId);
  const sprint = input.sprintId
    ? sprints.find((candidate) => candidate.id === input.sprintId) ?? currentSprintFrom(context.project, sprints)
    : currentSprintFrom(context.project, sprints);
  const client = requireSupabaseAdmin();
  const { data, error } = await client
    .from("recommendations")
    .insert({
      project_id: projectId,
      sprint_id: sprint.id,
      profile_id: targetPersonaId || null,
      kind,
      severity,
      title,
      message,
      inputs: {
        source: "mcp-agent",
        actorPersonaId: input.personaId,
        targetPersonaId: targetPersonaId || null,
        issueKeys: input.issueKeys ?? []
      },
      status: "open"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    viewer: context.viewer,
    project: context.project,
    recommendation: toRecommendation(data as RecommendationRow)
  };
};

export const refreshSupabaseAiInsights = async (
  projectId: string,
  personaId: string,
  sprintId?: string
): Promise<ProjectDashboardResponse | undefined> => {
  const context = await loadProjectContext(projectId, personaId);
  if (!context?.permissions.includes("dashboard:viewTeam")) {
    throw new Error("You do not have permission to refresh AI insights.");
  }

  const signals = await fetchSignals(context.project, sprintId);
  const dashboard = await enhanceDashboardWithAi(buildDashboard(context, signals));
  await persistAiAnalysisRun(projectId, personaId, dashboard, signals, "manual");
  await writeAiDashboardSnapshot(dashboard, personaId);
  return dashboard;
};

export const answerSupabaseProjectAi = async (
  projectId: string,
  input: AiChatRequest
): Promise<AiChatResponse | undefined> => {
  const dashboard = await buildSupabaseProjectDashboard(projectId, input.personaId, input.sprintId);
  if (!dashboard) {
    return undefined;
  }

  return answerProjectQuestion(dashboard, input.message);
};
