import { describe, expect, it } from 'vitest';
import {
  createEntityId,
  createGameId,
  createPlayerId,
  createZoneId,
  ParticipantRole,
  Visibility,
} from '@turnbased/shared-types';

import type { CanonicalAction, GameState } from '../index';
import { hashGameState, reduceGameState, replayCanonicalActions } from '../index';

const gameId = createGameId('game_demo');
const playerOneId = createPlayerId('player_1');
const playerTwoId = createPlayerId('player_2');
const playerThreeId = createPlayerId('player_3');
const deckZoneId = createZoneId('zone_deck');
const handZoneId = createZoneId('zone_hand');
const entityAId = createEntityId('ent_a');
const entityBId = createEntityId('ent_b');
const entityCId = createEntityId('ent_c');
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
    version: 0,
    entities: {
      [entityAId]: {
        id: entityAId,
        type: 'card',
        componentType: 'card.basic',
        zoneId: deckZoneId,
        ownerId: playerOneId,
        controllerId: playerOneId,
        position: 0,
        faceUp: false,
        properties: {},
        tags: [],
      },
      [entityBId]: {
        id: entityBId,
        type: 'card',
        componentType: 'card.basic',
        zoneId: deckZoneId,
        ownerId: playerOneId,
        controllerId: playerOneId,
        position: 1,
        faceUp: false,
        properties: {},
        tags: [],
      },
      [entityCId]: {
        id: entityCId,
        type: 'card',
        componentType: 'card.basic',
        zoneId: deckZoneId,
        ownerId: playerOneId,
        controllerId: playerOneId,
        position: 2,
        faceUp: false,
        properties: {},
        tags: [],
      },
    },
    zones: {
      [deckZoneId]: {
        id: deckZoneId,
        type: 'deck',
        name: 'Deck',
        ownerId: playerOneId,
        entityIds: [entityAId, entityBId, entityCId],
        maxCapacity: null,
        visibility: {
          defaultVisibility: Visibility.Private,
          overrides: {},
        },
        properties: {},
      },
      [handZoneId]: {
        id: handZoneId,
        type: 'hand',
        name: 'Hand',
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
        score: 0,
        resources: {},
        properties: {},
      },
      [playerTwoId]: {
        id: playerTwoId,
        displayName: 'Player Two',
        role: ParticipantRole.Player,
        isActive: false,
        isEliminated: false,
        score: 0,
        resources: {},
        properties: {},
      },
      [playerThreeId]: {
        id: playerThreeId,
        displayName: 'Player Three',
        role: ParticipantRole.Player,
        isActive: false,
        isEliminated: false,
        score: 0,
        resources: {},
        properties: {},
      },
    },
    playerOrder: [playerOneId, playerTwoId, playerThreeId],
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
      seed: 42,
      callCount: 0,
    },
    status: 'playing',
    winner: null,
    actionLog: [],
    componentInstances: {},
  };
}

