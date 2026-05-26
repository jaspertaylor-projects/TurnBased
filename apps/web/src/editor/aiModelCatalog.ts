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

export const RULES_WRITER_MODEL_OPTIONS: AIModelOption[] = [
  {
    id: 'moonshotai/kimi-k2-0905',
    label: 'Kimi K2',
    provider: 'openrouter',
    task: 'rulesWriter',
    description: 'Default long-context rules writing model.',
    priceMeta: { inputPerMillionUsd: 0.4, outputPerMillionUsd: 2 },
  },
  {
    id: 'deepseek/deepseek-chat-v3-0324',
    label: 'DeepSeek Chat V3',
    provider: 'openrouter',
    task: 'rulesWriter',
    description: 'Fallback general rules and prose model.',
  },
  {
    id: 'anthropic/claude-3-haiku',
    label: 'Claude 3 Haiku',
    provider: 'openrouter',
    task: 'rulesWriter',
    description: 'Fast, lower-cost drafting option.',
  },
];

export const IMAGE_GENERATION_MODEL_OPTIONS: AIModelOption[] = [
  {
    id: 'fal-diffusion-mock',
    label: 'Fal Diffusion Mock',
    provider: 'fal',
    task: 'imageGeneration',
    description: 'Local mock image route for development.',
    priceMeta: { flatCostCents: 3 },
  },
  {
    id: 'fal-flux-schnell-mock',
    label: 'Fal Flux Schnell Mock',
    provider: 'fal',
    task: 'imageGeneration',
    description: 'Fast image-generation placeholder route.',
    priceMeta: { flatCostCents: 3 },
  },
  {
    id: 'recraft-image-mock',
    label: 'Recraft Image Mock',
    provider: 'fal',
    task: 'imageGeneration',
    description: 'Illustration-oriented placeholder route.',
    priceMeta: { flatCostCents: 4 },
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
    rulesWriter: value?.rulesWriter && rulesIds.has(value.rulesWriter)
      ? value.rulesWriter
      : DEFAULT_PROJECT_AI_MODELS.rulesWriter,
    imageGeneration: value?.imageGeneration && imageIds.has(value.imageGeneration)
      ? value.imageGeneration
      : DEFAULT_PROJECT_AI_MODELS.imageGeneration,
  };
}

export function getModelLabel(modelId: string): string {
  const all = [...RULES_WRITER_MODEL_OPTIONS, ...IMAGE_GENERATION_MODEL_OPTIONS];
  return all.find((option) => option.id === modelId)?.label ?? modelId;
}

export function getModelOption(modelId: string): AIModelOption | null {
  const all = [...RULES_WRITER_MODEL_OPTIONS, ...IMAGE_GENERATION_MODEL_OPTIONS];
  return all.find((option) => option.id === modelId) ?? null;
}
