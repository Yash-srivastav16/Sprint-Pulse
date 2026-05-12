import { Router } from "express";
import type { Request, Response } from "express";
import type {
  AppRole,
  ConfigureGitRequest,
  ConfigureJiraRequest,
  CreateProjectRequest,
  CreateUserProfileRequest,
  InviteProjectMemberRequest,
  JiraConnectRequest,
  StandupEntry,
  UpdateProjectMemberRequest
} from "@sprintpulse/shared";
import { dataMode, mockFlowEnabled, realDataNotReadyMessage } from "../config/runtime.js";
import { supabaseAdminConfigError, supabaseAdminConfigured } from "../lib/supabaseAdmin.js";
import {
  addStandupEntry,
  buildDashboard,
  buildProjectDashboard,
  buildProjectDetail,
  buildProjectsResponse,
  buildProjectWorkspace,
  connectJiraProjectData,
  createManualProject,
  findPersona,
  findProject,
  findPulse,
  hasPermission,
  memberPulses,
  personas,
  plan
} from "../data/seed.js";
import { createSelfServiceProfile } from "../data/profiles.js";
import {
  createSupabaseUserProfile,
  findSupabasePersonaById,
  listSupabasePersonas,
  profilesTable
} from "../data/supabaseProfiles.js";
import {
  buildSupabaseProjectDetail,
  buildSupabaseProjectsResponse,
  buildSupabaseProjectWorkspace,
  createSupabaseProject
} from "../data/supabaseProjects.js";
import {
  buildSupabaseIntegrations,
  buildSupabaseProjectDashboard,
  buildSupabaseProjectMemberHistory,
  buildSupabaseProjectOps,
  buildSupabaseProjectStandups,
  buildSupabaseSprintList,
  buildSupabaseTeam,
  configureSupabaseGit,
  configureSupabaseJira,
  inviteSupabaseProjectMember,
  parseSupabaseProjectTranscript,
  submitSupabaseProjectStandup,
  syncSupabaseGit,
  syncSupabaseJira,
  syncSupabaseProjectStandups,
  updateSupabaseProjectMember
} from "../data/supabaseProjectOps.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "sprintpulse-api",
    dataMode,
    mockFlowEnabled,
    supabase: {
      adminConfigured: supabaseAdminConfigured,
      profilesTable,
      adminConfigError: supabaseAdminConfigError
    },
    timestamp: new Date().toISOString()
  });
});

apiRouter.get("/personas", async (_req, res) => {
  try {
    const responsePersonas = mockFlowEnabled ? personas : await listSupabasePersonas();
    res.json({ personas: responsePersonas });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load personas" });
  }
});

const appRoles = new Set<AppRole>(["admin", "product-owner", "engineering-manager", "scrum-master", "developer", "qa-lead"]);

apiRouter.post("/users", async (req, res) => {
  const request = req.body as CreateUserProfileRequest;
  const email = String(request.email ?? "").trim().toLowerCase();
  const name = String(request.name ?? "").trim();

  if (!email || !name || !appRoles.has(request.appRole)) {
    res.status(400).json({ error: "Name, email, and workspace role are required" });
    return;
  }

  try {
    const input = {
      ...request,
      email,
      name,
      title: request.title?.trim()
    };
    const result = mockFlowEnabled ? createSelfServiceProfile(input) : await createSupabaseUserProfile(input);
    res.status(201).json(result);
  } catch (err) {
    res.status(supabaseAdminConfigured ? 500 : 503).json({
      error: err instanceof Error ? err.message : "Unable to create user profile",
      setup:
        "Create apps/api/.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, run database/supabase/001_profiles.sql, then restart the API."
    });
  }
});

apiRouter.post("/session", (_req, res) => {
  res.status(410).json({ error: "Password sign-in is handled by Supabase Auth." });
});

