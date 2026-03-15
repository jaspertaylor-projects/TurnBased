import { ParticipantRole, Visibility } from '@turnbased/shared-types';

import type { ActionLogEntry } from '../actions';
import type {
  Entity,
  GameState,
  PendingDecision,
  PlayerId,
  PlayerState,
  StackItem,
  Zone,
} from '../state';
import type {
  FieldVisibilityRule,
  PlayerVisibleState,
  ResolvedViewerContext,
  SpectatorVisibilityPolicy,
  VisibilityFieldPolicies,
  VisibilityFieldPolicy,
  VisibilityFieldPolicyResolver,
  VisibilityProjectionOptions,
  VisibilityRedaction,
  ViewerContext,
  VisibleActionLogEntry,
  VisibleEntity,
  VisiblePendingDecision,
  VisibleStackItem,
  VisibleZone,
} from './types';

const HIDDEN_ENTITY_TOKEN = '[hidden-entity]';
const HIDDEN_ZONE_TOKEN = '[hidden-zone]';
const HIDDEN_DECISION_TOKEN = '[hidden-decision]';

interface PropertyAccessContext {
  ownerId?: PlayerId | null;
  controllerId?: PlayerId | null;
}

interface ProjectionRuntimeContext {
  state: GameState;
  viewer: ResolvedViewerContext;
  options: Required<Pick<VisibilityProjectionOptions, 'includeHiddenCounts'>>;
  fieldPolicies?: VisibilityFieldPolicies;
  redactions: VisibilityRedaction[];
}

