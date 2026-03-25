# Engine And Shared Packages API Index

## Purpose

This is the canonical starting point for understanding what exists in the shared TurnBased packages and how each package is meant to be used.

Use this document when you need to answer:

- which package should own a feature
- which package exports the API I need
- whether something belongs in shared engine code or only in the web app
- which deeper doc to read next

## Package Map

| Package | Owns | Use It For | Do Not Use It For |
|---------|------|------------|-------------------|
| `@turnbased/engine-core` | deterministic runtime | game state, canonical actions, reducer, turns, visibility, legal moves | editor-only UI or app shell concerns |
| `@turnbased/engine-sdk` | authoring layer | declarative rulebooks, compiled setup/turn/scoring/win logic, hook registries | direct UI rendering |
| `@turnbased/engine-components` | built-in authored building blocks | component manifests, placement rules, occupancy rules, component instances | applying gameplay state changes |
| `@turnbased/engine-ui` | shared UI contract | affordance derivation, drag/drop states, linked-view/table UI assets | defining gameplay legality |
| `@turnbased/engine-ai` | AI-facing gameplay helpers | AI input envelopes, rules summarization, bot turns, selection validation | primary player UI |
| `@turnbased/shared-types` | shared ids and types | branded ids and cross-package types | gameplay logic |
| `@turnbased/shared-utils` | general helpers | ids, hashing, canonical serialization, zod helpers | package-specific domain logic |

## Start Here By Goal

### I want to build or change game rules

Start with:

- `@turnbased/engine-sdk`
- `@turnbased/engine-core`

Read next:

- [agent-engine-api.md](/home/anonymous/TheCode/TurnBased/docs/engine/agent-engine-api.md)
- [legal-move-generation.md](/home/anonymous/TheCode/TurnBased/docs/engine/legal-move-generation.md)
- [state-model.md](/home/anonymous/TheCode/TurnBased/docs/engine/state-model.md)

### I want to add or understand placeable game building blocks

Start with:

- `@turnbased/engine-components`

Read next:

- [component-model.md](/home/anonymous/TheCode/TurnBased/docs/engine/component-model.md)

### I want to render legal interactions or shared game surfaces

Start with:

- `@turnbased/engine-ui`

Read next:

- [ui-interaction-contract.md](/home/anonymous/TheCode/TurnBased/docs/engine/ui-interaction-contract.md)

### I want to understand package boundaries first

Start with:

- [architecture.md](/home/anonymous/TheCode/TurnBased/docs/engine/architecture.md)
- [0001-monorepo-engine-boundaries.md](/home/anonymous/TheCode/TurnBased/docs/adr/0001-monorepo-engine-boundaries.md)

## Package Reference

### `@turnbased/engine-core`

Owns:

- normalized `GameState`
- canonical actions and reducer application
- turns, phases, priority windows, stack handling
- visibility projection
- legal move generation

Common exports:

- `reduceGameState`
- `generateLegalMoveTree`
- `projectGameStateForPlayer`
- `projectGameStateForAI`

Use it when:

- you need the authoritative game state
- you need to know what a player can legally do
- you need runtime ids such as `ent_*` and `zone_*`

Important notes:

- legal moves are the source of truth for interaction
- UI should consume legal moves, not bypass them
- runtime entity ids are not the same as authored component instance ids

Read next:

- [agent-engine-api.md](/home/anonymous/TheCode/TurnBased/docs/engine/agent-engine-api.md)
- [legal-move-generation.md](/home/anonymous/TheCode/TurnBased/docs/engine/legal-move-generation.md)
- [state-model.md](/home/anonymous/TheCode/TurnBased/docs/engine/state-model.md)

### `@turnbased/engine-sdk`

Owns:

- creator-facing declarative rule authoring
- rulebook compilation
- setup, scoring, and win-condition helpers
- hook registries for cases declarative rules cannot cover

Common exports:

