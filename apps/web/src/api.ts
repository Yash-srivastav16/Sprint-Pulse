import type {
  CreateUserProfileRequest,
  CreateUserProfileResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  ConfigureGitRequest,
  ConfigureGitResponse,
  ConfigureJiraRequest,
  ConfigureJiraResponse,
  CreateProjectSprintRequest,
  CreateProjectSprintResponse,
  DashboardResponse,
  IntegrationStatusResponse,
  InviteProjectMemberRequest,
  InviteProjectMemberResponse,
  JiraConnectRequest,
  JiraConnectResponse,
  JiraOAuthStartRequest,
  JiraOAuthStartResponse,
  MemberPulse,
  MemberPulseHistoryResponse,
  Persona,
  ProjectDashboardResponse,
  ProjectDetailResponse,
  ProjectOpsResponse,
  ProjectStandupsResponse,
  ProjectsResponse,
  ProjectWorkspaceResponse,
  SprintListResponse,
  SprintProject,
  StandupEntry,
  TeamResponse,
  UpdateProjectMemberRequest
} from "@sprintpulse/shared";
import {
  createProjectInSupabase,
  getProjectFromSupabase,
  getProjectsFromSupabase,
  getProjectWorkspaceFromSupabase
} from "./lib/supabaseProjects";
import {
  configureGitInSupabase,
  configureJiraInSupabase,
  getProjectDashboardFromSupabase,
  getProjectIntegrationsFromSupabase,
  getProjectMemberHistoryFromSupabase,
  getProjectMemberPulseFromSupabase,
  getProjectOpsFromSupabase,
  getProjectSprintsFromSupabase,
  getProjectStandupsFromSupabase,
  getProjectTeamFromSupabase,
  inviteProjectMemberInSupabase,
  createProjectSprintInSupabase,
  parseProjectTranscriptForPersonaInSupabase,
  submitProjectStandupToSupabase,
  syncGitInSupabase,
  syncProjectStandupsInSupabase,
  updateProjectMemberInSupabase
} from "./lib/supabaseProjectOps";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const configuredProjectTimeout = Number(import.meta.env.VITE_PROJECT_API_TIMEOUT_MS ?? 1200);
const PROJECT_API_TIMEOUT_MS = Number.isFinite(configuredProjectTimeout) ? configuredProjectTimeout : 1200;
const configuredProjectMutationTimeout = Number(import.meta.env.VITE_PROJECT_MUTATION_TIMEOUT_MS ?? 10000);
const PROJECT_MUTATION_TIMEOUT_MS = Number.isFinite(configuredProjectMutationTimeout)
  ? Math.max(configuredProjectMutationTimeout, PROJECT_API_TIMEOUT_MS)
  : 10000;
const configuredIntegrationTimeout = Number(import.meta.env.VITE_INTEGRATION_API_TIMEOUT_MS ?? 30000);
const INTEGRATION_API_TIMEOUT_MS = Number.isFinite(configuredIntegrationTimeout) ? configuredIntegrationTimeout : 30000;
const DIRECT_SUPABASE_PROJECTS = import.meta.env.VITE_DIRECT_SUPABASE_PROJECTS !== "false";

async function request<T>(path: string, init?: RequestInit, options?: { timeoutMs?: number }): Promise<T> {
  const timeoutMs = options?.timeoutMs;
  const controller = timeoutMs ? new AbortController() : undefined;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : undefined;

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...init?.headers
      },
      ...init,
      signal: init?.signal ?? controller?.signal
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out");
    }

    throw err;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

const projectRequest = <T>(path: string, init?: RequestInit) =>
  request<T>(path, init, { timeoutMs: PROJECT_API_TIMEOUT_MS });
const projectMutationRequest = <T>(path: string, init?: RequestInit) =>
  request<T>(path, init, { timeoutMs: PROJECT_MUTATION_TIMEOUT_MS });

const recoverCreatedProject = async (input: CreateProjectRequest): Promise<CreateProjectResponse | null> => {
  const key = input.projectKey.trim().toUpperCase();
  if (!key) {
    return null;
  }

  try {
    const projects = await getProjectsFromSupabase(input.personaId);
    const createdProject = projects.projects.find((project) => project.key.toUpperCase() === key);

    if (!createdProject) {
      return null;
    }

    const detail = await getProjectFromSupabase(createdProject.id, input.personaId);
    return {
      project: detail.project,
      warnings: ["The project was created before the response finished, so SprintPulse opened the saved workspace."]
    };
  } catch {
    return null;
  }
};

