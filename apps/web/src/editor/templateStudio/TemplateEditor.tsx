import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  Circle,
  Copy,
  Grid3X3,
  ImagePlus,
  Layers3,
  Minus,
  Route,
  Shapes,
  Square,
  Trash2,
  Type,
} from 'lucide-react';
import type {
  ComponentDesignDocument,
  TemplateComponentKind,
  TemplateLayer,
  TemplateLayerType,
} from './types';
import {
  createTemplateDocument,
  createTemplateLayer,
  normalizeTemplateDocument,
  MAX_TEMPLATE_FACES,
} from './model';
import {
  alignTemplateLayers,
  arrangeTemplateLayers,
  duplicateTemplateLayers,
  updateTemplateFace,
  type TemplateAlignment,
} from './editorActions';
import { useTemplateHistory } from './useTemplateHistory';
import { LayerList } from './LayerList';
import { LayerInspector } from './LayerInspector';
import { DocumentInspector } from './DocumentInspector';
import { TemplateCanvas } from './TemplateCanvas';
import { TemplateToolbar } from './TemplateToolbar';
import { TemplateDialogs } from './TemplateDialogs';
import { resizeTemplateDocument } from './resize';
import './templateEditor.css';
import './templateEditorPanels.css';

interface TemplateEditorProps {
  document: ComponentDesignDocument;
  data: Record<string, string>;
  fields: string[];
  onChange: (document: ComponentDesignDocument) => void;
  title?: string;
  kind?: TemplateComponentKind;
  records?: Array<{ id: string; label: string; data: Record<string, string> }>;
  onBack?: () => void;
}

