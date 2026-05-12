import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, GitCommitHorizontal, Loader2, MessageSquareText, TicketCheck } from "lucide-react";
import { useParams } from "react-router-dom";
import type { SprintInfo, SprintListResponse } from "@sprintpulse/shared";
import { SignalBarChart } from "@/components/charts/SignalBarChart";
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

function progressWidth(score: number, min = 5) {
  return `${Math.max(min, Math.min(100, score))}%`;
}

export function ProjectSprintsPage() {
  const { projectId } = useParams();
  const { persona } = useAuth();
  const { selectedSprintId, selectProject, selectSprint } = useProject();
  const [data, setData] = useState<SprintListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!persona || !projectId) {
      return;
    }

    setLoading(true);
    setError(null);
    api
      .getProjectSprints(projectId, persona.id)
      .then((response) => {
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
  }, [persona, projectId, selectProject, selectedSprintId]);

  if (loading) {
    return <WorkspaceLoading label="Loading sprints" />;
  }

  if (error || !data) {
    return <WorkspaceError label={error ?? "Sprints unavailable"} />;
  }

  const selectedSprint = data.sprints.find((sprint) => sprint.id === selectedSprintId) ?? data.currentSprint ?? data.sprints[0];
  const sprintHealthBars = data.sprints.map((sprint) => ({
    label: sprint.name.replace(/^(.{18}).+$/, "$1..."),
    value: sprint.healthScore,
    detail: sprint.goal,
    tone: sprint.healthScore >= 80 ? ("success" as const) : sprint.healthScore >= 65 ? ("warning" as const) : ("danger" as const)
  }));

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
        description="Review the active sprint and older sprint signals without mixing project context."
        score={data.sprints.length}
        scoreLabel="Sprint records"
        scoreTone="primary"
        scoreDetail={selectedSprint ? `${selectedSprint.name} · ${selectedSprint.healthScore} health · ${selectedSprint.standupCount} standups` : "No sprint selected"}
        pills={
          selectedSprint ? (
            <>
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

      {data.currentSprint ? (
        <SectionPanel>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <StatusPill icon={CheckCircle2} tone="success">
                  Active sprint
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
              <span className="mt-2 block text-xs font-black uppercase">health</span>
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
