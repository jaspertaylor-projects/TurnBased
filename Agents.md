# TurnBased Project Guide

## One-liner

TurnBased is a browser-first platform for building, playtesting, publishing, and selling digital tabletop games on top of a shared deterministic engine, reusable components, and AI-assisted creator tooling.

## What This Repo Is Optimizing For

- Engine-first creation, not template-first creation.
- Browser-only execution for creator-defined game logic.
- Low fixed infrastructure cost.
- Multiplayer playtests and entitlement-aware rooms.
- Strong default UX driven by legal move generation.
- A monorepo with hard package boundaries so the editor, engine, docs, and AI tooling evolve together.

## Product Shape

### Creator experience

- Build projects in-browser.
- Compose games from built-in boards, spaces, zones, decks, hands, pieces, tokens, counters, prompts, and rule definitions.
- Preview a live prototype while editing.
- Use AI for grounded advice, rule authoring help, and later code/content generation.
- Publish immutable builds and keep a simple Git-style project history.

### Player experience

- Join rooms with low friction, including guest playtests where allowed.
- Play browser-hosted multiplayer games with optional AI seats.
- Buy games and unlock room access through entitlement rules.

### Non-negotiable constraints

- Untrusted creator code does not run on the backend.
- Legal move generation must remain the source of truth for UI and AI behavior.
- Package APIs stay public-and-narrow; no deep imports across workspace boundaries.
- Published builds pin engine and component versions.

## Golden Rules

- Commit changes frequently with informative messages.
- Update docs when important behavior, constraints, or decisions change.
- Record architecture changes in ADRs.
- Keep monorepo package boundaries hard.
- Prefer documented extension points over ad hoc engine edits.
- Never execute untrusted creator code on the backend.
- Keep legal move generation central to validation, UI, and AI.
- Pin engine and component versions for published builds.
- Keep human-operated TODOs current and explicitly marked complete.

## Repo Map

```text
/apps
  /web          creator dashboard, editor, player shell
  /play-host    isolated runtime shell for browser-hosted play

/packages
  /engine-core        deterministic state machine
  /engine-sdk         author-facing rulebook and hook APIs
  /engine-components  built-in component catalog and placement rules
  /engine-ui          UI affordance adapters from legal moves
  /engine-ai          AI play contracts, summaries, and bot runners
  /sample-games       representative game archetypes and harnesses
  /shared-types       shared IDs and cross-package types
  /shared-utils       shared serialization, hashing, helpers

/docs
  /engine      engine design docs
  /examples    sample game documentation
  /adr         architecture decisions

/supabase
  /functions   edge functions for AI, assets, builds, Git, Stripe, play sessions
  /migrations  schema, multiplayer, commerce, and publishing SQL
```

## Major Architecture Areas

