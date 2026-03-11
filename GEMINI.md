# claude.md — Digital Board Game Design + Play Platform

## One-liner
A browser-first platform where **board game developers** build digital tabletop games using **templated repos, a simplified Git workflow, and AI agents**, while **players** can play, playtest, and purchase games—**with multiplayer in-browser**—all on a **low fixed-cost, low-egress architecture**.

---

## Product Scope

### Primary Personas
#### 1) Developer (Game Creator)
Goals:
- Create a new game project from a **pre-bootstrapped template**.
- Edit game rules/code/assets **in the browser**.
- Use **AI agents** to implement features, refactor, generate assets, write rules text, etc.
- Preview a **live prototype** while developing.
- Run **multiplayer playtests** with community.
- Publish and sell games.

Constraints:
- Must be easy for non-engineers: “dumbed down Git”
- Must support “AI-first” workflows
- Must support multiple AI models per task type

#### 2) Player (Community / Customer)
Goals:
- Create an account (or join playtests quickly).
- Join a multiplayer room and play.
- Buy a game and play with friends.
- Participate in playtests if allowed.

Constraints:
- Smooth join + multiplayer UX
- Minimal friction to playtest (anonymous/guest support)
- Purchases should unlock access cleanly

---

## Requirements (Derived from Your List)

### R1 — Dev workflow in-browser
- Projects are created from a curated list of **templates** (“quickstarts”).
- Devs edit via:
  - Rules editor view
  - Code editor view
  - Asset manager view
  - Git history view (commit / revert / branch-lite)
- AI agents can:
  - edit files, create commits, open PR-like “change sets”
  - generate assets (img/audio), rules text, code

### R2 — Live prototype during development
- Developers can run:
  - **Instant local preview** (based on current workspace)
  - **Shareable multiplayer demo** (published build snapshot)

### R3 — Multiplayer prototypes + community playtests
- Devs can create playtest rooms and invite community.
- Rooms support real-time multiplayer (board-game cadence, low tick rate).
- Dev decides whether playtests are:
  - public (discoverable)
  - invite-only (code/link)
  - friends-only (allowlisted)

### R4 — Retail purchase + “one friend owns” access
- Players can buy games.
- A group can play together if **at least one participant owns** the game.
- Playtests override purchase rules if dev allows it.

### R5 — Minimum fixed infra cost, low-egress
- No expensive managed hosting for builds.
- Don’t run arbitrary untrusted user code server-side.
- Use storage + CDN patterns with free/cheap tiers.

### R6 — Git backend is flexible
- We can use a self-hosted Git service, or a custom minimal Git store.
- The UX must remain “simple Git”.

### R7 — Multi-model AI routing
- Users can pick:
  - Model A for rules text
  - Model B for code agent
  - Model C for images
  - Model D for audio
- System enforces:
  - tier access
  - quotas/budgets
  - per-call markup for pay-as-you-go

---

## Explicit Non-Goals (MVP)
To keep cost + complexity down:
- No full “Roblox-like” runtime with authoritative server simulation.
- No running user code on the backend for validation.
- No heavy collaborative code editing (Google-Docs style) in MVP.
- No physical print-and-ship in MVP (design for it later).

---

## Architecture Overview (Low fixed cost, scalable variable cost)

### Key Principle: “Untrusted code runs only in the browser”
We never execute arbitrary developer code on our servers.

That means:
- Game logic runs client-side in an isolated Play origin.
- Multiplayer sync is event-based via DB + realtime.
- Server is authoritative for:
  - membership
  - ordering
  - entitlement checks
  - rate limits
…but **not** for game rule validation.

### Components (Recommended)
- **Frontend App**: React + Vite + Tailwind on Cloudflare Pages
- **Play Host**: Separate origin (e.g., `play.<domain>`) served via Cloudflare + R2 (static build snapshots)
- **Backend**: Supabase Postgres + RLS + Edge Functions (auth + gatekeeping + payments webhooks + AI proxy + Git proxy)
- **Storage**:
  - Cloudflare R2 for assets + published builds (zero/low egress)
- **Git** (choose one):
  - **Option A (recommended)**: Forgejo or Gitea on a small VPS (Hetzner)
  - Option B: Bare git repos + minimal HTTP API (harder; do later only if needed)
- **AI Providers**:
  - OpenRouter for text/code
  - Fal/Recraft for images (or equivalents)
  - Audio provider(s) later (model-agnostic interface)

## Origins & Security Boundaries (Critical)

### Separate Origins
- `app.<domain>`: authenticated creator dashboard + editor
- `play.<domain>`: runs untrusted game code

