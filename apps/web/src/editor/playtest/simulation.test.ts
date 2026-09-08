/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyLabMove, createLabGame, DEFAULT_LAB_CONFIG, getLabLegalActions, normalizeLabConfig,
  recordLabMove, replayLabRun, SAMPLE_LAB_CARDS, simulateLabBatch, simulateLabGame, summarizeLabBatch,
} from './simulation';
import { createLabAgentPacket, parseLabAgentMove } from './packet';
import type { LabCard, LabRun } from './types';
import type { EditorProject } from '../types';

const config = { ...DEFAULT_LAB_CONFIG };
const cards = SAMPLE_LAB_CARDS.map((card) => ({ ...card }));

test('identical seed and settings produce identical setup, decisions and outcome', () => {
  assert.deepEqual(simulateLabGame(config, cards), simulateLabGame(config, cards));
  assert.notDeepEqual(createLabGame(config, cards).drawPile, createLabGame({ ...config, seed: 43 }, cards).drawPile);
});

test('illegal, unaffordable, out-of-turn and stale actions cannot mutate the table', () => {
  const state = createLabGame(config, cards);
  const before = structuredClone(state);
  assert.throws(() => applyLabMove(state, config, cards, { chosenActionId: 'buy:invented', expectedStep: 0 }), /not legal/);
  assert.throws(() => applyLabMove(state, config, cards, { chosenActionId: 'gather', expectedStep: 1 }), /older observation/);
  assert.throws(() => applyLabMove(state, config, cards, { chosenActionId: 'gather', expectedStep: 0 }, 1), /not active/);
  const expensive: LabCard[] = [{ id: 'expensive', name: 'Expensive', cost: 8, points: 10, quantity: 1 }];
  const expensiveState = createLabGame(config, expensive);
  assert.throws(() => applyLabMove(expensiveState, config, expensive, { chosenActionId: 'buy:expensive', expectedStep: 0 }), /not legal/);
  assert.deepEqual(state, before);
});

test('action economy and resource cap hold, and restarting produces the original setup', () => {
  const initial = createLabGame(config, cards);
  const afterOne = applyLabMove(initial, config, cards, { chosenActionId: 'gather', expectedStep: 0 });
  assert.equal(afterOne.actionsRemaining, 1);
  assert.equal(afterOne.players[0].resources, 4);
  const afterTwo = applyLabMove(afterOne, config, cards, { chosenActionId: 'gather', expectedStep: 1 });
  assert.equal(afterTwo.activeSeat, 1);
  assert.equal(afterTwo.turn, 2);
  assert.equal(afterTwo.actionsRemaining, 2);
  assert.deepEqual(createLabGame(config, cards), initial);
  const cappedConfig = { ...config, startingResources: 11 };
  const capped = applyLabMove(createLabGame(cappedConfig, cards), cappedConfig, cards, { chosenActionId: 'gather', expectedStep: 0 });
  assert.equal(capped.players[0].resources, 12);
  assert.equal(getLabLegalActions(capped, cappedConfig, cards).some((action) => action.id === 'gather'), false);
});

test('target score and exhausted supply end immediately with the correct winner', () => {
  const scoring: LabCard[] = [{ id: 'score', name: 'Score', cost: 0, points: 5, quantity: 2 }];
  const targetConfig = { ...config, targetScore: 5 };
  const won = applyLabMove(createLabGame(targetConfig, scoring), targetConfig, scoring, { chosenActionId: 'buy:score', expectedStep: 0 });
  assert.equal(won.winner, 0);
  assert.equal(won.endReason, 'target');
  assert.deepEqual(getLabLegalActions(won, targetConfig, scoring), []);
  const supply: LabCard[] = [{ ...scoring[0], quantity: 1 }];
  const exhausted = applyLabMove(createLabGame(config, supply), config, supply, { chosenActionId: 'buy:score', expectedStep: 0 });
  assert.equal(exhausted.endReason, 'supply-empty');
  assert.equal(exhausted.winner, 0);
});

