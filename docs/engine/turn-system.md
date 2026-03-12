# Turn System

## Overview

The turn system is **data-driven** — turn structure is defined as data, not hardcoded. This supports games with wildly different turn structures, from simple "alternate turns" to complex multi-phase rounds with dynamic ordering.

## Hierarchy

```
Game
 └── Round (repeating)
      └── Turn (per player in turn order)
           └── Phase (ordered sequence per turn)
                └── Step (ordered sequence per phase)
```

## Turn State

```typescript
interface TurnState {
  roundNumber: number;
  turnNumber: number;          // Global turn counter
  activePlayerId: PlayerId;
  currentPhase: string;
  currentStep: string;
  phaseIndex: number;
  stepIndex: number;
  phases: PhaseDefinition[];
  turnDirection: 'forward' | 'reverse';
  extraTurns: PlayerId[];
  skippedPlayers: Set<PlayerId>;
}

interface PhaseDefinition {
  name: string;
  steps: StepDefinition[];
  onEnter?: CanonicalAction[];   // Actions to execute when entering phase
  onExit?: CanonicalAction[];    // Actions to execute when leaving phase
}

interface StepDefinition {
  name: string;
  autoAdvance: boolean;          // Auto-advance after step resolves
  requiresPlayerAction: boolean; // Does player need to act in this step
  onEnter?: CanonicalAction[];
  onExit?: CanonicalAction[];
}
```

## Turn Flow

1. **Round starts** — emit `ROUND_STARTED`, evaluate round-start triggers.
2. **Determine active player** — use `playerOrder` and `turnDirection`.
3. **Turn starts** — emit `TURN_STARTED`, evaluate triggers.
4. **Phase loop** — iterate through `phases` in order.
5. **Step loop** — iterate through `steps` within each phase.
6. **Turn ends** — emit `TURN_ENDED`, advance to next player.
7. **Round ends** — when all players have taken a turn, emit `ROUND_ENDED`.

## Dynamic Turn Mutations

### Extra Turns
```typescript
// Player gains an extra turn
{ type: 'ADD_EXTRA_TURN', playerId: 'player_1' }
// Extra turns are queued and processed before normal turn order advances
```

### Skipped Turns
```typescript
// Player's next turn is skipped
{ type: 'SKIP_TURN', playerId: 'player_2' }
```

### Reversed Turn Order
```typescript
// Turn direction reverses (e.g., UNO reverse card)
{ type: 'REVERSE_TURN_ORDER' }
```

### Inserted Phases/Steps
```typescript
// Add a temporary phase to the current turn
{ type: 'INSERT_PHASE', phase: { name: 'bonus_action', steps: [...] }, afterPhase: 'main' }
```

### Modified Player Order
Turn order can change at any time. The `playerOrder` array in state is the source of truth.

## Common Turn Structures

### Simple Alternating Turns
```typescript
phases: [
  { name: 'play', steps: [{ name: 'action', requiresPlayerAction: true }] }
]
```

### Board Game with Multiple Phases
```typescript
phases: [
  { name: 'draw', steps: [{ name: 'draw_cards', autoAdvance: true }] },
  { name: 'main', steps: [{ name: 'play_cards', requiresPlayerAction: true }] },
  { name: 'combat', steps: [{ name: 'resolve_attacks', autoAdvance: true }] },
  { name: 'end', steps: [{ name: 'discard', requiresPlayerAction: true }] }
]
```

### Simultaneous Play
For games where all players act at once, use a single phase with `requiresPlayerAction: true` for ALL players, not just the active player. The turn engine can be configured for simultaneous resolution.
