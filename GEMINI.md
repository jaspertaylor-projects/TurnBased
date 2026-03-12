# turnbased_engine_architecture_and_plan.md

## One-liner

A browser-first platform where **board game developers** build digital tabletop games using a **shared monorepo platform**, a **robust reusable game engine**, **placeable component systems**, a simplified Git workflow, and **AI agents**, while **players** can play, playtest, and purchase games—**with multiplayer in-browser**—on a **low fixed-cost, low-egress architecture**.

---

# Paradigm Update

## Old direction

* Developers start from curated game templates.
* The engine is conceptually separate from the platform repo.

## New direction

* Developers do **not** primarily start from templates.
* The platform ships with a **powerful built-in game engine** plus a **hierarchical component library**.
* Developers assemble games from **boards, spaces, tracks, zones, decks, hands, counters, resources, tokens, pieces, prompts, and rule definitions**.
* The platform editor, engine, UI interaction layer, AI tooling, and component catalog live in **one monorepo with hard package boundaries**.
* Advanced users may enable **custom extension mode**, and later **experimental engine override mode**, with explicit warnings and reduced guarantees.

## Sweet spot architecture

**One monorepo, multiple packages, hard internal boundaries.**

This gives us:

* full-context AI development across engine + editor + docs + multiplayer
* easier shared typing and coordinated refactors
* easier co-development of components and editor affordances
* better local development ergonomics
* future option to split the engine out later if needed

This avoids:

* early cross-repo drift
* version mismatch friction
* duplicated docs and contracts
* brittle AI agent context across multiple repos

---

# Product Scope

## Primary Personas

### 1) Developer (Game Creator)

Goals:

* Create a new game project inside the platform.
* Assemble game structures from a **component catalog** rather than a template picker.
* Edit rules, code, assets, components, and game metadata in the browser.
* Use **AI agents** to implement rules, author content, generate assets, refactor logic, explain engine behavior, and propose legal move flows.
* Preview a live prototype while developing.
* Run multiplayer playtests with humans and AI players.
* Publish and sell games.

Constraints:

* Must be easy for non-engineers.
* Must preserve a “dumbed down Git” workflow.
* Must support AI-first creation.
* Must support multiple AI models by task type.
* Must let advanced users dig deeper without forcing complexity on everyone.

### 2) Player (Community / Customer)

Goals:

* Create an account or join playtests quickly.
* Join a multiplayer room and play.
* Play against friends and optionally AI opponents.
* Buy a game and unlock access cleanly.
* Participate in dev-authorized playtests.

Constraints:

* Very low friction to join and play.
* Anonymous/guest participation for allowed playtests.
* Multiplayer UX must feel smooth.
* Purchases and ownership rules must be clear.

---

# Core Product Requirements

## R1 — In-browser creator workflow

* Creators build projects in-browser.
* They work with:

  * component palette
  * board/layout editor
  * rules editor
  * code editor
  * asset manager
  * Git history view
  * playtest tools
  * AI assistants
* AI agents can:

  * edit files
  * explain code and engine behavior
  * create commits
  * open PR-like change sets
  * generate assets and text
  * propose rules and interactions

## R2 — Live prototype during development

* Developer can run:

  * instant local preview from current workspace
  * shareable multiplayer demo from immutable build snapshot

## R3 — Multiplayer playtests

* Create rooms for humans and AI participants.
* Rooms support low-tick event-based real-time multiplayer.
* Playtests can be:

  * public
  * invite-only
  * friends-only

## R4 — Retail purchase + social access

* Players can buy games.
* A room can be played if at least one current participant owns the game.
* Playtests can override ownership checks if the dev allows it.
* Optional grace-period handling if the license holder leaves.

## R5 — Low fixed infra cost

* No expensive server-side build hosting.
* No arbitrary user code execution on backend.
* Use cheap storage + CDN patterns.
* Prefer browser-side build and deterministic local runtime.

## R6 — Simple Git UX

* Keep Git backend flexible.
* Expose only simple operations:

  * status
  * commit
  * history
  * revert
  * later branch-lite and diffs

## R7 — Multi-model AI routing

* Model selection by task type:

  * rules text
  * code agent
  * image generation
  * audio generation
  * AI play / opponent reasoning
* Enforce tier access, quotas, budgets, and pay-as-you-go pricing.

## R8 — AI opponent and AI playtest support

* Platform supports human-vs-AI and AI-vs-AI play.
* The engine must expose:

  * player-visible game state
  * game rules summary
  * legal move list
  * selected role / seat
* AI should choose from engine-generated legal moves whenever possible.

