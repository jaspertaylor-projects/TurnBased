import type {
  AIRulesSummarySource,
} from '@turnbased/engine-ai';
import type {
  CanonicalAction,
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
  getCardsInZone,
  getNextOrderedPlayerId,
  standardMainPhase,
  toManifestVisibility,
} from './game-helpers';

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
