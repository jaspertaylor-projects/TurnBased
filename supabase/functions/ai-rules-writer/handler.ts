import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { buildRulesPrompt } from "./prompt.ts";
import { resolveRulesModel, rulesProviderBody } from "./models.ts";
import { isRecord, parsePriceMeta, toFiniteNumber } from "./protocol.ts";

export interface RulesWriterDependencies {
  env: (name: string) => string | undefined;
  createClient: (
    url: string,
    key: string,
    options?: { global: { headers: Record<string, string> } },
  ) => SupabaseClient;
  fetch: typeof fetch;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class RequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function readProviderText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.choices)) return "";
  const choice = value.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) return "";
  const content = choice.message.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content.filter(isRecord).filter((item) =>
    item.type === "text" && typeof item.text === "string"
  ).map((item) => item.text).join("\n").trim();
}

export function createRulesWriterHandler(deps: RulesWriterDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return json({ error: "Use POST for the AI rules writer." }, 405);
    }
    try {
      const authHeader = req.headers.get("Authorization") ?? "";
      const jwt = /^Bearer\s+/i.test(authHeader)
        ? authHeader.replace(/^Bearer\s+/i, "").trim()
        : "";
      if (!jwt) {
        throw new RequestError("Sign in to use the AI rules writer.", 401);
      }
      const client = deps.createClient(
        deps.env("SUPABASE_URL") ?? "",
        deps.env("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: authError } = await client.auth.getUser(
        jwt,
      );
      if (
        authError || !user || (user as { is_anonymous?: boolean }).is_anonymous
      ) {
        throw new RequestError("Sign in to use the AI rules writer.", 401);
      }

      const input = await req.text();
      if (input.length > 2_000_000) {
        throw new RequestError(
          "This rules request is too large. Use fewer context chapters.",
          413,
        );
      }
      let body: unknown;
      try {
        body = JSON.parse(input);
      } catch {
        throw new RequestError("Invalid JSON request body.");
      }
      if (!isRecord(body)) throw new RequestError("Invalid request body.");
      const model = resolveRulesModel(
        body.modelId,
        deps.env("OPENROUTER_RULES_MODEL"),
        deps.env("OPENROUTER_DEFAULT_MODEL"),
      );
      const prompt = buildRulesPrompt(body);
      const key = deps.env("OPENROUTER_API_KEY");
      if (!key) {
        throw new RequestError("OpenRouter API Key not configured.", 503);
      }
      const admin = deps.createClient(
        deps.env("SUPABASE_URL") ?? "",
        deps.env("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      // Register supported choices without resetting administrator pricing, tier, or disabled status.
      const { error: registrationError } = await admin.from("ai_models").upsert(
        {
          provider: "openrouter",
          model_id: model,
          modality: "text",
          enabled: true,
          tier_min: "free",
        },
        { onConflict: "provider,model_id", ignoreDuplicates: true },
      );
      if (registrationError) {
        throw new RequestError(
          "The AI model catalog is unavailable. Try again later.",
          503,
        );
      }
      const { data: modelRow, error: modelError } = await admin.from(
        "ai_models",
      ).select("price_meta, enabled, modality").eq("provider", "openrouter").eq(
        "model_id",
        model,
      ).maybeSingle();
      if (modelError || !modelRow) {
        throw new RequestError(
          "The AI model catalog is unavailable. Try again later.",
          503,
        );
      }
      if (!modelRow.enabled || modelRow.modality !== "text") {
        throw new RequestError(
          "This rules-writing model is disabled. Choose another model.",
          403,
        );
      }
      const pricing = parsePriceMeta(modelRow.price_meta);

      const response = await deps.fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(rulesProviderBody(model, prompt)),
          signal: AbortSignal.timeout(120_000),
        },
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new RequestError(
          `OpenRouter request failed (${response.status}): ${
            errorText.slice(0, 400)
          }`,
          502,
        );
      }
      const responseJson: unknown = await response.json();
      const text = readProviderText(responseJson);
      if (!text) {
        throw new RequestError(
          "The model returned an empty response. Try again.",
          502,
        );
      }
      const usage = isRecord(responseJson) && isRecord(responseJson.usage)
        ? responseJson.usage
        : {};
      const tokens = (value: unknown) =>
        Math.max(0, Math.floor(toFiniteNumber(value) ?? 0));
      const promptTokens = tokens(usage.prompt_tokens);
      const completionTokens = tokens(usage.completion_tokens);
      const totalTokens = tokens(usage.total_tokens) ||
        promptTokens + completionTokens;
      const providerCostUsd = pricing
        ? (promptTokens * pricing.inputPerMillionUsd +
          completionTokens * pricing.outputPerMillionUsd) / 1_000_000
        : null;
      const providerCostCents = providerCostUsd === null
        ? 0
        : Math.ceil(providerCostUsd * 100);
      const platformFeeCents = providerCostCents;
      const totalChargedCents = providerCostCents + platformFeeCents;
      if (totalChargedCents > 0) {
        const { data: debited, error: debitError } = await client.rpc(
          "wallet_debit",
          { amount_cents: totalChargedCents },
        );
        if (debitError) {
          throw new RequestError(
            "The account balance could not be updated. Check Payments before retrying.",
            503,
          );
        }
        if (!debited) {
          throw new RequestError(
            `Insufficient account balance for AI rules call ($${
              (totalChargedCents / 100).toFixed(2)
            }).`,
            402,
          );
        }
      }
      const { error: ledgerError } = await admin.from("ai_usage_ledger").insert(
        {
          user_id: user.id,
          provider: "openrouter",
          model_id: model,
          modality: "text",
          provider_cost_cents: providerCostCents,
          platform_fee_cents: platformFeeCents,
          total_charged_cents: totalChargedCents,
          request_meta: {
            surface: "ai-rules-writer",
            activeChapterTitle: prompt.activeChapterTitle,
            mode: prompt.mode,
            contextWeights: prompt.contextWeights,
            chapterCount: prompt.chapterCount,
          },
          response_meta: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
            pricing_known: Boolean(pricing),
            provider_cost_usd: providerCostUsd,
            platform_fee_usd: providerCostUsd,
            total_charged_usd: providerCostUsd === null
              ? null
              : providerCostUsd * 2,
          },
        },
      );
      // Keep an already-paid draft available if history storage fails; do not trigger a second paid retry.
      if (ledgerError) {
        console.error(
          "ai-rules-writer: usage history could not be recorded",
          ledgerError.code,
        );
      }
      return json({
        success: true,
        text,
        model,
        usage: { promptTokens, completionTokens, totalTokens },
        cost: {
          estimatedCostUsd: providerCostUsd,
          providerCostCents,
          platformFeeCents,
          totalChargedCents,
          pricingKnown: Boolean(pricing),
          currency: "USD",
        },
      });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "AI rules writer failed.";
      return json(
        { error: message },
        error instanceof RequestError ? error.status : 400,
      );
    }
  };
}
