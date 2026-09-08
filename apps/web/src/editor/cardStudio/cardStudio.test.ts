import assert from "node:assert/strict";
import { test } from "node:test";
import { exportCardCsv, importCardCsv, parseDelimitedText } from "./csv";
import {
  cardStudioFingerprint,
  createCardRow,
  createDefaultCardStudio,
  createSampleRows,
  expandCardRows,
  getPlaytestCards,
  normalizeCardStudioState,
  safeArtUrl,
} from "./model";
import { buildCardPrintHtml, renderCardSvg } from "./render";

test("CSV supports BOM, quoted commas, escaped quotes, multiline fields, and CRLF", () => {
  const result = importCardCsv(
    '\uFEFFname,body,copies,flavor\r\n"Oak, Ancient","Say ""hello"".\nThen draw two.",2,"Home, again"\r\n',
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].title, "Oak, Ancient");
  assert.equal(result.rows[0].body, 'Say "hello".\nThen draw two.');
  assert.equal(result.rows[0].copies, 2);
  assert.deepEqual(result.customColumns, ["flavor"]);
  assert.equal(result.rows[0].customFields.flavor, "Home, again");
});

test("CSV roundtrip preserves stable IDs, blank cells, zero copies, and custom fields", () => {
  const rows = [
    createCardRow({
      id: "card-stable",
      title: 'A "fine" card',
      body: "A first line\nA second line, with detail.",
      copies: 0,
      customFields: { points: "4", flavor: "" },
    }),
  ];
  const result = importCardCsv(exportCardCsv(rows, ["points", "flavor"]));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows, rows);
});

test("spreadsheet TSV and aliases import without special setup", () => {
  const result = importCardCsv(
    'Name\tDescription\tQuantity\tImage URL\tpoints\nGlowmoth\t"Fly, little moth"\t3\thttps://example.com/moth.png\t2',
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0].artUrl, "https://example.com/moth.png");
  assert.equal(result.rows[0].copies, 3);
  assert.equal(result.rows[0].body, "Fly, little moth");
});

test("malformed quotes, duplicate headers, missing titles, invalid quantities, and extra cells are rejected atomically", () => {
  for (const text of [
    'title,body\nOak,"not closed',
    'title,body\nOak,"closed"oops',
    "title,name\nOak,Elm",
    "body,copies\nJust a body,1",
    "title,copies\nOak,2.5",
    "title,copies\nOak,-1",
    "title,copies\nOak,100",
    "title,copies\nOak,2x",
    "title,body\nOak,one,two",
    "title,constructor\nOak,unsafe",
    "title,artUrl\nOak,javascript:alert(1)",
  ]) {
    const result = importCardCsv(text);
    assert.ok(result.errors.length > 0, `Should reject: ${text}`);
    assert.equal(result.rows.length, 0, "Invalid imports never partially mutate a table");
  }
  assert.deepEqual(parseDelimitedText("a,b\r\n\r\nx,y\r\n"), [
    ["a", "b"],
    ["x", "y"],
  ]);
});

test("batch expansion honors copies, omits drafts, and keeps stable card identities", () => {
  const rows = [
    createCardRow({ id: "oak", title: "Oak", copies: 2, customFields: { points: "3" } }),
    createCardRow({ id: "draft", title: "Draft", copies: 0 }),
  ];
  const cards = expandCardRows(rows);
  assert.deepEqual(
    cards.map((card) => card.id),
    ["oak:1", "oak:2"],
  );
  assert.deepEqual(
    cards.map((card) => card.copyNumber),
    [1, 2],
  );
  assert.equal(cards[0].fields.points, "3");
  assert.deepEqual(cards, expandCardRows(rows));
  cards[0].fields.points = "12";
  assert.equal(rows[0].customFields.points, "3");
});

test("batch expansion rejects invalid rows and oversized decks before allocating output", () => {
  assert.throws(() => expandCardRows([createCardRow({ title: "", copies: 1 })]), /card title/);
  assert.throws(() => expandCardRows([createCardRow({ title: "Oak", copies: 1.5 })]), /whole number/);
  assert.throws(
    () => expandCardRows(Array.from({ length: 21 }, () => createCardRow({ title: "Oak", copies: 99 }))),
    /2000 cards/,
  );
  assert.throws(
    () => expandCardRows([createCardRow({ id: "oak", title: "Oak" }), createCardRow({ id: "oak", title: "Elm" })]),
    /duplicate card ID/,
  );
});

