// ─── Action Grammar Types ───────────────────────────────────────────
// Intent actions are ergonomic player requests; canonical actions are the
// reducer-ready, validation-friendly mutations the engine actually applies.

import type {
  ActionId,
  EntityId,
  PlayerId,
  TriggerId,
  ZoneId,
} from '@turnbased/shared-types';

export type {
  ActionId,
  EntityId,
  PlayerId,
  TriggerId,
  ZoneId,
} from '@turnbased/shared-types';

export type ActionSourceType = 'player' | 'trigger' | 'system' | 'ai';

export interface ActionSource {
  type: ActionSourceType;
  playerId?: PlayerId;
  triggerId?: TriggerId;
}

export interface IntentAction<TType extends string = string> {
  type: TType;
  payload: Record<string, unknown>;
  source: ActionSource;
  timestamp: number;
}

export interface DecisionOptionPayload {
  id: string;
  label: string;
  description?: string;
  entityId?: EntityId;
  zoneId?: ZoneId;
  disabled?: boolean;
  disabledReason?: string;
  metadata?: Record<string, unknown>;
}

export interface PendingDecisionPayload {
  id: string;
  playerId: PlayerId;
  type: 'choose_option' | 'choose_target' | 'choose_entity' | 'confirm';
  prompt: string;
  options: DecisionOptionPayload[];
  minChoices: number;
  maxChoices: number;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface StepDefinitionPayload {
  name: string;
  autoAdvance: boolean;
  requiresPlayerAction: boolean;
}

export interface PhaseDefinitionPayload {
  name: string;
  steps: StepDefinitionPayload[];
}

export type CanonicalActionType =
  | 'MOVE_ENTITY'
  | 'CREATE_ENTITY'
  | 'DESTROY_ENTITY'
  | 'SET_PROPERTY'
  | 'TRANSFER_CONTROL'
  | 'DRAW_FROM_ZONE'
  | 'SHUFFLE_ZONE'
  | 'REVEAL_ENTITY'
  | 'HIDE_ENTITY'
  | 'PROMPT_PLAYER'
  | 'CHOOSE_OPTION'
  | 'PASS_PRIORITY'
  | 'ADVANCE_STEP'
  | 'ADVANCE_PHASE'
  | 'END_TURN'
  | 'QUEUE_STACK_ITEM'
  | 'RESOLVE_STACK_ITEM'
  | 'ADD_RESOURCE'
  | 'REMOVE_RESOURCE'
  | 'SET_SCORE'
  | 'ELIMINATE_PLAYER'
  | 'END_GAME'
  | 'ADD_EXTRA_TURN'
  | 'SKIP_TURN'
  | 'REVERSE_TURN_ORDER'
  | 'INSERT_PHASE'
  | 'INSERT_STEP';

interface CanonicalActionBase<TType extends CanonicalActionType, TPayload> {
  type: TType;
  payload: TPayload;
  source: ActionSource;
  timestamp: number;
}

export type MoveEntityAction = CanonicalActionBase<
  'MOVE_ENTITY',
  {
    entityId: EntityId;
    fromZoneId: ZoneId;
    toZoneId: ZoneId;
    position?: number;
  }
>;

export type CreateEntityAction = CanonicalActionBase<
  'CREATE_ENTITY',
  {
    entity: {
      id: EntityId;
      type: string;
      componentType: string;
      zoneId: ZoneId;
      ownerId: PlayerId | null;
      controllerId: PlayerId | null;
      position: number;
      faceUp: boolean;
      properties: Record<string, unknown>;
      tags: string[];
    };
    zoneId: ZoneId;
  }
>;

export type DestroyEntityAction = CanonicalActionBase<
  'DESTROY_ENTITY',
  {
    entityId: EntityId;
  }
>;

export type SetPropertyAction = CanonicalActionBase<
  'SET_PROPERTY',
  {
    targetType: 'entity' | 'zone' | 'player' | 'game';
    targetId?: EntityId | ZoneId | PlayerId;
    key: string;
    value: unknown;
  }
>;

export type TransferControlAction = CanonicalActionBase<
  'TRANSFER_CONTROL',
  {
    entityId: EntityId;
    newControllerId: PlayerId | null;
  }
>;

export type DrawFromZoneAction = CanonicalActionBase<
  'DRAW_FROM_ZONE',
  {
    sourceZoneId: ZoneId;
    targetZoneId: ZoneId;
    count: number;
  }
>;

export type ShuffleZoneAction = CanonicalActionBase<
  'SHUFFLE_ZONE',
  {
    zoneId: ZoneId;
  }
>;

export type RevealEntityAction = CanonicalActionBase<
  'REVEAL_ENTITY',
  {
    entityId: EntityId;
    toPlayers?: PlayerId[];
  }
>;

export type HideEntityAction = CanonicalActionBase<
  'HIDE_ENTITY',
  {
    entityId: EntityId;
  }
>;

export type PromptPlayerAction = CanonicalActionBase<
  'PROMPT_PLAYER',
  {
    decision: PendingDecisionPayload;
  }
>;

export type ChooseOptionAction = CanonicalActionBase<
  'CHOOSE_OPTION',
  {
    decisionId: string;
    chosenOptionIds: string[];
  }
>;

export type PassPriorityAction = CanonicalActionBase<
  'PASS_PRIORITY',
  {
    playerId: PlayerId;
  }
>;

export type AdvanceStepAction = CanonicalActionBase<'ADVANCE_STEP', Record<string, never>>;
export type AdvancePhaseAction = CanonicalActionBase<'ADVANCE_PHASE', Record<string, never>>;
export type EndTurnAction = CanonicalActionBase<'END_TURN', Record<string, never>>;

export type QueueStackItemAction = CanonicalActionBase<
  'QUEUE_STACK_ITEM',
  {
    stackItem: {
      id: string;
      source: string;
      effect: CanonicalAction;
      controllerId: PlayerId;
      priority: number;
      isResolved?: boolean;
    };
  }
>;

export type ResolveStackItemAction = CanonicalActionBase<
  'RESOLVE_STACK_ITEM',
  {
    stackItemId: string;
  }
>;

export type AddResourceAction = CanonicalActionBase<
  'ADD_RESOURCE',
  {
    playerId: PlayerId;
    resource: string;
    amount: number;
  }
>;

export type RemoveResourceAction = CanonicalActionBase<
  'REMOVE_RESOURCE',
  {
    playerId: PlayerId;
    resource: string;
    amount: number;
  }
>;

export type SetScoreAction = CanonicalActionBase<
  'SET_SCORE',
  {
    playerId: PlayerId;
    score: number;
  }
>;

export type EliminatePlayerAction = CanonicalActionBase<
  'ELIMINATE_PLAYER',
  {
    playerId: PlayerId;
  }
>;

export type EndGameAction = CanonicalActionBase<
  'END_GAME',
  {
    winnerId?: PlayerId | PlayerId[] | null;
  }
>;

export type AddExtraTurnAction = CanonicalActionBase<
  'ADD_EXTRA_TURN',
  {
    playerId: PlayerId;
  }
>;

export type SkipTurnAction = CanonicalActionBase<
  'SKIP_TURN',
  {
    playerId: PlayerId;
  }
>;

export type ReverseTurnOrderAction = CanonicalActionBase<
  'REVERSE_TURN_ORDER',
  Record<string, never>
>;

export type InsertPhaseAction = CanonicalActionBase<
  'INSERT_PHASE',
  {
    phase: PhaseDefinitionPayload;
    afterPhase?: string;
  }
>;

export type InsertStepAction = CanonicalActionBase<
  'INSERT_STEP',
  {
    step: StepDefinitionPayload;
    phaseName?: string;
    afterStep?: string;
  }
>;

export type CanonicalAction =
  | MoveEntityAction
  | CreateEntityAction
  | DestroyEntityAction
  | SetPropertyAction
  | TransferControlAction
  | DrawFromZoneAction
  | ShuffleZoneAction
  | RevealEntityAction
  | HideEntityAction
  | PromptPlayerAction
  | ChooseOptionAction
  | PassPriorityAction
  | AdvanceStepAction
  | AdvancePhaseAction
  | EndTurnAction
  | QueueStackItemAction
  | ResolveStackItemAction
  | AddResourceAction
  | RemoveResourceAction
  | SetScoreAction
  | EliminatePlayerAction
  | EndGameAction
  | AddExtraTurnAction
  | SkipTurnAction
  | ReverseTurnOrderAction
  | InsertPhaseAction
  | InsertStepAction;

export type ActionLogEntry = CanonicalAction & {
  id: ActionId;
};

export type CanonicalActionTemplate = Omit<CanonicalAction, 'source' | 'timestamp'> & {
  source?: ActionSource;
  timestamp?: number;
};

export interface IntentActionLoweringResult {
  intent: IntentAction;
  canonicalActions: CanonicalAction[];
}