Never share cookies/localStorage across these origins.

### Iframe sandboxing
When embedding play inside the editor:
- Use `<iframe sandbox="allow-scripts allow-pointer-lock allow-fullscreen">`
- Do NOT use `allow-same-origin` unless there’s a strong reason.
- Use strict CSP headers on `play.<domain>`.

### Prevent token leakage
- The game runtime must not receive the user’s full Supabase session token.
- Instead, generate a **scoped “play session token”** with only the ability to:
  - join a specific room
  - read/write moves for that room
  - read the build snapshot

---

## Game Packaging Model (Templates + SDK)

### Standardized “Game SDK”
Each template repo includes a small runtime SDK (internal package) that provides:
- deterministic state reducer
- multiplayer transport (subscribe to moves + send move)
- asset loading helpers
- minimal UI primitives (optional)

We want all games to:
- accept `roomId` / `joinCode`
- apply moves in order
- render state

### Templates (quickstarts)
Each template should define:
- entrypoint: `src/main.tsx`
- game reducer: `src/game/reducer.ts`
- move types: `src/game/moves.ts`
- UI: `src/ui/*`
- manifest: `game.json` (name, version, min platform version, capabilities)

---

## Live Preview & “Published Build” Strategy

### Two preview modes
#### 1) Instant Preview (Developer-only)
- In-editor “Preview” bundles the current workspace **in the browser** (WASM bundler)
- Output runs in `play.<domain>` iframe using a blob URL or a “dev preview” endpoint
- Fast feedback loop, no publishing required

#### 2) Published Snapshot (Shareable + Multiplayer)
- “Publish Demo” produces an immutable build artifact:
  - HTML + JS + assets
  - fingerprinted filenames (cache forever)
- Stored in R2 under:
  - `builds/{projectId}/{commitSha}/...`
- This snapshot is used for:
  - community playtests
  - marketplace releases
  - reproducible bug reports

**Why browser-bundling is preferred**
- Avoids server-side builds (cost + RCE risk)
- Makes infra cost flat at scale
- Keeps previews fast and safe

---

## Multiplayer Model (MVP): Event-sourced Rooms

### Core idea
- Room has a move sequence counter
- Clients append moves via a controlled RPC
- All clients subscribe to INSERT events (realtime) and apply moves locally

### Determinism requirements
- Game reducer must be deterministic:
  - no `Math.random()` without seeded RNG
  - no time-based branching without synchronized clocks
- Provide SDK utilities:
  - seeded RNG
  - canonical serialization for moves/state hashes

### Anti-cheat (MVP-level)
We cannot fully prevent malicious clients without authoritative simulation.
Instead we implement:
- membership enforcement
- move ordering
- rate limits
- optional “host adjudication” mode (host can kick / pause / rewind to snapshot)

For a board game platform, this is acceptable for MVP.

---

## Commerce / Entitlements

### Entities
- A “game” is a published listing tied to a build snapshot.
- A “purchase” grants entitlement to a user.
- A “play session” grants temporary access to participants (friends) if:
  - ANY participant has entitlement, OR
  - dev has enabled playtest access.

### Rule: “Play with friends if one of you bought it”
Implementation strategy (simple + enforceable):
- Session has a `license_mode`:
  - `owned_required`: requires that at least one current participant has entitlement
  - `playtest`: dev-authorized (invite/code/allowlist)
- Join flow checks:
  - If `playtest`, allow
  - Else ensure at least one member with entitlement is currently in the room
- Optional extension:
  - “license holder” must remain present, or session expires after grace period

This avoids “one person buys then everyone plays forever”.

### Stripe (suggested)
- Stripe Checkout + webhooks -> Supabase Edge Function webhook receiver
- Write `purchases` + `entitlements` tables in Postgres
- RLS ensures users only see their own purchases

---

## AI System (Multi-model, multi-provider)

### Requirements
- Every AI request routes through Supabase Edge Function:
  - validates auth
  - checks tier + credits/budgets
  - enforces model access
  - charges usage + markup
  - logs usage ledger

### Model registry
Maintain an internal registry:
- provider (`openrouter`, `fal`, `recraft`, `audioX`)
- model_id
- modality (`text`, `code`, `image`, `audio`)
- tier availability (`free`, `pro`, `payg`)
- pricing metadata (for cost estimation)
- enabled/disabled toggle

### User preferences
Store per-user defaults:
- `default_rules_model`
- `default_code_model`
- `default_image_model`
- `default_audio_model`

The UI allows per-task override.

