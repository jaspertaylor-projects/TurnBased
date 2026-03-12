# Legal Move Generation

## Overview

Legal move generation is a **first-class engine subsystem**. It answers: "What can this player do right now?" This drives UI affordances, AI play, move validation, and accessibility.

## Move Tree

The engine produces a tree of legal moves for the active player:

```typescript
interface LegalMoveTree {
  playerId: PlayerId;
  availableActions: LegalAction[];
  canPass: boolean;
  canCancel: boolean;
  pendingDecision: PendingDecision | null;
}

interface LegalAction {
  id: string;
  type: string;                        // Action type
  displayName: string;                 // Human-readable label
  description?: string;
  interactableEntities: EntityId[];    // Entities player can interact with
  validDestinations: ZoneId[];         // Valid destination zones
  validTargets: EntityId[];            // Valid target entities
  subChoices?: SubChoice[];            // Follow-up choices required
  cost?: Record<string, number>;       // Resource cost to perform
  tags: string[];                      // For filtering/categorizing
}

interface SubChoice {
  type: 'select_entity' | 'select_zone' | 'select_option' | 'set_value';
  prompt: string;
  options: { id: string; label: string; entityId?: EntityId; zoneId?: ZoneId }[];
  minChoices: number;
  maxChoices: number;
}
```

## Bidirectional Affordance Queries

The engine supports both directions of interaction:

### Entity → Destination (Item-first)
"I picked up this piece. Where can I put it?"
```typescript
getValidDestinations(entityId: EntityId): ZoneId[]
```

### Destination → Entity (Destination-first)
"I clicked this board space. What can I place here?"
```typescript
getValidEntitiesForDestination(zoneId: ZoneId): EntityId[]
```

## Move Validation

When a player submits a move, it is validated against the legal move tree:
1. Is this action type available?
2. Is the entity interactable?
3. Is the destination/target valid?
4. Are sub-choices valid?
5. Can the player afford the cost?

## AI Integration

The legal move tree is the primary input for AI players:
- AI receives the full tree of available actions.
- AI selects from valid options only.
- No need for AI to understand game rules deeply — just pick from legal moves.

## Performance

Legal move generation runs after every state change. It must be efficient:
- Cache where possible (invalidate on state change).
- Use indexed lookups for entity/zone queries.
- Prune obviously invalid options early.
