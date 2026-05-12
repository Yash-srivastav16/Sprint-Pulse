import { FormEvent, useEffect, useState } from "react";
import { Cloud, GitBranch, Loader2, PlugZap, RefreshCw, Save, ShieldAlert, TicketCheck } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import type { IntegrationStatus, IntegrationStatusResponse } from "@sprintpulse/shared";
import { Input } from "@/components/ui/input";
import {
  EmptyPanel,
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
import { cn } from "../lib/utils";

function statusTone(status?: IntegrationStatus) {
  if (status === "synced") {
    return "success" as const;
  }
  if (status === "configured") {
    return "info" as const;
  }
  if (status === "failed") {
    return "danger" as const;
  }
  return "neutral" as const;
}

function formatStatus(status?: string) {
  return (status ?? "not-configured")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ProjectIntegrationsPage() {
  const { projectId } = useParams();
  const { persona } = useAuth();
  const [data, setData] = useState<IntegrationStatusResponse | null>(null);
  const [jiraSite, setJiraSite] = useState("");
  const [jiraKey, setJiraKey] = useState("");
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canConfigure = data?.permissions.includes("project:connect") ?? false;

  const loadIntegrations = () => {
    if (!persona || !projectId) {
      return;
    }

    setLoading(true);
    setError(null);
    api
      .getProjectIntegrations(projectId, persona.id)
      .then((response) => {
        setData(response);
        setJiraSite(response.jira?.siteUrl ?? "");
        setJiraKey(response.jira?.projectKey ?? response.project.key);
        setRepoOwner(response.git?.repoOwner ?? "");
        setRepoName(response.git?.repoName ?? "");
        setDefaultBranch(response.git?.defaultBranch ?? "main");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadIntegrations, [persona, projectId]);

  const configureJira = async (event: FormEvent) => {
    event.preventDefault();
    if (!persona || !projectId) {
      return;
    }

    setSaving("jira");
    setError(null);
    setSuccess(null);
    try {
      await api.configureProjectJira(projectId, {
        personaId: persona.id,
        jiraSite,
        projectKey: jiraKey
      });
      setSuccess("Jira configuration saved.");
      toast.success("Jira saved", { description: `${jiraKey || "Project"} is ready to sync.` });
      loadIntegrations();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Jira configuration failed";
      setError(message);
      toast.error("Jira save failed", { description: message });
    } finally {
      setSaving(null);
    }
  };

  const syncJira = async () => {
    if (!persona || !projectId) {
      return;
    }

    setSaving("jira-sync");
    setError(null);
    setSuccess(null);
    try {
      const response = await api.syncProjectJira(projectId, persona.id);
      setSuccess(`Jira synced ${response.importedIssues} issues.`);
      toast.success("Jira synced", { description: `${response.importedIssues} issue${response.importedIssues === 1 ? "" : "s"} imported.` });
      loadIntegrations();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Jira sync failed";
      setError(message);
      toast.error("Jira sync failed", { description: message });
    } finally {
      setSaving(null);
    }
  };

  const configureGit = async (event: FormEvent) => {
    event.preventDefault();
    if (!persona || !projectId) {
      return;
    }

    setSaving("git");
    setError(null);
    setSuccess(null);
    try {
      await api.configureProjectGit(projectId, {
        personaId: persona.id,
        provider: "github",
        repoOwner,
        repoName,
        defaultBranch
      });
      setSuccess("GitHub repository saved.");
      toast.success("GitHub saved", { description: `${repoOwner}/${repoName}` });
      loadIntegrations();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Git configuration failed";
      setError(message);
      toast.error("GitHub save failed", { description: message });
    } finally {
      setSaving(null);
    }
  };

  const syncGit = async () => {
    if (!persona || !projectId) {
      return;
    }

    setSaving("git-sync");
    setError(null);
    setSuccess(null);
    try {
      const response = await api.syncProjectGit(projectId, persona.id);
      setSuccess(`Git synced ${response.importedCommits} commits.`);
      toast.success("GitHub synced", { description: `${response.importedCommits} commit${response.importedCommits === 1 ? "" : "s"} imported.` });
      loadIntegrations();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Git sync failed";
      setError(message);
      toast.error("Git sync failed", { description: message });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <WorkspaceLoading label="Loading integrations" />;
  }

  if (error && !data) {
    return <WorkspaceError label={error} />;
  }

  if (!data) {
    return <WorkspaceError label="Integrations unavailable" />;
  }

  const connectedCount = [data.jira, data.git].filter(Boolean).length;
  const lastSyncAt = [data.jira?.lastSyncAt, data.git?.lastSyncAt].filter(Boolean).sort().at(-1);
  const totalAdditions = data.commitPreview.reduce((sum, commit) => sum + commit.additions, 0);
  const totalDeletions = data.commitPreview.reduce((sum, commit) => sum + commit.deletions, 0);
  const blockedIssues = data.issuePreview.filter((issue) => issue.status === "Blocked").length;
  const staleIssues = data.issuePreview.filter((issue) => issue.daysIdle >= 3).length;
  const successfulRuns = data.recentRuns.filter((run) => run.status === "succeeded").length;
  const failedRuns = data.recentRuns.filter((run) => run.status === "failed").length;
  const latestFailedRun = data.recentRuns.find((run) => run.status === "failed");
  const failedRunDetail = latestFailedRun
    ? `${formatStatus(latestFailedRun.source)}: ${latestFailedRun.errorMessage ?? "Review the last sync run."}`
    : "Recent runs healthy or waiting";
  const integrationStats = [
    {
      label: "Jira issues",
      value: data.issuePreview.length,
      detail: `${blockedIssues} blocked · ${staleIssues} stale`,
      icon: TicketCheck,
      tone: blockedIssues ? ("warning" as const) : ("info" as const)
    },
    {
      label: "Git movement",
      value: data.commitPreview.length,
      detail: `${totalAdditions}+ / ${totalDeletions}- lines changed`,
      icon: GitBranch,
      tone: "ai" as const
    },
    {
      label: "Sync health",
      value: data.recentRuns.length ? `${successfulRuns}/${data.recentRuns.length}` : "0",
      detail: failedRuns ? failedRunDetail : "Recent runs healthy or waiting",
      icon: RefreshCw,
      tone: failedRuns ? ("danger" as const) : ("success" as const)
    }
  ];

  return (
    <div className={workspacePageClass}>
      <WorkspaceHero
        eyebrow={
          <>
            <StatusPill icon={PlugZap} tone="primary">
              {data.project.key} integrations
            </StatusPill>
            <StatusPill icon={ShieldAlert} tone={canConfigure ? "success" : "neutral"}>
              {canConfigure ? "Configurable" : "Read only"}
            </StatusPill>
          </>
        }
        title="Configure sync"
        description="Connect Jira and GitHub signals to the selected project. Guided sync keeps issue and commit signals reliable for the demo."
        score={`${connectedCount}/2`}
        scoreLabel="Connected"
        scoreTone={connectedCount === 2 ? "success" : "info"}
        scoreDetail={lastSyncAt ? `Last sync ${new Date(lastSyncAt).toLocaleString()}` : "Run a sync after configuring Jira or GitHub."}
        pills={
          <>
            <StatusPill icon={Cloud} tone={statusTone(data.jira?.status)}>
              Jira {formatStatus(data.jira?.status)}
            </StatusPill>
            <StatusPill icon={GitBranch} tone={statusTone(data.git?.status)}>
              GitHub {formatStatus(data.git?.status)}
            </StatusPill>
          </>
        }
      />

      <section className="grid auto-rows-fr items-stretch gap-4 md:grid-cols-3">
        {integrationStats.map((stat) => {
          const StatIcon = stat.icon;
          return (
            <SectionPanel className="p-4" key={stat.label}>
              <div className="flex items-start justify-between gap-3">
                <StatusPill icon={StatIcon} tone={stat.tone}>
                  {stat.label}
                </StatusPill>
                <strong className="font-mono text-2xl font-bold text-slate-950 dark:text-white">{stat.value}</strong>
              </div>
              <p className="m-0 mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{stat.detail}</p>
            </SectionPanel>
          );
        })}
      </section>

      {!canConfigure ? (
        <SectionPanel className="border-warning-500/20 bg-warning-500/10">
          <div className="flex items-center gap-3 text-warning-700 dark:text-warning-100">
            <ShieldAlert className="h-5 w-5" />
            <span className="font-semibold">Developers can view sync status. Configuration is owned by Scrum Master or project owners.</span>
          </div>
        </SectionPanel>
      ) : null}

      {error ? <div className="rounded-xl border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm font-semibold text-danger-700 dark:text-danger-100">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-100">{success}</div> : null}
      {latestFailedRun ? (
        <SectionPanel className="border-warning-500/20 bg-warning-500/10 p-4">
          <div className="flex items-start gap-3 text-warning-700 dark:text-warning-100">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="text-sm leading-6">
              <strong className="font-black">{formatStatus(latestFailedRun.source)} sync needs review.</strong>{" "}
              {latestFailedRun.errorMessage ?? "Open the run details before the demo."}
            </span>
          </div>
        </SectionPanel>
      ) : null}

      <section className="grid items-stretch gap-5 xl:grid-cols-2">
        <SectionPanel>
          <form className="grid gap-5" onSubmit={configureJira}>
            <PanelHeader eyebrow="Jira" title={data.jira ? "Configured project" : "Connect project"} description="Project key and site URL are enough for the demo-safe import flow." icon={Cloud} tone="info" />
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Jira site</span>
                <Input value={jiraSite} onChange={(event) => setJiraSite(event.target.value)} placeholder="company.atlassian.net" disabled={!canConfigure} required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Project key</span>
                <Input value={jiraKey} onChange={(event) => setJiraKey(event.target.value.toUpperCase())} placeholder={data.project.key} disabled={!canConfigure} required />
              </label>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]">
              <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Status</span>
              <strong className="mt-1 block text-sm font-black text-slate-950 dark:text-white">{formatStatus(data.jira?.status)}</strong>
              <small className="text-slate-500 dark:text-slate-400">{data.jira?.lastSyncAt ? new Date(data.jira.lastSyncAt).toLocaleString() : "No sync yet"}</small>
            </div>
            {canConfigure ? (
              <div className="flex flex-wrap gap-3">
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(16,169,154,0.22)] disabled:pointer-events-none disabled:opacity-60" type="submit" disabled={Boolean(saving)}>
                  {saving === "jira" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Jira
                </button>
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm disabled:pointer-events-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" type="button" onClick={syncJira} disabled={Boolean(saving) || !data.jira}>
                  {saving === "jira-sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sync issues
                </button>
              </div>
            ) : null}
          </form>
        </SectionPanel>

        <SectionPanel>
          <form className="grid gap-5" onSubmit={configureGit}>
            <PanelHeader eyebrow="GitHub" title={data.git ? "Configured repository" : "Connect repository"} description="Repository details map commits and review pressure back to the sprint." icon={GitBranch} tone="ai" />
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Repo owner</span>
                <Input value={repoOwner} onChange={(event) => setRepoOwner(event.target.value)} placeholder="semicolon-team" disabled={!canConfigure} required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Repo name</span>
                <Input value={repoName} onChange={(event) => setRepoName(event.target.value)} placeholder="sprintpulse-ai" disabled={!canConfigure} required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Default branch</span>
                <Input value={defaultBranch} onChange={(event) => setDefaultBranch(event.target.value)} placeholder="main" disabled={!canConfigure} required />
              </label>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]">
              <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Status</span>
              <strong className="mt-1 block text-sm font-black text-slate-950 dark:text-white">{formatStatus(data.git?.status)}</strong>
              <small className="text-slate-500 dark:text-slate-400">{data.git?.lastSyncAt ? new Date(data.git.lastSyncAt).toLocaleString() : "No sync yet"}</small>
            </div>
            {canConfigure ? (
              <div className="flex flex-wrap gap-3">
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(16,169,154,0.22)] disabled:pointer-events-none disabled:opacity-60" type="submit" disabled={Boolean(saving)}>
                  {saving === "git" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save GitHub
                </button>
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm disabled:pointer-events-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" type="button" onClick={syncGit} disabled={Boolean(saving) || !data.git}>
                  {saving === "git-sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sync commits
                </button>
              </div>
            ) : null}
          </form>
        </SectionPanel>
      </section>

      <section className="grid items-stretch gap-5 xl:grid-cols-2">
        <SectionPanel>
          <PanelHeader eyebrow="Jira preview" title={`${data.issuePreview.length} synced issues`} icon={TicketCheck} tone="info" />
          <div className="grid gap-3">
            {data.issuePreview.length ? (
              data.issuePreview.map((issue) => (
                <div className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045] md:grid-cols-[110px_minmax(0,1fr)_120px_80px]" key={issue.id}>
                  <strong className="text-sm font-black text-slate-950 dark:text-white">{issue.issueKey}</strong>
                  <span className="text-sm leading-6 text-slate-600 dark:text-slate-300">{issue.summary}</span>
                  <em className="not-italic text-sm font-bold text-primary-700 dark:text-primary-100">{issue.status}</em>
                  <small className="text-sm font-bold text-slate-500 dark:text-slate-400">{issue.daysIdle}d idle</small>
                </div>
              ))
            ) : (
              <EmptyPanel icon={TicketCheck} title="No Jira preview yet" description="Sync Jira to preview sprint issues." />
            )}
          </div>
        </SectionPanel>

        <SectionPanel>
          <PanelHeader eyebrow="Git preview" title={`${data.commitPreview.length} synced commits`} icon={GitBranch} tone="ai" />
          <div className="grid gap-3">
            {data.commitPreview.length ? (
              data.commitPreview.map((commit) => (
                <div className="grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045] md:grid-cols-[110px_minmax(0,1fr)_120px_100px]" key={commit.id}>
                  <strong className="font-mono text-sm font-black text-slate-950 dark:text-white">{commit.sha.slice(0, 9)}</strong>
                  <span className="text-sm leading-6 text-slate-600 dark:text-slate-300">{commit.message}</span>
                  <em className="not-italic text-sm font-bold text-primary-700 dark:text-primary-100">{commit.additions}+ / {commit.deletions}-</em>
                  <small className="text-sm font-bold text-slate-500 dark:text-slate-400">{new Date(commit.committedAt).toLocaleDateString()}</small>
                </div>
              ))
            ) : (
              <EmptyPanel icon={GitBranch} title="No GitHub preview yet" description="Sync GitHub to preview commit activity." />
            )}
          </div>
        </SectionPanel>
      </section>
    </div>
  );
}
