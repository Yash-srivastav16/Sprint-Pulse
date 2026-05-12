import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Search, Bell, Command, Radio } from 'lucide-react';
import { ThemeToggle } from '../ui/theme-toggle';
import { Button } from '../ui/button';
import { useProject } from '@/context/ProjectContext';

const routeNames: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/team': 'Team',
  '/projects': 'Projects',
  '/standup': 'Standup',
  '/settings': 'Settings',
};

const segmentNames: Record<string, string> = {
  dashboard: 'Dashboard',
  standups: 'Standups',
  team: 'Team',
  sprints: 'Sprints',
  integrations: 'Integrations',
  members: 'Member',
};

interface TopBarProps {
  onOpenCommand: () => void;
}

export function TopBar({ onOpenCommand }: TopBarProps) {
  const location = useLocation();
  const { project, selectedProjectId } = useProject();
  
  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Home', path: '/' }];
    
    let currentPath = '';
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      const isProjectId = paths[index - 1] === 'projects';
      const isMemberId = paths[index - 1] === 'members';
      breadcrumbs.push({
        name:
          routeNames[currentPath] ||
          (isProjectId
            ? project?.projectKey ?? 'Project'
            : isMemberId
              ? 'Pulse'
              : segmentNames[path] || path.charAt(0).toUpperCase() + path.slice(1)),
        path: currentPath,
      });
    });
    
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-40 h-16 border-b border-white/70 bg-white/76 shadow-[0_10px_35px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-white/10 dark:bg-dark-surface/82 dark:shadow-[0_12px_40px_rgba(0,0,0,0.24)]"
    >
      <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <div className="flex min-w-0 items-center gap-4">
          <div className="hidden h-9 items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-3 text-xs font-black uppercase text-primary-700 shadow-sm dark:text-primary-200 xl:inline-flex">
            <Radio className="h-3.5 w-3.5" />
              {project ? `${project.projectKey} selected` : selectedProjectId ? 'Project selected' : 'Workspace'}
          </div>
          <div className="flex min-w-0 items-center gap-2 overflow-hidden text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.path} className="flex min-w-0 items-center gap-2">
                {index > 0 && <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                {index === breadcrumbs.length - 1 ? (
                  <span className="truncate font-semibold text-foreground">{crumb.name}</span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="truncate text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {crumb.name}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 justify-center px-3" />

        {/* Right Section - Search and Actions */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <Button
            variant="outline"
            className="relative hidden w-72 justify-start rounded-2xl border-slate-200/80 bg-white/74 text-sm text-muted-foreground shadow-sm backdrop-blur hover:bg-white md:flex dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.09]"
            onClick={onOpenCommand}
            type="button"
          >
            <Search className="mr-2 h-4 w-4" />
            <span className="flex-1 text-left">Jump to page...</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-lg border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <Command className="h-3 w-3" />K
            </kbd>
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative rounded-2xl">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full ring-2 ring-background" />
          </Button>

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </motion.header>
  );
}
