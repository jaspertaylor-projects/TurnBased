import assert from "node:assert/strict";
import test from "node:test";
import {
  type CardTableDependencies,
  createCardTableHandler,
} from "./handler.ts";
import { cardTableUsage } from "./billing.ts";
import { cardTableProviderBody } from "./provider.ts";
import {
  MAX_REQUEST_BYTES,
  parseCardTableEdits,
  parseCardTableRequest,
  readRequestJson,
} from "./protocol.ts";

const row = {
  id: "one",
  title: "Lantern",
  body: "Light the market.",
  cost: "2",
  category: "Tools",
  copies: 3,
  customFields: { points: "1" },
};
const input = {
  target: { field: "body", rowIds: ["one", "two"] },
  rows: [row, { ...row, id: "two", title: "Tea" }],
  game: {
    name: "Moonlit Market",
    theme: "Woodland",
    rules: "Gather 2 coins, or buy one card.",
  },
  prompt: "Write one cozy sentence for each card.",
};
const edits = [
  { rowId: "one", value: "Lanterns welcome the forest traders." },
  { rowId: "two", value: "Share a cup beneath the moon." },
];

function fixture(options: {
  anonymous?: boolean;
  disabled?: boolean;
  authError?: boolean;
  registrationError?: boolean;
  ledgerError?: boolean;
  debitError?: boolean;
  debited?: boolean;
  provider?: unknown;
  status?: number;
  throws?: boolean;
  pricing?: unknown;
} = {}) {
  const sent: Record<string, unknown>[] = [],
    ledger: Record<string, unknown>[] = [];
  const registrations: unknown[] = [], debits: unknown[] = [];
  const client = {
    auth: {
      getUser: (jwt: string) => {
        assert.equal(jwt, "test-jwt");
        return Promise.resolve({
          data: {
            user: { id: "test-user", is_anonymous: options.anonymous ?? false },
          },
          error: options.authError ? { code: "expired" } : null,
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
      insert: (entry: Record<string, unknown>) => {
        ledger.push(entry);
        return Promise.resolve({
          error: options.ledgerError ? { code: "offline" } : null,
        });
      },
    }),
    rpc: (_name: string, value: unknown) => {
      debits.push(value);
      return Promise.resolve({
        data: options.debited ?? true,
        error: options.debitError ? { code: "offline" } : null,
      });
    },
  };
  const handler = createCardTableHandler({
    env: (name) =>
      name === "OPENROUTER_API_KEY" ? "test-only-not-a-real-key" : undefined,
    createClient: (() =>
      client) as unknown as CardTableDependencies["createClient"],
    fetch: ((_url, init) => {
      sent.push(JSON.parse(String(init?.body)));
      if (options.throws) {
        return Promise.reject(new Error("Private upstream error"));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify(
            options.provider ?? {
              id: "generation-fixture",
              choices: [{
                message: {
                  content: JSON.stringify({
                    values: { r1: edits[0].value, r2: edits[1].value },
                  }),
                },
              }],
              usage: {
                prompt_tokens: 100,
                completion_tokens: 40,
                cost: 0.01234,
              },
            },
          ),
          { status: options.status ?? 200 },
        ),
      );
    }) as typeof fetch,
  });
  return {
    sent,
    ledger,
    registrations,
    debits,
    handler,
    request: (body: unknown = input, authorization = "Bearer test-jwt") =>
      handler(
        new Request("http://local.test/ai-card-table", {
          method: "POST",
          headers: { Authorization: authorization },
          body: JSON.stringify(body),
        }),
      ),
  };
}

test("request projection retains text context and targets but never forwards artwork or unrelated project state", () => {
  const parsed = parseCardTableRequest({
    ...input,
    images: ["data:image/png;base64,PRIVATE"],
    rows: input.rows.map((item) => ({
      ...item,
      artUrl: "https://private.example/art.png",
    })),
  });
  const body = cardTableProviderBody("moonshotai/kimi-k2.6", parsed);
  assert.match(body.messages[1].content, /Gather 2 coins/);
  assert.match(body.messages[1].content, /cozy sentence/);
  assert.doesNotMatch(
    JSON.stringify(body),
    /private\.example|data:image|artUrl|PRIVATE/,
  );
  assert.deepEqual(
    body.response_format.json_schema.schema.properties.values.required,
    ["r1", "r2"],
  );
  assert.equal(body.response_format.json_schema.strict, true);
  assert.deepEqual(body.provider, { require_parameters: true });
  assert.equal(
    "temperature" in cardTableProviderBody("openai/gpt-5.1", parsed),
    false,
  );
});

test("rejects unknown fields/IDs, duplicate IDs, missing custom targets, oversized context and invalid copies", () => {
  for (
    const value of [
      { ...input, target: { field: "artUrl", rowIds: ["one"] } },
      { ...input, target: { field: "body", rowIds: ["missing"] } },
      { ...input, target: { field: "body", rowIds: ["one", "one"] } },
      { ...input, rows: [row, row] },
      { ...input, target: { field: "custom:missing", rowIds: ["one"] } },
      { ...input, target: { field: "custom:__proto__", rowIds: ["one"] } },
      { ...input, rows: [{ ...row, copies: 1.5 }] },
      { ...input, rows: [{ ...row, copies: 100 }] },
      { ...input, rows: [{ ...row, copies: -1 }] },
      { ...input, prompt: " " },
      { ...input, prompt: "p".repeat(4001) },
      {
        ...input,
        rows: Array.from(
          { length: 201 },
          (_, index) => ({ ...row, id: String(index) }),
        ),
      },
      {
        ...input,
        target: {
          field: "body",
          rowIds: Array.from({ length: 101 }, (_, index) => String(index)),
        },
      },
    ]
  ) assert.throws(() => parseCardTableRequest(value));
  assert.equal(
    parseCardTableRequest({
      ...input,
      target: { field: "custom:points", rowIds: ["one"] },
    }).target.field,
    "custom:points",
  );
});

test("accepts complete replies in requested order, rejects missing/extra/duplicate edits and invalid value types", () => {
  const parsed = parseCardTableRequest(input);
  assert.deepEqual(
    parseCardTableEdits(
      JSON.stringify({ edits: [...edits].reverse() }),
      parsed,
    ),
    edits,
  );
  for (
    const result of [
      "```json\n{}\n```",
      "not json",
      "[]",
      JSON.stringify({ edits, project: {} }),
      JSON.stringify({ edits: [edits[0]] }),
      JSON.stringify({ edits: [edits[0], edits[0]] }),
      JSON.stringify({
        edits: [...edits, { rowId: "outside", value: "Wrong row" }],
      }),
      JSON.stringify({ edits: [{ ...edits[0], field: "title" }, edits[1]] }),
      JSON.stringify({ edits: [{ rowId: "one", value: {} }, edits[1]] }),
      JSON.stringify({ edits: [{ rowId: "one", value: 2 }, edits[1]] }),
    ]
  ) assert.throws(() => parseCardTableEdits(result, parsed));
  const copies = parseCardTableRequest({
    ...input,
    target: { field: "copies", rowIds: ["one"] },
  });
  for (const value of [-1, 100, 2.5, "2", null]) {
    assert.throws(() =>
      parseCardTableEdits(
        JSON.stringify({ edits: [{ rowId: "one", value }] }),
        copies,
      )
    );
  }
  assert.deepEqual(
    parseCardTableEdits('{"edits":[{"rowId":"one","value":0}]}', copies),
    [{ rowId: "one", value: 0 }],
  );
  const title = parseCardTableRequest({
    ...input,
    target: { field: "title", rowIds: ["one"] },
  });
  assert.throws(() =>
    parseCardTableEdits(
      JSON.stringify({ edits: [{ rowId: "one", value: "x".repeat(201) }] }),
      title,
    )
  );
});

test("bounded body reader rejects both declared and streamed oversized requests before parsing", async () => {
  await assert.rejects(
    () =>
      readRequestJson(
        new Request("http://local", {
          method: "POST",
          headers: { "Content-Length": String(MAX_REQUEST_BYTES + 1) },
          body: "{}",
        }),
      ),
    /too large/,
  );
  await assert.rejects(
    () =>
      readRequestJson(
        new Request("http://local", {
          method: "POST",
          body: "🌙".repeat(MAX_REQUEST_BYTES / 2),
        }),
      ),
    /too large/,
  );
  await assert.rejects(
    () =>
      readRequestJson(
        new Request("http://local", { method: "POST", body: "{bad" }),
      ),
    /Invalid JSON/,
  );
});

test("auth, request and catalog failures stop before any provider call", async () => {
  for (
    const [options, body, authorization, status] of [
      [{}, input, "", 401],
      [{ anonymous: true }, input, "Bearer test-jwt", 401],
      [{ authError: true }, input, "Bearer test-jwt", 401],
      [{}, { ...input, modelId: "unknown/model" }, "Bearer test-jwt", 400],
      [
        {},
        { ...input, target: { field: "body", rowIds: ["missing"] } },
        "Bearer test-jwt",
        400,
      ],
      [{ disabled: true }, input, "Bearer test-jwt", 403],
      [{ registrationError: true }, input, "Bearer test-jwt", 503],
    ] as const
  ) {
    const state = fixture(options);
    assert.equal((await state.request(body, authorization)).status, status);
    assert.equal(state.sent.length, 0);
  }
  const state = fixture();
  assert.equal(
    (await state.handler(new Request("http://local", { method: "OPTIONS" })))
      .status,
    200,
  );
  assert.equal((await state.handler(new Request("http://local"))).status, 405);
});

test("valid preview records actual provider cost once and preserves configured model catalog metadata", async () => {
  const state = fixture({
    pricing: { input_per_million_usd: 999, output_per_million_usd: 999 },
  });
  const response = await state.request({ ...input, modelId: "openai/gpt-5.1" });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.edits, edits);
  assert.equal(result.field, "body");
  assert.equal(result.model, "openai/gpt-5.1");
  assert.equal(result.cost.providerCostUsd, 0.01234);
  assert.equal(result.cost.actualCostKnown, true);
  assert.equal(result.cost.source, "provider");
  assert.equal(result.usage.totalTokens, 140);
  assert.deepEqual(state.debits, [{ amount_cents: 4 }]);
  assert.deepEqual(state.registrations, [{
    onConflict: "provider,model_id",
    ignoreDuplicates: true,
  }]);
  assert.equal(state.ledger.length, 1);
  assert.equal(state.ledger[0].user_id, "test-user");
  assert.doesNotMatch(
    JSON.stringify(state.ledger),
    /Light the market|Woodland|cozy sentence/,
  );
});

