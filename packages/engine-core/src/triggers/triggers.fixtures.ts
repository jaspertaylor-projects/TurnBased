import {
  createEntityId,
  createGameId,
  createPlayerId,
  createZoneId,
  ParticipantRole,
  Visibility,
} from '@turnbased/shared-types';

import type { GameState } from '../index';

export const gameId = createGameId('game_triggers');
export const playerOneId = createPlayerId('player_1');
export const playerTwoId = createPlayerId('player_2');
export const boardZoneId = createZoneId('zone_board');
export const discardZoneId = createZoneId('zone_discard');
export const entityId = createEntityId('ent_piece');
export const basePhases = [
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

export function createBaseState(): GameState {
  return {
    gameId,
    version: 0,
    entities: {
      [entityId]: {
        id: entityId,
        type: 'piece',
        componentType: 'piece.basic',
        zoneId: boardZoneId,
        ownerId: playerOneId,
        controllerId: playerOneId,
        position: 0,
        faceUp: true,
        properties: {},
        tags: [],
      },
    },
    zones: {
      [boardZoneId]: {
        id: boardZoneId,
        type: 'board',
        name: 'Board',
        ownerId: null,
        entityIds: [entityId],
        maxCapacity: null,
        visibility: {
          defaultVisibility: Visibility.Public,
          overrides: {},
        },
        properties: {},
      },
      [discardZoneId]: {
        id: discardZoneId,
        type: 'discard',
        name: 'Discard',
        ownerId: null,
        entityIds: [],
        maxCapacity: null,
        visibility: {
          defaultVisibility: Visibility.Public,
          overrides: {},
        },
        properties: {},
      },
    },
    players: {
      [playerOneId]: {
        id: playerOneId,
        displayName: 'Player One',
        role: ParticipantRole.Player,
        isActive: true,
        isEliminated: false,
        score: 0,
        resources: {},
        properties: {},
      },
      [playerTwoId]: {
        id: playerTwoId,
        displayName: 'Player Two',
        role: ParticipantRole.Player,
        isActive: false,
        isEliminated: false,
        score: 0,
        resources: {},
        properties: {},
      },
    },
    playerOrder: [playerOneId, playerTwoId],
    turnState: {
      roundNumber: 1,
      turnNumber: 1,
      activePlayerId: playerOneId,
      currentPhase: 'main',
      currentStep: 'action',
      phaseIndex: 0,
      stepIndex: 0,
      basePhases,
      phases: basePhases.map((phase) => ({
        ...phase,
        steps: phase.steps.map((step) => ({ ...step })),
      })),
      turnDirection: 'forward',
      currentTurnKind: 'normal',
      extraTurns: [],
      skippedPlayers: [],
      completedPlayerIdsThisRound: [],
    },
    pendingDecisions: [],
    stack: [],
    priorityWindow: {
      isOpen: false,
      currentPlayerId: null,
      passedPlayerIds: [],
      openedBy: null,
    },
    visibilityMap: {
      entityVisibility: {},
      zoneVisibility: {},
    },
    randomState: {
      seed: 7,
      callCount: 0,
    },
    status: 'playing',
    winner: null,
    actionLog: [],
    componentInstances: {},
  };
}
