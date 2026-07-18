const projectDataCache = new Map<string, unknown>();

export const projectCacheKey = (scope: string, parts: Array<string | null | undefined>) =>
  [scope, ...parts.map((part) => part ?? "")].join(":");

export const readProjectCache = <T>(key: string): T | null => (projectDataCache.get(key) as T | undefined) ?? null;

export const writeProjectCache = <T>(key: string, value: T) => {
  projectDataCache.set(key, value);
  return value;
};

export const clearProjectCache = (projectId?: string) => {
  if (!projectId) {
    projectDataCache.clear();
    return;
  }

  const projectMarker = `:${projectId}:`;
  for (const key of projectDataCache.keys()) {
    if (key.includes(projectMarker)) {
      projectDataCache.delete(key);
    }
  }
};
