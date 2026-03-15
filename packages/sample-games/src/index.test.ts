import { describe, expect, it } from 'vitest';
import {
  generateLegalMoveTree,
  getValidEntitiesForDestination,
  hashGameState,
} from '@turnbased/engine-core';
import { createZoneId } from '@turnbased/shared-types';

import {
  assertExpectedOutcome,
  cardBattleReferenceGame,
  createReplayRecord,
  replayRecord,
  runRandomSimulation,
  runRegressionCase,
  runSelfPlaySimulation,
  sampleGameRegressionPack,
  sampleGames,
  turnOrderChaosReferenceGame,
  workerPlacementReferenceGame,
} from './index';

describe('@turnbased/sample-games', () => {
  it('registers four representative archetype reference games', () => {
    expect(sampleGames.map((game) => game.id)).toEqual([
      'tic-tac-toe-reference',
      'card-battle-reference',
      'resource-collector-reference',
      'turn-order-chaos-reference',
    ]);
  });

  it('supports destination-first worker placement queries', () => {
    const state = workerPlacementReferenceGame.createInitialState();
    const moveTree = generateLegalMoveTree(state, {
      playerId: state.turnState.activePlayerId,
      definitions: workerPlacementReferenceGame.legalMoveDefinitions,
    });

    expect(getValidEntitiesForDestination(moveTree, createZoneId('zone_worker_forest'))).toEqual([
      'ent_worker_forager',
    ]);
  });

  it('replays self-play simulations deterministically', async () => {
    const result = await runSelfPlaySimulation(cardBattleReferenceGame, {
      seed: 17,
      maxTurns: 12,
    });
    const replay = replayRecord(cardBattleReferenceGame, createReplayRecord(result, 17));

    expect(result.completed).toBe(true);
    expect(replay.matches).toBe(true);
    expect(replay.actualFinalStateHash).toBe(result.finalStateHash);
  });

  it('runs random simulations across all reference games without stalling immediately', async () => {
    const results = await Promise.all(
      sampleGames.map((game) =>
        runRandomSimulation(game, {
          seed: 41,
          maxTurns: 20,
        }),
      ),
    );

    expect(results.every((result) => result.steps.length > 0)).toBe(true);
    expect(results.every((result) => result.finalStateHash === hashGameState(result.finalState))).toBe(true);
  });

  it('captures extra turns in self-play and reverse order in regression playback', async () => {
    const result = await runSelfPlaySimulation(turnOrderChaosReferenceGame, {
      seed: 29,
      maxTurns: 12,
    });
    const reverseCase = turnOrderChaosReferenceGame.regressionCases.find(
      (testCase) => testCase.id === 'chaos_reverse_changes_order',
    );

    expect(result.steps.some((step) => step.submittedActions.some((action) => action.type === 'ADD_EXTRA_TURN'))).toBe(true);
    expect(reverseCase).toBeTruthy();
    if (!reverseCase) {
      return;
    }

    const finalState = runRegressionCase(turnOrderChaosReferenceGame, reverseCase.submittedActions);
    expect(finalState.turnState.turnDirection).toBe('reverse');
    expect(finalState.turnState.activePlayerId).toBe('player_chaos_three');
  });

  it('validates the regression case pack', () => {
    for (const testCase of sampleGameRegressionPack) {
      const game = sampleGames.find((candidate) => candidate.id === testCase.gameId);
      expect(game, `Missing game for regression case ${testCase.id}`).toBeTruthy();
      if (!game) {
        continue;
      }

      const finalState = runRegressionCase(game, testCase.submittedActions);
      expect(() => assertExpectedOutcome(finalState, testCase.expected)).not.toThrow();
    }
  });
});
