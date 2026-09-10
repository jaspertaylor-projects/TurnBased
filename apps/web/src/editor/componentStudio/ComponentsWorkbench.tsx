import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Download,
  Layers3,
  LayoutGrid,
  Map,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Table2,
  Trash2,
} from 'lucide-react';
import type { EditorProject } from '../types';
import type { CardStudioState } from '../cardStudio/types';
import type { TemplateComponentKind } from '../templateStudio/types';
import { TemplateEditor } from '../templateStudio/TemplateEditor';
import { createTemplateDocument, migrateCardTemplate, rowTemplateData } from '../templateStudio/model';
import { renderDesignSvg } from '../templateStudio/render';
import { CardStudioSection } from '../sections/CardStudioSection';
import { BASE_CARD_FIELDS } from '../cardStudio/model';
import { downloadFile, fileStem } from '../exports/download';
import { ComponentDialog, CreateComponentDialog, RenameComponentDialog } from './ComponentDialogs';
import { ComponentPhysicalPanel } from './ComponentPhysicalPanel';
import { COMPONENT_FAMILIES, type ProjectDesignSet } from './types';
import {
  createStudioComponent,
  duplicateStudioComponent,
  LEGACY_DESIGN_SET_ID,
  listProjectDesignSets,
  materializeLegacyDesign,
  removeStudioComponent,
  renameStudioComponent,
  setProjectComponentDesign,
} from './model';
import './components.css';
import './componentSurfaces.css';

type WorkbenchTab = 'template' | 'data' | 'physical';
interface ComponentsWorkbenchProps {
  project: EditorProject;
  onChange: (project: EditorProject) => void;
  onOpenPlacement: (id: string) => void;
  initialKind?: TemplateComponentKind;
  selectedComponentId?: string | null;
}

