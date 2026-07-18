import { type Router } from "express";
import type { CreateProjectSprintRequest } from "@sprintpulse/shared";
import { mockFlowEnabled, realDataNotReadyMessage } from "../config/runtime.js";
import { buildProjectDetail } from "../data/seed.js";
import { buildSupabaseSprintList, createSupabaseProjectSprint } from "../data/supabaseProjectOps.js";

export function registerSprintRoutes(router: Router): void {
  router.get("/projects/:projectId/sprints", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await buildSupabaseSprintList(
          String(req.params.projectId ?? ""),
          String(req.query.personaId ?? "")
        );
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
    res.json({ viewer: detail.viewer, project: detail.project, permissions: detail.permissions, currentSprint: sprint, sprints: [sprint] });
  });

  router.post("/projects/:projectId/sprints", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await createSupabaseProjectSprint(
          String(req.params.projectId ?? ""),
          req.body as CreateProjectSprintRequest
        );
        if (!response) {
          res.status(404).json({ error: "Project not found or not visible to this user" });
          return;
        }
        res.status(201).json(response);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to create sprint" });
      }
      return;
    }

    res.status(501).json({ error: realDataNotReadyMessage });
  });
}
