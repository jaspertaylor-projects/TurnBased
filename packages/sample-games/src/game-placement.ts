import type {
  AIRulesSummarySource,
} from '@turnbased/engine-ai';
import type {
  GameDefinition,
  LegalMoveDefinition,
  TriggerRegistration,
} from '@turnbased/engine-core';
import {
  ParticipantRole,
  createEntityId,
  createPlayerId,
  createTriggerId,
  createZoneId,
} from '@turnbased/shared-types';

import { createSampleGameState } from './builders';
import type {
  SampleEntityDefinition,
  SampleGameDefinition,
  SampleGameRegressionCase,
  SamplePlayerDefinition,
  SampleZoneDefinition,
} from './types';
import {
  createEndTurnAction,
  createSystemEndGameAction,
  standardMainPhase,
  toManifestVisibility,
} from './game-helpers';
import type { StateLike } from './game-helpers';

const placementPlayerOneId = createPlayerId('player_placement_one');
const placementPlayerTwoId = createPlayerId('player_placement_two');
const placementReserveOneId = createZoneId('zone_placement_reserve_one');
const placementReserveTwoId = createZoneId('zone_placement_reserve_two');
const placementBoardZoneIds = [
  createZoneId('zone_placement_board_0'),
  createZoneId('zone_placement_board_1'),
  createZoneId('zone_placement_board_2'),
  createZoneId('zone_placement_board_3'),
  createZoneId('zone_placement_board_4'),
  createZoneId('zone_placement_board_5'),
  createZoneId('zone_placement_board_6'),
  createZoneId('zone_placement_board_7'),
  createZoneId('zone_placement_board_8'),
] as const;

const placementPlayers: SamplePlayerDefinition[] = [
  {
    id: placementPlayerOneId,
    displayName: 'Cross',
    role: ParticipantRole.Player,
  },
  {
    id: placementPlayerTwoId,
    displayName: 'Circle',
    role: ParticipantRole.Player,
  },
];

const placementZones: SampleZoneDefinition[] = [
  {
    id: placementReserveOneId,
    type: 'reserve',
    name: 'Cross Reserve',
    ownerId: placementPlayerOneId,
  },
  {
    id: placementReserveTwoId,
    type: 'reserve',
    name: 'Circle Reserve',
    ownerId: placementPlayerTwoId,
  },
  ...placementBoardZoneIds.map((zoneId, index) => ({
    id: zoneId,
    type: 'board_slot',
    name: `Space ${index + 1}`,
    ownerId: null,
    maxCapacity: 1,
  })),
];

const placementEntities: SampleEntityDefinition[] = [
  createEntityId('ent_placement_cross_1'),
  createEntityId('ent_placement_cross_2'),
  createEntityId('ent_placement_cross_3'),
  createEntityId('ent_placement_cross_4'),
  createEntityId('ent_placement_cross_5'),
].map((entityId, index) => ({
  id: entityId,
  type: 'piece',
  componentType: 'piece.cross',
  zoneId: placementReserveOneId,
  ownerId: placementPlayerOneId,
  properties: {
    symbol: 'X',
  },
  tags: ['marker', 'cross'],
  position: index,
})).concat(
  [
    createEntityId('ent_placement_circle_1'),
    createEntityId('ent_placement_circle_2'),
    createEntityId('ent_placement_circle_3'),
    createEntityId('ent_placement_circle_4'),
  ].map((entityId, index) => ({
    id: entityId,
    type: 'piece',
    componentType: 'piece.circle',
    zoneId: placementReserveTwoId,
    ownerId: placementPlayerTwoId,
    properties: {
      symbol: 'O',
    },
    tags: ['marker', 'circle'],
    position: index,
  })),
);

const placementWinningLines = [
  [placementBoardZoneIds[0], placementBoardZoneIds[1], placementBoardZoneIds[2]],
  [placementBoardZoneIds[3], placementBoardZoneIds[4], placementBoardZoneIds[5]],
  [placementBoardZoneIds[6], placementBoardZoneIds[7], placementBoardZoneIds[8]],
  [placementBoardZoneIds[0], placementBoardZoneIds[3], placementBoardZoneIds[6]],
  [placementBoardZoneIds[1], placementBoardZoneIds[4], placementBoardZoneIds[7]],
  [placementBoardZoneIds[2], placementBoardZoneIds[5], placementBoardZoneIds[8]],
  [placementBoardZoneIds[0], placementBoardZoneIds[4], placementBoardZoneIds[8]],
  [placementBoardZoneIds[2], placementBoardZoneIds[4], placementBoardZoneIds[6]],
];

