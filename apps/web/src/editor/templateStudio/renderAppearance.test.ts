import assert from "node:assert/strict";
import test from "node:test";
import { createTemplateDocument, createTemplateLayer } from "./model";
import { renderDesignSvg } from "./render";
import { layoutTemplateText } from "./text";
import type { TemplateTextLayer } from "./types";

test("text appearance stroke is painted behind its fill and included in fitting", () => {
  const document = createTemplateDocument("card");
  const layer = {
    ...createTemplateLayer("text", document),
    content: "Woodland",
    stroke: "#af7843",
    strokeWidth: 1.2,
  } as TemplateTextLayer;
  document.faces[0].layers = [layer];
  const svg = renderDesignSvg(document);
  assert.match(
    svg,
    /<text[^>]*stroke="#af7843"[^>]*stroke-width="1.2"[^>]*paint-order="stroke fill"/,
  );
  const layout = layoutTemplateText(layer, layer.content);
  assert.ok(layout.inset >= layer.strokeWidth / 2);
  assert.equal(layout.overflow, false);
});

test("uploaded image border is inset and painted above opaque artwork", () => {
  const document = createTemplateDocument("card");
  document.faces[0].layers = [
    {
      ...createTemplateLayer("image", document),
      type: "image",
      width: 30,
      height: 20,
      source: "https://example.com/art.png",
      fit: "cover",
      radius: 3,
      stroke: "#af7843",
      strokeWidth: 2,
    },
  ];
  const svg = renderDesignSvg(document);
  assert.ok(svg.indexOf('data-image-border="true"') > svg.indexOf("<image "));
  assert.match(
    svg,
    /data-image-border="true" x="1" y="1" width="28" height="18" rx="2" fill="none"/,
  );
});
