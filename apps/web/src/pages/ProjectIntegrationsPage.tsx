import { FormEvent, useEffect, useState } from "react";
import {
  Bot,
  Cloud,
  Code2,
  Copy,
  ExternalLink,
  FileJson2,
  GitBranch,
  GitCommitHorizontal,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mic,
  Plus,
  PlugZap,
  RefreshCw,
  Save,
  ServerCog,
  ShieldAlert,
  Sparkles,
  Terminal,
  TicketCheck,
  Trash2,
  Workflow
} from "lucide-react";
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

const compactToneClasses: Record<string, string> = {
  primary: "border-primary-500/25 bg-primary-500/10 text-primary-700 dark:border-primary-300/25 dark:text-primary-100",
  info: "border-info-500/25 bg-info-500/10 text-info-700 dark:border-info-300/25 dark:text-info-100",
  warning: "border-warning-500/30 bg-warning-500/10 text-warning-700 dark:border-warning-300/30 dark:text-warning-100",
  ai: "border-ai-500/25 bg-ai-500/10 text-ai-700 dark:border-ai-300/25 dark:text-ai-100",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-300/25 dark:text-emerald-100"
};

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
    { name: "get_project_risk", purpose: "Team health + top risks + P1 + recommended actions", mode: "Read", tone: "info" },
    { name: "get_member_health", purpose: "Per-member pulse, flags, evidence, recent standups", mode: "Read", tone: "info" },
    { name: "submit_standup", purpose: "Create a structured standup entry for a member", mode: "Write", tone: "success" },
    { name: "parse_transcript", purpose: "VTT or plain text → speaker-mapped standups + risk update", mode: "Ingest", tone: "warning" },
    { name: "run_member_pr_review", purpose: "AI review of a member's recent commits/PRs", mode: "Analyze", tone: "ai" },
    { name: "run_qa_activity_review", purpose: "AI review of QA activity: test case creation + test execution", mode: "Analyze", tone: "ai" }
  ];

  const webhookWorksWith = [
    {
      label: "Manual VTT/TXT/MD/CSV upload",
      detail: "on the Standup page (works today)"
    },
    {
      label: "Microsoft Power Automate flow",
      detail: "where tenant Graph subscriptions are enabled"
    },
    {
      label: "Otter.ai / Fireflies.ai bots",
      detail: "user-level auth, no admin needed"
    },
    {
      label: "Custom Microsoft Graph poller",
      detail: "using delegated read permissions"
    }
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

      <section id="teams-webhook" className="grid scroll-mt-24 gap-4">
        <SectionPanel className="border-l-[3px] border-l-warning-500/70 dark:border-l-warning-400/70">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-warning-700 dark:text-warning-200">
                  Endpoint &middot; Inbound
                </div>
                <h2 className="m-0 text-[1.35rem] font-extrabold leading-tight tracking-normal text-slate-950 dark:text-white">Teams transcript auto-sync</h2>
              </div>
            </div>
            <p className="m-0 w-full text-[0.92rem] leading-6 text-slate-600 dark:text-slate-300">
              POST Teams, Zoom, or Meet transcripts here. SprintPulse matches speakers to project members and creates standups automatically.
            </p>
          </div>

          <div className="mt-5 grid min-w-0 max-w-full items-start gap-5 overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.48fr)]">
            <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden">
              <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.035]">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Webhook URL</span>
                </div>
                <div className="grid min-w-0 max-w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200/70 bg-white/80 dark:border-white/10 dark:bg-slate-950/35">
                    <code className="block w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden whitespace-nowrap px-3 py-3 font-mono text-xs leading-6 text-slate-900 dark:text-white">
                      {webhookUrl}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={copyWebhookUrl}
                    className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-warning-500/30 bg-warning-500/10 px-5 text-sm font-black text-warning-700 transition hover:bg-warning-500/15 sm:w-auto dark:text-warning-100"
                  >
                    <Copy className="h-4 w-4" />
                    Copy URL
                  </button>
                </div>
              </div>

              <div className="grid gap-3">
                <details className="group rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/[0.035]">
                  <summary className="cursor-pointer list-none">
                    <div className="flex min-h-9 items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Workflow className="h-4 w-4 shrink-0 text-warning-700 dark:text-warning-100" />
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200">Works with</span>
                      </div>
                      <span className="text-sm font-black text-warning-700 group-open:hidden dark:text-warning-100">Expand</span>
                      <span className="hidden text-sm font-black text-warning-700 group-open:inline dark:text-warning-100">Collapse</span>
                    </div>
                  </summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {webhookWorksWith.map((source) => (
                      <div
                        className="flex min-w-0 items-start gap-2 rounded-lg border border-warning-500/20 bg-white/70 p-3 text-sm dark:border-warning-400/20 dark:bg-white/[0.05]"
                        key={source.label}
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning-500" />
                        <span className="min-w-0 leading-6">
                          <strong className="font-black text-warning-700 dark:text-warning-100">{source.label}</strong>{" "}
                          <span className="text-slate-600 dark:text-slate-300">{source.detail}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </details>

                <details className="group rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/[0.035]">
                  <summary className="cursor-pointer list-none">
                    <div className="flex min-h-9 items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileJson2 className="h-4 w-4 shrink-0 text-warning-700 dark:text-warning-100" />
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200">JSON body</span>
                      </div>
                      <span className="text-sm font-black text-warning-700 group-open:hidden dark:text-warning-100">Expand</span>
                      <span className="hidden text-sm font-black text-warning-700 group-open:inline dark:text-warning-100">Collapse</span>
                    </div>
                  </summary>
                  <div className="mt-2 grid gap-3">
                    <pre className="max-h-40 overflow-auto rounded-xl border border-slate-800/30 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 shadow-[0_12px_28px_rgba(15,23,42,0.14)] dark:border-white/10">{`{
  "organizerEmail": "<sm@example.com>",
  "meetingSubject": "Daily Standup",
  "meetingId": "<optional-stable-id-for-dedup>",
  "transcript": "<WebVTT body or plain Speaker: text>"
}`}</pre>
                    <div className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-white/55 p-3 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                      <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-700 dark:text-warning-100" />
                      <span>
                        <code className="rounded bg-slate-200/60 px-1.5 py-0.5 font-mono dark:bg-white/[0.06]">organizerEmail</code> must match a project member. Success returns <strong>201</strong>; unknown organizers return <strong>404</strong>. If tokens exist, include <code className="rounded bg-slate-200/60 px-1.5 py-0.5 font-mono dark:bg-white/[0.06]">X-SprintPulse-Webhook-Token</code>.
                      </span>
                    </div>
                  </div>
                </details>
              </div>
            </div>

            <aside className="grid min-w-0 content-start gap-3 rounded-xl border border-slate-200/80 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.035]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-ai-700 dark:text-ai-200">Auth &middot; Per-source secrets</div>
                  <h3 className="m-0 text-[1.35rem] font-extrabold leading-tight tracking-normal text-slate-950 dark:text-white">Authentication tokens</h3>
                </div>
                {!canConfigure ? (
                  <StatusPill icon={ShieldAlert} tone="neutral">Read only</StatusPill>
                ) : showCreateToken ? null : (
                  <button
                    type="button"
                    onClick={() => setShowCreateToken(true)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-ai-500/35 bg-ai-500/10 px-4 text-sm font-black text-ai-700 transition hover:bg-ai-500/15 dark:text-ai-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New
                  </button>
                )}
              </div>
              <p className="m-0 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Create one token per source so each can be revoked independently. Plaintext appears once.
              </p>

              {!canConfigure ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-sm font-semibold leading-6 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  Token changes are limited to project owners.
                </div>
              ) : showCreateToken ? (
                <form className="grid grid-cols-1 gap-3 rounded-xl border border-ai-500/25 bg-ai-500/[0.05] p-3 sm:grid-cols-[1fr_auto_auto] xl:grid-cols-1" onSubmit={submitCreateToken}>
                  <Input
                    value={newTokenName}
                    onChange={(event) => setNewTokenName(event.target.value)}
                    placeholder="e.g. Power Automate flow"
                    autoFocus
                    maxLength={80}
                    disabled={mintingToken}
                  />
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
                    <button
                      type="submit"
                      disabled={mintingToken || !newTokenName.trim()}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ai-500 px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(168,85,247,0.22)] transition hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      {mintingToken ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCreateToken(false); setNewTokenName(""); }}
                      disabled={mintingToken}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300/60 px-5 text-sm font-black text-slate-700 transition hover:bg-slate-200/40 dark:border-white/10 dark:text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              {revealedToken ? (
                <div className="grid gap-3 rounded-xl border border-warning-500/40 bg-warning-500/10 p-4 dark:border-warning-400/40">
                  <div className="flex items-center gap-2 text-sm font-black text-warning-700 dark:text-warning-100">
                    <ShieldAlert className="h-4 w-4" />
                    Token for "{revealedToken.name}" — copy now
                  </div>
                  <code className="max-h-24 overflow-auto break-all rounded-xl border border-warning-500/30 bg-white/80 px-3 py-3 font-mono text-xs text-slate-900 dark:bg-slate-950/60 dark:text-white">
                    {revealedToken.plaintext}
                  </code>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
                    <button
                      type="button"
                      onClick={copyRevealedToken}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-warning-500 px-5 text-sm font-black text-white shadow-[0_10px_28px_rgba(245,158,11,0.28)] transition hover:-translate-y-0.5"
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => setRevealedToken(null)}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-warning-500/30 px-5 text-sm font-black text-warning-700 transition hover:bg-warning-500/15 dark:text-warning-100"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}

              {tokensError ? (
                <div className="rounded-lg border border-danger-500/20 bg-danger-500/10 p-3 text-sm font-black text-danger-700 dark:text-danger-200">{tokensError}</div>
              ) : null}

              {tokensLoading ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading tokens…
                </div>
              ) : tokens.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-ai-500/30 bg-ai-500/[0.05] px-3 py-2.5 dark:border-ai-400/30 dark:bg-ai-400/[0.05]">
                  <KeyRound className="h-4 w-4 shrink-0 text-ai-700 dark:text-ai-100" />
                  <div className="min-w-0">
                    <strong className="block text-sm font-black text-slate-950 dark:text-white">No tokens yet</strong>
                    <p className="m-0 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Mint one to require the webhook token header.
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="grid max-h-44 gap-1.5 overflow-auto pr-1">
                  {tokens.map((token) => (
                    <li
                      key={token.id}
                      className="grid items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.035] md:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div className="grid min-w-0 gap-0.5">
                        <strong className="truncate text-sm font-black text-slate-950 dark:text-white">{token.name}</strong>
                        <code className="text-[11px] text-slate-500 dark:text-slate-400">sptk_•••{token.tokenHint}</code>
                      </div>
                      <span className="hidden text-xs text-slate-500 dark:text-slate-400 md:inline xl:hidden">
                        {new Date(token.createdAt).toLocaleDateString()}
                      </span>
                      <span className="hidden text-xs text-slate-500 dark:text-slate-400 md:inline xl:hidden">
                        {token.lastUsedAt ? `Used ${new Date(token.lastUsedAt).toLocaleDateString()}` : "Never used"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRevokeToken(token.id, token.name)}
                        disabled={revokingTokenId === token.id}
                        className="inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-danger-500/30 px-2.5 text-[11px] font-black text-danger-700 transition hover:bg-danger-500/10 disabled:opacity-50 dark:text-danger-200"
                      >
                        {revokingTokenId === token.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        Revoke
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        </SectionPanel>
      </section>

      {/* ─── 05 / Agent access · MCP ───────────────────────────────────────── */}
      <div className="flex items-baseline gap-4 pt-2">
        <span className="font-mono text-[0.72rem] font-black tracking-wider text-slate-400 dark:text-slate-500">05</span>
        <span className="text-[0.66rem] font-black uppercase tracking-[0.22em] text-slate-700 dark:text-slate-300">Agent access &middot; MCP</span>
        <span className="h-px flex-1 bg-gradient-to-r from-slate-300/70 via-slate-200/30 to-transparent dark:from-white/15 dark:via-white/[0.04]" />
      </div>

      <section id="mcp" className="grid scroll-mt-24 gap-5">
        <SectionPanel className="border-l-[3px] border-l-ai-500/70 bg-gradient-to-br from-ai-500/[0.05] via-white/60 to-primary-500/[0.04] dark:border-l-ai-400/70 dark:from-ai-400/[0.10] dark:via-white/[0.03] dark:to-primary-400/[0.08]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-ai-700 dark:text-ai-200">Agent access</div>
              <h2 className="m-0 text-[1.35rem] font-extrabold leading-tight tracking-normal text-slate-950 dark:text-white">Agent integration</h2>
              <p className="m-0 mt-2 w-full text-[0.92rem] leading-6 text-slate-600 dark:text-slate-300">
                Use SprintPulse in Claude Code, Cursor, or any MCP host. Agents get the same REST-backed tool catalog.
              </p>
            </div>
          </div>

          <div className="mt-5 grid items-start gap-5">
            <div className="rounded-xl border border-slate-200/80 bg-white/65 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-ai-700 dark:text-ai-100" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-700 dark:text-slate-200">Tool catalog</span>
                </div>
                <StatusPill icon={ServerCog} tone="ai">{mcpTools.length} tools</StatusPill>
              </div>
              <ul className="grid gap-2 lg:grid-cols-2">
                {mcpTools.map((tool, idx) => (
                  <li
                    key={tool.name}
                    className="group grid items-center gap-x-2 gap-y-1 rounded-lg border border-slate-200/80 bg-white/75 p-3 transition hover:border-ai-500/30 hover:bg-ai-500/[0.04] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-ai-400/[0.06] sm:grid-cols-[22px_minmax(0,1fr)_auto]"
                  >
                    <span className="font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500">{String(idx + 1).padStart(2, "0")}</span>
                    <code className="truncate rounded-md bg-ai-500/10 px-2 py-1 font-mono text-xs font-black text-ai-700 dark:bg-ai-400/15 dark:text-ai-100">
                      {tool.name}
                    </code>
                    <span className={cn("w-fit rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", compactToneClasses[tool.tone])}>
                      {tool.mode}
                    </span>
                    <span className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300 sm:col-start-2 sm:col-end-4" title={tool.purpose}>{tool.purpose}</span>
                  </li>
                ))}
              </ul>
              <details className="group mt-3 rounded-xl border border-ai-500/25 bg-ai-500/[0.06] p-4 dark:border-ai-400/25 dark:bg-ai-400/[0.06]">
                <summary className="cursor-pointer list-none">
                  <div className="flex min-h-9 items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-ai-700 dark:text-ai-200" />
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-ai-700 dark:text-ai-100">Example agent prompts</span>
                    </div>
                    <span className="text-sm font-black text-ai-700 group-open:hidden dark:text-ai-100">Expand</span>
                    <span className="hidden text-sm font-black text-ai-700 group-open:inline dark:text-ai-100">Collapse</span>
                  </div>
                </summary>
                <ul className="mt-2 grid gap-1.5 text-sm leading-6 text-ai-700 dark:text-ai-100">
                  <li className="flex items-baseline gap-2"><span className="font-mono text-xs text-ai-500">›</span> "Look up risk on this project. If team health is below 70, drill into each member."</li>
                  <li className="flex items-baseline gap-2"><span className="font-mono text-xs text-ai-500">›</span> "Here's today's standup transcript [paste]. Parse it and report missing members."</li>
                  <li className="flex items-baseline gap-2"><span className="font-mono text-xs text-ai-500">›</span> "Run the PR review tool for every developer. Summarise the top 3 review-pressure risks."</li>
                </ul>
              </details>
            </div>

            <details className="group rounded-xl border border-slate-200/80 bg-white/65 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <summary className="cursor-pointer list-none">
                <div className="flex min-h-9 items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Terminal className="h-4 w-4 shrink-0 text-ai-700 dark:text-ai-100" />
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-700 dark:text-slate-200">Host config</span>
                  </div>
                  <span className="text-sm font-black text-ai-700 group-open:hidden dark:text-ai-100">Expand</span>
                  <span className="hidden text-sm font-black text-ai-700 group-open:inline dark:text-ai-100">Collapse</span>
                </div>
              </summary>
              <div className="mt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={copyMcpConfig}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-ai-500/30 bg-ai-500/10 px-4 text-sm font-black text-ai-700 transition hover:bg-ai-500/15 dark:text-ai-100"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
              <div className="mt-3 flex max-h-[300px] min-h-[220px] flex-col overflow-hidden rounded-xl border border-slate-800/30 bg-slate-950 shadow-[0_18px_40px_rgba(15,23,42,0.16)] dark:border-white/10">
                <div className="flex items-center gap-1.5 border-b border-white/10 bg-slate-900/80 px-3 py-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" aria-hidden />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" aria-hidden />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" aria-hidden />
                  <span className="ml-2 font-mono text-[10px] text-slate-400">mcp_settings.json</span>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-slate-200">{mcpConfigSnippet}</pre>
              </div>
              <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                <div className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-white/55 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ai-700 dark:text-ai-100" />
                  <span>
                    Save to <code className="rounded bg-slate-200/60 px-1.5 py-0.5 font-mono dark:bg-white/[0.06]">~/.claude/mcp_settings.json</code> or <code className="rounded bg-slate-200/60 px-1.5 py-0.5 font-mono dark:bg-white/[0.06]">~/.cursor/mcp.json</code>. Build with <code className="rounded bg-slate-200/60 px-1.5 py-0.5 font-mono dark:bg-white/[0.06]">npm run build -w packages/mcp-server</code>, then restart.
                  </span>
                </div>
              </div>
            </details>
          </div>
        </SectionPanel>
      </section>
    </div>
  );
}
