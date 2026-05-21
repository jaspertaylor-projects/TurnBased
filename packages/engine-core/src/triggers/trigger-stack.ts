import type { CanonicalAction } from '../actions';
import type { GameState } from '../state';
import {
  createStackItemId,
  isOptionalDecisionMetadata,
  OPTIONAL_TRIGGER_ACCEPT_ID,
} from './trigger-actions';
import type {
  DomainEvent,
  RegisteredTrigger,
  TriggerDispatchResult,
  TriggerQueueEntry,
} from './types';

export type DispatchOptions = {
  autoResolveStack: boolean;
  maxDepth: number;
};

export type DispatchCanonicalActionFn = (
  state: GameState,
  action: CanonicalAction,
  triggers: readonly RegisteredTrigger[],
  options: DispatchOptions,
  depth: number,
) => TriggerDispatchResult;

export function applyActionSequence(
  state: GameState,
  actions: readonly CanonicalAction[],
  triggers: readonly RegisteredTrigger[],
  options: DispatchOptions,
  depth: number,
  dispatchFn: DispatchCanonicalActionFn,
): TriggerDispatchResult {
  return actions.reduce<TriggerDispatchResult>(
    (result, action) => {
      const actionResult = dispatchFn(result.state, action, triggers, options, depth);
      return {
        state: actionResult.state,
        emittedEvents: [...result.emittedEvents, ...actionResult.emittedEvents],
      };
    },
    {
      state,
      emittedEvents: [],
    },
  );
}

export function queueStackItems(
  state: GameState,
  entry: TriggerQueueEntry,
  event: DomainEvent,
  triggers: readonly RegisteredTrigger[],
  options: DispatchOptions,
  depth: number,
  dispatchFn: DispatchCanonicalActionFn,
): TriggerDispatchResult {
  const queueActions = [...entry.actions]
    .map((action, index) => ({
      type: 'QUEUE_STACK_ITEM' as const,
      payload: {
        stackItem: {
          id: createStackItemId(entry.trigger, event, index),
          source: `trigger:${entry.trigger.id}`,
          effect: action,
          controllerId: entry.trigger.controllerId,
          priority: entry.trigger.priority,
        },
      },
      source: {
        type: 'trigger' as const,
        playerId: entry.trigger.controllerId,
        triggerId: entry.trigger.id,
      },
      timestamp: action.timestamp,
    }))
    .reverse();

  return applyActionSequence(
    state,
    queueActions,
    triggers,
    {
      ...options,
      autoResolveStack: false,
    },
    depth + 1,
    dispatchFn,
  );
}

export function getTopUnresolvedStackItem(state: GameState) {
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    const stackItem = state.stack[index];
    if (!stackItem.isResolved) {
      return stackItem;
    }
  }

  return null;
}

export function hasUnresolvedStackItems(state: GameState): boolean {
  return getTopUnresolvedStackItem(state) !== null;
}

export function getNextSyntheticTimestamp(state: GameState): number {
  const lastTimestamp = state.actionLog[state.actionLog.length - 1]?.timestamp ?? -1;
  return lastTimestamp + 1;
}

export function resolveOptionalDecisionEffects(
  previousState: GameState,
  action: CanonicalAction,
  currentState: GameState,
  triggers: readonly RegisteredTrigger[],
  options: DispatchOptions,
  depth: number,
  dispatchFn: DispatchCanonicalActionFn,
): TriggerDispatchResult {
  if (action.type !== 'CHOOSE_OPTION') {
    return {
      state: currentState,
      emittedEvents: [],
    };
  }

  const pendingDecision = previousState.pendingDecisions.find(
    (decision) => decision.id === action.payload.decisionId,
  );

  const metadata = pendingDecision?.metadata;

  if (!pendingDecision || !isOptionalDecisionMetadata(metadata)) {
    return {
      state: currentState,
      emittedEvents: [],
    };
  }

  if (!action.payload.chosenOptionIds.includes(OPTIONAL_TRIGGER_ACCEPT_ID)) {
    return {
      state: currentState,
      emittedEvents: [],
    };
  }

  const followUpActions = metadata.actions as CanonicalAction[];

  const immediateActions =
    metadata.resolution === 'immediate'
      ? followUpActions
      : [];
  const stackedActions =
    metadata.resolution === 'stack'
      ? followUpActions
      : [];

  const immediateResult = applyActionSequence(
    currentState,
    immediateActions,
    triggers,
    {
      ...options,
      autoResolveStack: false,
    },
    depth + 1,
    dispatchFn,
  );

  if (stackedActions.length === 0) {
    return immediateResult;
  }

  const stackTrigger = triggers.find((trigger) => trigger.id === metadata.triggerId);
  if (!stackTrigger) {
    return immediateResult;
  }

  const stackEvent: DomainEvent = {
    id: metadata.eventId,
    type: 'DECISION_MADE',
    actionType: action.type,
    action,
    source: action.source,
    timestamp: action.timestamp,
    depth,
    sequence: 0,
    payload: {
      decisionId: action.payload.decisionId,
    },
  };

  const stackResult = queueStackItems(
    immediateResult.state,
    {
      trigger: stackTrigger,
      actions: stackedActions,
      resolution: 'stack',
    },
    stackEvent,
    triggers,
    {
      ...options,
      autoResolveStack: false,
    },
    depth + 1,
    dispatchFn,
  );

  return {
    state: stackResult.state,
    emittedEvents: [...immediateResult.emittedEvents, ...stackResult.emittedEvents],
  };
}

export function resolveTopStackItem(
  state: GameState,
  triggers: readonly RegisteredTrigger[],
  options: DispatchOptions,
  depth: number,
  dispatchFn: DispatchCanonicalActionFn,
): TriggerDispatchResult {
  const stackItem = getTopUnresolvedStackItem(state);
  if (!stackItem) {
    return {
      state,
      emittedEvents: [],
    };
  }

  const effectResult = dispatchFn(
    state,
    stackItem.effect,
    triggers,
    {
      ...options,
      autoResolveStack: false,
    },
    depth + 1,
  );

  const resolveResult = dispatchFn(
    effectResult.state,
    {
      type: 'RESOLVE_STACK_ITEM',
      payload: {
        stackItemId: stackItem.id,
      },
      source: {
        type: 'system',
      },
      timestamp: stackItem.effect.timestamp,
    },
    triggers,
    {
      ...options,
      autoResolveStack: false,
    },
    depth + 1,
  );

  return {
    state: resolveResult.state,
    emittedEvents: [...effectResult.emittedEvents, ...resolveResult.emittedEvents],
  };
}

export function resolvePendingStack(
  state: GameState,
  triggers: readonly RegisteredTrigger[],
  options: DispatchOptions,
  depth: number,
  dispatchFn: DispatchCanonicalActionFn,
): TriggerDispatchResult {
  let nextState = state;
  const emittedEvents: DomainEvent[] = [];

  while (true) {
    const resolveResult = resolveTopStackItem(nextState, triggers, options, depth, dispatchFn);
    if (resolveResult.state === nextState) {
      break;
    }

    nextState = resolveResult.state;
    emittedEvents.push(...resolveResult.emittedEvents);
  }

  return {
    state: nextState,
    emittedEvents,
  };
}
