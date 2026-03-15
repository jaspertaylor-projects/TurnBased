import { z } from 'zod';

const selectionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

export const aiOutputParametersSchema = z.object({
  selectedEntityId: z.string().trim().min(1).optional(),
  destinationZoneId: z.string().trim().min(1).optional(),
  targetEntityId: z.string().trim().min(1).optional(),
  subChoiceSelections: z.record(selectionValueSchema).optional(),
});

export const aiTokenUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative().optional(),
  model: z.string().trim().min(1).optional(),
});

export const aiOutputEnvelopeSchema = z.object({
  chosenActionId: z.string().trim().min(1),
  parameters: aiOutputParametersSchema.optional(),
  rationale: z.string().trim().min(1).optional(),
  confidence: z.number().min(0).max(1),
  thinkingTimeMs: z.number().nonnegative(),
  usage: aiTokenUsageSchema.partial().optional(),
  model: z.string().trim().min(1).optional(),
});

export const aiRulesDocumentSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  priority: z.number().int().optional(),
});

export const aiRulesComponentManifestSummarySchema = z.object({
  type: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
});

export const aiSeatBudgetConfigSchema = z.object({
  maxPromptTokens: z.number().int().nonnegative(),
  maxCompletionTokens: z.number().int().nonnegative(),
  maxTotalTokens: z.number().int().nonnegative(),
  maxCalls: z.number().int().nonnegative(),
  maxCostUsd: z.number().nonnegative().optional(),
  allowedModels: z.array(z.string().trim().min(1)).optional(),
});
