// ─── Zod Validation Schemas ─────────────────────────────────────────
// Runtime validation for all core state objects.

import { z } from 'zod';
import { canonicalActionSchema } from '../actions';

// ─── ID Schemas ─────────────────────────────────────────────────────

export const entityIdSchema = z.string().min(1);
export const zoneIdSchema = z.string().min(1);
export const playerIdSchema = z.string().min(1);
export const gameIdSchema = z.string().min(1);
export const actionIdSchema = z.string().min(1);
export const triggerIdSchema = z.string().min(1);
export const componentInstanceIdSchema = z.string().min(1);

// ─── Enums ──────────────────────────────────────────────────────────

export const visibilitySchema = z.enum(['public', 'private', 'hidden', 'restricted']);
export const participantRoleSchema = z.enum(['player', 'spectator', 'ai', 'host']);
export const gameStatusSchema = z.enum(['setup', 'playing', 'paused', 'finished']);
export const turnDirectionSchema = z.enum(['forward', 'reverse']);
export const turnKindSchema = z.enum(['normal', 'extra']);
export const decisionTypeSchema = z.enum(['choose_option', 'choose_target', 'choose_entity', 'confirm']);
export const actionSourceTypeSchema = z.enum(['player', 'trigger', 'system', 'ai']);
export const triggerTypeSchema = z.enum(['automatic', 'optional', 'replacement', 'prevention']);
export const triggerResolutionSchema = z.enum(['immediate', 'stack']);
export const priorityModeSchema = z.enum(['none', 'limited', 'full']);
export const priorityWindowSourceSchema = z.enum(['action', 'stack']);

// ─── Zone Visibility ────────────────────────────────────────────────

export const zoneVisibilitySchema = z.object({
  defaultVisibility: visibilitySchema,
  overrides: z.record(z.string(), visibilitySchema),
});

// ─── Entity ─────────────────────────────────────────────────────────

export const entitySchema = z.object({
  id: entityIdSchema,
  type: z.string().min(1),
  componentType: z.string().min(1),
  zoneId: zoneIdSchema,
  ownerId: playerIdSchema.nullable(),
  controllerId: playerIdSchema.nullable(),
  position: z.number().int().nonnegative(),
  faceUp: z.boolean(),
  properties: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()),
});

// ─── Zone ───────────────────────────────────────────────────────────

export const zoneSchema = z.object({
  id: zoneIdSchema,
  type: z.string().min(1),
  name: z.string().min(1),
  ownerId: playerIdSchema.nullable(),
  entityIds: z.array(entityIdSchema),
  maxCapacity: z.number().int().positive().nullable(),
  visibility: zoneVisibilitySchema,
  properties: z.record(z.string(), z.unknown()),
});

// ─── Player State ───────────────────────────────────────────────────

export const playerStateSchema = z.object({
  id: playerIdSchema,
  displayName: z.string().min(1),
  role: participantRoleSchema,
  isActive: z.boolean(),
  isEliminated: z.boolean(),
  score: z.number(),
  resources: z.record(z.string(), z.number()),
  properties: z.record(z.string(), z.unknown()),
});

// ─── Step / Phase Definitions ───────────────────────────────────────

export const actionSourceSchema = z.object({
  type: actionSourceTypeSchema,
  playerId: playerIdSchema.optional(),
  triggerId: triggerIdSchema.optional(),
});

export const actionLogEntrySchema = z.object({
  id: actionIdSchema,
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  source: actionSourceSchema,
  timestamp: z.number().int().nonnegative(),
});

export const stepDefinitionSchema = z.object({
  name: z.string().min(1),
  autoAdvance: z.boolean(),
  requiresPlayerAction: z.boolean(),
  onEnter: z.array(actionLogEntrySchema).optional(),
  onExit: z.array(actionLogEntrySchema).optional(),
});

export const phaseDefinitionSchema = z.object({
  name: z.string().min(1),
  steps: z.array(stepDefinitionSchema),
  onEnter: z.array(actionLogEntrySchema).optional(),
  onExit: z.array(actionLogEntrySchema).optional(),
});

// ─── Turn State ─────────────────────────────────────────────────────

export const turnStateSchema = z.object({
  roundNumber: z.number().int().nonnegative(),
  turnNumber: z.number().int().nonnegative(),
  activePlayerId: playerIdSchema,
  currentPhase: z.string(),
  currentStep: z.string(),
  phaseIndex: z.number().int().nonnegative(),
  stepIndex: z.number().int().nonnegative(),
  basePhases: z.array(phaseDefinitionSchema),
  phases: z.array(phaseDefinitionSchema),
  turnDirection: turnDirectionSchema,
  currentTurnKind: turnKindSchema,
  extraTurns: z.array(playerIdSchema),
  skippedPlayers: z.array(playerIdSchema),
  completedPlayerIdsThisRound: z.array(playerIdSchema),
});

