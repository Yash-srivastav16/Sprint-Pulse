import { type Router } from "express";
import type { AppRole, CreateUserProfileRequest } from "@sprintpulse/shared";
import { mockFlowEnabled, realDataNotReadyMessage } from "../config/runtime.js";
import { supabaseAdminConfigured } from "../lib/supabaseAdmin.js";
import {
  addStandupEntry,
  buildDashboard,
  buildProjectDashboard,
  buildProjectsResponse,
  findPersona,
  findPulse,
  memberPulses,
  personas,
  plan
} from "../data/seed.js";
import { createSelfServiceProfile } from "../data/profiles.js";
import { createSupabaseUserProfile, findSupabasePersonaById, listSupabasePersonas } from "../data/supabaseProfiles.js";
import { buildSupabaseProjectNotifications } from "../data/supabaseProjectOps.js";
import type { StandupEntry } from "@sprintpulse/shared";

const appRoles = new Set<AppRole>(["admin", "product-owner", "engineering-manager", "scrum-master", "developer", "qa-lead"]);

export function registerAuthRoutes(router: Router): void {
  router.get("/personas", async (_req, res) => {
    try {
      const responsePersonas = mockFlowEnabled ? personas : await listSupabasePersonas();
      res.json({ personas: responsePersonas });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load personas" });
    }
  });

  router.get("/notifications", async (req, res) => {
    const personaId = String(req.query.personaId ?? "");
    const projectId = String(req.query.projectId ?? "");
    const sprintId = req.query.sprintId ? String(req.query.sprintId) : undefined;

    if (!projectId) {
      const persona = mockFlowEnabled ? findPersona(personaId) : await findSupabasePersonaById(personaId);
      if (!persona) {
        res.status(404).json({ error: "Profile not found" });
        return;
      }
      res.json({
        viewer: persona,
        notifications: [],
        unreadCount: 0,
        meta: {
          enabled: false,
          source: "disabled",
          generatedAt: new Date().toISOString(),
          reason: "Select a project to see role-aware notifications."
        }
      });
      return;
    }

    if (!mockFlowEnabled) {
      try {
        const response = await buildSupabaseProjectNotifications(projectId, personaId, sprintId);
        if (!response) {
          res.status(404).json({ error: "Notifications not found or not visible to this user" });
          return;
        }
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to load notifications" });
      }
      return;
    }

    const dashboard = buildProjectDashboard(projectId, personaId);
    if (!dashboard) {
      res.status(404).json({ error: "Notifications not found or not visible to this user" });
      return;
    }

    res.json({
      viewer: dashboard.viewer,
      project: dashboard.project,
      notifications: [],
      unreadCount: 0,
      meta: {
        enabled: false,
        source: "disabled",
        generatedAt: new Date().toISOString(),
        reason: "Seed mode notifications are available in Supabase project mode."
      }
    });
  });

  router.post("/users", async (req, res) => {
    const request = req.body as CreateUserProfileRequest;
    const email = String(request.email ?? "").trim().toLowerCase();
    const name = String(request.name ?? "").trim();

    if (!email || !name || !appRoles.has(request.appRole)) {
      res.status(400).json({ error: "Name, email, and workspace role are required" });
      return;
    }

    try {
      const input = { ...request, email, name, title: request.title?.trim() };
      const result = mockFlowEnabled ? createSelfServiceProfile(input) : await createSupabaseUserProfile(input);
      res.status(201).json(result);
    } catch (err) {
      res.status(supabaseAdminConfigured ? 500 : 503).json({
        error: err instanceof Error ? err.message : "Unable to create user profile",
        setup: "Create apps/api/.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, run database/supabase/001_profiles.sql, then restart the API."
      });
    }
  });

  router.post("/session", (_req, res) => {
    res.status(410).json({ error: "Password sign-in is handled by Supabase Auth." });
  });

  router.get("/me", async (req, res) => {
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

  // Legacy mock-only global routes
  router.get("/dashboard", (req, res) => {
    if (!mockFlowEnabled) {
      res.status(501).json({ error: realDataNotReadyMessage });
      return;
    }
    const dashboard = buildDashboard(String(req.query.personaId ?? ""));
    if (!dashboard) {
      res.status(404).json({ error: "Dashboard not found for persona" });
      return;
    }
    res.json(dashboard);
  });

  router.get("/members", (_req, res) => {
    if (!mockFlowEnabled) {
      res.status(501).json({ error: realDataNotReadyMessage });
      return;
    }
    res.json({ members: memberPulses });
  });

  router.get("/members/:memberId", (req, res) => {
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

  router.post("/standups", (req, res) => {
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

  router.post("/transcripts/parse", (req, res) => {
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

    res.json({ mode: "transcript-parser", note: "Transcript entries were structured for sprint analysis.", parsed });
  });

  router.get("/plan", (_req, res) => {
    if (!mockFlowEnabled) {
      res.status(501).json({ error: realDataNotReadyMessage });
      return;
    }
    res.json(plan);
  });
}
