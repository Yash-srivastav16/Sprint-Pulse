import type { RiskLevel } from "@sprintpulse/shared";

const labels: Record<RiskLevel, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
  critical: "Critical risk"
};

export function RiskBadge({ compact = false, level }: { compact?: boolean; level: RiskLevel }) {
  return <span className={`risk-badge risk-${level}${compact ? " risk-badge-compact" : ""}`}>{labels[level]}</span>;
}
