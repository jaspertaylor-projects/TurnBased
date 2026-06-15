# TurnBased Architecture

Companion to [goal.md](./goal.md) and [goldenrules.md](./goldenrules.md). This is the
single source of truth for *how the codebase is laid out today* and *which pieces
matter for the current milestone*. If something here contradicts a doc in
`docs/`, this file wins — see "Doc inventory" at the bottom for the cleanup map.

## 1. Scope

The current product milestone is **Milestone 1: board game design + physical
prototype order**. Everything else (online play, marketplace, economy) is
deferred.

Concretely, M1 ships a designer who can:

- Author a board game project (boards, cards, tiles, dice, tokens, tracks,
  decks, etc.) with version history.
- Compose components from a fixed built-in catalog plus templating (decks,
  resource piles) so repeat assets aren't duplicated by hand.
- Get AI help for rule text and art assets.
- See each component priced and validated against the third-party physical
  catalog (bleed zones, sizes, bulk discounts surfaced to the user).
- Place a physical prototype order — the user picks pieces, we handle supplier
  ordering on the backend.

Things explicitly **not** in M1: deterministic engine runtime, legal-move
generation, AI players, multiplayer rooms, ledger, listings, purchases.
These have code stubs in `packages/` and `supabase/` but are not the focus
and should not drive new decisions in the editor.

## 2. Monorepo layout

```
/apps
  /web                       creator dashboard + editor + (stubbed) play shell
/packages
  /engine-components         built-in component catalog + schemas       [M1 ACTIVE]
  /engine-core               reducer, triggers, turn system              [M2]
  /engine-sdk                author-facing rule APIs                     [M2]
  /engine-ui                 interaction affordances                     [M2]
  /engine-ai                 AI player contracts                         [M2]
  /shared-types              cross-package types                         [M1 ACTIVE]
  /shared-utils              zod schemas, IDs, serialization             [M1 ACTIVE]
  /sample-games              reference games                             [M2]
/supabase
  /migrations                auth, projects, ledger, builds, multiplayer,
                             commerce, rate-limits, play-sessions
  /functions                 ai-project-builder, ai-image-agent, assets-manager,
                             build-manager, git-proxy, play-session-token,
                             stripe-webhook
```

**Import rules (from ADR 0001, still in force):**

1. App code may only import public exports of `packages/*`. No deep imports.
2. Engine packages may depend on `shared-types` / `shared-utils` but not on
   app code.
3. `engine-components` is the only engine package that's load-bearing for M1
   — it defines the catalog the editor renders.

## 3. Web app — editor architecture

The creator is split into two stages so the pre-build flow can evolve
independently from the post-build editor:

- **Pre-build:** [apps/web/src/pages/CreateBlankProject.tsx](../apps/web/src/pages/CreateBlankProject.tsx)
  collects game name, player-count range, theme, art style, starter presets,
  and runs `Build with AI`. Until there is a rules brief, there is no
  project. Legacy `#/templates` redirects to `#/new`.
- **Post-build:** [apps/web/src/pages/Editor.tsx](../apps/web/src/pages/Editor.tsx)
  is a thin shell. It owns route parsing, project loading, persistence,
  active-section state, version-history actions, and workspace syncing —
  not rendering.

### Section modules

Every top-level editor surface lives as one file under
[apps/web/src/editor/sections/](../apps/web/src/editor/sections/):

- `VisualsSection` — board appearance, in-canvas placement of spaces /
  tracks / children with drag-drop and resize.
- `ComponentEditorSection` — authoring individual components (the workbench).
- `ComponentGallery` — outline of all components for a project.
- `ArtSection` — AI art workflow.
- `AppLayoutSection` — linked multi-view layout (main board + per-seat
  player views).
- `SettingsSection` — project settings.
- `VersionsSection` — git-style version history.

There is intentionally **no separate `PreviewSection`** anymore — preview
reuses the same board-surface renderer used inside `VisualsSection` so the
authored board corresponds 1:1 with the playable surface (this is what
ADR 0004 calls "one combined edit surface").

### Domain modules (non-React)

