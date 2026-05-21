# UI Interaction Contract

## Overview

The `@turnbased/engine-ui` package provides a contract between the engine's legal move generator and the rendering layer. It translates legal moves into visual affordances (highlights, drag targets, selection states) without requiring per-game UI logic.

The current package exports:
- `createUIAffordanceState(moveTree, options?)`
- `getItemAffordance(moveTree, entityId, options?)`
- `getDestinationAffordance(moveTree, zoneId, options?)`
- `createPopupChoosers(moveTree, options?)`
- `DEFAULT_KEYBOARD_SHORTCUTS`
- `BoardGrid(props)`
- `GamePreviewWindow(props)`
- `GameSurfacePopup(props)`
- `GameTableHeader(props)`
- `GameInfoPanel(props)`
- `ResourceDock(props)`
- `LinkedSeatSummaryStrip(props)`
- `LinkedViewStage(props)`
- `PlayerLinkedViewStage(props)`

## Reusable Linked-View UI Assets

The package now includes reusable linked-view shell pieces for the default startup experience:

- `LinkedSeatSummaryStrip`
  - renders a row of player icons
  - each icon can expand on hover to expose a short resource summary
  - clicking a player icon can switch the active view to that player's linked area
- `GameInfoPanel`
  - renders a reusable status/info box for turn ownership and primary turn actions
- `GameTableHeader`
  - renders reusable above-the-table chrome for game title and primary session actions
- `GamePreviewWindow`
  - renders the reusable felt-table surface and app boundary
- `GameSurfacePopup`
  - renders a reusable game-surface popup above the preview/table shell
  - intended for start-of-match choices, lightweight session gating, and other shared in-surface prompts
- `ResourceDock`
  - renders shared player-resource docks for reusable bottom-of-board inventories
- `LinkedViewStage`
  - renders the main shared board surface
  - intended for the default `Main Board` view
- `PlayerLinkedViewStage`
  - renders a player-owned view surface
  - includes a built-in "back to main board" action slot

These are intentionally generic so AI-generated projects and app-level previews can reuse the same linked-view navigation pattern instead of inventing custom one-off shells.

The current starter direction is:

- a single shared board surface by default
- top-of-table game chrome outside the felt play area
- turn/info state in the upper banner near the player strip
- per-player `Player N Resources` inventories plus a shared `Game Supply` rendered through shared dock components
- editor board authoring should reuse the same shared board-surface renderer so board placement and styling stay 1:1 between editor and preview
- the editor surface should focus on visual editing; gameplay logic editing can stay in the AI/engine layer
- shared color selection should come from one reusable alpha-capable picker that can both choose from and write back into a project-level named palette
- that shared color picker should support left-opening popups in narrow side panels, so editor controls do not crowd the workspace
- shared board-surface appearance should flow through `BoardSurface` using params such as `surfaceColor`, `surfaceTexture`, `surfaceBorderColor`, `surfaceBorderWidth`, and `surfaceBorderStyle`
- when no board child is selected, the editor's active controls should style that shared board surface directly without a bulky summary pane, and texture selection should stay compact
- shared grid rendering should also come from `@turnbased/engine-ui`, with `BoardGrid` owning both square-grid cells and edge-to-edge hex tiling math
- `BoardGrid` should scale to fit inside the authored component frame instead of overflowing beyond it
- `BoardGrid` should render authored cell-coordinate sets directly and keep cell coordinates off the visible surface by default
- hex grids should ship with a visible per-hex border shell so neighboring cells read clearly before any custom styling is applied

## Resource Template Rendering

The UI layer should expect many authored resources to arrive as repeated runtime entities generated from one authored template.

Common example:

- one authored cube template inside a nested `resource-pile` in `Player 1 Resources`
- `quantity = 6`
- `colorMode = 'owner'`
- `supplyMode = 'finite'`

When rendered:

- preview/game surfaces still show six draggable cubes
- editor surfaces should show the permanent `resource-pile` region and may summarize the resource template with a compact `x6` representation
- `colorMode = 'owner'` should resolve visual color from the owning seat
- `colorMode = 'neutral'` should use a shared neutral style
- `supplyMode = 'infinite'` may keep a shared source available while spawning fresh runtime copies into destinations

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
