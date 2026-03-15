# Component Model

## Overview

`@turnbased/engine-components` is the first-party catalog of placeable building blocks for creator-authored games. A component manifest describes:

- editable properties and defaults
- render hints for default UI/editor behavior
- interaction defaults for selection, drag/drop, and keyboard navigation
- placement constraints for parent/child relationships
- occupancy rules for what a component can hold

Phase 13 establishes the shared foundation for boards, spaces, tracks, zones, collections, entities, and counters so creators can compose substantial games without starting from a game-specific template.

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
- Allowed children: `space`, `track`, `zone`, `counter`, `score-track`
- Occupancy model: unlimited mixed structural children

#### Space

- Category: `container`
- Purpose: a single addressable location on a board, track, or zone
- Default render: `surface: 'space'`, `layout: 'freeform'`
- Allowed parents: `board`, `track`, `zone`
- Allowed children: `piece`, `token`
- Occupancy model: single occupant, one owner at a time

#### Track

- Category: `container`
- Purpose: ordered progression path
- Default render: `surface: 'track'`, `layout: 'linear'`
- Allowed children: `space`, `piece`, `token`
- Occupancy model: track-style occupancy with multiple positions

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

#### Token

- Category: `entity`
- Purpose: lightweight marker for state, ownership, or score
- Allowed parents: `space`, `zone`, `track`, `deck`, `hand`, `discard`, `bag`, `score-track`
- Children: none
- Interaction default: drag-enabled move source

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

These values are defaults, not lock-in. Instances may override render or interaction metadata when the editor needs a more specific presentation.

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
