import type {
  AIBot,
  AIRulesSummarySource,
} from '@turnbased/engine-ai';
import type {
  CanonicalAction,
  GameDefinition,
  GameState,
  LegalMoveDefinition,
  PlayerId,
  TriggerRegistration,
} from '@turnbased/engine-core';
import type {
  EntityId,
  ParticipantRole,
  ZoneId,
} from '@turnbased/shared-types';

export interface SampleGameStateOptions {
  seed?: number;
  playerRoles?: ParticipantRole[];
}

export interface SampleGameExpectedOutcome {
  status?: GameState['status'];
  winner?: GameState['winner'];
  activePlayerId?: PlayerId;
  turnDirection?: GameState['turnState']['turnDirection'];
  scores?: Record<string, number>;
  resources?: Record<string, Record<string, number>>;
  zoneContents?: Record<string, string[]>;
  stateHash?: number;
}

export interface SampleGameRegressionCase {
  id: string;
  gameId: string;
  description: string;
  submittedActions: CanonicalAction[];
  expected: SampleGameExpectedOutcome;
}

export interface SampleGameDefinition {
  id: string;
  name: string;
  archetype: string;
  description: string;
  gameDefinition: GameDefinition;
  legalMoveDefinitions: LegalMoveDefinition[];
  triggers: TriggerRegistration[];
  rules: AIRulesSummarySource;
  createInitialState: (options?: SampleGameStateOptions) => GameState;
  regressionCases: SampleGameRegressionCase[];
}

export interface SimulationSeatConfig {
  mode: 'random' | 'heuristic';
  role?: ParticipantRole;
  bot?: AIBot;
  strategyProfile?: 'balanced' | 'aggressive' | 'defensive' | 'greedy';
}

export interface SimulationOptions {
  maxTurns?: number;
  seed?: number;
  seats?: Record<string, SimulationSeatConfig>;
}

export interface SimulationStepRecord {
  turnIndex: number;
  playerId: PlayerId;
  actionSource: 'random' | 'heuristic';
  submittedActions: CanonicalAction[];
  stateHashAfterStep: number;
}

export interface SimulationResult {
  gameId: string;
  mode: 'random' | 'self-play' | 'custom';
  completed: boolean;
  stopReason: 'finished' | 'max_turns' | 'no_legal_actions';
  finalState: GameState;
  finalStateHash: number;
  rootActions: CanonicalAction[];
  steps: SimulationStepRecord[];
}

export interface ReplayRecord {
  gameId: string;
  seed: number;
  playerRoles?: ParticipantRole[];
  rootActions: CanonicalAction[];
  expectedFinalStateHash?: number;
}

export interface ReplayVerificationResult {
  matches: boolean;
  expectedFinalStateHash: number | null;
  actualFinalStateHash: number;
  finalState: GameState;
}

export interface SamplePlayerDefinition {
  id: PlayerId;
  displayName: string;
  role?: ParticipantRole;
  score?: number;
  resources?: Record<string, number>;
  properties?: Record<string, unknown>;
  isEliminated?: boolean;
}

export interface SampleZoneDefinition {
  id: ZoneId;
  type: string;
  name: string;
  ownerId?: PlayerId | null;
  maxCapacity?: number | null;
  defaultVisibility?: '@public' | '@private' | '@hidden';
  properties?: Record<string, unknown>;
}

export interface SampleEntityDefinition {
  id: EntityId;
  type: string;
  componentType: string;
  zoneId: ZoneId;
  ownerId?: PlayerId | null;
  controllerId?: PlayerId | null;
  faceUp?: boolean;
  properties?: Record<string, unknown>;
  tags?: string[];
  position?: number;
}