apiRouter.get("/me", async (req, res) => {
  const personaId = String(req.query.personaId ?? "");

  if (!mockFlowEnabled) {
    try {
      const persona = await findSupabasePersonaById(personaId);
      if (!persona) {
        res.status(404).json({ error: "Profile not found" });
        return;
      }

      const canManageProjects =
        persona.productPersona === "scrum-master" || persona.productPersona === "engineering-manager";

      res.json({
        persona,
        permissions: canManageProjects ? ["project:view", "project:create", "project:connect"] : ["project:view"],
        accessibleProjectIds: []
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load profile" });
    }
    return;
  }

  const persona = findPersona(personaId);

  if (!persona) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }

  const projects = buildProjectsResponse(personaId);
  res.json({
    persona,
    permissions: projects?.projects[0]?.permissions ?? [],
    accessibleProjectIds: projects?.projects.map((project) => project.id) ?? []
  });
});

apiRouter.get("/projects", async (req, res) => {
  const personaId = String(req.query.personaId ?? "");

  if (!mockFlowEnabled) {
    try {
      const response = await buildSupabaseProjectsResponse(personaId);
      if (!response) {
        res.status(404).json({ error: "Profile not found" });
        return;
      }

      res.json(response);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load projects" });
    }
    return;
  }

  const response = buildProjectsResponse(personaId);

  if (!response) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }

  res.json(response);
});

apiRouter.post("/projects", async (req, res) => {
  if (!mockFlowEnabled) {
    const request = req.body as CreateProjectRequest;

    if (!request.projectName || !request.projectKey || !request.sprintName || !request.sprintGoal) {
      res.status(400).json({ error: "Project name, key, sprint name, and sprint goal are required" });
      return;
    }

    try {
      const result = await createSupabaseProject(request);

      if (!result) {
        res.status(403).json({ error: "You do not have permission to create projects" });
        return;
      }

      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Project creation failed" });
    }
    return;
  }

  const request = req.body as CreateProjectRequest;

  if (!request.projectName || !request.projectKey || !request.sprintName || !request.sprintGoal) {
    res.status(400).json({ error: "Project name, key, sprint name, and sprint goal are required" });
    return;
  }

  const result = createManualProject(request);

  if (!result) {
    res.status(403).json({ error: "You do not have permission to create projects" });
    return;
  }

  res.status(201).json(result);
});

const connectJiraProject = (req: Request, res: Response) => {
  if (!mockFlowEnabled) {
    res.status(501).json({ error: realDataNotReadyMessage });
    return;
  }

  const request = req.body as JiraConnectRequest;
  const result = connectJiraProjectData(request);

  if (!result) {
    res.status(403).json({ error: "You do not have permission to connect Jira projects" });
    return;
  }

  res.status(201).json(result);
};

apiRouter.post("/projects/connect/jira", connectJiraProject);

apiRouter.get("/projects/:projectId", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      const personaId = String(req.query.personaId ?? "");
      const response = await buildSupabaseProjectDetail(String(req.params.projectId ?? ""), personaId);

      if (!response) {
        res.status(404).json({ error: "Project not found or not visible to this user" });
        return;
      }

      res.json(response);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load project" });
    }
    return;
  }

  const personaId = String(req.query.personaId ?? "");
  const response = buildProjectDetail(req.params.projectId, personaId);

  if (!response) {
    res.status(404).json({ error: "Project not found or not visible to this user" });
    return;
  }

  res.json(response);
});

apiRouter.get("/projects/:projectId/workspace", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      const personaId = String(req.query.personaId ?? "");
      const response = await buildSupabaseProjectWorkspace(String(req.params.projectId ?? ""), personaId);

      if (!response) {
        res.status(404).json({ error: "Project workspace not found or not visible to this user" });
        return;
      }

      res.json(response);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load project workspace" });
    }
    return;
  }

  const personaId = String(req.query.personaId ?? "");
  const response = buildProjectWorkspace(req.params.projectId, personaId);

  if (!response) {
    res.status(404).json({ error: "Project workspace not found or not visible to this user" });
    return;
  }

  res.json(response);
});

