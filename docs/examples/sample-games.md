# Sample Games

## Overview

Sample games serve as **reference implementations**, not starting templates. They demonstrate how to use built-in components, declarative rules, and extension hooks to create different game archetypes.

The creator’s default starter scaffold is intentionally much smaller than these examples:

- one shared board
- one starter playable space
- one linked player view per seat
- one `Player N Resources` zone per seat
- one shared `Game Supply` zone
- one authored resource template per repeated cube/worker/token, using quantity instead of one component per copy

These sample games remain useful as reference targets after the starter scaffold is generated and expanded.

## Target Archetypes

### 1. Tic-Tac-Toe (Track/Placement Game)
**Demonstrates**: Board component, piece placement, win condition detection, alternating turns.

- 3×3 grid board
- 2 players, alternating turns
- Place piece on empty space
- Win: 3 in a row (horizontal, vertical, diagonal)
- Draw: all spaces filled

**Components used**: Board (grid), Piece (X/O tokens)
**Rules**: Simple placement permission, win condition predicate

### 2. Card Battle (Stack/Response Card Game)
**Demonstrates**: Deck, hand, play area, triggers, response windows, stack resolution.

- Each player has a deck of cards with attack/defense values
- Draw phase → Play phase → Combat phase → End phase
- Playing an attack card opens a response window for the defender
- Defender can play a defense card from hand
- Stack resolves: defense first, then attack

**Components used**: Deck zone, Hand zone, Play area zone, Card entities
**Rules**: Draw on turn start (trigger), response window on attack, stack LIFO resolution

### 3. Resource Collector (Worker Placement / Destination→Item)
**Demonstrates**: Destination-first interaction, limited slots, resource management.

- Board with resource spaces (each has limited slots)
- Players take turns placing workers on spaces
- Each space produces resources when claimed
- Spend resources to buy victory point cards
- Game ends after N rounds

**Components used**: Board, Space (with capacity), Worker piece, Resource counter, Score track
**Rules**: Worker placement permissions, resource production triggers, purchase actions

### 4. Turn Order Chaos (Turn-Order Mutation Game)
**Demonstrates**: Dynamic turn order, extra turns, skipped turns, reverse direction.

- Players play cards that modify turn order
- "Reverse" card reverses direction
- "Skip" card skips next player
- "Again" card gives current player an extra turn
- Goal: be first to play all cards

**Components used**: Hand zone, Discard zone, Card entities
**Rules**: Turn order mutation actions, card effect triggers

## Implementation Plan

Each sample game will be implemented as:
1. A **game definition** (manifest + component configuration + declarative rules)
2. A **test suite** validating game flow, win conditions, and edge cases
3. A **simulation harness** for AI vs AI automated play

Phase 16 implementation lives in [`packages/sample-games`](../../packages/sample-games):

- `src/games.ts` contains the four reference game definitions plus regression cases
- `src/harness.ts` contains random-play, self-play, replay, and regression helpers
- `src/cli.ts` provides a small simulation runner via `npm run simulate --workspace @turnbased/sample-games -- --game <id> --mode <random|self-play>`
