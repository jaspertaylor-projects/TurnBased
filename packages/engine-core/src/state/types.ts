// ─── Core State Types ───────────────────────────────────────────────
// Normalized state model for the TurnBased game engine.
// All game state is stored in a single GameState object.

import type {
  ComponentInstanceId,
  Visibility,
  ParticipantRole,
} from '@turnbased/shared-types';
import type {
  ActionLogEntry,
  CanonicalAction,
  CanonicalActionTemplate,
} from '../actions';
import type {
  EntityId,
  ZoneId,
  PlayerId,
  GameId,
  TriggerId,
} from '@turnbased/shared-types';

// Re-export shared types for convenience
export type {
  EntityId,
  ZoneId,
  PlayerId,
  GameId,
  TriggerId,
  ComponentInstanceId,
} from '@turnbased/shared-types';

// ─── Game State ─────────────────────────────────────────────────────

/** The complete game state — single source of truth */
export interface GameState {
  /** Unique game identifier */
  gameId: GameId;
  /** State version — increments with each action applied */
  version: number;

  /** All entities indexed by ID */
  entities: Record<string, Entity>;
  /** All zones indexed by ID */
  zones: Record<string, Zone>;
  /** All players indexed by ID */
  players: Record<string, PlayerState>;
  /** Current turn order (can change mid-game) */
  playerOrder: PlayerId[];

  /** Turn/phase/step tracking */
  turnState: TurnState;

  /** Pending decisions awaiting player input */
  pendingDecisions: PendingDecision[];
  /** Effect stack for trigger/response resolution */
  stack: StackItem[];
  /** Current priority / response window state */
  priorityWindow: PriorityWindowState;

  /** Per-entity and per-zone visibility overrides */
  visibilityMap: VisibilityMap;

  /** Seeded random number generator state */
  randomState: RandomState;

  /** Game lifecycle status */
  status: GameStatus;
  /** Winner(s) when game is finished */
  winner: PlayerId | PlayerId[] | null;
  /** Ordered log of all actions applied */
  actionLog: ActionLogEntry[];

  /** Component registry — which component instances exist */
  componentInstances: Record<string, ComponentInstance>;
}

export type GameStatus = 'setup' | 'playing' | 'paused' | 'finished';

// ─── Entity ─────────────────────────────────────────────────────────

/** A game object: card, piece, token, marker, etc. */
export interface Entity {
  id: EntityId;
  /** Entity archetype (e.g., 'card', 'piece', 'token') */
  type: string;
  /** Which component definition this instantiates */
  componentType: string;
  /** Current zone location */
  zoneId: ZoneId;
  /** Who owns this entity (may be null for communal entities) */
  ownerId: PlayerId | null;
  /** Who currently controls this entity (may differ from owner) */
  controllerId: PlayerId | null;
  /** Order within zone (for hands, decks, board positions, etc.) */
  position: number;
  /** Whether entity is face-up (visible to non-controllers) */
  faceUp: boolean;
  /** Component-specific data */
  properties: Record<string, unknown>;
  /** Flexible tags for rules queries */
  tags: string[];
}

// ─── Zone ───────────────────────────────────────────────────────────

/** A container for entities with specific rules */
export interface Zone {
  id: ZoneId;
  /** Zone archetype (e.g., 'hand', 'deck', 'board', 'discard') */
  type: string;
  /** Human-readable name */
  name: string;
  /** Zone owner (e.g., which player's hand, or null for shared zones) */
  ownerId: PlayerId | null;
  /** Ordered list of entity IDs in this zone */
  entityIds: EntityId[];
  /** Maximum number of entities (null = unlimited) */
  maxCapacity: number | null;
  /** Visibility rules for this zone */
  visibility: ZoneVisibility;
  /** Zone-specific data */
  properties: Record<string, unknown>;
}

/** Visibility configuration for a zone */
export interface ZoneVisibility {
  /** Default visibility for zone contents */
  defaultVisibility: Visibility;
  /** Per-player visibility overrides */
  overrides: Record<string, Visibility>;
}

