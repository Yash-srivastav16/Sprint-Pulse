import { FormEvent, useEffect, useState } from "react";
import { Bot, Cloud, Copy, ExternalLink, GitBranch, GitCommitHorizontal, KeyRound, Loader2, Mic, Plus, PlugZap, RefreshCw, Save, ShieldAlert, Sparkles, TicketCheck, Trash2 } from "lucide-react";
import { useLocation, useParams } from "react-router-dom";
import { toast } from "sonner";
import type { IntegrationStatus, IntegrationStatusResponse, WebhookToken } from "@sprintpulse/shared";
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
import { api, withAppRoute } from "../api";
import { useAuth } from "../context/AuthContext";
import { clearProjectCache, projectCacheKey, readProjectCache, writeProjectCache } from "../lib/projectDataCache";
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

function publishSignalRefresh(projectId?: string) {
  clearProjectCache(projectId);
  window.dispatchEvent(new CustomEvent("sprintpulse:signals-updated", { detail: { projectId } }));
}

export function ProjectIntegrationsPage() {
  const { projectId } = useParams();
  const location = useLocation();
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

  const apiBase = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:4000/api" : "/api");
  const absoluteApiBase = apiBase.startsWith("http") ? apiBase : `${window.location.origin}${apiBase}`;
  // withAppRoute appends ?app=<uuid> on the deployed SemicoLabs platform so
  // the URL works for external callers (Power Automate, Otter, curl); no-op
  // in local dev where the param isn't present.
  const webhookUrl = withAppRoute(`${absoluteApiBase}/projects/${projectId ?? "<projectId>"}/transcripts/teams-webhook`);
  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success("Webhook URL copied", { description: "Paste into Power Automate, Otter, or any HTTP client." });
    } catch {
      toast.error("Copy failed", { description: "Select the URL and copy manually." });
    }
  };

  // MCP host config snippet — drops into Claude Code / Cursor / any MCP client.
  // The API_BASE matches whatever the SPA is hitting (so it's correct for both
  // local dev and the SemicoLabs deploy). API key is left blank — the user
  // pastes their SPRINTPULSE_API_KEY from the deployment's env.
  const mcpConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        sprintpulse: {
          command: "node",
          args: ["./packages/mcp-server/dist/index.js"],
          env: {
            SPRINTPULSE_API_BASE: absoluteApiBase,
            SPRINTPULSE_API_KEY: "<paste from your deployment's SPRINTPULSE_API_KEY>"
          }
        }
      }
    },
    null,
    2
  );
  const copyMcpConfig = async () => {
    try {
      await navigator.clipboard.writeText(mcpConfigSnippet);
      toast.success("MCP config copied", {
        description: "Paste into ~/.claude/mcp_settings.json or ~/.cursor/mcp.json and restart the host."
      });
    } catch {
      toast.error("Copy failed", { description: "Select the snippet and copy manually." });
    }
  };

  const mcpTools = [
    { name: "get_project_risk", purpose: "Team health + top risks + P1 + recommended actions" },
    { name: "get_member_health", purpose: "Per-member pulse, flags, evidence, recent standups" },
    { name: "submit_standup", purpose: "Create a structured standup entry for a member" },
    { name: "parse_transcript", purpose: "VTT or plain text → speaker-mapped standups + risk update" },
    { name: "run_member_pr_review", purpose: "AI review of a member's recent commits/PRs" }
  ];

  // Webhook token state — list of active tokens, the just-minted plaintext
  // shown once, and the inline-create form state. The list reloads after every
  // mutation so the UI always reflects the DB truth.
  const [tokens, setTokens] = useState<WebhookToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokensError, setTokensError] = useState<string | null>(null);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [mintingToken, setMintingToken] = useState(false);
  const [revealedToken, setRevealedToken] = useState<{ name: string; plaintext: string } | null>(null);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);

  const loadTokens = async () => {
    if (!persona || !projectId) return;
    setTokensLoading(true);
    setTokensError(null);
    try {
      const response = await api.listWebhookTokens(projectId, persona.id);
      setTokens(response.tokens);
    } catch (err) {
      setTokensError(err instanceof Error ? err.message : "Failed to load webhook tokens");
    } finally {
      setTokensLoading(false);
    }
  };

  useEffect(() => {
    if (persona && projectId) {
      void loadTokens();
    }
    // Intentionally not subscribed to loadTokens itself — that would re-fire
    // on every render. Re-runs when persona or project changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona?.id, projectId]);

  const submitCreateToken = async (event: FormEvent) => {
    event.preventDefault();
    if (!persona || !projectId) return;
    const name = newTokenName.trim();
    if (!name) {
      toast.error("Token name is required");
      return;
    }

    setMintingToken(true);
    try {
      const response = await api.createWebhookToken(projectId, persona.id, name);
      setRevealedToken({ name: response.token.name, plaintext: response.plaintextToken });
      setNewTokenName("");
      setShowCreateToken(false);
      await loadTokens();
    } catch (err) {
      toast.error("Token creation failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setMintingToken(false);
    }
  };

  const copyRevealedToken = async () => {
    if (!revealedToken) return;
    try {
      await navigator.clipboard.writeText(revealedToken.plaintext);
      toast.success("Token copied", { description: "Paste it into your Power Automate / Otter / curl header now." });
    } catch {
      toast.error("Copy failed", { description: "Select the token and copy manually." });
    }
  };

  const handleRevokeToken = async (tokenId: string, name: string) => {
    if (!persona || !projectId) return;
    if (!window.confirm(`Revoke "${name}"? Any callers using this token will start getting 401s immediately.`)) return;
    setRevokingTokenId(tokenId);
    try {
      await api.revokeWebhookToken(projectId, tokenId, persona.id);
      toast.success("Token revoked");
      await loadTokens();
    } catch (err) {
      toast.error("Revoke failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setRevokingTokenId(null);
    }
  };

  const loadIntegrations = () => {
    if (!persona || !projectId) {
      return;
    }

    const cacheKey = projectCacheKey("integrations", [projectId, persona.id]);
    const cached = readProjectCache<IntegrationStatusResponse>(cacheKey);
    if (cached) {
      setData(cached);
      setJiraSite(cached.jira?.siteUrl ?? "");
      setJiraKey(cached.jira?.projectKey ?? cached.project.key);
      setRepoOwner(cached.git?.repoOwner ?? "");
      setRepoName(cached.git?.repoName ?? "");
      setDefaultBranch(cached.git?.defaultBranch ?? "main");
    }

    setLoading(!cached);
    setError(null);
    api
      .getProjectIntegrations(projectId, persona.id)
      .then((response) => {
        writeProjectCache(cacheKey, response);
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

  useEffect(loadIntegrations, [persona?.id, projectId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("jira") === "connected") {
      setSuccess("Jira OAuth connected. Run sync to import sprint issues.");
      toast.success("Jira connected", { description: "Run sync to import sprint issues." });
    }
  }, [location.search]);

  useEffect(() => {
    if (!location.hash || loading) {
      return;
    }
    const targetId = location.hash.slice(1);
    if (targetId !== "teams-webhook" && targetId !== "mcp") {
      return;
    }
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, loading]);

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
      const importedMembers = Number(response.run?.stats?.importedMembers ?? 0);
      const issueLabel = `${response.importedIssues} issue${response.importedIssues === 1 ? "" : "s"}`;
      const memberLabel = importedMembers
        ? ` and linked ${importedMembers} Jira member${importedMembers === 1 ? "" : "s"}`
        : "";
      const linkedSuccess = response.linkedSyncs?.filter((sync) => sync.status === "succeeded").map((sync) => sync.source).join(" + ");
      const linkedCopy = linkedSuccess ? ` Also refreshed ${linkedSuccess}.` : "";
      setSuccess(`Jira synced ${issueLabel}${memberLabel}.${linkedCopy}`);
      toast.success("Jira synced", { description: `${issueLabel} imported${memberLabel}.${linkedCopy}` });
      loadIntegrations();
      publishSignalRefresh(projectId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Jira sync failed";
      setError(message);
      toast.error("Jira sync failed", { description: message });
    } finally {
      setSaving(null);
    }
  };

  const connectJiraOAuth = async () => {
    if (!persona || !projectId) {
      return;
    }

    setSaving("jira-oauth");
    setError(null);
    setSuccess(null);
    try {
      const response = await api.startProjectJiraOAuth(projectId, {
        personaId: persona.id,
        jiraSite,
        projectKey: jiraKey
      });
      window.location.assign(response.authorizationUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Jira OAuth connection failed";
      setError(message);
      toast.error("Jira connection failed", { description: message });
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
      const linkedSuccess = response.linkedSyncs?.filter((sync) => sync.status === "succeeded").map((sync) => sync.source).join(" + ");
      const linkedCopy = linkedSuccess ? ` Also refreshed ${linkedSuccess}.` : "";
      const openPullRequests = Number(response.run?.stats?.openPullRequests ?? 0);
      const reviewIssueCount = Number(response.run?.stats?.reviewIssues ?? 0);
      setSuccess(`Git synced ${response.importedCommits} commits, ${openPullRequests} PRs, and ${reviewIssueCount} review issues.${linkedCopy}`);
      toast.success("GitHub synced", {
        description: `${response.importedCommits} commit${response.importedCommits === 1 ? "" : "s"}, ${openPullRequests} PR${openPullRequests === 1 ? "" : "s"}, ${reviewIssueCount} review issue${reviewIssueCount === 1 ? "" : "s"}.${linkedCopy}`
      });
      loadIntegrations();
      publishSignalRefresh(projectId);
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
  const latestGitRun = data.recentRuns.find((run) => run.source === "git");
  const gitRunSucceeded = latestGitRun?.status === "succeeded";
  const importedGitCommits = Number(latestGitRun?.stats?.importedCommits ?? data.commitPreview.length);
  const foundPullRequests = Number(latestGitRun?.stats?.openPullRequests ?? 0);
  const reviewIssues = Number(latestGitRun?.stats?.reviewIssues ?? 0);
  const failedRunDetail = latestFailedRun
    ? `${formatStatus(latestFailedRun.source)}: ${latestFailedRun.errorMessage ?? "Review the last sync run."}`
    : "Recent runs healthy or waiting";
  const integrationStats = [
    {
      label: "Jira issues",
      value: data.issuePreview.length,
      detail: `${blockedIssues} blocked; ${staleIssues} stale`,
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
  const integrationHealth = [
    {
      label: gitRunSucceeded ? "GitHub token OK" : latestGitRun ? "GitHub token check failed" : "GitHub token unchecked",
      detail: latestGitRun?.errorMessage ?? (gitRunSucceeded ? "Last Git sync authenticated successfully." : "Run Git sync to verify access."),
      tone: gitRunSucceeded ? ("success" as const) : latestGitRun ? ("danger" as const) : ("neutral" as const),
      icon: KeyRound
    },
    {
      label: data.git && data.git.status !== "failed" ? "Repo reachable" : "Repo not verified",
      detail: data.git ? `${data.git.repoOwner}/${data.git.repoName}` : "Configure GitHub repository first.",
      tone: data.git && data.git.status !== "failed" ? ("success" as const) : ("warning" as const),
      icon: GitBranch
    },
    {
      label: `${importedGitCommits} commits imported`,
      detail: "Mapped to members by GitHub username, commit email, or member email.",
      tone: importedGitCommits ? ("success" as const) : ("warning" as const),
      icon: RefreshCw
    },
    {
      label: `${foundPullRequests} PR${foundPullRequests === 1 ? "" : "s"} found`,
      detail: reviewIssues ? `${reviewIssues} review issue${reviewIssues === 1 ? "" : "s"} reported.` : "PR review pressure is clean or waiting.",
      tone: reviewIssues ? ("warning" as const) : foundPullRequests ? ("success" as const) : ("neutral" as const),
      icon: ShieldAlert
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
            <a
              href="#teams-webhook"
              onClick={(event) => {
                event.preventDefault();
                document.getElementById("teams-webhook")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex"
            >
              <StatusPill icon={Mic} tone="warning">
                Teams transcripts
              </StatusPill>
            </a>
            <a
              href="#mcp"
              onClick={(event) => {
                event.preventDefault();
                document.getElementById("mcp")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex"
            >
              <StatusPill icon={Bot} tone="ai">
                MCP &middot; Agents
              </StatusPill>
            </a>
          </>
        }
      />

      {/* Banners */}
      {error ? <div className="rounded-xl border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-sm font-semibold text-danger-700 dark:text-danger-100">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-100">{success}</div> : null}
      {!canConfigure ? (
        <div className="flex items-center gap-3 rounded-xl border border-warning-500/25 bg-warning-500/10 px-4 py-3 text-warning-700 dark:text-warning-100">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="text-sm font-semibold">Developers can view sync status. Configuration is owned by Scrum Master or project owners.</span>
        </div>
      ) : null}
      {latestFailedRun ? (
        <div className="flex items-start gap-3 rounded-xl border border-warning-500/25 bg-warning-500/10 px-4 py-3 text-warning-700 dark:text-warning-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-sm leading-6">
            <strong className="font-black">{formatStatus(latestFailedRun.source)} sync needs review.</strong>{" "}
            {latestFailedRun.errorMessage ?? "Open the run details before the demo."}
          </span>
        </div>
      ) : null}

      {/* ─── 01 / Signal overview ──────────────────────────────────────────── */}
      <div className="flex items-baseline gap-4 pt-2">
        <span className="font-mono text-[0.72rem] font-black tracking-wider text-slate-400 dark:text-slate-500">01</span>
        <span className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-700 dark:text-slate-300">Signal overview</span>
        <span className="h-px flex-1 bg-gradient-to-r from-slate-300/70 via-slate-200/30 to-transparent dark:from-white/15 dark:via-white/[0.04]" />
      </div>

      <section className="grid auto-rows-fr items-stretch gap-4 md:grid-cols-3">
        {integrationStats.map((stat) => {
          const StatIcon = stat.icon;
          return (
            <SectionPanel className="p-4" key={stat.label}>
              <div className="flex items-start justify-between gap-3">
                <StatusPill icon={StatIcon} tone={stat.tone}>
                  {stat.label}
                </StatusPill>
                <strong className="font-mono text-2xl font-bold tabular-nums text-slate-950 dark:text-white">{stat.value}</strong>
              </div>
              <p className="m-0 mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{stat.detail}</p>
            </SectionPanel>
          );
        })}
      </section>

      <SectionPanel className="p-4">
        <PanelHeader
          eyebrow="Integration health"
          title="GitHub trust checks"
          icon={ShieldAlert}
          tone={gitRunSucceeded ? "success" : "warning"}
        />
        <p className="-mt-3 mb-4 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Quick verification for judges: token access, repository reachability, imported commits, and PR review signals.
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          {integrationHealth.map((item) => {
            const ItemIcon = item.icon;
            return (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.04]" key={item.label} title={item.detail}>
                <StatusPill icon={ItemIcon} tone={item.tone}>
                  {item.label}
                </StatusPill>
                <p className="m-0 mt-3 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </SectionPanel>

      {/* ─── 02 / Connect sources ──────────────────────────────────────────── */}
      <div className="flex items-baseline gap-4 pt-2">
        <span className="font-mono text-[0.72rem] font-black tracking-wider text-slate-400 dark:text-slate-500">02</span>
        <span className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-700 dark:text-slate-300">Connect sources</span>
        <span className="h-px flex-1 bg-gradient-to-r from-slate-300/70 via-slate-200/30 to-transparent dark:from-white/15 dark:via-white/[0.04]" />
      </div>

      <section className="grid items-stretch gap-5 xl:grid-cols-2">
        <SectionPanel className="relative overflow-hidden border-l-[3px] border-l-info-500/80 dark:border-l-info-400/70">
          <form className="grid gap-5" onSubmit={configureJira}>
            <PanelHeader eyebrow="Jira" title={data.jira ? "Configured project" : "Connect project"} icon={Cloud} tone="info" />
            <p className="-mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Save the site and project key, then authorize Atlassian before syncing real issue data.
            </p>
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</span>
                <strong className="mt-1 block text-sm font-black text-slate-950 dark:text-white">{formatStatus(data.jira?.status)}</strong>
                <small className="text-xs text-slate-500 dark:text-slate-400">{data.jira?.displayName ?? (data.jira?.lastSyncAt ? new Date(data.jira.lastSyncAt).toLocaleString() : "No sync yet")}</small>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">OAuth</span>
                <strong className="mt-1 block text-sm font-black text-slate-950 dark:text-white">{data.jira?.cloudId ? "Connected" : "Required"}</strong>
                <small className="text-xs text-slate-500 dark:text-slate-400">{data.jira?.activeSprintName ?? data.jira?.lastError ?? "Authorize Atlassian before syncing"}</small>
              </div>
            </div>
            {canConfigure ? (
              <div className="flex flex-wrap gap-3">
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(16,169,154,0.22)] disabled:pointer-events-none disabled:opacity-60" type="submit" disabled={Boolean(saving)}>
                  {saving === "jira" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Jira
                </button>
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm disabled:pointer-events-none disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" type="button" onClick={connectJiraOAuth} disabled={Boolean(saving) || !jiraSite || !jiraKey}>
                  {saving === "jira-oauth" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Connect Atlassian
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-info-500/30 bg-info-500/10 px-5 text-sm font-black text-info-700 transition hover:bg-info-500/15 disabled:pointer-events-none disabled:opacity-60 dark:text-info-100" type="button" onClick={syncJira} disabled={Boolean(saving) || !data.jira?.cloudId}>
                  {saving === "jira-sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sync issues
                </button>
              </div>
            ) : null}
          </form>
        </SectionPanel>

        <SectionPanel className="relative overflow-hidden border-l-[3px] border-l-ai-500/80 dark:border-l-ai-400/70">
          <form className="grid gap-5" onSubmit={configureGit}>
            <PanelHeader eyebrow="GitHub" title={data.git ? "Configured repository" : "Connect repository"} icon={GitBranch} tone="ai" />
            <p className="-mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Repository details map commits and review pressure back to the sprint.
            </p>
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Repo owner</span>
                <Input value={repoOwner} onChange={(event) => setRepoOwner(event.target.value)} placeholder="semicolon-team" disabled={!canConfigure} required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Repo name</span>
                <Input value={repoName} onChange={(event) => setRepoName(event.target.value)} placeholder="sprintpulse-ai" disabled={!canConfigure} required />
              </label>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</span>
              <strong className="mt-1 block text-sm font-black text-slate-950 dark:text-white">{formatStatus(data.git?.status)}</strong>
              <small className="text-xs text-slate-500 dark:text-slate-400">{data.git?.lastSyncAt ? new Date(data.git.lastSyncAt).toLocaleString() : "No sync yet"}</small>
            </div>
            {canConfigure ? (
              <div className="flex flex-wrap gap-3">
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(16,169,154,0.22)] disabled:pointer-events-none disabled:opacity-60" type="submit" disabled={Boolean(saving)}>
                  {saving === "git" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save GitHub
                </button>
                <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-ai-500/30 bg-ai-500/10 px-5 text-sm font-black text-ai-700 transition hover:bg-ai-500/15 disabled:pointer-events-none disabled:opacity-60 dark:text-ai-100" type="button" onClick={syncGit} disabled={Boolean(saving) || !data.git}>
                  {saving === "git-sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sync git
                </button>
              </div>
            ) : null}
          </form>
        </SectionPanel>
      </section>

      {/* ─── 03 / Signal preview ───────────────────────────────────────────── */}
      <div className="flex items-baseline gap-4 pt-2">
        <span className="font-mono text-[0.72rem] font-black tracking-wider text-slate-400 dark:text-slate-500">03</span>
        <span className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-700 dark:text-slate-300">Signal preview</span>
        <span className="h-px flex-1 bg-gradient-to-r from-slate-300/70 via-slate-200/30 to-transparent dark:from-white/15 dark:via-white/[0.04]" />
      </div>

      <section className="grid items-start gap-5 xl:grid-cols-2">
        <SectionPanel className="border-l-[3px] border-l-info-500/40 dark:border-l-info-400/40">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-info-700 dark:text-info-200">
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-info-500" />
                </span>
                Live &middot; Jira preview
              </div>
              <h2 className="m-0 text-xl font-extrabold leading-tight text-slate-950 dark:text-white">
                <span className="font-mono text-2xl tabular-nums">{data.issuePreview.length}</span>
                <span className="ml-2 text-base font-bold text-slate-500 dark:text-slate-400">synced issues</span>
              </h2>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-info-500/30 bg-info-500/10 text-info-700 dark:text-info-100">
              <TicketCheck className="h-4 w-4" />
            </span>
          </div>
          <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
            {data.issuePreview.length ? (
              data.issuePreview.map((issue) => (
                <div className="grid gap-3 rounded-lg border border-slate-200/80 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/[0.035] md:grid-cols-[100px_minmax(0,1fr)_110px_70px]" key={issue.id}>
                  <strong className="font-mono text-xs font-black text-slate-950 dark:text-white">{issue.issueKey}</strong>
                  <span className="truncate text-sm leading-6 text-slate-600 dark:text-slate-300">{issue.summary}</span>
                  <em className="not-italic text-xs font-bold text-info-700 dark:text-info-100">{issue.status}</em>
                  <small className="text-right font-mono text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">{issue.daysIdle}d idle</small>
                </div>
              ))
            ) : (
              <EmptyPanel icon={TicketCheck} title="No Jira work mapped yet" description="Add Jira account IDs on the Team page, then sync Jira to connect issue ownership." />
            )}
          </div>
        </SectionPanel>

        <SectionPanel className="border-l-[3px] border-l-ai-500/40 dark:border-l-ai-400/40">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-ai-700 dark:text-ai-200">
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ai-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-ai-500" />
                </span>
                Live &middot; Git preview
              </div>
              <h2 className="m-0 text-xl font-extrabold leading-tight text-slate-950 dark:text-white">
                <span className="font-mono text-2xl tabular-nums">{data.commitPreview.length}</span>
                <span className="ml-2 text-base font-bold text-slate-500 dark:text-slate-400">synced commits</span>
              </h2>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ai-500/30 bg-ai-500/10 text-ai-700 dark:text-ai-100">
              <GitCommitHorizontal className="h-4 w-4" />
            </span>
          </div>
          <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
            {data.commitPreview.length ? (
              data.commitPreview.map((commit) => (
                <div className="grid gap-3 rounded-lg border border-slate-200/80 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/[0.035] md:grid-cols-[100px_minmax(0,1fr)_120px_90px]" key={commit.id}>
                  <strong className="font-mono text-xs font-black text-slate-950 dark:text-white">{commit.sha.slice(0, 9)}</strong>
                  <span className="truncate text-sm leading-6 text-slate-600 dark:text-slate-300">{commit.message}</span>
                  <em className="not-italic font-mono text-xs font-bold tabular-nums text-ai-700 dark:text-ai-100">+{commit.additions} / -{commit.deletions}</em>
                  <small className="text-right text-xs font-bold text-slate-500 dark:text-slate-400">{new Date(commit.committedAt).toLocaleDateString()}</small>
                </div>
              ))
            ) : (
              <EmptyPanel icon={GitBranch} title="No GitHub proof yet" description="Add GitHub usernames on the Team page, then sync GitHub to preview commits, PRs, and review pressure." />
            )}
          </div>
        </SectionPanel>
      </section>

      {/* ─── 04 / Webhook ingestion ────────────────────────────────────────── */}
      <div className="flex items-baseline gap-4 pt-2">
        <span className="font-mono text-[0.72rem] font-black tracking-wider text-slate-400 dark:text-slate-500">04</span>
        <span className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-700 dark:text-slate-300">Webhook ingestion</span>
        <span className="h-px flex-1 bg-gradient-to-r from-slate-300/70 via-slate-200/30 to-transparent dark:from-white/15 dark:via-white/[0.04]" />
      </div>

      <section id="teams-webhook" className="grid scroll-mt-24 items-stretch gap-5 xl:grid-cols-2">
        <SectionPanel className="flex h-full flex-col border-l-[3px] border-l-warning-500/70 dark:border-l-warning-400/70">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-warning-700 dark:text-warning-200">Endpoint &middot; Inbound</div>
              <h2 className="m-0 text-xl font-extrabold leading-tight text-slate-950 dark:text-white">Teams transcript auto-sync</h2>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-warning-500/30 bg-warning-500/10 text-warning-700 dark:text-warning-100">
              <Mic className="h-4 w-4" />
            </span>
          </div>
          <p className="mb-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Any HTTP client can deliver Teams (or Zoom / Meet) transcripts to this webhook URL. Standups appear automatically for each speaker matched to a project member.
          </p>

          <div className="flex flex-1 flex-col gap-4">
            <div className="grid gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Webhook URL</span>
              <div className="flex flex-col items-stretch gap-2 md:flex-row">
                <code className="flex-1 break-all rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 font-mono text-xs text-slate-900 dark:border-white/10 dark:bg-white/[0.045] dark:text-white">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={copyWebhookUrl}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-warning-500/30 bg-warning-500/10 px-4 text-sm font-black text-warning-700 transition hover:bg-warning-500/15 dark:text-warning-100"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </button>
              </div>
              <small className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                For external services (Power Automate, Otter.ai), expose the API on a public HTTPS URL (Cloudflare Tunnel, ngrok, or AWS deploy) and swap the host.
              </small>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/[0.035]">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Works with</span>
                <span className="h-px flex-1 bg-slate-200/80 dark:bg-white/10" />
              </div>
              <ul className="grid gap-1.5 text-sm leading-6 text-slate-700 dark:text-slate-300">
                <li className="flex items-baseline gap-2"><span className="font-mono text-[10px] text-warning-600 dark:text-warning-400">▸</span> <span><strong className="font-black">Manual VTT/TXT/MD/CSV upload</strong> on the Standup page (works today)</span></li>
                <li className="flex items-baseline gap-2"><span className="font-mono text-[10px] text-warning-600 dark:text-warning-400">▸</span> <span><strong className="font-black">Microsoft Power Automate flow</strong> where tenant Graph subscriptions are enabled</span></li>
                <li className="flex items-baseline gap-2"><span className="font-mono text-[10px] text-warning-600 dark:text-warning-400">▸</span> <span><strong className="font-black">Otter.ai / Fireflies.ai bots</strong> &mdash; user-level auth, no admin needed</span></li>
                <li className="flex items-baseline gap-2"><span className="font-mono text-[10px] text-warning-600 dark:text-warning-400">▸</span> <span><strong className="font-black">Custom Microsoft Graph poller</strong> using delegated read permissions</span></li>
                <li className="flex items-baseline gap-2"><span className="font-mono text-[10px] text-warning-600 dark:text-warning-400">▸</span> <span><strong className="font-black">Any HTTP client</strong> that can POST JSON (curl, Postman, scripts)</span></li>
              </ul>
            </div>

            <details className="mt-auto rounded-xl border border-slate-200/80 bg-slate-50/60 dark:border-white/10 dark:bg-white/[0.035]">
              <summary className="cursor-pointer p-4 text-sm font-black text-slate-900 dark:text-white">
                Show JSON body template
              </summary>
              <pre className="overflow-x-auto px-4 pb-4 font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-300">{`{
  "organizerEmail": "<sm@example.com>",
  "meetingSubject": "Daily Standup",
  "meetingId": "<optional-stable-id-for-dedup>",
  "transcript": "<WebVTT body or plain Speaker: text>"
}`}</pre>
              <p className="px-4 pb-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Authorization: the <code className="rounded bg-slate-200/60 px-1.5 py-0.5 font-mono dark:bg-white/[0.06]">organizerEmail</code> must match a project member. Returns <strong>201</strong> on success, <strong>404</strong> if the organizer isn't a project member. If any auth tokens exist, callers must also send <code className="rounded bg-slate-200/60 px-1.5 py-0.5 font-mono dark:bg-white/[0.06]">X-SprintPulse-Webhook-Token</code>.
              </p>
            </details>
          </div>
        </SectionPanel>

        <SectionPanel className="flex h-full flex-col border-l-[3px] border-l-ai-500/70 dark:border-l-ai-400/70">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-ai-700 dark:text-ai-200">Auth &middot; Per-source secrets</div>
              <h2 className="m-0 text-xl font-extrabold leading-tight text-slate-950 dark:text-white">Authentication tokens</h2>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ai-500/30 bg-ai-500/10 text-ai-700 dark:text-ai-100">
              <KeyRound className="h-4 w-4" />
            </span>
          </div>
          <p className="mb-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Mint one token per delivery source (Power Automate flow, Otter bot, etc.) so you can revoke individually. Plaintext is shown <strong className="font-black text-ai-700 dark:text-ai-100">once</strong> at mint time.
          </p>

          <div className="flex flex-1 flex-col gap-4">
            {revealedToken ? (
              <div className="grid gap-3 rounded-2xl border border-warning-500/40 bg-warning-500/10 p-4 dark:border-warning-400/40">
                <div className="flex items-center gap-2 text-sm font-black text-warning-700 dark:text-warning-100">
                  <ShieldAlert className="h-4 w-4" />
                  Token for "{revealedToken.name}" — copy now, won't be shown again
                </div>
                <div className="flex flex-col items-stretch gap-2 md:flex-row">
                  <code className="flex-1 break-all rounded-xl border border-warning-500/30 bg-white/80 px-3 py-3 font-mono text-xs text-slate-900 dark:bg-slate-950/60 dark:text-white">
                    {revealedToken.plaintext}
                  </code>
                  <button
                    type="button"
                    onClick={copyRevealedToken}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-warning-500 px-4 text-sm font-black text-white shadow-[0_10px_28px_rgba(245,158,11,0.32)] transition hover:-translate-y-0.5"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevealedToken(null)}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-warning-500/30 px-4 text-sm font-black text-warning-700 transition hover:bg-warning-500/15 dark:text-warning-100"
                  >
                    Dismiss
                  </button>
                </div>
                <p className="text-xs text-warning-700/85 dark:text-warning-200/85">
                  Add to your HTTP client as header <code className="rounded bg-white/60 px-1.5 py-0.5 font-mono dark:bg-slate-950/40">X-SprintPulse-Webhook-Token: &lt;paste&gt;</code>
                </p>
              </div>
            ) : null}

            {tokensError ? (
              <div className="rounded-xl border border-danger-500/20 bg-danger-500/10 p-3 text-sm font-black text-danger-700 dark:text-danger-200">{tokensError}</div>
            ) : null}

            {tokensLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tokens…
              </div>
            ) : tokens.length === 0 ? (
              <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-ai-500/30 bg-ai-500/[0.05] px-6 py-10 text-center dark:border-ai-400/30 dark:bg-ai-400/[0.05]">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ai-500/10 text-ai-700 dark:text-ai-100">
                  <KeyRound className="h-5 w-5" />
                </span>
                <strong className="text-sm font-black text-slate-950 dark:text-white">No webhook tokens yet</strong>
                <p className="m-0 max-w-xs text-xs leading-5 text-slate-500 dark:text-slate-400">
                  When unset, the webhook is open (organizer-must-be-a-member is the only barrier). Mint a token to require <code className="rounded bg-ai-500/10 px-1 py-0.5 font-mono dark:bg-ai-400/15">X-SprintPulse-Webhook-Token</code> on every call.
                </p>
              </div>
            ) : (
              <ul className="grid gap-2">
                {tokens.map((token) => (
                  <li
                    key={token.id}
                    className="grid items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/[0.035] md:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
                  >
                    <div className="grid min-w-0 gap-1">
                      <strong className="truncate text-sm font-black text-slate-950 dark:text-white">{token.name}</strong>
                      <code className="text-[11px] text-slate-500 dark:text-slate-400">sptk_•••{token.tokenHint}</code>
                    </div>
                    <span className="hidden text-xs text-slate-500 dark:text-slate-400 md:inline">
                      {new Date(token.createdAt).toLocaleDateString()}
                    </span>
                    <span className="hidden text-xs text-slate-500 dark:text-slate-400 md:inline">
                      {token.lastUsedAt ? `Used ${new Date(token.lastUsedAt).toLocaleDateString()}` : "Never used"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRevokeToken(token.id, token.name)}
                      disabled={revokingTokenId === token.id}
                      className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-danger-500/30 px-2.5 text-[11px] font-black text-danger-700 transition hover:bg-danger-500/10 disabled:opacity-50 dark:text-danger-200"
                    >
                      {revokingTokenId === token.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Refined bottom CTA — outline ai-tone pill, capped width, centered.
                The dashed top divider whispers "extensible — add more here". */}
            <div className="mt-auto flex justify-center border-t border-dashed border-slate-200/80 pt-5 dark:border-white/10">
              {showCreateToken ? (
                <form className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={submitCreateToken}>
                  <Input
                    value={newTokenName}
                    onChange={(event) => setNewTokenName(event.target.value)}
                    placeholder="e.g. Power Automate flow"
                    autoFocus
                    maxLength={80}
                    disabled={mintingToken}
                  />
                  <button
                    type="submit"
                    disabled={mintingToken || !newTokenName.trim()}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-ai-500 px-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(168,85,247,0.28)] transition hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {mintingToken ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreateToken(false); setNewTokenName(""); }}
                    disabled={mintingToken}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300/60 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-200/40 dark:border-white/10 dark:text-slate-200"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateToken(true)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-ai-500/40 bg-ai-500/10 px-5 text-sm font-black text-ai-700 transition hover:-translate-y-0.5 hover:border-ai-500/60 hover:bg-ai-500/15 dark:text-ai-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Generate new token
                </button>
              )}
            </div>
          </div>
        </SectionPanel>
      </section>

      {/* ─── 05 / Agent access · MCP ───────────────────────────────────────── */}
      <div className="flex items-baseline gap-4 pt-2">
        <span className="font-mono text-[0.72rem] font-black tracking-wider text-ai-500 dark:text-ai-400">05</span>
        <span className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-ai-700 dark:text-ai-200">Agent access &middot; MCP</span>
        <span className="h-px flex-1 bg-gradient-to-r from-ai-500/40 via-ai-500/10 to-transparent dark:from-ai-400/30 dark:via-ai-400/[0.05]" />
      </div>

      <section id="mcp" className="grid scroll-mt-24 gap-5">
        <SectionPanel className="relative overflow-hidden border-ai-500/30 bg-gradient-to-br from-ai-500/[0.06] via-transparent to-ai-500/[0.03] dark:border-ai-400/30 dark:from-ai-400/10">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-ai-500/15 blur-3xl dark:bg-ai-400/15" />
          <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-ai-500/10 blur-3xl dark:bg-ai-400/10" />

          <div className="relative">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-ai-500/30 bg-ai-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-ai-700 dark:text-ai-100">
                  <span className="relative inline-flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ai-500 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ai-500" />
                  </span>
                  Model Context Protocol
                </div>
                <h2 className="m-0 text-2xl font-extrabold leading-tight tracking-tight text-slate-950 dark:text-white">Agent integration</h2>
                <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Drop SprintPulse into Claude Code, Cursor, or any Model Context Protocol host. Agents get a tool catalog that mirrors the REST API — same backend, but agent-callable.
                </p>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-ai-500/30 bg-gradient-to-br from-ai-500/20 to-ai-500/5 text-ai-700 shadow-sm dark:text-ai-100">
                <Bot className="h-5 w-5" />
              </span>
            </div>

            <div className="grid items-stretch gap-5 xl:grid-cols-2">
              <div className="flex min-h-[360px] flex-col rounded-2xl border border-slate-200/80 bg-white/55 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
                <div className="flex h-8 items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-700 dark:text-slate-200">Tool catalog</span>
                  <span className="inline-flex h-7 items-center rounded-md border border-slate-200/70 bg-white/50 px-2 font-mono text-[10px] font-bold text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">{mcpTools.length} tools</span>
                </div>
                <ul className="mt-3 grid content-start gap-2">
                  {mcpTools.map((tool, idx) => (
                    <li key={tool.name} className="group grid items-baseline gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 transition hover:border-ai-500/30 hover:bg-ai-500/[0.04] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-ai-400/[0.06] md:grid-cols-[28px_minmax(150px,auto)_minmax(0,1fr)]">
                      <span className="font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500">{String(idx + 1).padStart(2, "0")}</span>
                      <code className="shrink-0 rounded bg-ai-500/10 px-2 py-0.5 font-mono text-xs font-black text-ai-700 dark:bg-ai-400/15 dark:text-ai-100">
                        {tool.name}
                      </code>
                      <span className="text-xs leading-5 text-slate-600 dark:text-slate-400">{tool.purpose}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto rounded-xl border border-ai-500/25 bg-ai-500/[0.06] p-4 dark:border-ai-400/25 dark:bg-ai-400/[0.06]">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-ai-700 dark:text-ai-200" />
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-ai-700 dark:text-ai-200">Example agent prompts</span>
                  </div>
                  <ul className="grid gap-1.5 text-sm leading-6 text-ai-700 dark:text-ai-100">
                    <li className="flex items-baseline gap-2"><span className="font-mono text-xs text-ai-500">›</span> "Look up risk on this project. If team health is below 70, drill into each member."</li>
                    <li className="flex items-baseline gap-2"><span className="font-mono text-xs text-ai-500">›</span> "Here's today's standup transcript [paste]. Parse it and report missing members."</li>
                    <li className="flex items-baseline gap-2"><span className="font-mono text-xs text-ai-500">›</span> "Run the PR review tool for every developer. Summarise the top 3 review-pressure risks."</li>
                  </ul>
                </div>
              </div>

              <div className="flex min-h-[360px] flex-col rounded-2xl border border-slate-200/80 bg-white/55 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
                <div className="flex h-8 items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-700 dark:text-slate-200">Host config</span>
                  <button
                    type="button"
                    onClick={copyMcpConfig}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-ai-500/30 bg-ai-500/10 px-2.5 text-[11px] font-black text-ai-700 transition hover:bg-ai-500/15 dark:text-ai-100"
                  >
                    <Copy className="h-3 w-3" />
                    Copy config
                  </button>
                </div>
                <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800/30 bg-slate-950 shadow-[0_18px_40px_rgba(15,23,42,0.18)] dark:border-white/10">
                  <div className="flex items-center gap-1.5 border-b border-white/10 bg-slate-900/80 px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" aria-hidden />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" aria-hidden />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" aria-hidden />
                    <span className="ml-2 font-mono text-[10px] text-slate-400">mcp_settings.json</span>
                  </div>
                  <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-slate-200">{mcpConfigSnippet}</pre>
                </div>
                <p className="m-0 mt-3 rounded-xl border border-slate-200/70 bg-white/55 px-3 py-2 text-xs leading-5 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                  Save into <code className="rounded bg-slate-200/60 px-1.5 py-0.5 font-mono dark:bg-white/[0.06]">~/.claude/mcp_settings.json</code> or <code className="rounded bg-slate-200/60 px-1.5 py-0.5 font-mono dark:bg-white/[0.06]">~/.cursor/mcp.json</code>. Build once with <code className="rounded bg-slate-200/60 px-1.5 py-0.5 font-mono dark:bg-white/[0.06]">npm run build -w packages/mcp-server</code>, then restart the host.
                </p>
              </div>
            </div>

          </div>
        </SectionPanel>
      </section>
    </div>
  );
}
