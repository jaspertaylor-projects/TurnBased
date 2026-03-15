import { describe, expect, it } from 'vitest';

import {
  canonicalActionEventMap,
  canonicalActionSchema,
  getEventsForCanonicalAction,
  intentActionSchema,
} from './index';

describe('action grammar validation', () => {
  it('accepts a valid canonical MOVE_ENTITY action', () => {
    const result = canonicalActionSchema.parse({
      type: 'MOVE_ENTITY',
      payload: {
        entityId: 'ent_alpha',
        fromZoneId: 'zone_hand',
        toZoneId: 'zone_board',
        position: 0,
      },
      source: {
        type: 'player',
        playerId: 'player_1',
      },
      timestamp: 3,
    });

    expect(result.type).toBe('MOVE_ENTITY');
  });

  it('rejects invalid SET_PROPERTY actions without a target id', () => {
    const result = canonicalActionSchema.safeParse({
      type: 'SET_PROPERTY',
      payload: {
        targetType: 'entity',
        key: 'power',
        value: 7,
      },
      source: {
        type: 'system',
      },
      timestamp: 4,
    });

    expect(result.success).toBe(false);
  });

  it('accepts ergonomic intent actions before lowering', () => {
    const result = intentActionSchema.parse({
      type: 'PLAY_CARD_TO_BOARD',
      payload: {
        entityId: 'ent_card',
        destinationZoneId: 'zone_board',
      },
      source: {
        type: 'player',
        playerId: 'player_1',
      },
      timestamp: 1,
    });

    expect(result.type).toBe('PLAY_CARD_TO_BOARD');
  });
});

describe('canonical action event rules', () => {
  it('maps END_TURN to end and start events', () => {
    expect(getEventsForCanonicalAction('END_TURN')).toEqual(['TURN_ENDED', 'TURN_STARTED']);
  });

  it('defines event rules for every canonical action', () => {
    expect(Object.keys(canonicalActionEventMap)).toHaveLength(27);
  });

  it('maps QUEUE_STACK_ITEM to the stack queued event', () => {
    expect(getEventsForCanonicalAction('QUEUE_STACK_ITEM')).toEqual(['STACK_ITEM_QUEUED']);
  });

  it('maps INSERT_STEP to the step inserted event', () => {
    expect(getEventsForCanonicalAction('INSERT_STEP')).toEqual(['STEP_INSERTED']);
  });
});
