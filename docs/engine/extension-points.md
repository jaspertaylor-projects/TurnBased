# Extension Points

## Overview

The engine provides documented extension points for advanced creators who need custom behavior beyond declarative rules and built-in components.

## Extension Hook Types

### Custom Predicates
Functions that evaluate game state conditions:
```typescript
interface CustomPredicate {
  name: string;
  evaluate: (state: GameState, context: PredicateContext) => boolean;
}
```
Use: Custom win conditions, special movement rules, eligibility checks.

### Custom Target Generators
Functions that produce valid targets for actions:
```typescript
interface CustomTargetGenerator {
  name: string;
  generateTargets: (state: GameState, source: EntityId) => EntityId[];
}
```
Use: "All enemies within 2 spaces", "cards that share a color with played card".

### Custom Scoring Helpers
Functions that compute scores or derived values:
```typescript
interface CustomScoringHelper {
  name: string;
  computeScore: (state: GameState, playerId: PlayerId) => number;
}
```
Use: Complex scoring formulas, set collection bonuses, area control calculations.

### Custom Derived Views
Functions that compute read-only derived state visible to players:
```typescript
interface CustomDerivedView {
  name: string;
  compute: (state: GameState, viewerId: PlayerId) => Record<string, unknown>;
}
```
Use: "Your current power level", "Available combos", territory maps.

### Custom AI Hints
Metadata that helps AI make better decisions:
```typescript
interface CustomAIHint {
  name: string;
  generateHints: (state: GameState, playerId: PlayerId) => AIHintData;
}
```

### Custom Interaction Affordance Policies
Override how the UI highlights interactable elements:
```typescript
interface CustomAffordancePolicy {
  name: string;
  computeAffordances: (state: GameState, legalMoves: LegalMoveTree) => UIAffordanceState;
}
```

## Registration

Extensions are registered in the game definition manifest:
```typescript
interface GameDefinition {
  // ...
  extensions: {
    predicates: CustomPredicate[];
    targetGenerators: CustomTargetGenerator[];
    scoringHelpers: CustomScoringHelper[];
    derivedViews: CustomDerivedView[];
    aiHints: CustomAIHint[];
    affordancePolicies: CustomAffordancePolicy[];
  };
}
```

## Creator Workflow

Advanced Extension Mode is the supported path for custom hook work inside TurnBased.

Recommended workflow:
- stay in Standard Mode unless declarative rules and built-in components are clearly insufficient
- upgrade the project to Advanced Extension Mode
- register hook stubs for the smallest surface that solves the problem
- document the hook purpose, inputs, and expected outputs alongside the stub
- keep hooks deterministic and browser-safe

Advanced Mode is still considered marketplace-ready as long as projects stay inside these documented hook contracts.

## Boundaries

Extensions **can**:
- Read game state
- Return computed results
- Be called by the engine at defined points

Extensions **cannot**:
- Mutate state directly (must return values for the engine to apply)
- Override core reducer logic (that requires experimental mode)
- Access other players' hidden state
- Make network calls or side effects

## Support Policy

In Advanced Extension Mode, the platform still guarantees:
- browser-only execution
- compatibility with the documented hook interfaces
- normal AI assistance quality
- normal marketplace eligibility

The platform does not guarantee support for behaviors that bypass these hook contracts. Projects that need reducer, visibility, or turn-flow overrides must move to Experimental Engine Override Mode and accept reduced guarantees.
