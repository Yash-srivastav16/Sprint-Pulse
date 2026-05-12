import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ClipboardCheck, Loader2, RefreshCw, Send, Sparkles, UploadCloud } from "lucide-react";
import { useParams } from "react-router-dom";
import type { ProjectStandupsResponse } from "@sprintpulse/shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

type StandupMode = "manual" | "transcript" | "upload";

export function StandupPage() {
  const { projectId } = useParams();
  const { persona } = useAuth();
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
  const [parserResult, setParserResult] = useState<Array<{
    memberId: string;
    name: string;
    yesterday: string;
    today: string;
    blockers: string;
    confidence: number;
  }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStandups = () => {
    if (!persona || !projectId) {
      setCanSyncStandups(false);
      return;
    }

    api
      .getProjectStandups(projectId, persona.id)
      .then((response) => {
        setStandupData(response);
        setCanSyncStandups(response.canSync);
      })
      .catch(() => setCanSyncStandups(false));
  };

  useEffect(() => {
    loadStandups();
  }, [persona, projectId]);

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
      setResult("Standup submitted. Your latest update is now part of the sprint pulse.");
      setYesterday("");
      setToday("");
      setBlockers("No blocker.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Standup submission failed");
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
      if (projectId) {
        loadStandups();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcript parse failed");
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
      loadStandups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Standup sync failed");
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
      setError("Unable to read this file. Use a text, markdown, or CSV export.");
    }
  };

  return (
    <div className="page-stack">
      <section className="page-heading standup-heading">
        <div>
          <p className="eyebrow">{projectId ? "Project input flow" : "Input flow"}</p>
          <h1>Submit standup</h1>
          <p>
            {standupData
              ? `${standupData.project.key} · ${standupData.sprint.name}`
              : "Capture daily updates from manual entries, transcripts, uploaded exports, and connected delivery sources."}
          </p>
        </div>
        {projectId && canSyncStandups ? (
          <button className="icon-text-button" type="button" onClick={syncStandups} disabled={syncLoading}>
            {syncLoading ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
            <span>Sync updates</span>
          </button>
        ) : null}
      </section>

      <div className="segmented-control standup-mode-control" role="tablist" aria-label="Standup input mode">
        <button className={mode === "manual" ? "active" : ""} type="button" onClick={() => switchMode("manual")}>
          <ClipboardCheck size={17} />
          <span>Manual</span>
        </button>
        <button className={mode === "transcript" ? "active" : ""} type="button" onClick={() => switchMode("transcript")}>
          <Sparkles size={17} />
          <span>Transcript</span>
        </button>
        <button className={mode === "upload" ? "active" : ""} type="button" onClick={() => switchMode("upload")}>
          <UploadCloud size={17} />
          <span>Upload</span>
        </button>
      </div>

      {mode === "manual" ? (
        <form className="panel form-panel" onSubmit={submitManual}>
          <label>
            <span>Yesterday</span>
            <textarea
              value={yesterday}
              onChange={(event) => setYesterday(event.target.value)}
              placeholder="Finished API contracts and routed dashboard data."
              required
            />
          </label>
          <label>
            <span>Today</span>
            <textarea
              value={today}
              onChange={(event) => setToday(event.target.value)}
              placeholder="Connecting standup submission to the sprint pulse."
              required
            />
          </label>
          <label>
            <span>Blockers</span>
            <textarea
              value={blockers}
              onChange={(event) => setBlockers(event.target.value)}
              placeholder="No blocker."
            />
          </label>
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            <span>Submit update</span>
          </button>
        </form>
      ) : mode === "transcript" ? (
        <form className="panel form-panel" onSubmit={parseTranscript}>
          <label>
            <span>Paste standup transcript</span>
            <textarea
              className="large-textarea"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Atharv: Yesterday I worked on dashboard cards. Today I am connecting the API. No blockers."
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            <span>Parse transcript</span>
          </button>
        </form>
      ) : (
        <form className="panel form-panel" onSubmit={parseTranscript}>
          <label className="upload-dropzone">
            <UploadCloud size={24} />
            <span>{uploadFileName ?? "Upload standup export"}</span>
            <small>TXT, MD, or CSV</small>
            <input type="file" accept=".txt,.md,.csv,text/plain,text/markdown,text/csv" onChange={loadUpload} />
          </label>
          <label>
            <span>Imported text</span>
            <textarea
              className="large-textarea"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Uploaded standup text will appear here before parsing."
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={loading || !transcript.trim()}>
            {loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            <span>Parse upload</span>
          </button>
        </form>
      )}

      {error ? <p className="form-error">{error}</p> : null}
      {result ? <p className="form-success">{result}</p> : null}
      {syncResult ? <p className="form-success">{syncResult}</p> : null}

      {parserResult ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Parsed updates</p>
              <h2>Detected speaker updates</h2>
            </div>
          </div>
          <div className="parsed-grid">
            {parserResult.map((entry) => (
              <div className="parsed-item" key={entry.memberId}>
                <strong>{entry.name}</strong>
                <span>{Math.round(entry.confidence * 100)}% confidence</span>
                <p>{entry.today}</p>
                <small>{entry.blockers}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {standupData ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Active sprint history</p>
              <h2>{standupData.standups.length} captured updates</h2>
            </div>
          </div>
          <div className="timeline-list">
            {standupData.standups.length ? (
              standupData.standups.map((entry) => (
                <div className="timeline-item" key={entry.id}>
                  <time>{entry.date}</time>
                  <div>
                    <strong>{entry.memberName}</strong>
                    <p>{entry.today}</p>
                  </div>
                  <div>
                    <strong>Blockers</strong>
                    <p>{entry.blockers}</p>
                  </div>
                  <div>
                    <strong>Source</strong>
                    <p>{entry.source}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">No standups have been captured for this active sprint yet.</div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
