# UI Interaction Contract

## Overview

The `@turnbased/engine-ui` package provides a contract between the engine's legal move generator and the rendering layer. It translates legal moves into visual affordances (highlights, drag targets, selection states) without requiring per-game UI logic.

The current package exports:
- `createUIAffordanceState(moveTree, options?)`
- `getItemAffordance(moveTree, entityId, options?)`
- `getDestinationAffordance(moveTree, zoneId, options?)`
- `createPopupChoosers(moveTree, options?)`
- `DEFAULT_KEYBOARD_SHORTCUTS`

## Affordance State

```typescript
interface UIAffordanceState {
  interactableEntities: EntityId[];
  interactableZones: ZoneId[];
  selectedEntity: EntityId | null;
  selectedZone: ZoneId | null;
  selectedTargetEntity: EntityId | null;
  validDestinations: UIDestinationAffordance[];
  validTargets: EntityId[];
  availableActions: UIAction[];
  globalMenuActions: UIAction[];
  popupChoosers: UIPopupChooser[];
  pendingDecision: UIPendingDecision | null;
  entityStates: Record<EntityId, EntityUIState>;
  zoneStates: Record<ZoneId, ZoneUIState>;
  keyboardShortcuts: UIKeyboardShortcut[];
}

interface EntityUIState {
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
  validTargetIds: EntityId[];
}

interface ZoneUIState {
  interactable: boolean;
  selected: boolean;
  highlighted: boolean;
  disabled: boolean;
  dropTarget: boolean;
  sourceEntityIds: EntityId[];
  availableActionIds: string[];
  menuActions: UIAction[];
}

interface UIDestinationAffordance {
  zoneId: ZoneId;
  actionIds: string[];
  sourceEntityIds: EntityId[];
  selected: boolean;
  highlighted: boolean;
  dropTarget: boolean;
  disabled: boolean;
}

interface UIAction {
  id: string;
  label: string;
  description?: string;
  kind: 'selection' | 'menu' | 'decision' | 'priority' | 'global';
  shortcut?: string;
  enabled: boolean;
  ready: boolean;
  selected: boolean;
  sourceEntityIds: EntityId[];
  destinationZoneIds: ZoneId[];
  targetEntityIds: EntityId[];
  chooserIds: string[];
}

interface UIPopupChooser {
  id: string;
  actionId: string;
  subChoiceId: string;
  title: string;
  prompt: string;
  kind: 'sub_choice' | 'pending_decision';
  selectionMode: 'single' | 'multiple' | 'value';
  minChoices: number;
  maxChoices: number;
  visible: boolean;
  options: UIPopupChooserOption[];
}

interface UIPendingDecision {
  id: string;
  prompt: string;
  type: VisiblePendingDecision['type'];
  minChoices: number;
  maxChoices: number;
  actionIds: string[];
  chooserIds: string[];
  actions: UIAction[];
}
```

## Interaction Flows

### Click Selection
1. Player clicks an interactable entity.
2. Entity becomes `selected`.
3. Valid destinations become `highlighted`.
4. Player clicks a destination → action submitted.

Use:
```typescript
const affordances = createUIAffordanceState(moveTree, {
  selection: { selectedEntityId: entityId },
});
```

### Drag and Drop
1. Player starts dragging an interactable entity.
2. Entity gets `dragSource: true`.
3. Valid destinations get `dropTarget: true`.
4. Player drops on valid target → action submitted.

Use:
```typescript
const affordances = createUIAffordanceState(moveTree, {
  selection: { selectedEntityId: entityId, dragEntityId: entityId },
});
```

### Action Menu
1. Player right-clicks or long-presses an interactable entity.
2. Available actions shown as a popup menu.
3. Player selects action → submitted or sub-choice prompted.

The package exposes action menus directly on `entityStates[entityId].menuActions`, `zoneStates[zoneId].menuActions`, and `globalMenuActions`.

### Decision Prompt
1. Engine generates a `PendingDecision`.
2. UI shows a modal/popover with options.
3. Player selects option(s) → `CHOOSE_OPTION` action submitted.

`pendingDecision` and `popupChoosers` are already shaped for modal rendering; pending decision actions are tagged as `kind: 'decision'`.

## Directional Affordance Adapters

### Item → Destination
"I picked up this piece. Where can it go?"

```typescript
const affordance = getItemAffordance(moveTree, entityId, {
  selection: { selectedEntityId: entityId },
});
```

The result includes:
- `destinationZoneIds`
- `menuActions`
- per-entity visual state (`dragSource`, `highlighted`, `disabled`)

### Destination → Item
"I clicked this space. What can I place here?"

```typescript
const affordance = getDestinationAffordance(moveTree, zoneId, {
  selection: { selectedZoneId: zoneId },
});
```

The result includes:
- `sourceEntityIds`
- `menuActions`
- per-zone visual state (`selected`, `dropTarget`, `disabled`)

## Popup Choosers

Any legal action with `subChoices` becomes one or more `UIPopupChooser` records:
- normal action choosers use `kind: 'sub_choice'`
- pending decision choosers use `kind: 'pending_decision'`
- `visible` becomes `true` when the action is selected, or immediately for active pending decisions

## Keyboard Accessibility

All interactions must have keyboard equivalents:
- Tab through interactable entities
- Enter to select/confirm
- Escape to cancel/deselect
- Arrow keys to navigate options

`DEFAULT_KEYBOARD_SHORTCUTS` ships the default bindings so consumers can render on-screen hints or remap them while preserving the same interaction intents.
