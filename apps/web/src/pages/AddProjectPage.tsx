import { FormEvent, useState } from "react";
import { ArrowRight, CalendarDays, FolderPlus, KeyRound, Layers3, Loader2, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import "../styles/project-flow.css";

const formatDate = (date: Date) => date.toISOString().slice(0, 10);
const msPerDay = 24 * 60 * 60 * 1000;

function formatSetupDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "Date pending";
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function sprintLengthLabel(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Dates pending";
  }

  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay) + 1);
  return `${days} day${days === 1 ? "" : "s"}`;
}

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
    <div className="page-stack project-flow-page setup-flow setup-create-flow">
      <section className="page-heading flow-hero setup-hero">
        <div className="flow-hero-copy">
          <div className="flow-kicker-row">
            <p className="eyebrow">New workspace</p>
            <span className="flow-live-chip">
              <FolderPlus size={15} />
              Manual source
            </span>
          </div>
          <h1>Create project</h1>
          <p className="flow-hero-lede">Create a project and sprint context for a team that is not connected through Jira yet.</p>
          <div className="flow-hero-pills" aria-label="Manual project setup summary">
            <span>
              <CalendarDays size={15} />
              {sprintLengthLabel(startDate, endDate)}
            </span>
            <span>
              <Target size={15} />
              {sprintGoal.trim() ? "Goal drafted" : "Goal required"}
            </span>
          </div>
        </div>
        <div className="setup-hero-panel" aria-label="Project setup preview">
          <span className="setup-hero-icon">
            <FolderPlus size={24} />
          </span>
          <div>
            <strong>{projectName.trim() || "Project name"}</strong>
            <span>{projectKey.trim() || "Project key"}</span>
          </div>
          <small>
            {formatSetupDate(startDate)} - {formatSetupDate(endDate)}
          </small>
        </div>
      </section>

      <section className="setup-shell">
        <aside className="setup-context-panel" aria-label="Create project flow">
          <p className="eyebrow">Manual flow</p>
          <h2>Define the delivery space first.</h2>
          <div className="setup-rail-list">
            <span>
              <Layers3 size={16} />
              Project identity
            </span>
            <span>
              <CalendarDays size={16} />
              Sprint window
            </span>
            <span>
              <Target size={16} />
              Sprint goal
            </span>
          </div>
        </aside>

        <form className="panel setup-form flow-form" onSubmit={createProject}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Project identity</p>
              <h2>Project and sprint details</h2>
            </div>
            <FolderPlus size={22} />
          </div>
          <div className="form-grid">
            <label className="field-group">
              <span>
                <Layers3 size={15} />
                Project name
              </span>
              <input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Project name"
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
            <label className="field-group">
              <span>
                <FolderPlus size={15} />
                Sprint name
              </span>
              <input
                value={sprintName}
                onChange={(event) => setSprintName(event.target.value)}
                placeholder="Sprint name"
                required
              />
            </label>
            <label className="field-group">
              <span>
                <CalendarDays size={15} />
                Start date
              </span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
            </label>
            <label className="field-group">
              <span>
                <CalendarDays size={15} />
                End date
              </span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
            </label>
            <label className="field-group wide">
              <span>
                <Target size={15} />
                Sprint goal
              </span>
              <textarea
                value={sprintGoal}
                onChange={(event) => setSprintGoal(event.target.value)}
                placeholder="Describe the sprint goal"
                required
              />
            </label>
          </div>
          <button className="primary-button flow-submit-button" type="submit" disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
            <span>Create project workspace</span>
          </button>
          {error ? <p className="form-error">{error}</p> : null}
        </form>
      </section>
    </div>
  );
}
