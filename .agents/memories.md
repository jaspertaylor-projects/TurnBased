# TurnBased Agent Memories

Shared persistent notes for any AI agent working on this repo (Claude, Codex,
Gemini, etc.). These are point-in-time observations about *how the user wants
work done* and *why* — they survive across conversations.

Companion to [goal.md](./goal.md), [goldenrules.md](./goldenrules.md), and
[architecture.md](./architecture.md). If something here contradicts goldenrules
or architecture, those win; this file is preferences + lessons, not spec.

---

## Feedback / collaboration preferences

### UI div naming rule

Every layout div in JSX must have a descriptive `data-layout` attribute and a
preceding comment explaining its purpose.

- **Why:** the user found it difficult to debug layout issues when divs were
  anonymous. Named divs make the DOM inspectable and the code self-documenting.
- **How to apply:** when writing or editing JSX layout containers, always add:
  1. A `data-layout="descriptiveName"` attribute (camelCase — e.g.
     `canvasColumn`, `inspectorScrollArea`).
  2. A comment above the element explaining what it contains and how it sizes
     (e.g. *"fills entire left column edge-to-edge, no padding"*).
- Applies to structural / layout divs, not small inline elements like buttons
  or spans.

### No hidden AI controls

Do NOT embed taste filters or style blocklists inside AI prompts (system
prompts, mode instructions, etc.). Every constraint the user fights should be
exposed in the UI as a control they can change.

- **Why:** during the brainstorm-weight fix on 2026-05-25, an
  "avoid dark-fantasy compound construction" guidance line plus a hard-coded
  blocklist of forbidden prefixes (Grim-, Ash-, Shadow-, Night-, …) got added
  on top of an existing "avoid fantasy / gothic / mythic" line. The user
  pushed back: they don't want hidden style controls the user is fighting
  against — the sliders and chips in the UI are the *real* controls.
- **How to apply:** when wiring an AI feature with UI controls (sliders,
  toggles, chips), make those controls fully load-bearing — change what gets
  sent to the model based on them. Don't add unconditional taste guidance that
  fights against or overrides those user-visible controls. Plumbing
  instructions (*"return JSON only", "be concise", "interpret prompts
  faithfully"*) are fine; opinionated style filters that the user can't see or
  override from the UI are not. If you find yourself writing *"avoid X unless
  Y"*, that's the smell — either expose the toggle in the UI or drop the rule.

### OpenRouter image generation shape

- **Why:** the Art tab image generator was originally a mock and needed the
  current OpenRouter image response contract.
- **How to apply:** `ai-image-agent` should call OpenRouter chat completions
  with `modalities`, then read generated images from
  `choices[0].message.images[0].image_url.url`. OpenRouter returns image
  outputs as base64 data URLs, so the Art tab stores an `imageDataUrl` on its
  local `EditorImageAsset` for immediate preview while the backend asset row
  records metadata and ledger usage.

### Version map layout is a framed surface

- **Why:** the branching version map became visually messy when the header,
  active commit card, New Version button, nodes, and meeple were all absolute
  overlays inside the same canvas.
- **How to apply:** keep `VersionsSection` as a header / scrollable map body /
  footer frame. Put branch lanes, paths, commit nodes, and the favicon meeple
  inside the scrollable canvas only; keep status and actions in the pinned
  frame regions so they do not cover map spaces.

### Version map is a fantasy adventure map

- **Why:** the user wants the versions tab to *feel* like travelling through a
  fantasy map, not a flat git graph. Each commit is a "camp" location, each
  branch is a "trail", saving plants a new camp, and the favicon meeple is the
  traveller you drag from camp to camp to restore a version.
- **How to apply:** the static terrain (hills, pine/round trees, a lake,
  meadow flowers, a compass rose) lives in
  `apps/web/src/editor/sections/versions/MapDecorations.tsx` as a purely
  decorative `FantasyMapDecorations` SVG layer (aria-hidden, no pointer
  events). Scenery placement must be deterministic — seed from the element
  index with a `Math.sin` hash, never `Math.random`, so the map does not
  jitter on re-render when the meeple moves. `VersionsSection` draws winding
  layered-stroke dirt trails (dark underlay + tan surface + dashed cream
  centreline) between camp markers, renders camps as numbered map-pin
  medallions on parchment plaques, names trails with wooden signposts at the
  trailhead, and stands the meeple on the active camp. Keep the cozy-forest +
  aged-parchment palette (greens, tans, `#5b3a16`/`#7c5a3a` ink, `#b45309`
  accents).

### Sidebar version control is a dropdown switcher (no + button)

- **Why:** the user wanted the game-name/version area cleaned up — the branch
  icon should switch versions, and the standalone "+" new-version button was
  redundant.
- **How to apply:** in `EditorSidebar`, the version line is a single pill
  (`data-layout="editorVersionSwitcher"`: branch icon + active version name +
  chevron) that toggles a dropdown (`editorVersionMenu`) listing every saved
  version (branch); selecting one calls `onSwitchVersion`, which restores that
  branch's head commit (`handleSwitchVersion` in `Editor.tsx`, computed from
  per-branch head SHAs). The "New version" action lives at the bottom of that
  dropdown. Do **not** re-add a separate "+" button next to the version label.

