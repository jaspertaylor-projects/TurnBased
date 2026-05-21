import type { CanonicalAction } from '../actions';
import type { GameState, PriorityPolicy } from '../state';
import {
  areAllPriorityParticipantsPassed,
  closePriorityWindow,
  currentPriorityPlayerHasDecision,
  openPriorityWindow,
} from './priority';
import type {
  DispatchCanonicalActionFn,
  DispatchOptions,
} from './trigger-stack';
import {
  getNextSyntheticTimestamp,
  hasUnresolvedStackItems,
  resolveTopStackItem,
} from './trigger-stack';
import type {
  DomainEvent,
  PriorityResponderContext,
  RegisteredTrigger,
  TriggerDispatchResult,
  TriggerEngineOptions,
} from './types';

export interface PriorityOptions extends DispatchOptions {
  priorityPolicy: PriorityPolicy;
  canPlayerRespond?: TriggerEngineOptions['canPlayerRespond'];
}

export function isExternallyControlledAction(action: CanonicalAction): boolean {
  return action.source.type === 'player' || action.source.type === 'ai';
}

export function assertPriorityActor(state: GameState, action: CanonicalAction): void {
  if (!state.priorityWindow.isOpen || !isExternallyControlledAction(action)) {
    return;
  }

  const currentPlayerId = state.priorityWindow.currentPlayerId;
  if (!currentPlayerId || action.source.playerId !== currentPlayerId) {
    throw new Error('Only the current priority player may act while a response window is open');
  }
}

export function shouldOpenPriorityWindow(
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

export function currentPlayerCanRespond(
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

export function settlePriorityWindow(
  state: GameState,
  triggers: readonly RegisteredTrigger[],
  options: PriorityOptions,
  depth: number,
  dispatchFn: DispatchCanonicalActionFn,
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
        dispatchFn,
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

    const passResult = dispatchFn(
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