// ─── Player State ───────────────────────────────────────────────────

/** Per-player game state */
export interface PlayerState {
  id: PlayerId;
  displayName: string;
  role: ParticipantRole;
  /** Whether it's currently this player's turn */
  isActive: boolean;
  /** Whether this player has been eliminated */
  isEliminated: boolean;
  /** Numeric score */
  score: number;
  /** Named resource counters (e.g., { gold: 5, wood: 3 }) */
  resources: Record<string, number>;
  /** Player-specific data */
  properties: Record<string, unknown>;
}

// ─── Turn State ─────────────────────────────────────────────────────

/** Tracks the current position in the turn structure */
export interface TurnState {
  roundNumber: number;
  turnNumber: number;
  activePlayerId: PlayerId;
  currentPhase: string;
  currentStep: string;
  phaseIndex: number;
  stepIndex: number;
  /** Immutable template for each new turn before temporary inserts are applied */
  basePhases: PhaseDefinition[];
  /** The turn structure definition */
  phases: PhaseDefinition[];
  /** Direction of turn order rotation */
  turnDirection: TurnDirection;
  /** Whether the current turn came from normal order or the extra-turn queue */
  currentTurnKind: TurnKind;
  /** Queue of players who have extra turns pending */
  extraTurns: PlayerId[];
  /** Players whose next turn will be skipped */
  skippedPlayers: PlayerId[];
  /** Players who have completed a normal turn in the current round */
  completedPlayerIdsThisRound: PlayerId[];
}

export type TurnDirection = 'forward' | 'reverse';
export type TurnKind = 'normal' | 'extra';

/** Defines a phase within a turn */
export interface PhaseDefinition {
  name: string;
  steps: StepDefinition[];
  /** Actions to execute when entering this phase */
  onEnter?: ActionLogEntry[];
  /** Actions to execute when leaving this phase */
  onExit?: ActionLogEntry[];
}

/** Defines a step within a phase */
export interface StepDefinition {
  name: string;
  /** Whether the step auto-advances after effects resolve */
  autoAdvance: boolean;
  /** Whether player input is needed in this step */
  requiresPlayerAction: boolean;
  onEnter?: ActionLogEntry[];
  onExit?: ActionLogEntry[];
}

// ─── Pending Decision ───────────────────────────────────────────────

/** A prompt requiring player input before the game can continue */
export interface PendingDecision {
  id: string;
  /** Which player must decide */
  playerId: PlayerId;
  type: DecisionType;
  /** Human-readable prompt */
  prompt: string;
  /** Available choices */
  options: DecisionOption[];
  minChoices: number;
  maxChoices: number;
  /** Optional timeout in milliseconds */
  timeoutMs?: number;
  /** Additional serialized engine metadata */
  metadata?: Record<string, unknown>;
}

export type DecisionType = 'choose_option' | 'choose_target' | 'choose_entity' | 'confirm';

export interface DecisionOption {
  id: string;
  label: string;
  description?: string;
  entityId?: EntityId;
  zoneId?: ZoneId;
  disabled?: boolean;
  disabledReason?: string;
  metadata?: Record<string, unknown>;
}

// ─── Stack Item ─────────────────────────────────────────────────────

/** A pending effect waiting for priority resolution */
export interface StackItem {
  id: string;
  /** What created this stack item (trigger ID, action type, etc.) */
  source: string;
  /** The effect to apply when this item resolves */
  effect: CanonicalAction;
  /** Who controls this effect */
  controllerId: PlayerId;
  /** Resolution order (higher resolves first) */
  priority: number;
  /** Whether this has been resolved */
  isResolved: boolean;
}

// ─── Priority Window ────────────────────────────────────────────────

/** Tracks the current priority / response window */
export interface PriorityWindowState {
  isOpen: boolean;
  /** Which player currently has priority */
  currentPlayerId: PlayerId | null;
  /** Players who have passed in the current cycle */
  passedPlayerIds: PlayerId[];
  /** What most recently opened the current window */
  openedBy: PriorityWindowSource | null;
}

