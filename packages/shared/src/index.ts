export type HackathonRole = "frontend" | "backend" | "architect" | "qa";

export type ProductPersona =
  | "product-owner"
  | "engineering-manager"
  | "scrum-master"
  | "developer"
  | "qa-lead"
  | "presenter";

export type AccessScope = "team" | "individual" | "quality" | "presentation";

export type AppRole =
  | "admin"
  | "product-owner"
  | "engineering-manager"
  | "scrum-master"
  | "developer"
  | "qa-lead";

export type Permission =
  | "project:view"
  | "project:create"
  | "project:connect"
  | "project:editTeam"
  | "standup:submit"
  | "standup:sync"
  | "dashboard:viewTeam"
  | "dashboard:viewOwn"
  | "member:viewTeam"
  | "member:viewOwn";

export type ProjectRole =
  | "product-owner"
  | "scrum-master"
  | "engineering-manager"
  | "architect"
  | "developer"
  | "qa";

export type ProjectSource = "manual" | "jira";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type FlagType =
  | "VAGUE_UPDATE"
  | "STALE_WORK"
  | "COPY_PASTE"
  | "SAY_DO_GAP"
  | "BLOCKER_ANOMALY"
  | "BURNOUT_SIGNAL"
  | "TEST_RISK"
  | "SPRINT_END_RISK";

export type SyncSource = "jira" | "git" | "standup" | "recommendation";

export type SyncRunStatus = "queued" | "running" | "succeeded" | "failed";

export type IntegrationStatus = "not-configured" | "configured" | "synced" | "failed";

export type AiGenerationSource = "openai" | "fallback" | "disabled" | "cache";

export type AiNotificationAudience = "manager" | "developer" | "qa" | "architect" | "team";

export type AiNotificationSeverity = RiskLevel | "info";

export interface AiGenerationMeta {
  enabled: boolean;
  source: AiGenerationSource;
  generatedAt: string;
  model?: string;
  promptId?: string;
  reason?: string;
  cachedUntil?: string;
}

export interface AiNotification {
  id: string;
  projectId?: string;
  sprintId?: string;
  personaId?: string;
  audience: AiNotificationAudience;
  severity: AiNotificationSeverity;
  title: string;
  message: string;
  actionLabel: string;
  actionHref?: string;
  source: SyncSource | "team" | "sprint" | "ai";
  createdAt: string;
}

export interface ProjectNotificationsResponse {
  viewer: Persona;
  project?: SprintProject;
  notifications: AiNotification[];
  unreadCount: number;
  meta: AiGenerationMeta;
}

export interface AiDashboardOverlay {
  headline: string;
  summary: string;
  scoreExplanation: string;
  nextBestAction: string;
  confidence: number;
  generatedAt: string;
  source: "ai" | "rule";
  notifications?: AiNotification[];
}

export interface AiMemberScore {
  profileId: string;
  healthScore: number;
  riskLevel: RiskLevel;
  flags: RiskFlag[];
  recommendation: string;
  explanation: string;
  confidence: number;
}

export interface AiChatRequest {
  personaId: string;
  message: string;
  sprintId?: string;
}

export interface AiChatResponse {
  answer: string;
  suggestedActions: string[];
  meta: AiGenerationMeta;
}

export interface ParsedTranscriptEntry {
  memberId: string;
  name: string;
  yesterday: string;
  today: string;
  blockers: string;
  confidence: number;
}

export type DailyStatusRiskType =
  | "STATUS_MISMATCH"
  | "UNCLEAR_REQUIREMENT"
  | "DEPENDENCY_WAIT"
  | "TECHNICAL_CHALLENGE"
  | "SYSTEM_ISSUE"
  | "SOFTWARE_ISSUE"
  | "QA_NOT_DONE"
  | "CODE_REVIEW_PENDING"
  | "SPRINT_END_RISK";

export type DailyStatusRiskSeverity = "watch" | "impediment" | "red-flag";

export interface DailyStatusRisk {
  id: string;
  type: DailyStatusRiskType;
  severity: DailyStatusRiskSeverity;
  title: string;
  message: string;
  ownerId?: string;
  ownerName?: string;
  storyKey?: string;
  evidence: string[];
}

export interface UserStoryConfidence {
  storyKey: string;
  title: string;
  ownerId?: string;
  ownerName?: string;
  jiraStatus?: JiraIssue["status"];
  standupStatus: "todo" | "in-progress" | "blocked" | "review" | "done" | "unclear";
  confidenceScore: number;
  canFinishInSprint: boolean;
  reason: string;
  riskTypes: DailyStatusRiskType[];
  evidence: string[];
  transferSuggestion?: {
    shouldTransfer: boolean;
    toMemberId?: string;
    toMemberName?: string;
    toRole?: ProjectRole;
    reason: string;
  };
}

