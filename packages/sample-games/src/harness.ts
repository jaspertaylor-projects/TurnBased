import {
  createHeuristicBot,
  runBotTurn,
} from '@turnbased/engine-ai';
import {
  applyActionWithTriggers,
  generateLegalMoveTree,
  hashGameState,
  nextRandomFloat,
  replayActionsWithTriggers,
} from '@turnbased/engine-core';
import type {
  CanonicalAction,
  GameState,
  LegalSubChoice,
  PlayerId,
  PriorityResponderContext,
} from '@turnbased/engine-core';
import { ParticipantRole } from '@turnbased/shared-types';

import type {
  ReplayRecord,
  ReplayVerificationResult,
  SampleGameDefinition,
  SampleGameExpectedOutcome,
  SimulationOptions,
  SimulationResult,
  SimulationSeatConfig,
  SimulationStepRecord,
} from './types';

function getActingPlayerId(state: GameState): PlayerId {
  return state.priorityWindow.currentPlayerId ?? state.turnState.activePlayerId;
}

function pickRandomIndex(
  length: number,
  randomState: GameState['randomState'],
): { index: number; randomState: GameState['randomState'] } {
  const result = nextRandomFloat(randomState);
  return {
    index: Math.max(0, Math.floor(result.value * length) % length),
    randomState: result.randomState,
  };
}

function pickRandomSubChoiceSelection(
  subChoice: LegalSubChoice,
  randomState: GameState['randomState'],
): { selection: string | string[] | undefined; randomState: GameState['randomState'] } {
  const enabledOptions = subChoice.options.filter((option) => !option.disabled);
  if (enabledOptions.length === 0) {
    return {
      selection: undefined,
      randomState,
    };
  }

  if (subChoice.maxChoices > 1) {
    const count = Math.min(
      enabledOptions.length,
      Math.max(subChoice.minChoices, 1),
    );
    return {
      selection: enabledOptions.slice(0, count).map((option) => option.id),
      randomState,
    };
  }

  const pick = pickRandomIndex(enabledOptions.length, randomState);
  return {
    selection: enabledOptions[pick.index]?.id,
    randomState: pick.randomState,
  };
}

function createRandomSubmission(
  game: SampleGameDefinition,
  state: GameState,
  playerId: PlayerId,
  randomState: GameState['randomState'],
): { actions: CanonicalAction[]; randomState: GameState['randomState'] } {
  const moveTree = generateLegalMoveTree(state, {
    playerId,
    definitions: game.legalMoveDefinitions,
  });

  const actionable = moveTree.availableActions.filter((action) => action.type !== 'PASS_PRIORITY');
  const actions = actionable.length > 0 ? actionable : moveTree.availableActions;
  if (actions.length === 0) {
    return {
      actions: [],
      randomState,
    };
  }

  let nextRandomState = randomState;
  const actionPick = pickRandomIndex(actions.length, nextRandomState);
  const action = actions[actionPick.index] ?? actions[0];
  nextRandomState = actionPick.randomState;

  const request: Parameters<typeof moveTree.materialize>[0] = {
    actionId: action.id,
  };

  if (action.interactableEntities.length > 0) {
    const entityPick = pickRandomIndex(action.interactableEntities.length, nextRandomState);
    request.selectedEntityId = action.interactableEntities[entityPick.index] ?? action.interactableEntities[0];
    nextRandomState = entityPick.randomState;
  }

  if (action.validDestinations.length > 0) {
    const destinationPick = pickRandomIndex(action.validDestinations.length, nextRandomState);
    request.destinationZoneId =
      action.validDestinations[destinationPick.index] ?? action.validDestinations[0];
    nextRandomState = destinationPick.randomState;
  }

  if (action.validTargets.length > 0) {
    const targetPick = pickRandomIndex(action.validTargets.length, nextRandomState);
    request.targetEntityId = action.validTargets[targetPick.index] ?? action.validTargets[0];
    nextRandomState = targetPick.randomState;
  }

  for (const subChoice of action.subChoices ?? []) {
    const selection = pickRandomSubChoiceSelection(subChoice, nextRandomState);
    nextRandomState = selection.randomState;
    if (selection.selection !== undefined) {
      request.subChoiceSelections = {
        ...(request.subChoiceSelections ?? {}),
        [subChoice.id]: selection.selection,
      };
    }
  }

  return {
    actions: moveTree.materialize(request),
    randomState: nextRandomState,
  };
}

