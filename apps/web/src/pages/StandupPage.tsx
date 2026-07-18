import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  ClipboardCheck,
  GitCommitHorizontal,
  History,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  TicketCheck,
  UploadCloud
} from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import type {
  DailyStatusAnalysis,
  FlagType,
  MemberPulse,
  ParsedTranscriptEntry,
  ProjectDashboardResponse,
  ProjectStandupsResponse,
  StandupWithMember
} from "@sprintpulse/shared";
import { Input } from "@/components/ui/input";
import {
  EmptyPanel,
  MemberAvatar,
  PanelHeader,
  SectionPanel,
  StatusPill,
  WorkspaceError,
  WorkspaceHero,
  WorkspaceLoading,
  workspacePageClass
} from "@/components/workspace/WorkspaceChrome";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import { clearProjectCache, projectCacheKey, readProjectCache, writeProjectCache } from "../lib/projectDataCache";
import { cn } from "../lib/utils";

type StandupMode = "manual" | "transcript" | "upload";
type TagTone = "primary" | "info" | "warning" | "danger" | "ai" | "success" | "neutral";
type SignalTag = { label: string; tone: TagTone; type?: FlagType | "LOW_SPECIFICITY" | "BLOCKER" | "JIRA_LINKED" | "GIT_PROOF" | "SOURCE" };
type ParsedSpeakerUpdate = ParsedTranscriptEntry;
type TranscriptStorySignal = {
  id: string;
  owner: string;
  status: "done" | "blocked" | "review" | "progress";
  summary: string;
  issues: SignalTag[];
  confidence: number;
  canFinish: boolean;
};
type TranscriptFlag = {
  id: string;
  title: string;
  owner: string;
  storyId: string;
  message: string;
  tone: TagTone;
  level: "Medium" | "High" | "Critical";
};

const modeCopy: Record<StandupMode, string> = {
  manual: "Capture one member update.",
  transcript: "Parse speaker updates from a meeting transcript.",
  upload: "Drop a Teams VTT or any TXT/MD/CSV export to parse."
};

const DEFAULT_STANDUP_DURATION_MINUTES = 15;
type StandupCacheValue = {
  standups: ProjectStandupsResponse;
  dashboard: ProjectDashboardResponse | null;
};

function hasOpenBlocker(value: string) {
  const text = value.trim().toLowerCase();
  if (!text) {
    return false;
  }

  const escalation = /\b(except|but|however|waiting|blocked|dependency|depends|pending|stuck|issue|problem|unclear|clarification|qa|review|approval|access|token|down|failing)\b/i;
  if (/\b(no blockers?|none|nothing)\b/i.test(text) && !escalation.test(text)) {
    return false;
  }

  return true;
}

function compactText(value: string, max = 118) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function usefulText(value?: string) {
  const text = value?.trim() ?? "";
  if (!text || /^[a-z]$/i.test(text)) {
    return "";
  }
  return text;
}

function initialsFromName(name: string) {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SP"
  );
}

function updateSummary(entry: { yesterday: string; today: string; blockers?: string }) {
  return (
    usefulUpdateText(entry.today) ||
    usefulUpdateText(entry.yesterday) ||
    (usefulText(entry.blockers) ? `Blocker: ${usefulText(entry.blockers)}` : "Update captured, but the transcript needs clearer speaker detail.")
  );
}

function usefulUpdateText(value?: string) {
  const text = usefulText(value);
  if (!text) {
    return "";
  }

  if (/^(shared previous progress in standup|continue planned sprint work|continue selected .* sprint work|update captured)/i.test(text)) {
    return "";
  }

  return text;
}

function standupUpdateParts(entry: { yesterday: string; today: string; blockers?: string }) {
  return {
    yesterday: usefulUpdateText(entry.yesterday),
    today: usefulUpdateText(entry.today),
    blocker: hasOpenBlocker(entry.blockers ?? "") ? usefulText(entry.blockers) : ""
  };
}

function localDateKey(date = new Date()) {
  return date.toLocaleDateString("en-CA");
}

function timelineDateMeta(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return {
      relative: value,
      weekday: "",
      month: "",
      day: "",
      full: value
    };
  }

  const todayKey = localDateKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateKey(yesterday);
  const dateKey = localDateKey(date);

  return {
    relative: dateKey === todayKey ? "Today" : dateKey === yesterdayKey ? "Yesterday" : date.toLocaleDateString(undefined, { weekday: "short" }),
    weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
    month: date.toLocaleDateString(undefined, { month: "short" }),
    day: date.toLocaleDateString(undefined, { day: "numeric" }),
    full: date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clockTokenToSeconds(value: string) {
  const parts = value
    .replace(",", ".")
    .split(":")
    .map((part) => Number.parseFloat(part));

  if (parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return null;
}

function safeDurationMinutes(seconds: number | null) {
  if (!seconds || seconds <= 0) {
    return null;
  }

  const minutes = Math.round(seconds / 60);
  return minutes >= 1 && minutes <= 180 ? minutes : null;
}

function wallClockToMinutes(hourValue: string, minuteValue: string, meridiem: string) {
  let hour = Number.parseInt(hourValue, 10);
  const minute = Number.parseInt(minuteValue, 10);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  const lowerMeridiem = meridiem.toLowerCase();
  if (lowerMeridiem === "pm" && hour !== 12) {
    hour += 12;
  }
  if (lowerMeridiem === "am" && hour === 12) {
    hour = 0;
  }

  return hour * 60 + minute;
}

function detectTranscriptDurationMinutes(value: string) {
  const text = value.replace(/\r/g, "\n");
  const explicitClock = text.match(/\b(?:meeting|standup|call|recording)?\s*(?:duration|elapsed|total time|recording length)\s*[:=-]?\s*((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[\.,]\d{1,3})?)/i);
  if (explicitClock?.[1]) {
    const duration = safeDurationMinutes(clockTokenToSeconds(explicitClock[1]));
    if (duration) {
      return duration;
    }
  }

  const explicitMinutes = text.match(/\b(?:meeting|standup|call|recording|duration|elapsed|total time)\D{0,28}(\d{1,3})\s*(?:m|min|mins|minute|minutes)\b/i);
  if (explicitMinutes?.[1]) {
    const duration = clamp(Number.parseInt(explicitMinutes[1], 10), 1, 180);
    if (duration) {
      return duration;
    }
  }

  const rangeMatches = Array.from(
    text.matchAll(/((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[\.,]\d{1,3})?)\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[\.,]\d{1,3})?)/g)
  );
  if (rangeMatches.length) {
    const starts = rangeMatches.map((match) => clockTokenToSeconds(match[1])).filter((seconds): seconds is number => seconds !== null);
    const ends = rangeMatches.map((match) => clockTokenToSeconds(match[2])).filter((seconds): seconds is number => seconds !== null);
    const duration = safeDurationMinutes(Math.max(...ends) - Math.min(...starts));
    if (duration) {
      return duration;
    }
  }

  const timecodeMatches = Array.from(
    text.matchAll(/(?:^|\s|\[|\()((?:\d{1,2}:)?\d{1,2}:\d{2})(?:[\.,]\d{1,3})?(?!\s?(?:am|pm)\b)(?:\]|\)|\s|$)/gim)
  )
    .map((match) => clockTokenToSeconds(match[1]))
    .filter((seconds): seconds is number => seconds !== null);
  if (timecodeMatches.length >= 2) {
    const duration = safeDurationMinutes(Math.max(...timecodeMatches) - Math.min(...timecodeMatches));
    if (duration) {
      return duration;
    }
  }

  const wallClockMatches = Array.from(text.matchAll(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/gi))
    .map((match) => wallClockToMinutes(match[1], match[2], match[3]))
    .filter((minutes): minutes is number => minutes !== null);
  if (wallClockMatches.length >= 2) {
    const first = wallClockMatches[0];
    const last = wallClockMatches[wallClockMatches.length - 1];
    const diff = last >= first ? last - first : last + 1440 - first;
    return diff >= 1 && diff <= 180 ? diff : null;
  }

  return null;
}

function standupQuality(entry: StandupWithMember) {
  const combined = `${entry.yesterday} ${entry.today}`.toLowerCase();
  const wordCount = combined.split(/\s+/).filter(Boolean).length;
  const hasIssueKey = /\b[A-Z][A-Z0-9]+-\d+\b/.test(`${entry.yesterday} ${entry.today} ${entry.blockers}`);
  const hasConcreteVerb = /(shipped|merged|fixed|reviewed|implemented|connected|tested|blocked|deployed|created|completed|debugged|validated)/i.test(combined);
  const vague = /(working on|continue|stuff|things|some changes|almost done|same as|progress)/i.test(combined);
  const blockerPenalty = hasOpenBlocker(entry.blockers) ? 8 : 0;
  const score = 42 + Math.min(24, wordCount * 2) + (hasIssueKey ? 14 : 0) + (hasConcreteVerb ? 18 : 0) - (vague ? 18 : 0) - blockerPenalty;

  return Math.max(22, Math.min(98, Math.round(score)));
}

