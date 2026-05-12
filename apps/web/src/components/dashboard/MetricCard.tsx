import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import CountUp from 'react-countup';
import { Card, CardContent } from '../ui/card';
import { SparkLine } from '../charts/SparkLine';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: number;
  suffix?: string;
  prefix?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  sparklineData?: Array<{ value: number }>;
  color?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  suffix = '',
  prefix = '',
  icon: Icon,
  trend = 'neutral',
  trendValue,
  sparklineData,
  color = '#159a8c',
  className
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn('glass border-border/50 hover:shadow-lg transition-shadow', className)}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
              <div className="flex items-baseline gap-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
                  className="text-3xl font-bold"
                >
                  {prefix}
                  <CountUp end={value} duration={1.5} separator="," />
                  {suffix}
                </motion.div>
              </div>
              {trendValue && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className={cn(
                    'text-sm font-medium mt-1',
                    trend === 'up' && 'text-emerald-600 dark:text-emerald-400',
                    trend === 'down' && 'text-red-600 dark:text-red-400',
                    trend === 'neutral' && 'text-muted-foreground'
                  )}
                >
                  {trendValue}
                </motion.p>
              )}
            </div>
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ 
                background: `linear-gradient(135deg, ${color}20, ${color}10)`,
                border: `1px solid ${color}30`
              }}
            >
              <Icon className="w-6 h-6" style={{ color }} />
            </motion.div>
          </div>
          
          {sparklineData && sparklineData.length > 0 && (
            <SparkLine 
              data={sparklineData} 
              trend={trend}
              color={color}
              height={50}
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
