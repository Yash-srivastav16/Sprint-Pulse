import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LiveIndicatorProps {
  status: 'online' | 'offline' | 'idle' | 'busy';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig = {
  online: {
    color: 'bg-emerald-500',
    label: 'Online',
    pulse: true,
  },
  offline: {
    color: 'bg-slate-400',
    label: 'Offline',
    pulse: false,
  },
  idle: {
    color: 'bg-amber-500',
    label: 'Idle',
    pulse: true,
  },
  busy: {
    color: 'bg-red-500',
    label: 'Busy',
    pulse: false,
  },
};

const sizeConfig = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

export function LiveIndicator({ status, showLabel = false, size = 'md', className }: LiveIndicatorProps) {
  const config = statusConfig[status];
  const sizeClass = sizeConfig[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative">
        <div className={cn('rounded-full', sizeClass, config.color)} />
        {config.pulse && (
          <motion.div
            className={cn('absolute inset-0 rounded-full', config.color)}
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </div>
      {showLabel && (
        <span className="text-sm text-muted-foreground">{config.label}</span>
      )}
    </div>
  );
}
