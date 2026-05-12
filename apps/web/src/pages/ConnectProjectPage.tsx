import { FormEvent, useState } from "react";
import { ArrowRight, Cloud, KeyRound, Link2, Loader2, PlugZap, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import "../styles/project-flow.css";

export function ConnectProjectPage() {
  const { persona } = useAuth();
  const { selectProject } = useProject();
  const navigate = useNavigate();
  const [jiraSite, setJiraSite] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!persona) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.connectJiraProject({
        personaId: persona.id,
        jiraSite,
        projectKey
      });
      selectProject(response.project.id, {
        source: "jira",
        projectName: response.project.name,
        projectKey: response.project.key,
        sprintName: response.project.sprint.name,
        sprintGoal: response.project.sprint.goal,
        jiraSite: response.project.jiraSite,
        importedAt: response.importedAt
      });
      navigate(`/projects/${response.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Jira connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack project-flow-page setup-flow setup-connect-flow">
      <section className="page-heading flow-hero setup-hero connect-hero">
        <div className="flow-hero-copy">
          <div className="flow-kicker-row">
            <p className="eyebrow">Existing workspace</p>
            <span className="flow-live-chip">
              <Cloud size={15} />
              Jira source
            </span>
          </div>
          <h1>Connect Jira project</h1>
          <p className="flow-hero-lede">Bring project, sprint, issue, and team movement into SprintPulse for delivery analysis.</p>
          <div className="flow-hero-pills" aria-label="Jira connection setup summary">
            <span>
              <Link2 size={15} />
              {jiraSite.trim() ? "Site ready" : "Site required"}
            </span>
            <span>
              <KeyRound size={15} />
              {projectKey.trim() ? "Key ready" : "Key required"}
            </span>
          </div>
        </div>
        <div className="setup-hero-panel" aria-label="Jira connection preview">
          <span className="setup-hero-icon">
            <Cloud size={24} />
          </span>
          <div>
            <strong>{projectKey.trim() || "Project key"}</strong>
            <span>{jiraSite.trim() || "Jira site"}</span>
          </div>
          <small>Import sprint context</small>
        </div>
      </section>

      <section className="setup-shell">
        <aside className="setup-context-panel" aria-label="Connect project flow">
          <p className="eyebrow">Connected flow</p>
          <h2>Pull delivery signals from the source of work.</h2>
          <div className="setup-rail-list">
            <span>
              <Link2 size={16} />
              Jira site
            </span>
            <span>
              <KeyRound size={16} />
              Project key
            </span>
            <span>
              <RefreshCw size={16} />
              Sprint import
            </span>
          </div>
        </aside>

        <form className="panel setup-form flow-form" onSubmit={connectProject}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Jira details</p>
              <h2>Fetch sprint context</h2>
            </div>
            <Cloud size={22} />
          </div>
          <div className="form-grid">
            <label className="field-group">
              <span>
                <Link2 size={15} />
                Jira site
              </span>
              <input
                value={jiraSite}
                onChange={(event) => setJiraSite(event.target.value)}
                placeholder="company.atlassian.net"
                required
              />
            </label>
            <label className="field-group">
              <span>
                <KeyRound size={15} />
                Project key
              </span>
              <input
                value={projectKey}
                onChange={(event) => setProjectKey(event.target.value.toUpperCase())}
                placeholder="KEY"
                required
              />
            </label>
          </div>
          <div className="jira-preview flow-import-preview">
            <PlugZap size={18} />
            <div>
              <strong>Import preview</strong>
              <p>Project details, active sprint, issue movement, assignees, and team members will be prepared for this workspace.</p>
            </div>
          </div>
          <button className="primary-button flow-submit-button" type="submit" disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
            <span>Connect project</span>
          </button>
          {error ? <p className="form-error">{error}</p> : null}
        </form>
      </section>
    </div>
  );
}
