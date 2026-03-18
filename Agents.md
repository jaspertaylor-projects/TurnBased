# TurnBased Project Guide

## One-liner

TurnBased is a browser-first platform for building, playtesting, publishing, and selling digital tabletop games where creators primarily rely on AI to author game-specific logic on top of a shared deterministic engine, engine-connected UI components, and structured creator tooling, with every game expected to support AI-controlled play for testing and live opponents.

## What This Repo Is Optimizing For

- Engine-first creation, not template-first creation.
- AI-first game authoring, where creators primarily steer, refine, and configure AI-generated logic rather than hand-writing every system from scratch.
- Browser-only execution for creator-defined game logic.
- Low fixed infrastructure cost.
- Multiplayer playtests and entitlement-aware rooms.
- Strong default UX driven by legal move generation.
- Guaranteed AI-capable play so every game can be tested and played even when human opponents are unavailable.
- Player-scoped AI decision-making based on projected game state, legal moves, and game rules rather than omniscient access.
- AI opponents and playtesters as a core product differentiator, especially for niche or low-population games.
- Versioned game development with rules and related project logic tracked as first-class project history.
- A shared engine API that absorbs logic common across many tabletop and board games so AI-generated code can be faster, cheaper, and more consistent.
- A shared UI component system with engine behavior attached so common rendering, interaction, and affordance patterns come prewired and can be configured or visually tweaked rather than rebuilt.
- Scalable, boundary-respecting code patterns across apps, packages, docs, and AI tooling.
- A monorepo with hard package boundaries so the editor, engine, docs, UI components, and AI tooling evolve together.

## AI-first authoring model

- Creators are expected to rely heavily on AI to produce game-specific code, rules, and configuration.
- The platform’s job is to make that workflow faster, cheaper, safer, and more structured.
- The engine should absorb logic that is common across many games so AI does not need to regenerate that logic from scratch for every project.
- The UI component system should absorb common UI structure, interaction wiring, and behavior so AI and creators can work from configurable, behavior-rich primitives.
- Every shipped game should have an AI-playable path so creators always have a built-in playtester and players can access an opponent even for obscure or low-population games.
- AI seats should operate from the projected state and legal moves available to that seat, not from hidden global information they should not know.
- The engine and AI contracts should make valid, informed move selection from player-visible state a default platform capability rather than a bespoke per-game feature.
- The ideal creator workflow is prompt, generate, configure, inspect, refine, and playtest rather than manually rebuilding standard board game systems each time.
- Good defaults, structured configuration, and reusable engine-connected components should reduce token cost, implementation time, and architectural drift in AI-generated outputs.

## Product Shape

### Creator experience

- Build projects in-browser.
- Start from rulebook-level top-level components selected from structured lists or dropdowns rather than raw freeform setup.
- Compose games from built-in boards, spaces, zones, decks, hands, pieces, tokens, counters, prompts, rule definitions, and higher-level game-building primitives.
- Rely primarily on AI to author game-specific rules and logic, with the creator guiding, reviewing, and refining the result.
- Use a shared engine API that already handles large portions of logic common across many games, including deterministic execution, legal move generation, multiplayer/session primitives, turn-flow communication, and AI-seat support.
- Use a shared UI component system with engine behavior attached so common interaction patterns, affordances, and rendering structures come prewired by default.
- Configure and visually tweak components and generated game logic instead of rebuilding common systems from scratch.
- Maintain multiple versions of a game through a simple Git-style project history, with rules and related project logic treated as first-class versioned assets.
- Preview a live prototype while editing.
- Ship games with at least one AI-capable seat or CPU-opponent path for playtesting and live play.
- Publish immutable builds and keep a simple Git-style project history.

### Player experience

- Join rooms with low friction, including guest playtests where allowed.
- Play browser-hosted multiplayer games with optional or required AI seats.
- Play against AI-controlled opponents when human players are unavailable.
- Benefit from every game having a built-in AI playtester/opponent path, making niche and low-population games more playable.
- Buy games and unlock room access through entitlement rules.

### Non-negotiable constraints

- Untrusted creator code does not run on the backend.
- Legal move generation must remain the source of truth for UI and AI behavior.
- Custom game rules authored by creators or AI must compile to supported rule definitions, schemas, engine APIs, or documented extension points rather than bypassing engine invariants.
- The platform should absorb shared game logic and shared interaction behavior wherever doing so makes AI-generated outputs faster, cheaper, safer, and more consistent.
- Every published game should support at least one AI-playable seat or CPU-opponent path.
- AI-controlled seats must make decisions from projected player-visible state, applicable game rules, and legal moves rather than privileged hidden information.
- Package APIs stay public-and-narrow; no deep imports across workspace boundaries.
- Published builds pin engine and component versions.
- Project evolution should preserve scalable ownership boundaries and avoid hidden coupling across packages.

