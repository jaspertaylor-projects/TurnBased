# Verification

Run commands from the repository root after installing dependencies. The
[development guide](development.md) covers startup and browser configuration.

## Automated checks

```bash
npm run test:dev
npm run test:workshop
npm run test:versions
npm run test:production
npm run test:rules:api
npm run test:cards:api
npm run lint
npm run typecheck
npm run build
```

| Suite | Coverage |
| --- | --- |
| `test:dev` | Local-stack startup, environment handling, and process orchestration |
| `test:workshop` | Card tables, component templates, all-family printing, and deterministic agents |
| `test:versions` | IndexedDB persistence, artwork round trips, archive validation, checkpoint restore, stalled cloud synchronization, and late responses |
| `test:production` | Supplier matching, physical quantities, artwork generation, ZIP structure, and PNG formats |
| `test:rules:api` | Authentication, model selection, prompts, whole-rulebook output, and mocked provider contracts |
| `test:cards:api` | Request scope, strict provider validation, authentication, disabled models, usage accounting, and failure handling |

Rules and card-table API tests mock providers and make no paid requests.
The [CI workflow](../.github/workflows/ci.yml) is the executable source for
checks required on pull requests and pushes to `main`. Browser checks run
separately against a local stack.

For catalog integration checks, start its API and dependencies first:

```bash
npm run test:catalog
```

Set `CATALOG_API_URL` to target a different local API. See the
[catalog guide](../apps/catalog-api/README.md#checks-and-deployment).

## Browser setup

Start the full stack with `npm run dev:local`. Browser helpers use Playwright
and Chrome; set `PLAYWRIGHT_MODULE_PATH` to the installed Playwright module
when it is not resolvable from the repository. The browser scripts are local
development tools and currently include machine-specific fallback paths.
Use the documented overrides on a fresh machine.

The workshop, component-template, and rules-fix checks attach to a dedicated
Chrome instance over CDP and create isolated contexts. Start it with:

```bash
node scripts/codex-headed-browser.mjs
```

Defaults are `http://127.0.0.1:3000` for the app and
`http://127.0.0.1:9223` for CDP. Override `CODEX_BROWSER_URL` and
`CODEX_BROWSER_CDP_URL` as needed. The dedicated profile lives in the ignored
`.playwright-codex/` directory. Helpers for inspection, screenshots, and
interactions are documented in [local development](development.md#codex-headed-browser).

The AI rulebook, card-table, tabletop, supplier, and production checks launch
their own isolated Chrome process. They default to `/usr/bin/google-chrome`;
set `DEMO_CHROME_PATH` for another installation. AI responses are intercepted
in the AI regression checks, so those checks do not consume provider credit.

## Browser suites

For a release, run the guest workflow against the production bundle or live
site. This check uses only public UI and browser APIs, blocks remote writes
and AI calls, and creates projects in isolated browser contexts:

```bash
CODEX_BROWSER_URL=https://turnbased.app node scripts/check-release-browser.mjs
```

It checks desktop/mobile bounds, concise headings, game creation, edited-rule
persistence after reload, sample component data, a real rulebook download,
production login controls, and the ad's poster, captions, playback, and seeking.
Artifacts default to `/tmp/turnbased-release-browser`; override with
`RELEASE_ARTIFACT_DIR`. The app defaults to `http://127.0.0.1:3000` when no URL
is supplied. Set `RELEASE_REQUIRE_PRODUCTION=1` when testing a local preview
to reject an accidental Vite development server. Remote URLs always require
a production bundle. Chrome and Playwright overrides above apply.

| Command | User journeys |
| --- | --- |
| `npm run test:workshop:browser` | Cards, checkpoint restore, agent moves, simulations, print downloads, and backup import |
| `npm run test:components:browser` | All six component families, layer gestures and data bindings, faces, template/SVG/print downloads, reloads, and checkpoint restore |
| `npm run test:rules:browser` | Supplier dimension edits, icon descriptions, saved AI settings, AI undo, delayed replies during editing and restores, and returning from Settings |
| `npm run test:rulebook:browser` | Whole-rulebook proposal review, apply/undo, and stale-response protection |
| `npm run test:cards:ai:browser` | Column/cell suggestions, custom columns, preview/apply/undo, and guarded edits |
| `npm run test:playtest:table:browser` | Authored cards, saved session artwork, proportional fullscreen, and card inspection |
| `npm run test:suppliers:browser` | Catalog matching, stock parts, reloads, quantity changes, and error states |
| `npm run test:production:browser` | Actual supplier ZIP download, physical image dimensions, image colors, 300 dpi metadata, copy counts, and ZIP checksums |

The tabletop check uses the Moonlit Market archive fixture described in the
[second walkthrough](demos/moonlit-market-v2.md). Supplier checks need a
populated local catalog; [seed and refresh instructions](../apps/catalog-api/README.md#catalog-data)
explain the distinction between supplier identities and ingested products.

## Artifacts

Browser scripts save screenshots, downloads, and diagnostics separately from
the application data. Their output identifies the active artifact directory.
Common defaults are:

- Workshop: `/tmp/turnbased-workshop-smoke`.
- Component templates: `/tmp/turnbased-component-templates`; override with
  `COMPONENT_TEMPLATE_ARTIFACT_DIR`.
- Rules fixes: `/tmp/turnbased-rules-fixes`.
- Development process logs: `logs/` at the repository root.

Recording, rendering, source captures, and actual video-playback validation
are described in the [demo documentation](demos/README.md). Generated local
recordings and exported projects stay under the ignored `artifacts/demos/`.
