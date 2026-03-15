import { describe, expect, it } from 'vitest';
import {
  createEntityId,
  createGameId,
  createPlayerId,
  createTriggerId,
  createZoneId,
  ParticipantRole,
  Visibility,
} from '@turnbased/shared-types';

import type { GameState, TriggerRegistration } from '../index';
import {
  applyActionWithTriggers,
  resolveStackWithTriggers,
} from '../index';

const gameId = createGameId('game_triggers');
const playerOneId = createPlayerId('player_1');
const playerTwoId = createPlayerId('player_2');
const boardZoneId = createZoneId('zone_board');
const discardZoneId = createZoneId('zone_discard');
const entityId = createEntityId('ent_piece');
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
      [entityId]: {
        id: entityId,
        type: 'piece',
        componentType: 'piece.basic',
        zoneId: boardZoneId,
        ownerId: playerOneId,
        controllerId: playerOneId,
        position: 0,
        faceUp: true,
        properties: {},
        tags: [],
      },
    },
    zones: {
      [boardZoneId]: {
        id: boardZoneId,
        type: 'board',
        name: 'Board',
        ownerId: null,
        entityIds: [entityId],
        maxCapacity: null,
        visibility: {
          defaultVisibility: Visibility.Public,
          overrides: {},
        },
        properties: {},
      },
      [discardZoneId]: {
        id: discardZoneId,
        type: 'discard',
        name: 'Discard',
        ownerId: null,
        entityIds: [],
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

describe('trigger engine', () => {
  it('orders simultaneous automatic triggers by active player then turn order', () => {
    const triggers: TriggerRegistration[] = [
      {
        id: createTriggerId('trigger_active_bonus'),
        type: 'automatic',
        event: 'PROPERTY_SET',
        controllerId: playerOneId,
        priority: 1,
        once: false,
        resolution: 'immediate',
        effect: {
          type: 'ADD_RESOURCE',
          payload: {
            playerId: playerOneId,
            resource: 'gold',
            amount: 1,
          },
        },
      },
      {
        id: createTriggerId('trigger_other_bonus'),
        type: 'automatic',
        event: 'PROPERTY_SET',
        controllerId: playerTwoId,
        priority: 1,
        once: false,
        resolution: 'immediate',
        effect: {
          type: 'ADD_RESOURCE',
          payload: {
            playerId: playerTwoId,
            resource: 'gold',
            amount: 1,
          },
        },
      },
    ];

    const result = applyActionWithTriggers(createBaseState(), {
      type: 'SET_PROPERTY',
      payload: {
        targetType: 'game',
        key: 'status',
        value: 'playing',
      },
      source: {
        type: 'system',
      },
      timestamp: 1,
    }, { triggers });

    expect(result.state.players[playerOneId].resources.gold).toBe(1);
    expect(result.state.players[playerTwoId].resources.gold).toBe(1);
    expect(result.state.actionLog.map((entry) => entry.source.triggerId ?? 'root')).toEqual([
      'root',
      triggers[0].id,
      triggers[1].id,
    ]);
  });

  it('handles nested trigger chains through the immediate queue', () => {
    const triggers: TriggerRegistration[] = [
      {
        id: createTriggerId('trigger_gain_resource'),
        type: 'automatic',
        event: 'PROPERTY_SET',
        controllerId: playerOneId,
        priority: 2,
        once: false,
        resolution: 'immediate',
        effect: {
          type: 'ADD_RESOURCE',
          payload: {
            playerId: playerOneId,
            resource: 'mana',
            amount: 2,
          },
        },
      },
      {
        id: createTriggerId('trigger_resource_scores'),
        type: 'automatic',
        event: 'RESOURCE_CHANGED',
        controllerId: playerOneId,
        priority: 1,
        once: false,
        resolution: 'immediate',
        createActions: ({ state }) => [
          {
            type: 'SET_SCORE',
            payload: {
              playerId: playerOneId,
              score: state.players[playerOneId].score + 1,
            },
          },
        ],
      },
    ];

    const result = applyActionWithTriggers(createBaseState(), {
      type: 'SET_PROPERTY',
      payload: {
        targetType: 'entity',
        targetId: entityId,
        key: 'armed',
        value: true,
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 5,
    }, { triggers });

    expect(result.state.players[playerOneId].resources.mana).toBe(2);
    expect(result.state.players[playerOneId].score).toBe(1);
    expect(result.state.actionLog.map((entry) => entry.type)).toEqual([
      'SET_PROPERTY',
      'ADD_RESOURCE',
      'SET_SCORE',
    ]);
  });

  it('supports optional triggers through pending decisions', () => {
    const triggerId = createTriggerId('trigger_optional_draw');
    const trigger: TriggerRegistration = {
      id: triggerId,
      type: 'optional',
      event: 'PROPERTY_SET',
      controllerId: playerOneId,
      priority: 1,
      once: false,
      resolution: 'immediate',
      prompt: 'Spend the charge?',
      effect: {
        type: 'ADD_RESOURCE',
        payload: {
          playerId: playerOneId,
          resource: 'charge',
          amount: 1,
        },
      },
    };

    const afterPrompt = applyActionWithTriggers(createBaseState(), {
      type: 'SET_PROPERTY',
      payload: {
        targetType: 'entity',
        targetId: entityId,
        key: 'charged',
        value: true,
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 10,
    }, { triggers: [trigger] });

    expect(afterPrompt.state.pendingDecisions).toHaveLength(1);

    const decisionId = afterPrompt.state.pendingDecisions[0].id;
    const afterChoice = applyActionWithTriggers(afterPrompt.state, {
      type: 'CHOOSE_OPTION',
      payload: {
        decisionId,
        chosenOptionIds: ['accept'],
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 11,
    }, { triggers: [trigger] });

    expect(afterChoice.state.pendingDecisions).toHaveLength(0);
    expect(afterChoice.state.players[playerOneId].resources.charge).toBe(1);
  });

  it('applies replacement and prevention hooks before the reducer mutates state', () => {
    const triggers: TriggerRegistration[] = [
      {
        id: createTriggerId('trigger_replace_destroy'),
        type: 'replacement',
        event: 'ENTITY_DESTROYED',
        controllerId: playerOneId,
        priority: 2,
        once: false,
        resolution: 'immediate',
        replace: () => [
          {
            type: 'MOVE_ENTITY',
            payload: {
              entityId,
              fromZoneId: boardZoneId,
              toZoneId: discardZoneId,
            },
          },
        ],
      },
      {
        id: createTriggerId('trigger_prevent_destroy'),
        type: 'prevention',
        event: 'ENTITY_DESTROYED',
        controllerId: playerOneId,
        priority: 3,
        once: false,
        resolution: 'immediate',
        prevent: ({ state }) => state.entities[entityId].properties.shielded === true,
      },
    ];

    const shieldedState = createBaseState();
    shieldedState.entities[entityId].properties.shielded = true;

    const prevented = applyActionWithTriggers(shieldedState, {
      type: 'DESTROY_ENTITY',
      payload: {
        entityId,
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 20,
    }, { triggers });

    expect(prevented.state.entities[entityId]).toBeDefined();
    expect(prevented.state.actionLog).toHaveLength(0);

    const replaced = applyActionWithTriggers(createBaseState(), {
      type: 'DESTROY_ENTITY',
      payload: {
        entityId,
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 21,
    }, { triggers });

    expect(replaced.state.entities[entityId]).toBeDefined();
    expect(replaced.state.entities[entityId].zoneId).toBe(discardZoneId);
    expect(replaced.state.zones[discardZoneId].entityIds).toEqual([entityId]);
    expect(replaced.state.actionLog.map((entry) => entry.type)).toEqual(['MOVE_ENTITY']);
  });

  it('queues simultaneous stack triggers deterministically and resolves them LIFO', () => {
    const activeTrigger = createTriggerId('trigger_active_stack');
    const otherTrigger = createTriggerId('trigger_other_stack');
    const triggers: TriggerRegistration[] = [
      {
        id: activeTrigger,
        type: 'automatic',
        event: 'PROPERTY_SET',
        controllerId: playerOneId,
        priority: 1,
        once: false,
        resolution: 'stack',
        effect: {
          type: 'ADD_RESOURCE',
          payload: {
            playerId: playerOneId,
            resource: 'stack_gold',
            amount: 1,
          },
        },
      },
      {
        id: otherTrigger,
        type: 'automatic',
        event: 'PROPERTY_SET',
        controllerId: playerTwoId,
        priority: 1,
        once: false,
        resolution: 'stack',
        effect: {
          type: 'ADD_RESOURCE',
          payload: {
            playerId: playerTwoId,
            resource: 'stack_gold',
            amount: 1,
          },
        },
      },
    ];

    const queued = applyActionWithTriggers(createBaseState(), {
      type: 'SET_PROPERTY',
      payload: {
        targetType: 'entity',
        targetId: entityId,
        key: 'prepared',
        value: true,
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 30,
    }, {
      triggers,
      autoResolveStack: false,
    });

    expect(queued.state.stack.map((item) => item.source)).toEqual([
      `trigger:${otherTrigger}`,
      `trigger:${activeTrigger}`,
    ]);

    const resolved = resolveStackWithTriggers(queued.state, {
      triggers,
    });

    expect(resolved.state.players[playerOneId].resources.stack_gold).toBe(1);
    expect(resolved.state.players[playerTwoId].resources.stack_gold).toBe(1);
    expect(
      resolved.state.actionLog
        .filter((entry) => entry.type === 'ADD_RESOURCE')
        .map((entry) => entry.source.triggerId),
    ).toEqual([activeTrigger, otherTrigger]);
    expect(resolved.state.stack.every((item) => item.isResolved)).toBe(true);
  });

  it('opens a full priority window, advances pass order, and resolves one stack item per pass cycle', () => {
    const activeTrigger = createTriggerId('trigger_priority_active');
    const otherTrigger = createTriggerId('trigger_priority_other');
    const triggers: TriggerRegistration[] = [
      {
        id: activeTrigger,
        type: 'automatic',
        event: 'PROPERTY_SET',
        controllerId: playerOneId,
        priority: 1,
        once: false,
        resolution: 'stack',
        effect: {
          type: 'ADD_RESOURCE',
          payload: {
            playerId: playerOneId,
            resource: 'priority_gold',
            amount: 1,
          },
        },
      },
      {
        id: otherTrigger,
        type: 'automatic',
        event: 'PROPERTY_SET',
        controllerId: playerTwoId,
        priority: 1,
        once: false,
        resolution: 'stack',
        effect: {
          type: 'ADD_RESOURCE',
          payload: {
            playerId: playerTwoId,
            resource: 'priority_gold',
            amount: 1,
          },
        },
      },
    ];
    const options = {
      triggers,
      priorityPolicy: {
        mode: 'full' as const,
        autoPassEnabled: false,
      },
    };

    const opened = applyActionWithTriggers(createBaseState(), {
      type: 'SET_PROPERTY',
      payload: {
        targetType: 'entity',
        targetId: entityId,
        key: 'prepared_for_priority',
        value: true,
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 40,
    }, options);

    expect(opened.state.priorityWindow).toEqual({
      isOpen: true,
      currentPlayerId: playerOneId,
      passedPlayerIds: [],
      openedBy: 'stack',
    });
    expect(opened.state.stack.filter((item) => !item.isResolved)).toHaveLength(2);

    const afterFirstPass = applyActionWithTriggers(opened.state, {
      type: 'PASS_PRIORITY',
      payload: {
        playerId: playerOneId,
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 41,
    }, options);

    expect(afterFirstPass.state.priorityWindow.currentPlayerId).toBe(playerTwoId);
    expect(afterFirstPass.state.priorityWindow.passedPlayerIds).toEqual([playerOneId]);

    const afterSecondPass = applyActionWithTriggers(afterFirstPass.state, {
      type: 'PASS_PRIORITY',
      payload: {
        playerId: playerTwoId,
      },
      source: {
        type: 'player',
        playerId: playerTwoId,
      },
      timestamp: 42,
    }, options);

    expect(afterSecondPass.state.players[playerOneId].resources.priority_gold).toBe(1);
    expect(afterSecondPass.state.players[playerTwoId].resources.priority_gold ?? 0).toBe(0);
    expect(afterSecondPass.state.priorityWindow).toEqual({
      isOpen: true,
      currentPlayerId: playerOneId,
      passedPlayerIds: [],
      openedBy: 'stack',
    });
    expect(afterSecondPass.state.stack.filter((item) => !item.isResolved)).toHaveLength(1);

    const closed = applyActionWithTriggers(
      applyActionWithTriggers(afterSecondPass.state, {
        type: 'PASS_PRIORITY',
        payload: {
          playerId: playerOneId,
        },
        source: {
          type: 'player',
          playerId: playerOneId,
        },
        timestamp: 43,
      }, options).state,
      {
        type: 'PASS_PRIORITY',
        payload: {
          playerId: playerTwoId,
        },
        source: {
          type: 'player',
          playerId: playerTwoId,
        },
        timestamp: 44,
      },
      options,
    );

    const afterEmptyPasses = applyActionWithTriggers(
      applyActionWithTriggers(closed.state, {
        type: 'PASS_PRIORITY',
        payload: {
          playerId: playerOneId,
        },
        source: {
          type: 'player',
          playerId: playerOneId,
        },
        timestamp: 45,
      }, options).state,
      {
        type: 'PASS_PRIORITY',
        payload: {
          playerId: playerTwoId,
        },
        source: {
          type: 'player',
          playerId: playerTwoId,
        },
        timestamp: 46,
      },
      options,
    );

    expect(afterEmptyPasses.state.players[playerTwoId].resources.priority_gold).toBe(1);
    expect(afterEmptyPasses.state.priorityWindow.isOpen).toBe(false);
    expect(afterEmptyPasses.state.stack.every((item) => item.isResolved)).toBe(true);
  });

  it('auto-passes full priority windows for games without responses', () => {
    const triggers: TriggerRegistration[] = [
      {
        id: createTriggerId('trigger_autopass_stack'),
        type: 'automatic',
        event: 'PROPERTY_SET',
        controllerId: playerOneId,
        priority: 1,
        once: false,
        resolution: 'stack',
        effect: {
          type: 'ADD_RESOURCE',
          payload: {
            playerId: playerOneId,
            resource: 'autopass_gold',
            amount: 1,
          },
        },
      },
    ];

    const result = applyActionWithTriggers(createBaseState(), {
      type: 'SET_PROPERTY',
      payload: {
        targetType: 'entity',
        targetId: entityId,
        key: 'autopass_test',
        value: true,
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 50,
    }, {
      triggers,
      priorityPolicy: {
        mode: 'full',
        autoPassEnabled: true,
      },
      canPlayerRespond: () => false,
    });

    expect(result.state.players[playerOneId].resources.autopass_gold).toBe(1);
    expect(result.state.priorityWindow.isOpen).toBe(false);
    expect(result.state.stack.every((item) => item.isResolved)).toBe(true);
    expect(
      result.state.actionLog.filter((entry) => entry.type === 'PASS_PRIORITY'),
    ).toHaveLength(4);
  });

  it('continues a response chain from the active player after a player adds to the stack', () => {
    const triggerId = createTriggerId('trigger_initial_stack');
    const options = {
      triggers: [
        {
          id: triggerId,
          type: 'automatic',
          event: 'PROPERTY_SET',
          controllerId: playerOneId,
          priority: 1,
          once: false,
          resolution: 'stack',
          effect: {
            type: 'ADD_RESOURCE',
            payload: {
              playerId: playerOneId,
              resource: 'chain_gold',
              amount: 1,
            },
          },
        },
      ] satisfies TriggerRegistration[],
      priorityPolicy: {
        mode: 'full' as const,
        autoPassEnabled: false,
      },
    };

    const opened = applyActionWithTriggers(createBaseState(), {
      type: 'SET_PROPERTY',
      payload: {
        targetType: 'entity',
        targetId: entityId,
        key: 'chain_test',
        value: true,
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 60,
    }, options);

    const waitingOnPlayerTwo = applyActionWithTriggers(opened.state, {
      type: 'PASS_PRIORITY',
      payload: {
        playerId: playerOneId,
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 61,
    }, options);

    const afterResponse = applyActionWithTriggers(waitingOnPlayerTwo.state, {
      type: 'QUEUE_STACK_ITEM',
      payload: {
        stackItem: {
          id: 'stack_player_two_response',
          source: 'player:two_response',
          effect: {
            type: 'ADD_RESOURCE',
            payload: {
              playerId: playerTwoId,
              resource: 'chain_gold',
              amount: 2,
            },
            source: {
              type: 'player',
              playerId: playerTwoId,
            },
            timestamp: 62,
          },
          controllerId: playerTwoId,
          priority: 5,
        },
      },
      source: {
        type: 'player',
        playerId: playerTwoId,
      },
      timestamp: 62,
    }, options);

    expect(afterResponse.state.priorityWindow).toEqual({
      isOpen: true,
      currentPlayerId: playerOneId,
      passedPlayerIds: [],
      openedBy: 'stack',
    });
    expect(afterResponse.state.stack.filter((item) => !item.isResolved)).toHaveLength(2);
    expect(afterResponse.state.stack[afterResponse.state.stack.length - 1].source).toBe('player:two_response');
  });

  it('does not open limited response windows for unconfigured events', () => {
    const triggers: TriggerRegistration[] = [
      {
        id: createTriggerId('trigger_limited_stack'),
        type: 'automatic',
        event: 'PROPERTY_SET',
        controllerId: playerOneId,
        priority: 1,
        once: false,
        resolution: 'stack',
        effect: {
          type: 'ADD_RESOURCE',
          payload: {
            playerId: playerOneId,
            resource: 'limited_gold',
            amount: 1,
          },
        },
      },
    ];

    const result = applyActionWithTriggers(createBaseState(), {
      type: 'SET_PROPERTY',
      payload: {
        targetType: 'entity',
        targetId: entityId,
        key: 'limited_test',
        value: true,
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 70,
    }, {
      triggers,
      priorityPolicy: {
        mode: 'limited',
        responseEvents: ['TURN_STARTED'],
        autoPassEnabled: false,
      },
    });

    expect(result.state.players[playerOneId].resources.limited_gold).toBe(1);
    expect(result.state.priorityWindow.isOpen).toBe(false);
    expect(result.state.stack.every((item) => item.isResolved)).toBe(true);
  });

  it('blocks passing priority while the current responder has a mandatory decision', () => {
    const state = createBaseState();
    state.priorityWindow = {
      isOpen: true,
      currentPlayerId: playerOneId,
      passedPlayerIds: [],
      openedBy: 'action',
    };
    state.pendingDecisions = [
      {
        id: 'decision_mandatory_response',
        playerId: playerOneId,
        type: 'confirm',
        prompt: 'Respond now',
        options: [
          {
            id: 'ok',
            label: 'OK',
          },
        ],
        minChoices: 1,
        maxChoices: 1,
      },
    ];

    expect(() =>
      applyActionWithTriggers(state, {
        type: 'PASS_PRIORITY',
        payload: {
          playerId: playerOneId,
        },
        source: {
          type: 'player',
          playerId: playerOneId,
        },
        timestamp: 80,
      }, {
        priorityPolicy: {
          mode: 'full',
          autoPassEnabled: false,
        },
      }),
    ).toThrow(/must resolve pending decisions/i);
  });

  it('allows non-once triggers to fire repeatedly across multiple matching events', () => {
    const repeatingTrigger: TriggerRegistration = {
      id: createTriggerId('trigger_repeatable_income'),
      type: 'automatic',
      event: 'PROPERTY_SET',
      controllerId: playerOneId,
      priority: 1,
      once: false,
      resolution: 'immediate',
      effect: {
        type: 'ADD_RESOURCE',
        payload: {
          playerId: playerOneId,
          resource: 'repeat_gold',
          amount: 1,
        },
      },
    };

    const firstResult = applyActionWithTriggers(createBaseState(), {
      type: 'SET_PROPERTY',
      payload: {
        targetType: 'entity',
        targetId: entityId,
        key: 'armed',
        value: true,
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 81,
    }, {
      triggers: [repeatingTrigger],
    });

    const secondResult = applyActionWithTriggers(firstResult.state, {
      type: 'SET_PROPERTY',
      payload: {
        targetType: 'entity',
        targetId: entityId,
        key: 'stunned',
        value: true,
      },
      source: {
        type: 'player',
        playerId: playerOneId,
      },
      timestamp: 82,
    }, {
      triggers: [repeatingTrigger],
    });

    expect(secondResult.state.players[playerOneId].resources.repeat_gold).toBe(2);
    expect(
      secondResult.state.actionLog.filter(
        (entry) => entry.source.triggerId === repeatingTrigger.id,
      ),
    ).toHaveLength(2);
  });
});