## Golden Rules

- Commit changes frequently with informative messages.
- Update docs when important behavior, constraints, or decisions change.
- Record architecture changes in ADRs.
- Keep monorepo package boundaries hard.
- Prefer the best architectural layer for a change rather than forcing every change through higher-level extension surfaces.
- Never execute untrusted creator code on the backend.
- Keep legal move generation central to validation, UI, and AI.
- Treat rules as first-class versioned assets in project history.
- Design games and engine contracts so AI-controlled seats are a default capability, not an afterthought.
- Ensure AI decision-making uses seat-scoped projected state and legal moves rather than hidden global state.
- AI-generated project logic must respect package boundaries, documented extension points, and scalable code patterns.
- Prefer composable, boundary-respecting abstractions over one-off shortcuts that increase long-term coupling.
- Pin engine and component versions for published builds.
- Keep human-operated TODOs current and explicitly marked complete.

## Repo Map

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

## Major Architecture Areas

| Area | What it owns | Start in code | Design docs |
| --- | --- | --- | --- |
| Creator shell and routing | Top-level app shell, auth-aware routing, page composition | `apps/web/src/App.tsx` | `docs/adr/0001-monorepo-engine-boundaries.md` |
| Browser editor | Component-first editing, preview, local Git-like history, local build publishing UX | `apps/web/src/pages/Editor.tsx`, `apps/web/src/editor/types.ts`, `apps/web/src/editor/project.ts`, `apps/web/src/editor/runtime.ts`, `apps/web/src/editor/git.ts`, `apps/web/src/editor/shipping.ts`, `apps/web/src/editor/capabilities.ts` | `docs/adr/0002-engine-first-creator-paradigm.md`, `docs/adr/0003-engine-override-policy.md` |
| Engine core | State model, action grammar, reducer, replay, triggers, turns, visibility, legal moves | `packages/engine-core/src/index.ts`, `packages/engine-core/src/state/`, `packages/engine-core/src/actions/`, `packages/engine-core/src/reducer/`, `packages/engine-core/src/triggers/`, `packages/engine-core/src/turns/`, `packages/engine-core/src/visibility/`, `packages/engine-core/src/legal-moves/` | `docs/engine/architecture.md`, `docs/engine/state-model.md`, `docs/engine/action-grammar.md`, `docs/engine/triggers-and-priority.md`, `docs/engine/turn-system.md`, `docs/engine/legal-move-generation.md` |
| Rules authoring SDK | Rulebook schemas, expressions, setup/turn/scoring/win-condition helpers, extension hooks | `packages/engine-sdk/src/index.ts`, `packages/engine-sdk/src/helpers.ts`, `packages/engine-sdk/src/expressions.ts`, `packages/engine-sdk/src/hooks.ts`, `packages/engine-sdk/src/schemas.ts` | `docs/engine/rules-authoring.md`, `docs/engine/extension-points.md` |
| Component model | Built-in components, manifests, placement validation, composition rules, engine-connected UI primitives | `packages/engine-components/src/index.ts`, `packages/engine-components/src/catalog.ts`, `packages/engine-components/src/helpers.ts`, `packages/engine-components/src/schemas.ts` | `docs/engine/component-model.md`, `docs/adr/0002-engine-first-creator-paradigm.md` |
| UI interaction layer | Highlight/selection/drag-drop adapters derived from legal moves and component affordance contracts | `packages/engine-ui/src/index.ts`, `packages/engine-ui/src/adapters.ts` | `docs/engine/ui-interaction-contract.md`, `docs/engine/legal-move-generation.md` |
| AI layer | AI input envelopes, seat-scoped move validation, summarization, heuristic/LLM bot runners, budget controls, creator authoring support, and guaranteed CPU-opponent/playtester contracts | `packages/engine-ai/src/index.ts`, `packages/engine-ai/src/runner.ts`, `packages/engine-ai/src/summarizer.ts`, `packages/engine-ai/src/bots.ts`, `packages/engine-ai/src/budget.ts`, `apps/web/src/editor/ai.ts` | `docs/engine/ai-player-contract.md`, `docs/engine/legal-move-generation.md`, `docs/engine/extension-points.md` |
| Sample game coverage | Representative archetypes and simulation harnesses for regression coverage | `packages/sample-games/src/index.ts`, `packages/sample-games/src/games.ts`, `packages/sample-games/src/harness.ts`, `packages/sample-games/src/cli.ts` | `docs/examples/sample-games.md` |
| Multiplayer, play sessions, commerce | Room creation/join flow, play session token minting, entitlement enforcement, Stripe and publish plumbing | `apps/web/src/rooms/api.ts`, `apps/web/src/rooms/runtime.ts`, `supabase/functions/play-session-token/index.ts`, `supabase/functions/stripe-webhook/index.ts`, `supabase/functions/build-manager/index.ts`, `supabase/functions/git-proxy/index.ts`, `supabase/migrations/00000000000005_phase7_multiplayer.sql`, `supabase/migrations/00000000000006_phase8_commerce.sql`, `supabase/migrations/00000000000009_phase18_play_sessions.sql`, `supabase/migrations/00000000000010_phase19_build_publish_git.sql` | `docs/adr/0001-monorepo-engine-boundaries.md`, this guide's Runtime Model section |

