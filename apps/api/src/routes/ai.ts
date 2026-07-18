import { type Router } from "express";
import { mockFlowEnabled, realDataNotReadyMessage } from "../config/runtime.js";
import { reviewSupabaseMemberPullRequests } from "../data/supabaseProjectOps.js";

export function registerAiRoutes(router: Router): void {
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
