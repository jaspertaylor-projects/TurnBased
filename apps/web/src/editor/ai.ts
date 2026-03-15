import {
  createAIInputEnvelope,
  summarizeRulesForAI,
} from '@turnbased/engine-ai';
import type { GameState } from '@turnbased/engine-core';

import { getProjectModeLabel, getProjectModeSupportSummary } from './capabilities';
import { createPreviewMoveTree } from './runtime';
import type { EditorProject, PreviewRuntime } from './types';

const ENGINE_DOC_GROUNDING = [
  {
    title: 'Component Model',
    citation: 'docs/engine/component-model.md',
    summary: 'Built-in components carry placement, occupancy, render hints, and property definitions so the editor and preview share one contract.',
  },
  {
    title: 'Rules Authoring',
    citation: 'docs/engine/rules-authoring.md',
    summary: 'Turn structure, scoring, visibility, and win conditions should stay declarative whenever possible and only drop to hooks for exceptional behavior.',
  },
  {
    title: 'Legal Move Generation',
    citation: 'docs/engine/legal-move-generation.md',
    summary: 'The legal move tree is the canonical source for current player actions, debug overlays, and AI prompts.',
  },
  {
    title: 'UI Interaction Contract',
    citation: 'docs/engine/ui-interaction-contract.md',
    summary: 'Highlights, interactable states, and menus should be derived from the move tree instead of ad hoc per-game click logic.',
  },
  {
    title: 'AI Player Contract',
    citation: 'docs/engine/ai-player-contract.md',
    summary: 'AI consumers should only see projected state, legal moves, recent visible history, and a concise rules summary.',
  },
  {
    title: 'Extension Points',
    citation: 'docs/engine/extension-points.md',
    summary: 'Advanced mode should use documented hook interfaces instead of reaching into reducer internals.',
  },
  {
    title: 'Experimental Engine Override Mode',
    citation: 'docs/engine/experimental-engine-override.md',
    summary: 'Experimental projects keep browser-only execution, but AI quality, marketplace readiness, and migration guarantees are reduced.',
  },
];

export interface GroundedAdvice {
  title: string;
  body: string;
  citations: string[];
  groundingSummary: string;
}

function getMissingStructure(project: EditorProject, runtime: PreviewRuntime): string[] {
  const suggestions: string[] = [];

  if (runtime.destinationZoneIds.length === 0) {
    suggestions.push('add at least one `Space` or `Zone` to create a legal destination surface');
  }

  const entityCount = Object.values(project.instances).filter((instance) => (
    instance.componentType === 'piece' || instance.componentType === 'token'
  )).length;
  if (entityCount === 0) {
    suggestions.push('add `Piece` or `Token` components so each player has something to move');
  }

  const unownedEntities = Object.values(project.instances).filter((instance) => (
    (instance.componentType === 'piece' || instance.componentType === 'token') &&
    !instance.bindings.ownerId
  )).length;
  if (unownedEntities > 0) {
    suggestions.push('assign owners to loose pieces so the preview can generate player-specific legal moves');
  }

  return suggestions;
}

