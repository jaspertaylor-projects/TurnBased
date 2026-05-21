import type {
  ActionLogEntry,
  ActionSource,
  CanonicalAction,
  CanonicalActionTemplate,
  GameState,
  PlayerState,
  TriggerRegistration,
} from '@turnbased/engine-core';
import { generateId } from '@turnbased/shared-utils';
import { evaluateRuleBooleanExpression, evaluateRuleExpression } from './expressions';
import { createRuleHookRegistry } from './hooks';
import type {
  DeclarativeActionTemplate,
  PhaseActionCompilationContext,
  RuleEvaluationRuntime,
  RuleExpressionReference,
  RuleHookContextBase,
  RuleHookReference,
  RuleHookRegistry,
  RulePlayerSelector,
  RuleValueTemplate,
} from './types';

export function getDefaultHooks(hooks?: RuleHookRegistry): RuleHookRegistry {
  return hooks ?? createRuleHookRegistry();
}

export function toTriggerRegistrationId(ruleId: string, playerId: PlayerState['id'], expandPerPlayer: boolean): TriggerRegistration['id'] {
  const suffix = expandPerPlayer ? `_${playerId}` : '';
  const normalized = `${ruleId}${suffix}`.replace(/[^A-Za-z0-9_-]/g, '_');
  return `trigger_${normalized}` as TriggerRegistration['id'];
}

export function getActivePlayer(state: GameState): PlayerState | undefined {
  return state.players[state.turnState.activePlayerId];
}

export function toExpressionContext(runtime: RuleEvaluationRuntime): Record<string, unknown> {
  return {
    state: runtime.state,
    previousState: runtime.previousState,
    event: runtime.event,
    player: runtime.player,
    activePlayer: getActivePlayer(runtime.state),
    viewerId: runtime.viewerId ?? null,
    entity: runtime.entity,
    zone: runtime.zone,
    controllerId: runtime.controllerId,
    variables: runtime.variables ?? {},
  };
}

export function evaluateExpressionWithRuntime(
  expression: string,
  runtime: RuleEvaluationRuntime,
): unknown {
  return evaluateRuleExpression(expression, toExpressionContext(runtime));
}

export function buildHookContext(
  runtime: RuleEvaluationRuntime,
  ruleId: string,
  hook: RuleHookReference | undefined,
): RuleHookContextBase {
  return {
    ...runtime,
    ruleId,
    args: resolveHookArgs(hook, runtime),
    evaluateExpression: (expression) => evaluateExpressionWithRuntime(expression, runtime),
  };
}

export function resolveHookArgs(
  hook: RuleHookReference | undefined,
  runtime: RuleEvaluationRuntime,
): Record<string, unknown> {
  if (!hook?.args) {
    return {};
  }

  return Object.entries(hook.args).reduce<Record<string, unknown>>((resolved, [key, value]) => {
    resolved[key] = resolveRuleValue(value, runtime);
    return resolved;
  }, {});
}

export function isExpressionReference(value: RuleValueTemplate): value is RuleExpressionReference {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && value.kind === 'expression';
}

export function resolveRuleValue(
  value: RuleValueTemplate,
  runtime: RuleEvaluationRuntime,
): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveRuleValue(item, runtime));
  }

  if (isExpressionReference(value)) {
    const result = evaluateExpressionWithRuntime(value.expression, runtime);
    if (result === undefined) {
      throw new Error(`Expression "${value.expression}" resolved to undefined`);
    }

    return result;
  }

  return Object.entries(value).reduce<Record<string, unknown>>((resolved, [key, nestedValue]) => {
    resolved[key] = resolveRuleValue(nestedValue, runtime);
    return resolved;
  }, {});
}

export function normalizeActionTemplate(
  action: DeclarativeActionTemplate,
  runtime: RuleEvaluationRuntime,
): CanonicalActionTemplate {
  return {
    ...action,
    payload: resolveRuleValue(action.payload, runtime) as CanonicalAction['payload'],
  } as CanonicalActionTemplate;
}

export function normalizeHookActions(
  actions: CanonicalActionTemplate | CanonicalActionTemplate[],
): CanonicalActionTemplate[] {
  return Array.isArray(actions) ? actions : [actions];
}

export function materializeCanonicalActions(
  actions: readonly CanonicalActionTemplate[],
  source: ActionSource,
  nextTimestamp: number,
): {
  actions: CanonicalAction[];
  nextTimestamp: number;
} {
  let timestamp = nextTimestamp;

  return {
    actions: actions.map((action) => {
      const materialized = {
        ...action,
        source: {
          ...source,
          ...action.source,
        },
        timestamp: action.timestamp ?? timestamp,
      } as CanonicalAction;

      timestamp = Math.max(timestamp, materialized.timestamp + 1);
      return materialized;
    }),
    nextTimestamp: timestamp,
  };
}

export function materializeActionLogEntries(
  actions: readonly CanonicalActionTemplate[],
  source: ActionSource,
  nextTimestamp: number,
): PhaseActionCompilationContext {
  const result = materializeCanonicalActions(actions, source, nextTimestamp);

  return {
    actionLogEntries: result.actions.map((action) => ({
      ...action,
      id: generateId('rule_action_log') as ActionLogEntry['id'],
    })),
    nextTimestamp: result.nextTimestamp,
  };
}

export function getSelectedPlayers(
  state: GameState,
  selector?: RulePlayerSelector,
): PlayerState[] {
  const normalized = selector ?? {
    scope: 'all' as const,
  };
  const players = state.playerOrder
    .map((playerId) => state.players[playerId])
    .filter((player): player is PlayerState => Boolean(player));

  const filtered = normalized.includeEliminated
    ? players
    : players.filter((player) => !player.isEliminated);

  if (normalized.scope === 'active') {
    const activePlayer = filtered.find((player) => player.id === state.turnState.activePlayerId);
    return activePlayer ? [activePlayer] : [];
  }

  if (normalized.scope === 'specific') {
    const requestedIds = new Set(normalized.playerIds ?? []);
    return filtered.filter((player) => requestedIds.has(player.id));
  }

  return filtered;
}

export function evaluatePredicate(
  ruleId: string,
  runtime: RuleEvaluationRuntime,
  hooks: RuleHookRegistry,
  when?: string,
  predicateHook?: RuleHookReference,
): boolean {
  const expressionResult = when
    ? evaluateRuleBooleanExpression(when, toExpressionContext(runtime))
    : true;

  if (!expressionResult) {
    return false;
  }

  if (!predicateHook) {
    return true;
  }

  const hook = hooks.predicates[predicateHook.name];
  if (!hook) {
    throw new Error(`Unknown predicate hook "${predicateHook.name}" for rule "${ruleId}"`);
  }

  return hook.evaluate(buildHookContext(runtime, ruleId, predicateHook));
}

export function resolveRuleActions(
  ruleId: string,
  runtime: RuleEvaluationRuntime,
  hooks: RuleHookRegistry,
  actions: readonly DeclarativeActionTemplate[] | undefined,
  actionHook: RuleHookReference | undefined,
): CanonicalActionTemplate[] {
  if (actionHook) {
    const hook = hooks.actionBuilders[actionHook.name];
    if (!hook) {
      throw new Error(`Unknown action hook "${actionHook.name}" for rule "${ruleId}"`);
    }

    return normalizeHookActions(hook.buildActions(buildHookContext(runtime, ruleId, actionHook)));
  }

  return (actions ?? []).map((action) => normalizeActionTemplate(action, runtime));
}
