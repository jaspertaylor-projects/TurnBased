import { MAX_GENERATED_CARDS } from "./model";
import type { CardStudioRow, CardStudioState } from "./types";

export const AI_TABLE_FIELDS = [
  "title",
  "body",
  "cost",
  "category",
  "copies",
] as const;
export type AITableField =
  | (typeof AI_TABLE_FIELDS)[number]
  | `custom:${string}`;
export interface AITableTarget {
  field: AITableField;
  rowIds: string[];
}
export interface AITableEdit {
  rowId: string;
  value: string | number;
}
export interface AITableBaseline {
  identity: string;
  target: AITableTarget;
  order: string[];
  values: Array<string | number>;
}
export const aiFieldLabel = (field: AITableField) =>
  field.startsWith("custom:") ? field.slice(7) : field;
export function aiCellValue(
  row: CardStudioRow,
  field: AITableField,
): string | number {
  return field.startsWith("custom:")
    ? (row.customFields[field.slice(7)] ?? "")
    : row[field as (typeof AI_TABLE_FIELDS)[number]];
}
export function aiFieldExists(
  studio: CardStudioState,
  field: AITableField,
): boolean {
  return field.startsWith("custom:")
    ? studio.customColumns.includes(field.slice(7))
    : AI_TABLE_FIELDS.includes(field as (typeof AI_TABLE_FIELDS)[number]);
}
export function captureAITableBaseline(
  studio: CardStudioState,
  target: AITableTarget,
  identity: string,
): AITableBaseline {
  if (!aiFieldExists(studio, target.field))
    throw new Error("This table field no longer exists.");
  if (
    !target.rowIds.length ||
    new Set(target.rowIds).size !== target.rowIds.length
  )
    throw new Error("Choose at least one existing row.");
  const rows = new Map(studio.rows.map((row) => [row.id, row]));
  return {
    identity,
    target: { ...target, rowIds: [...target.rowIds] },
    order: studio.rows.map((row) => row.id),
    values: target.rowIds.map((id) => {
      const row = rows.get(id);
      if (!row) throw new Error("A selected row no longer exists.");
      return aiCellValue(row, target.field);
    }),
  };
}
export function aiBaselineConflict(
  studio: CardStudioState,
  baseline: AITableBaseline,
  identity: string,
): string | null {
  if (baseline.identity !== identity)
    return "The current game or component changed. Open AI assist again.";
  if (!aiFieldExists(studio, baseline.target.field))
    return "The selected field was removed. Open AI assist again.";
  if (
    studio.rows.length !== baseline.order.length ||
    studio.rows.some((row, i) => row.id !== baseline.order[i])
  )
    return "The table rows changed. Generate a fresh suggestion.";
  const rows = new Map(studio.rows.map((row) => [row.id, row]));
  if (
    baseline.target.rowIds.some(
      (id, i) =>
        !rows.has(id) ||
        aiCellValue(rows.get(id)!, baseline.target.field) !==
          baseline.values[i],
    )
  )
    return "A selected value changed. Generate a fresh suggestion to keep your edits.";
  return null;
}
export function validateAITableEdits(
  value: unknown,
  target: AITableTarget,
): AITableEdit[] {
  if (!Array.isArray(value) || value.length !== target.rowIds.length)
    throw new Error(
      "AI must return one value for every selected row. Nothing was changed.",
    );
  const expected = new Set(target.rowIds),
    seen = new Set<string>();
  const edits = value.map((item) => {
    if (!item || typeof item !== "object")
      throw new Error("AI returned an invalid table edit.");
    const { rowId, value: next } = item as { rowId?: unknown; value?: unknown };
    if (typeof rowId !== "string" || !expected.has(rowId) || seen.has(rowId))
      throw new Error(
        "AI returned duplicate or unexpected rows. Nothing was changed.",
      );
    seen.add(rowId);
    if (target.field === "copies") {
      const copies =
        typeof next === "number"
          ? next
          : typeof next === "string" && /^\d+$/.test(next)
            ? Number(next)
            : NaN;
      if (!Number.isInteger(copies) || copies < 0 || copies > 99)
        throw new Error("Copies must be a whole number from 0 to 99.");
      return { rowId, value: copies };
    }
    if (
      typeof next !== "string" &&
      !(typeof next === "number" && Number.isFinite(next))
    )
      throw new Error("AI returned a value that is not text or a number.");
    const text = String(next);
    const limit =
      target.field === "title" || target.field === "category"
        ? 200
        : target.field === "cost"
          ? 100
          : 8000;
    if (text.length > limit || (target.field === "title" && !text.trim()))
      throw new Error(
        `AI returned an invalid ${aiFieldLabel(target.field)} value. Nothing was changed.`,
      );
    return { rowId, value: text };
  });
  return target.rowIds.map((id) => edits.find((edit) => edit.rowId === id)!);
}
/** Merge only the chosen field into current rows; never replace a request-time table snapshot. */
export function applyAITableEdits(
  studio: CardStudioState,
  baseline: AITableBaseline,
  edits: AITableEdit[],
  identity: string,
  undo = false,
): CardStudioState {
  const conflict = aiBaselineConflict(studio, baseline, identity);
  if (conflict) throw new Error(conflict);
  const values = new Map(
    (undo ? edits : validateAITableEdits(edits, baseline.target)).map(
      (edit) => [edit.rowId, edit.value],
    ),
  );
  const field = baseline.target.field;
  const rows = studio.rows.map((row) =>
    !values.has(row.id)
      ? row
      : field.startsWith("custom:")
        ? {
            ...row,
            customFields: {
              ...row.customFields,
              [field.slice(7)]: String(values.get(row.id)),
            },
          }
        : { ...row, [field]: values.get(row.id) },
  );
  if (
    field === "copies" &&
    rows.reduce((sum, row) => sum + row.copies, 0) > MAX_GENERATED_CARDS
  )
    throw new Error(
      `A batch can contain at most ${MAX_GENERATED_CARDS} cards. Reduce copies before applying.`,
    );
  return { ...studio, rows };
}
