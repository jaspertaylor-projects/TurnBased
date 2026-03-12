# Experimental Engine Override Mode

## Overview

Experimental engine override mode allows power users to modify engine-adjacent behavior. This mode comes with explicit trade-offs and warnings.

## What Can Be Overridden

| Override | Risk Level | Description |
|----------|-----------|-------------|
| Trigger resolution order | Medium | Custom ordering for simultaneous triggers |
| Priority rules | Medium | Custom response window behavior |
| Visibility projection | High | Custom rules for what each player sees |
| Reducer middleware | High | Insert custom logic into the action pipeline |
| Turn flow | Medium | Custom turn advancement logic |
| Entity lifecycle | Medium | Custom creation/destruction behavior |

## Activation Requirements

1. Creator must explicitly enable experimental mode in project settings.
2. A multi-step confirmation dialog explains the trade-offs.
3. The project is permanently flagged as `experimental` (cannot downgrade).
4. The project manifest records which overrides are enabled.

## Trade-offs

### Guaranteed in Experimental Mode
- Engine still runs in the browser only.
- State is still serializable and replayable.
- Legal move generation still functions.
- Multiplayer still works.

### Not Guaranteed
- AI assistance quality may degrade (agents may not understand custom overrides).
- Future engine updates may break custom overrides (no migration guarantees).
- Marketplace eligibility may be restricted.
- Save-game compatibility across engine versions is not guaranteed.
- Performance may be worse (custom middleware adds overhead).

## Implementation

Experimental overrides are implemented as middleware:

```typescript
interface EngineMiddleware {
  name: string;
  before?: (state: GameState, action: CanonicalAction) => { state: GameState; action: CanonicalAction };
  after?: (prevState: GameState, newState: GameState, action: CanonicalAction) => GameState;
}
```

The middleware contract is narrow: you receive state and action, you return modified state and/or action. You cannot inject arbitrary behavior.

## Project Flag

```typescript
// In project manifest
{
  capabilities: {
    mode: 'experimental',
    activatedAt: '2026-03-11T00:00:00Z',
    acknowledgedWarnings: ['ai-degradation', 'no-migration-guarantee', 'marketplace-restriction'],
    enabledOverrides: ['custom-trigger-order', 'reducer-middleware']
  }
}
```
