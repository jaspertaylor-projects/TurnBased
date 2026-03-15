import { aiOutputEnvelopeSchema } from './schemas';
import { estimateTextTokens } from './budget';
import { serializeAIInputForLLM } from './summarizer';

import type {
  AIBot,
  AIDecisionContext,
  AIInputEnvelope,
  AIOutputEnvelope,
  ExperimentalLLMBotOptions,
  ExperimentalLLMBotResponse,
  HeuristicBotOptions,
  HeuristicProfileWeights,
} from './types';

import type { LegalAction, LegalSubChoice } from '@turnbased/engine-core';

function keywordScore(text: string, weights: Record<string, number>): number {
  const normalized = text.toLowerCase();
  return Object.entries(weights).reduce((score, [keyword, value]) => {
    return normalized.includes(keyword.toLowerCase()) ? score + value : score;
  }, 0);
}

function resolveProfileWeights(
  options: HeuristicBotOptions,
): Required<HeuristicProfileWeights> {
  const profile = options.profile ?? 'balanced';

  const base: Required<HeuristicProfileWeights> = {
    tagWeights: {
      win: 100,
      scoring: 32,
      score: 28,
      capture: 24,
      attack: 16,
      resource: 14,
      draw: 12,
      develop: 10,
      decision: 18,
      priority: -8,
      pass: -30,
    },
    actionTypeWeights: {
      CHOOSE_OPTION: 12,
      PASS_PRIORITY: -40,
    },
    keywordWeights: {
      win: 100,
      score: 24,
      capture: 18,
      draw: 12,
      resource: 10,
      pass: -16,
    },
    passPenalty: 30,
    costWeight: 1,
  };

  if (profile === 'aggressive') {
    base.tagWeights.attack += 10;
    base.tagWeights.capture += 12;
    base.keywordWeights.capture += 10;
    base.passPenalty += 10;
  } else if (profile === 'defensive') {
    base.tagWeights.resource += 8;
    base.tagWeights.develop += 8;
    base.tagWeights.attack -= 6;
    base.keywordWeights.pass += 6;
  } else if (profile === 'greedy') {
    base.tagWeights.score += 14;
    base.tagWeights.scoring += 14;
    base.tagWeights.resource += 12;
    base.keywordWeights.score += 16;
  }

  if (options.weights?.tagWeights) {
    Object.assign(base.tagWeights, options.weights.tagWeights);
  }

  if (options.weights?.actionTypeWeights) {
    Object.assign(base.actionTypeWeights, options.weights.actionTypeWeights);
  }

  if (options.weights?.keywordWeights) {
    Object.assign(base.keywordWeights, options.weights.keywordWeights);
  }

  if (typeof options.weights?.passPenalty === 'number') {
    base.passPenalty = options.weights.passPenalty;
  }

  if (typeof options.weights?.costWeight === 'number') {
    base.costWeight = options.weights.costWeight;
  }

  return base;
}

function pickSubChoiceSelection(subChoice: LegalSubChoice): string | string[] | undefined {
  const enabledOptions = subChoice.options.filter((option) => !option.disabled);

  if (enabledOptions.length === 0) {
    return undefined;
  }

  if (subChoice.maxChoices > 1) {
    return enabledOptions.slice(0, Math.max(subChoice.minChoices, 1)).map((option) => option.id);
  }

  return enabledOptions[0]?.id;
}

function buildDefaultParameters(action: LegalAction): AIOutputEnvelope['parameters'] {
  const parameters: NonNullable<AIOutputEnvelope['parameters']> = {};

  if (action.interactableEntities.length > 0) {
    parameters.selectedEntityId = action.interactableEntities[0];
  }

  if (action.validDestinations.length > 0) {
    parameters.destinationZoneId = action.validDestinations[0];
  }

  if (action.validTargets.length > 0) {
    parameters.targetEntityId = action.validTargets[0];
  }

  const subChoiceSelections = (action.subChoices ?? []).reduce<Record<string, string | number | boolean | string[]>>(
    (selections, subChoice) => {
      const selection = pickSubChoiceSelection(subChoice);
      if (selection !== undefined) {
        selections[subChoice.id] = selection;
      }
      return selections;
    },
    {},
  );

  if (Object.keys(subChoiceSelections).length > 0) {
    parameters.subChoiceSelections = subChoiceSelections;
  }

  return Object.keys(parameters).length > 0 ? parameters : undefined;
}

function scoreAction(
  action: LegalAction,
  weights: Required<HeuristicProfileWeights>,
): number {
  let score = 0;

  if (action.type === 'PASS_PRIORITY') {
    score -= weights.passPenalty;
  }

  score += weights.actionTypeWeights[action.type] ?? 0;

  for (const tag of action.tags) {
    score += weights.tagWeights[tag] ?? 0;
  }

  const searchableText = [action.displayName, action.description, action.explanation?.summary]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  score += keywordScore(searchableText, weights.keywordWeights);
  score += action.validTargets.length * 1.5;
  score += action.validDestinations.length;
  score += action.interactableEntities.length * 0.5;
  score += (action.subChoices?.length ?? 0) * 0.75;

  const totalCost = Object.values(action.cost ?? {}).reduce((sum, value) => sum + value, 0);
  score -= totalCost * weights.costWeight;

  return score;
}

