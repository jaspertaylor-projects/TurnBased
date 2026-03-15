import { describe, expect, it } from 'vitest';
import {
  applyActionWithTriggers,
  type GameState,
} from '@turnbased/engine-core';
import {
  createEntityId,
  createGameId,
  createPlayerId,
  createZoneId,
  ParticipantRole,
  Visibility,
} from '@turnbased/shared-types';
import {
  compileRulebook,
  compileTriggerRules,
  createRuleHookRegistry,
  defineRulebook,
  evaluateScoringRules,
  evaluateWinConditions,
  evaluateRuleExpression,
  parseRuleExpression,
  resolveVisibilityDefaults,
} from './index';
import type { RulebookDefinition } from './index';

const playerOneId = createPlayerId('player_one');
const playerTwoId = createPlayerId('player_two');
const handOneId = createZoneId('hand_one');
const handTwoId = createZoneId('hand_two');
const boardZoneId = createZoneId('board');
const crownEntityId = createEntityId('crown');

function createBaseState(): GameState {
  return {
    gameId: createGameId('game_sdk_rules'),
    version: 0,
    entities: {
      [crownEntityId]: {
        id: crownEntityId,
        type: 'token',
        componentType: 'token',
        zoneId: boardZoneId,
        ownerId: playerOneId,
        controllerId: playerOneId,
        position: 0,
        faceUp: true,
        properties: {
          crown: true,
        },
        tags: ['objective', 'crown'],
      },
    },
    zones: {
      [handOneId]: {
        id: handOneId,
        type: 'hand',
        name: 'Hand One',
        ownerId: playerOneId,
        entityIds: [],
        maxCapacity: null,
        visibility: {
          defaultVisibility: Visibility.Private,
          overrides: {},
        },
        properties: {},
      },
      [handTwoId]: {
        id: handTwoId,
        type: 'hand',
        name: 'Hand Two',
        ownerId: playerTwoId,
        entityIds: [],
        maxCapacity: null,
        visibility: {
          defaultVisibility: Visibility.Private,
          overrides: {},
        },
        properties: {},
      },
      [boardZoneId]: {
        id: boardZoneId,
        type: 'board',
        name: 'Board',
        ownerId: null,
        entityIds: [crownEntityId],
        maxCapacity: null,
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
        score: 7,
        resources: {
          gold: 2,
        },
        properties: {
          crowned: true,
        },
      },
      [playerTwoId]: {
        id: playerTwoId,
        displayName: 'Player Two',
        role: ParticipantRole.Player,
        isActive: false,
        isEliminated: false,
        score: 4,
        resources: {
          gold: 1,
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
      currentStep: 'play',
      phaseIndex: 0,
      stepIndex: 0,
      basePhases: [],
      phases: [],
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
  };
}

describe('engine-sdk expression system', () => {
  it('parses member access and evaluates arithmetic/logical precedence', () => {
    const runtime = createBaseState();
    const ast = parseRuleExpression(
      'state.players[player.id].score + 2 * 3 >= 13 && !player.isEliminated',
    );

    expect(ast.kind).toBe('binary');
    expect(
      evaluateRuleExpression(
        'state.players[player.id].score + 2 * 3 >= 13 && !player.isEliminated',
        {
          state: runtime,
          player: runtime.players[playerOneId],
        },
      ),
    ).toBe(true);
  });
});

describe('engine-sdk rulebook compilation', () => {
  it('materializes setup rules, static turn structure, and trigger registrations', () => {
    const state = createBaseState();
    const rulebook: RulebookDefinition = defineRulebook({
      setup: [
        {
          id: 'starting_gold',
          order: 1,
          players: {
            scope: 'all',
          },
          actions: [
            {
              type: 'ADD_RESOURCE',
              payload: {
                playerId: {
                  kind: 'expression',
                  expression: 'player.id',
                },
                resource: 'gold',
                amount: 3,
              },
            },
          ],
        },
      ],
      turnStructure: {
        phases: [
          {
            name: 'draw',
            onEnter: [
              {
                type: 'ADVANCE_STEP',
                payload: {},
              },
            ],
            steps: [
              {
                name: 'draw_cards',
                autoAdvance: true,
                requiresPlayerAction: false,
              },
            ],
          },
          {
            name: 'main',
            steps: [
              {
                name: 'play',
                autoAdvance: false,
                requiresPlayerAction: true,
              },
            ],
          },
        ],
        priorityPolicy: {
          mode: 'limited',
          responseEvents: ['TURN_STARTED'],
          autoPassEnabled: true,
        },
      },
      triggers: [
        {
          id: 'draw_on_turn_start',
          type: 'automatic',
          event: 'TURN_STARTED',
          controller: {
            scope: 'all',
          },
          when: 'event.payload.playerId == controllerId',
          actions: [
            {
              type: 'ADD_RESOURCE',
              payload: {
                playerId: {
                  kind: 'expression',
                  expression: 'event.payload.playerId',
                },
                resource: 'gold',
                amount: 1,
              },
            },
          ],
        },
      ],
    });

    const compiled = compileRulebook(rulebook, {
      state,
      timestampStart: 10,
    });

    expect(compiled.setupActions).toHaveLength(2);
    expect(compiled.setupEvaluations.map((item) => item.playerId)).toEqual([
      playerOneId,
      playerTwoId,
    ]);
    expect(compiled.phases.map((phase) => phase.name)).toEqual(['draw', 'main']);
    expect(compiled.priorityPolicy?.mode).toBe('limited');
    expect(compiled.triggers).toHaveLength(2);
  });

  it('compiles trigger rules into engine-core registrations that execute deterministically', () => {
    const state = createBaseState();
    const triggers = compileTriggerRules(
      [
        {
          id: 'turn_income',
          type: 'automatic',
          event: 'TURN_STARTED',
          controller: {
            scope: 'all',
          },
          when: 'event.payload.playerId == controllerId',
          actions: [
            {
              type: 'ADD_RESOURCE',
              payload: {
                playerId: {
                  kind: 'expression',
                  expression: 'event.payload.playerId',
                },
                resource: 'gold',
                amount: 2,
              },
            },
          ],
        },
      ],
      {
        state,
      },
    );

    const result = applyActionWithTriggers(
      state,
      {
        type: 'END_TURN',
        payload: {},
        source: {
          type: 'player',
          playerId: playerOneId,
        },
        timestamp: 20,
      },
      {
        triggers,
      },
    );

    expect(result.state.turnState.activePlayerId).toBe(playerTwoId);
    expect(result.state.players[playerTwoId].resources.gold).toBe(3);
  });
});

describe('engine-sdk evaluation helpers', () => {
  it('evaluates scoring rules, win conditions, and visibility defaults with hooks', () => {
    const state = createBaseState();
    const hooks = createRuleHookRegistry({
      scoring: [
        {
          name: 'crown_bonus',
          computeScore: ({ player }) => (player.properties.crowned ? 5 : 0),
        },
      ],
      winConditions: [
        {
          name: 'score_threshold',
          evaluate: ({ state: runtimeState }) => {
            const winner = Object.values(runtimeState.players).find((player) => player.score >= 7);
            if (!winner) {
              return null;
            }

            return {
              matched: true,
              winnerId: winner.id,
            };
          },
        },
      ],
    });

    const scoring = evaluateScoringRules(
      [
        {
          id: 'score_plus_gold',
          players: {
            scope: 'all',
          },
          value: 'player.score + player.resources.gold',
        },
        {
          id: 'hook_bonus',
          players: {
            scope: 'all',
          },
          scoringHook: {
            name: 'crown_bonus',
          },
        },
      ],
      {
        state,
        hooks,
      },
    );

    const win = evaluateWinConditions(
      [
        {
          id: 'hooked_win',
          priority: 10,
          winConditionHook: {
            name: 'score_threshold',
          },
        },
      ],
      {
        state,
        hooks,
      },
    );

    const visibility = resolveVisibilityDefaults(
      [
        {
          id: 'private_hands',
          target: 'zone',
          visibility: Visibility.Private,
          match: {
            types: ['hand'],
          },
        },
        {
          id: 'public_objectives',
          target: 'entity',
          visibility: Visibility.Public,
          match: {
            tags: ['objective'],
          },
        },
      ],
      {
        state,
        hooks,
        viewerId: playerOneId,
      },
    );

    expect(scoring.totals[playerOneId]).toBe(14);
    expect(scoring.totals[playerTwoId]).toBe(5);
    expect(win?.winnerId).toBe(playerOneId);
    expect(visibility.zoneVisibility[handOneId]).toBe(true);
    expect(visibility.zoneVisibility[handTwoId]).toBe(false);
    expect(visibility.entityVisibility[crownEntityId]).toBe(true);
  });
});
