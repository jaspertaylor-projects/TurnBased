# Triggers and Priority

## Overview

The trigger system is the reactive rules backbone of the engine. It allows game effects to fire in response to events, supporting everything from simple "draw a card when you score" to complex Magic-like response chains.

## Trigger Pipeline

```
1. Canonical action applied to state
2. Domain event(s) emitted
3. Replacement/prevention triggers evaluated (may cancel or modify the event)
4. Trigger subscriptions checked against event
5. Matching trigger records materialized
6. Immediate effects resolved OR stack items queued
7. Optional triggers materialize pending decisions when player consent is required
8. Priority window opened if game policy requires it
9. Stack/queue resolves (LIFO for stack, FIFO for queue)
10. Repeat from step 2 for any new events from trigger effects
```

## Trigger Types

### Automatic Triggers
Fire immediately when their condition is met. No player choice.
```typescript
{ type: 'automatic', event: 'ENTITY_MOVED', condition: 'entity.type === "piece"', effect: { ... } }
```

### Optional Triggers
Fire only if the controlling player chooses to activate them.
```typescript
{ type: 'optional', event: 'TURN_STARTED', prompt: 'Activate power?', effect: { ... } }
```

### Replacement Triggers
Modify or prevent an event before it fully resolves.
```typescript
{ type: 'replacement', event: 'ENTITY_DESTROYED', replacement: { ... } }
```

### Prevention Triggers
Cancel an event entirely.
```typescript
{ type: 'prevention', event: 'DAMAGE_DEALT', condition: 'target.hasShield', prevention: true }
```

## Trigger Subscription

```typescript
interface TriggerSubscription {
  id: TriggerId;
  type: 'automatic' | 'optional' | 'replacement' | 'prevention';
  event: string;                      // Event type to listen for
  condition?: string;                 // Expression to evaluate
  effect: CanonicalAction | CanonicalAction[];
  controllerId: PlayerId;             // Who controls this trigger
  sourceEntityId?: EntityId;          // Entity that owns this trigger
  priority: number;                   // Resolution order (higher = first)
  resolution: 'immediate' | 'stack';  // FIFO queue or LIFO stack
  once: boolean;                      // Remove after first activation
  phase?: string;                     // Only active during specific phase
  prompt?: string;                    // Optional triggers only
}
```

## Runtime API

Phase 7 introduces the first trigger-engine runtime entry points in `engine-core`:

```typescript
applyActionWithTriggers(state, action, {
  triggers,
  autoResolveStack,
  priorityPolicy,
  canPlayerRespond,
});
resolveStackWithTriggers(state, { triggers });
replayActionsWithTriggers(initialState, actions, { triggers });
```

- `applyActionWithTriggers()` wraps the pure reducer and runs replacement/prevention hooks, event emission, automatic/optional trigger handling, and optional auto-resolution of the stack.
- In Phase 8 it also opens, advances, and closes `priorityWindow` state for `none`, `limited`, and `full` response policies.
- `resolveStackWithTriggers()` resolves queued stack items later, which Phase 8 will use when response windows are active.
- `replayActionsWithTriggers()` replays the same action inputs through the trigger pipeline for deterministic verification.

## Priority / Response Windows

Games can configure how much response opportunity players have:

### No-Response Mode (Default for simple games)
- Effects resolve immediately.
- No priority windows.
- Players cannot respond to other players' actions.

### Limited Response Windows
- Priority window opens only for specific events (e.g., attacks, spells).
- Active player gets first response, then each other player in turn order.
- Window closes when all players pass.

### Full Priority Cycle (Magic-like)
- After every action, ALL players get a chance to respond in turn order.
- Responses go on the stack. Stack resolves LIFO.
- New priority cycle after each stack resolution.
- Game proceeds only when all players pass on an empty stack.

### Configuration
```typescript
interface PriorityPolicy {
  mode: 'none' | 'limited' | 'full';
  responseEvents?: string[];           // Events that open windows (for 'limited')
  autoPassEnabled: boolean;            // Auto-pass when no legal responses
  timeoutMs?: number;                  // Per-player response timeout
}
```

`canPlayerRespond({ state, playerId, priorityWindow })` is an optional runtime hook used for auto-pass decisions before legal move generation exists.

## Runtime Priority State

```typescript
interface PriorityWindowState {
  isOpen: boolean;
  currentPlayerId: PlayerId | null;
  passedPlayerIds: PlayerId[];
  openedBy: 'action' | 'stack' | null;
}
```

- Full mode opens a window after every non-pass action.
- Limited mode opens a window only when the configured `responseEvents` appear, but once opened the chain stays active until all players pass on an empty stack.
- When all players pass and the stack is non-empty, only the top unresolved stack item resolves, then a fresh priority cycle starts with the active player.
- If `autoPassEnabled` is true, the engine synthesizes deterministic `PASS_PRIORITY` actions for players who cannot respond.
- If the current responder has a pending decision, the window pauses until they answer it.

## Simultaneous Trigger Ordering

When multiple triggers activate from the same event:
1. **Active player's triggers resolve first** (if during their turn).
2. **Then each other player in turn order.**
3. **Within a player, higher priority number resolves first.**
4. **Equal priority: order of registration (FIFO).**

For `resolution: 'stack'`, the engine pushes items in reverse of this resolution order so LIFO stack resolution still produces the same final ordering.

## Nested Trigger Chains

Trigger effects can emit events that activate more triggers. The engine:
1. Tracks recursion depth to prevent infinite loops (configurable max, default: 100).
2. Applies replacement/prevention triggers before automatic triggers for each event.
3. Uses pending-decision metadata to resume optional trigger effects after player choice.
4. Maintains a deterministic action log that can be replayed to debug chains.
