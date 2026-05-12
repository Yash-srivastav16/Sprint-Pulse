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
  hasProject: boolean;
  selectProject: (projectId: string, project?: ProjectWorkspace) => void;
  saveProject: (project: ProjectWorkspace) => void;
  clearProject: () => void;
}

const STORAGE_KEY = "sprintpulse.project";
const SELECTED_PROJECT_KEY = "sprintpulse.selectedProjectId";

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

  const selectProject = useCallback((projectId: string, nextProject?: ProjectWorkspace) => {
    window.localStorage.setItem(SELECTED_PROJECT_KEY, projectId);
    setSelectedProjectId(projectId);
    if (nextProject) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProject));
      setProject(nextProject);
    }
  }, []);

  const saveProject = useCallback((nextProject: ProjectWorkspace) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProject));
    setProject(nextProject);
    if (nextProject.projectKey) {
      window.localStorage.setItem(SELECTED_PROJECT_KEY, nextProject.projectKey.toLowerCase());
      setSelectedProjectId(nextProject.projectKey.toLowerCase());
    }
  }, []);

  const clearProject = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(SELECTED_PROJECT_KEY);
    setProject(null);
    setSelectedProjectId(null);
  }, []);

  const value = useMemo<ProjectContextValue>(
    () => ({
      project,
      selectedProjectId,
      hasProject: Boolean(project || selectedProjectId),
      selectProject,
      saveProject,
      clearProject
    }),
    [clearProject, project, saveProject, selectProject, selectedProjectId]
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