test('blocked markets finish at the round limit, ties are draws and all simulations are bounded', () => {
  const blocked: LabCard[] = [{ id: 'blocked', name: 'Too costly', cost: 99, points: 1, quantity: 20 }];
  for (const strategy of ['balanced', 'greedy', 'random'] as const) {
    const result = simulateLabGame({ ...config, maxRounds: 3, challenger: strategy, opponent: strategy }, blocked);
    assert.equal(result.state.endReason, 'round-limit');
    assert.equal(result.state.winner, 'draw');
    assert.equal(result.state.turn, 6);
    assert.ok(result.transcript.length <= 12);
  }
});

test('session transcript reconstructs each state and never changes its card or settings snapshot', () => {
  const frozenConfig = structuredClone(config);
  const frozenCards = structuredClone(cards);
  const run: LabRun = { id: 'test', startedAt: '2026-01-01', version: { label: 'v1', sha: 'abc' },
    config: frozenConfig, cards: frozenCards, state: createLabGame(frozenConfig, frozenCards), transcript: [] };
  const advanced = recordLabMove(run, { chosenActionId: 'gather', expectedStep: 0 }, 'human');
  assert.deepEqual(replayLabRun(advanced), advanced.state);
  assert.deepEqual(replayLabRun(advanced, 0), run.state);
  const simulation = simulateLabGame(config, cards);
  const completed = { ...run, ...simulation };
  assert.deepEqual(replayLabRun(completed), simulation.state);
  assert.deepEqual(run.config, config);
  assert.deepEqual(run.cards, cards);
  assert.equal(run.state.step, 0);
});

test('batches use fresh state and matched seeds with swapped starters; every summary is computed from results', () => {
  const results = simulateLabBatch(config, cards, 20);
  assert.equal(results.length, 20);
  for (let index = 0; index < results.length; index += 2) {
    assert.equal(results[index].seed, results[index + 1].seed);
    assert.equal(results[index].firstPlayer, 0);
    assert.equal(results[index + 1].firstPlayer, 1);
    const independent = simulateLabGame({ ...config, seed: results[index].seed, firstPlayer: 0 }, cards);
    assert.equal(independent.state.winner, results[index].winner);
    assert.equal(independent.state.turn, results[index].turns);
  }
  const summary = summarizeLabBatch({ results });
  assert.equal(summary.wins + summary.losses + summary.draws, 20);
  assert.equal(summary.challengerWinRate, summary.wins / 20);
  assert.equal(summary.meanTurns, results.reduce((total, result) => total + result.turns, 0) / 20);
  assert.deepEqual(simulateLabBatch(config, cards, 20), results);
});

test('normalize bounds prevent unbounded configurations and invalid seeds', () => {
  const normalized = normalizeLabConfig({ actionsPerTurn: 100, maxRounds: Infinity, seed: NaN, resourceCap: 3, startingResources: 100 });
  assert.equal(normalized.actionsPerTurn, 5);
  assert.equal(normalized.maxRounds, 20);
  assert.equal(normalized.seed, 42);
  assert.equal(normalized.startingResources, 3);
});

test('agent packet separates public observation from referee secrets and validates response shape', () => {
  const run: LabRun = { id: 'test', startedAt: '2026-01-01', version: { label: 'v1', sha: 'abc' },
    config, cards, state: createLabGame(config, cards), transcript: [] };
  const project = { id: 'project', name: 'Game', description: 'A prototype', instances: {}, rootInstanceIds: [],
    rules: { rulesText: 'Reference rules', chapters: [], designerNotes: '', customComponents: [] } } as unknown as EditorProject;
  const packet = createLabAgentPacket(project, run);
  assert.equal('drawPile' in packet.observation, false);
  assert.equal('seed' in packet.observation, false);
  assert.equal(packet.observation.drawPileCount, run.state.drawPile.length);
  assert.deepEqual(packet.refereeReplay.fullState.drawPile, run.state.drawPile);
  assert.ok(packet.responseSchema.properties.chosenActionId.enum.includes('gather'));
  assert.equal(packet.session.version.sha, 'abc');
  assert.deepEqual(parseLabAgentMove('{"chosenActionId":"gather","expectedStep":0}'), { chosenActionId: 'gather', expectedStep: 0, rationale: undefined });
  assert.throws(() => parseLabAgentMove('{"chosenActionId":"gather"}'), /expectedStep/);
  assert.throws(() => parseLabAgentMove('not json'), /JSON/);
});
