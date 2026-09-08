import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Hand, Minus, MousePointer2, Plus, Scan } from 'lucide-react';
import type { ComponentDesignDocument, TemplateLayer } from './types';
import { renderDesignSvg } from './render';
import { snapTemplateValue, templateLayersBounds } from './editorActions';

type Gesture = {
  kind: 'move' | 'resize' | 'rotate';
  pointerId: number;
  startX: number;
  startY: number;
  rotation: number;
  original: TemplateLayer[];
  selected: string[];
  bounds: { x: number; y: number; width: number; height: number };
  handle?: string;
};
interface TemplateCanvasProps {
  document: ComponentDesignDocument;
  faceId: string;
  data: Record<string, string>;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onChangeLayers: (layers: TemplateLayer[]) => void;
  onEditText: () => void;
  guides: boolean;
  grid: boolean;
}

export function TemplateCanvas({
  document,
  faceId,
  data,
  selectedIds,
  onSelect,
  onChangeLayers,
  onEditText,
  guides,
  grid,
}: TemplateCanvasProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const artwork = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const latestDraft = useRef<TemplateLayer[] | null>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [size, setSize] = useState({ width: 600, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [hand, setHand] = useState(false);
  const [draft, setDraft] = useState<TemplateLayer[] | null>(null);
  const face = document.faces.find((item) => item.id === faceId) ?? document.faces[0];
  const layers = draft ?? face.layers;
  const selected = layers.filter((layer) => selectedIds.includes(layer.id) && layer.visible);
  const editableSelected = selected.filter((layer) => !layer.locked);
  const bounds = templateLayersBounds(editableSelected);
  const fitScale = Math.max(
    0.02,
    Math.min((size.width - 120) / document.widthMm, (size.height - 120) / document.heightMm),
  );
  const scale = fitScale * zoom;
  const markup = useMemo(() => {
    const preview = draft
      ? {
          ...document,
          faces: document.faces.map((item) => (item.id === faceId ? { ...item, layers: draft } : item)),
        }
      : document;
    return renderDesignSvg(preview, { faceId, data, showGuides: guides, idPrefix: 'template-canvas' });
  }, [document, draft, faceId, data, guides]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const resize = new ResizeObserver(() =>
      setSize({ width: element.clientWidth, height: element.clientHeight }),
    );
    resize.observe(element);
    const wheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      setZoom((current) => Math.max(0.2, Math.min(12, current * (event.deltaY < 0 ? 1.12 : 1 / 1.12))));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      resize.disconnect();
      element.removeEventListener('wheel', wheel);
    };
  }, []);

  function pointerPosition(event: PointerEvent) {
    const rect = artwork.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
  }

  function start(event: PointerEvent<HTMLDivElement>) {
    if (event.button === 1 || hand) {
      event.preventDefault();
      const area = viewport.current!;
      pan.current = { x: event.clientX, y: event.clientY, left: area.scrollLeft, top: area.scrollTop };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    const target = event.target as Element;
    const handle = target.closest('[data-resize-handle]')?.getAttribute('data-resize-handle');
    const rotate = Boolean(target.closest('[data-rotate-handle]'));
    const id = target.closest('[data-layer-id]')?.getAttribute('data-layer-id');
    if (!id && !handle && !rotate) {
      if (!event.shiftKey) onSelect([]);
      return;
    }
    const layer = face.layers.find((item) => item.id === id);
    if (layer?.locked) {
      onSelect([layer.id]);
      return;
    }
    let ids = [...selectedIds];
    if (layer) {
      if (event.shiftKey) {
        ids = ids.includes(layer.id) ? ids.filter((value) => value !== layer.id) : [...ids, layer.id];
        onSelect(ids);
        return;
      }
      if (!ids.includes(layer.id)) {
        ids = [layer.id];
        onSelect(ids);
      }
    }
    const movable = face.layers.filter((item) => ids.includes(item.id) && !item.locked && item.visible);
    const startBounds = templateLayersBounds(movable);
    if (!startBounds) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    gesture.current = {
      kind: rotate ? 'rotate' : handle ? 'resize' : 'move',
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      rotation: movable.length === 1 ? movable[0].rotation : 0,
      original: face.layers,
      selected: movable.map((item) => item.id),
      bounds: startBounds,
      handle: handle ?? undefined,
    };
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (pan.current) {
      viewport.current!.scrollLeft = pan.current.left - (event.clientX - pan.current.x);
      viewport.current!.scrollTop = pan.current.top - (event.clientY - pan.current.y);
      return;
    }
    const active = gesture.current;
    if (!active) return;
    const point = pointerPosition(event);
    const snap = (value: number) =>
      snapTemplateValue(value, document.gridMm, document.snapToGrid && !event.altKey);
    const rawDx = point.x - active.startX;
    const rawDy = point.y - active.startY;
    const angle = (active.rotation * Math.PI) / 180;
    const dx = active.kind === 'resize' ? rawDx * Math.cos(angle) + rawDy * Math.sin(angle) : rawDx;
    const dy = active.kind === 'resize' ? -rawDx * Math.sin(angle) + rawDy * Math.cos(angle) : rawDy;
    let next: TemplateLayer[];
    if (active.kind === 'rotate') {
      const cx = active.bounds.x + active.bounds.width / 2;
      const cy = active.bounds.y + active.bounds.height / 2;
      let delta =
        ((Math.atan2(point.y - cy, point.x - cx) - Math.atan2(active.startY - cy, active.startX - cx)) *
          180) /
        Math.PI;
      if (event.shiftKey) delta = Math.round((active.rotation + delta) / 15) * 15 - active.rotation;
      const radians = (delta * Math.PI) / 180;
      next = active.original.map((layer) => {
        if (!active.selected.includes(layer.id)) return layer;
        const cxOffset = layer.x + layer.width / 2 - cx;
        const cyOffset = layer.y + layer.height / 2 - cy;
        return {
          ...layer,
          rotation: Math.round((layer.rotation + delta) * 10) / 10,
          x: cx + cxOffset * Math.cos(radians) - cyOffset * Math.sin(radians) - layer.width / 2,
          y: cy + cxOffset * Math.sin(radians) + cyOffset * Math.cos(radians) - layer.height / 2,
        };
      });
    } else if (active.kind === 'move') {
      const offsetX = snap(active.bounds.x + dx) - active.bounds.x;
      const offsetY = snap(active.bounds.y + dy) - active.bounds.y;
      next = active.original.map((layer) =>
        active.selected.includes(layer.id) ? { ...layer, x: layer.x + offsetX, y: layer.y + offsetY } : layer,
      );
    } else {
      const box = active.bounds;
      let x = active.handle!.includes('w') ? Math.min(box.x + box.width - 0.5, snap(box.x + dx)) : box.x;
      let y = active.handle!.includes('n') ? Math.min(box.y + box.height - 0.5, snap(box.y + dy)) : box.y;
      let width = active.handle!.includes('w')
        ? box.x + box.width - x
        : active.handle!.includes('e')
          ? Math.max(0.5, snap(box.width + dx))
          : box.width;
      let height = active.handle!.includes('n')
        ? box.y + box.height - y
        : active.handle!.includes('s')
          ? Math.max(0.5, snap(box.height + dy))
          : box.height;
      if (event.shiftKey) {
        const factor = Math.max(width / box.width, height / box.height);
        width = box.width * factor;
        height = box.height * factor;
        if (active.handle!.includes('w')) x = box.x + box.width - width;
        if (active.handle!.includes('n')) y = box.y + box.height - height;
      }
      if (active.rotation) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const cxOffset = x + width / 2 - cx;
        const cyOffset = y + height / 2 - cy;
        x = cx + cxOffset * Math.cos(angle) - cyOffset * Math.sin(angle) - width / 2;
        y = cy + cxOffset * Math.sin(angle) + cyOffset * Math.cos(angle) - height / 2;
      }
      next = active.original.map((layer) =>
        active.selected.includes(layer.id)
          ? {
              ...layer,
              x: x + ((layer.x - box.x) * width) / box.width,
              y: y + ((layer.y - box.y) * height) / box.height,
              width: Math.max(0.5, (layer.width * width) / box.width),
              height: Math.max(0.5, (layer.height * height) / box.height),
            }
          : layer,
      );
    }
    latestDraft.current = next;
    setDraft(next);
  }

  function finish(event: PointerEvent<HTMLDivElement>, cancel = false) {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    pan.current = null;
    if (gesture.current && latestDraft.current && !cancel) onChangeLayers(latestDraft.current);
    gesture.current = null;
    latestDraft.current = null;
    setDraft(null);
  }

  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  return (
    <div data-layout="templateCanvasShell" className="template-canvas-shell">
      <div
        data-layout="templateCanvasViewport"
        ref={viewport}
        className={`template-canvas-viewport${hand ? ' is-panning' : ''}`}
        aria-label="Template canvas"
        tabIndex={0}
      >
        <div
          data-layout="templateCanvasSpace"
          className="template-canvas-space"
          style={{
            width: Math.max(size.width, document.widthMm * scale + 120),
            height: Math.max(size.height, document.heightMm * scale + 120),
          }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={(event) => finish(event)}
          onPointerCancel={(event) => finish(event, true)}
        >
          <div
            data-layout="templateArtwork"
            ref={artwork}
            className="template-artwork"
            style={{ width: document.widthMm * scale, height: document.heightMm * scale }}
            onDoubleClick={(event) => {
              const id = (event.target as Element).closest('[data-layer-id]')?.getAttribute('data-layer-id');
              if (face.layers.find((layer) => layer.id === id)?.type === 'text') onEditText();
            }}
          >
            <div
              data-layout="templateRenderedDesign"
              className="template-rendered"
              dangerouslySetInnerHTML={{ __html: markup }}
            />
            {grid && (
              <div
                data-layout="templateGridOverlay"
                className="template-grid-overlay"
                style={{
                  backgroundSize: `${Math.max(2, document.gridMm * scale)}px ${Math.max(2, document.gridMm * scale)}px`,
                }}
              />
            )}
            <svg
              className="template-selection-overlay"
              viewBox={`0 0 ${document.widthMm} ${document.heightMm}`}
              aria-hidden="true"
            >
              {selected.map((layer) => (
                <rect
                  key={layer.id}
                  x={layer.x}
                  y={layer.y}
                  width={layer.width}
                  height={layer.height}
                  transform={`rotate(${layer.rotation} ${layer.x + layer.width / 2} ${layer.y + layer.height / 2})`}
                  fill="none"
                  stroke={layer.locked ? '#9e805a' : '#24775b'}
                  strokeWidth={1 / scale}
                  strokeDasharray={selected.length > 1 ? `${3 / scale} ${2 / scale}` : undefined}
                />
              ))}
              {bounds && editableSelected.length > 0 && (
                <g
                  transform={
                    editableSelected.length === 1
                      ? `rotate(${editableSelected[0].rotation} ${bounds.x + bounds.width / 2} ${bounds.y + bounds.height / 2})`
                      : undefined
                  }
                >
                  {editableSelected.length > 1 && (
                    <rect {...bounds} fill="none" stroke="#24775b" strokeWidth={1 / scale} />
                  )}
                  {handles.map((handle) => {
                    const x =
                      bounds.x +
                      (handle.includes('e') ? bounds.width : handle.includes('w') ? 0 : bounds.width / 2);
                    const y =
                      bounds.y +
                      (handle.includes('s') ? bounds.height : handle.includes('n') ? 0 : bounds.height / 2);
                    return (
                      <rect
                        key={handle}
                        data-resize-handle={handle}
                        x={x - 4 / scale}
                        y={y - 4 / scale}
                        width={8 / scale}
                        height={8 / scale}
                        rx={1 / scale}
                        fill="white"
                        stroke="#24775b"
                        strokeWidth={1 / scale}
                        style={{ pointerEvents: 'all', cursor: `${handle}-resize` }}
                      />
                    );
                  })}
                  <line
                    x1={bounds.x + bounds.width / 2}
                    x2={bounds.x + bounds.width / 2}
                    y1={bounds.y}
                    y2={bounds.y - 21 / scale}
                    stroke="#24775b"
                    strokeWidth={1 / scale}
                  />
                  <circle
                    data-rotate-handle="true"
                    cx={bounds.x + bounds.width / 2}
                    cy={bounds.y - 25 / scale}
                    r={4 / scale}
                    fill="white"
                    stroke="#24775b"
                    strokeWidth={1 / scale}
                    style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                  />
                </g>
              )}
            </svg>
            <span className="template-dimension template-width">{document.widthMm} mm</span>
            <span className="template-dimension template-height">{document.heightMm} mm</span>
          </div>
        </div>
      </div>
      <div data-layout="templateCanvasControls" className="template-canvas-controls">
        <button
          title="Select and move layers"
          aria-label="Select tool"
          aria-pressed={!hand}
          onClick={() => setHand(false)}
        >
          <MousePointer2 size={15} />
        </button>
        <button
          title="Pan the canvas"
          aria-label="Pan tool"
          aria-pressed={hand}
          onClick={() => setHand(true)}
        >
          <Hand size={15} />
        </button>
        <i />
        <button aria-label="Zoom out" onClick={() => setZoom(Math.max(0.2, zoom / 1.25))}>
          <Minus size={15} />
        </button>
        <button
          className="template-zoom-value"
          title="Show actual CSS size"
          onClick={() => setZoom(3.7795 / fitScale)}
        >
          {Math.round((scale / 3.7795) * 100)}%
        </button>
        <button aria-label="Zoom in" onClick={() => setZoom(Math.min(12, zoom * 1.25))}>
          <Plus size={15} />
        </button>
        <button aria-label="Fit template to canvas" title="Fit to canvas" onClick={() => setZoom(1)}>
          <Scan size={15} />
        </button>
      </div>
    </div>
  );
}