apiRouter.get("/projects/:projectId/ops", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      const response = await buildSupabaseProjectOps(String(req.params.projectId ?? ""), String(req.query.personaId ?? ""));
      if (!response) {
        res.status(404).json({ error: "Project operations not found or not visible to this user" });
        return;
      }

      res.json(response);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load project operations" });
    }
    return;
  }

  const response = buildProjectWorkspace(req.params.projectId, String(req.query.personaId ?? ""));
  if (!response) {
    res.status(404).json({ error: "Project operations not found or not visible to this user" });
    return;
  }

  res.json({
    ...response,
    currentSprint: {
      ...response.project.sprint,
      issueCount: 0,
      standupCount: 0,
      commitCount: 0,
      blockerCount: response.summary.openBlockers,
      healthScore: response.summary.healthScore
    },
    integrations: {
      jira: null,
      git: null,
      recentRuns: []
    }
  });
});

apiRouter.get("/projects/:projectId/sprints", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      const response = await buildSupabaseSprintList(String(req.params.projectId ?? ""), String(req.query.personaId ?? ""));
      if (!response) {
        res.status(404).json({ error: "Sprints not found or not visible to this user" });
        return;
      }

      res.json(response);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load sprints" });
    }
    return;
  }

  const detail = buildProjectDetail(req.params.projectId, String(req.query.personaId ?? ""));
  if (!detail) {
    res.status(404).json({ error: "Sprints not found or not visible to this user" });
    return;
  }

  const sprint = {
    ...detail.project.sprint,
    issueCount: 0,
    standupCount: 0,
    commitCount: 0,
    blockerCount: 0,
    healthScore: 0
  };
  res.json({ viewer: detail.viewer, project: detail.project, currentSprint: sprint, sprints: [sprint] });
});

apiRouter.get("/projects/:projectId/team", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      const response = await buildSupabaseTeam(String(req.params.projectId ?? ""), String(req.query.personaId ?? ""));
      if (!response) {
        res.status(404).json({ error: "Team not found or not visible to this user" });
        return;
      }

      res.json(response);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load team" });
    }
    return;
  }

  const detail = buildProjectDetail(req.params.projectId, String(req.query.personaId ?? ""));
  if (!detail) {
    res.status(404).json({ error: "Team not found or not visible to this user" });
    return;
  }

  res.json({
    ...detail,
    members: detail.project.members,
    availableUsers: [],
    invites: [],
    canEditTeam: detail.permissions.includes("project:editTeam")
  });
});

const addProjectMember = async (req: Request, res: Response) => {
  if (!mockFlowEnabled) {
    try {
      const result = await inviteSupabaseProjectMember(
        String(req.params.projectId ?? ""),
        req.body as InviteProjectMemberRequest
      );
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to add project member" });
    }
    return;
  }

  res.status(501).json({ error: realDataNotReadyMessage });
};

apiRouter.post("/projects/:projectId/invites", addProjectMember);
apiRouter.post("/projects/:projectId/team", addProjectMember);

apiRouter.patch("/projects/:projectId/team/:profileId", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      const response = await updateSupabaseProjectMember(
        String(req.params.projectId ?? ""),
        String(req.params.profileId ?? ""),
        req.body as UpdateProjectMemberRequest
      );
      if (!response) {
        res.status(404).json({ error: "Team member not found or not visible to this user" });
        return;
      }

      res.json(response);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to update team member" });
    }
    return;
  }

  res.status(501).json({ error: realDataNotReadyMessage });
});

apiRouter.get("/projects/:projectId/integrations", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      const response = await buildSupabaseIntegrations(String(req.params.projectId ?? ""), String(req.query.personaId ?? ""));
      if (!response) {
        res.status(404).json({ error: "Integrations not found or not visible to this user" });
        return;
      }

      res.json(response);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load integrations" });
    }
    return;
  }

  const detail = buildProjectDetail(req.params.projectId, String(req.query.personaId ?? ""));
  if (!detail) {
    res.status(404).json({ error: "Integrations not found or not visible to this user" });
    return;
  }

  res.json({ ...detail, jira: null, git: null, recentRuns: [], issuePreview: [], commitPreview: [] });
});

