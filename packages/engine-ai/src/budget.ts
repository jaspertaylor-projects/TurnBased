import type {
  AISeatBudgetConfig,
  AISeatBudgetController,
  AISeatBudgetLedger,
  AISeatBudgetReservation,
  AISeatBudgetReservationRequest,
  AISeatBudgetSnapshot,
  AITokenUsage,
} from './types';

export function estimateTextTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return Math.ceil(normalized.length / 4);
}

function createEmptyLedger(): AISeatBudgetLedger {
  return {
    promptTokensUsed: 0,
    completionTokensUsed: 0,
    totalTokensUsed: 0,
    callsUsed: 0,
    costUsdUsed: 0,
  };
}

function createSnapshot(
  config: AISeatBudgetConfig,
  ledger: AISeatBudgetLedger,
): AISeatBudgetSnapshot {
  return {
    remainingPromptTokens: Math.max(0, config.maxPromptTokens - ledger.promptTokensUsed),
    remainingCompletionTokens: Math.max(0, config.maxCompletionTokens - ledger.completionTokensUsed),
    remainingTotalTokens: Math.max(0, config.maxTotalTokens - ledger.totalTokensUsed),
    remainingCalls: Math.max(0, config.maxCalls - ledger.callsUsed),
    remainingCostUsd:
      typeof config.maxCostUsd === 'number'
        ? Math.max(0, config.maxCostUsd - ledger.costUsdUsed)
        : null,
    allowedModels: config.allowedModels ? [...config.allowedModels] : undefined,
  };
}

function evaluateReservation(
  config: AISeatBudgetConfig,
  ledger: AISeatBudgetLedger,
  request: AISeatBudgetReservationRequest,
): AISeatBudgetReservation {
  const reasons: string[] = [];
  const projectedPromptTokens = ledger.promptTokensUsed + request.estimatedPromptTokens;
  const projectedCompletionTokens = ledger.completionTokensUsed + request.estimatedCompletionTokens;
  const projectedTotalTokens = ledger.totalTokensUsed + request.estimatedPromptTokens + request.estimatedCompletionTokens;

  if (
    config.allowedModels &&
    request.model &&
    !config.allowedModels.includes(request.model)
  ) {
    reasons.push(`Model "${request.model}" is not in the allowlist.`);
  }

  if (projectedPromptTokens > config.maxPromptTokens) {
    reasons.push('Prompt token budget exceeded.');
  }

  if (projectedCompletionTokens > config.maxCompletionTokens) {
    reasons.push('Completion token budget exceeded.');
  }

  if (projectedTotalTokens > config.maxTotalTokens) {
    reasons.push('Total token budget exceeded.');
  }

  if (ledger.callsUsed + 1 > config.maxCalls) {
    reasons.push('Call budget exceeded.');
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    request,
    snapshot: createSnapshot(config, ledger),
  };
}

export function createAISeatBudgetController(
  config: AISeatBudgetConfig,
  initialLedger: Partial<AISeatBudgetLedger> = {},
): AISeatBudgetController {
  const ledger: AISeatBudgetLedger = {
    ...createEmptyLedger(),
    ...initialLedger,
  };

  return {
    config,
    ledger,
    reserve: (request) => evaluateReservation(config, ledger, request),
    recordUsage: (usage: AITokenUsage) => {
      ledger.promptTokensUsed += usage.promptTokens;
      ledger.completionTokensUsed += usage.completionTokens;
      ledger.totalTokensUsed += usage.totalTokens;
      ledger.callsUsed += 1;
      ledger.costUsdUsed += usage.estimatedCostUsd ?? 0;
    },
    snapshot: () => createSnapshot(config, ledger),
  };
}
