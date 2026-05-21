import type { GameState, PlayerId } from '../state';
import { getPriorityOrder } from './priority';
import type {
  DomainEvent,
  RegisteredTrigger,
  TriggerMatchContext,
} from './types';

export function getControllerRank(state: GameState, controllerId: PlayerId): number {
  const orderedPlayers = getPriorityOrder(state);
  const rank = orderedPlayers.indexOf(controllerId);
  return rank === -1 ? orderedPlayers.length : rank;
}

export function hasTriggeredOnce(state: GameState, triggerId: RegisteredTrigger['id']): boolean {
  return state.actionLog.some((entry) => entry.source.triggerId === triggerId);
}

export function matchesSourceEntity(trigger: RegisteredTrigger, event: DomainEvent): boolean {
  if (!trigger.sourceEntityId) {
    return true;
  }

  return event.payload.entityId === trigger.sourceEntityId;
}

export function evaluateCondition(trigger: RegisteredTrigger, context: TriggerMatchContext): boolean {
  if (typeof trigger.condition === 'function') {
    return trigger.condition(context);
  }

  if (trigger.matches) {
    return trigger.matches(context);
  }

  return true;
}

export function matchesTrigger(
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

export function sortTriggersForResolution(
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
