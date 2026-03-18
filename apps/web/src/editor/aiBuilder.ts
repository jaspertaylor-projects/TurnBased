import {
  builtInCatalog,
  getBuiltInComponentManifest,
} from '@turnbased/engine-components';
import type {
  BuiltInComponentType,
  ComponentInstanceModel,
  ComponentLayout,
} from '@turnbased/engine-components';

import {
  addProjectComponent,
  createBlankProject,
  createDefaultProjectViews,
  createDefaultSeats,
  syncProjectViews,
} from './project';
import { buildPreviewRuntime } from './runtime';
import type { EditorProject, RulesBuilderBrief } from './types';

export interface RulesBriefSuggestion {
  title: string;
  body: string;
}

export interface AIBuildPromptPack {
  brief: RulesBuilderBrief;
  engineGrounding: string[];
  componentCatalog: Array<{
    type: string;
    displayName: string;
    description: string;
    allowedParents: string[];
    allowedChildren: string[];
    keyProperties: string[];
    tags: string[];
  }>;
  acceptanceChecklist: string[];
  previewRuntimeContract: string[];
  workspacePolicy: string[];
}

export interface AIGameBlueprint {
  projectName?: string;
  description?: string;
  rulesText?: string;
  phases?: string[];
  targetScore?: number;
  maxTurns?: number;
  designerNotes?: string[];
  playerRange?: {
    min?: number;
    max?: number;
    hasDistinctSoloMode?: boolean;
    isCampaignGame?: boolean;
  };
  playerIdentities?: Array<{
    seatId?: string;
    badgeLabel?: string;
    iconKey?: string;
    color?: string;
    resourceLabel?: string;
    startingBlocks?: number;
  }>;
  views?: {
    defaultViewId?: string;
    selectedViewId?: string;
    sharedView?: {
      label?: string;
      description?: string;
    };
    playerViews?: Array<{
      seatId?: string;
      label?: string;
      description?: string;
    }>;
  };
  appLayout?: Partial<EditorProject['appLayout']>;
  board?: {
    label?: string;
    layout?: ComponentLayout;
    width?: number;
    height?: number;
    spaceCount?: number;
    spaceLabels?: string[];
    terrainPattern?: string[];
  };
  playerAreas?: Array<{
    ownerId?: string;
    reserveLabel?: string;
    startingPieces?: number;
    pieceLabelPrefix?: string;
    pieceType?: 'piece' | 'token';
  }>;
  sharedZones?: Array<{
    label?: string;
    ownerId?: string | null;
    maxCapacity?: number | null;
    pieceCount?: number;
    pieceLabelPrefix?: string;
    pieceType?: 'piece' | 'token';
  }>;
}

const SIMPLE_EXAMPLE_BRIEF: RulesBuilderBrief = {
  name: 'Lantern Blocks',
  minPlayers: 2,
  maxPlayers: 4,
  hasDistinctSoloMode: true,
  isCampaignGame: false,
  theme: 'harbor lantern guilds',
  artStyle: 'cozy painted woodcut',
};

const ENGINE_GROUNDING = [
  'Use built-in components and declarative rules whenever possible.',
  'Every generated starter project should open in a linked multi-view shell with one shared board view and one player-linked view per seat.',
  'A previewable project needs at least one public destination surface and at least one owned movable block resource per player.',
  'Generated projects should preserve the lightweight setup brief and stay easy to refine in the visual editor.',
  'Prefer a minimal playable interpretation when the setup brief is underspecified.',
];

const ACCEPTANCE_CHECKLIST = [
  'Project manifest and setup brief are preserved in project metadata.',
  'Requested player count range and solo/campaign flags are preserved.',
  'One shared board view exists and one linked player view exists per seat.',
  'Player summaries show seat identity, Lucide-first avatar fallback, and compact resource counts.',
  'Each player starts with 6 block resources unless the blueprint explicitly asks for a higher valid amount.',
  'Preview runtime compiles without blocking requirements.',
  'The active player has at least one legal move in the initial preview state.',
  'App layout fields exist for summary strip, linked view navigation, and resource presentation.',
];

