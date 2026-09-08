import { nextRandomFloat } from '@turnbased/engine-core';
import type {
  LabAction, LabBatch, LabCard, LabConfig, LabGameResult, LabGameState,
  LabMove, LabRun, LabSeat, LabStrategy, LabTurnRecord, PlaytestLabState,
} from './types';

export const DEFAULT_LAB_CONFIG: LabConfig = {
  protocol: 'market-race-v1', seed: 42, targetScore: 15, maxRounds: 20,
  actionsPerTurn: 2, startingResources: 2, gatherAmount: 2, resourceCap: 12,
  marketSize: 5, firstPlayer: 0, opponent: 'balanced', challenger: 'greedy', cardSource: 'sample',
};

export const SAMPLE_LAB_CARDS: LabCard[] = [
  { id: 'sample-path', name: 'Woodland Path', cost: 1, points: 1, quantity: 7 },
  { id: 'sample-orchard', name: 'Wild Orchard', cost: 3, points: 3, quantity: 6 },
  { id: 'sample-workshop', name: 'The Workshop', cost: 4, points: 5, quantity: 5 },
  { id: 'sample-tower', name: 'Watchtower', cost: 6, points: 8, quantity: 4 },
  { id: 'sample-sanctuary', name: 'Forest Sanctuary', cost: 8, points: 12, quantity: 3 },
];

const integer = (value: number, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, Math.trunc(value))) : fallback;

export function normalizeLabConfig(config: Partial<LabConfig> = {}): LabConfig {
  const value = { ...DEFAULT_LAB_CONFIG, ...config };
  const resourceCap = integer(value.resourceCap, 12, 1, 100);
  const strategy = (candidate: LabStrategy) => ['balanced', 'greedy', 'random'].includes(candidate) ? candidate : 'balanced';
  return {
    protocol: 'market-race-v1', seed: integer(value.seed, 42, 0, 2147483647),
    targetScore: integer(value.targetScore, 15, 1, 999), maxRounds: integer(value.maxRounds, 20, 1, 100),
    actionsPerTurn: integer(value.actionsPerTurn, 2, 1, 5),
    startingResources: integer(value.startingResources, 2, 0, resourceCap),
    gatherAmount: integer(value.gatherAmount, 2, 1, 20), resourceCap,
    marketSize: integer(value.marketSize, 5, 1, 8), firstPlayer: value.firstPlayer === 1 ? 1 : 0,
    opponent: strategy(value.opponent), challenger: strategy(value.challenger),
    cardSource: value.cardSource === 'project' ? 'project' : 'sample',
  };
}

export function normalizeLabCards(cards: LabCard[]): LabCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (!card.id || seen.has(card.id) || card.quantity <= 0) return false;
    seen.add(card.id);
    return true;
  }).slice(0, 500).map((card) => ({
    id: card.id, name: card.name.trim() || 'Untitled card',
    cost: integer(card.cost, 0, 0, 999), points: integer(card.points, 0, 0, 999),
    quantity: integer(card.quantity, 1, 1, 100),
  }));
}

export function createPlaytestLabState(): PlaytestLabState {
  return { schemaVersion: 1, config: { ...DEFAULT_LAB_CONFIG }, activeRun: null, sessions: [], batches: [], findings: [] };
}

/** Avalanche nearby seeds/counters before the engine RNG, so paired experiments sample different deals. */
function labRandom(seed: number, callCount: number): number {
  let mixed = (seed + Math.imul(callCount + 1, 0x9e3779b9)) >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b);
  mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35);
  mixed = (mixed ^ (mixed >>> 16)) >>> 0;
  return nextRandomFloat({ seed: mixed, callCount: 0 }).value;
}