### Editor "Notice" status lives in the sidebar header

- **Why:** the transient save/error notice used to float over the editor
  canvas (a centered panel), which covered content. The user asked for it to
  be a small tucked-away area instead.
- **How to apply:** `editorNotice` is passed from `Editor.tsx` into
  `EditorSidebar` as `notice` + `onDismissNotice`. The sidebar renders it as a
  small dismissible chip (`data-layout="editorNoticeChip"`) under the project
  header. Do **not** re-add floating notice panels in the editor viewport.

---

## Tooling references

### Playwright MCP runs `--isolated`

On 2026-05-25 every Playwright MCP entry in `~/.claude.json` (root `mcpServers`
and each per-project section under `projects.<path>.mcpServers`) was given the
`--isolated` flag so Claude sessions and Codex never lock each other out of
the same Chrome user-data-dir.

- **Why:** Codex and Claude both wanted to drive Playwright; the default
  shared persistent profile at `~/.cache/ms-playwright/mcp-chrome-<hash>` caused
  "Browser is already in use" failures whenever a second session started.
- **How to apply:**
  - Each Playwright MCP session now starts with a fresh ephemeral browser
    context — no persisted sign-in. If a test needs auth, log in at the start
    of the session (local dev account is `dev@turnbased.local` /
    `dev-local-only`, seeded per the README).
  - Codex's headed Chrome stays separate at
    `.playwright-codex/chrome-profile` (launched by
    `scripts/codex-headed-browser.mjs`) and keeps its persistent login —
    that's intentional, see the README "Codex headed browser" section.
  - If MCP starts conflicting again, confirm every `playwright` entry under
    `~/.claude.json` still has `--isolated` in its args list. A backup of the
    pre-change config lives at `~/.claude.json.bak-20260525-163425`.

### Codex headed browser workflow

For TurnBased UI work, Codex should prefer the repo's headed-browser scripts
over one-off Playwright snippets.

- **Why:** the user wants Codex to be able to see and operate a visible browser
  with fewer repeated approval prompts. A previous ad-hoc `node -e` Playwright
  command worked technically but could not get a reusable approval rule, which
  made the workflow noisy and brittle.
- **How to apply:**
  - Keep the app running locally, usually at `http://127.0.0.1:3000`.
  - Launch or reuse the visible persistent Chrome with:
    `node scripts/codex-headed-browser.mjs`
  - For read-only checks, use:
    `node scripts/codex-browser-inspect.mjs <url-or-hash>`
    `node scripts/codex-browser-screenshot.mjs <url-or-hash> <name.png>`
  - For simple browser interactions, use the approved stable helper:
    `node scripts/codex-browser-action.mjs <action> ...`
    Examples: `create-project`, `open '#/settings'`, `click-text`, and
    `fill-label`.
  - Do not fall back to ad-hoc `node -e` Playwright automation unless the
    helper genuinely cannot express the needed action. If the helper is
    missing a common action, extend `scripts/codex-browser-action.mjs` and ask
    for approval on that stable script prefix instead.
  - The local dev login is `dev@turnbased.local` / `dev-local-only`; the
    persistent Codex profile lives under `.playwright-codex/chrome-profile`.

### Editor reloads the saved working draft; checkpoints restore explicitly

- **Why:** earlier editor builds restored a checkpoint on reload. That behavior
  is obsolete: a designer's latest autosaved working draft must survive
  independently of the selected historical checkpoint.
- **How to apply:** set up browser fixtures through `saveEditorProject` before
  loading the editor, or use the real UI. Do not write raw localStorage project
  bodies: its project list now contains small pointers to IndexedDB snapshots.
  Vite serves the app factories for test setup (`/src/editor/project.ts`,
  `/src/editor/storage.ts`, and `/src/editor/componentStudio/model.ts`).
- Components opens the shared template workbench. Use its **Placement** action
  to reach the existing Konva board/interactive-child editor. Printed template
  grids and tracks do not automatically create playable spaces.

### Board image + text components have dedicated inspectors

The board's `image-area` and `text-box` leaves use dedicated inspectors
(`editor/components/ImageInspector.tsx`, `TextBoxInspector.tsx`) wired into
`BoardItemInspector`, not the generic property grid. Image styling is resolved
through the shared `editor/components/imageAreaStyle.ts` so the canvas render and
inspector preview match. Image sources are upload/drop/paste + Art library + AI
generate (deliberately no raw-URL field). The Konva surface draws 8-point
selection handles (`RESIZE_HANDLE_SPECS`); arrows nudge, Alt+arrows resize, Shift
on a corner locks aspect. See `.agents/architecture.md` §4 for the full map.

### Editor sidebar is a collapsible drawer