| Area | What it owns | Start in code | Design docs |
| --- | --- | --- | --- |
| Creator shell and routing | Top-level app shell, auth-aware routing, page composition | `apps/web/src/App.tsx` | `docs/adr/0001-monorepo-engine-boundaries.md` |
| Browser editor | Component-first editing, preview, local Git-like history, local build publishing UX | `apps/web/src/pages/Editor.tsx`, `apps/web/src/editor/types.ts`, `apps/web/src/editor/project.ts`, `apps/web/src/editor/runtime.ts`, `apps/web/src/editor/git.ts`, `apps/web/src/editor/shipping.ts`, `apps/web/src/editor/capabilities.ts` | `docs/adr/0002-engine-first-creator-paradigm.md`, `docs/adr/0003-engine-override-policy.md` |
| Engine core | State model, action grammar, reducer, replay, triggers, turns, visibility, legal moves | `packages/engine-core/src/index.ts`, `packages/engine-core/src/state/`, `packages/engine-core/src/actions/`, `packages/engine-core/src/reducer/`, `packages/engine-core/src/triggers/`, `packages/engine-core/src/turns/`, `packages/engine-core/src/visibility/`, `packages/engine-core/src/legal-moves/` | `docs/engine/architecture.md`, `docs/engine/state-model.md`, `docs/engine/action-grammar.md`, `docs/engine/triggers-and-priority.md`, `docs/engine/turn-system.md`, `docs/engine/legal-move-generation.md` |
| Rules authoring SDK | Rulebook schemas, expressions, setup/turn/scoring/win-condition helpers, extension hooks | `packages/engine-sdk/src/index.ts`, `packages/engine-sdk/src/helpers.ts`, `packages/engine-sdk/src/expressions.ts`, `packages/engine-sdk/src/hooks.ts`, `packages/engine-sdk/src/schemas.ts` | `docs/engine/rules-authoring.md`, `docs/engine/extension-points.md` |
| Component model | Built-in components, manifests, placement validation, composition rules | `packages/engine-components/src/index.ts`, `packages/engine-components/src/catalog.ts`, `packages/engine-components/src/helpers.ts`, `packages/engine-components/src/schemas.ts` | `docs/engine/component-model.md`, `docs/adr/0002-engine-first-creator-paradigm.md` |
| UI interaction layer | Highlight/selection/drag-drop adapters derived from legal moves | `packages/engine-ui/src/index.ts`, `packages/engine-ui/src/adapters.ts` | `docs/engine/ui-interaction-contract.md`, `docs/engine/legal-move-generation.md` |
| AI layer | AI input envelopes, move validation, summarization, heuristic/LLM bot runners, budget controls | `packages/engine-ai/src/index.ts`, `packages/engine-ai/src/runner.ts`, `packages/engine-ai/src/summarizer.ts`, `packages/engine-ai/src/bots.ts`, `packages/engine-ai/src/budget.ts`, `apps/web/src/editor/ai.ts` | `docs/engine/ai-player-contract.md`, `docs/engine/legal-move-generation.md`, `docs/engine/extension-points.md` |
| Sample game coverage | Representative archetypes and simulation harnesses for regression coverage | `packages/sample-games/src/index.ts`, `packages/sample-games/src/games.ts`, `packages/sample-games/src/harness.ts`, `packages/sample-games/src/cli.ts` | `docs/examples/sample-games.md` |
| Multiplayer, play sessions, commerce | Room creation/join flow, play session token minting, entitlement enforcement, Stripe and publish plumbing | `apps/web/src/rooms/api.ts`, `apps/web/src/rooms/runtime.ts`, `supabase/functions/play-session-token/index.ts`, `supabase/functions/stripe-webhook/index.ts`, `supabase/functions/build-manager/index.ts`, `supabase/functions/git-proxy/index.ts`, `supabase/migrations/00000000000005_phase7_multiplayer.sql`, `supabase/migrations/00000000000006_phase8_commerce.sql`, `supabase/migrations/00000000000009_phase18_play_sessions.sql`, `supabase/migrations/00000000000010_phase19_build_publish_git.sql` | `docs/adr/0001-monorepo-engine-boundaries.md`, this guide's Runtime Model section |

## Runtime Model

### High-level flow

1. The creator works in `apps/web`.
2. The editor builds a local project model from component instances and rule config.
3. Preview runtime helpers translate that model into engine state and legal move definitions.
4. `engine-core` applies canonical actions and emits a deterministic next state.
5. `engine-ui` turns legal move output into default affordances.
6. `engine-ai` consumes projected state and legal moves for bot play or AI explanations.
7. Multiplayer and publishing metadata flow through Supabase RPCs, edge functions, and migrations.

### Security boundary

- `app.<domain>` is the authenticated creator and marketplace surface.
- `play.<domain>` is the isolated play runtime surface.
- Backend services mint narrow play-session tokens instead of sharing full app auth context with runtime clients.
- Browser-hosted play is a feature, not a shortcut: it is the core trust boundary of the product.