## Runtime Model

### High-level flow

1. The creator works in `apps/web`.
2. The editor builds a local project model from component instances, rule config, generated logic, and versioned project assets.
3. Preview runtime helpers translate that model into engine state and legal move definitions.
4. `engine-core` applies canonical actions and emits a deterministic next state.
5. `engine-ui` turns legal move output and component affordance contracts into default interactions.
6. `engine-ai` consumes project context, seat-specific projected state, game rules, component metadata, and legal moves for bot play, grounded explanations, rule-authoring assistance, and project generation support.
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

### Engine-first, component-first, AI-first authoring

- Creators start from a blank engine-backed project, not from a template.
- Built-in components and declarative rules are the default authoring surface.
- AI is the primary authoring accelerator for project-specific game logic and configuration.
- The engine should absorb reusable logic common across many games so AI can target higher-level primitives instead of repeatedly generating the same low-level systems.
- The component library should absorb reusable UI structure, interaction affordances, and visual defaults so creators and AI can configure and refine rather than assemble everything manually.
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

### Versioned project evolution

- Rules, related project logic, and core project assets are first-class versioned artifacts.
- Git-style history is part of the creator workflow, not an implementation afterthought.
- Published builds remain immutable even as project history continues to evolve.

### Scalable engineering patterns

- Prefer narrow interfaces over broad shared reach-through.
- Prefer composable abstractions over special-case coupling.
- Keep ownership boundaries explicit at the package level.
- Treat AI-generated logic as maintainable project code, not disposable output.
- Optimize for extensibility, testability, and long-term maintainability rather than only near-term speed.

## Development Contexts

### Internal platform development

- This repository is the active development surface for the TurnBased platform itself.
- Engine changes are acceptable when they improve determinism, legal move generation, authoring ergonomics, multiplayer behavior, AI integration, or maintainability.
- Backwards compatibility is not the dominant constraint during platform development.
- Prompts evaluating platform work should recommend the best architectural layer to change, including `engine-core`, when appropriate.
- Package boundaries still matter, but engine evolution is a normal part of platform development.
- The same is true for shared UI components and default interaction systems: they should be improved directly when doing so makes AI-first creation faster, cheaper, and more reliable.
- The same is true for AI play contracts and CPU-opponent systems: they should be improved directly when doing so makes every shipped game more testable and more playable.

### External creator authoring

- Creators using TurnBased should generally build through rules, components, SDK helpers, and supported extension points.
- The engine should usually be treated as a platform foundation rather than an everyday customization target.
- The UI component system should usually be treated as the default behavior-rich interaction and rendering foundation rather than something rebuilt from scratch per game.
- Creator-facing AI should steer users toward safe, scalable authoring surfaces and away from direct engine modification unless there is an exceptional reason.
- The product should make the good path the easy path: most game creation work should not require touching engine internals or rebuilding standard component behavior.
- Every game should ship with AI-capable seats that can act from player-visible information and the game’s rules without bespoke omniscient hacks.

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
| Work on AI seats, AI summaries, AI rule-authoring behavior, or CPU-opponent decision flow | `docs/engine/ai-player-contract.md` then `packages/engine-ai/src/runner.ts`, `packages/engine-ai/src/summarizer.ts`, `packages/engine-ai/src/bots.ts`, and `apps/web/src/editor/ai.ts` |
| Work on editor behavior | `apps/web/src/pages/Editor.tsx` plus the relevant file under `apps/web/src/editor/` |
| Work on project history, rules versioning, or build evolution | `apps/web/src/editor/git.ts`, `apps/web/src/editor/project.ts`, `apps/web/src/editor/shipping.ts`, and related publish/build functions |
| Work on top-level component selection, behavior-rich UI primitives, or configurable component variants | `packages/engine-components/src/catalog.ts`, `packages/engine-ui/src/adapters.ts`, `apps/web/src/pages/Editor.tsx`, and relevant editor/component schema files |
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

