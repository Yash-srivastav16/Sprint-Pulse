import { FormEvent, type ReactNode, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, FolderPlus, KeyRound, Layers3, Loader2, Target, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { workspacePageClass } from "@/components/workspace/WorkspaceChrome";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import { cn } from "../lib/utils";

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

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200" htmlFor={htmlFor}>
      {children}
    </label>
  );
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

    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T00:00:00`).getTime();
    if (!projectName.trim() || !projectKey.trim() || !sprintName.trim() || !sprintGoal.trim() || Number.isNaN(start) || Number.isNaN(end) || end < start) {
      setError("Complete the project details and use a valid sprint date range.");
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

  const projectKeyPreview = projectKey.trim() || "KEY";
  const sprintGoalReady = sprintGoal.trim().length > 0;
  const identityReady = projectName.trim().length > 0 && projectKey.trim().length > 0;
  const sprintReady = sprintName.trim().length > 0 && startDate.trim().length > 0 && endDate.trim().length > 0;
  const dateReady = !Number.isNaN(new Date(`${startDate}T00:00:00`).getTime()) && !Number.isNaN(new Date(`${endDate}T00:00:00`).getTime()) && new Date(`${endDate}T00:00:00`).getTime() >= new Date(`${startDate}T00:00:00`).getTime();
  const formReady = identityReady && sprintReady && sprintGoalReady && dateReady;

  return (
    <motion.div
      className={workspacePageClass}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
    >
      <section className="premium-surface relative rounded-2xl p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-400/70 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,169,154,0.08),transparent_40%,rgba(68,123,219,0.10))] dark:bg-[linear-gradient(135deg,rgba(16,169,154,0.11),transparent_40%,rgba(68,123,219,0.15))]" />
        <div className="relative grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Link className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:border-primary-500/35 hover:text-primary-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-primary-100" to="/projects">
              <ArrowLeft className="h-4 w-4" />
              Projects
            </Link>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="gap-2 border-primary-500/20 bg-primary-500/10 px-3 py-1 text-primary-700 dark:text-primary-100" variant="outline">
                  <FolderPlus className="h-3.5 w-3.5" />
                  New workspace
                </Badge>
                <Badge className="gap-2 border-slate-200 bg-white/70 px-3 py-1 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300" variant="outline">
                  {sprintLengthLabel(startDate, endDate)}
                </Badge>
              </div>
              <h1 className="m-0 text-4xl font-black leading-[1.04] tracking-normal text-slate-950 dark:text-white">Create project</h1>
              <p className="m-0 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Start with a clean project identity, active sprint window, and sprint goal. Team members and integrations can be added once the workspace opens.
              </p>
            </div>
          </div>

          <Card className="overflow-hidden rounded-2xl border-slate-200/80 bg-slate-950 text-white shadow-[0_18px_60px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-white/[0.055]">
            <div className="h-1.5 bg-gradient-to-r from-primary-500 via-info-400 to-ai-500" />
            <CardContent className="grid gap-5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="m-0 text-xs font-black uppercase text-primary-100/80">Workspace preview</p>
                  <h2 className="m-0 mt-1 text-xl font-black tracking-normal text-white">{projectName.trim() || "Project name"}</h2>
                  <p className="m-0 mt-1 text-sm font-semibold text-slate-300">{projectKeyPreview}</p>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/10 text-primary-100">
                  <FolderPlus className="h-5 w-5" />
                </span>
              </div>
              <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.075] p-4">
                <span className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-slate-300">Sprint</span>
                  <strong className="text-right text-white">{sprintName.trim() || "Sprint name"}</strong>
                </span>
                <span className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-slate-300">Window</span>
                  <strong className="text-right text-white">
                    {formatSetupDate(startDate)} - {formatSetupDate(endDate)}
                  </strong>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Identity", identityReady],
                  ["Sprint", sprintReady],
                  ["Goal", sprintGoalReady]
                ].map(([label, ready]) => (
                  <span className={cn("grid min-h-16 place-items-center rounded-2xl border px-2 text-center text-xs font-black", ready ? "border-primary-300/30 bg-primary-300/15 text-primary-100" : "border-white/10 bg-white/[0.055] text-slate-400")} key={label as string}>
                    {ready ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-4 w-4 rounded-full border border-white/20" />}
                    {label as string}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="premium-surface grid gap-4 self-start rounded-2xl p-5">
          <div>
            <p className="m-0 text-xs font-black uppercase text-primary-700 dark:text-primary-100">Setup path</p>
            <h2 className="m-0 mt-2 text-2xl font-black tracking-normal text-slate-950 dark:text-white">Build the project shell first.</h2>
          </div>
          <div className="grid gap-3">
            {[
              [Layers3, "Project identity", "Name and short key for navigation."],
              [CalendarDays, "Sprint window", "Dates become the default active sprint."],
              [Target, "Sprint goal", "The dashboard uses this as project context."],
              [Users, "Team later", "Members can be invited after creation."]
            ].map(([Icon, title, detail], index) => {
              const StepIcon = Icon as typeof Layers3;
              return (
                <div className="flex gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-950/30" key={title as string}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-500/10 text-primary-700 dark:text-primary-100">
                    <StepIcon className="h-4 w-4" />
                  </span>
                  <span className="grid gap-1">
                    <strong className="text-sm font-black text-slate-950 dark:text-white">
                      {index + 1}. {title as string}
                    </strong>
                    <small className="text-sm leading-5 text-slate-500 dark:text-slate-400">{detail as string}</small>
                  </span>
                </div>
              );
            })}
          </div>
        </aside>

        <form className="premium-surface grid gap-5 rounded-2xl p-6" onSubmit={createProject}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge className="mb-3 gap-2 border-primary-500/20 bg-primary-500/10 px-3 py-1 text-primary-700 dark:text-primary-100" variant="outline">
                <Layers3 className="h-3.5 w-3.5" />
                Project details
              </Badge>
              <h2 className="m-0 text-2xl font-black tracking-normal text-slate-950 dark:text-white">Workspace information</h2>
              <p className="m-0 mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Use a clear project key because it appears in navigation, breadcrumbs, and project cards.</p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-100">
              <FolderPlus className="h-5 w-5" />
            </span>
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <div className="grid gap-2">
              <FieldLabel htmlFor="project-name">
                <Layers3 className="h-4 w-4 text-primary-600 dark:text-primary-200" />
                Project name
              </FieldLabel>
              <Input
                className="min-h-12 border-slate-200 bg-white/80 font-semibold shadow-sm dark:border-white/10 dark:bg-slate-950/40"
                id="project-name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="SprintPulse Metrics"
                required
              />
            </div>
            <div className="grid gap-2">
              <FieldLabel htmlFor="project-key">
                <KeyRound className="h-4 w-4 text-primary-600 dark:text-primary-200" />
                Project key
              </FieldLabel>
              <Input
                className="min-h-12 border-slate-200 bg-white/80 font-semibold uppercase shadow-sm dark:border-white/10 dark:bg-slate-950/40"
                id="project-key"
                value={projectKey}
                onChange={(event) => setProjectKey(event.target.value.toUpperCase())}
                placeholder="SPM"
                required
              />
            </div>
            <div className="grid gap-2 lg:col-span-2">
              <FieldLabel htmlFor="sprint-name">
                <FolderPlus className="h-4 w-4 text-primary-600 dark:text-primary-200" />
                Sprint name
              </FieldLabel>
              <Input
                className="min-h-12 border-slate-200 bg-white/80 font-semibold shadow-sm dark:border-white/10 dark:bg-slate-950/40"
                id="sprint-name"
                value={sprintName}
                onChange={(event) => setSprintName(event.target.value)}
                placeholder="Sprint 1 - Delivery Signal"
                required
              />
            </div>
            <div className="grid gap-2">
              <FieldLabel htmlFor="start-date">
                <CalendarDays className="h-4 w-4 text-primary-600 dark:text-primary-200" />
                Start date
              </FieldLabel>
              <Input
                className="min-h-12 border-slate-200 bg-white/80 font-semibold shadow-sm dark:border-white/10 dark:bg-slate-950/40"
                id="start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <FieldLabel htmlFor="end-date">
                <CalendarDays className="h-4 w-4 text-primary-600 dark:text-primary-200" />
                End date
              </FieldLabel>
              <Input
                className="min-h-12 border-slate-200 bg-white/80 font-semibold shadow-sm dark:border-white/10 dark:bg-slate-950/40"
                id="end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2 lg:col-span-2">
              <FieldLabel htmlFor="sprint-goal">
                <Target className="h-4 w-4 text-primary-600 dark:text-primary-200" />
                Sprint goal
              </FieldLabel>
              <textarea
                className="min-h-32 w-full resize-y rounded-md border border-slate-200 bg-white/80 px-3 py-3 text-sm font-semibold leading-6 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-white dark:placeholder:text-slate-500"
                id="sprint-goal"
                value={sprintGoal}
                onChange={(event) => setSprintGoal(event.target.value)}
                placeholder="Describe the sprint outcome the team is committing to."
                required
              />
            </div>
          </div>

          {error ? (
            <div className="flex gap-3 rounded-2xl border border-danger-500/20 bg-danger-500/10 p-4 text-sm font-semibold text-danger-700 dark:text-danger-100">
              <Target className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-6 text-sm font-black text-white shadow-[0_16px_40px_rgba(16,169,154,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(16,169,154,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:pointer-events-none disabled:opacity-60"
            type="submit"
            disabled={loading || !formReady}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Create project workspace
          </button>
        </form>
      </section>
    </motion.div>
  );
}