[apps/web/src/editor/*.ts](../apps/web/src/editor/) hold logic that must stay
out of view files:

- `project.ts` — project mutation primitives.
- `runtime.ts` — compile authored project → preview runtime state.
- `storage.ts`, `workspace.ts`, `git.ts` — persistence layers.
- `aiBuilder.ts`, `aiBuildService.ts`, `ai.ts` — AI build orchestration.
- `supplierCatalog.ts`, `useSupplierCatalog.ts`, `shipping.ts` — physical
  order pricing + supplier lookup.
- `boardLayout.ts`, `componentMeta.tsx`, `iconography.tsx` — visual
  conventions.

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

## 6. Physical prototype ordering

This is the M1 endpoint that closes the loop with the user. The flow:

1. User authors components in the editor.
2. `useSupplierCatalog` resolves each component against the third-party
   catalog (sizes, bulk pricing, available stock).
3. Inspector surfaces unit price and a "bulk discount" indicator (not a
   full volume table — per [TO_DO.md](../TO_DO.md)).
4. Bleed zone, dimensions, and product-fixed sizing are visualized in the
   editor canvas so the user sees what will be printed.
5. Shipping math lives in `shipping.ts`.

The third-party catalog API contract belongs in
[`.agents/third-party-catalog-pricing-api.md`](./third-party-catalog-pricing-api.md)
— that file is currently empty and is the single highest-leverage doc gap
for M1.

## 7. Deferred milestones

When work eventually starts on these, the parked docs in
[docs/future/](../docs/future/) become relevant again:

- **M2 — online play engine:** `docs/future/engine/architecture.md`,
  `state-model.md`, `action-grammar.md`, `triggers-and-priority.md`,
  `turn-system.md`, `legal-move-generation.md`,
  `ui-interaction-contract.md`, `rules-authoring.md`,
  `extension-points.md`, plus `docs/future/adr/0002-*` and
  `docs/future/adr/0003-*`.
- **M2 — AI players:** `docs/future/engine/ai-player-contract.md`,
  `agent-engine-api.md`, `packages/engine-ai/`.
- **M3 — economy:** Supabase tables `listings`, `purchases`, `entitlements`
  exist in migrations but have no UI yet.

Constraint that bleeds back into M1: every authored component must remain
addressable as a runtime entity so it can be lifted into M2's playable
runtime without re-authoring. The template/quantity pattern in
`engine-components` is the load-bearing piece here — don't bypass it.

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

**Load-bearing for M1:**

- [.agents/goal.md](./goal.md) — product direction.
- [.agents/goldenrules.md](./goldenrules.md) — coding + UI rules
  (single source of truth, no duplicates elsewhere).
- [.agents/third-party-catalog-pricing-api.md](./third-party-catalog-pricing-api.md)
  — supplier API contract for the physical order flow.
- [docs/adr/0001-monorepo-engine-boundaries.md](../docs/adr/0001-monorepo-engine-boundaries.md)
  — package boundaries + import rules.
- [docs/adr/0004-web-editor-composition.md](../docs/adr/0004-web-editor-composition.md)
  — editor staging.
- [apps/web/README.md](../apps/web/README.md) — editor structure.
- [TO_DO.md](../TO_DO.md) — active component-editor backlog.
- [docs/human-todo.md](../docs/human-todo.md) — pre-launch operational
  checklist; not M1 code scope but relevant near launch.

**Parked for future milestones — see [docs/future/](../docs/future/):**

- `docs/future/engine/` (14 files) — engine runtime, state model,
  rules, triggers, AI player contract, etc. (M2).
- `docs/future/adr/0002-engine-first-creator-paradigm.md` and
  `0003-engine-override-policy.md` (M2 engine architecture decisions).
- `docs/future/examples/sample-games.md` (M2 reference games).
- `docs/future/ai/aider-openrouter-workspace-plan.md` (future AI worker
  architecture).

Note: `apps/web/src/editor/ai.ts` and `capabilities.ts` cite
`docs/future/engine/*` and `docs/future/adr/0003-*` as AI grounding.
M1 builds still ground the AI in these engine docs because the editor
expects authored projects to remain runtime-addressable for M2. That
grounding is fine to keep, but if it ever drifts the project off-scope
(generating engine rules that don't matter for M1), revisit which
citations are passed to the AI.
