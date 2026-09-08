# TurnBased Architecture

Companion to [goal.md](./goal.md) and [goldenrules.md](./goldenrules.md). This is the
single source of truth for *how the codebase is laid out today* and *which pieces
matter for the current milestone*. If something here contradicts a doc in
`docs/`, this file wins — see "Doc inventory" at the bottom for the cleanup map.

## 1. Scope

TurnBased is an approachable workshop for amateur board game designers:
**idea → prototype → playtest → revise → print**. The user explicitly made
versioning, AI-compatible playtesting, and templates driven by tables current
priorities in September 2026. Components is the unified authoring surface;
Card Studio lives inside decks, and cards, boards, tokens, tiles, mats, and
pieces share the same fully editable layer/face template editor. Earlier
exclusions of AI players and legal-move generation from the active milestone no longer apply.

The current product supports:

- Guest/local game creation, a recent-games workshop, and a Little Woodland
  example with rules, card data, and a configured playtest experiment.
- Rulebooks, supplier-linked physical inventory, art assistance, and a unified
  Components workspace for cards, boards, tokens, tiles, mats, and pieces.
  Its shared layer editor supports editable layouts, faces, data bindings,
  reusable template JSONs, and table-driven copy generation.
- Named checkpoints, experiment branches, design comparisons, safe restores,
  and portable archives containing design history and embedded artwork.
  Checkpoints are secured locally before optional remote sync, with one
  five-second deadline spanning authentication, initialization, and upload.
  Imported archives start separate cloud histories.
- A bounded, executable two-player market-race lab with seeded heuristic
  agents, replayable transcripts, version-linked findings, and a public JSON
  observation/legal-move contract for external agents.
- A4/Letter prototype sheets for every component family, shaped trim guides,
  optional bleed, duplex fronts/backs, tiled large boards, and printable
  rulebooks. Supplier checkout and production fulfillment remain future work.

The lab does not interpret arbitrary rulebook prose or card abilities, and
it is not an automatic LLM runner. Broad game-engine coverage, hosted
multiplayer, marketplace, payments, and an online economy remain longer-term
work. Keep these boundaries explicit in UI copy and architecture decisions.

The [Moonlit Market walkthrough](../docs/demos/README.md) demonstrates the
real workflow using the dev account for AI writing and artwork. Reusable
recording, rendering, and playback-check tools live in `scripts/demo/`;
large local videos and exported prototypes are ignored under `artifacts/demos/`.

## 2. Monorepo layout

```
/apps
  /catalog-api               supplier catalog + quotes + ingestion (NestJS/Prisma)
  /web                       local workshop + editor + playtest lab + prototype exports
/packages
  /engine-components         built-in component catalog + schemas       [ACTIVE]
  /engine-core               reducer, triggers, turn system              [ENGINE FOUNDATION]
  /engine-sdk                author-facing rule APIs                     [ENGINE FOUNDATION]
  /engine-ui                 interaction affordances                     [ENGINE FOUNDATION]
  /engine-ai                 AI player contracts                         [ENGINE FOUNDATION]
  /shared-types              cross-package types                         [ACTIVE]
  /shared-utils              zod schemas, IDs, serialization             [ACTIVE]
  /sample-games              reference games                             [ENGINE FOUNDATION]
/supabase
  /migrations                auth, projects, ledger, builds, multiplayer,
                             commerce, rate-limits, play-sessions
  /functions                 ai-project-builder, ai-image-agent, assets-manager,
                             build-manager, git-proxy, play-session-token,
                             stripe-webhook
```

**Local stack:** `npm run dev` / `npm run dev:local` starts catalog Postgres
(54328), Redis (6380), the API (3100), Supabase, and Vite (3000). The root
`compose.yml` owns persistent catalog volumes, separate from Supabase.
`apps/catalog-api` is the former BoardGameMakerAPIServer; no sibling checkout
is needed. The web still uses HTTP `/v1`, proxied by Vite. See the
[catalog README](../apps/catalog-api/README.md) for setup and data ingestion.

