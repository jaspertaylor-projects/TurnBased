import type {
  CanonicalAction,
  GameState,
} from '@turnbased/engine-core';
import {
  getNextPlayerIndex,
} from '@turnbased/engine-core';
import {
  createPlayerId,
  createZoneId,
  Visibility,
} from '@turnbased/shared-types';

import type { SampleZoneDefinition } from './types';

export const standardMainPhase = [
  {
    name: 'main',
    steps: [
      {
        name: 'action',
        autoAdvance: false,
        requiresPlayerAction: true,
      },
    ],
  },
];

export type StateLike = {
  entities: Record<
    string,
    {
      id: string;
      ownerId: string | null;
      properties: Record<string, unknown>;
    }
  >;
  zones: Record<
    string,
    {
      id: string;
      entityIds: string[];
      maxCapacity: number | null;
      properties: Record<string, unknown>;
    }
  >;
  players: Record<
    string,
    {
      score: number;
      resources: Record<string, number>;
    }
  >;
  playerOrder: string[];
  turnState: {
    turnDirection: GameState['turnState']['turnDirection'];
  };
};

export function createEndTurnAction(
  playerId: ReturnType<typeof createPlayerId>,
  timestamp: number,
): CanonicalAction {
  return {
    type: 'END_TURN',
    payload: {},
    source: {
      type: 'player',
      playerId,
    },
    timestamp,
  };
}

export function createSystemEndGameAction(
  winnerId: ReturnType<typeof createPlayerId> | ReturnType<typeof createPlayerId>[] | null,
  timestamp: number,
): CanonicalAction {
  return {
    type: 'END_GAME',
    payload: {
      winnerId,
    },
    source: {
      type: 'system',
    },
    timestamp,
  };
}

export function getCardsInZone(
  state: StateLike,
  zoneId: ReturnType<typeof createZoneId>,
): GameState['entities'][string][] {
  const zone = state.zones[zoneId];
  if (!zone) {
    return [];
  }

  return zone.entityIds
    .map((entityId) => state.entities[entityId])
    .filter((entity): entity is GameState['entities'][string] => Boolean(entity));
}

export function getOtherPlayerId(
  state: StateLike,
  playerId: ReturnType<typeof createPlayerId>,
): ReturnType<typeof createPlayerId> {
  return (state.playerOrder.find((candidate) => candidate !== playerId) ?? playerId) as ReturnType<
    typeof createPlayerId
  >;
}

export function getNextOrderedPlayerId(
  state: StateLike,
  playerId: ReturnType<typeof createPlayerId>,
): ReturnType<typeof createPlayerId> {
  const index = getNextPlayerIndex(
    state.playerOrder as ReturnType<typeof createPlayerId>[],
    playerId,
    state.turnState.turnDirection,
  );
  return (state.playerOrder[index] ?? playerId) as ReturnType<typeof createPlayerId>;
}

export function toManifestVisibility(
  token: SampleZoneDefinition['defaultVisibility'],
): Visibility {
  if (token === '@private') {
    return Visibility.Private;
  }

  if (token === '@hidden') {
    return Visibility.Hidden;
  }

  return Visibility.Public;
}
