# Component Model

## Overview

`@turnbased/engine-components` is the first-party catalog of placeable building blocks for creator-authored games. A component manifest describes:

- editable properties and defaults
- render hints for default UI/editor behavior
- interaction defaults for selection, drag/drop, and keyboard navigation
- placement constraints for parent/child relationships
- occupancy rules for what a component can hold

Phase 13 establishes the shared foundation for boards, spaces, tracks, zones, collections, entities, and counters so creators can compose substantial games without starting from a game-specific template.

The current authoring direction also distinguishes between:

- author-time component templates stored in the project tree
- runtime entities materialized from those templates for preview and shipped play

That matters most for repeated per-player resources. A creator may author one `piece` or `token` template with a `quantity` and `colorMode`, while preview/runtime expands it into multiple concrete movable entities.

## Manifest Shape

```typescript
interface ComponentManifest<TProperties extends Record<string, unknown> = Record<string, unknown>> {
  type: string;
  category: 'container' | 'collection' | 'entity' | 'counter';
  displayName: string;
  description: string;
  propertyDefinitions: Record<string, ComponentPropertyDefinition>;
  propertiesSchema: z.ZodType<TProperties>;
  defaultProperties: TProperties;
  renderHints: ComponentRenderHints;
  interactionDefaults: ComponentInteractionDefaults;
  placementConstraints: ComponentPlacementConstraints;
  occupancyRules: ComponentOccupancyRules;
  visibilityDefaults: ComponentVisibilityDefaults;
  composition: ComponentComposition;
  tags: string[];
}
```

This format is intentionally split into two layers:

- `propertyDefinitions` drives editor forms and creator-facing labels
- `propertiesSchema` validates actual runtime values and default properties

## Instance Model

Placed components are stored as instances with explicit hierarchy and placement metadata:

```typescript
interface ComponentInstanceModel<TProperties extends Record<string, unknown> = Record<string, unknown>> {
  instanceId: ComponentInstanceId;
  componentType: string;
  category: ComponentCategory;
  displayName?: string;
  properties: TProperties;
  children: ComponentInstanceId[];
  parentId: ComponentInstanceId | null;
  placement: {
    slotId?: string;
    index?: number;
    coordinates?: { x: number; y: number };
    trackPosition?: number;
  } | null;
  bindings: {
    zoneId?: ZoneId;
    entityIds?: EntityId[];
    ownerId?: PlayerId | null;
  };
  frame?: {
    x: number;
    y: number;
    width: number;
    height: number;
    background: string | null;
    borderColor: string | null;
    borderWidth: number;
    borderRadius: number;
  };
}
```

This keeps authored structure separate from runtime game state while still allowing components to bind to engine zones/entities later.

## Hierarchical Composition

Composition is explicit and validated in both directions:

- child manifests declare which parent categories/types they can live under
- parent manifests declare which child categories/types they can contain
- containers and collections also declare occupancy rules such as capacity, mixed-occupant support, and per-player limits

Typical structures:

```text
Board
 ├── Space
 │    └── Piece
 ├── Space
 │    └── Piece
 └── Score Track
      ├── Token
      └── Token

Zone
 ├── Hand
 ├── Deck
 ├── Discard
 ├── Bag
 └── Counter
```

## Package Surface

The package exports:

- `builtInComponentCatalog` and `builtInCatalog`
- zod schemas for manifests, placement, instances, and policy objects
- `createComponentCatalog`
- `createComponentInstance`
- `validateComponentPlacement`
- `validateComponentOccupancy`
- `validateComponentTree`

These helpers let the editor and future rules SDK share one canonical component contract.

## Built-In Catalog

### Container Components

#### Board

- Category: `container`
- Purpose: top-level spatial surface
- Default render: `surface: 'board'`, `layout: 'grid'`
- Allowed children: `space`, `track`, `hex-grid`, `square-grid`, `zone`, `counter`, `score-track`
- Occupancy model: unlimited mixed structural children
- Important properties:
  - `surfaceColor`
  - `surfaceTexture`
  - `surfaceBorderColor`
  - `surfaceBorderWidth`
  - `surfaceBorderStyle`

#### Space

- Category: `container`
- Purpose: a single addressable location on a board, track, or zone
- Default render: `surface: 'space'`, `layout: 'freeform'`
- Allowed parents: `board`, `track`, `zone`
- Allowed children: `piece`, `token`
- Occupancy model: supports configurable capacity through `maxCapacity`

#### Track

