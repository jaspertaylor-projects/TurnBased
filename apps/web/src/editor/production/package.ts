import type { EditorProject } from '../types';
import type { ProductionPlan } from './orderPlan';
import { listProjectDesignSets } from '../componentStudio/model';
import { buildComponentPrintHtml } from '../componentStudio/print';
import { migrateCardTemplate, rowTemplateData } from '../templateStudio/model';
import { renderDesignSvg } from '../templateStudio/render';
import { createRulebookHtml } from '../exports/rulebook';
import { fileStem, escapeHtml } from '../exports/download';
import { createDesignArchive } from '../versions/archive';
import { createStoredZip, textPackageFile, type PackageFile } from './zip';
import { rasterizeProductionSvg } from './raster';

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`;
}

export function productionChecklistHtml(name: string, plan: ProductionPlan): string {
  const rows = plan.rows.map((row) => `<tr><td><strong>${escapeHtml(row.name)}</strong><br>${row.widthMm} × ${row.heightMm} mm</td><td>${row.copiesPerGame ?? 'Check quantity'}</td><td>${escapeHtml(row.supplier)}<br>${escapeHtml(row.productTitle)}<br>${escapeHtml(row.variantTitle)}</td><td>${row.purchase.totalUnits ?? 'Confirm'} ${escapeHtml(row.purchase.unit)}${row.purchase.totalUnits === 1 ? '' : 's'}<br>${row.purchase.overagePhysical ? `${row.purchase.overagePhysical} spare pieces` : ''}</td><td>${row.sourceUrl ? `<a href="${escapeHtml(row.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open product</a>` : 'Choose a supplier'}<ul>${row.issues.map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join('')}</ul></td></tr>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escapeHtml(name)} — supplier checklist</title><style>body{max-width:1100px;margin:40px auto;padding:0 24px;background:#faf7ed;color:#244637;font:15px/1.6 system-ui}h1,h2{font-family:Georgia,serif}table{width:100%;border-collapse:collapse}td,th{text-align:left;vertical-align:top;border-bottom:1px solid #d6dcca;padding:15px 10px}a{color:#176b58}small{color:#687560}ul{padding-left:20px;font-size:12px}.note{background:#e9eedf;padding:18px;border-radius:10px}</style><h1>${escapeHtml(name)}</h1><p>${plan.gameCopies} game ${plan.gameCopies === 1 ? 'copy' : 'copies'} · ${plan.totalPhysical ?? 'Check'} required pieces · ${plan.providers.length} supplier${plan.providers.length === 1 ? '' : 's'}</p><p class="note">This package prepares a supplier order. It does not place an order or arrange shipping. Open each product, upload its artwork, check the proof, and confirm quantities, price and delivery with the supplier.</p><table><thead><tr><th>Component</th><th>Per game</th><th>Supplier match</th><th>Purchase</th><th>Review</th></tr></thead><tbody>${rows}</tbody></table><h2>Before checkout</h2><ol><li>Use the numbered artwork folders and copy-map.csv to assign fronts and backs. Counts describe one complete game; the order plan specifies how many game copies to purchase.</li><li>Check the supplier's current trim, bleed, safe area, colors and artwork preview. PNG files are rendered at 300 dpi using the template's saved bleed. The file dimensions and margins are recorded in order-plan.json.</li><li>Supplier sheets may contain extra slots. The plan reports spare pieces; confirm how blank or duplicate slots should be handled.</li><li>Open rulebook.html to print the instructions. Packaging, printed rulebooks, score paper or other supplies need separate arrangements unless listed as a matched component.</li><li>Confirm the final price, shipping address, tax, shipping cost and delivery date at the supplier. Different suppliers may ship separately.</li></ol><p>Cached estimates exclude ${plan.estimate.excludes.map(escapeHtml).join(', ')}. Unknown prices are not zero.</p></html>`;
}

