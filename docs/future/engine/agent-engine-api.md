# Engine API for AI Builders

## Purpose

This document is the compact engine contract that should be fed to coding agents during project generation.

It is intentionally narrower than the full repo docs. It tells an agent:

- which packages matter
- which APIs are stable enough to use
- how to think about state, rules, components, legal moves, and UI
- what not to do

If this document conflicts with ad hoc assumptions, follow this document.

## Golden Rules

1. Prefer built-in components over custom engine behavior.
2. Prefer declarative rulebook definitions over custom hooks.
3. The legal move tree is the source of truth for what a player can do.
4. UI affordances must derive from the legal move tree, not custom click logic.
5. AI/gameplay consumers should use visible projected state, not unrestricted full state.
6. Do not modify shared engine packages when generating a game project.
7. Prefer compact authored templates for repeated resources, then let preview/runtime expand them into concrete entities.

## Package Map

### `@turnbased/engine-core`

Core deterministic runtime:

- normalized game state
- canonical actions
- reducer
- triggers
- turns
- visibility projection
- legal move generation

Primary exports:

- `reduceGameState`
- `replayCanonicalActions`
- `generateLegalMoveTree`
- `projectGameStateForPlayer`
- `projectGameStateForAI`
- `applyActionWithTriggers`

### `@turnbased/engine-sdk`

Creator-facing rule authoring layer:

- declarative rulebooks
- expressions
- hook registries
- setup/turn/scoring/win-condition compilation

Primary exports:

- `defineRulebook`
- `compileRulebook`
- `compileTriggerRules`
- `compileTurnStructure`
- `materializeSetupRules`
- `evaluateScoringRules`
- `evaluateWinConditions`
- `resolveVisibilityDefaults`
- `createRuleHookRegistry`

### `@turnbased/engine-components`

Built-in component system:

- component manifests
- component instances
- placement and occupancy validation
- built-in component catalog

Primary exports:

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

Important authoring direction:

- `piece` and `token` may represent repeated authored templates through `quantity`
- `piece` and `token` may use `colorMode: 'owner' | 'neutral'`
- `resource-pile` is the preferred permanent nested region for displaying movable resources inside another component
- repeated cubes, workers, or markers should usually be authored as one template plus quantity, not one component instance per copy
- editor prompts should assume the post-build `Component Editor` left rail expands into top-level components with type icons
- movable `piece`/`token` templates stay outline-first resources, not nested layout cards
- supply-style zones should usually contain a permanent nested `resource-pile` instead of showing movable templates directly in the layout surface
- permanent nested children should be arranged visually with frame-style metadata and can be promoted into the main editing context when they need more detail
- board appearance editing should prefer a shared board-surface renderer so preview and authoring stay visually aligned
- the visual editor should focus on authored appearance and layout; gameplay logic details can be left to the AI's engine-facing build step
- when no board item is selected, the active controls should edit shared board-surface appearance params instead of a separate editor-only summary state
- project settings should expose a named color palette with `primary`, `secondary`, `tertiary`, and `accent 1-6` slots that AI should prefer when making visual decisions
- human-facing color picking should route through one shared alpha-capable picker that can also save a chosen color back into one of those named palette slots
- board-item preset menus should come from shared preset data so AI can instantiate the same preset params when generating or refining a game
- the current board-authored surface primitives are `space`, `track`, `hex-grid`, and `square-grid`
- `hex-grid` and `square-grid` should be authored as single board items whose explicit cell-coordinate lists generate nested `space` components for engine play
- the board tray should present `hex-grid` and `square-grid` as two options inside a shared `Grid` preset family
- board surface appearance should be captured through reusable params like `surfaceColor`, `surfaceTexture`, `surfaceBorderColor`, `surfaceBorderWidth`, and `surfaceBorderStyle`
- grid editing should allow adding or deleting individual cells while keeping those engine-facing coordinates off the visible board surface
- hex grids should render with a visible per-hex border by default so each generated space reads distinctly

### `@turnbased/engine-ui`

UI contract derived from legal moves:

- interactable entities and zones
- selected/highlighted/drop-target states
- popup choosers
- action menus
- shared board and grid rendering

Primary exports:

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

### `@turnbased/engine-ai`

Safe AI-facing state summarization and bot helpers:

- AI input envelope
- rules summarization
- bot runner

Primary exports:

- `createAIInputEnvelope`
- `serializeAIInputForLLM`
- `summarizeRulesForAI`
- `runBotTurn`
- `validateAISelection`

