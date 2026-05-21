# Legal Move Generation

## Overview

Legal move generation is a **first-class engine subsystem**. It answers: "What can this player do right now?" This drives UI affordances, AI play, move validation, and accessibility.

`engine-core` now exposes:
- `generateLegalMoveTree(state, { playerId, visibility, definitions })`
- `getValidDestinations(moveTree, entityId)`
- `getValidEntitiesForDestination(moveTree, zoneId)`
- `moveTree.validate(request)`
- `moveTree.materialize(request)`

The public move-generator surface is visibility-aware:
- actions are generated from the acting player's `PlayerVisibleState`
- entity references not visible to that viewer are stripped before the move tree is exposed
- destination lists are filtered to visible zones
- AI adapters should pair legal moves with `projectGameStateForAI(...)`, not raw `GameState`
- explanation/debug metadata may explain legality, but must not reveal hidden opponent information

## Move Tree

The engine produces a visibility-safe tree for the acting player:

```typescript
interface LegalMoveTree {
  playerId: PlayerId;
  availableActions: LegalAction[];
  canPass: boolean;
  canCancel: boolean;
  pendingDecision: VisiblePendingDecision | null;
  visibleState: PlayerVisibleState;
}

interface LegalAction {
  id: string;
  type: string;
  displayName: string;
  description?: string;
  interactableEntities: string[];
  validDestinations: ZoneId[];
  validTargets: string[];
  subChoices?: LegalSubChoice[];
  cost?: Record<string, number>;
  tags: string[];
  explanation?: LegalMoveExplanation;
}

interface LegalSubChoice {
  id: string;
  type: 'select_entity' | 'select_zone' | 'select_option' | 'set_value';
  prompt: string;
  options: { id: string; label: string; entityId?: string; zoneId?: ZoneId }[];
  minChoices: number;
  maxChoices: number;
}
```

`CompiledLegalMoveTree` extends the public tree with `validate(...)` and `materialize(...)`, so the UI or AI can choose a legal action id and let the engine produce canonical actions.

## Definition-Driven Generation

Game-specific moves are supplied through `LegalMoveDefinition` objects:

```typescript
interface LegalMoveDefinition {
  id: string;
  generate: (context: LegalMoveGenerationContext) =>
    LegalActionBlueprint | LegalActionBlueprint[] | null | undefined;
}
```

Definitions read from the acting player's visible state and return either:
- static `canonicalActions`
- `buildCanonicalActions(context)` for moves that depend on the final selection

This keeps move generation machine-readable without letting action builders depend on hidden information.

## Pending Decisions And Priority

The generator includes built-in handling for existing engine flow gates:
- pending decisions collapse the tree to a decision-resolving `CHOOSE_OPTION` action
- an acting player with priority gets `priority:pass`
- `canPass` and `canCancel` are convenience flags for default UI behavior

## Bidirectional Affordance Queries

The engine supports both directions of interaction:

### Entity → Destination (Item-first)
"I picked up this piece. Where can I put it?"
```typescript
getValidDestinations(moveTree, entityId): ZoneId[]
```

### Destination → Entity (Destination-first)
"I clicked this board space. What can I place here?"
```typescript
getValidEntitiesForDestination(moveTree, zoneId): string[]
```

## Move Validation

When a player submits a move, `validate(...)` checks:
1. Is the action id available?
2. Is the entity interactable?
3. Is the destination/target valid?
4. Are sub-choices present and in range?

`materialize(...)` throws if validation fails.

## Explanation / Debug Contract

Each action can carry lightweight debug metadata:

```typescript
interface LegalMoveExplanation {
  summary: string;
  details?: string[];
  generatedBy?: string;
  context?: {
    phase: string;
    step: string;
    priorityWindowOpen: boolean;
    pendingDecisionId?: string;
  };
}
```

This is intended for debug overlays, tests, and AI prompts. It should stay visibility-safe.

## AI Integration

The legal move tree is the primary input for AI players:
- AI receives the full tree of available actions plus its own `PlayerVisibleState`
- AI selects from valid action ids only
- follow-up choices are submitted as structured selections
- no AI path should bypass move validation or hidden-info projection

## Performance

Legal move generation runs after every state change. It must be efficient:
- Cache where possible (invalidate on state change).
- Use indexed lookups for entity/zone queries.
- Prune obviously invalid options early.
