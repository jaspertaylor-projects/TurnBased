import type {
  CompiledLegalMoveTree,
  LegalAction,
  LegalSubChoice,
  VisiblePendingDecision,
  ZoneId,
} from '@turnbased/engine-core';

export type UIActionKind = 'selection' | 'menu' | 'decision' | 'priority' | 'global';
export type UIPopupChooserKind = 'sub_choice' | 'pending_decision';
export type UIPopupSelectionMode = 'single' | 'multiple' | 'value';
export type UIKeyboardIntent =
  | 'focus_next'
  | 'focus_previous'
  | 'select'
  | 'confirm'
  | 'cancel'
  | 'navigate_horizontal'
  | 'navigate_vertical';

export interface UISelectionState {
  selectedActionId?: string | null;
  selectedEntityId?: string | null;
  selectedZoneId?: ZoneId | null;
  selectedTargetEntityId?: string | null;
  dragEntityId?: string | null;
  subChoiceSelections?: Record<string, string | number | boolean | string[]>;
}

export interface UIAffordanceOptions {
  selection?: UISelectionState;
}

export interface UIKeyboardShortcut {
  key: string;
  intent: UIKeyboardIntent;
  description: string;
}

export interface UIAction {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  shortcut?: string;
  kind: UIActionKind;
  enabled: boolean;
  ready: boolean;
  selected: boolean;
  sourceEntityIds: string[];
  destinationZoneIds: ZoneId[];
  targetEntityIds: string[];
  chooserIds: string[];
  tags: string[];
}

export interface UIPopupChooserOption {
  id: string;
  label: string;
  description?: string;
  entityId?: string;
  zoneId?: ZoneId;
  disabled: boolean;
  disabledReason?: string;
  selected: boolean;
}

export interface UIPopupChooser {
  id: string;
  actionId: string;
  subChoiceId: string;
  title: string;
  prompt: string;
  kind: UIPopupChooserKind;
  selectionMode: UIPopupSelectionMode;
  minChoices: number;
  maxChoices: number;
  visible: boolean;
  options: UIPopupChooserOption[];
}

export interface UIPendingDecision {
  id: string;
  prompt: string;
  type: VisiblePendingDecision['type'];
  minChoices: number;
  maxChoices: number;
  actionIds: string[];
  chooserIds: string[];
  actions: UIAction[];
}

export interface UIDestinationAffordance {
  zoneId: ZoneId;
  actionIds: string[];
  sourceEntityIds: string[];
  selected: boolean;
  highlighted: boolean;
  dropTarget: boolean;
  disabled: boolean;
}

export interface UIItemAffordance {
  entityId: string;
  actionIds: string[];
  destinationZoneIds: ZoneId[];
  targetEntityIds: string[];
  menuActions: UIAction[];
  state: EntityUIState;
}

export interface UIDestinationSelectionAffordance {
  zoneId: ZoneId;
  actionIds: string[];
  sourceEntityIds: string[];
  menuActions: UIAction[];
  state: ZoneUIState;
}

export interface EntityUIState {
  interactable: boolean;
  selected: boolean;
  targeted: boolean;
  highlighted: boolean;
  disabled: boolean;
  dragSource: boolean;
  dropTarget: boolean;
  availableActionIds: string[];
  menuActions: UIAction[];
  validDestinationIds: ZoneId[];
  validTargetIds: string[];
}

export interface ZoneUIState {
  interactable: boolean;
  selected: boolean;
  highlighted: boolean;
  disabled: boolean;
  dropTarget: boolean;
  sourceEntityIds: string[];
  availableActionIds: string[];
  menuActions: UIAction[];
}

export interface UIAffordanceState {
  interactableEntities: string[];
  interactableZones: ZoneId[];
  selectedEntityId: string | null;
  selectedZoneId: ZoneId | null;
  selectedTargetEntityId: string | null;
  validDestinations: UIDestinationAffordance[];
  validTargets: string[];
  availableActions: UIAction[];
  globalMenuActions: UIAction[];
  popupChoosers: UIPopupChooser[];
  pendingDecision: UIPendingDecision | null;
  entityStates: Record<string, EntityUIState>;
  zoneStates: Record<string, ZoneUIState>;
  keyboardShortcuts: UIKeyboardShortcut[];
}

export interface UIActionResolutionContext {
  moveTree: CompiledLegalMoveTree;
  action: LegalAction;
  selection: Required<UISelectionState>;
}

export interface UISubChoiceResolutionContext {
  moveTree: CompiledLegalMoveTree;
  action: LegalAction;
  subChoice: LegalSubChoice;
  selection: Required<UISelectionState>;
}
