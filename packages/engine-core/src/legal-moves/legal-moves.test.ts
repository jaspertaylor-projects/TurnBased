import { describe, expect, it } from 'vitest';
import {
  createEntityId,
  createGameId,
  createPlayerId,
  createZoneId,
  ParticipantRole,
  Visibility,
} from '@turnbased/shared-types';

import type { GameState, LegalMoveDefinition } from '../index';
import {
  generateLegalMoveTree,
  getValidDestinations,
  getValidEntitiesForDestination,
} from '../index';

const gameId = createGameId('game_legal_moves');
const playerOneId = createPlayerId('player_1');
const playerTwoId = createPlayerId('player_2');
const reserveZoneId = createZoneId('zone_reserve');
const handZoneId = createZoneId('zone_hand');
const boardLeftZoneId = createZoneId('zone_board_left');
const boardRightZoneId = createZoneId('zone_board_right');
const reservePieceId = createEntityId('ent_reserve_piece');
const handCardId = createEntityId('ent_hand_card');
const occupiedBoardPieceId = createEntityId('ent_board_piece');

const basePhases = [
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

function createBaseState(): GameState {
  return {
    gameId,
    version: 8,
    entities: {
      [reservePieceId]: {
        id: reservePieceId,
        type: 'piece',
        componentType: 'piece.soldier',
        zoneId: reserveZoneId,
        ownerId: playerOneId,
        controllerId: playerOneId,
        position: 0,
        faceUp: true,
        properties: {
          strength: 2,
        },
        tags: ['reserve'],
      },
      [handCardId]: {
        id: handCardId,
        type: 'card',
        componentType: 'card.spell',
        zoneId: handZoneId,
        ownerId: playerOneId,
        controllerId: playerOneId,
        position: 0,
        faceUp: false,
        properties: {
          cost: 1,
        },
        tags: ['spell'],
      },
      [occupiedBoardPieceId]: {
        id: occupiedBoardPieceId,
        type: 'piece',
        componentType: 'piece.guard',
        zoneId: boardLeftZoneId,
        ownerId: playerTwoId,
        controllerId: playerTwoId,
        position: 0,
        faceUp: true,
        properties: {},
        tags: ['board'],
      },
    },
    zones: {
      [reserveZoneId]: {
        id: reserveZoneId,
        type: 'reserve',
        name: 'Reserve',
        ownerId: playerOneId,
        entityIds: [reservePieceId],
        maxCapacity: null,
        visibility: {
          defaultVisibility: Visibility.Public,
          overrides: {},
        },
        properties: {},
      },
      [handZoneId]: {
        id: handZoneId,
        type: 'hand',
        name: 'Hand',
        ownerId: playerOneId,
        entityIds: [handCardId],
        maxCapacity: null,
        visibility: {
          defaultVisibility: Visibility.Private,
          overrides: {},
        },
        properties: {},
      },
      [boardLeftZoneId]: {
        id: boardLeftZoneId,
        type: 'board_slot',
        name: 'Board Left',
        ownerId: null,
        entityIds: [occupiedBoardPieceId],
        maxCapacity: 1,
        visibility: {
          defaultVisibility: Visibility.Public,
          overrides: {},
        },
        properties: {},
      },
      [boardRightZoneId]: {
        id: boardRightZoneId,
        type: 'board_slot',
        name: 'Board Right',
        ownerId: null,
        entityIds: [],
        maxCapacity: 1,
        visibility: {
          defaultVisibility: Visibility.Public,
          overrides: {},
        },
        properties: {},
      },
    },
    players: {
      [playerOneId]: {
        id: playerOneId,
        displayName: 'Player One',
        role: ParticipantRole.Player,
        isActive: true,
        isEliminated: false,
        score: 0,
        resources: {
          mana: 2,
        },
        properties: {},
      },
      [playerTwoId]: {
        id: playerTwoId,
        displayName: 'Player Two',
        role: ParticipantRole.Player,
        isActive: false,
        isEliminated: false,
        score: 0,
        resources: {
          mana: 0,
        },
        properties: {},
      },
    },
    playerOrder: [playerOneId, playerTwoId],
    turnState: {
      roundNumber: 1,
      turnNumber: 1,
      activePlayerId: playerOneId,
      currentPhase: 'main',
      currentStep: 'action',
      phaseIndex: 0,
      stepIndex: 0,
      basePhases,
      phases: basePhases.map((phase) => ({
        ...phase,
        steps: phase.steps.map((step) => ({ ...step })),
      })),
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
      seed: 7,
      callCount: 0,
    },
    status: 'playing',
    winner: null,
    actionLog: [],
    componentInstances: {},
  };
}

function setActivePlayer(state: GameState, playerId: typeof playerOneId): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      [playerOneId]: {
        ...state.players[playerOneId],
        isActive: playerOneId === playerId,
      },
      [playerTwoId]: {
        ...state.players[playerTwoId],
        isActive: playerTwoId === playerId,
      },
    },
    turnState: {
      ...state.turnState,
      activePlayerId: playerId,
    },
  };
}

