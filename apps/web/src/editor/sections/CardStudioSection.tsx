import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileUp,
  Grid2X2,
  Layers3,
  Plus,
  Printer,
  Table2,
  X,
  Sparkles,
  Undo2,
} from 'lucide-react';
import type { EditorProject } from '../types';
import { ComponentRowArtwork } from '../componentStudio/ComponentRowArtwork';
import { buildComponentPrintHtml } from '../componentStudio/print';
import { CardTable } from '../cardStudio/CardTable';
import { ImportCardsDialog } from '../cardStudio/ImportCardsDialog';
import { CardPreview, TemplateInspector } from '../cardStudio/TemplateInspector';
import { exportCardCsv } from '../cardStudio/csv';
import {
  BASE_CARD_FIELDS,
  cardStudioFingerprint,
  createCardRow,
  createDefaultCardStudio,
  createSampleRows,
  expandCardRows,
  MAX_CARD_ROWS,
  validateCardRows,
} from '../cardStudio/model';
import {
  buildCardPrintHtml,
  cardExportFilename,
  cardTextNeedsReview,
  downloadCardFile,
  renderCardSvg,
} from '../cardStudio/render';
import type { CardStudioRow, CardStudioState } from '../cardStudio/types';
import '../cardStudio/cardStudio.css';
import '../cardStudio/cardTableAI.css';
import { CardTableAIDialog } from '../cardStudio/CardTableAIDialog';
import { useCardTableAI, type AITableSelection } from '../cardStudio/useCardTableAI';
import { aiFieldLabel } from '../cardStudio/aiTableModel';

