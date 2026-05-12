import { FormEvent, useEffect, useState } from "react";
import { Cloud, GitBranch, Loader2, PlugZap, RefreshCw, Save, ShieldAlert, TicketCheck, Workflow } from "lucide-react";
import { useParams } from "react-router-dom";
import type { IntegrationStatusResponse } from "@sprintpulse/shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

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
      loadIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Jira configuration failed");
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
      loadIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Jira sync failed");
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
      loadIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Git configuration failed");
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
      loadIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Git sync failed");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="center-state">
        <Loader2 className="spin" size={26} />
        <span>Loading integrations</span>
      </div>
    );
  }

  if (error && !data) {
    return <div className="center-state error-state">{error}</div>;
  }

  if (!data) {
    return <div className="center-state error-state">Integrations unavailable</div>;
  }

  const connectedCount = [data.jira, data.git].filter(Boolean).length;
  const lastSyncAt = [data.jira?.lastSyncAt, data.git?.lastSyncAt].filter(Boolean).sort().at(-1);

  return (
    <div className="page-stack ops-page">
      <section className="page-heading ops-heading">
        <div>
          <p className="eyebrow">{data.project.key} integrations</p>
          <h1>Configure sync</h1>
          <p>Connect Jira and GitHub signals to the selected project. Guided sync keeps issue and commit signals reliable for the presentation.</p>
        </div>
        <div className="ops-hero-metrics">
          <div>
            <strong>{connectedCount}/2</strong>
            <span>connected</span>
          </div>
          <div>
            <strong>{data.issuePreview.length + data.commitPreview.length}</strong>
            <span>signals</span>
          </div>
          <div className="ops-heading-icon">
            <PlugZap size={28} />
          </div>
        </div>
      </section>

      <section className="ops-kpi-grid">
        <article className="ops-kpi-card">
          <Cloud size={20} />
          <span>Jira status</span>
          <strong>{data.jira?.status ?? "Not connected"}</strong>
          <small>{data.jira?.projectKey ?? "Add the sprint project key"}</small>
        </article>
        <article className="ops-kpi-card">
          <GitBranch size={20} />
          <span>GitHub status</span>
          <strong>{data.git?.status ?? "Not connected"}</strong>
          <small>{data.git ? `${data.git.repoOwner}/${data.git.repoName}` : "Add the delivery repository"}</small>
        </article>
        <article className="ops-kpi-card">
          <Workflow size={20} />
          <span>Last sync</span>
          <strong>{lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : "Pending"}</strong>
          <small>{lastSyncAt ? new Date(lastSyncAt).toLocaleDateString() : "Run a sync after configuring"}</small>
        </article>
      </section>

      {!canConfigure ? (
        <section className="panel permission-panel">
          <ShieldAlert size={20} />
          <span>Developers can view sync status. Configuration is owned by Scrum Master or project owners.</span>
        </section>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}

      <section className="integration-grid">
        <form className="panel setup-form compact-form" onSubmit={configureJira}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Jira</p>
              <h2>{data.jira ? "Configured" : "Connect project"}</h2>
            </div>
            <Cloud size={22} />
          </div>
          <div className="form-grid single">
            <label className="field-group">
              <span>Jira site</span>
              <input value={jiraSite} onChange={(event) => setJiraSite(event.target.value)} placeholder="company.atlassian.net" disabled={!canConfigure} required />
            </label>
            <label className="field-group">
              <span>Project key</span>
              <input value={jiraKey} onChange={(event) => setJiraKey(event.target.value.toUpperCase())} placeholder={data.project.key} disabled={!canConfigure} required />
            </label>
          </div>
          <div className="integration-status-line">
            <span>Status</span>
            <strong>{data.jira?.status ?? "not-configured"}</strong>
            <small>{data.jira?.lastSyncAt ? new Date(data.jira.lastSyncAt).toLocaleString() : "No sync yet"}</small>
          </div>
          {canConfigure ? (
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={Boolean(saving)}>
                {saving === "jira" ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                <span>Save Jira</span>
              </button>
              <button className="icon-text-button" type="button" onClick={syncJira} disabled={Boolean(saving) || !data.jira}>
                {saving === "jira-sync" ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
                <span>Sync issues</span>
              </button>
            </div>
          ) : null}
        </form>

        <form className="panel setup-form compact-form" onSubmit={configureGit}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">GitHub</p>
              <h2>{data.git ? "Configured" : "Connect repository"}</h2>
            </div>
            <GitBranch size={22} />
          </div>
          <div className="form-grid single">
            <label className="field-group">
              <span>Repo owner</span>
              <input value={repoOwner} onChange={(event) => setRepoOwner(event.target.value)} placeholder="semicolon-team" disabled={!canConfigure} required />
            </label>
            <label className="field-group">
              <span>Repo name</span>
              <input value={repoName} onChange={(event) => setRepoName(event.target.value)} placeholder="sprintpulse-ai" disabled={!canConfigure} required />
            </label>
            <label className="field-group">
              <span>Default branch</span>
              <input value={defaultBranch} onChange={(event) => setDefaultBranch(event.target.value)} placeholder="main" disabled={!canConfigure} required />
            </label>
          </div>
          <div className="integration-status-line">
            <span>Status</span>
            <strong>{data.git?.status ?? "not-configured"}</strong>
            <small>{data.git?.lastSyncAt ? new Date(data.git.lastSyncAt).toLocaleString() : "No sync yet"}</small>
          </div>
          {canConfigure ? (
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={Boolean(saving)}>
                {saving === "git" ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                <span>Save GitHub</span>
              </button>
              <button className="icon-text-button" type="button" onClick={syncGit} disabled={Boolean(saving) || !data.git}>
                {saving === "git-sync" ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
                <span>Sync commits</span>
              </button>
            </div>
          ) : null}
        </form>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Jira preview</p>
              <h2>{data.issuePreview.length} synced issues</h2>
            </div>
            <TicketCheck size={20} />
          </div>
          <div className="ticket-list">
            {data.issuePreview.length ? data.issuePreview.map((issue) => (
              <div className="ticket-row" key={issue.id}>
                <strong>{issue.issueKey}</strong>
                <span>{issue.summary}</span>
                <em>{issue.status}</em>
                <small>{issue.daysIdle}d idle</small>
              </div>
            )) : <div className="empty-state">Sync Jira to preview sprint issues.</div>}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Git preview</p>
              <h2>{data.commitPreview.length} synced commits</h2>
            </div>
          </div>
          <div className="ticket-list">
            {data.commitPreview.length ? data.commitPreview.map((commit) => (
              <div className="ticket-row" key={commit.id}>
                <strong>{commit.sha.slice(0, 9)}</strong>
                <span>{commit.message}</span>
                <em>{commit.additions}+ / {commit.deletions}-</em>
                <small>{new Date(commit.committedAt).toLocaleDateString()}</small>
              </div>
            )) : <div className="empty-state">Sync GitHub to preview commit activity.</div>}
          </div>
        </article>
      </section>
    </div>
  );
}
