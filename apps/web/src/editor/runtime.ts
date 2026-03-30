import {
  builtInCatalog,
  getBuiltInComponentManifest,
  validateComponentTree,
} from '@turnbased/engine-components';
import type { BuiltInComponentType } from '@turnbased/engine-components';
import {
  generateLegalMoveTree,
  reduceGameState,
} from '@turnbased/engine-core';
import type {
  CanonicalAction,
  GameState,
  LegalMoveDefinition,
  LegalMoveGenerationContext,
  ZoneId,
  Zone,
} from '@turnbased/engine-core';
import {
  createEntityId,
  createGameId,
  createPlayerId,
  createZoneId,
  ParticipantRole,
  Visibility,
} from '@turnbased/shared-types';

import type { EditorProject, PreviewRuntime } from './types';

const ZONE_TYPES = new Set(['space', 'zone', 'resource-pile', 'track', 'deck', 'hand', 'discard', 'bag', 'score-track']);
const DESTINATION_TYPES = new Set(['space', 'zone']);

export function toPreviewZoneId(instanceId: string): ZoneId {
  return createZoneId(`zone_${instanceId}`);
}

export function toPreviewEntityId(instanceId: string, copyIndex?: number) {
  if (typeof copyIndex === 'number') {
    return createEntityId(`ent_${instanceId}_${copyIndex + 1}`);
  }

  return createEntityId(`ent_${instanceId}`);
}

function getEntityQuantity(instance: EditorProject['instances'][string]): number {
  if (instance.componentType !== 'piece' && instance.componentType !== 'token' && instance.componentType !== 'card') {
    return 0;
  }

  if (instance.componentType === 'card') {
    return 1;
  }

  const quantity = instance.properties.quantity;
  return typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0
    ? Math.max(1, Math.trunc(quantity))
    : 1;
}

function clonePhases(phases: readonly string[]) {
  return phases.map((phase) => ({
    name: phase,
    steps: [
      {
        name: 'action',
        autoAdvance: false,
        requiresPlayerAction: true,
      },
    ],
  }));
}

function isZoneType(componentType: string): boolean {
  return ZONE_TYPES.has(componentType);
}

function isDestinationType(componentType: string): boolean {
  return DESTINATION_TYPES.has(componentType);
}

function getZoneCapacity(componentType: string, properties: Record<string, unknown>): number | null {
  if (componentType === 'space') {
    return typeof properties.maxCapacity === 'number' ? properties.maxCapacity : null;
  }

  if (componentType === 'zone' || componentType === 'resource-pile') {
    return typeof properties.maxCapacity === 'number' ? properties.maxCapacity : null;
  }

  if (componentType === 'deck' || componentType === 'hand') {
    return typeof properties.maxCards === 'number' ? properties.maxCards : null;
  }

  if (componentType === 'bag') {
    return typeof properties.maxItems === 'number' ? properties.maxItems : null;
  }

  return null;
}

function getZoneVisibility(componentType: string): Visibility {
  const manifest = getBuiltInComponentManifest(componentType as BuiltInComponentType);

  if (manifest.visibilityDefaults.contentsVisibility) {
    return manifest.visibilityDefaults.contentsVisibility;
  }

  if (manifest.visibilityDefaults.ownerPrivate) {
    return Visibility.Private;
  }

  return Visibility.Public;
}

function getZoneName(instance: EditorProject['instances'][string]): string {
  const label = instance.properties.label;
  if (typeof label === 'string' && label.trim().length > 0) {
    return label;
  }

  return instance.displayName ?? getBuiltInComponentManifest(instance.componentType as BuiltInComponentType).displayName;
}

function buildZoneIdsByType(project: EditorProject): Record<string, ZoneId[]> {
  return Object.values(project.instances).reduce<Record<string, ZoneId[]>>((groups, instance) => {
    if (!isZoneType(instance.componentType)) {
      return groups;
    }

    const list = groups[instance.componentType] ?? [];
    list.push(toPreviewZoneId(instance.instanceId));
    groups[instance.componentType] = list;
    return groups;
  }, {});
}

