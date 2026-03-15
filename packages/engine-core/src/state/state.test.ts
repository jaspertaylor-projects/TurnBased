import { describe, expect, it } from 'vitest';

import { derivedViewSnapshotSchema, gameStateSchema } from './index';

describe('state model schemas', () => {
  it('accepts a minimal valid game state', () => {
    const result = gameStateSchema.parse({
      gameId: 'game_demo',
      version: 0,
      entities: {},
      zones: {},
      players: {
        player_1: {
          id: 'player_1',
          displayName: 'Player One',
          role: 'player',
          isActive: true,
          isEliminated: false,
          score: 0,
          resources: {},
          properties: {},
        },
      },
      playerOrder: ['player_1'],
      turnState: {
        roundNumber: 1,
        turnNumber: 1,
        activePlayerId: 'player_1',
        currentPhase: 'main',
        currentStep: 'action',
        phaseIndex: 0,
        stepIndex: 0,
        basePhases: [
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
        ],
        phases: [
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
        ],
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
        seed: 123,
        callCount: 0,
      },
      status: 'playing',
      winner: null,
      actionLog: [],
      componentInstances: {},
    });

    expect(result.turnState.activePlayerId).toBe('player_1');
  });

  it('accepts viewer-scoped derived view snapshots', () => {
    const result = derivedViewSnapshotSchema.parse({
      name: 'territory_control',
      viewerId: 'player_1',
      data: {
        controlledSpaces: 4,
      },
    });

    expect(result.name).toBe('territory_control');
  });
});
