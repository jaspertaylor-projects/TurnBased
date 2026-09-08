import type {
  CardStudioRow,
  CardStudioState,
  CardTemplate,
  CardTemplatePreset,
  GeneratedCard,
} from "./types";
import { canonicalSerialize } from "@turnbased/shared-utils";
import { normalizeTemplateDocument } from "../templateStudio/model";

export const MAX_CARD_ROWS = 1000;
export const MAX_GENERATED_CARDS = 2000;
export const BASE_CARD_FIELDS = ["title", "body", "cost", "category", "artUrl"] as const;
export const PRESETS: Record<
  CardTemplatePreset,
  { label: string; description: string; colors: [string, string, string] }
> = {
  woodland: {
    label: "Woodland",
    description: "Botanical borders & warm parchment",
    colors: ["#fbf3dd", "#193e31", "#a46e38"],
  },
  storybook: {
    label: "Storybook",
    description: "An illustrated keepsake",
    colors: ["#f6edfc", "#3b2850", "#9467b8"],
  },
  modern: {
    label: "Modern",
    description: "Clean, bold & easy to read",
    colors: ["#f9faf7", "#153c3b", "#d29645"],
  },
};

export function createCardRow(values: Partial<CardStudioRow> = {}): CardStudioRow {
  return {
    id: crypto.randomUUID(),
    title: "",
    body: "",
    cost: "0",
    category: "Action",
    copies: 1,
    artUrl: "",
    customFields: {},
    ...values,
  };
}

export function createDefaultCardStudio(): CardStudioState {
  return {
    schemaVersion: 1,
    rows: [],
    customColumns: ["points"],
    template: {
      preset: "woodland",
      background: "#fbf3dd",
      foreground: "#193e31",
      accent: "#a46e38",
      widthMm: 63,
      heightMm: 88,
      titleField: "title",
      bodyField: "body",
      badgeField: "cost",
      footerField: "category",
      bodyFontSize: 18,
      showArt: true,
    },
  };
}

export function createSampleRows(): CardStudioRow[] {
  return [
    createCardRow({
      title: "Gathering Glade",
      body: "Collect two acorns.\nSometimes the smallest discoveries start the greatest adventures.",
      cost: "0",
      category: "Gather",
      copies: 4,
      customFields: { points: "1" },
    }),
    createCardRow({
      title: "The Lantern Keeper",
      body: "Spend two acorns to light a path.\nA little kindness makes the forest feel like home.",
      cost: "2",
      category: "Companion",
      copies: 3,
      customFields: { points: "3" },
    }),
    createCardRow({
      title: "Moonlit Market",
      body: "Trade three acorns for a treasured find.\nMeet me where the fireflies gather.",
      cost: "3",
      category: "Place",
      copies: 2,
      customFields: { points: "5" },
    }),
    createCardRow({
      title: "Ancient Oak",
      body: "Spend five acorns to build a woodland haven.\nPlant something worth coming back to.",
      cost: "5",
      category: "Wonder",
      copies: 1,
      customFields: { points: "8" },
    }),
  ];
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

export function safeArtUrl(value: string): string {
  const trimmed = value.trim();
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password
      ? parsed.href
      : "";
  } catch {
    return "";
  }
}

export function normalizeCardStudioState(value: unknown): CardStudioState {
  const base = createDefaultCardStudio();
  if (!value || typeof value !== "object") return base;
  const input = value as Partial<CardStudioState>;
  const seenIds = new Set<string>();
  const rows = (Array.isArray(input.rows) ? input.rows : [])
    .slice(0, MAX_CARD_ROWS)
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const customFields = Object.fromEntries(
        Object.entries(row.customFields ?? {})
          .filter(([key]) => !["__proto__", "constructor", "prototype"].includes(key))
          .map(([key, val]) => [key, textValue(val)]),
      );
      const id = typeof row.id === "string" && row.id && !seenIds.has(row.id) ? row.id : crypto.randomUUID();
      seenIds.add(id);
      return {
        id,
        title: textValue(row.title),
        body: textValue(row.body),
        cost: textValue(row.cost),
        category: textValue(row.category),
        artUrl: safeArtUrl(textValue(row.artUrl)),
        customFields,
        copies:
          typeof row.copies === "number" && Number.isInteger(row.copies)
            ? Math.max(0, Math.min(99, row.copies))
            : 1,
      };
    });
  const source = input.template ?? base.template;
  const document = source.document ? normalizeTemplateDocument(source.document, source) : undefined;
  const preset = Object.hasOwn(PRESETS, source.preset) ? source.preset : "woodland";
  const color = (value: unknown, fallback: string) =>
    typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
  const bounded = (value: number, fallback: number, min: number, max: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  const template: CardTemplate = {
    ...base.template,
    preset,
    background: color(source.background, base.template.background),
    foreground: color(source.foreground, base.template.foreground),
    accent: color(source.accent, base.template.accent),
    ...(document ? { document } : {}),
    widthMm: document?.widthMm ?? bounded(source.widthMm, 63, 40, 100),
    heightMm: document?.heightMm ?? bounded(source.heightMm, 88, 50, 140),
    titleField: textValue(source.titleField) || "title",
    bodyField: textValue(source.bodyField) || "body",
    badgeField: textValue(source.badgeField) || "cost",
    footerField: textValue(source.footerField) || "category",
    bodyFontSize: bounded(source.bodyFontSize, 18, 12, 24),
    showArt: source.showArt !== false,
  };
  const customColumns = [
    ...new Set([
      ...(Array.isArray(input.customColumns)
        ? input.customColumns.filter((key) => typeof key === "string")
        : []),
      ...rows.flatMap((row) => Object.keys(row.customFields)),
    ]),
  ].filter(
    (key) =>
      key && !["id", "copies", ...BASE_CARD_FIELDS, "__proto__", "constructor", "prototype"].includes(key),
  );
  // Generated snapshots are caches; rebuild their card payload from normalized source data.
  const result: CardStudioState = { schemaVersion: 1, rows, customColumns, template };
  if (
    input.generated &&
    typeof input.generated.generatedAt === "string" &&
    typeof input.generated.sourceFingerprint === "string"
  ) {
    result.generated = {
      generatedAt: input.generated.generatedAt,
      sourceFingerprint: input.generated.sourceFingerprint,
      cards: [],
    };
    if (
      input.generated.sourceFingerprint === cardStudioFingerprint(result) &&
      !validateCardRows(rows).length
    ) {
      result.generated.cards = expandCardRows(rows).map(({ id, sourceRowId, copyNumber }) => ({
        id,
        sourceRowId,
        copyNumber,
      }));
    }
  }
  return result;
}

