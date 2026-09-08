export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parsePriceMeta(
  value: unknown,
): { inputPerMillionUsd: number; outputPerMillionUsd: number } | null {
  if (!isRecord(value)) return null;
  const inputPerMillionUsd = toFiniteNumber(
    value.input_per_million_usd ??
      value.prompt_per_million_usd ??
      value.inputUsdPerMillion,
  );
  const outputPerMillionUsd = toFiniteNumber(
    value.output_per_million_usd ??
      value.completion_per_million_usd ??
      value.outputUsdPerMillion,
  );
  if (
    inputPerMillionUsd === null || outputPerMillionUsd === null ||
    inputPerMillionUsd < 0 || outputPerMillionUsd < 0
  ) return null;
  return { inputPerMillionUsd, outputPerMillionUsd };
}
