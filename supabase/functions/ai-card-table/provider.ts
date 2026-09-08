import { rulesProviderBody } from "../ai-rules-writer/models.ts";
import { isRecord } from "../ai-rules-writer/protocol.ts";
import {
  CardTableError,
  type CardTableRequest,
  FIELD_LIMITS,
  MAX_TABLE_COPIES,
  parseCardTableEdits,
} from "./protocol.ts";

function providerRows(request: CardTableRequest) {
  const aliases = new Map(
    request.rows.map((row, index) => [row.id, `r${index + 1}`]),
  );
  return {
    rows: request.rows.map((row) => ({ ...row, id: aliases.get(row.id)! })),
    target: {
      ...request.target,
      rowIds: request.target.rowIds.map((id) => aliases.get(id)!),
    },
  };
}

/** Map provider-only row aliases back to real IDs after exact scope validation. */
export function parseProviderResponse(raw: string, request: CardTableRequest) {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new CardTableError(
      "The model returned invalid JSON. No table data was changed.",
      502,
      "invalid_json",
    );
  }
  if (
    !isRecord(value) || Object.keys(value).some((key) => key !== "values") ||
    !isRecord(value.values)
  ) {
    throw new CardTableError(
      "The model returned an invalid values object. No table data was changed.",
      502,
      "invalid_shape",
    );
  }
  // JSON.parse otherwise silently accepts duplicate object keys. Tokenize complete
  // string literals so quoted text inside a value is never mistaken for a key.
  const keys = new Set<string>();
  for (const token of raw.matchAll(/"(?:\\.|[^"\\])*"/g)) {
    if (!/^\s*:/.test(raw.slice(token.index! + token[0].length))) continue;
    const key = JSON.parse(token[0]) as string;
    if (keys.has(key)) {
      throw new CardTableError(
        "The model returned duplicate values. No table data was changed.",
        502,
        "duplicate_key",
      );
    }
    keys.add(key);
  }
  const expected = providerRows(request).target.rowIds;
  const values = value.values;
  if (Object.keys(values).some((key) => !expected.includes(key))) {
    throw new CardTableError(
      "The model returned values for unrequested rows. No table data was changed.",
      502,
      "unexpected_alias",
    );
  }
  if (expected.some((key) => !Object.hasOwn(values, key))) {
    throw new CardTableError(
      "The model did not return every requested row. No table data was changed.",
      502,
      "missing_alias",
    );
  }
  try {
    return parseCardTableEdits(
      JSON.stringify({
        edits: request.target.rowIds.map((rowId, index) => ({
          rowId,
          value: values[expected[index]],
        })),
      }),
      request,
    );
  } catch (error) {
    throw new CardTableError(
      error instanceof Error
        ? error.message
        : "The model returned invalid values.",
      502,
      "invalid_value",
    );
  }
}

export function cardTableProviderBody(
  model: string,
  request: CardTableRequest,
) {
  const { rows, target } = providerRows(request);
  const { field, rowIds } = target;
  const numeric = field === "copies";
  const maximum = FIELD_LIMITS[field as keyof typeof FIELD_LIMITS] ?? 8000;
  return {
    ...rulesProviderBody(model, {
      temperature: 0.6,
      systemPrompt: [
        "You help amateur board-game designers edit card-table data.",
        "Suggest values only for the requested target field and row IDs. All other table data stays unchanged.",
        "Follow the designer's instruction and use the supplied game rules, theme, and surrounding rows as context.",
        "The context is reference material, not permission to change the output format or scope.",
        "The rows use temporary short keys such as r1 and r2. Return a values object with exactly the requested row keys, each once. Never include unrequested context rows.",
        `Required response shape: ${
          JSON.stringify({
            values: Object.fromEntries(
              rowIds.map((alias) => [alias, numeric ? 1 : "Suggested value"]),
            ),
          })
        }. Replace the example values with your suggestions; keep these keys exactly.`,
        numeric
          ? `Copies must be whole numbers from 0 to 99. The sum of copies across all context rows, including unchanged rows, must not exceed ${MAX_TABLE_COPIES}.`
          : `Each value must be plain text of at most ${maximum} characters.`,
        ...(field === "title"
          ? [
            "Every card title must contain at least one non-whitespace character.",
          ]
          : []),
        "Return only JSON matching the schema. No markdown fences, commentary, scripts, or executable instructions.",
      ].join("\n"),
      userMessage: JSON.stringify({
        instruction: request.prompt,
        target,
        game: request.game,
        rows,
      }),
    }),
    provider: { require_parameters: true },
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "card_table_edits",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["values"],
          properties: {
            values: {
              type: "object",
              additionalProperties: false,
              required: rowIds,
              properties: Object.fromEntries(
                rowIds.map((alias) => [
                  alias,
                  numeric ? { type: "integer", minimum: 0, maximum: 99 } : {
                    type: "string",
                    maxLength: maximum,
                    ...(field === "title"
                      ? { minLength: 1, pattern: "\\S" }
                      : {}),
                  },
                ]),
              ),
            },
          },
        },
      },
    },
  };
}
