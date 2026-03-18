# TurnBased

AI-first platform for building, previewing, playtesting, and versioning tabletop games on top of a shared deterministic engine.

## Local Dev

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