interface ProjectedEntityResult {
  projectedId: string;
  visibleEntity: VisibleEntity;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOmniscientViewer(viewer: ResolvedViewerContext): boolean {
  return (
    viewer.role === ParticipantRole.Host ||
    (viewer.role === ParticipantRole.Spectator && viewer.spectatorPolicy === 'omniscient')
  );
}

function isResolvedViewerContext(
  viewer: ResolvedViewerContext | ViewerContext | PlayerId,
): viewer is ResolvedViewerContext {
  return typeof viewer !== 'string' && 'spectatorPolicy' in viewer;
}

function resolveRoleFromState(state: GameState, viewerId: PlayerId | null): ParticipantRole {
  if (!viewerId) {
    return ParticipantRole.Spectator;
  }

  return state.players[viewerId]?.role ?? ParticipantRole.Player;
}

export function resolveViewerContext(
  state: GameState,
  viewer: ViewerContext | PlayerId,
  options: VisibilityProjectionOptions = {},
): ResolvedViewerContext {
  const viewerContext =
    typeof viewer === 'string'
      ? {
          viewerId: viewer,
          role: undefined,
        }
      : viewer;

  const role = viewerContext.role ?? resolveRoleFromState(state, viewerContext.viewerId);
  const spectatorPolicy: SpectatorVisibilityPolicy =
    options.spectatorPolicy ?? 'public_only';

  return {
    viewerId: viewerContext.viewerId,
    role,
    spectatorPolicy,
  };
}

export function canViewerSeeZoneContents(
  state: GameState,
  zoneId: string,
  viewer: ResolvedViewerContext | ViewerContext | PlayerId,
  options: VisibilityProjectionOptions = {},
): boolean {
  const resolvedViewer = isResolvedViewerContext(viewer)
    ? viewer
    : resolveViewerContext(state, viewer, options);

  if (isOmniscientViewer(resolvedViewer)) {
    return true;
  }

  const zone = state.zones[zoneId];
  if (!zone) {
    return false;
  }

  const viewerId = resolvedViewer.viewerId;
  if (viewerId) {
    const explicitOverride = state.visibilityMap.zoneVisibility[zone.id]?.[viewerId];
    if (explicitOverride !== undefined) {
      return explicitOverride;
    }
  }

  const effectiveVisibility =
    (viewerId && zone.visibility.overrides[viewerId]) ?? zone.visibility.defaultVisibility;

  switch (effectiveVisibility) {
    case Visibility.Public:
      return true;
    case Visibility.Private:
      return Boolean(viewerId && zone.ownerId === viewerId);
    case Visibility.Hidden:
    case Visibility.Restricted:
    default:
      return false;
  }
}

export function canViewerSeeEntityPresence(
  state: GameState,
  entityId: string,
  viewer: ResolvedViewerContext | ViewerContext | PlayerId,
  options: VisibilityProjectionOptions = {},
): boolean {
  const resolvedViewer = isResolvedViewerContext(viewer)
    ? viewer
    : resolveViewerContext(state, viewer, options);

  if (isOmniscientViewer(resolvedViewer)) {
    return true;
  }

  const entity = state.entities[entityId];
  if (!entity) {
    return false;
  }

  const viewerId = resolvedViewer.viewerId;
  if (viewerId) {
    const explicitOverride = state.visibilityMap.entityVisibility[entity.id]?.[viewerId];
    if (explicitOverride !== undefined) {
      return explicitOverride;
    }
  }

  return canViewerSeeZoneContents(state, entity.zoneId, resolvedViewer);
}

export function canViewerSeeEntityDetails(
  state: GameState,
  entityId: string,
  viewer: ResolvedViewerContext | ViewerContext | PlayerId,
  options: VisibilityProjectionOptions = {},
): boolean {
  const resolvedViewer = isResolvedViewerContext(viewer)
    ? viewer
    : resolveViewerContext(state, viewer, options);

  if (isOmniscientViewer(resolvedViewer)) {
    return true;
  }

  const entity = state.entities[entityId];
  if (!entity) {
    return false;
  }

  const viewerId = resolvedViewer.viewerId;
  if (viewerId) {
    const explicitOverride = state.visibilityMap.entityVisibility[entity.id]?.[viewerId];
    if (explicitOverride !== undefined) {
      return explicitOverride;
    }
  }

  if (viewerId && (entity.ownerId === viewerId || entity.controllerId === viewerId)) {
    return true;
  }

  if (!canViewerSeeEntityPresence(state, entity.id, resolvedViewer)) {
    return false;
  }

  return entity.faceUp;
}

function createPresenceOnlyEntityId(entity: Entity): string {
  return `hidden:${entity.zoneId}:${entity.position}`;
}

function resolveFieldPolicy<TItem>(
  resolver: VisibilityFieldPolicyResolver<TItem> | undefined,
  context: {
    item: TItem;
    state: GameState;
    viewer: ResolvedViewerContext;
  },
): VisibilityFieldPolicy | undefined {
  if (!resolver) {
    return undefined;
  }

  if (typeof resolver === 'function') {
    return resolver(context);
  }

  return resolver;
}

function canViewerAccessField(
  rule: FieldVisibilityRule | undefined,
  viewer: ResolvedViewerContext,
  access: PropertyAccessContext,
): boolean {
  if (!rule || isOmniscientViewer(viewer)) {
    return true;
  }

  const viewerId = viewer.viewerId;

  if (rule === 'public') {
    return true;
  }

  if (rule === 'viewer') {
    return viewerId !== null;
  }

  if (rule === 'owner') {
    return viewerId !== null && access.ownerId === viewerId;
  }

  if (rule === 'controller') {
    return viewerId !== null && access.controllerId === viewerId;
  }

  if (rule === 'owner_or_controller') {
    return (
      viewerId !== null &&
      (access.ownerId === viewerId || access.controllerId === viewerId)
    );
  }

  if (rule === 'hidden') {
    return false;
  }

  if (rule.public) {
    return true;
  }

  if (rule.allowSpectators && viewer.role === ParticipantRole.Spectator) {
    return true;
  }

  if (rule.allowViewer && viewerId !== null) {
    return true;
  }

  if (rule.allowOwner && viewerId !== null && access.ownerId === viewerId) {
    return true;
  }

  if (rule.allowController && viewerId !== null && access.controllerId === viewerId) {
    return true;
  }

  return Boolean(
    viewerId !== null &&
      rule.allowedViewerIds?.some((allowedViewerId) => allowedViewerId === viewerId),
  );
}

function applyFieldVisibilityPolicy(
  value: Record<string, unknown>,
  policy: VisibilityFieldPolicy | undefined,
  viewer: ResolvedViewerContext,
  access: PropertyAccessContext,
  redactions: VisibilityRedaction[],
  pathPrefix: string,
  fallbackVisibility?: FieldVisibilityRule,
): Record<string, unknown> {
  const projected: Record<string, unknown> = {};

  for (const [key, fieldValue] of Object.entries(value)) {
    const rule = policy?.[key] ?? fallbackVisibility;
    if (canViewerAccessField(rule, viewer, access)) {
      projected[key] = fieldValue;
      continue;
    }

    redactions.push({
      path: `${pathPrefix}.${key}`,
      reason: 'field_hidden',
    });
  }

  return projected;
}

function sanitizePayloadValue(
  value: unknown,
  context: ProjectionRuntimeContext,
  path: string,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizePayloadValue(item, context, `${path}[${index}]`),
    );
  }

  if (!isRecord(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, childValue] of Object.entries(value)) {
    const childPath = `${path}.${key}`;

    if (typeof childValue === 'string') {
      if ((key === 'entityId' || key.endsWith('EntityId')) && context.state.entities[childValue]) {
        if (canViewerSeeEntityDetails(context.state, childValue, context.viewer)) {
          sanitized[key] = childValue;
        } else {
          sanitized[key] = HIDDEN_ENTITY_TOKEN;
          context.redactions.push({
            path: childPath,
            reason: 'action_log_hidden',
          });
        }
        continue;
      }

      if ((key === 'zoneId' || key.endsWith('ZoneId')) && context.state.zones[childValue]) {
        if (canViewerSeeZoneContents(context.state, childValue, context.viewer)) {
          sanitized[key] = childValue;
        } else {
          sanitized[key] = HIDDEN_ZONE_TOKEN;
          context.redactions.push({
            path: childPath,
            reason: 'action_log_hidden',
          });
        }
        continue;
      }
    }

    sanitized[key] = sanitizePayloadValue(childValue, context, childPath);
  }

  return sanitized;
}

