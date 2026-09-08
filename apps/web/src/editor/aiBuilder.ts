import { builtInCatalog, getBuiltInComponentManifest } from '@turnbased/engine-components';
import type { BuiltInComponentType, ComponentInstanceModel } from '@turnbased/engine-components';

import {
  addProjectComponent,
  createBlankProject,
  createDefaultProjectViews,
  createDefaultSeats,
  syncProjectViews,
} from './project';
import type { EditorProject, RulesBuilderBrief } from './types';

import {
  SIMPLE_EXAMPLE_BRIEF,
  ENGINE_GROUNDING,
  ACCEPTANCE_CHECKLIST,
  PREVIEW_RUNTIME_CONTRACT,
  WORKSPACE_POLICY,
} from './aiBuilderContracts';
import type { RulesBriefSuggestion, AIBuildPromptPack, AIGameBlueprint } from './aiBuilderContracts';
export type { RulesBriefSuggestion, AIBuildPromptPack, AIGameBlueprint } from './aiBuilderContracts';

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

function inferRulesText(brief: RulesBuilderBrief, projectName: string): string {
  void brief;
  void projectName;
  return '';
}

function buildDesignerNotes(brief: RulesBuilderBrief, extraNotes: string[] = []): string {
  void brief;
  return extraNotes.join('\n');
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
    rulesText?: string;
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

function applyPlayerIdentityPlan(
  project: EditorProject,
  plan: AIGameBlueprint['playerIdentities'],
): EditorProject {
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
          Number.isFinite(match.startingBlocks)
            ? Math.trunc(match.startingBlocks ?? 0)
            : seat.resources.startingBlocks,
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
  const defaultViewId =
    plan?.defaultViewId && validIds.has(plan.defaultViewId) ? plan.defaultViewId : nextViews.defaultViewId;
  const selectedViewId =
    plan?.selectedViewId && validIds.has(plan.selectedViewId)
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
  void brief;
  const boardResult = addProjectComponent(project, 'board', null, null);
  let nextProject = boardResult.project;
  const boardId = boardResult.instanceId ?? null;
  if (!boardId) {
    return nextProject;
  }

  const spaceCount = 1;
  const width = 1;
  const height = 1;
  const boardLabel = normalizeText(plan?.label, `${nextProject.name} Board`);
  const layout =
    plan?.layout && ['grid', 'hex', 'graph', 'custom'].includes(plan.layout) ? plan.layout : 'grid';
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
        maxCapacity: null,
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
    supplyMode?: 'finite' | 'infinite';
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

  if (config.pieceCount <= 0) {
    return nextProject;
  }

  // Pieces/tokens are root-level templates, not children of zones.
  // The engine setup function places them into their starting zones.
  const pieceResult = addProjectComponent(nextProject, config.pieceType, null, config.ownerId);
  nextProject = pieceResult.project;
  if (!pieceResult.instanceId) {
    return nextProject;
  }

  const pieceLabel = config.pieceLabelPrefix;
  nextProject = updateInstance(nextProject, pieceResult.instanceId, (instance) => ({
    ...instance,
    displayName: pieceLabel,
    properties: {
      ...instance.properties,
      label: pieceLabel,
      quantity: config.pieceCount,
      colorMode: config.ownerId ? 'owner' : 'neutral',
      supplyMode: config.supplyMode ?? 'finite',
    },
  }));

  return nextProject;
}

function getDefaultResourcesLabel(seat: EditorProject['seats'][number]): string {
  return `${seat.name} Resources`;
}

export function createSimpleRulesBrief(): RulesBuilderBrief {
  return {
    ...SIMPLE_EXAMPLE_BRIEF,
  };
}

export function getRulesBriefSuggestions(brief: RulesBuilderBrief): RulesBriefSuggestion {
  const hints: string[] = [];

  if (!brief.name.trim()) {
    hints.push(
      'Give the project a name so the shared shell, board, and player views have a strong default label.',
    );
  }

  if (!brief.theme.trim()) {
    hints.push('Add a theme so AI can align naming, player identity, and board presentation.');
  }

  if (!brief.artStyle.trim()) {
    hints.push(
      'Choose an art style so the shell copy and Lucide-first chrome know what visual mood to follow.',
    );
  }

  if (brief.minPlayers > brief.maxPlayers) {
    hints.push('Keep the minimum player count less than or equal to the maximum.');
  }

  if (brief.hasDistinctSoloMode && brief.minPlayers > 1) {
    hints.push(
      'If solo mode is distinct, let the player range include 1 so the project metadata stays consistent.',
    );
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
  return createProjectShell(brief);
}

export function buildProjectFromAIBlueprint(
  brief: RulesBuilderBrief,
  blueprint: AIGameBlueprint,
): EditorProject {
  let project = createProjectShell(brief, {
    projectName: blueprint.projectName,
    description: blueprint.description,
    rulesText: blueprint.rulesText,
    designerNotes: blueprint.designerNotes,
    appLayout: blueprint.appLayout,
  });

  project = applyPlayerIdentityPlan(project, blueprint.playerIdentities);
  project = applyViewPlan(project, blueprint.views);

  // Only seed components the AI blueprint explicitly specifies.
  // New games default to zero components — the creator adds them in the
  // Component Editor after writing the rules.
  if (blueprint.board) {
    project = addBoardFromPlan(project, brief, blueprint.board);
  }

  for (const sharedZone of blueprint.sharedZones ?? []) {
    project = addZoneWithPieces(project, {
      label: normalizeText(sharedZone.label, `${project.name} Shared Zone`),
      ownerId:
        sharedZone.ownerId && project.seats.some((seat) => seat.id === sharedZone.ownerId)
          ? sharedZone.ownerId
          : null,
      maxCapacity:
        typeof sharedZone.maxCapacity === 'number' ? Math.max(1, Math.trunc(sharedZone.maxCapacity)) : null,
      pieceCount: clamp(
        Number.isFinite(sharedZone.pieceCount) ? Math.trunc(sharedZone.pieceCount ?? 0) : 0,
        0,
        12,
      ),
      pieceType: sharedZone.pieceType === 'token' ? 'token' : 'piece',
      pieceLabelPrefix: normalizeText(sharedZone.pieceLabelPrefix, 'Shared Piece'),
      supplyMode: sharedZone.supplyMode === 'infinite' ? 'infinite' : 'finite',
    });
  }

  for (const area of blueprint.playerAreas ?? []) {
    const seat = project.seats.find((entry) => entry.id === area.ownerId);
    if (!seat) continue;
    project = addZoneWithPieces(project, {
      label: normalizeText(area.resourceLabel ?? area.reserveLabel, getDefaultResourcesLabel(seat)),
      ownerId: seat.id,
      maxCapacity: null,
      pieceCount: clamp(
        Number.isFinite(area.startingPieces)
          ? Math.trunc(area.startingPieces ?? 0)
          : seat.resources.startingBlocks,
        1,
        12,
      ),
      pieceType: area.pieceType === 'token' ? 'token' : 'piece',
      pieceLabelPrefix: normalizeText(area.pieceLabelPrefix, singularize(seat.resources.resourceLabel)),
      supplyMode: area.supplyMode === 'infinite' ? 'infinite' : 'finite',
    });
  }

  return project;
}

export function buildProjectWithAI(brief: RulesBuilderBrief): EditorProject {
  return buildProjectScaffoldFromBrief(brief);
}

export function getSuggestedComponentTypes(brief: RulesBuilderBrief): BuiltInComponentType[] {
  const suggestions: BuiltInComponentType[] = ['board', 'space', 'track', 'deck', 'piece', 'card'];

  if (brief.isCampaignGame) {
    suggestions.push('text-box');
  }

  if (brief.maxPlayers > 4) {
    suggestions.push('network');
  }

  return Array.from(new Set(suggestions)).filter((type) => Boolean(getBuiltInComponentManifest(type)));
}
