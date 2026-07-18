import { type Router } from "express";
import type { AiChatRequest } from "@sprintpulse/shared";
import { mockFlowEnabled, realDataNotReadyMessage } from "../config/runtime.js";
import { buildProjectDashboard } from "../data/seed.js";
import {
  answerSupabaseProjectAi,
  buildSupabaseProjectDashboard,
  refreshSupabaseAiInsights
} from "../data/supabaseProjectOps.js";

export function registerDashboardRoutes(router: Router): void {
  router.get("/projects/:projectId/dashboard", async (req, res) => {
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

    const dashboard = buildProjectDashboard(req.params.projectId, String(req.query.personaId ?? ""));
    if (!dashboard) {
      res.status(404).json({ error: "Project dashboard not found or not visible to this user" });
      return;
    }
    res.json(dashboard);
  });

  router.post("/projects/:projectId/ai/refresh", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await refreshSupabaseAiInsights(
          String(req.params.projectId ?? ""),
          String(req.body?.personaId ?? ""),
          req.body?.sprintId ? String(req.body.sprintId) : undefined
        );
        if (!response) {
          res.status(404).json({ error: "Project dashboard not found or not visible to this user" });
          return;
        }
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to refresh AI insights" });
      }
      return;
    }
    res.status(501).json({ error: realDataNotReadyMessage });
  });

  router.post("/projects/:projectId/ai/chat", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const request = req.body as AiChatRequest;
        const message = String(request.message ?? "").trim();
        if (!message) {
          res.status(400).json({ error: "Message is required" });
          return;
        }
        const response = await answerSupabaseProjectAi(String(req.params.projectId ?? ""), { ...request, message });
        if (!response) {
          res.status(404).json({ error: "Project not found or not visible to this user" });
          return;
        }
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to answer with AI assistant" });
      }
      return;
    }
    res.status(501).json({ error: realDataNotReadyMessage });
  });
}
