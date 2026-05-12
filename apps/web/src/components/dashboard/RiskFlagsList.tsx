import { motion } from 'framer-motion';
import { AlertTriangle, Clock, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { RiskBadge } from '../ui/risk-badge';
import { cn } from '@/lib/utils';

interface RiskFlag {
  id: string;
  title: string;
  member: string;
  timestamp: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
  description: string;
}

interface RiskFlagsListProps {
  flags: RiskFlag[];
  className?: string;
}

export function RiskFlagsList({ flags, className }: RiskFlagsListProps) {
  return (
    <Card className={cn('glass', className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-danger-500" />
          <CardTitle>Risk Flags</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {flags.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-muted-foreground"
            >
              <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No risk flags detected</p>
            </motion.div>
          ) : (
            flags.map((flag, index) => (
              <motion.div
                key={flag.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">{flag.title}</h4>
                      <RiskBadge level={flag.riskLevel} showIcon={false} animated={false} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {flag.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{flag.member}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{flag.timestamp}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
