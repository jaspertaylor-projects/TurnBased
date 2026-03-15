import type { CanonicalAction } from '../actions';
import { getEventsForCanonicalAction } from '../actions';
import type { GameState } from '../state';
import type { DomainEvent } from './types';

export interface EventBus {
  emit: (event: DomainEvent) => void;
  drain: () => DomainEvent[];
  size: () => number;
}

export function createEventBus(initialEvents: readonly DomainEvent[] = []): EventBus {
  let queue = [...initialEvents];

  return {
    emit(event) {
      queue = [...queue, event];
    },
    drain() {
      const drained = queue;
      queue = [];
      return drained;
    },
    size() {
      return queue.length;
    },
  };
}

function createEventId(
  version: number,
  action: CanonicalAction,
  eventType: DomainEvent['type'],
  depth: number,
  sequence: number,
): string {
  return `evt_v${version}_t${action.timestamp}_d${depth}_s${sequence}_${eventType}`;
}

function getEventPayload(
  eventType: DomainEvent['type'],
  action: CanonicalAction,
  previousState: GameState,
  state: GameState,
): Record<string, unknown> {
  if (eventType === 'TURN_ENDED') {
    return {
      playerId: previousState.turnState.activePlayerId,
      turnNumber: previousState.turnState.turnNumber,
    };
  }

  if (eventType === 'TURN_STARTED') {
    return {
      playerId: state.turnState.activePlayerId,
      turnNumber: state.turnState.turnNumber,
    };
  }

  if (action.type === 'QUEUE_STACK_ITEM' && eventType === 'STACK_ITEM_QUEUED') {
    return {
      stackItemId: action.payload.stackItem.id,
      controllerId: action.payload.stackItem.controllerId,
      priority: action.payload.stackItem.priority,
      source: action.payload.stackItem.source,
    };
  }

  if (action.type === 'RESOLVE_STACK_ITEM' && eventType === 'STACK_ITEM_RESOLVED') {
    return {
      stackItemId: action.payload.stackItemId,
    };
  }

  if (action.type === 'DRAW_FROM_ZONE' && eventType === 'ENTITY_DRAWN') {
    return {
      ...action.payload,
      entityIds: previousState.zones[action.payload.sourceZoneId]?.entityIds.slice(0, action.payload.count) ?? [],
    };
  }

  return { ...action.payload };
}

export function emitDomainEvents(
  previousState: GameState,
  state: GameState,
  action: CanonicalAction,
  depth: number,
): DomainEvent[] {
  const actionEvents = getEventsForCanonicalAction(action.type);
  const actionLogId = state.actionLog.at(-1)?.id;

  return actionEvents.map((eventType, index) => ({
    id: createEventId(state.version, action, eventType, depth, index),
    type: eventType,
    actionType: action.type,
    action,
    source: action.source,
    timestamp: action.timestamp,
    depth,
    sequence: index,
    payload: getEventPayload(eventType, action, previousState, state),
    actionLogId,
  }));
}
