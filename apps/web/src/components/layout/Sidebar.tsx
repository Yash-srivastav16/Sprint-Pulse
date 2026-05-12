import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
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
  Sparkles,
  ShieldCheck
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
  const { persona, user, logout } = useAuth();
  const { project, selectedProjectId, selectedSprintId, selectProject, selectSprint, clearProject } = useProject();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [sprints, setSprints] = useState<SprintSummary[]>([]);
  const [switcherError, setSwitcherError] = useState<string | null>(null);
  const projectBase = selectedProjectId ? `/projects/${selectedProjectId}` : '';

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
    if (!persona || !selectedProjectId) {
      setSprints([]);
      return;
    }

    let isCurrent = true;
    api
      .getProjectSprints(selectedProjectId, persona.id)
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
  }, [persona, selectedProjectId, selectedSprintId, selectSprint]);

  useEffect(() => {
    if (!selectedProjectId || !projects.length) {
      return;
    }

    const selected = projects.find((item) => item.id === selectedProjectId);
    if (selected && (!project || project.projectKey !== selected.key)) {
      if (project && project.projectKey !== selected.key) {
        selectSprint(null);
      }
      selectProject(selected.id, toWorkspaceProject(selected));
    }
  }, [project, projects, selectProject, selectSprint, selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((item) => item.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const activeSprint = useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? sprints.find((sprint) => sprint.status === 'active') ?? null,
    [selectedSprintId, sprints]
  );

  const navigation = [
    { name: 'Projects', href: '/projects', icon: FolderKanban, end: true },
    ...(selectedProjectId && projectBase
      ? [
          { name: 'Workspace', href: projectBase, icon: Activity, end: true },
          { name: 'Standups', href: `${projectBase}/standups`, icon: ClipboardCheck },
          { name: 'Dashboard', href: `${projectBase}/dashboard`, icon: Gauge },
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
      className="relative z-20 hidden w-72 flex-col overflow-hidden border-r border-white/10 bg-gradient-to-b from-slate-950 via-slate-900 to-[#0e1726] text-white shadow-2xl dark:from-dark-bg dark:via-dark-surface dark:to-dark-bg lg:flex"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(135deg,rgba(21,154,140,0.16),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(20deg,rgba(114,84,184,0.14),transparent_62%)]" />
      {/* Logo Section */}
      <div className="relative border-b border-white/10 p-5">
        <Link to={selectedProjectId ? projectBase : '/projects'} className="flex items-center gap-3 group">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary-300 via-primary-500 to-info-500 shadow-glow-sm"
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
              value={selectedProjectId ?? ''}
              onChange={(event) => handleProjectChange(event.target.value)}
              className="h-11 w-full appearance-none rounded-lg border border-white/10 bg-white/[0.07] px-3 pr-9 text-sm font-bold text-white outline-none transition focus:border-primary-300/70 focus:bg-white/[0.1] [&>option]:bg-slate-900 [&>option]:text-white"
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

        {selectedProjectId ? (
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500" htmlFor="sprint-switcher">
              Sprint
            </label>
            <div className="relative">
              <select
                id="sprint-switcher"
                value={activeSprint?.id ?? ''}
                onChange={(event) => handleSprintChange(event.target.value)}
                className="h-11 w-full appearance-none rounded-lg border border-white/10 bg-white/[0.07] px-3 pr-9 text-sm font-bold text-white outline-none transition focus:border-info-300/70 focus:bg-white/[0.1] [&>option]:bg-slate-900 [&>option]:text-white"
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

        <div className="rounded-lg border border-white/10 bg-white/[0.055] p-3 shadow-glass">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-primary-200">
            <Sparkles className="h-3.5 w-3.5" />
            Current context
          </div>
          <p className="mt-2 truncate text-sm font-bold text-white">
            {project?.projectName ?? selectedProject?.name ?? (selectedProjectId ? 'Project selected' : 'Choose a project')}
          </p>
          <p className="mt-1 truncate text-xs text-slate-400">
            {activeSprint?.name ?? project?.sprintName ?? 'Select a project to unlock sprint signals'}
          </p>
        </div>
        {switcherError ? <p className="text-xs font-semibold text-amber-200">{switcherError}</p> : null}
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 space-y-2 overflow-y-auto p-4">
        {navigation.map((item) => {
          return (
            <NavLink key={item.name} to={item.href} end={item.end}>
              {({ isActive }) => (
                <motion.div
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-primary-500/24 via-primary-500/12 to-transparent border border-primary-400/30 text-white shadow-glow-sm'
                      : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
                  )}
                >
                  <item.icon className={cn(
                    'w-5 h-5 transition-colors',
                    isActive ? 'text-primary-400' : 'text-slate-400 group-hover:text-primary-400'
                  )} />
                  <span className="font-medium flex-1">{item.name}</span>
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <ChevronRight className="w-4 h-4 text-primary-400" />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </NavLink>
          );
        })}
        {!selectedProjectId ? (
          <div className="mt-4 rounded-lg border border-dashed border-white/12 bg-white/[0.035] p-4 text-sm text-slate-400">
            <strong className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-300">Project pages</strong>
            Choose a project to open Workspace, Standups, Dashboard, Team, Sprints, and Integrations.
          </div>
        ) : null}
      </nav>

      {/* User Profile Section */}
      <div className="relative p-4 border-t border-white/10">
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100">
          <ShieldCheck className="h-4 w-4" />
          Role-aware workspace
        </div>
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 cursor-pointer hover:bg-slate-800/70 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-info-500 flex items-center justify-center text-white font-bold">
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
            className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-700/70 hover:text-white"
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