export function createHeuristicBot(options: HeuristicBotOptions = {}): AIBot {
  const weights = resolveProfileWeights(options);

  return {
    id: options.id ?? `heuristic-${options.profile ?? 'balanced'}`,
    kind: 'heuristic',
    decide: async (input: AIInputEnvelope): Promise<AIOutputEnvelope> => {
      const startedAt = Date.now();
      const rankedActions = [...input.legalMoves.availableActions]
        .map((action) => ({
          action,
          score: scoreAction(action, weights),
        }))
        .sort((left, right) => {
          if (right.score !== left.score) {
            return right.score - left.score;
          }

          return left.action.id.localeCompare(right.action.id);
        });

      const selection = rankedActions[0]?.action;
      if (!selection) {
        throw new Error('No legal actions available for heuristic bot.');
      }

      return {
        chosenActionId: selection.id,
        parameters: buildDefaultParameters(selection),
        rationale: `Heuristic score ${rankedActions[0]?.score.toFixed(2)} for ${selection.displayName}.`,
        confidence: Math.min(0.95, 0.55 + Math.max(0, rankedActions[0]?.score ?? 0) / 100),
        thinkingTimeMs: Math.max(0, Date.now() - startedAt),
      };
    },
  };
}

function createSystemPrompt(options: ExperimentalLLMBotOptions): string {
  const baseInstructions = [
    'You are an experimental TurnBased AI seat.',
    'Choose exactly one action from legalMoves.availableActions.',
    'Never invent action ids or hidden information.',
    'Return JSON with keys: chosenActionId, parameters, rationale, confidence.',
    'Use parameters only for selectedEntityId, destinationZoneId, targetEntityId, and subChoiceSelections.',
    'Confidence must be a number from 0 to 1.',
  ];

  if (options.promptPreamble) {
    baseInstructions.unshift(options.promptPreamble.trim());
  }

  return baseInstructions.join('\n');
}

function normalizeLLMResponse(
  response: ExperimentalLLMBotResponse,
  startedAt: number,
  requestedModel: string,
): AIOutputEnvelope {
  const rawPayload =
    response.structuredOutput ??
    (response.textOutput
      ? JSON.parse(response.textOutput)
      : null);

  const parsed = aiOutputEnvelopeSchema.parse(rawPayload);
  const usage = response.usage
    ? {
        promptTokens: response.usage.promptTokens ?? 0,
        completionTokens: response.usage.completionTokens ?? 0,
        totalTokens:
          response.usage.totalTokens ??
          (response.usage.promptTokens ?? 0) + (response.usage.completionTokens ?? 0),
        estimatedCostUsd: response.usage.estimatedCostUsd,
        model: response.usage.model ?? response.model ?? requestedModel,
      }
    : undefined;

  return {
    ...parsed,
    thinkingTimeMs: Math.max(parsed.thinkingTimeMs, Date.now() - startedAt),
    usage,
    model: parsed.model ?? response.model ?? requestedModel,
  };
}

export function createExperimentalLLMBot(
  options: ExperimentalLLMBotOptions,
): AIBot {
  return {
    id: options.id ?? `llm-${options.model}`,
    kind: 'llm',
    decide: async (input: AIInputEnvelope, context: AIDecisionContext): Promise<AIOutputEnvelope> => {
      const startedAt = Date.now();
      const systemPrompt = createSystemPrompt(options);
      const userPrompt = serializeAIInputForLLM(input);
      const estimatedPromptTokens =
        estimateTextTokens(systemPrompt) + estimateTextTokens(userPrompt);
      const maxOutputTokens = options.maxOutputTokens ?? 300;
      const reservation = context.budgetController?.reserve({
        model: options.model,
        estimatedPromptTokens,
        estimatedCompletionTokens: maxOutputTokens,
      });

      if (reservation && !reservation.allowed) {
        if (options.fallbackBot) {
          return options.fallbackBot.decide(input, context);
        }

        throw new Error(reservation.reasons.join(' '));
      }

      const responsePromise = options.client.complete({
        model: options.model,
        systemPrompt,
        userPrompt,
        input,
        maxOutputTokens,
        temperature: options.temperature,
      });

      const response = options.timeoutMs
        ? await Promise.race([
            responsePromise,
            new Promise<ExperimentalLLMBotResponse>((_, reject) => {
              setTimeout(() => reject(new Error('LLM bot timed out.')), options.timeoutMs);
            }),
          ])
        : await responsePromise;

      const normalized = normalizeLLMResponse(response, startedAt, options.model);
      if (normalized.usage) {
        context.budgetController?.recordUsage(normalized.usage);
      }

      return normalized;
    },
  };
}
