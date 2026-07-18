import type { AiGenerationMeta, ProjectDashboardResponse, RiskLevel, SprintInfo, SyncRun } from "@sprintpulse/shared";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { insertSyncRun } from "./supabaseSyncRuns.js";

export const AI_DASHBOARD_SNAPSHOT_TITLE = "Cached AI dashboard refresh";

type AiPersistSignals = {
  sprint: SprintInfo;
  runs: SyncRun[];
};

type SnapshotPayload = {
  schemaVersion: 1;
  cachedAt: string;
  dashboard: ProjectDashboardResponse;
  aiMeta?: AiGenerationMeta;
};

const requireSupabaseAdmin = () => {
  if (!supabaseAdmin) {
    throw new Error("Backend Supabase Admin is not configured.");
  }
  return supabaseAdmin;
};

const riskSeverity = (score: number): RiskLevel => {
  if (score < 45) return "critical";
  if (score < 65) return "high";
  if (score < 78) return "medium";
  return "low";
};

const isSnapshotPayload = (value: unknown): value is SnapshotPayload =>
  Boolean(
    value &&
      typeof value === "object" &&
      (value as { schemaVersion?: unknown }).schemaVersion === 1 &&
      typeof (value as { cachedAt?: unknown }).cachedAt === "string" &&
      typeof (value as { dashboard?: unknown }).dashboard === "object"
  );

export const readAiDashboardSnapshot = async (
  projectId: string,
  sprintId: string,
  personaId: string
): Promise<ProjectDashboardResponse | undefined> => {
  const client = requireSupabaseAdmin();
  const { data, error } = await client
    .from("recommendations")
    .select("inputs,created_at")
    .eq("project_id", projectId)
    .eq("sprint_id", sprintId)
    .eq("profile_id", personaId)
    .eq("title", AI_DASHBOARD_SNAPSHOT_TITLE)
    .eq("status", "resolved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  const payload = (data as { inputs?: unknown }).inputs;
  if (!isSnapshotPayload(payload)) {
    return undefined;
  }

  const dashboard = payload.dashboard;
  if (dashboard.project.id !== projectId || dashboard.project.sprint.id !== sprintId || dashboard.viewer.id !== personaId) {
    return undefined;
  }

  return {
    ...dashboard,
    aiMeta: dashboard.aiMeta
      ? {
          ...dashboard.aiMeta,
          source: "cache",
          reason: `Loaded pre-cached manual AI refresh from ${payload.cachedAt}.`,
          cachedUntil: undefined
        }
      : dashboard.aiMeta
  };
};

export const writeAiDashboardSnapshot = async (dashboard: ProjectDashboardResponse, personaId: string) => {
  const client = requireSupabaseAdmin();
  const payload: SnapshotPayload = {
    schemaVersion: 1,
    cachedAt: new Date().toISOString(),
    dashboard,
    aiMeta: dashboard.aiMeta
  };

  const cleanup = await client
    .from("recommendations")
    .delete()
    .eq("project_id", dashboard.project.id)
    .eq("sprint_id", dashboard.project.sprint.id)
    .eq("profile_id", personaId)
    .eq("title", AI_DASHBOARD_SNAPSHOT_TITLE);

  if (cleanup.error) {
    throw new Error(cleanup.error.message);
  }

  const { error } = await client.from("recommendations").insert({
    project_id: dashboard.project.id,
    sprint_id: dashboard.project.sprint.id,
    profile_id: personaId,
    kind: "team",
    severity: riskSeverity(dashboard.summary.teamHealthScore),
    title: AI_DASHBOARD_SNAPSHOT_TITLE,
    message: "Pre-cached dashboard AI output for low-latency demo reloads.",
    inputs: payload,
    status: "resolved"
  });

  if (error) {
    throw new Error(error.message);
  }
};

const saveAiRecommendations = async (dashboard: ProjectDashboardResponse) => {
  const client = requireSupabaseAdmin();
  const rows = dashboard.memberPulses
    .filter((pulse) => pulse.riskLevel !== "low" || pulse.aiScore)
    .slice(0, 6)
    .map((pulse) => ({
      project_id: dashboard.project.id,
      sprint_id: dashboard.project.sprint.id,
      profile_id: pulse.personaId,
      kind: pulse.flags[0]?.type === "BLOCKER_ANOMALY" ? "standup" : "delivery",
      severity: pulse.riskLevel,
      title: pulse.flags[0]?.title ?? `Check ${pulse.name}`,
      message: pulse.recommendation,
      inputs: {
        aiGenerated: Boolean(pulse.aiScore),
        explanation: pulse.aiScore?.explanation,
        confidence: pulse.aiScore?.confidence,
        healthScore: pulse.healthScore
      },
      status: "open"
    }));

  const cleanup = await client
    .from("recommendations")
    .delete()
    .eq("project_id", dashboard.project.id)
    .eq("sprint_id", dashboard.project.sprint.id)
    .contains("inputs", { aiGenerated: true });
  if (cleanup.error) {
    throw new Error(cleanup.error.message);
  }

  if (!rows.length) {
    return 0;
  }

  const { error } = await client.from("recommendations").insert(rows);
  if (error) {
    throw new Error(error.message);
  }

  return rows.length;
};

const hasDailyAiAnalysisRun = (signals: AiPersistSignals) => {
  const today = new Date().toLocaleDateString("en-CA");
  return signals.runs.some((run) => {
    const runSprintId = typeof run.stats?.sprintId === "string" ? run.stats.sprintId : undefined;
    return (
      run.source === "recommendation" &&
      run.status === "succeeded" &&
      run.startedAt.slice(0, 10) === today &&
      (!runSprintId || runSprintId === signals.sprint.id)
    );
  });
};

export const persistAiAnalysisRun = async (
  projectId: string,
  personaId: string,
  dashboard: ProjectDashboardResponse,
  signals: AiPersistSignals,
  mode: "daily" | "manual"
) => {
  if (!dashboard.aiMeta?.enabled) {
    return;
  }

  if (mode === "daily" && hasDailyAiAnalysisRun(signals)) {
    return;
  }

  const savedRecommendations = await saveAiRecommendations(dashboard);
  await insertSyncRun(projectId, personaId, "recommendation", {
    mode,
    sprintId: signals.sprint.id,
    aiSource: dashboard.aiMeta.source,
    promptId: dashboard.aiMeta.promptId ?? null,
    savedRecommendations,
    teamHealthScore: dashboard.summary.teamHealthScore,
    readinessScore: dashboard.summary.readinessScore,
    atRiskCount: dashboard.summary.atRiskCount,
    totalFlags: dashboard.summary.totalFlags
  });
};
