import type { CanonicalAction } from '../actions';
import { reduceGameState } from '../reducer';
import type { GameState, PriorityPolicy } from '../state';
import { createEventBus, emitDomainEvents } from './event-bus';
import {
  createClosedPriorityWindow,
  openPriorityWindow,
} from './priority';
import {
  buildExecutionContext,
  normalizeTriggerAction,
  planTriggeredEffects,
  toArray,
} from './trigger-actions';
import {
  matchesTrigger,
  sortTriggersForResolution,
} from './trigger-matching';
import {
  assertPriorityActor,
  shouldOpenPriorityWindow,
  settlePriorityWindow,
} from './trigger-priority';
import type { PriorityOptions } from './trigger-priority';
import {
  applyActionSequence,
  hasUnresolvedStackItems,
  queueStackItems,
  resolveOptionalDecisionEffects,
  resolvePendingStack,
} from './trigger-stack';
import type { DispatchOptions } from './trigger-stack';
import type {
  DomainEvent,
  RegisteredTrigger,
  TriggerDispatchResult,
  TriggerEngineOptions,
  TriggerRegistration,
} from './types';

const DEFAULT_MAX_DEPTH = 100;
const DEFAULT_PRIORITY_POLICY: PriorityPolicy = {
  mode: 'none',
  autoPassEnabled: true,
};

function interceptAction(
  state: GameState,
  action: CanonicalAction,
  triggers: readonly RegisteredTrigger[],
): CanonicalAction[] | null {
  const predictedEvents = emitDomainEvents(state, state, action, 0);
  const matchingTriggers = sortTriggersForResolution(
    triggers.filter(
      (trigger) =>
        (trigger.type === 'replacement' || trigger.type === 'prevention') &&
        predictedEvents.some((event) => matchesTrigger(trigger, event, state, state)),
    ),
    state,
  );

  for (const trigger of matchingTriggers) {
    const event = predictedEvents.find((candidate) => matchesTrigger(trigger, candidate, state, state));
    if (!event) {
      continue;
    }

    const context = buildExecutionContext(trigger, event, state, state);

    if (trigger.type === 'prevention') {
      const prevented = trigger.prevent ? trigger.prevent(context) : true;
      if (prevented) {
        return [];
      }
    }

    if (trigger.type === 'replacement') {
      const replacements = trigger.replace?.(context) ?? toArray(trigger.effect);
      if (replacements.length > 0) {
        return replacements.map((candidate) => normalizeTriggerAction(candidate, trigger, event));
      }
    }
  }

  return null;
}

function dispatchCanonicalAction(
  state: GameState,
  action: CanonicalAction,
  triggers: readonly RegisteredTrigger[],
  options: DispatchOptions,
  depth: number,
): TriggerDispatchResult {
  if (depth > options.maxDepth) {
    throw new Error(`Trigger depth exceeded configured limit of ${options.maxDepth}`);
  }

  const interceptedActions = interceptAction(state, action, triggers);
  if (interceptedActions) {
    if (interceptedActions.length === 0) {
      return {
        state,
        emittedEvents: [],
      };
    }

    return applyActionSequence(
      state,
      interceptedActions,
      triggers,
      {
        ...options,
        autoResolveStack: false,
      },
      depth + 1,
      dispatchCanonicalAction,
    );
  }

  let nextState = reduceGameState(state, action);
  const emittedEvents = emitDomainEvents(state, nextState, action, depth);
  const eventBus = createEventBus(emittedEvents);
  const nestedEvents: DomainEvent[] = [];

  while (eventBus.size() > 0) {
    const pendingEvents = eventBus.drain();

    for (const event of pendingEvents) {
      const plannedEffects = planTriggeredEffects(nextState, state, event, triggers);
      const immediateEffects = plannedEffects.filter((entry) => entry.resolution === 'immediate');
      const stackEffects = plannedEffects.filter((entry) => entry.resolution === 'stack').reverse();

      for (const entry of immediateEffects) {
        const immediateResult = applyActionSequence(
          nextState,
          entry.actions,
          triggers,
          {
            ...options,
            autoResolveStack: false,
          },
          depth + 1,
          dispatchCanonicalAction,
        );

        nextState = immediateResult.state;
        nestedEvents.push(...immediateResult.emittedEvents);
      }

      for (const entry of stackEffects) {
        const stackResult = queueStackItems(
          nextState,
          entry,
          event,
          triggers,
          {
            ...options,
            autoResolveStack: false,
          },
          depth + 1,
          dispatchCanonicalAction,
        );

        nextState = stackResult.state;
        nestedEvents.push(...stackResult.emittedEvents);
      }
    }
  }

  const optionalResult = resolveOptionalDecisionEffects(
    state,
    action,
    nextState,
    triggers,
    {
      ...options,
      autoResolveStack: false,
    },
    depth,
    dispatchCanonicalAction,
  );

  nextState = optionalResult.state;
  nestedEvents.push(...optionalResult.emittedEvents);

  if (!options.autoResolveStack) {
    return {
      state: nextState,
      emittedEvents: [...emittedEvents, ...nestedEvents],
    };
  }

  const stackResult = resolvePendingStack(
    nextState,
    triggers,
    {
      ...options,
      autoResolveStack: false,
    },
    depth + 1,
    dispatchCanonicalAction,
  );

  return {
    state: stackResult.state,
    emittedEvents: [...emittedEvents, ...nestedEvents, ...stackResult.emittedEvents],
  };
}

