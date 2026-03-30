import type { PhaseDefinition } from '@turnbased/engine-core';

import type {
  AIInputEnvelope,
  AIRulesComponentInstanceNoteSummary,
  AIInputEnvelopeOptions,
  AIRulesComponentManifestSummary,
  AIRulesDocument,
  AIRulesSummaryOptions,
  AIRulesSummarySource,
} from './types';

import {
  generateLegalMoveTree,
  projectGameStateForAI,
} from '@turnbased/engine-core';

function formatPhaseSummary(phases: readonly PhaseDefinition[]): string | null {
  if (phases.length === 0) {
    return null;
  }

  return phases
    .map((phase) => `${phase.name}: ${phase.steps.map((step) => step.name).join(' -> ')}`)
    .join('; ');
}

function sortDocuments(documents: readonly AIRulesDocument[]): AIRulesDocument[] {
  return [...documents].sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0));
}

function summarizeComponents(
  manifests: readonly AIRulesComponentManifestSummary[],
): string | null {
  if (manifests.length === 0) {
    return null;
  }

  return manifests
    .slice(0, 6)
    .map((manifest) => {
      const fragments = [
        manifest.displayName,
        manifest.category ? `(${manifest.category})` : null,
        manifest.description ?? null,
      ].filter((value): value is string => Boolean(value));

      return fragments.join(' ');
    })
    .join('; ');
}

function summarizeComponentNotes(
  componentNotes: readonly AIRulesComponentInstanceNoteSummary[],
): string | null {
  if (componentNotes.length === 0) {
    return null;
  }

  return componentNotes
    .slice(0, 8)
    .map((componentNote) => `${componentNote.displayName} (${componentNote.componentType}): ${componentNote.notes}`)
    .join('; ');
}

function trimToCharacterBudget(
  sections: string[],
  maxCharacters: number,
): string {
  const lines: string[] = [];
  let characterCount = 0;

  for (const section of sections) {
    const normalized = section.trim();
    if (!normalized) {
      continue;
    }

    const nextCount = characterCount + normalized.length + (lines.length > 0 ? 2 : 0);
    if (nextCount > maxCharacters) {
      const remaining = maxCharacters - characterCount - (lines.length > 0 ? 2 : 0);
      if (remaining > 12) {
        lines.push(`${normalized.slice(0, Math.max(0, remaining - 1)).trimEnd()}…`);
      }
      break;
    }

    lines.push(normalized);
    characterCount = nextCount;
  }

  return lines.join('\n\n');
}