function projectPendingDecision(
  decision: PendingDecision,
  runtime: ProjectionRuntimeContext,
): VisiblePendingDecision | null {
  if (!isOmniscientViewer(runtime.viewer) && decision.playerId !== runtime.viewer.viewerId) {
    runtime.redactions.push({
      path: `pendingDecisions.${decision.id}`,
      reason: 'pending_decision_hidden',
    });
    return null;
  }

  const metadataPolicy = resolveFieldPolicy(runtime.fieldPolicies?.pendingDecisionMetadata, {
    item: decision,
    state: runtime.state,
    viewer: runtime.viewer,
  });
  const metadata = decision.metadata
    ? applyFieldVisibilityPolicy(
        decision.metadata,
        metadataPolicy,
        runtime.viewer,
        {
          ownerId: decision.playerId,
          controllerId: decision.playerId,
        },
        runtime.redactions,
        `pendingDecisions.${decision.id}.metadata`,
        'owner',
      )
    : undefined;

  return {
    id: decision.id,
    playerId: decision.playerId,
    type: decision.type,
    prompt: decision.prompt,
    options: decision.options.map((option) => ({ ...option })),
    minChoices: decision.minChoices,
    maxChoices: decision.maxChoices,
    timeoutMs: decision.timeoutMs,
    metadata,
  };
}

function projectActionLogEntry(
  entry: ActionLogEntry,
  runtime: ProjectionRuntimeContext,
  pathPrefix: string,
): VisibleActionLogEntry {
  let payload = sanitizePayloadValue(entry.payload, runtime, `${pathPrefix}.payload`);
  const payloadRecord = isRecord(payload) ? payload : {};

  if (
    entry.type === 'PROMPT_PLAYER' &&
    isRecord(payloadRecord.decision) &&
    typeof payloadRecord.decision.playerId === 'string' &&
    !isOmniscientViewer(runtime.viewer) &&
    payloadRecord.decision.playerId !== runtime.viewer.viewerId
  ) {
    payload = {
      ...payloadRecord,
      decision: HIDDEN_DECISION_TOKEN,
    };
    runtime.redactions.push({
      path: `${pathPrefix}.payload.decision`,
      reason: 'action_log_hidden',
    });
  }

  const payloadPolicy = resolveFieldPolicy(runtime.fieldPolicies?.actionLogPayload, {
    item: entry,
    state: runtime.state,
    viewer: runtime.viewer,
  });
  const redactedPayload = applyFieldVisibilityPolicy(
    isRecord(payload) ? payload : {},
    payloadPolicy,
    runtime.viewer,
    {
      ownerId: entry.source.playerId,
      controllerId: entry.source.playerId,
    },
    runtime.redactions,
    `${pathPrefix}.payload`,
  );

  return {
    ...entry,
    payload: redactedPayload,
    redacted: runtime.redactions.some((redaction) => redaction.path.startsWith(pathPrefix)),
  };
}

