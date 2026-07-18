import { createHash, randomBytes } from "node:crypto";
import type {
  CreateWebhookTokenResponse,
  ListWebhookTokensResponse,
  WebhookToken
} from "@sprintpulse/shared";
import { supabaseAdmin, supabaseAdminConfigError } from "../lib/supabaseAdmin.js";

interface WebhookTokenRow {
  id: string;
  project_id: string;
  name: string;
  token_hash: string;
  token_hint: string;
  created_at: string;
  last_used_at: string | null;
  created_by_profile_id: string | null;
  revoked_at: string | null;
}

const requireAdmin = () => {
  if (!supabaseAdmin) {
    throw new Error(supabaseAdminConfigError ?? "Supabase admin client is not configured.");
  }
  return supabaseAdmin;
};

const TOKEN_PREFIX = "sptk_";
const TOKEN_BYTES = 24; // → 32 base64url chars after the prefix

const generatePlaintextToken = (): string => {
  return TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString("base64url");
};

const hashToken = (plaintext: string): string => {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
};

const tokenHint = (plaintext: string): string => {
  // last 4 chars, prefixed with • so the UI can render "sptk_•••mP3a" without
  // ever round-tripping the full secret.
  return plaintext.slice(-4);
};

const rowToToken = (row: WebhookTokenRow): WebhookToken => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  tokenHint: row.token_hint,
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
  createdByProfileId: row.created_by_profile_id,
  revokedAt: row.revoked_at
});

export const createProjectWebhookToken = async (
  projectId: string,
  personaId: string,
  name: string
): Promise<CreateWebhookTokenResponse> => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Token name is required.");
  }
  if (trimmedName.length > 80) {
    throw new Error("Token name must be 80 characters or fewer.");
  }

  const client = requireAdmin();
  const plaintext = generatePlaintextToken();
  const { data, error } = await client
    .from("project_webhook_tokens")
    .insert({
      project_id: projectId,
      name: trimmedName,
      token_hash: hashToken(plaintext),
      token_hint: tokenHint(plaintext),
      created_by_profile_id: personaId || null
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create webhook token.");
  }

  return {
    token: rowToToken(data as WebhookTokenRow),
    plaintextToken: plaintext
  };
};

export const listProjectWebhookTokens = async (projectId: string): Promise<ListWebhookTokensResponse> => {
  const client = requireAdmin();
  const { data, error } = await client
    .from("project_webhook_tokens")
    .select("*")
    .eq("project_id", projectId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return {
    tokens: (data ?? []).map((row) => rowToToken(row as WebhookTokenRow))
  };
};

export const projectHasAnyActiveWebhookToken = async (projectId: string): Promise<boolean> => {
  const client = requireAdmin();
  const { count } = await client
    .from("project_webhook_tokens")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .is("revoked_at", null);
  return (count ?? 0) > 0;
};

export const revokeProjectWebhookToken = async (projectId: string, tokenId: string): Promise<void> => {
  const client = requireAdmin();
  const { error } = await client
    .from("project_webhook_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("project_id", projectId)
    .is("revoked_at", null);

  if (error) {
    throw new Error(error.message);
  }
};

/**
 * Validate a webhook token against the DB for a specific project. Returns true
 * when the token matches an active (non-revoked) token; touches last_used_at
 * on the matching row so the UI can show recency. Returns false otherwise.
 *
 * Callers can fall through to env-based TEAMS_WEBHOOK_TOKEN if this returns
 * false, preserving the existing single-secret pattern for backwards-compat.
 */
export const validateProjectWebhookToken = async (
  projectId: string,
  plaintext: string
): Promise<boolean> => {
  if (!plaintext) return false;
  const client = requireAdmin();
  const hash = hashToken(plaintext);

  const { data, error } = await client
    .from("project_webhook_tokens")
    .select("id")
    .eq("project_id", projectId)
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  // Best-effort touch; ignore errors so a failed update doesn't block the
  // legitimate webhook from running.
  void client
    .from("project_webhook_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id as string)
    .then(() => undefined, () => undefined);

  return true;
};
