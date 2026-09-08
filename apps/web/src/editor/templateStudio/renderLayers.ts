import type {
  TemplateGridLayer,
  TemplateLayer,
  TemplateShapeLayer,
  TemplateTrackLayer,
} from "./types";
import {
  escapeTemplateMarkup as escape,
  resolveTemplateText,
  safeTemplateImage,
} from "./safety";
import { renderTemplateText } from "./text";

function renderShape(layer: TemplateShapeLayer): string {
  const { width: w, height: h } = layer;
  if (layer.shape === "ellipse")
    return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}"/>`;
  if (layer.shape === "line")
    return `<line x1="0" y1="0" x2="${w}" y2="${h}"/>`;
  if (layer.shape === "polygon") {
    const values = layer.points
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const points: string[] = [];
    for (let index = 0; index + 1 < values.length; index += 2) {
      if (Number.isFinite(values[index]) && Number.isFinite(values[index + 1]))
        points.push(
          `${(values[index] * w) / 100},${(values[index + 1] * h) / 100}`,
        );
    }
    return `<polygon points="${points.join(" ")}"/>`;
  }
  if (layer.shape === "path")
    return `<path d="${escape(layer.pathData)}" transform="scale(${w / 100} ${h / 100})" stroke-width="${layer.strokeWidth / Math.max(0.001, Math.sqrt(w * h) / 100)}"/>`;
  return `<rect width="${w}" height="${h}" rx="${layer.radius}"/>`;
}

function cellLabel(
  value: number,
  x: number,
  y: number,
  size: number,
  color: string,
): string {
  return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" fill="${escape(color)}" stroke="none" font-family="Arial, sans-serif" font-size="${Math.max(0.05, size)}">${value}</text>`;
}

function renderGrid(layer: TemplateGridLayer): string {
  const width = layer.width / layer.columns;
  const height = layer.height / layer.rows;
  const gap = Math.min(layer.gap, width * 0.8, height * 0.8);
  return Array.from({ length: layer.rows * layer.columns }, (_, index) => {
    const row = Math.floor(index / layer.columns);
    const column = index % layer.columns;
    const x = column * width + gap / 2;
    const y = row * height + gap / 2;
    const w = width - gap;
    const h = height - gap;
    const shape =
      layer.gridType === "hex"
        ? `<polygon points="${x + w * 0.25},${y} ${x + w * 0.75},${y} ${x + w},${y + h / 2} ${x + w * 0.75},${y + h} ${x + w * 0.25},${y + h} ${x},${y + h / 2}"/>`
        : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(1.4, w * 0.05)}"/>`;
    return `<g data-cell-index="${index}">${shape}${layer.labels ? cellLabel(layer.startAt + index, x + w / 2, y + h / 2, Math.min(w, h) * 0.22, layer.stroke === "none" ? "#193e31" : layer.stroke) : ""}</g>`;
  }).join("");
}

function renderTrack(layer: TemplateTrackLayer): string {
  return Array.from({ length: layer.spaces }, (_, index) => {
    let x: number;
    let y: number;
    let w: number;
    let h: number;
    if (layer.trackShape === "ring") {
      const diameter = Math.max(
        0.3,
        Math.min(layer.width, layer.height) /
          Math.max(3, layer.spaces / Math.PI + 1),
      );
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / layer.spaces;
      w = diameter;
      h = diameter;
      x =
        layer.width / 2 +
        (Math.cos(angle) * (layer.width - diameter)) / 2 -
        diameter / 2;
      y =
        layer.height / 2 +
        (Math.sin(angle) * (layer.height - diameter)) / 2 -
        diameter / 2;
    } else {
      const step = layer.width / layer.spaces;
      w = Math.max(0.001, step * 0.88);
      h = layer.height;
      x = index * step + step * 0.06;
      y = 0;
    }
    return `<g data-space-index="${index}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${layer.trackShape === "ring" ? w / 2 : Math.min(w, h) * 0.15}"/>${layer.labels ? cellLabel(layer.startAt + index, x + w / 2, y + h / 2, Math.min(w, h) * 0.35, layer.stroke === "none" ? "#193e31" : layer.stroke) : ""}</g>`;
  }).join("");
}

export function renderTemplateLayer(
  layer: TemplateLayer,
  data: Record<string, string>,
  prefix: string,
): string {
  if (!layer.visible) return "";
  let content = "";
  if (layer.type === "text")
    content = renderTemplateText(
      layer,
      resolveTemplateText(layer.content, data),
    );
  if (layer.type === "shape") content = renderShape(layer);
  if (layer.type === "grid") content = renderGrid(layer);
  if (layer.type === "track") content = renderTrack(layer);
  if (layer.type === "image") {
    const source = safeTemplateImage(resolveTemplateText(layer.source, data));
    const fit =
      layer.fit === "cover"
        ? "xMidYMid slice"
        : layer.fit === "contain"
          ? "xMidYMid meet"
          : "none";
    const inset = Math.min(
      layer.strokeWidth / 2,
      layer.width / 2,
      layer.height / 2,
    );
    const border =
      layer.stroke !== "none" && layer.strokeWidth > 0
        ? `<rect data-image-border="true" x="${inset}" y="${inset}" width="${Math.max(0.001, layer.width - inset * 2)}" height="${Math.max(0.001, layer.height - inset * 2)}" rx="${Math.max(0, layer.radius - inset)}" fill="none"/>`
        : "";
    content = `<rect width="${layer.width}" height="${layer.height}" rx="${layer.radius}" stroke="none"/>${source ? `<image href="${escape(source)}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="${fit}"/>` : ""}${border}`;
  }
  const clipId = `${prefix}-bounds`;
  const rounded = layer.type === "image" ? layer.radius : 0;
  const clip = layer.type === "image" || layer.type === "text";
  return `<g data-layer-id="${escape(layer.id)}" data-layer-type="${layer.type}" data-layer-locked="${layer.locked}" transform="translate(${layer.x} ${layer.y}) rotate(${layer.rotation} ${layer.width / 2} ${layer.height / 2})" opacity="${layer.opacity}" fill="${escape(layer.fill)}" stroke="${escape(layer.stroke)}" stroke-width="${layer.strokeWidth}">${clip ? `<defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><rect width="${layer.width}" height="${layer.height}" rx="${rounded}"/></clipPath></defs><g clip-path="url(#${clipId})">${content}</g>` : content}</g>`;
}
