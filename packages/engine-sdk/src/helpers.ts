import type {
  ActionLogEntry,
  ActionSource,
  CanonicalAction,
  CanonicalActionTemplate,
  Entity,
  GameState,
  PhaseDefinition,
  PlayerState,
  TriggerRegistration,
  Zone,
} from '@turnbased/engine-core';
import { generateId } from '@turnbased/shared-utils';
import { Visibility } from '@turnbased/shared-types';
import { evaluateRuleBooleanExpression, evaluateRuleExpression, evaluateRuleNumericExpression } from './expressions';
import { createRuleHookRegistry } from './hooks';
import { rulebookSchema } from './schemas';
import type {
  CompiledRulebookArtifacts,
  DeclarativeActionTemplate,
  DeclarativePhaseRule,
  DeclarativeStepRule,
  DeclarativeTriggerRule,
  PhaseActionCompilationContext,
  RuleCompileOptions,
  RuleCompilationRuntime,
  RuleEvaluationRuntime,
  RuleExpressionReference,
  RuleHookContextBase,
  RuleHookReference,
  RuleHookRegistry,
  RulePlayerSelector,
  RuleValueTemplate,
  RulebookDefinition,
  ScoringEvaluationResult,
  ScoringRule,
  ScoringRuleEvaluation,
  SetupRule,
  SetupRuleEvaluation,
  TurnStructureCompilation,
  VisibilityDefaultRule,
  VisibilityEvaluationResult,
  VisibilityRuleApplication,
  WinConditionEvaluation,
  WinConditionRule,
} from './types';

function getDefaultHooks(hooks?: RuleHookRegistry): RuleHookRegistry {
  return hooks ?? createRuleHookRegistry();
}

function toTriggerRegistrationId(ruleId: string, playerId: PlayerState['id'], expandPerPlayer: boolean): TriggerRegistration['id'] {
  const suffix = expandPerPlayer ? `_${playerId}` : '';
  const normalized = `${ruleId}${suffix}`.replace(/[^A-Za-z0-9_-]/g, '_');
  return `trigger_${normalized}` as TriggerRegistration['id'];
}

function getActivePlayer(state: GameState): PlayerState | undefined {
  return state.players[state.turnState.activePlayerId];
}

