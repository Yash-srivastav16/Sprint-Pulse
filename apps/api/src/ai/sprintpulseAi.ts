import type {
  AiChatResponse,
  AiDashboardOverlay,
  AiGenerationMeta,
  AiMemberScore,
  AiNotification,
  AiNotificationAudience,
  AiPrReviewPullRequest,
  AiPrReviewResponse,
  DailyStatusAnalysis,
  DashboardResponse,
  GitCommit,
  JiraIssue,
  MemberPulse,
  ParsedTranscriptEntry,
  Persona,
  ProjectDashboardResponse,
  ProjectRole,
  RiskFlag,
  RiskLevel,
  SprintInfo,
  SprintProject,
  StandupEntry
} from "@sprintpulse/shared";
import { analyzeDailyStatusSignals } from "@sprintpulse/shared";
import { aiCacheTtlMinutes, aiConfigReason, aiInsightsEnabled, openAiModel } from "../config/ai.js";
import { callStructuredOutput } from "./openaiResponses.js";
import {
  assistantCoachPrompt,
  dailyAnalysisRefreshPrompt,
  dailyStatusStoryAnalyzerPrompt,
  memberHealthScorerPrompt,
  prReviewerPrompt,
  projectDashboardNarrativePrompt,
  roleNotificationGeneratorPrompt,
  sayDoGapDetectorPrompt,
  standupSpecificityScorerPrompt,
  transcriptParserPrompt
} from "./prompts/index.js";

type AiDashboardOutput = {
  headline: string;
  summary: string;
  scoreExplanation: string;
  nextBestAction: string;
  confidence: number;
  teamHealthScore: number;
  readinessScore: number;
  members: AiMemberScore[];
  notifications: AiNotification[];
};

type AiPrReviewInputPullRequest = {
  number: number;
  title: string;
  url?: string;
  author?: string;
  commits: number;
  filesChanged: number;
  additions: number;
  deletions: number;
  churnLines: number;
  commitMessages: string[];
  files: Array<{
    filename: string;
    status?: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>;
};

type AiPrReviewModelOutput = {
  pullRequests: Array<{
    number: number;
    riskLevel: RiskLevel;
    summary: string;
    suggestedSummaryComment: string;
    findings: Array<{
      severity: RiskLevel;
      file: string | null;
      line: number | null;
      title: string;
      message: string;
      suggestedComment: string;
    }>;
  }>;
};

type CacheEntry<T> = {
  expiresAt: number;
  signature: string;
  value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();

const nowIso = () => new Date().toISOString();
const riskLevels = ["low", "medium", "high", "critical"] as const;
const notificationSeverities = ["info", ...riskLevels] as const;
const riskFlagTypes = [
  "VAGUE_UPDATE",
  "STALE_WORK",
  "COPY_PASTE",
  "SAY_DO_GAP",
  "BLOCKER_ANOMALY",
  "BURNOUT_SIGNAL",
  "TEST_RISK",
  "SPRINT_END_RISK"
] as const;
const dailyRiskTypes = [
  "STATUS_MISMATCH",
  "UNCLEAR_REQUIREMENT",
  "DEPENDENCY_WAIT",
  "TECHNICAL_CHALLENGE",
  "SYSTEM_ISSUE",
  "SOFTWARE_ISSUE",
  "QA_NOT_DONE",
  "CODE_REVIEW_PENDING",
  "SPRINT_END_RISK"
] as const;
const dailyRiskSeverities = ["watch", "impediment", "red-flag"] as const;
const jiraStatusValues = ["Todo", "In Progress", "Review", "Blocked", "Done", "Unknown"] as const;
const standupStatusValues = ["todo", "in-progress", "blocked", "review", "done", "unclear"] as const;
const transferRoleValues = ["product-owner", "scrum-master", "engineering-manager", "architect", "developer", "qa", "none"] as const;

export const aiMeta = (
  source: AiGenerationMeta["source"],
  reason?: string,
  promptId?: string,
  cachedUntil?: string
): AiGenerationMeta => ({
  enabled: aiInsightsEnabled,
  source,
  generatedAt: nowIso(),
  model: source === "openai" || source === "cache" ? openAiModel : undefined,
  promptId,
  reason,
  cachedUntil
});

const disabledMeta = (promptId?: string) => aiMeta("disabled", aiConfigReason, promptId);

const withCache = async <T>(
  key: string,
  signature: string,
  generate: () => Promise<T>
): Promise<{ value: T; meta: AiGenerationMeta } | undefined> => {
  if (!aiInsightsEnabled) {
    return undefined;
  }

  const cached = cache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.signature === signature && cached.expiresAt > Date.now()) {
    return {
      value: cached.value,
      meta: aiMeta("cache", undefined, undefined, new Date(cached.expiresAt).toISOString())
    };
  }

  const value = await generate();
  const expiresAt = Date.now() + aiCacheTtlMinutes * 60_000;
  cache.set(key, { signature, value, expiresAt });
  return { value, meta: aiMeta("openai", undefined, undefined, new Date(expiresAt).toISOString()) };
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const riskLevelFor = (score: number): RiskLevel => {
  if (score < 45) {
    return "critical";
  }
  if (score < 65) {
    return "high";
  }
  if (score < 78) {
    return "medium";
  }
  return "low";
};

const severityRank = (severity: AiNotification["severity"]) =>
  severity === "critical" ? 5 : severity === "high" ? 4 : severity === "medium" ? 3 : severity === "low" ? 2 : 1;

const audienceForViewer = (viewer: Persona): AiNotificationAudience => {
  if (viewer.productPersona === "developer") {
    return "developer";
  }
  if (viewer.productPersona === "qa-lead") {
    return "qa";
  }
  if (viewer.productPersona === "presenter") {
    return "team";
  }
  return "manager";
};

const notificationForFlag = (
  dashboard: ProjectDashboardResponse,
  viewer: Persona,
  pulse: MemberPulse,
  flag: RiskFlag,
  audience: AiNotificationAudience
): AiNotification => ({
  id: `flag-${dashboard.project.id}-${pulse.personaId}-${flag.id}`,
  projectId: dashboard.project.id,
  sprintId: dashboard.project.sprint.id,
  personaId: pulse.personaId,
  audience,
  severity: flag.severity,
  title: flag.title,
  message:
    audience === "developer" && pulse.personaId === viewer.id
      ? flag.message
      : `${pulse.name}: ${flag.message}`,
  actionLabel: audience === "developer" ? "Open my pulse" : "Open member pulse",
  actionHref: `/projects/${dashboard.project.id}/members/${pulse.personaId}`,
  source: "ai",
  createdAt: nowIso()
});

export const buildRuleNotifications = (dashboard: ProjectDashboardResponse): AiNotification[] => {
  const audience = audienceForViewer(dashboard.viewer);
  const visiblePulses =
    audience === "developer"
      ? dashboard.memberPulses.filter((pulse) => pulse.personaId === dashboard.viewer.id)
      : dashboard.memberPulses;
  const notifications: AiNotification[] = [];

  if (audience === "manager" && dashboard.summary.atRiskCount > 0) {
    notifications.push({
      id: `team-risk-${dashboard.project.id}`,
      projectId: dashboard.project.id,
      sprintId: dashboard.project.sprint.id,
      audience,
      severity: dashboard.summary.teamHealthScore < 60 ? "high" : "medium",
      title: `${dashboard.summary.atRiskCount} member${dashboard.summary.atRiskCount === 1 ? "" : "s"} need attention`,
      message: "Open the dashboard attention queue and start with the lowest health score.",
      actionLabel: "Review dashboard",
      actionHref: `/projects/${dashboard.project.id}/dashboard`,
      source: "sprint",
      createdAt: nowIso()
    });
  }

  if (dashboard.summary.openBlockers > 0) {
    notifications.push({
      id: `blockers-${dashboard.project.id}-${audience}`,
      projectId: dashboard.project.id,
      sprintId: dashboard.project.sprint.id,
      audience,
      severity: "high",
      title: `${dashboard.summary.openBlockers} blocker${dashboard.summary.openBlockers === 1 ? "" : "s"} open`,
      message: "A standup blocker is active in the selected sprint.",
      actionLabel: "Open standups",
      actionHref: `/projects/${dashboard.project.id}/standups`,
      source: "standup",
      createdAt: nowIso()
    });
  }

  for (const pulse of visiblePulses) {
    for (const flag of pulse.flags.slice(0, 2)) {
      notifications.push(notificationForFlag(dashboard, dashboard.viewer, pulse, flag, audience));
    }

    if (audience === "developer" && pulse.standups.length === 0) {
      notifications.push({
        id: `standup-reminder-${dashboard.project.id}-${pulse.personaId}`,
        projectId: dashboard.project.id,
        sprintId: dashboard.project.sprint.id,
        personaId: pulse.personaId,
        audience,
        severity: "medium",
        title: "Standup update needed",
        message: "Submit today’s update so the sprint signals stay current.",
        actionLabel: "Submit standup",
        actionHref: `/projects/${dashboard.project.id}/standups`,
        source: "standup",
        createdAt: nowIso()
      });
    }
  }

  if (!notifications.length) {
    notifications.push({
      id: `clear-${dashboard.project.id}-${audience}`,
      projectId: dashboard.project.id,
      sprintId: dashboard.project.sprint.id,
      audience,
      severity: "info",
      title: "Sprint signal is steady",
      message: "No urgent notification is active for your role right now.",
      actionLabel: "View workspace",
      actionHref: `/projects/${dashboard.project.id}/workspace`,
      source: "sprint",
      createdAt: nowIso()
    });
  }

  return notifications.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)).slice(0, 8);
};

const dashboardSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "summary",
    "scoreExplanation",
    "nextBestAction",
    "confidence",
    "teamHealthScore",
    "readinessScore",
    "members",
    "notifications"
  ],
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    scoreExplanation: { type: "string" },
    nextBestAction: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    teamHealthScore: { type: "number", minimum: 0, maximum: 100 },
    readinessScore: { type: "number", minimum: 0, maximum: 100 },
    members: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["profileId", "healthScore", "riskLevel", "flags", "recommendation", "explanation", "confidence"],
        properties: {
          profileId: { type: "string" },
          healthScore: { type: "number", minimum: 0, maximum: 100 },
          riskLevel: { enum: riskLevels },
          flags: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "type", "severity", "title", "message"],
              properties: {
                id: { type: "string" },
                type: {
                  enum: [
                    ...riskFlagTypes
                  ]
                },
                severity: { enum: riskLevels },
                title: { type: "string" },
                message: { type: "string" }
              }
            }
          },
          recommendation: { type: "string" },
          explanation: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    },
    notifications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "message", "severity", "actionLabel"],
        properties: {
          title: { type: "string" },
          message: { type: "string" },
          severity: { enum: notificationSeverities },
          actionLabel: { type: "string" }
        }
      }
    }
  }
};

const transcriptSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["parsed"],
  properties: {
    parsed: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["memberId", "name", "yesterday", "today", "blockers", "confidence"],
        properties: {
          memberId: { type: "string" },
          name: { type: "string" },
          yesterday: { type: "string" },
          today: { type: "string" },
          blockers: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    }
  }
};

const dailyStatusAnalysisSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "risks", "stories"],
  properties: {
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["storyCount", "redFlagCount", "impedimentCount", "averageConfidence", "canCompleteSprint", "transferSuggestionCount"],
      properties: {
        storyCount: { type: "number", minimum: 0 },
        redFlagCount: { type: "number", minimum: 0 },
        impedimentCount: { type: "number", minimum: 0 },
        averageConfidence: { type: "number", minimum: 0, maximum: 100 },
        canCompleteSprint: { type: "boolean" },
        transferSuggestionCount: { type: "number", minimum: 0 }
      }
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "type", "severity", "title", "message", "ownerId", "ownerName", "storyKey", "evidence"],
        properties: {
          id: { type: "string" },
          type: {
            enum: [
              ...dailyRiskTypes
            ]
          },
          severity: { enum: dailyRiskSeverities },
          title: { type: "string" },
          message: { type: "string" },
          ownerId: { type: "string" },
          ownerName: { type: "string" },
          storyKey: { type: "string" },
          evidence: { type: "array", items: { type: "string" } }
        }
      }
    },
    stories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "storyKey",
          "title",
          "ownerId",
          "ownerName",
          "jiraStatus",
          "standupStatus",
          "confidenceScore",
          "canFinishInSprint",
          "reason",
          "riskTypes",
          "evidence",
          "transferSuggestion"
        ],
        properties: {
          storyKey: { type: "string" },
          title: { type: "string" },
          ownerId: { type: "string" },
          ownerName: { type: "string" },
          jiraStatus: { enum: jiraStatusValues },
          standupStatus: { enum: standupStatusValues },
          confidenceScore: { type: "number", minimum: 0, maximum: 100 },
          canFinishInSprint: { type: "boolean" },
          reason: { type: "string" },
          riskTypes: {
            type: "array",
            items: {
              enum: [
                ...dailyRiskTypes
              ]
            }
          },
          evidence: { type: "array", items: { type: "string" } },
          transferSuggestion: {
            type: "object",
            additionalProperties: false,
            required: ["shouldTransfer", "toMemberId", "toMemberName", "toRole", "reason"],
            properties: {
              shouldTransfer: { type: "boolean" },
              toMemberId: { type: "string" },
              toMemberName: { type: "string" },
              toRole: {
                enum: transferRoleValues
              },
              reason: { type: "string" }
            }
          }
        }
      }
    }
  }
};

const chatSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "suggestedActions"],
  properties: {
    answer: { type: "string" },
    suggestedActions: { type: "array", items: { type: "string" } }
  }
};

const prReviewSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["pullRequests"],
  properties: {
    pullRequests: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["number", "riskLevel", "summary", "suggestedSummaryComment", "findings"],
        properties: {
          number: { type: "number" },
          riskLevel: { enum: riskLevels },
          summary: { type: "string" },
          suggestedSummaryComment: { type: "string" },
          findings: {
            type: "array",
            maxItems: 8,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["severity", "file", "line", "title", "message", "suggestedComment"],
              properties: {
                severity: { enum: riskLevels },
                file: { type: ["string", "null"] },
                line: { type: ["number", "null"] },
                title: { type: "string" },
                message: { type: "string" },
                suggestedComment: { type: "string" }
              }
            }
          }
        }
      }
    }
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const isString = (value: unknown): value is string => typeof value === "string";
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isScore = (value: unknown) => isFiniteNumber(value) && value >= 0 && value <= 100;
const isConfidence = (value: unknown) => isFiniteNumber(value) && value >= 0 && value <= 1;
const isOneOf = (value: unknown, values: readonly string[]) => isString(value) && values.includes(value);
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);
const isNullableNumber = (value: unknown): value is number | null => value === null || isFiniteNumber(value);

const isRiskFlagOutput = (value: unknown): value is RiskFlag =>
  isRecord(value) &&
  isString(value.id) &&
  isOneOf(value.type, riskFlagTypes) &&
  isOneOf(value.severity, riskLevels) &&
  isString(value.title) &&
  isString(value.message);

const isDashboardMemberOutput = (value: unknown): value is AiMemberScore =>
  isRecord(value) &&
  isString(value.profileId) &&
  isScore(value.healthScore) &&
  isOneOf(value.riskLevel, riskLevels) &&
  Array.isArray(value.flags) &&
  value.flags.every(isRiskFlagOutput) &&
  isString(value.recommendation) &&
  isString(value.explanation) &&
  isConfidence(value.confidence);

const isDashboardNotificationOutput = (
  value: unknown
): value is Pick<AiNotification, "title" | "message" | "severity" | "actionLabel"> =>
  isRecord(value) &&
  isString(value.title) &&
  isString(value.message) &&
  isOneOf(value.severity, notificationSeverities) &&
  isString(value.actionLabel);

const isDashboardOutput = (value: unknown): value is AiDashboardOutput =>
  isRecord(value) &&
  isString(value.headline) &&
  isString(value.summary) &&
  isString(value.scoreExplanation) &&
  isString(value.nextBestAction) &&
  isConfidence(value.confidence) &&
  isScore(value.teamHealthScore) &&
  isScore(value.readinessScore) &&
  Array.isArray(value.members) &&
  value.members.every(isDashboardMemberOutput) &&
  Array.isArray(value.notifications) &&
  value.notifications.every(isDashboardNotificationOutput);

const isTranscriptEntryOutput = (value: unknown): value is ParsedTranscriptEntry =>
  isRecord(value) &&
  isString(value.memberId) &&
  isString(value.name) &&
  isString(value.yesterday) &&
  isString(value.today) &&
  isString(value.blockers) &&
  isConfidence(value.confidence);

const isTranscriptOutput = (value: unknown): value is { parsed: ParsedTranscriptEntry[] } =>
  isRecord(value) && Array.isArray(value.parsed) && value.parsed.every(isTranscriptEntryOutput);

const isDailyRiskOutput = (value: unknown) =>
  isRecord(value) &&
  isString(value.id) &&
  isOneOf(value.type, dailyRiskTypes) &&
  isOneOf(value.severity, dailyRiskSeverities) &&
  isString(value.title) &&
  isString(value.message) &&
  isString(value.ownerId) &&
  isString(value.ownerName) &&
  isString(value.storyKey) &&
  isStringArray(value.evidence);

const isTransferSuggestionOutput = (value: unknown) =>
  isRecord(value) &&
  isBoolean(value.shouldTransfer) &&
  isString(value.toMemberId) &&
  isString(value.toMemberName) &&
  isOneOf(value.toRole, transferRoleValues) &&
  isString(value.reason);

const isDailyStoryOutput = (value: unknown) =>
  isRecord(value) &&
  isString(value.storyKey) &&
  isString(value.title) &&
  isString(value.ownerId) &&
  isString(value.ownerName) &&
  isOneOf(value.jiraStatus, jiraStatusValues) &&
  isOneOf(value.standupStatus, standupStatusValues) &&
  isScore(value.confidenceScore) &&
  isBoolean(value.canFinishInSprint) &&
  isString(value.reason) &&
  Array.isArray(value.riskTypes) &&
  value.riskTypes.every((riskType) => isOneOf(riskType, dailyRiskTypes)) &&
  isStringArray(value.evidence) &&
  isTransferSuggestionOutput(value.transferSuggestion);