## R9 — Rich default interaction UX

* By default, the UI should highlight all legal interactions.
* Support both:

  * **item -> destination** flows (drag piece to legal target)
  * **destination -> item** flows (click board space, choose eligible piece/action)
* Support popup selection when multiple things can be placed into a destination.
* Support drag/drop when item-first is more natural.

## R10 — Strong built-in engine out of the box

* The platform should not rely on creators building engine semantics themselves.
* It should ship with:

  * deterministic state system
  * triggers and interrupt windows
  * turn / phase / step system
  * dynamic turn order
  * hidden information model
  * legal move generation
  * reusable components
  * UI affordance generation
  * AI play hooks

---

# Explicit Non-Goals (MVP)

* No Roblox-like authoritative simulation platform.
* No execution of arbitrary creator code on backend.
* No Google-Docs-style multiplayer source editing in MVP.
* No print-and-ship in MVP.
* No support for arbitrary unsafe engine rewrites in standard mode.

---

# Monorepo Architecture (Revised)

## Monorepo principle

Everything lives in one repo, but with strict package boundaries and narrow public APIs.

## Recommended structure

```text
/apps
  /web               # creator dashboard + player-facing app shell
  /play-host         # isolated runtime shell for running untrusted game code on play origin

/packages
  /engine-core       # reducer, actions, events, triggers, stack, turn engine, visibility, legal move generation
  /engine-sdk        # author-facing APIs for game definitions, rules, hooks, manifests
  /engine-components # built-in placeable components and schemas
  /engine-ui         # interaction affordance adapters, highlighting, drag/drop contracts, selection flows
  /engine-ai         # AI play contracts, state summarizers, move-selection helpers, strategy hooks
  /shared-types      # common types across app, play host, engine, edge, db clients
  /shared-utils      # zod schemas, serialization helpers, ids, hashing, misc shared code

/docs
  /engine            # architecture, state model, actions, examples, extension points
  /examples          # sample games and patterns
  /adr               # architecture decision records

/supabase
  /migrations
  /functions
  /seed

/infrastructure
  /cloudflare
  /docker
  /scripts
```

## Hard boundary rules

* App code may only import public package exports.
* No deep imports into internal engine files from app packages.
* Engine internals stay private unless intentionally exported.
* Package README and docs must explain intended API surfaces.
* Published games pin engine + component versions.

## Why this is the sweet spot

* One place for AI coding and docs retrieval.
* One repo for coordinated changes.
* Logical separation without operational fragmentation.
* Future-ready if the engine later needs to be split out.

---

# Runtime Architecture (Low Fixed Cost)

## Key principle

**Untrusted creator game code runs only in the browser.**

We do not execute arbitrary creator code on the backend.

## Components

* **Frontend App**: React + Vite + Tailwind on Cloudflare Pages
* **Play Host**: separate origin `play.<domain>` for untrusted game runtime
* **Backend**: Supabase Postgres + RLS + Edge Functions
* **Storage**:

  * Cloudflare R2 for builds
  * Cloudflare R2 for assets
* **Git**:

  * Gitea or Forgejo on a small VPS via Docker
* **AI providers**:

  * OpenRouter for text/code/reasoning
  * image provider(s)
  * audio provider(s) later

## Security boundaries

* `app.<domain>` for authenticated creator/dashboard workflows
* `play.<domain>` for untrusted runtime
* never share cookies/localStorage between origins
* when embedded, use iframe sandboxing
* never expose full Supabase user session to runtime iframe
* instead mint a narrow **play session token** for room/build access

---

# Engine Vision

## Goal

Build a **general-purpose digital tabletop engine** capable of expressing:

* board games
* card games
* mixed card/board games
* hidden-information games
* trigger-heavy games
* games with changing turn order
* games with interrupt / response windows
* games with AI seats and AI-assisted playtesting

## Design inspiration

The engine should support rules complexity closer to a **multiplayer Magic-like response and trigger model**, while still supporting simpler board games ergonomically.

That means it must support:

* anyone’s action triggering anything else
* replacement/prevention-like mechanics
* nested trigger chains
* response windows
* stack/queue resolution where needed
* dynamic phase/step/turn mutation
* temporary control changes
* hidden and public state views

## Important principle

Complexity should exist in the engine, not be pushed onto every creator.

---

# Engine Layers

## Layer A — Platform-supported core engine

Trusted and stable. Includes:

* deterministic reducer
* canonical action grammar
* event pipeline
* trigger engine
* priority / response windows
* turn / phase / step manager
* visibility system
* legal move generator
* state serialization and replay

## Layer B — Built-in components and declarative rules