export function getCardField(row: CardStudioRow, field: string): string {
  if (BASE_CARD_FIELDS.includes(field as (typeof BASE_CARD_FIELDS)[number]))
    return row[field as (typeof BASE_CARD_FIELDS)[number]];
  if (field === "copies") return String(row.copies);
  return Object.hasOwn(row.customFields, field) ? row.customFields[field] : "";
}

export function validateCardRows(rows: CardStudioRow[]): string[] {
  const errors: string[] = [];
  if (rows.length > MAX_CARD_ROWS) errors.push(`A table can contain at most ${MAX_CARD_ROWS} designs.`);
  const ids = new Set<string>();
  rows.forEach((row, index) => {
    if (!row.title.trim()) errors.push(`Row ${index + 1}: add a card title.`);
    if (!Number.isInteger(row.copies) || row.copies < 0 || row.copies > 99)
      errors.push(`Row ${index + 1}: copies must be a whole number from 0 to 99.`);
    if (row.artUrl && !safeArtUrl(row.artUrl))
      errors.push(`Row ${index + 1}: art must be an https/http URL or an uploaded PNG, JPEG, WebP, or GIF.`);
    if (ids.has(row.id)) errors.push(`Row ${index + 1}: duplicate card ID.`);
    ids.add(row.id);
  });
  if (rows.reduce((total, row) => total + row.copies, 0) > MAX_GENERATED_CARDS)
    errors.push(`A batch can contain at most ${MAX_GENERATED_CARDS} cards. Reduce copies before generating.`);
  return errors;
}

export function expandCardRows(rows: CardStudioRow[]): GeneratedCard[] {
  const errors = validateCardRows(rows);
  if (errors.length) throw new Error(errors.join("\n"));
  return rows.flatMap((row) =>
    Array.from({ length: row.copies }, (_, index) => ({
      id: `${row.id}:${index + 1}`,
      sourceRowId: row.id,
      name: row.title,
      body: row.body,
      cost: row.cost,
      category: row.category,
      artUrl: row.artUrl,
      copyNumber: index + 1,
      fields: { ...row.customFields },
    })),
  );
}

export function cardStudioFingerprint(state: CardStudioState): string {
  const orderedFields = (fields: object) =>
    Object.entries(fields)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [
        key,
        value && typeof value === "object" ? JSON.parse(canonicalSerialize(value)) : value,
      ]);
  const source = JSON.stringify({
    rows: state.rows.map((row) => [
      row.id,
      row.title,
      row.body,
      row.cost,
      row.category,
      row.copies,
      row.artUrl,
      orderedFields(row.customFields),
    ]),
    customColumns: state.customColumns,
    template: orderedFields(state.template),
  });
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1)
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

export function getProjectCards(project: { cardStudio?: CardStudioState }): GeneratedCard[] {
  return expandCardRows(project.cardStudio?.rows ?? []);
}

export function getPlaytestCards(
  state?: CardStudioState,
): Array<{ id: string; name: string; cost: number; points: number; quantity: number }> {
  const number = (value: string) => (Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
  return (state?.rows ?? [])
    .filter((row) => row.copies > 0)
    .map((row) => ({
      id: row.id,
      name: row.title || "Untitled card",
      cost: number(row.cost),
      points: number(row.customFields.points ?? row.customFields.victory_points ?? "0"),
      quantity: row.copies,
    }));
}
