# ADR 0004: Compose the Web Editor as a Shell with Section Modules

## Status

Accepted

## Context

The web editor is expected to become one of the largest and most frequently changed parts of the product. A single-file editor page had already grown past a thousand lines while handling:

- project loading and persistence
- preview runtime state
- visual editing UI
- component editing UI
- settings UI
- preview UI
- sidebar and workspace chrome

That shape made the editor harder to change safely, and it encouraged adding more concerns to the main page file instead of creating clear extension points.

At the same time, the old `#/templates` entry point and blank-editor-first flow no longer matched the desired product direction. New projects should begin with a lightweight setup form, then let AI generate the initial linked-view workspace.

## Decision

The creator should use a staged architecture:

- `apps/web/src/pages/CreateBlankProject.tsx` is the pre-build setup stage.
  It owns the AI-first onboarding flow, including the game name, player-count range, solo/campaign flags, theme, art style, starter presets, and the handoff into `Build with AI`.
- `apps/web/src/pages/Editor.tsx` is the post-build shell.
  It owns route parsing, project loading, persistence, preview state, active section state, version-history actions, workspace syncing, and cross-section callbacks.

- `apps/web/src/editor/sections/` owns the top-level editor areas.
  Each section renders one major post-build workspace surface such as the combined `Editor`, `Preview`, `Versions`, or `App Layout`.
- `apps/web/src/editor/components/` owns shared editor chrome.
  The sidebar, requirements banners, and future shared editor scaffolding belong here.
- `apps/web/src/editor/*.ts` owns editor domain logic.
  Project mutation, runtime compilation, AI project generation, workspace persistence, version helpers, constants, and shared helpers should stay outside React view files whenever possible.

The project boundary should be explicit:

- `#/new` opens the AI-first setup builder.
- a valid setup brief is required before a generated workspace exists.
- AI builders may read engine docs, API contracts, and other repo context, but generated artifacts should only be written inside the project workspace boundary.
- version history should track workspace files, not just raw editor state snapshots, with remote backup available when the user is signed in and the Supabase git flow is configured.
- generated projects should treat linked views as first-class project state: one shared board view plus one linked player view per seat.
- the post-build editor should prefer one combined edit surface over splitting visual and component editing into separate primary tabs.
- the combined editor should favor reusable rendered component cards, focused create/edit flows, and compact starter scaffolds over raw internal trees as the primary experience.
- the left rail should treat `Component Editor` as an expandable outline:
  - top-level components appear directly beneath that entry
  - each top-level component carries a tasteful type icon
  - inline creation starts from the `+` affordance on the `Component Editor` row
  - movable nested pieces/tokens stay out of the nested layout canvas and remain outline-first resources
  - supply-style zones should usually show a permanent nested `resource-pile` region instead of raw movable blocks
  - board appearance editing should be direct: spaces, tracks, and similar board children are arranged visually in-canvas with drag/drop and resize controls
  - preview should reuse the same board-surface renderer so the authored board corresponds 1:1 with the playable surface
  - the main workspace stays focused on editing the selected board, styling its placed children, or creating a new board item

The old templates screen is removed from the primary flow:

- `#/new` opens the setup builder and does not expose the full editor until AI generation completes.
- legacy `#/templates` hashes redirect to `#/new`.
- product entry points should link to `#/new` directly.

## Consequences

Positive:

- The editor can grow by adding new section files instead of bloating the shell.
- The pre-build onboarding flow can evolve independently from the post-build editor.
- Shared chrome can evolve independently from section rendering.
- It becomes easier to reason about whether logic belongs in the shell, a section, or a domain module.
- The project-creation flow becomes faster and more guided for users.
- The combined editor can keep the authored component tree, component details, and rendered component view aligned in one place without a separate generic inspector pane.

Tradeoffs:

- Cross-section props still flow through the shell, so some future shared state may need dedicated hooks or context if coordination grows.
- Styling is still inline and centralized in editor style helpers, which is acceptable now but may need another pass if theme complexity increases.
- The current editor still keeps a browser-local working copy, while initial AI builds and version history can sync into Supabase-backed project records. A future fully isolated server-backed project workspace can replace that storage layer without changing the staged UI architecture.

## Follow-Up Rules

- Do not add new large render blocks back into `Editor.tsx`.
- Keep pre-build setup collection out of `Editor.tsx`.
- When a section becomes large, split it again inside `src/editor/sections/`.
- Keep project-creation behavior behind the rules-builder stage so future onboarding changes happen in one place.