Primary creator layer:

* boards
* spaces
* tracks
* zones
* decks
* hands
* discard piles
* bags
* pieces
* counters
* markers
* score areas
* resources
* prompts
* common rule declarations

## Layer C — Custom extension hooks

Advanced but supported:

* custom predicates
* custom target generation
* custom scoring/resolution helpers
* custom derived views
* custom AI hints
* custom interaction affordance policies

## Layer D — Experimental engine override mode

Opt-in and warned:

* creator edits engine-adjacent behavior
* may break compatibility
* may reduce AI guarantees
* may reduce marketplace eligibility at first
* should be visually marked as experimental

---

# Engine Core Specification

## 1. Deterministic state model

All runtime state must be deterministic and replayable.

### Requirements

* reducer must be pure
* no uncontrolled `Math.random()`
* all randomness comes from seeded RNG service
* no hidden dependence on wall clock
* state can be reconstructed from initial state + canonical action log
* serialization must be canonical enough for hashing/debugging

## 2. Canonical entities and zones

State should be normalized.

### Core concepts

* `GameInstanceState`
* `PlayerState`
* `Entity`
* `Zone`
* `ComponentInstance`
* `TurnState`
* `PendingDecision`
* `StackItem`
* `VisibilityMap`
* `RandomState`
* `DerivedView`

### Important distinctions

* owner
* controller
* viewer
* host/system actor

## 3. Action grammar

Players and effects should flow through a common action system.

### Example canonical actions

* `MOVE_ENTITY`
* `CREATE_ENTITY`
* `DESTROY_ENTITY`
* `SET_PROPERTY`
* `TRANSFER_CONTROL`
* `DRAW_FROM_ZONE`
* `SHUFFLE_ZONE`
* `REVEAL_ENTITY`
* `HIDE_ENTITY`
* `PROMPT_PLAYER`
* `CHOOSE_OPTION`
* `PASS_PRIORITY`
* `ADVANCE_STEP`
* `ADVANCE_PHASE`
* `END_TURN`
* `RESOLVE_STACK_ITEM`

### Principle

* user-facing actions can be ergonomic
* engine lowers them into canonical actions/effects
* reducer only applies canonical forms

## 4. Event and trigger pipeline

Every significant action may emit domain events.

### Support

* automatic triggers
* optional triggers
* replacement/prevention-style hooks
* immediate effects and stacked effects
* nested trigger chains
* ordering rules

### Pipeline outline

1. canonical action applied
2. event(s) emitted
3. replacement/prevention evaluated
4. trigger subscriptions checked
5. trigger records materialized
6. immediate effects resolved or stack items queued
7. priority window opened if required
8. stack or queue resolves

## 5. Priority / response model

Must support simple games and highly interruptible games.

### Configurable policies

* no-response mode
* limited response windows
* full priority cycle

### Needed capabilities

* active player order
* non-active response order
* pass handling
* auto-pass policies
* simultaneous trigger ordering rules
* forced vs optional responses

## 6. Dynamic turn engine

Turn structure must be data-driven.

### Support

* rounds
* turns
* phases
* steps
* extra turns
* skipped turns
* reversed turn order
* inserted phases/steps
* role-based sequencing

Turn order must be able to change midgame.

## 7. Hidden information / visibility

The engine must produce different state views per seat.

### Support

* hidden hands
* face-down cards/pieces
* secret objectives
* fogged metadata
* redacted logs
* role-based visibility
* spectator visibility

## 8. Legal move generation

This is a first-class subsystem.

### The engine must answer

* what can this player do right now?
* what objects are interactable?
* what destinations are legal?
* what sub-choices are required?
* which actions require prompts?

### Why it matters

* validates moves
* powers UI affordances
* powers AI seat play
* powers accessibility
* powers tutorialization and debugging

## 9. UI affordance generation

Default UI should light up legal interactions.

### Must support

* item -> destination
* destination -> item
* click actions
* popup option selection
* drag/drop
* pending decisions and follow-up choices

### Suggested outputs

* `interactableEntities`
* `validDestinationsByEntity`
* `validEntitiesByDestination`
* `availableActions`
* `pendingDecision`

## 10. AI play contract

AI seats should generally choose among legal moves emitted by the engine.

### Inputs

* player-visible state
* public summaries/logs
* rules summary
* legal move tree
* seat / role info
* optional strategy profile

### Outputs

* chosen legal move id
* parameters if needed
* optional rationale
* confidence / fallback metadata

### Modes

* heuristic AI for cheap automation
* LLM AI for strategic playtesting and reasoning

---

# Component System

## Philosophy

