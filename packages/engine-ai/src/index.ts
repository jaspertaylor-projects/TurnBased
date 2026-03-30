// @turnbased/engine-ai
// AI play contracts, state summarizers, move-selection helpers, and bot runners.

export const AI_VERSION = '0.2.0';

export {
  createExperimentalLLMBot,
  createHeuristicBot,
} from './bots';
export {
  createAISeatBudgetController,
  estimateTextTokens,
} from './budget';
export {
  createAIInputEnvelope,
  serializeAIInputForLLM,
  summarizeRulesForAI,
} from './summarizer';
export {
  runBotTurn,
  validateAISelection,
} from './runner';
export {
  aiRulesComponentInstanceNoteSummarySchema,
  aiOutputEnvelopeSchema,
  aiOutputParametersSchema,
  aiRulesComponentManifestSummarySchema,
  aiRulesDocumentSchema,
  aiSeatBudgetConfigSchema,
  aiTokenUsageSchema,
} from './schemas';
export type {
  AIBot,
  AIDecisionContext,
  AIFallbackResolution,
  AIInputEnvelope,
  AIInputEnvelopeOptions,
  AIOutputEnvelope,
  AIOutputParameters,
  AIRulesComponentInstanceNoteSummary,
  AIPlayerInfo,
  AIRulesComponentManifestSummary,
  AIRulesDocument,
  AIRulesSummaryOptions,
  AIRulesSummarySource,
  AIRunnerOptions,
  AIRunnerResult,
  AISeatBudgetConfig,
  AISeatBudgetController,
  AISeatBudgetLedger,
  AISeatBudgetReservation,
  AISeatBudgetReservationRequest,
  AISeatBudgetSnapshot,
  AISelectionValidationResult,
  AITokenUsage,
  AITurnContext,
  ExperimentalLLMBotOptions,
  ExperimentalLLMBotRequest,
  ExperimentalLLMBotResponse,
  ExperimentalLLMClient,
  HeuristicBotOptions,
  HeuristicProfileWeights,
} from './types';
