import { type Router } from "express";
import { mockFlowEnabled, realDataNotReadyMessage } from "../config/runtime.js";
import { createSupabaseAppNotification, reviewSupabaseMemberPullRequests } from "../data/supabaseProjectOps.js";

export function registerAiRoutes(router: Router): void {
  router.post("/projects/:projectId/notifications", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await createSupabaseAppNotification(String(req.params.projectId ?? ""), {
          personaId: String(req.body?.personaId ?? ""),
          targetPersonaId: req.body?.targetPersonaId ? String(req.body.targetPersonaId) : undefined,
          title: String(req.body?.title ?? ""),
          message: String(req.body?.message ?? ""),
          severity: req.body?.severity,
          kind: req.body?.kind,
          sprintId: req.body?.sprintId ? String(req.body.sprintId) : undefined,
          issueKeys: Array.isArray(req.body?.issueKeys) ? req.body.issueKeys.map(String) : undefined
        });
        if (!response) {
          res.status(404).json({ error: "Project not found or not visible to this user" });
          return;
        }
        res.status(201).json(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to create app notification";
        res.status(message.includes("permission") ? 403 : 400).json({ error: message });
      }
      return;
    }
    res.status(501).json({ error: realDataNotReadyMessage });
  });

  router.post("/projects/:projectId/members/:memberId/ai/pr-review", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const pullRequestNumber = Number(req.body?.pullRequestNumber);
        const response = await reviewSupabaseMemberPullRequests(
          String(req.params.projectId ?? ""),
          String(req.params.memberId ?? ""),
          String(req.body?.personaId ?? ""),
          req.body?.sprintId ? String(req.body.sprintId) : undefined,
          Number.isInteger(pullRequestNumber) && pullRequestNumber > 0 ? pullRequestNumber : undefined
        );
        if (!response) {
          res.status(404).json({ error: "Member not found or not visible to this user" });
          return;
        }
        res.json(response);
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to run AI PR review" });
      }
      return;
    }
    res.status(501).json({ error: realDataNotReadyMessage });
  });
}