Creators should compose powerful reusable pieces rather than author everything from scratch.

## Component categories

* boards
* spaces
* tracks
* zones
* decks
* hands
* discard piles
* bags
* pieces
* cards
* tokens
* markers
* counters
* score areas
* resources
* prompts
* overlays
* action panels

## Hierarchical composition

Components may contain or reference other components.

Examples:

* board contains spaces
* track contains ordered spaces
* deck owns card entities and draw rules
* player area contains hand + discard + score + resources
* zone may expose default visibility and movement rules

## Component definition should include

* schema
* render hints
* placement constraints
* occupancy rules
* visibility defaults
* interaction affordances
* optional rule hooks
* AI hints

## Early first-party component targets

* square/cell board
* graph/adjacency board
* linear track
* circular track
* deck zone
* hand zone
* discard zone
* bag/random draw zone
* token piece
* resource counter
* score track
* modal choice prompt

---

# Rules Authoring Model

## Layer 1 — Declarative rules

For common use cases:

* setup
* turn structure
* move permissions
* zone definitions
* scoring
* win/loss conditions
* triggers
* default prompts
* visibility rules

## Layer 2 — Expressions

For conditions and formulas:

* filters
* comparisons
* selectors
* ownership/control checks
* numeric formulas
* target queries

## Layer 3 — Custom hooks

For advanced behavior:

* custom target generation
* custom effect resolution
* custom derived state
* custom AI hints
* custom interaction logic

## Rule authoring principle

Creators should only need code for edge cases, not for standard game mechanics.

---

# Multiplayer Model

## Event-sourced room model

* room has ordered move/action sequence
* clients submit moves through controlled RPC
* all clients subscribe to new actions/moves and replay locally
* snapshots may be stored for fast recovery

## Server authority in MVP

Server is authoritative for:

* room membership
* entitlement checks
* move ordering
* rate limits
* session lifecycle

Server is not authoritative for:

* arbitrary user-authored rule execution

## Anti-cheat reality

We cannot fully prevent malicious clients in MVP without authoritative simulation.
We can still enforce:

* membership
* ordering
* rate limits
* room host controls
* pause / kick / rewind
* deterministic replay for dispute review

---

# Commerce / Entitlements

## Marketplace entities

* published game listing
* purchases
* entitlements
* session-level access grants

## “One friend owns” rule

A room can run in `owned_required` mode if at least one current participant has entitlement.

Optional policy:

* owner must remain present
* otherwise room enters grace period and later closes

## Playtest override

If room is in playtest mode and dev allows access, purchase requirement is skipped.

## Payments

* Stripe Checkout
* webhook to Supabase Edge Function
* write purchases and entitlements on verified completion

---

# AI System

## Provider routing

Every AI call goes through Edge Functions.

### Edge function responsibilities

* validate auth
* validate tier
* enforce budgets/quotas
* validate model access
* estimate and charge usage
* add platform markup
* log usage ledger

## Modalities

* text
* code
* image
* audio
* game AI / reasoning

## User preferences

* default rules model
* default code model
* default image model
* default audio model
* default AI-opponent model or strategy profile

## AI game-dev support

The AI code agent should have access to:

* engine docs
* engine package README content
* public engine types
* component docs
* example games
* extension point documentation

This is much better than only giving it code.

---

# Supabase Integration

## Supabase responsibilities

* auth and profiles
* room metadata and moves
* entitlements and purchases
* AI usage ledger and billing state
* project metadata and permissions
* optional engine registry metadata
* RLS enforcement

## What Supabase should not do

* store big blobs when R2 is better
* run arbitrary creator game code
* become the primary Git store

## Engine metadata tables to add

* `engine_versions`
* `component_packs`
* `component_versions`
* `project_engine_dependencies`
* `engine_migrations`

These support discovery, pinning, compatibility, and upgrade flows even inside a monorepo product.

---

# Git Strategy

## Recommended

Use Gitea or Forgejo on a cheap VPS and proxy all access through Supabase Edge Functions.

## Browser safety rule

The browser never gets privileged Git credentials.

## Simplified Git UX

Expose only:

* modified files
* commit
* history
* revert
* publish snapshot from commit

Optional later:

* lightweight branches
* diffs
* PR-like review/change sets

---

# Build and Hosting Strategy

## Instant preview

* browser bundles current workspace
* preview runs on `play.<domain>`
* no server-side build required

## Published snapshot

* immutable build artifact
* stored in R2 under content-addressed or commit-based path
* used for playtests, releases, debugging

## Benefits

* low infra cost
* reproducible runtime
* safer isolation
* strong caching characteristics

