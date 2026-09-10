import { touchProject } from './projectUpdates';
export { touchProject } from './projectUpdates';
export {
  addProjectComponent,
  updateComponentInstance,
  syncGeneratedBoardChildren,
  syncAllGeneratedBoardChildren,
  duplicateComponentSubtree,
  removeComponentInstance,
  listValidParents,
} from './projectComponents';
import { generateId } from '@turnbased/shared-utils';

import { createDefaultProjectManifest } from './manifest';
import { createDefaultProjectColorPalette } from './projectPalette';
import { getUserSettings } from '../userSettings';
import type {
  CustomRulebookComponent,
  EditorAppLayout,
  EditorArtDirection,
  EditorProject,
  EditorProjectView,
  EditorProjectViews,
  EditorRuleConfig,
  EditorSeat,
  EditorSettings,
  RulesBuilderBrief,
  RulesChapter,
} from './types';

function now(): string {
  return new Date().toISOString();
}

const DEFAULT_SEAT_COLORS = ['#f97316', '#0ea5e9', '#8b5cf6', '#10b981', '#ec4899', '#f59e0b'];

const DEFAULT_SEAT_ICONS = ['crown', 'shield', 'sparkles', 'leaf', 'flame', 'gem'];

export function createDefaultProjectSettings(): EditorSettings {
  return {
    timeControlMode: 'none',
    timeControlSeconds: 300,
    colorPalette: createDefaultProjectColorPalette(),
    aiModels: getUserSettings().defaultAIModels,
  };
}

export function createDefaultProjectArtDirection(): EditorArtDirection {
  return {
    theme: '',
    definedArtStyles: [],
    recurringAssets: [],
    icons: [],
    images: [],
  };
}

export function getDefaultSeatIconKey(index: number): string {
  return DEFAULT_SEAT_ICONS[index % DEFAULT_SEAT_ICONS.length];
}

export function createDefaultSeats(playerCount = 2): EditorSeat[] {
  return Array.from({ length: Math.max(1, playerCount) }, (_, index) => ({
    id: `player_${index + 1}`,
    name: `Player ${index + 1}`,
    color: DEFAULT_SEAT_COLORS[index % DEFAULT_SEAT_COLORS.length],
    identity: {
      badgeLabel: String(index + 1),
      iconKey: getDefaultSeatIconKey(index),
      customAvatarUrl: null,
    },
    resources: {
      startingBlocks: 6,
      resourceLabel: 'Blocks',
    },
  }));
}

export function createDefaultRulesBrief(): RulesBuilderBrief {
  return {
    name: '',
    minPlayers: 2,
    maxPlayers: 4,
    hasDistinctSoloMode: false,
    isCampaignGame: false,
    theme: '',
    artStyle: '',
    minAge: 10,
    playtimeMinMinutes: 30,
    playtimeMaxMinutes: 60,
  };
}

/* The brief stores `theme` and `artStyle` as a single comma-joined string so
   downstream consumers (AI grounding, runtime, project description) get a
   stable scalar. UI surfaces that want to render them as chip lists go
   through splitBriefList; appendBriefList adds a new value to the joined
   string, dedupes case-insensitively, and trims. */
export function splitBriefList(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of value.split(',')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function appendBriefList(value: string, entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) return value;
  // Filter out the literal "none" placeholder that normalizeRulesBuilderBrief
  // injects when the brief field was left empty at project creation — once
  // a real entry is being added, the placeholder should evaporate.
  const existing = splitBriefList(value).filter((item) => item.toLowerCase() !== 'none');
  if (existing.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
    return existing.join(', ');
  }
  return [...existing, trimmed].join(', ');
}

export function normalizeRulesBuilderBrief(brief: RulesBuilderBrief): RulesBuilderBrief {
  const normalizedMin = Math.max(1, Math.min(6, Math.trunc(brief.minPlayers || 1)));
  const normalizedMax = Math.max(normalizedMin, Math.min(6, Math.trunc(brief.maxPlayers || normalizedMin)));
  const normalizedAge = Math.max(0, Math.min(99, Math.trunc(brief.minAge || 0)));
  const rawPtMin = Math.max(1, Math.min(999, Math.trunc(brief.playtimeMinMinutes || 1)));
  const rawPtMax = Math.max(1, Math.min(999, Math.trunc(brief.playtimeMaxMinutes || rawPtMin)));
  const normalizedPtMin = Math.min(rawPtMin, rawPtMax);
  const normalizedPtMax = Math.max(rawPtMin, rawPtMax);

  return {
    ...brief,
    name: brief.name.trim(),
    minPlayers: normalizedMin,
    maxPlayers: normalizedMax,
    theme: brief.theme.trim() || 'none',
    artStyle: brief.artStyle.trim() || 'none',
    minAge: normalizedAge,
    playtimeMinMinutes: normalizedPtMin,
    playtimeMaxMinutes: normalizedPtMax,
  };
}