function tagToneClass(tone: TagTone) {
  const tones = {
    primary: "border-primary-500/25 bg-primary-500/10 text-primary-700 dark:text-primary-100",
    info: "border-info-500/25 bg-info-500/10 text-info-700 dark:text-info-100",
    warning: "border-warning-500/30 bg-warning-500/10 text-warning-700 dark:text-warning-100",
    danger: "border-danger-500/30 bg-danger-500/10 text-danger-700 dark:text-danger-100",
    ai: "border-ai-500/25 bg-ai-500/10 text-ai-700 dark:text-ai-100",
    success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100",
    neutral: "border-slate-200 bg-white/70 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
  } as const;

  return tones[tone];
}

const flagLabels: Record<FlagType, string> = {
  VAGUE_UPDATE: "Vague update",
  STALE_WORK: "Stale work",
  COPY_PASTE: "Copy-paste",
  SAY_DO_GAP: "Say-do gap",
  BLOCKER_ANOMALY: "Blocker anomaly",
  BURNOUT_SIGNAL: "Burnout signal",
  TEST_RISK: "Test risk",
  SPRINT_END_RISK: "Sprint finish risk"
};

const flagTones: Record<FlagType, TagTone> = {
  VAGUE_UPDATE: "warning",
  STALE_WORK: "warning",
  COPY_PASTE: "warning",
  SAY_DO_GAP: "danger",
  BLOCKER_ANOMALY: "danger",
  BURNOUT_SIGNAL: "danger",
  TEST_RISK: "info",
  SPRINT_END_RISK: "danger"
};

function claimsProgress(entry: StandupWithMember) {
  return /(progress|working|continue|implement|connect|fix|finish|build|debug|review|test|validate|ship|complete)/i.test(`${entry.yesterday} ${entry.today}`);
}