function playerControlsZone(
  state: StateLike,
  zoneId: ReturnType<typeof createZoneId>,
  playerId: ReturnType<typeof createPlayerId>,
): boolean {
  const occupantId = state.zones[zoneId]?.entityIds[0];
  if (!occupantId) {
    return false;
  }

  return state.entities[occupantId]?.ownerId === playerId;
}

function hasPlacementWinner(
  state: StateLike,
  playerId: ReturnType<typeof createPlayerId>,
): boolean {
  return placementWinningLines.some((line) =>
    line.every((zoneId) => playerControlsZone(state, zoneId, playerId)),
  );
}

function isPlacementBoardFull(state: StateLike): boolean {
  return placementBoardZoneIds.every((zoneId) => (state.zones[zoneId]?.entityIds.length ?? 0) > 0);
}

const placementMoveDefinitions: LegalMoveDefinition[] = [
  {
    id: 'placement:place-marker',
    generate: ({ state, playerId }) => {
      if (state.turnState.activePlayerId !== playerId || state.priorityWindow.isOpen) {
        return null;
      }

      const reserveZoneId =
        playerId === placementPlayerOneId ? placementReserveOneId : placementReserveTwoId;
      const reserveZone = state.zones[reserveZoneId];
      const openBoardZones = placementBoardZoneIds.filter(
        (zoneId) => (state.zones[zoneId]?.entityIds.length ?? 0) === 0,
      );

      if (!reserveZone || reserveZone.entityIds.length === 0 || openBoardZones.length === 0) {
        return null;
      }

      return {
        type: 'MOVE_ENTITY',
        displayName: 'Place marker',
        description: 'Place one of your reserve markers into an empty board space.',
        interactableEntities: [...reserveZone.entityIds],
        validDestinations: openBoardZones,
        tags: ['placement', 'develop', 'win'],
        explanation: {
          summary: 'Markers can only be placed into empty spaces.',
        },
        buildCanonicalActions: ({ request, resolveEntityId }) => [
          {
            type: 'MOVE_ENTITY',
            payload: {
              entityId: resolveEntityId(
                request.selectedEntityId ?? reserveZone.entityIds[0] ?? '',
              ) as SampleEntityDefinition['id'],
              fromZoneId: reserveZoneId,
              toZoneId: request.destinationZoneId ?? openBoardZones[0],
            },
            source: {
              type: 'player',
              playerId,
            },
            timestamp: state.version + 1,
          },
        ],
      };
    },
  },
];

const placementTriggers: TriggerRegistration[] = [
  {
    id: createTriggerId('trigger_placement_win'),
    type: 'automatic',
    event: 'ENTITY_MOVED',
    controllerId: placementPlayerOneId,
    priority: 3,
    once: false,
    resolution: 'immediate',
    matches: ({ action }) =>
      action.type === 'MOVE_ENTITY' &&
      placementBoardZoneIds.includes(action.payload.toZoneId),
    createActions: ({ state, action }) => {
      if (action.type !== 'MOVE_ENTITY') {
        return [];
      }

      const movedEntity = state.entities[action.payload.entityId];
      const ownerId = movedEntity?.ownerId;
      if (!ownerId || !hasPlacementWinner(state, ownerId)) {
        return [];
      }

      return [createSystemEndGameAction(ownerId, action.timestamp + 1)];
    },
  },
  {
    id: createTriggerId('trigger_placement_draw'),
    type: 'automatic',
    event: 'ENTITY_MOVED',
    controllerId: placementPlayerOneId,
    priority: 2,
    once: false,
    resolution: 'immediate',
    matches: ({ action, state }) =>
      action.type === 'MOVE_ENTITY' &&
      placementBoardZoneIds.includes(action.payload.toZoneId) &&
      !hasPlacementWinner(state, placementPlayerOneId) &&
      !hasPlacementWinner(state, placementPlayerTwoId) &&
      isPlacementBoardFull(state),
    effect: createSystemEndGameAction(null, 0),
  },
  {
    id: createTriggerId('trigger_placement_end_turn'),
    type: 'automatic',
    event: 'ENTITY_MOVED',
    controllerId: placementPlayerOneId,
    priority: 1,
    once: false,
    resolution: 'immediate',
    matches: ({ action, state }) => {
      if (action.type !== 'MOVE_ENTITY' || !placementBoardZoneIds.includes(action.payload.toZoneId)) {
        return false;
      }

      return (
        !hasPlacementWinner(state, placementPlayerOneId) &&
        !hasPlacementWinner(state, placementPlayerTwoId) &&
        !isPlacementBoardFull(state)
      );
    },
    createActions: ({ action }) => [
      createEndTurnAction(action.source.playerId ?? placementPlayerOneId, action.timestamp + 1),
    ],
  },
];

