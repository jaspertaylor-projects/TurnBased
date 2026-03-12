// @turnbased/shared-types
// Common types shared across app, play host, engine, edge functions, and DB clients

// ─── Branded ID Types ───────────────────────────────────────────────
// Using branded types for type-safe IDs that are strings at runtime

/** Branded type helper — creates a nominal type from a base type */
type Brand<T, B extends string> = T & { readonly __brand: B };

/** Unique identifier for a game entity (piece, card, token, etc.) */
export type EntityId = Brand<string, 'EntityId'>;

/** Unique identifier for a zone (board, hand, deck, discard, etc.) */
export type ZoneId = Brand<string, 'ZoneId'>;

/** Unique identifier for a player in a game session */
export type PlayerId = Brand<string, 'PlayerId'>;

/** Unique identifier for a component instance */
export type ComponentInstanceId = Brand<string, 'ComponentInstanceId'>;

/** Unique identifier for a game instance/session */
export type GameId = Brand<string, 'GameId'>;

/** Unique identifier for a room */
export type RoomId = Brand<string, 'RoomId'>;

/** Unique identifier for an action in the action log */
export type ActionId = Brand<string, 'ActionId'>;

/** Unique identifier for a trigger subscription */
export type TriggerId = Brand<string, 'TriggerId'>;

// ─── ID Factory Helpers ─────────────────────────────────────────────

export function createEntityId(id: string): EntityId { return id as EntityId; }
export function createZoneId(id: string): ZoneId { return id as ZoneId; }
export function createPlayerId(id: string): PlayerId { return id as PlayerId; }
export function createComponentInstanceId(id: string): ComponentInstanceId { return id as ComponentInstanceId; }
export function createGameId(id: string): GameId { return id as GameId; }
export function createRoomId(id: string): RoomId { return id as RoomId; }
export function createActionId(id: string): ActionId { return id as ActionId; }
export function createTriggerId(id: string): TriggerId { return id as TriggerId; }

// ─── Common Enums ───────────────────────────────────────────────────

/** Who can see an entity or zone */
export enum Visibility {
  /** Visible to all players and spectators */
  Public = 'public',
  /** Visible only to the owner/controller */
  Private = 'private',
  /** Hidden from everyone (face-down, etc.) */
  Hidden = 'hidden',
  /** Visible only to specific players */
  Restricted = 'restricted',
}

/** Role of a participant in a game session */
export enum ParticipantRole {
  Player = 'player',
  Spectator = 'spectator',
  AI = 'ai',
  Host = 'host',
}

/** Project customization tier */
export enum ProjectMode {
  Standard = 'standard',
  Advanced = 'advanced',
  Experimental = 'experimental',
}
