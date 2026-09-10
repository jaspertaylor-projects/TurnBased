# Web App

This app hosts the board-game designer's workshop: rules, editable physical
components, playtests, version history, home printing, and supplier preparation.

## Editor Structure

`#/new` creates a local game from a working title without an account or AI call.
`#/new/guided` retains the guided AI setup. Both open the same editor, where
designers can develop rules and components in any order.

The post-build editor is intentionally split into a thin page shell plus focused modules:

- `src/pages/Editor.tsx`
  Orchestrates project loading, persistence, preview runtime state, version history, workspace syncing, routing from the hash, and cross-section actions.
- `src/editor/components/`
  Shared shell pieces such as the compact sidebar and requirements notice.
- `src/editor/sections/`
  Top-level views for the workshop, rulebook, components, art, playtests,
  history, print/share, game details, and table layout.
- `src/editor/componentStudio/`, `templateStudio/`, and `cardStudio/`
  Physical component adapters, editable layers/faces and rendering, and
  table-driven designs with AI column/cell edits.
- `src/editor/production/`
  Supplier matching, physical purchase quantities, and the artwork ZIP.
  See its [guide](src/editor/production/README.md) for provider limits and checks.
- `src/editor/playtest/`, `versions/`, and `persistence/`
  Supported deterministic games/agent packets, checkpoints and archives,
  and browser drafts with deduplicated artwork.
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

## Physical prototype workflow

Every component family shares the visual template editor. **Layouts → Blank**
clears artwork layers while retaining the faces and physical settings. Bind
text/artwork to table fields and generate the required copies. Home exports
retain the template's millimeter dimensions, including duplex placement and
optional bleed.

**Print & share → Prepare supplier order** matches each component to a real
catalog product and variant. Designers explicitly choose whether to resize a
printable template or use a stock part. The resulting ZIP includes artwork,
copy mappings, paper proofs, rules, and the editable game archive. Supplier
proof review, final pricing, payment and delivery happen with the supplier;
this application does not yet create a hosted manufacturing cart.

See the [root README](../../README.md) for local startup, AI tooling, browser
checks, and the three recorded Moonlit Market walkthroughs.
