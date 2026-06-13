# TurnBased Agent Memories

Shared persistent notes for any AI agent working on this repo (Claude, Codex,
Gemini, etc.). These are point-in-time observations about *how the user wants
work done* and *why* — they survive across conversations.

Companion to [goal.md](./goal.md), [goldenrules.md](./goldenrules.md), and
[architecture.md](./architecture.md). If something here contradicts goldenrules
or architecture, those win; this file is preferences + lessons, not spec.

---

## Feedback / collaboration preferences

### UI div naming rule

Every layout div in JSX must have a descriptive `data-layout` attribute and a
preceding comment explaining its purpose.

- **Why:** the user found it difficult to debug layout issues when divs were
  anonymous. Named divs make the DOM inspectable and the code self-documenting.
- **How to apply:** when writing or editing JSX layout containers, always add:
  1. A `data-layout="descriptiveName"` attribute (camelCase — e.g.
     `canvasColumn`, `inspectorScrollArea`).
  2. A comment above the element explaining what it contains and how it sizes
     (e.g. *"fills entire left column edge-to-edge, no padding"*).
- Applies to structural / layout divs, not small inline elements like buttons
  or spans.

### No hidden AI controls

Do NOT embed taste filters or style blocklists inside AI prompts (system
prompts, mode instructions, etc.). Every constraint the user fights should be
exposed in the UI as a control they can change.

- **Why:** during the brainstorm-weight fix on 2026-05-25, an
  "avoid dark-fantasy compound construction" guidance line plus a hard-coded
  blocklist of forbidden prefixes (Grim-, Ash-, Shadow-, Night-, …) got added
  on top of an existing "avoid fantasy / gothic / mythic" line. The user
  pushed back: they don't want hidden style controls the user is fighting
  against — the sliders and chips in the UI are the *real* controls.
- **How to apply:** when wiring an AI feature with UI controls (sliders,
  toggles, chips), make those controls fully load-bearing — change what gets
  sent to the model based on them. Don't add unconditional taste guidance that
  fights against or overrides those user-visible controls. Plumbing
  instructions (*"return JSON only", "be concise", "interpret prompts
  faithfully"*) are fine; opinionated style filters that the user can't see or
  override from the UI are not. If you find yourself writing *"avoid X unless
  Y"*, that's the smell — either expose the toggle in the UI or drop the rule.

### OpenRouter image generation shape

- **Why:** the Art tab image generator was originally a mock and needed the
  current OpenRouter image response contract.
- **How to apply:** `ai-image-agent` should call OpenRouter chat completions
  with `modalities`, then read generated images from
  `choices[0].message.images[0].image_url.url`. OpenRouter returns image
  outputs as base64 data URLs, so the Art tab stores an `imageDataUrl` on its
  local `EditorImageAsset` for immediate preview while the backend asset row
  records metadata and ledger usage.

---

## Tooling references

### Playwright MCP runs `--isolated`

On 2026-05-25 every Playwright MCP entry in `~/.claude.json` (root `mcpServers`
and each per-project section under `projects.<path>.mcpServers`) was given the
`--isolated` flag so Claude sessions and Codex never lock each other out of
the same Chrome user-data-dir.

- **Why:** Codex and Claude both wanted to drive Playwright; the default
  shared persistent profile at `~/.cache/ms-playwright/mcp-chrome-<hash>` caused
  "Browser is already in use" failures whenever a second session started.
- **How to apply:**
  - Each Playwright MCP session now starts with a fresh ephemeral browser
    context — no persisted sign-in. If a test needs auth, log in at the start
    of the session (local dev account is `dev@turnbased.local` /
    `dev-local-only`, seeded per the README).
  - Codex's headed Chrome stays separate at
    `.playwright-codex/chrome-profile` (launched by
    `scripts/codex-headed-browser.mjs`) and keeps its persistent login —
    that's intentional, see the README "Codex headed browser" section.
  - If MCP starts conflicting again, confirm every `playwright` entry under
    `~/.claude.json` still has `--isolated` in its args list. A backup of the
    pre-change config lives at `~/.claude.json.bak-20260525-163425`.

---

## Maintenance

- Claude Code mirrors this file from its private `~/.claude/projects/.../memory/`
  store. When Claude saves a new memory, it should add a corresponding entry
  here so non-Claude agents can read it.
- Other agents (Codex, Gemini, etc.) — if you learn something about the user's
  preferences that future agents would benefit from, append it under
  "Feedback / collaboration preferences" with a **Why** and **How to apply**.
- Keep entries short and actionable. If an entry stops being true, edit or
  delete it rather than letting it rot.