export function TemplateEditor({
  document,
  data,
  fields,
  onChange,
  title = 'Component',
  kind = 'card',
  records = [],
  onBack,
}: TemplateEditorProps) {
  const [faceId, setFaceId] = useState(document.faces[0].id);
  const [recordId, setRecordId] = useState(records[0]?.id ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [guides, setGuides] = useState(true);
  const [grid, setGrid] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'layer' | 'document'>('document');
  const [notice, setNotice] = useState(
    'Drag to move. Use the corner handles to resize. Every detail is yours.',
  );
  const [library, setLibrary] = useState(false);
  const [pending, setPending] = useState<{ name: string; document: ComponentDesignDocument } | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'canvas' | 'layers' | 'inspector'>('canvas');
  const clipboard = useRef<TemplateLayer[]>([]);
  const importInput = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLElement>(null);
  const importRequest = useRef(0);
  useEffect(
    () => () => {
      importRequest.current += 1;
    },
    [],
  );
  const history = useTemplateHistory(document, onChange);
  const face = document.faces.find((item) => item.id === faceId) ?? document.faces[0];
  const selected = face.layers.filter((layer) => selectedIds.includes(layer.id));
  const previewData = records.find((row) => row.id === recordId)?.data ?? data;
  const layer = selected.length === 1 ? selected[0] : null;
  const changeLayers = (layers: TemplateLayer[]) =>
    history.commit(updateTemplateFace(document, face.id, (current) => ({ ...current, layers })));
  const select = (ids: string[]) => {
    setSelectedIds(ids);
    if (ids.length) setInspectorTab('layer');
  };
  const switchFace = (id: string) => {
    setFaceId(id);
    setSelectedIds([]);
    setInspectorTab('document');
  };

  function add(type: TemplateLayerType, shape?: 'rectangle' | 'ellipse' | 'line' | 'polygon') {
    if (face.layers.length >= 300) {
      setNotice('A face can have up to 300 layers. Remove or reuse a layer to make room.');
      return;
    }
    let next = createTemplateLayer(type, document);
    if (next.type === 'shape' && shape)
      next = {
        ...next,
        shape,
        name:
          shape === 'line'
            ? 'Line'
            : shape === 'ellipse'
              ? 'Ellipse'
              : shape === 'polygon'
                ? 'Polygon'
                : 'Rectangle',
        ...(shape === 'line' ? { height: 0.5, fill: 'none' } : {}),
      };
    changeLayers([...face.layers, next]);
    select([next.id]);
    setNotice(`${next.name} added. Drag it into place or edit its properties.`);
  }

  function remove() {
    const removable = selected.filter((item) => !item.locked).map((item) => item.id);
    if (!removable.length) return;
    changeLayers(face.layers.filter((item) => !removable.includes(item.id)));
    setSelectedIds(selectedIds.filter((id) => !removable.includes(id)));
    setNotice(
      `${removable.length} layer${removable.length === 1 ? '' : 's'} removed. Undo brings them back.`,
    );
  }

  function duplicate() {
    if (!selected.length || face.layers.length + selected.length > 300) return;
    const result = duplicateTemplateLayers(face.layers, selectedIds, document.gridMm || 2);
    changeLayers(result.layers);
    select(result.ids);
  }

  function arrange(direction: 'front' | 'back' | 'up' | 'down') {
    changeLayers(arrangeTemplateLayers(face.layers, selectedIds, direction));
  }

  function align(alignment: TemplateAlignment) {
    changeLayers(
      alignTemplateLayers(face.layers, selectedIds, alignment, document.widthMm, document.heightMm),
    );
    setNotice(selected.length === 1 ? 'Layer aligned to the component.' : 'Selected layers aligned.');
  }

  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('dialog')) {
      // Keep native dialog/input behavior without reaching the project-wide undo listener.
      event.stopPropagation();
      return;
    }
    if (
      ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName) ||
      (event.target as HTMLElement).isContentEditable
    )
      return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    let handled = true;
    if (mod && key === 'z') {
      if (event.shiftKey) history.redo();
      else history.undo();
    } else if (mod && key === 'y') history.redo();
    else if (mod && key === 'd') duplicate();
    else if (mod && key === 'a') select(face.layers.filter((item) => item.visible).map((item) => item.id));
    else if (mod && key === 'c') {
      clipboard.current = selected.map((item) => ({ ...item }));
      setNotice('Layers copied. Paste on this face or another.');
    } else if (mod && key === 'v' && clipboard.current.length) {
      const copies = clipboard.current.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        locked: false,
        x: item.x + 2,
        y: item.y + 2,
      }));
      if (face.layers.length + copies.length <= 300) {
        changeLayers([...face.layers, ...copies]);
        select(copies.map((item) => item.id));
      }
    } else if (key === 'delete' || key === 'backspace') remove();
    else if (key === 'escape') {
      setSelectedIds([]);
      setLibrary(false);
      setPending(null);
    } else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key) && selected.length) {
      const step = event.shiftKey ? 10 : event.altKey ? 0.1 : document.gridMm;
      changeLayers(
        face.layers.map((item) =>
          selectedIds.includes(item.id) && !item.locked
            ? {
                ...item,
                x: item.x + (key === 'arrowright' ? step : key === 'arrowleft' ? -step : 0),
                y: item.y + (key === 'arrowdown' ? step : key === 'arrowup' ? -step : 0),
              }
            : item,
        ),
      );
    } else handled = false;
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  async function importTemplate(file?: File) {
    if (!file) return;
    const request = ++importRequest.current;
    try {
      if (file.size > 20_000_000) throw new Error('Choose a template file smaller than 20 MB.');
      const parsed = JSON.parse(await file.text()) as { format?: string; document?: ComponentDesignDocument };
      if (
        parsed.format !== 'turnbased-component-template' ||
        parsed.document?.schemaVersion !== 1 ||
        !Array.isArray(parsed.document.faces) ||
        !parsed.document.faces.length
      )
        throw new Error('Choose a TurnBased component template JSON file.');
      if (
        parsed.document.faces.length > MAX_TEMPLATE_FACES ||
        parsed.document.faces.some((item) => !Array.isArray(item.layers) || item.layers.length > 300)
      )
        throw new Error('This template exceeds the supported face or layer count.');
      if (request === importRequest.current)
        setPending({ name: file.name, document: normalizeTemplateDocument(parsed.document) });
    } catch (error) {
      if (request === importRequest.current)
        setNotice(error instanceof Error ? error.message : 'Could not read this template.');
    }
  }

  function choosePreset(preset: string) {
    const next =
      preset === 'blank'
        ? { ...document, faces: document.faces.map((item) => ({ ...item, layers: [] })) }
        : createTemplateDocument(kind, preset);
    setPending({
      name: `${preset[0].toUpperCase()}${preset.slice(1)} layout`,
      document: resizeTemplateDocument(next, document.widthMm, document.heightMm, true),
    });
  }

  return (
    <section
      ref={root}
      className={`template-editor template-mobile-${mobilePanel}`}
      aria-label="Visual template editor"
      tabIndex={-1}
      onKeyDown={keyboard}
    >
      <TemplateToolbar
        document={document}
        face={face}
        title={title}
        previewData={previewData}
        history={history}
        guides={guides}
        grid={grid}
        onBack={onBack}
        onOpenLibrary={() => setLibrary(true)}
        onSelectFace={switchFace}
        onManageFaces={() => {
          setInspectorTab('document');
          setMobilePanel('inspector');
        }}
        onToggleGuides={() => setGuides(!guides)}
        onToggleGrid={() => setGrid(!grid)}
        onImport={() => importInput.current?.click()}
        onNotice={setNotice}
      />
      <div data-layout="templateMobileTabs" className="template-mobile-tabs">
        {(['layers', 'canvas', 'inspector'] as const).map((panel) => (
          <button key={panel} aria-pressed={mobilePanel === panel} onClick={() => setMobilePanel(panel)}>
            {panel}
          </button>
        ))}
      </div>
      <div data-layout="templateEditorWorkspace" className="template-editor-workspace">
        <aside className="template-layers-panel" aria-label="Template layers and tools">
          <header>
            <span>
              <Layers3 size={14} />
              Layers
            </span>
            <small>{face.layers.length}</small>
          </header>
          <div data-layout="templateAddTools" className="template-add-tools">
            <button aria-label="Add text layer" onClick={() => add('text')}>
              <Type size={16} />
              Text
            </button>
            <button aria-label="Add image layer" onClick={() => add('image')}>
              <ImagePlus size={16} />
              Image
            </button>
            <button aria-label="Add rectangle layer" onClick={() => add('shape', 'rectangle')}>
              <Square size={16} />
              Rectangle
            </button>
            <button aria-label="Add ellipse layer" onClick={() => add('shape', 'ellipse')}>
              <Circle size={16} />
              Ellipse
            </button>
            <button aria-label="Add line layer" onClick={() => add('shape', 'line')}>
              <Minus size={16} />
              Line
            </button>
            <button aria-label="Add polygon layer" onClick={() => add('shape', 'polygon')}>
              <Shapes size={16} />
              Polygon
            </button>
            <button aria-label="Add board grid" onClick={() => add('grid')}>
              <Grid3X3 size={16} />
              Grid
            </button>
            <button aria-label="Add numbered track" onClick={() => add('track')}>
              <Route size={16} />
              Track
            </button>
          </div>
          <LayerList
            layers={face.layers}
            selectedIds={selectedIds}
            onSelect={select}
            onChange={changeLayers}
          />
          <footer>
            <button
              disabled={!selected.length}
              aria-label="Duplicate selected layers"
              title="Duplicate · Ctrl/Cmd D"
              onClick={duplicate}
            >
              <Copy size={14} />
            </button>
            <button
              disabled={!selected.length}
              aria-label="Bring selected layers to front"
              title="Bring to front"
              onClick={() => arrange('front')}
            >
              <ArrowUpToLine size={14} />
            </button>
            <button
              disabled={!selected.length}
              aria-label="Send selected layers to back"
              title="Send to back"
              onClick={() => arrange('back')}
            >
              <ArrowDownToLine size={14} />
            </button>
            <button
              disabled={!selected.some((item) => !item.locked)}
              aria-label="Delete selected layers"
              title="Delete selected layers"
              onClick={remove}
            >
              <Trash2 size={14} />
            </button>
          </footer>
        </aside>
        <div data-layout="templateCenterWorkspace" className="template-center-workspace">
          <div data-layout="templatePreviewAndAlignment" className="template-context-bar">
            <label>
              Preview
              <select
                aria-label="Preview data row"
                value={recordId}
                onChange={(event) => setRecordId(event.target.value)}
              >
                {records.length ? (
                  records.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label || 'Untitled row'}
                    </option>
                  ))
                ) : (
                  <option value="">{previewData.title || title}</option>
                )}
              </select>
            </label>
            <div data-layout="templateAlignmentTools" className="template-alignment-tools">
              <button
                disabled={!selected.length}
                title="Align left"
                aria-label="Align layers left"
                onClick={() => align('left')}
              >
                <AlignLeft size={14} />
              </button>
              <button
                disabled={!selected.length}
                title="Align horizontal centers"
                aria-label="Align layers center"
                onClick={() => align('center')}
              >
                <AlignCenter size={14} />
              </button>
              <button
                disabled={!selected.length}
                title="Align right"
                aria-label="Align layers right"
                onClick={() => align('right')}
              >
                <AlignRight size={14} />
              </button>
              <select
                aria-label="More layer arrangement"
                value=""
                disabled={!selected.length}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === 'up' || value === 'down') arrange(value);
                  else if (value) align(value as TemplateAlignment);
                }}
              >
                <option value="">Arrange…</option>
                <option value="top">Align top</option>
                <option value="middle">Align vertical centers</option>
                <option value="bottom">Align bottom</option>
                <option value="distribute-x">Distribute horizontally</option>
                <option value="distribute-y">Distribute vertically</option>
                <option value="up">Move forward</option>
                <option value="down">Move backward</option>
              </select>
            </div>
          </div>
          <TemplateCanvas
            key={face.id}
            document={document}
            faceId={face.id}
            data={previewData}
            selectedIds={selectedIds}
            onSelect={select}
            onChangeLayers={changeLayers}
            onEditText={() => {
              setInspectorTab('layer');
              setMobilePanel('inspector');
              requestAnimationFrame(() =>
                root.current?.querySelector<HTMLTextAreaElement>('#template-text-content')?.focus(),
              );
            }}
            guides={guides}
            grid={grid}
          />
        </div>
        <aside className="template-properties-panel" aria-label="Template properties">
          <header>
            <button aria-pressed={inspectorTab === 'layer'} onClick={() => setInspectorTab('layer')}>
              Layer
            </button>
            <button aria-pressed={inspectorTab === 'document'} onClick={() => setInspectorTab('document')}>
              Template
            </button>
            <ChevronDown size={13} />
          </header>
          <div data-layout="templatePropertiesBody" className="template-properties-body">
            {inspectorTab === 'document' ? (
              <DocumentInspector
                key={face.id}
                document={document}
                face={face}
                onChange={history.commit}
                onFaceSelect={switchFace}
              />
            ) : layer ? (
              <LayerInspector
                key={layer.id}
                layer={layer}
                fields={fields}
                onChange={(next) =>
                  changeLayers(face.layers.map((item) => (item.id === next.id ? next : item)))
                }
                onDelete={remove}
              />
            ) : (
              <div data-layout="templateSelectionHint" className="template-selection-hint">
                <Layers3 size={30} />
                <h3>{selected.length ? `${selected.length} layers selected` : 'Make it your own.'}</h3>
                <p>
                  {selected.length
                    ? 'Move, align, duplicate, or arrange these layers together. Shift-click a layer to adjust the selection.'
                    : 'Select a layer on the canvas or in the list to edit every detail.'}
                </p>
                <button onClick={() => setInspectorTab('document')}>Edit component size & faces</button>
              </div>
            )}
          </div>
        </aside>
      </div>
      <footer className="template-statusbar">
        <span role="status">{notice}</span>
        <span>
          {selected.length ? `${selected.length} selected · ` : ''}
          {document.widthMm} × {document.heightMm} mm · {document.snapToGrid ? 'Snap on' : 'Free movement'}
        </span>
      </footer>
      <input
        ref={importInput}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="Import template file"
        onChange={(event) => {
          void importTemplate(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <TemplateDialogs
        library={library}
        pending={pending}
        onCloseLibrary={() => setLibrary(false)}
        onChoosePreset={choosePreset}
        onKeepCurrent={() => setPending(null)}
        onApplyPending={() => {
          if (!pending) return;
          history.commit(pending.document);
          switchFace(pending.document.faces[0].id);
          setPending(null);
          setLibrary(false);
          setNotice('New template applied. Every layer is ready to edit.');
        }}
      />
    </section>
  );
}
