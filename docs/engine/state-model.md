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
  priorityWindow: PriorityWindowState;

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
  basePhases: PhaseDefinition[];
  phases: PhaseDefinition[];
  turnDirection: 'forward' | 'reverse';
  currentTurnKind: 'normal' | 'extra';
  extraTurns: PlayerId[];       // Queue of players with extra turns
  skippedPlayers: PlayerId[];
  completedPlayerIdsThisRound: PlayerId[];
}
```

- `basePhases` is the canonical per-turn template.
- `phases` is the mutable runtime copy for the current turn, so inserted phases/steps reset automatically on the next turn.
- `completedPlayerIdsThisRound` tracks normal-turn round progress. If turn-order mutations would revisit one of those players, the engine increments the round before starting that turn.

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
  metadata?: Record<string, unknown>;
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

## Priority Window

```typescript
interface PriorityWindowState {
  isOpen: boolean;
  currentPlayerId: PlayerId | null;
  passedPlayerIds: PlayerId[];
  openedBy: 'action' | 'stack' | null;
}
```

- `currentPlayerId` is the responder who may currently act or pass.
- `passedPlayerIds` resets whenever a new response is added or a stack item resolves.
- A player with a matching `pendingDecision` cannot pass until that decision is resolved.

## Trigger Subscription

```typescript
interface TriggerSubscription {
  id: TriggerId;
  type: 'automatic' | 'optional' | 'replacement' | 'prevention';
  event: string;
  effect: CanonicalActionTemplate | CanonicalActionTemplate[];
  controllerId: PlayerId;
  sourceEntityId?: EntityId;
  priority: number;
  resolution: 'immediate' | 'stack';
  once: boolean;
  phase?: string;
  prompt?: string;
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

## Player-Visible Projection

The full `GameState` is never handed directly to UI, spectators, or AI seats. Instead, `engine-core` projects a `PlayerVisibleState` for a specific viewer:

```typescript
interface PlayerVisibleState {
  gameId: GameId;
  version: number;
  status: GameStatus;
  winner: PlayerId | PlayerId[] | null;
  players: Record<PlayerId, PlayerState>;
  zones: Record<ZoneId, VisibleZone>;
  entities: Record<string, VisibleEntity>;
  turnState: TurnState;
  pendingDecisions: VisiblePendingDecision[];
  stack: VisibleStackItem[];
  priorityWindow: PriorityWindowState;
  actionLog: VisibleActionLogEntry[];
  viewer: ResolvedViewerContext;
  redactions: VisibilityRedaction[];
}
```

Projection rules:
- Private or hidden zones stay in the view, but their `entityIds` are removed and counted via `hiddenEntityCount`.
- Face-down entities in otherwise visible zones remain present but downgrade to `presence_only` entries with redacted type/component/property data.
- Player `properties` default to owner-only unless field policies explicitly mark them public.
- Pending decisions are only visible to the deciding player, unless the viewer is an omniscient spectator/host.
- Action-log and stack payloads are sanitized so hidden entity IDs, zone IDs, and private decision payloads do not leak.

Spectators default to `public_only` access. Omniscient spectator tooling must opt in explicitly.

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
