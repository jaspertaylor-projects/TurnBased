export type LabStrategy = 'balanced' | 'greedy' | 'random';
export type LabSeat = 0 | 1;
export type LabCardSource = 'sample' | 'project';

export interface LabCard {
  id: string;
  name: string;
  cost: number;
  points: number;
  quantity: number;
}

/** The supported, executable rules. Prose and card abilities remain reference material. */
export interface LabConfig {
  protocol: 'market-race-v1';
  seed: number;
  targetScore: number;
  maxRounds: number;
  actionsPerTurn: number;
  startingResources: number;
  gatherAmount: number;
  resourceCap: number;
  marketSize: number;
  firstPlayer: LabSeat;
  opponent: LabStrategy;
  challenger: LabStrategy;
  cardSource: LabCardSource;
}

export interface LabPlayer {
  score: number;
  resources: number;
  acquired: string[];
}

export interface LabGameState {
  seed: number;
  turn: number;
  activeSeat: LabSeat;
  actionsRemaining: number;
  step: number;
  market: string[];
  drawPile: string[];
  players: [LabPlayer, LabPlayer];
  status: 'playing' | 'finished';
  winner: LabSeat | 'draw' | null;
  endReason: 'target' | 'round-limit' | 'supply-empty' | null;
}

export interface LabAction {
  id: string;
  type: 'gather' | 'buy' | 'end-turn';
  label: string;
  cardId?: string;
}

export interface LabMove {
  chosenActionId: string;
  expectedStep: number;
  rationale?: string;
}

export interface LabTurnRecord {
  step: number;
  turn: number;
  seat: LabSeat;
  actionId: string;
  label: string;
  actor: 'human' | 'bot' | 'agent';
  rationale?: string;
}

export interface LabVersionRef {
  label: string;
  sha: string | null;
}

export interface LabRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  version: LabVersionRef;
  config: LabConfig;
  cards: LabCard[];
  state: LabGameState;
  transcript: LabTurnRecord[];
}

export interface LabGameResult {
  seed: number;
  firstPlayer: LabSeat;
  winner: LabSeat | 'draw';
  turns: number;
  actions: number;
  scores: [number, number];
  reason: LabGameState['endReason'];
}

export interface LabBatch {
  id: string;
  createdAt: string;
  version: LabVersionRef;
  config: LabConfig;
  cards: LabCard[];
  results: LabGameResult[];
}

export interface LabFinding {
  id: string;
  text: string;
  status: 'open' | 'resolved';
  createdAt: string;
  version: LabVersionRef;
  sessionId: string | null;
}

export interface PlaytestLabState {
  schemaVersion: 1;
  config: LabConfig;
  activeRun: LabRun | null;
  sessions: LabRun[];
  batches: LabBatch[];
  findings: LabFinding[];
}
