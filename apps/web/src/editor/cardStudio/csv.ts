import { BASE_CARD_FIELDS, createCardRow, MAX_CARD_ROWS, validateCardRows } from "./model";
import type { CardImportResult, CardStudioRow } from "./types";

const CSV_FIELDS = ["id", "title", "body", "cost", "category", "copies", "artUrl"];
const HEADER_ALIASES: Record<string, string> = {
  name: "title",
  text: "body",
  description: "body",
  type: "category",
  quantity: "copies",
  count: "copies",
  art: "artUrl",
  image: "artUrl",
  imageurl: "artUrl",
  arturl: "artUrl",
};

/** RFC 4180 fields, including escaped quotes, multiline content, CRLF, and TSV paste. */
export function parseDelimitedText(input: string): string[][] {
  const source = input.replace(/^\uFEFF/, "");
  let quoted = false;
  let delimiter = ",";
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') quoted = !quoted;
    if (!quoted && char === "\t") {
      delimiter = "\t";
      break;
    }
    if (!quoted && (char === "\n" || char === "\r")) break;
  }
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  let closedQuote = false;
  const endField = () => {
    record.push(field);
    field = "";
    closedQuote = false;
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
  };
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
        closedQuote = true;
      } else field += char;
      continue;
    }
    if (char === delimiter) {
      endField();
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      endRecord();
      continue;
    }
    if (closedQuote) {
      if (char === " " || char === "\t") continue;
      throw new Error(`Record ${records.length + 1}: unexpected character after a closing quote.`);
    }
    if (char === '"') {
      if (field.length)
        throw new Error(`Record ${records.length + 1}: put a field containing quotes inside double quotes.`);
      inQuotes = true;
    } else field += char;
  }
  if (inQuotes) throw new Error(`Record ${records.length + 1}: missing closing quote.`);
  if (field.length || record.length || closedQuote) endRecord();
  return records.filter((row) => row.some((value) => value.trim()));
}

export function importCardCsv(input: string): CardImportResult {
  const errors: string[] = [];
  let records: string[][];
  if (input.length > 10_000_000)
    return { rows: [], customColumns: [], errors: ["The import is too large. Use a file smaller than 10 MB."] };
  try {
    records = parseDelimitedText(input);
  } catch (error) {
    return {
      rows: [],
      customColumns: [],
      errors: [error instanceof Error ? error.message : "Could not read this table."],
    };
  }
  if (records.length < 2)
    return {
      rows: [],
      customColumns: [],
      errors: ["Include a header row and at least one card. Start with title, body, cost, category, copies."],
    };
  const headers = records[0].map((header) => {
    const trimmed = header.trim();
    const key = trimmed.toLowerCase().replace(/[ _-]/g, "");
    return (
      (Object.hasOwn(HEADER_ALIASES, key) ? HEADER_ALIASES[key] : undefined) ??
      CSV_FIELDS.find((field) => field.toLowerCase() === key) ??
      trimmed
    );
  });
  const seen = new Set<string>();
  headers.forEach((header, index) => {
    if (!header) errors.push(`Column ${index + 1} needs a header.`);
    if (seen.has(header.toLowerCase())) errors.push(`The header "${header}" appears more than once.`);
    if (["__proto__", "constructor", "prototype", "customFields"].includes(header))
      errors.push(`The header "${header}" is reserved. Rename it.`);
    seen.add(header.toLowerCase());
  });
  if (!headers.includes("title")) errors.push("A title (or name) column is required.");
  if (records.length - 1 > MAX_CARD_ROWS) errors.push(`Import at most ${MAX_CARD_ROWS} designs at a time.`);
  if (errors.length) return { rows: [], customColumns: [], errors };
  const customColumns = headers.filter((header) => !CSV_FIELDS.includes(header));
  const rows: CardStudioRow[] = records.slice(1).map((values, index) => {
    if (values.length !== headers.length)
      errors.push(
        `Row ${index + 2}: expected ${headers.length} columns, found ${values.length}. Check commas and quotes.`,
      );
    const data = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
    const copiesValue = data.copies?.trim() || "1";
    if (!/^\d+$/.test(copiesValue) || Number(copiesValue) > 99)
      errors.push(`Row ${index + 2}: copies must be a whole number from 0 to 99.`);
    return createCardRow({
      ...(data.id?.trim() ? { id: data.id.trim() } : {}),
      title: data.title ?? "",
      body: data.body ?? "",
      cost: data.cost ?? "0",
      category: data.category ?? "",
      copies: Number(copiesValue),
      artUrl: data.artUrl?.trim() ?? "",
      customFields: Object.fromEntries(customColumns.map((column) => [column, data[column]])),
    });
  });
  errors.push(...validateCardRows(rows));
  return { rows: errors.length ? [] : rows, customColumns, errors: [...new Set(errors)] };
}

export function exportCardCsv(rows: CardStudioRow[], customColumns: string[]): string {
  const headers = [...CSV_FIELDS, ...customColumns.filter((column) => !CSV_FIELDS.includes(column))];
  const escape = (value: string) => (/[",\r\n\t]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [
    headers,
    ...rows.map((row) =>
      headers.map((header) => {
        if (header === "id") return row.id;
        if (header === "copies") return String(row.copies);
        if (BASE_CARD_FIELDS.includes(header as (typeof BASE_CARD_FIELDS)[number]))
          return row[header as (typeof BASE_CARD_FIELDS)[number]];
        return row.customFields[header] ?? "";
      }),
    ),
  ]
    .map((record) => record.map(escape).join(","))
    .join("\r\n");
}
