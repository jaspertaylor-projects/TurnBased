# Linked Multi-View Startup Flow with Lucide-Driven Player Identity

## Summary

Rework new-game creation so the creator enters only:
- game name
- player count range
- `distinct solo mode` checkbox
- `campaign game` checkbox
- theme
- art style

Use those inputs to generate a default project whose core engine-backed UX is a linked multi-view experience:
- one primary game view with the main board
- a persistent summary strip of all players/resources
- each player summary is clickable
- clicking a player swaps the main viewing area into that player’s linked view while preserving the shared shell
- each player has 6 starting block resources
- each player summary shows a colored circular identity badge with an avatar inside
- avatar rendering should default to Lucide icons when no custom avatar exists

Decision locked:
- v1 multi-view support lives in project schema + AI generation + preview/player UI, not deep reducer/state semantics
- clicking a player summary swaps the main viewing area to that player’s linked view

## Implementation Changes

### New project input model and AI prompt
- Replace the current rules-brief-heavy new-project form with a compact setup model:
  - `name`
  - `minPlayers`
  - `maxPlayers`
  - `hasDistinctSoloMode`
  - `isCampaignGame`
  - `theme`
  - `artStyle`
- Update the builder prompt-pack and AI blueprint contract so generation is guided by:
  - linked multi-view startup structure
  - player count range
  - solo/campaign flags
  - theme + art style
  - 6 starting block resources per player
  - Lucide-first avatar/icon usage
- Remove the expectation that the creator provides raw initial rules text during project creation; the first build should infer a minimal playable scaffold from the lighter brief.

### Project/app schema for first-class linked views
- Extend the editor project schema to include explicit view definitions at the project level.
- Add a default view model that supports:
  - one `main/shared` game view
  - one linked player view per player seat
  - stable ids, labels, and linkage metadata between the shared view and player views
  - default selected view for preview/app layout
- Extend app-layout data so the generated shell can describe:
  - player summary strip
  - linked-view navigation behavior
  - avatar/icon presentation
  - resource-summary presentation
- Keep this as a first-class project/runtime concept, not just descriptive UI copy.

### Startup scaffold generation
- Update scaffold/materialization logic so every newly generated game includes:
  - a shared board-centered main view
  - per-player linked views
  - 6 block resources per player in their personal area
  - player summaries visible from the main view
  - clickable summaries that switch the main viewing area to the corresponding player view
- Ensure the generated player identity model includes:
  - player color
  - avatar/icon token
  - Lucide icon fallback key when no custom avatar exists
- Update the AI generation acceptance criteria so a build is incomplete unless:
  - the shared view exists
  - all player views exist
  - view links are valid
  - 6 starting resources per player exist
  - preview can render the shared view and each linked player view

### Preview and player-facing UI
- Upgrade preview/app-layout rendering to understand the new view model:
  - render the shared shell
  - render player summary cards/buttons
  - switch the main viewing area based on selected view
  - preserve board context and summary strip across view changes
- Default player summary content should show:
  - colored circular badge
  - Lucide avatar icon
  - player name
  - compact resource summary
- The clicked player’s personal items should render in the main viewing area, not in a modal.
- Heavy Lucide usage should be explicit in the visual system:
  - add `lucide-react` as a UI dependency
  - use Lucide icons for avatar fallback, player badges, view navigation affordances, resource markers, and other default startup-project chrome
  - document Lucide as the default icon system for generated creator/player shells unless a future art asset overrides it

### Docs and product framing
- Update product docs/ADRs/AI builder docs so they clearly state:
  - new projects begin from a lightweight setup form, not a long rules brief
  - linked multi-view support is a first-class part of the generated project model
  - default startup projects include a shared board view plus linked player views
  - Lucide icons are the default iconography system for startup scaffolds and fallback avatars
- Update the model-facing generation prompt to explicitly request:
  - linked views
  - player summary strip
  - clickable player summaries
  - 6 block resources per player
  - colored circular player badges with Lucide fallback icons
  - theme/art-style reflected in naming and presentation

## Public Interfaces / Types

- Replace or substantially reshape the new-game brief input type:
  - from rules-text/component-list oriented fields
  - to setup-oriented fields (`name`, player range, solo flag, campaign flag, theme, art style)
- Add project-level view definitions:
  - shared game view
  - player-linked views
  - selected/default view metadata
- Add player identity presentation fields needed for default avatars/icons.
- Add app-layout/view-shell fields for:
  - summary strip
  - linked view navigation
  - icon/avatar configuration
- Add AI blueprint fields for:
  - player count range
  - solo/campaign flags
  - shared/player view definitions
  - starting player resources
  - Lucide avatar/icon choices

## Test Plan

- New project flow:
  - creator can create a game without entering raw rules text
  - player count range is preserved in metadata and generated copy
  - solo/campaign flags are preserved
- Generated scaffold:
  - main shared view exists
  - one linked player view exists per seat
  - each player starts with exactly 6 resources
  - player summaries render in the shared view shell
- Interaction:
  - clicking a player summary swaps the main viewing area to that player’s linked view
  - switching views does not break preview or lose shared shell state
- Visual defaults:
  - colored circular player badges render
  - Lucide fallback avatars render when no custom avatar is present
- Persistence/versioning:
  - views and icon/avatar metadata serialize into workspace files and commit history
  - restoring an older commit restores view linkage correctly
- AI generation:
  - blueprint/materializer rejects or repairs builds missing linked views/resources
  - generated project still compiles and preview remains playable

## Assumptions

- v1 “first-class engine support” means first-class project/preview/runtime contract support, not reducer-level view semantics.
- The main board remains part of the shared shell; clicking a player summary changes the main content area to that player’s linked view.
- Lucide is the default iconography system for startup scaffolds and avatar fallbacks.
- Custom uploaded/player-authored avatar art is future work; Lucide fallback is the required default for v1.
- “6 block resources” should be implemented as six visible starter resource units per player using existing component primitives and Lucide-enhanced presentation.
