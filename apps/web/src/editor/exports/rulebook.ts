import type { EditorProject } from '../types';
import { escapeHtml } from './download';
import { listProjectDesignSets } from '../componentStudio/model';
import { renderRulebookIconography } from './rulebookIcons';

export function createRulebookHtml(project: EditorProject): string {
  const escape = escapeHtml;
  const components = project.rootInstanceIds.map((id) => project.instances[id]).filter(Boolean);
  const sets = listProjectDesignSets(project);
  const represented = new Set(sets.flatMap((set) => (set.instanceId ? [set.instanceId] : [])));
  const inventory = [
    ...sets.map((set) => {
      const copies = set.studio.rows.reduce((sum, row) => sum + row.copies, 0);
      return `<li><strong>${escape(set.name)}</strong> — ${copies} ${escape(set.kind)}${copies === 1 ? '' : 's'}${set.studio.rows.length > 1 ? `, ${set.studio.rows.length} designs` : ''}</li>`;
    }),
    ...components
      .filter((item) => !represented.has(String(item.instanceId)))
      .map(
        (item) =>
          `<li><strong>${escape(item.displayName || item.componentType)}</strong>${item.notes ? ` — ${escape(item.notes)}` : ''}</li>`,
      ),
    ...project.rules.customComponents.map(
      (item) => `<li><strong>${escape(item.name)}</strong> — ${escape(item.description)}</li>`,
    ),
  ].join('');
  const chapters = project.rules.chapters
    .map(
      (chapter) =>
        `<section><h2>${escape(chapter.title)}</h2>${chapter.kind === 'components' ? `<ul>${inventory}</ul>` : chapter.kind === 'iconography' ? renderRulebookIconography(project) : ''}<div class="prose" data-layout="printedChapterProse">${escape(chapter.body)}</div></section>`,
    )
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(project.name)} — rulebook</title><style>
  @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:12pt/1.6 Georgia,serif;color:#233f30;background:#f6f2e6;max-width:185mm;margin:30px auto;padding:16px}h1{font-size:34pt;line-height:1.15;margin:0 0 14px}h2{font-size:20pt;border-bottom:1px solid #b9c5af;padding-bottom:8px;break-after:avoid}section{margin:28px 0}.prose{white-space:pre-wrap}li{margin:8px 0}.meta{color:#68795f;font:10pt system-ui}.cover{padding:25px 0;border-bottom:2px solid #345b3e}.toolbar{display:flex;justify-content:space-between;gap:20px;background:#e9efdf;padding:15px;font:12px system-ui}button{background:#31583e;color:white;border:0;border-radius:5px;padding:10px 15px;cursor:pointer}.icon-legend{list-style:none;padding:0}.icon-entry{display:flex;align-items:center;gap:16px;break-inside:avoid;margin:16px 0}.icon-entry>div{min-width:0;flex:1}.icon-preview{display:flex;align-items:center;justify-content:center;flex:0 0 64px;width:64px;height:64px;overflow:hidden;print-color-adjust:exact;-webkit-print-color-adjust:exact}.icon-preview svg{flex-shrink:0}.icon-glyph{font:32px/1 system-ui}.icon-preview-unavailable{font:9px/1.2 system-ui;text-align:center;padding:4px}.icon-entry code{font:9pt monospace;color:#68795f;overflow-wrap:anywhere}@media print{body{margin:0;padding:0;background:white;max-width:none}.toolbar{display:none}section{break-inside:auto}}
  </style></head><body><div class="toolbar" data-layout="printedRulebookToolbar"><span>Prototype rulebook · Review before sharing with playtesters</span><button onclick="window.print()">Print / save PDF</button></div><header class="cover"><p class="meta">A WORK IN PROGRESS · MADE WITH TURNBASED</p><h1>${escape(project.name)}</h1><p>${escape(project.description || project.brief.theme)}</p><p class="meta">${project.brief.minPlayers}–${project.brief.maxPlayers} players · ${project.brief.playtimeMinMinutes}–${project.brief.playtimeMaxMinutes} minutes · Ages ${project.brief.minAge}+</p></header>${chapters}</body></html>`;
}
