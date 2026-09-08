import type { CardStudioState } from '../cardStudio/types';
import type { ComponentDesignDocument } from '../templateStudio/types';
import { migrateCardTemplate, rowTemplateData } from '../templateStudio/model';
import { renderDesignSvg } from '../templateStudio/render';
import { buildComponentPrintLayout, type ComponentPrintOptions } from './printLayout';

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );

function trimGuide(document: ComponentDesignDocument, bleedMm: number): string {
  const w = document.widthMm;
  const h = document.heightMm;
  const attributes = 'fill="none" stroke="#777" stroke-width="0.15" stroke-dasharray="1 .8"';
  const shape =
    document.trimShape === 'ellipse'
      ? `<ellipse cx="${bleedMm + w / 2}" cy="${bleedMm + h / 2}" rx="${w / 2}" ry="${h / 2}" ${attributes}/>`
      : document.trimShape === 'hexagon'
        ? `<polygon points="${[
            [w / 4, 0],
            [w * 0.75, 0],
            [w, h / 2],
            [w * 0.75, h],
            [w / 4, h],
            [0, h / 2],
          ]
            .map(([x, y]) => `${x + bleedMm},${y + bleedMm}`)
            .join(' ')}" ${attributes}/>`
        : `<rect x="${bleedMm}" y="${bleedMm}" width="${w}" height="${h}" rx="${document.cornerRadiusMm}" ${attributes}/>`;
  return `<svg class="cut-guide" xmlns="http://www.w3.org/2000/svg" width="${w + bleedMm * 2}mm" height="${h + bleedMm * 2}mm" viewBox="0 0 ${w + bleedMm * 2} ${h + bleedMm * 2}" aria-hidden="true">${shape}</svg>`;
}

