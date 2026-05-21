import { describe, expect, it } from 'vitest';
import {
  createTriggerId,
} from '@turnbased/shared-types';

import type { TriggerRegistration } from '../index';
import {
  applyActionWithTriggers,
} from '../index';

import {
  playerOneId,
  playerTwoId,
  boardZoneId,
  discardZoneId,
  entityId,
  createBaseState,
} from './triggers.fixtures';

describe('trigger engine – core', () => {
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
