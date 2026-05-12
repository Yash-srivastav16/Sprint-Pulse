import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
  showIcon?: boolean;
  animated?: boolean;
}

const riskConfig = {
  critical: {
    label: 'Critical',
    icon: AlertTriangle,
    gradient: 'from-red-500 to-red-600',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-600 dark:text-red-400',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
  },
  high: {
    label: 'High Risk',
    icon: AlertCircle,
    gradient: 'from-orange-500 to-red-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-600 dark:text-orange-400',
    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]',
  },
  medium: {
    label: 'Medium',
    icon: Info,
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
  },
  low: {
    label: 'Low Risk',
    icon: CheckCircle,
    gradient: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]',
  },
  none: {
    label: 'No Risk',
    icon: CheckCircle,
    gradient: 'from-teal-500 to-cyan-500',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    text: 'text-teal-600 dark:text-teal-400',
    glow: 'shadow-[0_0_20px_rgba(20,184,166,0.3)]',
  },
};

export function RiskBadge({ level, className, showIcon = true, animated = true }: RiskBadgeProps) {
  const config = riskConfig[level];
  const Icon = config.icon;

  const badge = (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-medium text-xs',
        config.bg,
        config.border,
        config.text,
        animated && 'transition-all duration-300',
        className
      )}
    >
      {showIcon && <Icon className="w-3.5 h-3.5" />}
      <span>{config.label}</span>
    </div>
  );

  if (!animated) {
    return badge;
  }

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={cn(level === 'critical' && config.glow)}
    >
      {badge}
    </motion.div>
  );
}
