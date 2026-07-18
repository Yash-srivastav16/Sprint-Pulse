import { useId } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

type SignalTone = "primary" | "info" | "warning" | "danger" | "ai" | "success" | "neutral";

export interface SignalBarDatum {
  label: string;
  value: number;
  detail?: string;
  tone?: SignalTone;
  fill?: string;
}

interface SignalBarChartProps {
  data: SignalBarDatum[];
  height?: number;
  valueSuffix?: string;
  className?: string;
}

const toneColor: Record<SignalTone, string> = {
  primary: "#10a99a",
  info: "#447bdb",
  warning: "#e7a52e",
  danger: "#f26d5b",
  ai: "#8462e8",
  success: "#10b981",
  neutral: "#94a3b8"
};

function colorForDatum(item: SignalBarDatum) {
  return item.fill ?? toneColor[item.tone ?? "primary"];
}

export function SignalBarChart({ data, height, valueSuffix = "", className }: SignalBarChartProps) {
  const gradientBaseId = useId().replace(/:/g, "");
  const chartHeight = height ?? Math.max(180, data.length * 48 + 32);
  const normalizedData = data.map((item) => ({
    ...item,
    value: Number.isFinite(item.value) ? Math.max(0, item.value) : 0
  }));

  if (!normalizedData.length) {
    return (
      <div className={cn("grid min-h-[180px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400", className)}>
        No chart data yet
      </div>
    );
  }

  return (
    <div className={cn("h-full min-h-[180px] w-full", className)}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={normalizedData} layout="vertical" margin={{ top: 8, right: 34, bottom: 8, left: 8 }}>
          <defs>
            {normalizedData.map((item, index) => (
              <linearGradient id={`${gradientBaseId}-${index}`} key={`${item.label}-${index}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={colorForDatum(item)} stopOpacity={0.64} />
                <stop offset="100%" stopColor={colorForDatum(item)} stopOpacity={1} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid horizontal={false} stroke="currentColor" strokeDasharray="3 3" opacity={0.12} />
          <XAxis
            type="number"
            tick={{ fill: "currentColor", fontSize: 11, fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="label"
            type="category"
            width={116}
            tick={{ fill: "currentColor", fontSize: 12, fontWeight: 800 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) {
                return null;
              }

              const item = payload[0]?.payload as SignalBarDatum;
              return (
                <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-sm shadow-xl shadow-slate-900/10 backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
                  <strong className="block text-slate-950 dark:text-white">{item.label}</strong>
                  {item.detail ? <span className="mt-1 block max-w-56 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.detail}</span> : null}
                  <span className="mt-2 block text-lg font-black" style={{ color: colorForDatum(item) }}>
                    {item.value}{valueSuffix}
                  </span>
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={[0, 12, 12, 0]} barSize={18} animationDuration={900}>
            {normalizedData.map((item, index) => (
              <Cell key={`${item.label}-${index}`} fill={`url(#${gradientBaseId}-${index})`} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(value) => `${Number(value ?? 0)}${valueSuffix}`}
              className="fill-slate-600 text-xs font-black dark:fill-slate-200"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
