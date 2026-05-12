import { motion } from 'framer-motion';
import { Sparkles, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionLabel?: string;
}

interface RecommendationsPanelProps {
  recommendations: Recommendation[];
  className?: string;
}

export function RecommendationsPanel({ recommendations, className }: RecommendationsPanelProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-danger-500';
      case 'medium':
        return 'border-l-warning-500';
      default:
        return 'border-l-info-500';
    }
  };

  return (
    <Card className={cn('glass border-ai-500/30', className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <Sparkles className="w-5 h-5 text-ai-500" />
          </motion.div>
          <CardTitle className="bg-gradient-to-r from-ai-600 to-ai-400 bg-clip-text text-transparent">
            AI Recommendations
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-muted-foreground"
            >
              <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No recommendations at this time</p>
            </motion.div>
          ) : (
            recommendations.map((rec, index) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                whileHover={{ x: 4 }}
                className={cn(
                  'p-4 rounded-lg border-l-4 bg-gradient-to-r from-ai-500/5 to-transparent',
                  'border border-border/50 hover:bg-ai-500/10 transition-all cursor-pointer',
                  getPriorityColor(rec.priority)
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm mb-1">{rec.title}</h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      {rec.description}
                    </p>
                    {rec.actionLabel && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        {rec.actionLabel}
                        <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                  <Sparkles className="w-4 h-4 text-ai-500 flex-shrink-0" />
                </div>
              </motion.div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
