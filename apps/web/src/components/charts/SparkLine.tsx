import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SparkLineProps {
  data: Array<{ value: number }>;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
  height?: number;
  showTrendIcon?: boolean;
  className?: string;
}

export function SparkLine({ 
  data, 
  trend = 'neutral',
  color,
  height = 40,
  showTrendIcon = true,
  className 
}: SparkLineProps) {
  const getTrendColor = () => {
    if (color) return color;
    if (trend === 'up') return '#10b981';
    if (trend === 'down') return '#ef4444';
    return '#6b7280';
  };

  const lineColor = getTrendColor();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8 }}
        className="flex-1"
        style={{ height }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
      
      {showTrendIcon && trend !== 'neutral' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
        >
          {trend === 'up' ? (
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500" />
          )}
        </motion.div>
      )}
    </div>
  );
}