export interface DailyStatusAnalysis {
  generatedAt: string;
  sprintId: string;
  daysRemaining: number;
  isSprintEndingSoon: boolean;
  summary: {
    storyCount: number;
    redFlagCount: number;
    impedimentCount: number;
    averageConfidence: number;
    canCompleteSprint: boolean;
    transferSuggestionCount: number;
  };
  risks: DailyStatusRisk[];
  stories: UserStoryConfidence[];
  meta?: AiGenerationMeta;
}

export interface TranscriptParseResponse {
  mode: string;
  note: string;
  parsed: ParsedTranscriptEntry[];
  analysis?: DailyStatusAnalysis;
  aiMeta?: AiGenerationMeta;
}

export interface ProjectTranscriptParseResponse extends TranscriptParseResponse {
  project: SprintProject;
}

export interface Persona {
  id: string;
  name: string;
  email: string;
  initials: string;
  hackathonRole: HackathonRole;
  productPersona: ProductPersona;
  title: string;
  accessScope: AccessScope;
  focus: string;
}

export interface UserProfile {
  id: string;
  authUserId?: string;
  email: string;
  name: string;
  initials: string;
  title: string;
  appRole: AppRole;
  productPersona: ProductPersona;
  accessScope: AccessScope;
  status: "active" | "invited";
  createdAt: string;
  invitedBy?: string;
}

export interface AuthMeResponse {
  profile: UserProfile;
  persona: Persona;
  recommendedRoute: string;
}

export interface CreateUserProfileRequest {
  email: string;
  name: string;
  appRole: AppRole;
  title?: string;
  authUserId?: string;
}

export interface CreateUserProfileResponse {
  profile: UserProfile;
  persona: Persona;
  recommendedRoute: string;
  warnings: string[];
}

export interface InviteUserRequest {
  email: string;
  name: string;
  title?: string;
  appRole: AppRole;
  projectId?: string;
  projectRole?: ProjectRole;
}

export interface InviteUserResponse {
  profile: UserProfile;
  persona: Persona;
  invitation: {
    status: "sent" | "profile-created";
    message: string;
  };
  warnings: string[];
}

export interface ProjectMember {
  personaId: string;
  name: string;
  email: string;
  initials: string;
  role: ProjectRole;
  jiraAccountId?: string;
  githubUsername?: string;
  standupActive?: boolean;
}

export interface SprintInfo {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: "planned" | "active" | "closed";
}

export interface SprintProject {
  id: string;
  key: string;
  name: string;
  source: ProjectSource;
  jiraSite?: string;
  sprint: SprintInfo;
  members: ProjectMember[];
  ownerIds: string[];
  scrumMasterIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastSyncAt?: string;
}

export interface ProjectSummary {
  id: string;
  key: string;
  name: string;
  source: ProjectSource;
  sprintName: string;
  sprintGoal: string;
  memberCount: number;
  healthScore: number;
  atRiskCount: number;
  currentUserRole: ProjectRole;
  permissions: Permission[];
  lastSyncAt?: string;
}

export interface ProjectsResponse {
  viewer: Persona;
  projects: ProjectSummary[];
  uniqueMemberCount: number;
  canCreateProject: boolean;
  canConnectProject: boolean;
  recommendedProjectId?: string;
}

export interface ProjectDetailResponse {
  viewer: Persona;
  project: SprintProject;
  permissions: Permission[];
}

export interface ProjectWorkspaceResponse {
  viewer: Persona;
  project: SprintProject;
  permissions: Permission[];
  sync: {
    mode: "manual" | "jira";
    lastSyncAt?: string;
    nextSyncAt?: string;
    status: "idle" | "synced" | "needs-setup" | "failed";
  };
  summary: {
    sprintDay: number;
    daysRemaining: number;
    participationRate: number;
    openBlockers: number;
    atRiskCount: number;
    healthScore: number;
  };
  nextActions: Array<{
    id: string;
    label: string;
    description: string;
    route: string;
    requiredPermission?: Permission;
  }>;
}

export interface SyncRun {
  id: string;
  projectId: string;
  source: SyncSource;
  status: SyncRunStatus;
  requestedBy: string;
  startedAt: string;
  finishedAt?: string;
  stats: Record<string, string | number | boolean | null>;
  errorMessage?: string;
}

export interface ProjectSignalSyncStatus {
  source: Exclude<SyncSource, "recommendation">;
  status: Extract<SyncRunStatus, "succeeded" | "failed">;
  importedCount?: number;
  warning?: string;
}

export interface SprintSummary extends SprintInfo {
  issueCount: number;
  standupCount: number;
  commitCount: number;
  blockerCount: number;
  healthScore: number;
}

