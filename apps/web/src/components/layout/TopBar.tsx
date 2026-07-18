import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Search, Bell, Command, Menu, Radio, AlertTriangle, Bot, CheckCircle2, Sparkles } from 'lucide-react';
import type { AiNotification, ProjectNotificationsResponse } from '@sprintpulse/shared';
import { ThemeToggle } from '../ui/theme-toggle';
import { Button } from '../ui/button';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api';

const routeNames: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/team': 'Team',
  '/projects': 'Projects',
  '/standup': 'Standup',
  '/settings': 'Settings',
};

const segmentNames: Record<string, string> = {
  new: 'Create project',
  connect: 'Connect project',
  dashboard: 'Dashboard',
  standups: 'Standups',
  team: 'Team',
  sprints: 'Sprints',
  integrations: 'Integrations',
  members: 'Member',
};

interface TopBarProps {
  onOpenCommand: () => void;
  onToggleMobileSidebar?: () => void;
}

export function TopBar({ onOpenCommand, onToggleMobileSidebar }: TopBarProps) {
  const location = useLocation();
  const { persona } = useAuth();
  const { project, selectedProjectId, selectedSprintId } = useProject();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ProjectNotificationsResponse | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const projectRouteSegment = location.pathname.split('/').filter(Boolean)[1];
  const isProjectScopedRoute = Boolean(projectRouteSegment && !['new', 'connect'].includes(projectRouteSegment));
  const notificationProjectId = isProjectScopedRoute ? projectRouteSegment : selectedProjectId;

  const loadNotifications = useCallback(async () => {
    if (!persona) {
      setNotifications(null);
      return;
    }

    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const response = await api.getProjectNotifications({
        personaId: persona.id,
        projectId: notificationProjectId,
        sprintId: selectedSprintId
      });
      setNotifications(response);
    } catch (err) {
      setNotificationsError(err instanceof Error ? err.message : 'Notifications unavailable');
    } finally {
      setNotificationsLoading(false);
    }
  }, [notificationProjectId, persona?.id, selectedSprintId]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const refreshAfterSignalChange = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (!detail?.projectId || detail.projectId === notificationProjectId) {
        void loadNotifications();
      }
    };

    window.addEventListener('sprintpulse:signals-updated', refreshAfterSignalChange);
    return () => window.removeEventListener('sprintpulse:signals-updated', refreshAfterSignalChange);
  }, [loadNotifications, notificationProjectId]);

  useEffect(() => {
    if (notificationsOpen && notifications?.notifications) {
      notifications.notifications.forEach((n) => seenNotificationIds.current.add(n.id));
    }
  }, [notificationsOpen, notifications]);
  
  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Home', path: '/' }];
    
    let currentPath = '';
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      const isProjectId = paths[index - 1] === 'projects' && !['new', 'connect'].includes(path);
      const isMemberId = paths[index - 1] === 'members';
      const projectName = isProjectScopedRoute ? project?.projectKey ?? 'Project' : segmentNames[path] ?? 'Project';
      breadcrumbs.push({
        name:
          routeNames[currentPath] ||
          (isProjectId ? projectName : isMemberId ? 'Pulse' : segmentNames[path] || path.charAt(0).toUpperCase() + path.slice(1)),
        path: currentPath,
      });
    });
    
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();
  const visibleBreadcrumbs = breadcrumbs.length > 3 ? [breadcrumbs[0], ...breadcrumbs.slice(-2)] : breadcrumbs;
  const unreadCount = notifications?.notifications.filter((n) => !seenNotificationIds.current.has(n.id)).length ?? 0;
  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false);
    requestAnimationFrame(() => notificationButtonRef.current?.focus());
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-40 h-16 border-b border-white/70 bg-white/[0.76] shadow-[0_10px_35px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-white/10 dark:bg-dark-surface/[0.82] dark:shadow-[0_12px_40px_rgba(0,0,0,0.24)]"
    >
      <div className="mx-auto flex h-full w-full max-w-[1840px] items-center justify-between gap-4 px-4 sm:px-5 lg:px-7">
        {/* Mobile sidebar toggle */}
        {onToggleMobileSidebar ? (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-2xl lg:hidden"
            onClick={onToggleMobileSidebar}
            type="button"
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : null}

        {/* Breadcrumbs */}
        <div className="flex min-w-0 items-center gap-4">
          <div className="hidden h-9 items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-3 text-xs font-black uppercase text-primary-700 shadow-sm dark:text-primary-200 xl:inline-flex">
            <Radio className="h-3.5 w-3.5" />
              {isProjectScopedRoute && project ? `${project.projectKey} selected` : isProjectScopedRoute && selectedProjectId ? 'Project selected' : 'SprintPulse'}
          </div>
          <div className="flex min-w-0 items-center gap-2 overflow-hidden text-sm">
            {visibleBreadcrumbs.map((crumb, index) => (
              <div key={crumb.path} className="flex min-w-0 items-center gap-2">
                {index > 0 && <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                {index === visibleBreadcrumbs.length - 1 ? (
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
        <div className="relative flex items-center gap-3">
          {/* Routes to the MCP section on the Integrations page. Hidden below
              lg breakpoint to keep the bar tidy on small screens. */}
          {notificationProjectId ? (
            <Link
              to={`/projects/${notificationProjectId}/integrations#mcp`}
              className="mcp-agent-highlight hidden h-9 items-center gap-2 rounded-full px-3.5 text-xs font-black text-ai-900 transition hover:scale-[1.02] dark:text-white lg:inline-flex"
              title="Connect Claude Code, Cursor, or any MCP-capable agent host to this project"
            >
              <span className="relative inline-flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ai-500 opacity-90" />
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-500 opacity-60 [animation-delay:400ms]" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ai-600 shadow-[0_0_12px_rgba(132,98,232,0.85)]" />
              </span>
              <Bot className="h-3.5 w-3.5 text-ai-700 dark:text-ai-100" />
              <span className="uppercase tracking-[0.12em]">Works with agent &middot; MCP</span>
            </Link>
          ) : null}

          {/* Search */}
          <Button
            variant="outline"
            className="relative hidden w-72 justify-start rounded-2xl border-slate-200/80 bg-white/[0.74] text-sm text-muted-foreground shadow-sm backdrop-blur hover:bg-white md:flex dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.09]"
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
          <Button
            ref={notificationButtonRef}
            variant="ghost"
            size="icon"
            className="relative rounded-2xl focus-visible:ring-2 focus-visible:ring-primary-400"
            onClick={() => {
              setNotificationsOpen((open) => !open);
              void loadNotifications();
            }}
            type="button"
            aria-label="Open notifications"
            aria-expanded={notificationsOpen}
            aria-controls="sprintpulse-notifications-panel"
          >
            <Bell className="h-5 w-5" />
            {unreadCount ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger-500 px-1 text-[10px] font-black text-white ring-2 ring-background">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </Button>

          {/* Theme Toggle */}
          <ThemeToggle />

          <AnimatePresence>
            {notificationsOpen ? (
              <NotificationPanel
                data={notifications}
                loading={notificationsLoading}
                error={notificationsError}
                onClose={closeNotifications}
                returnFocusRef={notificationButtonRef}
              />
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.header>
  );
}

function notificationTone(notification: AiNotification) {
  if (notification.severity === 'critical' || notification.severity === 'high') {
    return {
      icon: AlertTriangle,
      className: 'border-danger-500/35 bg-white text-danger-700 dark:bg-slate-950 dark:text-danger-100',
      chip: 'border-danger-500/25 bg-danger-500/15 text-danger-700 dark:text-danger-100'
    };
  }
  if (notification.severity === 'medium') {
    return {
      icon: Sparkles,
      className: 'border-warning-500/35 bg-white text-warning-700 dark:bg-slate-950 dark:text-warning-100',
      chip: 'border-warning-500/25 bg-warning-500/15 text-warning-700 dark:text-warning-100'
    };
  }
  return {
    icon: CheckCircle2,
    className: 'border-primary-500/35 bg-white text-primary-700 dark:bg-slate-950 dark:text-primary-100',
    chip: 'border-primary-500/25 bg-primary-500/15 text-primary-700 dark:text-primary-100'
  };
}

function NotificationPanel({
  data,
  loading,
  error,
  onClose,
  returnFocusRef
}: {
  data: ProjectNotificationsResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        requestAnimationFrame(() => returnFocusRef.current?.focus());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, returnFocusRef]);

  return (
    <motion.div
      id="sprintpulse-notifications-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="sprintpulse-notifications-title"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className="absolute right-0 top-12 z-50 w-[min(430px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-950 dark:shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
    >
      <div className="border-b border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-700 dark:text-primary-200">
              Role signal feed
            </p>
            <h3 id="sprintpulse-notifications-title" className="mt-1 text-lg font-black text-slate-950 dark:text-white">
              {data?.project ? `${data.project.key} notifications` : 'Notifications'}
            </h3>
          </div>
          <Button ref={closeButtonRef} variant="ghost" size="sm" className="h-8 rounded-xl px-3 text-xs font-black" onClick={onClose}>
            Close
          </Button>
        </div>
        {data?.meta ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Prioritized for {data.viewer.productPersona.replace(/-/g, ' ')} from the latest sprint, standup, Jira, and Git evidence.
          </p>
        ) : null}
      </div>

      <div className="max-h-[430px] space-y-3 overflow-y-auto p-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
            Reading sprint signals...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-danger-500/20 bg-danger-500/10 p-4 text-sm font-semibold text-danger-700 dark:text-danger-100">
            {error.includes('timed out') ? 'Notification analysis timed out. Open again after the page settles or use the dashboard refresh.' : error}
          </div>
        ) : data?.notifications.length ? (
          data.notifications.map((notification) => {
            const tone = notificationTone(notification);
            const Icon = tone.icon;
            const content = (
              <article className={`group rounded-2xl border border-l-4 p-4 transition focus-within:ring-2 focus-within:ring-primary-400 hover:-translate-y-0.5 hover:shadow-lg ${tone.className}`}>
                <div className="flex items-start gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${tone.chip}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-sm font-black text-slate-950 dark:text-white">{notification.title}</h4>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${tone.chip}`}>
                        {notification.severity}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">{notification.message}</p>
                    <p className="mt-3 text-xs font-black text-primary-700 dark:text-primary-200">{notification.actionLabel}</p>
                  </div>
                </div>
              </article>
            );

            return notification.actionHref ? (
              <Link className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400" to={notification.actionHref} onClick={onClose} key={notification.id}>
                {content}
              </Link>
            ) : (
              <div key={notification.id}>{content}</div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
            Select a project to see role-aware sprint updates.
          </div>
        )}
      </div>
    </motion.div>
  );
}
