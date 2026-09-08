# TurnBased

A cozy workshop for amateur board game designers: **make a game, try it,
make it better, and print a prototype.** Keep rules, components, card tables,
playtest findings, and version history together as an idea grows.

Architecture and current scope live in [.agents/architecture.md](.agents/architecture.md).
The current workflow is **idea → prototype → playtest → revise → print**.
Supplier checkout, production fulfillment, and a marketplace remain future work.

## Try the workshop

After starting the local stack, open `http://127.0.0.1:3000`:

1. Choose **New game** and enter a working title, or open **My workshop**
   and try **Little Woodland**. Creating a game and its first local checkpoint
   needs no account or AI generation. The example includes five rules chapters,
   four card designs, and ten physical cards.
2. In **Card studio**, edit the table or import CSV / pasted spreadsheet rows.
   Bind fields to a Woodland, Storybook, or Modern template, then generate
   the deck. Copy counts, custom fields, artwork, and template settings save
   with the project.
3. In **Playtest lab**, record observations or run the supported two-player
   market-race experiment. Seeded heuristic agents play explicit numeric
   cost/points rules; they do not interpret arbitrary rulebooks or card powers.
   Export an agent packet with public state and legal moves, and paste an
   external agent's JSON reply to take a validated turn. No LLM runner is
   required for the built-in simulations.
4. In **Version history**, name checkpoints, branch an experiment, compare
   changes, and restore earlier work. Restoring saves uncheckpointed work in
   a safety checkpoint first. Browser drafts survive reloads independently
   of the selected checkpoint.
5. In **Print & share**, download A4 or US Letter card sheets with millimeter
   dimensions and cutting guides, a printable rulebook, or a design archive
   with history. Open the HTML sheets and print at **100% / actual size**
   with browser headers and footers off. These are prototype card fronts;
   manufacturing bleed, duplex backs, and supplier ordering need further work.

`#/new` is the local creation path; `#/new/guided` retains guided AI setup.
Editor links accept a section, for example
`#/editor/<project-id>?section=card_studio`.

Live project snapshots, workspace files, checkpoints, and embedded artwork
are stored in IndexedDB. localStorage contains a small project index and UI
preferences. Checkpoints are not automatically pruned; download a portable
backup before clearing browser data or moving to another browser. Archives
include embedded artwork once and import as a new game. Linked HTTP(S)
artwork still needs its original source; upload it to make it portable.

## Workshop checks

Run from the repository root:

```bash
npm run test:workshop # Node tests: card tables, exports, simulation and agent protocol
npm run test:versions # Vitest + fake IndexedDB: persistence, versions and archives
npm run typecheck    # Typecheck all workspaces
```

UI verification uses Playwright; browser helpers and logs are described below.
With the dev stack and the dedicated browser running, `npm run test:workshop:browser`
checks cards, checkpoint restore, agent moves, simulations, print downloads, and
backup import in an isolated browser context. Set `PLAYWRIGHT_MODULE_PATH` if
Playwright is installed elsewhere; artifacts go to `/tmp/turnbased-workshop-smoke`.

## Local Dev

To start the full local stack in one command:

```bash
npm run dev:local
```

Both `npm run dev` and `npm run dev:local` start the full stack. Use Node 22.12+
and Docker with Compose v2.

That script uses your existing `.env` when present. If `.env` is missing, it
copies `.env.example` to `.env` without overwriting an existing file. It then
installs workspace dependencies, starts catalog Postgres + Redis, applies the
catalog migrations and supplier seed, starts the catalog API on port 3100,
then starts Supabase, the local edge runtime, and the web app at
`http://127.0.0.1:3000`. Missing `apps/catalog-api/.env` is also created from its
example. The web app receives the running local Supabase URL and anon key
automatically.

The catalog server is now part of this monorepo at
[`apps/catalog-api`](apps/catalog-api/README.md). Its existing API routes stay
at `/v1`; Vite forwards them to the local server. `npm run dev:catalog` starts
just the API and its dependencies. Logs are saved under `logs/`.

