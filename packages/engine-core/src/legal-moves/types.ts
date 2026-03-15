import type { CanonicalAction, PlayerId, ZoneId } from '../actions';
import type { GameState } from '../state';
import type {
  PlayerVisibleState,
  VisibilityProjectionOptions,
  VisibleEntity,
  VisiblePendingDecision,
  VisibleZone,
} from '../visibility';

export interface LegalMoveExplanation {
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

export interface LegalSubChoiceOption {
  id: string;
  label: string;
  description?: string;
  entityId?: string;
  zoneId?: ZoneId;
  disabled?: boolean;
  disabledReason?: string;
}

export interface LegalSubChoice {
  id: string;
  type: 'select_entity' | 'select_zone' | 'select_option' | 'set_value';
  prompt: string;
  options: LegalSubChoiceOption[];
  minChoices: number;
  maxChoices: number;
}

export interface LegalAction {
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

export interface LegalMoveTree {
  playerId: PlayerId;
  availableActions: LegalAction[];
  canPass: boolean;
  canCancel: boolean;
  pendingDecision: VisiblePendingDecision | null;
  visibleState: PlayerVisibleState;
}

export interface LegalMoveRequest {
  actionId: string;
  selectedEntityId?: string;
  destinationZoneId?: ZoneId;
  targetEntityId?: string;
  subChoiceSelections?: Record<string, string | number | boolean | string[]>;
}

export interface NormalizedLegalMoveRequest {
  selectedEntityId: string | null;
  destinationZoneId: ZoneId | null;
  targetEntityId: string | null;
  actionId: string;
  subChoiceSelections: Record<string, string | number | boolean | string[]>;
}

export interface LegalMoveValidationResult {
  isValid: boolean;
  errors: string[];
  normalizedRequest: NormalizedLegalMoveRequest | null;
}

export interface CompiledLegalMoveTree extends LegalMoveTree {
  getAction(actionId: string): LegalAction | undefined;
  validate(request: LegalMoveRequest): LegalMoveValidationResult;
  materialize(request: LegalMoveRequest): CanonicalAction[];
}

export interface LegalMoveGenerationHelpers {
  getVisibleEntity(entityId: string): VisibleEntity | undefined;
  getVisibleZone(zoneId: ZoneId): VisibleZone | undefined;
  listVisibleEntities(): VisibleEntity[];
  listVisibleZones(): VisibleZone[];
  toVisibleEntityId(entityId: string): string | null;
}

export interface LegalMoveGenerationContext {
  state: PlayerVisibleState;
  playerId: PlayerId;
  pendingDecision: VisiblePendingDecision | null;
  canAct: boolean;
  hasPriority: boolean;
  helpers: LegalMoveGenerationHelpers;
}

export interface LegalMoveExecutionContext extends LegalMoveGenerationContext {
  action: LegalAction;
  request: NormalizedLegalMoveRequest;
  resolveEntityId(entityId: string): string;
}

export interface LegalActionBlueprint {
  id?: string;
  type: string;
  displayName: string;
  description?: string;
  interactableEntities?: string[];
  validDestinations?: ZoneId[];
  validTargets?: string[];
  subChoices?: LegalSubChoice[];
  cost?: Record<string, number>;
  tags?: string[];
  explanation?: LegalMoveExplanation;
  canonicalActions?: CanonicalAction[];
  buildCanonicalActions?: (context: LegalMoveExecutionContext) => CanonicalAction[];
}

export interface LegalMoveDefinition {
  id: string;
  generate:
    | ((context: LegalMoveGenerationContext) => LegalActionBlueprint | LegalActionBlueprint[] | null | undefined)
    | undefined;
}

export interface LegalMoveGenerationOptions {
  playerId?: PlayerId;
  visibility?: VisibilityProjectionOptions;
  definitions?: LegalMoveDefinition[];
}

export interface LegalMoveEngineContext {
  fullState: GameState;
  visibleState: PlayerVisibleState;
  playerId: PlayerId;
}
