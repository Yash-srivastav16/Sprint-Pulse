import { FormEvent, type ReactNode, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Cloud, DatabaseZap, KeyRound, Link2, Loader2, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";
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

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function normalizeJiraSite(site: string) {
  return site.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

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

    if (!normalizeJiraSite(jiraSite) || !projectKey.trim()) {
      setError("Enter a Jira site and project key before connecting.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.connectJiraProject({
        personaId: persona.id,
        jiraSite: normalizeJiraSite(jiraSite),
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

  const normalizedSite = normalizeJiraSite(jiraSite);
  const siteReady = normalizedSite.length > 0;
  const keyReady = projectKey.trim().length > 0;
  const formReady = siteReady && keyReady;
  const previewUrl = normalizedSite || "company.atlassian.net";

  return (
    <motion.div
      className={workspacePageClass}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
    >
      <section className="premium-surface relative rounded-2xl p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-info-400/70 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(68,123,219,0.10),transparent_40%,rgba(16,169,154,0.08))] dark:bg-[linear-gradient(135deg,rgba(68,123,219,0.15),transparent_40%,rgba(16,169,154,0.11))]" />
        <div className="relative grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <Link className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:border-primary-500/35 hover:text-primary-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-primary-100" to="/projects">
              <ArrowLeft className="h-4 w-4" />
              Projects
            </Link>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="gap-2 border-info-500/20 bg-info-500/10 px-3 py-1 text-info-700 dark:text-info-100" variant="outline">
                  <Cloud className="h-3.5 w-3.5" />
                  Jira source
                </Badge>
                <Badge className="gap-2 border-slate-200 bg-white/70 px-3 py-1 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300" variant="outline">
                  Existing project
                </Badge>
              </div>
              <h1 className="m-0 text-4xl font-black leading-[1.04] tracking-normal text-slate-950 dark:text-white">Connect Jira project</h1>
              <p className="m-0 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Pull project identity, active sprint context, issue movement, and member mapping into SprintPulse without leaving the project setup flow.
              </p>
            </div>
          </div>

          <Card className="overflow-hidden rounded-2xl border-slate-200/80 bg-slate-950 text-white shadow-[0_18px_60px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-white/[0.055]">
            <div className="h-1.5 bg-gradient-to-r from-info-500 via-primary-400 to-ai-500" />
            <CardContent className="grid gap-5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="m-0 text-xs font-black uppercase text-info-100/80">Connection preview</p>
                  <h2 className="m-0 mt-1 text-xl font-black tracking-normal text-white">{projectKey.trim() || "Project key"}</h2>
                  <p className="m-0 mt-1 break-all text-sm font-semibold text-slate-300">{previewUrl}</p>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/10 text-info-100">
                  <Cloud className="h-5 w-5" />
                </span>
              </div>
              <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.075] p-4">
                {[
                  ["Site", siteReady],
                  ["Key", keyReady],
                  ["Import", siteReady && keyReady]
                ].map(([label, ready]) => (
                  <span className="flex items-center justify-between gap-3 text-sm" key={label as string}>
                    <span className="font-bold text-slate-300">{label as string}</span>
                    <span className={cn("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-black", ready ? "bg-primary-300/15 text-primary-100" : "bg-white/[0.065] text-slate-400")}>
                      {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-white/20" />}
                      {ready ? "Ready" : "Needed"}
                    </span>
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-black text-slate-300">
                <span className="rounded-2xl border border-white/10 bg-white/[0.055] px-2 py-3">Sprint</span>
                <span className="rounded-2xl border border-white/10 bg-white/[0.055] px-2 py-3">Issues</span>
                <span className="rounded-2xl border border-white/10 bg-white/[0.055] px-2 py-3">Members</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="premium-surface grid gap-4 self-start rounded-2xl p-5">
          <div>
            <p className="m-0 text-xs font-black uppercase text-info-700 dark:text-info-100">Connection path</p>
            <h2 className="m-0 mt-2 text-2xl font-black tracking-normal text-slate-950 dark:text-white">Bring the existing delivery system in.</h2>
          </div>
          <div className="grid gap-3">
            {[
              [Link2, "Jira site", "Use your Atlassian Cloud site domain."],
              [KeyRound, "Project key", "SprintPulse imports the project mapped to this key."],
              [RefreshCw, "Sprint context", "Active sprint, issue state, and team signal are prepared."],
              [ShieldCheck, "No token storage", "This setup keeps the demo slice safe and repeatable."]
            ].map(([Icon, title, detail], index) => {
              const StepIcon = Icon as typeof Link2;
              return (
                <div className="flex gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-950/30" key={title as string}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-info-500/10 text-info-700 dark:text-info-100">
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

        <form className="premium-surface grid gap-5 rounded-2xl p-6" onSubmit={connectProject}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge className="mb-3 gap-2 border-info-500/20 bg-info-500/10 px-3 py-1 text-info-700 dark:text-info-100" variant="outline">
                <PlugZap className="h-3.5 w-3.5" />
                Jira details
              </Badge>
              <h2 className="m-0 text-2xl font-black tracking-normal text-slate-950 dark:text-white">Source project</h2>
              <p className="m-0 mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Enter the Jira site and project key that should become a SprintPulse workspace.</p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-info-500/20 bg-info-500/10 text-info-700 dark:text-info-100">
              <DatabaseZap className="h-5 w-5" />
            </span>
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <div className="grid gap-2 lg:col-span-2">
              <FieldLabel htmlFor="jira-site">
                <Link2 className="h-4 w-4 text-info-600 dark:text-info-200" />
                Jira site
              </FieldLabel>
              <Input
                className="min-h-12 border-slate-200 bg-white/80 font-semibold shadow-sm dark:border-white/10 dark:bg-slate-950/40"
                id="jira-site"
                value={jiraSite}
                onChange={(event) => setJiraSite(event.target.value)}
                placeholder="company.atlassian.net"
                required
              />
            </div>
            <div className="grid gap-2">
              <FieldLabel htmlFor="project-key">
                <KeyRound className="h-4 w-4 text-info-600 dark:text-info-200" />
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
            <div className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200">
                <RefreshCw className="h-4 w-4 text-info-600 dark:text-info-200" />
                Import scope
              </span>
              <div className="grid min-h-12 content-center rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300">
                Project, active sprint, issues, and members
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-info-500/15 bg-info-500/10 p-5 dark:bg-info-500/10">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-info-500/15 text-info-700 dark:text-info-100">
                <PlugZap className="h-5 w-5" />
              </span>
              <div>
                <h3 className="m-0 text-base font-black text-slate-950 dark:text-white">Import preview</h3>
                <p className="m-0 mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  SprintPulse will prepare the workspace from Jira-shaped project data and then open the project dashboard for review.
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {["Project identity", "Sprint board", "Team mapping"].map((label) => (
                <span className="rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-3 text-center text-xs font-black uppercase text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300" key={label}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {error ? (
            <div className="flex gap-3 rounded-2xl border border-danger-500/20 bg-danger-500/10 p-4 text-sm font-semibold text-danger-700 dark:text-danger-100">
              <Cloud className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-info-500 to-primary-500 px-6 text-sm font-black text-white shadow-[0_16px_40px_rgba(68,123,219,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(68,123,219,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-400 disabled:pointer-events-none disabled:opacity-60"
            type="submit"
            disabled={loading || !formReady}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Connect project
          </button>
        </form>
      </section>
    </motion.div>
  );
}
