export { placementReferenceGame } from './game-placement';
export { cardBattleReferenceGame } from './game-card-battle';
export { workerPlacementReferenceGame } from './game-worker-placement';
export { turnOrderChaosReferenceGame } from './game-turn-order-chaos';

import { placementReferenceGame } from './game-placement';
import { cardBattleReferenceGame } from './game-card-battle';
import { workerPlacementReferenceGame } from './game-worker-placement';
import { turnOrderChaosReferenceGame } from './game-turn-order-chaos';

import type { SampleGameDefinition } from './types';

export const sampleGames = [
  placementReferenceGame,
  cardBattleReferenceGame,
  workerPlacementReferenceGame,
  turnOrderChaosReferenceGame,
];

export const sampleGamesById = Object.fromEntries(
  sampleGames.map((game) => [game.id, game]),
) as Record<string, SampleGameDefinition>;

export const sampleGameRegressionPack = sampleGames.flatMap((game) => game.regressionCases);