apiRouter.post("/projects/:projectId/jira/configure", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      res.json(await configureSupabaseJira(String(req.params.projectId ?? ""), req.body as ConfigureJiraRequest));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to configure Jira" });
    }
    return;
  }

  res.status(501).json({ error: realDataNotReadyMessage });
});

apiRouter.post("/projects/:projectId/jira/sync", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      res.json(await syncSupabaseJira(String(req.params.projectId ?? ""), String(req.body?.personaId ?? "")));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to sync Jira" });
    }
    return;
  }

  res.status(501).json({ error: realDataNotReadyMessage });
});

apiRouter.post("/projects/:projectId/git/configure", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      res.json(await configureSupabaseGit(String(req.params.projectId ?? ""), req.body as ConfigureGitRequest));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to configure Git" });
    }
    return;
  }

  res.status(501).json({ error: realDataNotReadyMessage });
});

apiRouter.post("/projects/:projectId/git/sync", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      res.json(await syncSupabaseGit(String(req.params.projectId ?? ""), String(req.body?.personaId ?? "")));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to sync Git" });
    }
    return;
  }

  res.status(501).json({ error: realDataNotReadyMessage });
});

apiRouter.get("/projects/:projectId/dashboard", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      const response = await buildSupabaseProjectDashboard(
        String(req.params.projectId ?? ""),
        String(req.query.personaId ?? ""),
        req.query.sprintId ? String(req.query.sprintId) : undefined
      );
      if (!response) {
        res.status(404).json({ error: "Project dashboard not found or not visible to this user" });
        return;
      }

      res.json(response);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load project dashboard" });
    }
    return;
  }

  const personaId = String(req.query.personaId ?? "");
  const dashboard = buildProjectDashboard(req.params.projectId, personaId);

  if (!dashboard) {
    res.status(404).json({ error: "Project dashboard not found or not visible to this user" });
    return;
  }

  res.json(dashboard);
});

apiRouter.get("/projects/:projectId/members/:memberId/history", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      const response = await buildSupabaseProjectMemberHistory(
        String(req.params.projectId ?? ""),
        String(req.params.memberId ?? ""),
        String(req.query.personaId ?? ""),
        req.query.sprintId ? String(req.query.sprintId) : undefined
      );
      if (!response) {
        res.status(404).json({ error: "Member not found or not visible to this user" });
        return;
      }

      res.json(response);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load member history" });
    }
    return;
  }

  const personaId = String(req.query.personaId ?? "");
  const project = findProject(String(req.params.projectId ?? ""));
  const persona = findPersona(personaId);
  const member = findPulse(req.params.memberId);

  if (!project || !persona || !member || !hasPermission(persona, "member:viewOwn", project)) {
    res.status(404).json({ error: "Member not found or not visible to this user" });
    return;
  }

  const canViewTeamPulse = hasPermission(persona, "member:viewTeam", project);
  if (!canViewTeamPulse && member.personaId !== persona.id) {
    res.status(403).json({ error: "This role can only view its own member pulse" });
    return;
  }

  res.json({ viewer: persona, member, project, issues: [], commits: [], recommendations: [], standups: member.standups });
});

apiRouter.get("/projects/:projectId/members/:memberId", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      const response = await buildSupabaseProjectMemberHistory(
        String(req.params.projectId ?? ""),
        String(req.params.memberId ?? ""),
        String(req.query.personaId ?? ""),
        req.query.sprintId ? String(req.query.sprintId) : undefined
      );
      if (!response) {
        res.status(404).json({ error: "Member not found or not visible to this user" });
        return;
      }

      res.json({ member: response.member, project: response.project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load member pulse" });
    }
    return;
  }

  const personaId = String(req.query.personaId ?? "");
  const project = findProject(String(req.params.projectId ?? ""));
  const persona = findPersona(personaId);
  const member = findPulse(req.params.memberId);

  if (!project || !persona || !member || !hasPermission(persona, "member:viewOwn", project)) {
    res.status(404).json({ error: "Member not found or not visible to this user" });
    return;
  }

  const canViewTeam = hasPermission(persona, "member:viewTeam", project);
  if (!canViewTeam && member.personaId !== persona.id) {
    res.status(403).json({ error: "This role can only view its own member pulse" });
    return;
  }

  res.json({ member, project });
});