- Category: `container`
- Purpose: ordered progression path
- Default render: `surface: 'track'`, `layout: 'linear'`
- Allowed children: `space`, `piece`, `token`
- Occupancy model: track-style occupancy with multiple positions

#### Hex Grid

- Category: `container`
- Purpose: authored board region whose generated hex cells are real `space` components
- Default render: `surface: 'board'`, `layout: 'hex'`
- Allowed parents: `board`
- Allowed children: `space`
- Important properties:
  - `cells` as explicit `{ x, y }` coordinates
  - `cellLabelPrefix`
  - `maxCapacity` applies to each generated cell space

#### Square Grid

- Category: `container`
- Purpose: authored board region whose generated square cells are real `space` components
- Default render: `surface: 'board'`, `layout: 'grid'`
- Allowed parents: `board`
- Allowed children: `space`
- Important properties:
  - `cells` as explicit `{ x, y }` coordinates
  - `cellLabelPrefix`
  - `maxCapacity` applies to each generated cell space

#### Zone

- Category: `container`
- Purpose: logical area for collections, entities, counters, or nested tracks
- Default render: `surface: 'zone'`, `layout: 'freeform'`
- Allowed children: `deck`, `hand`, `discard`, `bag`, `piece`, `token`, `counter`, `track`
- Occupancy model: unlimited mixed occupants

### Collection Components

#### Deck

- Category: `collection`
- Purpose: ordered face-down pile for draw/shuffle flows
- Default render: `layout: 'stack'`
- Visibility default: hidden contents
- Interaction default: primary action `draw`

#### Hand

- Category: `collection`
- Purpose: player-owned visible-to-owner holding area
- Default render: `layout: 'fan'`
- Visibility default: private contents
- Interaction default: drag-enabled selection

#### Discard

- Category: `collection`
- Purpose: public history pile
- Default render: `layout: 'pile'`
- Visibility default: public contents
- Interaction default: inspect/open

#### Bag

- Category: `collection`
- Purpose: concealed random-access container
- Default render: `layout: 'pile'`
- Visibility default: hidden contents
- Interaction default: primary action `draw`

### Entity Components

#### Piece

- Category: `entity`
- Purpose: movable board/zone occupant
- Allowed parents: `space`, `zone`, `track`, `deck`, `hand`, `discard`, `bag`, `score-track`
- Children: none
- Interaction default: drag-enabled move source
- Important properties:
  - `quantity`: author one template that can expand into many runtime copies
  - `colorMode`: `owner` or `neutral`, for reusable per-player coloring

#### Token

- Category: `entity`
- Purpose: lightweight marker for state, ownership, or score
- Allowed parents: `space`, `zone`, `track`, `deck`, `hand`, `discard`, `bag`, `score-track`
- Children: none
- Interaction default: drag-enabled move source
- Important properties:
  - `quantity`: author one template that can expand into many runtime copies
  - `colorMode`: `owner` or `neutral`, for reusable per-player coloring

### Counter Components

#### Counter

- Category: `counter`
- Purpose: numeric value display for resources, health, charges, or points
- Allowed parents: `board`, `zone`
- Children: none
- Interaction default: primary action `increment`

#### Score Track

- Category: `counter`
- Purpose: ordered scoring strip with per-player markers
- Allowed parents: `board`, `zone`
- Allowed children: `token`, `piece`
- Occupancy model: track with `perPlayerLimit: 1`

## Render And Interaction Defaults

Every component ships with render hints and interaction defaults so a consumer UI can produce a reasonable default presentation without game-specific branching.

Examples:

- boards and zones show labels, occupancy, and capacity hints
- hands default to fan layout and multiple selection
- pieces and tokens default to drag-enabled movement
- counters default to keyboard-navigable increment interactions
- owner-colored pieces/tokens should render from seat color when `colorMode` is `owner`

These values are defaults, not lock-in. Instances may override render or interaction metadata when the editor needs a more specific presentation.

## Aggregated Resource Templates

The preferred creator workflow is to avoid authoring one component instance per repeated cube, worker, or marker when those units are identical.

Instead:

- author one `piece` or `token` template inside a permanent nested `resource-pile` that lives in a player-owned `Resources` zone or the shared `Game Supply`
- set `quantity` to the number of copies that should exist
- set `colorMode` to `owner` when the runtime should color the copies by player
- set `supplyMode` to `infinite` when the authored template should behave like a renewable source rather than a draining pile

Preview/runtime can then materialize that template into multiple legal-move entities while the project tree stays compact.

The current editor workflow should reinforce that compact authoring model:

- project settings should carry a named color palette with `primary`, `secondary`, `tertiary`, and `accent 1-6` slots so AI and humans are pulling from the same visual vocabulary
- shared color picking should route through one alpha-capable reusable picker that can both choose palette colors and save new values back into those named slots
- the settings UI for that palette should stay compact and live inside the main game setup panel as a 3x3 swatch grid instead of a separate oversized region
- the left `Component Editor` rail expands into top-level authored components, not a fully exposed raw tree by default
- the default authoring palette should stay intentionally small: top-level `board`, `deck`, and `piece`; subcomponents such as `space`, `track`, `square-grid`, `hex-grid`, `network`, and `card`; and leaf components such as `text-box` and `image-area`
- palette exposure should be catalog-driven metadata, so additional built-ins can be promoted or hidden without rewriting editor grouping logic
- leaf components should never accept draggable children, while authored subcomponents remain the main nesting surface for future composition growth
- movable `piece` and `token` templates should remain directly visible in that outline even when they live inside a nested `resource-pile`, so creators can treat them as first-class authored resources
- movable nested pieces/tokens should not appear inside the permanent nested-layout canvas
- use a permanent nested `resource-pile` when a component needs a visible region where movable resources gather
- permanent nested children should be placed visually with frame metadata such as `x`, `y`, `width`, `height`, `background`, and border styling
- the current first-class appearance workflow is board-first: `space`, `track`, `hex-grid`, and `square-grid` are manipulated directly on the board surface
- preview should reuse the same board-surface rendering so authored board appearance corresponds 1:1 with the playable surface
- board-item trays should be driven by shared presets that materialize into concrete component properties plus frame params, so AI can author against the same board vocabulary
- the board tray should group `hex-grid` and `square-grid` under a shared `Grid` family while preserving their exact engine component types
- board-item resizing should happen from the item border rather than a separate visible corner handle so the surface stays visually clean
- board-child controls should stay compact and focus on placement plus fill/border styling instead of exposing full engine detail
- when no board child is selected, the same right-side controls should fall back to styling the board surface itself
- board items should stay visually clean on the surface itself in both editor and preview; title/type metadata should appear once in a selected-item strip above the board with a delete affordance
- `hex-grid` and `square-grid` should be treated as authored containers whose generated cells are nested `space` instances for move legality and occupancy
- grid shapes should come from explicit authored cell coordinates so creators can add or delete individual cells without surfacing those coordinates visually on the board
- grid-shape editing should happen through a small anchored popup on the board surface with lightweight add/delete actions, reclick-to-deselect behavior, and room for a future detail-edit affordance instead of a bulky right-panel explainer or selection menu
- shared UI rendering for those grids should come from `@turnbased/engine-ui` so editor and preview use the same tiling math
- board-surface textures and border styles should be shared board params consumed by `BoardSurface`, not editor-only styling state
- each top-level component should carry a distinct type icon so boards, zones, tracks, and collections scan quickly
- creating a component should open a focused create surface instead of taking over the main workspace with another broad browsing view
- the main component workspace should stay centered on the selected component, its permanent authored children, and its editable properties rather than a separate generic inspector pane

This is the default direction for starter scaffolds such as:

- `Player 1 Resources`
- `Player 2 Resources`
- `Game Supply`
- one nested `Resource Pile` region inside each supply-style zone
- one cube template per player with `quantity = 6`
- an optional shared block template with `supplyMode = 'infinite'`

That pattern should be preferred over six individually-authored block instances unless the copies need separate authored properties.

## Placement And Occupancy Validation

Placement and occupancy are validated separately:

- `validateComponentPlacement(child, parent)` checks structural legality
- `validateComponentOccupancy(container, occupants)` checks capacity, type mix, shared-control, and per-player limits
- `validateComponentTree(instances, catalog)` validates a whole authored hierarchy

That split matters because some structures are legal to nest but still illegal to populate. For example:

- a `space` can be placed on a `board`
- a `space` can contain only one occupant
- a `score-track` may contain multiple markers, but only one per owner by default

## Example

```typescript
const board = createComponentInstance(getBuiltInComponentManifest('board'), {
  instanceId: createComponentInstanceId('board_root'),
  children: [
    createComponentInstanceId('space_1'),
    createComponentInstanceId('space_2'),
    createComponentInstanceId('score_track'),
  ],
  properties: { width: 2, height: 1 },
});
```

From there, spaces, pieces, score markers, and player-area collections can be added and validated with `validateComponentTree(...)`.