The editor's left sidebar (`editor/components/EditorSidebar.tsx`) is a drawer.
`pages/Editor.tsx` owns the open/closed state (`isSidebarOpen`, persisted to
`localStorage['turnbased.editor.sidebarOpen']`). Closing it animates the shell's
first grid column from `232px` → `0px` while the panel itself slides left via
`transform: translateX(-100%)` — both share the same `0.28s ease`, so the canvas
reclaims the space in lockstep with the slide. The panel lives inside a
`data-layout="editorSidebarDrawer"` clipping box (`overflow:hidden`) and, when
closed, gets `pointer-events:none` + `aria-hidden`. The control is a full-height
"drawer-pull" rail (`data-layout="editorSidebarToggle"`, `RAIL_WIDTH` 20px,
beefy chevron `strokeWidth 3.25`) flush on the panel's **interior right edge**
(`left: SIDEBAR_WIDTH - RAIL_WIDTH` when open), sliding to the far-left edge
(`left: 0`) when closed — `ChevronLeft` to collapse, `ChevronRight` to open. Its
free (exposed) edge is rounded (`RAIL_RADIUS`): interior/left corners when open,
canvas/right corners when docked closed. Two-tone = **solid fill + contrasting
border & chevron** (NOT a split gradient — a split was explicitly rejected):
brown fill `RAIL_BROWN` #3b2412 (the rulebook ink brown) with a green border +
chevron `RAIL_GREEN` #3f9168 (tabletop.forest.bright) at rest; fill and accent
swap on hover. Both tones are drawn from the existing on-screen palette. The
panel reserves a right-padding gutter (`1.4rem`) so its content (esp. the save
button) clears the rail. To add a new sidebar section, edit
`EditorSidebar`/`SECTION_OPTIONS`, not the drawer plumbing.

### One shared catalog selector drives all component-selection surfaces

`editor/sections/visuals/CatalogSelector.tsx` is the single thing → size →
finish picker. It is hosted in three places: the component-editor inspector
(`CatalogPicker.tsx`), the rulebook "Add catalog item" picker
(`rules/ComponentPicker.tsx`), and the "New component" dialog
(`rules/NewComponentDialog.tsx`). Change the selector once and all three update.
The catalog API (`/v1/products`) returns `imageUrl` (absolute supplier-CDN URL,
may be null) on each product; `CatalogSelector` renders it via the shared
`CatalogPreviewImage` once a product/slug is picked, so every surface shows the
supplier preview for free. The thumbnail border just hugs the image and clicking
it opens an enlarged lightbox (`data-layout="catalogPreviewLightbox"`, z-index
500 to clear the dialogs, Esc/click to close). Images load directly from the CDN
through the `<img>` (not the `/v1` proxy), and the component hides itself on
missing/`null`/broken images, so the selection flow never depends on the artwork.

`CatalogSelector` owns the per-category product fetch (was in each leaf picker)
so it can render a **"Show components from" site/supplier multi-select**
(`data-layout="catalogSiteFilter"`, `SiteFilter` + `extractSites`/`siteLabel`).
Sites come from `product.supplierId` + a label derived from `sourceUrl` host
(`KNOWN_SITE_NAMES` maps boardgamesmaker.com→BoardGamesMaker,
thegamecrafter.com→The Game Crafter). State is `selectedSites: string[] | null`
where **null = all (default)**, `[]` = none, explicit = subset; it collapses
back to null when all are re-picked, and filtering is bypassed when a category
has ≤1 site so a stale selection can't blank a single-supplier genre. The leaf
pickers (Tile/Board/Deck) now receive `products/loading/error` as props.

`fetchCatalogProducts` (`supplierCatalog.ts`) **pages through all results** —
it previously hardcoded `pageSize=50` and silently dropped products once a
category passed 50 (cards is already 51), which also hid any newly-added
supplier's items. As of 2026-06, the live catalog API on :3100 contains only ONE
supplier (boardgamesmaker, `1f2022af…`, 77 products); adding a supplier is a
job on that separate third-party service (not this repo) — check
`/v1/admin/scrape-runs`.

### Version history + images live in IndexedDB, not localStorage

Never persist bulky editor data (version commits, workspace file maps, base64
image data URLs) in localStorage — its ~5MB origin quota is what caused the
2026-07 `QuotaExceededError` on `turnbased.creator.git`.

- **Why:** the legacy layout stored every commit of every project (each with a
  full file map AND a full `projectSnapshot`) under one localStorage key. One
  AI-generated image (~0.5–2MB base64) was serialized into every commit twice;
  three saves blew the quota.
