import type { CSSProperties, ReactNode } from "react";
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
  "workspace-page relative isolate mx-auto grid w-full max-w-[var(--sp-shell-max-width)] gap-5 pb-4 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-72 before:rounded-full before:bg-[radial-gradient(circle_at_22%_0%,rgba(16,169,154,0.10),transparent_50%)] before:blur-3xl before:content-[''] after:pointer-events-none after:absolute after:right-0 after:top-20 after:-z-10 after:h-80 after:w-1/2 after:rounded-full after:bg-[radial-gradient(circle,rgba(132,98,232,0.08),transparent_60%)] after:blur-3xl after:content-[''] sm:gap-6 dark:before:bg-[radial-gradient(circle_at_22%_0%,rgba(16,169,154,0.18),transparent_48%)] dark:after:bg-[radial-gradient(circle,rgba(132,98,232,0.14),transparent_58%)]";
export const workspacePanelClass =
  "premium-surface h-full min-w-0 rounded-2xl transition duration-300 hover:border-primary-500/25 dark:hover:border-primary-300/18";

export function WorkspaceLoading({ label }: { label: string }) {
  return (
    <div className={cn(workspacePageClass, "min-h-[360px] content-start")}>
      <div className="premium-surface grid gap-5 rounded-2xl p-6">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-200">
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-100">
            <Loader2 className="h-4 w-4 animate-spin" />
          </span>
          {label}
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <span className="h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/[0.06]" key={item} />
          ))}
        </div>
        <span className="h-56 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/[0.055]" />
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
  className,
  title
}: {
  children: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <Badge
      className={cn(
        "!inline-flex !h-auto !min-h-0 !w-fit !min-w-0 !aspect-auto !self-start shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-black leading-5",
        toneClasses[tone],
        className
      )}
      title={title}
      variant="outline"
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </Badge>
  );
}

export function MemberAvatar({
  initials,
  seed,
  size = "md",
  className
}: {
  initials: string;
  seed?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const cleanInitials = (initials || "SP").slice(0, 2).toUpperCase();
  const avatarSeed = `${seed || cleanInitials}`.trim() || cleanInitials;
  const hash = Array.from(avatarSeed).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  const palettes = [
    ["#10a99a", "#3b82f6", "#8462e8"],
    ["#f25252", "#f8b02b", "#8462e8"],
    ["#22c55e", "#10a99a", "#3b82f6"],
    ["#8462e8", "#ec4899", "#3b82f6"],
    ["#f8b02b", "#10a99a", "#0f172a"],
    ["#38bdf8", "#6366f1", "#10a99a"],
    ["#fb7185", "#f97316", "#8b5cf6"],
    ["#14b8a6", "#22c55e", "#64748b"]
  ] as const;
  const palette = palettes[hash % palettes.length];
  const blobOne = 18 + (hash % 30);
  const blobTwo = 52 + ((hash >> 4) % 28);
  const avatarStyle = {
    background: `
      radial-gradient(circle at ${blobOne}% 22%, rgba(255,255,255,0.44), transparent 22%),
      radial-gradient(circle at ${blobTwo}% 76%, ${palette[2]} 0%, transparent 34%),
      linear-gradient(135deg, ${palette[0]}, ${palette[1]})
    `
  } satisfies CSSProperties;

  return (
    <span
      aria-label={`${avatarSeed} avatar`}
      className={cn(
        "relative isolate grid shrink-0 place-items-center overflow-hidden rounded-full font-black text-white shadow-[0_14px_34px_rgba(15,23,42,0.20)] ring-1 ring-white/30",
        size === "sm" && "h-9 w-9 text-[0.68rem]",
        size === "md" && "h-11 w-11 text-sm",
        size === "lg" && "h-16 w-16 text-lg",
        className
      )}
      style={avatarStyle}
    >
      <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.28),transparent_38%,rgba(15,23,42,0.18))]" />
      <span className="absolute -right-1 top-1 h-1/2 w-1/2 rounded-full border border-white/20 bg-white/[0.15] blur-[1px]" />
      <span className="absolute bottom-0 left-1/2 h-1/3 w-[120%] -translate-x-1/2 rounded-t-full bg-slate-950/[0.18]" />
      <span className="relative grid h-[62%] w-[62%] place-items-center rounded-full border border-white/[0.22] bg-slate-950/[0.18] shadow-inner backdrop-blur-[1px]">
        {cleanInitials}
      </span>
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

function numericMetric(value: ReactNode) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number(value.replace("%", "").trim());
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function labelText(value: ReactNode) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function shouldShowGauge(label: ReactNode, value: ReactNode) {
  const metric = numericMetric(value);
  if (metric === null || metric < 0 || metric > 100) {
    return false;
  }

  return /(health|confidence|quality|readiness|score|signal)/i.test(labelText(label));
}

