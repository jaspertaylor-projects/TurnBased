# TurnBased

The online home for board game designers. Design components, version your
rules, get AI help on text and art, and order physical prototypes through
our supplier integration.

Architecture and current scope live in [.agents/architecture.md](.agents/architecture.md).
Current milestone is board game design + physical prototype ordering;
online play and the digital marketplace are planned later milestones.

## Local Dev

To start the full local stack in one command:

```bash
npm run dev:local
```

That script uses your existing `.env` when present. If `.env` is missing, it
copies `.env.example` to `.env` without overwriting an existing file. It then
starts Supabase, serves the local edge runtime, and starts the web app at
`http://127.0.0.1:3000`.

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
npx supabase stop                # tears down all the supabase_* containers
# then Ctrl+C the npm run dev:local terminal to stop the Vite dev server
```

**Restart just the edge runtime** (e.g. after adding a new function in
`supabase/functions/`). This is faster than restarting the whole stack and
preserves Postgres, Auth, your dev server, etc.:
```bash
docker restart supabase_edge_runtime_TurnBased
```

After it comes back, smoke-test the runtime picked up your function:
```bash
curl -sS http://127.0.0.1:54321/functions/v1/<function-name> \
  -X POST -H "Content-Type: application/json" -d '{}'
```
`{"error":"Not Authenticated"}` is the expected response for an auth-gated
function — it confirms the route is live.

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
5. Start the web app:
   ```bash
   npm run dev --workspace web -- --host 127.0.0.1 --port 3000
   ```
6. Open `http://127.0.0.1:3000`, sign in, and use `Build with AI`.

### Environment variables

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
