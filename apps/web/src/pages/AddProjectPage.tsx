import { FormEvent, useState } from "react";
import { ArrowRight, FolderPlus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

export function AddProjectPage() {
  const { persona } = useAuth();
  const { selectProject } = useProject();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [sprintName, setSprintName] = useState("");
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState(formatDate(new Date(Date.now() + 13 * 24 * 60 * 60 * 1000)));
  const [sprintGoal, setSprintGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!persona) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.createProject({
        personaId: persona.id,
        projectName,
        projectKey,
        sprintName,
        sprintGoal,
        startDate,
        endDate,
        members: []
      });
      selectProject(response.project.id, {
        source: "manual",
        projectName: response.project.name,
        projectKey: response.project.key,
        sprintName: response.project.sprint.name,
        sprintGoal: response.project.sprint.goal
      });
      navigate(`/projects/${response.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project creation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">New workspace</p>
          <h1>Create project</h1>
          <p>Create a project and sprint context for a team that is not connected through Jira yet.</p>
        </div>
      </section>

      <form className="panel setup-form" onSubmit={createProject}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Project identity</p>
            <h2>Project and sprint details</h2>
          </div>
          <FolderPlus size={22} />
        </div>
        <div className="form-grid">
          <label className="field-group">
            <span>Project name</span>
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Customer Portal Revamp"
              required
            />
          </label>
          <label className="field-group">
            <span>Project key</span>
            <input
              value={projectKey}
              onChange={(event) => setProjectKey(event.target.value.toUpperCase())}
              placeholder="CPR"
              required
            />
          </label>
          <label className="field-group">
            <span>Sprint name</span>
            <input
              value={sprintName}
              onChange={(event) => setSprintName(event.target.value)}
              placeholder="Sprint 1"
              required
            />
          </label>
          <label className="field-group">
            <span>Start date</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
          </label>
          <label className="field-group">
            <span>End date</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
          </label>
          <label className="field-group wide">
            <span>Sprint goal</span>
            <textarea
              value={sprintGoal}
              onChange={(event) => setSprintGoal(event.target.value)}
              placeholder="Ship the first usable project flow with clear ownership, risks, and standup visibility."
              required
            />
          </label>
        </div>
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
          <span>Create project workspace</span>
        </button>
        {error ? <p className="form-error">{error}</p> : null}
      </form>
    </div>
  );
}