const isDailyStatusAnalysisOutput = (
  value: unknown
): value is Pick<DailyStatusAnalysis, "summary" | "risks" | "stories"> => {
  if (!isRecord(value) || !isRecord(value.summary)) {
    return false;
  }
  const summary = value.summary;
  return (
    isFiniteNumber(summary.storyCount) &&
    summary.storyCount >= 0 &&
    isFiniteNumber(summary.redFlagCount) &&
    summary.redFlagCount >= 0 &&
    isFiniteNumber(summary.impedimentCount) &&
    summary.impedimentCount >= 0 &&
    isScore(summary.averageConfidence) &&
    isBoolean(summary.canCompleteSprint) &&
    isFiniteNumber(summary.transferSuggestionCount) &&
    summary.transferSuggestionCount >= 0 &&
    Array.isArray(value.risks) &&
    value.risks.every(isDailyRiskOutput) &&
    Array.isArray(value.stories) &&
    value.stories.every(isDailyStoryOutput)
  );
};

const isChatOutput = (value: unknown): value is Pick<AiChatResponse, "answer" | "suggestedActions"> =>
  isRecord(value) && isString(value.answer) && isStringArray(value.suggestedActions);

const isPrReviewFindingOutput = (value: unknown) =>
  isRecord(value) &&
  isOneOf(value.severity, riskLevels) &&
  isNullableString(value.file) &&
  isNullableNumber(value.line) &&
  isString(value.title) &&
  isString(value.message) &&
  isString(value.suggestedComment);

const isPrReviewPullRequestOutput = (value: unknown) =>
  isRecord(value) &&
  isFiniteNumber(value.number) &&
  isOneOf(value.riskLevel, riskLevels) &&
  isString(value.summary) &&
  isString(value.suggestedSummaryComment) &&
  Array.isArray(value.findings) &&
  value.findings.length <= 8 &&
  value.findings.every(isPrReviewFindingOutput);

const isPrReviewOutput = (value: unknown): value is AiPrReviewModelOutput =>
  isRecord(value) &&
  Array.isArray(value.pullRequests) &&
  value.pullRequests.length <= 5 &&
  value.pullRequests.every(isPrReviewPullRequestOutput);

const dashboardSignature = (dashboard: ProjectDashboardResponse) =>
  JSON.stringify({
    projectId: dashboard.project.id,
    sprintId: dashboard.project.sprint.id,
    summary: dashboard.summary,
    members: dashboard.memberPulses.map((pulse) => ({
      id: pulse.personaId,
      score: pulse.healthScore,
      flags: pulse.flags.map((flag) => flag.id),
      standups: pulse.standups.length,
      tickets: pulse.tickets.length,
      commits: pulse.git.commitsThisSprint
    }))
  });

const applyAiDashboard = (
  dashboard: ProjectDashboardResponse,
  output: AiDashboardOutput,
  meta: AiGenerationMeta
): ProjectDashboardResponse => {
  const scoreByMember = new Map(output.members.map((member) => [member.profileId, member]));
  const memberPulses = dashboard.memberPulses.map((pulse) => {
    const aiScore = scoreByMember.get(pulse.personaId);
    if (!aiScore) {
      return pulse;
    }

    const healthScore = clampScore(aiScore.healthScore);
    return {
      ...pulse,
      healthScore,
      riskLevel: aiScore.riskLevel ?? riskLevelFor(healthScore),
      flags: aiScore.flags?.length ? aiScore.flags : pulse.flags,
      recommendation: aiScore.recommendation || pulse.recommendation,
      aiScore: { ...aiScore, healthScore, riskLevel: aiScore.riskLevel ?? riskLevelFor(healthScore) }
    };
  });
  const aiTeamHealthScore = Number(output.teamHealthScore);
  const teamHealthScore = Number.isFinite(aiTeamHealthScore)
    ? clampScore(aiTeamHealthScore)
    : memberPulses.length
      ? Math.round(memberPulses.reduce((sum, pulse) => sum + pulse.healthScore, 0) / memberPulses.length)
      : 0;
  const readinessScore = clampScore(output.readinessScore || teamHealthScore);

  return {
    ...dashboard,
    memberPulses,
    viewerPulse: memberPulses.find((pulse) => pulse.personaId === dashboard.viewerPulse.personaId) ?? dashboard.viewerPulse,
    summary: {
      ...dashboard.summary,
      teamHealthScore,
      readinessScore,
      atRiskCount: memberPulses.filter((pulse) => pulse.healthScore < 70).length,
      totalFlags: memberPulses.reduce((sum, pulse) => sum + pulse.flags.length, 0)
    },
    teamPreview: memberPulses.map((pulse) => ({
      id: pulse.personaId,
      name: pulse.name,
      initials: pulse.initials,
      role: pulse.hackathonRole,
      score: pulse.healthScore,
      riskLevel: pulse.riskLevel
    })),
    recommendations: memberPulses
      .filter((pulse) => pulse.riskLevel !== "low")
      .map((pulse) => pulse.recommendation)
      .slice(0, 4),
    ai: {
      headline: output.headline,
      summary: output.summary,
      scoreExplanation: output.scoreExplanation,
      nextBestAction: output.nextBestAction,
      confidence: Math.max(0, Math.min(1, output.confidence)),
      generatedAt: meta.generatedAt,
      source: meta.source === "openai" || meta.source === "cache" ? "ai" : "rule",
      notifications: output.notifications.map((notification, index) => ({
        id: `ai-${dashboard.project.id}-${index}`,
        projectId: dashboard.project.id,
        sprintId: dashboard.project.sprint.id,
        audience: audienceForViewer(dashboard.viewer),
        severity: notification.severity,
        title: notification.title,
        message: notification.message,
        actionLabel: notification.actionLabel,
        actionHref: `/projects/${dashboard.project.id}/dashboard`,
        source: "ai",
        createdAt: meta.generatedAt
      }))
    },
    aiMeta: meta
  };
};