test("rejected provider edits record incurred cost without debiting the designer or returning partial edits", async () => {
  const state = fixture({
    provider: {
      choices: [{
        message: {
          content: JSON.stringify({ values: { r1: edits[0].value } }),
        },
      }],
      usage: { cost: 0.004 },
    },
  });
  const response = await state.request();
  assert.equal(response.status, 502);
  assert.equal("edits" in await response.json(), false);
  assert.equal(state.debits.length, 0);
  assert.equal(state.ledger[0].provider_cost_cents, 1);
  assert.equal(state.ledger[0].total_charged_cents, 0);
  assert.equal(
    (state.ledger[0].response_meta as Record<string, unknown>).accepted,
    false,
  );
  assert.equal(
    (state.ledger[0].response_meta as Record<string, unknown>).failure_reason,
    "missing_alias",
  );
});

function providerValues(values: Record<string, string | number>) {
  return {
    choices: [{ message: { content: JSON.stringify({ values }) } }],
    usage: { cost: 0.004 },
  };
}

async function assertRejectedPreview(
  state: ReturnType<typeof fixture>,
  response: Response,
) {
  assert.equal(response.status, 502);
  const result = await response.json();
  assert.equal(typeof result.error, "string");
  assert.equal("edits" in result, false);
  assert.equal(state.sent.length, 1);
  assert.deepEqual(state.debits, []);
  assert.equal(state.ledger.length, 1);
  assert.equal(state.ledger[0].provider_cost_cents, 1);
  assert.equal(state.ledger[0].total_charged_cents, 0);
  assert.equal(
    (state.ledger[0].response_meta as Record<string, unknown>).accepted,
    false,
  );
}