---

# Observability and Admin Needs

## Minimum observability

* edge function structured logs
* AI billing decision logs
* failed webhook capture
* room activity metrics
* storage usage metrics
* top AI spenders

## Admin dashboard needs

* inspect AI ledger
* inspect entitlement issues
* inspect webhook failures
* inspect room counts / stuck rooms
* inspect storage usage

---

# Coding Standards and Constraints

## Hard constraints

* no paid managed services that break cost goals
* no secrets in client code
* all AI calls behind quota/budget checks
* uploads go direct to R2 via signed URLs
* never execute creator code on backend

## TypeScript / React rules

* strict TS
* zod validation for APIs and critical client inputs
* small composable editor views
* avoid oversized framework dependencies early

## Data access rules

* Supabase JS with RLS for normal reads/writes
* SQL/RPC for sensitive counters and billing operations
* avoid unbounded scans
* keep large artifacts out of Postgres

---

# Engine Override Policy

## Standard mode

* official engine only
* full compatibility guarantees
* recommended for most creators
* marketplace-ready path

## Advanced extension mode

* custom rules and extension hooks
* still supported
* still compatible when inside documented boundaries

## Experimental engine override mode

* explicit warning required
* reduced support guarantees
* possible AI/tooling degradation
* possible marketplace restriction initially
* should require an irreversible per-project opt-in setting or strong confirmation flow

---

# Documentation Plan

## Required docs tree

* `docs/engine/architecture.md`
* `docs/engine/state-model.md`
* `docs/engine/action-grammar.md`
* `docs/engine/triggers-and-priority.md`
* `docs/engine/turn-system.md`
* `docs/engine/component-model.md`
* `docs/engine/legal-move-generation.md`
* `docs/engine/ui-interaction-contract.md`
* `docs/engine/ai-player-contract.md`
* `docs/engine/extension-points.md`
* `docs/engine/experimental-engine-override.md`
* `docs/examples/sample-games.md`
* `docs/adr/*.md`

## Why this matters

These docs should be available to:

* human developers
* AI code agents
* future marketplace review/admin flows

---

# Detailed Multi-Phase Implementation Plan

## Phase 1 — Lock architecture doctrine

### Goal

Replace the template-first concept with the engine-and-components doctrine.

### Tasks

* write ADR confirming monorepo + package boundaries
* write ADR confirming engine-first instead of template-first
* define supported engine layers: core, components, extensions, experimental override
* define support policy for standard vs advanced vs experimental projects
* define first-party sample game targets

### Deliverables

* `docs/adr/0001-monorepo-engine-boundaries.md`
* `docs/adr/0002-engine-first-creator-paradigm.md`
* `docs/adr/0003-engine-override-policy.md`

### Done when

* architecture doctrine is approved and referenced by all future work

---

## Phase 2 — Restructure repo into monorepo packages

### Goal

Create clean internal package boundaries before feature growth makes this painful.

### Tasks

* move current app into `apps/web`
* create `apps/play-host`
* create `packages/engine-core`
* create `packages/engine-sdk`
* create `packages/engine-components`
* create `packages/engine-ui`
* create `packages/engine-ai`
* create `packages/shared-types`
* create `packages/shared-utils`
* set up workspace tooling
* configure TypeScript project references or equivalent monorepo build strategy
* add lint rules preventing deep internal imports across package boundaries

### Deliverables

* monorepo workspace config
* package build/test scripts
* path aliases or package exports

### Done when

* app can compile while importing only package public exports

---

## Phase 3 — Write engine documentation skeleton

### Goal

Create the AI- and human-readable documentation backbone before implementation gets too deep.

### Tasks

* create all engine docs files listed above
* write high-level summaries in each
* define glossary
* define invariants and non-goals
* document sample game categories the engine must support

### Deliverables

* complete docs skeleton with initial content

### Done when

* a new engineer or AI agent can navigate the engine plan from docs alone

---

## Phase 4 — Define state model and schemas

### Goal

Lock the normalized state model.

### Tasks

* define TypeScript interfaces and zod schemas for core state objects
* define entity ids, zone ids, component instance ids, player ids
* define ownership/control/viewer relationships
* define pending decision model
* define stack item model
* define visibility map model
* define random state model
* define derived view contract
* define serialization and stable hashing strategy

### Deliverables

* exported core types from `engine-core`
* schema validators in `shared-utils` or `engine-core`

### Done when

* state shape is sufficient for both board pieces and hidden-information card objects

---

## Phase 5 — Define canonical action grammar

### Goal

Create the universal action/effect language of the engine.