export function createLabGame(config: LabConfig, cards: LabCard[]): LabGameState {
  const supply = normalizeLabCards(cards).flatMap((card) => Array<string>(card.quantity).fill(card.id));
  if (!supply.length) throw new Error('Add at least one card with a positive quantity, or choose the sample deck.');
  const shuffled = [...supply];
  let callCount = 0;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(labRandom(config.seed, callCount++) * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return {
    seed: config.seed, turn: 1, activeSeat: config.firstPlayer,
    actionsRemaining: config.actionsPerTurn, step: 0,
    market: shuffled.slice(0, config.marketSize), drawPile: shuffled.slice(config.marketSize),
    players: [
      { score: 0, resources: config.startingResources, acquired: [] },
      { score: 0, resources: config.startingResources, acquired: [] },
    ],
    status: 'playing', winner: null, endReason: null,
  };
}

export function getLabLegalActions(state: LabGameState, config: LabConfig, cards: LabCard[]): LabAction[] {
  if (state.status !== 'playing') return [];
  const resources = state.players[state.activeSeat].resources;
  const legal: LabAction[] = [];
  if (resources < config.resourceCap) {
    legal.push({ id: 'gather', type: 'gather', label: `Gather ${Math.min(config.gatherAmount, config.resourceCap - resources)} coins` });
  }
  for (const id of new Set(state.market)) {
    const card = cards.find((item) => item.id === id);
    if (card && card.cost <= resources) legal.push({ id: `buy:${id}`, type: 'buy', cardId: id, label: `Buy ${card.name} · ${card.cost} coins → ${card.points} points` });
  }
  legal.push({ id: 'end-turn', type: 'end-turn', label: 'End turn' });
  return legal;
}

function finish(state: LabGameState, reason: LabGameState['endReason']): LabGameState {
  const [first, second] = state.players;
  return { ...state, status: 'finished', endReason: reason,
    winner: first.score === second.score ? 'draw' : first.score > second.score ? 0 : 1 };
}

/** Validates actor, freshness and legal action before a single immutable transition. */
export function applyLabMove(
  state: LabGameState, config: LabConfig, cards: LabCard[], move: LabMove, seat: LabSeat = state.activeSeat,
): LabGameState {
  if (seat !== state.activeSeat) throw new Error('This seat is not active.');
  if (move.expectedStep !== state.step) throw new Error('This move is for an older observation. Export the current state and try again.');
  const action = getLabLegalActions(state, config, cards).find((candidate) => candidate.id === move.chosenActionId);
  if (!action) throw new Error('That action is not legal in the current state.');
  const next: LabGameState = {
    ...state, step: state.step + 1, market: [...state.market], drawPile: [...state.drawPile],
    players: state.players.map((player) => ({ ...player, acquired: [...player.acquired] })) as LabGameState['players'],
  };
  const player = next.players[next.activeSeat];
  if (action.type === 'gather') player.resources = Math.min(config.resourceCap, player.resources + config.gatherAmount);
  if (action.type === 'buy') {
    const card = cards.find((candidate) => candidate.id === action.cardId)!;
    player.resources -= card.cost;
    player.score += card.points;
    player.acquired.push(card.id);
    next.market.splice(next.market.indexOf(card.id), 1);
    const refill = next.drawPile.shift();
    if (refill) next.market.push(refill);
    if (player.score >= config.targetScore) return finish(next, 'target');
    if (next.market.length === 0 && next.drawPile.length === 0) return finish(next, 'supply-empty');
  }
  next.actionsRemaining = action.type === 'end-turn' ? 0 : next.actionsRemaining - 1;
  if (next.actionsRemaining <= 0) {
    if (next.turn >= config.maxRounds * 2) return finish(next, 'round-limit');
    next.turn += 1;
    next.activeSeat = next.activeSeat === 0 ? 1 : 0;
    next.actionsRemaining = config.actionsPerTurn;
  }
  return next;
}

export const STRATEGY_DESCRIPTIONS: Record<LabStrategy, string> = {
  balanced: 'Chooses points per action, accounting for how many gathers a card needs. Takes a win immediately.',
  greedy: 'Buys the highest scoring affordable card; gathers when it cannot buy a scoring card.',
  random: 'Uses the seed to choose uniformly among legal buys and gathers; passes only when those are unavailable.',
};

export function chooseLabBotMove(state: LabGameState, config: LabConfig, cards: LabCard[], strategy: LabStrategy): LabMove {
  const legal = getLabLegalActions(state, config, cards);
  if (!legal.length) throw new Error('The game has ended.');
  const roll = labRandom(state.seed, state.step + 100003);
  const choose = <T,>(choices: T[]) => choices[Math.min(choices.length - 1, Math.floor(roll * choices.length))];
  let selection: LabAction | undefined;
  if (strategy === 'random') {
    const options = legal.filter((action) => action.type !== 'end-turn');
    selection = choose(options.length ? options : legal);
  } else {
    const player = state.players[state.activeSeat];
    const buys = legal.filter((action) => action.type === 'buy').map((action) => ({ action, card: cards.find((card) => card.id === action.cardId)! }));
    const winners = buys.filter(({ card }) => card.points + player.score >= config.targetScore);
    if (winners.length) selection = choose(winners).action;
    else if (strategy === 'greedy') {
      const score = Math.max(0, ...buys.map(({ card }) => card.points));
      if (score > 0) selection = choose(buys.filter(({ card }) => card.points === score)).action;
    } else {
      const candidates = [...new Set(state.market)].map((id) => cards.find((card) => card.id === id)!)
        .filter((card) => card.cost <= config.resourceCap && card.points > 0)
        .map((card) => ({ card, value: card.points / (1 + Math.ceil(Math.max(0, card.cost - player.resources) / config.gatherAmount)) }));
      const best = Math.max(0, ...candidates.map(({ value }) => value));
      const preferred = candidates.filter(({ value }) => value === best);
      if (preferred.length) {
        const target = choose(preferred).card;
        selection = legal.find((action) => action.id === `buy:${target.id}`);
      }
    }
    selection ??= legal.find((action) => action.type === 'gather') ?? legal.find((action) => action.type === 'end-turn');
  }
  return { chosenActionId: selection!.id, expectedStep: state.step, rationale: `${strategy}: ${selection!.label}.` };
}

export function recordLabMove(run: LabRun, move: LabMove, actor: LabTurnRecord['actor']): LabRun {
  const state = applyLabMove(run.state, run.config, run.cards, move);
  const label = getLabLegalActions(run.state, run.config, run.cards).find((action) => action.id === move.chosenActionId)!.label;
  return { ...run, state, transcript: [...run.transcript, {
    step: run.state.step, turn: run.state.turn, seat: run.state.activeSeat,
    actionId: move.chosenActionId, label, actor, rationale: move.rationale,
  }] };
}

export function replayLabRun(run: LabRun, steps = run.transcript.length): LabGameState {
  return run.transcript.slice(0, Math.max(0, steps)).reduce((state, record) =>
    applyLabMove(state, run.config, run.cards, { chosenActionId: record.actionId, expectedStep: record.step }, record.seat),
  createLabGame(run.config, run.cards));
}

export function simulateLabGame(config: LabConfig, cards: LabCard[]): { state: LabGameState; transcript: LabTurnRecord[] } {
  let state = createLabGame(config, cards);
  const transcript: LabTurnRecord[] = [];
  const maxActions = config.maxRounds * 2 * config.actionsPerTurn;
  while (state.status === 'playing' && transcript.length < maxActions) {
    const strategy = state.activeSeat === 0 ? config.challenger : config.opponent;
    const move = chooseLabBotMove(state, config, cards, strategy);
    const action = getLabLegalActions(state, config, cards).find((candidate) => candidate.id === move.chosenActionId)!;
    transcript.push({ step: state.step, turn: state.turn, seat: state.activeSeat, actionId: action.id, label: action.label, actor: 'bot', rationale: move.rationale });
    state = applyLabMove(state, config, cards, move);
  }
  if (state.status !== 'finished') throw new Error('Simulation exceeded its action bound.');
  return { state, transcript };
}

/** Alternate starting seats across identical seed pairs to expose first-player advantage. */
export function simulateLabBatch(config: LabConfig, cards: LabCard[], count: number): LabGameResult[] {
  return Array.from({ length: integer(count, 20, 2, 100) }, (_, index) => {
    const seed = (config.seed + Math.floor(index / 2)) % 2147483648;
    const firstPlayer: LabSeat = index % 2 === 0 ? 0 : 1;
    const { state, transcript } = simulateLabGame({ ...config, seed, firstPlayer }, cards);
    return { seed, firstPlayer, winner: state.winner!, turns: state.turn, actions: transcript.length,
      scores: [state.players[0].score, state.players[1].score], reason: state.endReason };
  });
}

export function summarizeLabBatch(batch: Pick<LabBatch, 'results'>) {
  const results = batch.results;
  const wins = results.filter((result) => result.winner === 0).length;
  const losses = results.filter((result) => result.winner === 1).length;
  const draws = results.length - wins - losses;
  return { games: results.length, wins, losses, draws,
    challengerWinRate: results.length ? wins / results.length : 0,
    firstPlayerWinRate: results.length ? results.filter((result) => result.winner === result.firstPlayer).length / results.length : 0,
    meanTurns: results.length ? results.reduce((sum, result) => sum + result.turns, 0) / results.length : 0,
    roundLimitGames: results.filter((result) => result.reason === 'round-limit').length,
  };
}
