import {
  cloneTurnPhases,
} from '@turnbased/engine-core';
import type {
  GameState,
  PhaseDefinition,
} from '@turnbased/engine-core';
import {
  ParticipantRole,
  Visibility,
  createGameId,
} from '@turnbased/shared-types';

import type {
  SampleEntityDefinition,
  SampleGameStateOptions,
  SamplePlayerDefinition,
  SampleZoneDefinition,
} from './types';

interface CreateSampleGameStateOptions extends SampleGameStateOptions {
  gameId: string;
  players: SamplePlayerDefinition[];
  playerOrder: SamplePlayerDefinition['id'][];
  phases: PhaseDefinition[];
  zones: SampleZoneDefinition[];
  entities: SampleEntityDefinition[];
  activePlayerId?: SamplePlayerDefinition['id'];
}

function resolveVisibility(
  token: SampleZoneDefinition['defaultVisibility'],
): Visibility {
  if (token === '@private') {
    return Visibility.Private;
  }

  if (token === '@hidden') {
    return Visibility.Hidden;
  }

  return Visibility.Public;
}

export function createSampleGameState(
  options: CreateSampleGameStateOptions,
): GameState {
  const seed = options.seed ?? 1;
  const basePhases = cloneTurnPhases(options.phases);
  const phases = cloneTurnPhases(options.phases);
  const activePlayerId = options.activePlayerId ?? options.playerOrder[0];
  const entitiesByZone = new Map<string, SampleEntityDefinition[]>();

  for (const entity of options.entities) {
    const bucket = entitiesByZone.get(entity.zoneId) ?? [];
    bucket.push(entity);
    entitiesByZone.set(entity.zoneId, bucket);
  }

  for (const bucket of entitiesByZone.values()) {
    bucket.sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  }

  const players = options.players.reduce<GameState['players']>((accumulator, player, index) => {
    accumulator[player.id] = {
      id: player.id,
      displayName: player.displayName,
      role: options.playerRoles?.[index] ?? player.role ?? ParticipantRole.Player,
      isActive: player.id === activePlayerId,
      isEliminated: player.isEliminated ?? false,
      score: player.score ?? 0,
      resources: { ...(player.resources ?? {}) },
      properties: { ...(player.properties ?? {}) },
    };
    return accumulator;
  }, {});

  const zones = options.zones.reduce<GameState['zones']>((accumulator, zone) => {
    const zoneEntities = entitiesByZone.get(zone.id) ?? [];
    accumulator[zone.id] = {
      id: zone.id,
      type: zone.type,
      name: zone.name,
      ownerId: zone.ownerId ?? null,
      entityIds: zoneEntities.map((entity) => entity.id),
      maxCapacity: zone.maxCapacity ?? null,
      visibility: {
        defaultVisibility: resolveVisibility(zone.defaultVisibility),
        overrides: {},
      },
      properties: { ...(zone.properties ?? {}) },
    };
    return accumulator;
  }, {});

  const entities = options.entities.reduce<GameState['entities']>((accumulator, entity) => {
    accumulator[entity.id] = {
      id: entity.id,
      type: entity.type,
      componentType: entity.componentType,
      zoneId: entity.zoneId,
      ownerId: entity.ownerId ?? null,
      controllerId: entity.controllerId ?? entity.ownerId ?? null,
      position: entity.position ?? 0,
      faceUp: entity.faceUp ?? true,
      properties: { ...(entity.properties ?? {}) },
      tags: [...(entity.tags ?? [])],
    };
    return accumulator;
  }, {});

  return {
    gameId: createGameId(options.gameId),
    version: 0,
    entities,
    zones,
    players,
    playerOrder: [...options.playerOrder],
    turnState: {
      roundNumber: 1,
      turnNumber: 1,
      activePlayerId,
      currentPhase: phases[0]?.name ?? '',
      currentStep: phases[0]?.steps[0]?.name ?? '',
      phaseIndex: 0,
      stepIndex: 0,
      basePhases,
      phases,
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
      seed,
      callCount: 0,
    },
    status: 'playing',
    winner: null,
    actionLog: [],
    componentInstances: {},
  };
}