### Tasks

* define player-intent actions vs canonical engine actions
* create action taxonomy
* define validation rules for action payloads
* define canonical event emission rules for every action category
* document lowering rules from ergonomic user actions to canonical actions

### Deliverables

* action schemas
* action docs
* initial tests for validation

### Done when

* the reducer can eventually operate only on canonical actions

---

## Phase 6 — Build deterministic reducer core

### Goal

Implement the pure replayable engine center.

### Tasks

* implement reducer entrypoint
* implement action application pipeline
* implement seeded RNG service
* implement canonical serialization helpers
* implement stable sorting policies
* implement replay test harness
* add snapshot tests and seed-based determinism tests

### Deliverables

* reducer module
* deterministic replay suite

### Done when

* identical seed + action log always produces identical state and hashes

---

## Phase 7 — Build events, triggers, and stack/queue system

### Goal

Implement the Magic-like reactive rules backbone.

### Tasks

* define event bus abstraction inside engine
* define trigger subscriptions
* implement automatic triggers
* implement optional triggers
* implement replacement/prevention hooks
* implement immediate queue vs stack semantics
* define ordering rules for simultaneous triggers
* implement nested trigger chain handling

### Deliverables

* trigger engine
* trigger registration contracts
* trigger resolution docs

### Done when

* a sample game can cause one effect to trigger others and open response windows correctly

---

## Phase 8 — Build priority and response window system

### Goal

Support interruptible games and response-heavy flow.

### Tasks

* implement active player / responder order
* implement pass priority semantics
* implement auto-pass rules for simple games
* define per-game priority policy configuration
* implement forced prompt handling where responses are mandatory
* test simultaneous and nested response situations

### Deliverables

* priority manager
* response cycle tests

### Done when

* engine supports both no-response games and full stack-response games through configuration

---

## Phase 9 — Build dynamic turn system

### Goal

Support mutable turn/phase/step structures.

### Tasks

* model rounds/turns/phases/steps as data
* implement next-step resolution logic
* implement extra turns
* implement skipped turns
* implement reverse turn order
* implement inserted steps/phases
* document policy for turn-order mutations

### Deliverables

* turn manager
* turn structure schemas
* tests for midgame sequencing changes

### Done when

* a sample game can reverse or modify turn order midgame without hardcoded hacks

---

## Phase 10 — Build visibility and player-view system

### Goal

Produce safe role-based state views.

### Tasks

* define canonical full-state vs player-view state
* implement hidden/private/public field handling
* redact logs/events per viewer
* implement spectator view policy
* ensure legal move generation uses only allowed knowledge
* ensure AI input adapters use player-visible state only

### Deliverables

* visibility adapters
* player-view projection tests

### Done when

* different players can see different valid slices of the same game state

---

## Phase 11 — Build legal move generation

### Goal

Make the engine machine-readable and UI-ready.

### Tasks

* define legal move tree structure
* implement current-player action enumeration
* implement target selection and destination filtering
* implement prompted follow-up choices
* implement pass/cancel/confirm handling
* add legal move explanation metadata for debugging
* add tests for board placement, card play, and triggered decisions

### Deliverables

* move generator module
* move tree docs
* move explanation/debug data contracts

### Done when

* engine can describe all legal interactions for current player at any state

---

## Phase 12 — Build UI interaction contract and affordance adapters

### Goal

Connect engine legality to default UX behavior.

### Tasks

* define engine-ui interfaces for highlights, drag/drop, menus, pending decisions
* implement item -> destination affordance adapter
* implement destination -> item affordance adapter
* implement popup chooser contracts
* implement visual state for interactable/disabled/selected/targetable objects
* document keyboard-accessible equivalents

### Deliverables

* `engine-ui` package contracts
* initial shared UI primitives for highlights/selection

### Done when

* a consumer UI can render valid actions from engine outputs without custom game logic

---

## Phase 13 — Build component system foundations

### Goal

Create first-party placeable building blocks.

### Tasks

* define component manifest/schema format
* define component instance model
* define hierarchical composition model
* implement board, space, track, zone, deck, hand, discard, bag, piece, token, counter, score-track components
* define component-level render hints and interaction defaults
* define component placement constraints and occupancy rules

### Deliverables

* `engine-components` base catalog
* docs for each component category

### Done when

* a creator can assemble a non-trivial board/card game from built-ins without a template

---

## Phase 14 — Build rules authoring layers

### Goal

Make common game logic configurable before requiring code.

### Tasks

* define declarative rule schema
* define expression language and parser/evaluator or equivalent execution model
* define extension hook interfaces
* implement setup rules, scoring rules, win conditions, turn structure rules, triggers, visibility defaults
* document where declarative ends and custom hook begins

