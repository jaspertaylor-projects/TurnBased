import type {
  AIRulesSummarySource,
} from '@turnbased/engine-ai';
import type {
  CanonicalAction,
  GameDefinition,
  GameState,
  LegalMoveDefinition,
  TriggerRegistration,
} from '@turnbased/engine-core';
import {
  getNextPlayerIndex,
} from '@turnbased/engine-core';
import {
  ParticipantRole,
  Visibility,
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

const standardMainPhase = [
  {
    name: 'main',
    steps: [
      {
        name: 'action',
        autoAdvance: false,
        requiresPlayerAction: true,
      },
    ],
  },
];

type StateLike = {
  entities: Record<
    string,
    {
      id: string;
      ownerId: string | null;
      properties: Record<string, unknown>;
    }
  >;
  zones: Record<
    string,
    {
      id: string;
      entityIds: string[];
      maxCapacity: number | null;
      properties: Record<string, unknown>;
    }
  >;
  players: Record<
    string,
    {
      score: number;
      resources: Record<string, number>;
    }
  >;
  playerOrder: string[];
  turnState: {
    turnDirection: GameState['turnState']['turnDirection'];
  };
};

function createEndTurnAction(
  playerId: ReturnType<typeof createPlayerId>,
  timestamp: number,
): CanonicalAction {
  return {
    type: 'END_TURN',
    payload: {},
    source: {
      type: 'player',
      playerId,
    },
    timestamp,
  };
}

function createSystemEndGameAction(
  winnerId: ReturnType<typeof createPlayerId> | ReturnType<typeof createPlayerId>[] | null,
  timestamp: number,
): CanonicalAction {
  return {
    type: 'END_GAME',
    payload: {
      winnerId,
    },
    source: {
      type: 'system',
    },
    timestamp,
  };
}

function getCardsInZone(
  state: StateLike,
  zoneId: ReturnType<typeof createZoneId>,
): GameState['entities'][string][] {
  const zone = state.zones[zoneId];
  if (!zone) {
    return [];
  }

  return zone.entityIds
    .map((entityId) => state.entities[entityId])
    .filter((entity): entity is GameState['entities'][string] => Boolean(entity));
}

function getOtherPlayerId(
  state: StateLike,
  playerId: ReturnType<typeof createPlayerId>,
): ReturnType<typeof createPlayerId> {
  return (state.playerOrder.find((candidate) => candidate !== playerId) ?? playerId) as ReturnType<
    typeof createPlayerId
  >;
}

function getNextOrderedPlayerId(
  state: StateLike,
  playerId: ReturnType<typeof createPlayerId>,
): ReturnType<typeof createPlayerId> {
  const index = getNextPlayerIndex(
    state.playerOrder as ReturnType<typeof createPlayerId>[],
    playerId,
    state.turnState.turnDirection,
  );
  return (state.playerOrder[index] ?? playerId) as ReturnType<typeof createPlayerId>;
}

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

function toManifestVisibility(
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

const cardPlayerOneId = createPlayerId('player_card_one');
const cardPlayerTwoId = createPlayerId('player_card_two');
const cardHandOneId = createZoneId('zone_card_hand_one');
const cardHandTwoId = createZoneId('zone_card_hand_two');
const cardStackZoneId = createZoneId('zone_card_stack');
const cardDiscardOneId = createZoneId('zone_card_discard_one');
const cardDiscardTwoId = createZoneId('zone_card_discard_two');

const cardPlayers: SamplePlayerDefinition[] = [
  {
    id: cardPlayerOneId,
    displayName: 'Initiator',
    role: ParticipantRole.Player,
  },
  {
    id: cardPlayerTwoId,
    displayName: 'Responder',
    role: ParticipantRole.Player,
  },
];

const cardZones: SampleZoneDefinition[] = [
  {
    id: cardHandOneId,
    type: 'hand',
    name: 'Initiator Hand',
    ownerId: cardPlayerOneId,
    defaultVisibility: '@private',
  },
  {
    id: cardHandTwoId,
    type: 'hand',
    name: 'Responder Hand',
    ownerId: cardPlayerTwoId,
    defaultVisibility: '@private',
  },
  {
    id: cardStackZoneId,
    type: 'stack',
    name: 'Stack',
    ownerId: null,
  },
  {
    id: cardDiscardOneId,
    type: 'discard',
    name: 'Initiator Discard',
    ownerId: cardPlayerOneId,
  },
  {
    id: cardDiscardTwoId,
    type: 'discard',
    name: 'Responder Discard',
    ownerId: cardPlayerTwoId,
  },
];

const cardEntities: SampleEntityDefinition[] = [
  {
    id: createEntityId('ent_card_attack_alpha'),
    type: 'card',
    componentType: 'card.attack',
    zoneId: cardHandOneId,
    ownerId: cardPlayerOneId,
    faceUp: true,
    properties: {
      kind: 'attack',
      label: 'Strike',
    },
    tags: ['attack'],
    position: 0,
  },
  {
    id: createEntityId('ent_card_defense_alpha'),
    type: 'card',
    componentType: 'card.defense',
    zoneId: cardHandTwoId,
    ownerId: cardPlayerTwoId,
    faceUp: true,
    properties: {
      kind: 'defense',
      label: 'Guard',
    },
    tags: ['defense'],
    position: 0,
  },
  {
    id: createEntityId('ent_card_attack_beta'),
    type: 'card',
    componentType: 'card.attack',
    zoneId: cardHandTwoId,
    ownerId: cardPlayerTwoId,
    faceUp: true,
    properties: {
      kind: 'attack',
      label: 'Riposte',
    },
    tags: ['attack'],
    position: 1,
  },
];

const cardMoveDefinitions: LegalMoveDefinition[] = [
  {
    id: 'card:play-attack',
    generate: ({ state, playerId, hasPriority }) => {
      if (hasPriority || state.turnState.activePlayerId !== playerId) {
        return null;
      }

      const handZoneId = playerId === cardPlayerOneId ? cardHandOneId : cardHandTwoId;
      const attackCards = getCardsInZone(state, handZoneId).filter(
        (entity) => entity.properties.kind === 'attack',
      );

      if (attackCards.length === 0) {
        return {
          type: 'END_TURN',
          displayName: 'Pass turn',
          description: 'No attack cards remain in hand.',
          tags: ['pass'],
          canonicalActions: [createEndTurnAction(playerId, state.version + 1)],
        };
      }

      return {
        type: 'MOVE_ENTITY',
        displayName: 'Play attack card',
        description: 'Put an attack card on the stack to open a response window.',
        interactableEntities: attackCards.map((card) => card.id),
        validDestinations: [cardStackZoneId],
        tags: ['attack'],
        explanation: {
          summary: 'Attack cards open a response window before resolving.',
        },
        buildCanonicalActions: ({ request, resolveEntityId }) => [
          {
            type: 'MOVE_ENTITY',
            payload: {
              entityId: resolveEntityId(
                request.selectedEntityId ?? attackCards[0]?.id ?? '',
              ) as SampleEntityDefinition['id'],
              fromZoneId: handZoneId,
              toZoneId: cardStackZoneId,
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
  {
    id: 'card:play-defense',
    generate: ({ state, playerId, hasPriority }) => {
      if (!hasPriority || state.turnState.activePlayerId === playerId) {
        return null;
      }

      const stackContainsAttack = getCardsInZone(state, cardStackZoneId).some(
        (entity) => entity.properties.kind === 'attack',
      );
      if (!stackContainsAttack) {
        return null;
      }

      const handZoneId = playerId === cardPlayerOneId ? cardHandOneId : cardHandTwoId;
      const defenseCards = getCardsInZone(state, handZoneId).filter(
        (entity) => entity.properties.kind === 'defense',
      );

      if (defenseCards.length === 0) {
        return null;
      }

      return {
        type: 'MOVE_ENTITY',
        displayName: 'Play defense card',
        description: 'Respond to the attack with a defense card.',
        interactableEntities: defenseCards.map((card) => card.id),
        validDestinations: [cardStackZoneId],
        tags: ['defense', 'response'],
        explanation: {
          summary: 'Defense cards resolve first and can absorb an incoming attack.',
        },
        buildCanonicalActions: ({ request, resolveEntityId }) => [
          {
            type: 'MOVE_ENTITY',
            payload: {
              entityId: resolveEntityId(
                request.selectedEntityId ?? defenseCards[0]?.id ?? '',
              ) as SampleEntityDefinition['id'],
              fromZoneId: handZoneId,
              toZoneId: cardStackZoneId,
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

const cardTriggers: TriggerRegistration[] = [
  {
    id: createTriggerId('trigger_card_queue_stack_effect'),
    type: 'automatic',
    event: 'ENTITY_MOVED',
    controllerId: cardPlayerOneId,
    priority: 3,
    once: false,
    resolution: 'immediate',
    matches: ({ action }) =>
      action.type === 'MOVE_ENTITY' &&
      action.payload.toZoneId === cardStackZoneId,
    createActions: ({ state, action }) => {
      if (action.type !== 'MOVE_ENTITY') {
        return [];
      }

      const movedCard = state.entities[action.payload.entityId];
      if (!movedCard) {
        return [];
      }

      const destinationDiscard =
        movedCard.ownerId === cardPlayerOneId ? cardDiscardOneId : cardDiscardTwoId;
      const kind = movedCard.properties.kind === 'defense' ? 'defense' : 'attack';

      return [
        {
          type: 'QUEUE_STACK_ITEM',
          payload: {
            stackItem: {
              id: `stack_${String(movedCard.id)}_${action.timestamp}`,
              source: `${kind}:${String(movedCard.id)}`,
              effect: {
                type: 'MOVE_ENTITY',
                payload: {
                  entityId: movedCard.id,
                  fromZoneId: cardStackZoneId,
                  toZoneId: destinationDiscard,
                },
                source: {
                  type: 'trigger',
                  playerId: movedCard.ownerId ?? cardPlayerOneId,
                },
                timestamp: action.timestamp + 1,
              },
              controllerId: movedCard.ownerId ?? cardPlayerOneId,
              priority: kind === 'defense' ? 2 : 1,
            },
          },
          source: {
            type: 'trigger',
            playerId: movedCard.ownerId ?? cardPlayerOneId,
            triggerId: createTriggerId('trigger_card_queue_stack_effect'),
          },
          timestamp: action.timestamp + 1,
        },
      ];
    },
  },
  {
    id: createTriggerId('trigger_card_resolve_defense'),
    type: 'automatic',
    event: 'ENTITY_MOVED',
    controllerId: cardPlayerTwoId,
    priority: 2,
    once: false,
    resolution: 'immediate',
    matches: ({ state, action }) => {
      if (action.type !== 'MOVE_ENTITY' || action.payload.fromZoneId !== cardStackZoneId) {
        return false;
      }

      return state.entities[action.payload.entityId]?.properties.kind === 'defense';
    },
    createActions: ({ state, action }) => {
      if (action.type !== 'MOVE_ENTITY') {
        return [];
      }

      const movedCard = state.entities[action.payload.entityId];
      const ownerId = movedCard?.ownerId;
      if (!ownerId) {
        return [];
      }

      return [
        {
          type: 'ADD_RESOURCE',
          payload: {
            playerId: ownerId,
            resource: 'shield',
            amount: 1,
          },
          source: {
            type: 'trigger',
            playerId: ownerId,
          },
          timestamp: action.timestamp + 1,
        },
      ];
    },
  },
  {
    id: createTriggerId('trigger_card_resolve_attack'),
    type: 'automatic',
    event: 'ENTITY_MOVED',
    controllerId: cardPlayerOneId,
    priority: 1,
    once: false,
    resolution: 'immediate',
    matches: ({ state, action }) => {
      if (action.type !== 'MOVE_ENTITY' || action.payload.fromZoneId !== cardStackZoneId) {
        return false;
      }

      return state.entities[action.payload.entityId]?.properties.kind === 'attack';
    },
    createActions: ({ state, action }) => {
      if (action.type !== 'MOVE_ENTITY') {
        return [];
      }

      const movedCard = state.entities[action.payload.entityId];
      const attackerId = movedCard?.ownerId;
      if (!attackerId) {
        return [];
      }

      const defenderId = getOtherPlayerId(state, attackerId);
      const shield = state.players[defenderId]?.resources.shield ?? 0;
      if (shield > 0) {
        return [
          {
            type: 'REMOVE_RESOURCE',
            payload: {
              playerId: defenderId,
              resource: 'shield',
              amount: 1,
            },
            source: {
              type: 'trigger',
              playerId: attackerId,
            },
            timestamp: action.timestamp + 1,
          },
          createEndTurnAction(attackerId, action.timestamp + 2),
        ];
      }

      const nextScore = (state.players[attackerId]?.score ?? 0) + 1;
      const actions: CanonicalAction[] = [
        {
          type: 'SET_SCORE',
          payload: {
            playerId: attackerId,
            score: nextScore,
          },
          source: {
            type: 'trigger',
            playerId: attackerId,
          },
          timestamp: action.timestamp + 1,
        },
      ];

      if (nextScore >= 1) {
        actions.push(createSystemEndGameAction(attackerId, action.timestamp + 2));
      } else {
        actions.push(createEndTurnAction(attackerId, action.timestamp + 2));
      }

      return actions;
    },
  },
];

const cardGameDefinition: GameDefinition = {
  name: 'Card Battle Reference',
  description: 'A stack/response reference game for priority windows and LIFO resolution.',
  minPlayers: 2,
  maxPlayers: 2,
  phases: standardMainPhase,
  priorityPolicy: {
    mode: 'limited',
    responseEvents: ['ENTITY_MOVED'],
    autoPassEnabled: true,
  },
  initialZones: cardZones.map((zone) => ({
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
  initialEntities: cardEntities.map((entity) => ({
    type: entity.type,
    componentType: entity.componentType,
    zoneId: entity.zoneId,
    ownerId: entity.ownerId ?? null,
    controllerId: entity.controllerId ?? entity.ownerId ?? null,
    position: entity.position ?? 0,
    faceUp: entity.faceUp ?? false,
    properties: { ...(entity.properties ?? {}) },
    tags: [...(entity.tags ?? [])],
  })),
  triggers: [],
  winCondition: 'First unblocked attack wins.',
  rulesText: 'Attack cards go on the stack; defense cards can respond before resolution.',
  defaultSeed: 17,
};

const cardRules: AIRulesSummarySource = {
  gameDefinition: cardGameDefinition,
  additionalNotes: [
    'Priority should only remain open when the current responder has a legal response.',
  ],
};

const cardRegressionCases: SampleGameRegressionCase[] = [
  {
    id: 'card_defense_then_counter',
    gameId: 'card-battle-reference',
    description: 'A defense should resolve before the original attack, and the counterattack should win.',
    submittedActions: [
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: createEntityId('ent_card_attack_alpha'),
          fromZoneId: cardHandOneId,
          toZoneId: cardStackZoneId,
        },
        source: {
          type: 'player',
          playerId: cardPlayerOneId,
        },
        timestamp: 1,
      },
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: createEntityId('ent_card_defense_alpha'),
          fromZoneId: cardHandTwoId,
          toZoneId: cardStackZoneId,
        },
        source: {
          type: 'player',
          playerId: cardPlayerTwoId,
        },
        timestamp: 3,
      },
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: createEntityId('ent_card_attack_beta'),
          fromZoneId: cardHandTwoId,
          toZoneId: cardStackZoneId,
        },
        source: {
          type: 'player',
          playerId: cardPlayerTwoId,
        },
        timestamp: 5,
      },
    ],
    expected: {
      status: 'finished',
      winner: cardPlayerTwoId,
      scores: {
        [cardPlayerTwoId]: 1,
      },
      resources: {
        [cardPlayerTwoId]: {
          shield: 0,
        },
      },
    },
  },
];

const workerPlayerOneId = createPlayerId('player_worker_one');
const workerPlayerTwoId = createPlayerId('player_worker_two');
const workerReserveOneId = createZoneId('zone_worker_reserve_one');
const workerReserveTwoId = createZoneId('zone_worker_reserve_two');
const workerWoodSpaceId = createZoneId('zone_worker_forest');
const workerStoneSpaceId = createZoneId('zone_worker_quarry');
const workerMarketZoneId = createZoneId('zone_worker_market');
const workerTableauOneId = createZoneId('zone_worker_tableau_one');
const workerTableauTwoId = createZoneId('zone_worker_tableau_two');

const workerPlayers: SamplePlayerDefinition[] = [
  {
    id: workerPlayerOneId,
    displayName: 'Forager',
    role: ParticipantRole.Player,
  },
  {
    id: workerPlayerTwoId,
    displayName: 'Builder',
    role: ParticipantRole.Player,
  },
];

const workerZones: SampleZoneDefinition[] = [
  {
    id: workerReserveOneId,
    type: 'reserve',
    name: 'Forager Reserve',
    ownerId: workerPlayerOneId,
  },
  {
    id: workerReserveTwoId,
    type: 'reserve',
    name: 'Builder Reserve',
    ownerId: workerPlayerTwoId,
  },
  {
    id: workerWoodSpaceId,
    type: 'resource_space',
    name: 'Forest',
    ownerId: null,
    maxCapacity: 1,
    properties: {
      resource: 'wood',
    },
  },
  {
    id: workerStoneSpaceId,
    type: 'resource_space',
    name: 'Quarry',
    ownerId: null,
    maxCapacity: 1,
    properties: {
      resource: 'stone',
    },
  },
  {
    id: workerMarketZoneId,
    type: 'market',
    name: 'Contracts',
    ownerId: null,
  },
  {
    id: workerTableauOneId,
    type: 'tableau',
    name: 'Forager Tableau',
    ownerId: workerPlayerOneId,
  },
  {
    id: workerTableauTwoId,
    type: 'tableau',
    name: 'Builder Tableau',
    ownerId: workerPlayerTwoId,
  },
];

const workerEntities: SampleEntityDefinition[] = [
  {
    id: createEntityId('ent_worker_forager'),
    type: 'piece',
    componentType: 'piece.worker',
    zoneId: workerReserveOneId,
    ownerId: workerPlayerOneId,
    properties: {
      kind: 'worker',
    },
    tags: ['worker'],
    position: 0,
  },
  {
    id: createEntityId('ent_worker_builder'),
    type: 'piece',
    componentType: 'piece.worker',
    zoneId: workerReserveTwoId,
    ownerId: workerPlayerTwoId,
    properties: {
      kind: 'worker',
    },
    tags: ['worker'],
    position: 0,
  },
  {
    id: createEntityId('ent_contract_wood'),
    type: 'card',
    componentType: 'card.contract',
    zoneId: workerMarketZoneId,
    ownerId: null,
    properties: {
      costResource: 'wood',
      costAmount: 1,
      points: 1,
    },
    tags: ['contract', 'wood'],
    position: 0,
  },
  {
    id: createEntityId('ent_contract_stone'),
    type: 'card',
    componentType: 'card.contract',
    zoneId: workerMarketZoneId,
    ownerId: null,
    properties: {
      costResource: 'stone',
      costAmount: 1,
      points: 1,
    },
    tags: ['contract', 'stone'],
    position: 1,
  },
];

const workerMoveDefinitions: LegalMoveDefinition[] = [
  {
    id: 'worker:place',
    generate: ({ state, playerId }) => {
      if (state.turnState.activePlayerId !== playerId || state.priorityWindow.isOpen) {
        return null;
      }

      const reserveZoneId = playerId === workerPlayerOneId ? workerReserveOneId : workerReserveTwoId;
      const reserveZone = state.zones[reserveZoneId];
      const openSpaces = [workerWoodSpaceId, workerStoneSpaceId].filter((zoneId) => {
        const zone = state.zones[zoneId];
        return zone && (zone.maxCapacity === null || zone.entityIds.length < zone.maxCapacity);
      });

      if (!reserveZone || reserveZone.entityIds.length === 0 || openSpaces.length === 0) {
        return null;
      }

      return {
        type: 'MOVE_ENTITY',
        displayName: 'Place worker',
        description: 'Place a worker onto an open resource space to gain its resource.',
        interactableEntities: [...reserveZone.entityIds],
        validDestinations: openSpaces,
        tags: ['placement', 'resource', 'develop'],
        explanation: {
          summary: 'Workers can only go to open spaces, and the space determines the resource gained.',
        },
        buildCanonicalActions: ({ request, resolveEntityId }) => [
          {
            type: 'MOVE_ENTITY',
            payload: {
              entityId: resolveEntityId(
                request.selectedEntityId ?? reserveZone.entityIds[0] ?? '',
              ) as SampleEntityDefinition['id'],
              fromZoneId: reserveZoneId,
              toZoneId: request.destinationZoneId ?? openSpaces[0],
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
  {
    id: 'worker:buy-contract',
    generate: ({ state, playerId }) => {
      if (state.turnState.activePlayerId !== playerId || state.priorityWindow.isOpen) {
        return null;
      }

      const marketCards = getCardsInZone(state, workerMarketZoneId).filter(
        (entity) => entity.properties.costResource && entity.properties.costAmount,
      );
      const affordable = marketCards.filter((entity) => {
        const resource = String(entity.properties.costResource);
        const amount = Number(entity.properties.costAmount);
        return (state.players[playerId]?.resources[resource] ?? 0) >= amount;
      });

      if (affordable.length === 0) {
        return null;
      }

      const tableauZoneId = playerId === workerPlayerOneId ? workerTableauOneId : workerTableauTwoId;

      return {
        type: 'MOVE_ENTITY',
        displayName: 'Buy contract',
        description: 'Spend a collected resource to buy a scoring contract.',
        interactableEntities: affordable.map((entity) => entity.id),
        validDestinations: [tableauZoneId],
        tags: ['score', 'resource'],
        cost: {
          flexible: 1,
        },
        explanation: {
          summary: 'Contracts convert collected resources into points.',
        },
        buildCanonicalActions: ({ request, resolveEntityId }) => {
          const contractId = resolveEntityId(
            request.selectedEntityId ?? affordable[0]?.id ?? '',
          ) as SampleEntityDefinition['id'];
          const contract = state.entities[contractId];
          const costResource = String(contract?.properties.costResource ?? '');
          const costAmount = Number(contract?.properties.costAmount ?? 0);
          const nextScore = (state.players[playerId]?.score ?? 0) + Number(contract?.properties.points ?? 1);

          const actions: CanonicalAction[] = [
            {
              type: 'MOVE_ENTITY',
              payload: {
                entityId: contractId,
                fromZoneId: workerMarketZoneId,
                toZoneId: tableauZoneId,
              },
              source: {
                type: 'player',
                playerId,
              },
              timestamp: state.version + 1,
            },
            {
              type: 'REMOVE_RESOURCE',
              payload: {
                playerId,
                resource: costResource,
                amount: costAmount,
              },
              source: {
                type: 'player',
                playerId,
              },
              timestamp: state.version + 2,
            },
            {
              type: 'SET_SCORE',
              payload: {
                playerId,
                score: nextScore,
              },
              source: {
                type: 'player',
                playerId,
              },
              timestamp: state.version + 3,
            },
          ];

          if (nextScore >= 1) {
            actions.push(createSystemEndGameAction(playerId, state.version + 4));
          } else {
            actions.push(createEndTurnAction(playerId, state.version + 4));
          }

          return actions;
        },
      };
    },
  },
  {
    id: 'worker:end-turn',
    generate: ({ state, playerId }) => {
      if (state.turnState.activePlayerId !== playerId || state.priorityWindow.isOpen) {
        return null;
      }

      return {
        type: 'END_TURN',
        displayName: 'End turn',
        description: 'Pass if you cannot place a worker or afford a contract.',
        tags: ['pass'],
        canonicalActions: [createEndTurnAction(playerId, state.version + 1)],
      };
    },
  },
];

const workerTriggers: TriggerRegistration[] = [
  {
    id: createTriggerId('trigger_worker_collect_resource'),
    type: 'automatic',
    event: 'ENTITY_MOVED',
    controllerId: workerPlayerOneId,
    priority: 1,
    once: false,
    resolution: 'immediate',
    matches: ({ action, state }) =>
      action.type === 'MOVE_ENTITY' &&
      [workerWoodSpaceId, workerStoneSpaceId].includes(action.payload.toZoneId) &&
      state.entities[action.payload.entityId]?.properties.kind === 'worker',
    createActions: ({ state, action }) => {
      if (action.type !== 'MOVE_ENTITY') {
        return [];
      }

      const worker = state.entities[action.payload.entityId];
      const ownerId = worker?.ownerId;
      const resource = String(state.zones[action.payload.toZoneId]?.properties.resource ?? '');
      if (!ownerId || !resource) {
        return [];
      }

      return [
        {
          type: 'ADD_RESOURCE',
          payload: {
            playerId: ownerId,
            resource,
            amount: 1,
          },
          source: {
            type: 'trigger',
            playerId: ownerId,
          },
          timestamp: action.timestamp + 1,
        },
        createEndTurnAction(ownerId, action.timestamp + 2),
      ];
    },
  },
];

const workerGameDefinition: GameDefinition = {
  name: 'Resource Collector Reference',
  description: 'A worker placement reference game with destination-first space selection.',
  minPlayers: 2,
  maxPlayers: 2,
  phases: standardMainPhase,
  priorityPolicy: {
    mode: 'none',
    autoPassEnabled: true,
  },
  initialZones: workerZones.map((zone) => ({
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
  initialEntities: workerEntities.map((entity) => ({
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
  winCondition: 'Buy a contract to score and win.',
  rulesText: 'Workers collect resources from spaces; contracts convert resources into points.',
  defaultSeed: 23,
};

const workerRules: AIRulesSummarySource = {
  gameDefinition: workerGameDefinition,
  documents: [
    {
      title: 'Destination First',
      content: 'Spaces are meaningful destinations first; the engine should still answer what workers can go there.',
      priority: 1,
    },
  ],
};

const workerRegressionCases: SampleGameRegressionCase[] = [
  {
    id: 'worker_collect_and_buy',
    gameId: 'resource-collector-reference',
    description: 'A worker can collect a resource and later spend it on a matching contract.',
    submittedActions: [
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: createEntityId('ent_worker_forager'),
          fromZoneId: workerReserveOneId,
          toZoneId: workerWoodSpaceId,
        },
        source: {
          type: 'player',
          playerId: workerPlayerOneId,
        },
        timestamp: 1,
      },
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: createEntityId('ent_worker_builder'),
          fromZoneId: workerReserveTwoId,
          toZoneId: workerStoneSpaceId,
        },
        source: {
          type: 'player',
          playerId: workerPlayerTwoId,
        },
        timestamp: 4,
      },
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: createEntityId('ent_contract_wood'),
          fromZoneId: workerMarketZoneId,
          toZoneId: workerTableauOneId,
        },
        source: {
          type: 'player',
          playerId: workerPlayerOneId,
        },
        timestamp: 7,
      },
      {
        type: 'REMOVE_RESOURCE',
        payload: {
          playerId: workerPlayerOneId,
          resource: 'wood',
          amount: 1,
        },
        source: {
          type: 'player',
          playerId: workerPlayerOneId,
        },
        timestamp: 8,
      },
      {
        type: 'SET_SCORE',
        payload: {
          playerId: workerPlayerOneId,
          score: 1,
        },
        source: {
          type: 'player',
          playerId: workerPlayerOneId,
        },
        timestamp: 9,
      },
      createSystemEndGameAction(workerPlayerOneId, 10),
    ],
    expected: {
      status: 'finished',
      winner: workerPlayerOneId,
      scores: {
        [workerPlayerOneId]: 1,
      },
      resources: {
        [workerPlayerOneId]: {
          wood: 0,
        },
      },
      zoneContents: {
        [workerTableauOneId]: ['ent_contract_wood'],
      },
    },
  },
];

const chaosPlayerOneId = createPlayerId('player_chaos_one');
const chaosPlayerTwoId = createPlayerId('player_chaos_two');
const chaosPlayerThreeId = createPlayerId('player_chaos_three');
const chaosHandOneId = createZoneId('zone_chaos_hand_one');
const chaosHandTwoId = createZoneId('zone_chaos_hand_two');
const chaosHandThreeId = createZoneId('zone_chaos_hand_three');
const chaosDiscardOneId = createZoneId('zone_chaos_discard_one');
const chaosDiscardTwoId = createZoneId('zone_chaos_discard_two');
const chaosDiscardThreeId = createZoneId('zone_chaos_discard_three');

const chaosPlayers: SamplePlayerDefinition[] = [
  {
    id: chaosPlayerOneId,
    displayName: 'Tempo One',
    role: ParticipantRole.Player,
  },
  {
    id: chaosPlayerTwoId,
    displayName: 'Tempo Two',
    role: ParticipantRole.Player,
  },
  {
    id: chaosPlayerThreeId,
    displayName: 'Tempo Three',
    role: ParticipantRole.Player,
  },
];

const chaosZones: SampleZoneDefinition[] = [
  {
    id: chaosHandOneId,
    type: 'hand',
    name: 'Tempo One Hand',
    ownerId: chaosPlayerOneId,
    defaultVisibility: '@private',
  },
  {
    id: chaosHandTwoId,
    type: 'hand',
    name: 'Tempo Two Hand',
    ownerId: chaosPlayerTwoId,
    defaultVisibility: '@private',
  },
  {
    id: chaosHandThreeId,
    type: 'hand',
    name: 'Tempo Three Hand',
    ownerId: chaosPlayerThreeId,
    defaultVisibility: '@private',
  },
  {
    id: chaosDiscardOneId,
    type: 'discard',
    name: 'Tempo One Discard',
    ownerId: chaosPlayerOneId,
  },
  {
    id: chaosDiscardTwoId,
    type: 'discard',
    name: 'Tempo Two Discard',
    ownerId: chaosPlayerTwoId,
  },
  {
    id: chaosDiscardThreeId,
    type: 'discard',
    name: 'Tempo Three Discard',
    ownerId: chaosPlayerThreeId,
  },
];

const chaosEntities: SampleEntityDefinition[] = [
  {
    id: createEntityId('ent_chaos_again_one'),
    type: 'card',
    componentType: 'card.again',
    zoneId: chaosHandOneId,
    ownerId: chaosPlayerOneId,
    faceUp: false,
    properties: {
      kind: 'again',
    },
    tags: ['again'],
    position: 0,
  },
  {
    id: createEntityId('ent_chaos_reverse_one'),
    type: 'card',
    componentType: 'card.reverse',
    zoneId: chaosHandOneId,
    ownerId: chaosPlayerOneId,
    faceUp: false,
    properties: {
      kind: 'reverse',
    },
    tags: ['reverse'],
    position: 1,
  },
  {
    id: createEntityId('ent_chaos_skip_two'),
    type: 'card',
    componentType: 'card.skip',
    zoneId: chaosHandTwoId,
    ownerId: chaosPlayerTwoId,
    faceUp: false,
    properties: {
      kind: 'skip',
    },
    tags: ['skip'],
    position: 0,
  },
  {
    id: createEntityId('ent_chaos_sprint_two'),
    type: 'card',
    componentType: 'card.sprint',
    zoneId: chaosHandTwoId,
    ownerId: chaosPlayerTwoId,
    faceUp: false,
    properties: {
      kind: 'sprint',
    },
    tags: ['sprint'],
    position: 1,
  },
  {
    id: createEntityId('ent_chaos_reverse_three'),
    type: 'card',
    componentType: 'card.reverse',
    zoneId: chaosHandThreeId,
    ownerId: chaosPlayerThreeId,
    faceUp: false,
    properties: {
      kind: 'reverse',
    },
    tags: ['reverse'],
    position: 0,
  },
];

const chaosMoveDefinitions: LegalMoveDefinition[] = [
  {
    id: 'chaos:play-card',
    generate: ({ state, playerId }) => {
      if (state.turnState.activePlayerId !== playerId || state.priorityWindow.isOpen) {
        return null;
      }

      const handZoneId =
        playerId === chaosPlayerOneId
          ? chaosHandOneId
          : playerId === chaosPlayerTwoId
            ? chaosHandTwoId
            : chaosHandThreeId;
      const discardZoneId =
        playerId === chaosPlayerOneId
          ? chaosDiscardOneId
          : playerId === chaosPlayerTwoId
            ? chaosDiscardTwoId
            : chaosDiscardThreeId;
      const cards = getCardsInZone(state, handZoneId);

      if (cards.length === 0) {
        return null;
      }

      return cards.map((card) => ({
        id: `chaos:play:${String(card.id)}`,
        type: 'MOVE_ENTITY',
        displayName: `Play ${String(card.properties.kind)} card`,
        description:
          card.properties.kind === 'again'
            ? 'Gain an extra turn after this one.'
            : card.properties.kind === 'reverse'
              ? 'Reverse turn order.'
              : card.properties.kind === 'skip'
                ? 'Skip the next player.'
                : 'Play a simple tempo card.',
        interactableEntities: [card.id],
        validDestinations: [discardZoneId],
        tags:
          card.properties.kind === 'again'
            ? ['score', 'develop']
            : card.properties.kind === 'sprint'
              ? ['score']
              : ['attack'],
        explanation: {
          summary: 'These cards mutate the turn sequence directly through canonical actions.',
        },
        buildCanonicalActions: () => {
          const actions: CanonicalAction[] = [
            {
              type: 'MOVE_ENTITY',
              payload: {
                entityId: card.id,
                fromZoneId: handZoneId,
                toZoneId: discardZoneId,
              },
              source: {
                type: 'player',
                playerId,
              },
              timestamp: state.version + 1,
            },
          ];

          if (card.properties.kind === 'reverse') {
            actions.push({
              type: 'REVERSE_TURN_ORDER',
              payload: {},
              source: {
                type: 'player',
                playerId,
              },
              timestamp: state.version + 2,
            });
          } else if (card.properties.kind === 'skip') {
            actions.push({
              type: 'SKIP_TURN',
              payload: {
                playerId: getNextOrderedPlayerId(state, playerId),
              },
              source: {
                type: 'player',
                playerId,
              },
              timestamp: state.version + 2,
            });
          } else if (card.properties.kind === 'again') {
            actions.push({
              type: 'ADD_EXTRA_TURN',
              payload: {
                playerId,
              },
              source: {
                type: 'player',
                playerId,
              },
              timestamp: state.version + 2,
            });
          }

          actions.push(createEndTurnAction(playerId, state.version + 3));
          return actions;
        },
      }));
    },
  },
];

const chaosTriggers: TriggerRegistration[] = [
  {
    id: createTriggerId('trigger_chaos_empty_hand_wins'),
    type: 'automatic',
    event: 'ENTITY_MOVED',
    controllerId: chaosPlayerOneId,
    priority: 1,
    once: false,
    resolution: 'immediate',
    matches: ({ action, state }) => {
      if (action.type !== 'MOVE_ENTITY') {
        return false;
      }

      const movedEntity = state.entities[action.payload.entityId];
      if (!movedEntity?.ownerId) {
        return false;
      }

      const ownerHandId =
        movedEntity.ownerId === chaosPlayerOneId
          ? chaosHandOneId
          : movedEntity.ownerId === chaosPlayerTwoId
            ? chaosHandTwoId
            : chaosHandThreeId;

      return (state.zones[ownerHandId]?.entityIds.length ?? 0) === 0;
    },
    createActions: ({ state, action }) => {
      if (action.type !== 'MOVE_ENTITY') {
        return [];
      }

      const winnerId = state.entities[action.payload.entityId]?.ownerId;
      if (!winnerId) {
        return [];
      }

      return [createSystemEndGameAction(winnerId, action.timestamp + 1)];
    },
  },
];

const chaosGameDefinition: GameDefinition = {
  name: 'Turn Order Chaos Reference',
  description: 'A turn-order mutation reference game with reverse, skip, and extra-turn cards.',
  minPlayers: 3,
  maxPlayers: 3,
  phases: standardMainPhase,
  priorityPolicy: {
    mode: 'none',
    autoPassEnabled: true,
  },
  initialZones: chaosZones.map((zone) => ({
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
  initialEntities: chaosEntities.map((entity) => ({
    type: entity.type,
    componentType: entity.componentType,
    zoneId: entity.zoneId,
    ownerId: entity.ownerId ?? null,
    controllerId: entity.controllerId ?? entity.ownerId ?? null,
    position: entity.position ?? 0,
    faceUp: entity.faceUp ?? false,
    properties: { ...(entity.properties ?? {}) },
    tags: [...(entity.tags ?? [])],
  })),
  triggers: [],
  winCondition: 'The first player to empty their hand wins.',
  rulesText: 'Cards can reverse direction, skip players, or grant extra turns.',
  defaultSeed: 29,
};

const chaosRules: AIRulesSummarySource = {
  gameDefinition: chaosGameDefinition,
  additionalNotes: ['End-of-turn mutations should reset turn phases cleanly between turns.'],
};

const chaosRegressionCases: SampleGameRegressionCase[] = [
  {
    id: 'chaos_reverse_changes_order',
    gameId: 'turn-order-chaos-reference',
    description: 'Playing reverse should flip direction and hand the next turn to the previous player in order.',
    submittedActions: [
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: createEntityId('ent_chaos_reverse_one'),
          fromZoneId: chaosHandOneId,
          toZoneId: chaosDiscardOneId,
        },
        source: {
          type: 'player',
          playerId: chaosPlayerOneId,
        },
        timestamp: 1,
      },
      {
        type: 'REVERSE_TURN_ORDER',
        payload: {},
        source: {
          type: 'player',
          playerId: chaosPlayerOneId,
        },
        timestamp: 2,
      },
      createEndTurnAction(chaosPlayerOneId, 3),
    ],
    expected: {
      status: 'playing',
      activePlayerId: chaosPlayerThreeId,
      turnDirection: 'reverse',
    },
  },
  {
    id: 'chaos_again_then_reverse',
    gameId: 'turn-order-chaos-reference',
    description: 'Extra turns should resolve before normal order, and reverse should flip the next normal direction.',
    submittedActions: [
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: createEntityId('ent_chaos_again_one'),
          fromZoneId: chaosHandOneId,
          toZoneId: chaosDiscardOneId,
        },
        source: {
          type: 'player',
          playerId: chaosPlayerOneId,
        },
        timestamp: 1,
      },
      {
        type: 'ADD_EXTRA_TURN',
        payload: {
          playerId: chaosPlayerOneId,
        },
        source: {
          type: 'player',
          playerId: chaosPlayerOneId,
        },
        timestamp: 2,
      },
      createEndTurnAction(chaosPlayerOneId, 3),
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: createEntityId('ent_chaos_reverse_one'),
          fromZoneId: chaosHandOneId,
          toZoneId: chaosDiscardOneId,
        },
        source: {
          type: 'player',
          playerId: chaosPlayerOneId,
        },
        timestamp: 4,
      },
    ],
    expected: {
      status: 'finished',
      winner: chaosPlayerOneId,
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

export const cardBattleReferenceGame: SampleGameDefinition = {
  id: 'card-battle-reference',
  name: 'Card Battle Reference',
  archetype: 'stack/response card game',
  description: cardGameDefinition.description,
  gameDefinition: cardGameDefinition,
  legalMoveDefinitions: cardMoveDefinitions,
  triggers: cardTriggers,
  rules: cardRules,
  createInitialState: (options = {}) =>
    createSampleGameState({
      gameId: 'game_sample_card_battle',
      seed: options.seed ?? cardGameDefinition.defaultSeed ?? 1,
      playerRoles: options.playerRoles,
      players: cardPlayers,
      playerOrder: [cardPlayerOneId, cardPlayerTwoId],
      phases: standardMainPhase,
      zones: cardZones,
      entities: cardEntities,
      activePlayerId: cardPlayerOneId,
    }),
  regressionCases: cardRegressionCases,
};

export const workerPlacementReferenceGame: SampleGameDefinition = {
  id: 'resource-collector-reference',
  name: 'Resource Collector Reference',
  archetype: 'worker placement / destination->item',
  description: workerGameDefinition.description,
  gameDefinition: workerGameDefinition,
  legalMoveDefinitions: workerMoveDefinitions,
  triggers: workerTriggers,
  rules: workerRules,
  createInitialState: (options = {}) =>
    createSampleGameState({
      gameId: 'game_sample_worker',
      seed: options.seed ?? workerGameDefinition.defaultSeed ?? 1,
      playerRoles: options.playerRoles,
      players: workerPlayers,
      playerOrder: [workerPlayerOneId, workerPlayerTwoId],
      phases: standardMainPhase,
      zones: workerZones,
      entities: workerEntities,
      activePlayerId: workerPlayerOneId,
    }),
  regressionCases: workerRegressionCases,
};

export const turnOrderChaosReferenceGame: SampleGameDefinition = {
  id: 'turn-order-chaos-reference',
  name: 'Turn Order Chaos Reference',
  archetype: 'turn-order mutation',
  description: chaosGameDefinition.description,
  gameDefinition: chaosGameDefinition,
  legalMoveDefinitions: chaosMoveDefinitions,
  triggers: chaosTriggers,
  rules: chaosRules,
  createInitialState: (options = {}) =>
    createSampleGameState({
      gameId: 'game_sample_chaos',
      seed: options.seed ?? chaosGameDefinition.defaultSeed ?? 1,
      playerRoles: options.playerRoles,
      players: chaosPlayers,
      playerOrder: [chaosPlayerOneId, chaosPlayerTwoId, chaosPlayerThreeId],
      phases: standardMainPhase,
      zones: chaosZones,
      entities: chaosEntities,
      activePlayerId: chaosPlayerOneId,
    }),
  regressionCases: chaosRegressionCases,
};

export const sampleGames = [
  placementReferenceGame,
  cardBattleReferenceGame,
  workerPlacementReferenceGame,
  turnOrderChaosReferenceGame,
];

export const sampleGamesById = Object.fromEntries(
  sampleGames.map((game) => [game.id, game]),
) as Record<string, SampleGameDefinition>;

export const sampleGameRegressionPack = sampleGames.flatMap((game) => game.regressionCases);