export const enhanceDashboardWithAi = async (dashboard: ProjectDashboardResponse): Promise<ProjectDashboardResponse> => {
  if (!aiInsightsEnabled) {
    return {
      ...dashboard,
      ai: fallbackOverlay(dashboard),
      aiMeta: disabledMeta(projectDashboardNarrativePrompt.id)
    };
  }

  try {
    const signature = dashboardSignature(dashboard);
    const result = await withCache(`dashboard:${dashboard.project.id}:${dashboard.project.sprint.id}`, signature, () =>
      callStructuredOutput<AiDashboardOutput>({
        promptId: projectDashboardNarrativePrompt.id,
        system: [
          projectDashboardNarrativePrompt.system,
          memberHealthScorerPrompt.system,
          standupSpecificityScorerPrompt.system,
          sayDoGapDetectorPrompt.system,
          dailyAnalysisRefreshPrompt.system
        ].join("\n"),
        instructions: [
          projectDashboardNarrativePrompt.instructions,
          memberHealthScorerPrompt.instructions,
          standupSpecificityScorerPrompt.instructions,
          sayDoGapDetectorPrompt.instructions,
          dailyAnalysisRefreshPrompt.instructions,
          "Return final scores and detections from AI analysis, not from averaging deterministic baseline scores. Use the baseline only as one input signal."
        ].join("\n"),
        schemaName: "sprintpulse_dashboard_ai",
        schema: dashboardSchema,
        input: dashboardToAiInput(dashboard),
        validate: isDashboardOutput,
        maxOutputTokens: 2_400
      })
    );

    if (!result) {
      return { ...dashboard, ai: fallbackOverlay(dashboard), aiMeta: disabledMeta(projectDashboardNarrativePrompt.id) };
    }

    return applyAiDashboard(dashboard, result.value, { ...result.meta, promptId: projectDashboardNarrativePrompt.id });
  } catch (err) {
    return {
      ...dashboard,
      ai: fallbackOverlay(dashboard),
      aiMeta: aiMeta("fallback", err instanceof Error ? err.message : "AI dashboard generation failed", projectDashboardNarrativePrompt.id)
    };
  }
};

const fallbackOverlay = (dashboard: ProjectDashboardResponse): AiDashboardOverlay => ({
  headline:
    dashboard.summary.teamHealthScore >= 80
      ? "Sprint signals are steady"
      : dashboard.summary.teamHealthScore >= 60
        ? "Sprint needs focused attention"
        : "Sprint risk is elevated",
  summary: `${dashboard.project.name} is at ${dashboard.summary.teamHealthScore}% health with ${dashboard.summary.openBlockers} open blocker${dashboard.summary.openBlockers === 1 ? "" : "s"}.`,
  scoreExplanation: "The score is based on standup participation, Jira movement, blockers, and Git activity.",
  nextBestAction: dashboard.recommendations[0] ?? "Review the lowest-health member and clear the first blocker.",
  confidence: 0.74,
  generatedAt: nowIso(),
  source: "rule",
  notifications: buildRuleNotifications(dashboard)
});

const dashboardToAiInput = (dashboard: ProjectDashboardResponse) => ({
  viewer: dashboard.viewer,
  project: {
    id: dashboard.project.id,
    key: dashboard.project.key,
    name: dashboard.project.name,
    sprint: dashboard.project.sprint
  },
  summary: dashboard.summary,
  members: dashboard.memberPulses.map((pulse) => ({
    personaId: pulse.personaId,
    name: pulse.name,
    role: pulse.title as ProjectRole | string,
    roleExpectation:
      pulse.productPersona === "developer"
        ? "Expected to provide standups and delivery evidence when owning Jira work."
        : pulse.productPersona === "qa-lead"
          ? "Expected to provide validation, blocked testing, and release-readiness evidence."
          : "Expected to remove blockers, clarify dependencies, and coordinate delivery; do not require Git commits unless implementation ownership is visible.",
    deterministicHealthScore: pulse.healthScore,
    currentRiskLevel: pulse.riskLevel,
    flags: pulse.flags,
    standupCount: pulse.standups.length,
    latestStandup: pulse.standups[0],
    tickets: pulse.tickets,
    git: pulse.git,
    recommendation: pulse.recommendation
  }))
});

export const generateAiNotifications = async (dashboard: ProjectDashboardResponse) => {
  const fallback = buildRuleNotifications(dashboard);
  if (!aiInsightsEnabled) {
    return { notifications: fallback, meta: disabledMeta(roleNotificationGeneratorPrompt.id) };
  }

  try {
    const result = await withCache(
      `notifications:${dashboard.project.id}:${dashboard.project.sprint.id}:${dashboard.viewer.id}`,
      dashboardSignature(dashboard),
      () =>
        callStructuredOutput<{ notifications: Array<Pick<AiNotification, "title" | "message" | "severity" | "actionLabel">> }>({
          promptId: roleNotificationGeneratorPrompt.id,
          system: roleNotificationGeneratorPrompt.system,
          instructions: roleNotificationGeneratorPrompt.instructions,
          schemaName: "sprintpulse_notifications",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["notifications"],
            properties: {
              notifications: dashboardSchema.properties
                ? (dashboardSchema.properties as Record<string, unknown>).notifications
                : { type: "array", items: { type: "object" } }
            }
          },
          input: {
            audience: audienceForViewer(dashboard.viewer),
            ...dashboardToAiInput(dashboard)
          },
          validate: (value): value is { notifications: Array<Pick<AiNotification, "title" | "message" | "severity" | "actionLabel">> } =>
            isRecord(value) &&
            Array.isArray(value.notifications) &&
            value.notifications.length <= 8 &&
            value.notifications.every(isDashboardNotificationOutput),
          maxOutputTokens: 1_600
        })
    );

    if (!result || !result.value.notifications.length) {
      return { notifications: fallback, meta: aiMeta("fallback", "AI returned no notifications", roleNotificationGeneratorPrompt.id) };
    }

    return {
      notifications: result.value.notifications.slice(0, 8).map((notification, index) => ({
        id: `ai-notification-${dashboard.project.id}-${dashboard.viewer.id}-${index}`,
        projectId: dashboard.project.id,
        sprintId: dashboard.project.sprint.id,
        audience: audienceForViewer(dashboard.viewer),
        severity: notification.severity,
        title: notification.title,
        message: notification.message,
        actionLabel: notification.actionLabel,
        actionHref: `/projects/${dashboard.project.id}/dashboard`,
        source: "ai" as const,
        createdAt: result.meta.generatedAt
      })),
      meta: { ...result.meta, promptId: roleNotificationGeneratorPrompt.id }
    };
  } catch (err) {
    return {
      notifications: fallback,
      meta: aiMeta("fallback", err instanceof Error ? err.message : "AI notification generation failed", roleNotificationGeneratorPrompt.id)
    };
  }
};

