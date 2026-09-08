import { isRecord } from "../ai-rules-writer/protocol.ts";

export const MAX_REQUEST_BYTES = 256 * 1024;
export const MAX_CONTEXT_ROWS = 200;
export const MAX_TARGET_ROWS = 100;
/** Keep aligned with the editor's MAX_GENERATED_CARDS batch limit. */
export const MAX_TABLE_COPIES = 2000;
export const FIELD_LIMITS = {
  title: 200,
  body: 8000,
  cost: 100,
  category: 200,
};

export class CardTableError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly category?: string,
  ) {
    super(message);
  }
}

export interface TableRow {
  id: string;
  title: string;
  body: string;
  cost: string;
  category: string;
  copies: number;
  customFields: Record<string, string>;
}

export interface CardTableRequest {
  target: { field: string; rowIds: string[] };
  rows: TableRow[];
  game: { name: string; theme: string; rules: string };
  prompt: string;
  modelId?: string;
}

export interface CardTableEdit {
  rowId: string;
  value: string | number;
}

function text(
  value: unknown,
  name: string,
  maximum: number,
  required = false,
): string {
  if (
    typeof value !== "string" || value.length > maximum ||
    (required && !value.trim())
  ) {
    throw new CardTableError(
      `${name} must be ${
        required ? "non-empty " : ""
      }text of at most ${maximum} characters.`,
    );
  }
  return value;
}

function customKey(key: string): boolean {
  return key.length > 0 && key.length <= 64 && key === key.trim() &&
    [...key].every((character) =>
      character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127
    ) &&
    !["__proto__", "constructor", "prototype"].includes(key.toLowerCase());
}

function copies(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 &&
    value <= 99;
}

export async function readRequestJson(req: Request): Promise<unknown> {
  if (Number(req.headers.get("Content-Length")) > MAX_REQUEST_BYTES) {
    throw new CardTableError(
      "This card request is too large. Use fewer rows or shorter context.",
      413,
    );
  }
  const reader = req.body?.getReader();
  if (!reader) throw new CardTableError("A JSON request body is required.");
  const decoder = new TextDecoder();
  let length = 0, body = "";
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new CardTableError(
          "This card request is too large. Use fewer rows or shorter context.",
          413,
        );
      }
      body += decoder.decode(result.value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch (error) {
    if (error instanceof CardTableError) throw error;
    throw new CardTableError("Invalid JSON request body.");
  } finally {
    reader.releaseLock();
  }
}