const boardPlacementDefinition: LegalMoveDefinition = {
  id: 'board-placement',
  generate: ({ playerId, state }) => {
    const reserveZone = state.zones[reserveZoneId];
    const openBoardZones = [boardLeftZoneId, boardRightZoneId].filter((zoneId) => {
      const zone = state.zones[zoneId];
      return zone && (zone.maxCapacity === null || zone.entityIds.length < zone.maxCapacity);
    });

    if (!reserveZone || reserveZone.entityIds.length === 0 || openBoardZones.length === 0) {
      return [];
    }

    return {
      id: 'place-piece',
      type: 'MOVE_ENTITY',
      displayName: 'Deploy reserve piece',
      description: 'Move a piece from reserve to an open board space.',
      interactableEntities: reserveZone.entityIds,
      validDestinations: openBoardZones,
      tags: ['board', 'placement'],
          explanation: {
            summary: 'Reserve pieces can be deployed to empty board spaces.',
          },
      buildCanonicalActions: ({ request, resolveEntityId }) => {
        const entityId = createEntityId(resolveEntityId(request.selectedEntityId ?? ''));

        return [
          {
            type: 'MOVE_ENTITY',
            payload: {
              entityId,
              fromZoneId: reserveZoneId,
              toZoneId: request.destinationZoneId ?? boardRightZoneId,
              position: 0,
            },
            source: {
              type: 'player',
              playerId,
            },
            timestamp: state.version + 1,
          },
        ];
      },
    };
  },
};

const cardPlayDefinition: LegalMoveDefinition = {
  id: 'card-play',
  generate: ({ playerId, state }) => {
    const handZone = state.zones[handZoneId];
    const destinationZone = state.zones[boardRightZoneId];

    if (!handZone || handZone.entityIds.length === 0 || !destinationZone) {
      return [];
    }

    return {
      id: 'play-card',
      type: 'PLAY_CARD',
      displayName: 'Play a card',
      description: 'Play a card from hand onto the board.',
      interactableEntities: handZone.entityIds,
      validDestinations: [boardRightZoneId],
      tags: ['card', 'play'],
      explanation: {
        summary: 'Playable cards come from the visible hand projection.',
      },
      buildCanonicalActions: ({ request, resolveEntityId }) => {
        const entityId = createEntityId(resolveEntityId(request.selectedEntityId ?? ''));

        return [
          {
            type: 'MOVE_ENTITY',
            payload: {
              entityId,
              fromZoneId: handZoneId,
              toZoneId: request.destinationZoneId ?? boardRightZoneId,
              position: 0,
            },
            source: {
              type: 'player',
              playerId,
            },
            timestamp: state.version + 1,
          },
          {
            type: 'REVEAL_ENTITY',
            payload: {
              entityId,
            },
            source: {
              type: 'player',
              playerId,
            },
            timestamp: state.version + 1,
          },
        ];
      },
    };
  },
};