- `defineRulebook`
- `compileRulebook`
- `compileTriggerRules`
- `compileTurnStructure`

Use it when:

- you are generating or authoring game rules
- you want to stay declarative instead of writing custom reducer logic

Important notes:

- prefer declarative rulebooks over custom hooks whenever possible
- hooks are for hard cases like pathfinding, custom targeting, or complex derived logic

Read next:

- [agent-engine-api.md](/home/anonymous/TheCode/TurnBased/docs/engine/agent-engine-api.md)

### `@turnbased/engine-components`

Owns:

- built-in component manifests
- component instance shape
- parent/child placement rules
- occupancy rules and tree validation

Common exports:

- `builtInCatalog`
- `BOARD_BORDER_STYLE_OPTIONS`
- `BOARD_SURFACE_TEXTURE_OPTIONS`
- `createComponentInstance`
- `getBuiltInComponentManifest`
- `getBoardComponentPreset`
- `listBuiltInComponents`
- `listBoardComponentPresets`
- `resolveBoardAppearanceProperties`
- `validateComponentPlacement`
- `validateComponentOccupancy`
- `validateComponentTree`

Use it when:

- you are building the authored project tree
- you need to know what can be placed where
- you need reusable built-in component types like `board`, `space`, `zone`, `piece`, `token`, `counter`

Important notes:

- authored components are templates, not always one-to-one runtime entities
- repeated cubes/workers/tokens should usually be one authored `piece` or `token` with:
  - `quantity`
  - `colorMode`
- when a zone needs a visible resource area in the editor, prefer a permanent nested `resource-pile` and keep the movable templates out of the layout canvas
- starter scaffolds should prefer compact authored templates over many duplicate child instances
- editor flows should browse top-level authored components from the `Component Editor` rail and keep the main workspace focused on editing the selected component or creating a new one
- project settings should carry a reusable named color palette that both AI and humans use as their preferred color vocabulary
- color selection UI should come from a shared alpha-capable picker instead of one-off text fields
- shared board-item presets are the preferred way to offer AI/user-coauthored board vocabulary because they encode reusable params instead of editor-only choices
- the current board-authored surface primitives are `space`, `track`, `hex-grid`, and `square-grid`
- board surface appearance should live in shared board params like `surfaceColor`, `surfaceTexture`, `surfaceBorderColor`, `surfaceBorderWidth`, and `surfaceBorderStyle`
- `hex-grid` and `square-grid` should be treated as authored containers whose generated cells are nested `space` instances
- the board tray should expose `hex-grid` and `square-grid` as two options under a shared `Grid` family
- grid shapes should be editable cell-by-cell, with engine-facing coordinates stored in the component model rather than printed on the board

Read next:

- [component-model.md](/home/anonymous/TheCode/TurnBased/docs/engine/component-model.md)
- [agent-engine-api.md](/home/anonymous/TheCode/TurnBased/docs/engine/agent-engine-api.md)

### `@turnbased/engine-ui`

Owns:

- affordance derivation from the legal move tree
- entity/zone selected/highlighted/drop-target state
- popup chooser shaping
- shared linked-view and preview/table UI assets

Common exports:

- `createUIAffordanceState`
- `getItemAffordance`
- `getDestinationAffordance`
- `createPopupChoosers`
- `BoardGrid`
- `BoardSurface`
- `BoardGrid`
- `getBoardSurfaceTextureStyle`
- `GamePreviewWindow`
- `GameSurfacePopup`
- `GameTableHeader`
- `GameInfoPanel`
- `ResourceDock`
- `LinkedSeatSummaryStrip`
- `LinkedViewStage`
- `PlayerLinkedViewStage`

Use it when:

- you need to render legal interaction state
- you need reusable shared preview or starter-game surfaces
- you need shared in-surface popups for preview or shipped game flows
- you want AI-generated projects to share the same UI primitives

Important notes:

- `engine-ui` renders what the legal move layer says is possible
- it should not invent gameplay legality on its own
- it should hold reusable UI that ships with user-created games, not just editor-only chrome
- board rendering that should match between authoring and preview belongs here rather than in app-only one-offs
- board textures and border-style rendering for authored board surfaces should also live here so editor and preview use the same board-surface treatment
- `BoardGrid` should own shared checkerboard and edge-to-edge hex tiling math instead of duplicating that layout in app code

Read next:

- [ui-interaction-contract.md](/home/anonymous/TheCode/TurnBased/docs/engine/ui-interaction-contract.md)
- [agent-engine-api.md](/home/anonymous/TheCode/TurnBased/docs/engine/agent-engine-api.md)

### `@turnbased/engine-ai`

Owns:

- AI-safe gameplay envelopes
- rules summarization for model input
- bot helpers and validation

Common exports:

- `createAIInputEnvelope`
- `serializeAIInputForLLM`
- `summarizeRulesForAI`
- `runBotTurn`
- `validateAISelection`

Use it when:

- you need to feed game state into an AI safely
- you need a bot turn runner
- you want summarized rules and legal moves for model consumption

Read next:

- [ai-player-contract.md](/home/anonymous/TheCode/TurnBased/docs/engine/ai-player-contract.md)
- [agent-engine-api.md](/home/anonymous/TheCode/TurnBased/docs/engine/agent-engine-api.md)

### `@turnbased/shared-types`

Owns:

- branded ids
- cross-package shared types and enums

Common exports:

- `createEntityId`
- `createZoneId`
- `createPlayerId`
- `createComponentInstanceId`
- `createGameId`

Use it when:

- you need ids shared across packages
- you want to avoid inventing inconsistent string formats

Important notes:

- use shared id helpers instead of ad hoc string formatting when possible
- engine runtime actions expect canonical formats like `ent_*` and `zone_*`

### `@turnbased/shared-utils`

Owns:

- general helper utilities shared across packages

Common exports:

- `generateId`
- `canonicalSerialize`
- `canonicalDeserialize`

Use it when:

- you need stable hashing or serialization
- you need generic id generation for editor/project records

## Current Product Direction

The current shared-package direction is:

- keep starter game scaffolds very small
- prefer one shared board with one starter playable space
- prefer one linked player view per seat
- prefer `Player N Resources` zones for starter player-owned areas
- prefer one shared `Game Supply` zone when the prototype needs common neutral resources
- prefer one authored repeated-resource template with `quantity` over many duplicate cube instances
- prefer a nested `resource-pile` when those movable resources need a visible permanent region inside another component
- prefer keeping movable `piece`/`token` templates visible in the component-editor outline even when they are sourced from zones
- prefer editing permanent nested structure through frame-style layout metadata instead of treating movable resources like nested layout cards
- prefer `colorMode: 'owner'` for starter player-colored resources
- use `supplyMode: 'infinite'` when a shared supply should behave like a renewable source
- push reusable UI and runtime behavior into shared packages whenever it should ship with user-created games

## Source Of Truth Reading Order

If you are onboarding or prompting an agent, use this order:

1. [api-index.md](/home/anonymous/TheCode/TurnBased/docs/engine/api-index.md)
2. [agent-engine-api.md](/home/anonymous/TheCode/TurnBased/docs/engine/agent-engine-api.md)
3. [component-model.md](/home/anonymous/TheCode/TurnBased/docs/engine/component-model.md)
4. [ui-interaction-contract.md](/home/anonymous/TheCode/TurnBased/docs/engine/ui-interaction-contract.md)
5. [legal-move-generation.md](/home/anonymous/TheCode/TurnBased/docs/engine/legal-move-generation.md)
6. [state-model.md](/home/anonymous/TheCode/TurnBased/docs/engine/state-model.md)
7. [architecture.md](/home/anonymous/TheCode/TurnBased/docs/engine/architecture.md)