/** One portable, actual-size document. Board tiles overlap; duplex backs mirror placement. */
export function buildComponentPrintHtml(
  studio: CardStudioState,
  name: string,
  paper: 'a4' | 'letter' = 'a4',
  options: ComponentPrintOptions = {},
): string {
  const document = studio.template.document ?? migrateCardTemplate(studio.template);
  const layout = buildComponentPrintLayout(document, studio.rows, paper, options);
  const rows = new Map(studio.rows.map((row) => [row.id, row]));
  const artwork = new Map<string, string>();
  const dedupeImages = (svg: string) =>
    svg.replace(/\bhref="(data:image\/[^"<>]+)"/g, (_, url: string) => {
      if (!artwork.has(url)) artwork.set(url, `print-art-${artwork.size + 1}`);
      return `data-print-asset="${artwork.get(url)}"`;
    });
  const pages = layout.pages
    .map((page, pageIndex) => {
      const pieces = page.placements
        .map((placement, index) => {
          const row = rows.get(placement.rowId)!;
          const svg = dedupeImages(
            renderDesignSvg(document, {
              faceId: placement.faceId,
              data: rowTemplateData(row),
              includeBleed: options.includeBleed,
              showGuides: false,
              idPrefix: `print-${pageIndex}-${index}`,
            }),
          );
          return `<article class="print-piece" data-row-id="${escape(row.id)}" data-copy="${placement.copyNumber}" data-face="${escape(placement.faceId)}" style="left:${placement.xMm}mm;top:${placement.yMm}mm;width:${placement.widthMm}mm;height:${placement.heightMm}mm"><div class="piece-art" style="left:${-placement.sourceXMm}mm;top:${-placement.sourceYMm}mm;width:${layout.componentWidthMm}mm;height:${layout.componentHeightMm}mm">${svg}${trimGuide(document, layout.bleedMm)}</div></article>`;
        })
        .join('');
      const placement = page.placements[0];
      const tile = placement.tile;
      const face = document.faces.find((candidate) => candidate.id === placement.faceId)!;
      const label = `${name} · ${face.name} · ${page.side === 'single' ? '' : `${page.side} · `}page ${pageIndex + 1}/${layout.pages.length}${tile ? ` · copy ${placement.copyNumber} · tile ${tile.row},${tile.column} of ${tile.rows}×${tile.columns} · x ${placement.sourceXMm.toFixed(1)}–${(placement.sourceXMm + placement.widthMm).toFixed(1)} mm / y ${placement.sourceYMm.toFixed(1)}–${(placement.sourceYMm + placement.heightMm).toFixed(1)} mm` : ''}`;
      return `<section class="print-sheet" aria-label="${escape(label)}" data-print-side="${page.side}" data-page="${pageIndex + 1}">${pieces}<footer class="sheet-label">${escape(label)}</footer></section>`;
    })
    .join('');
  const assetJson = JSON.stringify(Object.fromEntries([...artwork].map(([url, id]) => [id, url]))).replace(
    /</g,
    '\\u003c',
  );
  const copies = studio.rows.reduce((sum, row) => sum + row.copies, 0);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(name)} · Print components</title><style>
  *{box-sizing:border-box}body{margin:0;background:#e8e4db;color:#193e31;font:14px/1.6 system-ui,sans-serif}.print-instructions{max-width:900px;margin:0 auto;padding:24px}h1{font:28px Georgia,serif;margin:0 0 10px}button{border:0;border-radius:7px;padding:12px 18px;background:#234b34;color:#fff8e9;cursor:pointer}.print-sheet{position:relative;width:${layout.paperWidthMm}mm;height:${layout.paperHeightMm}mm;margin:20px auto;background:#fff;overflow:hidden;break-after:page}.print-sheet:last-of-type{break-after:auto}.print-piece{position:absolute;overflow:hidden}.piece-art{position:absolute}.piece-art>svg{position:absolute;left:0;top:0;display:block;width:100%;height:100%}.cut-guide{pointer-events:none}.sheet-label{position:absolute;bottom:3mm;left:10mm;right:10mm;font:7pt/1.25 Arial,sans-serif;color:#555} @page{size:${layout.paperWidthMm}mm ${layout.paperHeightMm}mm;margin:0}@media print{body{background:#fff;print-color-adjust:exact;-webkit-print-color-adjust:exact}.print-instructions{display:none}.print-sheet{margin:0}}
  </style></head><body><header class="print-instructions"><h1>${escape(name)}</h1><p>${copies} component${copies === 1 ? '' : 's'} · trim ${document.widthMm} × ${document.heightMm} mm · ${layout.pages.length} ${paper.toUpperCase()} pages (${layout.paperWidthMm} × ${layout.paperHeightMm} mm). Print at 100% / actual size with browser headers and footers off. Dashed lines mark the trim shape.</p>${options.includeBleed ? `<p>Includes ${document.bleedMm} mm bleed beyond the trim edge.</p>` : ''}${options.duplex ? '<p><strong>Duplex:</strong> use portrait orientation and flip on the long edge. Each front is followed by its matching back; back positions are mirrored, including incomplete sheets. Print a two-page alignment check before the whole job.</p>' : '<p>Single-sided sheets. Each selected face prints separately.</p>'}${layout.tiled ? `<p><strong>Board assembly:</strong> the artwork keeps its original physical size. Neighboring tiles overlap by ${layout.overlapMm} mm. Use row/column labels and coordinate bounds to align the repeated artwork, trim one overlapping edge, then tape the tiles together.${options.duplex ? ' Back labels identify the matching front tile; the back artwork covers its mirrored horizontal coordinates.' : ''}</p>` : ''}<button onclick="window.print()">Print / save PDF</button></header>${pages}<script id="print-artwork" type="application/json">${assetJson}</script><script>const artwork=JSON.parse(document.getElementById('print-artwork').textContent);document.querySelectorAll('image[data-print-asset]').forEach(image=>image.setAttribute('href',artwork[image.getAttribute('data-print-asset')]));</script></body></html>`;
}

export { buildComponentPrintLayout } from './printLayout';
