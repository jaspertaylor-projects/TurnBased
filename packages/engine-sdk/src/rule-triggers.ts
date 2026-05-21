import type {
  GameState,
  PlayerState,
  TriggerRegistration,
} from '@turnbased/engine-core';
import {
  evaluatePredicate,
  getDefaultHooks,
  getSelectedPlayers,
  resolveRuleActions,
  toTriggerRegistrationId,
} from './rule-evaluation';
import type {
  DeclarativeTriggerRule,
  RuleCompilationRuntime,
  RuleEvaluationRuntime,
  RuleHookRegistry,
} from './types';

export function getTriggerControllerIds(
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

export function compileTriggerRuleForPlayer(
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
