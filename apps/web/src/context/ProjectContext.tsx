import { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface ProjectWorkspace {
  source: "manual" | "jira";
  projectName: string;
  projectKey: string;
  sprintName: string;
  sprintGoal: string;
  jiraSite?: string;
  importedAt?: string;
}

interface ProjectContextValue {
  project: ProjectWorkspace | null;
  selectedProjectId: string | null;
  selectedSprintId: string | null;
  hasProject: boolean;
  selectProject: (projectId: string, project?: ProjectWorkspace) => void;
  selectSprint: (sprintId: string | null, sprint?: Pick<ProjectWorkspace, "sprintName" | "sprintGoal">) => void;
  saveProject: (project: ProjectWorkspace) => void;
  clearProject: () => void;
}

const STORAGE_KEY = "sprintpulse.project";
const SELECTED_PROJECT_KEY = "sprintpulse.selectedProjectId";
const SELECTED_SPRINT_KEY = "sprintpulse.selectedSprintId";

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

const readStoredProject = (): ProjectWorkspace | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ProjectWorkspace;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<ProjectWorkspace | null>(readStoredProject);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => window.localStorage.getItem(SELECTED_PROJECT_KEY)
  );
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(
    () => window.localStorage.getItem(SELECTED_SPRINT_KEY)
  );

  const selectProject = useCallback((projectId: string, nextProject?: ProjectWorkspace) => {
    const isDifferentProject = selectedProjectId !== projectId;
    window.localStorage.setItem(SELECTED_PROJECT_KEY, projectId);
    setSelectedProjectId(projectId);
    if (isDifferentProject) {
      window.localStorage.removeItem(SELECTED_SPRINT_KEY);
      setSelectedSprintId(null);
    }
    if (nextProject) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProject));
      setProject(nextProject);
    }
  }, [selectedProjectId]);

  const selectSprint = useCallback(
    (sprintId: string | null, sprint?: Pick<ProjectWorkspace, "sprintName" | "sprintGoal">) => {
      if (sprintId) {
        window.localStorage.setItem(SELECTED_SPRINT_KEY, sprintId);
      } else {
        window.localStorage.removeItem(SELECTED_SPRINT_KEY);
      }
      setSelectedSprintId(sprintId);

      if (sprint && project) {
        const nextProject = { ...project, ...sprint };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProject));
        setProject(nextProject);
      }
    },
    [project]
  );

  const saveProject = useCallback((nextProject: ProjectWorkspace) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProject));
    setProject(nextProject);
    if (nextProject.projectKey) {
      window.localStorage.setItem(SELECTED_PROJECT_KEY, nextProject.projectKey.toLowerCase());
      setSelectedProjectId(nextProject.projectKey.toLowerCase());
    }
    window.localStorage.removeItem(SELECTED_SPRINT_KEY);
    setSelectedSprintId(null);
  }, []);

  const clearProject = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(SELECTED_PROJECT_KEY);
    window.localStorage.removeItem(SELECTED_SPRINT_KEY);
    setProject(null);
    setSelectedProjectId(null);
    setSelectedSprintId(null);
  }, []);

  const value = useMemo<ProjectContextValue>(
    () => ({
      project,
      selectedProjectId,
      selectedSprintId,
      hasProject: Boolean(project || selectedProjectId),
      selectProject,
      selectSprint,
      saveProject,
      clearProject
    }),
    [clearProject, project, saveProject, selectProject, selectSprint, selectedProjectId, selectedSprintId]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used inside ProjectProvider");
  }

  return context;
}
