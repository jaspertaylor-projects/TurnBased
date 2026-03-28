import type { EditorArtReference, EditorIconAsset, EditorProject, StoredEditorProjects } from './types';
import { ensureProjectManifest } from './manifest';
import {
  createDefaultAppLayout,
  createDefaultProjectArtDirection,
  createDefaultProjectSettings,
  createDefaultProjectViews,
  createDefaultRulesBrief,
  createDefaultSeats,
  syncProjectViews,
} from './project';
import { createDefaultProjectColorPalette, createProjectPaletteReference } from './projectPalette';
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

function normalizeArtReference(
  item: Partial<EditorArtReference> | undefined,
  fallbackId: string,
): EditorArtReference {
  return {
    id: typeof item?.id === 'string' && item.id.trim().length > 0 ? item.id : fallbackId,
    name: typeof item?.name === 'string' ? item.name : '',
    category: typeof item?.category === 'string' ? item.category : '',
    description: typeof item?.description === 'string' ? item.description : '',
    tags: Array.isArray(item?.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : [],
  };
}

function normalizeIconAsset(
  item: Partial<EditorIconAsset> | undefined,
  fallbackId: string,
): EditorIconAsset {
  return {
    id: typeof item?.id === 'string' && item.id.trim().length > 0 ? item.id : fallbackId,
    mode: item?.mode === 'custom' ? 'custom' : 'library',
    name: typeof item?.name === 'string' ? item.name : '',
    iconKey: typeof item?.iconKey === 'string' && item.iconKey.trim().length > 0 ? item.iconKey : 'shield',
    iconColor: typeof item?.iconColor === 'string' && item.iconColor.trim().length > 0
      ? item.iconColor
      : createProjectPaletteReference('primary'),
    iconFillColor: typeof item?.iconFillColor === 'string' && item.iconFillColor.trim().length > 0
      ? item.iconFillColor
      : 'rgba(0,0,0,0)',
    iconStrokeWidth: typeof item?.iconStrokeWidth === 'number' && Number.isFinite(item.iconStrokeWidth)
      ? Math.max(0.5, item.iconStrokeWidth)
      : 1,
    backgroundColor: typeof item?.backgroundColor === 'string' && item.backgroundColor.trim().length > 0
      ? item.backgroundColor
      : 'rgba(255,255,255,0.94)',
    backgroundTextureId: typeof item?.backgroundTextureId === 'string' ? item.backgroundTextureId : 'none',
    backgroundTextureOpacity: typeof item?.backgroundTextureOpacity === 'number' && Number.isFinite(item.backgroundTextureOpacity)
      ? Math.max(0, Math.min(1, item.backgroundTextureOpacity))
      : 0.35,
    borderColor: typeof item?.borderColor === 'string' && item.borderColor.trim().length > 0
      ? item.borderColor
      : createProjectPaletteReference('secondary'),
    borderWidth: typeof item?.borderWidth === 'number' && Number.isFinite(item.borderWidth)
      ? Math.max(0, item.borderWidth)
      : 1,
    borderRadius: typeof item?.borderRadius === 'number' && Number.isFinite(item.borderRadius)
      ? Math.max(0, item.borderRadius)
      : 20,
    customSvgMarkup: typeof item?.customSvgMarkup === 'string' ? item.customSvgMarkup : '',
    inlineCode: typeof item?.inlineCode === 'string' ? item.inlineCode : '',
    description: typeof item?.description === 'string' ? item.description : '',
    tags: Array.isArray(item?.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : [],
  };
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
    art: {
      ...createDefaultProjectArtDirection(),
      ...(project.art ?? {}),
      theme: project.art?.theme ?? project.brief?.theme ?? defaultBrief.theme,
      definedArtStyles: Array.isArray(project.art?.definedArtStyles)
        ? project.art.definedArtStyles.map((item, index) => normalizeArtReference(item, `art_style_${index + 1}`))
        : [],
      recurringAssets: Array.isArray(project.art?.recurringAssets)
        ? project.art.recurringAssets.map((item, index) => normalizeArtReference(item, `art_asset_${index + 1}`))
        : [],
      icons: Array.isArray(project.art?.icons)
        ? project.art.icons.map((item, index) => normalizeIconAsset(item, `art_icon_${index + 1}`))
        : [],
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