## Core Data Model

The engine uses a normalized `GameState`.

Important fields:

- `entities`
  - game pieces, cards, tokens, markers
- `zones`
  - spaces, boards, hands, decks, discard piles, reserve zones
- `players`
  - score, resources, properties, active/eliminated status
- `turnState`
  - round, turn, phase, step, active player, turn order
- `pendingDecisions`
  - blocking prompts that require player input
- `stack`
  - pending effects waiting to resolve
- `priorityWindow`
  - response timing state
- `visibilityMap`
  - visibility overrides
- `actionLog`
  - canonical ordered action history

### Important state types

`Entity`

- `id`
- `type`
- `componentType`
- `zoneId`
- `ownerId`
- `controllerId`
- `position`
- `faceUp`
- `properties`
- `tags`

Notes:

- an authored component instance and a runtime entity are not the same thing
- repeated authored templates may expand into multiple runtime `ent_*` ids
- UI and canonical actions must use runtime entity/zone ids, not raw component instance ids

`Zone`

- `id`
- `type`
- `name`
- `ownerId`
- `entityIds`
- `maxCapacity`
- `visibility`
- `properties`

`PlayerState`

- `id`
- `displayName`
- `role`
- `isActive`
- `isEliminated`
- `score`
- `resources`
- `properties`

`TurnState`

- `roundNumber`
- `turnNumber`
- `activePlayerId`
- `currentPhase`
- `currentStep`
- `phases`
- `turnDirection`
- `extraTurns`
- `skippedPlayers`

## Shared IDs

Use branded IDs from `@turnbased/shared-types`.

Common helpers:

- `createEntityId`
- `createZoneId`
- `createPlayerId`
- `createComponentInstanceId`
- `createGameId`

Do not invent inconsistent ID formats inside generated code when helper constructors already exist.

## Action Model

The runtime advances through canonical actions.

Examples of canonical action categories:

- move an entity
- create or destroy an entity
- reveal or hide an entity
- add or remove resources
- set score
- prompt player decisions
- end turn
- advance phase or step

Key idea:

- high-level player intent is lowered into canonical actions
- the reducer applies canonical actions
- triggers and turn logic respond afterward

Prefer declarative action templates in rulebooks instead of hand-written reducer logic.

## Rule Authoring Path

The preferred authoring path for generated projects is:

1. define a declarative rulebook
2. compile it through `@turnbased/engine-sdk`
3. let `engine-core` execute the resulting runtime behavior

### Rulebook shape

Important top-level areas:

- `rulesText`
- `setup`
- `turnStructure`
- `scoring`
- `winConditions`
- `triggers`
- `visibilityDefaults`

### Use declarative rules for

- setup actions
- turn phases and steps
- simple triggers
- scoring formulas
- win conditions
- ownership/visibility defaults

### Use hooks only when necessary

Use hooks for:

- search or pathfinding
- graph or adjacency logic
- custom target generation
- complex scoring
- line-of-sight or derived visibility
- specialized AI hints

If declarative rules can express the mechanic, do not generate a custom hook.

## Expression Language

Rule expressions are intentionally narrow and deterministic.

They support:

- strings, numbers, booleans, `null`
- field access
- array indexing
- arithmetic
- comparisons
- boolean logic

Typical runtime scope fields:

- `state`
- `previousState`
- `event`
- `player`
- `activePlayer`
- `viewerId`
- `entity`
- `zone`
- `controllerId`
- `variables`

## Components

Built-in components are the first choice for generated projects.

Typical built-in component families include:

- `board`
- `space`
- `zone`
- `piece`
- `token`
- `deck`
- `hand`
- `counter`

Use the component catalog rather than inventing unsupported component types.

### Important component APIs

- `listBuiltInComponents()`
  - enumerate supported built-in component types
- `getBuiltInComponentManifest(type)`
  - inspect labels, descriptions, property definitions, layout hints, and visibility defaults
- `createComponentInstance(type, options)`
  - create an instance with bindings, placement, and properties
- `validateComponentPlacement(projectTree)`
  - ensure parent/child placement is valid
- `validateComponentTree(projectTree)`
  - catch structural issues before runtime compilation

### Component-generation rules