### Deliverables

* rules schema docs
* expression system
* hook interfaces in `engine-sdk`

### Done when

* standard rule authoring covers most common mechanics without deep engine edits

---

## Phase 15 — Build AI play contract and bot runner

### Goal

Support AI players and AI-assisted playtesting.

### Tasks

* define AI input envelope
* define AI output envelope
* implement legal-move-based move selection contract
* implement heuristic baseline bot
* implement LLM bot adapter
* implement rules summarization from docs/manifests for AI use
* implement cost controls and token budgeting for AI seat play

### Deliverables

* `engine-ai` interfaces
* basic AI runner
* one heuristic bot + one LLM-backed experimental bot

### Done when

* a room can contain at least one AI seat that chooses valid moves only

---

## Phase 16 — Build sample games and simulation harnesses

### Goal

Validate the engine against representative game archetypes.

### Tasks

* create internal test game: track/placement game
* create internal test game: stack/response card game
* create internal test game: worker placement / destination->item game
* create internal test game: turn-order mutation game
* implement self-play and random-play simulation harnesses
* implement replay test tooling
* implement regression case pack for engine bugs

### Deliverables

* sample games in repo
* simulation CLI/test utilities

### Done when

* the engine survives multiple archetypes without one-off architectural hacks

---

## Phase 17 — Integrate engine into creator editor

### Goal

Expose the new system inside the platform UI.

### Tasks

* replace template-first project creation with component-first project creation
* add component palette and placement workflow
* add board/zone layout editor
* add rules editor
* add move debugger panel
* add preview of interactable elements and legal move overlays
* add AI assistance grounded in engine docs and project context

### Deliverables

* component-first editor views in `apps/web`

### Done when

* a creator can assemble a playable prototype from built-in components inside the browser

---

## Phase 18 — Integrate multiplayer, entitlements, and play sessions

### Goal

Connect engine runtime to Supabase room workflows and commerce rules.

### Tasks

* implement room creation RPCs
* implement room join validation
* implement scoped play session token minting
* implement action append flow
* implement action subscriptions/replay
* wire room modes: playtest vs owned_required
* implement entitlement checks and one-owner-present policy
* test guest playtest flows

### Deliverables

* room lifecycle integration
* room UI
* entitlement-aware join flow

### Done when

* published or playtest builds can be joined safely under the intended rules

---

## Phase 19 — Integrate build/publish/Git workflows

### Goal

Connect engine-backed projects to low-cost shipping workflows.

### Tasks

* implement browser build pipeline for instant preview
* implement immutable published snapshot pipeline to R2
* connect simplified Git operations through edge proxies
* pin engine/component versions in project manifest
* store project build metadata and publish metadata in Supabase
* add compatibility warnings on publish

### Deliverables

* publish flow
* version-pinned build manifests
* Git-backed commit/revert history in UI

### Done when

* creators can preview and publish engine-based games without server-side code execution

---

## Phase 20 — Add advanced extension mode and experimental engine override mode

### Goal

Support power users without damaging the default product path.

### Tasks

* define project-level capability flags
* implement advanced custom hooks workflow
* gate experimental engine override mode behind explicit confirmation
* add UI warnings and support disclaimers
* add docs for reduced guarantees
* optionally restrict experimental mode from marketplace publishing at first
* ensure AI agent knows project mode and warns accordingly

### Deliverables

* advanced and experimental mode settings
* docs and support policy

### Done when

* power users can go deeper while the mainstream path remains safe and coherent

---

# Continued Development Workstreams Beyond Core Engine

## Creator UX workstream

* component palette search/filtering
* board layout editing UX
* rules editor ergonomics
* Git history view
* AI change review UI
* move debugger and event timeline

## Player UX workstream

* frictionless room join
* room lobby UX
* AI seat configuration UX
* ownership and playtest messaging
* reconnect / resume flow

## Marketplace workstream

* listing authoring
* screenshots/assets pipeline
* purchase flow
* entitlement-aware room launch
* moderation/review workflow later

## Ops workstream

* logs and admin views
* failed webhook handling
* spend controls
* storage monitoring
* room cleanup jobs

## Documentation workstream

* engine docs
* author docs
* AI grounding docs
* sample game docs
* migration docs

---

# Human To-Do List (Manual / Account / Billing / Infra)

These are the tasks that still need a human to do outside normal coding.

## Domain and DNS

