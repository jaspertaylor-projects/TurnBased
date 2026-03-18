# ADR 0004: Compose the Web Editor as a Shell with Section Modules

## Status

Accepted

## Context

The web editor is expected to become one of the largest and most frequently changed parts of the product. A single-file editor page had already grown past a thousand lines while handling:

- project loading and persistence
- preview runtime state
- visual editing UI
- rules editing UI
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
  Each section renders one major post-build workspace surface such as `Visual`, `Preview`, `Versions`, `Component Editor`, or `App Layout`.
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

Tradeoffs:

- Cross-section props still flow through the shell, so some future shared state may need dedicated hooks or context if coordination grows.
- Styling is still inline and centralized in editor style helpers, which is acceptable now but may need another pass if theme complexity increases.
- The current editor still keeps a browser-local working copy, while initial AI builds and version history can sync into Supabase-backed project records. A future fully isolated server-backed project workspace can replace that storage layer without changing the staged UI architecture.

## Follow-Up Rules

- Do not add new large render blocks back into `Editor.tsx`.
- Keep pre-build setup collection out of `Editor.tsx`.
- When a section becomes large, split it again inside `src/editor/sections/`.
- Keep project-creation behavior behind the rules-builder stage so future onboarding changes happen in one place.