export const parseTranscriptWithAi = async (
  project: SprintProject,
  personaId: string,
  transcript: string,
  allowedMembers: Array<{ personaId: string; name: string; email: string }>
) => {
  if (!aiInsightsEnabled) {
    return { parsed: [] as ParsedTranscriptEntry[], meta: disabledMeta(transcriptParserPrompt.id) };
  }

  try {
    const result = await callStructuredOutput<{ parsed: ParsedTranscriptEntry[] }>({
      promptId: transcriptParserPrompt.id,
      system: transcriptParserPrompt.system,
      instructions: transcriptParserPrompt.instructions,
      schemaName: "sprintpulse_transcript_parse",
      schema: transcriptSchema,
      input: {
        project: { id: project.id, key: project.key, name: project.name, sprint: project.sprint },
        requestedBy: personaId,
        members: allowedMembers,
        transcript
      },
      validate: isTranscriptOutput,
      maxOutputTokens: 1_600
    });

    return {
      parsed: result.parsed
        .filter((entry) => allowedMembers.some((member) => member.personaId === entry.memberId))
        .map((entry) => ({
          ...entry,
          blockers: entry.blockers?.trim() || "No blocker.",
          confidence: Math.max(0, Math.min(1, Number(entry.confidence) || 0.7))
        })),
      meta: aiMeta("openai", undefined, transcriptParserPrompt.id)
    };
  } catch (err) {
    return {
      parsed: [] as ParsedTranscriptEntry[],
      meta: aiMeta("fallback", err instanceof Error ? err.message : "AI transcript parse failed", transcriptParserPrompt.id)
    };
  }
};

const dailyStatusSignature = (
  project: SprintProject,
  parsed: ParsedTranscriptEntry[],
  previousStandups: StandupEntry[],
  issues: JiraIssue[],
  commits: GitCommit[]
) =>
  JSON.stringify({
    projectId: project.id,
    sprintId: project.sprint.id,
    parsed,
    previousStandups: previousStandups.slice(0, 12),
    issues: issues.map((issue) => ({
      key: issue.issueKey,
      status: issue.status,
      assignee: issue.assigneeProfileId,
      daysIdle: issue.daysIdle,
      storyPoints: issue.storyPoints,
      priority: issue.priority,
      issueType: issue.issueType,
      parentKey: issue.parentKey,
      title: issue.summary
    })),
    commits: commits.slice(0, 12).map((commit) => ({
      author: commit.authorProfileId,
      message: commit.message,
      committedAt: commit.committedAt
    }))
  });