### Monetization logic
- PAYG: debit wallet per call + `$0.01` platform fee
- SUBSCRIPTION: monthly included credits + discounted rate + platform margin
- SALES: platform fee on marketplace purchases (future phase)

---

## Data Model (MVP Tables)

### Core identity / tiers
- `profiles`
  - `id` (auth uid)
  - `tier` (`free|pro|payg`)
  - `wallet_cents`
  - `monthly_included_cents_remaining`
  - `ai_prompts_used_today`, `ai_prompts_date`
  - `art_bytes_used`
  - `created_at`

### Projects / templates / git mapping
- `project_templates`
  - `id`, `name`, `description`, `git_template_repo`, `enabled`
- `projects`
  - `id`, `owner_id`, `name`, `template_id`, `created_at`
- `project_repos`
  - `project_id`, `git_repo_ref` (owner/name), `is_private`, `default_branch`

### Builds
- `project_builds`
  - `id`, `project_id`, `commit_sha`, `r2_prefix`, `created_at`, `created_by`
  - `is_release_candidate`, `notes`

### Assets
- `assets`
  - `id`, `owner_id`, `project_id`, `kind` (`image|audio|other`)
  - `r2_key`, `bytes`, `mime`, metadata json
  - `visibility` (`private|public|unlisted`)

### Multiplayer
- `mp.rooms`
  - `id`, `build_id`, `host_user_id`, `join_code`, `status`, `max_players`
  - `license_mode`, `listing_id` (nullable), `created_at`, `last_activity_at`
- `mp.room_members`
  - `room_id`, `user_id`, `display_name`, `is_host`, `left_at`
- `mp.moves`
  - `room_id`, `seq`, `user_id`, `move` jsonb, `created_at`
- `mp.room_state` (optional snapshots)
  - `room_id`, `seq`, `state` jsonb, `hash`, `updated_at`

### Marketplace / listings
- `listings`
  - `id`, `dev_id`, `project_id`, `build_id`
  - `title`, `description`, `price_cents`, `status` (`draft|published|hidden`)
  - `created_at`
- `purchases`
  - `id`, `buyer_id`, `listing_id`, `stripe_payment_intent`, `price_cents`, `created_at`
- `entitlements`
  - `buyer_id`, `listing_id`, `created_at`

### AI billing
- `ai_models`
  - `provider`, `model_id`, `modality`, `enabled`, `tier_min`, `price_meta`
- `ai_usage_ledger`
  - `id`, `user_id`, `provider`, `model_id`, `modality`
  - `provider_cost_cents`, `platform_fee_cents`, `total_charged_cents`
  - `request_meta`, `response_meta`, `created_at`

---

## API Surface (Edge Functions + RPC)

### Edge Functions (HTTP)
- `POST /ai/text`
- `POST /ai/code-agent`
- `POST /ai/image`
- `POST /ai/audio` (later)
- `POST /git/create-project-from-template`
- `POST /git/read-file`
- `POST /git/write-file`
- `POST /git/commit`
- `POST /git/list-tree`
- `POST /r2/sign-upload`
- `POST /r2/finalize-upload`
- `POST /build/publish` (optional wrapper; can be client-only + finalize call)
- `POST /stripe/webhook`

### Postgres RPC (preferred for atomic operations)
- `consume_ai_budget(...)`
- `wallet_debit(...)`
- `mp.create_room(...)`
- `mp.join_room(...)`
- `mp.append_move(...)`
- `assert_repo_limit(...)`
- `increment_storage_usage(...)`

**Guideline:** enforce quotas and counters in SQL/RPC whenever possible (atomic + fast). Edge Functions orchestrate and call providers.

---

## RLS Policy Principles

1) **Users can only see their own dev assets/projects** by default.
2) Published marketplace content is readable by everyone:
   - listings with `status='published'`
   - build snapshots for those listings
3) Multiplayer tables are member-only visible:
   - room members can read/write moves
4) No direct client writes to:
   - wallets
   - usage counters
   - entitlements
   - quota fields
   These must be written via RPC/Edge with strict checks.

---

## Git Strategy (Min cost, max simplicity)

### Recommended: Forgejo/Gitea on VPS
Why:
- Solves Git storage + refs + history cheaply
- Has stable API primitives
- Easy template-based repo generation
- Low operational overhead compared to rolling your own Git server API

**Important security constraint**
- The browser must NOT talk directly to Git service with privileged tokens.
- Use Edge Functions as a proxy to:
  - enforce tier limits (repo count)
  - enforce per-project ownership
  - prevent repo enumeration
  - keep tokens server-side only

