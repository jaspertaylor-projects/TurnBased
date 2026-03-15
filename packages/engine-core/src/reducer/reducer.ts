// ─── Deterministic Reducer Core ─────────────────────────────────────

import { deepClone } from '@turnbased/shared-utils';

import type { CanonicalAction } from '../actions';
import { canonicalActionSchema } from '../actions';
import type { GameState, PlayerId } from '../state';
import { advanceTurnPhase, advanceTurnStep, endTurn, insertTurnPhase, insertTurnStep } from '../turns';
import { appendActionLog, getNextPlayerIndex, insertIntoOrderedList, reindexZonePositions } from './helpers';
import { shuffleWithRandomState } from './rng';

function requireEntity(state: GameState, entityId: string) {
  const entity = state.entities[entityId];
  if (!entity) {
    throw new Error(`Entity not found: ${entityId}`);
  }
  return entity;
}

function requireZone(state: GameState, zoneId: string) {
  const zone = state.zones[zoneId];
  if (!zone) {
    throw new Error(`Zone not found: ${zoneId}`);
  }
  return zone;
}

function requirePlayer(state: GameState, playerId: string) {
  const player = state.players[playerId];
  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }
  return player;
}

function getPriorityParticipants(state: GameState): PlayerId[] {
  return state.playerOrder.filter((playerId) => {
    const player = state.players[playerId];
    return player && !player.isEliminated;
  });
}

function getNextPriorityPlayerId(state: GameState, currentPlayerId: PlayerId): PlayerId | null {
  const participants = getPriorityParticipants(state);
  if (participants.length === 0) {
    return null;
  }

  return participants[
    getNextPlayerIndex(participants, currentPlayerId, state.turnState.turnDirection)
  ];
}

