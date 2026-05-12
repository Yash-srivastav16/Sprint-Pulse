import { FormEvent, useState } from "react";
import { ArrowRight, Cloud, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";

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
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Existing workspace</p>
          <h1>Connect Jira project</h1>
          <p>Bring project, sprint, issue, and team movement into SprintPulse for delivery analysis.</p>
        </div>
      </section>

      <form className="panel setup-form" onSubmit={connectProject}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Jira details</p>
            <h2>Fetch sprint context</h2>
          </div>
          <Cloud size={22} />
        </div>
        <div className="form-grid">
          <label className="field-group">
            <span>Jira site</span>
            <input
              value={jiraSite}
              onChange={(event) => setJiraSite(event.target.value)}
              placeholder="your-company.atlassian.net"
              required
            />
          </label>
          <label className="field-group">
            <span>Project key</span>
            <input
              value={projectKey}
              onChange={(event) => setProjectKey(event.target.value.toUpperCase())}
              placeholder="SP"
              required
            />
          </label>
        </div>
        <div className="jira-preview">
          <strong>Import preview</strong>
          <p>Project details, active sprint, issue movement, assignees, and team members will be prepared for this workspace.</p>
        </div>
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
          <span>Connect project</span>
        </button>
        {error ? <p className="form-error">{error}</p> : null}
      </form>
    </div>
  );
}
