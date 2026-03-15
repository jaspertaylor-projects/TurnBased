import type { EditorProject, StoredEditorProjects } from './types';
import { ensureProjectManifest } from './manifest';

const STORAGE_KEY = 'turnbased.creator.projects';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export function loadEditorProjects(): EditorProject[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as StoredEditorProjects;
    return (parsed.projects ?? []).map((project) => ensureProjectManifest(project));
  } catch {
    return [];
  }
}

export function loadEditorProject(projectId: string): EditorProject | null {
  return loadEditorProjects().find((project) => project.id === projectId) ?? null;
}

export function saveEditorProject(project: EditorProject): void {
  const projects = loadEditorProjects();
  const nextProjects = projects.filter((entry) => entry.id !== project.id);
  nextProjects.unshift(project);

  const storage = getStorage();
  storage?.setItem(
    STORAGE_KEY,
    JSON.stringify({
      projects: nextProjects,
    } satisfies StoredEditorProjects),
  );
}

export function deleteEditorProject(projectId: string): void {
  const projects = loadEditorProjects().filter((project) => project.id !== projectId);
  const storage = getStorage();
  storage?.setItem(
    STORAGE_KEY,
    JSON.stringify({
      projects,
    } satisfies StoredEditorProjects),
  );
}
