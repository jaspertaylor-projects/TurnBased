import { expandCardRows, getCardField, safeArtUrl } from "./model";
import type { CardStudioRow, CardStudioState, CardTemplate } from "./types";
import { renderDesignSvg } from "../templateStudio/render";
import { rowTemplateData, resolveTemplateText } from "../templateStudio/model";
import { layoutTemplateText } from "../templateStudio/text";
import { buildComponentPrintHtml } from "../componentStudio/print";

export function escapeMarkup(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}

function wrapText(value: string, characters: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const chunks = word.match(new RegExp(`.{1,${characters}}`, "gu")) ?? [""];
      for (const chunk of chunks) {
        if (line && [...`${line} ${chunk}`].length > characters) {
          lines.push(line);
          line = "";
        }
        line = line ? `${line} ${chunk}` : chunk;
      }
    }
    lines.push(line);
  }
  return lines;
}

function fitText(value: string, width: number, height: number, preferredSize: number, weight = 0.54) {
  let size = preferredSize;
  let lines = wrapText(value, Math.max(1, Math.floor(width / (size * weight))));
  while (lines.length * size * 1.28 > height && size > 1) {
    size -= 0.5;
    lines = wrapText(value, Math.max(1, Math.floor(width / (size * weight))));
  }
  return { size, lines };
}

function textBlock(
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  options = "",
): string {
  const { size, lines } = fitText(value, width, height, fontSize);
  return `<text x="${x}" y="${y + size}" font-size="${size}" ${options}>${lines.map((line, index) => `<tspan x="${x}" dy="${index ? size * 1.28 : 0}">${escapeMarkup(line)}</tspan>`).join("")}</text>`;
}

function forestArtwork(template: CardTemplate, width: number, height: number): string {
  const { foreground, accent, background } = template;
  return `<rect width="${width}" height="${height}" fill="${foreground}" opacity=".09"/>
    <circle cx="${width * 0.76}" cy="${height * 0.27}" r="${height * 0.16}" fill="${accent}" opacity=".5"/>
    <path d="M0 ${height * 0.82}Q${width * 0.25} ${height * 0.33} ${width * 0.55} ${height * 0.88}Q${width * 0.8} ${height * 0.51} ${width} ${height * 0.73}V${height}H0Z" fill="${foreground}" opacity=".12"/>
    ${[0.13, 0.34, 0.6, 0.88]
      .map((position, index) => {
        const x = position * width;
        const h = height * (index % 2 ? 0.76 : 0.57);
        return `<path d="M${x} ${height - h}l${h * 0.29} ${h * 0.72}h-${h * 0.58}Z" fill="${foreground}" opacity="${index % 2 ? 0.75 : 0.38}"/><path d="M${x} ${height - h * 0.6}v${h * 0.6}" stroke="${accent}" stroke-width="3"/>`;
      })
      .join("")}
    <path d="M${width * 0.5} ${height}Q${width * 0.68} ${height * 0.85} ${width * 0.52} ${height * 0.65}" fill="none" stroke="${background}" stroke-width="10" opacity=".6"/>`;
}

