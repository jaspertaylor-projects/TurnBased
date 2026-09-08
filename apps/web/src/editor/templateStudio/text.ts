import type { TemplateTextLayer } from "./types";
import { escapeTemplateMarkup } from "./safety";
import { templateTextWidthEm, wrapTemplateText } from "./textMetrics";

export function layoutTemplateText(layer: TemplateTextLayer, content: string) {
  let sizeMm = (layer.fontSize * 25.4) / 72;
  const insetEm = layer.italic ? 0.15 : 0.04;
  const strokeInset =
    layer.stroke === "none" || layer.stroke === "transparent"
      ? 0
      : layer.strokeWidth / 2;
  const inset = () => Math.max(insetEm * sizeMm, strokeInset);
  const wrap = () =>
    wrapTemplateText(content, (layer.width - 2 * inset()) / sizeMm, layer);
  let lines = wrap();
  const height = () =>
    sizeMm * (1.25 + Math.max(0, lines.length - 1) * layer.lineHeight) +
    2 * strokeInset;
  const width = () =>
    Math.max(0, ...lines.map((line) => templateTextWidthEm(line, layer))) *
      sizeMm +
    2 * inset();
  const overflows = () =>
    height() > layer.height + 0.001 || width() > layer.width + 0.001;
  if (layer.autoFit === "shrink") {
    for (let step = 0; step < 100 && overflows() && sizeMm > 0.15; step += 1) {
      sizeMm *= 0.95;
      lines = wrap();
    }
  }
  const blockHeight = height();
  const y =
    layer.verticalAlign === "middle"
      ? Math.max(0, (layer.height - blockHeight) / 2)
      : layer.verticalAlign === "bottom"
        ? Math.max(0, layer.height - blockHeight)
        : 0;
  return {
    lines,
    sizeMm,
    fontSizePt: (sizeMm * 72) / 25.4,
    y,
    inset: inset(),
    strokeInset,
    overflow: overflows(),
  };
}

export function renderTemplateText(
  layer: TemplateTextLayer,
  content: string,
): string {
  const layout = layoutTemplateText(layer, content);
  const x =
    layer.align === "center"
      ? layer.width / 2
      : layer.align === "right"
        ? layer.width - layout.inset
        : layout.inset;
  const font =
    layer.fontFamily === "serif"
      ? "Georgia, serif"
      : layer.fontFamily === "mono"
        ? "monospace"
        : "Arial, sans-serif";
  const anchor =
    layer.align === "center"
      ? "middle"
      : layer.align === "right"
        ? "end"
        : "start";
  return `<text x="${x}" y="${layout.y + layout.sizeMm + layout.strokeInset}" fill="${escapeTemplateMarkup(layer.fill)}" stroke="${escapeTemplateMarkup(layer.stroke)}" stroke-width="${layer.strokeWidth}" paint-order="stroke fill" font-family="${font}" font-size="${layout.sizeMm}" font-weight="${layer.fontWeight}" font-style="${layer.italic ? "italic" : "normal"}" text-anchor="${anchor}">${layout.lines.map((line, index) => `<tspan x="${x}" dy="${index ? layout.sizeMm * layer.lineHeight : 0}">${escapeTemplateMarkup(line)}</tspan>`).join("")}</text>`;
}