---

# Additions for Prompt Development

## Glossary

Use these terms consistently in prompts and responses.

- **Legal move**: A canonical action the current player or system is allowed to take from the current projected game state. Legal moves are the source of truth for validation, UI affordances, and AI behavior.
- **Rule definition**: Declarative author-facing configuration that describes setup, turn structure, actions, effects, scoring, win conditions, and other game logic inputs.
- **Extension hook**: A documented and supported customization seam exposed by the engine or SDK. Hooks are preferred over direct edits to engine internals in creator-facing authoring.
- **Immutable build**: A published version of a game that pins engine and component versions and must remain reproducible after publication.
- **Entitlement-aware room**: A multiplayer room whose join and play permissions are governed by purchase, ownership, or other entitlement rules.
- **Browser-hosted play**: Runtime execution of gameplay logic in the browser, not in trusted backend compute. This is a core trust boundary, not merely an implementation detail.
- **Experimental override**: An explicitly lower-guarantee customization path that operates adjacent to the official engine model and may sacrifice compatibility or tooling guarantees.
- **Project model**: The editor-side representation of a creator’s game project, including component instances, rule configuration, generated logic, metadata, and local history.
- **Projected state**: A player- or system-specific view of engine state after applying visibility and information-hiding rules.
- **Creator-defined logic**: Game-specific behavior authored by creators through rules, schemas, expressions, AI generation, and approved extension points.
- **Deterministic engine**: The authoritative game state machine where identical prior state plus identical action sequence must yield identical next state.
- **Package boundary**: The hard workspace-level API contract that prevents apps or sibling packages from reaching into internal files through deep imports.
- **Grounded AI assistance**: AI help constrained by actual project structure, existing rules, component contracts, legal moves, and package-level extension points rather than freeform invention.
- **Versioned project asset**: A rule set, configuration artifact, generated logic unit, or related project asset that is tracked through the creator-facing Git-style history and participates in the evolution of a game over time.
- **Engine-connected UI component**: A reusable game-building primitive that combines configurable presentation with engine semantics, default affordances, placement/composition rules, and runtime meaning.
- **AI-playable seat**: A player seat that can be controlled by an AI agent using only the projected state, applicable rules, and legal moves available to that seat.
- **Projected player state**: The seat-specific visible game state available to a given player or AI seat after hidden-information rules are applied.
- **Guaranteed opponent path**: The product expectation that a published game remains playable through built-in AI seats even when human opponents are not available.

## Prompting Doctrine

When using AI to analyze or improve this project, first determine whether the task is about **internal platform development** or **external creator authoring**.

### For internal platform development

- Treat this repository as the active development surface for the TurnBased engine and platform.
- Recommend engine, SDK, editor, UI, AI, runtime, or schema changes wherever they best solve the problem.
- Do not impose artificial extension-only constraints when the engine or shared component system should be improved directly.
- Preserve determinism, legal move centrality, clear package ownership, and scalable abstractions.
- Treat rules, generated logic, and project assets as first-class versioned assets where relevant to editor and publishing flows.
- Prefer improvements that make AI-first creation faster, cheaper, safer, and more consistent.
- Prefer engine and AI contract changes that make AI play a guaranteed platform capability rather than a bespoke game-by-game bolt-on.
- Preserve seat-scoped decision-making so AI opponents reason only from the information available to that player.

### For external creator authoring

- Treat the engine as the platform foundation creators build on.
- Treat the component library as the default UI and interaction foundation creators build on.
- Assume creators will often rely on AI to generate game-specific logic and configuration.
- Prefer rules, components, SDK helpers, and documented extension points over engine modification.
- Guide creators toward high-leverage, low-fragility authoring paths where AI can build on shared engine and component primitives.
- Preserve the idea that a good engine and component system should absorb common complexity so creators usually do not need to reinvent it.
- Assume every published game should be playable with at least one AI-controlled seat or CPU opponent path.
- Guide creators toward designs where AI can act from projected player state, game rules, and legal moves without custom omniscient hacks.