function projectStackItem(
  stackItem: StackItem,
  runtime: ProjectionRuntimeContext,
  index: number,
): VisibleStackItem {
  const stackEntry = {
    id: stackItem.id as ActionLogEntry['id'],
    type: stackItem.effect.type,
    payload: stackItem.effect.payload,
    source: stackItem.effect.source,
    timestamp: stackItem.effect.timestamp,
  } as ActionLogEntry;
  const effect = projectActionLogEntry(stackEntry, runtime, `stack.${index}.effect`);
  const payloadPolicy = resolveFieldPolicy(runtime.fieldPolicies?.stackEffectPayload, {
    item: stackItem,
    state: runtime.state,
    viewer: runtime.viewer,
  });
  const payload = applyFieldVisibilityPolicy(
    effect.payload,
    payloadPolicy,
    runtime.viewer,
    {
      ownerId: stackItem.controllerId,
      controllerId: stackItem.controllerId,
    },
    runtime.redactions,
    `stack.${index}.effect.payload`,
  );

  return {
    id: stackItem.id,
    source: stackItem.source,
    controllerId: stackItem.controllerId,
    priority: stackItem.priority,
    isResolved: stackItem.isResolved,
    effect: {
      ...effect,
      payload,
      redacted: runtime.redactions.some((redaction) =>
        redaction.path.startsWith(`stack.${index}.effect`),
      ),
    },
  };
}

function projectPlayerState(
  player: PlayerState,
  runtime: ProjectionRuntimeContext,
): PlayerState {
  const playerPolicy = resolveFieldPolicy(runtime.fieldPolicies?.playerProperties, {
    item: player,
    state: runtime.state,
    viewer: runtime.viewer,
  });

  return {
    ...player,
    properties: applyFieldVisibilityPolicy(
      player.properties,
      playerPolicy,
      runtime.viewer,
      {
        ownerId: player.id,
        controllerId: player.id,
      },
      runtime.redactions,
      `players.${player.id}.properties`,
      'owner',
    ),
  };
}

function projectEntity(
  entity: Entity,
  runtime: ProjectionRuntimeContext,
): ProjectedEntityResult | null {
  if (!canViewerSeeEntityPresence(runtime.state, entity.id, runtime.viewer)) {
    runtime.redactions.push({
      path: `entities.${entity.id}`,
      reason: 'entity_hidden',
    });
    return null;
  }

  if (!canViewerSeeEntityDetails(runtime.state, entity.id, runtime.viewer)) {
    runtime.redactions.push({
      path: `entities.${entity.id}`,
      reason: 'entity_details_hidden',
    });
    const projectedId = createPresenceOnlyEntityId(entity);
    return {
      projectedId,
      visibleEntity: {
        id: projectedId,
        zoneId: entity.zoneId,
        position: entity.position,
        type: null,
        componentType: null,
        ownerId: null,
        controllerId: null,
        faceUp: false,
        properties: {},
        tags: [],
        visibility: 'presence_only',
      },
    };
  }

  const entityPolicy = resolveFieldPolicy(runtime.fieldPolicies?.entityProperties, {
    item: entity,
    state: runtime.state,
    viewer: runtime.viewer,
  });

  return {
    projectedId: entity.id,
    visibleEntity: {
      id: entity.id,
      zoneId: entity.zoneId,
      position: entity.position,
      type: entity.type,
      componentType: entity.componentType,
      ownerId: entity.ownerId,
      controllerId: entity.controllerId,
      faceUp: entity.faceUp,
      properties: applyFieldVisibilityPolicy(
        entity.properties,
        entityPolicy,
        runtime.viewer,
        {
          ownerId: entity.ownerId,
          controllerId: entity.controllerId,
        },
        runtime.redactions,
        `entities.${entity.id}.properties`,
      ),
      tags: [...entity.tags],
      visibility: 'full',
    },
  };
}

