import type { ActionLogEntry } from '../actions';
import type {
  GameState,
  PhaseDefinition,
  PlayerId,
  StepDefinition,
  TurnDirection,
  TurnState,
} from '../state';

function cloneActionLogEntries(entries?: readonly ActionLogEntry[]): ActionLogEntry[] | undefined {
  return entries?.map((entry) => ({ ...entry }));
}

export function cloneStepDefinition(step: StepDefinition): StepDefinition {
  return {
    ...step,
    onEnter: cloneActionLogEntries(step.onEnter),
    onExit: cloneActionLogEntries(step.onExit),
  };
}

export function clonePhaseDefinition(phase: PhaseDefinition): PhaseDefinition {
  return {
    ...phase,
    steps: phase.steps.map((step) => cloneStepDefinition(step)),
    onEnter: cloneActionLogEntries(phase.onEnter),
    onExit: cloneActionLogEntries(phase.onExit),
  };
}

export function cloneTurnPhases(phases: readonly PhaseDefinition[]): PhaseDefinition[] {
  return phases.map((phase) => clonePhaseDefinition(phase));
}

function getNextPlayerIndex(
  playerOrder: readonly PlayerId[],
  currentPlayerId: PlayerId,
  direction: TurnDirection,
): number {
  const currentIndex = playerOrder.indexOf(currentPlayerId);

  if (currentIndex === -1) {
    return 0;
  }

  if (direction === 'reverse') {
    return (currentIndex - 1 + playerOrder.length) % playerOrder.length;
  }

  return (currentIndex + 1) % playerOrder.length;
}

function getEligibleParticipants(state: GameState): PlayerId[] {
  return state.playerOrder.filter((playerId) => {
    const player = state.players[playerId];
    return player && !player.isEliminated;
  });
}

function setActivePlayer(state: GameState, activePlayerId: PlayerId): void {
  Object.values(state.players).forEach((player) => {
    player.isActive = player.id === activePlayerId;
  });
  state.turnState.activePlayerId = activePlayerId;
}

function syncTurnPointer(turnState: TurnState): void {
  if (turnState.phases.length === 0) {
    turnState.phaseIndex = 0;
    turnState.stepIndex = 0;
    turnState.currentPhase = '';
    turnState.currentStep = '';
    return;
  }

  if (turnState.phaseIndex < 0) {
    turnState.phaseIndex = 0;
  } else if (turnState.phaseIndex >= turnState.phases.length) {
    turnState.phaseIndex = turnState.phases.length - 1;
  }

  const currentPhase = turnState.phases[turnState.phaseIndex];
  turnState.currentPhase = currentPhase.name;

  if (currentPhase.steps.length === 0) {
    turnState.stepIndex = 0;
    turnState.currentStep = '';
    return;
  }

  if (turnState.stepIndex < 0) {
    turnState.stepIndex = 0;
  } else if (turnState.stepIndex >= currentPhase.steps.length) {
    turnState.stepIndex = currentPhase.steps.length - 1;
  }

  turnState.currentStep = currentPhase.steps[turnState.stepIndex]?.name ?? '';
}

export function resetTurnStructure(turnState: TurnState): void {
  const templatePhases = turnState.basePhases.length > 0 ? turnState.basePhases : turnState.phases;
  turnState.phases = cloneTurnPhases(templatePhases);
  turnState.phaseIndex = 0;
  turnState.stepIndex = 0;
  syncTurnPointer(turnState);
}

function dequeueNextExtraTurn(state: GameState): PlayerId | null {
  while (state.turnState.extraTurns.length > 0) {
    const candidate = state.turnState.extraTurns.shift();

    if (!candidate) {
      continue;
    }

    const player = state.players[candidate];
    if (player && !player.isEliminated) {
      return candidate;
    }
  }

  return null;
}

function recordCompletedTurn(state: GameState, playerId: PlayerId): void {
  if (state.turnState.currentTurnKind !== 'normal') {
    return;
  }

  const player = state.players[playerId];
  if (!player || player.isEliminated) {
    return;
  }

  if (!state.turnState.completedPlayerIdsThisRound.includes(playerId)) {
    state.turnState.completedPlayerIdsThisRound = [
      ...state.turnState.completedPlayerIdsThisRound,
      playerId,
    ];
  }
}