apiRouter.get("/projects/:projectId/standups", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      const response = await buildSupabaseProjectStandups(
        String(req.params.projectId ?? ""),
        String(req.query.personaId ?? ""),
        req.query.sprintId ? String(req.query.sprintId) : undefined
      );
      if (!response) {
        res.status(404).json({ error: "Standups not found or not visible to this user" });
        return;
      }

      res.json(response);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load standups" });
    }
    return;
  }

  const personaId = String(req.query.personaId ?? "");
  const project = findProject(String(req.params.projectId ?? ""));
  const persona = findPersona(personaId);

  if (!project || !persona || !hasPermission(persona, "project:view", project)) {
    res.status(404).json({ error: "Standups not found or not visible to this user" });
    return;
  }

  const memberIds = new Set(project.members.map((member) => member.personaId));
  const standups = memberPulses
    .filter((pulse) => memberIds.has(pulse.personaId))
    .flatMap((pulse) => pulse.standups.map((entry) => ({ ...entry, projectId: project.id })));

  res.json({ project, standups });
});

apiRouter.post("/projects/:projectId/standups", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      res.status(201).json(await submitSupabaseProjectStandup(String(req.params.projectId ?? ""), req.body));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to submit standup" });
    }
    return;
  }

  const personaId = String(req.body?.personaId ?? "");
  const project = findProject(String(req.params.projectId ?? ""));
  const persona = findPersona(personaId);
  const yesterday = String(req.body?.yesterday ?? "").trim();
  const today = String(req.body?.today ?? "").trim();
  const blockers = String(req.body?.blockers ?? "No blocker.").trim();

  if (!project || !persona || !hasPermission(persona, "standup:submit", project)) {
    res.status(403).json({ error: "You do not have permission to submit standups for this project" });
    return;
  }

  if (!yesterday || !today) {
    res.status(400).json({ error: "Yesterday and today fields are required" });
    return;
  }

  const entry: StandupEntry = {
    id: `${project.id}-${personaId}-${Date.now()}`,
    projectId: project.id,
    memberId: personaId,
    date: new Date().toISOString().slice(0, 10),
    yesterday,
    today,
    blockers: blockers || "No blocker.",
    source: "manual"
  };

  const member = addStandupEntry(entry);
  res.status(201).json({ entry, member, project });
});

apiRouter.post("/projects/:projectId/transcripts/parse", async (req, res) => {
  if (!mockFlowEnabled) {
    try {
      const transcript = String(req.body?.transcript ?? "").trim();
      if (!transcript) {
        res.status(400).json({ error: "Transcript text is required" });
        return;
      }

      res.json(
        await parseSupabaseProjectTranscript(
          String(req.params.projectId ?? ""),
          String(req.body?.personaId ?? ""),
          transcript
        )
      );
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Transcript parse failed" });
    }
    return;
  }

  const project = findProject(String(req.params.projectId ?? ""));
  const transcript = String(req.body?.transcript ?? "").trim();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!transcript) {
    res.status(400).json({ error: "Transcript text is required" });
    return;
  }

  const parsed = project.members.slice(0, 4).map((member, index) => ({
    memberId: member.personaId,
    name: member.name,
    yesterday: index === 3 ? "Worked on backend API contracts." : "Worked on assigned SprintPulse screens.",
    today: index === 3 ? "Connecting analysis scoring with dashboard data." : "Continuing UI implementation and polish.",
    blockers: index === 2 ? "Waiting for transcript parser contract." : "No blocker.",
    confidence: 0.78 - index * 0.04
  }));

  res.json({
    mode: "transcript-parser",
    note: "Transcript entries were structured for sprint analysis.",
    project,
    parsed
  });
});