describe('deterministic reducer core', () => {
  it('moves entities between zones and records the action log', () => {
    const nextState = reduceGameState(createBaseState(), {
      type: 'MOVE_ENTITY',
      payload: {
        entityId: entityAId,
        fromZoneId: deckZoneId,
        toZoneId: handZoneId,
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 1,
    });

    expect(nextState.version).toBe(1);
    expect(nextState.zones[deckZoneId].entityIds).toEqual([entityBId, entityCId]);
    expect(nextState.zones[handZoneId].entityIds).toEqual([entityAId]);
    expect(nextState.actionLog).toHaveLength(1);
  });

  it('replays shuffle actions deterministically for identical seeds', () => {
    const actions = [
      {
        type: 'SHUFFLE_ZONE',
        payload: {
          zoneId: deckZoneId,
        },
        source: {
          type: 'system',
        },
        timestamp: 1,
      } as CanonicalAction,
      {
        type: 'DRAW_FROM_ZONE',
        payload: {
          sourceZoneId: deckZoneId,
          targetZoneId: handZoneId,
          count: 2,
        },
        source: {
          type: 'player',
          playerId: playerOneId,
        },
        timestamp: 2,
      } as CanonicalAction,
    ];

    const firstReplay = replayCanonicalActions(createBaseState(), actions);
    const secondReplay = replayCanonicalActions(createBaseState(), actions);

    expect(firstReplay).toEqual(secondReplay);
    expect(hashGameState(firstReplay)).toBe(hashGameState(secondReplay));
  });

  it('processes queued extra turns before normal order advances', () => {
    const withExtraTurn = reduceGameState(createBaseState(), {
      type: 'ADD_EXTRA_TURN',
      payload: {
        playerId: playerOneId,
      },
      source: {
        type: 'system',
      },
      timestamp: 3,
    });

    const nextState = reduceGameState(withExtraTurn, {
      type: 'END_TURN',
      payload: {},
      source: {
        type: 'system',
      },
      timestamp: 4,
    });

    expect(nextState.turnState.activePlayerId).toBe(playerOneId);
    expect(nextState.turnState.currentTurnKind).toBe('extra');
    expect(nextState.turnState.roundNumber).toBe(1);
    expect(nextState.turnState.completedPlayerIdsThisRound).toEqual([playerOneId]);
  });

  it('consumes skipped players when selecting the next normal turn', () => {
    const withSkip = reduceGameState(createBaseState(), {
      type: 'SKIP_TURN',
      payload: {
        playerId: playerTwoId,
      },
      source: {
        type: 'system',
      },
      timestamp: 5,
    });

    const nextState = reduceGameState(withSkip, {
      type: 'END_TURN',
      payload: {},
      source: {
        type: 'system',
      },
      timestamp: 6,
    });

    expect(nextState.turnState.activePlayerId).toBe(playerThreeId);
    expect(nextState.turnState.skippedPlayers).toEqual([]);
    expect(nextState.turnState.currentTurnKind).toBe('normal');
  });

  it('wraps to a new round when a turn-order reversal revisits a completed player', () => {
    let nextState = reduceGameState(createBaseState(), {
      type: 'END_TURN',
      payload: {},
      source: {
        type: 'system',
      },
      timestamp: 7,
    });

    nextState = reduceGameState(nextState, {
      type: 'REVERSE_TURN_ORDER',
      payload: {},
      source: {
        type: 'system',
      },
      timestamp: 8,
    });

    nextState = reduceGameState(nextState, {
      type: 'END_TURN',
      payload: {},
      source: {
        type: 'system',
      },
      timestamp: 9,
    });

    expect(nextState.turnState.activePlayerId).toBe(playerOneId);
    expect(nextState.turnState.roundNumber).toBe(2);
    expect(nextState.turnState.completedPlayerIdsThisRound).toEqual([]);
  });

  it('keeps inserted steps and phases scoped to the current turn', () => {
    let nextState = reduceGameState(createBaseState(), {
      type: 'INSERT_STEP',
      payload: {
        step: {
          name: 'bonus_action',
          autoAdvance: false,
          requiresPlayerAction: true,
        },
      },
      source: {
        type: 'system',
      },
      timestamp: 10,
    });

    nextState = reduceGameState(nextState, {
      type: 'INSERT_PHASE',
      payload: {
        phase: {
          name: 'cleanup',
          steps: [
            {
              name: 'discard',
              autoAdvance: false,
              requiresPlayerAction: true,
            },
          ],
        },
      },
      source: {
        type: 'system',
      },
      timestamp: 11,
    });

    expect(nextState.turnState.phases.map((phase) => phase.name)).toEqual(['main', 'cleanup']);
    expect(nextState.turnState.phases[0]?.steps.map((step) => step.name)).toEqual([
      'action',
      'bonus_action',
    ]);

    nextState = reduceGameState(nextState, {
      type: 'ADVANCE_STEP',
      payload: {},
      source: {
        type: 'system',
      },
      timestamp: 12,
    });
    expect(nextState.turnState.currentStep).toBe('bonus_action');

    nextState = reduceGameState(nextState, {
      type: 'ADVANCE_STEP',
      payload: {},
      source: {
        type: 'system',
      },
      timestamp: 13,
    });
    expect(nextState.turnState.currentPhase).toBe('cleanup');

    nextState = reduceGameState(nextState, {
      type: 'END_TURN',
      payload: {},
      source: {
        type: 'system',
      },
      timestamp: 14,
    });

    expect(nextState.turnState.activePlayerId).toBe(playerTwoId);
    expect(nextState.turnState.currentPhase).toBe('main');
    expect(nextState.turnState.currentStep).toBe('action');
    expect(nextState.turnState.phases.map((phase) => phase.name)).toEqual(['main']);
    expect(nextState.turnState.phases[0]?.steps.map((step) => step.name)).toEqual(['action']);
  });
});
