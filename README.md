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

That script uses your existing `.env` when present. If `.env` is missing, it copies `.env.example` to `.env` without overwriting an existing file. It then starts Supabase, serves the local edge runtime, and starts the web app at `http://127.0.0.1:3000`.

Set `RESET_DB=1` if you want to rebuild the local database from migrations and seed data:

```bash
RESET_DB=1 npm run dev:local
```

Manual setup:

1. Copy `.env.example` to `.env` and fill in the values you need.
2. Start local Supabase:

```bash
npx supabase start
```

3. Apply migrations and seed data:

```bash
npx supabase db reset
```

4. Start the local edge runtime:

```bash
npx supabase functions serve ai-project-builder --env-file .env
```

Current Supabase CLI behavior serves the shared local edge runtime, so the other local functions are exposed from the same process.

5. Start the web app:

```bash
npm run dev --workspace web -- --host 127.0.0.1 --port 3000
```

6. Open `http://127.0.0.1:3000`, sign in, and use `Build with AI`.

## Notes

- The web app reads the `VITE_` Supabase vars.
- The local Supabase edge runtime injects reserved `SUPABASE_*` values automatically.
- `OPENROUTER_API_KEY` must still be available to the edge runtime for hosted AI builds.
- When signed in, initial AI builds can create Supabase-backed project history in addition to the local browser working copy.
