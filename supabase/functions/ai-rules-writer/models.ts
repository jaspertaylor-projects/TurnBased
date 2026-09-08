export const DEFAULT_RULES_MODEL = "moonshotai/kimi-k2.6";
// Keep aligned with the browser catalog; verified with OpenRouter's public models API, 2026-09-08.
export const RULES_MODELS = [
  DEFAULT_RULES_MODEL,
  "anthropic/claude-sonnet-4.6",
  "openai/gpt-5.1",
  "google/gemini-3.1-pro-preview",
  "deepseek/deepseek-chat-v3-0324",
];

export function resolveRulesModel(
  requested: unknown,
  configuredRules?: string,
  configuredDefault?: string,
): string {
  const configured = [configuredRules?.trim(), configuredDefault?.trim()]
    .filter((value): value is string => Boolean(value));
  let model = typeof requested === "string" && requested.trim()
    ? requested.trim()
    : configured[0] || DEFAULT_RULES_MODEL;
  if (model === "google/gemini-3-pro-preview") {
    model = "google/gemini-3.1-pro-preview";
  }
  if (!RULES_MODELS.includes(model) && !configured.includes(model)) {
    throw new Error("Choose an available rules-writing model.");
  }
  return model;
}

export function rulesProviderBody(
  model: string,
  prompt: { systemPrompt: string; userMessage: string; temperature: number },
) {
  return {
    model,
    // GPT-5.1 does not advertise temperature in its OpenRouter parameters.
    ...(model === "openai/gpt-5.1" ? {} : { temperature: prompt.temperature }),
    max_tokens: 8192,
    messages: [{ role: "system", content: prompt.systemPrompt }, {
      role: "user",
      content: prompt.userMessage,
    }],
  };
}
