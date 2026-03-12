# UI Interaction Contract

## Overview

The engine-ui package provides a contract between the engine's legal move generator and the rendering layer. It translates legal moves into visual affordances (highlights, drag targets, selection states).

## Affordance State

```typescript
interface UIAffordanceState {
  interactableEntities: EntityId[];
  selectedEntity: EntityId | null;
  validDestinations: { zoneId: ZoneId; positions?: number[] }[];
  validTargets: EntityId[];
  availableActions: UIAction[];
  pendingDecision: UIPendingDecision | null;
  entityStates: Record<EntityId, EntityUIState>;
}

interface EntityUIState {
  interactable: boolean;
  selected: boolean;
  targeted: boolean;
  highlighted: boolean;
  disabled: boolean;
  dragSource: boolean;
  dropTarget: boolean;
}

interface UIAction {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  enabled: boolean;
}
```

## Interaction Flows

### Click Selection
1. Player clicks an interactable entity.
2. Entity becomes `selected`.
3. Valid destinations become `highlighted`.
4. Player clicks a destination → action submitted.

### Drag and Drop
1. Player starts dragging an interactable entity.
2. Entity gets `dragSource: true`.
3. Valid destinations get `dropTarget: true`.
4. Player drops on valid target → action submitted.

### Action Menu
1. Player right-clicks or long-presses an interactable entity.
2. Available actions shown as a popup menu.
3. Player selects action → submitted or sub-choice prompted.

### Decision Prompt
1. Engine generates a `PendingDecision`.
2. UI shows a modal/popover with options.
3. Player selects option(s) → `CHOOSE_OPTION` action submitted.

## Keyboard Accessibility

All interactions must have keyboard equivalents:
- Tab through interactable entities
- Enter to select/confirm
- Escape to cancel/deselect
- Arrow keys to navigate options
