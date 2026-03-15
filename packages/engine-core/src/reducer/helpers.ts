// ─── Reducer Helpers ────────────────────────────────────────────────

import type { ActionLogEntry, CanonicalAction } from '../actions';
import type { GameState, PlayerId } from '../state';

export function createActionLogId(version: number, timestamp: number): ActionLogEntry['id'] {
  return `act_v${version}_t${timestamp}` as ActionLogEntry['id'];
}

export function appendActionLog(
  state: GameState,
  action: CanonicalAction,
  nextState: GameState,
): GameState {
  const version = state.version + 1;
  const actionLogEntry: ActionLogEntry = {
    ...action,
    id: createActionLogId(version, action.timestamp),
  };

  return {
    ...nextState,
    version,
    actionLog: [...state.actionLog, actionLogEntry],
  };
}

export function reindexZonePositions(state: GameState, zoneId: string): void {
  const zone = state.zones[zoneId];
  if (!zone) {
    return;
  }

  zone.entityIds.forEach((entityId, index) => {
    const entity = state.entities[entityId];
    if (entity) {
      entity.position = index;
      entity.zoneId = zone.id;
    }
  });
}

export function insertIntoOrderedList<T>(
  items: readonly T[],
  value: T,
  position?: number,
): T[] {
  if (position === undefined || position < 0 || position >= items.length) {
    return [...items, value];
  }

  return [...items.slice(0, position), value, ...items.slice(position)];
}

export function getNextPlayerIndex(
  playerOrder: readonly PlayerId[],
  currentPlayerId: PlayerId,
  direction: 'forward' | 'reverse',
): number {
  const currentIndex = playerOrder.indexOf(currentPlayerId);

  if (currentIndex === -1) {
    return 0;
  }

  if (direction === 'reverse') {
    return (currentIndex - 1 + playerOrder.length) % playerOrder.length;
  }

  return (currentIndex + 1) % playerOrder.length;
}