function selectNextNormalTurnPlayer(state: GameState, currentPlayerId: PlayerId): {
  playerId: PlayerId;
  roundWrapped: boolean;
} {
  const eligibleParticipants = getEligibleParticipants(state);

  if (eligibleParticipants.length === 0) {
    return {
      playerId: currentPlayerId,
      roundWrapped: false,
    };
  }

  let pointerId = currentPlayerId;

  for (let pass = 0; pass < 2; pass += 1) {
    for (let attempts = 0; attempts < state.playerOrder.length; attempts += 1) {
      const nextIndex = getNextPlayerIndex(
        state.playerOrder,
        pointerId,
        state.turnState.turnDirection,
      );
      const candidateId = state.playerOrder[nextIndex];
      pointerId = candidateId;

      const candidate = state.players[candidateId];
      if (!candidate || candidate.isEliminated) {
        continue;
      }

      if (state.turnState.skippedPlayers.includes(candidateId)) {
        state.turnState.skippedPlayers = state.turnState.skippedPlayers.filter(
          (playerId) => playerId !== candidateId,
        );
        continue;
      }

      return {
        playerId: candidateId,
        roundWrapped: state.turnState.completedPlayerIdsThisRound.includes(candidateId),
      };
    }
  }

  return {
    playerId: eligibleParticipants[0],
    roundWrapped: state.turnState.completedPlayerIdsThisRound.includes(eligibleParticipants[0]),
  };
}

export function endTurn(state: GameState): void {
  const currentPlayerId = state.turnState.activePlayerId;

  recordCompletedTurn(state, currentPlayerId);

  const extraTurnPlayerId = dequeueNextExtraTurn(state);
  if (extraTurnPlayerId) {
    setActivePlayer(state, extraTurnPlayerId);
    state.turnState.currentTurnKind = 'extra';
    state.turnState.turnNumber += 1;
    resetTurnStructure(state.turnState);
    return;
  }

  const nextNormalTurn = selectNextNormalTurnPlayer(state, currentPlayerId);

  if (nextNormalTurn.roundWrapped) {
    state.turnState.roundNumber += 1;
    state.turnState.completedPlayerIdsThisRound = [];
  }

  setActivePlayer(state, nextNormalTurn.playerId);
  state.turnState.currentTurnKind = 'normal';
  state.turnState.turnNumber += 1;
  resetTurnStructure(state.turnState);
}

export function advanceTurnPhase(state: GameState): void {
  const nextPhase = state.turnState.phases[state.turnState.phaseIndex + 1];

  if (nextPhase) {
    state.turnState.phaseIndex += 1;
    state.turnState.stepIndex = 0;
    syncTurnPointer(state.turnState);
    return;
  }

  endTurn(state);
}

export function advanceTurnStep(state: GameState): void {
  const currentPhase = state.turnState.phases[state.turnState.phaseIndex];
  const nextStep = currentPhase?.steps[state.turnState.stepIndex + 1];

  if (nextStep) {
    state.turnState.stepIndex += 1;
    syncTurnPointer(state.turnState);
    return;
  }

  advanceTurnPhase(state);
}

function getPhaseInsertIndex(turnState: TurnState, afterPhase?: string): number {
  if (afterPhase) {
    const namedIndex = turnState.phases.findIndex((phase) => phase.name === afterPhase);
    if (namedIndex >= 0) {
      return namedIndex + 1;
    }
  }

  return Math.min(turnState.phaseIndex + 1, turnState.phases.length);
}

export function insertTurnPhase(
  turnState: TurnState,
  phase: PhaseDefinition,
  afterPhase?: string,
): void {
  const insertIndex = getPhaseInsertIndex(turnState, afterPhase);

  turnState.phases = [
    ...turnState.phases.slice(0, insertIndex),
    clonePhaseDefinition(phase),
    ...turnState.phases.slice(insertIndex),
  ];

  if (insertIndex <= turnState.phaseIndex) {
    turnState.phaseIndex += 1;
  }

  syncTurnPointer(turnState);
}

function getTargetPhaseIndex(turnState: TurnState, phaseName?: string): number {
  if (phaseName) {
    const namedIndex = turnState.phases.findIndex((phase) => phase.name === phaseName);
    if (namedIndex >= 0) {
      return namedIndex;
    }
  }

  return turnState.phaseIndex;
}

export function insertTurnStep(
  turnState: TurnState,
  step: StepDefinition,
  phaseName?: string,
  afterStep?: string,
): void {
  const phaseIndex = getTargetPhaseIndex(turnState, phaseName);
  const targetPhase = turnState.phases[phaseIndex];

  if (!targetPhase) {
    return;
  }

  let insertIndex = targetPhase.steps.length;

  if (afterStep) {
    const namedIndex = targetPhase.steps.findIndex((candidate) => candidate.name === afterStep);
    if (namedIndex >= 0) {
      insertIndex = namedIndex + 1;
    }
  } else if (phaseIndex === turnState.phaseIndex) {
    insertIndex = Math.min(turnState.stepIndex + 1, targetPhase.steps.length);
  }

  targetPhase.steps = [
    ...targetPhase.steps.slice(0, insertIndex),
    cloneStepDefinition(step),
    ...targetPhase.steps.slice(insertIndex),
  ];

  if (phaseIndex === turnState.phaseIndex && insertIndex <= turnState.stepIndex) {
    turnState.stepIndex += 1;
  }

  syncTurnPointer(turnState);
}