const gaugeColors: Record<Tone, { from: string; to: string; track: string; badge: string }> = {
  primary: { from: "#10a99a", to: "#3b82f6", track: "rgba(148,163,184,0.26)", badge: "border-primary-500/20 bg-primary-500/10 text-primary-700 dark:border-primary-300/20 dark:bg-primary-400/[0.12] dark:text-primary-100" },
  info: { from: "#3b82f6", to: "#10a99a", track: "rgba(148,163,184,0.26)", badge: "border-info-500/20 bg-info-500/10 text-info-700 dark:border-info-300/20 dark:bg-info-400/[0.12] dark:text-info-100" },
  warning: { from: "#f8b02b", to: "#ff7a59", track: "rgba(148,163,184,0.26)", badge: "border-warning-500/25 bg-warning-500/10 text-warning-700 dark:border-warning-300/25 dark:bg-warning-400/[0.12] dark:text-warning-100" },
  danger: { from: "#f25252", to: "#f8b02b", track: "rgba(148,163,184,0.26)", badge: "border-danger-500/20 bg-danger-500/10 text-danger-700 dark:border-danger-300/25 dark:bg-danger-400/[0.12] dark:text-danger-100" },
  ai: { from: "#8462e8", to: "#3b82f6", track: "rgba(148,163,184,0.26)", badge: "border-ai-500/20 bg-ai-500/10 text-ai-700 dark:border-ai-300/20 dark:bg-ai-400/[0.12] dark:text-ai-100" },
  neutral: { from: "#64748b", to: "#94a3b8", track: "rgba(148,163,184,0.26)", badge: "border-slate-200 bg-white/70 text-slate-600 dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-200" },
  success: { from: "#22c55e", to: "#10a99a", track: "rgba(148,163,184,0.26)", badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-400/[0.12] dark:text-emerald-100" }
};

function metricStatus(tone: Tone, value: number) {
  if (tone === "danger" || value < 55) {
    return "Needs attention";
  }
  if (tone === "warning" || value < 75) {
    return "Watch closely";
  }
  return "Healthy";
}

export function SectionPanel({
  children,
  className,
  delay = 0
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      className={cn(workspacePanelClass, "p-5", className)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut", delay }}
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
  const metric = numericMetric(score);
  const showGauge = shouldShowGauge(scoreLabel, score);
  const gaugeValue = showGauge && metric !== null ? Math.max(0, Math.min(100, Math.round(metric))) : null;
  const gauge = gaugeColors[scoreTone];
  const status = gaugeValue === null ? null : metricStatus(scoreTone, gaugeValue);

  return (
    <motion.section
      className="premium-surface relative z-50 min-w-0 !overflow-visible rounded-2xl p-6"
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
      <div className="relative z-10 grid items-stretch gap-6 overflow-visible xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>
            <h1 className="m-0 text-[2.15rem] font-extrabold leading-[1.08] tracking-normal text-slate-950 dark:text-white xl:text-[2.85rem]">{title}</h1>
            {description ? <p className="m-0 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">{description}</p> : null}
          </div>
          {pills ? <div className="flex flex-wrap items-start gap-2">{pills}</div> : null}
          {children}
        </div>
        <Card className="relative h-full overflow-hidden rounded-3xl border-slate-200/80 bg-white/95 text-slate-950 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-slate-950/80 dark:text-white dark:shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
          <div className={cn("h-1.5 bg-gradient-to-r", gradientClasses[scoreTone])} />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),transparent_48%),radial-gradient(circle_at_100%_0%,rgba(16,169,154,0.12),transparent_34%)] dark:bg-[radial-gradient(circle_at_100%_0%,rgba(16,169,154,0.14),transparent_34%),radial-gradient(circle_at_0%_100%,rgba(132,98,232,0.14),transparent_42%)]" />
          <CardContent className="relative grid h-full content-between gap-5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="m-0 text-[0.72rem] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">{scoreLabel}</p>
                {status ? (
                  <span className={cn("mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-black", gauge.badge)}>
                    {status}
                  </span>
                ) : null}
              </div>
              {action}
            </div>

            {showGauge && gaugeValue !== null ? (
              <div className="grid gap-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <strong className="block font-mono text-6xl font-black leading-none tracking-tight text-slate-950 dark:text-white">
                      <AnimatedValue value={score} />
                    </strong>
                    <span className="mt-1 block text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Signal score</span>
                  </div>
                  <span className="rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-right text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
                    {gaugeValue} / 100
                  </span>
                </div>
                <div className="grid gap-3">
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <span
                      className={cn("block h-full rounded-full bg-gradient-to-r shadow-[0_0_18px_rgba(16,169,154,0.22)]", gradientClasses[scoreTone])}
                      style={{ width: `${gaugeValue}%` }}
                    />
                  </div>
                  {scoreDetail ? (
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm font-semibold leading-6 text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
                      {scoreDetail}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <strong className="block font-mono text-[3.05rem] font-bold leading-none tracking-normal text-slate-950 dark:text-white">
                  <AnimatedValue value={score} />
                </strong>
                {scoreDetail ? <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">{scoreDetail}</div> : null}
              </>
            )}
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
