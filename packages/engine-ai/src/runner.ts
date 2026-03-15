import {
  generateLegalMoveTree,
  projectGameStateForAI,
} from '@turnbased/engine-core';
import type { LegalMoveRequest, ZoneId } from '@turnbased/engine-core';

import { createHeuristicBot } from './bots';
import { summarizeRulesForAI, createAIInputEnvelope } from './summarizer';

import type {
  AIBot,
  AIOutputEnvelope,
  AISelectionValidationResult,
  AIRunnerOptions,
  AIRunnerResult,
} from './types';

function normalizeOutputToRequest(output: AIOutputEnvelope) {
  return {
    actionId: output.chosenActionId,
    selectedEntityId: output.parameters?.selectedEntityId,
    destinationZoneId: output.parameters?.destinationZoneId as ZoneId | undefined,
    targetEntityId: output.parameters?.targetEntityId,
    subChoiceSelections: output.parameters?.subChoiceSelections,
  } satisfies LegalMoveRequest;
}

export function validateAISelection(
  moveTree: AIRunnerResult['moveTree'],
  output: AIOutputEnvelope,
): AISelectionValidationResult {
  const request = normalizeOutputToRequest(output);
  const validation = moveTree.validate(request);

  return {
    isValid: validation.isValid,
    request,
    errors: validation.errors,
    action: moveTree.getAction(output.chosenActionId) ?? null,
  };
}

async function resolveFallback(
  fallbackBot: AIBot | undefined,
  input: AIRunnerResult['input'],
  context: Parameters<AIBot['decide']>[1],
): Promise<{ output: AIOutputEnvelope; reason: string; botId?: string }> {
  const safeBot = fallbackBot ?? createHeuristicBot();
  const output = await safeBot.decide(input, context);
  return {
    output,
    reason: fallbackBot ? 'Primary bot failed or proposed an invalid move.' : 'Auto-generated heuristic fallback.',
    botId: safeBot.id,
  };
}

export async function runBotTurn(
  options: AIRunnerOptions,
): Promise<AIRunnerResult> {
  const moveTree = generateLegalMoveTree(options.state, {
    playerId: options.playerId,
    definitions: options.legalMoveDefinitions,
    visibility: options.visibility,
  });
  const gameState = projectGameStateForAI(options.state, options.playerId, options.visibility);
  const rulesSummary = summarizeRulesForAI(options.rules);
  const input = createAIInputEnvelope(options);
  const decisionContext = {
    state: options.state,
    playerId: options.playerId,
    moveTree,
    gameState,
    rulesSummary,
    budgetController: options.budgetController,
  };

  let output: AIOutputEnvelope;
  let fallback: AIRunnerResult['fallback'];

  try {
    output = await options.bot.decide(input, decisionContext);
  } catch (_error) {
    const fallbackResolution = await resolveFallback(options.fallbackBot, input, decisionContext);
    output = fallbackResolution.output;
    fallback = {
      reason: fallbackResolution.reason,
      botId: fallbackResolution.botId,
    };
  }

  let selection = validateAISelection(moveTree, output);
  if (!selection.isValid || !selection.action) {
    const fallbackResolution = await resolveFallback(options.fallbackBot, input, decisionContext);
    output = fallbackResolution.output;
    selection = validateAISelection(moveTree, output);

    fallback = {
      reason: `${fallbackResolution.reason} ${selection.errors.join(' ')}`.trim(),
      botId: fallbackResolution.botId,
    };
  }

  if (!selection.isValid || !selection.action) {
    throw new Error(selection.errors.join(' ') || 'AI seat could not produce a valid legal move.');
  }

  return {
    input,
    output,
    moveTree,
    request: selection.request,
    selectedAction: selection.action,
    canonicalActions: moveTree.materialize(selection.request),
    fallback,
  };
}
