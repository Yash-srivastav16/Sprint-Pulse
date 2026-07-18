import type {
  CreateUserProfileRequest,
  CreateUserProfileResponse,
  AiChatRequest,
  AiChatResponse,
  AiPrReviewResponse,
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
  LinkProjectMemberRequest,
  MemberPulse,
  MemberPulseHistoryResponse,
  Persona,
  ProjectDashboardResponse,
  ProjectDetailResponse,
  ProjectNotificationsResponse,
  ProjectOpsResponse,
  ProjectStandupsResponse,
  ProjectStandupSyncResponse,
  ProjectsResponse,
  ProjectWorkspaceResponse,
  SprintListResponse,
  SprintProject,
  StandupEntry,
  TeamResponse,
  TranscriptParseResponse,
  UpdateProjectMemberRequest,
  CreateWebhookTokenResponse,
  ListWebhookTokensResponse
} from "@sprintpulse/shared";
import {
  connectJiraProjectInSupabase,
  createProjectInSupabase,
  getProjectFromSupabase,
  getProjectsFromSupabase,
  getProjectWorkspaceFromSupabase
} from "./lib/supabaseProjects";
import {
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
  linkProjectMemberInSupabase,
  createProjectSprintInSupabase,
  parseProjectTranscriptForPersonaInSupabase,
  submitProjectStandupToSupabase,
  syncProjectSignalsInSupabase,
  updateProjectMemberInSupabase
} from "./lib/supabaseProjectOps";
import { supabase } from "./lib/supabase";

const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:4000/api" : "/api");

// The SemicoLabs deploy platform identifies the target app via an ?app=<uuid>
// query parameter on every request - path routing is intact, the platform
// just needs to know which container to forward to. Capture the value once at
// module load from window.location.search; when absent (local dev), the helper
// is a no-op. Exported because UIs that build user-facing URLs (Integrations
// webhook display, signup invite links) need to include the same param.
export const APP_ROUTE_PARAM = typeof window !== "undefined"
  ? new URLSearchParams(window.location.search).get("app") ?? ""
  : "";