- **How to apply:** the persistence layer is `apps/web/src/editor/persistence/`
  (`idb.ts` thin IDB wrapper, `blobStore.ts` content-addressed sha-256 blobs,
  `imageBlobs.ts` data-URL deflate/inflate, `migrate.ts` one-time legacy
  migration, `records.ts` stored shapes). Rules:
  1. Commits store `fileHashes` (path → sha-256), never file contents, and NO
     `projectSnapshot` — restores parse the committed `turnbased.project.json`
     blob.
  2. Any serialized project at rest has large `data:` URLs replaced by
     `idb-image://<sha256>` refs (`deflateProjectImages`); loads always
     `inflateProjectImages` so in-memory projects carry real data URLs.
     In-memory projects must never be persisted or sent anywhere without
     deciding deflated-vs-inflated deliberately (remote git-proxy payloads are
     re-inflated so Supabase stays self-contained).
  3. `git.ts`, `workspace.ts`, `storage.ts` APIs are all async now —
     `Editor.tsx` holds `gitStatus`/`versionGraph` in state fed by an effect,
     refreshed via `versionsRefreshKey` after save/restore/switch actions.
  4. After a successful remote sync a commit is marked `synced`. Checkpoints
     are retained; do not reintroduce the former 50-checkpoint pruning or
     uncoordinated orphan-blob collection.
  5. localStorage keeps ONLY small metadata (`turnbased.creator.projects`
     v2 pointer index, UI prefs). Full live snapshots belong in IndexedDB,
     including component rows and nested template artwork.

---

## Maintenance

- Claude Code mirrors this file from its private `~/.claude/projects/.../memory/`
  store. When Claude saves a new memory, it should add a corresponding entry
  here so non-Claude agents can read it.
- Other agents (Codex, Gemini, etc.) — if you learn something about the user's
  preferences that future agents would benefit from, append it under
  "Feedback / collaboration preferences" with a **Why** and **How to apply**.
- Keep entries short and actionable. If an entry stops being true, edit or
  delete it rather than letting it rot.


## 2026-09-07 — Catalog API moved into the monorepo

- `apps/catalog-api` is the imported NestJS/Prisma/BullMQ supplier service.
  Root npm workspaces and `package-lock.json` manage its dependencies. Node
  22.12+ is required; the Supabase CLI is pinned as a root dev dependency.
- `npm run dev` and `npm run dev:local` now supervise catalog Postgres/Redis,
  migrations, supplier seeding, the API, Supabase edge functions, and Vite.
  `npm run dev:catalog` starts just the catalog stack. Logs live in `logs/`.
  Ctrl+C stops child process groups; `npm run dev:stop` then stops containers.
- Root `compose.yml` uses ports 54328/6380 and separate persistent catalog
  volumes. `CATALOG_PORT`, `CATALOG_DB_PORT`, `CATALOG_REDIS_PORT` root env
  overrides stay in sync with the API and Vite proxy. `RESET_DB=1` only resets
  Supabase. Local startup always uses local catalog connections.
- Copied 3,058 products and the full original DB into the monorepo volume,
  preserving IDs. The old directory/DB volume remain as a rollback copy,
  with no runtime dependency on them. Supplier credentials are in ignored
  `apps/catalog-api/.env`; a DB backup is in ignored `logs/`. Redis starts
  fresh. New machines must explicitly refresh suppliers to populate products.
- `npm run test:dev` checks env setup, port coordination, readiness, secret
  capture, and watcher cleanup. `npm run test:catalog` exercises the running
  API. API build, all-workspace typecheck, and web build pass. The imported
  API still has pre-existing ESLint/Prettier violations; migration did not
  reformat or rewrite its supplier/quote behavior.
- Updated VersionsSection useSurfaceSize return type to include nullable
  refs, fixing the existing React 19 typecheck error exposed during validation.


## 2026-09-07 — Workshop vision, guest creation, and reliable iteration

- **Why:** the user wants a convenient home for amateur designers to make,
  playtest, revise, and eventually print games. They explicitly prioritized
  versioning, agent-compatible playtesting, and attractive decks generated
  from tables. This supersedes older milestone exclusions of AI players or
  legal-move work; commerce remains future scope.
- **How to apply:** make workshop/new-game entry primary. `#/new` now creates a
  local game plus a first checkpoint without auth/AI; `#/new/guided` preserves
  the older AI form. Little Woodland supplies five rule chapters, four card
  designs / ten cards, and matching market-race lab settings. Use the public
  async storage APIs and UI creation paths in browser checks.
- `EditorProject.cardStudio` and `.playtestLab` belong to the design snapshot:
  autosave, undo, checkpoints, safety restores, comparisons, and archives must
  include them. Card rows and generated copy references keep identities;
  embedded artwork must not be duplicated for every physical copy.
- **Storage correction:** earlier notes that the editor restores a checkpoint
  on every reload, stores inline deflated projects in localStorage, or prunes
  synced checkpoints after 50 are obsolete. Load the saved working draft.
  localStorage `turnbased.creator.projects` is now a small v2 pointer index;
  live snapshots, workspaces, checkpoint files, and images are IndexedDB blobs.
  Old inline projects migrate on their next save. Checkpoints are retained.