function projectZone(
  zone: Zone,
  projectedEntityIds: Map<string, string>,
  runtime: ProjectionRuntimeContext,
): VisibleZone {
  const isVisibleToViewer = canViewerSeeZoneContents(runtime.state, zone.id, runtime.viewer);
  const zonePolicy = resolveFieldPolicy(runtime.fieldPolicies?.zoneProperties, {
    item: zone,
    state: runtime.state,
    viewer: runtime.viewer,
  });

  const entityIds: string[] = [];
  let hiddenEntityCount = 0;

  for (const entityId of zone.entityIds) {
    const projectedEntityId = projectedEntityIds.get(entityId);
    if (projectedEntityId) {
      entityIds.push(projectedEntityId);
      continue;
    }

    hiddenEntityCount += 1;
  }

  if (!runtime.options.includeHiddenCounts) {
    hiddenEntityCount = 0;
  }

  const properties = isVisibleToViewer || isOmniscientViewer(runtime.viewer)
    ? applyFieldVisibilityPolicy(
        zone.properties,
        zonePolicy,
        runtime.viewer,
        {
          ownerId: zone.ownerId,
        },
        runtime.redactions,
        `zones.${zone.id}.properties`,
      )
    : {};

  if (!isVisibleToViewer && Object.keys(zone.properties).length > 0) {
    runtime.redactions.push({
      path: `zones.${zone.id}.properties`,
      reason: 'zone_hidden',
    });
  }

  return {
    id: zone.id,
    type: zone.type,
    name: zone.name,
    ownerId: zone.ownerId,
    entityIds,
    hiddenEntityCount,
    maxCapacity: zone.maxCapacity,
    properties,
    isVisibleToViewer,
  };
}

export function projectGameStateForViewer(
  state: GameState,
  viewer: ViewerContext | PlayerId,
  options: VisibilityProjectionOptions = {},
): PlayerVisibleState {
  const resolvedViewer = resolveViewerContext(state, viewer, options);
  const runtime: ProjectionRuntimeContext = {
    state,
    viewer: resolvedViewer,
    options: {
      includeHiddenCounts: options.includeHiddenCounts ?? true,
    },
    fieldPolicies: options.fieldPolicies,
    redactions: [],
  };

  const projectedEntityIds = new Map<string, string>();
  const entities: Record<string, VisibleEntity> = {};

  for (const entity of Object.values(state.entities)) {
    const projectedEntity = projectEntity(entity, runtime);
    if (!projectedEntity) {
      continue;
    }

    projectedEntityIds.set(entity.id, projectedEntity.projectedId);
    entities[projectedEntity.projectedId] = projectedEntity.visibleEntity;
  }

  const zones: Record<string, VisibleZone> = {};
  for (const zone of Object.values(state.zones)) {
    zones[zone.id] = projectZone(zone, projectedEntityIds, runtime);
  }

  const players: Record<string, PlayerState> = {};
  for (const player of Object.values(state.players)) {
    players[player.id] = projectPlayerState(player, runtime);
  }

  return {
    gameId: state.gameId,
    version: state.version,
    status: state.status,
    winner: state.winner,
    playerOrder: [...state.playerOrder],
    players,
    zones,
    entities,
    turnState: structuredClone(state.turnState),
    pendingDecisions: state.pendingDecisions
      .map((decision) => projectPendingDecision(decision, runtime))
      .filter((decision): decision is VisiblePendingDecision => decision !== null),
    stack: state.stack.map((stackItem, index) => projectStackItem(stackItem, runtime, index)),
    priorityWindow: {
      ...state.priorityWindow,
      passedPlayerIds: [...state.priorityWindow.passedPlayerIds],
    },
    actionLog: state.actionLog.map((entry, index) =>
      projectActionLogEntry(entry, runtime, `actionLog.${index}`),
    ),
    randomState: { ...state.randomState },
    viewer: resolvedViewer,
    redactions: runtime.redactions,
  };
}

export function projectGameStateForPlayer(
  state: GameState,
  playerId: PlayerId,
  options: VisibilityProjectionOptions = {},
): PlayerVisibleState {
  return projectGameStateForViewer(
    state,
    {
      viewerId: playerId,
      role: state.players[playerId]?.role ?? ParticipantRole.Player,
    },
    options,
  );
}

export function projectGameStateForAI(
  state: GameState,
  playerId: PlayerId,
  options: VisibilityProjectionOptions = {},
): PlayerVisibleState {
  return projectGameStateForViewer(
    state,
    {
      viewerId: playerId,
      role: ParticipantRole.AI,
    },
    options,
  );
}
