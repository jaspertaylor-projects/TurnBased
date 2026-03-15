import { z } from 'zod';
import { Visibility } from '@turnbased/shared-types';
import {
  actionSourceSchema,
  playerIdSchema,
  priorityPolicySchema,
  triggerResolutionSchema,
  triggerTypeSchema,
} from '@turnbased/engine-core/src/state/schemas';
import type { RuleValueTemplate } from './types';

const canonicalActionTypeSchema = z.enum([
  'MOVE_ENTITY',
  'CREATE_ENTITY',
  'DESTROY_ENTITY',
  'SET_PROPERTY',
  'TRANSFER_CONTROL',
  'DRAW_FROM_ZONE',
  'SHUFFLE_ZONE',
  'REVEAL_ENTITY',
  'HIDE_ENTITY',
  'PROMPT_PLAYER',
  'CHOOSE_OPTION',
  'PASS_PRIORITY',
  'ADVANCE_STEP',
  'ADVANCE_PHASE',
  'END_TURN',
  'QUEUE_STACK_ITEM',
  'RESOLVE_STACK_ITEM',
  'ADD_RESOURCE',
  'REMOVE_RESOURCE',
  'SET_SCORE',
  'ELIMINATE_PLAYER',
  'END_GAME',
  'ADD_EXTRA_TURN',
  'SKIP_TURN',
  'REVERSE_TURN_ORDER',
  'INSERT_PHASE',
  'INSERT_STEP',
]);

export const ruleExpressionReferenceSchema = z.object({
  kind: z.literal('expression'),
  expression: z.string().trim().min(1),
});

export const ruleValueTemplateSchema: z.ZodType<RuleValueTemplate> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    ruleExpressionReferenceSchema,
    z.array(ruleValueTemplateSchema),
    z.record(z.string(), ruleValueTemplateSchema),
  ]),
);

export const ruleValueMapSchema = z.record(z.string(), ruleValueTemplateSchema);

export const ruleHookReferenceSchema = z.object({
  name: z.string().trim().min(1),
  args: ruleValueMapSchema.optional(),
});

export const declarativeActionTemplateSchema = z.object({
  type: canonicalActionTypeSchema,
  payload: ruleValueMapSchema,
  source: actionSourceSchema.optional(),
  timestamp: z.number().int().nonnegative().optional(),
});

export const rulePlayerSelectorSchema = z
  .object({
    scope: z.enum(['all', 'active', 'specific']),
    playerIds: z.array(playerIdSchema).optional(),
    includeEliminated: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scope === 'specific' && (!value.playerIds || value.playerIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['playerIds'],
        message: 'specific player selectors require at least one playerId',
      });
    }
  });

export const setupRuleSchema = z
  .object({
    id: z.string().trim().min(1),
    description: z.string().optional(),
    order: z.number().int().optional(),
    players: rulePlayerSelectorSchema.optional(),
    when: z.string().trim().min(1).optional(),
    predicateHook: ruleHookReferenceSchema.optional(),
    actions: z.array(declarativeActionTemplateSchema).optional(),
    actionHook: ruleHookReferenceSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.actions && !value.actionHook) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actions'],
        message: 'setup rules require actions or an actionHook',
      });
    }
  });

export const declarativeStepRuleSchema = z.object({
  name: z.string().trim().min(1),
  autoAdvance: z.boolean(),
  requiresPlayerAction: z.boolean(),
  onEnter: z.array(declarativeActionTemplateSchema).optional(),
  onExit: z.array(declarativeActionTemplateSchema).optional(),
});

export const declarativePhaseRuleSchema = z.object({
  name: z.string().trim().min(1),
  steps: z.array(declarativeStepRuleSchema).min(1),
  onEnter: z.array(declarativeActionTemplateSchema).optional(),
  onExit: z.array(declarativeActionTemplateSchema).optional(),
});

