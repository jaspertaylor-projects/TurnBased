import { useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  FileJson,
  Layers3,
  Printer,
  Upload,
} from 'lucide-react';
import type { EditorProject } from '../types';
import type { EditorSection } from '../constants';
import { normalizeCardStudioState, validateCardRows } from '../cardStudio/model';
import { listProjectDesignSets } from '../componentStudio/model';
import { buildComponentPrintHtml, buildComponentPrintLayout } from '../componentStudio/print';
import { migrateCardTemplate } from '../templateStudio/model';
import { createRulebookHtml } from '../exports/rulebook';
import { downloadFile, fileStem } from '../exports/download';
import { createDesignArchive, importDesignArchive } from '../versions/archive';
import { OrderPanel } from '../production/OrderPanel';
import './print.css';

export function PrintSection({
  project,
  onNavigate,
  onChange,
}: {
  project: EditorProject;
  onNavigate: (section: EditorSection) => void;
  onChange: (project: EditorProject) => void;
}) {
  const [mode, setMode] = useState<'home' | 'supplier'>('home');
  const sets = listProjectDesignSets(project);
  const [selectedId, setSelectedId] = useState('');
  const selected = sets.find((set) => set.id === selectedId) ?? sets[0];
  const studio = normalizeCardStudioState(selected?.studio);
  const document = studio.template.document ?? migrateCardTemplate(studio.template);
  const errors = validateCardRows(studio.rows);
  const copies = studio.rows.reduce((sum, row) => sum + row.copies, 0);
  const totalCopies = sets.reduce(
    (total, set) => total + set.studio.rows.reduce((sum, row) => sum + row.copies, 0),
    0,
  );
  const linked = sets.filter(
    (set) => set.instanceId && project.instances[set.instanceId]?.properties.catalogSlug,
  ).length;
  const writtenChapters = project.rules.chapters.filter((chapter) => chapter.body.trim()).length;
  const [paper, setPaper] = useState<'a4' | 'letter'>('a4');
  const [faceId, setFaceId] = useState('');
  const [duplex, setDuplex] = useState(false);
  const [includeBleed, setIncludeBleed] = useState(false);
  const selectedFace =
    faceId === 'all' || document.faces.some((face) => face.id === faceId) ? faceId : document.faces[0]?.id;
  const useDuplex = duplex && document.faces.length >= 2;
  const options = {
    faceId: useDuplex ? document.faces[0]?.id : selectedFace,
    duplex: useDuplex,
    includeBleed,
  };
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  let printError = errors[0] ?? '';
  let pageCount = 0;
  let tiled = false;
  if (copies && !printError) {
    try {
      const layout = buildComponentPrintLayout(document, studio.rows, paper, options);
      pageCount = layout.pages.length;
      tiled = layout.tiled;
    } catch (error) {
      printError = error instanceof Error ? error.message : 'Check the component dimensions before printing.';
    }
  }

  async function backup() {
    setBusy(true);
    try {
      downloadFile(`${fileStem(project.name)}-with-history.json`, await createDesignArchive(project));
      setStatus('Downloaded a portable backup with every component design and your full version history.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not export your backup.');
    } finally {
      setBusy(false);
    }
  }

  async function restore(file: File) {
    setBusy(true);
    try {
      if (file.size > 100_000_000) throw new Error('Choose a backup smaller than 100 MB.');
      const imported = await importDesignArchive(await file.text());
      window.location.hash = `#/editor/${imported.id}?section=workshop`;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not import this backup.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  function printComponent() {
    if (!selected) return;
    try {
      const html = buildComponentPrintHtml(studio, `${project.name} — ${selected.name}`, paper, options);
      downloadFile(`${fileStem(project.name)}-${fileStem(selected.name)}.html`, html, 'text/html');
      setStatus(
        `Downloaded ${pageCount} pages for ${selected.name}. Open the file and print at actual size${useDuplex ? ', flipping on the long edge' : ''}.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not export this component.');
    }
  }

  return (
    <section className={`print-workshop${mode === 'supplier' ? ' print-workshop--supplier' : ''}`} aria-label="Print and share">
      <header className="print-heading">
        <div data-layout="printTitle">
          <h1>Print & share</h1>
          <p>Export prototype sheets, a rulebook, or a complete project backup.</p>
        </div>
        <Printer size={42} strokeWidth={1.2} />
      </header>
      <nav className="print-mode-tabs" aria-label="Print and order tools">
        <button type="button" aria-pressed={mode === 'home'} onClick={() => setMode('home')}>Print at home</button>
        <button type="button" aria-pressed={mode === 'supplier'} onClick={() => setMode('supplier')}>Prepare supplier order</button>
      </nav>
      {mode === 'supplier' ? <OrderPanel project={project} onChange={onChange} /> : <>
      <div data-layout="printBody" className="print-body">
        <div data-layout="printExports" className="print-exports">
          <article className="print-card">
            <div data-layout="printCardIcon" className="print-icon">
              <Layers3 size={24} />
            </div>
            <span className="print-kicker">01 / YOUR COMPONENTS</span>
            <h2>Print & assemble</h2>
            <p>
              Use the same editable template as your design workspace. Small pieces share sheets; large boards
              tile across pages at their original size.
            </p>
            <div data-layout="printComponentSelect" className="print-paper">
              <label htmlFor="print-component">Component</label>
              <select
                id="print-component"
                value={selected?.id ?? ''}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setFaceId('');
                  setDuplex(false);
                }}
              >
                {sets.length ? (
                  sets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.name} · {set.kind}
                    </option>
                  ))
                ) : (
                  <option value="">No components yet</option>
                )}
              </select>
            </div>
            <div data-layout="printPaperSelect" className="print-paper">
              <label htmlFor="paper-size">Paper size</label>
              <select
                id="paper-size"
                value={paper}
                onChange={(event) => setPaper(event.target.value as 'a4' | 'letter')}
              >
                <option value="a4">A4 · 210 × 297 mm</option>
                <option value="letter">US Letter · 215.9 × 279.4 mm</option>
              </select>
            </div>
            <div data-layout="printFaceSelect" className="print-paper">
              <label htmlFor="print-face">Face</label>
              <select
                id="print-face"
                value={useDuplex ? document.faces[0]?.id : selectedFace}
                disabled={useDuplex}
                onChange={(event) => setFaceId(event.target.value)}
              >
                {document.faces.map((face) => (
                  <option key={face.id} value={face.id}>
                    {face.name}
                  </option>
                ))}
                {document.faces.length > 1 && <option value="all">All faces · separate sheets</option>}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={useDuplex}
                disabled={document.faces.length < 2}
                onChange={(event) => setDuplex(event.target.checked)}
              />
              Duplex first two faces
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={includeBleed}
                onChange={(event) => setIncludeBleed(event.target.checked)}
              />
              Include {document.bleedMm} mm bleed
            </label>
            <strong className="print-count">
              {copies} copies · {document.widthMm} × {document.heightMm} mm · {pageCount} pages
              {tiled ? ' · tiled assembly' : ''}
            </strong>
            {useDuplex && (
              <small style={{ color: '#6b755d', marginTop: 8 }}>
                Flip on the long edge. Back positions match front positions, including partly filled sheets.
              </small>
            )}
            <button disabled={!selected || !copies || !!printError} onClick={printComponent}>
              <Download size={16} />
              Download component sheets
            </button>
            <button className="print-link" onClick={() => onNavigate('component_editor')}>
              Edit your components <ArrowRight size={14} />
            </button>
          </article>
          <article className="print-card">
            <div data-layout="printRulesIcon" className="print-icon">
              <BookOpen size={24} />
            </div>
            <span className="print-kicker">02 / RULEBOOK</span>
            <h2>Print rules</h2>
            <p>
              Give your playtesters a clean copy of the rules and component list. Keep designer notes private
              in your project.
            </p>
            <strong className="print-count">{writtenChapters} written chapters</strong>
            <button
              onClick={() => {
                downloadFile(
                  `${fileStem(project.name)}-rulebook.html`,
                  createRulebookHtml(project),
                  'text/html',
                );
                setStatus('Rulebook downloaded. Open it to print or save as PDF.');
              }}
            >
              <Download size={16} />
              Download rulebook
            </button>
            <button className="print-link" onClick={() => onNavigate('rules')}>
              Review your rules <ArrowRight size={14} />
            </button>
          </article>
          <article className="print-card">
            <div data-layout="printArchiveIcon" className="print-icon">
              <FileJson size={24} />
            </div>
            <span className="print-kicker">03 / PROJECT BACKUP</span>
            <h2>Export or import</h2>
            <p>
              A portable archive of every component, editable template, artwork, table, playtest finding and
              saved checkpoint.
            </p>
            <button
              disabled={busy}
              onClick={() => {
                void backup();
              }}
            >
              <Download size={16} />
              {busy ? 'Working…' : 'Download full backup'}
            </button>
            <button className="print-link" disabled={busy} onClick={() => input.current?.click()}>
              <Upload size={14} />
              Import a backup as a new game
            </button>
            <input
              ref={input}
              type="file"
              accept=".json,application/json"
              hidden
              aria-label="Import game backup"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void restore(file);
              }}
            />
          </article>
        </div>
        <aside className="print-readiness" aria-label="Prototype preparation">
          <div data-layout="readinessHeading">
            <h2>Prototype readiness</h2>
          </div>
          <ul>
            <li>
              <CheckCircle2 size={18} />
              <span>
                <strong>
                  {sets.length} component sets · {totalCopies} physical copies
                </strong>
                {[...new Set(sets.map((set) => set.kind))].join(', ') ||
                  'Create your first component in the Components workspace.'}
              </span>
            </li>
            <li>
              <CheckCircle2 size={18} />
              <span>
                <strong>
                  {linked} of {sets.length} sets linked to suppliers
                </strong>
                Supplier-linked components keep dimensions and options close to the design.
              </span>
            </li>
            <li>
              <CheckCircle2 size={18} />
              <span>
                <strong>Home prototype first</strong>Print a sample at 100% scale. Check text, trim shapes and
                front/back alignment before making the whole game.
              </span>
            </li>
          </ul>
          {printError && (
            <p className="print-warning" role="alert">
              Before printing {selected?.name ?? 'this component'}: {printError}
            </p>
          )}
          <div data-layout="supplierPrintingNextStep" className="print-future">
            <Printer size={23} />
            <p>
              <strong>Ready for a manufactured prototype?</strong>
              <br />
              Match every piece to a supplier and download the artwork package. Confirm proofs, payment and delivery at the supplier.
            </p>
            <button type="button" className="print-supplier-link" onClick={() => setMode('supplier')}>Prepare supplier order <ArrowRight size={14} /></button>
          </div>
        </aside>
      </div>
      <footer className="print-footer" role="status">
        {status ||
          'Print at 100% scale and check the alignment before printing the full set.'}
      </footer>
      </>}
    </section>
  );
}
