import type { ComponentDesignDocument, TemplateRenderOptions, TemplateTrimShape } from "./types";
import { normalizeTemplateDocument } from "./model";
import { escapeTemplateMarkup as escape } from "./safety";
import { renderTemplateLayer } from "./renderLayers";

export function templateTrimMarkup(
  shape: TemplateTrimShape,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): string {
  if (shape === "ellipse")
    return `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}"/>`;
  if (shape === "hexagon")
    return `<polygon points="${x + width * 0.25},${y} ${x + width * 0.75},${y} ${x + width},${y + height / 2} ${x + width * 0.75},${y + height} ${x + width * 0.25},${y + height} ${x},${y + height / 2}"/>`;
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${Math.max(0, radius)}"/>`;
}

function prefixFor(document: ComponentDesignDocument, faceId: string): string {
  const layout = JSON.stringify([
    document.widthMm,
    document.heightMm,
    faceId,
    document.faces.map((face) =>
      face.layers.map((layer) => [
        layer.id,
        layer.x,
        layer.y,
        layer.width,
        layer.height,
        layer.type === "image" ? layer.radius : 0,
      ]),
    ),
  ]);
  let hash = 2166136261;
  for (let index = 0; index < layout.length; index += 1)
    hash = Math.imul(hash ^ layout.charCodeAt(index), 16777619);
  return `design-${(hash >>> 0).toString(36)}`;
}

export function renderDesignSvg(value: ComponentDesignDocument, options: TemplateRenderOptions = {}): string {
  const document = normalizeTemplateDocument(value);
  const face = document.faces.find((item) => item.id === options.faceId) ?? document.faces[0];
  const prefix = (options.idPrefix || prefixFor(document, face.id)).replace(/[^a-zA-Z0-9_-]/g, "_");
  const { widthMm: w, heightMm: h } = document;
  const bleed = options.includeBleed ? document.bleedMm : 0;
  const clip = templateTrimMarkup(
    document.trimShape,
    -bleed,
    -bleed,
    w + bleed * 2,
    h + bleed * 2,
    document.cornerRadiusMm + bleed,
  );
  const safe = Math.min(document.safeMm, Math.min(w, h) / 2 - 0.01);
  const trim = templateTrimMarkup(document.trimShape, 0, 0, w, h, document.cornerRadiusMm);
  const safeShape = templateTrimMarkup(
    document.trimShape,
    safe,
    safe,
    Math.max(0.01, w - 2 * safe),
    Math.max(0.01, h - 2 * safe),
    Math.max(0, document.cornerRadiusMm - safe),
  );
  const guides = options.showGuides
    ? `<g data-template-guides="true" pointer-events="none"><rect x="0" y="0" width="${w}" height="${h}" fill="url(#${prefix}-grid)"/><g fill="none" stroke="#bf7149" stroke-width=".2" stroke-dasharray="1.2 .8">${trim}</g><g fill="none" stroke="#4b9278" stroke-width=".2" stroke-dasharray="1 .7">${safeShape}</g></g>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w + bleed * 2}mm" height="${h + bleed * 2}mm" viewBox="${-bleed} ${-bleed} ${w + bleed * 2} ${h + bleed * 2}" font-weight="400" font-style="normal" letter-spacing="normal" role="img" aria-label="${escape(face.name)} design" data-template-face="${escape(face.id)}"><title>${escape(face.name)} design</title><defs><clipPath id="${prefix}-trim" clipPathUnits="userSpaceOnUse">${clip}</clipPath>${options.showGuides ? `<pattern id="${prefix}-grid" width="${document.gridMm}" height="${document.gridMm}" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".12" fill="#587761" opacity=".35"/></pattern>` : ""}</defs><g clip-path="url(#${prefix}-trim)"><rect x="${-bleed}" y="${-bleed}" width="${w + bleed * 2}" height="${h + bleed * 2}" fill="${escape(face.background)}"/>${face.layers.map((layer, index) => renderTemplateLayer(layer, options.data ?? {}, `${prefix}-layer-${index}`)).join("")}${guides}</g></svg>`;
}