export const turnStructureRuleSchema = z.object({
  phases: z.array(declarativePhaseRuleSchema).min(1),
  priorityPolicy: priorityPolicySchema.optional(),
});

export const triggerControllerSelectorSchema = z
  .object({
    scope: z.enum(['all', 'specific']),
    playerIds: z.array(playerIdSchema).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scope === 'specific' && (!value.playerIds || value.playerIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['playerIds'],
        message: 'specific trigger controllers require at least one playerId',
      });
    }
  });

export const declarativeTriggerRuleSchema = z
  .object({
    id: z.string().trim().min(1),
    description: z.string().optional(),
    type: triggerTypeSchema,
    event: z.string().trim().min(1),
    controller: triggerControllerSelectorSchema,
    when: z.string().trim().min(1).optional(),
    predicateHook: ruleHookReferenceSchema.optional(),
    actions: z.array(declarativeActionTemplateSchema).optional(),
    actionHook: ruleHookReferenceSchema.optional(),
    priority: z.number().optional(),
    resolution: triggerResolutionSchema.optional(),
    once: z.boolean().optional(),
    phase: z.string().trim().min(1).optional(),
    prompt: z.string().trim().min(1).optional(),
    sourceEntityId: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type !== 'prevention' && !value.actions && !value.actionHook) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actions'],
        message: 'non-prevention triggers require actions or an actionHook',
      });
    }
  });

export const scoringRuleSchema = z
  .object({
    id: z.string().trim().min(1),
    description: z.string().optional(),
    players: rulePlayerSelectorSchema.optional(),
    when: z.string().trim().min(1).optional(),
    predicateHook: ruleHookReferenceSchema.optional(),
    mode: z.enum(['add', 'set']).optional(),
    value: z.string().trim().min(1).optional(),
    scoringHook: ruleHookReferenceSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.value && !value.scoringHook) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'scoring rules require a value expression or scoringHook',
      });
    }
  });

export const winConditionRuleSchema = z
  .object({
    id: z.string().trim().min(1),
    description: z.string().optional(),
    priority: z.number().optional(),
    when: z.string().trim().min(1).optional(),
    predicateHook: ruleHookReferenceSchema.optional(),
    winnerExpression: z.string().trim().min(1).optional(),
    outcome: z.enum(['win', 'draw']).optional(),
    winConditionHook: ruleHookReferenceSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.when && !value.predicateHook && !value.winConditionHook) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['when'],
        message: 'win conditions require a when expression, predicateHook, or winConditionHook',
      });
    }
  });

export const visibilityRuleMatchSchema = z.object({
  ids: z.array(z.string().trim().min(1)).optional(),
  types: z.array(z.string().trim().min(1)).optional(),
  componentTypes: z.array(z.string().trim().min(1)).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  ownerScope: z.enum(['any', 'viewer', 'active_player']).optional(),
});

export const visibilityDefaultRuleSchema = z.object({
  id: z.string().trim().min(1),
  description: z.string().optional(),
  target: z.enum(['entity', 'zone']),
  visibility: z.nativeEnum(Visibility),
  viewers: z.enum(['all', 'none', 'owner', 'controller', 'specific']).optional(),
  playerIds: z.array(playerIdSchema).optional(),
  match: visibilityRuleMatchSchema.optional(),
  when: z.string().trim().min(1).optional(),
  predicateHook: ruleHookReferenceSchema.optional(),
  visibilityHook: ruleHookReferenceSchema.optional(),
});

export const rulebookSchema = z.object({
  rulesText: z.string().optional(),
  setup: z.array(setupRuleSchema).optional(),
  turnStructure: turnStructureRuleSchema.optional(),
  scoring: z.array(scoringRuleSchema).optional(),
  winConditions: z.array(winConditionRuleSchema).optional(),
  triggers: z.array(declarativeTriggerRuleSchema).optional(),
  visibilityDefaults: z.array(visibilityDefaultRuleSchema).optional(),
});
