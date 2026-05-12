import type {
  AccessScope,
  AppRole,
  CreateProjectRequest,
  CreateProjectResponse,
  HackathonRole,
  Permission,
  Persona,
  ProductPersona,
  ProjectDetailResponse,
  ProjectMember,
  ProjectRole,
  ProjectSource,
  ProjectSummary,
  ProjectWorkspaceResponse,
  ProjectsResponse,
  SprintProject
} from "@sprintpulse/shared";
import { supabase, supabaseConfigError } from "./supabase";

type ProfileRow = {
  id: string;
  auth_user_id?: string | null;
  email: string;
  name: string;
  initials: string;
  title: string;
  app_role: AppRole;
  product_persona: ProductPersona;
  access_scope: AccessScope;
  status: "active" | "invited";
  created_at: string;
  invited_by?: string | null;
};

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

const roleDefaults: Record<
  AppRole,
  {
    productPersona: ProductPersona;
    accessScope: AccessScope;
    hackathonRole: HackathonRole;
    title: string;
    projectRole: ProjectRole;
  }
> = {
  admin: {
    productPersona: "product-owner",
    accessScope: "team",
    hackathonRole: "architect",
    title: "Workspace Admin",
    projectRole: "product-owner"
  },
  "product-owner": {
    productPersona: "product-owner",
    accessScope: "team",
    hackathonRole: "architect",
    title: "Product Owner",
    projectRole: "product-owner"
  },
  "engineering-manager": {
    productPersona: "engineering-manager",
    accessScope: "team",
    hackathonRole: "architect",
    title: "Engineering Manager",
    projectRole: "engineering-manager"
  },
  "scrum-master": {
    productPersona: "scrum-master",
    accessScope: "team",
    hackathonRole: "architect",
    title: "Scrum Master",
    projectRole: "scrum-master"
  },
  developer: {
    productPersona: "developer",
    accessScope: "individual",
    hackathonRole: "frontend",
    title: "Developer",
    projectRole: "developer"
  },
  "qa-lead": {
    productPersona: "qa-lead",
    accessScope: "quality",
    hackathonRole: "qa",
    title: "QA Lead",
    projectRole: "qa"
  }
};

const requireSupabase = () => {
  if (!supabase) {
    throw new Error(supabaseConfigError ?? "Supabase is not configured.");
  }

  return supabase;
};

const toPersona = (profile: ProfileRow): Persona => {
  const defaults = roleDefaults[profile.app_role];

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    initials: profile.initials,
    hackathonRole: defaults.hackathonRole,
    productPersona: profile.product_persona,
    title: profile.title || defaults.title,
    accessScope: profile.access_scope,
    focus:
      profile.product_persona === "scrum-master"
        ? "Sprint setup, team rhythm, and delivery operations."
        : profile.product_persona === "product-owner"
          ? "Portfolio visibility, sprint confidence, and risk decisions."
          : "SprintPulse workspace access and delivery collaboration."
  };
};

const isProjectManager = (viewer: Persona) =>
  viewer.productPersona === "scrum-master" || viewer.productPersona === "engineering-manager";

const canViewAllProjects = (viewer: Persona) =>
  viewer.productPersona === "product-owner" ||
  viewer.productPersona === "scrum-master" ||
  viewer.productPersona === "engineering-manager" ||
  viewer.productPersona === "qa-lead" ||
  viewer.productPersona === "presenter";

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