export function generateGroundedAdvice(
  question: string,
  project: EditorProject,
  runtime: PreviewRuntime,
  state: GameState,
): GroundedAdvice {
  const normalizedQuestion = question.trim().toLowerCase();
  const modeSupport = getProjectModeSupportSummary(project);
  const modeLabel = getProjectModeLabel(project.manifest.capabilities.mode);
  const moveTree = createPreviewMoveTree(state, runtime);
  const rulesSummary = summarizeRulesForAI({
    ...runtime.summarySource,
    documents: ENGINE_DOC_GROUNDING.map((document, index) => ({
      title: document.title,
      content: document.summary,
      priority: index,
    })),
  }, {
    maxCharacters: 1200,
  });
  const aiEnvelope = createAIInputEnvelope({
    state,
    playerId: state.turnState.activePlayerId,
    legalMoveDefinitions: runtime.legalMoveDefinitions,
    rules: runtime.summarySource,
  });
  const missingStructure = getMissingStructure(project, runtime);

  if (normalizedQuestion.includes('missing') || normalizedQuestion.includes('next')) {
    const nextSteps = missingStructure.length > 0
      ? `Next structural steps: ${missingStructure.join('; ')}.`
      : `The structure is already playable. Focus next on pacing: raise or lower the target score (${project.rules.targetScore}) and tighten the turn cap (${project.rules.maxTurns}) to match the board size.`;
    const modeNote = project.manifest.capabilities.mode === 'standard'
      ? 'Stay on the standard path unless documented extension hooks are clearly necessary.'
      : project.manifest.capabilities.mode === 'advanced'
        ? 'If you need custom logic, prefer documented extension hooks instead of core engine overrides.'
        : 'Because this project is experimental, prefer the smallest override surface possible and document the trade-offs for future collaborators.';

    return {
      title: 'Recommended Next Steps',
      body: `${nextSteps} ${modeNote} The component catalog should stay responsible for layout and occupancy, while the rules layer stays declarative around score and turn flow.`,
      citations: ['docs/engine/component-model.md', 'docs/engine/rules-authoring.md', ...modeSupport.citations],
      groundingSummary: rulesSummary,
    };
  }

  if (normalizedQuestion.includes('legal') || normalizedQuestion.includes('move') || normalizedQuestion.includes('overlay')) {
    const actionSummary = moveTree.availableActions.length > 0
      ? moveTree.availableActions.map((action) => `${action.displayName} [${action.tags.join(', ')}]`).join('; ')
      : 'No legal actions are available yet.';

    return {
      title: 'Current Legal Move Readout',
      body: `The preview is driven directly from the legal move tree. Current actions: ${actionSummary} Interactable overlays should mirror those exact actions rather than inventing extra UI-only states.`,
      citations: ['docs/engine/legal-move-generation.md', 'docs/engine/ui-interaction-contract.md'],
      groundingSummary: JSON.stringify({
        player: aiEnvelope.playerInfo.displayName,
        turn: aiEnvelope.turnContext,
        legalMoveCount: aiEnvelope.legalMoves.availableActions.length,
      }, null, 2),
    };
  }

  if (normalizedQuestion.includes('ai') || normalizedQuestion.includes('prompt') || normalizedQuestion.includes('bot')) {
    return {
      title: 'AI Grounding Bundle',
      body: `A future agent should receive projected state, visible recent history, and legal moves only. Current mode: ${modeLabel}. ${modeSupport.aiGuidance} The current project already produces a compact rules summary and legal move envelope for the active seat, which is the right boundary for safe editor assistance.`,
      citations: ['docs/engine/ai-player-contract.md', 'docs/engine/legal-move-generation.md', ...modeSupport.citations],
      groundingSummary: JSON.stringify({
        projectMode: project.manifest.capabilities.mode,
        enabledOverrides: project.manifest.capabilities.enabledOverrides,
        acknowledgedWarnings: project.manifest.capabilities.acknowledgedWarnings,
        rulesSummary,
        playerInfo: aiEnvelope.playerInfo,
        turnContext: aiEnvelope.turnContext,
      }, null, 2),
    };
  }

  if (project.manifest.capabilities.mode === 'experimental') {
    return {
      title: 'Experimental Mode Guidance',
      body: `This project is in ${modeLabel}. ${modeSupport.supportDescription} Before changing engine-adjacent behavior, keep the override surface narrow, document enabled overrides (${project.manifest.capabilities.enabledOverrides.join(', ') || 'none yet'}), and expect weaker AI certainty.`,
      citations: modeSupport.citations,
      groundingSummary: JSON.stringify({
        projectMode: project.manifest.capabilities.mode,
        support: modeSupport,
        customHooks: project.manifest.customHooks.map((hook) => ({
          name: hook.name,
          hookType: hook.hookType,
          status: hook.status,
        })),
      }, null, 2),
    };
  }

  return {
    title: 'Prototype Coaching',
    body: `This project is using the territory prototype ruleset in ${modeLabel}, so the most valuable checks are: can each player reach a public destination, do legal highlights match available actions, and does the target score fit the amount of board space? ${modeSupport.aiGuidance} Keep components responsible for structure and let the move tree explain what can happen now.`,
    citations: [...ENGINE_DOC_GROUNDING.map((document) => document.citation), ...modeSupport.citations],
    groundingSummary: rulesSummary,
  };
}