function buildZones(project: EditorProject): Record<string, Zone> {
  return Object.values(project.instances).reduce<Record<string, Zone>>((zones, instance) => {
    if (!isZoneType(instance.componentType)) {
      return zones;
    }

    const zoneId = toPreviewZoneId(instance.instanceId);

    zones[zoneId] = {
      id: zoneId,
      type: instance.componentType,
      name: getZoneName(instance),
      ownerId: instance.bindings.ownerId ? createPlayerId(instance.bindings.ownerId) : null,
      entityIds: instance.children
        .filter((childId) => {
          const child = project.instances[childId];
          return child && (child.componentType === 'piece' || child.componentType === 'token' || child.componentType === 'card');
        })
        .flatMap((childId) => {
          const child = project.instances[childId];
          const quantity = child ? getEntityQuantity(child) : 1;

          return Array.from({ length: quantity }, (_unused, copyIndex) => (
            quantity > 1 ? toPreviewEntityId(childId, copyIndex) : toPreviewEntityId(childId)
          ));
        }),
      maxCapacity: getZoneCapacity(instance.componentType, instance.properties),
      visibility: {
        defaultVisibility: getZoneVisibility(instance.componentType),
        overrides: {},
      },
      properties: {
        ...instance.properties,
        instanceId: instance.instanceId,
      },
    };
    return zones;
  }, {});
}

function buildEntities(project: EditorProject): GameState['entities'] {
  return Object.values(project.instances).reduce<GameState['entities']>((entities, instance) => {
    if (instance.componentType !== 'piece' && instance.componentType !== 'token' && instance.componentType !== 'card') {
      return entities;
    }

    const parent = instance.parentId ? project.instances[instance.parentId] : null;
    if (!parent || !isZoneType(parent.componentType)) {
      return entities;
    }

    const ownerId = instance.bindings.ownerId ?? parent.bindings.ownerId ?? project.seats[0]?.id ?? null;
    const quantity = getEntityQuantity(instance);

    for (let copyIndex = 0; copyIndex < quantity; copyIndex += 1) {
      const entityId = quantity > 1
        ? toPreviewEntityId(instance.instanceId, copyIndex)
        : toPreviewEntityId(instance.instanceId);
      entities[entityId] = {
        id: entityId,
        type: instance.componentType,
        componentType: instance.componentType,
        zoneId: toPreviewZoneId(parent.instanceId),
        ownerId: ownerId ? createPlayerId(ownerId) : null,
        controllerId: ownerId ? createPlayerId(ownerId) : null,
        position: typeof instance.placement?.index === 'number' ? instance.placement.index + copyIndex : copyIndex,
        faceUp: getZoneVisibility(parent.componentType) !== Visibility.Hidden,
        properties: {
          ...instance.properties,
          instanceId: instance.instanceId,
          copyIndex,
        },
        tags: [instance.componentType],
      };
    }

    return entities;
  }, {});
}

function buildPlayers(project: EditorProject): GameState['players'] {
  return project.seats.reduce<GameState['players']>((players, seat, index) => {
    players[seat.id] = {
      id: createPlayerId(seat.id),
      displayName: seat.name,
      role: ParticipantRole.Player,
      isActive: index === 0,
      isEliminated: false,
      score: 0,
      resources: {},
      properties: {
        color: seat.color,
      },
    };
    return players;
  }, {});
}

function getControllingOwnerId(state: GameState, zoneId: ZoneId): string | null {
  const entityId = state.zones[zoneId]?.entityIds[0];
  if (!entityId) {
    return null;
  }

  const entity = state.entities[entityId];
  return entity?.ownerId ?? entity?.controllerId ?? null;
}

function highestScoreWinners(players: GameState['players']): string[] {
  const entries = Object.values(players);
  const highestScore = Math.max(...entries.map((player) => player.score), 0);
  return entries.filter((player) => player.score === highestScore).map((player) => player.id);
}

