# Web App

This app hosts the creator dashboard, editor, local preview flows, and marketplace-facing browser UI for TurnBased.

## Editor Structure

The creator flow is intentionally split into two phases:

- Pre-build: the `#/new` rules builder collects player count, player colors, theme, components, and the first rules draft, then offers `Get AI rule suggestions / clarifications` and `Build with AI`.
- Post-build: the generated workspace opens in the editor shell with focused modules for `Visual`, `Preview`, `Versions`, `Component Editor`, and `App Layout`.

The post-build editor is intentionally split into a thin page shell plus focused modules:

- `src/pages/Editor.tsx`
  Orchestrates project loading, persistence, preview runtime state, version history, workspace syncing, routing from the hash, and cross-section actions.
- `src/editor/components/`
  Shared shell pieces such as the compact sidebar and requirements notice.
- `src/editor/sections/`
  One file per top-level editor area. Right now that is `Visual`, `Preview`, `Versions`, `Component Editor`, and `App Layout`.
- `src/editor/helpers.ts`, `src/editor/styles.ts`, `src/editor/constants.ts`
  Shared non-domain helpers, editor UI styles, and section metadata.
- `src/editor/project.ts`, `src/editor/runtime.ts`, `src/editor/storage.ts`, `src/editor/workspace.ts`, `src/editor/git.ts`, `src/editor/aiBuilder.ts`
  Domain logic for editing project data, compiling preview runtime state, persisting project records, maintaining the per-project workspace boundary, version history, and AI project generation.

## Scaling Rules

When the creator grows, keep these boundaries intact:

- Add new editor views as new files under `src/editor/sections/` instead of expanding `Editor.tsx`.
- Keep the rules-builder flow separate from the post-build editor shell.
- Keep `Editor.tsx` responsible for shared state and coordination only, not detailed rendering.
- Put reusable sidebar, navigation, notices, and future workspace chrome in `src/editor/components/`.
- Keep business logic in `src/editor/*.ts` modules rather than embedding it in React components.
- If a section needs its own internal workflow, split that section into subcomponents before it becomes another large mixed-responsibility file.
- Treat the per-project workspace as the writable boundary for generated artifacts and version history. AI builders may read broader repo context, but generated files should land inside the project workspace only.

## AI-First Project Flow

The old templates screen has been removed. New project entry points now go through `#/new`, which opens the AI-first rules builder instead of a blank editor.

Until there is a rules brief, there is no game. `Build with AI` generates the initial project scaffold, writes the workspace files, creates the first local version checkpoint, and then opens the editor.

Legacy `#/templates` hashes are redirected to `#/new` in the router so old links do not strand users.