test("blank AI titles reject the entire preview without debiting the designer", async () => {
  for (const title of ["", " \t\n", "\u00a0"]) {
    const state = fixture({
      provider: providerValues({ r1: "Valid new title", r2: title }),
    });
    await assertRejectedPreview(
      state,
      await state.request({
        ...input,
        target: { field: "title", rowIds: ["one", "two"] },
      }),
    );
  }
});

test("copies edits cannot expand a full table beyond 2,000 physical cards", async () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    ...row,
    id: `card-${index + 1}`,
    copies: 90,
  }));
  const state = fixture({
    provider: providerValues(
      Object.fromEntries(rows.map((_, index) => [`r${index + 1}`, 96])),
    ),
  });
  await assertRejectedPreview(
    state,
    await state.request({
      ...input,
      rows,
      target: { field: "copies", rowIds: rows.map((item) => item.id) },
    }),
  );
});

test("copy edits include unchanged context rows in the total and accept exactly 2,000", async () => {
  const rows = [
    ...Array.from({ length: 20 }, (_, index) => ({
      ...row,
      id: `unchanged-${index + 1}`,
      copies: 99,
    })),
    { ...row, id: "selected", copies: 10 },
  ];
  const request = {
    ...input,
    rows,
    target: { field: "copies", rowIds: ["selected"] },
  };
  const rejected = fixture({ provider: providerValues({ r21: 21 }) });
  await assertRejectedPreview(rejected, await rejected.request(request));

  const accepted = fixture({ provider: providerValues({ r21: 20 }) });
  const response = await accepted.request(request);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).edits, [{
    rowId: "selected",
    value: 20,
  }]);
  assert.deepEqual(accepted.debits, [{ amount_cents: 2 }]);
  assert.equal(accepted.sent.length, 1);
  assert.equal(accepted.ledger.length, 1);
  assert.equal(
    (accepted.ledger[0].response_meta as Record<string, unknown>).accepted,
    true,
  );
});

