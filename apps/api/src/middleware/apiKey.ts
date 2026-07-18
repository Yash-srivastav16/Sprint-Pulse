import type { NextFunction, Request, RequestHandler, Response } from "express";
import { getAuthUserFromToken } from "../lib/supabaseAdmin.js";

/**
 * Express middleware that gates /api/* on EITHER:
 *
 *   - X-SprintPulse-API-Key header matching process.env.SPRINTPULSE_API_KEY, OR
 *   - Authorization: Bearer <token> where the token is a valid Supabase user JWT.
 *
 * Behaviour:
 *   - If SPRINTPULSE_API_KEY is unset, the middleware is a no-op (backwards-compat
 *     with the web UI which doesn't yet attach its Supabase JWT to API calls).
 *     This is the default and matches existing dev/local deploys.
 *   - When the env is set, every request to /api/* must carry one of the two
 *     credentials above. /api/health is exempted so container healthchecks
 *     still work.
 *
 * Design choice: dual accept (API key OR JWT) so:
 *   - The MCP server (and any other server-to-server caller) authenticates with
 *     the shared API key.
 *   - The web UI, once we wire api.ts to send `Authorization: Bearer <jwt>`, gets
 *     a per-user authenticated path without sharing the API key with browsers.
 *
 * What this does NOT solve: the agent's `personaId` parameter on tool calls is
 * still trusted as identity. An adversarial prompt can ask the agent to act
 * "as Yash" and the API will obey. The fix is Personal Access Tokens (PATs)
 * that bind every tool call to a single persona derived from the credential
 * itself — tracked separately as the next auth step.
 */

const HEALTH_PATH = "/health"; // mounted at /api/health by apiRouter
const JIRA_OAUTH_CALLBACK_PATH = "/jira/oauth/callback"; // Atlassian redirect, validated by OAuth state

export function apiAuthMiddleware(): RequestHandler {
  const expectedKey = process.env.SPRINTPULSE_API_KEY;
  if (!expectedKey) {
    // No-op so existing dev/local flows keep working unchanged.
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    // /api/health stays public — healthchecks (Docker, platform probes) hit it
    // before any caller could authenticate.
    if (
      req.path === HEALTH_PATH ||
      req.path === "/health/" ||
      (req.method === "GET" && (req.path === JIRA_OAUTH_CALLBACK_PATH || req.path === `${JIRA_OAUTH_CALLBACK_PATH}/`))
    ) {
      next();
      return;
    }

    const providedKey = req.get("X-SprintPulse-API-Key");
    if (providedKey && providedKey === expectedKey) {
      next();
      return;
    }

    const authHeader = req.get("Authorization");
    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice("bearer ".length).trim();
      if (token) {
        try {
          const user = await getAuthUserFromToken(token);
          if (user) {
            next();
            return;
          }
        } catch {
          // Fall through to 401 — invalid JWT looks the same as no JWT.
        }
      }
    }

    res.status(401).json({
      error:
        "Missing or invalid credentials. Send X-SprintPulse-API-Key (server-to-server) or Authorization: Bearer <supabase-jwt> (user)."
    });
  };
}
