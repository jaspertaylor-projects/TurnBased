# State Model

## Overview

The engine uses a **normalized, immutable state model**. All game data is stored in a single `GameState` object with well-defined sub-structures. State is never mutated in place — the reducer always produces a new state object.

## Core State Structure

```typescript
interface GameState {
  // ─── Identity ─────────────────
  gameId: GameId;
  version: number;              // Increments with each action applied

  // ─── Entities ─────────────────
  entities: Record<EntityId, Entity>;

  // ─── Zones ────────────────────
  zones: Record<ZoneId, Zone>;

  // ─── Players ──────────────────
  players: Record<PlayerId, PlayerState>;
  playerOrder: PlayerId[];      // Current turn order (can change mid-game)

  // ─── Turn State ───────────────
  turnState: TurnState;

  // ─── Decision/Response ────────
  pendingDecisions: PendingDecision[];
  stack: StackItem[];

  // ─── Visibility ───────────────
  visibilityMap: VisibilityMap;

  // ─── Randomness ───────────────
  randomState: RandomState;

  // ─── Metadata ─────────────────
  status: 'setup' | 'playing' | 'paused' | 'finished';
  winner?: PlayerId | PlayerId[] | null;
  actionLog: ActionLogEntry[];
}
```

## Entity Model

Entities are the fundamental game objects — cards, pieces, tokens, markers.

```typescript
interface Entity {
  id: EntityId;
  type: string;                 // e.g., 'card', 'piece', 'token'
  componentType: string;        // Which component definition this is an instance of
  zoneId: ZoneId;               // Current zone location
  ownerId: PlayerId | null;     // Who owns this entity
  controllerId: PlayerId | null;// Who currently controls it (may differ from owner)
  position: number;             // Order within zone (for hands, decks, etc.)
  faceUp: boolean;              // Whether visible to non-controller
  properties: Record<string, unknown>; // Component-specific data
  tags: string[];               // Flexible tagging for rules queries
}
```

## Zone Model

Zones are containers that hold entities with specific rules.

```typescript
interface Zone {
  id: ZoneId;
  type: string;                 // e.g., 'hand', 'deck', 'board', 'discard'
  ownerId: PlayerId | null;     // Zone owner (e.g., player's hand)
  entityIds: EntityId[];        // Ordered list of entities in this zone
  maxCapacity: number | null;   // null = unlimited
  visibility: ZoneVisibility;   // Who can see contents
  properties: Record<string, unknown>;
}

interface ZoneVisibility {
  defaultVisibility: Visibility;      // 'public' | 'private' | 'hidden'
  overrides: Record<PlayerId, Visibility>; // Per-player overrides
}
```

## Player State

```typescript
interface PlayerState {
  id: PlayerId;
  displayName: string;
  role: ParticipantRole;        // 'player' | 'spectator' | 'ai'
  isActive: boolean;            // Whether it's their turn
  isEliminated: boolean;
  score: number;
  resources: Record<string, number>;
  properties: Record<string, unknown>;
}
```

## Turn State

```typescript
interface TurnState {
  roundNumber: number;
  turnNumber: number;
  activePlayerId: PlayerId;
  currentPhase: string;
  currentStep: string;
  phaseIndex: number;
  stepIndex: number;
  phases: PhaseDefinition[];
  turnDirection: 'forward' | 'reverse';
  extraTurns: PlayerId[];       // Queue of players with extra turns
  skippedPlayers: Set<PlayerId>;
}
```

## Pending Decision

```typescript
interface PendingDecision {
  id: string;
  playerId: PlayerId;           // Who must decide
  type: 'choose_option' | 'choose_target' | 'choose_entity' | 'confirm';
  prompt: string;
  options: DecisionOption[];
  minChoices: number;
  maxChoices: number;
  timeoutMs?: number;
}
```

## Stack Item

```typescript
interface StackItem {
  id: string;
  source: string;               // What created this (trigger ID, action, etc.)
  effect: CanonicalAction;      // The effect to apply when resolved
  controllerId: PlayerId;
  priority: number;
  isResolved: boolean;
}
```

## Random State

```typescript
interface RandomState {
  seed: number;
  callCount: number;            // How many random values have been consumed
}
```

## Visibility Map

```typescript
interface VisibilityMap {
  entityVisibility: Record<EntityId, Record<PlayerId, boolean>>;
  zoneVisibility: Record<ZoneId, Record<PlayerId, boolean>>;
}
```

## ID System

All IDs use branded string types (see `@turnbased/shared-types`):
- `EntityId` — `ent_<timestamp>_<random>`
- `ZoneId` — `zone_<timestamp>_<random>`
- `PlayerId` — `player_<timestamp>_<random>`
- `GameId` — `game_<timestamp>_<random>`

## Serialization

State uses **canonical JSON serialization** (sorted keys) for:
- Deterministic hashing and comparison
- Replay verification
- Debug snapshots

See `@turnbased/shared-utils` for `canonicalSerialize()` and `hashValue()`.