const integrationRequest = <T>(path: string, init?: RequestInit) =>
  request<T>(path, init, { timeoutMs: INTEGRATION_API_TIMEOUT_MS });

export const api = {
  getPersonas: () => request<{ personas: Persona[] }>("/personas", undefined, { timeoutMs: PROJECT_API_TIMEOUT_MS }),
  createUserProfile: (input: CreateUserProfileRequest) =>
    request<CreateUserProfileResponse>(
      "/users",
      {
        method: "POST",
        body: JSON.stringify(input)
      },
      { timeoutMs: PROJECT_MUTATION_TIMEOUT_MS }
    ),
  getPersonaByEmail: async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const response = await request<{ personas: Persona[] }>("/personas", undefined, { timeoutMs: PROJECT_API_TIMEOUT_MS });
    const persona = response.personas.find((item) => item.email.toLowerCase() === normalizedEmail);

    if (!persona) {
      throw new Error("No SprintPulse persona is linked to this email.");
    }

    return persona;
  },
  getProjects: async (personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectsFromSupabase(personaId);
    }

    try {
      return await projectRequest<ProjectsResponse>(`/projects?personaId=${encodeURIComponent(personaId)}`);
    } catch {
      return getProjectsFromSupabase(personaId);
    }
  },
  getProject: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectFromSupabase(projectId, personaId);
    }

    try {
      return await projectRequest<ProjectDetailResponse>(`/projects/${projectId}?personaId=${encodeURIComponent(personaId)}`);
    } catch {
      return getProjectFromSupabase(projectId, personaId);
    }
  },
  createProject: async (input: CreateProjectRequest) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      try {
        return await createProjectInSupabase(input);
      } catch (err) {
        const recovered = await recoverCreatedProject(input);
        if (recovered) {
          return recovered;
        }

        const message = err instanceof Error ? err.message.toLowerCase() : "";
        if (!message.includes("row-level security")) {
          throw err;
        }

        try {
          return await projectMutationRequest<CreateProjectResponse>("/projects", {
            method: "POST",
            body: JSON.stringify(input)
          });
        } catch (fallbackErr) {
          const fallbackRecovered = await recoverCreatedProject(input);
          if (fallbackRecovered) {
            return fallbackRecovered;
          }
          throw fallbackErr;
        }
      }
    }

    try {
      return await projectMutationRequest<CreateProjectResponse>("/projects", {
        method: "POST",
        body: JSON.stringify(input)
      });
    } catch (err) {
      const recovered = await recoverCreatedProject(input);
      if (recovered) {
        return recovered;
      }

      return createProjectInSupabase(input);
    }
  },
  connectJiraProject: (input: JiraConnectRequest) =>
    request<JiraConnectResponse>("/projects/connect/jira", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  getProjectWorkspace: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectWorkspaceFromSupabase(projectId, personaId);
    }

    try {
      return await projectRequest<ProjectWorkspaceResponse>(
        `/projects/${projectId}/workspace?personaId=${encodeURIComponent(personaId)}`
      );
    } catch {
      return getProjectWorkspaceFromSupabase(projectId, personaId);
    }
  },
  getProjectOps: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectOpsFromSupabase(projectId, personaId);
    }

    try {
      return await projectRequest<ProjectOpsResponse>(`/projects/${projectId}/ops?personaId=${encodeURIComponent(personaId)}`);
    } catch {
      return getProjectOpsFromSupabase(projectId, personaId);
    }
  },
  getProjectSprints: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectSprintsFromSupabase(projectId, personaId);
    }

    try {
      return await projectRequest<SprintListResponse>(`/projects/${projectId}/sprints?personaId=${encodeURIComponent(personaId)}`);
    } catch {
      return getProjectSprintsFromSupabase(projectId, personaId);
    }
  },
  createProjectSprint: async (projectId: string, input: CreateProjectSprintRequest): Promise<CreateProjectSprintResponse> => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return createProjectSprintInSupabase(projectId, input);
    }

    try {
      return await projectRequest<CreateProjectSprintResponse>(`/projects/${projectId}/sprints`, {
        method: "POST",
        body: JSON.stringify(input)
      });
    } catch {
      return createProjectSprintInSupabase(projectId, input);
    }
  },
  getProjectTeam: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectTeamFromSupabase(projectId, personaId);
    }

    try {
      return await projectRequest<TeamResponse>(`/projects/${projectId}/team?personaId=${encodeURIComponent(personaId)}`);
    } catch {
      return getProjectTeamFromSupabase(projectId, personaId);
    }
  },
  inviteProjectMember: async (projectId: string, input: InviteProjectMemberRequest) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return inviteProjectMemberInSupabase(projectId, input);
    }

    try {
      return await projectRequest<InviteProjectMemberResponse>(`/projects/${projectId}/invites`, {
        method: "POST",
        body: JSON.stringify(input)
      });
    } catch {
      return inviteProjectMemberInSupabase(projectId, input);
    }
  },
  updateProjectMember: async (projectId: string, profileId: string, input: UpdateProjectMemberRequest) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return updateProjectMemberInSupabase(projectId, profileId, input);
    }

    try {
      return await projectRequest<TeamResponse>(`/projects/${projectId}/team/${profileId}`, {
        method: "PATCH",
        body: JSON.stringify(input)
      });
    } catch {
      return updateProjectMemberInSupabase(projectId, profileId, input);
    }
  },
  getProjectIntegrations: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectIntegrationsFromSupabase(projectId, personaId);
    }

    try {
      return await projectRequest<IntegrationStatusResponse>(`/projects/${projectId}/integrations?personaId=${encodeURIComponent(personaId)}`);
    } catch {
      return getProjectIntegrationsFromSupabase(projectId, personaId);
    }
  },
  configureProjectJira: async (projectId: string, input: ConfigureJiraRequest) => {
    try {
      return await integrationRequest<ConfigureJiraResponse>(`/projects/${projectId}/jira/configure`, {
        method: "POST",
        body: JSON.stringify(input)
      });
    } catch {
      return configureJiraInSupabase(projectId, input);
    }
  },
  startProjectJiraOAuth: (projectId: string, input: JiraOAuthStartRequest) =>
    integrationRequest<JiraOAuthStartResponse>(`/projects/${projectId}/jira/oauth/start`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  syncProjectJira: async (projectId: string, personaId: string) => {
    return integrationRequest<ConfigureJiraResponse>(`/projects/${projectId}/jira/sync`, {
      method: "POST",
      body: JSON.stringify({ personaId })
    });
  },
  configureProjectGit: async (projectId: string, input: ConfigureGitRequest) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return configureGitInSupabase(projectId, input);
    }

    try {
      return await projectRequest<ConfigureGitResponse>(`/projects/${projectId}/git/configure`, {
        method: "POST",
        body: JSON.stringify(input)
      });
    } catch {
      return configureGitInSupabase(projectId, input);
    }
  },
  syncProjectGit: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return syncGitInSupabase(projectId, personaId);
    }

    try {
      return await projectRequest<ConfigureGitResponse>(`/projects/${projectId}/git/sync`, {
        method: "POST",
        body: JSON.stringify({ personaId })
      });
    } catch {
      return syncGitInSupabase(projectId, personaId);
    }
  },
  getDashboard: (personaId: string) =>
    request<DashboardResponse>(`/dashboard?personaId=${encodeURIComponent(personaId)}`),
  getProjectDashboard: async (projectId: string, personaId: string, sprintId?: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectDashboardFromSupabase(projectId, personaId, sprintId);
    }

    try {
      const sprintQuery = sprintId ? `&sprintId=${encodeURIComponent(sprintId)}` : "";
      return await projectRequest<ProjectDashboardResponse>(
        `/projects/${projectId}/dashboard?personaId=${encodeURIComponent(personaId)}${sprintQuery}`
      );
    } catch {
      return getProjectDashboardFromSupabase(projectId, personaId, sprintId);
    }
  },
  getMember: (memberId: string) => request<{ member: MemberPulse }>(`/members/${memberId}`),
  getProjectMember: async (projectId: string, memberId: string, personaId: string, sprintId?: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectMemberPulseFromSupabase(projectId, memberId, personaId, sprintId);
    }

    try {
      const sprintQuery = sprintId ? `&sprintId=${encodeURIComponent(sprintId)}` : "";
      return await projectRequest<{ member: MemberPulse; project: SprintProject }>(
        `/projects/${projectId}/members/${memberId}?personaId=${encodeURIComponent(personaId)}${sprintQuery}`
      );
    } catch {
      return getProjectMemberPulseFromSupabase(projectId, memberId, personaId, sprintId);
    }
  },
  getProjectMemberHistory: async (projectId: string, memberId: string, personaId: string, sprintId?: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectMemberHistoryFromSupabase(projectId, memberId, personaId, sprintId);
    }

    try {
      const sprintQuery = sprintId ? `&sprintId=${encodeURIComponent(sprintId)}` : "";
      return await projectRequest<MemberPulseHistoryResponse>(
        `/projects/${projectId}/members/${memberId}/history?personaId=${encodeURIComponent(personaId)}${sprintQuery}`
      );
    } catch {
      return getProjectMemberHistoryFromSupabase(projectId, memberId, personaId, sprintId);
    }
  },
  submitStandup: (input: {
    personaId: string;
    yesterday: string;
    today: string;
    blockers: string;
  }) =>
    request<{ entry: StandupEntry; member: MemberPulse }>("/standups", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  getProjectStandups: async (projectId: string, personaId: string, sprintId?: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectStandupsFromSupabase(projectId, personaId, sprintId);
    }

    try {
      const sprintQuery = sprintId ? `&sprintId=${encodeURIComponent(sprintId)}` : "";
      return await projectRequest<ProjectStandupsResponse>(
        `/projects/${projectId}/standups?personaId=${encodeURIComponent(personaId)}${sprintQuery}`
      );
    } catch {
      return getProjectStandupsFromSupabase(projectId, personaId, sprintId);
    }
  },
  submitProjectStandup: async (
    projectId: string,
    input: {
      personaId: string;
      yesterday: string;
      today: string;
      blockers: string;
    }
  ) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return submitProjectStandupToSupabase(projectId, input);
    }

    try {
      return await projectRequest<{ entry: StandupEntry; member: MemberPulse; project: SprintProject }>(
        `/projects/${projectId}/standups`,
        {
          method: "POST",
          body: JSON.stringify(input)
        }
      );
    } catch {
      return submitProjectStandupToSupabase(projectId, input);
    }
  },
  parseTranscript: (transcript: string) =>
    request<{
      mode: string;
      note: string;
      parsed: Array<{
        memberId: string;
        name: string;
        yesterday: string;
        today: string;
        blockers: string;
        confidence: number;
      }>;
    }>("/transcripts/parse", {
      method: "POST",
      body: JSON.stringify({ transcript })
    }),
  parseProjectTranscript: async (projectId: string, transcript: string, personaId?: string) => {
    if (DIRECT_SUPABASE_PROJECTS && personaId) {
      return parseProjectTranscriptForPersonaInSupabase(projectId, personaId, transcript);
    }

    try {
      return await projectRequest<{
        mode: string;
        note: string;
        project: SprintProject;
        parsed: Array<{
          memberId: string;
          name: string;
          yesterday: string;
          today: string;
          blockers: string;
          confidence: number;
        }>;
      }>(`/projects/${projectId}/transcripts/parse`, {
        method: "POST",
        body: JSON.stringify({ transcript, personaId })
      });
    } catch {
      if (!personaId) {
        throw new Error("Persona is required to parse project transcripts.");
      }
      return parseProjectTranscriptForPersonaInSupabase(projectId, personaId, transcript);
    }
  },
  syncProjectStandups: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return syncProjectStandupsInSupabase(projectId, personaId);
    }

    try {
      return await projectRequest<{
        project: SprintProject;
        syncedAt: string;
        importedStandups: number;
        warnings: string[];
      }>(`/projects/${projectId}/standups/sync`, {
        method: "POST",
        body: JSON.stringify({ personaId })
      });
    } catch {
      return syncProjectStandupsInSupabase(projectId, personaId);
    }
  }
};
