import { ParticipantRole } from '@turnbased/shared-types';

import type { ActionLogEntry } from '../actions';
import type {
  DecisionOption,
  DecisionType,
  GameState,
  GameStatus,
  PendingDecision,
  PlayerId,
  PlayerState,
  PriorityWindowState,
  StackItem,
  TurnState,
  ZoneId,
} from '../state';

export type SpectatorVisibilityPolicy = 'public_only' | 'omniscient';

export interface ViewerContext {
  viewerId: PlayerId | null;
  role?: ParticipantRole;
}

export interface ResolvedViewerContext {
  viewerId: PlayerId | null;
  role: ParticipantRole;
  spectatorPolicy: SpectatorVisibilityPolicy;
}

export type FieldVisibilityRule =
  | 'public'
  | 'viewer'
  | 'owner'
  | 'controller'
  | 'owner_or_controller'
  | 'hidden'
  | {
      allowedViewerIds?: PlayerId[];
      allowSpectators?: boolean;
      allowViewer?: boolean;
      allowOwner?: boolean;
      allowController?: boolean;
      public?: boolean;
    };

export type VisibilityFieldPolicy = Record<string, FieldVisibilityRule>;

export type VisibilityFieldPolicyResolver<TItem> =
  | VisibilityFieldPolicy
  | ((context: {
      item: TItem;
      state: GameState;
      viewer: ResolvedViewerContext;
    }) => VisibilityFieldPolicy | undefined);

export interface VisibilityFieldPolicies {
  entityProperties?: VisibilityFieldPolicyResolver<GameState['entities'][string]>;
  zoneProperties?: VisibilityFieldPolicyResolver<GameState['zones'][string]>;
  playerProperties?: VisibilityFieldPolicyResolver<PlayerState>;
  pendingDecisionMetadata?: VisibilityFieldPolicyResolver<PendingDecision>;
  actionLogPayload?: VisibilityFieldPolicyResolver<ActionLogEntry>;
  stackEffectPayload?: VisibilityFieldPolicyResolver<StackItem>;
}

export interface VisibilityProjectionOptions {
  spectatorPolicy?: SpectatorVisibilityPolicy;
  includeHiddenCounts?: boolean;
  fieldPolicies?: VisibilityFieldPolicies;
}

export type VisibilityRedactionReason =
  | 'zone_hidden'
  | 'entity_hidden'
  | 'entity_details_hidden'
  | 'field_hidden'
  | 'pending_decision_hidden'
  | 'action_log_hidden'
  | 'stack_hidden';

export interface VisibilityRedaction {
  path: string;
  reason: VisibilityRedactionReason;
}

export interface VisibleEntity {
  id: string;
  zoneId: ZoneId;
  position: number;
  type: string | null;
  componentType: string | null;
  ownerId: PlayerId | null;
  controllerId: PlayerId | null;
  faceUp: boolean;
  properties: Record<string, unknown>;
  tags: string[];
  visibility: 'full' | 'presence_only';
}

export interface VisibleZone {
  id: ZoneId;
  type: string;
  name: string;
  ownerId: PlayerId | null;
  entityIds: string[];
  hiddenEntityCount: number;
  maxCapacity: number | null;
  properties: Record<string, unknown>;
  isVisibleToViewer: boolean;
}

export interface VisiblePendingDecision {
  id: string;
  playerId: PlayerId;
  type: DecisionType;
  prompt: string;
  options: DecisionOption[];
  minChoices: number;
  maxChoices: number;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface VisibleActionLogEntry
  extends Omit<ActionLogEntry, 'payload'> {
  payload: Record<string, unknown>;
  redacted: boolean;
}

export interface VisibleStackItem
  extends Omit<StackItem, 'effect'> {
  effect: VisibleActionLogEntry;
}

export interface PlayerVisibleState {
  gameId: GameState['gameId'];
  version: number;
  status: GameStatus;
  winner: GameState['winner'];
  playerOrder: PlayerId[];
  players: Record<string, PlayerState>;
  zones: Record<string, VisibleZone>;
  entities: Record<string, VisibleEntity>;
  turnState: TurnState;
  pendingDecisions: VisiblePendingDecision[];
  stack: VisibleStackItem[];
  priorityWindow: PriorityWindowState;
  actionLog: VisibleActionLogEntry[];
  randomState: GameState['randomState'];
  viewer: ResolvedViewerContext;
  redactions: VisibilityRedaction[];
}