- Restore creates a safety checkpoint when the draft is dirty. New checkpoints
  preserve parent links and existing forward history; designers can name
  experiment branches explicitly. Archives preserve ancestry and embedded artwork
  once; imports create a new game. Current archive bounds are 100 MB / 2,000
  checkpoints and are validated without silently trimming saved history.
- Orphan-blob GC is deliberately not called by delete/history maintenance.
  Future compaction must serialize with saves and include live snapshot,
  workspace, checkpoint, and nested-image roots. A collector that races a
  live write can delete the new snapshot before its index is published.
- **Scope honesty:** the lab currently executes `market-race-v1` for two seats
  with seeded balanced/greedy/random heuristic agents. Prose/card powers are
  reference material, not executable rules. Public JSON packets expose state
  and legal actions; replies validate action IDs and expected step. There is
  no built-in LLM runner for arbitrary games.
- Prototype printing now supports all component families, optional bleed,
  shaped cut guides, face selection, aligned duplex backs, and tiled boards.
  Browser printing uses 100% scale and long-edge flipping for duplex. Supplier
  production-file validation, checkout, and fulfillment remain future work.
  Linked URL artwork requires its source; uploaded artwork travels with files.
- Checks: `npm run test:workshop` (Node domain tests), `npm run test:versions`
  (Vitest/fake IndexedDB), and `npm run typecheck`. Use Playwright for the
  guest/sample workflow and verify bounded non-landing surfaces at desktop,
  tablet, and phone widths. Keep logs under `logs/`.


## Workshop verification — September 2026

- Before the unified-template expansion, 20 Card Studio / Playtest Lab domain
  tests and 27 IndexedDB/version/archive tests passed. That browser smoke
  covered safety restore, valid/invalid agent moves, 20-game batches, findings,
  printable downloads, full-history import, reload persistence, and bounded
  desktop layouts. Its print proof used 10 cards across 2 A4 pages. See the
  unified Components entry below for the newer verification scope.
- `npm run test:workshop:browser` uses an isolated context in the dedicated
  CDP browser; screenshots/downloads default to `/tmp/turnbased-workshop-smoke`.
- Version comparisons use canonical key ordering; serialization order must
  never be reported as a design edit. Archive v2 preserves the active head
  independently of the current working draft. Failed restores validate
  executable snapshots and artwork before moving workspace/head pointers.
- The original workshop commit left five pre-existing type diagnostics in
  committed source while the working tree contained the user's fixes. Those
  remaining fixes were subsequently authorized for integration; see the
  September 2026 rulebook integration entry below for current status.


## Local development sign-in

- The sign-in form offers **Use local dev account** only for Vite development
  with both app and Supabase on loopback hosts. The JSX also has an explicit
  `import.meta.env.DEV` guard so production builds omit its handler/credentials.
- Anonymous sessions may enter the sign-in form; only regular authenticated
  users redirect to the workshop. **Continue without signing in** opens the
  local workshop directly. Supabase anonymous auth is disabled locally and
  is unnecessary for local project editing.
- Verified the existing seeded account via the real browser, sign-in state
  after reload, guest continuation, web production build, and Auth ESLint.
  No database reset or account reseeding was needed. Logs: `logs/dev-sign-in-*`.

## September 2026 — Components owns every editable template

- **Product contract:** Components is the shared workspace for cards, boards,
  tokens, tiles, player mats, and pieces; Card Studio belongs inside each deck.
  Presets become fully editable text, image, shape, grid, and track layers.
  Printed grids/tracks remain artwork; Placement authors interactive board
  structures and relationships separately.
- **Canonical state:** `EditorProject.componentDesigns` maps physical instance
  IDs to studio data. Use `listProjectDesignSets` for inventory, counts,
  comparisons, exports, and playtests. Legacy `project.cardStudio` appears once
  as `legacy-card-studio`; opening it materializes a physical deck and removes
  the legacy field while preserving row IDs, quantities, artwork, and history.
  Old standalone root cards remain editable under their physical IDs; their
  duplicates become valid deck roots. Lab fallback material must exclude both
  represented physical IDs and represented deck-child IDs to avoid duplicates.
- **Shared authoring:** `templateStudio/TemplateEditor` edits faces, layer
  ordering, visibility/locks, geometry, typography, image fit, shapes, grids,
  tracks, bindings, and print guides. Coordinates use millimeters; font sizes
  use points. Explicit `{{field}}` substitutions preview selected table rows.
  Canvas gestures, keyboard actions, undo/redo, alignment/distribution, and
  reusable template JSONs share the same document model. Native modal dialogs
  contain keyboard focus, support Escape, and protect background controls.
- **Physical dimensions:** new components use their family's native preset
  dimensions. Existing supplier-sized components proportionally scale starter
  artwork into the preserved physical dimensions; do not apply card-size
  limits to boards, mats, or tokens. Template edits synchronize physical
  instance dimensions and clear an incompatible supplier match. Normalization
  runs after embedded artwork hydration.
