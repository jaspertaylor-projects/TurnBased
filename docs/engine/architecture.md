# Engine Architecture

## Overview

The TurnBased engine is a **deterministic, event-sourced game state machine** designed for digital tabletop games. It runs entirely in the browser. No game logic executes on the server.

## Core Principles

1. **Determinism** — Given the same initial state and action sequence, the engine always produces identical output. All randomness is seeded.
2. **Event-sourcing** — Game state is derived from an ordered log of canonical actions. State can be reconstructed from replay.
3. **Separation of concerns** — The engine is divided into layers: core reducer, component library, extension hooks, and experimental overrides.
4. **Legal-move-first** — The engine always knows what the current player can do. This drives UI affordances, AI play, and validation.
5. **Visibility-aware** — The engine produces different state views per player seat, supporting hidden information games.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Game Instance                         │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Turn Engine  │  │  Trigger     │  │  Priority /   │  │
│  │  (phases,     │  │  Engine      │  │  Response     │  │
│  │   steps,      │  │  (events,    │  │  Manager      │  │
│  │   turn order) │  │   hooks)     │  │               │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                  │                   │          │
│  ┌──────▼──────────────────▼───────────────────▼───────┐ │
│  │              Deterministic Reducer                   │ │
│  │   (applies canonical actions, emits events,          │ │
│  │    updates normalized state)                         │ │
│  └──────────────────────┬──────────────────────────────┘ │
│                          │                                │
│  ┌──────────────────────▼──────────────────────────────┐ │
│  │              Normalized Game State                   │ │
│  │   (entities, zones, players, turn state,             │ │
│  │    pending decisions, stack, visibility map)          │ │
│  └──────────────────────┬──────────────────────────────┘ │
│                          │                                │
│  ┌──────────┐  ┌────────▼──────┐  ┌───────────────────┐ │
│  │ Legal    │  │  Visibility   │  │  UI Affordance    │ │
│  │ Move     │  │  Projection   │  │  Generator        │ │
│  │ Generator│  │  (per-player) │  │  (highlights,     │ │
│  │          │  │               │  │   drag/drop)      │ │
│  └──────────┘  └───────────────┘  └───────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Package Map

| Package | Responsibility |
|---------|---------------|
| `engine-core` | Reducer, actions, events, triggers, turns, visibility, legal moves |
| `engine-sdk` | Author-facing APIs: game definitions, rules, hooks, manifests |
| `engine-components` | Built-in placeable components and schemas |
| `engine-ui` | Interaction affordance adapters, highlighting, drag/drop |
| `engine-ai` | AI play contracts, bots, state summarizers |
| `shared-types` | Cross-package type definitions |
| `shared-utils` | Serialization, hashing, ID generation, zod helpers |

## Data Flow

1. Player or AI submits an **intent action** (e.g., "play card X to zone Y").
2. `engine-sdk` lowers the intent into one or more **canonical actions**.
3. The **reducer** applies each canonical action to the state.
4. Each action emits **domain events**.
5. The **trigger engine** checks event subscriptions and materializes trigger effects.
6. The **priority manager** opens response windows if configured.
7. The **stack/queue** resolves pending effects.
8. The **turn engine** advances phases/steps/turns as needed.
9. The **visibility system** projects per-player views.
10. The **legal move generator** computes available actions for the active player.
11. The **UI affordance generator** produces highlight/interaction data.

## Glossary

| Term | Definition |
|------|-----------|
| **Entity** | Any game object: card, piece, token, marker |
| **Zone** | A container for entities: board, hand, deck, discard pile |
| **Component** | A reusable building block with schema, render hints, and behavior |
| **Canonical Action** | A primitive state mutation (MOVE_ENTITY, SET_PROPERTY, etc.) |
| **Intent Action** | A high-level player action that gets lowered to canonical actions |
| **Trigger** | A subscription that fires effects in response to events |
| **Priority Window** | An opportunity for players to respond before effects resolve |
| **Stack Item** | A pending effect waiting for priority resolution |
| **Pending Decision** | A prompt requiring player input before the game can continue |

## Invariants

- The reducer is a pure function: `(state, action) => newState`
- No uncontrolled randomness — all randomness goes through the seeded RNG
- State can always be reconstructed from `initialState + actionLog`
- The engine never executes on the server — browser only
- Legal move generation never leaks hidden information