const PREVIEW_RUNTIME_CONTRACT = [
  'The shared shell keeps the player summary strip visible while the main content swaps between the board and player-linked views.',
  'Public spaces or zones become destination surfaces in preview.',
  'Owned block resources placed in a player area can move into open public destinations.',
  'Target score and turn cap should match the board size and pace.',
];

const WORKSPACE_POLICY = [
  'Generate only project-workspace artifacts, never shared engine changes.',
  'Stay inside documented component and rules boundaries.',
  'Prefer a shared board plus player-owned personal areas for the first playable build.',
];

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function normalizeStringList(values: string[] | undefined, fallback: string[]): string[] {
  const normalized = (values ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((value) => value.replace(/[^a-z0-9]+/g, '-'));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : fallback;
}

function singularize(label: string): string {
  return label.endsWith('s') ? label.slice(0, -1) : label;
}

function inferProjectName(brief: RulesBuilderBrief): string {
  const preferred = brief.name.trim() || brief.theme.trim();
  return preferred.length > 0 ? toTitleCase(preferred) : 'AI Prototype';
}

function inferPlayerCount(brief: RulesBuilderBrief): number {
  return clamp(Math.max(brief.minPlayers, brief.maxPlayers), 1, 6);
}

function inferBoardSpaceCount(brief: RulesBuilderBrief): number {
  return clamp(Math.max(9, inferPlayerCount(brief) * 3), 9, 24);
}

function inferPhases(brief: RulesBuilderBrief): string[] {
  if (brief.isCampaignGame) {
    return ['setup', 'main', 'campaign', 'end'];
  }

  return ['setup', 'main', 'end'];
}

function inferRulesText(brief: RulesBuilderBrief, projectName: string): string {
  const playerRange = brief.minPlayers === brief.maxPlayers
    ? `${brief.maxPlayers} player${brief.maxPlayers === 1 ? '' : 's'}`
    : `${brief.minPlayers}-${brief.maxPlayers} players`;
  const soloNote = brief.hasDistinctSoloMode
    ? ' A distinct solo mode should reinterpret the shared shell for a single seat when needed.'
    : '';
  const campaignNote = brief.isCampaignGame
    ? ' The campaign flag means progress and naming should feel episodic even in the starter scaffold.'
    : '';

  return `${projectName} is a linked multi-view tabletop prototype for ${playerRange}. Each seat starts with 6 block resources in a personal area, the shared board opens by default, and clicking a player summary should focus that player view while keeping the shared shell intact.${soloNote}${campaignNote}`;
}

function buildDesignerNotes(brief: RulesBuilderBrief, extraNotes: string[] = []): string {
  return [
    `Setup name: ${brief.name || 'Untitled setup'}`,
    `Player range: ${brief.minPlayers}-${brief.maxPlayers}`,
    `Distinct solo mode: ${brief.hasDistinctSoloMode ? 'yes' : 'no'}`,
    `Campaign game: ${brief.isCampaignGame ? 'yes' : 'no'}`,
    `Theme: ${brief.theme || 'Untitled theme'}`,
    `Art style: ${brief.artStyle || 'Lucide-first default'}`,
    ...extraNotes,
  ].join('\n');
}

function buildComponentCatalogSummary(): AIBuildPromptPack['componentCatalog'] {
  return Object.values(builtInCatalog.manifests).map((manifest) => ({
    type: manifest.type,
    displayName: manifest.displayName,
    description: manifest.description,
    allowedParents: manifest.placementConstraints.allowedParentTypes,
    allowedChildren: manifest.placementConstraints.allowedChildTypes,
    keyProperties: Object.keys(manifest.propertyDefinitions),
    tags: manifest.tags,
  }));
}

function updateInstance(
  project: EditorProject,
  instanceId: string,
  updater: (instance: ComponentInstanceModel) => ComponentInstanceModel,
): EditorProject {
  const current = project.instances[instanceId];
  if (!current) {
    return project;
  }

  return {
    ...project,
    instances: {
      ...project.instances,
      [instanceId]: updater(current),
    },
  };
}

function createProjectShell(
  brief: RulesBuilderBrief,
  overrides: {
    projectName?: string;
    description?: string;
    phases?: string[];
    rulesText?: string;
    targetScore?: number;
    maxTurns?: number;
    designerNotes?: string[];
    appLayout?: Partial<EditorProject['appLayout']>;
  } = {},
): EditorProject {
  const projectName = normalizeText(overrides.projectName, inferProjectName(brief));
  const baseProject = createBlankProject(projectName);
  const seatCount = inferPlayerCount(brief);
  const seats = createDefaultSeats(seatCount).map((seat) => ({
    ...seat,
    name: seatCount === 1 ? 'Solo Player' : seat.name,
    resources: {
      ...seat.resources,
      startingBlocks: 6,
      resourceLabel: 'Blocks',
    },
  }));
  const phases = normalizeStringList(overrides.phases, inferPhases(brief));
  const views = createDefaultProjectViews(seats, projectName);

  return {
    ...baseProject,
    name: projectName,
    description: normalizeText(
      overrides.description,
      `${brief.theme.trim() || projectName} is a linked multi-view starter game scaffold with a shared board, player summary strip, and per-seat views.`,
    ),
    phase: 'ready',
    brief: {
      ...brief,
      name: brief.name.trim() || projectName,
    },
    seats,
    views,
    rules: {
      ...baseProject.rules,
      phases,
      targetScore: clamp(
        Number.isFinite(overrides.targetScore) ? Math.trunc(overrides.targetScore ?? 0) : Math.max(3, Math.ceil(seats.length * 1.5)),
        2,
        20,
      ),
      maxTurns: clamp(
        Number.isFinite(overrides.maxTurns) ? Math.trunc(overrides.maxTurns ?? 0) : 12 + seats.length,
        4,
        60,
      ),
      rulesText: normalizeText(overrides.rulesText, inferRulesText(brief, projectName)),
      designerNotes: buildDesignerNotes(brief, overrides.designerNotes),
    },
    appLayout: {
      ...baseProject.appLayout,
      shellTitle: projectName,
      introText: `A ${brief.artStyle || 'Lucide-first'} shared shell for ${brief.theme || projectName}, with clickable player summaries that swap the main area into linked player views.`,
      hudItems: ['Turn tracker', 'Blocks', 'Active player'],
      sidePanels: ['Rules', 'Players', 'Board context'],
      primaryActionLabel: 'Place block',
      summaryStripLabel: 'Players',
      linkedViewLabel: 'Linked Views',
      resourceSummaryLabel: 'Blocks',
      navigationMode: 'summary_strip',
      avatarStyle: 'lucide',
      ...(overrides.appLayout ?? {}),
    },
  };
}

function applyPlayerIdentityPlan(project: EditorProject, plan: AIGameBlueprint['playerIdentities']): EditorProject {
  if (!plan || plan.length === 0) {
    return project;
  }

  const seats = project.seats.map((seat, index) => {
    const match = plan.find((entry) => entry.seatId === seat.id) ?? plan[index];
    if (!match) {
      return seat;
    }

    return {
      ...seat,
      color: normalizeText(match.color, seat.color),
      identity: {
        ...seat.identity,
        badgeLabel: normalizeText(match.badgeLabel, seat.identity.badgeLabel),
        iconKey: normalizeText(match.iconKey, seat.identity.iconKey),
      },
      resources: {
        ...seat.resources,
        resourceLabel: normalizeText(match.resourceLabel, seat.resources.resourceLabel),
        startingBlocks: clamp(
          Number.isFinite(match.startingBlocks) ? Math.trunc(match.startingBlocks ?? 0) : seat.resources.startingBlocks,
          1,
          12,
        ),
      },
    };
  });

  return {
    ...project,
    seats,
    views: syncProjectViews(project.views, seats, project.name),
  };
}

function applyViewPlan(project: EditorProject, plan: AIGameBlueprint['views']): EditorProject {
  const nextViews = syncProjectViews(project.views, project.seats, project.name);
  const items = nextViews.items.map((view) => {
    if (view.kind === 'shared') {
      return {
        ...view,
        label: normalizeText(plan?.sharedView?.label, view.label),
        description: normalizeText(plan?.sharedView?.description, view.description),
      };
    }

    const match = plan?.playerViews?.find((entry) => entry.seatId === view.linkedSeatId);
    return {
      ...view,
      label: normalizeText(match?.label, view.label),
      description: normalizeText(match?.description, view.description),
    };
  });
  const validIds = new Set(items.map((item) => item.id));
  const defaultViewId = plan?.defaultViewId && validIds.has(plan.defaultViewId)
    ? plan.defaultViewId
    : nextViews.defaultViewId;
  const selectedViewId = plan?.selectedViewId && validIds.has(plan.selectedViewId)
    ? plan.selectedViewId
    : plan?.defaultViewId && validIds.has(plan.defaultViewId)
      ? plan.defaultViewId
      : nextViews.selectedViewId;

  return {
    ...project,
    views: {
      defaultViewId,
      selectedViewId,
      items,
    },
  };
}

function addBoardFromPlan(
  project: EditorProject,
  brief: RulesBuilderBrief,
  plan: AIGameBlueprint['board'],
): EditorProject {
  const boardResult = addProjectComponent(project, 'board', null, null);
  let nextProject = boardResult.project;
  const boardId = boardResult.instanceId ?? null;
  if (!boardId) {
    return nextProject;
  }

  const spaceCount = clamp(
    Number.isFinite(plan?.spaceCount) ? Math.trunc(plan?.spaceCount ?? 0) : inferBoardSpaceCount(brief),
    6,
    25,
  );
  const width = clamp(
    Number.isFinite(plan?.width) ? Math.trunc(plan?.width ?? 0) : Math.ceil(Math.sqrt(spaceCount)),
    2,
    8,
  );
  const height = clamp(
    Number.isFinite(plan?.height) ? Math.trunc(plan?.height ?? 0) : Math.ceil(spaceCount / width),
    2,
    8,
  );
  const boardLabel = normalizeText(plan?.label, `${nextProject.name} Board`);
  const layout = plan?.layout && ['grid', 'hex', 'graph', 'custom'].includes(plan.layout) ? plan.layout : 'grid';
  const terrainPattern = (plan?.terrainPattern ?? []).map((value) => value.trim()).filter(Boolean);
  const spaceLabels = (plan?.spaceLabels ?? []).map((value) => value.trim()).filter(Boolean);

  nextProject = updateInstance(nextProject, boardId, (instance) => ({
    ...instance,
    displayName: boardLabel,
    properties: {
      ...instance.properties,
      label: boardLabel,
      layout,
      width,
      height,
    },
  }));

  for (let index = 0; index < spaceCount; index += 1) {
    const spaceResult = addProjectComponent(nextProject, 'space', boardId, null);
    nextProject = spaceResult.project;
    if (!spaceResult.instanceId) {
      continue;
    }

    const x = index % width;
    const y = Math.floor(index / width);
    const label = spaceLabels[index] ?? `${boardLabel} ${index + 1}`;
    const terrain = terrainPattern[index % Math.max(terrainPattern.length, 1)] ?? 'plain';
    nextProject = updateInstance(nextProject, spaceResult.instanceId, (instance) => ({
      ...instance,
      displayName: label,
      properties: {
        ...instance.properties,
        x,
        y,
        label,
        terrain,
      },
    }));
  }

  return nextProject;
}

function addZoneWithPieces(
  project: EditorProject,
  config: {
    label: string;
    ownerId: string | null;
    maxCapacity: number | null;
    pieceCount: number;
    pieceType: 'piece' | 'token';
    pieceLabelPrefix: string;
  },
): EditorProject {
  const zoneResult = addProjectComponent(project, 'zone', null, config.ownerId);
  let nextProject = zoneResult.project;
  const zoneId = zoneResult.instanceId ?? null;
  if (!zoneId) {
    return nextProject;
  }

  nextProject = updateInstance(nextProject, zoneId, (instance) => ({
    ...instance,
    displayName: config.label,
    properties: {
      ...instance.properties,
      label: config.label,
      maxCapacity: config.maxCapacity,
    },
  }));

  for (let index = 0; index < config.pieceCount; index += 1) {
    const pieceResult = addProjectComponent(nextProject, config.pieceType, zoneId, config.ownerId);
    nextProject = pieceResult.project;
    if (!pieceResult.instanceId) {
      continue;
    }

    const pieceLabel = `${config.pieceLabelPrefix} ${index + 1}`;
    nextProject = updateInstance(nextProject, pieceResult.instanceId, (instance) => ({
      ...instance,
      displayName: pieceLabel,
      properties: {
        ...instance.properties,
        label: pieceLabel,
      },
    }));
  }

  return nextProject;
}

function countDestinationSurfaces(project: EditorProject): number {
  return Object.values(project.instances).filter((instance) => (
    instance.componentType === 'space' || instance.componentType === 'zone'
  )).length;
}

function countOwnedMovers(project: EditorProject, ownerId: string): number {
  return Object.values(project.instances).filter((instance) => (
    (instance.componentType === 'piece' || instance.componentType === 'token')
    && instance.bindings.ownerId === ownerId
  )).length;
}

function ensureMinimumPreviewableStructure(project: EditorProject, brief: RulesBuilderBrief): EditorProject {
  let nextProject = project;

  if (countDestinationSurfaces(nextProject) === 0) {
    nextProject = addBoardFromPlan(nextProject, brief, undefined);
  }

  for (const seat of nextProject.seats) {
    if (countOwnedMovers(nextProject, seat.id) > 0) {
      continue;
    }

    nextProject = addZoneWithPieces(nextProject, {
      label: `${seat.name} ${seat.resources.resourceLabel}`,
      ownerId: seat.id,
      maxCapacity: null,
      pieceCount: seat.resources.startingBlocks,
      pieceType: 'piece',
      pieceLabelPrefix: singularize(seat.resources.resourceLabel),
    });
  }

  return nextProject;
}

function repairIfPreviewStillBlocked(project: EditorProject, brief: RulesBuilderBrief): EditorProject {
  const runtime = buildPreviewRuntime(project);
  if (runtime.requirements.length === 0) {
    return project;
  }

  let rebuilt = createProjectShell(brief, {
    projectName: project.name,
    description: project.description,
    phases: project.rules.phases,
    rulesText: project.rules.rulesText,
    targetScore: project.rules.targetScore,
    maxTurns: project.rules.maxTurns,
    designerNotes: project.rules.designerNotes.split('\n').filter(Boolean),
    appLayout: project.appLayout,
  });
  rebuilt = {
    ...rebuilt,
    seats: project.seats,
    views: syncProjectViews(project.views, project.seats, project.name),
  };

  return ensureMinimumPreviewableStructure(rebuilt, brief);
}

export function createSimpleRulesBrief(): RulesBuilderBrief {
  return {
    ...SIMPLE_EXAMPLE_BRIEF,
  };
}

export function getRulesBriefSuggestions(brief: RulesBuilderBrief): RulesBriefSuggestion {
  const hints: string[] = [];

  if (!brief.name.trim()) {
    hints.push('Give the project a name so the shared shell, board, and player views have a strong default label.');
  }

  if (!brief.theme.trim()) {
    hints.push('Add a theme so AI can align naming, player identity, and board presentation.');
  }

  if (!brief.artStyle.trim()) {
    hints.push('Choose an art style so the shell copy and Lucide-first chrome know what visual mood to follow.');
  }

  if (brief.minPlayers > brief.maxPlayers) {
    hints.push('Keep the minimum player count less than or equal to the maximum.');
  }

  if (brief.hasDistinctSoloMode && brief.minPlayers > 1) {
    hints.push('If solo mode is distinct, let the player range include 1 so the project metadata stays consistent.');
  }

  if (hints.length === 0) {
    return {
      title: 'Setup looks strong',
      body: `This setup is ready for a linked multi-view scaffold. Theme: ${brief.theme}. Art style: ${brief.artStyle}.`,
    };
  }

  return {
    title: 'Setup suggestions',
    body: hints.join(' '),
  };
}

export function createAIBuildPromptPack(brief: RulesBuilderBrief): AIBuildPromptPack {
  return {
    brief,
    engineGrounding: ENGINE_GROUNDING,
    componentCatalog: buildComponentCatalogSummary(),
    acceptanceChecklist: ACCEPTANCE_CHECKLIST,
    previewRuntimeContract: PREVIEW_RUNTIME_CONTRACT,
    workspacePolicy: WORKSPACE_POLICY,
  };
}

export function buildProjectScaffoldFromBrief(brief: RulesBuilderBrief): EditorProject {
  return repairIfPreviewStillBlocked(
    ensureMinimumPreviewableStructure(createProjectShell(brief), brief),
    brief,
  );
}

export function buildProjectFromAIBlueprint(brief: RulesBuilderBrief, blueprint: AIGameBlueprint): EditorProject {
  let project = createProjectShell(brief, {
    projectName: blueprint.projectName,
    description: blueprint.description,
    phases: blueprint.phases,
    rulesText: blueprint.rulesText,
    targetScore: blueprint.targetScore,
    maxTurns: blueprint.maxTurns,
    designerNotes: blueprint.designerNotes,
    appLayout: blueprint.appLayout,
  });

  project = applyPlayerIdentityPlan(project, blueprint.playerIdentities);
  project = applyViewPlan(project, blueprint.views);
  project = addBoardFromPlan(project, brief, blueprint.board);

  for (const sharedZone of blueprint.sharedZones ?? []) {
    project = addZoneWithPieces(project, {
      label: normalizeText(sharedZone.label, `${project.name} Shared Zone`),
      ownerId: sharedZone.ownerId && project.seats.some((seat) => seat.id === sharedZone.ownerId) ? sharedZone.ownerId : null,
      maxCapacity: typeof sharedZone.maxCapacity === 'number' ? Math.max(1, Math.trunc(sharedZone.maxCapacity)) : null,
      pieceCount: clamp(Number.isFinite(sharedZone.pieceCount) ? Math.trunc(sharedZone.pieceCount ?? 0) : 0, 0, 12),
      pieceType: sharedZone.pieceType === 'token' ? 'token' : 'piece',
      pieceLabelPrefix: normalizeText(sharedZone.pieceLabelPrefix, 'Shared Piece'),
    });
  }

  for (const seat of project.seats) {
    const matchingArea = (blueprint.playerAreas ?? []).find((area) => area.ownerId === seat.id);
    project = addZoneWithPieces(project, {
      label: normalizeText(matchingArea?.reserveLabel, `${seat.name} ${seat.resources.resourceLabel}`),
      ownerId: seat.id,
      maxCapacity: null,
      pieceCount: clamp(
        Number.isFinite(matchingArea?.startingPieces) ? Math.trunc(matchingArea?.startingPieces ?? 0) : seat.resources.startingBlocks,
        1,
        12,
      ),
      pieceType: matchingArea?.pieceType === 'token' ? 'token' : 'piece',
      pieceLabelPrefix: normalizeText(
        matchingArea?.pieceLabelPrefix,
        singularize(seat.resources.resourceLabel),
      ),
    });
  }

  project = ensureMinimumPreviewableStructure(project, brief);
  return repairIfPreviewStillBlocked(project, brief);
}

export function buildProjectWithAI(brief: RulesBuilderBrief): EditorProject {
  return buildProjectScaffoldFromBrief(brief);
}

export function getSuggestedComponentTypes(brief: RulesBuilderBrief): BuiltInComponentType[] {
  const suggestions: BuiltInComponentType[] = ['board', 'space', 'zone', 'piece'];

  if (brief.isCampaignGame) {
    suggestions.push('counter');
  }

  if (brief.maxPlayers > 4) {
    suggestions.push('token');
  }

  return Array.from(new Set(suggestions)).filter((type) => Boolean(getBuiltInComponentManifest(type)));
}
