import { getNextPlayerIndex } from '../reducer';
import type {
  GameState,
  PlayerId,
  PriorityWindowSource,
  PriorityWindowState,
} from '../state';

export function createClosedPriorityWindow(): PriorityWindowState {
  return {
    isOpen: false,
    currentPlayerId: null,
    passedPlayerIds: [],
    openedBy: null,
  };
}

export function getPriorityParticipants(state: GameState): PlayerId[] {
  return state.playerOrder.filter((playerId) => {
    const player = state.players[playerId];
    return player && !player.isEliminated;
  });
}

export function getPriorityOrder(
  state: GameState,
  startingPlayerId: PlayerId = state.turnState.activePlayerId,
): PlayerId[] {
  const participants = getPriorityParticipants(state);
  if (participants.length === 0) {
    return [];
  }

  const order: PlayerId[] = [];
  let currentPlayerId = startingPlayerId;

  for (let index = 0; index < participants.length; index += 1) {
    order.push(currentPlayerId);
    currentPlayerId =
      participants[
        getNextPlayerIndex(participants, currentPlayerId, state.turnState.turnDirection)
      ];
  }

  return order;
}

export function openPriorityWindow(
  state: GameState,
  openedBy: PriorityWindowSource,
  currentPlayerId: PlayerId = state.turnState.activePlayerId,
): GameState {
  return {
    ...state,
    priorityWindow: {
      isOpen: true,
      currentPlayerId,
      passedPlayerIds: [],
      openedBy,
    },
  };
}

export function closePriorityWindow(state: GameState): GameState {
  return {
    ...state,
    priorityWindow: createClosedPriorityWindow(),
  };
}

export function areAllPriorityParticipantsPassed(state: GameState): boolean {
  const participants = getPriorityParticipants(state);
  if (participants.length === 0) {
    return true;
  }

  return participants.every((playerId) => state.priorityWindow.passedPlayerIds.includes(playerId));
}

export function currentPriorityPlayerHasDecision(state: GameState): boolean {
  const currentPlayerId = state.priorityWindow.currentPlayerId;
  if (!currentPlayerId) {
    return false;
  }

  return state.pendingDecisions.some((decision) => decision.playerId === currentPlayerId);
}
