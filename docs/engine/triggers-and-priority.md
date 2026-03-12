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
7. Priority window opened if game policy requires it
8. Stack/queue resolves (LIFO for stack, FIFO for queue)
9. Repeat from step 2 for any new events from trigger effects
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
  once: boolean;                      // Remove after first activation
  phase?: string;                     // Only active during specific phase
}
```

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

## Simultaneous Trigger Ordering

When multiple triggers activate from the same event:
1. **Active player's triggers resolve first** (if during their turn).
2. **Then each other player in turn order.**
3. **Within a player, higher priority number resolves first.**
4. **Equal priority: order of registration (FIFO).**

## Nested Trigger Chains

Trigger effects can emit events that activate more triggers. The engine:
1. Tracks recursion depth to prevent infinite loops (configurable max, default: 100).
2. Applies replacement/prevention triggers before automatic triggers for each event.
3. Maintains a trigger activation log for debugging.
