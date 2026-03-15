import { describe, expect, it } from 'vitest';
import {
  createEntityId,
  createGameId,
  createPlayerId,
  createZoneId,
  ParticipantRole,
  Visibility,
} from '@turnbased/shared-types';
import type { GameState, LegalMoveDefinition } from '@turnbased/engine-core';
import { generateLegalMoveTree } from '@turnbased/engine-core';

import {
  createPopupChoosers,
  createUIAffordanceState,
  getDestinationAffordance,
  getItemAffordance,
} from './index';

const gameId = createGameId('game_ui_affordances');
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
    version: 11,
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
      seed: 9,
      callCount: 0,
    },
    status: 'playing',
    winner: null,
    actionLog: [],
    componentInstances: {},
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
      buildCanonicalActions: ({ request, resolveEntityId }) => [
        {
          type: 'MOVE_ENTITY',
          payload: {
            entityId: createEntityId(resolveEntityId(request.selectedEntityId ?? reservePieceId)),
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
      ],
    };
  },
};

const stancePlacementDefinition: LegalMoveDefinition = {
  id: 'stance-placement',
  generate: ({ state }) => {
    const reserveZone = state.zones[reserveZoneId];

    if (!reserveZone || reserveZone.entityIds.length === 0) {
      return [];
    }

    return {
      id: 'place-piece-with-stance',
      type: 'MOVE_ENTITY',
      displayName: 'Deploy with stance',
      description: 'Choose a stance before committing the placement.',
      interactableEntities: reserveZone.entityIds,
      validDestinations: [boardRightZoneId],
      tags: ['board', 'placement', 'stance'],
      subChoices: [
        {
          id: 'stance',
          type: 'select_option',
          prompt: 'Choose the piece stance.',
          options: [
            {
              id: 'aggressive',
              label: 'Aggressive',
            },
            {
              id: 'defensive',
              label: 'Defensive',
            },
          ],
          minChoices: 1,
          maxChoices: 1,
        },
      ],
      canonicalActions: [],
    };
  },
};

describe('engine-ui affordance adapters', () => {
  it('builds item-first affordances for drag and drop without custom UI logic', () => {
    const moveTree = generateLegalMoveTree(createBaseState(), {
      playerId: playerOneId,
      definitions: [boardPlacementDefinition],
    });

    const affordanceState = createUIAffordanceState(moveTree, {
      selection: {
        selectedEntityId: reservePieceId,
        dragEntityId: reservePieceId,
      },
    });
    const itemAffordance = getItemAffordance(moveTree, reservePieceId, {
      selection: {
        selectedEntityId: reservePieceId,
        dragEntityId: reservePieceId,
      },
    });

    expect(affordanceState.interactableEntities).toEqual([reservePieceId]);
    expect(affordanceState.validDestinations.map((destination) => destination.zoneId)).toEqual([
      boardRightZoneId,
    ]);
    expect(affordanceState.zoneStates[boardRightZoneId]?.dropTarget).toBe(true);
    expect(affordanceState.entityStates[reservePieceId]?.dragSource).toBe(true);
    expect(itemAffordance?.destinationZoneIds).toEqual([boardRightZoneId]);
    expect(itemAffordance?.menuActions[0]).toMatchObject({
      id: 'place-piece',
      enabled: true,
      ready: true,
      kind: 'selection',
    });
  });

  it('builds destination-first affordances that point back to valid source entities', () => {
    const moveTree = generateLegalMoveTree(createBaseState(), {
      playerId: playerOneId,
      definitions: [boardPlacementDefinition],
    });

    const affordanceState = createUIAffordanceState(moveTree, {
      selection: {
        selectedZoneId: boardRightZoneId,
      },
    });
    const destinationAffordance = getDestinationAffordance(moveTree, boardRightZoneId, {
      selection: {
        selectedZoneId: boardRightZoneId,
      },
    });

    expect(affordanceState.interactableZones).toEqual([boardRightZoneId]);
    expect(affordanceState.interactableEntities).toEqual([reservePieceId]);
    expect(affordanceState.zoneStates[boardRightZoneId]?.selected).toBe(true);
    expect(affordanceState.entityStates[reservePieceId]?.interactable).toBe(true);
    expect(destinationAffordance?.sourceEntityIds).toEqual([reservePieceId]);
    expect(destinationAffordance?.menuActions[0]).toMatchObject({
      id: 'place-piece',
      enabled: true,
    });
  });

  it('derives popup chooser contracts for action sub-choices when an action is selected', () => {
    const moveTree = generateLegalMoveTree(createBaseState(), {
      playerId: playerOneId,
      definitions: [stancePlacementDefinition],
    });

    const choosers = createPopupChoosers(moveTree, {
      selection: {
        selectedActionId: 'place-piece-with-stance',
        selectedEntityId: reservePieceId,
        selectedZoneId: boardRightZoneId,
      },
    });
    const affordanceState = createUIAffordanceState(moveTree, {
      selection: {
        selectedActionId: 'place-piece-with-stance',
        selectedEntityId: reservePieceId,
        selectedZoneId: boardRightZoneId,
      },
    });

    expect(choosers).toHaveLength(1);
    expect(choosers[0]).toMatchObject({
      actionId: 'place-piece-with-stance',
      subChoiceId: 'stance',
      kind: 'sub_choice',
      selectionMode: 'single',
      visible: true,
    });
    expect(choosers[0]?.options.map((option) => option.id)).toEqual([
      'aggressive',
      'defensive',
    ]);
    expect(affordanceState.availableActions[0]?.chooserIds).toEqual([
      'place-piece-with-stance:stance',
    ]);
  });

  it('turns pending decisions into modal-ready chooser state with keyboard hints', () => {
    const moveTree = generateLegalMoveTree(
      {
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
      },
      {
        playerId: playerOneId,
        definitions: [boardPlacementDefinition],
      },
    );

    const affordanceState = createUIAffordanceState(moveTree);

    expect(affordanceState.pendingDecision).toMatchObject({
      id: 'decision_trigger',
      actionIds: ['decision:decision_trigger:resolve'],
      chooserIds: ['decision:decision_trigger:resolve:decision-choice'],
    });
    expect(affordanceState.popupChoosers[0]).toMatchObject({
      kind: 'pending_decision',
      visible: true,
      prompt: 'Choose how to resolve the trigger.',
    });
    expect(affordanceState.availableActions[0]?.kind).toBe('decision');
    expect(affordanceState.keyboardShortcuts.some((shortcut) => shortcut.key === 'Escape')).toBe(
      true,
    );
  });
});
