# Aider + OpenRouter Workspace Plan

## Current Implementation Status

The repo now has a smaller first slice of this vision in place:

- `Build with AI` calls a Supabase edge function backed by OpenRouter
- the model returns a constrained game blueprint instead of editing files directly
- the browser materializes that blueprint into a previewable TurnBased workspace
- the first commit is created automatically, with Supabase-backed git history when the user is signed in

This means the current product is aligned with the AI-first and versioned-project direction, but it is not yet the full isolated `aider` workspace architecture described below.

## Recommendation

Use `aider` as the coding worker and route model traffic through OpenRouter.

Why this is the current best fit for TurnBased:

- `aider` is a real coding CLI with strong file-edit workflows.
- It supports multiple providers and OpenRouter directly.
- We can keep the model choice configurable without rebuilding the worker.
- It is easier to swap models later than if we build around a provider-specific CLI.

## Product Goal

Turn the `Build with AI` action into a real project-generation job that:

- reads the game brief
- reads engine docs and API summaries
- reads component catalog and runtime contracts
- writes only inside the user's project workspace
- returns a generated workspace that the editor can open immediately

## Non-Negotiable Boundary

The AI worker may:

- read prompt-pack files
- read engine/API reference files copied into the job context
- read generated acceptance criteria and component summaries

The AI worker may not:

- write into the monorepo outside the target project workspace
- modify shared engine packages directly
- depend on hidden repo state that is not explicitly copied into the prompt pack

## Shared Engine vs Project Workspaces

TurnBased should use one shared platform/engine codebase and many separate project workspaces.

### Shared platform codebase

This repo is the shared platform layer:

- engine packages
- editor and web app
- worker infrastructure
- shared docs
- component/runtime contracts

This codebase is maintained by platform developers and is shared across all user-created games.

### Per-project workspace

Each generated game should live in its own separate workspace:

- project files
- rules
- components
- app layout
- assets
- manifests
- per-project git history

The important boundary is:

- agents may read shared engine context
- agents may write only inside the current project workspace
- git commits for generated games belong to the project workspace, not the shared platform repo

### Practical example

Think of the final system like this:

- `/platform`
  - shared engine packages
  - shared editor
  - shared docs
- `/projects/<project-id>`
  - that project's files
  - that project's `.git`

In that model:

- all projects share the same engine
- each project has isolated source files
- each project has isolated version history
- normal game creation does not modify the shared engine repo

### Why this model is preferred

- engine upgrades happen centrally
- user projects stay isolated from each other
- project history is clean and per-project
- generated games depend on the engine instead of copying it
- the AI worker can be sandboxed safely

## Recommended Runtime Shape

Run `aider` inside an isolated job container or sandbox with two mounted areas:

- read-only context mount
  - `/context`
  - contains copied engine docs, API docs, component summaries, examples, and the user's brief
- writable workspace mount
  - `/workspace`
  - contains only the target project files the worker is allowed to create or modify

This is the simplest way to enforce:

- broad repo read access through curated copied context
- project-only write access through filesystem isolation

## Job Lifecycle

### 1. Browser submits build request

The web app sends:

- project id
- rules brief
- player metadata
- selected model
- optional build mode

Suggested endpoint:

- `POST /api/projects/:projectId/ai-build`

### 2. Server creates workspace

The worker service creates a fresh project workspace:

- initialize workspace directory
- initialize git repo
- write initial files
- write prompt-pack files under a hidden folder such as `.turnbased/`

Suggested initial files:

- `turnbased.project.json`
- `turnbased.brief.json`
- `turnbased.app-layout.json`
- `README.md`
- `.turnbased/engine-api.md`
- `.turnbased/build-constraints.md`
- `.turnbased/component-catalog.json`
- `.turnbased/acceptance-checklist.md`

### 3. Server materializes the prompt pack

Do not give the agent the whole repo.

Instead copy only the files we want it to reason over:

- the model-facing Engine API doc
- the rules brief
- component catalog summaries
- relevant engine docs
- one or two example generated projects
- a short write-boundary policy

This keeps prompts stable and prevents accidental hidden dependencies.

### 4. Run aider inside the isolated workspace

Run `aider` with:

- cwd set to `/workspace`
- model set to the configured OpenRouter model
- auto-commit enabled for checkpoints if desired
- explicit file list where useful
- non-interactive mode

The important part is not the exact command shape. The important part is:

- `aider` only sees writable project files in `/workspace`
- all other guidance is provided through read-only context files