export function CardStudioSection({
  project,
  onChange,
  embedded = false,
  itemLabel = 'cards',
  studioKey = 'legacy',
  onUpdateStudio,
}: {
  project: EditorProject;
  embedded?: boolean;
  itemLabel?: string;
  studioKey?: string;
  onUpdateStudio?: (updater: (studio: CardStudioState) => CardStudioState) => void;
  onChange: (project: EditorProject) => void;
}) {
  const state = useMemo(() => project.cardStudio ?? createDefaultCardStudio(), [project.cardStudio]);
  const live = useRef({ project, state, onChange });
  useLayoutEffect(() => {
    live.current = { project, state, onChange };
  });
  const [aiCell, setAICell] = useState<AITableSelection | null>(null);
  const ai = useCardTableAI(
    project,
    state,
    `${project.id}:${studioKey}`,
    onUpdateStudio ??
      ((updater) => {
        const current = live.current;
        current.onChange({
          ...current.project,
          cardStudio: updater(current.state),
        });
      }),
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [view, setView] = useState<'table' | 'deck'>('table');
  const [importing, setImporting] = useState(false);
  const [newColumn, setNewColumn] = useState('');
  const [addingField, setAddingField] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [paper, setPaper] = useState<'a4' | 'letter'>('a4');
  const [page, setPage] = useState(0);
  const selected = state.rows.find((row) => row.id === selectedId) ?? state.rows[0];
  const errors = useMemo(() => validateCardRows(state.rows), [state.rows]);
  const total = state.rows.reduce((sum, row) => sum + row.copies, 0);
  const fingerprint = useMemo(() => cardStudioFingerprint(state), [state]);
  const batchIsCurrent = state.generated?.sourceFingerprint === fingerprint;
  const expanded = useMemo(() => (errors.length ? [] : expandCardRows(state.rows)), [state.rows, errors]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(expanded.length / 48) - 1));
  const rowMap = useMemo(() => new Map(state.rows.map((row) => [row.id, row])), [state.rows]);
  const smallTextCount = useMemo(
    () => state.rows.filter((row) => row.copies > 0 && cardTextNeedsReview(row, state.template)).length,
    [state.rows, state.template],
  );

  function update(next: CardStudioState) {
    onChange({ ...project, cardStudio: next });
    setStatus('');
    setError('');
  }

  function updateRow(next: CardStudioRow) {
    update({
      ...state,
      rows: state.rows.map((row) => (row.id === next.id ? next : row)),
    });
  }

  function addRow(source?: CardStudioRow) {
    if (state.rows.length >= MAX_CARD_ROWS) {
      setError(`A table can contain at most ${MAX_CARD_ROWS} designs.`);
      return;
    }
    const row = createCardRow(
      source
        ? {
            ...source,
            id: crypto.randomUUID(),
            title: `${source.title} (copy)`,
            customFields: { ...source.customFields },
          }
        : {},
    );
    update({ ...state, rows: [...state.rows, row] });
    setSelectedId(row.id);
    setView('table');
  }

  function addColumn() {
    const column = newColumn.trim();
    if (!column) return;
    if (
      [
        'id',
        'copies',
        'customfields',
        '__proto__',
        'constructor',
        'prototype',
        ...BASE_CARD_FIELDS.map((field) => field.toLowerCase()),
        ...state.customColumns.map((field) => field.toLowerCase()),
      ].includes(column.toLowerCase())
    ) {
      setError('Choose a unique field name, such as flavor, attack, or faction.');
      return;
    }
    update({ ...state, customColumns: [...state.customColumns, column] });
    setNewColumn('');
    setAddingField(false);
  }

  function generate() {
    try {
      const cards = expandCardRows(state.rows);
      if (!cards.length) throw new Error('Add a design with at least one copy first.');
      update({
        ...state,
        generated: {
          generatedAt: new Date().toISOString(),
          sourceFingerprint: fingerprint,
          cards: cards.map(({ id, sourceRowId, copyNumber }) => ({
            id,
            sourceRowId,
            copyNumber,
          })),
        },
      });
      setView('deck');
      setPage(0);
      setStatus(`Generated ${cards.length} ${itemLabel} from ${state.rows.length} designs.`);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'The deck could not be generated.');
    }
  }

  function exportPrintSheet() {
    try {
      downloadCardFile(
        embedded
          ? buildComponentPrintHtml(state, project.name, paper, {
              faceId: 'all',
            })
          : buildCardPrintHtml(state, project.name, paper),
        `${cardExportFilename(project.name)}-${itemLabel}-${paper}.html`,
        'text/html;charset=utf-8',
      );
      setStatus('Print sheet downloaded. Open the HTML file, then choose Print / save as PDF at 100% scale.');
      setError('');
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'The print sheet could not be created.');
    }
  }

  return (
    <section
      className={`card-studio${embedded ? ' card-studio--embedded' : ''}`}
      aria-label={embedded ? 'Component data' : 'Card Studio'}
    >
      {!embedded && (
        <header className="card-studio-heading">
          <div className="card-studio-heading-title" data-region="card-studio-title">
            <span className="card-studio-title-icon">
              <Layers3 size={23} />
            </span>
            <div data-region="card-studio-title-copy">
              <span className="card-studio-eyebrow">From a table to the tabletop</span>
              <h1>Card Studio</h1>
              <p>Write it once. Make a whole beautiful deck.</p>
            </div>
          </div>
          <div className="card-studio-metrics" data-region="card-studio-counts">
            <span>
              <strong>{state.rows.length}</strong> designs
            </span>
            <span>
              <strong>{total}</strong> cards
            </span>
            <span className="card-studio-size">
              {state.template.widthMm} × {state.template.heightMm} mm
            </span>
          </div>
        </header>
      )}
      <div className="card-studio-workspace" data-region="card-studio-workspace">
        <section
          className="card-studio-data-panel"
          aria-label={embedded ? 'Component designs' : 'Card designs'}
        >
          <header className="card-studio-table-toolbar">
            <div
              className="card-studio-tabs"
              data-region="card-studio-view-switcher"
              role="group"
              aria-label={embedded ? 'Component data view' : 'Card view'}
            >
              <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>
                <Table2 size={15} /> Table
              </button>
              <button type="button" aria-pressed={view === 'deck'} onClick={() => setView('deck')}>
                <Grid2X2 size={15} /> {embedded ? 'Batch' : 'Deck'}
              </button>
            </div>
            <div className="card-studio-toolbar" data-region="card-table-actions">
              <button type="button" className="card-studio-button" onClick={() => setImporting(true)}>
                <FileUp size={14} /> Import
              </button>
              <button
                type="button"
                className="card-studio-button"
                onClick={() => setAddingField(!addingField)}
              >
                <Plus size={14} /> Field
              </button>
              <button type="button" className="card-studio-button is-primary" onClick={() => addRow()}>
                <Plus size={14} /> {embedded ? 'Row' : 'Card'}
              </button>
            </div>
          </header>
          {view === 'table' && (
            <div data-layout="tableAISelectedCell" className="table-ai-cell-toolbar">
              <span>
                {aiCell?.rowId && state.rows.some((row) => row.id === aiCell.rowId)
                  ? `${state.rows.find((row) => row.id === aiCell.rowId)?.title || 'Untitled design'} · ${aiFieldLabel(aiCell.field)}`
                  : 'Select a cell to edit it with AI, or use AI in a column header.'}
              </span>
              <button
                type="button"
                className="card-studio-button"
                disabled={!aiCell || !state.rows.some((row) => row.id === aiCell.rowId)}
                onClick={() => {
                  if (aiCell) ai.open(aiCell);
                }}
              >
                <Sparkles size={13} />
                AI edit selected cell
              </button>
              <button
                type="button"
                className="card-studio-button"
                disabled={!ai.canUndo}
                onClick={ai.undoLast}
              >
                <Undo2 size={13} />
                Undo AI edit
              </button>
              {ai.notice && <span role="status">{ai.notice}</span>}
            </div>
          )}
          {addingField && (
            <form
              className="card-studio-new-field"
              onSubmit={(event) => {
                event.preventDefault();
                addColumn();
              }}
            >
              <label className="card-studio-sr-only" htmlFor="card-studio-new-column">
                New field name
              </label>
              <input
                id="card-studio-new-column"
                autoFocus
                value={newColumn}
                onChange={(event) => setNewColumn(event.target.value)}
                placeholder="Field name: attack, flavor, faction…"
                maxLength={50}
              />
              <button type="submit" className="card-studio-button">
                Add field
              </button>
              <button
                type="button"
                className="card-studio-icon-button"
                aria-label="Cancel new field"
                onClick={() => setAddingField(false)}
              >
                <X size={15} />
              </button>
            </form>
          )}
          {view === 'table' ? (
            <CardTable
              rows={state.rows}
              customColumns={state.customColumns}
              selectedId={selected?.id}
              onSelect={setSelectedId}
              onAIColumn={(field) => ai.open({ field })}
              onCellSelect={(rowId, field) => setAICell({ rowId, field })}
              onChange={updateRow}
              onDuplicate={addRow}
              onRemove={(id) =>
                update({
                  ...state,
                  rows: state.rows.filter((row) => row.id !== id),
                })
              }
              onAdd={() => addRow()}
              onSamples={() => {
                const rows = createSampleRows();
                update({ ...state, rows });
                setSelectedId(rows[0].id);
              }}
            />
          ) : (
            <div className="card-studio-deck-scroll" data-region="card-deck-preview">
              {expanded.length ? (
                <div className="card-studio-deck-grid" data-region="card-deck-grid">
                  {expanded.slice(currentPage * 48, (currentPage + 1) * 48).map((card) => (
                    <button
                      type="button"
                      key={card.id}
                      className={`card-studio-deck-item ${selected?.id === card.sourceRowId ? 'is-selected' : ''}`}
                      aria-label={`Preview ${card.name}, copy ${card.copyNumber}`}
                      onClick={() => setSelectedId(card.sourceRowId)}
                    >
                      <CardPreview row={rowMap.get(card.sourceRowId)!} template={state.template} />
                      <span>
                        {card.name}
                        <small>Copy {card.copyNumber}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="card-studio-empty" data-region="card-deck-empty">
                  <Layers3 size={40} />
                  <h3>
                    {errors.length ? 'A few details need your attention.' : 'Your deck is waiting to happen.'}
                  </h3>
                  <p>
                    {errors.length
                      ? 'Finish the table fields below to preview your deck.'
                      : 'Add a card and set its copies to at least one.'}
                  </p>
                  <button type="button" className="card-studio-button" onClick={() => setView('table')}>
                    Back to the table
                  </button>
                </div>
              )}
            </div>
          )}
          {embedded && (
            <ComponentRowArtwork
              row={selected}
              onAttach={(id, artUrl) =>
                update({
                  ...state,
                  rows: state.rows.map((row) => (row.id === id ? { ...row, artUrl } : row)),
                })
              }
              onError={setError}
            />
          )}
          <footer className="card-studio-table-footer">
            <span>
              {view === 'table'
                ? 'Each row is a design. Copies repeats it in the batch. Set copies to 0 to keep a draft.'
                : `${expanded.length ? currentPage * 48 + 1 : 0}–${Math.min((currentPage + 1) * 48, expanded.length)} of ${expanded.length} ${itemLabel} · live template preview`}
            </span>
            {view === 'deck' && expanded.length > 48 && (
              <div className="card-studio-toolbar" data-region="card-deck-pagination">
                <button
                  type="button"
                  className="card-studio-icon-button"
                  aria-label="Previous card page"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  className="card-studio-icon-button"
                  aria-label="Next card page"
                  disabled={(currentPage + 1) * 48 >= expanded.length}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </footer>
        </section>
        {!embedded && (
          <TemplateInspector
            state={state}
            selected={selected}
            onTemplateChange={(template) => update({ ...state, template })}
            onRowChange={updateRow}
            onError={setError}
          />
        )}
      </div>
      {(error || errors.length > 0 || smallTextCount > 0 || status) && (
        <div
          className={`card-studio-notice ${error || errors.length ? 'is-error' : ''}`}
          data-region="card-studio-status"
          role={error || errors.length ? 'alert' : 'status'}
        >
          {error ||
            (errors.length
              ? `${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}`
              : status ||
                `${smallTextCount} design${smallTextCount === 1 ? ' has' : 's have'} small text. Review the preview before printing.`)}
        </div>
      )}
      <footer className="card-studio-footer">
        <div className="card-studio-batch-state" data-region="card-batch-state">
          {batchIsCurrent ? <Check size={16} /> : <Layers3 size={16} />}
          <span>
            <strong>
              {batchIsCurrent
                ? `${state.generated?.cards.length ?? total} ${itemLabel} generated`
                : state.generated
                  ? 'Your batch has new changes'
                  : 'Your next prototype starts here'}
            </strong>
            <small>
              {batchIsCurrent
                ? 'Saved in this project · ready for your next playtest'
                : state.generated
                  ? 'Generate again to capture the latest table and template.'
                  : 'Generate your pieces, then take them to the table.'}
            </small>
          </span>
        </div>
        <div className="card-studio-export-actions" data-region="card-export-actions">
          <button
            type="button"
            className="card-studio-button"
            disabled={!state.rows.length}
            onClick={() => {
              downloadCardFile(
                exportCardCsv(state.rows, state.customColumns),
                `${cardExportFilename(project.name)}-${itemLabel}.csv`,
                'text/csv;charset=utf-8',
              );
              setStatus('Design table downloaded as CSV, including your custom fields.');
            }}
            title="Download the editable design table"
          >
            <Download size={14} /> CSV
          </button>
          <button
            type="button"
            className="card-studio-button"
            disabled={!selected}
            onClick={() => {
              if (selected)
                downloadCardFile(
                  renderCardSvg(selected, state.template),
                  `${cardExportFilename(selected.title)}.svg`,
                  'image/svg+xml',
                );
            }}
            title="Download the selected design as an SVG"
          >
            SVG
          </button>
          <label className="card-studio-paper-choice">
            <span className="card-studio-sr-only">Print paper size</span>
            <select value={paper} onChange={(event) => setPaper(event.target.value as 'a4' | 'letter')}>
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
            </select>
          </label>
          <button
            type="button"
            className="card-studio-button"
            disabled={!total || errors.length > 0}
            onClick={exportPrintSheet}
          >
            <Printer size={15} /> Print sheet
          </button>
          <button
            type="button"
            className="card-studio-button is-primary"
            disabled={!total || errors.length > 0}
            onClick={generate}
          >
            <Layers3 size={15} /> Generate {total || ''} {itemLabel}
          </button>
        </div>
      </footer>
      {importing && (
        <ImportCardsDialog
          existingCount={state.rows.length}
          onClose={() => setImporting(false)}
          onImport={(result, replace) => {
            const existing = replace ? [] : state.rows;
            if (existing.length + result.rows.length > MAX_CARD_ROWS) {
              setError(`A table can contain at most ${MAX_CARD_ROWS} designs.`);
              setImporting(false);
              return;
            }
            const ids = new Set(existing.map((row) => row.id));
            const rows = result.rows.map((row) => {
              const id = ids.has(row.id) ? crypto.randomUUID() : row.id;
              ids.add(id);
              return { ...row, id };
            });
            const nextRows = [...existing, ...rows];
            const issues = validateCardRows(nextRows);
            if (issues.length) {
              setError(issues[0]);
              setImporting(false);
              return;
            }
            update({
              ...state,
              rows: nextRows,
              customColumns: [...new Set([...(replace ? [] : state.customColumns), ...result.customColumns])],
            });
            setImporting(false);
            setView('table');
            setSelectedId(rows[0]?.id);
            setStatus(`Imported ${rows.length} designs. Extra columns are ready to use as template fields.`);
          }}
        />
      )}
      {ai.selection && (
        <CardTableAIDialog ai={ai} studio={state} defaultModel={project.settings.aiModels.rulesWriter} />
      )}
    </section>
  );
}
