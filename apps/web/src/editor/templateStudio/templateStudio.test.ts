import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cardStudioFingerprint,
  createCardRow,
  createDefaultCardStudio,
  normalizeCardStudioState,
} from "../cardStudio/model";
import { renderCardSvg } from "../cardStudio/render";
import {
  createTemplateDocument,
  createTemplateLayer,
  migrateCardTemplate,
  normalizeTemplateDocument,
  resolveTemplateText,
  rowTemplateData,
} from "./model";
import { renderDesignSvg } from "./render";
import type { TemplateComponentKind } from "./types";

test("every component starts with deterministic, editable front and back artwork", () => {
  for (const kind of ["card", "board", "token", "tile", "mat", "piece"] as TemplateComponentKind[]) {
    const doc = createTemplateDocument(kind);
    assert.deepEqual(doc, createTemplateDocument(kind));
    assert.equal(doc.faces.length, 2);
    assert.ok(doc.faces[0].layers.length > 0);
    assert.ok(doc.faces[0].layers.every((layer) => !layer.locked));
    assert.deepEqual(normalizeTemplateDocument(doc), doc);
    assert.equal(
      new Set(doc.faces.flatMap((face) => face.layers.map((layer) => layer.id))).size,
      doc.faces.flatMap((face) => face.layers).length,
    );
  }
});

test("normalization repairs IDs and unsafe content deterministically without changing physical board or token sizes", () => {
  const document = createTemplateDocument("board");
  const layer = document.faces[0].layers[0];
  const raw = {
    ...document,
    faces: [
      {
        id: "front",
        name: "Front",
        background: "url(https://bad.test)",
        layers: [
          { ...layer, id: "same", opacity: Infinity, fill: 'red" onload="bad()' },
          { ...layer, id: "same" },
          { type: "image", source: "javascript:alert(1)" },
        ],
      },
    ],
  };
  const normalized = normalizeTemplateDocument(raw);
  assert.deepEqual(normalized, normalizeTemplateDocument(raw));
  assert.deepEqual(normalized, normalizeTemplateDocument(normalized));
  const tiny = normalizeTemplateDocument({ widthMm: 1, heightMm: 1 });
  assert.deepEqual(tiny, normalizeTemplateDocument(tiny));
  assert.equal(tiny.safeMm, 0.5);
  assert.equal(normalized.widthMm, 300);
  assert.equal(normalized.faces[0].layers[1].id, "same-2");
  assert.equal(normalized.faces[0].background, "#fbf3dd");
  assert.equal(normalized.faces[0].layers[0].opacity, 1);
  const image = normalized.faces[0].layers[2];
  assert.equal(image.type === "image" && image.source, "");
  const state = createDefaultCardStudio();
  state.template.document = createTemplateDocument("token");
  assert.equal(normalizeCardStudioState(state).template.widthMm, 32);
  state.template.document = document;
  assert.equal(normalizeCardStudioState(state).template.widthMm, 300);
});

test("legacy card templates keep their renderer until explicitly migrated", () => {
  const state = createDefaultCardStudio();
  const row = createCardRow({ title: "Old familiar oak", body: "Keep this card unchanged.", copies: 3 });
  const legacySvg = renderCardSvg(row, state.template);
  assert.match(legacySvg, /viewBox="0 0 315 440"/);
  assert.equal(renderCardSvg(row, normalizeCardStudioState(state).template), legacySvg);
  const document = migrateCardTemplate(state.template);
  assert.deepEqual(document, migrateCardTemplate(state.template));
  assert.equal(document.faces[0].layers.find((layer) => layer.id === "card-title")?.type, "text");
  const title = document.faces[0].layers.find((layer) => layer.id === "card-title");
  assert.equal(title?.type === "text" && title.content, "{{title}}");
  assert.match(renderCardSvg(row, { ...state.template, document }), /data-layer-id="card-title"/);
  assert.deepEqual(migrateCardTemplate({ ...state.template, document }), normalizeTemplateDocument(document));
});

test("SVG honors layer transforms, array order, visibility, and physical dimensions", () => {
  const document = createTemplateDocument("token");
  const lower = createTemplateLayer("shape", document);
  const upper = createTemplateLayer("text", document);
  document.faces[0].layers = [
    { ...lower, id: "lower", x: 5, y: 7, width: 20, height: 12, rotation: 45 },
    { ...upper, id: "upper" },
    { ...lower, id: "hidden", visible: false },
  ];
  const svg = renderDesignSvg(document, { idPrefix: "proof" });
  assert.match(svg, /width="32mm" height="32mm" viewBox="0 0 32 32"/);
  assert.match(svg, /translate\(5 7\) rotate\(45 10 6\)/);
  assert.ok(svg.indexOf('data-layer-id="lower"') < svg.indexOf('data-layer-id="upper"'));
  assert.ok(!svg.includes('data-layer-id="hidden"'));
  assert.match(svg, /clipPath id="proof-trim"/);
  assert.match(svg, /<ellipse/);
});