function toExpressionContext(runtime: RuleEvaluationRuntime): Record<string, unknown> {
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

function evaluateExpressionWithRuntime(
  expression: string,
  runtime: RuleEvaluationRuntime,
): unknown {
  return evaluateRuleExpression(expression, toExpressionContext(runtime));
}

function buildHookContext(
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

function resolveHookArgs(
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

function isExpressionReference(value: RuleValueTemplate): value is RuleExpressionReference {
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

function normalizeActionTemplate(
  action: DeclarativeActionTemplate,
  runtime: RuleEvaluationRuntime,
): CanonicalActionTemplate {
  return {
    ...action,
    payload: resolveRuleValue(action.payload, runtime) as CanonicalAction['payload'],
  } as CanonicalActionTemplate;
}

function normalizeHookActions(
  actions: CanonicalActionTemplate | CanonicalActionTemplate[],
): CanonicalActionTemplate[] {
  return Array.isArray(actions) ? actions : [actions];
}

function materializeCanonicalActions(
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

function materializeActionLogEntries(
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

function getSelectedPlayers(
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

function evaluatePredicate(
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

function resolveRuleActions(
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

function getTriggerControllerIds(
  state: GameState,
  rule: DeclarativeTriggerRule,
): PlayerState[] {
  if (rule.controller.scope === 'specific') {
    const requested = new Set(rule.controller.playerIds ?? []);
    return state.playerOrder
      .map((playerId) => state.players[playerId])
      .filter((player): player is PlayerState => Boolean(player))
      .filter((player) => requested.has(player.id));
  }

  return getSelectedPlayers(state);
}

function compileTriggerRuleForPlayer(
  rule: DeclarativeTriggerRule,
  player: PlayerState,
  hooks: RuleHookRegistry,
): TriggerRegistration {
  return {
    id: toTriggerRegistrationId(rule.id, player.id, rule.controller.scope === 'all'),
    type: rule.type,
    event: rule.event,
    controllerId: player.id,
    sourceEntityId: rule.sourceEntityId as TriggerRegistration['sourceEntityId'],
    priority: rule.priority ?? 0,
    resolution: rule.resolution,
    once: rule.once ?? false,
    phase: rule.phase,
    prompt: rule.prompt,
    condition:
      rule.type === 'replacement' || rule.type === 'prevention'
        ? undefined
        : (context) =>
            evaluatePredicate(
              rule.id,
              {
                state: context.state,
                previousState: context.previousState,
                event: context.event,
                player: context.state.players[player.id],
                controllerId: player.id,
              },
              hooks,
              rule.when,
              rule.predicateHook,
            ),
    createActions:
      rule.type === 'prevention'
        ? undefined
        : (context) => {
            const runtime: RuleEvaluationRuntime = {
              state: context.state,
              previousState: context.previousState,
              event: context.event,
              player: context.state.players[player.id],
              controllerId: player.id,
            };

            if (!evaluatePredicate(rule.id, runtime, hooks, rule.when, rule.predicateHook)) {
              return [];
            }

            return resolveRuleActions(rule.id, runtime, hooks, rule.actions, rule.actionHook);
          },
    replace:
      rule.type !== 'replacement'
        ? undefined
        : (context) => {
            const runtime: RuleEvaluationRuntime = {
              state: context.state,
              previousState: context.previousState,
              event: context.event,
              player: context.state.players[player.id],
              controllerId: player.id,
            };

            if (!evaluatePredicate(rule.id, runtime, hooks, rule.when, rule.predicateHook)) {
              return null;
            }

            return resolveRuleActions(rule.id, runtime, hooks, rule.actions, rule.actionHook);
          },
    prevent:
      rule.type !== 'prevention'
        ? undefined
        : (context) =>
            evaluatePredicate(
              rule.id,
              {
                state: context.state,
                previousState: context.previousState,
                event: context.event,
                player: context.state.players[player.id],
                controllerId: player.id,
              },
              hooks,
              rule.when,
              rule.predicateHook,
            ),
  };
}

export function compileTriggerRules(
  rules: readonly DeclarativeTriggerRule[] = [],
  runtime: RuleCompilationRuntime,
): TriggerRegistration[] {
  const hooks = getDefaultHooks(runtime.hooks);

  return rules.flatMap((rule) =>
    getTriggerControllerIds(runtime.state, rule).map((player) =>
      compileTriggerRuleForPlayer(rule, player, hooks),
    ),
  );
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

function matchesTags(candidateTags: string[] | undefined, requestedTags: string[] | undefined): boolean {
  if (!requestedTags || requestedTags.length === 0) {
    return true;
  }

  const tagSet = new Set(candidateTags ?? []);
  return requestedTags.every((tag) => tagSet.has(tag));
}

function matchesOwnerScope(
  ownerId: PlayerState['id'] | null | undefined,
  runtime: RuleEvaluationRuntime,
  ownerScope: 'any' | 'viewer' | 'active_player' | undefined,
): boolean {
  if (!ownerScope || ownerScope === 'any') {
    return true;
  }

  if (ownerScope === 'viewer') {
    return ownerId !== null && ownerId !== undefined && runtime.viewerId === ownerId;
  }

  if (ownerScope === 'active_player') {
    return ownerId !== null && ownerId !== undefined && ownerId === runtime.state.turnState.activePlayerId;
  }

  return true;
}

function matchesVisibilityRule(
  rule: VisibilityDefaultRule,
  runtime: RuleEvaluationRuntime,
): boolean {
  const target = rule.target === 'entity' ? runtime.entity : runtime.zone;
  if (!target) {
    return false;
  }

  const match = rule.match;
  if (!match) {
    return true;
  }

  if (match.ids && !match.ids.includes(target.id)) {
    return false;
  }

  if (match.types && !match.types.includes(target.type)) {
    return false;
  }

  if (
    match.componentTypes &&
    'componentType' in target &&
    !match.componentTypes.includes(target.componentType)
  ) {
    return false;
  }

  if ('tags' in target && !matchesTags(target.tags, match.tags)) {
    return false;
  }

  if (!matchesOwnerScope(('ownerId' in target ? target.ownerId : null) ?? null, runtime, match.ownerScope)) {
    return false;
  }

  return true;
}

function resolveVisibilityFromPolicy(
  rule: VisibilityDefaultRule,
  runtime: RuleEvaluationRuntime,
): boolean {
  const viewerId = runtime.viewerId ?? null;
  const target = rule.target === 'entity' ? runtime.entity : runtime.zone;
  const ownerId = target && 'ownerId' in target ? target.ownerId : null;
  const controllerId =
    rule.target === 'entity' ? (runtime.entity?.controllerId ?? null) : null;

  if (rule.viewers === 'all') {
    return true;
  }

  if (rule.viewers === 'none') {
    return false;
  }

  if (rule.viewers === 'owner') {
    return viewerId !== null && viewerId === ownerId;
  }

  if (rule.viewers === 'controller') {
    return viewerId !== null && viewerId === controllerId;
  }

  if (rule.viewers === 'specific') {
    return viewerId !== null && (rule.playerIds ?? []).includes(viewerId);
  }

  switch (rule.visibility) {
    case Visibility.Public:
      return true;
    case Visibility.Hidden:
      return false;
    case Visibility.Private:
      return viewerId !== null && (viewerId === ownerId || viewerId === controllerId);
    case Visibility.Restricted:
      return viewerId !== null && (rule.playerIds ?? []).includes(viewerId);
    default:
      return false;
  }
}

export function resolveVisibilityDefaults(
  rules: readonly VisibilityDefaultRule[] = [],
  runtime: RuleCompilationRuntime & { viewerId?: PlayerState['id'] | null },
): VisibilityEvaluationResult {
  const hooks = getDefaultHooks(runtime.hooks);
  const entityVisibility: Record<string, boolean> = {};
  const zoneVisibility: Record<string, boolean> = {};
  const applied: VisibilityRuleApplication[] = [];

  const entities = Object.values(runtime.state.entities);
  const zones = Object.values(runtime.state.zones);

  for (const rule of rules) {
    const targets: Array<Entity | Zone> = rule.target === 'entity' ? entities : zones;

    for (const target of targets) {
      const evaluationRuntime: RuleEvaluationRuntime = {
        ...runtime,
        entity: rule.target === 'entity' ? (target as Entity) : undefined,
        zone: rule.target === 'zone' ? (target as Zone) : undefined,
        viewerId: runtime.viewerId ?? null,
      };

      if (!matchesVisibilityRule(rule, evaluationRuntime)) {
        continue;
      }

      if (!evaluatePredicate(rule.id, evaluationRuntime, hooks, rule.when, rule.predicateHook)) {
        continue;
      }

      const visible = rule.visibilityHook
        ? (() => {
            const hook = hooks.visibility[rule.visibilityHook.name];
            if (!hook) {
              throw new Error(`Unknown visibility hook "${rule.visibilityHook.name}" for rule "${rule.id}"`);
            }

            return hook.isVisible({
              ...buildHookContext(evaluationRuntime, rule.id, rule.visibilityHook),
              entity: evaluationRuntime.entity,
              zone: evaluationRuntime.zone,
              viewerId: evaluationRuntime.viewerId ?? null,
            });
          })()
        : resolveVisibilityFromPolicy(rule, evaluationRuntime);

      if (rule.target === 'entity' && evaluationRuntime.entity) {
        entityVisibility[evaluationRuntime.entity.id] = visible;
        applied.push({
          ruleId: rule.id,
          target: 'entity',
          targetId: evaluationRuntime.entity.id,
          viewerId: evaluationRuntime.viewerId ?? null,
          visible,
          visibility: rule.visibility,
        });
      }

      if (rule.target === 'zone' && evaluationRuntime.zone) {
        zoneVisibility[evaluationRuntime.zone.id] = visible;
        applied.push({
          ruleId: rule.id,
          target: 'zone',
          targetId: evaluationRuntime.zone.id,
          viewerId: evaluationRuntime.viewerId ?? null,
          visible,
          visibility: rule.visibility,
        });
      }
    }
  }

  return {
    viewerId: runtime.viewerId ?? null,
    entityVisibility,
    zoneVisibility,
    applied,
  };
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
    triggers: compileTriggerRules(definition.triggers, runtime),
  };
}
