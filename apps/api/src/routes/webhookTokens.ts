import { type Router } from "express";
import { mockFlowEnabled } from "../config/runtime.js";
import {
  createProjectWebhookToken,
  listProjectWebhookTokens,
  revokeProjectWebhookToken
} from "../data/supabaseWebhookTokens.js";
import { supabaseAdmin, supabaseAdminConfigError } from "../lib/supabaseAdmin.js";

/**
 * Authorize webhook-token management for a project + persona. Reads
 * project_members directly because requiring permissions through the heavier
 * loadProjectContext pulls in a lot of unrelated DB queries. Anyone who can
 * "connect" the project (Scrum Master, EM, PO, Architect, Admin) can mint
 * tokens; everyone else gets a 403.
 *
 * Returns true when the caller is authorized.
 */
const canManageTokens = async (projectId: string, personaId: string): Promise<boolean> => {
  if (!supabaseAdmin || !projectId || !personaId) return false;

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id, created_by")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return false;

  if ((project as { created_by: string | null }).created_by === personaId) {
    return true;
  }

  const { data: membership } = await supabaseAdmin
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("profile_id", personaId)
    .maybeSingle();

  if (!membership) return false;
  const role = (membership as { role: string }).role;
  return ["product-owner", "scrum-master", "engineering-manager", "architect"].includes(role);
};

export function registerWebhookTokenRoutes(router: Router): void {
  router.get("/projects/:projectId/webhook-tokens", async (req, res) => {
    if (mockFlowEnabled) {
      res.status(501).json({ error: "Webhook tokens require Supabase mode." });
      return;
    }
    if (!supabaseAdmin) {
      res.status(503).json({ error: supabaseAdminConfigError ?? "Supabase admin not configured." });
      return;
    }

    try {
      const projectId = String(req.params.projectId ?? "");
      const personaId = String(req.query.personaId ?? "");

      if (!(await canManageTokens(projectId, personaId))) {
        res.status(403).json({ error: "You do not have permission to view webhook tokens for this project." });
        return;
      }

      res.json(await listProjectWebhookTokens(projectId));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list webhook tokens." });
    }
  });

  router.post("/projects/:projectId/webhook-tokens", async (req, res) => {
    if (mockFlowEnabled) {
      res.status(501).json({ error: "Webhook tokens require Supabase mode." });
      return;
    }
    if (!supabaseAdmin) {
      res.status(503).json({ error: supabaseAdminConfigError ?? "Supabase admin not configured." });
      return;
    }

    try {
      const projectId = String(req.params.projectId ?? "");
      const personaId = String(req.body?.personaId ?? "");
      const name = String(req.body?.name ?? "");

      if (!(await canManageTokens(projectId, personaId))) {
        res.status(403).json({ error: "You do not have permission to mint webhook tokens for this project." });
        return;
      }

      res.status(201).json(await createProjectWebhookToken(projectId, personaId, name));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to mint webhook token.";
      const status = message.includes("required") || message.includes("characters") ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  router.delete("/projects/:projectId/webhook-tokens/:tokenId", async (req, res) => {
    if (mockFlowEnabled) {
      res.status(501).json({ error: "Webhook tokens require Supabase mode." });
      return;
    }
    if (!supabaseAdmin) {
      res.status(503).json({ error: supabaseAdminConfigError ?? "Supabase admin not configured." });
      return;
    }

    try {
      const projectId = String(req.params.projectId ?? "");
      const tokenId = String(req.params.tokenId ?? "");
      const personaId = String(req.query.personaId ?? "");

      if (!(await canManageTokens(projectId, personaId))) {
        res.status(403).json({ error: "You do not have permission to revoke webhook tokens for this project." });
        return;
      }

      await revokeProjectWebhookToken(projectId, tokenId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to revoke webhook token." });
    }
  });
}
