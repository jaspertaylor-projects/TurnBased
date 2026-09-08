# TurnBased Goal

TurnBased is a convenient, welcoming workshop for amateur board game designers.
Help someone turn an idea into a playable prototype, learn from trying it,
and eventually hold a physical copy of their own game.

**Make a board game. Try it with friends. Make it better. Print it when you’re ready.**

The central loop is **idea → prototype → playtest → revise → print**. A maker
should not need specialist layout tools, manufacturing knowledge, or several
disconnected apps just to discover whether their idea is fun.

## Current priorities

The September 2026 direction makes these parts of one active workflow:

1. **Get to the first playable version.** Offer local creation without an
   account or an AI build, a useful example, clear next steps, and an inviting
   forest / parchment / oak workspace.
2. **Keep the history of the game.** Version rules, components, artwork, card
   data, and playtest findings together. Name checkpoints, branch experiments,
   compare changes, protect work before restores, and export portable backups.
3. **Turn tables into attractive decks.** Reusable templates, CSV/spreadsheet
   import, custom fields, copies, live previews, and batch generation should
   make a whole deck as convenient to change as one card.
4. **Make games understandable to agents.** Build toward explicit state,
   legal moves, reproducible experiments, and AI-agent playtesting. Start with
   supported executable game models and clearly state their limits; rulebook
   prose alone is not an executable game. Preserve human playtest observations
   beside the tested version.
5. **Move from screen to physical play.** Provide actual-size home prototype
   exports now. Continue supplier-linked component design, clear dimensions,
   bleed/safe zones, and pricing toward future physical ordering. The supplier
   service lives in this monorepo; its contract is in
   [third-party-catalog-pricing-api.md](./third-party-catalog-pricing-api.md).
6. **Make assistance optional and useful.** AI rule-writing and art generation
   support the designer's decisions. The core creation, versioning, card
   workflow, and current heuristic playtests work without paid AI calls.

## What exists and what comes next

The current Playtest lab executes a two-seat market-race model with numeric
card costs and points, seeded heuristic agents, transcripts, and an external
JSON agent protocol. It does not yet execute arbitrary game rules or run an
LLM automatically. Expand game coverage through explicit, testable contracts.

Current printing produces prototype card fronts and a shareable rulebook.
Manufacturing-ready duplex/bleed handling, supplier checkout, and fulfillment
remain future work. Keep supplier-backed components as the path to physical
orders, while allowing household or custom materials for early playtests.

Broader online play and, eventually, digital/physical sales remain part of the
long-term vision. They should grow naturally from a useful design-and-test
workshop; marketplace and monetization are not the entry promise.

Implementation details and current boundaries live in
[architecture.md](./architecture.md).