// ─── Decision / Stack ───────────────────────────────────────────────

export const decisionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  description: z.string().optional(),
  entityId: entityIdSchema.optional(),
  zoneId: zoneIdSchema.optional(),
  disabled: z.boolean().optional(),
  disabledReason: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const pendingDecisionSchema = z.object({
  id: z.string().min(1),
  playerId: playerIdSchema,
  type: decisionTypeSchema,
  prompt: z.string(),
  options: z.array(decisionOptionSchema),
  minChoices: z.number().int().nonnegative(),
  maxChoices: z.number().int().positive(),
  timeoutMs: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const stackItemSchema = z.object({
  id: z.string().min(1),
  source: z.string(),
  effect: actionLogEntrySchema,
  controllerId: playerIdSchema,
  priority: z.number(),
  isResolved: z.boolean(),
});

export const priorityWindowStateSchema = z.object({
  isOpen: z.boolean(),
  currentPlayerId: playerIdSchema.nullable(),
  passedPlayerIds: z.array(playerIdSchema),
  openedBy: priorityWindowSourceSchema.nullable(),
});

// ─── Visibility Map ─────────────────────────────────────────────────

export const visibilityMapSchema = z.object({
  entityVisibility: z.record(z.string(), z.record(z.string(), z.boolean())),
  zoneVisibility: z.record(z.string(), z.record(z.string(), z.boolean())),
});

// ─── Random State ───────────────────────────────────────────────────

export const randomStateSchema = z.object({
  seed: z.number(),
  callCount: z.number().int().nonnegative(),
});

// ─── Component Instance ─────────────────────────────────────────────

export const componentInstanceSchema = z.object({
  instanceId: componentInstanceIdSchema,
  componentType: z.string().min(1),
  properties: z.record(z.string(), z.unknown()),
  children: z.array(componentInstanceIdSchema),
  parentId: componentInstanceIdSchema.nullable(),
});

// ─── Game State ─────────────────────────────────────────────────────

export const gameStateSchema = z.object({
  gameId: gameIdSchema,
  version: z.number().int().nonnegative(),
  entities: z.record(z.string(), entitySchema),
  zones: z.record(z.string(), zoneSchema),
  players: z.record(z.string(), playerStateSchema),
  playerOrder: z.array(playerIdSchema),
  turnState: turnStateSchema,
  pendingDecisions: z.array(pendingDecisionSchema),
  stack: z.array(stackItemSchema),
  priorityWindow: priorityWindowStateSchema,
  visibilityMap: visibilityMapSchema,
  randomState: randomStateSchema,
  status: gameStatusSchema,
  winner: z.union([playerIdSchema, z.array(playerIdSchema), z.null()]),
  actionLog: z.array(actionLogEntrySchema),
  componentInstances: z.record(z.string(), componentInstanceSchema),
});

// ─── Priority Policy ────────────────────────────────────────────────

export const priorityPolicySchema = z.object({
  mode: priorityModeSchema,
  responseEvents: z.array(z.string()).optional(),
  autoPassEnabled: z.boolean(),
  timeoutMs: z.number().int().positive().optional(),
});

// ─── Trigger Subscription ───────────────────────────────────────────

export const triggerSubscriptionSchema = z.object({
  id: triggerIdSchema,
  type: triggerTypeSchema,
  event: z.string().min(1),
  condition: z.string().optional(),
  effect: z.union([canonicalActionSchema, z.array(canonicalActionSchema)]),
  controllerId: playerIdSchema,
  sourceEntityId: entityIdSchema.optional(),
  priority: z.number(),
  resolution: triggerResolutionSchema,
  once: z.boolean(),
  phase: z.string().optional(),
  prompt: z.string().optional(),
});

// ─── Derived Views ──────────────────────────────────────────────────

export const derivedViewSnapshotSchema = z.object({
  name: z.string().min(1),
  viewerId: playerIdSchema,
  data: z.record(z.string(), z.unknown()),
});

// ─── Game Definition ────────────────────────────────────────────────

export const gameDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  minPlayers: z.number().int().positive(),
  maxPlayers: z.number().int().positive(),
  phases: z.array(phaseDefinitionSchema),
  priorityPolicy: priorityPolicySchema,
  initialZones: z.array(zoneSchema.omit({ entityIds: true })),
  initialEntities: z.array(entitySchema.omit({ id: true })),
  triggers: z.array(triggerSubscriptionSchema.omit({ id: true })),
  winCondition: z.string().optional(),
  rulesText: z.string().optional(),
  defaultSeed: z.number().optional(),
});
