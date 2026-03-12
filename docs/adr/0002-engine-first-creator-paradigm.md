# ADR 0002 — Engine-First Creator Paradigm

## Status

**Accepted** — 2026-03-11

## Context

The original platform design was template-first: creators would pick a game template and customize it. This approach has significant limitations:

- Templates become stale and need constant maintenance.
- Creators are constrained to pre-built patterns.
- AI agents can only assist within template boundaries.
- Component reuse is ad-hoc rather than systematic.
- Advanced creators outgrow templates quickly.

## Decision

**The platform ships with a powerful built-in game engine and a hierarchical component library. Creators assemble games from reusable components rather than starting from templates.**

### How it works

1. **New project creation** starts with an empty game definition, not a template picker.
2. Creators compose games from a **component catalog**: boards, spaces, tracks, zones, decks, hands, counters, resources, tokens, pieces, prompts, and rule definitions.
3. The **engine** handles all core mechanics (state, turns, triggers, visibility, legal moves) so creators focus on game design, not engine implementation.
4. **AI agents** assist with rules authoring, component placement, logic generation, and asset creation — all grounded in engine documentation and the component catalog.
5. **Sample games** serve as learning references, not starting points. They demonstrate how to use built-in components and rules.

### Component-first workflow

```
Creator opens new project
  → Empty game definition
  → Opens component palette
  → Adds board (square grid, hex, graph, etc.)
  → Adds zones (deck, hand, discard, etc.)
  → Adds pieces/tokens/cards
  → Defines rules (turn structure, move permissions, win conditions)
  → Previews live
  → Publishes
```

### Engine layers available to creators

| Layer | Description | Who uses it |
|-------|-------------|-------------|
| **Layer A** — Core Engine | Deterministic reducer, actions, events, triggers, turns, visibility, legal moves | Platform-managed, not editable by creators |
| **Layer B** — Components + Declarative Rules | Built-in components and rule declarations | All creators (primary authoring surface) |
| **Layer C** — Custom Extension Hooks | Custom predicates, target generation, scoring helpers, derived views | Advanced creators |
| **Layer D** — Experimental Override | Engine-adjacent behavior modifications | Power users with explicit opt-in |

### What replaces templates

- **Component catalog** replaces template picker for structure.
- **Declarative rules** replace template-specific logic files.
- **Sample games** replace template cloning for learning.
- **AI agents** replace manual boilerplate generation.

## Consequences

### Benefits

- Creators have more freedom and power from day one.
- Components are reusable across all games, not template-specific.
- AI agents can work with a stable, documented engine API.
- No template maintenance burden.
- Advanced creators aren't constrained by template boundaries.

### Drawbacks

- Higher initial complexity for first-time creators → mitigated by good component defaults, AI assistance, and sample game references.
- Requires a robust component catalog before launch → must prioritize core components.

### Risks

- If the component catalog is too sparse at launch, creators will feel lost → ship with at least 12 first-party components covering the major game archetypes.

## First-party component targets (MVP)

1. Square/cell board
2. Graph/adjacency board
3. Linear track
4. Circular track
5. Deck zone
6. Hand zone
7. Discard zone
8. Bag/random draw zone
9. Token piece
10. Resource counter
11. Score track
12. Modal choice prompt

## First-party sample game archetypes

1. **Track/placement game** — pieces move along a board, occupy spaces
2. **Card game with stack/response** — deck, hand, play area, triggers, response windows
3. **Worker placement** — destination → item flow, limited slots
4. **Turn-order mutation game** — dynamic turn order changes mid-game

## References

- GEMINI.md: Paradigm Update section
- GEMINI.md: Component System section
- GEMINI.md: Rules Authoring Model section
