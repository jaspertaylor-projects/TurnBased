import {
  isRecord,
  parsePriceMeta,
  toFiniteNumber,
} from "../ai-rules-writer/protocol.ts";

export function cardTableUsage(response: unknown, priceMeta: unknown) {
  const usage = isRecord(response) && isRecord(response.usage)
    ? response.usage
    : {};
  const tokens = (value: unknown) =>
    Math.max(0, Math.floor(toFiniteNumber(value) ?? 0));
  const promptTokens = tokens(usage.prompt_tokens);
  const completionTokens = tokens(usage.completion_tokens);
  const totalTokens = tokens(usage.total_tokens) ||
    promptTokens + completionTokens;
  const reported = toFiniteNumber(usage.cost);
  const actualCostKnown = reported !== null && reported >= 0;
  const pricing = parsePriceMeta(priceMeta);
  // OpenRouter returns its actual charge in usage.cost, including caching effects.
  // https://openrouter.ai/docs/cookbook/administration/usage-accounting
  const providerCostUsd = actualCostKnown
    ? reported
    : pricing
    ? (promptTokens * pricing.inputPerMillionUsd +
      completionTokens * pricing.outputPerMillionUsd) / 1_000_000
    : null;
  const providerCostCents = providerCostUsd === null
    ? 0
    : Math.ceil(providerCostUsd * 100);
  if (
    !Number.isSafeInteger(providerCostCents) || providerCostCents < 0 ||
    providerCostCents > 1_000_000
  ) {
    throw new Error("The model returned invalid billing data.");
  }
  return {
    usage: { promptTokens, completionTokens, totalTokens },
    cost: {
      providerCostUsd,
      estimatedCostUsd: actualCostKnown ? null : providerCostUsd,
      providerCostCents,
      platformFeeCents: providerCostCents,
      totalChargedCents: providerCostCents * 2,
      pricingKnown: providerCostUsd !== null,
      actualCostKnown,
      source: actualCostKnown
        ? "provider"
        : pricing
        ? "catalog_estimate"
        : "unknown",
      currency: "USD",
    },
  };
}