**Import rules (from ADR 0001, still in force):**

1. App code may only import public exports of `packages/*`. No deep imports.
2. Engine packages may depend on `shared-types` / `shared-utils` but not on
   app code.
3. `engine-components` defines the editor catalog. Engine packages also
   support the existing preview runtime; the current lab has its explicit
   executable model in `apps/web/src/editor/playtest/`.

## 3. Web app — editor architecture

The entry workflow creates a saved project before optional AI assistance:

- [CreateGame.tsx](../apps/web/src/pages/CreateGame.tsx) at `#/new` collects a
  working title, optional theme, and 1–6 players. It creates a local project
  and initial checkpoint without auth or AI calls. The Little Woodland sample
  includes five editable rule chapters, four designs / ten cards, and a
  matching market-race configuration.
- `#/dashboard` is available to guests and lists local projects, checkpoint
  counts, search, next actions, and a copyable sample.
- [CreateBlankProject.tsx](../apps/web/src/pages/CreateBlankProject.tsx) remains
  at `#/new/guided` for guided AI setup. Legacy `#/templates` redirects to
  `#/new`.
- [Editor.tsx](../apps/web/src/pages/Editor.tsx) coordinates loading, autosave,
  undo, sections, and version actions. `EditorFrame` owns shared rendering;
  `editorComponentActions.ts` isolates component actions. The default section
  is `workshop`; Components links use `#/editor/<id>?section=component_editor`.
  Legacy `card_studio` links open the card family in Components. Load the
  latest saved draft; selecting a checkpoint is an explicit restore action.

### Section modules

Top-level editor surfaces live under
[apps/web/src/editor/sections/](../apps/web/src/editor/sections/):

- `WorkshopSection` — next steps and prototype counts.
- `RulesSection`, `StatsSection` — rulebook and game details.
- `ComponentsWorkbench` in `componentStudio/` — unified inventory, shared
  template authoring, component tables, physical options, and Placement access.
- `CardStudioSection` — table, import, and generated-copy tools embedded inside
  the selected component; it is not a separate top-level workflow.
- `TemplateEditor` in `templateStudio/` — shared layer, face, data-preview,
  physical-dimension, and reusable-template tools for all component families.
- `PlaytestSection` — executable lab, external-agent turns, sessions, findings.
- `VersionsSection` — named checkpoints, branches, change comparison, trail map.
- `PrintSection` — all-family sheets, face/duplex selection, tiled board
  assembly, rulebook export, and portable archive import/export.
- `VisualsSection`, `ComponentEditorSection`, `ComponentGallery` — existing
  interactive placement, board appearance, and legacy outline tools reached
  from the unified Components workflow.
- `ArtSection`, `AppLayoutSection` — art and linked table/player views.

There is intentionally **no separate `PreviewSection`** anymore — preview
reuses the same board-surface renderer used inside `VisualsSection` so the
authored board corresponds 1:1 with the playable surface (this is what
ADR 0004 calls "one combined edit surface").

### Domain modules (non-React)