const placementGameDefinition: GameDefinition = {
  name: 'Tic-Tac-Toe Reference',
  description: 'A track/placement reference game that validates turn-taking and line wins.',
  minPlayers: 2,
  maxPlayers: 2,
  phases: standardMainPhase,
  priorityPolicy: {
    mode: 'none',
    autoPassEnabled: true,
  },
  initialZones: placementZones.map((zone) => ({
    id: zone.id,
    type: zone.type,
    name: zone.name,
    ownerId: zone.ownerId ?? null,
    maxCapacity: zone.maxCapacity ?? null,
    visibility: {
      defaultVisibility: toManifestVisibility(zone.defaultVisibility),
      overrides: {},
    },
    properties: { ...(zone.properties ?? {}) },
  })),
  initialEntities: placementEntities.map((entity) => ({
    type: entity.type,
    componentType: entity.componentType,
    zoneId: entity.zoneId,
    ownerId: entity.ownerId ?? null,
    controllerId: entity.controllerId ?? entity.ownerId ?? null,
    position: entity.position ?? 0,
    faceUp: entity.faceUp ?? true,
    properties: { ...(entity.properties ?? {}) },
    tags: [...(entity.tags ?? [])],
  })),
  triggers: [],
  winCondition: 'Three markers in a row wins; a full board with no line is a draw.',
  rulesText: 'Players alternate placing reserve markers into empty board spaces.',
  defaultSeed: 11,
};

const placementRules: AIRulesSummarySource = {
  gameDefinition: placementGameDefinition,
  documents: [
    {
      title: 'Board',
      content: 'There are nine public board spaces arranged in a 3x3 grid.',
      priority: 1,
    },
  ],
  componentManifests: [
    {
      type: 'piece.cross',
      displayName: 'Cross Marker',
      category: 'entity',
      description: 'A reserve marker for the first player.',
    },
    {
      type: 'piece.circle',
      displayName: 'Circle Marker',
      category: 'entity',
      description: 'A reserve marker for the second player.',
    },
  ],
};

const placementRegressionCases: SampleGameRegressionCase[] = [
  {
    id: 'placement_diagonal_win',
    gameId: 'tic-tac-toe-reference',
    description: 'A diagonal line should immediately end the game.',
    submittedActions: [
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: createEntityId('ent_placement_cross_1'),
          fromZoneId: placementReserveOneId,
          toZoneId: placementBoardZoneIds[0],
        },
        source: {
          type: 'player',
          playerId: placementPlayerOneId,
        },
        timestamp: 1,
      },
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: createEntityId('ent_placement_circle_1'),
          fromZoneId: placementReserveTwoId,
          toZoneId: placementBoardZoneIds[1],
        },
        source: {
          type: 'player',
          playerId: placementPlayerTwoId,
        },
        timestamp: 3,
      },
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: createEntityId('ent_placement_cross_2'),
          fromZoneId: placementReserveOneId,
          toZoneId: placementBoardZoneIds[4],
        },
        source: {
          type: 'player',
          playerId: placementPlayerOneId,
        },
        timestamp: 5,
      },
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: createEntityId('ent_placement_circle_2'),
          fromZoneId: placementReserveTwoId,
          toZoneId: placementBoardZoneIds[2],
        },
        source: {
          type: 'player',
          playerId: placementPlayerTwoId,
        },
        timestamp: 7,
      },
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: createEntityId('ent_placement_cross_3'),
          fromZoneId: placementReserveOneId,
          toZoneId: placementBoardZoneIds[8],
        },
        source: {
          type: 'player',
          playerId: placementPlayerOneId,
        },
        timestamp: 9,
      },
    ],
    expected: {
      status: 'finished',
      winner: placementPlayerOneId,
      zoneContents: {
        [placementBoardZoneIds[0]]: ['ent_placement_cross_1'],
        [placementBoardZoneIds[4]]: ['ent_placement_cross_2'],
        [placementBoardZoneIds[8]]: ['ent_placement_cross_3'],
      },
    },
  },
];

export const placementReferenceGame: SampleGameDefinition = {
  id: 'tic-tac-toe-reference',
  name: 'Tic-Tac-Toe Reference',
  archetype: 'track/placement',
  description: placementGameDefinition.description,
  gameDefinition: placementGameDefinition,
  legalMoveDefinitions: placementMoveDefinitions,
  triggers: placementTriggers,
  rules: placementRules,
  createInitialState: (options = {}) =>
    createSampleGameState({
      gameId: 'game_sample_placement',
      seed: options.seed ?? placementGameDefinition.defaultSeed ?? 1,
      playerRoles: options.playerRoles,
      players: placementPlayers,
      playerOrder: [placementPlayerOneId, placementPlayerTwoId],
      phases: standardMainPhase,
      zones: placementZones,
      entities: placementEntities,
      activePlayerId: placementPlayerOneId,
    }),
  regressionCases: placementRegressionCases,
};