test("playtesting reads the current table and maps explicit cost and points without inventing card rules", () => {
  const state = { ...createDefaultCardStudio(), rows: createSampleRows() };
  const cards = getPlaytestCards(state);
  assert.equal(
    cards.reduce((sum, card) => sum + card.quantity, 0),
    10,
  );
  assert.deepEqual(
    cards.map((card) => card.points),
    [1, 3, 5, 8],
  );
  assert.deepEqual(
    cards.map((card) => card.cost),
    [0, 2, 3, 5],
  );
});

test("normalization repairs untrusted configuration and generated content is derived from safe rows", () => {
  const state = { ...createDefaultCardStudio(), rows: createSampleRows() };
  const result = normalizeCardStudioState({
    ...state,
    template: { ...state.template, accent: 'red" onload="alert(1)', widthMm: 9999 },
    rows: [
      { ...state.rows[0], id: "same", artUrl: "javascript:alert(1)" },
      { ...state.rows[1], id: "same" },
    ],
  });
  assert.equal(result.template.accent, "#a46e38");
  assert.equal(result.template.widthMm, 100);
  assert.equal(result.rows[0].artUrl, "");
  assert.notEqual(result.rows[0].id, result.rows[1].id);
  const withCache = normalizeCardStudioState({
    ...state,
    generated: {
      generatedAt: "2026-09-07",
      sourceFingerprint: cardStudioFingerprint(state),
      cards: [{ malicious: true }],
    },
  });
  assert.equal(withCache.generated?.cards.length, 10);
  assert.equal(withCache.generated?.cards[0].sourceRowId, state.rows[0].id);
  assert.equal(Object.hasOwn(withCache.generated?.cards[0] ?? {}, "artUrl"), false);
});

test("SVG template bindings and print pages use the displayed artwork safely", () => {
  const state = createDefaultCardStudio();
  state.rows = [
    createCardRow({
      title: "Oak <script>alert(1)</script>",
      body: "<img src=x onerror=alert(1)>",
      copies: 10,
      customFields: { flavor: "A custom title" },
    }),
  ];
  state.template.titleField = "flavor";
  const svg = renderCardSvg(state.rows[0], state.template);
  assert.match(svg, /A custom title/);
  assert.ok(!svg.includes("<img src=x"));
  assert.match(svg, /&lt;img/);
  const html = buildCardPrintHtml(state, "Game </title><script>bad()</script>");
  assert.equal((html.match(/class="sheet"/g) ?? []).length, 2);
  assert.equal((html.match(/class="card"/g) ?? []).length, 10);
  assert.ok(html.includes(svg));
  assert.ok(!html.includes("<script>bad()"));
  assert.match(html, /width:63mm;height:88mm/);
  assert.match(html, /size:A4/);
  assert.match(buildCardPrintHtml(state, "Game", "letter"), /size:letter/);
});

test("art URLs accept browser-safe images and reject executable or local paths", () => {
  assert.equal(safeArtUrl('data:image/svg+xml,<svg onload="bad()"/>'), "");
  assert.equal(safeArtUrl("file:///etc/passwd"), "");
  assert.equal(safeArtUrl("https://user:password@example.com/a.png"), "");
  assert.equal(safeArtUrl("data:image/png;base64,YQ=="), "data:image/png;base64,YQ==");
  assert.equal(safeArtUrl("https://example.com/card.png"), "https://example.com/card.png");
});

test("print sheets embed shared artwork once across every copy", () => {
  const state = createDefaultCardStudio();
  const artUrl = "data:image/png;base64,YQ==";
  state.rows = [createCardRow({ title: "Art card", artUrl, copies: 99 })];
  const html = buildCardPrintHtml(state, "Shared artwork");
  assert.equal(html.split(artUrl).length - 1, 1);
  assert.equal((html.match(/<use href="#card-art-0"/g) ?? []).length, 99);
  assert.match(html, /\.card > svg\{/);
});