export const analyzeDailyStatusWithAi = async ({
  project,
  sprint,
  parsed,
  previousStandups,
  issues,
  commits
}: {
  project: SprintProject;
  sprint: SprintInfo;
  parsed: ParsedTranscriptEntry[];
  previousStandups: StandupEntry[];
  issues: JiraIssue[];
  commits: GitCommit[];
}): Promise<DailyStatusAnalysis> => {
  const fallback = analyzeDailyStatusSignals({ project, sprint, parsed, previousStandups, issues, commits });

  if (!aiInsightsEnabled) {
    return {
      ...fallback,
      meta: disabledMeta(dailyStatusStoryAnalyzerPrompt.id)
    };
  }

  try {
    const signature = dailyStatusSignature(project, parsed, previousStandups, issues, commits);
    const result = await withCache(`daily-status:${project.id}:${sprint.id}`, signature, () =>
      callStructuredOutput<Pick<DailyStatusAnalysis, "summary" | "risks" | "stories">>({
        promptId: dailyStatusStoryAnalyzerPrompt.id,
        system: dailyStatusStoryAnalyzerPrompt.system,
        instructions: dailyStatusStoryAnalyzerPrompt.instructions,
        schemaName: "sprintpulse_daily_status_story_analysis",
        schema: dailyStatusAnalysisSchema,
        input: {
          project: {
            id: project.id,
            key: project.key,
            name: project.name,
            members: project.members.map((member) => ({
              personaId: member.personaId,
              name: member.name,
              role: member.role,
              activeIssueCount: issues.filter((issue) => issue.assigneeProfileId === member.personaId && issue.status !== "Done").length,
              activeStoryPoints: issues
                .filter((issue) => issue.assigneeProfileId === member.personaId && issue.status !== "Done")
                .reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0),
              blockedIssueCount: issues.filter((issue) => issue.assigneeProfileId === member.personaId && issue.status === "Blocked").length,
              reviewQueueCount: issues.filter((issue) => issue.assigneeProfileId === member.personaId && issue.status === "Review").length,
              staleReviewCount: issues.filter((issue) => issue.assigneeProfileId === member.personaId && issue.status === "Review" && issue.daysIdle >= 2).length,
              commitCount: commits.filter((commit) => commit.authorProfileId === member.personaId).length
            }))
          },
          sprint,
          sprintFinishContext: {
            daysRemaining: fallback.daysRemaining,
            isSprintEndingSoon: fallback.isSprintEndingSoon,
            guidance:
              fallback.daysRemaining <= 2
                ? "Sprint close is near. Treat unresolved blockers, QA pending, old review queues, and high story-point stale work as urgent spillover risks."
                : "Sprint still has time, but stale high-point work and repeated vague updates should be corrected early."
          },
          daysRemaining: fallback.daysRemaining,
          isSprintEndingSoon: fallback.isSprintEndingSoon,
          parsed,
          previousStandups,
          jiraIssues: issues,
          gitCommits: commits
        },
        validate: isDailyStatusAnalysisOutput,
        maxOutputTokens: 2_400
      })
    );

    if (!result) {
      return {
        ...fallback,
        meta: disabledMeta(dailyStatusStoryAnalyzerPrompt.id)
      };
    }

    const meta = { ...result.meta, promptId: dailyStatusStoryAnalyzerPrompt.id };
    const stories = result.value.stories.map((story) => {
      const rawJiraStatus = (story as unknown as { jiraStatus?: string }).jiraStatus;
      const jiraStatus = rawJiraStatus === "Unknown" ? undefined : (rawJiraStatus as JiraIssue["status"] | undefined);
      const rawTransfer = (story as unknown as { transferSuggestion?: { shouldTransfer?: boolean; toMemberId?: string; toMemberName?: string; toRole?: string; reason?: string } }).transferSuggestion;
      const transferSuggestion = rawTransfer
        ? {
            shouldTransfer: Boolean(rawTransfer.shouldTransfer),
            toMemberId: rawTransfer.toMemberId || undefined,
            toMemberName: rawTransfer.toMemberName || undefined,
            toRole: rawTransfer.toRole === "none" ? undefined : (rawTransfer.toRole as ProjectRole | undefined),
            reason: rawTransfer.reason || "No transfer recommendation was provided."
          }
        : undefined;
      return {
        ...story,
        jiraStatus,
        confidenceScore: clampScore(story.confidenceScore),
        evidence: story.evidence.slice(0, 4),
        transferSuggestion
      };
    });
    const risks = result.value.risks.map((risk) => ({
      ...risk,
      evidence: risk.evidence.slice(0, 4)
    }));

    return {
      generatedAt: meta.generatedAt,
      sprintId: sprint.id,
      daysRemaining: fallback.daysRemaining,
      isSprintEndingSoon: fallback.isSprintEndingSoon,
      summary: {
        storyCount: Math.max(0, Math.round(result.value.summary.storyCount || stories.length)),
        redFlagCount: Math.max(0, Math.round(result.value.summary.redFlagCount || risks.filter((risk) => risk.severity === "red-flag").length)),
        impedimentCount: Math.max(0, Math.round(result.value.summary.impedimentCount || risks.filter((risk) => risk.severity === "impediment").length)),
        averageConfidence: clampScore(result.value.summary.averageConfidence || (stories.length ? stories.reduce((sum, story) => sum + story.confidenceScore, 0) / stories.length : 0)),
        canCompleteSprint:
          typeof result.value.summary.canCompleteSprint === "boolean"
            ? result.value.summary.canCompleteSprint
            : stories.length > 0 && stories.every((story) => story.canFinishInSprint),
        transferSuggestionCount:
          Math.max(0, Math.round(result.value.summary.transferSuggestionCount || stories.filter((story) => story.transferSuggestion?.shouldTransfer).length))
      },
      risks,
      stories,
      meta
    };
  } catch (err) {
    return {
      ...fallback,
      meta: aiMeta("fallback", err instanceof Error ? err.message : "AI daily status analysis failed", dailyStatusStoryAnalyzerPrompt.id)
    };
  }
};

const prReviewRisk = (issues: number, churnLines: number, filesChanged: number): RiskLevel => {
  if (issues >= 4 || churnLines >= 700 || filesChanged >= 18) {
    return "high";
  }
  if (issues >= 2 || churnLines >= 240 || filesChanged >= 8) {
    return "medium";
  }
  return "low";
};

const fallbackPrReview = ({
  project,
  sprint,
  member,
  pullRequests,
  meta
}: {
  project: SprintProject;
  sprint: SprintInfo;
  member: { personaId: string; name: string };
  pullRequests: AiPrReviewInputPullRequest[];
  meta: AiGenerationMeta;
}): AiPrReviewResponse => {
  const reviewed = pullRequests.map((pullRequest): AiPrReviewPullRequest => {
    const findings = [];
    if (pullRequest.churnLines >= 240 || pullRequest.filesChanged >= 8) {
      findings.push({
        id: `pr-${pullRequest.number}-size`,
        severity: prReviewRisk(1, pullRequest.churnLines, pullRequest.filesChanged),
        title: "Large review surface",
        message: `This PR changes ${pullRequest.churnLines} lines across ${pullRequest.filesChanged} files, so review and QA need focused attention.`,
        suggestedComment:
          "This PR has a larger review surface. Can we confirm the main risk areas and test coverage before merge?"
      });
    }
    if (!pullRequest.files.some((file) => /test|spec/i.test(file.filename)) && pullRequest.filesChanged > 0) {
      findings.push({
        id: `pr-${pullRequest.number}-tests`,
        severity: "medium" as const,
        title: "No test file visible",
        message: "The changed file list does not show a test/spec file.",
        suggestedComment: "I do not see a test/spec update in this PR. Can we confirm how this change was validated?"
      });
    }

    const riskLevel = prReviewRisk(findings.length, pullRequest.churnLines, pullRequest.filesChanged);
    return {
      ...pullRequest,
      riskLevel,
      issueCount: findings.length,
      summary: findings.length
        ? `${findings.length} review signal${findings.length === 1 ? "" : "s"} found for PR #${pullRequest.number}.`
        : `No obvious review risk found for PR #${pullRequest.number} from the available diff metadata.`,
      suggestedSummaryComment: findings.length
        ? `SprintPulse review found ${findings.length} follow-up item${findings.length === 1 ? "" : "s"} before merge.`
        : "SprintPulse review did not find obvious issues from the available diff metadata.",
      findings
    };
  });
  const highRiskIssues = reviewed.reduce(
    (total, pullRequest) => total + pullRequest.findings.filter((finding) => finding.severity === "high" || finding.severity === "critical").length,
    0
  );
  const issues = reviewed.reduce((total, pullRequest) => total + pullRequest.issueCount, 0);

  return {
    projectId: project.id,
    sprintId: sprint.id,
    memberId: member.personaId,
    reviewedAt: meta.generatedAt,
    pullRequests: reviewed,
    totals: {
      pullRequests: reviewed.length,
      issues,
      highRiskIssues,
      suggestedComments: reviewed.reduce((total, pullRequest) => total + pullRequest.findings.length + 1, 0)
    },
    meta
  };
};

