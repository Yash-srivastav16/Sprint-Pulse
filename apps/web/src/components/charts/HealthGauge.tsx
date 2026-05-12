import { motion } from 'framer-motion';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';
import { cn } from '@/lib/utils';

interface HealthGaugeProps {
  value: number; // 0-100
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function HealthGauge({ 
  value, 
  label = 'Health Score', 
  size = 'md', 
  showLabel = true,
  className 
}: HealthGaugeProps) {
  const sizeConfig = {
    sm: { width: 120, height: 120, fontSize: 'text-xl' },
    md: { width: 180, height: 180, fontSize: 'text-3xl' },
    lg: { width: 240, height: 240, fontSize: 'text-4xl' },
  };

  const config = sizeConfig[size];
  
  const getColor = (val: number) => {
    if (val >= 80) return '#10b981'; // green
    if (val >= 60) return '#3b82f6'; // blue
    if (val >= 40) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  const data = [
    {
      name: 'health',
      value: value,
      fill: getColor(value),
    },
  ];

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: config.width, height: config.height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            barSize={12}
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background
              dataKey="value"
              cornerRadius={10}
              animationDuration={1000}
              animationBegin={0}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        
        {/* Center Value */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className={cn('font-bold', config.fontSize)}
            style={{ color: getColor(value) }}
          >
            {value}
          </motion.div>
          {showLabel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-xs text-muted-foreground mt-1"
            >
              {label}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
