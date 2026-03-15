import { describe, expect, it } from 'vitest';
import {
  createActionId,
  createEntityId,
  createGameId,
  createPlayerId,
  createZoneId,
  ParticipantRole,
  Visibility,
} from '@turnbased/shared-types';

import type { ActionLogEntry, GameState, VisibilityProjectionOptions } from '../index';
import {
  canViewerSeeEntityDetails,
  canViewerSeeZoneContents,
  projectGameStateForAI,
  projectGameStateForPlayer,
  projectGameStateForViewer,
} from '../index';

const gameId = createGameId('game_visibility');
const playerOneId = createPlayerId('player_1');
const playerTwoId = createPlayerId('player_2');
const boardZoneId = createZoneId('zone_board');
const handZoneId = createZoneId('zone_hand');
const deckZoneId = createZoneId('zone_deck');
const facedownBoardEntityId = createEntityId('ent_board_hidden');
const handEntityId = createEntityId('ent_hand_secret');
const publicBoardEntityId = createEntityId('ent_board_public');

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

const visibilityOptions: VisibilityProjectionOptions = {
  fieldPolicies: {
    entityProperties: ({ item }) => {
      if (item.id === publicBoardEntityId) {
        return {
          power: 'public',
          secretCode: 'owner_or_controller',
        };
      }

      return {
        power: 'public',
        secretCode: 'owner_or_controller',
      };
    },
    playerProperties: {
      publicTitle: 'public',
      secretPlan: 'owner',
    },
    pendingDecisionMetadata: {
      publicHint: 'public',
      secretReason: 'owner',
    },
  },
};

function createActionLogEntry(
  id: string,
  type: ActionLogEntry['type'],
  payload: Record<string, unknown>,
): ActionLogEntry {
  return {
    id: createActionId(id),
    type,
    payload,
    source: {
      type: 'system',
    },
    timestamp: Number(id.replace(/\D/g, '')) || 1,
  } as ActionLogEntry;
}

