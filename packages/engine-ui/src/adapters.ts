import type {
  CompiledLegalMoveTree,
  LegalAction,
  LegalMoveRequest,
  LegalSubChoice,
  ZoneId,
} from '@turnbased/engine-core';

import type {
  EntityUIState,
  UIAction,
  UIAffordanceOptions,
  UIAffordanceState,
  UIDestinationAffordance,
  UIDestinationSelectionAffordance,
  UIItemAffordance,
  UIKeyboardShortcut,
  UIPendingDecision,
  UIPopupChooser,
  UIPopupChooserKind,
  UIPopupSelectionMode,
  UISelectionState,
  ZoneUIState,
} from './types';

const EMPTY_SELECTION: Required<UISelectionState> = {
  selectedActionId: null,
  selectedEntityId: null,
  selectedZoneId: null,
  selectedTargetEntityId: null,
  dragEntityId: null,
  subChoiceSelections: {},
};

export const DEFAULT_KEYBOARD_SHORTCUTS: UIKeyboardShortcut[] = [
  {
    key: 'Tab',
    intent: 'focus_next',
    description: 'Move focus to the next interactable entity, zone, or chooser option.',
  },
  {
    key: 'Shift+Tab',
    intent: 'focus_previous',
    description: 'Move focus to the previous interactable entity, zone, or chooser option.',
  },
  {
    key: 'Enter',
    intent: 'confirm',
    description: 'Confirm the focused action, destination, or popup choice.',
  },
  {
    key: 'Space',
    intent: 'select',
    description: 'Select the focused entity or destination without committing immediately.',
  },
  {
    key: 'Escape',
    intent: 'cancel',
    description: 'Cancel the current selection or close the active popup chooser.',
  },
  {
    key: 'ArrowLeft/ArrowRight',
    intent: 'navigate_horizontal',
    description: 'Move between peer destinations, menu items, or single-row chooser options.',
  },
  {
    key: 'ArrowUp/ArrowDown',
    intent: 'navigate_vertical',
    description: 'Move through popup choices, menus, and interactable lists.',
  },
];

function uniqueValues<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function normalizeSelection(options?: UIAffordanceOptions): Required<UISelectionState> {
  return {
    ...EMPTY_SELECTION,
    ...options?.selection,
    subChoiceSelections: options?.selection?.subChoiceSelections ?? {},
  };
}

function matchesSelection(action: LegalAction, selection: Required<UISelectionState>): boolean {
  if (selection.selectedActionId && selection.selectedActionId !== action.id) {
    return false;
  }

  if (
    selection.selectedEntityId &&
    action.interactableEntities.length > 0 &&
    !action.interactableEntities.includes(selection.selectedEntityId)
  ) {
    return false;
  }

  if (
    selection.selectedZoneId &&
    action.validDestinations.length > 0 &&
    !action.validDestinations.includes(selection.selectedZoneId)
  ) {
    return false;
  }

  if (
    selection.selectedTargetEntityId &&
    action.validTargets.length > 0 &&
    !action.validTargets.includes(selection.selectedTargetEntityId)
  ) {
    return false;
  }

  return true;
}

function buildRequest(actionId: string, selection: Required<UISelectionState>): LegalMoveRequest {
  const request: LegalMoveRequest = {
    actionId,
  };

  if (selection.selectedEntityId) {
    request.selectedEntityId = selection.selectedEntityId;
  }

  if (selection.selectedZoneId) {
    request.destinationZoneId = selection.selectedZoneId;
  }

  if (selection.selectedTargetEntityId) {
    request.targetEntityId = selection.selectedTargetEntityId;
  }

  if (Object.keys(selection.subChoiceSelections).length > 0) {
    request.subChoiceSelections = selection.subChoiceSelections;
  }

  return request;
}

function inferActionKind(action: LegalAction): UIAction['kind'] {
  if (action.type === 'PASS_PRIORITY') {
    return 'priority';
  }

  if (action.tags.includes('decision') || action.type === 'CHOOSE_OPTION') {
    return 'decision';
  }

  if ((action.subChoices?.length ?? 0) > 0) {
    return 'menu';
  }

  if (
    action.interactableEntities.length > 0 ||
    action.validDestinations.length > 0 ||
    action.validTargets.length > 0
  ) {
    return 'selection';
  }

  return 'global';
}

function selectionModeForSubChoice(subChoice: LegalSubChoice): UIPopupSelectionMode {
  if (subChoice.type === 'set_value') {
    return 'value';
  }

  return subChoice.maxChoices === 1 ? 'single' : 'multiple';
}

