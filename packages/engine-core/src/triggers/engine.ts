import type { CanonicalAction, CanonicalActionTemplate } from '../actions';
import { reduceGameState } from '../reducer';
import type { GameState, PlayerId, PriorityPolicy } from '../state';
import { createEventBus, emitDomainEvents } from './event-bus';
import {
  areAllPriorityParticipantsPassed,
  closePriorityWindow,
  createClosedPriorityWindow,
  currentPriorityPlayerHasDecision,
  getPriorityOrder,
  openPriorityWindow,
} from './priority';
import type {
  DomainEvent,
  PriorityResponderContext,
  OptionalTriggerDecisionMetadata,
  RegisteredTrigger,
  TriggerDispatchResult,
  TriggerEngineOptions,
  TriggerExecutionContext,
  TriggerMatchContext,
  TriggerQueueEntry,
  TriggerRegistration,
} from './types';

const DEFAULT_MAX_DEPTH = 100;
const OPTIONAL_TRIGGER_ACCEPT_ID = 'accept';
const DEFAULT_PRIORITY_POLICY: PriorityPolicy = {
  mode: 'none',
  autoPassEnabled: true,
};

type DispatchOptions = Required<Pick<TriggerEngineOptions, 'autoResolveStack' | 'maxDepth'>>;

interface PriorityOptions extends DispatchOptions {
  priorityPolicy: PriorityPolicy;
  canPlayerRespond?: TriggerEngineOptions['canPlayerRespond'];
}

function getControllerRank(state: GameState, controllerId: PlayerId): number {
  const orderedPlayers = getPriorityOrder(state);
  const rank = orderedPlayers.indexOf(controllerId);
  return rank === -1 ? orderedPlayers.length : rank;
}

function hasTriggeredOnce(state: GameState, triggerId: RegisteredTrigger['id']): boolean {
  return state.actionLog.some((entry) => entry.source.triggerId === triggerId);
}

function createOptionalDecisionId(trigger: RegisteredTrigger, event: DomainEvent): string {
  return `decision_${trigger.id}_${event.id}`;
}