function createPriorityResponder(game: SampleGameDefinition) {
  return ({ state, playerId }: PriorityResponderContext): boolean => {
    const moveTree = generateLegalMoveTree(state, {
      playerId,
      definitions: game.legalMoveDefinitions,
    });

    return moveTree.availableActions.some((action) => action.type !== 'PASS_PRIORITY');
  };
}

function applySubmittedActions(
  game: SampleGameDefinition,
  state: GameState,
  actions: readonly CanonicalAction[],
): { state: GameState; appliedActions: CanonicalAction[] } {
  const responder = createPriorityResponder(game);
  let nextState = state;
  const appliedActions: CanonicalAction[] = [];

  for (const action of actions) {
    nextState = applyActionWithTriggers(nextState, action, {
      triggers: game.triggers,
      priorityPolicy: game.gameDefinition.priorityPolicy,
      canPlayerRespond: responder,
    }).state;
    appliedActions.push(action);

    if (nextState.status === 'finished') {
      break;
    }
  }

  return {
    state: nextState,
    appliedActions,
  };
}

function resolveSeat(
  playerId: PlayerId,
  options: SimulationOptions,
  defaultMode: 'random' | 'heuristic',
): SimulationSeatConfig {
  const configured = options.seats?.[playerId];
  if (configured) {
    return configured;
  }

  return {
    mode: defaultMode,
    role: defaultMode === 'heuristic' ? ParticipantRole.AI : ParticipantRole.Player,
  };
}

async function runSimulation(
  game: SampleGameDefinition,
  options: SimulationOptions,
  defaultMode: 'random' | 'heuristic',
  mode: SimulationResult['mode'],
): Promise<SimulationResult> {
  let state = game.createInitialState({
    seed: options.seed,
    playerRoles: statePlayerRoles(game, options, defaultMode),
  });
  let randomState = state.randomState;
  const rootActions: CanonicalAction[] = [];
  const steps: SimulationStepRecord[] = [];
  const maxTurns = options.maxTurns ?? 32;

  for (let turnIndex = 0; turnIndex < maxTurns; turnIndex += 1) {
    if (state.status === 'finished') {
      return {
        gameId: game.id,
        mode,
        completed: true,
        stopReason: 'finished',
        finalState: state,
        finalStateHash: hashGameState(state),
        rootActions,
        steps,
      };
    }

    const playerId = getActingPlayerId(state);
    const seat = resolveSeat(playerId, options, defaultMode);
    let submittedActions: CanonicalAction[] = [];
    let source: SimulationStepRecord['actionSource'] = seat.mode === 'random' ? 'random' : 'heuristic';

    if (seat.mode === 'random') {
      const randomSelection = createRandomSubmission(game, state, playerId, randomState);
      submittedActions = randomSelection.actions;
      randomState = randomSelection.randomState;
    } else {
      const runner = await runBotTurn({
        state,
        playerId,
        legalMoveDefinitions: game.legalMoveDefinitions,
        bot: seat.bot ?? createHeuristicBot({ profile: seat.strategyProfile }),
        rules: game.rules,
      });
      submittedActions = runner.canonicalActions;
    }

    if (submittedActions.length === 0) {
      return {
        gameId: game.id,
        mode,
        completed: false,
        stopReason: 'no_legal_actions',
        finalState: state,
        finalStateHash: hashGameState(state),
        rootActions,
        steps,
      };
    }

    const appliedResult = applySubmittedActions(game, state, submittedActions);
    state = appliedResult.state;
    rootActions.push(...appliedResult.appliedActions);
    steps.push({
      turnIndex,
      playerId,
      actionSource: source,
      submittedActions: appliedResult.appliedActions,
      stateHashAfterStep: hashGameState(state),
    });
  }

  return {
    gameId: game.id,
    mode,
    completed: state.status === 'finished',
    stopReason: state.status === 'finished' ? 'finished' : 'max_turns',
    finalState: state,
    finalStateHash: hashGameState(state),
    rootActions,
    steps,
  };
}

function statePlayerRoles(
  game: SampleGameDefinition,
  options: SimulationOptions,
  defaultMode: 'random' | 'heuristic',
): ParticipantRole[] {
  const state = game.createInitialState();
  return state.playerOrder.map((playerId) => {
    const seat = resolveSeat(playerId, options, defaultMode);
    return seat.role ?? (seat.mode === 'heuristic' ? ParticipantRole.AI : ParticipantRole.Player);
  });
}