## Current Architectural Doctrine

### Monorepo with hard boundaries

- Workspace packages are the unit of ownership.
- App code imports public package exports only.
- Engine internals are private unless intentionally exported from package entrypoints.

More detail:
- `docs/adr/0001-monorepo-engine-boundaries.md`

### Engine-first, component-first authoring

- Creators start from a blank engine-backed project, not from a template.
- Built-in components and declarative rules are the default authoring surface.
- Sample games exist as references and regression targets, not as the primary creation path.

More detail:
- `docs/adr/0002-engine-first-creator-paradigm.md`
- `docs/engine/component-model.md`
- `docs/engine/rules-authoring.md`

### Tiered customization model

- Standard mode: official engine plus declarative authoring.
- Advanced mode: supported extension hooks.
- Experimental mode: explicit engine-adjacent overrides with reduced guarantees.

More detail:
- `docs/adr/0003-engine-override-policy.md`
- `docs/engine/extension-points.md`
- `docs/engine/experimental-engine-override.md`

## Best Starting Points By Task

| If you need to... | Start here |
| --- | --- |
| Understand the whole engine quickly | `docs/engine/architecture.md` then `packages/engine-core/src/index.ts` |
| Change the state shape | `docs/engine/state-model.md` then `packages/engine-core/src/state/` |
| Add a new action or effect | `docs/engine/action-grammar.md` then `packages/engine-core/src/actions/` and `packages/engine-core/src/reducer/` |
| Modify trigger or response behavior | `docs/engine/triggers-and-priority.md` then `packages/engine-core/src/triggers/` |
| Change turn sequencing | `docs/engine/turn-system.md` then `packages/engine-core/src/turns/manager.ts` |
| Work on hidden information rules | `docs/engine/state-model.md` and `docs/engine/legal-move-generation.md`, then `packages/engine-core/src/visibility/projector.ts` |
| Add or refine built-in components | `docs/engine/component-model.md` then `packages/engine-components/src/catalog.ts` and `packages/engine-components/src/helpers.ts` |
| Improve author-facing rules | `docs/engine/rules-authoring.md` then `packages/engine-sdk/src/helpers.ts` and `packages/engine-sdk/src/schemas.ts` |
| Improve default game interactions | `docs/engine/ui-interaction-contract.md` then `packages/engine-ui/src/adapters.ts` |
| Work on AI seats or AI summaries | `docs/engine/ai-player-contract.md` then `packages/engine-ai/src/runner.ts` and `packages/engine-ai/src/summarizer.ts` |
| Work on editor behavior | `apps/web/src/pages/Editor.tsx` plus the relevant file under `apps/web/src/editor/` |
| Work on rooms, entitlements, or publishing | `apps/web/src/rooms/api.ts` and the relevant `supabase/functions/` and `supabase/migrations/` files |

## Detailed Doc Index

### Engine docs

- `docs/engine/architecture.md`
- `docs/engine/state-model.md`
- `docs/engine/action-grammar.md`
- `docs/engine/triggers-and-priority.md`
- `docs/engine/turn-system.md`
- `docs/engine/legal-move-generation.md`
- `docs/engine/ui-interaction-contract.md`
- `docs/engine/component-model.md`
- `docs/engine/rules-authoring.md`
- `docs/engine/extension-points.md`
- `docs/engine/experimental-engine-override.md`
- `docs/engine/ai-player-contract.md`

### ADRs

- `docs/adr/0001-monorepo-engine-boundaries.md`
- `docs/adr/0002-engine-first-creator-paradigm.md`
- `docs/adr/0003-engine-override-policy.md`

### Examples

- `docs/examples/sample-games.md`

## Human-Run Work

The manual operations, billing, account, DNS, legal, and security checklist now lives in:

- `docs/human-todo.md`

That file is intended to be the operational runbook. Update it as tasks are completed or when the human workflow changes.