### In both modes

- Preserve the browser/runtime trust boundary.
- Keep legal move generation central to gameplay validation, UI, and AI.
- Prefer scalable patterns: narrow interfaces, composable modules, explicit ownership, stable contracts, and low cross-package coupling.
- Separate current architecture from speculative future architecture.
- Prefer reversible proposals over tightly coupled rewrites.
- Frame recommendations in terms of ownership boundaries and blast radius.

## What Good Output Looks Like

Good prompt outputs should:

- Respect the stated product thesis and non-negotiable constraints.
- Tie recommendations to specific repo areas, docs, or package boundaries.
- Preserve deterministic behavior unless the prompt explicitly asks to challenge it.
- Call out trust-boundary risk when proposals drift toward backend execution of creator logic.
- Keep legal move generation central rather than treating it as an optional adapter.
- Prefer additive or extension-based designs when working on creator-facing flows, but allow direct engine or shared component improvements when evaluating platform development.
- Distinguish near-term improvements from later-stage platform bets.
- Label speculative ideas as proposals rather than implied existing architecture.
- Be concrete enough to act on without inventing missing systems.
- Treat AI-generated rule and logic output as maintainable, scalable project code.
- Recognize that the platform’s job is to reduce repeated low-level generation work by centralizing common game and UI behavior.
- Preserve the product expectation that AI-controlled play is a default capability of shipped games.

## Things to Avoid in Proposals

Treat the following as anti-patterns unless a prompt explicitly asks to explore them as tradeoffs:

- Suggesting backend execution of untrusted creator code.
- Bypassing legal move generation for UI or AI convenience.
- Deep imports across workspace/package boundaries.
- Collapsing `app.<domain>` and `play.<domain>` trust surfaces.
- Recommending mutable published builds.
- Turning sample games into the primary authoring path.
- Coupling editor-local project state directly to private engine internals.
- Introducing hidden package ownership overlaps.
- Treating AI as authoritative over engine legality.
- Proposing template-first onboarding as the default product direction.
- For creator-facing workflows, defaulting to engine modification when rules, components, SDK surfaces, or extension points are sufficient.
- Describing hypothetical files, services, or package APIs as though they already exist.
- Treating game rules as unstructured content rather than versioned project assets.
- Suggesting AI-generated custom logic that bypasses engine rule schemas or legal move generation.
- Recommending patterns that trade short-term prompt convenience for long-term monorepo coupling or unclear ownership.
- Treating shared engine or shared UI component defaults as unnecessary abstraction when they materially reduce repeated AI generation and creator effort.
- Designing AI opponents that rely on privileged hidden state unavailable to the seat they control.

## Proposal Classification

When giving recommendations, classify each recommendation as one of:

- **Docs-only**
- **Prompt-only**
- **Editor UX**
- **SDK/API surface**
- **Engine-core change**
- **UI interaction layer**
- **AI tooling**
- **Multiplayer/runtime**
- **Publishing/commerce**
- **Infra/backend**
- **Architecture/ADR**

This is meant to make blast radius visible before implementation discussion begins.

## Standard Task Modes for Prompts

Use one of these operating modes when writing or evaluating prompts:

### 1. Architecture critique

Use for stress-testing boundaries, package ownership, trust model, or long-term maintainability.

Expected output:
- strengths
- risks
- hidden coupling
- recommended boundary-preserving improvements

### 2. Feature scoping

Use for shaping new product capabilities before implementation.

Expected output:
- user outcome
- affected areas
- constraints
- minimum viable scope
- deferred work

### 3. ADR drafting

Use for turning architectural decisions into explicit records.

Expected output:
- context
- decision
- consequences
- rejected alternatives

### 4. UX flow analysis

Use for creator or player journey quality, friction, and default behaviors.

Expected output:
- current likely flow
- friction points
- UX principles violated or upheld
- proposed changes tied to architecture constraints

### 5. Prompt generation

Use for authoring reusable prompts for product, architecture, docs, or creator tooling work.

Expected output:
- the prompt
- intended use
- assumptions
- expected response shape

### 6. Prompt evaluation

Use for critiquing an existing prompt.

Expected output:
- what it will likely do well
- where it will drift
- missing guardrails
- tightened rewrite

### 7. Naming and information architecture

