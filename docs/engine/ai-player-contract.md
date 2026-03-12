# AI Player Contract

## Overview

AI players interact with the engine through a well-defined input/output contract. They receive visible game state and legal moves, and return a chosen action.

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
