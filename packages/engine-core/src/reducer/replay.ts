// ─── Replay And Determinism Helpers ─────────────────────────────────

import { canonicalSerialize, hashValue } from '@turnbased/shared-utils';

import type { CanonicalAction } from '../actions';
import type { GameState } from '../state';
import { reduceGameState } from './reducer';

export function replayCanonicalActions(
  initialState: GameState,
  actions: readonly CanonicalAction[],
): GameState {
  return actions.reduce((state, action) => reduceGameState(state, action), initialState);
}

export function serializeGameState(state: GameState): string {
  return canonicalSerialize(state);
}

export function hashGameState(state: GameState): number {
  return hashValue(state);
}