/** One SVG renderer drives the workbench, exported cards, and physical print sheets. */
export function renderCardSvg(row: CardStudioRow, template: CardTemplate, artReference?: string): string {
  if (template.document) return renderDesignSvg(template.document, { data: rowTemplateData(row) });
  const width = 315;
  const height = (width * template.heightMm) / template.widthMm;
  const { background, foreground, accent, preset } = template;
  const title = getCardField(row, template.titleField) || "Untitled card";
  const badge = getCardField(row, template.badgeField);
  const body = getCardField(row, template.bodyField);
  const footer = getCardField(row, template.footerField);
  const artY = 87;
  const artHeight = height * 0.32;
  const bodyY = template.showArt ? artY + artHeight + 15 : 98;
  const bodyHeight = height - bodyY - 58;
  const titleX = preset === "modern" ? 28 : 30;
  const safeArt = artReference ? "" : safeArtUrl(row.artUrl);
  const artwork = artReference
    ? `<use href="#${escapeMarkup(artReference)}" x="0" y="0" width="263" height="${artHeight}"/>`
    : safeArt
      ? `<image href="${escapeMarkup(safeArt)}" x="0" y="0" width="263" height="${artHeight}" preserveAspectRatio="xMidYMid slice"/>`
      : forestArtwork(template, 263, artHeight);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.widthMm}mm" height="${template.heightMm}mm" viewBox="0 0 ${width} ${height}" font-weight="400" font-style="normal" letter-spacing="normal" role="img" aria-label="${escapeMarkup(title)}">
    <title>${escapeMarkup(title)}</title>
    <rect x=".5" y=".5" width="314" height="${height - 1}" rx="14" fill="${background}" stroke="${accent}"/>
    ${
      preset === "modern"
        ? `<path d="M15 0h285a15 15 0 0 1 15 15v65H0V15A15 15 0 0 1 15 0" fill="${foreground}"/><rect x="0" y="${height - 43}" width="315" height="28" fill="${accent}" opacity=".15"/>`
        : `<rect x="11" y="11" width="293" height="${height - 22}" rx="${preset === "storybook" ? 25 : 8}" fill="none" stroke="${accent}" stroke-width="${preset === "storybook" ? 2 : 1}"/>
        <path d="M20 70H295M26 ${height - 49}H289" stroke="${accent}" opacity=".55"/>
        ${preset === "woodland" ? `<path d="M16 52Q32 20 57 17M299 ${height - 52}Q283 ${height - 20} 258 ${height - 17}" stroke="${accent}" fill="none"/><path d="M22 36Q19 17 36 24Q38 37 22 36M292 ${height - 36}Q295 ${height - 17} 278 ${height - 24}Q276 ${height - 37} 292 ${height - 36}" fill="${accent}"/>` : ""}`
    }
    <g fill="${preset === "modern" ? background : foreground}" font-family="${preset === "modern" ? "Arial, sans-serif" : "Georgia, serif"}">
      ${textBlock(title, titleX, 28, badge ? 199 : 257, 39, 22, 'font-weight="700"')}
    </g>
    ${badge ? `<circle cx="267" cy="47" r="20" fill="${accent}"/>${textBlock(badge, 250, 32, 34, 25, 20, `fill="${background}" font-family="Arial, sans-serif" font-weight="700" text-anchor="middle" transform="translate(17 0)"`)}` : ""}
    ${template.showArt ? `<svg x="26" y="${artY}" width="263" height="${artHeight}" viewBox="0 0 263 ${artHeight}" overflow="hidden">${artwork}</svg>` : ""}
    <g fill="${foreground}" font-family="${preset === "storybook" ? "Georgia, serif" : "Arial, sans-serif"}">${textBlock(body, 30, bodyY, 255, bodyHeight, template.bodyFontSize)}</g>
    ${textBlock(footer.toUpperCase(), 30, height - 40, 255, 23, 12, `fill="${foreground}" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1.2"`)}
  </svg>`;
}

export function cardTextNeedsReview(row: CardStudioRow, template: CardTemplate): boolean {
  if (template.document) {
    const data = rowTemplateData(row);
    return template.document.faces.some((face) =>
      face.layers.some((layer) => {
        if (layer.type !== "text" || !layer.visible) return false;
        const layout = layoutTemplateText(layer, resolveTemplateText(layer.content, data));
        return layout.overflow || layout.fontSizePt < 6;
      }),
    );
  }
  const height = (315 * template.heightMm) / template.widthMm;
  const bodyY = template.showArt ? 102 + height * 0.32 : 98;
  return (
    fitText(getCardField(row, template.bodyField), 255, height - bodyY - 58, template.bodyFontSize).size <
      12 || fitText(getCardField(row, template.titleField), 199, 39, 22).size < 12
  );
}

export function buildCardPrintHtml(
  state: CardStudioState,
  projectName: string,
  paper: "a4" | "letter" = "a4",
): string {
  if (state.template.document) return buildComponentPrintHtml(state, projectName, paper);
  const cards = expandCardRows(state.rows);
  if (!cards.length) throw new Error("Add at least one card with a positive number of copies.");
  const pageWidth = paper === "a4" ? 210 : 215.9;
  const pageHeight = paper === "a4" ? 297 : 279.4;
  const columns = Math.max(1, Math.floor((pageWidth - 15 + 3) / (state.template.widthMm + 3)));
  const rowsPerPage = Math.max(1, Math.floor((pageHeight - 15 + 3) / (state.template.heightMm + 3)));
  const pageSize = columns * rowsPerPage;
  const rowMap = new Map(state.rows.map((row) => [row.id, row]));
  const artwork = new Map<string, string>();
  if (state.template.showArt) {
    state.rows
      .filter((row) => row.copies > 0 && row.artUrl)
      .forEach((row) => {
        if (!artwork.has(row.artUrl)) artwork.set(row.artUrl, `card-art-${artwork.size}`);
      });
  }
  const artHeight = ((315 * state.template.heightMm) / state.template.widthMm) * 0.32;
  // Each uploaded image is embedded once, even when a design has 99 copies.
  const sharedArtwork = artwork.size
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${[...artwork].map(([url, id]) => `<symbol id="${id}" viewBox="0 0 263 ${artHeight}"><image href="${escapeMarkup(safeArtUrl(url))}" width="263" height="${artHeight}" preserveAspectRatio="xMidYMid slice"/></symbol>`).join("")}</defs></svg>`
    : "";
  const pages = Array.from(
    { length: Math.ceil(cards.length / pageSize) },
    (_, index) =>
      `<section class="sheet" aria-label="Print sheet ${index + 1}">${cards
        .slice(index * pageSize, (index + 1) * pageSize)
        .map(
          (card) =>
            `<article class="card">${renderCardSvg(rowMap.get(card.sourceRowId)!, state.template, artwork.get(card.artUrl))}</article>`,
        )
        .join("")}</section>`,
  ).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeMarkup(projectName)} · Print cards</title><style>
    *{box-sizing:border-box}body{margin:0;background:#e8e4db;color:#193e31;font-family:system-ui,sans-serif}header{padding:24px;max-width:900px;margin:auto}h1{font-size:24px;margin:0 0 8px}p{font-size:14px;line-height:1.6;margin:8px 0}button{background:#193e31;color:white;border:0;border-radius:8px;padding:12px 20px;cursor:pointer}.sheet{width:${pageWidth}mm;height:${pageHeight}mm;padding:7.5mm;margin:20px auto;background:white;display:grid;grid-template-columns:repeat(${columns},${state.template.widthMm}mm);grid-auto-rows:${state.template.heightMm}mm;gap:3mm;align-content:start;justify-content:center;break-after:page}.sheet:last-child{break-after:auto}.card{width:${state.template.widthMm}mm;height:${state.template.heightMm}mm;outline:.2mm dashed #999;outline-offset:.7mm}.card > svg{width:100%;height:100%;display:block} @page{size:${paper === "a4" ? "A4" : "letter"};margin:0}@media print{body{background:white;print-color-adjust:exact;-webkit-print-color-adjust:exact}header{display:none}.sheet{margin:0}}
    </style></head><body>${sharedArtwork}<header><h1>${escapeMarkup(projectName)}</h1><p>${cards.length} cards · ${state.template.widthMm} × ${state.template.heightMm} mm · ${paper.toUpperCase()} paper. Print at 100% / actual size with browser headers and footers off. Cut along the dashed guides. These are prototype card fronts; inspect a sample before printing the full deck.</p>${state.rows.some((row) => /^https?:/.test(row.artUrl)) ? "<p>Linked artwork needs an internet connection. Wait for all images to load before printing. Upload artwork in Card Studio to keep it inside the file.</p>" : ""}<button type="button" onclick="window.print()">Print / save as PDF</button></header>${pages}</body></html>`;
}

export function downloadCardFile(contents: string, name: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function cardExportFilename(name: string): string {
  return (
    name
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "my-game"
  );
}