- create the minimum number of components required for the requested game loop
- prefer a single board plus spaces/zones for initial builds
- prefer a single board with one playable starter space unless the brief strongly requires more
- ensure each player has owned pieces if the game expects direct movement
- prefer `Player N Resources` zones for player-owned starter resources
- add a shared `Game Supply` when the starter loop benefits from common neutral resources
- prefer one authored per-player resource template with `quantity` over many duplicate child pieces
- prefer a nested `resource-pile` inside each supply-style zone when the resources should appear in the editor surface
- keep movable `piece` and `token` templates visible as first-class outline items in the component editor
- use `colorMode: 'owner'` for player-colored starter resources
- use `supplyMode: 'infinite'` for authored resource sources that should not drain when used
- keep names readable and theme-aligned

## Legal Moves

Legal moves are the engine’s authoritative interaction surface.

Primary APIs:

- `generateLegalMoveTree(...)`
- `getValidDestinations(...)`
- `getValidEntitiesForDestination(...)`

Important types:

- `LegalMoveTree`
- `CompiledLegalMoveTree`
- `LegalAction`
- `LegalMoveRequest`

### What a legal action contains

- `id`
- `type`
- `displayName`
- `interactableEntities`
- `validDestinations`
- `validTargets`
- `subChoices`
- `tags`
- optional explanation and cost

### Design rule

A generated game should make player interaction discoverable through legal moves.

If preview cannot produce meaningful legal actions, the generated project is incomplete.

## UI Contract

Never generate game UI logic that bypasses the legal move tree.

Use `@turnbased/engine-ui` to derive:

- selected entities
- interactable zones
- highlighted destinations
- popup choosers
- menu actions
- reusable linked-view navigation surfaces

The UI layer should render engine-derived affordances, not invent custom legality rules.

For linked multi-view starter projects, prefer the reusable `@turnbased/engine-ui` surfaces:

- `GameTableHeader`
- `GamePreviewWindow`
- `GameSurfacePopup`
- `LinkedSeatSummaryStrip`
- `GameInfoPanel`
- `ResourceDock`
- `LinkedViewStage`
- `PlayerLinkedViewStage`

These assets provide the default "single shared board + player strip + resources dock + shared game supply + linked player view" flow and should be reused before inventing a custom starter shell.

## Visibility and AI Safety

Use projected visible state for AI and player-facing consumers.

Important APIs:

- `projectGameStateForPlayer`
- `projectGameStateForAI`
- `projectGameStateForViewer`
- `createAIInputEnvelope`
- `summarizeRulesForAI`

### AI input envelope

The preferred model-facing gameplay context includes:

- visible game state
- legal moves
- player info
- concise rules summary
- recent visible history
- turn context

Do not feed unrestricted hidden state to a seat-specific AI unless the game mode explicitly allows omniscient analysis.

## Preferred Build Strategy for AI Project Generation

When generating a new game project:

1. preserve the requested setup brief, especially player range, solo/campaign flags, theme, and art style
2. create seats, seat identity, and ownership first
3. create one shared board view plus one linked player view per seat
4. prefer a single board with one playable starter space unless the brief strongly requires a richer map
5. give each player a `Player N Resources` area with an owned resource template unless the brief explicitly asks for a compatible alternative
6. use `quantity` for repeated starter cubes/workers when the copies are identical
7. use `colorMode: 'owner'` when those resources should render in player color
8. add a shared `Game Supply` or `supplyMode: 'infinite'` resource source when the loop needs renewable neutral pieces
9. define concise rules text
10. prefer a simple declarative turn structure
10. ensure preview can compile
11. ensure legal moves exist for the active player
12. keep app layout language aligned with the game theme and Lucide-first shell defaults

## What Not to Do

Do not:

- modify `packages/engine-*` during project generation
- invent undocumented engine exports
- bypass legal-move generation with custom UI-only action rules
- store core gameplay truth only in prose
- create unnecessary custom hooks when declarative rules are enough
- assume server-side execution for gameplay logic

## Useful Minimal Workflow

For a typical generated project:

1. inspect the rules brief
2. choose built-in components from `engine-components`
3. create a minimal component tree
4. define rules through `engine-sdk`
5. compile or map into runtime structures
6. build preview state through `engine-core`
7. generate legal moves
8. derive UI affordances through `engine-ui`
9. expose AI-safe prompt context through `engine-ai`

## Source-of-Truth Docs

If more detail is required, consult these docs in this order:

1. `docs/engine/api-index.md`
2. `docs/engine/agent-engine-api.md`
3. `docs/engine/component-model.md`
4. `docs/engine/rules-authoring.md`
5. `docs/engine/legal-move-generation.md`
6. `docs/engine/ui-interaction-contract.md`
7. `docs/engine/ai-player-contract.md`
8. `docs/engine/architecture.md`