function chooserKindForAction(
  moveTree: CompiledLegalMoveTree,
  action: LegalAction,
): UIPopupChooserKind {
  return moveTree.pendingDecision && action.tags.includes('decision')
    ? 'pending_decision'
    : 'sub_choice';
}

function selectionIncludesOption(
  subChoice: LegalSubChoice,
  selection: Required<UISelectionState>,
  optionId: string,
): boolean {
  const currentValue = selection.subChoiceSelections[subChoice.id];

  if (Array.isArray(currentValue)) {
    return currentValue.includes(optionId);
  }

  return currentValue === optionId;
}

export function createPopupChoosers(
  moveTree: CompiledLegalMoveTree,
  options: UIAffordanceOptions = {},
): UIPopupChooser[] {
  const selection = normalizeSelection(options);

  return moveTree.availableActions.flatMap((action) => {
    if (!matchesSelection(action, selection)) {
      return [];
    }

    return (action.subChoices ?? []).map((subChoice) => ({
      id: `${action.id}:${subChoice.id}`,
      actionId: action.id,
      subChoiceId: subChoice.id,
      title: action.displayName,
      prompt: subChoice.prompt,
      kind: chooserKindForAction(moveTree, action),
      selectionMode: selectionModeForSubChoice(subChoice),
      minChoices: subChoice.minChoices,
      maxChoices: subChoice.maxChoices,
      visible:
        selection.selectedActionId === action.id ||
        (moveTree.pendingDecision !== null && action.tags.includes('decision')),
      options: subChoice.options.map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description,
        entityId: option.entityId,
        zoneId: option.zoneId,
        disabled: option.disabled ?? false,
        disabledReason: option.disabledReason,
        selected: selectionIncludesOption(subChoice, selection, option.id),
      })),
    }));
  });
}

function toUIAction(
  moveTree: CompiledLegalMoveTree,
  action: LegalAction,
  selection: Required<UISelectionState>,
  popupChoosers: readonly UIPopupChooser[],
): UIAction {
  const enabled = matchesSelection(action, selection);
  const ready = enabled ? moveTree.validate(buildRequest(action.id, selection)).isValid : false;
  const chooserIds = popupChoosers
    .filter((chooser) => chooser.actionId === action.id)
    .map((chooser) => chooser.id);

  return {
    id: action.id,
    label: action.displayName,
    description: action.description,
    kind: inferActionKind(action),
    enabled,
    ready,
    selected: selection.selectedActionId === action.id,
    sourceEntityIds: [...action.interactableEntities],
    destinationZoneIds: [...action.validDestinations],
    targetEntityIds: [...action.validTargets],
    chooserIds,
    tags: [...action.tags],
  };
}

function createDestinationList(
  actions: readonly LegalAction[],
  selection: Required<UISelectionState>,
): UIDestinationAffordance[] {
  const destinationMap = new Map<ZoneId, UIDestinationAffordance>();

  for (const action of actions) {
    for (const zoneId of action.validDestinations) {
      const existing = destinationMap.get(zoneId);
      const next: UIDestinationAffordance = existing ?? {
        zoneId,
        actionIds: [],
        sourceEntityIds: [],
        selected: selection.selectedZoneId === zoneId,
        highlighted: true,
        dropTarget: Boolean(selection.selectedEntityId || selection.dragEntityId),
        disabled: false,
      };

      next.actionIds = uniqueValues([...next.actionIds, action.id]);
      next.sourceEntityIds = uniqueValues([...next.sourceEntityIds, ...action.interactableEntities]);

      destinationMap.set(zoneId, next);
    }
  }

  return [...destinationMap.values()];
}

function globalActionFilter(action: LegalAction): boolean {
  return (
    action.interactableEntities.length === 0 &&
    action.validDestinations.length === 0 &&
    action.validTargets.length === 0
  );
}

