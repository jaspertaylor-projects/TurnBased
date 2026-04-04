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
  getOtherPlayerId,
  standardMainPhase,
  toManifestVisibility,
} from './game-helpers';

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
