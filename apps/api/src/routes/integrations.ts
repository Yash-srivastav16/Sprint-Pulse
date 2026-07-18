import { type Router } from "express";
import type { ConfigureGitRequest, ConfigureJiraRequest, JiraOAuthStartRequest } from "@sprintpulse/shared";
import { mockFlowEnabled, realDataNotReadyMessage } from "../config/runtime.js";
import { jiraOAuthConfig } from "../config/jira.js";
import { buildProjectDetail } from "../data/seed.js";
import {
  buildSupabaseIntegrations,
  completeSupabaseJiraOAuth,
  configureSupabaseGit,
  configureSupabaseJira,
  startSupabaseJiraOAuth,
  syncSupabaseProjectSignals
} from "../data/supabaseProjectOps.js";

export function registerIntegrationRoutes(router: Router): void {
  router.get("/projects/:projectId/integrations", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        const response = await buildSupabaseIntegrations(
          String(req.params.projectId ?? ""),
          String(req.query.personaId ?? "")
        );
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
    const mockJira = {
      connected: true,
      projectKey: "SP",
      boardName: "SprintPulse Board",
      lastSyncAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      issueCount: 24,
      syncStatus: "success" as const
    };
    const mockGit = {
      connected: true,
      repoOwner: "semicolons-team",
      repoName: "sprintpulse",
      defaultBranch: "main",
      lastSyncAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      commitCount: 47,
      syncStatus: "success" as const
    };
    const mockRecentRuns = [
      { id: "run-1", source: "jira", status: "success", startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), itemsImported: 24, durationMs: 1840 },
      { id: "run-2", source: "git",  status: "success", startedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), itemsImported: 12, durationMs: 920 },
      { id: "run-3", source: "standup", status: "success", startedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), itemsImported: 6, durationMs: 340 }
    ];
    res.json({ ...detail, jira: mockJira, git: mockGit, recentRuns: mockRecentRuns, issuePreview: [], commitPreview: [] });
  });

  router.post("/projects/:projectId/jira/configure", async (req, res) => {
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

  router.post("/projects/:projectId/jira/oauth/start", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        res.json(await startSupabaseJiraOAuth(String(req.params.projectId ?? ""), req.body as JiraOAuthStartRequest));
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to start Jira OAuth" });
      }
      return;
    }
    res.status(501).json({ error: realDataNotReadyMessage });
  });

  router.get("/jira/oauth/callback", async (req, res) => {
    try {
      const code = String(req.query.code ?? "");
      const state = String(req.query.state ?? "");
      if (!code || !state) {
        res.status(400).json({ error: "Jira OAuth code and state are required" });
        return;
      }
      const result = await completeSupabaseJiraOAuth(code, state);
      res.redirect(result.redirectTo);
    } catch (err) {
      const message = encodeURIComponent(err instanceof Error ? err.message : "Jira OAuth callback failed");
      res.redirect(`${jiraOAuthConfig.frontendBaseUrl.replace(/\/+$/, "")}/projects?jira=error&message=${message}`);
    }
  });

  router.post("/projects/:projectId/jira/sync", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        res.json(await syncSupabaseProjectSignals(String(req.params.projectId ?? ""), String(req.body?.personaId ?? ""), "jira"));
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to sync Jira" });
      }
      return;
    }
    res.status(501).json({ error: realDataNotReadyMessage });
  });

  router.post("/projects/:projectId/git/configure", async (req, res) => {
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

  router.post("/projects/:projectId/git/sync", async (req, res) => {
    if (!mockFlowEnabled) {
      try {
        res.json(await syncSupabaseProjectSignals(String(req.params.projectId ?? ""), String(req.body?.personaId ?? ""), "git"));
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : "Unable to sync Git" });
      }
      return;
    }
    res.status(501).json({ error: realDataNotReadyMessage });
  });
}
