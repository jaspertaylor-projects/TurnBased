import type { EditorArtReference, EditorIconAsset, EditorProject, RulesChapter, StoredEditorProjects } from './types';
import { ensureProjectManifest } from './manifest';
import { normalizeProjectAIModels } from './aiModelCatalog';
import {
  createBlankChapter,
  createDefaultAppLayout,
  createDefaultProjectArtDirection,
  createDefaultProjectSettings,
  createDefaultProjectViews,
  createDefaultRulesBrief,
  createDefaultRulesChapters,
  createDefaultSeats,
  syncProjectViews,
} from './project';
import { createDefaultProjectColorPalette, createProjectPaletteReference } from './projectPalette';
import { deleteProjectVersionData } from './git';
import { deflateProjectImages, inflateProjectImages } from './persistence/imageBlobs';
import { ensureStorageMigrated } from './persistence/migrate';

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
    iconScale: typeof item?.iconScale === 'number' && Number.isFinite(item.iconScale)
      ? Math.max(0.3, Math.min(1.5, item.iconScale))
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

function normalizeRules(rules: EditorProject['rules'] | undefined): EditorProject['rules'] {
  const safe = rules ?? ({} as Partial<EditorProject['rules']>);
  const legacyChapters = Array.isArray(safe.chapters) ? safe.chapters : [];

  // Migration: if no chapters but legacy rulesText is present, lift it into a
  // single "Rules" chapter so existing projects don't appear empty after the
  // rulebook switch. If both are empty, seed the 7 default chapters.
  let chapters: RulesChapter[] = legacyChapters
    .filter((chapter) => chapter && typeof chapter.id === 'string')
    .map((chapter) => {
      const title = typeof chapter.title === 'string' ? chapter.title : 'Untitled Chapter';
      // Stored projects from before the components-chapter migration won't have
      // a `kind` field — infer it from the title so the catalog picker shows up.
      const storedKind = (chapter as { kind?: unknown }).kind;
      const kind: 'standard' | 'components' = storedKind === 'components'
        ? 'components'
        : storedKind === 'standard'
          ? 'standard'
          : title.trim().toLowerCase() === 'components'
            ? 'components'
            : 'standard';
      return {
        id: chapter.id,
        title,
        body: typeof chapter.body === 'string' ? chapter.body : '',
        kind,
      };
    });

  if (chapters.length === 0) {
    if (typeof safe.rulesText === 'string' && safe.rulesText.trim().length > 0) {
      const seeded = createBlankChapter('Rules');
      chapters = [{ ...seeded, body: safe.rulesText, kind: 'standard' }];
    } else {
      chapters = createDefaultRulesChapters();
    }
  }

  const rawCustom = Array.isArray((safe as { customComponents?: unknown }).customComponents)
    ? (safe as { customComponents: unknown[] }).customComponents
    : [];
  const customComponents = rawCustom
    .filter((entry): entry is { id?: unknown; name?: unknown; description?: unknown } => (
      typeof entry === 'object' && entry !== null
    ))
    .map((entry, index) => ({
      id: typeof entry.id === 'string' && entry.id.trim().length > 0
        ? entry.id
        : `custom_component_${index + 1}`,
      name: typeof entry.name === 'string' ? entry.name : '',
      description: typeof entry.description === 'string' ? entry.description : '',
    }));

  return {
    rulesText: typeof safe.rulesText === 'string' ? safe.rulesText : '',
    designerNotes: typeof safe.designerNotes === 'string' ? safe.designerNotes : '',
    chapters,
    customComponents,
  };
}

function normalizeEditorProject(project: EditorProject): EditorProject {
  const defaultBrief = createDefaultRulesBrief();
  const legacyPlayerCount = clampPlayerCount((project.brief as Partial<Record<'playerCount', number>> | undefined)?.playerCount, project.seats?.length ?? 2);
  const minPlayers = clampPlayerCount(project.brief?.minPlayers, Math.min(2, legacyPlayerCount));
  const maxPlayers = clampPlayerCount(project.brief?.maxPlayers, legacyPlayerCount);
  const clampInt = (value: unknown, lo: number, hi: number, fallback: number): number => {
    const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
    return Math.max(lo, Math.min(hi, numeric));
  };
  const rawPtMin = clampInt(project.brief?.playtimeMinMinutes, 1, 999, defaultBrief.playtimeMinMinutes);
  const rawPtMax = clampInt(project.brief?.playtimeMaxMinutes, 1, 999, defaultBrief.playtimeMaxMinutes);
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
    minAge: clampInt(project.brief?.minAge, 0, 99, defaultBrief.minAge),
    playtimeMinMinutes: Math.min(rawPtMin, rawPtMax),
    playtimeMaxMinutes: Math.max(rawPtMin, rawPtMax),
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
    rules: normalizeRules(project.rules),
    settings: {
      ...createDefaultProjectSettings(),
      ...(project.settings ?? {}),
      colorPalette: {
        ...createDefaultProjectColorPalette(),
        ...(project.settings?.colorPalette ?? {}),
      },
      aiModels: normalizeProjectAIModels(project.settings?.aiModels),
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

/** The raw, at-rest project list (image payloads deflated to blob refs). */
function readRawProjects(): EditorProject[] {
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
    return parsed.projects ?? [];
  } catch {
    return [];
  }
}

function writeRawProjects(projects: EditorProject[]): void {
  getStorage()?.setItem(
    STORAGE_KEY,
    JSON.stringify({ projects } satisfies StoredEditorProjects),
  );
}

export async function loadEditorProjects(): Promise<EditorProject[]> {
  await ensureStorageMigrated();
  return Promise.all(
    readRawProjects().map((project) => inflateProjectImages(normalizeEditorProject(project))),
  );
}

export async function loadEditorProject(projectId: string): Promise<EditorProject | null> {
  await ensureStorageMigrated();
  const raw = readRawProjects().find((project) => project.id === projectId);
  return raw ? inflateProjectImages(normalizeEditorProject(raw)) : null;
}

// Saves are chained so rapid autosaves can't interleave their async
// deflate + write steps and land out of order.
let writeQueue: Promise<unknown> = Promise.resolve();

export function saveEditorProject(project: EditorProject): Promise<void> {
  const task = writeQueue.then(async () => {
    await ensureStorageMigrated();
    // Large data URLs move to IndexedDB; localStorage keeps only small refs.
    const deflated = await deflateProjectImages(project);
    const nextProjects = readRawProjects().filter((entry) => entry.id !== project.id);
    nextProjects.unshift(deflated);
    writeRawProjects(nextProjects);
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

export async function deleteEditorProject(projectId: string): Promise<void> {
  await ensureStorageMigrated();
  writeRawProjects(readRawProjects().filter((project) => project.id !== projectId));
  // Also drop the project's commits, workspace, and any orphaned blobs.
  await deleteProjectVersionData(projectId);
}