export const reviewPullRequestsWithAi = async ({
  project,
  sprint,
  member,
  pullRequests
}: {
  project: SprintProject;
  sprint: SprintInfo;
  member: { personaId: string; name: string; email: string };
  pullRequests: AiPrReviewInputPullRequest[];
}): Promise<AiPrReviewResponse> => {
  if (!pullRequests.length) {
    return fallbackPrReview({
      project,
      sprint,
      member,
      pullRequests,
      meta: aiMeta("disabled", "No open pull requests are mapped to this member.", prReviewerPrompt.id)
    });
  }

  const fallback = () =>
    fallbackPrReview({
      project,
      sprint,
      member,
      pullRequests,
      meta: disabledMeta(prReviewerPrompt.id)
    });

  if (!aiInsightsEnabled) {
    return fallback();
  }

  try {
    const signature = JSON.stringify({ projectId: project.id, sprintId: sprint.id, memberId: member.personaId, pullRequests });
    const result = await withCache(`pr-review:${project.id}:${sprint.id}:${member.personaId}`, signature, () =>
      callStructuredOutput<AiPrReviewModelOutput>({
        promptId: prReviewerPrompt.id,
        system: prReviewerPrompt.system,
        instructions: prReviewerPrompt.instructions,
        schemaName: "sprintpulse_pr_review",
        schema: prReviewSchema,
        input: {
          project: { id: project.id, key: project.key, name: project.name },
          sprint,
          member,
          pullRequests
        },
        validate: isPrReviewOutput,
        maxOutputTokens: 2_400
      })
    );

    if (!result) {
      return fallback();
    }

    const fallbackByNumber = new Map(fallback().pullRequests.map((pullRequest) => [pullRequest.number, pullRequest]));
    const outputByNumber = new Map(result.value.pullRequests.map((pullRequest) => [pullRequest.number, pullRequest]));
    const reviewed = pullRequests.map((pullRequest): AiPrReviewPullRequest => {
      const output = outputByNumber.get(pullRequest.number);
      const fallbackPullRequest = fallbackByNumber.get(pullRequest.number);
      if (!output) {
        return fallbackPullRequest ?? {
          ...pullRequest,
          riskLevel: "low",
          issueCount: 0,
          summary: "AI did not return review detail for this PR.",
          suggestedSummaryComment: "SprintPulse did not find a review summary for this PR.",
          findings: []
        };
      }

      const findings = output.findings.slice(0, 8).map((finding, index) => ({
        id: `pr-${pullRequest.number}-ai-${index}`,
        severity: finding.severity,
        file: finding.file ?? undefined,
        line: finding.line ?? undefined,
        title: finding.title,
        message: finding.message,
        suggestedComment: finding.suggestedComment
      }));

      return {
        ...pullRequest,
        riskLevel: output.riskLevel,
        issueCount: findings.length,
        summary: output.summary,
        suggestedSummaryComment: output.suggestedSummaryComment,
        findings
      };
    });
    const highRiskIssues = reviewed.reduce(
      (total, pullRequest) => total + pullRequest.findings.filter((finding) => finding.severity === "high" || finding.severity === "critical").length,
      0
    );
    const issues = reviewed.reduce((total, pullRequest) => total + pullRequest.issueCount, 0);

    return {
      projectId: project.id,
      sprintId: sprint.id,
      memberId: member.personaId,
      reviewedAt: result.meta.generatedAt,
      pullRequests: reviewed,
      totals: {
        pullRequests: reviewed.length,
        issues,
        highRiskIssues,
        suggestedComments: reviewed.reduce((total, pullRequest) => total + pullRequest.findings.length + 1, 0)
      },
      meta: { ...result.meta, promptId: prReviewerPrompt.id }
    };
  } catch (err) {
    return fallbackPrReview({
      project,
      sprint,
      member,
      pullRequests,
      meta: aiMeta("fallback", err instanceof Error ? err.message : "AI PR review failed", prReviewerPrompt.id)
    });
  }
};

export const answerProjectQuestion = async (
  dashboard: ProjectDashboardResponse,
  message: string
): Promise<AiChatResponse> => {
  const fallback: AiChatResponse = {
    answer: `For ${dashboard.project.name}, start with ${dashboard.summary.teamHealthScore}% health, ${dashboard.summary.atRiskCount} at-risk member${dashboard.summary.atRiskCount === 1 ? "" : "s"}, and ${dashboard.summary.openBlockers} open blocker${dashboard.summary.openBlockers === 1 ? "" : "s"}. ${dashboard.ai?.nextBestAction ?? dashboard.recommendations[0] ?? "Open the dashboard attention queue for the next action."}`,
    suggestedActions: ["Open dashboard", "Review member pulse"],
    meta: disabledMeta(assistantCoachPrompt.id)
  };

  if (!aiInsightsEnabled) {
    return fallback;
  }

  try {
    const result = await callStructuredOutput<Pick<AiChatResponse, "answer" | "suggestedActions">>({
      promptId: assistantCoachPrompt.id,
      system: assistantCoachPrompt.system,
      instructions: assistantCoachPrompt.instructions,
      schemaName: "sprintpulse_ai_chat",
      schema: chatSchema,
      input: {
        question: message,
        project: dashboardToAiInput(dashboard),
        aiOverlay: dashboard.ai
      },
      validate: isChatOutput,
      maxOutputTokens: 900
    });

    return {
      answer: result.answer,
      suggestedActions: result.suggestedActions.slice(0, 4),
      meta: aiMeta("openai", undefined, assistantCoachPrompt.id)
    };
  } catch (err) {
    return {
      ...fallback,
      meta: aiMeta("fallback", err instanceof Error ? err.message : "AI assistant failed", assistantCoachPrompt.id)
    };
  }
};

export const fallbackAiDashboard = (dashboard: DashboardResponse) => ({
  ...dashboard,
  aiMeta: disabledMeta(projectDashboardNarrativePrompt.id)
});
