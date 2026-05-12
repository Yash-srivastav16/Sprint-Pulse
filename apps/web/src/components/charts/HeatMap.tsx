import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HeatMapCell {
  day: string;
  value: number;
  label?: string;
}

interface HeatMapProps {
  data: HeatMapCell[];
  maxValue?: number;
  className?: string;
}

export function HeatMap({ data, maxValue, className }: HeatMapProps) {
  const max = maxValue || Math.max(...data.map(d => d.value));
  
  const getColor = (value: number) => {
    const intensity = value / max;
    if (intensity === 0) return 'bg-muted';
    if (intensity < 0.25) return 'bg-primary-200 dark:bg-primary-900/30';
    if (intensity < 0.5) return 'bg-primary-400 dark:bg-primary-800/50';
    if (intensity < 0.75) return 'bg-primary-600 dark:bg-primary-700/70';
    return 'bg-primary-700 dark:bg-primary-600';
  };

  return (
    <div className={cn('grid grid-cols-7 gap-2', className)}>
      {data.map((cell, index) => (
        <motion.div
          key={cell.day}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: index * 0.02, duration: 0.3 }}
          whileHover={{ scale: 1.1 }}
          className={cn(
            'aspect-square rounded-md transition-colors cursor-pointer',
            getColor(cell.value)
          )}
          title={`${cell.label || cell.day}: ${cell.value}`}
        />
      ))}
    </div>
  );
}