export function createTriggerRegistry(
  triggers: readonly TriggerRegistration[] = [],
): RegisteredTrigger[] {
  return triggers.map((trigger, registrationIndex) => ({
    ...trigger,
    resolution:
      trigger.resolution ??
      (trigger.type === 'automatic' ? 'immediate' : 'stack'),
    registrationIndex,
  }));
}

function normalizePriorityState(state: GameState): GameState {
  if ('priorityWindow' in state && state.priorityWindow) {
    return state;
  }

  return {
    ...state,
    priorityWindow: createClosedPriorityWindow(),
  };
}

function normalizePriorityPolicy(policy?: PriorityPolicy): PriorityPolicy {
  return {
    ...DEFAULT_PRIORITY_POLICY,
    ...policy,
  };
}

export function applyActionWithTriggers(
  state: GameState,
  action: CanonicalAction,
  options: TriggerEngineOptions = {},
): TriggerDispatchResult {
  const triggerRegistry = createTriggerRegistry(options.triggers);
  const normalizedState = normalizePriorityState(state);
  const priorityPolicy = normalizePriorityPolicy(options.priorityPolicy);
  const priorityOptions: PriorityOptions = {
    autoResolveStack: options.autoResolveStack ?? true,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    priorityPolicy,
    canPlayerRespond: options.canPlayerRespond,
  };

  if (priorityPolicy.mode !== 'none') {
    assertPriorityActor(normalizedState, action);
  }

  const actionResult = dispatchCanonicalAction(
    normalizedState,
    action,
    triggerRegistry,
    {
      autoResolveStack:
        priorityPolicy.mode === 'none'
          ? priorityOptions.autoResolveStack
          : false,
      maxDepth: priorityOptions.maxDepth,
    },
    0,
  );

  if (priorityPolicy.mode === 'none') {
    return actionResult;
  }

  if (action.type === 'PASS_PRIORITY') {
    const settled = settlePriorityWindow(
      actionResult.state,
      triggerRegistry,
      priorityOptions,
      0,
      dispatchCanonicalAction,
    );

    return {
      state: settled.state,
      emittedEvents: [...actionResult.emittedEvents, ...settled.emittedEvents],
    };
  }

  if (
    shouldOpenPriorityWindow(
      normalizedState,
      action,
      actionResult.emittedEvents,
      priorityPolicy,
    )
  ) {
    const openedState = openPriorityWindow(
      actionResult.state,
      hasUnresolvedStackItems(actionResult.state) ? 'stack' : 'action',
    );
    const settled = settlePriorityWindow(
      openedState,
      triggerRegistry,
      priorityOptions,
      0,
      dispatchCanonicalAction,
    );

    return {
      state: settled.state,
      emittedEvents: [...actionResult.emittedEvents, ...settled.emittedEvents],
    };
  }

  if (!priorityOptions.autoResolveStack) {
    return actionResult;
  }

  const stackResult = resolvePendingStack(
    actionResult.state,
    triggerRegistry,
    {
      autoResolveStack: false,
      maxDepth: priorityOptions.maxDepth,
    },
    0,
    dispatchCanonicalAction,
  );

  return {
    state: stackResult.state,
    emittedEvents: [...actionResult.emittedEvents, ...stackResult.emittedEvents],
  };
}

export function replayActionsWithTriggers(
  initialState: GameState,
  actions: readonly CanonicalAction[],
  options: TriggerEngineOptions = {},
): GameState {
  return actions.reduce(
    (state, action) => applyActionWithTriggers(state, action, options).state,
    initialState,
  );
}

export function resolveStackWithTriggers(
  state: GameState,
  options: TriggerEngineOptions = {},
): TriggerDispatchResult {
  return resolvePendingStack(
    normalizePriorityState(state),
    createTriggerRegistry(options.triggers),
    {
      autoResolveStack: false,
      maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    },
    0,
    dispatchCanonicalAction,
  );
}