### Simplified Git UX (“dumbed down”)
Expose only:
- status (modified files)
- commit with message
- history list
- revert to commit
- “publish snapshot” from commit
Optional later:
- branches (lightweight)
- merge UI
- diff view

---

## Build/Run-time Hosting (R2 + Cloudflare)

### Build storage
- Immutable build artifacts stored in R2.
- Public or gated via token depending on listing/playtest rules.

### Serving strategy
- Published listings: cache aggressively (immutable URLs)
- Playtests: “unlisted” but still gated by session token when needed

### Session-gated builds (for prototypes)
- Use a lightweight gate:
  - A signed token minted by Edge Function
  - Worker checks token then serves files from R2

(Keep this optional for MVP if “unguessable URLs” are acceptable short-term, but plan to add gating quickly.)

---

## Observability (Cheap but necessary)
- Postgres: record error logs for AI calls + billing decisions
- Edge Functions: structured logging
- Basic admin dashboard:
  - realtime connections (approx)
  - AI usage by day
  - top storage users
  - failed webhook events

---

## Coding Standards & Constraints (for the coding agent)

### Hard constraints
- Do not add paid managed services that break low fixed-cost requirements.
- Never store secrets in client code. Only env vars and server-side.
- All AI calls must be behind quota checks.
- Files must be uploaded directly to R2 using presigned URLs.
- Never execute user code on backend.

### TypeScript + React rules
- Use strict TS.
- Prefer `zod` for input validation (both client and Edge).
- Prefer small, composable components per view: GitView, RulesView, AssetsView, PlayView.
- Avoid heavy editor frameworks unless necessary; start simple.

### Data access rules
- Use Supabase JS client with RLS.
- For “sensitive writes” use RPC and keep logic in SQL.
- Avoid expensive queries (no unbounded scans).

### Cost hygiene
- Avoid storing large blobs in Postgres.
- Cache static build artifacts via immutable keys.
- Use event-sourcing for multiplayer to keep server logic minimal.

---

# TODO — Coding Agent (Phased, Implementable)

## Phase 0 — Repo + environments
- [x] Create monorepo structure:
  - `apps/web` (React app)
  - `supabase/` (migrations, functions)
  - `packages/sdk` (game runtime SDK)
  - `packages/ui` (shared UI)
- [x] Add `.env.example` with all required variables (no secrets)
- [x] Add basic CI lint/typecheck

## Phase 1 — Auth, profiles, tiers, quotas
- [x] Implement `profiles` table + RLS
- [x] Implement tier enums and quota constants (server-side only)
- [x] Add RPC functions:
  - `wallet_debit`
  - `consume_daily_prompt`
  - `consume_monthly_credits`
- [x] Build UI: Settings (tier, usage, wallet)

## Phase 2 — Templates + project creation
- [x] Implement `project_templates`, `projects`, `project_repos`
- [x] Add Edge Fn: `git/create-project-from-template`
  - checks repo quota
  - creates repo from template
  - writes DB rows
- [x] Build UI: New Project flow + template gallery

## Phase 3 — Git browser + editor core
- [x] Git proxy endpoints:
  - list tree, read file, write file, commit, history, revert
- [x] Build UI:
  - GitView: history + revert + commit
  - CodeView: file tree + editor
- [x] Store workspace edits locally (IndexedDB) before commit (optional)

## Phase 4 — AI “coding agent” integration
- [x] Add `/ai/code-agent` Edge Fn:
  - validates model selection
  - consumes budget
  - streams response
- [x] Implement “agent plan” format:
  - agent proposes file edits
  - user approves
  - agent writes via git proxy and commits
- [x] Add model selection per task type (rules/code)

## Phase 5 — Assets (R2) + AI art/audio
- [x] Implement `assets` table + RLS
- [x] Add Edge Fn:
  - `r2/sign-upload`
  - `r2/finalize-upload` (HEAD object, enforce quota, insert row)
- [x] Build UI: Asset gallery + uploader
- [x] Add `/ai/image` with tier routing + ledger
- [x] Stub `/ai/audio` (interface + placeholder provider)

## Phase 6 — Preview + Build publishing
- [x] Implement in-browser bundling for preview
- [x] Implement `project_builds` + publish flow:
  - publish build snapshot to R2
  - record build row (commit SHA)
- [x] Create PlayView:
  - iframe to `play.<domain>` build URL
  - session token handshake (if gating enabled)