export function createDefaultAppLayout(name = 'New Prototype'): EditorAppLayout {
  return {
    shellTitle: name,
    introText:
      'A linked multi-view match opens with the shared board and lets you jump into each player resources area from the summary strip.',
    hudItems: ['Turn tracker', 'Blocks', 'Active player'],
    sidePanels: ['Rules', 'Players', 'Board context'],
    primaryActionLabel: 'Take turn',
    summaryStripLabel: 'Players',
    linkedViewLabel: 'Linked Views',
    resourceSummaryLabel: 'Blocks',
    navigationMode: 'summary_strip',
    avatarStyle: 'lucide',
  };
}

export function createDefaultProjectViews(
  seats: EditorSeat[],
  projectName = 'New Prototype',
): EditorProjectViews {
  const sharedViewId = 'view_shared_board';
  const items: EditorProjectView[] = [
    {
      id: sharedViewId,
      kind: 'shared',
      label: 'Main Board',
      linkedSeatId: null,
      parentViewId: null,
      description: `${projectName} starts in the shared board view with the player summary strip visible above it.`,
    },
    ...seats.map((seat) => ({
      id: `view_${seat.id}`,
      kind: 'player' as const,
      label: `${seat.name} View`,
      linkedSeatId: seat.id,
      parentViewId: sharedViewId,
      description: `${seat.name}'s resources view stays linked to the shared board shell.`,
    })),
  ];

  return {
    defaultViewId: sharedViewId,
    selectedViewId: sharedViewId,
    items,
  };
}

export function syncProjectViews(
  existing: EditorProjectViews | undefined,
  seats: EditorSeat[],
  projectName: string,
): EditorProjectViews {
  const defaults = createDefaultProjectViews(seats, projectName);
  const existingItems = existing?.items ?? [];
  const nextItems = defaults.items.map((defaultView) => {
    const match =
      defaultView.kind === 'shared'
        ? existingItems.find((item) => item.kind === 'shared')
        : existingItems.find((item) => item.linkedSeatId === defaultView.linkedSeatId);

    return match
      ? {
          ...defaultView,
          label: match.label || defaultView.label,
          description: match.description || defaultView.description,
        }
      : defaultView;
  });
  const validIds = new Set(nextItems.map((item) => item.id));
  const defaultViewId =
    existing?.defaultViewId && validIds.has(existing.defaultViewId)
      ? existing.defaultViewId
      : defaults.defaultViewId;
  const selectedViewId =
    existing?.selectedViewId && validIds.has(existing.selectedViewId)
      ? existing.selectedViewId
      : defaultViewId;

  return {
    defaultViewId,
    selectedViewId,
    items: nextItems,
  };
}

export function createBlankProject(name = 'Untitled Prototype'): EditorProject {
  const timestamp = now();
  const brief = createDefaultRulesBrief();
  const seats = createDefaultSeats(2);

  return {
    id: generateId('project'),
    name,
    description: 'An AI-generated linked multi-view prototype workspace.',
    createdAt: timestamp,
    updatedAt: timestamp,
    phase: 'ready',
    manifest: createDefaultProjectManifest(),
    brief,
    seats,
    views: createDefaultProjectViews(seats, name),
    rootInstanceIds: [],
    instances: {},
    rules: {
      rulesText: '',
      designerNotes: '',
      chapters: createDefaultRulesChapters(),
      customComponents: [],
    },
    settings: createDefaultProjectSettings(),
    art: createDefaultProjectArtDirection(),
    appLayout: createDefaultAppLayout(name),
  };
}

export function renameProject(project: EditorProject, name: string): EditorProject {
  return touchProject({
    ...project,
    name,
    brief: { ...project.brief, name },
  });
}

export function updateProjectDescription(project: EditorProject, description: string): EditorProject {
  return touchProject({
    ...project,
    description,
  });
}

export function updateProjectRules(
  project: EditorProject,
  updater: (rules: EditorProject['rules']) => EditorProject['rules'],
): EditorProject {
  return touchProject({
    ...project,
    rules: updater(project.rules),
  });
}

// ── Rulebook chapters ───────────────────────────────────────────────────

const DEFAULT_CHAPTER_TITLES = [
  'Concept',
  'Components',
  'Setup',
  'Game Structure',
  'Taking a Turn',
  'End Game',
  'Iconography',
];

export function createDefaultRulesChapters(): RulesChapter[] {
  return DEFAULT_CHAPTER_TITLES.map((title) => ({
    id: generateId('chapter'),
    title,
    body: '',
    kind:
      title === 'Components'
        ? ('components' as const)
        : title === 'Iconography'
          ? ('iconography' as const)
          : ('standard' as const),
  }));
}