export interface JiraConnection {
  id: string;
  projectId: string;
  siteUrl: string;
  projectKey: string;
  status: IntegrationStatus;
  cloudId?: string;
  displayName?: string;
  accountId?: string;
  boardId?: number;
  activeSprintId?: string;
  activeSprintName?: string;
  authType?: "manual" | "oauth";
  lastSyncAt?: string;
  lastError?: string;
}

export interface GitConnection {
  id: string;
  projectId: string;
  provider: "github" | "gitlab";
  baseUrl?: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  status: IntegrationStatus;
  tokenStatus?: "valid" | "invalid" | "revoked" | "unchecked";
  lastSyncAt?: string;
  lastVerifiedAt?: string;
  lastError?: string;
}

export interface JiraIssue {
  id: string;
  projectId: string;
  sprintId?: string;
  jiraIssueId?: string;
  issueKey: string;
  summary: string;
  status: "Todo" | "In Progress" | "Review" | "Blocked" | "Done";
  assigneeProfileId?: string;
  jiraAssigneeId?: string;
  issueType?: string;
  priority?: string;
  url?: string;
  parentKey?: string;
  storyPoints?: number;
  daysIdle: number;
  updatedAtSource?: string;
}

export interface GitCommit {
  id: string;
  projectId: string;
  sprintId?: string;
  sha: string;
  authorProfileId?: string;
  authorEmail: string;
  message: string;
  committedAt: string;
  additions: number;
  deletions: number;
}

export interface SprintRecommendation {
  id: string;
  projectId: string;
  sprintId?: string;
  profileId?: string;
  kind: "standup" | "jira" | "git" | "delivery" | "team";
  severity: RiskLevel;
  title: string;
  message: string;
  status: "open" | "acknowledged" | "resolved";
  createdAt: string;
}

export interface ProjectInvite {
  id: string;
  projectId: string;
  email: string;
  role: ProjectRole;
  invitedBy: string;
  status: "pending" | "accepted" | "expired";
  expiresAt?: string;
  createdAt: string;
}

export interface StandupWithMember extends StandupEntry {
  sprintId?: string;
  memberName: string;
  memberInitials: string;
}

export interface ProjectOpsResponse {
  viewer: Persona;
  project: SprintProject;
  permissions: Permission[];
  currentSprint: SprintSummary;
  summary: {
    teamHealthScore: number;
    participationRate: number;
    openBlockers: number;
    atRiskCount: number;
    issueCount: number;
    commitCount: number;
    standupCount: number;
    lastSyncAt?: string;
  };
  integrations: {
    jira: JiraConnection | null;
    git: GitConnection | null;
    recentRuns: SyncRun[];
  };
}

export interface SprintListResponse {
  viewer: Persona;
  project: SprintProject;
  permissions: Permission[];
  currentSprint?: SprintSummary;
  sprints: SprintSummary[];
}

export interface CreateProjectSprintRequest {
  personaId: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: SprintInfo["status"];
}

export interface CreateProjectSprintResponse extends SprintListResponse {
  createdSprint: SprintSummary;
}

export interface TeamResponse {
  viewer: Persona;
  project: SprintProject;
  permissions: Permission[];
  members: ProjectMember[];
  availableUsers: UserProfile[];
  linkableUsers?: UserProfile[];
  invites: ProjectInvite[];
  canEditTeam: boolean;
}

export interface InviteProjectMemberRequest {
  personaId: string;
  email: string;
  name: string;
  appRole: AppRole;
  projectRole: ProjectRole;
  title?: string;
  jiraAccountId?: string;
  githubUsername?: string;
}

export interface InviteProjectMemberResponse {
  profile: UserProfile;
  member: ProjectMember;
  invite: ProjectInvite;
  warnings: string[];
}

export interface UpdateProjectMemberRequest {
  personaId: string;
  role?: ProjectRole;
  jiraAccountId?: string;
  githubUsername?: string;
}

export interface LinkProjectMemberRequest {
  personaId: string;
  targetProfileId: string;
}

export interface IntegrationStatusResponse {
  viewer: Persona;
  project: SprintProject;
  permissions: Permission[];
  jira: JiraConnection | null;
  git: GitConnection | null;
  recentRuns: SyncRun[];
  issuePreview: JiraIssue[];
  commitPreview: GitCommit[];
}

export interface ConfigureJiraRequest {
  personaId: string;
  jiraSite: string;
  projectKey: string;
}

export interface ConfigureJiraResponse {
  connection: JiraConnection;
  run?: SyncRun;
  importedIssues: number;
  warnings: string[];
  linkedSyncs?: ProjectSignalSyncStatus[];
}

