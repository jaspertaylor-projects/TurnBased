// ─── Deterministic RNG Helpers ──────────────────────────────────────

import type { RandomState } from '../state';

export interface RandomFloatResult {
  value: number;
  randomState: RandomState;
}

function xorshift32(seed: number): number {
  let value = seed | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function nextRandomFloat(randomState: RandomState): RandomFloatResult {
  const baseSeed = (randomState.seed ^ (randomState.callCount + 0x9e3779b9)) >>> 0;
  const nextSeed = xorshift32(baseSeed);

  return {
    value: nextSeed / 0x100000000,
    randomState: {
      ...randomState,
      callCount: randomState.callCount + 1,
    },
  };
}

export function shuffleWithRandomState<T>(
  items: readonly T[],
  randomState: RandomState,
): { values: T[]; randomState: RandomState } {
  const values = [...items];
  let currentRandomState = randomState;

  for (let index = values.length - 1; index > 0; index -= 1) {
    const result = nextRandomFloat(currentRandomState);
    const swapIndex = Math.floor(result.value * (index + 1));
    currentRandomState = result.randomState;
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }

  return {
    values,
    randomState: currentRandomState,
  };
}
