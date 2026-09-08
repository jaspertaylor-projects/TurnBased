import type { CardStudioRow, CardTemplate } from "../cardStudio/types";
import type {
  ComponentDesignDocument,
  TemplateComponentKind,
  TemplateFace,
  TemplateLayer,
  TemplateLayerType,
} from "./types";
import { buildCardPreset, buildTemplatePreset } from "./presets";
import { templateLayerDefaults } from "./layers";
import {
  safeTemplateColor,
  safeTemplateImage,
  safeTemplatePath,
  safeTemplatePoints,
  templateNumber as number,
  templateString as string,
} from "./safety";
export { resolveTemplateText } from "./safety";

export const MAX_TEMPLATE_LAYERS = 300;
export const MAX_TEMPLATE_FACES = 100;

export function createTemplateDocument(
  kind: TemplateComponentKind,
  preset?: string,
): ComponentDesignDocument {
  return normalizeTemplateDocument(buildTemplatePreset(kind, preset));
}

export function createTemplateLayer(
  type: TemplateLayerType,
  document: ComponentDesignDocument,
): TemplateLayer {
  return templateLayerDefaults(type, document, crypto.randomUUID());
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function choice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? (value as T) : fallback;
}

function uniqueId(value: unknown, fallback: string, used: Set<string>): string {
  const base = typeof value === "string" && value.trim() ? value : fallback;
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

export function normalizeTemplateDocument(
  value: unknown,
  fallback?: { widthMm: number; heightMm: number },
): ComponentDesignDocument {
  const source = record(value);
  const widthMm = number(source.widthMm, number(fallback?.widthMm, 63, 1, 2000), 1, 2000);
  const heightMm = number(source.heightMm, number(fallback?.heightMm, 88, 1, 2000), 1, 2000);
  const minor = Math.min(widthMm, heightMm);
  const document: ComponentDesignDocument = {
    schemaVersion: 1,
    widthMm,
    heightMm,
    trimShape: choice(source.trimShape, ["rectangle", "ellipse", "hexagon"], "rectangle"),
    cornerRadiusMm: number(source.cornerRadiusMm, 2.5, 0, minor / 2),
    bleedMm: number(source.bleedMm, 3, 0, 30),
    safeMm: number(source.safeMm, 3, 0, minor / 2),
    gridMm: number(source.gridMm, 1, 0.1, 100),
    snapToGrid: source.snapToGrid !== false,
    faces: [],
  };
  const faceIds = new Set<string>();
  const layerIds = new Set<string>();
  const faces =
    Array.isArray(source.faces) && source.faces.length
      ? source.faces.slice(0, MAX_TEMPLATE_FACES)
      : [{ id: "front", name: "Front", background: "#fbf3dd", layers: [] }];
  document.faces = faces.map((raw, faceIndex): TemplateFace => {
    const face = record(raw);
    return {
      id: uniqueId(face.id, `face-${faceIndex + 1}`, faceIds),
      name: string(face.name, faceIndex === 0 ? "Front" : `Face ${faceIndex + 1}`),
      background: safeTemplateColor(face.background, "#fbf3dd"),
      layers: (Array.isArray(face.layers) ? face.layers : [])
        .slice(0, MAX_TEMPLATE_LAYERS)
        .map((rawLayer, index): TemplateLayer => {
          const layer = record(rawLayer);
          const type = choice(layer.type, ["text", "image", "shape", "grid", "track"], "shape");
          const defaults = templateLayerDefaults(type, document, "");
          const base = {
            id: uniqueId(layer.id, `${faceIds.size}-layer-${index + 1}`, layerIds),
            name: string(layer.name, defaults.name),
            x: number(layer.x, defaults.x, -4000, 4000),
            y: number(layer.y, defaults.y, -4000, 4000),
            width: number(layer.width, defaults.width, 0.1, 4000),
            height: number(layer.height, defaults.height, 0.1, 4000),
            rotation: number(layer.rotation, 0, -36000, 36000),
            opacity: number(layer.opacity, 1, 0, 1),
            visible: layer.visible !== false,
            locked: layer.locked === true,
            fill: safeTemplateColor(layer.fill, defaults.fill),
            stroke: safeTemplateColor(layer.stroke, defaults.stroke),
            strokeWidth: number(layer.strokeWidth, 0.3, 0, 100),
          };
          if (type === "text")
            return {
              ...base,
              type,
              content: string(layer.content, "Your text").slice(0, 30_000),
              fontFamily: choice(layer.fontFamily, ["serif", "sans", "mono"], "serif"),
              fontSize: number(layer.fontSize, 12, 1, 500),
              fontWeight: choice(layer.fontWeight, ["normal", "bold"], "normal"),
              italic: layer.italic === true,
              align: choice(layer.align, ["left", "center", "right"], "left"),
              verticalAlign: choice(layer.verticalAlign, ["top", "middle", "bottom"], "top"),
              lineHeight: number(layer.lineHeight, 1.25, 0.5, 4),
              autoFit: choice(layer.autoFit, ["shrink", "clip"], "shrink"),
            };
          if (type === "image") {
            const image = string(layer.source);
            return {
              ...base,
              type,
              source: image.includes("{{") ? image : safeTemplateImage(image),
              fit: choice(layer.fit, ["cover", "contain", "stretch"], "cover"),
              radius: number(layer.radius, 0, 0, Math.min(base.width, base.height) / 2),
            };
          }
          if (type === "shape")
            return {
              ...base,
              type,
              shape: choice(layer.shape, ["rectangle", "ellipse", "line", "polygon", "path"], "rectangle"),
              radius: number(layer.radius, 0, 0, Math.min(base.width, base.height) / 2),
              points: safeTemplatePoints(layer.points),
              pathData: safeTemplatePath(layer.pathData),
            };
          if (type === "grid")
            return {
              ...base,
              type,
              gridType: choice(layer.gridType, ["square", "hex"], "square"),
              rows: Math.round(number(layer.rows, 5, 1, 40)),
              columns: Math.round(number(layer.columns, 5, 1, 40)),
              gap: number(layer.gap, 1, 0, 100),
              labels: layer.labels !== false,
              startAt: Math.round(number(layer.startAt, 1, -99999, 99999)),
            };
          return {
            ...base,
            type,
            trackShape: choice(layer.trackShape, ["linear", "ring"], "linear"),
            spaces: Math.round(number(layer.spaces, 10, 2, 100)),
            labels: layer.labels !== false,
            startAt: Math.round(number(layer.startAt, 0, -99999, 99999)),
          };
        }),
    };
  });
  return document;
}

export function migrateCardTemplate(template: CardTemplate): ComponentDesignDocument {
  return normalizeTemplateDocument(template.document ?? buildCardPreset(template), template);
}

export function rowTemplateData(row: CardStudioRow): Record<string, string> {
  return {
    ...row.customFields,
    id: row.id,
    title: row.title,
    name: row.title,
    body: row.body,
    cost: row.cost,
    category: row.category,
    copies: String(row.copies),
    artUrl: row.artUrl,
  };
}