- **Rendering:** `renderDesignSvg` drives previews and exports; give each inline
  copy a unique `idPrefix`. Text uses conservative family-aware wrapping and
  shrink-to-fit estimates, including wide glyphs and stroke/italic insets.
  SVG text honors fill, stroke, and stroke width; clipping remains explicit.
  Keep deterministic rendering independent of browser font measurement.
- **Async edits:** artwork reads resolve the current target by identity, patch
  the latest state, and invalidate pending requests on unmount or target
  changes. Never apply a captured whole-project updater after switching a
  component/layer or restoring a version.
- **Exports:** all-family sheets use actual millimeters, shaped trim guides,
  optional bleed, selectable faces, and duplex back placement mirrored across
  the page for long-edge printing, including partial sheets. Large boards tile
  with 10 mm overlap and coordinate labels. Embedded artwork is reused across
  copies. Rulebooks, shipping workspaces, archives, and agent packets consume
  the shared design inventory; existing lab runs retain frozen definitions.

### Verified completion

- `npm run test:workshop`: **57 domain tests passed**, covering tables,
  template documents/rendering/text, editor actions, physical components,
  adapter quantities, print layout, deterministic simulations, and agent
  packets. `npm run test:versions`: **30 persistence/archive tests passed**.
  Every family's authored layers, faces, data, artwork, and physical dimensions
  survive saves, checkpoints, and a fresh-browser archive import. Coverage
  includes single legacy migration, independent duplication/removal, standalone
  cards counted once, and a 420×297 mm board retaining its true print size.
- `npm run build` passed for both the catalog API and web app. The web build
  retains its existing large-chunk warning. Scoped ESLint passed for all source
  changed by that task. Its staged-only check still needed five pre-existing
  fixes (AI brief fields, catalog callbacks, icon callback types). Those fixes
  are now integrated in the subsequent rulebook update below. Historical logs:
  `logs/components-head-source-check.log` and
  `logs/components-staged-source-check.log`.
- `npm run test:workshop:browser` passed: canonical overview counts and
  Components navigation, safety checkpoint restore, card persistence,
  accepted/rejected agent moves, 20 simulations, findings, component/rulebook
  downloads, full-history archive import, reload, bounded layout, and no page
  errors. Artifacts: `/tmp/turnbased-workshop-smoke`.
- `npm run test:components:browser` passed on the final implementation:
  pointer movement, resize, rotation and rotated resize; layer actions and
  undo; live table bindings; face artwork; template JSON/SVG/print downloads;
  exact reload/checkpoint restore; and all six component families. Native
  dialog Ctrl-Z/Delete/Escape/Tab behavior, wide-glyph SVG text bounds, and
  fitted canvases without scrollbars passed. Canvases and footers remain
  bounded at 1600×1000 with no app errors. Artifacts:
  `/tmp/turnbased-component-templates`.
- Dedicated Chrome print checks confirmed four duplex pages, a 400×400 mm
  board across six A4 pages, physical dimensions, and embedded image reuse.
  Prototype files are distinct from supplier-approved production files.
- Repeatable browser sources are
  [check-workshop-browser.mjs](../scripts/check-workshop-browser.mjs) and
  [check-component-templates-browser.mjs](../scripts/check-component-templates-browser.mjs).
  Both use isolated CDP contexts. Defaults: app port 3000, CDP port 9223.
  Override `CODEX_BROWSER_URL`, `CODEX_BROWSER_CDP_URL`, or
  `PLAYWRIGHT_MODULE_PATH`; artifact overrides are `WORKSHOP_ARTIFACT_DIR`
  and `COMPONENT_TEMPLATE_ARTIFACT_DIR`, respectively.


## September 2026 — Remaining rulebook fixes integrated

- The user authorized integrating the previously preserved rulebook, AI, and
  Settings edits. Required brief fields and catalog/icon callback types now
  belong to committed source; do not preserve the old five-error baseline.
- Rules uses the shared catalog picker for adding and updating physical
  components. Supplier updates keep the instance ID, rows, and layers while
  resizing stored template dimensions to the selected physical size. Changing
  component families during a supplier update is rejected.
- Art Studio and Iconography edit the same icon descriptions. Printable
  rulebooks include structured iconography alongside authored prose. The
  Glossary migration only converts an empty legacy default placeholder;
  authored Glossary text and explicitly standard chapters remain editable.
- AI drafts persist per project in localStorage: prompt, model, mode, weights,
  selected tags, and temperature. Validate saved values and tolerate blocked
  or corrupt storage. Deselected art styles must not leak their descriptions
  into the request context.
- Rules AI uses a request generation and the latest rules updater. Ignore
  replies after closing, changing targets, leaving Rules, or restoring a
  checkpoint; reject a reply when its target body changed during generation.
  RulesSection is keyed by project/restore epoch so restoring an identical
  target body still invalidates pending work. AI undo is cleared by manual
  edits and restore/unmount boundaries.