function createTerritoryMaintenanceActions(
  state: GameState,
  runtime: PreviewRuntime,
  targetScore: number,
  maxTurns: number,
): CanonicalAction[] {
  const actions: CanonicalAction[] = [];
  let timestamp = state.version + 1;

  const scores = Object.values(state.players).reduce<Record<string, number>>((accumulator, player) => {
    accumulator[player.id] = 0;
    return accumulator;
  }, {});

  for (const zoneId of runtime.scoringZoneIds) {
    const ownerId = getControllingOwnerId(state, zoneId);
    if (!ownerId) {
      continue;
    }

    scores[ownerId] = (scores[ownerId] ?? 0) + 1;
  }

  for (const player of Object.values(state.players)) {
    if (player.score === scores[player.id]) {
      continue;
    }

    actions.push({
      type: 'SET_SCORE',
      payload: {
        playerId: player.id,
        score: scores[player.id] ?? 0,
      },
      source: {
        type: 'system',
      },
      timestamp,
    });
    timestamp += 1;
  }

  const playerScores = Object.entries(scores);
  const targetReached = playerScores.filter(([, score]) => score >= targetScore);
  const allClaimed = runtime.scoringZoneIds.length > 0 && runtime.scoringZoneIds.every((zoneId) => state.zones[zoneId]?.entityIds.length > 0);
  const maxTurnsReached = state.turnState.turnNumber >= maxTurns;

  let winnerIds: string[] | null = null;
  if (targetReached.length > 0) {
    const topScore = Math.max(...targetReached.map(([, score]) => score), 0);
    winnerIds = targetReached
      .filter(([, score]) => score === topScore)
      .map(([playerId]) => playerId);
  } else if (allClaimed || maxTurnsReached) {
    winnerIds = highestScoreWinners({
      ...state.players,
      ...Object.fromEntries(
        Object.values(state.players).map((player) => [player.id, {
          ...player,
          score: scores[player.id] ?? player.score,
        }]),
      ),
    });
  }

  if (winnerIds && state.status !== 'finished') {
    actions.push({
      type: 'END_GAME',
      payload: {
        winnerId: winnerIds.length <= 1
          ? (winnerIds[0] ? createPlayerId(winnerIds[0]) : null)
          : winnerIds.map((winnerId) => createPlayerId(winnerId)),
      },
      source: {
        type: 'system',
      },
      timestamp,
    });
  }

  return actions;
}

export function applyPreviewActions(
  state: GameState,
  runtime: PreviewRuntime,
  actions: readonly CanonicalAction[],
  targetScore: number,
  maxTurns: number,
): GameState {
  let nextState = actions.reduce((currentState, action) => reduceGameState(currentState, action), state);
  const maintenanceActions = createTerritoryMaintenanceActions(nextState, runtime, targetScore, maxTurns);
  nextState = maintenanceActions.reduce((currentState, action) => reduceGameState(currentState, action), nextState);
  return nextState;
}

export function normalizePreviewActions(
  project: EditorProject,
  state: GameState,
  actions: readonly CanonicalAction[],
): CanonicalAction[] {
  return actions.map((action) => {
    if (action.type !== 'MOVE_ENTITY') {
      return action;
    }

    const entityId = action.payload.entityId.startsWith('ent_')
      ? action.payload.entityId
      : (project.instances[action.payload.entityId]
        ? toPreviewEntityId(action.payload.entityId)
        : action.payload.entityId);
    const fromZoneId = action.payload.fromZoneId.startsWith('zone_')
      ? action.payload.fromZoneId
      : (project.instances[action.payload.fromZoneId]
        ? toPreviewZoneId(action.payload.fromZoneId)
        : state.entities[entityId]?.zoneId ?? action.payload.fromZoneId);
    const toZoneId = action.payload.toZoneId.startsWith('zone_')
      ? action.payload.toZoneId
      : (project.instances[action.payload.toZoneId]
        ? toPreviewZoneId(action.payload.toZoneId)
        : action.payload.toZoneId);
    const sourceEntity = state.entities[entityId];
    const sourceInstanceId = typeof sourceEntity?.properties.instanceId === 'string'
      ? sourceEntity.properties.instanceId
      : null;
    const sourceInstance = sourceInstanceId ? project.instances[sourceInstanceId] : null;
    const isInfiniteSupply = sourceInstance?.componentType === 'piece' || sourceInstance?.componentType === 'token'
      ? sourceInstance.properties.supplyMode === 'infinite'
      : false;

    if (isInfiniteSupply && sourceEntity) {
      const createdEntityId = createEntityId(`ent_${sourceEntity.properties.instanceId}_${state.version + 1}_${toZoneId}`);
      return {
        type: 'CREATE_ENTITY',
        payload: {
          entity: {
            ...sourceEntity,
            id: createdEntityId,
            zoneId: toZoneId,
            position: state.zones[toZoneId]?.entityIds.length ?? 0,
          },
          zoneId: toZoneId,
        },
        source: action.source,
        timestamp: action.timestamp,
      };
    }

    return {
      ...action,
      payload: {
        ...action.payload,
        entityId,
        fromZoneId,
        toZoneId,
      },
    };
  });
}

