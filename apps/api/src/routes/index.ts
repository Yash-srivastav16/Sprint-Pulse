import { Router } from "express";
import { dataMode, mockFlowEnabled } from "../config/runtime.js";
import { aiConfigReason, aiInsightsConfigured, aiInsightsRequested, openAiModel } from "../config/ai.js";
import { jiraOAuthConfigError, jiraOAuthConfigured } from "../config/jira.js";
import { supabaseAdminConfigError, supabaseAdminConfigured } from "../lib/supabaseAdmin.js";
import { profilesTable } from "../data/supabaseProfiles.js";
import { registerAuthRoutes } from "./auth.js";
import { registerProjectRoutes } from "./projects.js";
import { registerSprintRoutes } from "./sprints.js";
import { registerTeamRoutes } from "./team.js";
import { registerIntegrationRoutes } from "./integrations.js";
import { registerStandupRoutes } from "./standups.js";
import { registerDashboardRoutes } from "./dashboard.js";
import { registerAiRoutes } from "./ai.js";
import { registerMemberRoutes } from "./members.js";
import { registerWebhookTokenRoutes } from "./webhookTokens.js";
import { configRouter } from "./config.js";

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
    jira: {
      oauthConfigured: jiraOAuthConfigured,
      oauthConfigError: jiraOAuthConfigError
    },
    ai: {
      requested: aiInsightsRequested,
      configured: aiInsightsConfigured,
      model: openAiModel,
      configError: aiConfigReason
    },
    timestamp: new Date().toISOString()
  });
});

registerAuthRoutes(apiRouter);
registerProjectRoutes(apiRouter);
registerSprintRoutes(apiRouter);
registerTeamRoutes(apiRouter);
registerIntegrationRoutes(apiRouter);
registerStandupRoutes(apiRouter);
registerDashboardRoutes(apiRouter);
registerAiRoutes(apiRouter);
registerMemberRoutes(apiRouter);
registerWebhookTokenRoutes(apiRouter);
apiRouter.use("/config", configRouter);

// 404 for unmatched /api/* routes
apiRouter.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});