Catalog data lives in its own persistent Docker volume. A fresh machine needs
a supplier refresh to populate products; see the [catalog setup guide](apps/catalog-api/README.md#catalog-data).

Set `RESET_DB=1` if you want to rebuild the local database from migrations
and seed data:

```bash
RESET_DB=1 npm run dev:local
```

### What's actually running

Local Supabase runs as a stack of **Docker containers**, not as host
processes — so `pgrep supabase` will show nothing even when the stack is up.
The Supabase CLI manages them on your behalf.

| Container                              | Role                              | Host port |
| -------------------------------------- | --------------------------------- | --------- |
| `supabase_kong_TurnBased`              | API gateway (routes everything)   | **54321** |
| `supabase_db_TurnBased`                | Postgres                          | 54322     |
| `supabase_studio_TurnBased`            | Web admin UI                      | 54323     |
| `supabase_inbucket_TurnBased`          | Mail capture for local auth flows | 54324     |
| `supabase_analytics_TurnBased`         | Logflare                          | 54327     |
| `supabase_edge_runtime_TurnBased`      | Edge function runtime (Deno)      | (via Kong on 54321) |
| `supabase_auth_TurnBased`              | GoTrue auth                       | (via Kong) |
| `supabase_rest_TurnBased`              | PostgREST                         | (via Kong) |
| `supabase_realtime_TurnBased`          | Realtime                          | (via Kong) |
| `supabase_storage_TurnBased`           | Storage API                       | (via Kong) |
| `supabase_pg_meta_TurnBased`           | DB metadata                       | (via Kong) |
| `supabase_vector_TurnBased`            | Log shipping                      | —         |

Plus, in front of all that:

- **Catalog API** on `http://127.0.0.1:3100`, with Postgres on **54328**
  and Redis on **6380** (managed by the root `compose.yml`).
- **Vite dev server** on `http://127.0.0.1:3000` — the web app
- The Supabase CLI's `functions serve` Deno worker, attached to
  `supabase_edge_runtime_TurnBased` over a websocket so the runtime can
  hot-load functions from `supabase/functions/`.

### Common operations

**Start everything fresh** — easiest path:
```bash
npm run dev:local
```

**Stop everything**:
```bash
# First Ctrl+C the npm run dev terminal (stops web, API, and edge workers).
npm run dev:stop                 # stops Supabase + catalog Postgres/Redis
# Database volumes and catalog data are preserved.
```

**Register a newly-added edge function with the running runtime.** The
edge runtime container's function route table is built when the CLI's
`supabase functions serve` worker registers them on startup — `docker restart`
alone keeps the OLD list. To add a function you just dropped into
`supabase/functions/`, (re-)run the serve worker:
```bash
# kill any stale serve worker first
pkill -f 'supabase functions serve' 2>/dev/null

# from the repo root — the named function doesn't matter; the worker
# exposes EVERY directory under supabase/functions/ from the same process
npx supabase functions serve ai-project-builder --env-file .env
```

Leave that terminal running while developing — it also hot-reloads function
code on save. To smoke-test the route is wired:
```bash
curl -sS http://127.0.0.1:54321/functions/v1/<function-name> \
  -X POST -H "Content-Type: application/json" -d '{}'
```
`{"msg":"Missing authorization header"}` (HTTP 401) is the expected
response for an auth-gated function — it confirms the route exists.

**Tail edge function logs** while developing:
```bash
docker logs -f supabase_edge_runtime_TurnBased
```

**Reset the local DB** without restarting containers:
```bash
npx supabase db reset
```

**Open Studio** (the local admin UI) — useful for browsing tables, ledger
entries, etc.:
```
http://127.0.0.1:54323
```

### Manual setup (if you're not using `dev:local`)

1. Copy `.env.example` to `.env` and fill in the values you need.
2. Start local Supabase:
   ```bash
   npx supabase start
   ```
3. Apply migrations and seed data:
   ```bash
   npx supabase db reset
   ```
4. Start the local edge runtime. The CLI's `functions serve` attaches to the
   already-running edge runtime container — you only need to name **one**
   function; the runtime exposes every function in `supabase/functions/` from
   the same process:
   ```bash
   npx supabase functions serve ai-project-builder --env-file .env
   ```
5. In another terminal, start the catalog API and its dependencies:
   ```bash
   npm run dev:catalog
   ```
6. Start the web app:
   ```bash
   npm run dev --workspace web -- --host 127.0.0.1 --port 3000
   ```
7. Open `http://127.0.0.1:3000` and create a game or try Little Woodland.
   Sign in only when exercising an authenticated feature such as AI assistance.

### Environment variables

Optional root `.env` / shell overrides: `WEB_HOST`, `WEB_PORT`,
`CATALOG_PORT` (3100), `CATALOG_DB_PORT` (54328), and
`CATALOG_REDIS_PORT` (6380). The launcher keeps these ports and the web proxy
in sync. For a manually started Vite server, use `CATALOG_API_URL` to override
its default `http://127.0.0.1:3100` target. Supplier credentials belong in
`apps/catalog-api/.env`, which is ignored by git.

The web app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build
time from `.env` (Vite only exposes vars prefixed with `VITE_` to the
browser).

The edge runtime reads the rest of `.env` (everything **not** starting with
`VITE_`) when you pass `--env-file .env`. The reserved `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected by the CLI
automatically — you don't need to set them yourself.

Keys the edge functions actually read:

- `OPENROUTER_API_KEY` — required for any AI-backed function
  (`ai-project-builder`, `ai-rules-writer`, `ai-image-agent`).
- `OPENROUTER_DEFAULT_MODEL` — fallback model id used by all AI functions
  when no per-function override is set.
- `OPENROUTER_BUILD_MODEL` — override for `ai-project-builder` only.
- `OPENROUTER_RULES_MODEL` — override for `ai-rules-writer` only. Defaults
  to `moonshotai/kimi-k2-0905`.

When signed in, initial AI builds can create Supabase-backed project history
in addition to the local browser working copy.

### Local dev account

A pre-confirmed account is seeded into the local Postgres on every
`supabase db reset`:

- **Email:** `dev@turnbased.local`
- **Password:** `dev-local-only`
- **Local AI wallet:** `$50.00`

Open `http://127.0.0.1:3000/#/auth` and choose **Use local dev account**.
The shortcut appears only in development when both the app and Supabase use
localhost/loopback addresses. You can also enter the credentials above in the
normal form. Guest sessions can open this page to sign into a regular account.

Use it to exercise any flow that requires auth (the `Build with AI` path,
the rulebook `AI` button on each section, anything that hits the edge
functions). If you already have local data and don't want a full reset,
the same account can be created against the running DB with:

```bash
scripts/seed-dev-account.sh
```

The seed/script logic both live in `supabase/seed.sql` — credentials never
leave local-dev databases, they're not deployed to hosted Supabase.

### Codex headed browser

For UI work, Codex should use its own headed Chrome profile instead of the
shared Playwright MCP profile that Claude Code may already have locked. Keep the
normal dev server on `http://127.0.0.1:3000`, then launch:

```bash
node scripts/codex-headed-browser.mjs
```

The script opens a visible Chrome window with a persistent local profile at
`.playwright-codex/chrome-profile` and remote debugging on port `9223`. Sign in
there once with the local dev account above; future Codex browser checks can
reuse that session without disturbing Claude's browser.

Codex can inspect or screenshot that browser through the approved helper scripts:

```bash
node scripts/codex-browser-inspect.mjs http://127.0.0.1:3000/#/settings
node scripts/codex-browser-screenshot.mjs http://127.0.0.1:3000/#/settings settings.png
```

Useful overrides:

```bash
CODEX_BROWSER_URL=http://127.0.0.1:3000 \
CODEX_BROWSER_DEBUG_PORT=9223 \
node scripts/codex-headed-browser.mjs
```

The `.playwright-codex/` directory is ignored by git because it contains local
browser profile state.

### Edge function gotcha: validate JWTs explicitly

When writing a new edge function that needs the caller's identity, do NOT
rely on the supabase-js client's session lookup:

```ts
// ✗ "Auth session missing!" even when the Authorization header is present
const { data: { user } } = await supabaseClient.auth.getUser();
```

The server-side client has no persisted session, so a no-arg `getUser()`
returns the missing-session error. Pass the JWT from the request explicitly:

```ts
// ✓ verifies the token from the request header directly
const authHeader = req.headers.get('Authorization') ?? '';
const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
const { data: { user } } = await supabaseClient.auth.getUser(jwt);
```

`ai-rules-writer` follows this pattern. Older functions in this repo predate
the fix and may surface the same issue once they go through more rigorous
testing.

### Troubleshooting

**"Edge Function returned a non-2xx status code"** — the function threw. The
web client extracts the real cause and shows it inline (e.g. `OpenRouter API
Key not configured`, `Not Authenticated`). If you want the raw response,
tail the runtime logs with `docker logs -f supabase_edge_runtime_TurnBased`
while you trigger the action.

**Edge function not found (404)** — either the function directory is missing
from `supabase/functions/`, or the runtime hasn't picked up a new function
you just added. Restart the runtime container:
```bash
docker restart supabase_edge_runtime_TurnBased
```

**`pgrep supabase` shows nothing but the app still works** — expected.
Everything is in Docker. Use `docker ps --filter "name=supabase"` instead.