function createTerritoryMoveDefinition(destinationZoneIds: readonly ZoneId[]): LegalMoveDefinition {
  return {
    id: 'territory-move',
    generate: ({ playerId, state }: LegalMoveGenerationContext) => {
      const sourceEntityIds = Object.values(state.entities)
        .filter((entity) => entity.ownerId === playerId || entity.controllerId === playerId)
        .map((entity) => entity.id);

      if (sourceEntityIds.length === 0 || destinationZoneIds.length === 0) {
        return [];
      }

      const openZoneIds = destinationZoneIds.filter((zoneId) => {
        const zone = state.zones[zoneId];
        return zone && (zone.maxCapacity === null || zone.entityIds.length < zone.maxCapacity);
      });

      if (openZoneIds.length === 0) {
        return [];
      }

      return {
        id: 'territory:deploy',
        type: 'MOVE_ENTITY',
        displayName: 'Deploy or reposition a piece',
        description: 'Move one of your owned pieces into an open public space or zone.',
        interactableEntities: sourceEntityIds,
        validDestinations: openZoneIds,
        tags: ['territory', 'movement'],
        explanation: {
          summary: 'Owned pieces can move into any open public destination.',
          details: ['Select a piece, then click a highlighted destination.'],
        },
        buildCanonicalActions: ({ request, resolveEntityId, state: visibleState }) => {
          const entityId = createEntityId(resolveEntityId(request.selectedEntityId ?? ''));
          const entity = visibleState.entities[entityId];
          if (!entity || !request.destinationZoneId) {
            return [];
          }

          return [
            {
              type: 'MOVE_ENTITY',
              payload: {
                entityId,
                fromZoneId: entity.zoneId,
                toZoneId: request.destinationZoneId,
                position: visibleState.zones[request.destinationZoneId]?.entityIds.length ?? 0,
              },
              source: {
                type: 'player',
                playerId,
              },
              timestamp: visibleState.version + 1,
            },
          ];
        },
      };
    },
  };
}

function createEndTurnDefinition(): LegalMoveDefinition {
  return {
    id: 'territory-end-turn',
    generate: ({ playerId }) => ({
      id: 'territory:end-turn',
      type: 'END_TURN',
      displayName: 'End turn',
      description: 'Pass play to the next creator seat.',
      tags: ['turn'],
      explanation: {
        summary: 'End the current turn after making your move.',
      },
      canonicalActions: [
        {
          type: 'END_TURN',
          payload: {},
          source: {
            type: 'player',
            playerId,
          },
          timestamp: 1,
        },
      ],
    }),
  };
}