test("provider outages never debit and hide upstream payloads; wallet failures record incurred cost", async () => {
  for (const options of [{ status: 429 }, { throws: true }]) {
    const state = fixture(options);
    const response = await state.request();
    assert.equal(response.status, 502);
    assert.equal(state.debits.length, 0);
    assert.equal(state.ledger.length, 0);
    assert.doesNotMatch(await response.text(), /Private upstream|Lantern/);
  }
  for (
    const [options, status] of [[{ debited: false }, 402], [{
      debitError: true,
    }, 503]] as const
  ) {
    const state = fixture(options);
    assert.equal((await state.request()).status, status);
    assert.equal(state.sent.length, 1);
    assert.equal(state.ledger[0].total_charged_cents, 0);
  }
});

test("paid preview remains available when usage history is offline, without retrying or charging twice", async () => {
  const state = fixture({ ledgerError: true });
  assert.equal((await state.request()).status, 200);
  assert.equal(state.sent.length, 1);
  assert.equal(state.debits.length, 1);
});

test("cost accounting distinguishes free actual usage, catalog estimates, and unknown pricing", () => {
  const pricing = { input_per_million_usd: 1, output_per_million_usd: 2 };
  const free = cardTableUsage(
    { usage: { cost: 0, prompt_tokens: 100 } },
    pricing,
  );
  assert.equal(free.cost.actualCostKnown, true);
  assert.equal(free.cost.totalChargedCents, 0);
  const estimate = cardTableUsage({
    usage: { prompt_tokens: 100, completion_tokens: 50 },
  }, pricing);
  assert.equal(estimate.cost.providerCostUsd, 0.0002);
  assert.equal(estimate.cost.actualCostKnown, false);
  assert.equal(estimate.cost.source, "catalog_estimate");
  assert.equal(cardTableUsage({}, null).cost.pricingKnown, false);
  assert.throws(
    () => cardTableUsage({ usage: { cost: 1e25 } }, null),
    /billing/,
  );
});