const fallbackMember = (member: ProjectMemberRow): ProjectMember => ({
  personaId: member.profile_id,
  name: member.profile_id,
  email: "",
  initials: member.profile_id.slice(0, 2).toUpperCase(),
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
  const members = memberRows.map((member) => {
    const profile = profileById.get(member.profile_id);
    return profile ? toMember(profile, member) : fallbackMember(member);
  });

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

const findProfile = async (profileId: string): Promise<ProfileRow | null> => {
  const client = requireSupabase();
  const { data, error } = await client.from("profiles").select("*").eq("id", profileId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ProfileRow | null) ?? null;
};

const fetchProjectRows = async () => {
  const client = requireSupabase();
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

const fetchProfiles = async (profileIds: string[]) => {
  if (!profileIds.length) {
    return [];
  }

  const client = requireSupabase();
  const { data, error } = await client.from("profiles").select("*").in("id", profileIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProfileRow[];
};

const loadProjectsForViewer = async (personaId: string) => {
  const [viewerProfile, rows] = await Promise.all([findProfile(personaId), fetchProjectRows()]);
  if (!viewerProfile) {
    throw new Error("SprintPulse profile not found for this account.");
  }

  const viewer = toPersona(viewerProfile);
  const { projects, sprints, members } = rows;
  const profileIds = [...new Set(members.map((member) => member.profile_id))];
  const profiles = await fetchProfiles(profileIds);
  const mappedProjects = projects
    .map((project) => {
      const sprint = sprints.find((item) => item.project_id === project.id);
      if (!sprint) {
        return null;
      }

      return toProject(
        project,
        sprint,
        members.filter((member) => member.project_id === project.id),
        profiles
      );
    })
    .filter((project): project is SprintProject => Boolean(project));
  const visibleProjects = canViewAllProjects(viewer)
    ? mappedProjects
    : mappedProjects.filter((project) => project.members.some((member) => member.personaId === viewer.id));

  return { viewer, projects: visibleProjects };
};

export const getProjectsFromSupabase = async (personaId: string): Promise<ProjectsResponse> => {
  const { viewer, projects } = await loadProjectsForViewer(personaId);

  return {
    viewer,
    projects: projects.map((project) => toSummary(project, viewer)),
    canCreateProject: isProjectManager(viewer),
    canConnectProject: isProjectManager(viewer),
    recommendedProjectId: projects[0]?.id
  };
};

export const getProjectFromSupabase = async (
  projectId: string,
  personaId: string
): Promise<ProjectDetailResponse> => {
  const { viewer, projects } = await loadProjectsForViewer(personaId);
  const project = projects.find((item) => item.id === projectId || item.key.toLowerCase() === projectId.toLowerCase());

  if (!project) {
    throw new Error("Project not found or not visible to this user.");
  }

  return {
    viewer,
    project,
    permissions: permissionsFor(viewer, project)
  };
};

export const getProjectWorkspaceFromSupabase = async (
  projectId: string,
  personaId: string
): Promise<ProjectWorkspaceResponse> => {
  const detail = await getProjectFromSupabase(projectId, personaId);
  const { viewer, project, permissions } = detail;

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

export const createProjectInSupabase = async (input: CreateProjectRequest): Promise<CreateProjectResponse> => {
  const client = requireSupabase();
  const viewerProfile = await findProfile(input.personaId);

  if (!viewerProfile) {
    throw new Error("SprintPulse profile not found for this account.");
  }

  const viewer = toPersona(viewerProfile);
  if (!isProjectManager(viewer)) {
    throw new Error("Only Scrum Masters and Engineering Managers can create projects.");
  }

  const key = input.projectKey.trim().toUpperCase();
  const now = new Date().toISOString();
  const { data: project, error: projectError } = await client
    .from("projects")
    .insert({
      key,
      name: input.projectName.trim(),
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
      name: input.sprintName.trim(),
      goal: input.sprintGoal.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      status: "active",
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (sprintError) {
    throw new Error(sprintError.message);
  }

  const requestMembers = input.members?.length
    ? input.members
    : [
        toMember(viewerProfile, {
          project_id: projectRow.id,
          profile_id: viewerProfile.id,
          role: roleDefaults[viewerProfile.app_role].projectRole
        })
      ];
  const memberRows = requestMembers.map((member) => ({
    project_id: projectRow.id,
    profile_id: member.personaId,
    role: member.role,
    jira_account_id: member.jiraAccountId ?? null,
    github_username: member.githubUsername ?? null
  }));
  const { error: memberError } = await client.from("project_members").insert(memberRows);

  if (memberError) {
    throw new Error(memberError.message);
  }

  const profileRows = await fetchProfiles(memberRows.map((member) => member.profile_id));

  return {
    project: toProject(projectRow, sprint as SprintRow, memberRows, profileRows),
    warnings: []
  };
};
