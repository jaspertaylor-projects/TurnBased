import type {
  CanonicalAction,
  CompiledLegalMoveTree,
  GameDefinition,
  GameState,
  LegalAction,
  LegalMoveDefinition,
  LegalMoveRequest,
  LegalMoveTree,
  PlayerId,
  PlayerVisibleState,
  VisibilityProjectionOptions,
  VisibleActionLogEntry,
} from '@turnbased/engine-core';

export interface AIPlayerInfo {
  playerId: PlayerId;
  role: string;
  seatIndex: number;
  displayName: string;
}

export interface AITurnContext {
  roundNumber: number;
  turnNumber: number;
  phase: string;
  step: string;
  activePlayerId: PlayerId;
  priorityWindowOpen: boolean;
  pendingDecisionId?: string;
}

export interface AITokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
  model?: string;
}

export interface AISeatBudgetConfig {
  maxPromptTokens: number;
  maxCompletionTokens: number;
  maxTotalTokens: number;
  maxCalls: number;
  maxCostUsd?: number;
  allowedModels?: string[];
}

export interface AISeatBudgetLedger {
  promptTokensUsed: number;
  completionTokensUsed: number;
  totalTokensUsed: number;
  callsUsed: number;
  costUsdUsed: number;
}

export interface AISeatBudgetSnapshot {
  remainingPromptTokens: number;
  remainingCompletionTokens: number;
  remainingTotalTokens: number;
  remainingCalls: number;
  remainingCostUsd: number | null;
  allowedModels?: string[];
}

export interface AISeatBudgetReservationRequest {
  model?: string;
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
}

export interface AISeatBudgetReservation {
  allowed: boolean;
  reasons: string[];
  request: AISeatBudgetReservationRequest;
  snapshot: AISeatBudgetSnapshot;
}

export interface AISeatBudgetController {
  readonly config: AISeatBudgetConfig;
  readonly ledger: AISeatBudgetLedger;
  reserve: (request: AISeatBudgetReservationRequest) => AISeatBudgetReservation;
  recordUsage: (usage: AITokenUsage) => void;
  snapshot: () => AISeatBudgetSnapshot;
}

export interface AIRulesDocument {
  title: string;
  content: string;
  priority?: number;
}

export interface AIRulesComponentManifestSummary {
  type: string;
  displayName: string;
  description?: string;
  category?: string;
  tags?: string[];
}

export interface AIRulesComponentInstanceNoteSummary {
  instanceId: string;
  componentType: string;
  displayName: string;
  notes: string;
}

export interface AIRulesSummarySource {
  gameDefinition?: Pick<
    GameDefinition,
    'name' | 'description' | 'rulesText' | 'winCondition' | 'priorityPolicy' | 'phases'
  >;
  rulesText?: string;
  documents?: AIRulesDocument[];
  componentManifests?: AIRulesComponentManifestSummary[];
  componentInstanceNotes?: AIRulesComponentInstanceNoteSummary[];
  additionalNotes?: string[];
}

export interface AIRulesSummaryOptions {
  maxCharacters?: number;
  includeTurnStructure?: boolean;
  includePriorityPolicy?: boolean;
  includeComponents?: boolean;
}

export interface AIInputEnvelope {
  gameState: PlayerVisibleState;
  legalMoves: LegalMoveTree;
  playerInfo: AIPlayerInfo;
  gameRulesSummary: string;
  recentHistory: VisibleActionLogEntry[];
  strategyProfile?: string;
  turnContext: AITurnContext;
  budget?: AISeatBudgetSnapshot;
}

export interface AIOutputParameters {
  selectedEntityId?: string;
  destinationZoneId?: string;
  targetEntityId?: string;
  subChoiceSelections?: Record<string, string | number | boolean | string[]>;
}

export interface AIOutputEnvelope {
  chosenActionId: string;
  parameters?: AIOutputParameters;
  rationale?: string;
  confidence: number;
  thinkingTimeMs: number;
  usage?: AITokenUsage;
  model?: string;
}

export interface AISelectionValidationResult {
  isValid: boolean;
  request: LegalMoveRequest;
  errors: string[];
  action: LegalAction | null;
}

export interface AIDecisionContext {
  state: GameState;
  playerId: PlayerId;
  moveTree: CompiledLegalMoveTree;
  gameState: PlayerVisibleState;
  rulesSummary: string;
  budgetController?: AISeatBudgetController;
}

export interface AIBot {
  id: string;
  kind: 'heuristic' | 'llm' | 'custom';
  decide: (input: AIInputEnvelope, context: AIDecisionContext) => Promise<AIOutputEnvelope>;
}

export interface HeuristicProfileWeights {
  tagWeights?: Record<string, number>;
  actionTypeWeights?: Record<string, number>;
  keywordWeights?: Record<string, number>;
  passPenalty?: number;
  costWeight?: number;
}

export interface HeuristicBotOptions {
  id?: string;
  profile?: 'balanced' | 'aggressive' | 'defensive' | 'greedy';
  weights?: HeuristicProfileWeights;
}

export interface ExperimentalLLMBotRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  input: AIInputEnvelope;
  maxOutputTokens: number;
  temperature?: number;
}

export interface ExperimentalLLMBotResponse {
  structuredOutput?: unknown;
  textOutput?: string;
  usage?: Partial<AITokenUsage>;
  model?: string;
}

export interface ExperimentalLLMClient {
  complete: (request: ExperimentalLLMBotRequest) => Promise<ExperimentalLLMBotResponse>;
}

export interface ExperimentalLLMBotOptions {
  id?: string;
  model: string;
  client: ExperimentalLLMClient;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  fallbackBot?: AIBot;
  promptPreamble?: string;
}

export interface AIInputEnvelopeOptions {
  state: GameState;
  playerId: PlayerId;
  legalMoveDefinitions?: LegalMoveDefinition[];
  visibility?: VisibilityProjectionOptions;
  rules?: AIRulesSummarySource;
  strategyProfile?: string;
  recentHistoryLimit?: number;
  budgetController?: AISeatBudgetController;
}

export interface AIFallbackResolution {
  reason: string;
  botId?: string;
}

export interface AIRunnerOptions extends AIInputEnvelopeOptions {
  bot: AIBot;
  fallbackBot?: AIBot;
}

export interface AIRunnerResult {
  input: AIInputEnvelope;
  output: AIOutputEnvelope;
  moveTree: CompiledLegalMoveTree;
  request: LegalMoveRequest;
  selectedAction: LegalAction;
  canonicalActions: CanonicalAction[];
  fallback?: AIFallbackResolution;
}