const syncProjectStandups = async (req: Request, res: Response) => {
  if (!mockFlowEnabled) {
    try {
      res.json(await syncSupabaseProjectStandups(String(req.params.projectId ?? ""), String(req.body?.personaId ?? "")));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to sync standups" });
    }
    return;
  }

  const personaId = String(req.body?.personaId ?? "");
  const project = findProject(String(req.params.projectId ?? ""));
  const persona = findPersona(personaId);

  if (!project || !persona || !hasPermission(persona, "standup:sync", project)) {
    res.status(403).json({ error: "You do not have permission to sync standups for this project" });
    return;
  }

  project.lastSyncAt = new Date().toISOString();
  project.updatedAt = project.lastSyncAt;

  res.json({
    project,
    syncedAt: project.lastSyncAt,
    importedStandups: 6,
    warnings: ["Connected delivery updates were refreshed for the active sprint."]
  });
};

apiRouter.post("/projects/:projectId/standups/sync", syncProjectStandups);

apiRouter.get("/dashboard", (req, res) => {
  if (!mockFlowEnabled) {
    res.status(501).json({ error: realDataNotReadyMessage });
    return;
  }

  const personaId = String(req.query.personaId ?? "");
  const dashboard = buildDashboard(personaId);

  if (!dashboard) {
    res.status(404).json({ error: "Dashboard not found for persona" });
    return;
  }

  res.json(dashboard);
});

apiRouter.get("/members", (_req, res) => {
  if (!mockFlowEnabled) {
    res.status(501).json({ error: realDataNotReadyMessage });
    return;
  }

  res.json({ members: memberPulses });
});

apiRouter.get("/members/:memberId", (req, res) => {
  if (!mockFlowEnabled) {
    res.status(501).json({ error: realDataNotReadyMessage });
    return;
  }

  const member = findPulse(req.params.memberId);

  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  res.json({ member });
});

apiRouter.post("/standups", (req, res) => {
  if (!mockFlowEnabled) {
    res.status(501).json({ error: realDataNotReadyMessage });
    return;
  }

  const personaId = String(req.body?.personaId ?? "");
  const yesterday = String(req.body?.yesterday ?? "").trim();
  const today = String(req.body?.today ?? "").trim();
  const blockers = String(req.body?.blockers ?? "No blocker.").trim();
  const persona = findPersona(personaId);

  if (!persona) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }

  if (!yesterday || !today) {
    res.status(400).json({ error: "Yesterday and today fields are required" });
    return;
  }

  const entry: StandupEntry = {
    id: `${personaId}-${Date.now()}`,
    memberId: personaId,
    date: new Date().toISOString().slice(0, 10),
    yesterday,
    today,
    blockers: blockers || "No blocker.",
    source: "manual"
  };

  const member = addStandupEntry(entry);
  res.status(201).json({ entry, member });
});

apiRouter.post("/transcripts/parse", (req, res) => {
  if (!mockFlowEnabled) {
    res.status(501).json({ error: realDataNotReadyMessage });
    return;
  }

  const transcript = String(req.body?.transcript ?? "").trim();

  if (!transcript) {
    res.status(400).json({ error: "Transcript text is required" });
    return;
  }

  const parsed = personas.slice(0, 4).map((persona, index) => ({
    memberId: persona.id,
    name: persona.name,
    yesterday: index === 3 ? "Worked on backend API contracts." : "Worked on assigned SprintPulse screens.",
    today: index === 3 ? "Connecting analysis scoring with dashboard data." : "Continuing UI implementation and polish.",
    blockers: index === 2 ? "Waiting for transcript parser contract." : "No blocker.",
    confidence: 0.78 - index * 0.04
  }));

  res.json({
    mode: "transcript-parser",
    note: "Transcript entries were structured for sprint analysis.",
    parsed
  });
});

apiRouter.get("/plan", (_req, res) => {
  if (!mockFlowEnabled) {
    res.status(501).json({ error: realDataNotReadyMessage });
    return;
  }

  res.json(plan);
});
