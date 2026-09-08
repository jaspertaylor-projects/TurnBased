import assert from "node:assert/strict";
import test from "node:test";
import { cardTableProviderBody, parseProviderResponse } from "./provider.ts";
import { CardTableError, parseCardTableRequest } from "./protocol.ts";

const ids = [
  "deck_mtt1234-long-source-id:row_lantern_5678",
  "deck_mtt1234-long-source-id:row_tea_9012",
  "deck_mtt1234-long-source-id:row_moon_3456",
];
const request = parseCardTableRequest({
  target: { field: "body", rowIds: [ids[2], ids[0]] },
  rows: ids.map((id, index) => ({
    id,
    title: `Card ${index}`,
    body: "A woodland card.",
    cost: "1",
    category: "Market",
    copies: 2,
    customFields: {},
  })),
  game: { name: "Moonlit", theme: "Woodland", rules: "Most points wins." },
  prompt: "Write brief flavor text.",
});

test("provider context uses stable short aliases and schema requires exactly the target keys", () => {
  const body = cardTableProviderBody("moonshotai/kimi-k2.6", request);
  const context = JSON.parse(body.messages[1].content);
  assert.deepEqual(context.rows.map((row: { id: string }) => row.id), [
    "r1",
    "r2",
    "r3",
  ]);
  assert.deepEqual(context.target.rowIds, ["r3", "r1"]);
  for (const id of ids) {
    assert.equal(
      JSON.stringify(body).includes(id),
      false,
      "Opaque source IDs never reach provider",
    );
  }
  const schema = body.response_format.json_schema.schema.properties.values;
  assert.deepEqual(schema.required, ["r3", "r1"]);
  assert.deepEqual(Object.keys(schema.properties), ["r3", "r1"]);
  assert.equal(schema.additionalProperties, false);
});

test("reordered alias object converts to exact requested real IDs and never writes context-only rows", () => {
  assert.deepEqual(
    parseProviderResponse(
      '{"values":{"r1":"A lantern.","r3":"A moon."}}',
      request,
    ),
    [
      { rowId: ids[2], value: "A moon." },
      { rowId: ids[0], value: "A lantern." },
    ],
  );
  const quoted = 'A quoted "r3": label is ordinary card text.';
  assert.equal(
    parseProviderResponse(
      JSON.stringify({ values: { r1: quoted, r3: "Moon" } }),
      request,
    )[1].value,
    quoted,
  );
});

test("missing, extra, duplicate, unknown and malformed aliases are rejected without repairing partial data", () => {
  for (
    const [raw, category] of [
      ['{"values":{"r1":"Only one"}}', "missing_alias"],
      [
        '{"values":{"r1":"One","r2":"Context only","r3":"Three"}}',
        "unexpected_alias",
      ],
      [
        '{"values":{"r1":"One","r3":"Three","r9":"Unknown"}}',
        "unexpected_alias",
      ],
      [
        '{"values":{"r1":"First","r1":"Duplicate","r3":"Three"}}',
        "duplicate_key",
      ],
      ['{"values":{"r1":{},"r3":"Three"}}', "invalid_value"],
      ['{"values":{"r1":"One","r3":"Three"},"extra":true}', "invalid_shape"],
      ['{"edits":[]}', "invalid_shape"],
      ['```json\n{"values":{}}\n```', "invalid_json"],
    ]
  ) {
    assert.throws(
      () => parseProviderResponse(raw, request),
      (error) =>
        error instanceof CardTableError && error.status === 502 &&
        error.category === category,
    );
  }
});

test("alias mapping retains final field-value validation for copies and text limits", () => {
  const numeric = {
    ...request,
    target: { ...request.target, field: "copies" },
  };
  assert.deepEqual(
    parseProviderResponse('{"values":{"r3":0,"r1":99}}', numeric),
    [
      { rowId: ids[2], value: 0 },
      { rowId: ids[0], value: 99 },
    ],
  );
  for (const value of [-1, 100, 1.5, "2"]) {
    assert.throws(() =>
      parseProviderResponse(
        JSON.stringify({ values: { r3: value, r1: 2 } }),
        numeric,
      )
    );
  }
  const title = { ...request, target: { ...request.target, field: "title" } };
  assert.throws(() =>
    parseProviderResponse(
      JSON.stringify({ values: { r3: "x".repeat(201), r1: "Fine" } }),
      title,
    )
  );
});

test("title output schema and prompt require nonblank text without restricting optional body text", () => {
  const title = { ...request, target: { ...request.target, field: "title" } };
  const titleBody = cardTableProviderBody("moonshotai/kimi-k2.6", title);
  const titleSchema =
    titleBody.response_format.json_schema.schema.properties.values.properties
      .r3;
  assert.deepEqual(titleSchema, {
    type: "string",
    maxLength: 200,
    minLength: 1,
    pattern: "\\S",
  });
  assert.match(titleBody.messages[0].content, /non-whitespace/);
  const bodySchema =
    cardTableProviderBody("moonshotai/kimi-k2.6", request).response_format
      .json_schema.schema.properties.values.properties.r3;
  assert.deepEqual(bodySchema, { type: "string", maxLength: 8000 });
});
