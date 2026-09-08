import {
  readProviderText,
  type RulesWriterDependencies,
} from "../ai-rules-writer/handler.ts";
import { resolveRulesModel } from "../ai-rules-writer/models.ts";
import { isRecord } from "../ai-rules-writer/protocol.ts";
import { cardTableUsage } from "./billing.ts";
import {
  type CardTableEdit,
  CardTableError,
  parseCardTableRequest,
  readRequestJson,
} from "./protocol.ts";
import { cardTableProviderBody, parseProviderResponse } from "./provider.ts";

export type CardTableDependencies = RulesWriterDependencies;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export function createCardTableHandler(deps: CardTableDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Use POST for AI table editing." }, 405);
    }
    try {
      const authorization = request.headers.get("Authorization") ?? "";
      const jwt = /^Bearer\s+/i.test(authorization)
        ? authorization.replace(/^Bearer\s+/i, "").trim()
        : "";
      if (!jwt) {
        throw new CardTableError("Sign in to use AI table editing.", 401);
      }
      const client = deps.createClient(
        deps.env("SUPABASE_URL") ?? "",
        deps.env("SUPABASE_ANON_KEY") ?? "",
        {
          global: { headers: { Authorization: authorization } },
        },
      );
      const { data: { user }, error: authError } = await client.auth.getUser(
        jwt,
      );
      if (
        authError || !user || (user as { is_anonymous?: boolean }).is_anonymous
      ) {
        throw new CardTableError("Sign in to use AI table editing.", 401);
      }
      const input = parseCardTableRequest(await readRequestJson(request));
      let model: string;
      try {
        model = resolveRulesModel(
          input.modelId,
          deps.env("OPENROUTER_CARD_TABLE_MODEL") ??
            deps.env("OPENROUTER_RULES_MODEL"),
          deps.env("OPENROUTER_DEFAULT_MODEL"),
        );
      } catch {
        throw new CardTableError("Choose an available AI writing model.");
      }
      const key = deps.env("OPENROUTER_API_KEY");
      if (!key) {
        throw new CardTableError("OpenRouter API Key not configured.", 503);
      }
      const admin = deps.createClient(
        deps.env("SUPABASE_URL") ?? "",
        deps.env("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
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
        throw new CardTableError(
          "The AI model catalog is unavailable. Try again later.",
          503,
        );
      }
      const { data: modelRow, error: modelError } = await admin.from(
        "ai_models",
      )
        .select("price_meta, enabled, modality").eq("provider", "openrouter")
        .eq("model_id", model).maybeSingle();
      if (modelError || !modelRow) {
        throw new CardTableError(
          "The AI model catalog is unavailable. Try again later.",
          503,
        );
      }
      if (!modelRow.enabled || modelRow.modality !== "text") {
        throw new CardTableError(
          "This AI writing model is disabled. Choose another model.",
          403,
        );
      }

      let response: Response;
      try {
        response = await deps.fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(cardTableProviderBody(model, input)),
            signal: AbortSignal.timeout(120_000),
          },
        );
      } catch {
        throw new CardTableError(
          "The AI provider could not complete this request. No table data was changed.",
          502,
        );
      }
      // Avoid exposing raw upstream errors, which may echo submitted private table data.
      if (!response.ok) {
        throw new CardTableError(
          `The AI provider returned an error (${response.status}). No table data was changed.`,
          502,
        );
      }
      let responseJson: unknown;
      try {
        responseJson = await response.json();
      } catch {
        throw new CardTableError(
          "The AI provider returned an invalid response. No table data was changed.",
          502,
        );
      }
      let accounted: ReturnType<typeof cardTableUsage>;
      try {
        accounted = cardTableUsage(responseJson, modelRow.price_meta);
      } catch {
        throw new CardTableError(
          "The AI provider returned invalid billing data. No table data was changed.",
          502,
        );
      }
      let edits: CardTableEdit[] = [], failure: CardTableError | null = null;
      try {
        edits = parseProviderResponse(readProviderText(responseJson), input);
      } catch (error) {
        failure = error instanceof CardTableError
          ? error
          : new CardTableError("The model returned invalid edits.", 502);
      }
      const { usage, cost } = accounted;
      let charged = 0;
      if (!failure && cost.totalChargedCents > 0) {
        const { data: debited, error: debitError } = await client.rpc(
          "wallet_debit",
          { amount_cents: cost.totalChargedCents },
        );
        if (debitError) {
          failure = new CardTableError(
            "The account balance could not be updated. Check Payments before retrying.",
            503,
          );
        } else if (!debited) {
          failure = new CardTableError(
            `Insufficient account balance for this AI table request ($${
              (cost.totalChargedCents / 100).toFixed(2)
            }).`,
            402,
          );
        } else charged = cost.totalChargedCents;
      }
      const { error: ledgerError } = await admin.from("ai_usage_ledger").insert(
        {
          user_id: user.id,
          provider: "openrouter",
          model_id: model,
          modality: "text",
          provider_cost_cents: cost.providerCostCents,
          platform_fee_cents: charged ? cost.platformFeeCents : 0,
          total_charged_cents: charged,
          request_meta: {
            surface: "ai-card-table",
            field: input.target.field,
            targetRowCount: input.target.rowIds.length,
            contextRowCount: input.rows.length,
          },
          response_meta: {
            prompt_tokens: usage.promptTokens,
            completion_tokens: usage.completionTokens,
            total_tokens: usage.totalTokens,
            provider_cost_usd: cost.providerCostUsd,
            pricing_known: cost.pricingKnown,
            actual_cost_known: cost.actualCostKnown,
            cost_source: cost.source,
            response_id:
              isRecord(responseJson) && typeof responseJson.id === "string"
                ? responseJson.id.slice(0, 200)
                : null,
            accepted: !failure,
            failure_status: failure?.status ?? null,
            failure_reason: failure?.category ??
              (failure ? "billing_or_validation" : null),
          },
        },
      );
      // Return a paid preview even if history is temporarily unavailable; never repeat the provider call.
      if (ledgerError) {
        console.error(
          "ai-card-table: usage history could not be recorded",
          ledgerError.code,
        );
      }
      if (failure) return json({ error: failure.message }, failure.status);
      return json({
        success: true,
        field: input.target.field,
        edits,
        model,
        usage,
        cost,
      });
    } catch (error) {
      return json({
        error: error instanceof CardTableError
          ? error.message
          : "AI table editing is temporarily unavailable. No table data was changed.",
      }, error instanceof CardTableError ? error.status : 503);
    }
  };
}
