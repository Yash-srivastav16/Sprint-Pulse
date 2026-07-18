import type { SyncRun } from "@sprintpulse/shared";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

export type SyncRunRow = {
  id: string;
  project_id: string;
  source: SyncRun["source"];
  status: SyncRun["status"];
  requested_by: string;
  started_at: string;
  finished_at?: string | null;
  stats?: Record<string, string | number | boolean | null> | null;
  error_message?: string | null;
};

const requireSupabaseAdmin = () => {
  if (!supabaseAdmin) {
    throw new Error("Backend Supabase Admin is not configured.");
  }
  return supabaseAdmin;
};

export const toSyncRun = (row: SyncRunRow): SyncRun => ({
  id: row.id,
  projectId: row.project_id,
  source: row.source,
  status: row.status,
  requestedBy: row.requested_by,
  startedAt: row.started_at,
  finishedAt: row.finished_at ?? undefined,
  stats: row.stats ?? {},
  errorMessage: row.error_message ?? undefined
});

export const insertSyncRun = async (
  projectId: string,
  personaId: string,
  source: SyncRun["source"],
  stats: SyncRun["stats"],
  status: SyncRun["status"] = "succeeded",
  errorMessage?: string
) => {
  const client = requireSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("sync_runs")
    .insert({
      project_id: projectId,
      source,
      status,
      requested_by: personaId,
      started_at: now,
      finished_at: now,
      stats,
      error_message: errorMessage ?? null
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toSyncRun(data as SyncRunRow);
};
