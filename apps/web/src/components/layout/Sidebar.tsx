import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Activity,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  LogOut,
  Users, 
  FolderKanban, 
  Gauge,
  PlugZap,
  Zap,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import type { ProjectSummary, SprintSummary } from '@sprintpulse/shared';
import { api } from '@/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { type ProjectWorkspace, useProject } from '@/context/ProjectContext';

const toWorkspaceProject = (item: ProjectSummary): ProjectWorkspace => ({
  source: item.source === 'manual' ? 'manual' : 'jira',
  projectName: item.name,
  projectKey: item.key,
  sprintName: item.sprintName,
  sprintGoal: item.sprintGoal,
  importedAt: item.lastSyncAt,
});

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { persona, user, logout } = useAuth();
  const { project, selectedProjectId, selectedSprintId, selectProject, selectSprint, clearProject } = useProject();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [sprints, setSprints] = useState<SprintSummary[]>([]);
  const [switcherError, setSwitcherError] = useState<string | null>(null);
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const projectRouteSegment = pathSegments[1];
  const isProjectScopedRoute = Boolean(projectRouteSegment && !['new', 'connect'].includes(projectRouteSegment));
  const visibleProjectId = isProjectScopedRoute ? projectRouteSegment ?? selectedProjectId : null;
  const projectBase = visibleProjectId ? `/projects/${visibleProjectId}` : '';

  useEffect(() => {
    if (!persona) {
      setProjects([]);
      return;
    }

    let isCurrent = true;
    api
      .getProjects(persona.id)
      .then((response) => {
        if (!isCurrent) {
          return;
        }
        setProjects(response.projects);
        setSwitcherError(null);
        if (selectedProjectId && !response.projects.some((item) => item.id === selectedProjectId)) {
          const staleProjectId = selectedProjectId;
          clearProject();
          setSprints([]);
          if (window.location.pathname.includes(`/projects/${staleProjectId}`)) {
            navigate('/projects', { replace: true });
          }
        }
      })
      .catch(() => {
        if (isCurrent) {
          setSwitcherError('Project list unavailable');
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [clearProject, navigate, persona, selectedProjectId]);

  useEffect(() => {
    if (!persona || !visibleProjectId) {
      setSprints([]);
      return;
    }

    let isCurrent = true;
    api
      .getProjectSprints(visibleProjectId, persona.id)
      .then((response) => {
        if (!isCurrent) {
          return;
        }
        setSprints(response.sprints);
        if (selectedSprintId && !response.sprints.some((sprint) => sprint.id === selectedSprintId)) {
          selectSprint(null);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setSprints([]);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [persona, selectedSprintId, selectSprint, visibleProjectId]);

  useEffect(() => {
    if (!visibleProjectId || !projects.length) {
      return;
    }

    const selected = projects.find((item) => item.id === visibleProjectId);
    if (selected && (!project || project.projectKey !== selected.key)) {
      if (project && project.projectKey !== selected.key) {
        selectSprint(null);
      }
      selectProject(selected.id, toWorkspaceProject(selected));
    }
  }, [project, projects, selectProject, selectSprint, visibleProjectId]);

  const selectedProject = useMemo(
    () => projects.find((item) => item.id === visibleProjectId) ?? null,
    [projects, visibleProjectId]
  );
  const activeSprint = useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? sprints.find((sprint) => sprint.status === 'active') ?? null,
    [selectedSprintId, sprints]
  );

  const navigation = [
    { name: 'Projects', href: '/projects', icon: FolderKanban, end: true },
    ...(visibleProjectId && projectBase
      ? [
          { name: 'Workspace', href: projectBase, icon: Activity, end: true },
          { name: 'Dashboard', href: `${projectBase}/dashboard`, icon: Gauge },
          { name: 'Standups', href: `${projectBase}/standups`, icon: ClipboardCheck },
          { name: 'Team', href: `${projectBase}/team`, icon: Users },
          { name: 'Sprints', href: `${projectBase}/sprints`, icon: CalendarDays },
          { name: 'Integrations', href: `${projectBase}/integrations`, icon: PlugZap },
        ]
      : []),
  ];

  const handleLogout = () => {
    clearProject();
    logout();
    navigate('/login');
  };

  const handleProjectChange = (projectId: string) => {
    if (!projectId) {
      clearProject();
      navigate('/projects');
      return;
    }

    const nextProject = projects.find((item) => item.id === projectId);
    if (nextProject) {
      selectProject(nextProject.id, toWorkspaceProject(nextProject));
      navigate(`/projects/${nextProject.id}`);
    }
  };

  const handleSprintChange = (sprintId: string) => {
    const sprint = sprints.find((item) => item.id === sprintId);
    if (!sprint) {
      selectSprint(null);
      return;
    }

    selectSprint(sprint.id, {
      sprintName: sprint.name,
      sprintGoal: sprint.goal,
    });
  };

  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="relative z-20 hidden h-screen w-80 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-gradient-to-b from-[#060a13] via-[#0d1422] to-[#111a2b] text-white shadow-2xl dark:from-dark-bg dark:via-dark-surface dark:to-dark-bg lg:flex"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_22%_0%,rgba(16,169,154,0.26),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-[radial-gradient(circle_at_78%_100%,rgba(132,98,232,0.20),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.10)_1px,transparent_1px)] [background-size:34px_34px]" />
      {/* Logo Section */}
      <div className="relative border-b border-white/10 p-5">
        <Link to={visibleProjectId ? projectBase : '/projects'} className="flex items-center gap-3 group">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-300 via-primary-500 to-info-500 shadow-glow-sm ring-1 ring-white/25"
          >
            <Zap className="h-6 w-6 text-white" />
          </motion.div>
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-normal text-white">SprintPulse</h1>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">Delivery nerve center</p>
          </div>
        </Link>
      </div>

      <div className="relative space-y-3 border-b border-white/10 p-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500" htmlFor="project-switcher">
            Project
          </label>
          <div className="relative">
            <select
              id="project-switcher"
              value={visibleProjectId ?? ''}
              onChange={(event) => handleProjectChange(event.target.value)}
              className="h-11 w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.07] px-3 pr-9 text-sm font-bold text-white outline-none transition focus:border-primary-300/70 focus:bg-white/[0.1] [&>option]:bg-slate-900 [&>option]:text-white"
            >
              <option value="">Choose project</option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.key} · {item.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {visibleProjectId ? (
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500" htmlFor="sprint-switcher">
              Sprint
            </label>
            <div className="relative">
              <select
                id="sprint-switcher"
                value={activeSprint?.id ?? ''}
                onChange={(event) => handleSprintChange(event.target.value)}
                className="h-11 w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.07] px-3 pr-9 text-sm font-bold text-white outline-none transition focus:border-info-300/70 focus:bg-white/[0.1] [&>option]:bg-slate-900 [&>option]:text-white"
              >
                {sprints.length ? null : <option value="">Active sprint</option>}
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.status === 'active' ? 'Active · ' : sprint.status === 'closed' ? 'Closed · ' : ''}
                    {sprint.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/[0.065] p-3 shadow-glass backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-primary-200">
            <Sparkles className="h-3.5 w-3.5" />
            Current context
          </div>
          <p className="mt-2 truncate text-sm font-bold text-white">
            {visibleProjectId ? project?.projectName ?? selectedProject?.name ?? 'Project selected' : 'Choose or create a project'}
          </p>
          <p className="mt-1 truncate text-xs text-slate-400">
            {visibleProjectId ? activeSprint?.name ?? project?.sprintName ?? 'Select a sprint to unlock signals' : 'Project pages unlock after opening a workspace'}
          </p>
        </div>
        {switcherError ? <p className="text-xs font-semibold text-amber-200">{switcherError}</p> : null}
      </div>

      {/* Navigation */}
      <nav className="relative min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {navigation.map((item) => {
          return (
            <NavLink key={item.name} to={item.href} end={item.end}>
              {({ isActive }) => (
                <motion.div
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'group relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 transition-all duration-200',
                    isActive
                      ? 'border border-primary-300/30 bg-gradient-to-r from-primary-400/24 via-info-500/12 to-white/[0.035] text-white shadow-glow-sm'
                      : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
                  )}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="sidebar-active-rail"
                      className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-primary-300 shadow-glow-sm"
                    />
                  ) : null}
                  <item.icon className={cn(
                    'relative h-5 w-5 transition-colors',
                    isActive ? 'text-primary-200' : 'text-slate-400 group-hover:text-primary-300'
                  )} />
                  <span className="relative flex-1 font-semibold">{item.name}</span>
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <ChevronRight className="h-4 w-4 text-primary-200" />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </NavLink>
          );
        })}
        {!visibleProjectId ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/12 bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">
            <strong className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-300">Project pages</strong>
            Choose a project to open Workspace, Dashboard, Standups, Team, Sprints, and Integrations.
          </div>
        ) : null}
      </nav>

      {/* User Profile Section */}
      <div className="relative shrink-0 border-t border-white/10 bg-slate-950/35 p-4 backdrop-blur">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.065] p-3 shadow-glass transition-colors hover:bg-white/[0.09]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 via-info-500 to-ai-500 font-bold text-white ring-1 ring-white/25">
            {persona?.initials || user?.email?.charAt(0).toUpperCase() || 'SP'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {persona?.name || user?.email?.split('@')[0] || 'SprintPulse user'}
            </p>
            <p className="text-xs text-slate-400 truncate">{persona?.title || 'Workspace member'}</p>
          </div>
          <button
            aria-label="Logout"
            className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            type="button"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    </motion.aside>
  );
}