function uniqueTags(tags: SignalTag[]) {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = tag.type ?? tag.label;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function detectionTags(entry: StandupWithMember, member: MemberPulse | undefined, quality: number): SignalTag[] {
  const staleIssue = member?.tickets.find((ticket) => ticket.daysIdle >= 3 && ticket.status !== "Done");
  const blockedIssue = member?.tickets.find((ticket) => ticket.status === "Blocked");
  const activeIssues = member?.tickets.filter((ticket) => ticket.status !== "Done") ?? [];
  const flags = member?.flags ?? [];
  const tags: SignalTag[] = flags.map((flag) => ({
    label: flagLabels[flag.type],
    tone: flagTones[flag.type],
    type: flag.type
  }));

  if (quality < 55) {
    tags.push({ label: "Vague update", tone: "warning", type: "VAGUE_UPDATE" });
  } else if (quality < 75) {
    tags.push({ label: "Low specificity", tone: "warning", type: "LOW_SPECIFICITY" });
  }

  if (staleIssue) {
    tags.push({ label: "Stale work", tone: "warning", type: "STALE_WORK" });
  }

  if ((blockedIssue || staleIssue || activeIssues.length > 0) && claimsProgress(entry) && !member?.git.commitsThisSprint) {
    tags.push({ label: "Say-do gap", tone: "danger", type: "SAY_DO_GAP" });
  }

  if (hasOpenBlocker(entry.blockers)) {
    tags.push({ label: "Blocker anomaly", tone: "danger", type: "BLOCKER_ANOMALY" });
  }

  return uniqueTags(tags);
}

function buildTags(entry: StandupWithMember, member: MemberPulse | undefined, quality: number) {
  const staleIssue = member?.tickets.find((ticket) => ticket.daysIdle >= 3 && ticket.status !== "Done");
  const blockedIssue = member?.tickets.find((ticket) => ticket.status === "Blocked");
  return uniqueTags([
    { label: entry.source, tone: "neutral", type: "SOURCE" },
    ...detectionTags(entry, member, quality),
    hasOpenBlocker(entry.blockers) ? { label: "Blocker", tone: "danger", type: "BLOCKER" } : { label: "No blocker", tone: "success", type: "BLOCKER" },
    blockedIssue ? { label: `${blockedIssue.key} blocked`, tone: "danger", type: "JIRA_LINKED" } : null,
    staleIssue && !blockedIssue ? { label: `${staleIssue.key} stale`, tone: "warning", type: "JIRA_LINKED" } : null,
    member?.git.commitsThisSprint ? { label: `${member.git.commitsThisSprint} commits`, tone: "ai", type: "GIT_PROOF" } : null
  ].filter(Boolean) as SignalTag[]);
}

function publishSignalRefresh(projectId?: string) {
  clearProjectCache(projectId);
  window.dispatchEvent(new CustomEvent("sprintpulse:signals-updated", { detail: { projectId } }));
}

function extractStoryRefs(text: string) {
  const refs = new Set<string>();
  const patterns = [
    /\b(?:US|USER STORY|STORY|BUG|DEFECT|TASK|PBI|PB|JIRA)[-\s#:]*\d{1,6}\b/gi,
    /\b[A-Z]{2,10}-\d{1,6}\b/g,
    /#\d{2,6}\b/g
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      refs.add(
        match[0]
          .toUpperCase()
          .replace(/^USER STORY/i, "US")
          .replace(/^STORY/i, "US")
          .replace(/^#/, "US-")
          .replace(/[:#\s]+/g, "-")
          .replace(/--+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  }

  return Array.from(refs);
}

function issueSignals(text: string, blockers: string): SignalTag[] {
  const combined = `${text} ${blockers}`;
  const signals: SignalTag[] = [];
  const hasBlocker = hasOpenBlocker(blockers) || /\b(blocked|blocker|blocked by|waiting on|dependency|depends on)\b/i.test(combined);

  if (hasBlocker) {
    signals.push({ label: "Blocker anomaly", tone: "danger", type: "BLOCKER_ANOMALY" });
  }
  if (/\b(waiting|dependency|depends|blocked by|need input|unclear|requirement|clarification)\b/i.test(combined)) {
    signals.push({ label: "Stale work", tone: "warning", type: "STALE_WORK" });
  }
  if (/\b(review|PR|pull request|approval|merge|code review)\b/i.test(combined)) {
    signals.push({ label: "Review pending", tone: "ai", type: "SAY_DO_GAP" });
  }
  if (/\b(QA|test|testing|validation|fixture|regression|defect)\b/i.test(combined)) {
    signals.push({ label: "Test risk", tone: "info", type: "TEST_RISK" });
  }
  if (/\b(same status|same update|same as yesterday|no change|still working|still on)\b/i.test(combined)) {
    signals.push({ label: "Copy-paste", tone: "warning", type: "COPY_PASTE" });
  }
  if (/\b(working on|progress|stuff|things|almost done|continue)\b/i.test(combined) && !extractStoryRefs(combined).length) {
    signals.push({ label: "Vague update", tone: "warning", type: "VAGUE_UPDATE" });
  }

  return uniqueTags(signals);
}

function statusForSignals(text: string, blockers: string, signals: SignalTag[]): TranscriptStorySignal["status"] {
  if (hasOpenBlocker(blockers) || signals.some((signal) => signal.type === "BLOCKER_ANOMALY" || signal.type === "STALE_WORK")) {
    return "blocked";
  }
  if (/\b(done|completed|merged|shipped|closed|resolved|deployed)\b/i.test(text)) {
    return "done";
  }
  if (/\b(review|PR|pull request|QA|testing|validation)\b/i.test(text)) {
    return "review";
  }
  return "progress";
}

function analyzeParsedTranscript(parsed: ParsedSpeakerUpdate[]) {
  const stories: TranscriptStorySignal[] = parsed.flatMap((entry, index) => {
    const text = `${entry.yesterday} ${entry.today}`;
    const refs = extractStoryRefs(`${text} ${entry.blockers}`);
    const storyIds = refs.length ? refs : [`UPDATE-${index + 1}`];

    return storyIds.map((storyId) => {
      const issues = issueSignals(text, entry.blockers);
      const status = statusForSignals(text, entry.blockers, issues);
      const specificity = Math.round(entry.confidence * 100);
      const confidence = clamp(
        specificity +
          (refs.length ? 6 : -8) +
          (status === "done" ? 8 : 0) -
          issues.length * 9 -
          (hasOpenBlocker(entry.blockers) ? 10 : 0),
        5,
        99
      );

      return {
        id: storyId,
        owner: entry.name,
        status,
        summary: compactText(entry.today || entry.yesterday, 150),
        issues,
        confidence,
        canFinish: confidence >= 70 && status !== "blocked"
      };
    });
  });

  const flags: TranscriptFlag[] = stories.flatMap((story) => {
    const rows: TranscriptFlag[] = [];
    if (story.status === "blocked") {
      rows.push({
        id: `${story.id}-blocked`,
        title: "Blocking signal",
        owner: story.owner,
        storyId: story.id,
        message: `${story.id} has a blocker/dependency signal in the transcript.`,
        tone: "danger",
        level: "High"
      });
    }
    if (story.issues.some((issue) => issue.type === "COPY_PASTE" || issue.type === "VAGUE_UPDATE")) {
      rows.push({
        id: `${story.id}-quality`,
        title: "Low update clarity",
        owner: story.owner,
        storyId: story.id,
        message: `${story.owner}'s update needs more concrete delivery proof.`,
        tone: "warning",
        level: "Medium"
      });
    }
    if (!story.canFinish) {
      rows.push({
        id: `${story.id}-finish`,
        title: "Finish confidence low",
        owner: story.owner,
        storyId: story.id,
        message: `${story.id} is below the confidence threshold for sprint finish.`,
        tone: "danger",
        level: story.confidence < 45 ? "Critical" : "High"
      });
    }
    return rows;
  });

  return {
    stories,
    flags,
    metrics: {
      stories: stories.length,
      redFlags: flags.filter((flag) => flag.tone === "danger").length,
      impediments: flags.filter((flag) => flag.tone === "warning" || flag.tone === "ai").length,
      averageConfidence: stories.length ? Math.round(stories.reduce((sum, story) => sum + story.confidence, 0) / stories.length) : 0
    }
  };
}

function StandupTextArea({
  value,
  onChange,
  placeholder,
  rows = 5,
  required = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <textarea
      className="w-full resize-y rounded-md border border-slate-200 bg-white/80 px-3 py-3 text-sm font-semibold leading-6 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-white dark:placeholder:text-slate-500"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      required={required}
    />
  );
}

export function StandupPage() {
  const { projectId } = useParams();
  const { persona } = useAuth();
  const { selectedSprintId } = useProject();
  const [mode, setMode] = useState<StandupMode>("transcript");
  const [yesterday, setYesterday] = useState("");
  const [today, setToday] = useState("");
  const [blockers, setBlockers] = useState("No blocker.");
  const [transcript, setTranscript] = useState("");
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [canSyncStandups, setCanSyncStandups] = useState(false);
  const [standupData, setStandupData] = useState<ProjectStandupsResponse | null>(null);
  const [dashboardData, setDashboardData] = useState<ProjectDashboardResponse | null>(null);
  const [parserResult, setParserResult] = useState<ParsedSpeakerUpdate[] | null>(null);
  const [dailyAnalysis, setDailyAnalysis] = useState<DailyStatusAnalysis | null>(null);
  const [durationLog, setDurationLog] = useState<Record<string, number>>({});
  const [durationDetectionNote, setDurationDetectionNote] = useState("Paste a transcript with timestamps to auto-detect call duration.");
  const [selectedTimelineDate, setSelectedTimelineDate] = useState("all");
  const [collapsedTimelineDates, setCollapsedTimelineDates] = useState<Record<string, boolean>>({});
  const [pageLoading, setPageLoading] = useState(Boolean(projectId));
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const durationStorageKey = projectId && standupData?.sprint.id ? `sprintpulse:standup-duration:${projectId}:${standupData.sprint.id}` : null;

  const loadStandups = () => {
    if (!persona || !projectId) {
      setCanSyncStandups(false);
      setPageLoading(false);
      return;
    }

    const cacheKey = projectCacheKey("standups", [projectId, persona.id, selectedSprintId]);
    const cached = readProjectCache<StandupCacheValue>(cacheKey);
    if (cached) {
      setStandupData(cached.standups);
      setDashboardData(cached.dashboard);
      setCanSyncStandups(cached.standups.canSync);
    }

    setPageLoading(!cached);
    Promise.all([
      api.getProjectStandups(projectId, persona.id, selectedSprintId ?? undefined),
      api.getProjectDashboard(projectId, persona.id, selectedSprintId ?? undefined).catch(() => null)
    ])
      .then(([response, dashboard]) => {
        writeProjectCache(cacheKey, { standups: response, dashboard });
        setStandupData(response);
        setDashboardData(dashboard);
        setCanSyncStandups(response.canSync);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setPageLoading(false));
  };

  useEffect(() => {
    loadStandups();
  }, [persona?.id, projectId, selectedSprintId]);

  useEffect(() => {
    setSelectedTimelineDate("all");
    setCollapsedTimelineDates({});
  }, [projectId, selectedSprintId]);

  useEffect(() => {
    if (!durationStorageKey || typeof window === "undefined") {
      setDurationLog({});
      return;
    }

    try {
      const parsed = JSON.parse(window.localStorage.getItem(durationStorageKey) ?? "{}") as Record<string, number>;
      const cleanLog = Object.fromEntries(Object.entries(parsed).filter(([, minutes]) => Number.isFinite(minutes) && minutes > 0));
      setDurationLog(cleanLog);
    } catch {
      setDurationLog({});
    }
  }, [durationStorageKey]);

  const switchMode = (nextMode: StandupMode) => {
    setMode(nextMode);
    setError(null);
    setResult(null);
    setSyncResult(null);
    setParserResult(null);
    setDailyAnalysis(null);
  };

  const recordDurationFromTranscript = (minutes: number) => {
    if (!durationStorageKey || typeof window === "undefined") {
      return;
    }

    const safeMinutes = clamp(minutes, 1, 180);
    const nextLog = { ...durationLog, [localDateKey()]: safeMinutes };
    setDurationLog(nextLog);
    window.localStorage.setItem(durationStorageKey, JSON.stringify(nextLog));
  };

  const submitManual = async (event: FormEvent) => {
    event.preventDefault();
    if (!persona) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const input = {
        personaId: persona.id,
        yesterday,
        today,
        blockers
      };
      if (projectId) {
        await api.submitProjectStandup(projectId, input);
        loadStandups();
        publishSignalRefresh(projectId);
      } else {
        await api.submitStandup(input);
      }
      const message = "Standup submitted. Your latest update is now part of the sprint pulse.";
      setResult(message);
      toast.success("Standup captured", { description: "The update is attached to the selected sprint." });
      setYesterday("");
      setToday("");
      setBlockers("No blocker.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Standup submission failed";
      setError(message);
      toast.error("Standup submission failed", { description: message });
    } finally {
      setLoading(false);
    }
  };

  const parseTranscript = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setParserResult(null);
    setDailyAnalysis(null);

    try {
      const response = projectId
        ? await api.parseProjectTranscript(projectId, transcript, persona?.id)
        : await api.parseTranscript(transcript);
      const detectedDuration = detectTranscriptDurationMinutes(transcript);
      setParserResult(response.parsed);
      setDailyAnalysis(response.analysis ?? null);
      if (detectedDuration) {
        recordDurationFromTranscript(detectedDuration);
        setDurationDetectionNote(`${detectedDuration} minutes detected from transcript timing.`);
      } else {
        setDurationDetectionNote("No duration or timestamp range found in this transcript.");
      }
      toast.success("Transcript parsed", {
        description: `${response.parsed.length} speaker update${response.parsed.length === 1 ? "" : "s"} detected.${
          detectedDuration ? ` ${detectedDuration}m duration captured.` : ""
        }`
      });
      if (projectId) {
        loadStandups();
        publishSignalRefresh(projectId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transcript parse failed";
      setError(message);
      toast.error("Transcript parse failed", { description: message });
    } finally {
      setLoading(false);
    }
  };

  const syncStandups = async () => {
    if (!persona || !projectId) {
      return;
    }

    setSyncLoading(true);
    setError(null);
    setSyncResult(null);

    try {
      const response = await api.syncProjectStandups(projectId, persona.id);
      const linkedSuccess = response.linkedSyncs?.filter((sync) => sync.status === "succeeded").map((sync) => sync.source).join(" + ");
      const linkedCopy = linkedSuccess ? ` Also refreshed ${linkedSuccess}.` : "";
      setSyncResult(`Synced ${response.importedStandups} standups at ${new Date(response.syncedAt).toLocaleTimeString()}.${linkedCopy}`);
      toast.success("Signals synced", { description: `${response.importedStandups} standup update${response.importedStandups === 1 ? "" : "s"} imported.${linkedCopy}` });
      loadStandups();
      publishSignalRefresh(projectId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Standup sync failed";
      setError(message);
      toast.error("Standup sync failed", { description: message });
    } finally {
      setSyncLoading(false);
    }
  };

  const loadUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadFileName(file.name);
    setError(null);

    try {
      setTranscript(await file.text());
    } catch {
      const message = "Unable to read this file. Use a Teams VTT, or a TXT/MD/CSV export.";
      setError(message);
      toast.error("Upload failed", { description: message });
    }
  };

  if (pageLoading) {
    return <WorkspaceLoading label="Loading standups" />;
  }

  const recentStandups = standupData?.standups ?? [];
  const latestStandup = recentStandups[0];
  const memberById = new Map((dashboardData?.memberPulses ?? []).map((member) => [member.personaId, member]));
  const signalRows = recentStandups.map((entry) => {
    const member = memberById.get(entry.memberId);
    const quality = standupQuality(entry);
    const detections = detectionTags(entry, member, quality);
    const hasBlocker = hasOpenBlocker(entry.blockers);
    const linkedIssue =
      member?.tickets.find((ticket) => ticket.status === "Blocked") ??
      member?.tickets.find((ticket) => ticket.daysIdle >= 3 && ticket.status !== "Done") ??
      member?.tickets[0];

    return {
      entry,
      member,
      quality,
      linkedIssue,
      detections,
      hasBlocker,
      flags: member?.flags.slice(0, 2) ?? [],
      tags: buildTags(entry, member, quality)
    };
  }).sort((left, right) => {
    if (left.hasBlocker !== right.hasBlocker) {
      return left.hasBlocker ? -1 : 1;
    }
    const leftSeverity = left.detections.some((tag) => tag.tone === "danger") ? 1 : 0;
    const rightSeverity = right.detections.some((tag) => tag.tone === "danger") ? 1 : 0;
    if (leftSeverity !== rightSeverity) {
      return rightSeverity - leftSeverity;
    }
    return new Date(right.entry.date).getTime() - new Date(left.entry.date).getTime();
  });
  const averageQuality = signalRows.length
    ? Math.round(signalRows.reduce((sum, row) => sum + row.quality, 0) / signalRows.length)
    : 0;
  const blockerCount = signalRows.filter((row) => hasOpenBlocker(row.entry.blockers)).length;
  const staleWorkCount = signalRows.filter((row) => row.detections.some((tag) => tag.type === "STALE_WORK")).length;
  const sayDoGapCount = signalRows.filter((row) => row.detections.some((tag) => tag.type === "SAY_DO_GAP")).length;
  const durationEntries = Object.entries(durationLog).sort(([leftDate], [rightDate]) => new Date(`${rightDate}T00:00:00`).getTime() - new Date(`${leftDate}T00:00:00`).getTime());
  const latestDurationEntry = durationEntries[0] ?? null;
  const latestDuration = latestDurationEntry?.[1] ?? null;
  const latestDurationTone: TagTone = latestDuration
    ? latestDuration > DEFAULT_STANDUP_DURATION_MINUTES
      ? "warning"
      : "success"
    : "neutral";
  const latestDurationDelta = latestDuration ? latestDuration - DEFAULT_STANDUP_DURATION_MINUTES : null;
  const groupedSignalRows = Array.from(
    signalRows.reduce<Map<string, typeof signalRows>>((groups, row) => {
      const date = row.entry.date || "Unknown date";
      const existing = groups.get(date) ?? [];
      groups.set(date, [...existing, row]);
      return groups;
    }, new Map())
  )
    .sort(([leftDate], [rightDate]) => new Date(`${rightDate}T00:00:00`).getTime() - new Date(`${leftDate}T00:00:00`).getTime())
    .map(([date, rows]) => ({
      date,
      rows,
      blockerCount: rows.filter((row) => row.hasBlocker).length,
      averageQuality: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.quality, 0) / rows.length) : 0,
      duration: durationLog[date] ?? null
    }));
  const activeTimelineDate =
    selectedTimelineDate === "all" || groupedSignalRows.some((group) => group.date === selectedTimelineDate) ? selectedTimelineDate : "all";
  const toggleTimelineDate = (date: string) => {
    setCollapsedTimelineDates((current) => ({ ...current, [date]: !current[date] }));
  };
  const transcriptAnalysis = parserResult ? analyzeParsedTranscript(parserResult) : null;
  const primarySignals = (tags: SignalTag[]) =>
    tags.filter((tag) => tag.type !== "SOURCE" && tag.type !== "BLOCKER" && tag.type !== "GIT_PROOF" && tag.type !== "JIRA_LINKED");
  const topBlockerRow = signalRows.find((row) => row.hasBlocker);
  const sprintStartTime = standupData?.sprint.startDate ? new Date(`${standupData.sprint.startDate}T00:00:00`).getTime() : null;
  const sprintEndTime = standupData?.sprint.endDate ? new Date(`${standupData.sprint.endDate}T23:59:59`).getTime() : null;
  const sprintTotalDays = sprintStartTime && sprintEndTime ? Math.max(1, Math.floor((sprintEndTime - sprintStartTime) / 86400000) + 1) : null;
  const fallbackDaysRemaining = sprintEndTime ? Math.max(0, Math.ceil((sprintEndTime - Date.now()) / 86400000)) : null;
  const daysRemaining = dailyAnalysis?.daysRemaining ?? fallbackDaysRemaining;
  const sprintElapsedDays =
    sprintStartTime && sprintEndTime
      ? Math.min(sprintTotalDays ?? 1, Math.max(0, Math.floor((Date.now() - sprintStartTime) / 86400000) + 1))
      : null;
  const sprintProgressPercent = sprintTotalDays && sprintElapsedDays !== null ? clamp((sprintElapsedDays / sprintTotalDays) * 100, 0, 100) : 0;
  const sprintFinishConfidence = dailyAnalysis?.summary.averageConfidence ?? null;
  const signalConfidence = sprintFinishConfidence ?? (averageQuality || null);
  const heroScore = signalConfidence ?? recentStandups.length;
  const heroScoreLabel = sprintFinishConfidence !== null ? "Sprint health" : averageQuality ? "Sprint signal health" : "Updates";
  const confidenceLabel = sprintFinishConfidence !== null ? "Sprint confidence" : "Update clarity";
  const analyzedRolloverCount = dailyAnalysis ? dailyAnalysis.stories.filter((story) => !story.canFinishInSprint).length : null;
  const pressureCount = Math.max(blockerCount, sayDoGapCount);
  const rolloverCount = analyzedRolloverCount ?? pressureCount;
  const rolloverLabel = analyzedRolloverCount !== null ? "Rollover risk" : "Slip signals";
  const rolloverDetail = analyzedRolloverCount !== null ? (rolloverCount ? "Stories may slip" : "No rollover risk") : "Blockers/gaps need proof";
  const transferSuggestions = (dailyAnalysis?.stories ?? [])
    .filter((story) => story.transferSuggestion?.shouldTransfer)
    .slice(0, 2);
  const availableMembers = (dashboardData?.memberPulses ?? [])
    .filter((member) => member.healthScore >= 74 && member.riskLevel !== "critical" && !member.flags.some((flag) => flag.severity === "critical"))
    .slice(0, 3);
  const blockedTickets = Array.from(
    new Map(
      signalRows
        .flatMap((row) => (row.linkedIssue?.status === "Blocked" ? [row.linkedIssue] : []))
        .map((ticket) => [ticket.key, ticket])
    ).values()
  ).slice(0, 4);
  const staleTickets = Array.from(
    new Map(
      signalRows
        .flatMap((row) => (row.linkedIssue && row.linkedIssue.daysIdle >= 3 && row.linkedIssue.status !== "Done" ? [row.linkedIssue] : []))
        .map((ticket) => [ticket.key, ticket])
    ).values()
  ).slice(0, 4);
  const timelineGroupsToRender =
    activeTimelineDate === "all" ? groupedSignalRows.slice(0, 3) : groupedSignalRows.filter((group) => group.date === activeTimelineDate);
  const confidenceTone: TagTone = signalConfidence !== null && signalConfidence < 55 ? "danger" : signalConfidence !== null && signalConfidence < 75 ? "warning" : "success";
  const sprintTimingDetail = sprintTotalDays ? `${sprintTotalDays}d sprint window` : "Sprint dates unavailable";
  const standupTimeValue = latestDuration ? `${latestDuration}m` : `${DEFAULT_STANDUP_DURATION_MINUTES}m`;
  const standupTimeDetail = latestDuration
    ? latestDuration > DEFAULT_STANDUP_DURATION_MINUTES
      ? `${latestDurationDelta}m over target`
      : "Inside target"
    : "waiting for timestamps";
  const quickStats: Array<{ label: string; value: string | number; detail: string; icon: typeof AlertTriangle; tone: TagTone; drilldown: string[] }> = [
    {
      label: "Standup time",
      value: standupTimeValue,
      detail: standupTimeDetail,
      icon: Clock3,
      tone: latestDuration ? latestDurationTone : "neutral" as const,
      drilldown: [
        latestDuration ? `Detected from transcript: ${latestDuration} minutes` : "No transcript timestamp detected yet",
        `Expected daily standup: ${DEFAULT_STANDUP_DURATION_MINUTES} minutes`,
        sprintTimingDetail
      ]
    },
    {
      label: "Blockers",
      value: blockerCount,
      detail: topBlockerRow ? `${topBlockerRow.entry.memberName} needs help` : "No open blocker",
      icon: AlertTriangle,
      tone: blockerCount ? "danger" as const : "success" as const,
      drilldown: blockedTickets.length
        ? blockedTickets.map((ticket) => `${ticket.key}: ${ticket.status}`)
        : topBlockerRow
          ? [`${topBlockerRow.entry.memberName}: ${compactText(topBlockerRow.entry.blockers, 80)}`]
          : ["No open blockers in selected sprint"]
    },
    {
      label: confidenceLabel,
      value: signalConfidence !== null ? `${signalConfidence}%` : "--",
      detail: sprintFinishConfidence !== null ? "finish confidence" : "standup specificity",
      icon: BarChart3,
      tone: confidenceTone,
      drilldown: [
        `${dailyAnalysis?.summary.storyCount ?? signalRows.length} tracked update${(dailyAnalysis?.summary.storyCount ?? signalRows.length) === 1 ? "" : "s"}`,
        `${rolloverCount} rollover risk${rolloverCount === 1 ? "" : "s"}`,
        `${sayDoGapCount} say-do gap${sayDoGapCount === 1 ? "" : "s"}`
      ]
    },
    {
      label: rolloverLabel,
      value: rolloverCount,
      detail: rolloverDetail,
      icon: TicketCheck,
      tone: rolloverCount ? "warning" as const : "success" as const,
      drilldown: staleTickets.length
        ? staleTickets.map((ticket) => `${ticket.key}: ${ticket.daysIdle}d idle`)
        : dailyAnalysis?.stories.filter((story) => !story.canFinishInSprint).slice(0, 3).map((story) => `${story.storyKey}: ${story.confidenceScore}%`) ?? ["No rollover signal"]
    },
    {
      label: "People available",
      value: availableMembers.length,
      detail: availableMembers.length ? availableMembers.map((member) => member.name.split(" ")[0]).join(", ") : "No spare owner",
      icon: Sparkles,
      tone: availableMembers.length ? "info" as const : "neutral" as const,
      drilldown: availableMembers.length
        ? availableMembers.map((member) => `${member.name}: ${member.healthScore} health`)
        : ["No low-risk teammate found for handoff"]
    }
  ];
  const sprintActionCards = (
    <article className="mb-4 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
      <div className="grid gap-3 xl:grid-cols-2">
        <section
          className={cn(
            "rounded-2xl border p-3",
            blockedTickets.length
              ? "border-danger-500/25 bg-danger-500/10 text-danger-700 dark:text-danger-100"
              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100"
          )}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <span className="inline-flex min-w-0 items-center gap-2">
              <TicketCheck className="h-4 w-4 shrink-0" />
              <strong className="truncate text-xs uppercase tracking-[0.14em]">{blockedTickets.length ? "Blocked Jira work" : "No blocked Jira work"}</strong>
            </span>
            <StatusPill tone={blockedTickets.length ? "danger" : "success"}>{blockedTickets.length}</StatusPill>
          </div>
          <div className="mt-3 grid gap-2">
            {blockedTickets.length ? (
              blockedTickets.map((ticket) => (
                <span className="grid min-h-[58px] grid-cols-[76px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-danger-500/20 bg-white px-3 py-2 text-sm font-bold dark:bg-slate-950/70" key={ticket.key}>
                  <span className="font-mono text-xs uppercase leading-4 tracking-[0.1em]">
                    {ticket.key}
                    <br />
                    {ticket.daysIdle}d idle
                  </span>
                  <span className="min-w-0 leading-5 opacity-90">{compactText(ticket.title, 76)}</span>
                </span>
              ))
            ) : (
              <span className="rounded-xl border border-emerald-500/20 bg-white px-3 py-2 text-sm font-bold dark:bg-slate-950/70">
                No blocker signal is mapped to Jira for the selected sprint.
              </span>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-ai-500/25 bg-ai-500/10 p-3 text-ai-700 dark:text-ai-100">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              <strong className="truncate text-xs uppercase tracking-[0.14em]">Best handoff candidate</strong>
            </span>
            <StatusPill tone={transferSuggestions.length ? "ai" : availableMembers.length ? "info" : "neutral"}>
              {transferSuggestions.length || availableMembers.length || 0}
            </StatusPill>
          </div>
          <div className="mt-3 grid gap-2">
            {transferSuggestions.length ? (
              transferSuggestions.map((story) => (
                <span className="grid min-h-[58px] grid-cols-[76px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-ai-500/20 bg-white px-3 py-2 text-sm font-bold dark:bg-slate-950/70" key={`${story.storyKey}-${story.ownerId ?? "owner"}`}>
                  <span className="font-mono text-xs uppercase leading-4 tracking-[0.1em]">{story.storyKey}</span>
                  <span className="min-w-0 leading-5">
                    {story.transferSuggestion?.toMemberName ?? story.transferSuggestion?.toRole ?? "Available teammate"}
                    <small className="mt-0.5 block leading-5 opacity-80">{compactText(story.transferSuggestion?.reason ?? "Can absorb follow-up.", 86)}</small>
                  </span>
                </span>
              ))
            ) : availableMembers.length ? (
              availableMembers.map((member) => (
                <span className="grid min-h-[58px] grid-cols-[76px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-ai-500/20 bg-white px-3 py-2 text-sm font-bold dark:bg-slate-950/70" key={member.id}>
                  <span className="font-mono text-xs uppercase leading-4 tracking-[0.1em]">{member.healthScore} health</span>
                  <span className="min-w-0 leading-5">
                    {member.name}
                    <small className="mt-0.5 block leading-5 opacity-80">Can absorb follow-up</small>
                  </span>
                </span>
              ))
            ) : (
              <span className="rounded-xl border border-ai-500/20 bg-white px-3 py-2 text-sm font-bold dark:bg-slate-950/70">
                No low-risk teammate detected for reassignment.
              </span>
            )}
          </div>
        </section>
      </div>
    </article>
  );
  return (
    <div className={workspacePageClass}>
      <WorkspaceHero
        eyebrow={
          <>
            <StatusPill icon={ClipboardCheck} tone="primary">
              {projectId ? "Project standups" : "Standups"}
            </StatusPill>
          </>
        }
        title="Standup room"
        description="Spot hidden blockers before they become sprint spillover."
        score={heroScore}
        scoreLabel={heroScoreLabel}
        scoreTone={signalConfidence !== null && signalConfidence < 60 ? "danger" : signalConfidence !== null && signalConfidence < 75 ? "warning" : "info"}
        scoreDetail={
          latestStandup ? (
            <span>
              {blockerCount
                ? <span><strong className="text-slate-950 dark:text-white">{blockerCount}</strong> blocker signal{blockerCount === 1 ? "" : "s"} in this sprint.</span>
                : <span>Latest update from <strong className="text-slate-950 dark:text-white">{latestStandup.memberName}</strong>. No blocker is open in the selected sprint.</span>}
            </span>
          ) : (
            "No standups yet."
          )
        }
        action={
          projectId && canSyncStandups ? (
            <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 disabled:pointer-events-none disabled:opacity-60" type="button" onClick={syncStandups} disabled={syncLoading}>
              {syncLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync
            </button>
          ) : null
        }
      >
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
          {quickStats.map(({ label, value, detail, icon: Icon, tone, drilldown }) => (
            <button
              className={cn(
                "group relative isolate rounded-2xl border px-3.5 py-3 text-left shadow-sm backdrop-blur transition hover:z-[900] hover:-translate-y-0.5 focus-visible:z-[900] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                tone === "danger"
                  ? "border-danger-500/30 bg-danger-500/10"
                  : tone === "warning"
                    ? "border-warning-500/30 bg-warning-500/10"
                    : tone === "success"
                      ? "border-emerald-500/25 bg-emerald-500/10"
                      : "border-slate-200 bg-white/60 dark:border-white/10 dark:bg-white/[0.045]"
              )}
              key={label}
              type="button"
              aria-label={`${label}: ${value}. ${detail}. ${drilldown.join(". ")}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={cn("grid h-8 w-8 place-items-center rounded-xl border", tagToneClass(tone))}>
                  <Icon className="h-4 w-4" />
                </span>
                <strong className="font-mono text-xl font-black text-slate-950 dark:text-white">{value}</strong>
              </div>
              <span className="mt-2 block text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</span>
              <small className="mt-0.5 block truncate font-bold text-slate-600 dark:text-slate-300">{detail}</small>
              <div className="pointer-events-none absolute left-1/2 top-[calc(100%+0.65rem)] z-[1200] hidden w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-[0_24px_80px_rgba(15,23,42,0.24)] group-focus:block group-hover:block dark:border-white/10 dark:bg-slate-950">
                <span className="absolute bottom-full left-1/2 h-3 w-3 -translate-x-1/2 translate-y-1/2 rotate-45 border-l border-t border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950" />
                <strong className="block text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label} details</strong>
                <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto pr-1">
                  {drilldown.map((item) => (
                    <span className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs font-bold leading-5 text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200" key={`${label}-${item}`}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </WorkspaceHero>

      <section className="relative z-0 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <SectionPanel className="!h-auto">
          <PanelHeader
            eyebrow="Capture"
            title={mode === "manual" ? "Add one update" : "Analyze transcript"}
            description={modeCopy[mode]}
            action={
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/[0.055]">
                {(["transcript", "upload", "manual"] as StandupMode[]).map((item) => (
                  <button
                    className={cn(
                      "inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-black capitalize transition",
                      mode === item ? "bg-white text-primary-700 shadow-sm dark:bg-white/10 dark:text-primary-100" : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                    )}
                    key={item}
                    type="button"
                    onClick={() => switchMode(item)}
                  >
                    {item === "manual" ? <ClipboardCheck className="h-4 w-4" /> : item === "transcript" ? <Sparkles className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
                    {item}
                  </button>
                ))}
              </div>
            }
          />

          {mode === "manual" ? (
            <form className="grid gap-4" onSubmit={submitManual}>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Yesterday</span>
                <StandupTextArea value={yesterday} onChange={setYesterday} placeholder="Finished API contracts and routed dashboard data." required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Today</span>
                <StandupTextArea value={today} onChange={setToday} placeholder="Connecting standup submission to the sprint pulse." required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Blockers</span>
                <StandupTextArea value={blockers} onChange={setBlockers} placeholder="No blocker." rows={3} />
              </label>
              <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-6 text-sm font-black text-white shadow-[0_16px_40px_rgba(16,169,154,0.24)] transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60" type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit update
              </button>
            </form>
          ) : (
            <form className="grid gap-4" onSubmit={parseTranscript}>
              {mode === "upload" ? (
                <label className="grid min-h-36 cursor-pointer place-items-center rounded-2xl border border-dashed border-primary-500/35 bg-primary-500/10 p-6 text-center text-primary-700 transition hover:bg-primary-500/15 dark:text-primary-100">
                  <UploadCloud className="h-7 w-7" />
                  <strong className="mt-3 text-sm font-black">{uploadFileName ?? "Upload standup export"}</strong>
                  <small className="mt-1 text-sm text-slate-500 dark:text-slate-400">Teams VTT, TXT, MD, or CSV</small>
                  <Input className="sr-only" type="file" accept=".vtt,.txt,.md,.csv,text/vtt,text/plain,text/markdown,text/csv" onChange={loadUpload} />
                </label>
              ) : null}
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{mode === "upload" ? "Imported text" : "Paste standup transcript"}</span>
                <StandupTextArea value={transcript} onChange={setTranscript} placeholder="Atharv: Yesterday I worked on dashboard cards. Today I am connecting the API. No blockers." rows={8} required />
              </label>
              <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-6 text-sm font-black text-white shadow-[0_16px_40px_rgba(16,169,154,0.24)] transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60" type="submit" disabled={loading || !transcript.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {mode === "upload" ? "Parse upload" : "Parse transcript"}
              </button>
            </form>
          )}

          {error ? <div className="mt-4 rounded-xl border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm font-semibold text-danger-700 dark:text-danger-100">{error}</div> : null}
          {result ? <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-100">{result}</div> : null}
          {syncResult ? <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-100">{syncResult}</div> : null}
        </SectionPanel>

        <SectionPanel className="!h-auto">
          <PanelHeader
            eyebrow="Spillover prevention"
            title="Sprint finish window"
            description="Sprint calendar pressure for the selected sprint."
            icon={BarChart3}
            tone="ai"
          />

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="block text-[0.7rem] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Sprint left</span>
                <strong className="mt-1 block font-mono text-5xl font-black leading-none text-slate-950 dark:text-white">{daysRemaining ?? "-"}</strong>
                <span className="mt-1 block text-sm font-black text-slate-500 dark:text-slate-300">days remaining</span>
              </div>
              <StatusPill tone={daysRemaining !== null && daysRemaining !== undefined && daysRemaining <= 2 ? "warning" : "neutral"}>
                {sprintElapsedDays ?? "-"} / {sprintTotalDays ?? "-"} days used
              </StatusPill>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
              <span className="block h-full rounded-full bg-gradient-to-r from-primary-500 via-info-500 to-ai-500" style={{ width: `${sprintProgressPercent}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              <span>{standupData?.sprint.startDate ?? "Start"}</span>
              <span>{standupData?.sprint.endDate ?? "End"}</span>
            </div>
          </div>
        </SectionPanel>
      </section>

      {parserResult ? (
        <SectionPanel>
          <PanelHeader
            eyebrow="Analysis"
            title="Transcript readout"
            description="Turns the standup into evidence: what may slip, why it may slip, and who can help before sprint close."
            icon={Sparkles}
            tone="ai"
          />
          {sprintActionCards}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  [`${dailyAnalysis?.summary.averageConfidence ?? transcriptAnalysis?.metrics.averageConfidence ?? 0}%`, "Finish confidence"],
                  [dailyAnalysis ? `${dailyAnalysis.daysRemaining}d` : daysRemaining ?? "-", "Sprint left"],
                  [dailyAnalysis?.summary.redFlagCount ?? transcriptAnalysis?.metrics.redFlags ?? 0, "Red flags"],
                  [dailyAnalysis?.summary.transferSuggestionCount ?? 0, "Handoffs"]
                ].map(([value, label]) => (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/75" key={label}>
                    <strong className="block text-2xl font-black text-slate-950 dark:text-white">{value}</strong>
                    <span className="mt-1 block text-[0.68rem] font-black uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400">{label}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/75">
                <div className="flex items-start justify-between gap-3">
                  <span>
                    <strong className="block text-sm font-black text-slate-950 dark:text-white">Story finish confidence</strong>
                    <small className="mt-1 block text-sm font-semibold text-slate-500 dark:text-slate-400">Lower bars are the work most likely to spill over.</small>
                  </span>
                  <StatusPill tone={dailyAnalysis?.summary.canCompleteSprint ? "success" : dailyAnalysis ? "warning" : "neutral"}>
                    {dailyAnalysis?.summary.canCompleteSprint ? "On track" : dailyAnalysis ? "Needs action" : "Parsed"}
                  </StatusPill>
                </div>
                <div className="mt-4 grid gap-2">
                  {dailyAnalysis
                    ? dailyAnalysis.stories.slice(0, 4).map((story) => (
                        <article
                          className={cn(
                            "rounded-2xl border p-3",
                            story.confidenceScore < 50
                              ? "border-danger-500/30 bg-danger-500/10"
                              : story.confidenceScore < 75
                                ? "border-warning-500/30 bg-warning-500/10"
                                : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.045]"
                          )}
                          key={`${story.storyKey}-${story.ownerId ?? "owner"}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="min-w-0">
                              <strong className="block truncate text-sm font-black text-slate-950 dark:text-white">{story.storyKey}</strong>
                              <small className="block truncate text-slate-500 dark:text-slate-400">{story.ownerName ?? story.title}</small>
                            </span>
                            <StatusPill tone={story.canFinishInSprint ? "success" : story.confidenceScore < 50 ? "danger" : "warning"}>
                              {story.confidenceScore}% {story.canFinishInSprint ? "finish" : "risk"}
                            </StatusPill>
                          </div>
                          <span className="mt-3 block h-2.5 overflow-hidden rounded-full bg-slate-950/10 dark:bg-white/10">
                            <span
                              className={cn(
                                "block h-full rounded-full bg-gradient-to-r",
                                story.confidenceScore < 50 ? "from-danger-500 to-warning-400" : story.confidenceScore < 75 ? "from-warning-500 to-amber-300" : "from-emerald-500 to-primary-400"
                              )}
                              style={{ width: `${story.confidenceScore}%` }}
                            />
                          </span>
                          <p className="m-0 mt-2 text-sm font-semibold leading-5 text-slate-600 dark:text-slate-300">{compactText(story.reason, 160)}</p>
                        </article>
                      ))
                    : transcriptAnalysis?.stories.slice(0, 4).map((story) => (
                        <article className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.045]" key={story.id}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <strong className="text-sm font-black text-slate-950 dark:text-white">{story.id}</strong>
                            <StatusPill tone={story.canFinish ? "success" : "warning"}>{story.confidence}% confidence</StatusPill>
                          </div>
                          <p className="m-0 mt-2 text-sm font-semibold leading-5 text-slate-600 dark:text-slate-300">{story.summary}</p>
                        </article>
                      ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]">
                <strong className="block text-sm font-black text-slate-950 dark:text-white">Top issues</strong>
                <div className="mt-4 grid gap-2">
                  {dailyAnalysis?.risks.length ? (
                    dailyAnalysis.risks.slice(0, 3).map((risk) => (
                      <article
                        className={cn(
                          "rounded-xl border p-3",
                          risk.severity === "red-flag"
                            ? "border-danger-500/35 bg-danger-500/10 text-danger-700 dark:text-danger-100"
                            : risk.severity === "impediment"
                              ? "border-warning-500/35 bg-warning-500/10 text-warning-700 dark:text-warning-100"
                              : "border-info-500/25 bg-info-500/10 text-info-700 dark:text-info-100"
                        )}
                        key={risk.id}
                      >
                        <strong className="text-sm font-black">{risk.title}</strong>
                        <p className="m-0 mt-1 text-sm font-semibold leading-5">{compactText(risk.message, 150)}</p>
                      </article>
                    ))
                  ) : transcriptAnalysis?.flags.length ? (
                    transcriptAnalysis.flags.slice(0, 3).map((flag) => (
                      <article className={cn("rounded-xl border p-3", tagToneClass(flag.tone))} key={flag.id}>
                        <strong className="text-sm font-black">{flag.title}</strong>
                        <p className="m-0 mt-1 text-sm font-semibold leading-5">{flag.message}</p>
                      </article>
                    ))
                  ) : (
                    <p className="m-0 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-700 dark:text-emerald-100">
                      No blocker or rollover issue found in this transcript.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]">
                <strong className="block text-sm font-black text-slate-950 dark:text-white">Updates extracted</strong>
                <div className="mt-4 grid gap-2">
                  {parserResult.slice(0, 5).map((entry) => (
                    <article className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.045]" key={`${entry.memberId}-${entry.name}-${entry.confidence}`}>
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <MemberAvatar initials={initialsFromName(entry.name)} seed={entry.name} size="sm" />
                          <strong className="truncate text-sm font-black text-slate-950 dark:text-white">{entry.name}</strong>
                        </span>
                        <StatusPill tone={hasOpenBlocker(entry.blockers) ? "danger" : "success"}>
                          {hasOpenBlocker(entry.blockers) ? "Blocker" : "Clear"}
                        </StatusPill>
                      </div>
                      <p className="m-0 mt-2 text-sm font-semibold leading-5 text-slate-600 dark:text-slate-300">{compactText(updateSummary(entry), 155)}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SectionPanel>
      ) : null}

      {standupData ? (
        <SectionPanel className="p-0">
          <div className="border-b border-slate-200/80 p-5 dark:border-white/10">
            <PanelHeader
              eyebrow="Timeline"
              title="Standup history"
              description="Pick a day, expand the summary, and read only the useful updates, blockers, and proof."
              icon={History}
              action={
                groupedSignalRows.length ? (
                  <label className="grid gap-1">
                    <span className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Jump to</span>
                    <select
                      className="min-h-10 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-black text-slate-700 outline-none transition focus:ring-2 focus:ring-primary-500 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-100"
                      value={activeTimelineDate}
                      onChange={(event) => {
                        const nextDate = event.target.value;
                        setSelectedTimelineDate(nextDate);
                        if (nextDate !== "all") {
                          setCollapsedTimelineDates((current) => ({ ...current, [nextDate]: false }));
                        }
                      }}
                    >
                      <option value="all">Latest 3 days</option>
                      {groupedSignalRows.map((group) => {
                        const dateMeta = timelineDateMeta(group.date);
                        return (
                          <option key={group.date} value={group.date}>
                            {dateMeta.full} · {group.rows.length} update{group.rows.length === 1 ? "" : "s"}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                ) : null
              }
            />
            {groupedSignalRows.length ? (
              <div className="grid gap-3 rounded-3xl border border-slate-200/80 bg-slate-50/70 p-2 dark:border-white/10 dark:bg-white/[0.035] md:grid-cols-4">
                <button
                  className={cn(
                    "grid min-h-[84px] gap-2 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5",
                    activeTimelineDate === "all"
                      ? "border-primary-500/35 bg-primary-500/15 text-primary-700 dark:text-primary-100"
                      : "border-slate-200 bg-white/70 text-slate-500 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-400 dark:hover:text-white"
                  )}
                  type="button"
                  onClick={() => {
                    setSelectedTimelineDate("all");
                    setCollapsedTimelineDates({});
                  }}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl border border-primary-500/25 bg-primary-500/10">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <span className="rounded-full bg-slate-950/10 px-2 py-0.5 text-xs font-black dark:bg-white/10">
                      {groupedSignalRows.slice(0, 3).reduce((sum, group) => sum + group.rows.length, 0)}
                    </span>
                  </span>
                  <span>
                    <strong className="block text-sm font-black">Latest 3 days</strong>
                    <small className="mt-0.5 block text-xs font-bold opacity-80">Default view</small>
                  </span>
                </button>
                {groupedSignalRows.slice(0, 3).map((group) => {
                  const dateMeta = timelineDateMeta(group.date);
                  return (
                    <button
                      className={cn(
                        "grid min-h-[84px] gap-2 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5",
                        activeTimelineDate === group.date
                          ? "border-info-500/35 bg-info-500/15 text-info-700 dark:text-info-100"
                          : "border-slate-200 bg-white/70 text-slate-500 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-400 dark:hover:text-white"
                      )}
                      type="button"
                      key={group.date}
                      onClick={() => {
                        setSelectedTimelineDate(group.date);
                        setCollapsedTimelineDates((current) => ({ ...current, [group.date]: false }));
                      }}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-xl border border-current/20 bg-white/60 text-center dark:bg-white/10">
                          <strong className="font-mono text-lg leading-none">{dateMeta.day}</strong>
                          <small className="text-[0.58rem] font-black uppercase leading-none">{dateMeta.month}</small>
                        </span>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-black", group.blockerCount ? "bg-danger-500/10 text-danger-700 dark:text-danger-100" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-100")}>
                          {group.blockerCount ? `${group.blockerCount} blocker${group.blockerCount === 1 ? "" : "s"}` : "Clear"}
                        </span>
                      </span>
                      <span>
                        <strong className="block text-sm font-black">{dateMeta.relative}</strong>
                        <small className="mt-0.5 block text-xs font-bold opacity-80">
                          {group.rows.length} update{group.rows.length === 1 ? "" : "s"} · {group.averageQuality || "-"}% clarity
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="grid gap-6 p-5">
            {groupedSignalRows.length ? (
              timelineGroupsToRender.map((group) => {
                const isCollapsed = collapsedTimelineDates[group.date] ?? (activeTimelineDate === "all" ? group.date !== timelineGroupsToRender[0]?.date : false);
                const dateMeta = timelineDateMeta(group.date);
                const blockerTone = group.blockerCount ? "danger" : "success";
                const clarityTone = group.averageQuality < 60 ? "danger" : group.averageQuality < 75 ? "warning" : "success";
                const durationTone = group.duration && group.duration > DEFAULT_STANDUP_DURATION_MINUTES ? "warning" : "neutral";

                return (
                <section className="grid gap-3" key={group.date}>
                  <button
                    className={cn(
                      "grid w-full gap-4 rounded-3xl border px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg md:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1fr)_auto_auto]",
                      isCollapsed
                        ? "border-slate-200/80 bg-slate-50/80 hover:border-primary-500/30 hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.065]"
                        : "border-primary-500/25 bg-gradient-to-r from-primary-500/10 via-white/80 to-info-500/10 dark:from-primary-500/12 dark:via-white/[0.055] dark:to-info-500/10"
                    )}
                    type="button"
                    onClick={() => toggleTimelineDate(group.date)}
                  >
                    <span className="grid h-16 w-16 place-items-center rounded-2xl border border-primary-500/25 bg-white/80 text-center text-primary-700 shadow-sm dark:bg-white/10 dark:text-primary-100">
                      <span>
                        <strong className="block font-mono text-2xl leading-none">{dateMeta.day}</strong>
                        <small className="block text-[0.62rem] font-black uppercase tracking-[0.16em]">{dateMeta.month}</small>
                      </span>
                    </span>

                    <div className="min-w-0 self-center">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-xl font-black text-slate-950 dark:text-white">{dateMeta.relative}</strong>
                        <StatusPill tone={isCollapsed ? "neutral" : "primary"}>
                          {isCollapsed ? "Show updates" : "Showing updates"}
                        </StatusPill>
                      </div>
                      <p className="m-0 mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                        {dateMeta.full} · {group.rows.length} update{group.rows.length === 1 ? "" : "s"} captured
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 self-center sm:grid-cols-4 xl:min-w-[520px]">
                      <span className="rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.045]">
                        <small className="block text-[0.64rem] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Updates</small>
                        <strong className="text-lg font-black text-slate-950 dark:text-white">{group.rows.length}</strong>
                      </span>
                      <span className={cn("rounded-2xl border px-3 py-2", tagToneClass(blockerTone))}>
                        <small className="block text-[0.64rem] font-black uppercase tracking-[0.14em] opacity-80">Blockers</small>
                        <strong className="text-lg font-black">{group.blockerCount || "Clear"}</strong>
                      </span>
                      <span className={cn("rounded-2xl border px-3 py-2", tagToneClass(clarityTone))}>
                        <small className="block text-[0.64rem] font-black uppercase tracking-[0.14em] opacity-80">Clarity</small>
                        <strong className="text-lg font-black">{group.averageQuality || "-"}%</strong>
                      </span>
                      <span className={cn("rounded-2xl border px-3 py-2", tagToneClass(durationTone))}>
                        <small className="block text-[0.64rem] font-black uppercase tracking-[0.14em] opacity-80">Duration</small>
                        <strong className="text-lg font-black">{group.duration ? `${group.duration}m` : "Not detected"}</strong>
                      </span>
                    </div>

                    <span className="grid h-11 w-11 place-items-center self-center justify-self-end rounded-2xl border border-primary-500/25 bg-primary-500/10 text-primary-700 dark:text-primary-100">
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </button>

                  {!isCollapsed ? (
                  <div className="grid gap-3">
                    {group.rows.map(({ entry, member, quality, linkedIssue, tags, hasBlocker }) => {
                      const visibleSignals = primarySignals(tags);
                      const updates = standupUpdateParts(entry);
                      const hasGitProof = Boolean(member?.git.commitsThisSprint);
                      const updateRows = [
                        { label: "Today", value: updates.today || updateSummary(entry), tone: "primary" as const },
                        { label: "Yesterday", value: updates.yesterday, tone: "neutral" as const },
                        { label: "Blocker", value: updates.blocker, tone: "danger" as const }
                      ].filter((row) => row.value);

                      return (
                        <article
                          className={cn(
                            "group relative grid overflow-hidden gap-4 rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 lg:grid-cols-[210px_minmax(0,1fr)_230px]",
                            hasBlocker
                              ? "border-danger-500/40 bg-gradient-to-r from-danger-500/12 via-danger-500/7 to-slate-50/90 shadow-[0_14px_40px_rgba(242,82,82,0.10)] dark:from-danger-500/18 dark:via-danger-500/9 dark:to-white/[0.045]"
                              : "border-slate-200/80 bg-slate-50/80 hover:border-primary-500/30 hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:hover:bg-white/[0.065]"
                          )}
                          key={entry.id}
                        >
                          <span
                            className={cn(
                              "absolute left-0 top-0 h-full w-1 rounded-l-2xl",
                              hasBlocker ? "bg-danger-500" : quality < 75 ? "bg-warning-500" : "bg-emerald-500"
                            )}
                          />
                          <div className="flex min-w-0 items-center gap-3">
                            <MemberAvatar initials={entry.memberInitials} seed={entry.memberName} />
                            <span className="min-w-0">
                              <strong className="block truncate text-sm font-black text-slate-950 dark:text-white">{entry.memberName}</strong>
                              <small className="text-slate-500 dark:text-slate-400">{entry.source}</small>
                              <span className="mt-2 flex flex-wrap gap-2">
                                <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-black", tagToneClass(hasBlocker ? "danger" : quality < 75 ? "warning" : "success"))}>
                                  {quality}% clarity
                                </span>
                                {hasBlocker ? (
                                  <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-black", tagToneClass("danger"))}>Blocker first</span>
                                ) : null}
                              </span>
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap gap-2">
                              {visibleSignals.slice(0, 2).map((tag) => (
                                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-black capitalize", tagToneClass(tag.tone))} key={`${entry.id}-${tag.label}`}>
                                  {tag.label}
                                </span>
                              ))}
                              {!visibleSignals.length ? (
                                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-black", tagToneClass("success"))}>No stale signal</span>
                              ) : null}
                            </div>
                            <div className="mt-3 grid gap-2">
                              {updateRows.length ? (
                                updateRows.map((row) => (
                                  <div
                                    className={cn(
                                      "rounded-xl border px-3 py-2",
                                      row.tone === "danger"
                                        ? "border-danger-500/25 bg-danger-500/10"
                                        : row.tone === "primary"
                                          ? "border-primary-500/20 bg-primary-500/10"
                                          : "border-slate-200/80 bg-white/60 dark:border-white/10 dark:bg-white/[0.035]"
                                    )}
                                    key={`${entry.id}-${row.label}`}
                                  >
                                    <span className={cn("mb-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]", tagToneClass(row.tone))}>
                                      {row.label}
                                    </span>
                                    <p className="m-0 text-[0.95rem] font-semibold leading-6 text-slate-800 dark:text-slate-100">
                                      {row.value}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <p className="m-0 rounded-xl border border-warning-500/25 bg-warning-500/10 px-3 py-2 text-sm font-bold text-warning-700 dark:text-warning-100">
                                  Update text is missing. Re-parse the transcript with speaker lines or enter a manual update.
                                </p>
                              )}
                            </div>
                          </div>

                          {linkedIssue || hasGitProof ? (
                          <div className="grid content-center gap-3 self-center text-sm">
                            {linkedIssue ? (
                            <span className="grid min-w-0 gap-1 rounded-2xl border border-info-500/20 bg-info-500/10 px-3 py-2.5 text-info-700 dark:text-info-100">
                              <span className="inline-flex min-w-0 items-center gap-2">
                                <TicketCheck className="h-4 w-4 shrink-0" />
                                <span className="text-[0.66rem] font-black uppercase tracking-[0.14em]">Jira</span>
                              </span>
                              <strong className="font-mono text-sm text-slate-950 dark:text-white">{linkedIssue.key}</strong>
                              <small className="font-bold opacity-80">{linkedIssue.status} · {linkedIssue.daysIdle}d idle</small>
                            </span>
                            ) : null}
                            {hasGitProof ? (
                              <span className="grid min-w-0 gap-1 rounded-2xl border border-ai-500/20 bg-ai-500/10 px-3 py-2.5 text-ai-700 dark:text-ai-100">
                                <span className="inline-flex min-w-0 items-center gap-2">
                                  <GitCommitHorizontal className="h-4 w-4 shrink-0" />
                                  <span className="text-[0.66rem] font-black uppercase tracking-[0.14em]">Git</span>
                                </span>
                                <strong className="font-mono text-sm text-slate-950 dark:text-white">{member?.git.commitsThisSprint} commits</strong>
                                <small className="font-bold opacity-80">{member?.git.pullRequestsOpen} PRs open</small>
                              </span>
                            ) : null}
                          </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                  ) : null}
                </section>
                );
              })
            ) : (
              <EmptyPanel icon={ClipboardCheck} title="No standups yet" description="Capture the first update to start building the project pulse." />
            )}
          </div>
        </SectionPanel>
      ) : projectId && error ? (
        <WorkspaceError label={error} />
      ) : null}
    </div>
  );
}