export function createReplayRecord(
  result: SimulationResult,
  seed: number,
): ReplayRecord {
  return {
    gameId: result.gameId,
    seed,
    playerRoles: result.finalState.playerOrder.map(
      (playerId) => result.finalState.players[playerId]?.role ?? ParticipantRole.Player,
    ),
    rootActions: result.rootActions,
    expectedFinalStateHash: result.finalStateHash,
  };
}

export function replayRecord(
  game: SampleGameDefinition,
  replay: ReplayRecord,
): ReplayVerificationResult {
  const finalState = replayActionsWithTriggers(
    game.createInitialState({
      seed: replay.seed,
      playerRoles: replay.playerRoles,
    }),
    replay.rootActions,
    {
      triggers: game.triggers,
      priorityPolicy: game.gameDefinition.priorityPolicy,
      canPlayerRespond: createPriorityResponder(game),
    },
  );
  const actualFinalStateHash = hashGameState(finalState);
  const expectedFinalStateHash = replay.expectedFinalStateHash ?? null;

  return {
    matches:
      expectedFinalStateHash === null
        ? true
        : expectedFinalStateHash === actualFinalStateHash,
    expectedFinalStateHash,
    actualFinalStateHash,
    finalState,
  };
}

export function runRegressionCase(
  game: SampleGameDefinition,
  submittedActions: readonly CanonicalAction[],
): GameState {
  return replayActionsWithTriggers(
    game.createInitialState(),
    submittedActions,
    {
      triggers: game.triggers,
      priorityPolicy: game.gameDefinition.priorityPolicy,
      canPlayerRespond: createPriorityResponder(game),
    },
  );
}

export function assertExpectedOutcome(
  state: GameState,
  expected: SampleGameExpectedOutcome,
): void {
  if (expected.status !== undefined && state.status !== expected.status) {
    throw new Error(`Expected status ${expected.status}, received ${state.status}.`);
  }

  if (expected.winner !== undefined && JSON.stringify(state.winner) !== JSON.stringify(expected.winner)) {
    throw new Error(`Expected winner ${JSON.stringify(expected.winner)}, received ${JSON.stringify(state.winner)}.`);
  }

  if (expected.activePlayerId !== undefined && state.turnState.activePlayerId !== expected.activePlayerId) {
    throw new Error(`Expected active player ${expected.activePlayerId}, received ${state.turnState.activePlayerId}.`);
  }

  if (expected.turnDirection !== undefined && state.turnState.turnDirection !== expected.turnDirection) {
    throw new Error(`Expected turn direction ${expected.turnDirection}, received ${state.turnState.turnDirection}.`);
  }

  for (const [playerId, score] of Object.entries(expected.scores ?? {})) {
    if ((state.players[playerId]?.score ?? 0) !== score) {
      throw new Error(`Expected ${playerId} score ${score}, received ${state.players[playerId]?.score ?? 0}.`);
    }
  }

  for (const [playerId, resources] of Object.entries(expected.resources ?? {})) {
    for (const [resource, amount] of Object.entries(resources)) {
      if ((state.players[playerId]?.resources[resource] ?? 0) !== amount) {
        throw new Error(
          `Expected ${playerId} resource ${resource} to equal ${amount}, received ${state.players[playerId]?.resources[resource] ?? 0}.`,
        );
      }
    }
  }

  for (const [zoneId, entityIds] of Object.entries(expected.zoneContents ?? {})) {
    const actual = state.zones[zoneId]?.entityIds.map(String) ?? [];
    if (JSON.stringify(actual) !== JSON.stringify(entityIds)) {
      throw new Error(`Expected zone ${zoneId} to contain ${JSON.stringify(entityIds)}, received ${JSON.stringify(actual)}.`);
    }
  }

  if (expected.stateHash !== undefined && hashGameState(state) !== expected.stateHash) {
    throw new Error(`Expected state hash ${expected.stateHash}, received ${hashGameState(state)}.`);
  }
}

export async function runRandomSimulation(
  game: SampleGameDefinition,
  options: SimulationOptions = {},
): Promise<SimulationResult> {
  return runSimulation(game, options, 'random', 'random');
}

export async function runSelfPlaySimulation(
  game: SampleGameDefinition,
  options: SimulationOptions = {},
): Promise<SimulationResult> {
  return runSimulation(game, options, 'heuristic', 'self-play');
}