describe('legal move generation', () => {
  it('enumerates board placement actions and destination filters', () => {
    const state = createBaseState();
    const moveTree = generateLegalMoveTree(state, {
      playerId: playerOneId,
      definitions: [boardPlacementDefinition],
    });

    expect(moveTree.availableActions).toHaveLength(1);
    expect(moveTree.availableActions[0]?.id).toBe('place-piece');
    expect(moveTree.availableActions[0]?.interactableEntities).toEqual([reservePieceId]);
    expect(getValidDestinations(moveTree, reservePieceId)).toEqual([boardRightZoneId]);
    expect(getValidEntitiesForDestination(moveTree, boardRightZoneId)).toEqual([reservePieceId]);

    const validation = moveTree.validate({
      actionId: 'place-piece',
      selectedEntityId: reservePieceId,
      destinationZoneId: boardRightZoneId,
    });

    expect(validation.isValid).toBe(true);

    expect(
      moveTree.materialize({
        actionId: 'place-piece',
        selectedEntityId: reservePieceId,
        destinationZoneId: boardRightZoneId,
      }),
    ).toEqual([
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: reservePieceId,
          fromZoneId: reserveZoneId,
          toZoneId: boardRightZoneId,
          position: 0,
        },
        source: {
          type: 'player',
          playerId: playerOneId,
        },
        timestamp: 9,
      },
    ]);
  });

  it('builds card play actions from the active player visible hand only', () => {
    const playerOneTree = generateLegalMoveTree(createBaseState(), {
      playerId: playerOneId,
      definitions: [cardPlayDefinition],
    });

    expect(playerOneTree.availableActions).toHaveLength(1);
    expect(playerOneTree.availableActions[0]?.interactableEntities).toEqual([handCardId]);
    expect(playerOneTree.materialize({
      actionId: 'play-card',
      selectedEntityId: handCardId,
      destinationZoneId: boardRightZoneId,
    })).toEqual([
      {
        type: 'MOVE_ENTITY',
        payload: {
          entityId: handCardId,
          fromZoneId: handZoneId,
          toZoneId: boardRightZoneId,
          position: 0,
        },
        source: {
          type: 'player',
          playerId: playerOneId,
        },
        timestamp: 9,
      },
      {
        type: 'REVEAL_ENTITY',
        payload: {
          entityId: handCardId,
        },
        source: {
          type: 'player',
          playerId: playerOneId,
        },
        timestamp: 9,
      },
    ]);

    const playerTwoActiveState = setActivePlayer(createBaseState(), playerTwoId);
    const playerTwoTree = generateLegalMoveTree(playerTwoActiveState, {
      playerId: playerTwoId,
      definitions: [cardPlayDefinition],
    });

    expect(playerTwoTree.availableActions).toEqual([]);
    expect(playerTwoTree.visibleState.zones[handZoneId]?.entityIds).toEqual([]);
  });

  it('turns pending triggered decisions into follow-up choice actions', () => {
    const state: GameState = {
      ...createBaseState(),
      pendingDecisions: [
        {
          id: 'decision_trigger',
          playerId: playerOneId,
          type: 'choose_option',
          prompt: 'Choose how to resolve the trigger.',
          options: [
            {
              id: 'gain_resource',
              label: 'Gain 1 mana',
            },
            {
              id: 'draw_card',
              label: 'Draw a card',
            },
          ],
          minChoices: 1,
          maxChoices: 1,
        },
      ],
    };

    const moveTree = generateLegalMoveTree(state, {
      playerId: playerOneId,
      definitions: [boardPlacementDefinition],
    });

    expect(moveTree.pendingDecision?.id).toBe('decision_trigger');
    expect(moveTree.availableActions).toHaveLength(1);
    expect(moveTree.availableActions[0]?.type).toBe('CHOOSE_OPTION');
    expect(moveTree.availableActions[0]?.subChoices?.[0]?.options.map((option) => option.id)).toEqual([
      'gain_resource',
      'draw_card',
    ]);
    expect(moveTree.canPass).toBe(false);
    expect(moveTree.canCancel).toBe(true);

    expect(moveTree.materialize({
      actionId: 'decision:decision_trigger:resolve',
      subChoiceSelections: {
        'decision-choice': 'draw_card',
      },
    })).toEqual([
      {
        type: 'CHOOSE_OPTION',
        payload: {
          decisionId: 'decision_trigger',
          chosenOptionIds: ['draw_card'],
        },
        source: {
          type: 'player',
          playerId: playerOneId,
        },
        timestamp: 9,
      },
    ]);
  });

  it('adds a pass action while priority is open for the acting player', () => {
    const state: GameState = {
      ...createBaseState(),
      priorityWindow: {
        isOpen: true,
        currentPlayerId: playerOneId,
        passedPlayerIds: [],
        openedBy: 'stack',
      },
    };

    const moveTree = generateLegalMoveTree(state, {
      playerId: playerOneId,
      definitions: [],
    });

    expect(moveTree.canPass).toBe(true);
    expect(moveTree.availableActions.map((action) => action.id)).toEqual(['priority:pass']);
    expect(moveTree.materialize({
      actionId: 'priority:pass',
    })).toEqual([
      {
        type: 'PASS_PRIORITY',
        payload: {
          playerId: playerOneId,
        },
        source: {
          type: 'player',
          playerId: playerOneId,
        },
        timestamp: 9,
      },
    ]);
  });
});
