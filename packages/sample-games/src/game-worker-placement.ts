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
  standardMainPhase,
  toManifestVisibility,
} from './game-helpers';

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