export function getItemAffordance(
  moveTree: CompiledLegalMoveTree,
  entityId: string,
  options: UIAffordanceOptions = {},
): UIItemAffordance | null {
  const selection = normalizeSelection(options);
  const popupChoosers = createPopupChoosers(moveTree, options);
  const compatibleActions = moveTree.availableActions.filter((action) =>
    action.interactableEntities.includes(entityId) || action.validTargets.includes(entityId),
  );

  if (compatibleActions.length === 0) {
    return null;
  }

  const activeActions = compatibleActions.filter((action) =>
    matchesSelection(action, {
      ...selection,
      selectedEntityId: selection.selectedEntityId ?? entityId,
    }),
  );
  const uiActions = activeActions.map((action) => toUIAction(moveTree, action, selection, popupChoosers));
  const destinationZoneIds = uniqueValues(activeActions.flatMap((action) => action.validDestinations));
  const targetEntityIds = uniqueValues(activeActions.flatMap((action) => action.validTargets));
  const sourceActions = activeActions.filter((action) => action.interactableEntities.includes(entityId));
  const targetActions = activeActions.filter((action) => action.validTargets.includes(entityId));

  const state: EntityUIState = {
    interactable: sourceActions.length > 0 || targetActions.length > 0,
    selected:
      selection.selectedEntityId === entityId || selection.selectedTargetEntityId === entityId,
    targeted: targetActions.length > 0,
    highlighted:
      sourceActions.length > 0 ||
      targetActions.length > 0 ||
      selection.selectedEntityId === entityId ||
      selection.selectedTargetEntityId === entityId,
    disabled:
      (selection.selectedEntityId !== null ||
        selection.selectedZoneId !== null ||
        selection.selectedActionId !== null) &&
      sourceActions.length === 0 &&
      targetActions.length === 0 &&
      selection.selectedEntityId !== entityId &&
      selection.selectedTargetEntityId !== entityId,
    dragSource:
      selection.dragEntityId === entityId ||
      (selection.dragEntityId === null && selection.selectedEntityId === entityId),
    dropTarget:
      targetActions.length > 0 && Boolean(selection.selectedEntityId || selection.selectedActionId),
    availableActionIds: uniqueValues(activeActions.map((action) => action.id)),
    menuActions: uiActions,
    validDestinationIds: destinationZoneIds,
    validTargetIds: targetEntityIds,
  };

  return {
    entityId,
    actionIds: state.availableActionIds,
    destinationZoneIds,
    targetEntityIds,
    menuActions: uiActions,
    state,
  };
}

export function createItemAffordanceMap(
  moveTree: CompiledLegalMoveTree,
  options: UIAffordanceOptions = {},
): Record<string, UIItemAffordance> {
  const affordances: Record<string, UIItemAffordance> = {};

  for (const entityId of Object.keys(moveTree.visibleState.entities)) {
    const affordance = getItemAffordance(moveTree, entityId, options);
    if (affordance) {
      affordances[entityId] = affordance;
    }
  }

  return affordances;
}

export function getDestinationAffordance(
  moveTree: CompiledLegalMoveTree,
  zoneId: ZoneId,
  options: UIAffordanceOptions = {},
): UIDestinationSelectionAffordance | null {
  const selection = normalizeSelection(options);
  const popupChoosers = createPopupChoosers(moveTree, options);
  const compatibleActions = moveTree.availableActions.filter((action) =>
    action.validDestinations.includes(zoneId),
  );

  if (compatibleActions.length === 0) {
    return null;
  }

  const activeActions = compatibleActions.filter((action) =>
    matchesSelection(action, {
      ...selection,
      selectedZoneId: selection.selectedZoneId ?? zoneId,
    }),
  );
  const sourceEntityIds = uniqueValues(activeActions.flatMap((action) => action.interactableEntities));
  const uiActions = activeActions.map((action) => toUIAction(moveTree, action, selection, popupChoosers));

  const state: ZoneUIState = {
    interactable: sourceEntityIds.length > 0,
    selected: selection.selectedZoneId === zoneId,
    highlighted: sourceEntityIds.length > 0 || selection.selectedZoneId === zoneId,
    disabled:
      (selection.selectedEntityId !== null ||
        selection.selectedActionId !== null ||
        selection.selectedZoneId !== null) &&
      sourceEntityIds.length === 0 &&
      selection.selectedZoneId !== zoneId,
    dropTarget:
      activeActions.length > 0 && Boolean(selection.selectedEntityId || selection.dragEntityId),
    sourceEntityIds,
    availableActionIds: uniqueValues(activeActions.map((action) => action.id)),
    menuActions: uiActions,
  };

  return {
    zoneId,
    actionIds: state.availableActionIds,
    sourceEntityIds,
    menuActions: uiActions,
    state,
  };
}

