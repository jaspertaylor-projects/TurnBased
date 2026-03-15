import type { CanonicalAction, PlayerId, ZoneId } from '../actions';
import type { GameState } from '../state';
import {
  canViewerSeeEntityPresence,
  projectGameStateForPlayer,
} from '../visibility';
import type { VisiblePendingDecision } from '../visibility';
import type {
  CompiledLegalMoveTree,
  LegalAction,
  LegalActionBlueprint,
  LegalMoveDefinition,
  LegalMoveExecutionContext,
  LegalMoveGenerationContext,
  LegalMoveGenerationOptions,
  LegalMoveRequest,
  LegalMoveValidationResult,
  LegalSubChoice,
  NormalizedLegalMoveRequest,
} from './types';

type CompiledActionRecord = {
  action: LegalAction;
  materialize: (request: NormalizedLegalMoveRequest) => CanonicalAction[];
};

function buildEntityVisibilityMaps(
  fullState: GameState,
  playerId: PlayerId,
  visibility: LegalMoveGenerationOptions['visibility'],
): {
  rawToVisible: Map<string, string>;
  visibleToRaw: Map<string, string>;
} {
  const rawToVisible = new Map<string, string>();
  const visibleToRaw = new Map<string, string>();
  const projectedState = projectGameStateForPlayer(fullState, playerId, visibility);

  for (const zone of Object.values(fullState.zones)) {
    const visibleZone = projectedState.zones[zone.id];
    if (!visibleZone) {
      continue;
    }

    let visibleIndex = 0;
    for (const entityId of zone.entityIds) {
      if (!canViewerSeeEntityPresence(fullState, entityId, playerId, visibility)) {
        continue;
      }

      const visibleEntityId = visibleZone.entityIds[visibleIndex];
      visibleIndex += 1;

      if (!visibleEntityId) {
        continue;
      }

      rawToVisible.set(entityId, visibleEntityId);
      visibleToRaw.set(visibleEntityId, entityId);
    }
  }

  return {
    rawToVisible,
    visibleToRaw,
  };
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function uniqueStrings(values: Iterable<string>): string[] {
  return [...new Set(values)];
}

function mapEntityIdsForPublic(
  ids: readonly string[] | undefined,
  rawToVisible: Map<string, string>,
  visibleEntityIds: ReadonlySet<string>,
): string[] {
  if (!ids || ids.length === 0) {
    return [];
  }

  return uniqueStrings(
    ids.flatMap((id) => {
      const mappedId = rawToVisible.get(id) ?? id;
      return mappedId && visibleEntityIds.has(mappedId) ? [mappedId] : [];
    }),
  );
}

function mapSubChoicesForPublic(
  subChoices: readonly LegalSubChoice[] | undefined,
  rawToVisible: Map<string, string>,
  visibleEntityIds: ReadonlySet<string>,
  visibleZoneIds: ReadonlySet<string>,
): LegalSubChoice[] | undefined {
  if (!subChoices || subChoices.length === 0) {
    return undefined;
  }

  return subChoices.map((subChoice) => ({
    ...subChoice,
    options: subChoice.options.map((option) => ({
      ...option,
      entityId: option.entityId
        ? (() => {
            const mappedId = rawToVisible.get(option.entityId) ?? option.entityId;
            return visibleEntityIds.has(mappedId) ? mappedId : undefined;
          })()
        : undefined,
      zoneId: option.zoneId && visibleZoneIds.has(option.zoneId) ? option.zoneId : undefined,
    })),
  }));
}

function createActionExplanation(
  blueprint: LegalActionBlueprint,
  generatedBy: string,
  context: LegalMoveGenerationContext,
): LegalAction['explanation'] {
  const baseExplanation = blueprint.explanation;

  if (baseExplanation) {
    return {
      ...baseExplanation,
      generatedBy: baseExplanation.generatedBy ?? generatedBy,
      context: baseExplanation.context ?? {
        phase: context.state.turnState.currentPhase,
        step: context.state.turnState.currentStep,
        priorityWindowOpen: context.state.priorityWindow.isOpen,
        pendingDecisionId: context.pendingDecision?.id,
      },
    };
  }

  return {
    summary: `${blueprint.displayName} is currently legal.`,
    generatedBy,
    context: {
      phase: context.state.turnState.currentPhase,
      step: context.state.turnState.currentStep,
      priorityWindowOpen: context.state.priorityWindow.isOpen,
      pendingDecisionId: context.pendingDecision?.id,
    },
  };
}

function compileBlueprint(
  blueprint: LegalActionBlueprint,
  context: LegalMoveGenerationContext,
  actionId: string,
  rawToVisible: Map<string, string>,
  visibleToRaw: Map<string, string>,
): CompiledActionRecord {
  const visibleEntityIds = new Set(Object.keys(context.state.entities));
  const visibleZoneIds = new Set(
    Object.values(context.state.zones)
      .filter((zone) => zone.isVisibleToViewer)
      .map((zone) => zone.id),
  );

  const action: LegalAction = {
    id: actionId,
    type: blueprint.type,
    displayName: blueprint.displayName,
    description: blueprint.description,
    interactableEntities: mapEntityIdsForPublic(
      blueprint.interactableEntities,
      rawToVisible,
      visibleEntityIds,
    ),
    validDestinations: uniqueStrings(
      (blueprint.validDestinations ?? []).filter((zoneId) => visibleZoneIds.has(zoneId)),
    ) as ZoneId[],
    validTargets: mapEntityIdsForPublic(
      blueprint.validTargets,
      rawToVisible,
      visibleEntityIds,
    ),
    subChoices: mapSubChoicesForPublic(
      blueprint.subChoices,
      rawToVisible,
      visibleEntityIds,
      visibleZoneIds,
    ),
    cost: blueprint.cost ? { ...blueprint.cost } : undefined,
    tags: uniqueStrings(blueprint.tags ?? []),
    explanation: createActionExplanation(blueprint, actionId.split(':')[0] ?? actionId, context),
  };

  const materialize = (request: NormalizedLegalMoveRequest): CanonicalAction[] => {
    const executionContext: LegalMoveExecutionContext = {
      ...context,
      action,
      request,
      resolveEntityId: (entityId: string) => visibleToRaw.get(entityId) ?? entityId,
    };

    if (blueprint.buildCanonicalActions) {
      return blueprint.buildCanonicalActions(executionContext);
    }

    return (blueprint.canonicalActions ?? []).map((canonicalAction) => structuredClone(canonicalAction));
  };

  return {
    action,
    materialize,
  };
}

function createPendingDecisionAction(
  decision: VisiblePendingDecision,
  context: LegalMoveGenerationContext,
): LegalActionBlueprint {
  const enabledOptions = decision.options.filter((option) => !option.disabled);

  if (decision.type === 'confirm' && enabledOptions.length === 1) {
    const option = enabledOptions[0];
    return {
      id: `decision:${decision.id}:confirm`,
      type: 'CHOOSE_OPTION',
      displayName: 'Confirm',
      description: decision.prompt,
      tags: ['decision', 'confirm'],
      explanation: {
        summary: decision.prompt,
        details: ['Resolve the pending confirmation prompt.'],
      },
      canonicalActions: [
        {
          type: 'CHOOSE_OPTION',
          payload: {
            decisionId: decision.id,
            chosenOptionIds: [option.id],
          },
          source: {
            type: 'player',
            playerId: context.playerId,
          },
          timestamp: context.state.version + 1,
        },
      ],
    };
  }

  const subChoiceType =
    decision.type === 'choose_entity' || decision.type === 'choose_target'
      ? 'select_entity'
      : 'select_option';

  return {
    id: `decision:${decision.id}:resolve`,
    type: 'CHOOSE_OPTION',
    displayName: 'Resolve decision',
    description: decision.prompt,
    tags: ['decision'],
    subChoices: [
      {
        id: 'decision-choice',
        type: subChoiceType,
        prompt: decision.prompt,
        options: decision.options.map((option) => ({
          id: option.id,
          label: option.label,
          description: option.description,
          entityId: option.entityId,
          zoneId: option.zoneId,
          disabled: option.disabled,
          disabledReason: option.disabledReason,
        })),
        minChoices: decision.minChoices,
        maxChoices: decision.maxChoices,
      },
    ],
    explanation: {
      summary: decision.prompt,
      details: ['Resolve the pending prompt before taking other actions.'],
    },
    buildCanonicalActions: ({ request }) => {
      const selection = request.subChoiceSelections['decision-choice'];
      const chosenOptionIds = Array.isArray(selection)
        ? selection.filter((value): value is string => typeof value === 'string')
        : typeof selection === 'string'
          ? [selection]
          : [];

      return [
        {
          type: 'CHOOSE_OPTION',
          payload: {
            decisionId: decision.id,
            chosenOptionIds,
          },
          source: {
            type: 'player',
            playerId: context.playerId,
          },
          timestamp: context.state.version + 1,
        },
      ];
    },
  };
}

function createPassPriorityAction(context: LegalMoveGenerationContext): LegalActionBlueprint {
  return {
    id: 'priority:pass',
    type: 'PASS_PRIORITY',
    displayName: 'Pass priority',
    description: 'Pass without adding another response.',
    tags: ['priority', 'pass'],
    explanation: {
      summary: 'Priority is open and you may pass.',
      details: ['Passing keeps the stack and response window moving.'],
    },
    canonicalActions: [
      {
        type: 'PASS_PRIORITY',
        payload: {
          playerId: context.playerId,
        },
        source: {
          type: 'player',
          playerId: context.playerId,
        },
        timestamp: context.state.version + 1,
      },
    ],
  };
}

function collectBlueprints(
  context: LegalMoveGenerationContext,
  definitions: readonly LegalMoveDefinition[],
  pendingDecision: VisiblePendingDecision | null,
): LegalActionBlueprint[] {
  if (!context.canAct) {
    return [];
  }

  if (pendingDecision) {
    return [createPendingDecisionAction(pendingDecision, context)];
  }

  const blueprints: LegalActionBlueprint[] = [];

  if (context.hasPriority) {
    blueprints.push(createPassPriorityAction(context));
  }

  for (const definition of definitions) {
    const generated = definition.generate?.(context);
    const definitionBlueprints = toArray(generated).filter((candidate): candidate is LegalActionBlueprint => Boolean(candidate));

    definitionBlueprints.forEach((blueprint, index) => {
      blueprints.push({
        ...blueprint,
        id: blueprint.id ?? `${definition.id}:${index}`,
      });
    });
  }

  return blueprints;
}

function normalizeSubChoiceSelection(
  subChoice: LegalSubChoice,
  rawSelection: string | number | boolean | string[] | undefined,
  errors: string[],
): string | number | boolean | string[] | undefined {
  if (rawSelection === undefined) {
    if (subChoice.minChoices === 0) {
      return undefined;
    }

    const enabledOptions = subChoice.options.filter((option) => !option.disabled);
    if (enabledOptions.length === 1 && subChoice.minChoices === 1 && subChoice.maxChoices === 1) {
      return enabledOptions[0]?.id;
    }

    errors.push(`Missing selection for sub-choice "${subChoice.id}".`);
    return undefined;
  }

  const optionIds = new Set(subChoice.options.map((option) => option.id));

  if (Array.isArray(rawSelection)) {
    const selectedIds = rawSelection.filter((value): value is string => typeof value === 'string');
    if (selectedIds.length < subChoice.minChoices || selectedIds.length > subChoice.maxChoices) {
      errors.push(
        `Sub-choice "${subChoice.id}" requires between ${subChoice.minChoices} and ${subChoice.maxChoices} selections.`,
      );
    }

    for (const selectedId of selectedIds) {
      if (!optionIds.has(selectedId)) {
        errors.push(`Sub-choice "${subChoice.id}" has an invalid option "${selectedId}".`);
      }
    }

    return selectedIds;
  }

  if (typeof rawSelection === 'string') {
    if (subChoice.type !== 'set_value' && !optionIds.has(rawSelection)) {
      errors.push(`Sub-choice "${subChoice.id}" has an invalid option "${rawSelection}".`);
    }
    return rawSelection;
  }

  if (subChoice.type !== 'set_value') {
    errors.push(`Sub-choice "${subChoice.id}" only accepts listed options.`);
  }

  return rawSelection;
}

function validateRequestAgainstAction(action: LegalAction, request: LegalMoveRequest): LegalMoveValidationResult {
  const errors: string[] = [];
  const normalizedRequest: NormalizedLegalMoveRequest = {
    actionId: request.actionId,
    selectedEntityId: request.selectedEntityId ?? null,
    destinationZoneId: request.destinationZoneId ?? null,
    targetEntityId: request.targetEntityId ?? null,
    subChoiceSelections: {},
  };

  if (action.interactableEntities.length > 0) {
    const selectedEntityId =
      request.selectedEntityId ?? (action.interactableEntities.length === 1 ? action.interactableEntities[0] ?? null : null);

    if (!selectedEntityId) {
      errors.push(`Action "${action.id}" requires selecting an entity.`);
    } else if (!action.interactableEntities.includes(selectedEntityId)) {
      errors.push(`Entity "${selectedEntityId}" is not valid for action "${action.id}".`);
    } else {
      normalizedRequest.selectedEntityId = selectedEntityId;
    }
  }

  if (action.validDestinations.length > 0) {
    const destinationZoneId =
      request.destinationZoneId ?? (action.validDestinations.length === 1 ? action.validDestinations[0] ?? null : null);

    if (!destinationZoneId) {
      errors.push(`Action "${action.id}" requires selecting a destination.`);
    } else if (!action.validDestinations.includes(destinationZoneId)) {
      errors.push(`Zone "${destinationZoneId}" is not a valid destination for action "${action.id}".`);
    } else {
      normalizedRequest.destinationZoneId = destinationZoneId;
    }
  }

  if (action.validTargets.length > 0) {
    const targetEntityId =
      request.targetEntityId ?? (action.validTargets.length === 1 ? action.validTargets[0] ?? null : null);

    if (!targetEntityId) {
      errors.push(`Action "${action.id}" requires selecting a target.`);
    } else if (!action.validTargets.includes(targetEntityId)) {
      errors.push(`Target "${targetEntityId}" is not valid for action "${action.id}".`);
    } else {
      normalizedRequest.targetEntityId = targetEntityId;
    }
  }

  for (const subChoice of action.subChoices ?? []) {
    const normalizedSelection = normalizeSubChoiceSelection(
      subChoice,
      request.subChoiceSelections?.[subChoice.id],
      errors,
    );

    if (normalizedSelection !== undefined) {
      normalizedRequest.subChoiceSelections[subChoice.id] = normalizedSelection;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedRequest: errors.length === 0 ? normalizedRequest : null,
  };
}

function determineActingPlayerId(state: GameState, requestedPlayerId?: PlayerId): PlayerId {
  if (requestedPlayerId) {
    return requestedPlayerId;
  }

  return state.priorityWindow.currentPlayerId ?? state.turnState.activePlayerId;
}

function isPubliclyUsableAction(
  blueprint: LegalActionBlueprint,
  action: LegalAction,
): boolean {
  if ((blueprint.interactableEntities?.length ?? 0) > 0 && action.interactableEntities.length === 0) {
    return false;
  }

  if ((blueprint.validDestinations?.length ?? 0) > 0 && action.validDestinations.length === 0) {
    return false;
  }

  if ((blueprint.validTargets?.length ?? 0) > 0 && action.validTargets.length === 0) {
    return false;
  }

  return true;
}

export function generateLegalMoveTree(
  state: GameState,
  options: LegalMoveGenerationOptions = {},
): CompiledLegalMoveTree {
  const playerId = determineActingPlayerId(state, options.playerId);
  const visibleState = projectGameStateForPlayer(state, playerId, options.visibility);
  const pendingDecision = visibleState.pendingDecisions.find((decision) => decision.playerId === playerId) ?? null;
  const hasPriority =
    visibleState.priorityWindow.isOpen && visibleState.priorityWindow.currentPlayerId === playerId;
  const canAct =
    Boolean(pendingDecision) ||
    hasPriority ||
    (!visibleState.priorityWindow.isOpen && visibleState.turnState.activePlayerId === playerId);

  const { rawToVisible, visibleToRaw } = buildEntityVisibilityMaps(state, playerId, options.visibility);

  const generationContext: LegalMoveGenerationContext = {
    state: visibleState,
    playerId,
    pendingDecision,
    canAct,
    hasPriority,
    helpers: {
      getVisibleEntity: (entityId: string) => visibleState.entities[rawToVisible.get(entityId) ?? entityId],
      getVisibleZone: (zoneId: ZoneId) => visibleState.zones[zoneId],
      listVisibleEntities: () => Object.values(visibleState.entities),
      listVisibleZones: () => Object.values(visibleState.zones),
      toVisibleEntityId: (entityId: string) => rawToVisible.get(entityId) ?? (visibleState.entities[entityId] ? entityId : null),
    },
  };

  const compiledActions = new Map<string, CompiledActionRecord>();
  const availableActions: LegalAction[] = [];
  const blueprints = collectBlueprints(generationContext, options.definitions ?? [], pendingDecision);

  for (const [index, blueprint] of blueprints.entries()) {
    const actionId = blueprint.id ?? `${blueprint.type.toLowerCase()}:${index}`;
    const compiledAction = compileBlueprint(
      blueprint,
      generationContext,
      actionId,
      rawToVisible,
      visibleToRaw,
    );

    if (!isPubliclyUsableAction(blueprint, compiledAction.action)) {
      continue;
    }

    compiledActions.set(actionId, compiledAction);
    availableActions.push(compiledAction.action);
  }

  const canPass = availableActions.some((action) => action.type === 'PASS_PRIORITY');
  const canCancel =
    Boolean(pendingDecision) ||
    availableActions.some(
      (action) =>
        action.interactableEntities.length > 0 ||
        action.validDestinations.length > 0 ||
        action.validTargets.length > 0 ||
        (action.subChoices?.length ?? 0) > 0,
    );

  return {
    playerId,
    availableActions,
    canPass,
    canCancel,
    pendingDecision,
    visibleState,
    getAction: (actionId: string) => compiledActions.get(actionId)?.action,
    validate: (request: LegalMoveRequest) => {
      const compiledAction = compiledActions.get(request.actionId);
      if (!compiledAction) {
        return {
          isValid: false,
          errors: [`Unknown action "${request.actionId}".`],
          normalizedRequest: null,
        };
      }

      return validateRequestAgainstAction(compiledAction.action, request);
    },
    materialize: (request: LegalMoveRequest) => {
      const compiledAction = compiledActions.get(request.actionId);
      if (!compiledAction) {
        throw new Error(`Unknown action "${request.actionId}".`);
      }

      const validation = validateRequestAgainstAction(compiledAction.action, request);
      if (!validation.isValid || !validation.normalizedRequest) {
        throw new Error(validation.errors.join(' '));
      }

      return compiledAction.materialize(validation.normalizedRequest);
    },
  };
}

export function getValidDestinations(
  moveTree: Pick<CompiledLegalMoveTree, 'availableActions'>,
  entityId: string,
): ZoneId[] {
  return uniqueStrings(
    moveTree.availableActions.flatMap((action) =>
      action.interactableEntities.includes(entityId) ? action.validDestinations : [],
    ),
  ) as ZoneId[];
}

export function getValidEntitiesForDestination(
  moveTree: Pick<CompiledLegalMoveTree, 'availableActions'>,
  zoneId: ZoneId,
): string[] {
  return uniqueStrings(
    moveTree.availableActions.flatMap((action) =>
      action.validDestinations.includes(zoneId) ? action.interactableEntities : [],
    ),
  );
}
