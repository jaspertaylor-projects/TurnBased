import type { CanonicalAction, CanonicalActionTemplate } from '../actions';
import type { GameState } from '../state';
import { matchesTrigger, sortTriggersForResolution } from './trigger-matching';
import type {
  DomainEvent,
  OptionalTriggerDecisionMetadata,
  RegisteredTrigger,
  TriggerExecutionContext,
  TriggerQueueEntry,
} from './types';

const OPTIONAL_TRIGGER_ACCEPT_ID = 'accept';

export { OPTIONAL_TRIGGER_ACCEPT_ID };

export function createOptionalDecisionId(trigger: RegisteredTrigger, event: DomainEvent): string {
  return `decision_${trigger.id}_${event.id}`;
}

export function createStackItemId(trigger: RegisteredTrigger, event: DomainEvent, index: number): string {
  return `stack_${trigger.id}_${event.id}_${index}`;
}

export function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function normalizeTriggerAction(
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

export function isOptionalDecisionMetadata(value: unknown): value is OptionalTriggerDecisionMetadata {
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

export function createOptionalTriggerPrompt(
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

export function buildExecutionContext(
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

export function materializeTriggerActions(
  trigger: RegisteredTrigger,
  event: DomainEvent,
  previousState: GameState,
  state: GameState,
): CanonicalAction[] {
  const context = buildExecutionContext(trigger, event, previousState, state);
  const effectTemplates = trigger.createActions?.(context) ?? toArray(trigger.effect);

  return effectTemplates.map((action) => normalizeTriggerAction(action, trigger, event));
}

export function planTriggeredEffects(
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
