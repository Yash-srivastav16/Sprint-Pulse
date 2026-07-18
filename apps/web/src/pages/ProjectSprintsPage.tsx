import { type FormEvent, useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, GitCommitHorizontal, Loader2, MessageSquareText, Plus, TicketCheck } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import type { CreateProjectSprintRequest, SprintInfo, SprintListResponse, SprintSummary } from "@sprintpulse/shared";
import { SignalBarChart } from "@/components/charts/SignalBarChart";
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
import { useProject } from "../context/ProjectContext";
import { projectCacheKey, readProjectCache, writeProjectCache } from "../lib/projectDataCache";
import { cn } from "../lib/utils";

const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

function statusTone(status: SprintInfo["status"]) {
  if (status === "active") {
    return "success" as const;
  }
  if (status === "planned") {
    return "info" as const;
  }
  return "neutral" as const;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function compactSprintChartLabel(name: string) {
  const sprintMatch = name.match(/\bSprint\s*\d+\b/i);
  if (sprintMatch) {
    return sprintMatch[0].replace(/\s+/, " ");
  }

  const firstSegment = name.split("-")[0]?.trim() || name;
  return firstSegment.length > 14 ? `${firstSegment.slice(0, 13)}...` : firstSegment;
}

function progressWidth(score: number, min = 5) {
  return `${Math.max(min, Math.min(100, score))}%`;
}

const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const nextSprintName = (name: string) => {
  const match = name.match(/^(.*?)(\d+)$/);
  if (!match) {
    return `${name} 2`;
  }

  return `${match[1]}${Number(match[2]) + 1}`;
};

function daysRemaining(endDate: string) {
  const end = new Date(`${endDate}T23:59:59`);
  if (Number.isNaN(end.getTime())) {
    return null;
  }

  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

function finishDecision(sprint?: SprintSummary) {
  if (!sprint) {
    return {
      title: "No sprint selected",
      detail: "Select or create a sprint before reading finish risk.",
      tone: "neutral" as const
    };
  }

  const remaining = daysRemaining(sprint.endDate);
  if (sprint.blockerCount > 0 && remaining !== null && remaining <= 3) {
    return {
      title: "Protect sprint close",
      detail: `${sprint.blockerCount} blocker${sprint.blockerCount === 1 ? "" : "s"} with ${remaining}d left. Clear owner and review path today.`,
      tone: "danger" as const
    };
  }

  if (sprint.healthScore < 70 || sprint.blockerCount > 0) {
    return {
      title: "Needs intervention",
      detail: `${sprint.blockerCount} blocker${sprint.blockerCount === 1 ? "" : "s"} and ${sprint.issueCount} Jira item${sprint.issueCount === 1 ? "" : "s"} need evidence review.`,
      tone: "warning" as const
    };
  }

  return {
    title: "Likely to finish",
    detail: "Sprint signal is stable. Keep standups and integration sync fresh.",
    tone: "success" as const
  };
}

export function ProjectSprintsPage() {
  const { projectId } = useParams();
  const { persona } = useAuth();
  const { selectedSprintId, selectProject, selectSprint } = useProject();
  const [data, setData] = useState<SprintListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSprintForm, setShowSprintForm] = useState(false);
  const [savingSprint, setSavingSprint] = useState(false);
  const [sprintFeedback, setSprintFeedback] = useState<string | null>(null);
  const [sprintDraft, setSprintDraft] = useState({
    name: "",
    goal: "",
    startDate: "",
    endDate: "",
    status: "planned" as CreateProjectSprintRequest["status"]
  });

  useEffect(() => {
    if (!persona || !projectId) {
      return;
    }

    const cacheKey = projectCacheKey("sprints", [projectId, persona.id]);
    const cached = readProjectCache<SprintListResponse>(cacheKey);
    if (cached) {
      setData(cached);
    }

    setLoading(!cached);
    setError(null);
    api
      .getProjectSprints(projectId, persona.id)
      .then((response) => {
        writeProjectCache(cacheKey, response);
        setData(response);
        const contextSprint =
          (selectedSprintId ? response.sprints.find((sprint) => sprint.id === selectedSprintId) : null) ??
          response.currentSprint ??
          response.project.sprint;
        selectProject(response.project.id, {
          source: response.project.source === "manual" ? "manual" : "jira",
          projectName: response.project.name,
          projectKey: response.project.key,
          sprintName: contextSprint.name,
          sprintGoal: contextSprint.goal,
          jiraSite: response.project.jiraSite,
          importedAt: response.project.lastSyncAt
        });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [persona?.id, projectId, selectedSprintId]);

  if (loading) {
    return <WorkspaceLoading label="Loading sprints" />;
  }

  if (error || !data) {
    return <WorkspaceError label={error ?? "Sprints unavailable"} />;
  }

  const selectedSprint = data.sprints.find((sprint) => sprint.id === selectedSprintId) ?? data.currentSprint ?? data.sprints[0];
  const canManageSprints = data.permissions.includes("project:connect");
  const selectedDaysRemaining = selectedSprint ? daysRemaining(selectedSprint.endDate) : null;
  const selectedDecision = finishDecision(selectedSprint);
  const sprintHealthBars = data.sprints.map((sprint) => ({
    label: compactSprintChartLabel(sprint.name),
    value: sprint.healthScore,
    detail: `${sprint.name}${sprint.goal ? ` - ${sprint.goal}` : ""}`,
    tone: sprint.healthScore >= 80 ? ("success" as const) : sprint.healthScore >= 65 ? ("warning" as const) : ("danger" as const)
  }));
  const openSprintDraft = (status: CreateProjectSprintRequest["status"]) => {
    const baseSprint = data.currentSprint ?? selectedSprint ?? data.project.sprint;
    const startDate = addDays(baseSprint.endDate, 1);
    setSprintDraft({
      name: nextSprintName(baseSprint.name),
      goal: baseSprint.goal,
      startDate,
      endDate: addDays(startDate, 13),
      status
    });
    setSprintFeedback(null);
    setShowSprintForm(true);
  };
  const createSprint = async (event: FormEvent) => {
    event.preventDefault();
    if (!persona || !projectId) {
      return;
    }

    setSavingSprint(true);
    setError(null);
    setSprintFeedback(null);
    try {
      const response = await api.createProjectSprint(projectId, {
        personaId: persona.id,
        ...sprintDraft
      });
      setData(response);
      const created = response.createdSprint;
      const contextSprint = created;
      selectProject(response.project.id, {
        source: response.project.source === "manual" ? "manual" : "jira",
        projectName: response.project.name,
        projectKey: response.project.key,
        sprintName: contextSprint.name,
        sprintGoal: contextSprint.goal,
        jiraSite: response.project.jiraSite,
        importedAt: response.project.lastSyncAt
      });
      selectSprint(contextSprint.id, {
        sprintName: contextSprint.name,
        sprintGoal: contextSprint.goal
      });
      setSprintFeedback(
        created.status === "active"
          ? `${created.name} is now the active sprint.`
          : `${created.name} is planned for this project.`
      );
      toast.success(created.status === "active" ? "Active sprint started" : "Sprint planned", {
        description: created.name
      });
      setShowSprintForm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create sprint";
      setError(message);
      toast.error("Sprint update failed", { description: message });
    } finally {
      setSavingSprint(false);
    }
  };

  return (
    <div className={workspacePageClass}>
      <WorkspaceHero
        eyebrow={
          <>
            <StatusPill icon={CalendarDays} tone="primary">
              {data.project.key} sprint history
            </StatusPill>
            {selectedSprint ? (
              <StatusPill tone={statusTone(selectedSprint.status)}>
                {statusLabel(selectedSprint.status)}
              </StatusPill>
            ) : null}
          </>
        }
        title="Sprints"
        description="Manage sprint windows and judge whether current scope can finish before it becomes rollover."
        score={selectedSprint?.healthScore ?? data.sprints.length}
        scoreLabel={selectedSprint ? "Finish confidence" : "Sprint records"}
        scoreTone={selectedDecision.tone}
        scoreDetail={selectedSprint ? `${selectedDecision.title}: ${selectedDecision.detail}` : "No sprint selected"}
        pills={
          selectedSprint ? (
            <>
              <StatusPill icon={AlertTriangle} tone={selectedDecision.tone}>
                {selectedDecision.title}
              </StatusPill>
              <StatusPill icon={TicketCheck} tone="neutral">
                {selectedSprint.issueCount} issues
              </StatusPill>
              <StatusPill icon={MessageSquareText} tone="neutral">
                {selectedSprint.standupCount} standups
              </StatusPill>
              <StatusPill icon={GitCommitHorizontal} tone="neutral">
                {selectedSprint.commitCount} commits
              </StatusPill>
            </>
          ) : null
        }
      />

      <SectionPanel>
        <PanelHeader
          eyebrow="Sprint finish readout"
          title={selectedSprint ? selectedDecision.title : "Select a sprint"}
          description={selectedDecision.detail}
          icon={AlertTriangle}
          tone={selectedDecision.tone}
          action={
            selectedSprint ? (
              <StatusPill icon={CalendarDays} tone="neutral">
                {selectedDaysRemaining === null ? "Dates pending" : `${selectedDaysRemaining}d left`}
              </StatusPill>
            ) : null
          }
        />
        {selectedSprint ? (
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                label: "Blocker pressure",
                value: selectedSprint.blockerCount,
                detail: selectedSprint.blockerCount ? "Needs owner before sprint close" : "No active blocker signal",
                tone: selectedSprint.blockerCount ? ("danger" as const) : ("success" as const)
              },
              {
                label: "Delivery evidence",
                value: selectedSprint.commitCount,
                detail: `${selectedSprint.standupCount} standup update${selectedSprint.standupCount === 1 ? "" : "s"} captured`,
                tone: selectedSprint.commitCount ? ("ai" as const) : ("warning" as const)
              },
              {
                label: "Jira scope",
                value: selectedSprint.issueCount,
                detail: "Open dashboard for stale scope and PR review pressure",
                tone: "info" as const
              }
            ].map((item) => (
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.045]" key={item.label}>
                <StatusPill tone={item.tone}>{item.label}</StatusPill>
                <strong className="mt-4 block font-mono text-3xl font-black text-slate-950 dark:text-white">{item.value}</strong>
                <p className="m-0 mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</p>
              </div>
            ))}
          </div>
        ) : null}
      </SectionPanel>

      <SectionPanel>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <StatusPill icon={CalendarDays} tone="primary">
                Sprint control
              </StatusPill>
              {selectedSprint ? (
                <StatusPill tone={statusTone(selectedSprint.status)}>
                  {statusLabel(selectedSprint.status)}
                </StatusPill>
              ) : null}
            </div>
            <h2 className="m-0 text-2xl font-black tracking-normal text-slate-950 dark:text-white">
              {selectedSprint?.name ?? "No sprint selected"}
            </h2>
            <p className="m-0 mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {selectedSprint ? `${formatDate(selectedSprint.startDate)} - ${formatDate(selectedSprint.endDate)}` : "Create or sync a sprint to begin history."}
            </p>
          </div>
          {canManageSprints ? (
            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-500/35 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                type="button"
                onClick={() => openSprintDraft("planned")}
              >
                <Plus className="h-4 w-4" />
                Plan next sprint
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(16,169,154,0.22)] transition hover:-translate-y-0.5"
                type="button"
                onClick={() => openSprintDraft("active")}
              >
                <ArrowRight className="h-4 w-4" />
                Start active sprint
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-warning-500/20 bg-warning-500/10 px-4 py-3 text-sm font-semibold text-warning-700 dark:text-warning-100">
              Project leads manage sprint planning.
            </div>
          )}
        </div>
      </SectionPanel>

      {sprintFeedback ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-100">
          {sprintFeedback}
        </div>
      ) : null}

      {showSprintForm ? (
        <SectionPanel>
          <form className="grid gap-5" onSubmit={createSprint}>
            <PanelHeader
              eyebrow={sprintDraft.status === "active" ? "New active sprint" : "Planned sprint"}
              title={sprintDraft.status === "active" ? "Start sprint" : "Plan sprint"}
              description="Create a sprint record inside this project so dashboards, standups, and member history stay scoped correctly."
              icon={CalendarDays}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Sprint name</span>
                <Input value={sprintDraft.name} onChange={(event) => setSprintDraft((draft) => ({ ...draft, name: event.target.value }))} required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Status</span>
                <select
                  className="min-h-10 rounded-md border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-950 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                  value={sprintDraft.status}
                  onChange={(event) =>
                    setSprintDraft((draft) => ({
                      ...draft,
                      status: event.target.value as CreateProjectSprintRequest["status"]
                    }))
                  }
                >
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Start date</span>
                <Input type="date" value={sprintDraft.startDate} onChange={(event) => setSprintDraft((draft) => ({ ...draft, startDate: event.target.value }))} required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">End date</span>
                <Input type="date" value={sprintDraft.endDate} onChange={(event) => setSprintDraft((draft) => ({ ...draft, endDate: event.target.value }))} required />
              </label>
              <label className="grid gap-2 lg:col-span-2">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">Goal</span>
                <textarea
                  className="min-h-28 rounded-md border border-slate-200 bg-white/80 px-3 py-3 text-sm font-semibold leading-6 text-slate-950 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                  value={sprintDraft.goal}
                  onChange={(event) => setSprintDraft((draft) => ({ ...draft, goal: event.target.value }))}
                  required
                />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100" type="button" onClick={() => setShowSprintForm(false)}>
                Cancel
              </button>
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-info-500 px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(16,169,154,0.22)] disabled:pointer-events-none disabled:opacity-60" type="submit" disabled={savingSprint}>
                {savingSprint ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {sprintDraft.status === "active" ? "Start sprint" : "Save planned sprint"}
              </button>
            </div>
          </form>
        </SectionPanel>
      ) : null}

      <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <SectionPanel>
          <PanelHeader
            eyebrow="Sprint trend"
            title="Health by sprint"
            description="Historical sprint health becomes visible instead of buried in cards."
            icon={CalendarDays}
          />
          <SignalBarChart data={sprintHealthBars} valueSuffix="%" />
        </SectionPanel>

        <SectionPanel>
          <PanelHeader
            eyebrow="Selected sprint"
            title={selectedSprint ? selectedSprint.name : "No sprint selected"}
            description={selectedSprint ? `${statusLabel(selectedSprint.status)} · ${formatDate(selectedSprint.startDate)} - ${formatDate(selectedSprint.endDate)}` : "No sprint selected"}
            icon={TicketCheck}
            tone="info"
          />
          {selectedSprint ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [TicketCheck, selectedSprint.issueCount, "Jira issues"],
                [MessageSquareText, selectedSprint.standupCount, "Standups"],
                [GitCommitHorizontal, selectedSprint.commitCount, "Commits"],
                [CalendarDays, selectedSprint.blockerCount, "Blockers"]
              ].map(([Icon, value, label]) => {
                const ItemIcon = Icon as typeof TicketCheck;
                return (
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.045]" key={label as string}>
                    <ItemIcon className="h-4 w-4 text-primary-600 dark:text-primary-200" />
                    <strong className="mt-3 block font-mono text-2xl font-bold text-slate-950 dark:text-white">{value as number}</strong>
                    <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{label as string}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyPanel icon={TicketCheck} title="No sprint selected" description="Choose a sprint from the timeline below." />
          )}
        </SectionPanel>
      </section>

      {data.currentSprint && selectedSprint?.id !== data.currentSprint.id ? (
        <SectionPanel>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <StatusPill icon={CheckCircle2} tone="success">
                  Currently active
                </StatusPill>
                <StatusPill tone="neutral">
                  {formatDate(data.currentSprint.startDate)} - {formatDate(data.currentSprint.endDate)}
                </StatusPill>
              </div>
              <h2 className="m-0 text-2xl font-black tracking-normal text-slate-950 dark:text-white">{data.currentSprint.name}</h2>
              <p className="m-0 mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{data.currentSprint.goal}</p>
            </div>
            <div className="rounded-2xl border border-primary-500/20 bg-primary-500/10 p-5 text-center text-primary-700 dark:text-primary-100">
              <strong className="block text-5xl font-black leading-none">{data.currentSprint.healthScore}</strong>
              <span className="mt-2 block text-xs font-black uppercase">active health</span>
            </div>
          </div>
        </SectionPanel>
      ) : null}

      <SectionPanel>
        <PanelHeader eyebrow="Sprint timeline" title="Project sprint history" description="Switching a sprint updates dashboard, standup, and member views through the shared project context." icon={CalendarDays} />
        {data.sprints.length ? (
          <div className="grid auto-rows-fr items-stretch gap-4 xl:grid-cols-2">
            {data.sprints.map((sprint) => {
              const isSelected = (selectedSprintId ?? data.currentSprint?.id) === sprint.id;
              return (
                <article
                  className={cn(
                    "relative h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary-500/35 dark:border-white/10 dark:bg-white/[0.045]",
                    isSelected && "ring-1 ring-primary-500/35"
                  )}
                  key={sprint.id}
                >
                  <div className="absolute inset-x-0 top-0 h-1.5 bg-slate-200 dark:bg-white/10" aria-hidden="true">
                    <span className="block h-full rounded-r-full bg-gradient-to-r from-primary-500 to-info-500" style={{ width: progressWidth(sprint.healthScore, 12) }} />
                  </div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <StatusPill tone={statusTone(sprint.status)}>
                        {statusLabel(sprint.status)}
                      </StatusPill>
                      {isSelected ? (
                        <StatusPill icon={CheckCircle2} tone="primary">
                          Selected
                        </StatusPill>
                      ) : null}
                    </div>
                    <strong className="text-2xl font-black text-slate-950 dark:text-white">{sprint.healthScore}</strong>
                  </div>
                  <h3 className="m-0 mt-5 text-xl font-black tracking-normal text-slate-950 dark:text-white">{sprint.name}</h3>
                  <p className="m-0 mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{sprint.goal}</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {[
                      [TicketCheck, sprint.issueCount, "Issues"],
                      [MessageSquareText, sprint.standupCount, "Standups"],
                      [GitCommitHorizontal, sprint.commitCount, "Commits"]
                    ].map(([Icon, value, label]) => {
                      const ItemIcon = Icon as typeof TicketCheck;
                      return (
                        <span className="grid gap-1 rounded-xl border border-slate-200/80 bg-white/70 p-3 text-sm dark:border-white/10 dark:bg-white/[0.045]" key={label as string}>
                          <ItemIcon className="h-4 w-4 text-primary-600 dark:text-primary-200" />
                          <strong className="text-xl font-black text-slate-950 dark:text-white">{value as number}</strong>
                          <small className="font-bold text-slate-500 dark:text-slate-400">{label as string}</small>
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                      {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                    </span>
                    <button
                      className={cn(
                        "inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-black transition",
                        isSelected
                          ? "bg-primary-500/10 text-primary-700 dark:text-primary-100"
                          : "border border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                      )}
                      type="button"
                      onClick={() => selectSprint(sprint.id, { sprintName: sprint.name, sprintGoal: sprint.goal })}
                    >
                      {isSelected ? "Selected sprint" : "View this sprint"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyPanel icon={CalendarDays} title="No sprint history yet" description="Create or sync a sprint to start building project history." />
        )}
      </SectionPanel>
    </div>
  );
}
