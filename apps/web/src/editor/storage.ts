import type { EditorProject, StoredEditorProjects } from './types';
import { ensureProjectManifest } from './manifest';
import {
  createDefaultAppLayout,
  createDefaultProjectSettings,
  createDefaultProjectViews,
  createDefaultRulesBrief,
  createDefaultSeats,
  syncProjectViews,
} from './project';
import { createDefaultProjectColorPalette } from './projectPalette';
import { deleteProjectWorkspace } from './workspace';

const STORAGE_KEY = 'turnbased.creator.projects';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function clampPlayerCount(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.max(1, Math.min(6, numeric));
}

function normalizeEditorProject(project: EditorProject): EditorProject {
  const defaultBrief = createDefaultRulesBrief();
  const legacyPlayerCount = clampPlayerCount((project.brief as Partial<Record<'playerCount', number>> | undefined)?.playerCount, project.seats?.length ?? 2);
  const minPlayers = clampPlayerCount(project.brief?.minPlayers, Math.min(2, legacyPlayerCount));
  const maxPlayers = clampPlayerCount(project.brief?.maxPlayers, legacyPlayerCount);
  const normalizedBrief = {
    ...defaultBrief,
    ...(project.brief ?? {}),
    name: project.brief?.name ?? project.name ?? defaultBrief.name,
    minPlayers: Math.min(minPlayers, maxPlayers),
    maxPlayers: Math.max(minPlayers, maxPlayers),
    hasDistinctSoloMode: Boolean(project.brief?.hasDistinctSoloMode),
    isCampaignGame: Boolean(project.brief?.isCampaignGame),
    theme: project.brief?.theme ?? defaultBrief.theme,
    artStyle: project.brief?.artStyle ?? defaultBrief.artStyle,
  };
  const seatCount = Math.max(project.seats?.length ?? 0, normalizedBrief.maxPlayers, 1);
  const defaultSeats = createDefaultSeats(seatCount);
  const seats = (project.seats?.length ? project.seats : defaultSeats).map((seat, index) => ({
    ...defaultSeats[index % defaultSeats.length],
    ...seat,
    identity: {
      ...defaultSeats[index % defaultSeats.length].identity,
      ...(seat.identity ?? {}),
    },
    resources: {
      ...defaultSeats[index % defaultSeats.length].resources,
      ...(seat.resources ?? {}),
    },
  }));
  const defaultViews = createDefaultProjectViews(seats, project.name);
  const views = syncProjectViews((project as EditorProject).views ?? defaultViews, seats, project.name);

  return {
    ...ensureProjectManifest(project),
    phase: project.phase ?? 'ready',
    brief: normalizedBrief,
    seats,
    views,
    settings: {
      ...createDefaultProjectSettings(),
      ...(project.settings ?? {}),
      colorPalette: {
        ...createDefaultProjectColorPalette(),
        ...(project.settings?.colorPalette ?? {}),
      },
    },
    appLayout: {
      ...createDefaultAppLayout(project.name),
      ...(project.appLayout ?? {}),
    },
  };
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
    return (parsed.projects ?? []).map((project) => normalizeEditorProject(project));
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
  deleteProjectWorkspace(projectId);
}
