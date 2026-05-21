import type {
  Entity,
  PlayerState,
  Zone,
} from '@turnbased/engine-core';
import { Visibility } from '@turnbased/shared-types';
import {
  buildHookContext,
  evaluatePredicate,
  getDefaultHooks,
} from './rule-evaluation';
import type {
  RuleCompilationRuntime,
  RuleEvaluationRuntime,
  VisibilityDefaultRule,
  VisibilityEvaluationResult,
  VisibilityRuleApplication,
} from './types';

export function matchesTags(candidateTags: string[] | undefined, requestedTags: string[] | undefined): boolean {
  if (!requestedTags || requestedTags.length === 0) {
    return true;
  }

  const tagSet = new Set(candidateTags ?? []);
  return requestedTags.every((tag) => tagSet.has(tag));
}

export function matchesOwnerScope(
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

export function matchesVisibilityRule(
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

export function resolveVisibilityFromPolicy(
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
