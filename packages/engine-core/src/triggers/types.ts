import type {
  ActionSource,
  CanonicalAction,
  CanonicalActionTemplate,
  CanonicalActionType,
  DomainEventType,
} from '../actions';
import type {
  EntityId,
  GameState,
  PlayerId,
  PriorityPolicy,
  PriorityWindowState,
  TriggerId,
  TriggerResolution,
  TriggerSubscription,
  TriggerType,
} from '../state';

export interface DomainEvent {
  id: string;
  type: DomainEventType;
  actionType: CanonicalActionType;
  action: CanonicalAction;
  source: ActionSource;
  timestamp: number;
  depth: number;
  sequence: number;
  payload: Record<string, unknown>;
  actionLogId?: string;
}

export interface TriggerMatchContext {
  event: DomainEvent;
  action: CanonicalAction;
  previousState: GameState;
  state: GameState;
}

export interface TriggerExecutionContext extends TriggerMatchContext {
  trigger: RegisteredTrigger;
}

export interface TriggerRegistration
  extends Omit<TriggerSubscription, 'condition' | 'effect' | 'resolution' | 'prompt'> {
  condition?: string | ((context: TriggerMatchContext) => boolean);
  effect?: CanonicalActionTemplate | CanonicalActionTemplate[];
  resolution?: TriggerResolution;
  prompt?: string;
  matches?: (context: TriggerMatchContext) => boolean;
  createActions?: (context: TriggerExecutionContext) => CanonicalActionTemplate[];
  replace?: (context: TriggerExecutionContext) => CanonicalActionTemplate[] | null;
  prevent?: (context: TriggerExecutionContext) => boolean;
}

export interface RegisteredTrigger
  extends Omit<TriggerRegistration, 'resolution'> {
  registrationIndex: number;
  resolution: TriggerResolution;
}

export interface TriggerEngineOptions {
  triggers?: readonly TriggerRegistration[];
  autoResolveStack?: boolean;
  maxDepth?: number;
  priorityPolicy?: PriorityPolicy;
  canPlayerRespond?: (context: PriorityResponderContext) => boolean;
}

export interface TriggerDispatchResult {
  state: GameState;
  emittedEvents: DomainEvent[];
}

export interface OptionalTriggerDecisionMetadata {
  kind: 'optional_trigger';
  triggerId: TriggerId;
  eventId: string;
  resolution: TriggerResolution;
  actions: CanonicalAction[];
}

export interface TriggerQueueEntry {
  trigger: RegisteredTrigger;
  actions: CanonicalAction[];
  resolution: TriggerResolution;
}

export interface PriorityResponderContext {
  state: GameState;
  playerId: PlayerId;
  priorityWindow: PriorityWindowState;
}

export type TriggerableType = Exclude<TriggerType, 'replacement' | 'prevention'>;

export interface EventMatchCandidate {
  event: DomainEvent;
  trigger: RegisteredTrigger;
  sourceEntityId?: EntityId;
}