/** Capture one design snapshot; exporting never modifies the project or contacts a supplier. */
export async function createSupplierPackage(
  project: EditorProject,
  plan: ProductionPlan,
  onProgress: (message: string) => void,
): Promise<{ blob: Blob; fileCount: number; artworkFaces: number }> {
  if (plan.rows.some((row) => row.issues.some((issue) => issue.severity === 'blocking')) || plan.issues.some((issue) => issue.severity === 'blocking')) {
    throw new Error('Resolve the missing supplier matches and component issues before exporting this order.');
  }
  const sets = listProjectDesignSets(project).filter((set) => set.studio.rows.some((row) => row.copies > 0));
  const faces = sets.reduce((sum, set) => sum + (plan.rows.find((row) => row.designSetId === set.id)?.productionType === 'stock' ? 0 : set.studio.rows.filter((row) => row.copies > 0).length * (set.studio.template.document?.faces.length ?? 1)), 0);
  if (faces * 2 + sets.length + 6 > 6000) throw new Error('This package exceeds 6,000 files. Split it into smaller prototypes.');
  await document.fonts.ready;
  const files: PackageFile[] = [], map: unknown[][] = [['Component', 'Design', 'Copy within game', 'Front artwork', 'Back artwork', 'Other faces']];
  const artwork: Array<Record<string, unknown>> = [];
  let completed = 0, bytes = 0;
  const add = (file: PackageFile) => {
    bytes += file.data.byteLength;
    if (bytes > 200_000_000) throw new Error('The supplier package exceeds 200 MB. Export fewer designs at once.');
    files.push(file);
  };
  for (const [setIndex, set] of sets.entries()) {
    const material = plan.rows.find((row) => row.designSetId === set.id);
    if (!material) throw new Error('The component list changed. Refresh the order and try again.');
    const folder = `${String(setIndex + 1).padStart(2, '0')}-${fileStem(set.name)}`;
    const template = set.studio.template.document ?? migrateCardTemplate(set.studio.template);
    const faceWidth = template.widthMm + template.bleedMm * 2;
    const faceHeight = template.heightMm + template.bleedMm * 2;
    if (material.productionType !== 'stock') {
      for (const [rowIndex, row] of set.studio.rows.entries()) {
        if (!row.copies) continue;
        const paths: string[] = [];
        for (const [faceIndex, face] of template.faces.entries()) {
          const stem = `artwork/${folder}/${String(rowIndex + 1).padStart(3, '0')}-${fileStem(row.title)}-${String(faceIndex + 1).padStart(2, '0')}-${fileStem(face.name)}`;
          onProgress(`Rendering ${set.name} · ${row.title} · ${face.name} (${++completed}/${faces})`);
          const svg = renderDesignSvg(template, { faceId: face.id, data: rowTemplateData(row), includeBleed: true, showGuides: false, idPrefix: `production-${setIndex}-${rowIndex}-${faceIndex}` });
          const rendered = await rasterizeProductionSvg(svg, faceWidth, faceHeight);
          add({ name: `${stem}.png`, data: rendered.png });
          add(textPackageFile(`${stem}.svg`, rendered.svg));
          paths.push(`${stem}.png`);
          artwork.push({ designSetId: set.id, rowId: row.id, faceId: face.id, path: `${stem}.png`, copiesPerGame: row.copies, widthMm: faceWidth, heightMm: faceHeight, trimWidthMm: template.widthMm, trimHeightMm: template.heightMm, bleedMm: template.bleedMm, safeMm: template.safeMm, dpi: 300 });
        }
        for (let copy = 1; copy <= row.copies; copy++) map.push([set.name, row.title, copy, paths[0], paths[1] ?? '', paths.slice(2).join('; ')]);
      }
    } else {
      map.push([set.name, 'Stock part — supplied appearance; no custom artwork upload', material.copiesPerGame, '', '', '']);
    }
    // Home proofs retain cut guides and actual-size imposition separately from upload artwork.
    add(textPackageFile(`home-print/${folder}.html`, buildComponentPrintHtml(set.studio, `${project.name} — ${set.name}`, 'a4', { duplex: template.faces.length === 2, faceId: template.faces.length > 2 ? 'all' : template.faces[0].id })));
  }
  onProgress('Packing the checklist, rulebook, artwork and editable backup…');
  add(textPackageFile('START-HERE.html', productionChecklistHtml(project.name, plan)));
  add(textPackageFile('order-plan.json', JSON.stringify({ format: 'turnbased-supplier-package', schemaVersion: 1, projectName: project.name, exportedAt: new Date().toISOString(), orderPlaced: false, plan, artwork }, null, 2)));
  add(textPackageFile('copy-map.csv', map.map((row) => row.map(csvCell).join(',')).join('\r\n')));
  add(textPackageFile('rulebook.html', createRulebookHtml(project)));
  add(textPackageFile(`${fileStem(project.name)}-with-history.json`, await createDesignArchive(project)));
  add(textPackageFile('README.txt', `${project.name}\n\nOpen START-HERE.html for the complete supplier checklist.\nPNG artwork is 300 dpi, includes the template's saved bleed, and has no printed cut guides.\nSVG files preserve vector shapes/text; the editable project backup preserves all design history.\nUse copy-map.csv to repeat artwork for the per-game quantities.\nHome-print files are actual-size paper proofs, not files to upload as individual supplier pieces.\n\nNo supplier order has been placed. Supplier proof approval, payment, packaging and delivery are confirmed at checkout.\n`));
  return { blob: createStoredZip(files), fileCount: files.length, artworkFaces: artwork.length };
}

export function downloadSupplierBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${fileStem(name)}-supplier-package.zip`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