export function createDestinationAffordanceMap(
  moveTree: CompiledLegalMoveTree,
  options: UIAffordanceOptions = {},
): Record<string, UIDestinationSelectionAffordance> {
  const affordances: Record<string, UIDestinationSelectionAffordance> = {};

  for (const zoneId of Object.keys(moveTree.visibleState.zones) as ZoneId[]) {
    const affordance = getDestinationAffordance(moveTree, zoneId, options);
    if (affordance) {
      affordances[zoneId] = affordance;
    }
  }

  return affordances;
}

function createPendingDecision(
  moveTree: CompiledLegalMoveTree,
  availableActions: readonly UIAction[],
  popupChoosers: readonly UIPopupChooser[],
): UIPendingDecision | null {
  if (!moveTree.pendingDecision) {
    return null;
  }

  const actionIds = availableActions
    .filter((action) => action.kind === 'decision')
    .map((action) => action.id);
  const chooserIds = popupChoosers
    .filter((chooser) => chooser.kind === 'pending_decision')
    .map((chooser) => chooser.id);

  return {
    id: moveTree.pendingDecision.id,
    prompt: moveTree.pendingDecision.prompt,
    type: moveTree.pendingDecision.type,
    minChoices: moveTree.pendingDecision.minChoices,
    maxChoices: moveTree.pendingDecision.maxChoices,
    actionIds,
    chooserIds,
    actions: availableActions.filter((action) => action.kind === 'decision'),
  };
}

export function createUIAffordanceState(
  moveTree: CompiledLegalMoveTree,
  options: UIAffordanceOptions = {},
): UIAffordanceState {
  const selection = normalizeSelection(options);
  const popupChoosers = createPopupChoosers(moveTree, options);
  const availableActions = moveTree.availableActions.map((action) =>
    toUIAction(moveTree, action, selection, popupChoosers),
  );
  const activeActions = moveTree.availableActions.filter((action) => matchesSelection(action, selection));
  const interactableEntities = uniqueValues(activeActions.flatMap((action) => action.interactableEntities));
  const interactableZones = uniqueValues(activeActions.flatMap((action) => action.validDestinations));
  const validDestinations = createDestinationList(activeActions, selection);
  const validTargets = uniqueValues(activeActions.flatMap((action) => action.validTargets));
  const itemAffordances = createItemAffordanceMap(moveTree, options);
  const destinationAffordances = createDestinationAffordanceMap(moveTree, options);
  const entityStates = Object.fromEntries(
    Object.keys(moveTree.visibleState.entities).map((entityId) => [
      entityId,
      itemAffordances[entityId]?.state ?? {
        interactable: false,
        selected:
          selection.selectedEntityId === entityId || selection.selectedTargetEntityId === entityId,
        targeted: false,
        highlighted:
          selection.selectedEntityId === entityId || selection.selectedTargetEntityId === entityId,
        disabled:
          selection.selectedEntityId !== null ||
          selection.selectedZoneId !== null ||
          selection.selectedActionId !== null,
        dragSource:
          selection.dragEntityId === entityId ||
          (selection.dragEntityId === null && selection.selectedEntityId === entityId),
        dropTarget: false,
        availableActionIds: [],
        menuActions: [],
        validDestinationIds: [],
        validTargetIds: [],
      } satisfies EntityUIState,
    ]),
  ) as Record<string, EntityUIState>;
  const zoneStates = Object.fromEntries(
    (Object.keys(moveTree.visibleState.zones) as ZoneId[]).map((zoneId) => [
      zoneId,
      destinationAffordances[zoneId]?.state ?? {
        interactable: false,
        selected: selection.selectedZoneId === zoneId,
        highlighted: selection.selectedZoneId === zoneId,
        disabled:
          selection.selectedEntityId !== null ||
          selection.selectedZoneId !== null ||
          selection.selectedActionId !== null,
        dropTarget: false,
        sourceEntityIds: [],
        availableActionIds: [],
        menuActions: [],
      } satisfies ZoneUIState,
    ]),
  ) as Record<string, ZoneUIState>;

  return {
    interactableEntities,
    interactableZones,
    selectedEntityId: selection.selectedEntityId,
    selectedZoneId: selection.selectedZoneId,
    selectedTargetEntityId: selection.selectedTargetEntityId,
    validDestinations,
    validTargets,
    availableActions,
    globalMenuActions: availableActions.filter((action) => globalActionFilter(moveTree.getAction(action.id)!)),
    popupChoosers,
    pendingDecision: createPendingDecision(moveTree, availableActions, popupChoosers),
    entityStates,
    zoneStates,
    keyboardShortcuts: [...DEFAULT_KEYBOARD_SHORTCUTS],
  };
}