### 5. Verify before accepting output

After generation, the worker should run local checks against the generated workspace:

- schema validation
- runtime build
- preview compilation
- project manifest checks

Suggested validation stages:

1. parse generated files
2. compile preview runtime
3. run minimal smoke tests
4. if validation fails, let the agent perform one or two repair passes

### 6. Save versioned result

On success:

- commit generated files into the project workspace git history
- return workspace metadata to the web app
- open the editor in post-build mode

## Prompt Pack Design

The initial prompt should be short and stable. Most detail should live in files.

### System prompt goals

The system prompt should tell the worker:

- you are generating a TurnBased project workspace
- you must follow the Engine API doc exactly
- you may only write inside `/workspace`
- prefer declarative rules and built-in components
- do not edit engine packages
- if the brief is underspecified, choose the simplest legal playable interpretation

### Suggested system prompt

```text
You are building a TurnBased game project inside /workspace.

Follow /context/engine-api.md as the source of truth for engine boundaries and allowed APIs.
Use built-in components and declarative rules whenever possible.
Do not modify shared engine code or assume undocumented APIs.
You may read files under /context.
You may write only inside /workspace.

Your goal is to produce a minimal but playable project scaffold that:
- matches the setup brief
- compiles in the local project validator
- opens in the TurnBased editor
- supports live preview with legal moves

When the brief is ambiguous, prefer the simplest playable interpretation.
Keep the project modular and easy for later refinement by humans and follow-up agents.
```

### Suggested user prompt template

```text
Build a new TurnBased game project from the attached setup brief.

Requirements:
- create a playable first version, not a speculative design document
- preserve the requested player range, solo/campaign flags, theme, and art style
- reflect the requested theme in names and app layout copy
- create a linked multi-view shell with one shared board view plus one player view per seat
- give each player 6 starting block resources with Lucide-first avatar fallbacks
- create only the components needed for the first playable build
- keep rules concise and deterministic

Read these files first:
- /context/engine-api.md
- /context/turnbased.brief.json
- /context/component-catalog.json
- /context/acceptance-checklist.md

Then generate or update files inside /workspace only.
```

## Files the Worker Should Receive

Minimum prompt-pack files:

- `engine-api.md`
  - compact model-facing engine contract
- `turnbased.brief.json`
  - user setup brief, player range, theme, art style, and generation flags
- `component-catalog.json`
  - summarized built-in components and their important properties
- `acceptance-checklist.md`
  - concrete must-pass outcomes for the generated project
- `workspace-policy.md`
  - explicit write boundary and forbidden actions

Useful optional files:

- `example-territory-project.md`
- `preview-runtime-shape.json`
- `app-layout-guidelines.md`

## Acceptance Checklist for Initial Build

The worker should treat these as pass/fail criteria:

- project manifest exists and is valid
- setup brief is preserved in project metadata
- player seats match requested count and colors
- one shared view and one player-linked view per seat exist
- each player starts with 6 block resources
- at least one board or destination surface exists
- each player has at least one movable piece or token
- preview runtime compiles
- legal moves exist for the active player, unless the brief explicitly describes a setup-only initial state
- app layout fields exist with sensible defaults

## Suggested Service Boundaries

### Browser responsibilities

- collect the brief
- start build jobs
- poll job status
- open finished workspaces

### AI worker responsibilities

- build prompt pack
- run `aider`
- validate output
- perform limited repair loops
- commit workspace result

### Editor responsibilities

- load generated workspace
- preview gameplay
- expose versions, component editing, visual editing, and app layout editing

## First Implementation Slice

The fastest safe first slice is:

1. keep `Build with AI` in the browser UI
2. send the brief to a new backend job endpoint
3. create an isolated workspace
4. copy the Engine API doc and brief into `/context`
5. run `aider` once
6. run validation
7. store the generated workspace and open it in the editor

Do not try to make the first version fully autonomous. A single generation pass plus one repair pass is enough to prove the architecture.

## Why This Is Better Than Calling a Model Directly from the Browser

- write boundaries can be enforced at the filesystem level
- repo context can be curated instead of dumped into a prompt
- validation and repair loops can happen server-side
- the same worker can later support build, refactor, and fix flows
- model choice stays flexible behind OpenRouter

## Follow-Up Work

- add a backend job runner for isolated workspaces
- generate the prompt-pack files automatically from repo docs and manifests
- define the on-disk project format the agent should write
- add validator and repair loop support
- add model presets and fallback routing
