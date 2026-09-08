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

### Editor restores the committed version snapshot, not raw localStorage

When verifying the editor in a browser, the editor restores the project from the
committed **version snapshot** (e.g. "initial musings"), NOT directly from the
raw `localStorage` key `turnbased.creator.projects`.

- **Why:** seeding a project/component into `localStorage` while the editor is
  already mounted shows nothing — neither new instances nor changed property
  values appear, and even a full reload restores the snapshot. This wasted real
  debugging time during the image-component work until the cause was found.
- **How to apply:**
  - Seed into storage BEFORE the editor first loads the project, or (more
    reliable) add/edit through the real UI — the board's "Add Subcomponent →
    Text / Image" buttons, inspector controls, drag/resize all autosave and
    render correctly.
  - Vite serves app modules as source: import factories in the page for setup,
    e.g. `await import('/src/editor/project.ts')` (`createBlankProject`,
    `addProjectComponent`) and `'/src/editor/storage.ts'`.
  - The board is `KonvaBoardSurface` (`window.Konva.stages[0]`) under the
    `component_editor` tab; open it by clicking a component gallery card. Konva
    drag/resize via synthetic events needs ~80ms after mousedown before the
    mousemoves — the window listener attaches in a React effect post-commit.

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
  4. After a successful remote sync a commit is marked `synced`; older synced
     commits beyond 50/project are pruned (branch heads and the active commit
     are never pruned) and orphaned blobs garbage-collected.
  5. localStorage keeps ONLY small metadata (`turnbased.creator.projects`
     deflated, UI prefs). If you add a new persisted artifact ask "can this
     hold an image or a file map?" — if yes, it goes in IndexedDB.

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
- Card Studio exports actual-mm A4/Letter HTML sheets with cutting guides;
  browser printing uses 100% scale. These are prototype fronts. Production
  bleed, duplex backs, supplier checkout, and fulfillment are still future
  work. Linked URL artwork requires its source; uploaded artwork travels with
  the exported files.
- Checks: `npm run test:workshop` (Node domain tests), `npm run test:versions`
  (Vitest/fake IndexedDB), and `npm run typecheck`. Use Playwright for the
  guest/sample workflow and verify bounded non-landing surfaces at desktop,
  tablet, and phone widths. Keep logs under `logs/`.


## Workshop verification — September 2026

- 20 Card Studio / Playtest Lab domain tests and 27 IndexedDB/version/archive
  tests pass. The browser smoke covers safety restore, valid/invalid agent
  moves, 20-game batches, findings, printable downloads, full-history import,
  reload persistence, and bounded desktop layouts. Print proof verified 10
  cards across 2 actual-size A4 PDF pages.
- `npm run test:workshop:browser` uses an isolated context in the dedicated
  CDP browser; screenshots/downloads default to `/tmp/turnbased-workshop-smoke`.
- Version comparisons use canonical key ordering; serialization order must
  never be reported as a design edit. Archive v2 preserves the active head
  independently of the current working draft. Failed restores validate
  executable snapshots and artwork before moving workspace/head pointers.
- Working-tree build/typecheck pass with the user's existing rule-editor
  changes. A staged-only source check and the previous HEAD produce the same
  five pre-existing type diagnostics in aiBuilder, ComponentsChapterPage, and
  Editor's rule-section props; those unrelated user fixes remain uncommitted.
  Do not discard or accidentally fold that work into this feature commit.
