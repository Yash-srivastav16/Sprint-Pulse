import type {
  CreateProjectRequest,
  CreateProjectResponse,
  Permission,
  Persona,
  ProjectDetailResponse,
  ProjectMember,
  ProjectRole,
  ProjectSource,
  ProjectSummary,
  ProjectWorkspaceResponse,
  ProjectsResponse,
  SprintProject
} from "@sprintpulse/shared";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  findSupabaseProfileById,
  findSupabaseProfilesByIds,
  roleDefaults,
  toPersonaFromProfile,
  type ProfileRow
} from "./supabaseProfiles.js";

type ProjectRow = {
  id: string;
  key: string;
  name: string;
  source: ProjectSource;
  jira_site?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_sync_at?: string | null;
};

type SprintRow = {
  id: string;
  project_id: string;
  name: string;
  goal: string;
  start_date: string;
  end_date: string;
  status: "planned" | "active" | "closed";
};

type ProjectMemberRow = {
  project_id: string;
  profile_id: string;
  role: ProjectRole;
  jira_account_id?: string | null;
  github_username?: string | null;
};

const requireSupabaseAdmin = () => {
  if (!supabaseAdmin) {
    throw new Error("Backend Supabase Admin is not configured.");
  }

  return supabaseAdmin;
};

const isProjectManager = (viewer: Persona) =>
  viewer.productPersona === "scrum-master" || viewer.productPersona === "engineering-manager";

const canViewAllProjects = (viewer: Persona) =>
  viewer.productPersona === "product-owner" ||
  viewer.productPersona === "scrum-master" ||
  viewer.productPersona === "engineering-manager" ||
  viewer.productPersona === "qa-lead" ||
  viewer.productPersona === "presenter";

const permissionsFor = (viewer: Persona, project?: SprintProject): Permission[] => {
  const isMember = project?.members.some((member) => member.personaId === viewer.id) ?? true;
  const teamVisibility = canViewAllProjects(viewer);
  const permissions: Permission[] = [];

  if (teamVisibility || isMember) {
    permissions.push("project:view", "dashboard:viewOwn", "member:viewOwn", "standup:submit");
  }

  if (teamVisibility) {
    permissions.push("dashboard:viewTeam", "member:viewTeam");
  }

  if (isProjectManager(viewer)) {
    permissions.push("project:create", "project:connect", "project:editTeam", "standup:sync");
  }

  return [...new Set(permissions)];
};

const projectRoleForPersona = (viewer: Persona): ProjectRole => {
  if (viewer.productPersona === "product-owner") {
    return "product-owner";
  }
  if (viewer.productPersona === "scrum-master") {
    return "scrum-master";
  }
  if (viewer.productPersona === "engineering-manager") {
    return "engineering-manager";
  }
  if (viewer.productPersona === "qa-lead" || viewer.productPersona === "presenter") {
    return "qa";
  }
  return "developer";
};

const sprintDay = (sprint: SprintProject["sprint"]) => {
  const start = new Date(`${sprint.startDate}T00:00:00.000Z`);
  const today = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  return Math.max(1, Math.floor((today.getTime() - start.getTime()) / dayMs) + 1);
};

const daysRemaining = (sprint: SprintProject["sprint"]) => {
  const end = new Date(`${sprint.endDate}T00:00:00.000Z`);
  const today = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / dayMs));
};

const toMember = (profile: ProfileRow, member: ProjectMemberRow): ProjectMember => ({
  personaId: profile.id,
  name: profile.name,
  email: profile.email,
  initials: profile.initials,
  role: member.role,
  jiraAccountId: member.jira_account_id ?? undefined,
  githubUsername: member.github_username ?? undefined
});

const toProject = (
  project: ProjectRow,
  sprint: SprintRow,
  memberRows: ProjectMemberRow[],
  profileRows: ProfileRow[]
): SprintProject => {
  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));
  const members = memberRows
    .map((member) => {
      const profile = profileById.get(member.profile_id);
      return profile ? toMember(profile, member) : null;
    })
    .filter((member): member is ProjectMember => Boolean(member));

  return {
    id: project.id,
    key: project.key,
    name: project.name,
    source: project.source,
    jiraSite: project.jira_site ?? undefined,
    sprint: {
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal,
      startDate: sprint.start_date,
      endDate: sprint.end_date,
      status: sprint.status
    },
    members,
    ownerIds: members.filter((member) => member.role === "product-owner").map((member) => member.personaId),
    scrumMasterIds: members.filter((member) => member.role === "scrum-master").map((member) => member.personaId),
    createdBy: project.created_by,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    lastSyncAt: project.last_sync_at ?? undefined
  };
};