export function buildPreviewRuntime(project: EditorProject): PreviewRuntime {
  const phases = clonePhases(project.rules.phases.length > 0 ? project.rules.phases : ['main']);
  const zones = buildZones(project);
  const zoneIdsByType = buildZoneIdsByType(project);
  const scoringZoneIds = Object.values(project.instances)
    .filter((instance) => isDestinationType(instance.componentType))
    .map((instance) => toPreviewZoneId(instance.instanceId));
  const destinationZoneIds = [...scoringZoneIds];
  const entities = buildEntities(project);
  const players = buildPlayers(project);
  const validation = validateComponentTree(project.instances, builtInCatalog);
  const requirements: string[] = [];

  if (project.rootInstanceIds.length === 0) {
    requirements.push('Add at least one board or public zone to start laying out the prototype.');
  }

  if (destinationZoneIds.length === 0) {
    requirements.push('Add at least one `Space` or `Zone` so the preview has legal destinations.');
  }

  if (Object.keys(entities).length === 0) {
    requirements.push('Add one or more `Piece` or `Token` components and assign them to players.');
  }

  const initialState: GameState = {
    gameId: createGameId(project.id),
    version: 0,
    entities,
    zones,
    players,
    playerOrder: project.seats.map((seat) => createPlayerId(seat.id)),
    turnState: {
      roundNumber: 1,
      turnNumber: 1,
      activePlayerId: createPlayerId(project.seats[0]?.id ?? 'player_one'),
      currentPhase: phases[0]?.name ?? 'main',
      currentStep: phases[0]?.steps[0]?.name ?? 'action',
      phaseIndex: 0,
      stepIndex: 0,
      basePhases: phases,
      phases: clonePhases(project.rules.phases.length > 0 ? project.rules.phases : ['main']),
      turnDirection: 'forward',
      currentTurnKind: 'normal',
      extraTurns: [],
      skippedPlayers: [],
      completedPlayerIdsThisRound: [],
    },
    pendingDecisions: [],
    stack: [],
    priorityWindow: {
      isOpen: false,
      currentPlayerId: null,
      passedPlayerIds: [],
      openedBy: null,
    },
    visibilityMap: {
      entityVisibility: {},
      zoneVisibility: {},
    },
    randomState: {
      seed: 1,
      callCount: 0,
    },
    status: 'playing',
    winner: null,
    actionLog: [],
    componentInstances: Object.fromEntries(
      Object.values(project.instances).map((instance) => [instance.instanceId, {
        instanceId: instance.instanceId,
        componentType: instance.componentType,
        properties: instance.properties,
        children: instance.children,
        parentId: instance.parentId,
        notes: instance.notes,
      }]),
    ),
  };

  const gameDefinition = {
    name: project.name,
    description: project.description,
    priorityPolicy: {
      mode: 'none' as const,
      autoPassEnabled: true,
    },
    phases,
    rulesText: project.rules.rulesText,
  };

  const summarySource = {
    gameDefinition,
    rulesText: project.rules.rulesText,
    componentManifests: [...new Set(Object.values(project.instances).map((instance) => instance.componentType))]
      .map((componentType) => getBuiltInComponentManifest(componentType as BuiltInComponentType))
      .map((manifest) => ({
        type: manifest.type,
        displayName: manifest.displayName,
        description: manifest.description,
        category: manifest.category,
        tags: manifest.tags,
      })),
    componentInstanceNotes: Object.values(project.instances)
      .map((instance) => {
        const notes = instance.notes?.trim() ?? '';
        if (!notes) {
          return null;
        }

        return {
          instanceId: String(instance.instanceId),
          componentType: instance.componentType,
          displayName: getZoneName(instance),
          notes,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    additionalNotes: [
      project.rules.designerNotes,
      `Target score: ${project.rules.targetScore}.`,
      `Max turns: ${project.rules.maxTurns}.`,
    ].filter((value) => value.trim().length > 0),
  };

  return {
    initialState: applyPreviewActions(
      initialState,
      {
        initialState,
        gameDefinition,
        legalMoveDefinitions: [],
        summarySource,
        validation,
        requirements,
        zoneIdsByType,
        scoringZoneIds,
        destinationZoneIds,
      },
      [],
      project.rules.targetScore,
      project.rules.maxTurns,
    ),
    gameDefinition,
    legalMoveDefinitions: [
      createTerritoryMoveDefinition(destinationZoneIds),
      createEndTurnDefinition(),
    ],
    summarySource,
    validation,
    requirements,
    zoneIdsByType,
    scoringZoneIds,
    destinationZoneIds,
  };
}

export function createPreviewMoveTree(state: GameState, runtime: PreviewRuntime) {
  return generateLegalMoveTree(state, {
    playerId: state.turnState.activePlayerId,
    definitions: runtime.legalMoveDefinitions,
  });
}
