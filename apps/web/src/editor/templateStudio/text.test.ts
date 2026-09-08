import assert from "node:assert/strict";
import test from "node:test";
import { createTemplateDocument, createTemplateLayer } from "./model";
import { layoutTemplateText } from "./text";
import { templateTextWidthEm, wrapTemplateText } from "./textMetrics";
import type { TemplateTextLayer } from "./types";

function textLayer(values: Partial<TemplateTextLayer> = {}): TemplateTextLayer {
  return {
    ...createTemplateLayer("text", createTemplateDocument("card")),
    width: 50,
    height: 12,
    fontSize: 12,
    ...values,
  } as TemplateTextLayer;
}

test("wide capitals wrap to their physical width instead of silently clipping", () => {
  const layer = textLayer();
  const content = "W".repeat(20);
  const result = layoutTemplateText(layer, content);
  assert.ok(result.lines.length > 1);
  assert.equal(result.lines.join(""), content);
  assert.equal(result.overflow, false);
  for (const line of result.lines)
    assert.ok(
      templateTextWidthEm(line, layer) * result.sizeMm + 2 * result.inset <=
        layer.width,
    );
});

test("long unbroken words fit narrow boxes while retaining every character", () => {
  for (const fontFamily of ["serif", "sans", "mono"] as const) {
    const layer = textLayer({
      width: 13,
      height: 15,
      fontFamily,
      fontWeight: "bold",
      italic: true,
    });
    const content = "WWinterWoodlandWithoutAnySpaces";
    const result = layoutTemplateText(layer, content);
    assert.equal(result.lines.join(""), content);
    assert.equal(result.overflow, false);
    assert.ok(result.fontSizePt < layer.fontSize);
    for (const line of result.lines)
      assert.ok(
        templateTextWidthEm(line, layer) * result.sizeMm + 2 * result.inset <=
          layer.width + 0.001,
      );
  }
});

test("combining accents and joined emoji remain intact across wrapping", () => {
  const layer = textLayer();
  assert.equal(
    templateTextWidthEm("e\u0301", layer),
    templateTextWidthEm("e", layer),
  );
  assert.equal(
    templateTextWidthEm("é", layer),
    templateTextWidthEm("e", layer),
  );
  assert.deepEqual(wrapTemplateText("e\u0301e\u0301", 0.8, layer), [
    "e\u0301",
    "e\u0301",
  ]);
  assert.deepEqual(wrapTemplateText("👩‍🎨👩‍🎨", 1.3, layer), ["👩‍🎨", "👩‍🎨"]);
  assert.ok(templateTextWidthEm("森", layer) > templateTextWidthEm("W", layer));
  assert.deepEqual(wrapTemplateText("森の\r\n小道", 5, layer), [
    "森の",
    "小道",
  ]);
});

test("clip mode reports horizontal overflow and short line-height preserves descent", () => {
  const narrow = textLayer({ width: 0.5, height: 20, autoFit: "clip" });
  assert.equal(layoutTemplateText(narrow, "W").overflow, true);
  const short = textLayer({ height: 3, lineHeight: 0.5, autoFit: "clip" });
  assert.equal(layoutTemplateText(short, "gy").overflow, true);
  assert.equal(
    layoutTemplateText({ ...short, autoFit: "shrink" }, "gy").overflow,
    false,
  );
});