const toSummary = (project: SprintProject, viewer: Persona): ProjectSummary => ({
  id: project.id,
  key: project.key,
  name: project.name,
  source: project.source,
  sprintName: project.sprint.name,
  sprintGoal: project.sprint.goal,
  memberCount: project.members.length,
  healthScore: 0,
  atRiskCount: 0,
  currentUserRole: project.members.find((member) => member.personaId === viewer.id)?.role ?? projectRoleForPersona(viewer),
  permissions: permissionsFor(viewer, project),
  lastSyncAt: project.lastSyncAt
});

const fetchProjectRows = async () => {
  const client = requireSupabaseAdmin();
  const [
    { data: projects, error: projectsError },
    { data: sprints, error: sprintsError },
    { data: members, error: membersError }
  ] = await Promise.all([
    client.from("projects").select("*").order("created_at", { ascending: false }),
    client.from("sprints").select("*"),
    client.from("project_members").select("*")
  ]);

  if (projectsError) {
    throw new Error(projectsError.message);
  }
  if (sprintsError) {
    throw new Error(sprintsError.message);
  }
  if (membersError) {
    throw new Error(membersError.message);
  }

  return {
    projects: (projects ?? []) as ProjectRow[],
    sprints: (sprints ?? []) as SprintRow[],
    members: (members ?? []) as ProjectMemberRow[]
  };
};

const buildProjects = async () => {
  const { projects, sprints, members } = await fetchProjectRows();
  const profileIds = [...new Set(members.map((member) => member.profile_id))];
  const profiles = await findSupabaseProfilesByIds(profileIds);
  const profileRows = profiles.map((profile) => ({
    id: profile.id,
    auth_user_id: profile.authUserId,
    email: profile.email,
    name: profile.name,
    initials: profile.initials,
    title: profile.title,
    app_role: profile.appRole,
    product_persona: profile.productPersona,
    access_scope: profile.accessScope,
    status: profile.status,
    created_at: profile.createdAt,
    invited_by: profile.invitedBy
  })) as ProfileRow[];

  return projects
    .map((project) => {
      const sprint = sprints.find((item) => item.project_id === project.id);
      if (!sprint) {
        return null;
      }

      return toProject(
        project,
        sprint,
        members.filter((member) => member.project_id === project.id),
        profileRows
      );
    })
    .filter((project): project is SprintProject => Boolean(project));
};

const loadProjectsForViewer = async (personaId: string) => {
  const [viewerProfile, projects] = await Promise.all([findSupabaseProfileById(personaId), buildProjects()]);
  if (!viewerProfile) {
    return undefined;
  }

  const viewer = toPersonaFromProfile(viewerProfile);
  const visibleProjects = canViewAllProjects(viewer)
    ? projects
    : projects.filter((project) => project.members.some((member) => member.personaId === viewer.id));

  return { viewer, visibleProjects };
};

export const buildSupabaseProjectsResponse = async (personaId: string): Promise<ProjectsResponse | undefined> => {
  const context = await loadProjectsForViewer(personaId);
  if (!context) {
    return undefined;
  }

  const { viewer, visibleProjects } = context;

  return {
    viewer,
    projects: visibleProjects.map((project) => toSummary(project, viewer)),
    canCreateProject: isProjectManager(viewer),
    canConnectProject: isProjectManager(viewer),
    recommendedProjectId: visibleProjects[0]?.id
  };
};

export const buildSupabaseProjectDetail = async (
  projectId: string,
  personaId: string
): Promise<ProjectDetailResponse | undefined> => {
  const context = await loadProjectsForViewer(personaId);
  if (!context) {
    return undefined;
  }

  const { viewer, visibleProjects } = context;
  const project = visibleProjects.find((item) => item.id === projectId || item.key.toLowerCase() === projectId.toLowerCase());
  if (!project) {
    return undefined;
  }

  return {
    viewer,
    project,
    permissions: permissionsFor(viewer, project)
  };
};

