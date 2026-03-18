const WORKSPACE_STORAGE_KEY = 'turnbased.creator.workspaces';

export interface ProjectWorkspaceRecord {
  projectId: string;
  files: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface StoredWorkspaceRecords {
  workspaces: ProjectWorkspaceRecord[];
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function readStoredWorkspaces(): ProjectWorkspaceRecord[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(WORKSPACE_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as StoredWorkspaceRecords;
    return parsed.workspaces ?? [];
  } catch {
    return [];
  }
}

function writeStoredWorkspaces(workspaces: ProjectWorkspaceRecord[]): void {
  const storage = getStorage();
  storage?.setItem(
    WORKSPACE_STORAGE_KEY,
    JSON.stringify({
      workspaces,
    } satisfies StoredWorkspaceRecords),
  );
}

export function loadProjectWorkspace(projectId: string): ProjectWorkspaceRecord | null {
  return readStoredWorkspaces().find((workspace) => workspace.projectId === projectId) ?? null;
}

export function saveProjectWorkspace(projectId: string, files: Record<string, string>): ProjectWorkspaceRecord {
  const current = loadProjectWorkspace(projectId);
  const nextRecord: ProjectWorkspaceRecord = {
    projectId,
    files,
    createdAt: current?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const workspaces = readStoredWorkspaces().filter((workspace) => workspace.projectId !== projectId);
  workspaces.unshift(nextRecord);
  writeStoredWorkspaces(workspaces);
  return nextRecord;
}

export function deleteProjectWorkspace(projectId: string): void {
  writeStoredWorkspaces(readStoredWorkspaces().filter((workspace) => workspace.projectId !== projectId));
}
