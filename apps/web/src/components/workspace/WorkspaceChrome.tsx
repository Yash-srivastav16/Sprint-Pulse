import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "primary" | "info" | "warning" | "danger" | "ai" | "neutral" | "success";

const toneClasses: Record<Tone, string> = {
  primary: "border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-100",
  info: "border-info-500/20 bg-info-500/10 text-info-700 dark:text-info-100",
  warning: "border-warning-500/25 bg-warning-500/10 text-warning-700 dark:text-warning-100",
  danger: "border-danger-500/20 bg-danger-500/10 text-danger-700 dark:text-danger-100",
  ai: "border-ai-500/20 bg-ai-500/10 text-ai-700 dark:text-ai-100",
  neutral: "border-slate-200 bg-white/70 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100"
};

const gradientClasses: Record<Tone, string> = {
  primary: "from-primary-500 to-info-500",
  info: "from-info-500 to-primary-500",
  warning: "from-warning-500 to-primary-500",
  danger: "from-danger-500 to-warning-500",
  ai: "from-ai-500 to-info-500",
  neutral: "from-slate-500 to-slate-700",
  success: "from-emerald-500 to-primary-500"
};

export const workspacePageClass =
  "workspace-page relative isolate mx-auto grid w-full max-w-[1600px] gap-5 pb-4 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-72 before:rounded-full before:bg-[radial-gradient(circle_at_22%_0%,rgba(16,169,154,0.16),transparent_48%)] before:blur-3xl before:content-[''] after:pointer-events-none after:absolute after:right-0 after:top-20 after:-z-10 after:h-80 after:w-1/2 after:rounded-full after:bg-[radial-gradient(circle,rgba(132,98,232,0.13),transparent_58%)] after:blur-3xl after:content-[''] sm:gap-6 dark:before:bg-[radial-gradient(circle_at_22%_0%,rgba(16,169,154,0.22),transparent_48%)] dark:after:bg-[radial-gradient(circle,rgba(132,98,232,0.18),transparent_58%)]";
export const workspacePanelClass =
  "premium-surface h-full min-w-0 rounded-2xl transition duration-300 hover:-translate-y-0.5 hover:border-primary-500/30 dark:hover:border-primary-300/22";

export function WorkspaceLoading({ label }: { label: string }) {
  return (
    <div className="grid min-h-[360px] place-items-center">
      <div className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/85 px-5 py-3 text-sm font-semibold text-slate-600 shadow-lg shadow-slate-900/5 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
        <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
        {label}
      </div>
    </div>
  );
}

export function WorkspaceError({ label }: { label: string }) {
  return (
    <Card className="border-danger-500/20 bg-danger-500/10 text-danger-700 dark:text-danger-100">
      <CardContent className="flex min-h-[220px] items-center gap-3 p-6">
        <AlertTriangle className="h-5 w-5" />
        <span className="font-semibold">{label}</span>
      </CardContent>
    </Card>
  );
}

export function StatusPill({
  children,
  icon: Icon,
  tone = "neutral",
  className
}: {
  children: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Badge className={cn("gap-2 px-3 py-1 font-black", toneClasses[tone], className)} variant="outline">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </Badge>
  );
}

export function MemberAvatar({
  initials,
  size = "md",
  className
}: {
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary-400 via-info-500 to-ai-500 font-black text-white shadow-[0_12px_30px_rgba(16,169,154,0.20)] ring-1 ring-white/25",
        size === "sm" && "h-9 w-9 text-xs",
        size === "md" && "h-11 w-11 text-sm",
        size === "lg" && "h-16 w-16 text-lg",
        className
      )}
    >
      {initials}
    </span>
  );
}

function AnimatedValue({ value }: { value: ReactNode }) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return <CountUp end={value} duration={0.9} preserveValue />;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (value.trim() && Number.isFinite(numeric) && String(numeric) === value.trim()) {
      return <CountUp end={numeric} duration={0.9} preserveValue />;
    }
  }

  return value;
}

export function SectionPanel({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      className={cn(workspacePanelClass, "p-5", className)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}

export function PanelHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
  tone = "primary"
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-primary-700 dark:text-primary-100">{eyebrow}</div> : null}
        <h2 className="m-0 text-[1.35rem] font-extrabold leading-tight tracking-normal text-slate-950 dark:text-white">{title}</h2>
        {description ? <p className="m-0 mt-2 max-w-3xl text-[0.92rem] leading-6 text-slate-600 dark:text-slate-300">{description}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        {action}
        {Icon ? (
          <span className={cn("grid h-12 w-12 place-items-center rounded-2xl border shadow-sm", toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function WorkspaceHero({
  eyebrow,
  title,
  description,
  pills,
  action,
  score,
  scoreLabel,
  scoreDetail,
  scoreTone = "primary",
  children
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  pills?: ReactNode;
  action?: ReactNode;
  score?: ReactNode;
  scoreLabel?: ReactNode;
  scoreDetail?: ReactNode;
  scoreTone?: Tone;
  children?: ReactNode;
}) {
  return (
    <motion.section
      className="premium-surface relative min-w-0 rounded-2xl p-6"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
    >
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-400/80 to-transparent"
        initial={{ opacity: 0.35, scaleX: 0.7 }}
        animate={{ opacity: [0.35, 1, 0.35], scaleX: [0.7, 1, 0.7] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-500/12 blur-3xl dark:bg-primary-400/14" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-ai-500/14 blur-3xl dark:bg-ai-400/16" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,169,154,0.08),transparent_38%,rgba(132,98,232,0.10)),linear-gradient(90deg,rgba(255,255,255,0.38),transparent_42%)] dark:bg-[linear-gradient(135deg,rgba(16,169,154,0.10),transparent_38%,rgba(132,98,232,0.15))]" />
      <div className="relative grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>
            <h1 className="m-0 text-[2.15rem] font-extrabold leading-[1.08] tracking-normal text-slate-950 dark:text-white xl:text-[2.85rem]">{title}</h1>
            {description ? <p className="m-0 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">{description}</p> : null}
          </div>
          {pills ? <div className="flex flex-wrap gap-2">{pills}</div> : null}
          {children}
        </div>
        <Card className="relative h-full overflow-hidden rounded-2xl border-slate-200/80 bg-slate-950 text-white shadow-[0_18px_60px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-white/[0.055]">
          <div className={cn("h-1.5 bg-gradient-to-r", gradientClasses[scoreTone])} />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(255,255,255,0.18),transparent_34%)]" />
          <CardContent className="grid gap-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="m-0 text-[0.72rem] font-bold uppercase text-slate-300">{scoreLabel}</p>
                <strong className="mt-2 block font-mono text-[3.05rem] font-bold leading-none tracking-normal text-white">
                  <AnimatedValue value={score} />
                </strong>
              </div>
              {action}
            </div>
            {scoreDetail ? <div className="rounded-xl border border-white/10 bg-white/[0.075] p-4 text-sm leading-6 text-slate-300">{scoreDetail}</div> : null}
          </CardContent>
        </Card>
      </div>
    </motion.section>
  );
}

export function EmptyPanel({
  title,
  description,
  icon: Icon,
  action
}: {
  title: ReactNode;
  description: ReactNode;
  icon: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center dark:border-white/12 dark:bg-white/[0.035]">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-100">
        <Icon className="h-6 w-6" />
      </span>
      <div className="max-w-xl space-y-2">
        <h3 className="m-0 text-xl font-black tracking-normal text-slate-950 dark:text-white">{title}</h3>
        <p className="m-0 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
      </div>
      {action}
    </div>
  );
}