function createStackItemId(trigger: RegisteredTrigger, event: DomainEvent, index: number): string {
  return `stack_${trigger.id}_${event.id}_${index}`;
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function normalizeTriggerAction(
  action: CanonicalActionTemplate,
  trigger: RegisteredTrigger,
  event: DomainEvent,
): CanonicalAction {
  return {
    ...action,
    source: {
      type: 'trigger',
      playerId: trigger.controllerId,
      triggerId: trigger.id,
      ...action.source,
    },
    timestamp: action.timestamp ?? event.timestamp,
  } as CanonicalAction;
}

function matchesSourceEntity(trigger: RegisteredTrigger, event: DomainEvent): boolean {
  if (!trigger.sourceEntityId) {
    return true;
  }

  return event.payload.entityId === trigger.sourceEntityId;
}

function evaluateCondition(trigger: RegisteredTrigger, context: TriggerMatchContext): boolean {
  if (typeof trigger.condition === 'function') {
    return trigger.condition(context);
  }

  if (trigger.matches) {
    return trigger.matches(context);
  }

  return true;
}

function matchesTrigger(
  trigger: RegisteredTrigger,
  event: DomainEvent,
  previousState: GameState,
  state: GameState,
): boolean {
  if (trigger.event !== '*' && trigger.event !== event.type) {
    return false;
  }

  if (trigger.phase && trigger.phase !== state.turnState.currentPhase) {
    return false;
  }

  if (trigger.once && hasTriggeredOnce(state, trigger.id)) {
    return false;
  }

  if (!matchesSourceEntity(trigger, event)) {
    return false;
  }

  return evaluateCondition(trigger, {
    event,
    action: event.action,
    previousState,
    state,
  });
}

function sortTriggersForResolution(
  triggers: readonly RegisteredTrigger[],
  state: GameState,
): RegisteredTrigger[] {
  return [...triggers].sort((left, right) => {
    const controllerRank = getControllerRank(state, left.controllerId) - getControllerRank(state, right.controllerId);
    if (controllerRank !== 0) {
      return controllerRank;
    }

    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    return left.registrationIndex - right.registrationIndex;
  });
}

function isOptionalDecisionMetadata(value: unknown): value is OptionalTriggerDecisionMetadata {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const metadata = value as Record<string, unknown>;
  return (
    metadata.kind === 'optional_trigger' &&
    typeof metadata.eventId === 'string' &&
    typeof metadata.triggerId === 'string' &&
    (metadata.resolution === 'immediate' || metadata.resolution === 'stack') &&
    Array.isArray(metadata.actions)
  );
}

function createOptionalTriggerPrompt(
  trigger: RegisteredTrigger,
  event: DomainEvent,
  actions: CanonicalAction[],
): CanonicalAction {
  return {
    type: 'PROMPT_PLAYER',
    payload: {
      decision: {
        id: createOptionalDecisionId(trigger, event),
        playerId: trigger.controllerId,
        type: 'confirm',
        prompt: trigger.prompt ?? `Activate optional trigger ${trigger.id}?`,
        options: [
          {
            id: OPTIONAL_TRIGGER_ACCEPT_ID,
            label: 'Yes',
          },
          {
            id: 'decline',
            label: 'No',
          },
        ],
        minChoices: 1,
        maxChoices: 1,
        metadata: {
          kind: 'optional_trigger',
          triggerId: trigger.id,
          eventId: event.id,
          resolution: trigger.resolution,
          actions,
        } satisfies OptionalTriggerDecisionMetadata,
      },
    },
    source: {
      type: 'trigger',
      playerId: trigger.controllerId,
      triggerId: trigger.id,
    },
    timestamp: event.timestamp,
  };
}

function buildExecutionContext(
  trigger: RegisteredTrigger,
  event: DomainEvent,
  previousState: GameState,
  state: GameState,
): TriggerExecutionContext {
  return {
    trigger,
    event,
    action: event.action,
    previousState,
    state,
  };
}

function materializeTriggerActions(
  trigger: RegisteredTrigger,
  event: DomainEvent,
  previousState: GameState,
  state: GameState,
): CanonicalAction[] {
  const context = buildExecutionContext(trigger, event, previousState, state);
  const effectTemplates = trigger.createActions?.(context) ?? toArray(trigger.effect);

  return effectTemplates.map((action) => normalizeTriggerAction(action, trigger, event));
}

function planTriggeredEffects(
  state: GameState,
  previousState: GameState,
  event: DomainEvent,
  triggers: readonly RegisteredTrigger[],
): TriggerQueueEntry[] {
  const eligible = sortTriggersForResolution(
    triggers.filter(
      (trigger) =>
        (trigger.type === 'automatic' || trigger.type === 'optional') &&
        matchesTrigger(trigger, event, previousState, state),
    ),
    state,
  );

  return eligible.map((trigger) => {
    const actions = materializeTriggerActions(trigger, event, previousState, state);

    if (trigger.type === 'optional') {
      return {
        trigger,
        actions: [createOptionalTriggerPrompt(trigger, event, actions)],
        resolution: 'immediate',
      };
    }

    return {
      trigger,
      actions,
      resolution: trigger.resolution,
    };
  });
}

function applyActionSequence(
  state: GameState,
  actions: readonly CanonicalAction[],
  triggers: readonly RegisteredTrigger[],
  options: DispatchOptions,
  depth: number,
): TriggerDispatchResult {
  return actions.reduce<TriggerDispatchResult>(
    (result, action) => {
      const actionResult = dispatchCanonicalAction(result.state, action, triggers, options, depth);
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

function queueStackItems(
  state: GameState,
  entry: TriggerQueueEntry,
  event: DomainEvent,
  triggers: readonly RegisteredTrigger[],
  options: DispatchOptions,
  depth: number,
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
  );
}

function getTopUnresolvedStackItem(state: GameState) {
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    const stackItem = state.stack[index];
    if (!stackItem.isResolved) {
      return stackItem;
    }
  }

  return null;
}

function hasUnresolvedStackItems(state: GameState): boolean {
  return getTopUnresolvedStackItem(state) !== null;
}

function getNextSyntheticTimestamp(state: GameState): number {
  const lastTimestamp = state.actionLog[state.actionLog.length - 1]?.timestamp ?? -1;
  return lastTimestamp + 1;
}

function isExternallyControlledAction(action: CanonicalAction): boolean {
  return action.source.type === 'player' || action.source.type === 'ai';
}

function assertPriorityActor(state: GameState, action: CanonicalAction): void {
  if (!state.priorityWindow.isOpen || !isExternallyControlledAction(action)) {
    return;
  }

  const currentPlayerId = state.priorityWindow.currentPlayerId;
  if (!currentPlayerId || action.source.playerId !== currentPlayerId) {
    throw new Error('Only the current priority player may act while a response window is open');
  }
}

function shouldOpenPriorityWindow(
  previousState: GameState,
  action: CanonicalAction,
  emittedEvents: readonly DomainEvent[],
  policy: PriorityPolicy,
): boolean {
  if (policy.mode === 'none' || action.type === 'PASS_PRIORITY') {
    return false;
  }

  if (previousState.priorityWindow.isOpen) {
    return true;
  }

  if (policy.mode === 'full') {
    return true;
  }

  const responseEvents = new Set(policy.responseEvents ?? []);
  return emittedEvents.some((event) => responseEvents.has(event.type));
}

function currentPlayerCanRespond(
  state: GameState,
  options: Pick<PriorityOptions, 'canPlayerRespond'>,
): boolean {
  const currentPlayerId = state.priorityWindow.currentPlayerId;
  if (!currentPlayerId) {
    return false;
  }

  if (currentPriorityPlayerHasDecision(state)) {
    return true;
  }

  if (!options.canPlayerRespond) {
    return false;
  }

  return options.canPlayerRespond({
    state,
    playerId: currentPlayerId,
    priorityWindow: state.priorityWindow,
  } satisfies PriorityResponderContext);
}

function resolveOptionalDecisionEffects(
  previousState: GameState,
  action: CanonicalAction,
  currentState: GameState,
  triggers: readonly RegisteredTrigger[],
  options: DispatchOptions,
  depth: number,
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
  );

  return {
    state: stackResult.state,
    emittedEvents: [...immediateResult.emittedEvents, ...stackResult.emittedEvents],
  };
}

function resolveTopStackItem(
  state: GameState,
  triggers: readonly RegisteredTrigger[],
  options: DispatchOptions,
  depth: number,
): TriggerDispatchResult {
  const stackItem = getTopUnresolvedStackItem(state);
  if (!stackItem) {
    return {
      state,
      emittedEvents: [],
    };
  }

  const effectResult = dispatchCanonicalAction(
    state,
    stackItem.effect,
    triggers,
    {
      ...options,
      autoResolveStack: false,
    },
    depth + 1,
  );

  const resolveResult = dispatchCanonicalAction(
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

function resolvePendingStack(
  state: GameState,
  triggers: readonly RegisteredTrigger[],
  options: DispatchOptions,
  depth: number,
): TriggerDispatchResult {
  let nextState = state;
  const emittedEvents: DomainEvent[] = [];

  while (true) {
    const resolveResult = resolveTopStackItem(nextState, triggers, options, depth);
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

function settlePriorityWindow(
  state: GameState,
  triggers: readonly RegisteredTrigger[],
  options: PriorityOptions,
  depth: number,
): TriggerDispatchResult {
  let nextState = state;
  const emittedEvents: DomainEvent[] = [];

  while (nextState.priorityWindow.isOpen) {
    if (areAllPriorityParticipantsPassed(nextState)) {
      if (!hasUnresolvedStackItems(nextState)) {
        nextState = closePriorityWindow(nextState);
        break;
      }

      const resolveResult = resolveTopStackItem(
        nextState,
        triggers,
        {
          autoResolveStack: false,
          maxDepth: options.maxDepth,
        },
        depth + 1,
      );

      nextState = openPriorityWindow(resolveResult.state, 'stack');
      emittedEvents.push(...resolveResult.emittedEvents);
      continue;
    }

    if (!options.priorityPolicy.autoPassEnabled) {
      break;
    }

    const currentPlayerId = nextState.priorityWindow.currentPlayerId;
    if (!currentPlayerId || currentPriorityPlayerHasDecision(nextState)) {
      break;
    }

    if (currentPlayerCanRespond(nextState, options)) {
      break;
    }

    const passResult = dispatchCanonicalAction(
      nextState,
      {
        type: 'PASS_PRIORITY',
        payload: {
          playerId: currentPlayerId,
        },
        source: {
          type: 'system',
        },
        timestamp: getNextSyntheticTimestamp(nextState),
      },
      triggers,
      {
        autoResolveStack: false,
        maxDepth: options.maxDepth,
      },
      depth + 1,
    );

    nextState = passResult.state;
    emittedEvents.push(...passResult.emittedEvents);
  }

  return {
    state: nextState,
    emittedEvents,
  };
}

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
  );
}
