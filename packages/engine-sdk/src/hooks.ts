import type { RuleHookRegistry, RuleHookRegistryInput } from './types';

function indexByName<T extends { name: string }>(items: readonly T[] | undefined): Record<string, T> {
  const registry: Record<string, T> = {};

  for (const item of items ?? []) {
    if (registry[item.name]) {
      throw new Error(`Duplicate rule hook registration: ${item.name}`);
    }

    registry[item.name] = item;
  }

  return registry;
}

export function createRuleHookRegistry(
  input: RuleHookRegistryInput = {},
): RuleHookRegistry {
  return {
    predicates: indexByName(input.predicates),
    actionBuilders: indexByName(input.actionBuilders),
    scoring: indexByName(input.scoring),
    winConditions: indexByName(input.winConditions),
    visibility: indexByName(input.visibility),
    targetGenerators: indexByName(input.targetGenerators),
    derivedViews: indexByName(input.derivedViews),
    aiHints: indexByName(input.aiHints),
    affordancePolicies: indexByName(input.affordancePolicies),
  };
}
