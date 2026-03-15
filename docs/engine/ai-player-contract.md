# AI Player Contract

## Overview

AI players interact with the engine through a well-defined input/output contract. They receive visible game state and legal moves, and return a chosen action.

`engine-core` now exposes `projectGameStateForAI(state, playerId, options)` so AI seats consume the same redacted visibility projection as a human player in that seat.
Legal moves are generated with `generateLegalMoveTree(state, { playerId, definitions, visibility })`, and `materialize(...)` converts a chosen action id plus selections into canonical actions.

## AI Input Envelope

```typescript
interface AIInput {
  gameState: PlayerVisibleState;     // State as seen by this AI's seat
  legalMoves: LegalMoveTree;         // Available actions
  playerInfo: {
    playerId: PlayerId;
    role: string;
    seatIndex: number;
  };
  gameRulesSummary: string;          // Human-readable rules text
  recentHistory: ActionLogEntry[];   // Recent game events (visible ones)
  strategyProfile?: string;          // Optional persona (aggressive, defensive, etc.)
  turnContext: {
    roundNumber: number;
    turnNumber: number;
    phase: string;
    step: string;
  };
}
```

## AI Output Envelope

```typescript
interface AIOutput {
  chosenActionId: string;            // ID from legalMoves.availableActions
  parameters?: Record<string, unknown>; // Sub-choice selections if needed
  rationale?: string;                // Optional reasoning explanation
  confidence: number;               // 0-1, how confident the AI is
  thinkingTimeMs: number;           // How long the AI took to decide
}
```

## AI Modes

### Heuristic AI
- Fast, cheap, deterministic.
- Uses scoring heuristics to pick moves.
- Good for playtesting and simple opponents.

### LLM AI
- Uses a language model for strategic reasoning.
- Receives the full AI input as a structured prompt.
- More expensive but can handle complex decision-making.
- Subject to token budgets and cost controls.

## Safety Rules

1. AI must only choose from legal moves (engine validates).
2. AI receives only its player-visible state (no hidden info leakage).
3. LLM AI calls go through the edge function with quota/budget enforcement.
4. AI thinking time is bounded by timeout.
5. If AI fails to respond, engine auto-passes or uses fallback heuristic.

## `engine-ai` package surface

`@turnbased/engine-ai` now provides the Phase 15 runtime pieces that sit on top of `engine-core`:

- `createAIInputEnvelope(...)` builds the canonical AI seat input from projected state, legal moves, recent visible history, rules summary, and optional budget snapshot.
- `summarizeRulesForAI(...)` compacts game definitions, docs snippets, and manifest summaries into an LLM-friendly rules brief.
- `createHeuristicBot(...)` provides a deterministic baseline bot that scores legal actions and emits only engine-compatible move requests.
- `createExperimentalLLMBot(...)` wraps an external model client behind a strict input/output envelope and budget gate.
- `createAISeatBudgetController(...)` tracks per-seat token, call, model-allowlist, and optional cost limits.
- `runBotTurn(...)` executes a bot, validates its selected move against `generateLegalMoveTree(...)`, falls back if needed, and materializes canonical actions.

## Runner behavior

The runner is intentionally conservative:

1. Build the AI envelope from `projectGameStateForAI(...)`, legal moves, and summarized rules.
2. Ask the primary bot for an `AIOutput`.
3. Convert the bot response into a `LegalMoveRequest`.
4. Validate the request against the compiled move tree.
5. If invalid or if the bot fails, invoke a fallback bot (default: heuristic).
6. Materialize canonical actions only after validation succeeds.

This means an AI seat can never directly inject arbitrary engine actions; it can only choose among currently legal ones.

## Cost controls

Budget enforcement happens before experimental LLM calls are made:

- prompt tokens are estimated from the serialized prompt
- completion tokens are reserved from a per-seat cap
- model allowlists can block disallowed models
- total token and call ceilings are enforced cumulatively
- actual usage can be recorded back into the seat ledger after the call completes

If a reservation fails, the experimental adapter can immediately fall back to the heuristic bot.
