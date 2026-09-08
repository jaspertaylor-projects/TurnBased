import assert from "node:assert/strict";
import test from "node:test";
import { buildRulesPrompt } from "./prompt.ts";
import {
  createRulesWriterHandler,
  readProviderText,
  type RulesWriterDependencies,
} from "./handler.ts";
import {
  DEFAULT_RULES_MODEL,
  resolveRulesModel,
  RULES_MODELS,
  rulesProviderBody,
} from "./models.ts";
import { parsePriceMeta } from "./protocol.ts";
import {
  DEFAULT_PROJECT_AI_MODELS,
  normalizeProjectAIModels,
  RULES_WRITER_MODEL_OPTIONS,
  rulesWriterSupportsTemperature,
} from "../../../apps/web/src/editor/aiModelCatalog.ts";

const input = {
  gameName: "Woodland",
  theme: "FOREST_THEME",
  artStyle: "PAINT_STYLE",
  activeChapterTitle: "Setup",
  activeChapterBody: "KEEP_THREE_COINS",
  userPrompt: "PROMPT_CITY_NAMES",
  chapters: [{ title: "Setup", body: "KEEP_THREE_COINS" }],
};

test("frontend and backend model IDs, defaults, migrations, and capabilities stay aligned", () => {
  assert.deepEqual(
    RULES_WRITER_MODEL_OPTIONS.map((model) => model.id),
    RULES_MODELS,
  );
  assert.equal(DEFAULT_PROJECT_AI_MODELS.rulesWriter, DEFAULT_RULES_MODEL);
  for (const model of RULES_MODELS) {
    assert.equal(
      "temperature" in rulesProviderBody(model, buildRulesPrompt(input)),
      rulesWriterSupportsTemperature(model),
    );
  }
  assert.equal(
    resolveRulesModel("google/gemini-3-pro-preview"),
    normalizeProjectAIModels({ rulesWriter: "google/gemini-3-pro-preview" })
      .rulesWriter,
  );
  assert.throws(
    () => resolveRulesModel("invented/expensive-model"),
    /available/,
  );
  assert.equal(
    resolveRulesModel("operator/custom", "operator/custom"),
    "operator/custom",
  );
});

test("weighted context follows priority and muted sources are absent from both prompts", () => {
  const prompt = buildRulesPrompt({
    ...input,
    mode: "brainstorm",
    contextWeights: { chips: 80, rulebook: 60, prompt: 100 },
    temperature: 1.15,
  });
  assert.ok(
    prompt.userMessage.indexOf("USER GUIDANCE") <
      prompt.userMessage.indexOf("PROJECT FLAVOR"),
  );
  assert.ok(
    prompt.userMessage.indexOf("PROJECT FLAVOR") <
      prompt.userMessage.indexOf("RULEBOOK SO FAR"),
  );
  assert.equal(prompt.temperature, 1.15);
  const muted = buildRulesPrompt({
    ...input,
    mode: "brainstorm",
    contextWeights: { rulebook: 0, chips: 0, prompt: 100 },
  });
  assert.doesNotMatch(
    muted.userMessage,
    /Woodland|FOREST_THEME|PAINT_STYLE|KEEP_THREE_COINS|Setup/,
  );
  assert.doesNotMatch(
    muted.systemPrompt,
    /Match the tone|GROUND every reference/,
  );
  assert.match(muted.userMessage, /PROMPT_CITY_NAMES/);
});

test("missing active section is appended and marked correctly; rewrite and expand preserve their source", () => {
  const missing = buildRulesPrompt({
    ...input,
    chapters: [{ title: "Unrelated", body: "OTHER" }],
    mode: "rewrite",
  });
  assert.match(
    missing.userMessage,
    /### 2\. Setup ← YOU ARE WRITING THIS SECTION/,
  );
  assert.doesNotMatch(missing.userMessage, /Unrelated ←/);
  assert.match(
    missing.userMessage,
    /EXISTING TEXT TO REWRITE[^]*KEEP_THREE_COINS/,
  );
  const expanded = buildRulesPrompt({
    ...input,
    mode: "expand",
    temperature: -3,
  });
  assert.equal(expanded.temperature, 0);
  assert.match(expanded.userMessage, /EXISTING TEXT TO PRESERVE AND BUILD ON/);
  assert.equal(
    buildRulesPrompt({ ...input, temperature: NaN }).temperature,
    0.6,
  );
});