- Model IDs/capabilities were checked against OpenRouter's public catalog on
  2026-09-08. Browser/backend choices and defaults are covered together. The
  backend validates supported or server-configured models, preserves disabled
  catalog entries, rejects anonymous auth, and omits unsupported temperature.
  Settings displays recorded ledger costs; the preference list is not a
  historical price source. Provider calls are mocked in regression tests.
- Settings Close uses an observed app route, with My workshop as the fallback
  after direct visits/reloads. Browser history may lead outside the app and
  must not determine this button's destination.
- Project component mutations live in projectComponents.ts and share the
  small projectUpdates.ts helper; project.ts retains its public exports.
  Rulebook normalization lives in rulebookStorage.ts; AI runtime controls and
  floating position are separate hooks. Keep changed source files under 600
  lines rather than growing project.ts or the edge entrypoint again.
- Repeatable checks: test:workshop, test:versions, test:rules:api, typecheck,
  build, and scoped lint. test:rules:browser covers catalog changes, icon sync,
  AI persistence/undo/concurrent edits/restore, and Settings navigation in an
  isolated CDP context. Defaults: app port 3000, CDP port 9223; artifacts in
  /tmp/turnbased-rules-fixes (RULES_FIXES_ARTIFACT_DIR overrides it). Keep logs
  under logs/remaining-fixes-*. No paid AI calls are required for these tests.

### Integration verification

- All 103 automated tests pass: 59 workshop domain, 38 Vitest
  storage/version/rulebook/export, and 6 rules API tests. Full workspace
  typecheck/build and scoped frontend/backend lint pass. Rules and image
  edge entrypoints pass Deno checks. The build retains the existing large
  bundle warning.
- Staged web source passes independently with zero TypeScript diagnostics,
  including all five previously outstanding errors. Log:
  logs/remaining-fixes-staged-source-check.log.
- Rules browser regression, general workshop browser regression, and actual
  printable rulebook download/render all pass with zero page errors. Custom
  SVG previews preserve their configured ink when rendered as isolated images.
- Vitest resolves React from the web workspace and inlines Lucide ESM for
  export rendering; the monorepo root can contain another React version. Use
  createRequire from apps/web/package.json instead of hardcoding dependency
  hoisting locations.

## September 2026 — Moonlit Market recorded walkthrough

- The user requested a real game-creation video and explicitly authorized the
  dev account for AI tooling. The isolated recording made two real paid AI
  requests (rules writer and image agent), both HTTP 200. Do not generalize
  this authorization to unrelated future AI calls.
- Final artifact: `artifacts/demos/moonlit-market/turnbased-game-creation.mp4`,
  332.68 seconds, 1600×1000 / 25 fps H.264, captions and no audio. Selected
  scenes omit operator gaps/failed takes; `recording-original.json` and the
  raw WebM preserve the source. Generated artifacts are ignored by Git.
- The real prototype has six card designs / eighteen copies, shared embedded
  AI artwork, an editable two-face template, authored rules, a 20-game lab
  batch, a finding, and five checkpoints. Its cost experiment was restored
  to the playtest baseline, retaining the alternate in a safety checkpoint.
  Printable HTML/PDF, an agent packet, template JSON, and a portable backup
  are under the demo's `downloads/` directory.
- Recording utilities: `scripts/demo/record-session.mjs` accepts local JSONL
  Playwright commands; `render-walkthrough.py` trims scene boundaries and
  adds a 100px caption band; `check-video.mjs` checks actual Chrome playback,
  seeking, decoded frames, and errors in an isolated process. Workflow docs
  and the CSV fixture live in `docs/demos/`.
- The recorder launches an isolated Chrome with separate browser storage.
  Export the game before closing it. It does not change the designer's CDP
  browser at port 9223. An implicit select label may include its options;
  the CSV Import mode is reliably scoped as dialog.getByRole('combobox').
- NumericInput now forwards aria-label and aria-labelledby. The real browser
  walkthrough verified named age/playtime controls after that correction.
- Checkpoints now commit locally before optional remote synchronization.
  Auth, cloud initialization, and upload share a five-second deadline;
  supported requests are aborted and late responses cannot mutate local
  state. The live UI confirmed bounded completion with an honest remote
  failure notice. The remote git service remained unavailable during the
  recording; local checkpoint, branch, and safety restore worked.
- New cloud project IDs are checkpoint sync metadata, not edits to the saved
  design. Legacy manifest links remain readable. Archive imports deliberately
  detach both cloud link forms so a copied design cannot write to the
  original remote history. See editor/versions/README.md.
- Validation: 44 persistence/version tests, web typecheck and scoped lint
  passed, as did the full monorepo build (existing bundle-size warning).
  Video QA passed beginning/middle/end playback and seek checks with no
  media/page errors or dropped frames. The actual recording had no page
  errors. Build/render/checkpoint logs are under logs/moonlit-market-*.


## September 2026 — AI card data and authored fullscreen playtests

- The user requested whole-column and individual-cell AI editing, a visible
  whole-rulebook generation flow, actual authored cards on the play surface,
  proportional fullscreen, and a second real video. The follow-up continues
  the explicit dev-account AI authorization for this recording.