[apps/web/src/editor/*.ts](../apps/web/src/editor/) hold logic that must stay
out of view files:

- `project.ts` — project mutation primitives.
- `runtime.ts` — compile authored project → preview runtime state.
- `storage.ts`, `workspace.ts`, `git.ts` — persistence layers (all async).
  Live project snapshots, version history, workspace files, and images live
  in **IndexedDB** via `persistence/`. See the storage contract below.
- `aiBuilder.ts`, `aiBuildService.ts`, `ai.ts` — AI build orchestration.
- `supplierCatalog.ts`, `useSupplierCatalog.ts` — supplier lookup and pricing.
- `shipping.ts` — generated workspace files and preview/release build records.
- `cardStudio/` — table normalization, CSV/TSV parsing, copy expansion, and
  legacy card rendering. Document-bearing card exports use the shared renderer.
- `componentStudio/model.ts` — enumerate physical design sets, migrate legacy
  card data, and create/update/duplicate/remove component designs.
- `componentStudio/print.ts`, `printLayout.ts` — actual-size imposition,
  matching duplex backs, tiled board regions, and portable print HTML.
- `templateStudio/` — shared millimeter-based document/layer types, normalized
  presets, rendering, editing operations, and the interactive TemplateEditor.
- `playtest/` — the executable market-race model, agent packets, replay,
  batches, and findings.
- `versions/` — readable design comparison and portable archives.
- `exports/` — file downloads and printable rulebooks.
- `boardLayout.ts`, `componentMeta.tsx`, `iconography.tsx` — visual
  conventions.

### Storage and version contract

- `persistence/liveProjects.ts` stores a v2 pointer for each game under
  localStorage `turnbased.creator.projects`: ID, name, update time, and
  snapshot hash. Full deflated snapshots live in the IndexedDB blob store.
  Legacy inline projects remain readable and migrate on their next save.
- Write the snapshot before updating its index pointer. Keep all public
  storage APIs async; use `saveEditorProject` / `loadEditorProject` rather
  than writing localStorage directly.
- Workspace and checkpoint records hold path → SHA-256 references. Embedded
  images become `idb-image://<hash>` references at rest and inflate on load.
  Component/table/template normalization runs after image hydration, so
  persisted image references are never stripped as unsupported image URLs.
- Checkpoints are immutable and retained locally even after remote sync.
  Restore preserves a dirty draft in a named safety checkpoint first;
  new checkpoints retain their parent links without deleting forward
  history. Designers can name experiment branches explicitly. Remote backup
  is optional.
- `versions/archive.ts` exports design archive v2: the live draft, all
  checkpoints, parent/branch metadata, and a deduplicated embedded-artwork
  map. Import validates artwork hashes and checkpoint ancestry and creates
  a new project. The current limits are 100 MB and 2,000 checkpoints per
  archive; the exporter does not trim history to fit. v1 archives remain
  importable.
- Automatic orphan-blob garbage collection is intentionally disabled in
  project deletion/history maintenance. Blobs may be shared by live drafts,
  workspaces, and checkpoints, and collecting during an in-flight save can
  destroy its new snapshot. A future coordinated compaction must capture
  all roots and serialize against saves; do not reintroduce eager pruning.

### Unified component and template contracts

`EditorProject.componentDesigns?: Record<instanceId, CardStudioState>` is the
canonical authoring map. Each key is an existing physical component instance
ID, so adding a design does not create a second inventory item. Physical
instances retain placement, supplier links, dimensions, and quantities.
`listProjectDesignSets(project)` is the adapter used by Components, counts,
rulebook exports, version comparison, workspace exports, print, and playtests.
It returns named sets with an ID, instance ID, family, and studio state.

Legacy `EditorProject.cardStudio` remains readable as exactly one virtual
`legacy-card-studio` deck. Opening it materializes a physical deck, copies its
existing rows and template into `componentDesigns`, then removes the legacy
field. Preserve source row IDs, quantities, artwork, and old checkpoints;
never enumerate both representations as separate physical decks. Existing
physical components without authored documents derive deterministic starter
sets that are saved when opened. Reads must not create random inventory IDs.

Each `CardStudioState` holds rows, custom columns, copy counts, compact
generated references, and a shared `CardTemplate`. Its optional `document`
is a `ComponentDesignDocument`: physical width/height, trim shape, corner
radius, bleed, safe margin, grid/snapping settings, and editable faces.
Each face contains ordered text, image, shape, grid, and track layers.
Coordinates and sizes are millimeters; text font sizes are points. Data-bound
text/images use explicit `{{field}}` substitutions from a selected table row.
Legacy card templates retain their prior renderer until migrated.

`TemplateEditor` edits layout, face names, layer order, visibility, locks,
position, size, rotation, opacity, typography, image fit, shape appearance,
grids, and tracks. It supports canvas gestures, keyboard manipulation,
alignment/distribution, undo/redo, and previewing table records. Reusable
`turnbased-component-template` JSON files carry normalized documents and
embedded artwork. Adding, duplicating, and removing faces is supported.
Template import/preset replacement asks for confirmation before replacing the
current layout. CSV/TSV import validates before replacing or
appending component data.

`renderDesignSvg(document, options)` drives live template previews and exports.
Use a unique `idPrefix` for each inline copy so SVG clipping IDs cannot collide.
`buildComponentPrintHtml` packs physical copies onto A4/Letter sheets, selects
one/all faces or aligned duplex pairs, optionally includes bleed, and tiles
oversized boards at actual size with 10 mm overlap and labeled coordinates.
Duplex mirrors placement across the page for long-edge flipping, including
partial final sheets; it does not mirror the artwork. Uploaded images are
embedded once and reused across copies. Linked artwork still needs its URL.
These are home prototype files, not supplier-approved production files.

Printed template artwork does not create interactive game structure. Grids,
tracks, and icons remain artwork; Placement continues to author interactive
spaces, children, and pieces through the existing board surface/runtime.

### Agent contract

`EditorProject.playtestLab` holds the lab configuration, session transcripts,
batches, and version-linked findings. `market-race-v1` supports exactly two
seats gathering a resource, buying public-market cards by numeric cost,
scoring points, and ending turns. It offers balanced/greedy/random heuristic
strategies, deterministic seeds, batch results, and replay validation.
Rulebook prose and card ability text are reference material only. New project
experiments aggregate card design sets with namespaced set/row IDs, plus
standalone cards not already represented by a deck. Non-card component
families are included as reference definitions rather than simulated cards.
Existing runs retain frozen card/configuration snapshots and unchanged replays.

Agent packets include frozen session configuration/card definitions,
executable rules, public observations, legal action IDs, and a JSON response
shape. Imported moves must match the current step and a legal action; stale
or illegal replies are rejected. No LLM API call is made by the built-in
agents. This contract is a starting point for broader executable games, not
proof that arbitrary authored games are already machine-playable.

### Scaling rules

Restated here so they don't get lost:

- Add new editor surfaces as new files in `sections/`. Do not expand
  `Editor.tsx`.
- Keep `Editor.tsx` for shared state and coordination only.
- Keep business logic in `editor/*.ts` modules, not embedded in React.
- Per-project workspace is the writable boundary for generated artifacts.
  AI builders may *read* broader repo context, but generated files land
  inside the project workspace only.
- File length ceiling: **600 lines** (per goldenrules.md). Split before
  crossing.

## 4. Component model

The authored project is a tree of components. Each component is either a
**template** (one author-time entity that expands into many at runtime via
`quantity` and `colorMode` — e.g. one "worker" template → 12 cubes) or a
**leaf** (a unique placed thing).

Built-in component types (the full catalog lives in
[packages/engine-components/src/catalog.ts](../packages/engine-components/src/catalog.ts)):

- **Spatial:** `board`, `tile`, `space`, `hex-grid`, `square-grid`,
  `checkerboard-grid`, `track`
- **Entities:** `card`, `piece`, `token`, `image-area`
- **Containers / collections:** `deck`, `hand`, `discard`, `bag`, `zone`
- **Counters:** `counter`, `score-track`, `text-box`, `network`

What this means for editor work: when adding a new built-in type, the
manifest (in `engine-components`), the editor inspector (in
`editor/sections/visuals/`), and the runtime expansion logic
(`editor/runtime.ts`) must all be updated together.

**Leaf authoring inspectors.** Rich leaf types get a dedicated inspector
component rendered by `BoardItemInspector` instead of the generic property
grid:

- `editor/components/ImageInspector.tsx` (`image-area`) — image sources
  (upload / drag-drop / paste, project Art library, AI generate via
  `AIImageGenerationModal`) plus fit + focal-point crop, opacity, corner
  radius, shadow, filters/tint. Styling is resolved through the shared
  `editor/components/imageAreaStyle.ts` so the board render
  (`renderImageAreaContent`) and the inspector preview stay identical.
- `editor/components/TextBoxInspector.tsx` (`text-box`) — typography
  (thematic fonts loaded in `index.css`, weight, letter-spacing, alignment,
  inset) + project-icon insertion.

**Canvas manipulation.** The Konva board surface (`packages/engine-ui`)
draws an 8-point selection frame on the selected item (`RESIZE_HANDLE_SPECS`
+ `KonvaResizeHandles`). Handle presses call `onResizeHandle`, routed through
`useBoardInteraction.handleBoardItemPointerDown` with forced edges. Keyboard:
arrows nudge (Shift ×10), Alt+arrows resize, Shift on a corner locks aspect.

## 5. AI builder integration

`Build with AI` posts the user's pre-build brief to a Supabase edge function
([supabase/functions/ai-project-builder/](../supabase/functions/ai-project-builder/))
that calls OpenRouter and returns a structured project payload. The web app
materializes that payload into the per-project workspace (rules, components,
manifest) and creates the first version checkpoint.

`OPENROUTER_API_KEY` must be available to the edge runtime. Local dev uses
`supabase functions serve` against `.env`.

Subsequent AI assistance (rule suggestions, art generation) follows the same
shape: edge function → structured payload → workspace mutation.

Rulebook AI assist persists validated per-project controls in localStorage.
Its hook applies replies through the latest rules updater, protects newer
typing, and invalidates requests when the panel closes, the section unmounts,
or a checkpoint restores. RulesSection uses the restore epoch as part of its
React key. AI undo belongs to the current editing session.

The rules writer edge entrypoint delegates to handler.ts (auth/provider/usage),
prompt.ts (context/modes), models.ts (supported models and parameters), and
protocol.ts (shared parsing). Browser/backend model choices are checked
together; unsupported temperature is omitted and disabled model rows remain
disabled. Recorded usage is the source for historical costs.

Rules and Art Studio share icon descriptions. Structured Iconography is
included in printed rulebooks. Legacy normalization preserves authored
Glossary prose and explicit standard chapter kinds. Supplier edits from Rules
keep component identities and authored rows/layers, synchronizing printable
template dimensions with the selected physical product.

## 6. Prototype printing and supplier direction

`PrintSection` closes the current iteration loop with a selector for every
component family, physical paper/face/duplex/bleed settings, downloadable
sheets, and a rulebook. Users open HTML exports and print at 100% / actual
size with browser headers/footers disabled. Duplex sheets use long-edge
flipping; large boards retain their size through labeled overlapping tiles.
Designer notes stay out of the public rulebook. Inventory counts enumerate
physical components once; prototype exports do not certify production files.

The component editor already resolves dimensions, finishes, and pricing
through the integrated catalog API. Keep supplier sizes and bleed/safe-zone
requirements visible when designing physical components. Checkout,
production files, order submission, and fulfillment are future work.

The API contract is documented in
[third-party-catalog-pricing-api.md](./third-party-catalog-pricing-api.md).
The running supplier service lives inside `apps/catalog-api`; the editor
continues to use its HTTP `/v1` boundary.

## 7. Longer-term engine and economy work

The broader engine design in [docs/future/](../docs/future/) remains useful
for extending executable game coverage and hosted play:

- `docs/future/engine/` describes state models, actions, triggers, legal moves,
  rules authoring, visibility, and AI-player contracts.
- `docs/future/adr/0002-*` and `0003-*` cover engine-first authoring and
  override policy. The current constrained lab is not an implementation of
  every proposed engine feature.
- Listings, purchases, entitlements, multiplayer routes, and related
  migrations are retained foundations. They are not the product's primary
  navigation or a completed commerce flow.

Keep authored components addressable and retain source card rows and stable
identities so later runtime adapters can reuse a design without re-authoring.
Do not infer executable behavior from unstructured prose silently.

## 8. UI standards

See [goldenrules.md](./goldenrules.md) — it is the source of truth for:

- Locked page zoom, no document scroll outside the landing page.
- Component editor as a static desktop workbench with warm oak tabletop.
- Cozy magical forest aesthetic.
- File length ≤ 600 lines.
- Label every layout div with `data-layout` + comment.
- Use Playwright MCP to verify UI changes.

Do not duplicate these rules into other docs.

## Doc inventory

**Current workshop references:**

- [.agents/goal.md](./goal.md) — product direction.
- [.agents/goldenrules.md](./goldenrules.md) — coding + UI rules
  (single source of truth, no duplicates elsewhere).
- [.agents/third-party-catalog-pricing-api.md](./third-party-catalog-pricing-api.md)
  — supplier API contract for the physical order flow.
- [docs/adr/0001-monorepo-engine-boundaries.md](../docs/adr/0001-monorepo-engine-boundaries.md)
  — package boundaries + import rules.
- [docs/adr/0004-web-editor-composition.md](../docs/adr/0004-web-editor-composition.md)
  — historical editor staging; the current guest creation path above supersedes its AI-first entry flow.
- [apps/web/README.md](../apps/web/README.md) — editor structure.
- [TO_DO.md](../TO_DO.md) — active component-editor backlog.
- [docs/human-todo.md](../docs/human-todo.md) — pre-launch operational
  checklist; not current editor code scope but relevant near launch.

**Parked for future milestones — see [docs/future/](../docs/future/):**

- `docs/future/engine/` (14 files) — engine runtime, state model,
  rules, triggers, AI player contract, etc. (M2).
- `docs/future/adr/0002-engine-first-creator-paradigm.md` and
  `0003-engine-override-policy.md` (M2 engine architecture decisions).
- `docs/future/examples/sample-games.md` (M2 reference games).
- `docs/future/ai/aider-openrouter-workspace-plan.md` (future AI worker
  architecture).

AI grounding in `ai.ts` and `capabilities.ts` still references the broader
engine docs. Preserve useful context, but distinguish generated design
material from executable behavior actually implemented in the current lab.

## Validation

From the repository root:

- `npm run test:workshop` — Node/tsx tests for tables, editable template
  documents/rendering, component adapters, actual-size/duplex/tiled printing,
  deterministic simulations, replay, and agent packets.
- `npm run test:versions` — Vitest with fake IndexedDB for live-draft storage,
  checkpoint ancestry, restore/branch behavior, archives, image deduplication,
  every component family's authored documents, legacy migration, and independent
  component duplication/removal.
- `npm run typecheck` — all workspace TypeScript checks.
- `npm run test:rules:api` — authenticated rules requests, model/capability
  alignment, prompt weighting, and mocked provider/usage/error paths.
- `npm run test:rules:browser` — catalog edits, icon sync, AI draft controls,
  undo, delayed replies across edits/restores, and safe Settings return. It
  mocks AI/catalog responses and uses an isolated CDP context; artifacts default
  to `/tmp/turnbased-rules-fixes` (`RULES_FIXES_ARTIFACT_DIR` overrides it).
- `npm run test:workshop:browser` runs the general workshop smoke in an
  isolated CDP browser context.
- `npm run test:components:browser` is the dedicated
  [shared template browser check](../scripts/check-component-templates-browser.mjs):
  all six families, pointer editing, row bindings, faces, template/SVG/print
  downloads, reloads, and checkpoint restore. Defaults: app port 3000, CDP
  port 9223, artifacts `/tmp/turnbased-component-templates`. Overrides:
  `CODEX_BROWSER_URL`, `CODEX_BROWSER_CDP_URL`, `PLAYWRIGHT_MODULE_PATH`,
  `COMPONENT_TEMPLATE_ARTIFACT_DIR`. Keep validation logs in `logs/`.
