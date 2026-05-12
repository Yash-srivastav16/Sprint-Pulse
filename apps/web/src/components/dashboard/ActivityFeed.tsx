import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  type: 'commit' | 'pr' | 'issue' | 'standup' | 'risk';
  user: string;
  action: string;
  timestamp: string;
  icon?: React.ReactNode;
}

interface ActivityFeedProps {
  activities: Activity[];
  className?: string;
}

export function ActivityFeed({ activities, className }: ActivityFeedProps) {
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'commit':
        return 'bg-primary-500';
      case 'pr':
        return 'bg-info-500';
      case 'issue':
        return 'bg-warning-500';
      case 'risk':
        return 'bg-danger-500';
      default:
        return 'bg-muted';
    }
  };

  return (
    <Card className={cn('glass', className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <CardTitle>Recent Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-muted-foreground"
            >
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
            </motion.div>
          ) : (
            activities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="flex gap-3"
              >
                <div className="relative">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold', getActivityColor(activity.type))}>
                    {activity.user.charAt(0).toUpperCase()}
                  </div>
                  {index < activities.length - 1 && (
                    <div className="absolute top-8 left-4 w-px h-4 bg-border" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-2">
                  <p className="text-sm">
                    <span className="font-semibold">{activity.user}</span>
                    {' '}
                    <span className="text-muted-foreground">{activity.action}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