- The new card-table endpoint uses provider-only r1/r2 aliases and a strict
  values object, then maps validated results to the original row IDs. A live
  attempt with long-ID array edits returned invalid row references; it was
  rejected without changing data or charging the designer. Do not silently
  repair, partially apply, or accept unknown/duplicate/missing row outputs.
- Card AI previews are reviewed before atomic apply. Target-baseline guards,
  cancellation, restore invalidation, and guarded undo preserve newer manual
  edits and unrelated fields. Custom columns use `custom:<key>` internally.
  Accessible prompt label is `AI table instructions`; model is `AI table model`.
- Whole-rulebook drafting changes selected prose bodies only, with exact-ID
  server/client validation. It leaves structured component/icon chapters intact.
  Existing per-chapter assistance remains available. Do not imply this prose
  is an executable arbitrary-game engine.
- New lab runs/batches freeze authored card templates and artwork along with
  numeric rules. Acquired zones, drawn-card backs, inspection and replays use
  those saved visuals. Start a fresh session to adopt subsequent design edits.
  All tabletop pieces share one physical scale; mixed dimensions must retain
  their relative size in normal mode, fullscreen, and viewport resize.
- Native-dialog StrictMode cleanup can queue a close event after reopening.
  Card inspector close handling checks `dialog.open` before dismissing its
  parent. Recorder pointer overlays must move inside open dialogs/fullscreen
  elements to remain visible in the browser top layer.

- Second video: `artifacts/demos/moonlit-market-v2/turnbased-game-creation.mp4`,
  219.44 seconds / 13.2 MB / H.264 1600×1000 at 25 fps, captions and no audio.
  The first video is preserved. Three successful real writing calls (whole
  rulebook, body column, body cell) returned 200; the earlier rejected column
  attempt remains in raw metadata. Artwork/template were reused from video one.
- V2 backup/PDF exports live in its `downloads/`. Fresh UI import and reload
  verified six AI-edited rows, original costs/points/copies, 18 physical cards,
  five prose chapters, artwork/front/back, 2 checkpoints, 1 finding, and frozen
  finished 19-action playtest (11–15, opponent wins). Card print has 18 fronts
  and 18 backs on 6 A4 pages. No paid calls or page errors occurred in verification.
  The designer's persistent browser was left intact; import the backup there
  to continue the recorded game.
- Validation: 68 workshop + 47 version/persistence + 9 rules API + 18 card API
  tests pass, as do full workspace typecheck/build, scoped lint/Deno checks,
  the three isolated feature browser checks, backup import/reload and actual
  MP4 playback/seek/visual QA. Logs use `logs/moonlit-market-v2-*` and
  `logs/ai-card-table-constraints-*`. Local checkpoints worked; remote sync
  remained unavailable within its bounded five-second timeout.
- Match card-table provider constraints to client apply constraints before
  billing: reject blank titles and merged copy totals over 2,000, including
  untouched context rows. Exactly 2,000 is allowed. Invalid paid-provider output
  is audited without returning partial edits or charging the designer.

### September 2026 presentation and release

- The user requested restrained product copy for a professional presentation.
  Keep app headings compact (22–24 px), describe concrete actions, and omit
  oversized slogans. The forest palette remains; the landing page features a
  real AI rulebook recording at `/demo/turnbased-ai-rules.mp4` with poster and
  optional captions. Recording helpers and provenance live in `docs/demos/`.
- The root README is the concise product/engineering entry point. Detailed
  setup, workshop workflow, and checks live in `docs/development.md`,
  `docs/workshop-guide.md`, and `docs/verification.md`. Deployment and rollback
  are documented in `docs/deployment.md`; keep hosted limitations explicit.
- Production web is Cloudflare Pages project `turnbased` at `turnbased.app`,
  connected to `main`. Hosted Supabase is `vwyxnvgpofvayjnltzrf`; its existing
  schema was current at release. AI rule/card/image/project functions and
  `git-proxy` were deployed with JWT verification. `git-proxy` must pass the
  caller's JWT explicitly to `getUser` and check ownership before history I/O.
- The hosted supplier `/v1` gateway is not connected. Vite's local proxy does
  not deploy with Pages. Catalog HTML fallback now reports unavailability;
  custom design and printing remain usable. Catalog admin routes must remain
  private until their authentication boundary is implemented.
- Catalog lint cleanup keeps its rules enabled and preserves exact output for
  82 curated TGC products and BGM/TGC parser fixtures. BGM parsing helpers and
  curated TGC family data have separate modules below the file-size ceiling.
- Generated `node_modules` files were removed from Git tracking; use the
  lockfile and a clean `npm ci`. CI now includes workshop, version, production,
  and mocked AI contract suites plus application builds.
- Isolated browser/test sessions can share the local dev account. Use
  `auth.signOut({ scope: 'local' })` in cleanup: the default global sign-out
  revokes other concurrent sessions and can interrupt a real demo recording.
