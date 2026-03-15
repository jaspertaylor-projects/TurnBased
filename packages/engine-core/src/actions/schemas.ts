// ─── Zod Validation Schemas For Intent And Canonical Actions ───────

import { z } from 'zod';

const entityIdSchema = z.string().regex(/^ent_[A-Za-z0-9_-]+$/, 'Expected an entity id');
const zoneIdSchema = z.string().regex(/^zone_[A-Za-z0-9_-]+$/, 'Expected a zone id');
const playerIdSchema = z.string().regex(/^player_[A-Za-z0-9_-]+$/, 'Expected a player id');
const actionIdSchema = z.string().regex(/^act_[A-Za-z0-9_-]+$/, 'Expected an action id');
const triggerIdSchema = z.string().regex(/^trigger_[A-Za-z0-9_-]+$/, 'Expected a trigger id');

const recordSchema = z.record(z.string(), z.unknown());
const emptyPayloadSchema = z.object({}).strict();

export const actionSourceTypeSchema = z.enum(['player', 'trigger', 'system', 'ai']);

export const actionSourceSchema = z.object({
  type: actionSourceTypeSchema,
  playerId: playerIdSchema.optional(),
  triggerId: triggerIdSchema.optional(),
});

const nestedCanonicalActionSchema = z.object({
  type: z.string().trim().min(1),
  payload: recordSchema,
  source: actionSourceSchema,
  timestamp: z.number().int().nonnegative(),
});

export const intentActionSchema = z.object({
  type: z.string().trim().min(1),
  payload: recordSchema,
  source: actionSourceSchema,
  timestamp: z.number().int().nonnegative(),
});

export const decisionOptionPayloadSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  entityId: entityIdSchema.optional(),
  zoneId: zoneIdSchema.optional(),
  disabled: z.boolean().optional(),
  disabledReason: z.string().trim().min(1).optional(),
  metadata: recordSchema.optional(),
});

export const pendingDecisionPayloadSchema = z.object({
  id: z.string().trim().min(1),
  playerId: playerIdSchema,
  type: z.enum(['choose_option', 'choose_target', 'choose_entity', 'confirm']),
  prompt: z.string(),
  options: z.array(decisionOptionPayloadSchema),
  minChoices: z.number().int().nonnegative(),
  maxChoices: z.number().int().positive(),
  timeoutMs: z.number().int().positive().optional(),
  metadata: recordSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.maxChoices < value.minChoices) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'maxChoices must be greater than or equal to minChoices',
      path: ['maxChoices'],
    });
  }
});

export const stepDefinitionPayloadSchema = z.object({
  name: z.string().trim().min(1),
  autoAdvance: z.boolean(),
  requiresPlayerAction: z.boolean(),
});

export const phaseDefinitionPayloadSchema = z.object({
  name: z.string().trim().min(1),
  steps: z.array(stepDefinitionPayloadSchema).min(1),
});

const createEntityPayloadSchema = z.object({
  entity: z.object({
    id: entityIdSchema,
    type: z.string().trim().min(1),
    componentType: z.string().trim().min(1),
    zoneId: zoneIdSchema,
    ownerId: playerIdSchema.nullable(),
    controllerId: playerIdSchema.nullable(),
    position: z.number().int().nonnegative(),
    faceUp: z.boolean(),
    properties: recordSchema,
    tags: z.array(z.string()),
  }),
  zoneId: zoneIdSchema,
});