test("bindings are data substitutions, with no inherited properties or executable markup", () => {
  assert.equal(
    resolveTemplateText("{{ title }} costs {{cost}}. {{missing}}", { title: "Oak", cost: "2" }),
    "Oak costs 2. ",
  );
  assert.equal(resolveTemplateText("{{constructor}} {{toString}}", {}), " ");
  const row = createCardRow({
    title: "Oak",
    customFields: { points: "4", title: "Cannot replace base title" },
  });
  assert.equal(rowTemplateData(row).title, "Oak");
  assert.equal(rowTemplateData(row).points, "4");
  const document = createTemplateDocument("card");
  document.faces[0].layers = [
    {
      ...createTemplateLayer("text", document),
      type: "text",
      content: "{{title}} <script>bad()</script>",
    } as ReturnType<typeof createTemplateLayer>,
    { ...createTemplateLayer("image", document), type: "image", source: "{{artUrl}}" } as ReturnType<
      typeof createTemplateLayer
    >,
  ];
  const svg = renderDesignSvg(document, {
    data: { title: "<img src=x onerror=bad()>", artUrl: "javascript:alert(1)" },
  });
  assert.ok(!svg.includes("<script>"));
  assert.ok(!svg.includes("<img "));
  assert.ok(!svg.includes("javascript:"));
  assert.match(svg, /&lt;script&gt;/);
});

test("front/back selection and bleed dimensions never expose editing guides in production exports", () => {
  const document = createTemplateDocument("card");
  const front = renderDesignSvg(document, { faceId: "front", data: { title: "FRONT ONLY" } });
  const back = renderDesignSvg(document, { faceId: "back", includeBleed: true });
  assert.match(front, /FRONT ONLY/);
  assert.ok(!back.includes("FRONT ONLY"));
  assert.match(back, /data-template-face="back"/);
  assert.match(back, /width="69mm" height="94mm" viewBox="-3 -3 69 94"/);
  assert.ok(!back.includes("data-template-guides"));
  assert.match(renderDesignSvg(document, { showGuides: true }), /data-template-guides="true"/);
  const dice = normalizeTemplateDocument({
    ...document,
    faces: Array.from({ length: 20 }, (_, index) => ({
      id: `face-${index + 1}`,
      name: `Face ${index + 1}`,
      background: "#ffffff",
      layers: [],
    })),
  });
  assert.equal(dice.faces.length, 20);
  assert.match(renderDesignSvg(dice, { faceId: "face-20" }), /data-template-face="face-20"/);
});

test("square/hex grids and ring/linear tracks have editable counts and numbered spaces", () => {
  const document = createTemplateDocument("board");
  document.faces[0].layers = [
    {
      ...createTemplateLayer("grid", document),
      type: "grid",
      rows: 2,
      columns: 3,
      startAt: 7,
      gridType: "hex",
    } as ReturnType<typeof createTemplateLayer>,
    {
      ...createTemplateLayer("track", document),
      type: "track",
      spaces: 5,
      trackShape: "ring",
      startAt: 20,
    } as ReturnType<typeof createTemplateLayer>,
  ];
  const svg = renderDesignSvg(document);
  assert.equal((svg.match(/data-cell-index=/g) ?? []).length, 6);
  assert.equal((svg.match(/data-space-index=/g) ?? []).length, 5);
  assert.match(svg, />12<\/text>/);
  assert.match(svg, />24<\/text>/);
});

test("nested artwork fingerprints survive JSON key reordering and change when a layer moves", () => {
  const state = createDefaultCardStudio();
  state.template.document = createTemplateDocument("card");
  const reorder = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(reorder)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .reverse()
              .map(([key, entry]) => [key, reorder(entry)]),
          )
        : value;
  const reordered = reorder(state) as typeof state;
  assert.equal(cardStudioFingerprint(state), cardStudioFingerprint(reordered));
  reordered.template.document!.faces[0].layers[0].x += 1;
  assert.notEqual(cardStudioFingerprint(state), cardStudioFingerprint(reordered));
});