Use for package names, concepts, surfaced terminology, and creator-facing language.

Expected output:
- naming candidates
- tradeoffs
- consistency with project doctrine

### 8. Risk review

Use for security, trust boundary, determinism, package ownership, publishing, and entitlement concerns.

Expected output:
- risks
- severity
- trigger conditions
- mitigations

### 9. Docs gap analysis

Use for identifying what is missing or unclear in the current written material.

Expected output:
- missing docs
- ambiguous docs
- outdated assumptions
- recommended doc additions

### 10. Workflow optimization

Use for improving how creators, players, or maintainers move through the system.

Expected output:
- current workflow
- bottlenecks
- proposed simplifications
- architectural implications

## Response Format Expectations

Unless a prompt explicitly asks for something else, responses should:

- Start from the current architecture, not a replacement architecture.
- State major assumptions explicitly.
- Reference the affected repo area or doc set.
- Identify which constraints are in play.
- Separate facts about the current repo from new proposals.
- Note when a recommendation should produce a doc update or ADR.
- Surface tradeoffs rather than pretending there is no cost.
- Prefer structured sections over loose brainstorming.
- Avoid vague advice like “improve scalability” without tying it to an ownership area or constraint.
- Avoid inventing undocumented files, services, package exports, or runtime behavior.

## Suggested Default Answer Shape

For most project-analysis prompts, this default structure is preferred:

1. **Goal**  
   What the recommendation is trying to improve.

2. **Relevant constraints**  
   Which product or architecture rules matter here.

3. **Affected areas**  
   Which packages, apps, docs, or runtime boundaries are implicated.

4. **Recommendation**  
   The concrete proposal.

5. **Why this fits TurnBased**  
   Why it aligns with the repo’s doctrine and trust model.

6. **Risks or tradeoffs**  
   What gets harder, more complex, or less flexible.

7. **Suggested follow-up**  
   Whether this should become a prompt, doc edit, ADR, or implementation plan.

## Prompt Authoring Guidance

When writing prompts for this project, prefer prompts that:

- name the task mode
- name the affected repo area
- name the relevant constraints
- indicate whether the prompt is about internal platform development or external creator authoring
- ask for tradeoffs explicitly
- ask the model to stay within current architecture unless proposing alternatives
- ask for classification by blast radius
- ask the model to distinguish immediate work from future work
- state whether the goal is to reduce repeated AI generation work through shared engine or shared component abstractions

Strong example pattern:

> Evaluate this proposal in architecture critique mode for internal platform development. Stay within the current TurnBased doctrine unless a clear limitation forces an alternative. Preserve browser-hosted creator logic, legal move centrality, hard package boundaries, immutable published builds, versioned rules as first-class assets, scalable ownership boundaries, and seat-scoped AI decision-making. Recommend engine or shared component changes when they are the best architectural answer, especially when they reduce repeated low-level AI generation and improve speed, cost, and consistency. Classify recommendations by blast radius with ADR-worthy changes called out explicitly.

## Prompt Review Checklist

Before reusing a prompt, check whether it:

- says which mode it is in
- says whether it is about internal platform development or external creator authoring
- names the relevant constraints
- identifies the affected area of the repo
- avoids asking for generic startup or SaaS advice
- avoids inviting backend execution of creator logic
- keeps legal moves central when discussing UI or AI
- treats rules and project logic as versioned assets when relevant
- asks for tradeoffs instead of only benefits
- prevents invented architecture from being treated as real
- makes the desired answer shape explicit
- makes clear whether shared engine or shared UI abstractions are intended to reduce repeated AI-authored work
- makes clear whether AI-controlled play must remain seat-scoped and non-omniscient

## Optional Add-on: Evaluation Lens

When comparing two ideas, use this evaluation order unless the prompt says otherwise:

1. trust boundary safety
2. deterministic engine integrity
3. legal move centrality
4. package boundary integrity
5. creator experience quality
6. player experience quality
7. implementation reversibility
8. infrastructure cost
9. extensibility
10. AI/tooling leverage

## Engineering Doctrine for Generated and Proposed Changes

- Prefer narrow public interfaces over cross-package reach-through.
- Prefer composable abstractions over special-case logic.
- Keep ownership boundaries explicit at the package level.
- Avoid hidden coupling between editor state, engine internals, AI tooling, and runtime services.
- Treat generated logic as maintainable project code, not disposable output.
- Optimize for long-term extensibility and testability, not only short-term feature velocity.