export const buildSupabaseProjectWorkspace = async (
  projectId: string,
  personaId: string
): Promise<ProjectWorkspaceResponse | undefined> => {
  const detail = await buildSupabaseProjectDetail(projectId, personaId);
  if (!detail) {
    return undefined;
  }

  const { project, viewer, permissions } = detail;

  return {
    viewer,
    project,
    permissions,
    sync: {
      mode: project.source,
      lastSyncAt: project.lastSyncAt,
      status: project.lastSyncAt ? "synced" : "idle"
    },
    summary: {
      sprintDay: sprintDay(project.sprint),
      daysRemaining: daysRemaining(project.sprint),
      participationRate: 0,
      openBlockers: 0,
      atRiskCount: 0,
      healthScore: 0
    },
    nextActions: [
      {
        id: "submit-standup",
        label: "Submit standup",
        description: "Add the first real update for this sprint workspace.",
        route: `/projects/${project.id}/standups`,
        requiredPermission: "standup:submit"
      },
      {
        id: "dashboard",
        label: "Open dashboard",
        description: "Dashboard data will grow as standups and delivery signals are connected.",
        route: `/projects/${project.id}/dashboard`,
        requiredPermission: "dashboard:viewOwn"
      }
    ]
  };
};

export const createSupabaseProject = async (request: CreateProjectRequest): Promise<CreateProjectResponse | undefined> => {
  const viewerProfile = await findSupabaseProfileById(request.personaId);
  if (!viewerProfile) {
    return undefined;
  }

  const viewer = toPersonaFromProfile(viewerProfile);
  if (!isProjectManager(viewer)) {
    return undefined;
  }

  const client = requireSupabaseAdmin();
  const key = request.projectKey.trim().toUpperCase();
  const now = new Date().toISOString();
  const { data: project, error: projectError } = await client
    .from("projects")
    .insert({
      key,
      name: request.projectName.trim(),
      source: "manual",
      created_by: viewer.id,
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (projectError) {
    throw new Error(projectError.message);
  }

  const projectRow = project as ProjectRow;
  const { data: sprint, error: sprintError } = await client
    .from("sprints")
    .insert({
      project_id: projectRow.id,
      name: request.sprintName.trim(),
      goal: request.sprintGoal.trim(),
      start_date: request.startDate,
      end_date: request.endDate,
      status: "active",
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (sprintError) {
    throw new Error(sprintError.message);
  }

  const requestMembers = request.members?.length
    ? request.members
    : [
        toMember(
          {
            id: viewerProfile.id,
            auth_user_id: viewerProfile.authUserId,
            email: viewerProfile.email,
            name: viewerProfile.name,
            initials: viewerProfile.initials,
            title: viewerProfile.title,
            app_role: viewerProfile.appRole,
            product_persona: viewerProfile.productPersona,
            access_scope: viewerProfile.accessScope,
            status: viewerProfile.status,
            created_at: viewerProfile.createdAt,
            invited_by: viewerProfile.invitedBy
          },
          {
            project_id: projectRow.id,
            profile_id: viewerProfile.id,
            role: roleDefaults[viewerProfile.appRole].projectRole
          }
        )
      ];

  const memberRows = requestMembers.map((member) => ({
    project_id: projectRow.id,
    profile_id: member.personaId,
    role: member.role,
    jira_account_id: member.jiraAccountId,
    github_username: member.githubUsername
  }));
  const { error: memberError } = await client.from("project_members").upsert(memberRows);

  if (memberError) {
    throw new Error(memberError.message);
  }

  const profileRows = await findSupabaseProfilesByIds(memberRows.map((member) => member.profile_id));
  const sprintProject = toProject(
    projectRow,
    sprint as SprintRow,
    memberRows,
    profileRows.map((profile) => ({
      id: profile.id,
      auth_user_id: profile.authUserId,
      email: profile.email,
      name: profile.name,
      initials: profile.initials,
      title: profile.title,
      app_role: profile.appRole,
      product_persona: profile.productPersona,
      access_scope: profile.accessScope,
      status: profile.status,
      created_at: profile.createdAt,
      invited_by: profile.invitedBy
    })) as ProfileRow[]
  );

  return {
    project: sprintProject,
    warnings: []
  };
};