export interface JiraOAuthStartRequest extends ConfigureJiraRequest {}

export interface JiraOAuthStartResponse {
  authorizationUrl: string;
  state: string;
  expiresAt: string;
  warnings: string[];
}

export interface JiraOAuthCallbackResponse {
  projectId: string;
  connection: JiraConnection;
  redirectTo: string;
  warnings: string[];
}

export interface ConfigureGitRequest {
  personaId: string;
  provider: "github" | "gitlab";
  baseUrl?: string;
  repoOwner: string;
  repoName: string;
  defaultBranch?: string;
  accessToken?: string;
  verify?: boolean;
}

export interface ConfigureGitResponse {
  connection: GitConnection;
  run?: SyncRun;
  importedCommits: number;
  warnings: string[];
  linkedSyncs?: ProjectSignalSyncStatus[];
}

export interface ProjectStandupSyncResponse {
  project: SprintProject;
  syncedAt: string;
  importedStandups: number;
  warnings: string[];
  linkedSyncs?: ProjectSignalSyncStatus[];
}

export interface ProjectStandupsResponse {
  viewer: Persona;
  project: SprintProject;
  sprint: SprintInfo;
  standups: StandupWithMember[];
  canSubmit: boolean;
  canSync: boolean;
}

export interface MemberPulseHistoryResponse {
  viewer: Persona;
  project: SprintProject;
  member: MemberPulse;
  issues: JiraIssue[];
  commits: GitCommit[];
  recommendations: SprintRecommendation[];
  standups: StandupWithMember[];
}

export interface CreateProjectRequest {
  personaId: string;
  projectName: string;
  projectKey: string;
  sprintName: string;
  sprintGoal: string;
  startDate: string;
  endDate: string;
  members: ProjectMember[];
}

export interface CreateProjectResponse {
  project: SprintProject;
  warnings: string[];
}

export interface JiraConnectRequest {
  personaId: string;
  jiraSite: string;
  projectKey: string;
}

export interface JiraConnectResponse {
  project: SprintProject;
  importedIssues: number;
  importedMembers: number;
  importedAt: string;
  warnings: string[];
}

export interface RiskFlag {
  id: string;
  type: FlagType;
  severity: RiskLevel;
  title: string;
  message: string;
  evidence?: string[];
}

export interface TicketSignal {
  key: string;
  title: string;
  status: "Todo" | "In Progress" | "Review" | "Blocked" | "Done";
  daysIdle: number;
  storyPoints?: number;
}

export interface PullRequestChurnSignal {
  number: number;
  title: string;
  url?: string;
  state?: string;
  updatedAt?: string;
  commits: number;
  additions: number;
  deletions: number;
  churnLines: number;
}

export interface AiPrReviewFinding {
  id: string;
  severity: RiskLevel;
  file?: string;
  line?: number;
  title: string;
  message: string;
  suggestedComment: string;
}

export interface AiPrReviewPullRequest {
  number: number;
  title: string;
  url?: string;
  author?: string;
  commits: number;
  filesChanged: number;
  additions: number;
  deletions: number;
  churnLines: number;
  riskLevel: RiskLevel;
  issueCount: number;
  summary: string;
  suggestedSummaryComment: string;
  findings: AiPrReviewFinding[];
}

export interface AiPrReviewResponse {
  projectId: string;
  sprintId: string;
  memberId: string;
  reviewedAt: string;
  pullRequests: AiPrReviewPullRequest[];
  totals: {
    pullRequests: number;
    issues: number;
    highRiskIssues: number;
    suggestedComments: number;
  };
  meta: AiGenerationMeta;
  warnings?: string[];
}

export interface GitSignal {
  commitsThisSprint: number;
  pullRequestsOpen: number;
  lastCommitAt: string;
  codeChurn: "low" | "medium" | "high";
  lateNightCommits?: number;
  churnLines?: number;
  stalePullRequests?: number;
  lastGitSyncAt?: string;
  reviewIssues?: number;
  reviewComments?: number;
  reviewConversationComments?: number;
  reviewInlineComments?: number;
  reviewBodyComments?: number;
  reviewCommitComments?: number;
  reviewSubmissions?: number;
  reviewApprovals?: number;
  reviewChangeRequests?: number;
  reviewedPullRequests?: number;
  pullRequestChurn?: PullRequestChurnSignal[];
  codeReviewState?: "clean" | "watch" | "needs-fixes";
  codeReviewSummary?: string;
  repoPulseBadges?: string[];
  deliveryConfidence?: number;
  velocityState?: "steady" | "quiet" | "drop" | "late-spike" | "bursty";
  velocitySummary?: string;
  quietDays?: number;
  lateSpikeCommits?: number;
  dominantDayShare?: number;
  dailyActivity?: Array<{
    date: string;
    commits: number;
    churnLines: number;
  }>;
  oldestPullRequestDays?: number;
  reviewPressure?: number;
}