export const canonicalActionSchema = z.union([
  z.object({
    type: z.literal('MOVE_ENTITY'),
    payload: z.object({
      entityId: entityIdSchema,
      fromZoneId: zoneIdSchema,
      toZoneId: zoneIdSchema,
      position: z.number().int().nonnegative().optional(),
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('CREATE_ENTITY'),
    payload: createEntityPayloadSchema,
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('DESTROY_ENTITY'),
    payload: z.object({
      entityId: entityIdSchema,
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('SET_PROPERTY'),
    payload: z.object({
      targetType: z.enum(['entity', 'zone', 'player', 'game']),
      targetId: z.union([entityIdSchema, zoneIdSchema, playerIdSchema]).optional(),
      key: z.string().trim().min(1),
      value: z.unknown(),
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }).superRefine((value, ctx) => {
    if (value.payload.targetType !== 'game' && !value.payload.targetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'targetId is required unless targetType is game',
        path: ['payload', 'targetId'],
      });
    }
  }),
  z.object({
    type: z.literal('TRANSFER_CONTROL'),
    payload: z.object({
      entityId: entityIdSchema,
      newControllerId: playerIdSchema.nullable(),
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('DRAW_FROM_ZONE'),
    payload: z.object({
      sourceZoneId: zoneIdSchema,
      targetZoneId: zoneIdSchema,
      count: z.number().int().positive(),
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('SHUFFLE_ZONE'),
    payload: z.object({
      zoneId: zoneIdSchema,
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('REVEAL_ENTITY'),
    payload: z.object({
      entityId: entityIdSchema,
      toPlayers: z.array(playerIdSchema).optional(),
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('HIDE_ENTITY'),
    payload: z.object({
      entityId: entityIdSchema,
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('PROMPT_PLAYER'),
    payload: z.object({
      decision: pendingDecisionPayloadSchema,
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('CHOOSE_OPTION'),
    payload: z.object({
      decisionId: z.string().trim().min(1),
      chosenOptionIds: z.array(z.string().trim().min(1)).min(1),
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('PASS_PRIORITY'),
    payload: z.object({
      playerId: playerIdSchema,
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('ADVANCE_STEP'),
    payload: emptyPayloadSchema,
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('ADVANCE_PHASE'),
    payload: emptyPayloadSchema,
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('END_TURN'),
    payload: emptyPayloadSchema,
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('QUEUE_STACK_ITEM'),
    payload: z.object({
      stackItem: z.object({
        id: z.string().trim().min(1),
        source: z.string().trim().min(1),
        effect: nestedCanonicalActionSchema,
        controllerId: playerIdSchema,
        priority: z.number(),
        isResolved: z.boolean().optional(),
      }),
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('RESOLVE_STACK_ITEM'),
    payload: z.object({
      stackItemId: z.string().trim().min(1),
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('ADD_RESOURCE'),
    payload: z.object({
      playerId: playerIdSchema,
      resource: z.string().trim().min(1),
      amount: z.number().positive(),
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('REMOVE_RESOURCE'),
    payload: z.object({
      playerId: playerIdSchema,
      resource: z.string().trim().min(1),
      amount: z.number().positive(),
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('SET_SCORE'),
    payload: z.object({
      playerId: playerIdSchema,
      score: z.number(),
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('ELIMINATE_PLAYER'),
    payload: z.object({
      playerId: playerIdSchema,
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('END_GAME'),
    payload: z.object({
      winnerId: z.union([playerIdSchema, z.array(playerIdSchema), z.null()]).optional(),
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('ADD_EXTRA_TURN'),
    payload: z.object({
      playerId: playerIdSchema,
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('SKIP_TURN'),
    payload: z.object({
      playerId: playerIdSchema,
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('REVERSE_TURN_ORDER'),
    payload: emptyPayloadSchema,
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('INSERT_PHASE'),
    payload: z.object({
      phase: phaseDefinitionPayloadSchema,
      afterPhase: z.string().trim().min(1).optional(),
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('INSERT_STEP'),
    payload: z.object({
      step: stepDefinitionPayloadSchema,
      phaseName: z.string().trim().min(1).optional(),
      afterStep: z.string().trim().min(1).optional(),
    }),
    source: actionSourceSchema,
    timestamp: z.number().int().nonnegative(),
  }),
]);

export const actionLogEntrySchema = canonicalActionSchema.and(
  z.object({
    id: actionIdSchema,
  }),
);

export function validateIntentAction(value: unknown) {
  return intentActionSchema.parse(value);
}

export function validateCanonicalAction(value: unknown) {
  return canonicalActionSchema.parse(value);
}
