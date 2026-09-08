import { useRef, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Download, FileJson, Layers3, Printer, Upload } from 'lucide-react';
import type { EditorProject } from '../types';
import type { EditorSection } from '../constants';
import { normalizeCardStudioState, validateCardRows } from '../cardStudio/model';
import { buildCardPrintHtml, cardTextNeedsReview } from '../cardStudio/render';
import { createRulebookHtml } from '../exports/rulebook';
import { downloadFile, fileStem } from '../exports/download';
import { createDesignArchive, importDesignArchive } from '../versions/archive';
import './print.css';

export function PrintSection({ project, onNavigate }: { project: EditorProject; onNavigate: (section: EditorSection) => void }) {
  const studio = normalizeCardStudioState(project.cardStudio);
  const errors = validateCardRows(studio.rows);
  const copies = studio.rows.reduce((sum, row) => sum + row.copies, 0);
  const textWarnings = studio.rows.filter((row) => cardTextNeedsReview(row, studio.template)).length;
  const components = project.rootInstanceIds.map((id) => project.instances[id]).filter(Boolean);
  const linked = components.filter((item) => item.properties.catalogSlug).length;
  const writtenChapters = project.rules.chapters.filter((chapter) => chapter.body.trim()).length;
  const [paper, setPaper] = useState<'a4' | 'letter'>('a4');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function backup() {
    setBusy(true);
    try { downloadFile(`${fileStem(project.name)}-with-history.json`, await createDesignArchive(project)); setStatus('Downloaded a portable backup with your full version history.'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Could not export your backup.'); }
    finally { setBusy(false); }
  }

  async function restore(file: File) {
    setBusy(true);
    try {
      if (file.size > 100_000_000) throw new Error('Choose a backup smaller than 100 MB.');
      const imported = await importDesignArchive(await file.text());
      window.location.hash = `#/editor/${imported.id}?section=workshop`;
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not import this backup.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }

  return (
    <section className="print-workshop" aria-label="Print and share">
      <header className="print-heading"><div data-layout="printTitle"><span>FROM YOUR SCREEN TO THE TABLE</span><h1>Make something you can hold.</h1><p>Print a rough copy, invite a few friends, and find out what happens.</p></div><Printer size={42} strokeWidth={1.2} /></header>
      <div data-layout="printBody" className="print-body">
        <div data-layout="printExports" className="print-exports">
          <article className="print-card"><div data-layout="printCardIcon" className="print-icon"><Layers3 size={24} /></div><span className="print-kicker">01 / YOUR DECK</span><h2>Print & cut cards</h2><p>Actual-size sheets made from your Card Studio template. Download, open in your browser, then print at 100% scale.</p><div data-layout="printPaperSelect" className="print-paper"><label htmlFor="paper-size">Paper size</label><select id="paper-size" value={paper} onChange={(event) => setPaper(event.target.value as 'a4' | 'letter')}><option value="a4">A4</option><option value="letter">US Letter</option></select></div><strong className="print-count">{copies} cards · {studio.template.widthMm} × {studio.template.heightMm} mm</strong><button disabled={!copies || errors.length > 0} onClick={() => { try { downloadFile(`${fileStem(project.name)}-cards.html`, buildCardPrintHtml(studio, project.name, paper), 'text/html'); setStatus('Card sheets downloaded. Open the HTML file and print at actual size.'); } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not export these cards.'); } }}><Download size={16} />Download card sheets</button><button className="print-link" onClick={() => onNavigate('card_studio')}>Edit your deck <ArrowRight size={14} /></button></article>
          <article className="print-card"><div data-layout="printRulesIcon" className="print-icon"><BookOpen size={24} /></div><span className="print-kicker">02 / THE HOW-TO-PLAY</span><h2>A rulebook to share</h2><p>Give your playtesters a clean copy of the rules and component list. Keep designer notes private in your project.</p><strong className="print-count">{writtenChapters} written chapters</strong><button onClick={() => { downloadFile(`${fileStem(project.name)}-rulebook.html`, createRulebookHtml(project), 'text/html'); setStatus('Rulebook downloaded. Open it to print or save as PDF.'); }}><Download size={16} />Download rulebook</button><button className="print-link" onClick={() => onNavigate('rules')}>Review your rules <ArrowRight size={14} /></button></article>
          <article className="print-card"><div data-layout="printArchiveIcon" className="print-icon"><FileJson size={24} /></div><span className="print-kicker">03 / THE WHOLE WORKSHOP</span><h2>Take your game with you</h2><p>A portable archive of your design, art, card data, playtest findings, and every saved checkpoint.</p><button disabled={busy} onClick={() => { void backup(); }}><Download size={16} />{busy ? 'Working…' : 'Download full backup'}</button><button className="print-link" disabled={busy} onClick={() => input.current?.click()}><Upload size={14} />Import a backup as a new game</button><input ref={input} type="file" accept=".json,application/json" hidden aria-label="Import game backup" onChange={(event) => { const file = event.target.files?.[0]; if (file) void restore(file); }} /></article>
        </div>
        <aside className="print-readiness" aria-label="Prototype preparation"><div data-layout="readinessHeading"><span className="print-kicker">BEFORE YOU CUT THE FIRST CARD</span><h2>A little preparation goes a long way.</h2></div><ul><li><CheckCircle2 size={18} /><span><strong>{studio.rows.length ? `${copies} cards ready to review` : 'Build your first deck'}</strong>{textWarnings ? `${textWarnings} card descriptions may need a readability check.` : 'Check that small text is comfortable to read at actual size.'}</span></li><li><CheckCircle2 size={18} /><span><strong>{linked} of {components.length} components linked to suppliers</strong>Supplier-linked components keep dimensions and options close to the design.</span></li><li><CheckCircle2 size={18} /><span><strong>Home prototype first</strong>These sheets are for cutting and testing. Review bleed, safe zones, and supplier templates before manufacturing.</span></li></ul>{errors.length > 0 && <p className="print-warning">Fix the card table before printing: {errors[0]}</p>}<div data-layout="futurePrinting" className="print-future"><Printer size={23} /><p><strong>Physical ordering is the next chapter.</strong><br />Your supplier catalog is connected. Checkout and production fulfillment are still being built.</p></div></aside>
      </div>
      <footer className="print-footer" role="status">{status || 'A paper prototype does not have to be perfect. It just has to make the next playtest possible.'}</footer>
    </section>
  );
}