function fixture(
  options: {
    anonymous?: boolean;
    disabled?: boolean;
    registrationError?: boolean;
    pricing?: unknown;
    provider?: unknown;
    status?: number;
  } = {},
) {
  const sent: Record<string, unknown>[] = [];
  const registrations: unknown[] = [];
  const ledger: unknown[] = [];
  const debits: unknown[] = [];
  const client = {
    auth: {
      getUser: (jwt: string) => {
        assert.equal(jwt, "test-jwt");
        return Promise.resolve({
          data: {
            user: { id: "test-user", is_anonymous: options.anonymous ?? false },
          },
          error: null,
        });
      },
    },
    from: () => ({
      upsert: (_row: unknown, config: unknown) => {
        registrations.push(config);
        return Promise.resolve({
          error: options.registrationError ? { code: "offline" } : null,
        });
      },
      select() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle: () =>
        Promise.resolve({
          data: {
            enabled: !options.disabled,
            modality: "text",
            price_meta: options.pricing ?? null,
          },
          error: null,
        }),
      insert: (row: unknown) => {
        ledger.push(row);
        return Promise.resolve({ error: null });
      },
    }),
    rpc: (_name: string, args: unknown) => {
      debits.push(args);
      return Promise.resolve({ data: true, error: null });
    },
  };
  const handler = createRulesWriterHandler({
    env: (name) =>
      name === "OPENROUTER_API_KEY" ? "test-only-not-a-real-key" : undefined,
    createClient: (() =>
      client) as unknown as RulesWriterDependencies["createClient"],
    fetch: ((_url: string | URL | Request, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      return Promise.resolve(
        new Response(
          JSON.stringify(
            options.provider ??
              {
                choices: [{ message: { content: "A mocked draft." } }],
                usage: { prompt_tokens: 100, completion_tokens: 30 },
              },
          ),
          { status: options.status ?? 200 },
        ),
      );
    }) as typeof fetch,
  });
  const request = (body: unknown = input, authorization = "Bearer test-jwt") =>
    handler(
      new Request("http://local.test/ai-rules-writer", {
        method: "POST",
        headers: { Authorization: authorization },
        body: JSON.stringify(body),
      }),
    );
  return { request, sent, registrations, ledger, debits, handler };
}

test("missing/anonymous auth, unsupported models, disabled catalog entries, and catalog failure never call provider", async () => {
  for (
    const [options, payload, authorization, status] of [
      [{}, input, "", 401],
      [{ anonymous: true }, input, "Bearer test-jwt", 401],
      [{}, { ...input, modelId: "invented/model" }, "Bearer test-jwt", 400],
      [{ disabled: true }, input, "Bearer test-jwt", 403],
      [{ registrationError: true }, input, "Bearer test-jwt", 503],
    ] as const
  ) {
    const state = fixture(options);
    assert.equal((await state.request(payload, authorization)).status, status);
    assert.equal(state.sent.length, 0);
  }
});

test("successful mocked call retains temperature/model and non-destructive registration, records usage once", async () => {
  const state = fixture({
    pricing: { input_per_million_usd: 1, output_per_million_usd: 2 },
  });
  const response = await state.request({
    ...input,
    modelId: "anthropic/claude-sonnet-4.6",
    temperature: 1.15,
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.text, "A mocked draft.");
  assert.equal(result.usage.totalTokens, 130);
  assert.equal(state.sent[0].temperature, 1.15);
  assert.deepEqual(state.registrations, [{
    onConflict: "provider,model_id",
    ignoreDuplicates: true,
  }]);
  assert.deepEqual(state.debits, [{ amount_cents: 2 }]);
  assert.equal(state.ledger.length, 1);
});

test("provider error and malformed content never debit; GPT-5.1 omits temperature", async () => {
  for (
    const options of [{ status: 429 }, {
      provider: { choices: [{ message: { content: null } }] },
    }]
  ) {
    const state = fixture(options);
    assert.equal((await state.request()).status, 502);
    assert.equal(state.debits.length, 0);
    assert.equal(state.ledger.length, 0);
  }
  const state = fixture();
  assert.equal(
    (await state.request({
      ...input,
      modelId: "openai/gpt-5.1",
      temperature: 1.5,
    })).status,
    200,
  );
  assert.equal("temperature" in state.sent[0], false);
  assert.equal(
    readProviderText({
      choices: [{
        message: {
          content: [{ type: "text", text: "A" }, { type: "text", text: "B" }],
        },
      }],
    }),
    "A\nB",
  );
  assert.equal(
    parsePriceMeta({ input_per_million_usd: -1, output_per_million_usd: 2 }),
    null,
  );
});

test('whole-rulebook requests use the authenticated writer and reject malformed chapter output before charging', async () => {
  const request = { ...input, mode: 'rulebook', targetChapters: [{ id: 'setup', title: 'Setup' }] };
  const text = JSON.stringify({ chapters: [{ id: 'setup', body: 'Each trader starts with two coins.' }] });
  const valid = fixture({ provider: { choices: [{ message: { content: text } }], usage: { prompt_tokens: 100, completion_tokens: 50 } } });
  assert.equal((await valid.request(request)).status, 200);
  assert.equal(valid.ledger.length, 1);
  assert.equal((valid.ledger[0] as { request_meta: { mode: string } }).request_meta.mode, 'rulebook');
  const malformed = fixture({ provider: { choices: [{ message: { content: '{"chapters":[]}' } }] } });
  assert.equal((await malformed.request(request)).status, 502);
  assert.equal(malformed.debits.length, 0);
});