export interface StandupEntry {
  id: string;
  projectId?: string;
  memberId: string;
  date: string;
  yesterday: string;
  today: string;
  blockers: string;
  source: "manual" | "transcript" | "audio";
}

export interface MemberPulse {
  id: string;
  personaId: string;
  name: string;
  initials: string;
  title: string;
  hackathonRole: HackathonRole;
  productPersona: ProductPersona;
  healthScore: number;
  riskLevel: RiskLevel;
  currentFocus: string;
  recommendation: string;
  tickets: TicketSignal[];
  git: GitSignal;
  flags: RiskFlag[];
  standups: StandupEntry[];
  aiScore?: AiMemberScore;
}

export interface DashboardSummary {
  sprintName: string;
  sprintWindow: string;
  teamHealthScore: number;
  atRiskCount: number;
  openBlockers: number;
  totalFlags: number;
  readinessScore: number;
}

export interface TeamPreviewItem {
  id: string;
  name: string;
  initials: string;
  role: HackathonRole;
  score: number;
  riskLevel: RiskLevel;
}

export interface DashboardResponse {
  viewer: Persona;
  scope: AccessScope;
  summary: DashboardSummary;
  viewerPulse: MemberPulse;
  memberPulses: MemberPulse[];
  teamPreview: TeamPreviewItem[];
  recommendations: string[];
  ai?: AiDashboardOverlay;
  aiMeta?: AiGenerationMeta;
}

export interface ProjectDashboardResponse extends DashboardResponse {
  project: SprintProject;
}

export interface DailyStatusAnalysisInput {
  project: SprintProject;
  sprint: SprintInfo;
  parsed: ParsedTranscriptEntry[];
  previousStandups: StandupEntry[];
  issues: JiraIssue[];
  commits: GitCommit[];
  generatedAt?: string;
}

const storyKeyPattern = /\b[A-Z][A-Z0-9]+-\d+\b/g;

const clampPercentage = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const dailyStatusDaysRemaining = (sprint: SprintInfo, generatedAt: string) => {
  const end = new Date(`${sprint.endDate}T23:59:59`);
  const now = new Date(generatedAt);
  if (Number.isNaN(end.getTime()) || Number.isNaN(now.getTime())) {
    return 0;
  }
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
};

const storyKeysFromDailyText = (text: string) => Array.from(new Set(text.toUpperCase().match(storyKeyPattern) ?? []));

const dailyStandupStatus = (text: string): UserStoryConfidence["standupStatus"] => {
  const textWithoutResolvedBlockerPhrases = text.replace(/\bno blockers?\b\.?/gi, "");
  if (/\b(done|completed|closed|resolved|merged|shipped|deployed)\b/i.test(text)) {
    return "done";
  }
  if (/\b(blocked|blocker|waiting|dependency|depends|stuck|cannot proceed)\b/i.test(textWithoutResolvedBlockerPhrases)) {
    return "blocked";
  }
  if (/\b(review|pr|pull request|qa|testing|validation)\b/i.test(text)) {
    return "review";
  }
  if (/\b(working|progress|implement|build|fix|continue|debug)\b/i.test(text)) {
    return "in-progress";
  }
  return "unclear";
};

const dailyRiskLabels: Record<DailyStatusRiskType, string> = {
  STATUS_MISMATCH: "Status mismatch",
  UNCLEAR_REQUIREMENT: "Requirement unclear",
  DEPENDENCY_WAIT: "Dependency wait",
  TECHNICAL_CHALLENGE: "Technical challenge",
  SYSTEM_ISSUE: "System issue",
  SOFTWARE_ISSUE: "Software issue",
  QA_NOT_DONE: "QA not done",
  CODE_REVIEW_PENDING: "Code review pending",
  SPRINT_END_RISK: "Sprint end risk"
};

const dailyRiskMessage: Record<DailyStatusRiskType, string> = {
  STATUS_MISMATCH: "Standup status does not match Jira or previous sprint evidence.",
  UNCLEAR_REQUIREMENT: "The update mentions unclear scope or requirements.",
  DEPENDENCY_WAIT: "The update is waiting on another story, person, approval, or external dependency.",
  TECHNICAL_CHALLENGE: "The update mentions a technical challenge that can block completion.",
  SYSTEM_ISSUE: "The update mentions environment, access, infra, build, deployment, or system trouble.",
  SOFTWARE_ISSUE: "The update mentions defects, bugs, regressions, crashes, or failing software behavior.",
  QA_NOT_DONE: "Sprint close is near and QA or validation is still incomplete.",
  CODE_REVIEW_PENDING: "Sprint close is near and code review or PR approval is still pending too long.",
  SPRINT_END_RISK: "Sprint close is near while this story still has unresolved risk."
};