function createBaseState(): GameState {
  return {
    gameId,
    version: 6,
    entities: {
      [facedownBoardEntityId]: {
        id: facedownBoardEntityId,
        type: 'card',
        componentType: 'card.secret',
        zoneId: boardZoneId,
        ownerId: playerOneId,
        controllerId: playerOneId,
        position: 0,
        faceUp: false,
        properties: {
          power: 2,
          secretCode: 'shadow',
        },
        tags: ['board', 'trap'],
      },
      [publicBoardEntityId]: {
        id: publicBoardEntityId,
        type: 'piece',
        componentType: 'piece.knight',
        zoneId: boardZoneId,
        ownerId: playerOneId,
        controllerId: playerOneId,
        position: 1,
        faceUp: true,
        properties: {
          power: 5,
          secretCode: 'lance',
        },
        tags: ['board', 'unit'],
      },
      [handEntityId]: {
        id: handEntityId,
        type: 'card',
        componentType: 'card.secret',
        zoneId: handZoneId,
        ownerId: playerOneId,
        controllerId: playerOneId,
        position: 0,
        faceUp: false,
        properties: {
          power: 7,
          secretCode: 'alpha',
        },
        tags: ['hand'],
      },
    },
    zones: {
      [boardZoneId]: {
        id: boardZoneId,
        type: 'board',
        name: 'Board',
        ownerId: null,
        entityIds: [facedownBoardEntityId, publicBoardEntityId],
        maxCapacity: null,
        visibility: {
          defaultVisibility: Visibility.Public,
          overrides: {},
        },
        properties: {
          terrain: 'forest',
        },
      },
      [handZoneId]: {
        id: handZoneId,
        type: 'hand',
        name: 'Hand',
        ownerId: playerOneId,
        entityIds: [handEntityId],
        maxCapacity: null,
        visibility: {
          defaultVisibility: Visibility.Private,
          overrides: {},
        },
        properties: {
          drawLimit: 7,
        },
      },
      [deckZoneId]: {
        id: deckZoneId,
        type: 'deck',
        name: 'Deck',
        ownerId: playerOneId,
        entityIds: [],
        maxCapacity: null,
        visibility: {
          defaultVisibility: Visibility.Private,
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
        score: 3,
        resources: {
          gold: 2,
        },
        properties: {
          publicTitle: 'Captain',
          secretPlan: 'ambush',
        },
      },
      [playerTwoId]: {
        id: playerTwoId,
        displayName: 'Player Two',
        role: ParticipantRole.Player,
        isActive: false,
        isEliminated: false,
        score: 1,
        resources: {
          gold: 1,
        },
        properties: {
          publicTitle: 'Scout',
          secretPlan: 'defend',
        },
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
    pendingDecisions: [
      {
        id: 'decision_secret',
        playerId: playerOneId,
        type: 'choose_option',
        prompt: 'Pick a hidden tactic',
        options: [
          {
            id: 'opt_a',
            label: 'Ambush',
          },
        ],
        minChoices: 1,
        maxChoices: 1,
        metadata: {
          publicHint: 'Choose one tactic',
          secretReason: 'Triggered by hidden hand card',
        },
      },
    ],
    stack: [
      {
        id: 'stack_secret_move',
        source: 'trap_trigger',
        effect: {
          type: 'MOVE_ENTITY',
          payload: {
            entityId: handEntityId,
            fromZoneId: handZoneId,
            toZoneId: boardZoneId,
          },
          source: {
            type: 'trigger',
          },
          timestamp: 3,
        },
        controllerId: playerOneId,
        priority: 1,
        isResolved: false,
      },
    ],
    priorityWindow: {
      isOpen: true,
      currentPlayerId: playerTwoId,
      passedPlayerIds: [],
      openedBy: 'action',
    },
    visibilityMap: {
      entityVisibility: {},
      zoneVisibility: {},
    },
    randomState: {
      seed: 12,
      callCount: 0,
    },
    status: 'playing',
    winner: null,
    actionLog: [
      createActionLogEntry('act_1', 'MOVE_ENTITY', {
        entityId: handEntityId,
        fromZoneId: deckZoneId,
        toZoneId: handZoneId,
      }),
      createActionLogEntry('act_2', 'PROMPT_PLAYER', {
        decision: {
          id: 'decision_secret',
          playerId: playerOneId,
          prompt: 'Pick a hidden tactic',
        },
      }),
    ],
    componentInstances: {},
  };
}

describe('visibility projection', () => {
  it('projects a safe opponent view with hidden zones, face-down entities, and redacted logs', () => {
    const state = createBaseState();
    const view = projectGameStateForPlayer(state, playerTwoId, visibilityOptions);

    expect(canViewerSeeZoneContents(state, handZoneId, playerTwoId)).toBe(false);
    expect(canViewerSeeEntityDetails(state, handEntityId, playerTwoId)).toBe(false);

    expect(view.zones[handZoneId].isVisibleToViewer).toBe(false);
    expect(view.zones[handZoneId].entityIds).toEqual([]);
    expect(view.zones[handZoneId].hiddenEntityCount).toBe(1);
    expect(view.entities[handEntityId]).toBeUndefined();

    expect(view.zones[boardZoneId].entityIds).toEqual([
      'hidden:zone_board:0',
      publicBoardEntityId,
    ]);
    expect(view.entities['hidden:zone_board:0']).toMatchObject({
      visibility: 'presence_only',
      type: null,
      componentType: null,
    });
    expect(view.entities[publicBoardEntityId].properties).toEqual({
      power: 5,
    });

    expect(view.players[playerOneId].properties).toEqual({
      publicTitle: 'Captain',
    });
    expect(view.pendingDecisions).toEqual([]);

    expect(view.actionLog[0].payload).toEqual({
      entityId: '[hidden-entity]',
      fromZoneId: '[hidden-zone]',
      toZoneId: '[hidden-zone]',
    });
    expect(view.actionLog[0].redacted).toBe(true);
    expect(view.actionLog[1].payload).toEqual({
      decision: '[hidden-decision]',
    });
    expect(view.stack[0].effect.payload).toEqual({
      entityId: '[hidden-entity]',
      fromZoneId: '[hidden-zone]',
      toZoneId: boardZoneId,
    });
  });

  it('preserves private information for the owning player and AI seat adapters', () => {
    const state = createBaseState();
    const playerView = projectGameStateForPlayer(state, playerOneId, visibilityOptions);
    const aiView = projectGameStateForAI(state, playerOneId, visibilityOptions);

    expect(playerView.entities[handEntityId].properties).toEqual({
      power: 7,
      secretCode: 'alpha',
    });
    expect(playerView.players[playerOneId].properties).toEqual({
      publicTitle: 'Captain',
      secretPlan: 'ambush',
    });
    expect(playerView.pendingDecisions[0].metadata).toEqual({
      publicHint: 'Choose one tactic',
      secretReason: 'Triggered by hidden hand card',
    });
    expect(playerView.actionLog[0].payload).toEqual({
      entityId: handEntityId,
      fromZoneId: deckZoneId,
      toZoneId: handZoneId,
    });

    expect(aiView.viewer.role).toBe(ParticipantRole.AI);
    expect(aiView.entities).toEqual(playerView.entities);
    expect(aiView.pendingDecisions).toEqual(playerView.pendingDecisions);
    expect(aiView.actionLog).toEqual(playerView.actionLog);
  });

  it('supports public-only and omniscient spectator policies', () => {
    const state = createBaseState();
    const publicSpectatorView = projectGameStateForViewer(
      state,
      {
        viewerId: null,
        role: ParticipantRole.Spectator,
      },
      visibilityOptions,
    );
    const omniscientSpectatorView = projectGameStateForViewer(
      state,
      {
        viewerId: null,
        role: ParticipantRole.Spectator,
      },
      {
        ...visibilityOptions,
        spectatorPolicy: 'omniscient',
      },
    );

    expect(publicSpectatorView.zones[handZoneId].isVisibleToViewer).toBe(false);
    expect(publicSpectatorView.pendingDecisions).toEqual([]);
    expect(publicSpectatorView.entities[handEntityId]).toBeUndefined();

    expect(omniscientSpectatorView.zones[handZoneId].isVisibleToViewer).toBe(true);
    expect(omniscientSpectatorView.entities[handEntityId].properties).toEqual({
      power: 7,
      secretCode: 'alpha',
    });
    expect(omniscientSpectatorView.pendingDecisions).toHaveLength(1);
    expect(omniscientSpectatorView.actionLog[0].payload).toEqual({
      entityId: handEntityId,
      fromZoneId: deckZoneId,
      toZoneId: handZoneId,
    });
  });
});
