import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { CalendarClock, ClipboardCheck, History, Loader2, MessageSquareText, RefreshCw, Send, Sparkles, UploadCloud } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import type { ProjectStandupsResponse } from "@sprintpulse/shared";
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
import { cn } from "../lib/utils";

type StandupMode = "manual" | "transcript" | "upload";

const modeCopy: Record<StandupMode, string> = {
  manual: "Write your update directly into the selected sprint.",
  transcript: "Paste a meeting transcript and SprintPulse will create speaker-mapped updates for the selected sprint.",
  upload: "Load a text, markdown, or CSV export before parsing."
};

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
  const [mode, setMode] = useState<StandupMode>("manual");
  const [yesterday, setYesterday] = useState("");
  const [today, setToday] = useState("");
  const [blockers, setBlockers] = useState("No blocker.");
  const [transcript, setTranscript] = useState("");
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [canSyncStandups, setCanSyncStandups] = useState(false);
  const [standupData, setStandupData] = useState<ProjectStandupsResponse | null>(null);
  const [parserResult, setParserResult] = useState<
    Array<{
      memberId: string;
      name: string;
      yesterday: string;
      today: string;
      blockers: string;
      confidence: number;
    }> | null
  >(null);
  const [pageLoading, setPageLoading] = useState(Boolean(projectId));
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStandups = () => {
    if (!persona || !projectId) {
      setCanSyncStandups(false);
      setPageLoading(false);
      return;
    }

    setPageLoading(true);
    api
      .getProjectStandups(projectId, persona.id, selectedSprintId ?? undefined)
      .then((response) => {
        setStandupData(response);
        setCanSyncStandups(response.canSync);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setPageLoading(false));
  };

  useEffect(() => {
    loadStandups();
  }, [persona, projectId, selectedSprintId]);

  const switchMode = (nextMode: StandupMode) => {
    setMode(nextMode);
    setError(null);
    setResult(null);
    setSyncResult(null);
    setParserResult(null);
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

    try {
      const response = projectId
        ? await api.parseProjectTranscript(projectId, transcript, persona?.id)
        : await api.parseTranscript(transcript);
      setParserResult(response.parsed);
      toast.success("Transcript parsed", { description: `${response.parsed.length} speaker update${response.parsed.length === 1 ? "" : "s"} detected.` });
      if (projectId) {
        loadStandups();
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
      setSyncResult(`Synced ${response.importedStandups} standups at ${new Date(response.syncedAt).toLocaleTimeString()}.`);
      toast.success("Standups synced", { description: `${response.importedStandups} update${response.importedStandups === 1 ? "" : "s"} imported.` });
      loadStandups();
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
      const message = "Unable to read this file. Use a text, markdown, or CSV export.";
      setError(message);
      toast.error("Upload failed", { description: message });
    }
  };

  if (pageLoading) {
    return <WorkspaceLoading label="Loading standups" />;
  }

  const activeSprintLabel = standupData ? `${standupData.project.key} · ${standupData.sprint.name}` : "Workspace standup";
  const recentStandups = standupData?.standups ?? [];
  const latestStandup = recentStandups[0];

  return (
    <div className={workspacePageClass}>
      <WorkspaceHero
        eyebrow={
          <>
            <StatusPill icon={ClipboardCheck} tone="primary">
              {projectId ? "Project standups" : "Standups"}
            </StatusPill>
            <StatusPill icon={MessageSquareText} tone="neutral">
              {activeSprintLabel}
            </StatusPill>
          </>
        }
        title="Standup capture"
        description="Every update is scoped to the selected project and sprint so dashboard signal stays clean."
        score={recentStandups.length}
        scoreLabel="Captured updates"
        scoreTone="info"
        scoreDetail={
          latestStandup ? (
            <span>
              Latest from <strong className="text-white">{latestStandup.memberName}</strong> on {latestStandup.date}.
            </span>
          ) : (
            "No updates have been captured for this sprint yet."
          )
        }
        action={
          projectId && canSyncStandups ? (
            <button className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/15 disabled:pointer-events-none disabled:opacity-60" type="button" onClick={syncStandups} disabled={syncLoading}>
              {syncLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync
            </button>
          ) : null
        }
        pills={
          <>
            <StatusPill icon={CalendarClock} tone="neutral">
              {standupData?.sprint.name ?? "Selected sprint"}
            </StatusPill>
            <StatusPill icon={Sparkles} tone="neutral">
              {mode}
            </StatusPill>
          </>
        }
      />

      <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <SectionPanel>
          <PanelHeader
            eyebrow="Input"
            title="Add sprint signal"
            description={modeCopy[mode]}
            icon={ClipboardCheck}
            action={
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/[0.055]">
                {(["manual", "transcript", "upload"] as StandupMode[]).map((item) => (
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
                  <small className="mt-1 text-sm text-slate-500 dark:text-slate-400">TXT, MD, or CSV</small>
                  <Input className="sr-only" type="file" accept=".txt,.md,.csv,text/plain,text/markdown,text/csv" onChange={loadUpload} />
                </label>
              ) : null}
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{mode === "upload" ? "Imported text" : "Paste standup transcript"}</span>
                <StandupTextArea value={transcript} onChange={setTranscript} placeholder="Atharv: Yesterday I worked on dashboard cards. Today I am connecting the API. No blockers." rows={10} required />
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

        <SectionPanel>
          <PanelHeader eyebrow="Context" title="What gets attached" description="These guardrails keep every standup tied to the correct sprint." icon={CalendarClock} tone="info" />
          <div className="grid gap-3">
            {[
              ["Project", standupData?.project.key ?? "Selected workspace"],
              ["Sprint", standupData?.sprint.name ?? "Selected sprint"],
              ["Identity", persona?.name ?? "Signed-in user"],
              ["Latest source", latestStandup?.source ?? "Waiting for first update"]
            ].map(([label, value]) => (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]" key={label}>
                <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{label}</span>
                <strong className="mt-1 block text-sm font-black text-slate-950 dark:text-white">{value}</strong>
              </div>
            ))}
          </div>
        </SectionPanel>
      </section>

      {parserResult ? (
        <SectionPanel>
          <PanelHeader eyebrow="Parsed updates" title="Detected speaker updates" description="Review the parsed records before relying on them in the demo flow." icon={Sparkles} tone="ai" />
          <div className="grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
            {parserResult.map((entry) => (
              <article className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]" key={entry.memberId}>
                <div className="flex items-center gap-3">
                  <MemberAvatar initials={entry.name.slice(0, 2).toUpperCase()} size="sm" />
                  <span>
                    <strong className="block text-sm font-black text-slate-950 dark:text-white">{entry.name}</strong>
                    <small className="text-slate-500 dark:text-slate-400">{Math.round(entry.confidence * 100)}% confidence</small>
                  </span>
                </div>
                <p className="m-0 mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{entry.today}</p>
                <small className="mt-2 block font-semibold text-warning-700 dark:text-warning-100">{entry.blockers}</small>
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}

      {standupData ? (
        <SectionPanel>
          <PanelHeader eyebrow="Sprint history" title={`${standupData.standups.length} captured updates`} description="Newest updates appear first for quick Scrum Master review." icon={History} />
          <div className="grid gap-3">
            {standupData.standups.length ? (
              standupData.standups.map((entry) => (
                <article className="grid gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045] xl:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_minmax(220px,0.7fr)]" key={entry.id}>
                  <div className="flex items-center gap-3">
                    <MemberAvatar initials={entry.memberInitials} />
                    <span className="min-w-0">
                      <strong className="block truncate text-sm font-black text-slate-950 dark:text-white">{entry.memberName}</strong>
                      <small className="text-slate-500 dark:text-slate-400">{entry.date}</small>
                    </span>
                  </div>
                  <div>
                    <strong className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Yesterday</strong>
                    <p className="m-0 mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{entry.yesterday}</p>
                  </div>
                  <div>
                    <strong className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Today</strong>
                    <p className="m-0 mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{entry.today}</p>
                  </div>
                  <div>
                    <strong className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Blockers</strong>
                    <p className="m-0 mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{entry.blockers}</p>
                  </div>
                </article>
              ))
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