export const analyzeDailyStatusSignals = ({
  project,
  sprint,
  parsed,
  previousStandups,
  issues,
  commits,
  generatedAt = new Date().toISOString()
}: DailyStatusAnalysisInput): DailyStatusAnalysis => {
  const daysRemaining = dailyStatusDaysRemaining(sprint, generatedAt);
  const isSprintEndingSoon = sprint.status === "active" && daysRemaining <= 2;
  const issueByKey = new Map(issues.map((issue) => [issue.issueKey.toUpperCase(), issue]));
  const activeIssuesByOwner = new Map<string, JiraIssue[]>();

  for (const issue of issues.filter((issue) => issue.status !== "Done")) {
    if (!issue.assigneeProfileId) {
      continue;
    }
    const ownerIssues = activeIssuesByOwner.get(issue.assigneeProfileId) ?? [];
    activeIssuesByOwner.set(issue.assigneeProfileId, [...ownerIssues, issue]);
  }

  const risks: DailyStatusRisk[] = [];
  const stories: UserStoryConfidence[] = [];
  const blockedMemberIds = new Set(
    parsed
      .filter((entry) => dailyStandupStatus(`${entry.yesterday} ${entry.today} ${entry.blockers}`) === "blocked")
      .map((entry) => entry.memberId)
  );

  const preferredRolesForTransfer = (riskTypes: Set<DailyStatusRiskType>) => {
    if (riskTypes.has("QA_NOT_DONE")) {
      return ["qa", "developer", "scrum-master"] as ProjectRole[];
    }
    if (riskTypes.has("TECHNICAL_CHALLENGE") || riskTypes.has("SYSTEM_ISSUE") || riskTypes.has("SOFTWARE_ISSUE")) {
      return ["developer", "architect", "engineering-manager"] as ProjectRole[];
    }
    if (riskTypes.has("UNCLEAR_REQUIREMENT") || riskTypes.has("DEPENDENCY_WAIT") || riskTypes.has("STATUS_MISMATCH")) {
      return ["scrum-master", "engineering-manager", "developer"] as ProjectRole[];
    }
    return ["developer", "qa", "architect"] as ProjectRole[];
  };

  const transferSuggestionFor = (
    currentOwnerId: string,
    riskTypes: Set<DailyStatusRiskType>,
    confidenceScore: number
  ): UserStoryConfidence["transferSuggestion"] => {
    if (confidenceScore >= 70 || !riskTypes.size) {
      return {
        shouldTransfer: false,
        reason: "Current owner can continue; no transfer is needed from the available evidence."
      };
    }

    const preferredRoles = preferredRolesForTransfer(riskTypes);
    const candidates = project.members
      .filter((member) => member.personaId !== currentOwnerId)
      .map((member) => {
        const activeIssueCount = activeIssuesByOwner.get(member.personaId)?.length ?? 0;
        const recentCommitCount = commits.filter((commit) => commit.authorProfileId === member.personaId).length;
        const roleRank = preferredRoles.includes(member.role) ? preferredRoles.indexOf(member.role) : preferredRoles.length + 1;
        const loadScore = activeIssueCount * 8 + (blockedMemberIds.has(member.personaId) ? 30 : 0) + roleRank * 3 - Math.min(6, recentCommitCount);
        return { member, loadScore, activeIssueCount, roleRank };
      })
      .sort((left, right) => left.loadScore - right.loadScore);

    const best = candidates[0];
    if (!best) {
      return {
        shouldTransfer: false,
        reason: "No alternate owner is available; unblock the current owner before moving the story."
      };
    }

    return {
      shouldTransfer: true,
      toMemberId: best.member.personaId,
      toMemberName: best.member.name,
      toRole: best.member.role,
      reason: `${best.member.name} is the best available owner because they have ${best.activeIssueCount} active Jira item${best.activeIssueCount === 1 ? "" : "s"} and match the risk area better than the current path.`
    };
  };

  const addRisk = (
    type: DailyStatusRiskType,
    storyKey: string,
    entry: ParsedTranscriptEntry,
    evidence: string[],
    severity: DailyStatusRiskSeverity = isSprintEndingSoon ? "red-flag" : "impediment"
  ) => {
    const id = `${storyKey}-${entry.memberId}-${type}`;
    if (risks.some((risk) => risk.id === id)) {
      return;
    }
    risks.push({
      id,
      type,
      severity,
      title: dailyRiskLabels[type],
      message: dailyRiskMessage[type],
      ownerId: entry.memberId,
      ownerName: entry.name,
      storyKey,
      evidence: evidence.filter(Boolean).slice(0, 4)
    });
  };

  parsed.forEach((entry, index) => {
    const text = `${entry.yesterday} ${entry.today} ${entry.blockers}`.replace(/\s+/g, " ").trim();
    const previousText = previousStandups
      .filter((standup) => standup.memberId === entry.memberId)
      .slice(0, 3)
      .map((standup) => `${standup.yesterday} ${standup.today} ${standup.blockers}`)
      .join(" ");
    const explicitKeys = storyKeysFromDailyText(`${text} ${previousText}`);
    const fallbackIssues = activeIssuesByOwner.get(entry.memberId) ?? [];
    const storyKeys = explicitKeys.length ? explicitKeys : fallbackIssues.slice(0, 2).map((issue) => issue.issueKey);
    const targetStoryKeys = storyKeys.length ? storyKeys : [`UPDATE-${index + 1}`];

    for (const storyKey of targetStoryKeys) {
      const issue = issueByKey.get(storyKey.toUpperCase()) ?? fallbackIssues.find((candidate) => candidate.issueKey === storyKey);
      const standupStatus = dailyStandupStatus(text);
      const hasCommitProof = commits.some(
        (commit) =>
          commit.authorProfileId === entry.memberId &&
          (commit.message.toUpperCase().includes(storyKey.toUpperCase()) || storyKey.startsWith("UPDATE-"))
      );
      const riskTypes = new Set<DailyStatusRiskType>();
      const evidence = [
        entry.today,
        entry.blockers && !/^no blockers?\.?$/i.test(entry.blockers) ? entry.blockers : "",
        issue ? `${issue.issueKey} is ${issue.status}${issue.daysIdle ? ` and ${issue.daysIdle}d idle` : ""}` : "",
        hasCommitProof ? "Git activity found for owner/story" : ""
      ].filter(Boolean);

      const unclearRequirement = /\b(requirement|scope|acceptance|clarification|unclear|not clear|need details|ambiguous|open question)\b/i.test(text);
      const dependencyWait = /\b(waiting|dependency|depends|blocked by|approval|access|token|api owner|another story|upstream|handoff)\b/i.test(text);
      const technicalChallenge = /\b(technical challenge|debug|complex|architecture|integration issue|merge conflict|performance|migration|schema|contract)\b/i.test(text);
      const systemIssue = /\b(system|environment|env|server|infra|network|vpn|build|deploy|pipeline|permission|access)\b/i.test(text);
      const softwareIssue = /\b(bug|defect|regression|crash|failing|flaky|error|exception|broken|issue)\b/i.test(text);
      const qaPending = /\b(qa pending|qa not done|testing pending|validation pending|not tested|needs testing|regression pending)\b/i.test(text);
      const reviewPending = /\b(review pending|pr pending|approval pending|waiting for review|code review|pull request)\b/i.test(text);

      if (unclearRequirement) {
        riskTypes.add("UNCLEAR_REQUIREMENT");
        addRisk("UNCLEAR_REQUIREMENT", storyKey, entry, evidence);
      }
      if (dependencyWait || standupStatus === "blocked") {
        riskTypes.add("DEPENDENCY_WAIT");
        addRisk("DEPENDENCY_WAIT", storyKey, entry, evidence);
      }
      if (technicalChallenge) {
        riskTypes.add("TECHNICAL_CHALLENGE");
        addRisk("TECHNICAL_CHALLENGE", storyKey, entry, evidence, isSprintEndingSoon ? "red-flag" : "watch");
      }
      if (systemIssue) {
        riskTypes.add("SYSTEM_ISSUE");
        addRisk("SYSTEM_ISSUE", storyKey, entry, evidence);
      }
      if (softwareIssue) {
        riskTypes.add("SOFTWARE_ISSUE");
        addRisk("SOFTWARE_ISSUE", storyKey, entry, evidence, isSprintEndingSoon ? "red-flag" : "watch");
      }

      if (
        issue &&
        ((standupStatus === "done" && issue.status !== "Done") ||
          (standupStatus !== "blocked" && issue.status === "Blocked") ||
          (standupStatus === "review" && !["Review", "Done"].includes(issue.status)))
      ) {
        riskTypes.add("STATUS_MISMATCH");
        addRisk("STATUS_MISMATCH", storyKey, entry, evidence);
      }

      if (isSprintEndingSoon && (qaPending || (issue?.status === "Review" && /\b(qa|test|validation)\b/i.test(text)))) {
        riskTypes.add("QA_NOT_DONE");
        addRisk("QA_NOT_DONE", storyKey, entry, evidence, "impediment");
      }

      if (isSprintEndingSoon && (reviewPending || (issue?.status === "Review" && issue.daysIdle >= 2))) {
        riskTypes.add("CODE_REVIEW_PENDING");
        addRisk("CODE_REVIEW_PENDING", storyKey, entry, evidence, "impediment");
      }

      if (isSprintEndingSoon && riskTypes.size > 0 && issue?.status !== "Done") {
        riskTypes.add("SPRINT_END_RISK");
        addRisk("SPRINT_END_RISK", storyKey, entry, evidence, "red-flag");
      }

      let confidenceScore =
        issue?.status === "Done"
          ? 92
          : standupStatus === "done"
            ? 72
            : standupStatus === "review"
              ? 68
              : standupStatus === "in-progress"
                ? 62
                : standupStatus === "blocked"
                  ? 38
                  : 52;

      if (!issue) {
        confidenceScore -= 10;
      }
      if (issue?.status === "Blocked") {
        confidenceScore -= 22;
      }
      if (issue?.status === "Review" && issue.daysIdle >= 2) {
        confidenceScore -= 14;
      }
      if (hasCommitProof) {
        confidenceScore += 8;
      }
      confidenceScore -= riskTypes.size * 9;
      if (isSprintEndingSoon && issue?.status !== "Done") {
        confidenceScore -= 8;
      }
      confidenceScore = clampPercentage(confidenceScore);
      const canFinishInSprint = confidenceScore >= 70 && !riskTypes.has("SPRINT_END_RISK") && standupStatus !== "blocked";

      stories.push({
        storyKey,
        title: issue?.summary ?? `Transcript update from ${entry.name}`,
        ownerId: entry.memberId,
        ownerName: entry.name,
        jiraStatus: issue?.status,
        standupStatus,
        confidenceScore,
        canFinishInSprint,
        reason:
          confidenceScore >= 70
            ? "Current status and evidence indicate this can finish in the sprint."
            : riskTypes.has("SPRINT_END_RISK")
              ? "Sprint close is near and unresolved risk remains."
              : "Completion confidence is reduced by blockers, stale review, missing proof, or unclear scope.",
        riskTypes: Array.from(riskTypes),
        evidence: evidence.slice(0, 4),
        transferSuggestion: transferSuggestionFor(entry.memberId, riskTypes, confidenceScore)
      });
    }
  });

  const uniqueStories = Array.from(new Map(stories.map((story) => [`${story.storyKey}-${story.ownerId ?? ""}`, story])).values());
  const averageConfidence = uniqueStories.length
    ? Math.round(uniqueStories.reduce((sum, story) => sum + story.confidenceScore, 0) / uniqueStories.length)
    : 0;
  const canCompleteSprint = Boolean(uniqueStories.length) && uniqueStories.every((story) => story.canFinishInSprint);

  return {
    generatedAt,
    sprintId: sprint.id,
    daysRemaining,
    isSprintEndingSoon,
    summary: {
      storyCount: uniqueStories.length,
      redFlagCount: risks.filter((risk) => risk.severity === "red-flag").length,
      impedimentCount: risks.filter((risk) => risk.severity === "impediment").length,
      averageConfidence,
      canCompleteSprint,
      transferSuggestionCount: uniqueStories.filter((story) => story.transferSuggestion?.shouldTransfer).length
    },
    risks: risks.sort((left, right) => {
      const rank = { "red-flag": 3, impediment: 2, watch: 1 };
      return rank[right.severity] - rank[left.severity];
    }),
    stories: uniqueStories.sort((left, right) => left.confidenceScore - right.confidenceScore)
  };
};

export interface StackItem {
  layer: string;
  choice: string;
  reason: string;
}

export interface Assignment {
  owner: string;
  role: HackathonRole;
  workstream: string;
  firstDeliverable: string;
}

export interface PlanResponse {
  stack: StackItem[];
  assignments: Assignment[];
  milestones: Array<{
    date: string;
    target: string;
  }>;
}

// Webhook tokens — per-project shared secrets for the Teams transcript webhook
// (and future inbound webhooks). Plaintext is shown once at mint time and only
// ever stored as a SHA-256 hash. `tokenHint` is the last few chars of the
// plaintext, kept around so users can identify which token is which in the UI.
export interface WebhookToken {
  id: string;
  projectId: string;
  name: string;
  tokenHint: string;
  createdAt: string;
  lastUsedAt: string | null;
  createdByProfileId: string | null;
  revokedAt: string | null;
}

export interface CreateWebhookTokenRequest {
  personaId: string;
  name: string;
}

export interface CreateWebhookTokenResponse {
  token: WebhookToken;
  plaintextToken: string;
}

export interface ListWebhookTokensResponse {
  tokens: WebhookToken[];
}
