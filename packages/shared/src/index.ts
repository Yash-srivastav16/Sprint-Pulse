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
  | "TEST_RISK";

export type SyncSource = "jira" | "git" | "standup" | "recommendation";

export type SyncRunStatus = "queued" | "running" | "succeeded" | "failed";

export type IntegrationStatus = "not-configured" | "configured" | "synced" | "failed";

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
  lastSyncAt?: string;
}

export interface GitConnection {
  id: string;
  projectId: string;
  provider: "github";
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  status: IntegrationStatus;
  lastSyncAt?: string;
}

export interface JiraIssue {
  id: string;
  projectId: string;
  sprintId?: string;
  issueKey: string;
  summary: string;
  status: "Todo" | "In Progress" | "Review" | "Blocked" | "Done";
  assigneeProfileId?: string;
  jiraAssigneeId?: string;
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
  currentSprint?: SprintSummary;
  sprints: SprintSummary[];
}

export interface TeamResponse {
  viewer: Persona;
  project: SprintProject;
  permissions: Permission[];
  members: ProjectMember[];
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
}

export interface ConfigureGitRequest {
  personaId: string;
  provider: "github";
  repoOwner: string;
  repoName: string;
  defaultBranch?: string;
}

export interface ConfigureGitResponse {
  connection: GitConnection;
  run?: SyncRun;
  importedCommits: number;
  warnings: string[];
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
}

export interface TicketSignal {
  key: string;
  title: string;
  status: "Todo" | "In Progress" | "Review" | "Blocked" | "Done";
  daysIdle: number;
}

export interface GitSignal {
  commitsThisSprint: number;
  pullRequestsOpen: number;
  lastCommitAt: string;
  codeChurn: "low" | "medium" | "high";
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
}

export interface ProjectDashboardResponse extends DashboardResponse {
  project: SprintProject;
}

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
