import type {
  PhaseDefinition,
} from '@turnbased/engine-core';
import { evaluateRuleNumericExpression } from './expressions';
import { rulebookSchema } from './schemas';
import {
  buildHookContext,
  evaluateExpressionWithRuntime,
  evaluatePredicate,
  getDefaultHooks,
  getSelectedPlayers,
  materializeActionLogEntries,
  materializeCanonicalActions,
  resolveRuleActions,
  toExpressionContext,
} from './rule-evaluation';
import type {
  CompiledRulebookArtifacts,
  DeclarativePhaseRule,
  DeclarativeStepRule,
  RuleCompilationRuntime,
  RuleCompileOptions,
  RuleEvaluationRuntime,
  RulebookDefinition,
  ScoringEvaluationResult,
  ScoringRule,
  ScoringRuleEvaluation,
  SetupRule,
  SetupRuleEvaluation,
  TurnStructureCompilation,
  WinConditionEvaluation,
  WinConditionRule,
} from './types';

import { compileTriggerRules as _compileTriggerRules } from './rule-triggers';

// Re-export public symbols from extracted modules so that index.ts
// (which imports from './helpers') continues to work unchanged.
export { resolveRuleValue } from './rule-evaluation';
export { compileTriggerRules } from './rule-triggers';
export { resolveVisibilityDefaults } from './rule-visibility';

export function defineRulebook(
  rulebook: RulebookDefinition,
): RulebookDefinition {
  return rulebookSchema.parse(rulebook) as RulebookDefinition;
}

export function materializeSetupRules(
  rules: readonly SetupRule[] = [],
  runtime: RuleCompilationRuntime,
): SetupRuleEvaluation[] {
  const hooks = getDefaultHooks(runtime.hooks);
  let nextTimestamp = runtime.timestampStart ?? 0;

  const orderedRules = [...rules].sort((left, right) => {
    if ((left.order ?? 0) !== (right.order ?? 0)) {
      return (left.order ?? 0) - (right.order ?? 0);
    }

    return left.id.localeCompare(right.id);
  });

  const evaluations: SetupRuleEvaluation[] = [];

  for (const rule of orderedRules) {
    const selectedPlayers = rule.players ? getSelectedPlayers(runtime.state, rule.players) : [undefined];

    for (const player of selectedPlayers) {
      const evaluationRuntime: RuleEvaluationRuntime = {
        ...runtime,
        player,
      };

      if (!evaluatePredicate(rule.id, evaluationRuntime, hooks, rule.when, rule.predicateHook)) {
        continue;
      }

      const templates = resolveRuleActions(
        rule.id,
        evaluationRuntime,
        hooks,
        rule.actions,
        rule.actionHook,
      );
      const actionResult = materializeCanonicalActions(
        templates,
        {
          type: 'system',
          playerId: player?.id,
        },
        nextTimestamp,
      );
      nextTimestamp = actionResult.nextTimestamp;

      evaluations.push({
        ruleId: rule.id,
        playerId: player?.id ?? null,
        actions: actionResult.actions,
      });
    }
  }

  return evaluations;
}

function compileStepRule(
  step: DeclarativeStepRule,
  nextTimestamp: number,
): {
  step: PhaseDefinition['steps'][number];
  nextTimestamp: number;
} {
  const enterActions = materializeActionLogEntries(step.onEnter ?? [], { type: 'system' }, nextTimestamp);
  const exitActions = materializeActionLogEntries(step.onExit ?? [], { type: 'system' }, enterActions.nextTimestamp);

  return {
    step: {
      name: step.name,
      autoAdvance: step.autoAdvance,
      requiresPlayerAction: step.requiresPlayerAction,
      onEnter: enterActions.actionLogEntries,
      onExit: exitActions.actionLogEntries,
    },
    nextTimestamp: exitActions.nextTimestamp,
  };
}

function compilePhaseRule(
  phase: DeclarativePhaseRule,
  nextTimestamp: number,
): {
  phase: PhaseDefinition;
  nextTimestamp: number;
} {
  const enterActions = materializeActionLogEntries(phase.onEnter ?? [], { type: 'system' }, nextTimestamp);
  let timestamp = enterActions.nextTimestamp;

  const compiledSteps = phase.steps.map((step) => {
    const compiled = compileStepRule(step, timestamp);
    timestamp = compiled.nextTimestamp;
    return compiled.step;
  });

  const exitActions = materializeActionLogEntries(phase.onExit ?? [], { type: 'system' }, timestamp);

  return {
    phase: {
      name: phase.name,
      steps: compiledSteps,
      onEnter: enterActions.actionLogEntries,
      onExit: exitActions.actionLogEntries,
    },
    nextTimestamp: exitActions.nextTimestamp,
  };
}