export function summarizeRulesForAI(
  source: AIRulesSummarySource = {},
  options: AIRulesSummaryOptions = {},
): string {
  const sections: string[] = [];
  const maxCharacters = options.maxCharacters ?? 2400;
  const includeTurnStructure = options.includeTurnStructure ?? true;
  const includePriorityPolicy = options.includePriorityPolicy ?? true;
  const includeComponents = options.includeComponents ?? true;

  if (source.gameDefinition?.name) {
    sections.push(`Game: ${source.gameDefinition.name}`);
  }

  if (source.gameDefinition?.description) {
    sections.push(`Overview: ${source.gameDefinition.description}`);
  }

  const rulesText = source.rulesText ?? source.gameDefinition?.rulesText;
  if (rulesText) {
    sections.push(`Rules: ${rulesText}`);
  }

  if (source.gameDefinition?.winCondition) {
    sections.push(`Win condition: ${source.gameDefinition.winCondition}`);
  }

  if (includeTurnStructure && source.gameDefinition?.phases) {
    const phaseSummary = formatPhaseSummary(source.gameDefinition.phases);
    if (phaseSummary) {
      sections.push(`Turn structure: ${phaseSummary}`);
    }
  }

  if (includePriorityPolicy && source.gameDefinition?.priorityPolicy) {
    const responseEvents = source.gameDefinition.priorityPolicy.responseEvents?.join(', ');
    const policySummary = [
      `Priority: ${source.gameDefinition.priorityPolicy.mode} mode`,
      source.gameDefinition.priorityPolicy.autoPassEnabled ? 'auto-pass on empty responses' : null,
      responseEvents ? `response events: ${responseEvents}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(', ');

    if (policySummary) {
      sections.push(policySummary);
    }
  }

  if (source.documents?.length) {
    for (const document of sortDocuments(source.documents)) {
      sections.push(`${document.title}: ${document.content}`);
    }
  }

  if (includeComponents && source.componentManifests?.length) {
    const componentSummary = summarizeComponents(source.componentManifests);
    if (componentSummary) {
      sections.push(`Components: ${componentSummary}`);
    }
  }

  if (source.componentInstanceNotes?.length) {
    const componentNotesSummary = summarizeComponentNotes(source.componentInstanceNotes);
    if (componentNotesSummary) {
      sections.push(`Component notes: ${componentNotesSummary}`);
    }
  }

  if (source.additionalNotes?.length) {
    sections.push(`Notes: ${source.additionalNotes.join(' ')}`);
  }

  return trimToCharacterBudget(sections, maxCharacters);
}

export function createAIInputEnvelope(
  options: AIInputEnvelopeOptions,
): AIInputEnvelope {
  const moveTree = generateLegalMoveTree(options.state, {
    playerId: options.playerId,
    definitions: options.legalMoveDefinitions,
    visibility: options.visibility,
  });
  const projectedState = projectGameStateForAI(
    options.state,
    options.playerId,
    options.visibility,
  );
  const player = options.state.players[options.playerId];
  const rulesSummary = summarizeRulesForAI(options.rules);
  const recentHistoryLimit = options.recentHistoryLimit ?? 12;
  const pendingDecisionId =
    projectedState.pendingDecisions.find((decision) => decision.playerId === options.playerId)?.id;

  return {
    gameState: projectedState,
    legalMoves: {
      ...moveTree,
      visibleState: projectedState,
    },
    playerInfo: {
      playerId: options.playerId,
      role: player?.role ?? 'player',
      seatIndex: Math.max(0, options.state.playerOrder.indexOf(options.playerId)),
      displayName: player?.displayName ?? String(options.playerId),
    },
    gameRulesSummary: rulesSummary,
    recentHistory: projectedState.actionLog.slice(-recentHistoryLimit),
    strategyProfile: options.strategyProfile,
    turnContext: {
      roundNumber: projectedState.turnState.roundNumber,
      turnNumber: projectedState.turnState.turnNumber,
      phase: projectedState.turnState.currentPhase,
      step: projectedState.turnState.currentStep,
      activePlayerId: projectedState.turnState.activePlayerId,
      priorityWindowOpen: projectedState.priorityWindow.isOpen,
      pendingDecisionId,
    },
    budget: options.budgetController?.snapshot(),
  };
}

export function serializeAIInputForLLM(input: AIInputEnvelope): string {
  return JSON.stringify(
    {
      playerInfo: input.playerInfo,
      turnContext: input.turnContext,
      strategyProfile: input.strategyProfile,
      budget: input.budget,
      gameRulesSummary: input.gameRulesSummary,
      recentHistory: input.recentHistory,
      legalMoves: {
        canPass: input.legalMoves.canPass,
        canCancel: input.legalMoves.canCancel,
        pendingDecision: input.legalMoves.pendingDecision,
        availableActions: input.legalMoves.availableActions,
      },
      gameState: {
        status: input.gameState.status,
        winner: input.gameState.winner,
        players: input.gameState.players,
        zones: input.gameState.zones,
        entities: input.gameState.entities,
        turnState: input.gameState.turnState,
        pendingDecisions: input.gameState.pendingDecisions,
        stack: input.gameState.stack,
        priorityWindow: input.gameState.priorityWindow,
      },
    },
    null,
    2,
  );
}