function applyCanonicalAction(state: GameState, action: CanonicalAction): GameState {
  const nextState = deepClone(state);

  switch (action.type) {
    case 'MOVE_ENTITY': {
      const entity = requireEntity(nextState, action.payload.entityId);
      const fromZone = requireZone(nextState, action.payload.fromZoneId);
      const toZone = requireZone(nextState, action.payload.toZoneId);

      fromZone.entityIds = fromZone.entityIds.filter((entityId) => entityId !== entity.id);
      toZone.entityIds = insertIntoOrderedList(toZone.entityIds, entity.id, action.payload.position);
      entity.zoneId = toZone.id;

      reindexZonePositions(nextState, fromZone.id);
      reindexZonePositions(nextState, toZone.id);
      return nextState;
    }

    case 'CREATE_ENTITY': {
      const zone = requireZone(nextState, action.payload.zoneId);
      nextState.entities[action.payload.entity.id] = { ...action.payload.entity };
      zone.entityIds = insertIntoOrderedList(zone.entityIds, action.payload.entity.id, action.payload.entity.position);
      reindexZonePositions(nextState, zone.id);
      return nextState;
    }

    case 'DESTROY_ENTITY': {
      const entity = requireEntity(nextState, action.payload.entityId);
      const zone = requireZone(nextState, entity.zoneId);

      zone.entityIds = zone.entityIds.filter((entityId) => entityId !== entity.id);
      delete nextState.entities[entity.id];
      reindexZonePositions(nextState, zone.id);
      return nextState;
    }

    case 'SET_PROPERTY': {
      const { targetType, targetId, key, value } = action.payload;

      if (targetType === 'entity' && targetId) {
        requireEntity(nextState, targetId).properties[key] = value;
      } else if (targetType === 'zone' && targetId) {
        requireZone(nextState, targetId).properties[key] = value;
      } else if (targetType === 'player' && targetId) {
        requirePlayer(nextState, targetId).properties[key] = value;
      } else if (targetType === 'game') {
        if (key === 'status') {
          nextState.status = value as GameState['status'];
        } else if (key === 'winner') {
          nextState.winner = value as GameState['winner'];
        } else {
          throw new Error(`Unsupported game property: ${key}`);
        }
      }

      return nextState;
    }

    case 'TRANSFER_CONTROL': {
      requireEntity(nextState, action.payload.entityId).controllerId = action.payload.newControllerId;
      return nextState;
    }

    case 'DRAW_FROM_ZONE': {
      const sourceZone = requireZone(nextState, action.payload.sourceZoneId);
      const targetZone = requireZone(nextState, action.payload.targetZoneId);
      const drawnIds = sourceZone.entityIds.slice(0, action.payload.count);

      sourceZone.entityIds = sourceZone.entityIds.slice(drawnIds.length);
      targetZone.entityIds = [...targetZone.entityIds, ...drawnIds];

      reindexZonePositions(nextState, sourceZone.id);
      reindexZonePositions(nextState, targetZone.id);
      return nextState;
    }

    case 'SHUFFLE_ZONE': {
      const zone = requireZone(nextState, action.payload.zoneId);
      const shuffled = shuffleWithRandomState(zone.entityIds, nextState.randomState);

      zone.entityIds = shuffled.values;
      nextState.randomState = shuffled.randomState;
      reindexZonePositions(nextState, zone.id);
      return nextState;
    }

    case 'REVEAL_ENTITY': {
      const entity = requireEntity(nextState, action.payload.entityId);
      entity.faceUp = true;
      return nextState;
    }

    case 'HIDE_ENTITY': {
      const entity = requireEntity(nextState, action.payload.entityId);
      entity.faceUp = false;
      return nextState;
    }

    case 'PROMPT_PLAYER': {
      nextState.pendingDecisions = [...nextState.pendingDecisions, action.payload.decision];
      return nextState;
    }

    case 'CHOOSE_OPTION': {
      nextState.pendingDecisions = nextState.pendingDecisions.filter(
        (decision) => decision.id !== action.payload.decisionId,
      );
      return nextState;
    }

    case 'PASS_PRIORITY': {
      if (!nextState.priorityWindow.isOpen || !nextState.priorityWindow.currentPlayerId) {
        throw new Error('Cannot pass priority when no priority window is open');
      }

      if (action.payload.playerId !== nextState.priorityWindow.currentPlayerId) {
        throw new Error(
          `Player ${action.payload.playerId} cannot pass priority out of order`,
        );
      }

      const hasMandatoryDecision = nextState.pendingDecisions.some(
        (decision) => decision.playerId === action.payload.playerId,
      );
      if (hasMandatoryDecision) {
        throw new Error(
          `Player ${action.payload.playerId} must resolve pending decisions before passing priority`,
        );
      }

      nextState.priorityWindow = {
        ...nextState.priorityWindow,
        currentPlayerId: getNextPriorityPlayerId(nextState, action.payload.playerId),
        passedPlayerIds: nextState.priorityWindow.passedPlayerIds.includes(action.payload.playerId)
          ? nextState.priorityWindow.passedPlayerIds
          : [...nextState.priorityWindow.passedPlayerIds, action.payload.playerId],
      };
      return nextState;
    }

    case 'ADVANCE_STEP': {
      advanceTurnStep(nextState);
      return nextState;
    }

    case 'ADVANCE_PHASE': {
      advanceTurnPhase(nextState);
      return nextState;
    }

    case 'END_TURN': {
      endTurn(nextState);
      return nextState;
    }

    case 'QUEUE_STACK_ITEM': {
      nextState.stack = [
        ...nextState.stack,
        {
          ...action.payload.stackItem,
          isResolved: action.payload.stackItem.isResolved ?? false,
        },
      ];
      return nextState;
    }

    case 'RESOLVE_STACK_ITEM': {
      nextState.stack = nextState.stack.map((stackItem) =>
        stackItem.id === action.payload.stackItemId
          ? { ...stackItem, isResolved: true }
          : stackItem,
      );
      return nextState;
    }

    case 'ADD_RESOURCE': {
      const player = requirePlayer(nextState, action.payload.playerId);
      const current = player.resources[action.payload.resource] ?? 0;
      player.resources[action.payload.resource] = current + action.payload.amount;
      return nextState;
    }

    case 'REMOVE_RESOURCE': {
      const player = requirePlayer(nextState, action.payload.playerId);
      const current = player.resources[action.payload.resource] ?? 0;
      player.resources[action.payload.resource] = Math.max(0, current - action.payload.amount);
      return nextState;
    }

    case 'SET_SCORE': {
      requirePlayer(nextState, action.payload.playerId).score = action.payload.score;
      return nextState;
    }

    case 'ELIMINATE_PLAYER': {
      requirePlayer(nextState, action.payload.playerId).isEliminated = true;
      return nextState;
    }

    case 'END_GAME': {
      nextState.status = 'finished';
      nextState.winner = action.payload.winnerId ?? null;
      return nextState;
    }

    case 'ADD_EXTRA_TURN': {
      nextState.turnState.extraTurns = [...nextState.turnState.extraTurns, action.payload.playerId];
      return nextState;
    }

    case 'SKIP_TURN': {
      if (!nextState.turnState.skippedPlayers.includes(action.payload.playerId)) {
        nextState.turnState.skippedPlayers = [
          ...nextState.turnState.skippedPlayers,
          action.payload.playerId,
        ];
      }
      return nextState;
    }

    case 'REVERSE_TURN_ORDER': {
      nextState.turnState.turnDirection =
        nextState.turnState.turnDirection === 'forward' ? 'reverse' : 'forward';
      return nextState;
    }

    case 'INSERT_PHASE': {
      insertTurnPhase(nextState.turnState, {
        name: action.payload.phase.name,
        steps: action.payload.phase.steps.map((step) => ({ ...step })),
      }, action.payload.afterPhase);
      return nextState;
    }

    case 'INSERT_STEP': {
      insertTurnStep(
        nextState.turnState,
        {
          ...action.payload.step,
        },
        action.payload.phaseName,
        action.payload.afterStep,
      );
      return nextState;
    }
  }
}

export function reduceGameState(state: GameState, action: CanonicalAction): GameState {
  canonicalActionSchema.parse(action);
  return appendActionLog(state, action, applyCanonicalAction(state, action));
}