export function compileTurnStructure(
  turnStructure: RulebookDefinition['turnStructure'],
  options: RuleCompileOptions = {},
): TurnStructureCompilation {
  if (!turnStructure) {
    return {
      phases: [],
      priorityPolicy: undefined,
    };
  }

  let nextTimestamp = options.timestampStart ?? 0;
  const phases = turnStructure.phases.map((phase) => {
    const compiled = compilePhaseRule(phase, nextTimestamp);
    nextTimestamp = compiled.nextTimestamp;
    return compiled.phase;
  });

  return {
    phases,
    priorityPolicy: turnStructure.priorityPolicy,
  };
}

export function evaluateScoringRules(
  rules: readonly ScoringRule[] = [],
  runtime: RuleCompilationRuntime,
): ScoringEvaluationResult {
  const hooks = getDefaultHooks(runtime.hooks);
  const applied: ScoringRuleEvaluation[] = [];
  const totals: Record<string, number> = {};

  for (const rule of rules) {
    const selectedPlayers = getSelectedPlayers(runtime.state, rule.players);

    for (const player of selectedPlayers) {
      const evaluationRuntime: RuleEvaluationRuntime = {
        ...runtime,
        player,
      };

      if (!evaluatePredicate(rule.id, evaluationRuntime, hooks, rule.when, rule.predicateHook)) {
        continue;
      }

      const value = rule.scoringHook
        ? (() => {
            const hook = hooks.scoring[rule.scoringHook.name];
            if (!hook) {
              throw new Error(`Unknown scoring hook "${rule.scoringHook.name}" for rule "${rule.id}"`);
            }

            return hook.computeScore({
              ...buildHookContext(evaluationRuntime, rule.id, rule.scoringHook),
              player,
            });
          })()
        : evaluateRuleNumericExpression(rule.value ?? '0', toExpressionContext(evaluationRuntime));

      const mode = rule.mode ?? 'add';
      applied.push({
        ruleId: rule.id,
        playerId: player.id,
        mode,
        value,
      });

      totals[player.id] = mode === 'set' ? value : (totals[player.id] ?? 0) + value;
    }
  }

  return {
    applied,
    totals,
  };
}

export function evaluateWinConditions(
  rules: readonly WinConditionRule[] = [],
  runtime: RuleCompilationRuntime,
): WinConditionEvaluation | null {
  const hooks = getDefaultHooks(runtime.hooks);
  const orderedRules = [...rules].sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));

  for (const rule of orderedRules) {
    const evaluationRuntime: RuleEvaluationRuntime = runtime;

    if (rule.winConditionHook) {
      const hook = hooks.winConditions[rule.winConditionHook.name];
      if (!hook) {
        throw new Error(`Unknown win condition hook "${rule.winConditionHook.name}" for rule "${rule.id}"`);
      }

      const result = hook.evaluate(buildHookContext(evaluationRuntime, rule.id, rule.winConditionHook));
      if (result?.matched) {
        return {
          ruleId: rule.id,
          matched: true,
          outcome: result.outcome ?? rule.outcome ?? 'win',
          winnerId: result.winnerId,
        };
      }

      continue;
    }

    if (!evaluatePredicate(rule.id, evaluationRuntime, hooks, rule.when, rule.predicateHook)) {
      continue;
    }

    const winnerId = rule.winnerExpression
      ? (evaluateExpressionWithRuntime(rule.winnerExpression, evaluationRuntime) as WinConditionEvaluation['winnerId'])
      : runtime.state.turnState.activePlayerId;

    return {
      ruleId: rule.id,
      matched: true,
      outcome: rule.outcome ?? 'win',
      winnerId,
    };
  }

  return null;
}

export function compileRulebook(
  rulebook: RulebookDefinition,
  runtime: RuleCompilationRuntime,
): CompiledRulebookArtifacts {
  const definition = defineRulebook(rulebook);
  const turnStructure = compileTurnStructure(definition.turnStructure, runtime);
  const setupEvaluations = materializeSetupRules(definition.setup, runtime);

  return {
    rulesText: definition.rulesText,
    setupActions: setupEvaluations.flatMap((evaluation) => evaluation.actions),
    setupEvaluations,
    phases: turnStructure.phases,
    priorityPolicy: turnStructure.priorityPolicy,
    triggers: _compileTriggerRules(definition.triggers, runtime),
  };
}
