import { describe, expect, it } from 'vitest';
import {
  createActionId,
  createEntityId,
  createGameId,
  createPlayerId,
  createZoneId,
  ParticipantRole,
  Visibility,
} from '@turnbased/shared-types';

import type {
  EntityId,
  GameDefinition,
  GameState,
  LegalMoveDefinition,
} from '@turnbased/engine-core';

import {
  createAIInputEnvelope,
  createAISeatBudgetController,
  createExperimentalLLMBot,
  createHeuristicBot,
  estimateTextTokens,
  runBotTurn,
  summarizeRulesForAI,
} from './index';

const gameId = createGameId('game_ai_contract');
const playerOneId = createPlayerId('player_one');
const playerTwoId = createPlayerId('player_two');
const reserveZoneId = createZoneId('zone_reserve');
const boardZoneId = createZoneId('zone_board');
const reservePieceId = createEntityId('entity_reserve_piece');

const basePhases = [
  {
    name: 'main',
    steps: [
      {
        name: 'act',
        autoAdvance: false,
        requiresPlayerAction: true,
      },
    ],
  },
];

function createBaseState(): GameState {
  return {
    gameId,
    version: 3,
    entities: {
      [reservePieceId]: {
        id: reservePieceId,
        type: 'piece',
        componentType: 'piece.worker',
        zoneId: reserveZoneId,
        ownerId: playerOneId,
        controllerId: playerOneId,
        position: 0,
        faceUp: true,
        properties: {
          value: 1,
        },
        tags: ['reserve'],
      },
    },
    zones: {
      [reserveZoneId]: {
        id: reserveZoneId,
        type: 'reserve',
        name: 'Reserve',
        ownerId: playerOneId,
        entityIds: [reservePieceId],
        maxCapacity: null,
        visibility: {
          defaultVisibility: Visibility.Public,
          overrides: {},
        },
        properties: {},
      },
      [boardZoneId]: {
        id: boardZoneId,
        type: 'board_slot',
        name: 'Board',
        ownerId: null,
        entityIds: [],
        maxCapacity: 1,
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
        displayName: 'Bot Seat',
        role: ParticipantRole.AI,
        isActive: true,
        isEliminated: false,
        score: 0,
        resources: {
          energy: 1,
        },
        properties: {},
      },
      [playerTwoId]: {
        id: playerTwoId,
        displayName: 'Human Seat',
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
      currentStep: 'act',
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
      seed: 5,
      callCount: 0,
    },
    status: 'playing',
    winner: null,
    actionLog: [
      {
        id: createActionId('action_1'),
        type: 'ADD_RESOURCE',
        payload: {
          playerId: playerOneId,
          resource: 'energy',
          amount: 1,
        },
        source: {
          type: 'system',
        },
        timestamp: 1,
      },
    ],
    componentInstances: {},
  };
}

const legalMoveDefinitions: LegalMoveDefinition[] = [
  {
    id: 'deploy-piece',
    generate: (context) => {
      const reservePiece = context.helpers.getVisibleEntity(reservePieceId);
      const boardZone = context.helpers.getVisibleZone(boardZoneId);

      if (!reservePiece || !boardZone || boardZone.entityIds.length > 0) {
        return null;
      }

      return {
        type: 'MOVE_ENTITY' as const,
        displayName: 'Deploy worker',
        description: 'Move the reserve worker to the open board slot.',
        interactableEntities: [reservePieceId],
        validDestinations: [boardZoneId],
        tags: ['develop', 'score'],
        explanation: {
          summary: 'Deploying advances your board position.',
        },
        buildCanonicalActions: ({ request, resolveEntityId, playerId, state }) => [
          {
            type: 'MOVE_ENTITY',
            payload: {
              entityId: resolveEntityId(
                request.selectedEntityId ?? reservePiece.id,
              ) as EntityId,
              fromZoneId: reserveZoneId,
              toZoneId: request.destinationZoneId ?? boardZoneId,
            },
            source: {
              type: 'ai',
              playerId,
            },
            timestamp: state.version + 1,
          },
        ],
      };
    },
  },
];

const gameDefinition: GameDefinition = {
  name: 'Worker Rally',
  description: 'A compact placement game used to validate AI seat behavior.',
  minPlayers: 2,
  maxPlayers: 2,
  phases: basePhases,
  priorityPolicy: {
    mode: 'limited',
    responseEvents: ['MOVE_ENTITY'],
    autoPassEnabled: true,
  },
  initialZones: [],
  initialEntities: [],
  triggers: [],
  winCondition: 'First player to 5 score wins.',
  rulesText: 'Deploy workers from reserve to score tempo and control the board.',
  defaultSeed: 5,
};

describe('@turnbased/engine-ai', () => {
  it('summarizes rules from docs and manifests within the configured character budget', () => {
    const summary = summarizeRulesForAI(
      {
        gameDefinition,
        documents: [
          {
            title: 'Opening',
            content: 'Use reserve workers to claim spaces early.',
            priority: 1,
          },
        ],
        componentManifests: [
          {
            type: 'piece.worker',
            displayName: 'Worker',
            category: 'entity',
            description: 'A placeable worker pawn.',
          },
        ],
        additionalNotes: ['Avoid passing when a deployment is available.'],
      },
      {
        maxCharacters: 400,
      },
    );

    expect(summary).toContain('Game: Worker Rally');
    expect(summary).toContain('Opening: Use reserve workers to claim spaces early.');
    expect(summary.length).toBeLessThanOrEqual(400);
  });

  it('creates an AI input envelope with visible state, legal moves, and budget snapshot', () => {
    const budgetController = createAISeatBudgetController({
      maxPromptTokens: 500,
      maxCompletionTokens: 200,
      maxTotalTokens: 700,
      maxCalls: 3,
      allowedModels: ['test-model'],
    });

    const input = createAIInputEnvelope({
      state: createBaseState(),
      playerId: playerOneId,
      legalMoveDefinitions,
      rules: {
        gameDefinition,
      },
      budgetController,
    });

    expect(input.gameState.viewer.role).toBe(ParticipantRole.AI);
    expect(input.legalMoves.availableActions).toHaveLength(1);
    expect(input.playerInfo.displayName).toBe('Bot Seat');
    expect(input.budget?.remainingCalls).toBe(3);
    expect(input.gameRulesSummary).toContain('Worker Rally');
  });

  it('runs the heuristic bot and materializes only legal moves', async () => {
    const result = await runBotTurn({
      state: createBaseState(),
      playerId: playerOneId,
      legalMoveDefinitions,
      rules: {
        gameDefinition,
      },
      bot: createHeuristicBot({
        profile: 'greedy',
      }),
    });

    expect(result.selectedAction.id).toBe('deploy-piece:0');
    expect(result.request.destinationZoneId).toBe(boardZoneId);
    expect(result.canonicalActions).toEqual([
      expect.objectContaining({
        type: 'MOVE_ENTITY',
        payload: expect.objectContaining({
          entityId: reservePieceId,
          fromZoneId: reserveZoneId,
          toZoneId: boardZoneId,
        }),
      }),
    ]);
    expect(result.fallback).toBeUndefined();
  });

  it('uses the experimental LLM bot when budget allows and records usage', async () => {
    const budgetController = createAISeatBudgetController({
      maxPromptTokens: 2000,
      maxCompletionTokens: 400,
      maxTotalTokens: 2400,
      maxCalls: 2,
      allowedModels: ['test-model'],
    });
    const bot = createExperimentalLLMBot({
      model: 'test-model',
      client: {
        complete: async () => ({
          structuredOutput: {
            chosenActionId: 'deploy-piece:0',
            confidence: 0.8,
            thinkingTimeMs: 5,
            rationale: 'Deploy the worker to advance the board.',
          },
          usage: {
            promptTokens: 120,
            completionTokens: 40,
            totalTokens: 160,
          },
        }),
      },
    });

    const result = await runBotTurn({
      state: createBaseState(),
      playerId: playerOneId,
      legalMoveDefinitions,
      rules: {
        gameDefinition,
      },
      budgetController,
      bot,
    });

    expect(result.output.model).toBe('test-model');
    expect(result.selectedAction.id).toBe('deploy-piece:0');
    expect(budgetController.ledger.totalTokensUsed).toBe(160);
  });

  it('falls back to a heuristic bot when the LLM proposes an invalid action', async () => {
    const fallbackBot = createHeuristicBot();
    const bot = createExperimentalLLMBot({
      model: 'approved-model',
      maxOutputTokens: 64,
      fallbackBot,
      client: {
        complete: async () => ({
          structuredOutput: {
            chosenActionId: 'illegal-action',
            confidence: 0.2,
            thinkingTimeMs: 2,
          },
        }),
      },
    });

    const result = await runBotTurn({
      state: createBaseState(),
      playerId: playerOneId,
      legalMoveDefinitions,
      rules: {
        gameDefinition,
      },
      budgetController: createAISeatBudgetController({
        maxPromptTokens: 2000,
        maxCompletionTokens: 200,
        maxTotalTokens: 2200,
        maxCalls: 1,
        allowedModels: ['approved-model'],
      }),
      bot,
      fallbackBot,
    });

    expect(result.selectedAction.id).toBe('deploy-piece:0');
    expect(result.fallback?.botId).toBe(fallbackBot.id);
  });

  it('estimates tokens with a simple deterministic heuristic', () => {
    expect(estimateTextTokens('')).toBe(0);
    expect(estimateTextTokens('12345678')).toBe(2);
  });
});
