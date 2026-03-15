# Action Grammar

## Overview

The engine uses a two-tier action system:

1. **Intent Actions** — High-level, ergonomic player actions (e.g., "play this card")
2. **Canonical Actions** — Low-level, atomic state mutations (e.g., "move entity from zone A to zone B")

Intent actions are **lowered** into one or more canonical actions before the reducer processes them.

## Canonical Action Types

| Action | Description | Key Payload Fields |
|--------|------------|-------------------|
| `MOVE_ENTITY` | Move an entity from one zone to another | `entityId`, `fromZoneId`, `toZoneId`, `position` |
| `CREATE_ENTITY` | Create a new entity in a zone | `entity`, `zoneId` |
| `DESTROY_ENTITY` | Remove an entity from the game | `entityId` |
| `SET_PROPERTY` | Set a property on an entity, zone, or player | `targetType`, `targetId`, `key`, `value` |
| `TRANSFER_CONTROL` | Change who controls an entity | `entityId`, `newControllerId` |
| `DRAW_FROM_ZONE` | Draw N entities from top of a zone | `sourceZoneId`, `targetZoneId`, `count` |
| `SHUFFLE_ZONE` | Randomize entity order in a zone | `zoneId` |
| `REVEAL_ENTITY` | Make an entity visible (face up) | `entityId`, `toPlayers` |
| `HIDE_ENTITY` | Make an entity hidden (face down) | `entityId` |
| `PROMPT_PLAYER` | Create a pending decision for a player | `decision` |
| `CHOOSE_OPTION` | Player responds to a pending decision | `decisionId`, `chosenOptionIds` |
| `PASS_PRIORITY` | Current responder passes in an open priority window | `playerId` |
| `ADVANCE_STEP` | Move to the next step in the current phase | — |
| `ADVANCE_PHASE` | Move to the next phase | — |
| `END_TURN` | End the current player's turn | — |
| `QUEUE_STACK_ITEM` | Push a pending effect onto the response stack | `stackItem` |
| `RESOLVE_STACK_ITEM` | Resolve the top item on the stack | `stackItemId` |
| `ADD_RESOURCE` | Add resources to a player | `playerId`, `resource`, `amount` |
| `REMOVE_RESOURCE` | Remove resources from a player | `playerId`, `resource`, `amount` |
| `SET_SCORE` | Set a player's score | `playerId`, `score` |
| `ELIMINATE_PLAYER` | Mark a player as eliminated | `playerId` |
| `END_GAME` | End the game with optional winner | `winnerId` |
| `ADD_EXTRA_TURN` | Queue an extra turn for a player | `playerId` |
| `SKIP_TURN` | Skip a player's next normal turn | `playerId` |
| `REVERSE_TURN_ORDER` | Flip turn direction | — |
| `INSERT_PHASE` | Insert a temporary phase into the current turn | `phase`, `afterPhase` |
| `INSERT_STEP` | Insert a temporary step into a phase of the current turn | `step`, `phaseName`, `afterStep` |

## Canonical Action Schema

```typescript
interface CanonicalAction {
  type: CanonicalActionType;
  payload: Record<string, unknown>;
  source: ActionSource;
  timestamp: number;            // Logical timestamp (action index)
}

interface ActionSource {
  type: 'player' | 'trigger' | 'system' | 'ai';
  playerId?: PlayerId;
  triggerId?: TriggerId;
}
```

## Lowering Rules

Intent actions are ergonomic — they describe what the player wants to do. The engine lowers them:

| Intent | Lowered To |
|--------|-----------|
| "Play card X to board" | `MOVE_ENTITY(X, hand, board)` + `REVEAL_ENTITY(X)` |
| "Draw 2 cards" | `DRAW_FROM_ZONE(deck, hand, 2)` |
| "Attack with piece A at target B" | `SET_PROPERTY(A, attacking, true)` + `PROMPT_PLAYER(choose_target)` |
| "End my turn" | `END_TURN` → `ADVANCE_PHASE` → trigger phase-end effects |

## Validation

Every canonical action is validated before application:
1. **Structural** — payload matches the action schema (zod validation)
2. **Legality** — the action is in the current legal move set
3. **Authorization** — the source player has permission
4. **State Preconditions** — required entities/zones exist, capacity not exceeded, etc.

## Events Emitted

Each canonical action emits one or more domain events after application:

| Action | Events |
|--------|--------|
| `MOVE_ENTITY` | `ENTITY_MOVED`, `ZONE_CHANGED` |
| `CREATE_ENTITY` | `ENTITY_CREATED` |
| `DESTROY_ENTITY` | `ENTITY_DESTROYED` |
| `DRAW_FROM_ZONE` | `ENTITY_DRAWN` (per entity) |
| `END_TURN` | `TURN_ENDED`, `TURN_STARTED` |
| `QUEUE_STACK_ITEM` | `STACK_ITEM_QUEUED` |
| `RESOLVE_STACK_ITEM` | `STACK_ITEM_RESOLVED` |
| `END_GAME` | `GAME_ENDED` |
| `ADD_EXTRA_TURN` | `EXTRA_TURN_ADDED` |
| `SKIP_TURN` | `TURN_SKIPPED` |
| `REVERSE_TURN_ORDER` | `TURN_ORDER_REVERSED` |
| `INSERT_PHASE` | `PHASE_INSERTED` |
| `INSERT_STEP` | `STEP_INSERTED` |

Events are what triggers subscribe to. See [triggers-and-priority.md](./triggers-and-priority.md).

## Priority Notes

- `PASS_PRIORITY` is only valid while `priorityWindow.isOpen === true`.
- The `playerId` must match `priorityWindow.currentPlayerId`.
- A player with a mandatory pending decision cannot pass until they answer that prompt.
- `INSERT_PHASE` and `INSERT_STEP` only modify the active turn's runtime structure; the next turn resets from `turnState.basePhases`.
