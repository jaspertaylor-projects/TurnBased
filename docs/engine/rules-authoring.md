# Rules Authoring

## Overview

`@turnbased/engine-sdk` is the creator-facing rules layer that sits above `engine-core`.
It gives authors a declarative rulebook format for the mechanics that show up in most tabletop-style games:

- setup sequencing
- turn structure
- triggers
- scoring
- win conditions
- visibility defaults

The SDK compiles those definitions into `engine-core` runtime structures and keeps custom logic behind named hooks instead of ad hoc reducer edits.

## Rulebook Shape

```typescript
interface RulebookDefinition {
  rulesText?: string;
  setup?: SetupRule[];
  turnStructure?: TurnStructureRule;
  scoring?: ScoringRule[];
  winConditions?: WinConditionRule[];
  triggers?: DeclarativeTriggerRule[];
  visibilityDefaults?: VisibilityDefaultRule[];
}
```

Use `defineRulebook()` to validate author input up front:

```typescript
import { defineRulebook } from '@turnbased/engine-sdk';

const rulebook = defineRulebook({
  setup: [
    {
      id: 'starting_gold',
      players: { scope: 'all' },
      actions: [
        {
          type: 'ADD_RESOURCE',
          payload: {
            playerId: { kind: 'expression', expression: 'player.id' },
            resource: 'gold',
            amount: 3,
          },
        },
      ],
    },
  ],
});
```

## Declarative Areas

### Setup Rules

Setup rules run in author-defined order and can target all players, the active player, or a specific player subset.

Typical uses:

- starting resources
- opening scores
- initial shuffles or reveals
- per-player configuration derived from player IDs

Use `materializeSetupRules()` or `compileRulebook()` to turn them into canonical actions.

### Turn Structure

Turn structure remains data-first:

```typescript
interface TurnStructureRule {
  phases: DeclarativePhaseRule[];
  priorityPolicy?: PriorityPolicy;
}
```

Each phase and step may carry static `onEnter` and `onExit` actions. If an enter/exit effect depends on the current event or a dynamic target, model it as a trigger instead of a static phase action.

### Trigger Rules

Declarative triggers compile into `engine-core` trigger registrations. The authoring model supports:

- automatic, optional, replacement, and prevention triggers
- per-player trigger expansion
- expression-based conditions
- declarative action payloads with embedded expressions
- custom action builder hooks for the non-standard cases

Example:

```typescript
{
  id: 'turn_income',
  type: 'automatic',
  event: 'TURN_STARTED',
  controller: { scope: 'all' },
  when: 'event.payload.playerId == controllerId',
  actions: [
    {
      type: 'ADD_RESOURCE',
      payload: {
        playerId: { kind: 'expression', expression: 'event.payload.playerId' },
        resource: 'gold',
        amount: 1,
      },
    },
  ],
}
```

### Scoring Rules

Scoring rules evaluate against one or more players and return additive or absolute score contributions.

```typescript
{
  id: 'score_plus_gold',
  players: { scope: 'all' },
  mode: 'add',
  value: 'player.score + player.resources.gold',
}
```

Use `evaluateScoringRules()` to compute author-defined score contributions without mutating state directly.

### Win Conditions

Win conditions are ordered by priority and stop on the first match.

They can be expressed with:

- a `when` expression
- a `winnerExpression`
- a named `winConditionHook`

Use `evaluateWinConditions()` to resolve the first satisfied condition into a winner payload.

### Visibility Defaults

Visibility defaults let authors describe who should see which entities or zones before runtime overrides are applied.

Supported matching fields include:

- IDs
- types
- component types
- tags
- owner-relative scopes

Use `resolveVisibilityDefaults()` to derive per-viewer visibility maps from the rulebook.

## Expression Language

The SDK ships a small deterministic expression parser and evaluator. It is intentionally narrow:

- literals: strings, numbers, booleans, `null`
- member access: `state.players[player.id].score`
- array indexing: `state.playerOrder[0]`
- arithmetic: `+ - * / %`
- comparisons: `== != > >= < <=`
- boolean logic: `&& || !`
- grouping with parentheses

Helper APIs:

- `parseRuleExpression()`
- `evaluateRuleExpression()`
- `evaluateRuleBooleanExpression()`
- `evaluateRuleNumericExpression()`

Expressions run against a known scope object that may include:

- `state`
- `previousState`
- `event`
- `player`
- `activePlayer`
- `viewerId`
- `entity`
- `zone`
- `controllerId`
- `variables`

## Hook Interfaces

When declarative data is not enough, the SDK exposes named hook registries:

- `RulePredicateHook`
- `RuleActionBuilderHook`
- `RuleScoringHook`
- `RuleWinConditionHook`
- `RuleVisibilityHook`
- `RuleTargetGeneratorHook`
- `RuleDerivedViewHook`
- `RuleAIHintHook`
- `RuleAffordancePolicyHook`

Register hooks with `createRuleHookRegistry()` and reference them from rule definitions by name.

## Boundary: Declarative vs Hooks

Use declarative rules when:

- the effect is a fixed canonical action or small action list
- the condition can be expressed with field access and arithmetic/boolean logic
- scoring is formula-like
- visibility depends on ownership, tags, or static type matching
- trigger ownership can be expanded per player

Switch to hooks when:

- the effect requires search, pathfinding, or graph traversal
- legal targets depend on hidden information filtering or combinatorics
- replacement/prevention logic needs custom branching beyond a simple predicate
- scoring depends on complex set analysis or spatial evaluation
- visibility depends on derived maps, line-of-sight, adjacency, or game-specific inference
- AI or UI consumers need computed hints that are not raw state fields

The important rule is: hooks extend the engine at named seams, while `engine-core` stays deterministic and generic.

## Package Surface

Phase 14 adds these primary exports:

- `defineRulebook`
- `compileRulebook`
- `compileTurnStructure`
- `compileTriggerRules`
- `materializeSetupRules`
- `evaluateScoringRules`
- `evaluateWinConditions`
- `resolveVisibilityDefaults`
- expression parser/evaluator helpers
- schemas for all declarative rule definitions

That is the default authoring layer for creator-authored games going forward.
