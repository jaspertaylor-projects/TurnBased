import { summarizeRulesForAI } from '@turnbased/engine-ai';
import type { EditorProject } from '../types';
import { getLabLegalActions, STRATEGY_DESCRIPTIONS } from './simulation';
import type { LabMove, LabRun } from './types';

export function observeLabRun(run: LabRun) {
  const { drawPile, seed, ...publicState } = run.state;
  void seed; // The public seat must not receive the seed that reveals the draw order.
  return {
    ...publicState,
    drawPileCount: drawPile.length,
    seatNames: ['You / challenger', 'Opponent'],
    legalActions: getLabLegalActions(run.state, run.config, run.cards),
    note: 'All market cards, coins, scores and acquired cards are public. The remaining draw order is hidden.',
  };
}

export function parseLabAgentMove(text: string): LabMove {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Paste a JSON object with chosenActionId and expectedStep.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The agent response must be a JSON object.');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !['chosenActionId', 'expectedStep', 'rationale'].includes(key))) {
    throw new Error('Use only chosenActionId, expectedStep and an optional rationale.');
  }
  if (typeof record.chosenActionId !== 'string' || typeof record.expectedStep !== 'number' || !Number.isInteger(record.expectedStep)) {
    throw new Error('Agent responses need a string chosenActionId and an integer expectedStep.');
  }
  if (record.rationale !== undefined && typeof record.rationale !== 'string') throw new Error('The rationale must be text.');
  return { chosenActionId: record.chosenActionId, expectedStep: record.expectedStep,
    rationale: typeof record.rationale === 'string' ? record.rationale.slice(0, 2000) : undefined };
}

export function createLabAgentPacket(project: EditorProject, run: LabRun) {
  return {
    format: 'turnbased-agent-packet', schemaVersion: 1, protocol: run.config.protocol,
    project: { id: project.id, name: project.name, description: project.description },
    session: { id: run.id, startedAt: run.startedAt, version: run.version },
    scope: 'This is a two-player market-race experiment. Only executableRules apply. The rulebook and card ability text are reference material, not executable behavior.',
    instructions: [
      'Read observation and choose exactly one of observation.legalActions by its id.',
      'Return a JSON object matching responseSchema; expectedStep must equal observation.step.',
      'The designer can paste your JSON into the Playtest Lab. Illegal and stale moves are rejected.',
      'Use only observation and cardDefinitions to make a fair decision. refereeReplay is for reproducing and inspecting the experiment, and contains hidden draw information.',
      'Report ambiguities between executableRules and referenceMaterial as findings instead of inventing mechanics.',
    ],
    responseSchema: {
      type: 'object', required: ['chosenActionId', 'expectedStep'], additionalProperties: false,
      properties: { chosenActionId: { type: 'string', enum: getLabLegalActions(run.state, run.config, run.cards).map((action) => action.id) },
        expectedStep: { type: 'integer', const: run.state.step }, rationale: { type: 'string', maxLength: 2000 } },
    },
    observationSchema: {
      fields: { step: 'Nonnegative action index; increments after every accepted move.', turn: 'One-based individual player turn.',
        activeSeat: '0 or 1', actionsRemaining: 'Remaining moves this turn.',
        market: 'Card definition ids, with duplicates representing physical copies.',
        drawPileCount: 'Number of cards waiting to refill the shared market.',
        players: 'Two ordered entries: score, resources (coins), acquired card definition ids.',
        status: 'playing or finished', winner: '0, 1, draw, or null while playing',
        endReason: 'target, round-limit, supply-empty, or null while playing' },
    },
    executableRules: {
      configuration: run.config,
      setup: 'Expand cardDefinitions by quantity; shuffle with the deterministic algorithm below. Deal marketSize cards to the public market. Each seat begins with startingResources coins, 0 score, and no acquired cards. firstPlayer is active, turn=1, step=0, actionsRemaining=actionsPerTurn.',
      gather: 'Legal if active seat has fewer coins than resourceCap. Add gatherAmount coins, capped at resourceCap. Costs one action.',
      buy: 'Legal if the named card is in the market and active seat coins >= its cost. Pay cost, add its points to score, append card id to acquired. Remove the first matching market copy and append the first draw-pile card if any. Costs one action. Card abilities have no additional effects.',
      endTurn: 'Always legal while playing. Forgo all remaining actions. This counts as one transcript move.',
      progression: 'After a nonterminal move, subtract one action (or set to zero for end-turn). At zero actions, if turn >= maxRounds * 2 finish by score. Otherwise increment turn, alternate activeSeat, and reset actionsRemaining.',
      endConditions: 'After a buy, first check whether that player reached targetScore, then whether both market and draw pile are empty. Otherwise check the round limit after the turn ends. The higher score wins; equal scores draw. Reaching target ends immediately and may give a starting-seat advantage.',
      legality: 'Only active seat may act. Reject moves when expectedStep differs from step or the action id is absent from legalActions. Finished games have no legal actions. No undo occurs inside a replay.',
      randomFloat: 'JavaScript algorithm for seed s and callCount n: let m = (s + Math.imul(n + 1, 0x9e3779b9)) >>> 0; m = Math.imul(m ^ (m >>> 16), 0x85ebca6b); m = Math.imul(m ^ (m >>> 13), 0xc2b2ae35); m = (m ^ (m >>> 16)) >>> 0; let x = (m ^ 0x9e3779b9) >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296. All bitwise operations use JavaScript 32-bit semantics.',
      shuffle: 'Fisher-Yates: iterate index from expanded deck length - 1 down to 1, use randomFloat(seed, callCount++) with callCount starting at zero, and swap index with floor(randomFloat * (index + 1)).',
      bots: STRATEGY_DESCRIPTIONS,
    },
    cardDefinitions: run.cards,
    observation: observeLabRun(run),
    refereeReplay: { warning: 'Contains hidden draw order for replay. Do not use for competitive move selection.',
      seed: run.config.seed, configuration: run.config, transcript: run.transcript, fullState: run.state },
    referenceMaterial: {
      capturedAt: 'Export time; the executable session configuration and card definitions above are frozen at session start.',
      rulesSummary: summarizeRulesForAI({ rulesText: project.rules.rulesText,
        documents: project.rules.chapters.map((chapter) => ({ title: chapter.title, content: chapter.body })),
        additionalNotes: [project.rules.designerNotes] }, { maxCharacters: 12000 }),
      rulebook: project.rules, components: project.instances, cardStudio: project.cardStudio ?? null,
    },
    findings: (project.playtestLab?.findings ?? []).filter((finding) => finding.sessionId === run.id),
  };
}

export function downloadLabJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
