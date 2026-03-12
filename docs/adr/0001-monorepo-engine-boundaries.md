# ADR 0001 — Monorepo with Hard Package Boundaries

## Status

**Accepted** — 2026-03-11

## Context

We are building a browser-first platform for board game creators. The platform includes:

- A creator-facing web application (dashboard, editor, preview)
- A player-facing runtime (play host on a separate origin)
- A game engine (state management, rules, triggers, turns, visibility, legal moves)
- An AI system (AI play contracts, bot runners)
- Shared utilities (types, schemas, serialization, IDs)

We need to decide whether these components live in separate repos or a single monorepo, and how boundaries are enforced.

## Decision

**We use a single monorepo with multiple npm workspace packages and hard internal boundaries.**

### Package structure

```
/apps
  /web                  # @turnbased/web — creator dashboard + player app shell
  /play-host            # @turnbased/play-host — isolated runtime for untrusted game code

/packages
  /engine-core          # @turnbased/engine-core — reducer, actions, events, triggers, turns, visibility, legal moves
  /engine-sdk           # @turnbased/engine-sdk — author-facing APIs, rule definitions, hooks, manifests
  /engine-components    # @turnbased/engine-components — built-in placeable components and schemas
  /engine-ui            # @turnbased/engine-ui — interaction affordance adapters, highlighting, drag/drop
  /engine-ai            # @turnbased/engine-ai — AI play contracts, bots, state summarizers
  /shared-types         # @turnbased/shared-types — common types across all packages
  /shared-utils         # @turnbased/shared-utils — zod schemas, serialization, IDs, hashing
```

### Import rules

1. App code (`apps/*`) may only import **public exports** from `packages/*`.
2. No deep imports into internal engine files (e.g., `@turnbased/engine-core/src/internal/foo` is forbidden).
3. Engine packages may depend on `shared-types` and `shared-utils` but **not** on app code.
4. `engine-sdk` and `engine-components` depend on `engine-core` types but not its internal implementation.
5. `engine-ui` depends on `engine-core` types for legal move / affordance contracts.
6. `engine-ai` depends on `engine-core` types for state and legal move contracts.
7. Published games pin engine + component versions in their manifests.

### Enforcement

- Each package's `package.json` declares its `main` and `types` entry point.
- TypeScript project references or `exports` field will restrict importable paths.
- CI/lint rules will flag violations of cross-package boundary rules.

## Consequences

### Benefits

- Full-context AI development across engine + editor + docs + multiplayer.
- Easier shared typing and coordinated refactors.
- Easier co-development of components and editor affordances.
- Better local development ergonomics.
- Future option to split the engine into its own repo if needed.

### Drawbacks

- Must be disciplined about not letting app code leak into engine packages.
- Need workspace tooling (npm workspaces, TypeScript project references).
- Slightly more complex CI configuration.

### Risks

- Without enforcement, boundaries erode over time → add lint rules early.
- Monorepo can be slow for very large repos → mitigated by TypeScript project references and incremental builds.

## References

- GEMINI.md: Monorepo Architecture (Revised) section
- GEMINI.md: Hard boundary rules