* [X] Buy and maintain the production domain if not already done.
* [ ] Set DNS records for `turnbased.app`, `app.turnbased.app`, `play.turnbased.app`, and `git.turnbased.app`.
* [ ] Confirm Cloudflare proxy and SSL settings are correct for each subdomain.

## Cloudflare

* [X] Create or verify the Cloudflare account and attach billing.
* [X] Create Pages project(s) for web app deployment.
* [X] Create R2 buckets for builds and assets.
* [ ] Configure R2 CORS rules for browser uploads and play-host access.
* [ ] Configure cache rules and security headers for `play.turnbased.app`.
* [ ] Decide whether to use a Worker for gated build access and, if yes, enable billing/features required.

## Supabase

* [ ] Create the production Supabase project.
* [ ] Confirm billing tier and card on file.
* [ ] Store production secrets in Supabase secrets/vault.
* [ ] Configure auth providers and email settings.
* [ ] Configure redirect URLs for app and play origins.
* [ ] Review and enable backups / retention appropriate for the chosen plan.
* [ ] Confirm region choice is acceptable before data accumulates.

## Stripe

* [X] Create or verify Stripe account.
* [ ] Submit any required business verification.
* [ ] Add business banking / payout details.
* [ ] Add live mode card/billing details if required.
* [ ] Configure products/prices strategy.
* [ ] Create production webhook destination for Supabase edge function.
* [ ] Rotate test keys to live keys when ready.
* [ ] Confirm tax, receipts, and support email settings.
* [ ] Review whether Stripe Connect is needed later or not.

## Git service / VPS

* [X] Create VPS account (DigitalOcean, Hetzner, or chosen provider).
* [X] Add payment method.
* [X] Provision server.
* [X] Install Docker and persistent volume setup.
* [X] Deploy Gitea/Forgejo.
* [ ] Configure backups for Git repos and config.
* [ ] Set HTTPS/TLS strategy correctly; do not rely on insecure shortcuts long term.
* [ ] Create service PAT / bot credentials and store them in Supabase secrets.

## AI provider accounts

* [X] Create and fund OpenRouter account.
* [ ] Decide model allowlist by tier.
* [ ] Set provider spending caps.
* [ ] Create accounts for image/audio providers when ready.
* [ ] Store provider API keys securely in secrets manager.

## Email / transactional comms

* [ ] Choose and configure email provider for auth and transactional emails if Supabase defaults are not sufficient.
* [ ] Verify sending domain if needed.
* [ ] Configure support/reply addresses.

## Legal / business basics

* [ ] Decide legal entity structure for taking payments.
* [ ] Prepare privacy policy.
* [ ] Prepare terms of service.
* [ ] Prepare acceptable use policy.
* [ ] Decide refund policy.
* [ ] Decide policy for experimental engine override projects in marketplace.

## App-store-like policy decisions

* [ ] Decide whether experimental engine override projects can be published publicly.
* [ ] Decide what support level to promise for advanced vs experimental projects.
* [ ] Decide whether AI-generated assets need special disclosure.
* [ ] Decide moderation/review approach for user-generated game content.

## Security and operations

* [ ] Set up password manager or secret-sharing process for team credentials.
* [ ] Enable MFA on Cloudflare, Supabase, Stripe, Git service host, and AI provider accounts.
* [ ] Decide backup strategy for Postgres, Git repos, and R2 bucket metadata.
* [ ] Decide incident response contacts and recovery process.

## Documentation and process

* [ ] Decide commit message convention.
* [ ] Decide release/versioning convention for engine packages.
* [ ] Decide ADR template and governance process.
* [ ] Decide how AI agent context is assembled from docs and code.

---

# Recommended Immediate Next Steps

## This week

* finalize the monorepo/package boundary decision in ADR form
* scaffold the monorepo package structure
* write the engine docs skeleton
* define the state model and action grammar before building editor surfaces

## Before live money

* fully configure Stripe live mode and webhooks
* verify secrets management and MFA everywhere
* review SSL/TLS and origin separation
* confirm privacy policy / terms / refund stance

## Before marketplace launch

* lock engine versioning policy
* lock experimental mode policy
* lock entitlement and owner-present rules
* finish at least 3-4 representative internal sample games

---

# Golden Rules (Revised)

* Commit code changes frequently with informative commit messages.
* Update project knowledge and docs whenever something important is learned.
* Keep ADRs current when architectural decisions change.
* Keep package boundaries hard even inside the monorepo.
* Prefer official extension points over ad hoc engine edits.
* Never execute untrusted creator code on the backend.
* Keep legal move generation central to UI and AI behavior.
* Pin engine and component versions for published builds.
* Update any project ToDo lists by marking completed items clearly.