## Phase 7 — Multiplayer playtests
- [ ] Implement `mp.*` tables + RLS
- [ ] Implement RPC:
  - `mp.create_room`
  - `mp.join_room`
  - `mp.append_move` (atomic seq)
- [ ] Build UI:
  - LobbyView (players, join code)
  - In-game overlay (invite link, reconnect)
- [ ] Add Presence integration

## Phase 8 — Marketplace + purchases
- [ ] Implement `listings`, `purchases`, `entitlements`
- [ ] Developer UI: create listing from a build
- [ ] Player UI: browse listings + buy
- [ ] Stripe webhook Edge Fn:
  - verify signature
  - write purchase + entitlement
- [ ] Enforce licensing in room joins:
  - owned_required vs playtest

## Phase 9 — “One friend owns” session enforcement
- [ ] Implement entitlement checks in:
  - room create
  - room join
- [ ] Add rules:
  - require entitlement holder present OR enforce grace timer
- [ ] Add UX messages (why join denied)

## Phase 10 — Abuse controls
- [ ] Rate limiting per user for:
  - room joins
  - move appends
  - anonymous sign-ins
- [ ] CAPTCHA integration for anonymous sign-in
- [ ] Move payload size enforcement

---

# TODO — Human (Accounts, Keys, Setup)

## Cloudflare
- [ ] Create Cloudflare account + add domain
- [ ] Create:
  - Pages project for `app.<domain>`
  - Pages or Worker/R2 binding for `play.<domain>`
- [ ] Create R2 bucket(s):
  - `assets`
  - `builds`
- [ ] Configure CORS for R2 uploads (PUT)
- [ ] Set cache headers strategy for builds (immutable)

## Supabase
- [ ] Create Supabase project
- [ ] Configure Auth:
  - email auth
  - anonymous auth enabled (for playtests)
- [ ] Add secrets to Supabase:
  - Git service token
  - AI provider keys
  - Stripe webhook secret
- [ ] Apply migrations + verify RLS policies

## Git Service (if using Forgejo/Gitea)
- [ ] Provision small VPS
- [ ] Install Forgejo/Gitea + secure it:
  - firewall, HTTPS, private networking if possible
- [ ] Create admin/service token
- [ ] Create template repos (quickstarts)
- [ ] Store token in Supabase Edge secrets

## AI Providers
- [ ] OpenRouter API key
- [ ] Image provider keys (Fal/Recraft or chosen alternatives)
- [ ] Decide on audio provider(s) (later)
- [ ] Establish internal model registry values:
  - allowed free-tier models
  - premium models
  - cost estimation metadata

## Payments
- [ ] Create Stripe account
- [ ] Setup products/prices:
  - Pro subscription
  - PAYG credit packs (optional)
- [ ] Configure webhook endpoint to Supabase Edge Fn
- [ ] Add tax/VAT settings (as needed)

## Policy / Legal / Safety (minimum viable)
- [ ] Terms of Service + Privacy Policy drafts
- [ ] Moderation policy for public playtests/listings
- [ ] DMCA/contact process (basic)

---

## “Make it awesome” Extras (Post-MVP, Still Low Infra)
- Deterministic replay + shareable match replays (store move log)
- Built-in bug report: attach build id + move sequence + state hash
- Spectator mode using broadcast fan-out (avoid DB auth bottlenecks)
- Creator analytics: playtest funnel, retention
- Print-and-ship integration later:
  - export printable assets (PDF)
  - partner fulfillment API
  - versioned print packs

---

## Acceptance Criteria (MVP Definition of Done)

### Developer can:
- create project from template
- edit files in browser
- run instant preview
- publish a build snapshot
- start a multiplayer playtest room
- invite others with link/code

### Player can:
- join a playtest room (anonymous or account)
- play multiplayer with friends (move sync + presence)
- buy a game listing
- host/join a purchased game session where “one owner” rule is enforced

### Platform enforces:
- tier quotas (repos, storage, AI)
- AI billing + markup ledger
- RLS isolation for private projects/assets
- safe origin separation for untrusted game code

---

## Implementation Notes (Decisions to lock early)
1) Keep runtime deterministic; ship a small SDK.
2) Keep multiplayer event-sourced; don’t attempt server-side simulation.
3) Use immutable published builds; it simplifies caching, debugging, and sales.
4) Proxy Git through Edge Functions; do not expose Git tokens to the browser.
5) Use scoped play session tokens; never leak full auth tokens into game runtime.

---

# THe Golden Rules

Commit your code changes to git frequently with informative commit messages.

Update your knowledge, whenever you learn something.  

and update teh ToDo lists here by marking an X in the []  when you are done with that task.