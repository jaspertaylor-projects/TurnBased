export type AIModelTask = 'rulesWriter' | 'imageGeneration';

export interface AIModelOption {
  id: string;
  label: string;
  provider: 'openrouter' | 'fal';
  task: AIModelTask;
  description: string;
  priceMeta?: {
    inputPerMillionUsd?: number;
    outputPerMillionUsd?: number;
    flatCostCents?: number;
  };
}

export interface ProjectAIModelSettings {
  rulesWriter: string;
  imageGeneration: string;
}

// Model IDs and output modalities checked against https://openrouter.ai/api/v1/models
// on 2026-09-08. Prices belong to each recorded request, not this preference list.
export const RULES_WRITER_MODEL_OPTIONS: AIModelOption[] = [
  {
    id: 'moonshotai/kimi-k2.6',
    label: 'Kimi K2.6',
    provider: 'openrouter',
    task: 'rulesWriter',
    description: 'Default model for drafting rules and brainstorming game ideas.',
  },
  {
    id: 'anthropic/claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    provider: 'openrouter',
    task: 'rulesWriter',
    description: 'Anthropic model for rules, rewriting, and brainstorming.',
  },
  {
    id: 'openai/gpt-5.1',
    label: 'GPT-5.1',
    provider: 'openrouter',
    task: 'rulesWriter',
    description: 'OpenAI model for rules, rewriting, and brainstorming.',
  },
  {
    id: 'google/gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    provider: 'openrouter',
    task: 'rulesWriter',
    description: 'Google model for rules, rewriting, and brainstorming.',
  },
  {
    id: 'deepseek/deepseek-chat-v3-0324',
    label: 'DeepSeek V3',
    provider: 'openrouter',
    task: 'rulesWriter',
    description: 'DeepSeek model for rules, rewriting, and brainstorming.',
  },
];

export const IMAGE_GENERATION_MODEL_OPTIONS: AIModelOption[] = [
  {
    id: 'google/gemini-2.5-flash-image',
    label: 'Gemini 2.5 Flash Image',
    provider: 'openrouter',
    task: 'imageGeneration',
    description: 'Generate game artwork from text prompts.',
  },
];

export const DEFAULT_PROJECT_AI_MODELS: ProjectAIModelSettings = {
  rulesWriter: RULES_WRITER_MODEL_OPTIONS[0].id,
  imageGeneration: IMAGE_GENERATION_MODEL_OPTIONS[0].id,
};

export function normalizeProjectAIModels(value: Partial<ProjectAIModelSettings> | undefined): ProjectAIModelSettings {
  const rulesIds = new Set(RULES_WRITER_MODEL_OPTIONS.map((option) => option.id));
  const imageIds = new Set(IMAGE_GENERATION_MODEL_OPTIONS.map((option) => option.id));
  return {
    rulesWriter: value?.rulesWriter === 'google/gemini-3-pro-preview'
      ? 'google/gemini-3.1-pro-preview'
      : value?.rulesWriter && rulesIds.has(value.rulesWriter)
      ? value.rulesWriter
      : DEFAULT_PROJECT_AI_MODELS.rulesWriter,
    imageGeneration: value?.imageGeneration && imageIds.has(value.imageGeneration)
      ? value.imageGeneration
      : DEFAULT_PROJECT_AI_MODELS.imageGeneration,
  };
}

/** Coerce an arbitrary model id to a valid rules-writer option, falling back
 *  to the default when the id isn't one of the curated choices (e.g. a
 *  project still pointing at a since-removed slug). */
export function resolveRulesWriterModel(modelId: string | undefined): string {
  const ids = new Set(RULES_WRITER_MODEL_OPTIONS.map((option) => option.id));
  if (modelId === 'google/gemini-3-pro-preview') return 'google/gemini-3.1-pro-preview';
  return modelId && ids.has(modelId) ? modelId : RULES_WRITER_MODEL_OPTIONS[0].id;
}

export function getModelLabel(modelId: string): string {
  const all = [...RULES_WRITER_MODEL_OPTIONS, ...IMAGE_GENERATION_MODEL_OPTIONS];
  return all.find((option) => option.id === modelId)?.label ?? modelId;
}

export function getModelOption(modelId: string): AIModelOption | null {
  const all = [...RULES_WRITER_MODEL_OPTIONS, ...IMAGE_GENERATION_MODEL_OPTIONS];
  return all.find((option) => option.id === modelId) ?? null;
}

export function rulesWriterSupportsTemperature(modelId: string): boolean {
  return resolveRulesWriterModel(modelId) !== 'openai/gpt-5.1';
}
