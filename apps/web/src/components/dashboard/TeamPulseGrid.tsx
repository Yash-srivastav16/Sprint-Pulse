import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../ui/card';
import { RiskBadge } from '../ui/risk-badge';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  name: string;
  initials?: string;
  healthScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
  status: string;
}

interface TeamPulseGridProps {
  members: TeamMember[];
  getMemberHref?: (member: TeamMember) => string;
  className?: string;
}

export function TeamPulseGrid({ members, getMemberHref, className }: TeamPulseGridProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {members.map((member, index) => (
        <motion.div
          key={member.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05, duration: 0.3 }}
        >
          <Card className="glass hover:shadow-lg transition-all hover:scale-[1.02]">
            <CardContent className="p-4">
              <Link
                className={cn('block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', !getMemberHref && 'pointer-events-none')}
                to={getMemberHref?.(member) ?? '#'}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-info-500 flex items-center justify-center text-white font-bold text-lg">
                      {member.initials ?? member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={cn(
                      'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background',
                      member.healthScore >= 80 && 'bg-emerald-500',
                      member.healthScore >= 60 && member.healthScore < 80 && 'bg-blue-500',
                      member.healthScore >= 40 && member.healthScore < 60 && 'bg-amber-500',
                      member.healthScore < 40 && 'bg-red-500'
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">{member.name}</h4>
                    <p className="text-xs text-muted-foreground truncate">{member.status}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{member.healthScore}</p>
                    <p className="text-xs text-muted-foreground">Health Score</p>
                  </div>
                  <RiskBadge level={member.riskLevel} showIcon={false} />
                </div>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