export function createBlankChapter(title = 'New Chapter'): RulesChapter {
  return { id: generateId('chapter'), title, body: '', kind: 'standard' };
}

// ── Custom rulebook components ──────────────────────────────────────────

export function addCustomRulebookComponent(
  rules: EditorRuleConfig,
  component: CustomRulebookComponent,
): EditorRuleConfig {
  return { ...rules, customComponents: [...rules.customComponents, component] };
}

export function updateCustomRulebookComponent(
  rules: EditorRuleConfig,
  componentId: string,
  patch: Partial<Omit<CustomRulebookComponent, 'id'>>,
): EditorRuleConfig {
  return {
    ...rules,
    customComponents: rules.customComponents.map((entry) =>
      entry.id === componentId ? { ...entry, ...patch } : entry,
    ),
  };
}

export function removeCustomRulebookComponent(
  rules: EditorRuleConfig,
  componentId: string,
): EditorRuleConfig {
  return {
    ...rules,
    customComponents: rules.customComponents.filter((entry) => entry.id !== componentId),
  };
}

export function updateChapter(
  rules: EditorRuleConfig,
  chapterId: string,
  patch: Partial<Omit<RulesChapter, 'id'>>,
): EditorRuleConfig {
  return {
    ...rules,
    chapters: rules.chapters.map((chapter) =>
      chapter.id === chapterId ? { ...chapter, ...patch } : chapter,
    ),
  };
}

export function addChapter(
  rules: EditorRuleConfig,
  chapter: RulesChapter = createBlankChapter(),
): EditorRuleConfig {
  return { ...rules, chapters: [...rules.chapters, chapter] };
}

export function removeChapter(rules: EditorRuleConfig, chapterId: string): EditorRuleConfig {
  return { ...rules, chapters: rules.chapters.filter((chapter) => chapter.id !== chapterId) };
}

export function moveChapter(rules: EditorRuleConfig, chapterId: string, direction: -1 | 1): EditorRuleConfig {
  const index = rules.chapters.findIndex((chapter) => chapter.id === chapterId);
  if (index === -1) return rules;
  const target = index + direction;
  if (target < 0 || target >= rules.chapters.length) return rules;
  const next = [...rules.chapters];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return { ...rules, chapters: next };
}

export function updateProjectSeats(
  project: EditorProject,
  updater: (seats: EditorProject['seats']) => EditorProject['seats'],
): EditorProject {
  const nextSeats = updater(project.seats);
  return touchProject({
    ...project,
    seats: nextSeats,
    views: syncProjectViews(project.views, nextSeats, project.name),
  });
}

export function updateProjectSettings(
  project: EditorProject,
  updater: (settings: EditorProject['settings']) => EditorProject['settings'],
): EditorProject {
  return touchProject({
    ...project,
    settings: updater(project.settings),
  });
}

export function updateProjectArt(
  project: EditorProject,
  updater: (art: EditorProject['art']) => EditorProject['art'],
): EditorProject {
  return touchProject({
    ...project,
    art: updater(project.art),
  });
}

export function updateProjectBrief(
  project: EditorProject,
  updater: (brief: EditorProject['brief']) => EditorProject['brief'],
): EditorProject {
  const nextBrief = updater(project.brief);
  return touchProject({
    ...project,
    brief: nextBrief,
  });
}

export function updateProjectAppLayout(
  project: EditorProject,
  updater: (layout: EditorProject['appLayout']) => EditorProject['appLayout'],
): EditorProject {
  return touchProject({
    ...project,
    appLayout: updater(project.appLayout),
  });
}

export function addProjectSeat(project: EditorProject): EditorProject {
  const nextSeat = createDefaultSeats(project.seats.length + 1)[project.seats.length];
  return updateProjectSeats(project, (seats) => [...seats, nextSeat]);
}

export function removeProjectSeat(project: EditorProject, seatId: string): EditorProject {
  if (project.seats.length <= 1) {
    return project;
  }

  const nextSeats = project.seats.filter((seat) => seat.id !== seatId);
  const nextInstances = Object.fromEntries(
    Object.entries(project.instances).map(([instanceId, instance]) => {
      if (instance.bindings.ownerId !== seatId) {
        return [instanceId, instance];
      }

      return [
        instanceId,
        {
          ...instance,
          bindings: {
            ...instance.bindings,
            ownerId: undefined,
          },
        },
      ];
    }),
  );

  return touchProject({
    ...project,
    seats: nextSeats,
    views: syncProjectViews(project.views, nextSeats, project.name),
    instances: nextInstances,
  });
}
