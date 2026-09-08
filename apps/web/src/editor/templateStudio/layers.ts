import type { ComponentDesignDocument, TemplateLayer, TemplateLayerBase, TemplateLayerType } from "./types";

export function templateLayerDefaults(
  type: TemplateLayerType,
  document: Pick<ComponentDesignDocument, "widthMm" | "heightMm">,
  id: string,
): TemplateLayer {
  const width = Math.max(1, document.widthMm * 0.55);
  const height = Math.max(1, document.heightMm * (type === "text" || type === "track" ? 0.16 : 0.4));
  const base: TemplateLayerBase = {
    id,
    name: { text: "Text", image: "Artwork", shape: "Shape", grid: "Play spaces", track: "Score track" }[type],
    type,
    x: document.widthMm * 0.12,
    y: document.heightMm * 0.12,
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fill: type === "text" ? "#193e31" : type === "image" ? "none" : "#e9eedc",
    stroke: type === "text" || type === "image" ? "none" : "#8eaa74",
    strokeWidth: 0.3,
  };
  switch (type) {
    case "text":
      return {
        ...base,
        type,
        content: "Your text",
        fontFamily: "serif",
        fontSize: Math.max(7, Math.min(24, document.widthMm / 6)),
        fontWeight: "normal",
        italic: false,
        align: "left",
        verticalAlign: "top",
        lineHeight: 1.25,
        autoFit: "shrink",
      };
    case "image":
      return { ...base, type, source: "{{artUrl}}", fit: "cover", radius: 0 };
    case "shape":
      return {
        ...base,
        type,
        shape: "rectangle",
        radius: 1.5,
        points: "50,0 100,100 0,100",
        pathData: "M0 100 Q50 0 100 100 Z",
      };
    case "grid":
      return { ...base, type, rows: 5, columns: 5, gridType: "square", gap: 1, labels: true, startAt: 1 };
    case "track":
      return { ...base, type, trackShape: "linear", spaces: 10, labels: true, startAt: 0 };
  }
}