export const withAppRoute = (url: string): string => {
  if (!APP_ROUTE_PARAM) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}app=${encodeURIComponent(APP_ROUTE_PARAM)}`;
};

const configuredProjectTimeout = Number(import.meta.env.VITE_PROJECT_API_TIMEOUT_MS ?? 8000);
const PROJECT_API_TIMEOUT_MS = Number.isFinite(configuredProjectTimeout) ? Math.max(configuredProjectTimeout, 8000) : 8000;
const configuredProjectMutationTimeout = Number(import.meta.env.VITE_PROJECT_MUTATION_TIMEOUT_MS ?? 10000);
const PROJECT_MUTATION_TIMEOUT_MS = Number.isFinite(configuredProjectMutationTimeout)
  ? Math.max(configuredProjectMutationTimeout, PROJECT_API_TIMEOUT_MS)
  : 10000;
const configuredIntegrationTimeout = Number(import.meta.env.VITE_INTEGRATION_API_TIMEOUT_MS ?? 30000);
const INTEGRATION_API_TIMEOUT_MS = Number.isFinite(configuredIntegrationTimeout) ? configuredIntegrationTimeout : 30000;
const configuredAiTimeout = Number(import.meta.env.VITE_AI_API_TIMEOUT_MS ?? INTEGRATION_API_TIMEOUT_MS);
const AI_API_TIMEOUT_MS = Number.isFinite(configuredAiTimeout) ? configuredAiTimeout : INTEGRATION_API_TIMEOUT_MS;
const DIRECT_SUPABASE_PROJECTS = import.meta.env.VITE_DIRECT_SUPABASE_PROJECTS !== "false";
const AI_INSIGHTS_ENABLED = import.meta.env.VITE_ENABLE_AI_INSIGHTS === "true";

async function request<T>(path: string, init?: RequestInit, options?: { timeoutMs?: number }): Promise<T> {
  const timeoutMs = options?.timeoutMs;
  const controller = timeoutMs ? new AbortController() : undefined;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : undefined;

  // Attach the current Supabase session JWT so the API's auth middleware
  // (when SPRINTPULSE_API_KEY is enabled on the server) accepts the request
  // via the Bearer path. supabase-js caches the session locally so this is
  // a sync read in practice; no extra network roundtrip per call.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {})
  };
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token && !headers["Authorization"]) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch {
      // Session lookup failure — fall through unauthenticated. The middleware
      // will 401 if SPRINTPULSE_API_KEY is enforced server-side.
    }
  }

  try {
    const response = await fetch(withAppRoute(`${API_BASE}${path}`), {
      headers,
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
const aiRequest = <T>(path: string, init?: RequestInit) => request<T>(path, init, { timeoutMs: AI_API_TIMEOUT_MS });

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

    return projectRequest<ProjectsResponse>(`/projects?personaId=${encodeURIComponent(personaId)}`);
  },
  getProject: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectFromSupabase(projectId, personaId);
    }

    return projectRequest<ProjectDetailResponse>(`/projects/${projectId}?personaId=${encodeURIComponent(personaId)}`);
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
      // Only recover if we might have created before the response failed (idempotency guard)
      const recovered = await recoverCreatedProject(input);
      if (recovered) {
        return recovered;
      }
      throw err;
    }
  },
  connectJiraProject: async (input: JiraConnectRequest) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return connectJiraProjectInSupabase(input);
    }

    return projectMutationRequest<JiraConnectResponse>("/projects/connect/jira", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  getProjectWorkspace: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectWorkspaceFromSupabase(projectId, personaId);
    }

    return projectRequest<ProjectWorkspaceResponse>(
      `/projects/${projectId}/workspace?personaId=${encodeURIComponent(personaId)}`
    );
  },
  getProjectOps: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectOpsFromSupabase(projectId, personaId);
    }

    return projectRequest<ProjectOpsResponse>(`/projects/${projectId}/ops?personaId=${encodeURIComponent(personaId)}`);
  },
  getProjectSprints: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectSprintsFromSupabase(projectId, personaId);
    }

    return projectRequest<SprintListResponse>(`/projects/${projectId}/sprints?personaId=${encodeURIComponent(personaId)}`);
  },
  createProjectSprint: async (projectId: string, input: CreateProjectSprintRequest): Promise<CreateProjectSprintResponse> => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return createProjectSprintInSupabase(projectId, input);
    }

    return projectMutationRequest<CreateProjectSprintResponse>(`/projects/${projectId}/sprints`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  getProjectTeam: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectTeamFromSupabase(projectId, personaId);
    }

    return projectRequest<TeamResponse>(`/projects/${projectId}/team?personaId=${encodeURIComponent(personaId)}`);
  },
  inviteProjectMember: async (projectId: string, input: InviteProjectMemberRequest) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return inviteProjectMemberInSupabase(projectId, input);
    }

    return projectRequest<InviteProjectMemberResponse>(`/projects/${projectId}/invites`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  updateProjectMember: async (projectId: string, profileId: string, input: UpdateProjectMemberRequest) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return updateProjectMemberInSupabase(projectId, profileId, input);
    }

    return projectRequest<TeamResponse>(`/projects/${projectId}/team/${profileId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },
  linkProjectMember: (projectId: string, sourceProfileId: string, input: LinkProjectMemberRequest) =>
    projectMutationRequest<TeamResponse>(`/projects/${projectId}/team/${sourceProfileId}/link`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  getProjectIntegrations: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return getProjectIntegrationsFromSupabase(projectId, personaId);
    }

    return projectRequest<IntegrationStatusResponse>(`/projects/${projectId}/integrations?personaId=${encodeURIComponent(personaId)}`);
  },
  configureProjectJira: (projectId: string, input: ConfigureJiraRequest) =>
    integrationRequest<ConfigureJiraResponse>(`/projects/${projectId}/jira/configure`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  startProjectJiraOAuth: (projectId: string, input: JiraOAuthStartRequest) =>
    integrationRequest<JiraOAuthStartResponse>(`/projects/${projectId}/jira/oauth/start`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  syncProjectJira: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS) {
      return syncProjectSignalsInSupabase(projectId, personaId, "jira");
    }

    return integrationRequest<ConfigureJiraResponse>(`/projects/${projectId}/jira/sync`, {
      method: "POST",
      body: JSON.stringify({ personaId })
    });
  },
  configureProjectGit: async (projectId: string, input: ConfigureGitRequest) => {
    // Git tokens are server-side secrets. Always route configuration through
    // apps/api so per-project tokens are encrypted before being stored.
    return integrationRequest<ConfigureGitResponse>(`/projects/${projectId}/git/configure`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  syncProjectGit: async (projectId: string, personaId: string) => {
    // Git sync needs server-side provider adapters and per-project tokens.
    // Even when reads use direct Supabase, route this action through apps/api.
    return integrationRequest<ConfigureGitResponse>(`/projects/${projectId}/git/sync`, {
      method: "POST",
      body: JSON.stringify({ personaId })
    });
  },
  getDashboard: (personaId: string) =>
    request<DashboardResponse>(`/dashboard?personaId=${encodeURIComponent(personaId)}`),
  getProjectDashboard: async (projectId: string, personaId: string, sprintId?: string) => {
    if (DIRECT_SUPABASE_PROJECTS && !AI_INSIGHTS_ENABLED) {
      return getProjectDashboardFromSupabase(projectId, personaId, sprintId);
    }

    const sprintQuery = sprintId ? `&sprintId=${encodeURIComponent(sprintId)}` : "";
    return projectRequest<ProjectDashboardResponse>(
      `/projects/${projectId}/dashboard?personaId=${encodeURIComponent(personaId)}${sprintQuery}`
    );
  },
  getMember: (memberId: string) => request<{ member: MemberPulse }>(`/members/${memberId}`),
  getProjectMember: async (projectId: string, memberId: string, personaId: string, sprintId?: string) => {
    if (DIRECT_SUPABASE_PROJECTS && !AI_INSIGHTS_ENABLED) {
      return getProjectMemberPulseFromSupabase(projectId, memberId, personaId, sprintId);
    }

    const sprintQuery = sprintId ? `&sprintId=${encodeURIComponent(sprintId)}` : "";
    return projectRequest<{ member: MemberPulse; project: SprintProject }>(
      `/projects/${projectId}/members/${memberId}?personaId=${encodeURIComponent(personaId)}${sprintQuery}`
    );
  },
  getProjectMemberHistory: async (projectId: string, memberId: string, personaId: string, sprintId?: string) => {
    if (DIRECT_SUPABASE_PROJECTS && !AI_INSIGHTS_ENABLED) {
      return getProjectMemberHistoryFromSupabase(projectId, memberId, personaId, sprintId);
    }

    const sprintQuery = sprintId ? `&sprintId=${encodeURIComponent(sprintId)}` : "";
    return projectRequest<MemberPulseHistoryResponse>(
      `/projects/${projectId}/members/${memberId}/history?personaId=${encodeURIComponent(personaId)}${sprintQuery}`
    );
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

    const sprintQuery = sprintId ? `&sprintId=${encodeURIComponent(sprintId)}` : "";
    return projectRequest<ProjectStandupsResponse>(
      `/projects/${projectId}/standups?personaId=${encodeURIComponent(personaId)}${sprintQuery}`
    );
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
    if (DIRECT_SUPABASE_PROJECTS && !AI_INSIGHTS_ENABLED) {
      return submitProjectStandupToSupabase(projectId, input);
    }

    return projectRequest<{ entry: StandupEntry; member: MemberPulse; project: SprintProject }>(
      `/projects/${projectId}/standups`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    );
  },
  parseTranscript: (transcript: string) =>
    request<TranscriptParseResponse>("/transcripts/parse", {
      method: "POST",
      body: JSON.stringify({ transcript })
    }),
  parseProjectTranscript: async (projectId: string, transcript: string, personaId?: string) => {
    if (DIRECT_SUPABASE_PROJECTS && personaId && !AI_INSIGHTS_ENABLED) {
      return parseProjectTranscriptForPersonaInSupabase(projectId, personaId, transcript);
    }

    return projectRequest<TranscriptParseResponse & { project: SprintProject }>(`/projects/${projectId}/transcripts/parse`, {
      method: "POST",
      body: JSON.stringify({ transcript, personaId })
    });
  },
  getProjectNotifications: (input: { personaId: string; projectId?: string | null; sprintId?: string | null }) => {
    const query = new URLSearchParams({ personaId: input.personaId });
    if (input.projectId) {
      query.set("projectId", input.projectId);
    }
    if (input.sprintId) {
      query.set("sprintId", input.sprintId);
    }
    return aiRequest<ProjectNotificationsResponse>(`/notifications?${query.toString()}`);
  },
  refreshProjectAi: (projectId: string, personaId: string, sprintId?: string | null) =>
    aiRequest<ProjectDashboardResponse>(`/projects/${projectId}/ai/refresh`, {
      method: "POST",
      body: JSON.stringify({ personaId, sprintId })
    }),
  chatProjectAi: (projectId: string, input: AiChatRequest) =>
    aiRequest<AiChatResponse>(`/projects/${projectId}/ai/chat`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  runMemberPrReview: (
    projectId: string,
    memberId: string,
    personaId: string,
    sprintId?: string | null,
    pullRequestNumber?: number | null
  ) =>
    aiRequest<AiPrReviewResponse>(`/projects/${projectId}/members/${memberId}/ai/pr-review`, {
      method: "POST",
      body: JSON.stringify({ personaId, sprintId, pullRequestNumber })
    }),
  syncProjectStandups: async (projectId: string, personaId: string) => {
    if (DIRECT_SUPABASE_PROJECTS && !AI_INSIGHTS_ENABLED) {
      return syncProjectSignalsInSupabase(projectId, personaId, "standup");
    }

    return projectRequest<ProjectStandupSyncResponse>(`/projects/${projectId}/standups/sync`, {
      method: "POST",
      body: JSON.stringify({ personaId })
    });
  },

  listWebhookTokens: (projectId: string, personaId: string) =>
    projectRequest<ListWebhookTokensResponse>(
      `/projects/${projectId}/webhook-tokens?personaId=${encodeURIComponent(personaId)}`
    ),
  createWebhookToken: (projectId: string, personaId: string, name: string) =>
    projectMutationRequest<CreateWebhookTokenResponse>(`/projects/${projectId}/webhook-tokens`, {
      method: "POST",
      body: JSON.stringify({ personaId, name })
    }),
  revokeWebhookToken: (projectId: string, tokenId: string, personaId: string) =>
    request<{ ok: true }>(
      `/projects/${projectId}/webhook-tokens/${tokenId}?personaId=${encodeURIComponent(personaId)}`,
      { method: "DELETE" },
      { timeoutMs: PROJECT_MUTATION_TIMEOUT_MS }
    )
};