function ComponentThumbnail({ design }: { design: ProjectDesignSet }) {
  const document =
    design.studio.template.document ??
    (design.kind === 'card'
      ? migrateCardTemplate(design.studio.template)
      : createTemplateDocument(design.kind));
  const row = design.studio.rows[0];
  const svg = renderDesignSvg(document, {
    data: row ? rowTemplateData(row) : { title: design.name },
    idPrefix: `gallery-${design.id}`,
  });
  return (
    <div
      data-layout="componentTemplateThumbnail"
      className={`component-thumbnail component-thumbnail--${design.kind}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function ComponentsWorkbench({
  project,
  onChange,
  onOpenPlacement,
  initialKind,
  selectedComponentId,
}: ComponentsWorkbenchProps) {
  const [selectedId, setSelectedId] = useState<string | null>(selectedComponentId ?? null);
  const latest = useRef({ project, onChange });
  useLayoutEffect(() => {
    latest.current = { project, onChange };
  });
  const [filter, setFilter] = useState<TemplateComponentKind | 'all'>(initialKind ?? 'all');
  const [tab, setTab] = useState<WorkbenchTab>('template');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState('');
  const sets = useMemo(() => listProjectDesignSets(project), [project]);
  const selected = sets.find((set) => set.id === selectedId) ?? null;
  const filtered = sets.filter(
    (set) =>
      (filter === 'all' || set.kind === filter) && set.name.toLowerCase().includes(query.toLowerCase()),
  );
  const totalCopies = sets.reduce(
    (sum, set) => sum + set.studio.rows.reduce((total, row) => total + row.copies, 0),
    0,
  );

  function run(action: () => void) {
    try {
      setStatus('');
      action();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'This change could not be made.');
    }
  }

  function openDesign(design: ProjectDesignSet) {
    run(() => {
      if (design.id === LEGACY_DESIGN_SET_ID) {
        const result = materializeLegacyDesign(project);
        onChange(result.project);
        setSelectedId(result.instanceId);
      } else {
        // Materialize the deterministic starter on first open. Existing component
        // identity, placement, children, and supplier configuration are preserved.
        if (!project.componentDesigns?.[design.id])
          onChange(setProjectComponentDesign(project, design.id, design.studio));
        setSelectedId(design.id);
      }
      setTab('template');
    });
  }

  function updateStudio(studio: CardStudioState) {
    if (!selected) return;
    run(() => onChange(setProjectComponentDesign(project, selected.id, studio)));
  }

  function create(kind: TemplateComponentKind, name: string) {
    run(() => {
      const result = createStudioComponent(project, kind, name);
      onChange(result.project);
      setSelectedId(result.instanceId);
      setTab('template');
      setCreating(false);
    });
  }

  function duplicate() {
    if (!selected) return;
    run(() => {
      const result = duplicateStudioComponent(project, selected.id);
      onChange(result.project);
      setSelectedId(result.instanceId);
      setStatus('A new copy is ready. The original component is unchanged.');
    });
  }

  const family = selected && COMPONENT_FAMILIES.find((item) => item.kind === selected.kind);
  const row = selected?.studio.rows[0];
  const document = selected
    ? (selected.studio.template.document ??
      (selected.kind === 'card'
        ? migrateCardTemplate(selected.studio.template)
        : createTemplateDocument(selected.kind)))
    : null;

  return (
    <section
      className={`components-workbench${selected ? ' components-workbench--editing' : ''}`}
      aria-label="Components workbench"
    >
      <header className="components-heading">
        <div data-layout="componentWorkbenchIdentity" className="components-heading-copy">
          {selected ? (
            <>
              <button
                className="component-back"
                onClick={() => {
                  setSelectedId(null);
                  setStatus('');
                }}
              >
                <ArrowLeft size={13} />
                All components
              </button>
              <div data-layout="selectedComponentTitle" className="component-title-row">
                <h1>{selected.name}</h1>
                <button
                  className="component-icon-button"
                  aria-label="Rename component"
                  onClick={() => setRenaming(true)}
                >
                  <Pencil size={14} />
                </button>
                <span>{family?.singular}</span>
              </div>
            </>
          ) : (
            <>
              <h1>Components</h1>
              <p className="component-muted">
                Design cards, boards, tokens, and other pieces with templates and tables.
              </p>
            </>
          )}
        </div>
        <div data-layout="componentWorkbenchActions" className="components-heading-actions">
          {selected ? (
            <>
              <button
                className="component-icon-button"
                title="Duplicate component"
                aria-label="Duplicate component"
                onClick={duplicate}
              >
                <Copy size={16} />
              </button>
              <button
                className="component-icon-button"
                title="Export component design"
                aria-label="Export component design"
                onClick={() =>
                  run(() => {
                    downloadFile(
                      `${fileStem(selected.name)}-component.json`,
                      JSON.stringify(
                        {
                          format: 'turnbased-component-design',
                          schemaVersion: 1,
                          name: selected.name,
                          kind: selected.kind,
                          studio: selected.studio,
                        },
                        null,
                        2,
                      ),
                    );
                    setStatus('Component design downloaded. Full-game backups live in Print & share.');
                  })
                }
              >
                <Download size={16} />
              </button>
              <button
                className="component-icon-button"
                title="Delete component"
                aria-label="Delete component"
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={16} />
              </button>
            </>
          ) : (
            <button className="component-button component-button--primary" onClick={() => setCreating(true)}>
              <Plus size={16} />
              New component
            </button>
          )}
        </div>
      </header>

      {selected ? (
        <>
          <nav className="component-tabs" aria-label="Component editing tools">
            {(
              [
                { id: 'template', label: 'Template', icon: Pencil },
                { id: 'data', label: 'Data & copies', icon: Table2 },
                {
                  id: 'physical',
                  label: 'Physical specs',
                  icon: SlidersHorizontal,
                },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                className={tab === item.id ? 'is-active' : ''}
                aria-pressed={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                <item.icon size={14} />
                {item.label}
              </button>
            ))}
            {selected.instanceId && (
              <button onClick={() => onOpenPlacement(selected.instanceId!)}>
                <Map size={14} />
                Table placement
              </button>
            )}
          </nav>
          <div data-layout="componentEditorBody" className="component-editor-body">
            {tab === 'template' && document && (
              <TemplateEditor
                key={selected.id}
                document={document}
                kind={selected.kind}
                records={selected.studio.rows.map((item) => ({
                  id: item.id,
                  label: item.title || 'Untitled design',
                  data: rowTemplateData(item),
                }))}
                data={row ? rowTemplateData(row) : { title: selected.name }}
                fields={[...BASE_CARD_FIELDS, 'copies', ...selected.studio.customColumns]}
                title={selected.name}
                onChange={(next) =>
                  updateStudio({
                    ...selected.studio,
                    template: {
                      ...selected.studio.template,
                      widthMm: next.widthMm,
                      heightMm: next.heightMm,
                      document: next,
                    },
                  })
                }
              />
            )}
            {tab === 'data' && (
              <div data-layout="componentTableSurface" className="component-data-surface">
                <CardStudioSection
                  key={selected.id}
                  embedded
                  studioKey={selected.id}
                  itemLabel={family?.label.toLowerCase() ?? 'pieces'}
                  project={{
                    ...project,
                    name: selected.name,
                    cardStudio: selected.studio,
                  }}
                  onChange={(next) => {
                    if (next.cardStudio) updateStudio(next.cardStudio);
                  }}
                  onUpdateStudio={(updater) => {
                    const current = latest.current;
                    const design = listProjectDesignSets(current.project).find(
                      (item) => item.id === selected.id,
                    );
                    if (!design) throw new Error('This component no longer exists.');
                    const next = setProjectComponentDesign(
                      current.project,
                      design.id,
                      updater(design.studio),
                    );
                    latest.current = { ...current, project: next };
                    current.onChange(next);
                  }}
                />
              </div>
            )}
            {tab === 'physical' && (
              <ComponentPhysicalPanel
                project={project}
                design={selected}
                onChange={onChange}
                onOpenPlacement={onOpenPlacement}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <div data-layout="componentFilters" className="component-gallery-toolbar">
            <nav aria-label="Component families">
              <button
                aria-pressed={filter === 'all'}
                className={filter === 'all' ? 'is-active' : ''}
                onClick={() => setFilter('all')}
              >
                <LayoutGrid size={13} />
                All <span>{sets.length}</span>
              </button>
              {COMPONENT_FAMILIES.map((item) => (
                <button
                  key={item.kind}
                  aria-pressed={filter === item.kind}
                  className={filter === item.kind ? 'is-active' : ''}
                  onClick={() => setFilter(item.kind)}
                >
                  {item.label}
                  <span>{sets.filter((set) => set.kind === item.kind).length}</span>
                </button>
              ))}
            </nav>
            <label className="component-search">
              <Search size={14} />
              <input
                aria-label="Search components"
                placeholder="Find a component…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <div data-layout="componentGalleryBody" className="component-gallery-body">
            {filtered.length ? (
              <div data-layout="componentDesignGrid" className="component-design-grid">
                {filtered.map((design) => (
                  <button
                    className="component-design-card"
                    key={design.id}
                    onClick={() => openDesign(design)}
                  >
                    <ComponentThumbnail design={design} />
                    <div data-layout="componentCardIdentity" className="component-card-identity">
                      <span className="component-eyebrow">
                        {COMPONENT_FAMILIES.find((item) => item.kind === design.kind)?.singular}
                      </span>
                      <h2>{design.name}</h2>
                      <p>
                        {design.studio.rows.length} design
                        {design.studio.rows.length === 1 ? '' : 's'} ·{' '}
                        {design.studio.rows.reduce((sum, item) => sum + item.copies, 0)} copies
                      </p>
                      <span className="component-card-size">
                        {design.studio.template.widthMm} × {design.studio.template.heightMm} mm{' '}
                        <ArrowRight size={13} />
                      </span>
                    </div>
                  </button>
                ))}
                <button className="component-create-card" onClick={() => setCreating(true)}>
                  <Plus size={30} strokeWidth={1.2} />
                  <strong>One more piece of the puzzle.</strong>
                  <span>Create a component</span>
                </button>
              </div>
            ) : (
              <div data-layout="emptyComponentFamily" className="component-empty">
                <Layers3 size={36} strokeWidth={1.2} />
                <h2>{query ? 'No matching components' : 'No components yet'}</h2>
                <p>
                  {query
                    ? 'Try a different name or another family.'
                    : 'Start with a deck, a board, or a handful of tokens. Each gets the same editable design tools.'}
                </p>
                <button
                  className="component-button component-button--primary"
                  onClick={() => {
                    if (query) setQuery('');
                    else setCreating(true);
                  }}
                >
                  {query ? 'Clear search' : 'Create your first component'}
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </>
      )}
      <footer className="components-footer" role="status">
        <span>
          {status ||
            (selected
              ? 'Template changes apply to every row. Save a checkpoint before a big experiment.'
              : `${sets.length} component sets · ${totalCopies} pieces to bring to the table`)}
        </span>
        {selected && (
          <span>
            {selected.studio.rows.length} designs · {selected.studio.template.widthMm} ×{' '}
            {selected.studio.template.heightMm} mm
          </span>
        )}
      </footer>
      {creating && (
        <CreateComponentDialog
          initialKind={filter === 'all' ? 'card' : filter}
          onClose={() => setCreating(false)}
          onCreate={create}
        />
      )}
      {renaming && selected && (
        <RenameComponentDialog
          name={selected.name}
          onClose={() => setRenaming(false)}
          onRename={(name) =>
            run(() => {
              const result = renameStudioComponent(project, selected.id, name);
              onChange(result.project);
              setSelectedId(result.instanceId);
              setRenaming(false);
            })
          }
        />
      )}
      {deleting && selected && (
        <ComponentDialog title={`Delete ${selected.name}?`} onClose={() => setDeleting(false)}>
          <p className="component-muted">
            This removes the component, its design table, and any placed children from your current draft.
            Saved checkpoints still keep their earlier versions.
          </p>
          <footer>
            <button className="component-button" onClick={() => setDeleting(false)}>
              Keep component
            </button>
            <button
              className="component-button component-button--danger"
              onClick={() =>
                run(() => {
                  onChange(removeStudioComponent(project, selected.id));
                  setSelectedId(null);
                  setDeleting(false);
                })
              }
            >
              Delete component
            </button>
          </footer>
        </ComponentDialog>
      )}
    </section>
  );
}