export function parseCardTableRequest(value: unknown): CardTableRequest {
  if (!isRecord(value) || !isRecord(value.target) || !isRecord(value.game)) {
    throw new CardTableError(
      "Provide a target field, rows, game context, and instruction.",
    );
  }
  if (
    !Array.isArray(value.rows) || !value.rows.length ||
    value.rows.length > MAX_CONTEXT_ROWS
  ) {
    throw new CardTableError(
      `Provide between 1 and ${MAX_CONTEXT_ROWS} context rows.`,
    );
  }
  const rowIds = new Set<string>();
  const rows = value.rows.map((row): TableRow => {
    if (!isRecord(row) || !isRecord(row.customFields)) {
      throw new CardTableError("Each row needs its data and custom fields.");
    }
    const id = text(row.id, "Row ID", 128, true);
    if (rowIds.has(id)) {
      throw new CardTableError("Context row IDs must be unique.");
    }
    rowIds.add(id);
    if (!copies(row.copies)) {
      throw new CardTableError("Copies must be a whole number from 0 to 99.");
    }
    const entries = Object.entries(row.customFields);
    if (entries.length > 32) {
      throw new CardTableError("A row can include at most 32 custom fields.");
    }
    const customFields = Object.fromEntries(entries.map(([key, fieldValue]) => {
      if (!customKey(key)) {
        throw new CardTableError(
          "Custom field names must be 1–64 characters and cannot use reserved names.",
        );
      }
      return [key, text(fieldValue, `Custom field ${key}`, 8000)];
    }));
    // Explicitly select text data: artwork URLs, images, and other project state never reach the provider.
    return {
      id,
      title: text(row.title, "Title", FIELD_LIMITS.title),
      body: text(row.body, "Body", FIELD_LIMITS.body),
      cost: text(row.cost, "Cost", FIELD_LIMITS.cost),
      category: text(row.category, "Category", FIELD_LIMITS.category),
      copies: row.copies,
      customFields,
    };
  });
  const field = text(value.target.field, "Target field", 71, true);
  const custom = field.startsWith("custom:") ? field.slice(7) : null;
  if (
    !(Object.hasOwn(FIELD_LIMITS, field) || field === "copies" ||
      (custom !== null && customKey(custom)))
  ) {
    throw new CardTableError(
      "Choose title, body, cost, category, copies, or an existing custom field.",
    );
  }
  const targets = value.target.rowIds;
  if (
    !Array.isArray(targets) || !targets.length ||
    targets.length > MAX_TARGET_ROWS
  ) {
    throw new CardTableError(
      `Choose between 1 and ${MAX_TARGET_ROWS} target rows.`,
    );
  }
  const targetIds = targets.map((id) => text(id, "Target row ID", 128, true));
  if (
    new Set(targetIds).size !== targetIds.length ||
    targetIds.some((id) => !rowIds.has(id))
  ) {
    throw new CardTableError(
      "Target row IDs must be unique and present in the supplied table.",
    );
  }
  if (
    custom !== null &&
    rows.some((row) =>
      targetIds.includes(row.id) && !Object.hasOwn(row.customFields, custom)
    )
  ) {
    throw new CardTableError(
      "The custom target field must already exist on every selected row.",
    );
  }
  return {
    target: { field, rowIds: targetIds },
    rows,
    game: {
      name: text(value.game.name, "Game name", 200),
      theme: text(value.game.theme, "Game theme", 4000),
      rules: text(value.game.rules, "Game rules", 60000),
    },
    prompt: text(value.prompt, "Instruction", 4000, true),
    ...(value.modelId === undefined
      ? {}
      : { modelId: text(value.modelId, "Model", 200, true) }),
  };
}

export function parseCardTableEdits(
  raw: string,
  request: CardTableRequest,
): CardTableEdit[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new CardTableError(
      "The model returned invalid JSON. No table data was changed.",
      502,
    );
  }
  if (
    !isRecord(value) || Object.keys(value).some((key) => key !== "edits") ||
    !Array.isArray(value.edits)
  ) {
    throw new CardTableError(
      "The model returned an invalid edits object. No table data was changed.",
      502,
    );
  }
  const expected = request.target.rowIds;
  const found = new Map<string, CardTableEdit>();
  for (const edit of value.edits) {
    if (
      !isRecord(edit) || Object.keys(edit).some((key) =>
        key !== "rowId" && key !== "value"
      ) ||
      typeof edit.rowId !== "string" || !expected.includes(edit.rowId) ||
      found.has(edit.rowId)
    ) {
      throw new CardTableError(
        "The model returned extra, duplicate, or unknown row edits. No table data was changed.",
        502,
      );
    }
    const limit =
      FIELD_LIMITS[request.target.field as keyof typeof FIELD_LIMITS] ?? 8000;
    if (
      request.target.field === "copies"
        ? !copies(edit.value)
        : typeof edit.value !== "string" || edit.value.length > limit ||
          (request.target.field === "title" && !edit.value.trim())
    ) {
      throw new CardTableError(
        "The model returned an invalid field value. No table data was changed.",
        502,
      );
    }
    found.set(edit.rowId, {
      rowId: edit.rowId,
      value: edit.value as string | number,
    });
  }
  if (found.size !== expected.length) {
    throw new CardTableError(
      "The model did not return every requested row. No table data was changed.",
      502,
    );
  }
  if (request.target.field === "copies") {
    const total = request.rows.reduce(
      (sum, row) =>
        sum +
        (found.has(row.id) ? Number(found.get(row.id)!.value) : row.copies),
      0,
    );
    if (total > MAX_TABLE_COPIES) {
      throw new CardTableError(
        `The model proposed more than ${MAX_TABLE_COPIES} cards. No table data was changed.`,
        502,
      );
    }
  }
  return expected.map((id) => found.get(id)!);
}
