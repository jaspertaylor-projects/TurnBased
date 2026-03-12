# Component Model

## Overview

Components are reusable building blocks that creators assemble into games. Each component has a schema, render hints, behavior rules, and interaction defaults.

## Component Manifest

```typescript
interface ComponentManifest {
  type: string;                    // Unique component type identifier
  category: ComponentCategory;
  displayName: string;
  description: string;
  schema: Record<string, PropertySchema>;
  defaultProperties: Record<string, unknown>;
  renderHints: RenderHints;
  placementConstraints: PlacementConstraints;
  occupancyRules: OccupancyRules;
  visibilityDefaults: VisibilityDefaults;
  interactionAffordances: InteractionAffordance[];
  ruleHooks: RuleHook[];
  aiHints: AIHint[];
}
```

## Component Categories

| Category | Examples |
|----------|---------|
| `container` | Board, zone, track, area |
| `collection` | Deck, hand, discard pile, bag |
| `entity` | Card, piece, token, marker |
| `counter` | Score track, resource counter, health bar |
| `prompt` | Choice dialog, action menu, confirmation |
| `overlay` | Turn indicator, phase display, status bar |

## Built-in Components

### Board
A spatial container with positions/spaces. Types: grid, hex, graph, custom.

### Zone
A logical container for entities. Can be a hand, play area, staging area, etc.

### Deck
An ordered collection with draw/shuffle rules. Entities enter face-down by default.

### Hand
A player-owned zone. Contents visible only to owner by default.

### Piece / Token
A movable game entity that occupies spaces on a board.

### Counter
A numeric tracker (score, resources, health, etc.).

### Track
An ordered sequence of positions (linear, circular, branching).

## Hierarchical Composition

Components can contain or reference other components:

```
Board
 ├── Space (position 0,0)
 ├── Space (position 0,1)
 └── Space (position 1,0)
      └── Piece (occupying this space)

Player Area
 ├── Hand (zone)
 ├── Discard Pile (zone)
 ├── Score Counter
 └── Resource Counters
```

## Component Instance

When placed in a game, a component becomes an instance:

```typescript
interface ComponentInstance {
  instanceId: ComponentInstanceId;
  componentType: string;
  properties: Record<string, unknown>;
  children: ComponentInstanceId[];
  parentId: ComponentInstanceId | null;
}
```