export type PriorityWindowSource = 'action' | 'stack';

// ─── Visibility Map ─────────────────────────────────────────────────

/** Per-entity and per-zone visibility overrides */
export interface VisibilityMap {
  /** Whether each entity is visible to each player */
  entityVisibility: Record<string, Record<string, boolean>>;
  /** Whether each zone's contents are visible to each player */
  zoneVisibility: Record<string, Record<string, boolean>>;
}

// ─── Random State ───────────────────────────────────────────────────

/** State for the seeded random number generator */
export interface RandomState {
  /** Initial seed */
  seed: number;
  /** How many random values have been consumed */
  callCount: number;
}

// ─── Component Instance ─────────────────────────────────────────────

/** An instance of a component placed in the game */
export interface ComponentInstance {
  instanceId: ComponentInstanceId;
  componentType: string;
  properties: Record<string, unknown>;
  children: ComponentInstanceId[];
  parentId: ComponentInstanceId | null;
}

// ─── Trigger Subscription ───────────────────────────────────────────

/** A trigger that fires effects in response to events */
export interface TriggerSubscription {
  id: TriggerId;
  type: TriggerType;
  /** Event type to listen for */
  event: string;
  /** Condition expression to evaluate */
  condition?: string;
  /** Effect(s) to apply when triggered */
  effect: CanonicalActionTemplate | CanonicalActionTemplate[];
  /** Who controls this trigger */
  controllerId: PlayerId;
  /** Entity that owns this trigger */
  sourceEntityId?: EntityId;
  /** Resolution order (higher = resolves first) */
  priority: number;
  /** Immediate FIFO queue or response stack */
  resolution: TriggerResolution;
  /** Remove after first activation */
  once: boolean;
  /** Only active during specific phase */
  phase?: string;
  /** Prompt text for optional triggers */
  prompt?: string;
}

export type TriggerType = 'automatic' | 'optional' | 'replacement' | 'prevention';
export type TriggerResolution = 'immediate' | 'stack';

// ─── Priority Policy ────────────────────────────────────────────────

/** Configuration for response windows */
export interface PriorityPolicy {
  mode: PriorityMode;
  /** Events that open response windows (for 'limited' mode) */
  responseEvents?: string[];
  /** Auto-pass when player has no legal responses */
  autoPassEnabled: boolean;
  /** Per-player response timeout in milliseconds */
  timeoutMs?: number;
}

export type PriorityMode = 'none' | 'limited' | 'full';

// ─── Derived Views ──────────────────────────────────────────────────

/** A computed, viewer-specific read-only data slice */
export interface DerivedViewSnapshot {
  name: string;
  viewerId: PlayerId;
  data: Record<string, unknown>;
}

/** Contract for engine or extension-provided derived views */
export interface DerivedViewDefinition {
  name: string;
  compute: (state: GameState, viewerId: PlayerId) => Record<string, unknown>;
}

// ─── Game Definition ────────────────────────────────────────────────

/** The static definition of a game (manifest) */
export interface GameDefinition {
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  /** Turn structure */
  phases: PhaseDefinition[];
  /** Priority/response policy */
  priorityPolicy: PriorityPolicy;
  /** Initial zones to create */
  initialZones: Omit<Zone, 'entityIds'>[];
  /** Initial entities to create (may reference zones) */
  initialEntities: Omit<Entity, 'id'>[];
  /** Trigger subscriptions */
  triggers: Omit<TriggerSubscription, 'id'>[];
  /** Custom read-only derived views for UI and AI consumers */
  derivedViews?: DerivedViewDefinition[];
  /** Win condition expression */
  winCondition?: string;
  /** Rules text for AI consumption */
  rulesText?: string;
  /** Seed for deterministic randomness (0 = random seed) */
  defaultSeed?: number;
}
