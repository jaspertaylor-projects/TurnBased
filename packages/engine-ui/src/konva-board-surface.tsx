import {
  type DragEventHandler,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { Stage, Layer, Group, Rect, Text, Path, Circle } from 'react-konva';
import { Html } from 'react-konva-utils';
import useImage from 'use-image';

import type { BoardSurfaceAppearance } from './board-surface-style';
import type { BoardSurfaceItem } from './board-surface';
import { RESIZE_HANDLE_SPECS } from './board-surface';

// ─── Types & helpers ────────────────────────────────────────────────────────

type SurfaceElementRef =
  | ((instance: HTMLDivElement | null) => void)
  | { readonly current: HTMLDivElement | null }
  | null;

function assignSurfaceElementRef(surfaceRef: SurfaceElementRef | undefined, node: HTMLDivElement | null) {
  if (typeof surfaceRef === 'function') {
    surfaceRef(node);
    return;
  }
  if (surfaceRef && typeof surfaceRef === 'object') {
    (surfaceRef as { current: HTMLDivElement | null }).current = node;
  }
}

export interface KonvaBoardSurfaceProps {
  items: readonly BoardSurfaceItem[];
  /** Logical board width in mm (coordinate space). */
  boardWidth: number;
  /** Logical board height in mm (coordinate space). */
  boardHeight: number;
  /** User zoom multiplier (1 = fit board to viewport). */
  zoom?: number;
  /** Board group origin X in screen pixels (absolute position of board top-left). */
  panX?: number;
  /** Board group origin Y in screen pixels. */
  panY?: number;
  /** Called when the user zooms, pans, or scrolls. */
  onViewChange?: (zoom: number, panX: number, panY: number) => void;
  background?: string;
  surfaceAppearance?: BoardSurfaceAppearance;
  surfaceBorderRadius?: number | string;
  /** Physical shape of the surface (tile only). Affects board outline and bleed zone. */
  surfaceShape?: 'square' | 'rectangle' | 'circle' | 'hexagon' | 'triangle';
  showGrid?: boolean;
  showBleed?: boolean;
  showUnits?: boolean;
  editable?: boolean;
  showItemHeader?: boolean;
  showResizeHandle?: boolean;
  emptyState?: ReactNode;
  surfaceRef?: SurfaceElementRef;
  onSurfaceDragOver?: DragEventHandler<HTMLDivElement>;
  onSurfaceDrop?: DragEventHandler<HTMLDivElement>;
  onBackgroundClick?: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Deep walnut behind everything — the dim, lamplit corner of the gaming room. */
const CANVAS_BG = '#241608';
/** Warm walnut desk surface: a soft top light, a grounding bottom vignette, a
 *  faint plank grain, then the real wood texture for fibre detail. */
const WOOD_SURFACE_IMAGE = "radial-gradient(120% 90% at 50% -8%, rgba(255,214,150,0.16), rgba(0,0,0,0) 52%), radial-gradient(140% 140% at 50% 120%, rgba(0,0,0,0.55), rgba(0,0,0,0) 60%), repeating-linear-gradient(93deg, rgba(0,0,0,0.06) 0 2px, rgba(255,255,255,0.015) 2px 6px), linear-gradient(160deg, rgba(96,61,31,0.55), rgba(51,33,15,0.72)), url('/textures/wood_texture.png')";
const WOOD_SURFACE_SIZE = 'cover, cover, auto, cover, 520px auto';
const WOOD_SURFACE_REPEAT = 'no-repeat, no-repeat, repeat, no-repeat, repeat';
/** Deep forest felt play-mat the board rests on. */
const FELT_SURFACE = "radial-gradient(110% 85% at 50% 30%, rgba(180,230,200,0.12), rgba(0,0,0,0) 60%), radial-gradient(140% 130% at 50% 112%, rgba(0,0,0,0.42), rgba(0,0,0,0) 62%), repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0 1px, rgba(255,255,255,0.02) 1px 3px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.04) 0 1px, rgba(255,255,255,0.015) 1px 3px), linear-gradient(160deg, #35624b, #274838 55%, #1f3a2c)";
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 40;
/** Physical bleed margin in mm — matches supplier spec (36/300 inch). */
const CLIP_BLEED_MM = (36 / 300) * 25.4;
/** At zoom=1 the board fills this fraction of the viewport. Leaves room
 *  around the board for the bleed hatch area and optional ruler strips. */
const FIT_PADDING = 0.70;
const TOOLBAR_H = 34;
const SCROLLBAR_THICKNESS = 14;
const SCROLLBAR_INSET = 4;
/** Extra scroll room beyond board edges, as fraction of viewport size. */
const PAN_OVERRUN = 0.4;

// ─── Surface shape helpers ─────────────────────────────────────────────────

export type SurfaceShapeKind = 'square' | 'rectangle' | 'circle' | 'hexagon' | 'triangle';

/** CSS clip-path polygon for a given surface shape. Returns undefined for rectangular shapes. */
function getSurfaceClipPath(shape: SurfaceShapeKind | undefined): string | undefined {
  switch (shape) {
    case 'hexagon':
      return 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
    case 'triangle':
      return 'polygon(50% 0%, 100% 100%, 0% 100%)';
    case 'circle':
      return 'ellipse(50% 50% at 50% 50%)';
    default:
      return undefined;
  }
}

/** Konva Path `data` string for a given shape at the specified size.
 *  Returns null for rectangular shapes (use Rect instead). */
function getSurfacePathData(shape: SurfaceShapeKind | undefined, w: number, h: number): string | null {
  switch (shape) {
    case 'hexagon': {
      const cx = w / 2;
      const t25 = h * 0.25;
      const t75 = h * 0.75;
      return `M${cx},0 L${w},${t25} L${w},${t75} L${cx},${h} L0,${t75} L0,${t25} Z`;
    }
    case 'triangle':
      return `M${w / 2},0 L${w},${h} L0,${h} Z`;
    case 'circle': {
      const rx = w / 2;
      const ry = h / 2;
      return `M${rx},0 A${rx},${ry} 0 1,1 ${rx},${h} A${rx},${ry} 0 1,1 ${rx},0 Z`;
    }
    default:
      return null;
  }
}

// ─── Item background ───────────────────────────────────────────────────────

function parsePolygonData(clipPath: string, w: number, h: number): string | null {
  const match = clipPath.match(/^polygon\((.+)\)$/);
  if (!match) return null;
  const points = match[1].split(',').map((pair) => {
    const [x, y] = pair.trim().split(/\s+/).map((v) => parseFloat(v));
    return { x: (x / 100) * w, y: (y / 100) * h };
  });
  if (points.length === 0) return null;
  return `M${points[0].x},${points[0].y} ` + points.slice(1).map(p => `L${p.x},${p.y}`).join(' ') + ' Z';
}

function KonvaItemBackground({ item }: { item: BoardSurfaceItem }) {
  const [img] = useImage(item.textureId ?? '', 'anonymous');
  const w = item.width;
  const h = item.height;
  const cr = typeof item.borderRadius === 'number' ? item.borderRadius : 18;
  const sw = item.borderWidth ?? 1;
  const sc = item.dropTarget ? '#f97316' : (item.borderColor ?? 'rgba(15,118,110,0.16)');
  const fc = item.background ?? 'rgba(255,255,255,0.92)';
  const hasClip = Boolean(item.clipPath);

  if (hasClip && item.clipPath) {
    const data = parsePolygonData(item.clipPath, w, h);
    if (data) {
      return (
        <Group>
          <Path data={data} fill={fc} />
          {img && <Path data={data} fillPatternImage={img} fillPatternOpacity={item.textureOpacity ?? 0.3} />}
          {item.selected && <Path data={data} stroke="#10b981" strokeWidth={Math.max(2, sw + 1)} shadowColor="rgba(16,185,129,0.45)" shadowBlur={14} listening={false} />}
          <Path data={data} stroke={sc} strokeWidth={sw} />
        </Group>
      );
    }
  }

  const noCr = hasClip ? 0 : cr;
  return (
    <Group>
      <Rect width={w} height={h} fill={fc} cornerRadius={noCr} shadowColor="rgba(0,0,0,0.12)" shadowBlur={12} shadowOffset={{ x: 0, y: 4 }} />
      {img && <Rect width={w} height={h} fillPatternImage={img} fillPatternOpacity={item.textureOpacity ?? 0.3} cornerRadius={noCr} />}
      {item.selected && <Rect width={w} height={h} stroke="#10b981" strokeWidth={Math.max(2, sw + 1)} cornerRadius={noCr} shadowColor="rgba(16,185,129,0.45)" shadowBlur={12} listening={false} />}
      <Rect width={w} height={h} stroke={sc} strokeWidth={hasClip ? 0 : sw} cornerRadius={noCr} />
    </Group>
  );
}

// ─── Selection resize handles ────────────────────────────────────────────────

/**
 * Eight draggable resize handles (4 corners + 4 edge midpoints) plus a thin
 * selection frame, drawn on the currently-selected item. Handle sizes are
 * divided by `scale` so they stay a constant ~9px on screen regardless of
 * board zoom. Pressing a handle starts an edge-constrained resize via
 * `item.onResizeHandle`; cancelBubble stops the parent group's move handler
 * from also firing.
 */
function KonvaResizeHandles({ item, scale }: { item: BoardSurfaceItem; scale: number }) {
  if (!item.onResizeHandle) return null;
  const onResizeHandle = item.onResizeHandle;
  const w = item.width;
  const h = item.height;
  const hs = 9 / Math.max(scale, 0.0001); // handle box size in board units
  const ring = 1.5 / Math.max(scale, 0.0001);

  return (
    <Group listening>
      {/* selectionFrame — crisp outline that reads as "this is selected" */}
      <Rect
        x={0}
        y={0}
        width={w}
        height={h}
        stroke="#0d9488"
        strokeWidth={ring}
        listening={false}
      />
      {RESIZE_HANDLE_SPECS.map((spec) => {
        const cx = spec.fx * w;
        const cy = spec.fy * h;
        return (
          <Rect
            key={spec.key}
            x={cx - hs / 2}
            y={cy - hs / 2}
            width={hs}
            height={hs}
            cornerRadius={hs * 0.25}
            fill="#ffffff"
            stroke="#0d9488"
            strokeWidth={ring}
            shadowColor="rgba(6,78,59,0.35)"
            shadowBlur={hs * 0.4}
            onMouseEnter={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = spec.cursor; }}
            onMouseLeave={(e) => { const stage = e.target.getStage(); if (stage) stage.container().style.cursor = ''; }}
            onMouseDown={(e) => {
              e.cancelBubble = true;
              onResizeHandle(spec.edges, e as unknown as { evt: MouseEvent });
            }}
          />
        );
      })}
    </Group>
  );
}

// ─── Scrollbar ──────────────────────────────────────────────────────────────

/**
 * A macOS-style overlay scrollbar. Thin, rounded, fades in on hover/activity.
 * The thumb is directly draggable, and clicking the track jumps to that position.
 *
 * Props work in "scroll offset" space:
 *  - min/max define the scrollable range of the origin coordinate
 *  - value is the current origin coordinate
 *  - onChange fires with the new origin coordinate
 */
function OverlayScrollbar({
  axis,
  trackLength,
  min,
  max,
  value,
  onChange,
}: {
  axis: 'x' | 'y';
  trackLength: number;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const range = max - min;
  const dragRef = useRef<{ startMouse: number; startValue: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const isH = axis === 'x';
  const hidden = range <= 0;

  const viewportFraction = range > 0 ? trackLength / (trackLength + range) : 1;
  const thumbLen = Math.max(28, Math.round(trackLength * viewportFraction));
  const thumbTravel = trackLength - thumbLen;
  const fraction = range > 0 ? (value - min) / range : 0;
  const thumbPos = Math.round(fraction * thumbTravel);
  const active = hovered || dragging;

  function valueFromThumbPos(pos: number) {
    const f = thumbTravel > 0 ? Math.max(0, Math.min(1, pos / thumbTravel)) : 0;
    return min + f * range;
  }

  // Drag effect — must always be called (no early return before hooks)
  useEffect(() => {
    if (!dragging) return;
    function move(e: MouseEvent) {
      if (!dragRef.current) return;
      const delta = (isH ? e.clientX : e.clientY) - dragRef.current.startMouse;
      onChange(valueFromThumbPos(dragRef.current.startValue + delta));
    }
    function up() {
      setDragging(false);
      dragRef.current = null;
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging]);

  if (hidden) return null;

  return (
    <div
      data-layout={`scrollbar-${axis}`}
      style={{
        position: 'absolute',
        zIndex: 4,
        borderRadius: SCROLLBAR_THICKNESS,
        transition: 'opacity 0.2s',
        opacity: active ? 1 : 0.5,
        ...(isH
          ? { bottom: TOOLBAR_H + SCROLLBAR_INSET, left: SCROLLBAR_INSET, width: trackLength, height: SCROLLBAR_THICKNESS }
          : { right: SCROLLBAR_INSET, top: SCROLLBAR_INSET, width: SCROLLBAR_THICKNESS, height: trackLength }),
      }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const click = isH ? e.clientX - rect.left : e.clientY - rect.top;
        onChange(valueFromThumbPos(click - thumbLen / 2));
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        data-layout={`scrollbar-${axis}-thumb`}
        style={{
          position: 'absolute',
          borderRadius: SCROLLBAR_THICKNESS,
          background: active ? 'rgba(16,185,129,0.55)' : 'rgba(15,118,110,0.35)',
          transition: dragging ? 'none' : 'background 0.2s, opacity 0.2s',
          cursor: 'pointer',
          ...(isH
            ? { left: thumbPos, top: 0, width: thumbLen, height: SCROLLBAR_THICKNESS }
            : { top: thumbPos, left: 0, width: SCROLLBAR_THICKNESS, height: thumbLen }),
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setDragging(true);
          dragRef.current = { startMouse: isH ? e.clientX : e.clientY, startValue: thumbPos };
        }}
      />
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function KonvaBoardSurface({
  items,
  boardWidth,
  boardHeight,
  zoom: zoomProp = 1,
  panX: panXProp = 0,
  panY: panYProp = 0,
  onViewChange,
  background: _background,
  surfaceAppearance,
  surfaceBorderRadius,
  surfaceShape,
  showGrid = false,
  showBleed = true,
  showUnits = false,
  editable: _editable = false,
  showItemHeader = true,
  showResizeHandle: _showResizeHandle = true,
  emptyState: _emptyState,
  surfaceRef,
  onSurfaceDragOver,
  onSurfaceDrop,
  onBackgroundClick,
}: KonvaBoardSurfaceProps) {
  // Board appearance
  const rawFill = surfaceAppearance?.background;
  const boardFill = (rawFill && rawFill !== 'transparent' && rawFill !== 'rgba(0,0,0,0)' && !rawFill.includes('gradient'))
    ? rawFill : '#f8fafc';
  const boardStroke = surfaceAppearance?.borderColor ?? 'rgba(0,0,0,0.18)';
  const boardStrokeW = Math.max(1, surfaceAppearance?.borderWidth ?? 1);

  // Container measurement
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const initRef = useRef(false);

  function containerRefCallback(node: HTMLDivElement | null) {
    containerRef.current = node;
    assignSurfaceElementRef(surfaceRef, node);
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    if (node) {
      const obs = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setContainerSize({ width, height });
      });
      obs.observe(node);
      observerRef.current = obs;
    }
  }

  // Prevent Ctrl+wheel from zooming the browser page — must use a native
  // listener with { passive: false } because React synthetic events can't
  // preventDefault on passive wheel listeners.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    function preventBrowserZoom(e: WheelEvent) {
      e.preventDefault();
    }
    node.addEventListener('wheel', preventBrowserZoom, { passive: false });
    return () => node.removeEventListener('wheel', preventBrowserZoom);
  }, [containerSize]);

  const vw = containerSize ? containerSize.width : 0;
  const vh = containerSize ? containerSize.height : 0;

  // ── Safe content area ──
  // Reserve space along the bottom for the toolbar + horizontal scrollbar,
  // and along the right for the vertical scrollbar, so neither overlay can
  // occlude the editing surface even when the board is panned/zoomed.
  const safeRightInset = SCROLLBAR_THICKNESS + SCROLLBAR_INSET * 2;
  const safeBottomInset = TOOLBAR_H + SCROLLBAR_THICKNESS + SCROLLBAR_INSET * 2;
  const safeW = Math.max(0, vw - safeRightInset);
  const safeH = Math.max(0, vh - safeBottomInset);

  // ── Scale ──
  const baseScale = safeW > 0 && safeH > 0
    ? Math.min((safeW * FIT_PADDING) / boardWidth, (safeH * FIT_PADDING) / boardHeight)
    : 1;
  const scale = baseScale * zoomProp;
  const boardPxW = boardWidth * scale;
  const boardPxH = boardHeight * scale;

  // ── Origin (board top-left in screen px) ──
  // Center the board using the full viewport height so the board doesn't
  // appear biased toward the top — the bottom toolbar inset only constrains
  // the fit scale, not the visual center.
  const centeredX = (safeW - boardPxW) / 2;
  const centeredY = (vh - boardPxH) / 2;

  // Emit centered origin once on first valid measurement
  useEffect(() => {
    if (vw > 0 && vh > 0 && !initRef.current && panXProp === 0 && panYProp === 0) {
      initRef.current = true;
      onViewChange?.(zoomProp, centeredX, centeredY);
    }
  }, [vw, vh]);

  const ox = panXProp;
  const oy = panYProp;

  // ── Pan bounds ──
  // The origin can travel from (board fully off-screen right/bottom + overrun)
  // to (board fully off-screen left/top + overrun). Bounds use the safe area
  // so the board edges never travel under the toolbar or scrollbars.
  const overX = safeW * PAN_OVERRUN;
  const overY = safeH * PAN_OVERRUN;
  const panMinX = safeW - boardPxW - overX;
  const panMaxX = overX;
  const panMinY = safeH - boardPxH - overY;
  const panMaxY = overY;

  function clampPan(x: number, y: number): [number, number] {
    return [
      Math.max(panMinX, Math.min(panMaxX, x)),
      Math.max(panMinY, Math.min(panMaxY, y)),
    ];
  }

  function emit(z: number, x: number, y: number) {
    const [cx, cy] = clampPan(x, y);
    onViewChange?.(z, cx, cy);
  }

  // ── Zoom toward a point ──
  function zoomAt(newZoom: number, anchorX: number, anchorY: number) {
    const newScale = baseScale * newZoom;
    // Board coordinate under anchor
    const bx = (anchorX - ox) / scale;
    const by = (anchorY - oy) / scale;
    emit(newZoom, anchorX - bx * newScale, anchorY - by * newScale);
  }

  // ── Wheel: zoom or pan ──
  // Scroll wheel always zooms toward cursor
  function handleWheel(e: any) {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const direction = e.evt.deltaY < 0 ? 1 : -1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomProp * (direction > 0 ? 1.08 : 1 / 1.08)));
    zoomAt(newZoom, pointer.x, pointer.y);
  }

  function handleStageMouseDown(e: any) {
    if (e.target === e.target.getStage() && e.evt.button === 0) {
      onBackgroundClick?.();
    }
  }

  // ── Scrollbar handlers ──
  const handleScrollX = useCallback((newOx: number) => {
    emit(zoomProp, newOx, oy);
  }, [zoomProp, oy, panMinX, panMaxX, vw, boardPxW, overX]);

  const handleScrollY = useCallback((newOy: number) => {
    emit(zoomProp, ox, newOy);
  }, [zoomProp, ox, panMinY, panMaxY, vh, boardPxH, overY]);

  // ── Toolbar ──
  function fitToView() {
    initRef.current = true;
    const s = safeW > 0 && safeH > 0
      ? Math.min((safeW * FIT_PADDING) / boardWidth, (safeH * FIT_PADDING) / boardHeight)
      : 1;
    const bw = boardWidth * s;
    const bh = boardHeight * s;
    onViewChange?.(1, (safeW - bw) / 2, (vh - bh) / 2);
  }

  function zoomCenter(newZoom: number) {
    zoomAt(newZoom, vw / 2, vh / 2);
  }

  const zoomPct = Math.round(zoomProp * 100);

  // Scrollbar track lengths
  const hTrack = vw - SCROLLBAR_THICKNESS - SCROLLBAR_INSET * 3;
  const vTrack = vh - SCROLLBAR_THICKNESS - SCROLLBAR_INSET * 3 - TOOLBAR_H;

  return (
    // surfaceContainer — fills parent, wood-desk canvas background.
    // Tinted wood texture uses a translucent color overlay over the raw
    // wood image so it reads as "working on a wood desk" rather than
    // full-saturation lumber.
    <div
      data-layout="surfaceContainer"
      ref={containerRefCallback}
      onDragOver={onSurfaceDragOver}
      onDrop={onSurfaceDrop}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: surfaceBorderRadius ?? 8,
        backgroundColor: CANVAS_BG,
        backgroundImage: WOOD_SURFACE_IMAGE,
        backgroundSize: WOOD_SURFACE_SIZE,
        backgroundRepeat: WOOD_SURFACE_REPEAT,
        overflow: 'hidden',
      }}
    >
      {/* workMat — solid black rectangle behind the board + bleed + rulers,
          like a drafting-desk mat. Gives the whole working area a clear
          visual boundary with a little breathing room on every side. */}
      {containerSize ? (() => {
        const BLEED_MM = (36 / 300) * 25.4;
        const bleed = showBleed ? BLEED_MM * scale : 0;
        // Match the ruler dimensions declared in the unitsRuler block.
        const rulerOuter = showUnits ? 30 + 4 : 0; // RULER_W + RULER_GAP
        const pad = 18;
        const matPad = pad + 14; // a little extra felt margin around the mat
        return (
          <div
            data-layout="workMat"
            /* felt play-mat the board rests on: forest baize with a stitched
               brass edge, a soft inner vignette, and a grounded drop shadow so
               it reads as a physical mat lying on the wooden desk. */
            style={{
              position: 'absolute',
              left: ox - bleed - rulerOuter - matPad,
              top: oy - bleed - rulerOuter - matPad,
              width: boardPxW + bleed * 2 + rulerOuter + matPad * 2,
              height: boardPxH + bleed * 2 + rulerOuter + matPad * 2,
              background: FELT_SURFACE,
              borderRadius: 18,
              border: '1px solid rgba(184,146,78,0.35)',
              boxShadow: '0 30px 70px rgba(0,0,0,0.55), 0 8px 18px rgba(0,0,0,0.42), inset 0 0 0 6px rgba(31,58,44,0.55), inset 0 0 0 7px rgba(184,146,78,0.30), inset 0 0 60px rgba(0,0,0,0.40)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        );
      })() : null}

      {/* bleedArea — hatched gray margin around the board, visually marks
          the off-board region. Rendered as an HTML div behind the Stage so
          we can use CSS repeating-linear-gradient for the slashes. */}
      {containerSize && showBleed ? (() => {
        // 36/300 inch = 0.12 in = 3.048 mm bleed around the board.
        const BLEED_MM = (36 / 300) * 25.4;
        const bleed = BLEED_MM * scale;
        const bleedClip = getSurfaceClipPath(surfaceShape);
        return (
          <div
            data-layout="boardBleed"
            style={{
              position: 'absolute',
              left: ox - bleed,
              top: oy - bleed,
              width: boardPxW + bleed * 2,
              height: boardPxH + bleed * 2,
              backgroundColor: 'rgba(231,216,180,0.92)',
              backgroundImage: 'repeating-linear-gradient(45deg, rgba(138,106,51,0.22) 0 5px, rgba(231,216,180,0) 5px 12px)',
              clipPath: bleedClip,
              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        );
      })() : null}

      {containerSize ? (
        <Stage
          width={vw}
          height={vh}
          style={{
            display: 'block', position: 'relative', zIndex: 1,
            clipPath: `inset(${Math.max(0, oy - CLIP_BLEED_MM * scale)}px ${Math.max(0, vw - ox - (boardWidth + CLIP_BLEED_MM) * scale)}px ${Math.max(0, vh - oy - (boardHeight + CLIP_BLEED_MM) * scale)}px ${Math.max(0, ox - CLIP_BLEED_MM * scale)}px)`,
          }}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
        >
          <Layer>
            {/* boardGroup — the physical board */}
            <Group x={ox} y={oy} scaleX={scale} scaleY={scale}>
              {/* boardRect — uses Path for non-rectangular shapes */}
              {(() => {
                const shapeData = getSurfacePathData(surfaceShape, boardWidth, boardHeight);
                if (shapeData) {
                  return <Path data={shapeData} fill={boardFill} stroke={boardStroke} strokeWidth={boardStrokeW} />;
                }
                return <Rect width={boardWidth} height={boardHeight} fill={boardFill} stroke={boardStroke} strokeWidth={boardStrokeW} cornerRadius={0} />;
              })()}

              {/* dotGrid — faint square lattice of dots, 10mm spacing.
                  Skip rendering when dots would be too dense on screen. */}
              {showGrid && (() => {
                const STEP = 10; // mm
                const stepPx = STEP * scale;
                if (stepPx < 4) return null; // too dense to read
                const dotR = Math.max(0.6, Math.min(1.4, stepPx / 18)) / scale;
                const dots: ReactNode[] = [];
                for (let x = 0; x <= boardWidth; x += STEP) {
                  for (let y = 0; y <= boardHeight; y += STEP) {
                    dots.push(<Circle key={`${x},${y}`} x={x} y={y} radius={dotR} fill="rgba(15,23,42,0.28)" listening={false} />);
                  }
                }
                return <>{dots}</>;
              })()}

              {items.map((item) => {
                const showH = item.showHeader ?? showItemHeader;
                return (
                  <Group
                    key={item.id}
                    x={item.x + (item.rotation ? item.width / 2 : 0)}
                    y={item.y + (item.rotation ? item.height / 2 : 0)}
                    offsetX={item.rotation ? item.width / 2 : 0}
                    offsetY={item.rotation ? item.height / 2 : 0}
                    rotation={item.rotation ?? 0}
                    width={item.width} height={item.height}
                    onClick={item.onClick as any} onDblClick={item.onDoubleClick as any}
                    onMouseDown={item.onMouseDown as any} onMouseMove={item.onMouseMove as any}
                  >
                    <KonvaItemBackground item={item} />
                    {showH && <Text y={12} x={12} text={item.label} fontSize={14} fill="#064e3b" fontStyle="bold" width={item.width - 24} wrap="none" ellipsis />}
                    {(() => {
                      // Honor item.padding (which the editor sets to 0 for
                      // text-boxes) instead of the default 12px inset, so
                      // flush-to-the-wall rendering matches the play-test.
                      const defaultInset = 12;
                      const inset = typeof item.padding === 'number' ? item.padding : defaultInset;
                      const headerExtra = showH ? 20 : 0; // leave room below header
                      const top = (showH ? 32 : 0) + inset;
                      const left = inset;
                      const width = Math.max(0, item.width - inset * 2);
                      const height = Math.max(0, item.height - (showH ? 32 + headerExtra : 0) - inset * 2);
                      return (
                        <Html divProps={{ style: { position: 'absolute', top: `${top}px`, left: `${left}px`, width: `${width}px`, height: `${height}px`, overflow: 'hidden', pointerEvents: 'none' } }}>
                          {item.content as any}
                        </Html>
                      );
                    })()}
                    {item.selected ? <KonvaResizeHandles item={item} scale={scale} /> : null}
                  </Group>
                );
              })}
            </Group>
          </Layer>
        </Stage>
      ) : null}


      {/* unitsRuler — mm readout overlay along top + left edges of the board.
          Shows every 50mm with labels. Pure HTML so it doesn't interact
          with Konva input; positioned absolutely relative to the container. */}
      {containerSize && showUnits ? (() => {
        // Architectural-style ruler: thin strips along the top and left
        // edges of the board with minor ticks every 10mm and labeled major
        // ticks every 50mm. A single "mm" badge sits in the corner so the
        // axes don't have to repeat units on every label.
        const MAJOR = 50;
        const MINOR = 10;
        const majorPx = MAJOR * scale;
        if (majorPx < 22) return null; // too dense — hide
        const showMinor = MINOR * scale >= 5;
        const RULER_W = 30;
        // Extra air gap between the ruler strip and the bleed hatch so the
        // thin bleed band (~3mm) reads as its own zone rather than touching
        // the ruler background.
        const RULER_GAP = 4;
        // Extra space past the last tick so a label centered on the final
        // major tick (e.g. "400") isn't clipped at the strip's edge. Kept
        // minimal to avoid a visible overhang past the board.
        const RULER_TAIL = 6;
        // Push the ruler strips outside the bleed area so they don't overlap
        // the hatched margin. Matches BLEED_MM from the bleed block above.
        const BLEED_MM = (36 / 300) * 25.4;
        const bleedPx = showBleed ? BLEED_MM * scale : 0;
        const majorsX: number[] = [];
        const majorsY: number[] = [];
        const minorsX: number[] = [];
        const minorsY: number[] = [];
        for (let mm = 0; mm <= boardWidth; mm += MAJOR) majorsX.push(mm);
        for (let mm = 0; mm <= boardHeight; mm += MAJOR) majorsY.push(mm);
        if (showMinor) {
          for (let mm = 0; mm <= boardWidth; mm += MINOR) if (mm % MAJOR !== 0) minorsX.push(mm);
          for (let mm = 0; mm <= boardHeight; mm += MINOR) if (mm % MAJOR !== 0) minorsY.push(mm);
        }
        const rulerBg = 'rgba(248,250,252,0.96)';
        const rulerBorder = 'rgba(15,23,42,0.18)';
        const tickColor = 'rgba(15,23,42,0.55)';
        const labelColor = '#0f172a';
        return (
          <div data-layout="unitsRuler" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
            {/* topRuler — horizontal strip above the board (outside bleed) */}
            <div style={{
              position: 'absolute',
              left: ox - bleedPx,
              top: oy - bleedPx - RULER_GAP - RULER_W,
              width: boardPxW + bleedPx * 2 + RULER_TAIL,
              height: RULER_W,
              background: rulerBg,
              borderBottom: `1px solid ${rulerBorder}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}>
              {minorsX.map((mm) => (
                <div key={`mx${mm}`} style={{ position: 'absolute', left: bleedPx + mm * scale, bottom: 0, width: 1, height: 4, background: tickColor }} />
              ))}
              {majorsX.filter((mm) => mm > 0).map((mm) => (
                <div key={`Mx${mm}`} style={{ position: 'absolute', left: bleedPx + mm * scale, bottom: 0, width: 1, height: 8, background: tickColor }}>
                  <div style={{ position: 'absolute', bottom: 9, left: 0, transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: labelColor, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>{mm}</div>
                </div>
              ))}
            </div>
            {/* leftRuler — vertical strip left of the board (outside bleed) */}
            <div style={{
              position: 'absolute',
              left: ox - bleedPx - RULER_GAP - RULER_W,
              top: oy - bleedPx,
              width: RULER_W,
              height: boardPxH + bleedPx * 2 + RULER_TAIL,
              background: rulerBg,
              borderRight: `1px solid ${rulerBorder}`,
              boxShadow: '1px 0 2px rgba(0,0,0,0.04)',
            }}>
              {minorsY.map((mm) => (
                <div key={`my${mm}`} style={{ position: 'absolute', top: bleedPx + mm * scale, right: 0, width: 4, height: 1, background: tickColor }} />
              ))}
              {majorsY.filter((mm) => mm > 0).map((mm) => (
                <div key={`My${mm}`} style={{ position: 'absolute', top: bleedPx + mm * scale, right: 0, width: 8, height: 1, background: tickColor }} />
              ))}
              {majorsY.filter((mm) => mm > 0).map((mm) => (
                <div key={`Ly${mm}`} style={{
                  position: 'absolute',
                  left: 0,
                  right: 10,
                  top: bleedPx + mm * scale,
                  transform: 'translateY(-50%)',
                  textAlign: 'right',
                  fontSize: 9,
                  fontWeight: 600,
                  color: labelColor,
                  letterSpacing: '0.02em',
                  pointerEvents: 'none',
                }}>{mm}</div>
              ))}
            </div>
            {/* cornerBadge — single unit indicator at the origin */}
            <div style={{
              position: 'absolute',
              left: ox - bleedPx - RULER_GAP - RULER_W,
              top: oy - bleedPx - RULER_GAP - RULER_W,
              width: RULER_W,
              height: RULER_W,
              background: '#064e3b',
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.05em',
              borderRight: `1px solid ${rulerBorder}`,
              borderBottom: `1px solid ${rulerBorder}`,
            }}>mm</div>
          </div>
        );
      })() : null}

      {/* overlayScrollbars — macOS-style, thin, always available so the
          creator can pan the mat even at fit-zoom. */}
      {onViewChange && vw > 0 && (
        <>
          <OverlayScrollbar axis="x" trackLength={hTrack} min={panMinX} max={panMaxX} value={ox} onChange={handleScrollX} />
          <OverlayScrollbar axis="y" trackLength={vTrack} min={panMinY} max={panMaxY} value={oy} onChange={handleScrollY} />
        </>
      )}

      {/* bottomToolbar — zoom controls */}
      {onViewChange && (
        <div data-layout="bottomToolbar" style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: TOOLBAR_H,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(255,255,255,0.08)', padding: '0 12px', zIndex: 3,
        }}>
          <TbBtn label="Fit" onClick={fitToView} />
          <TbDiv />
          <TbBtn label="-" onClick={() => zoomCenter(Math.max(MIN_ZOOM, zoomProp / 1.3))} />
          <span style={{ minWidth: 48, textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums', userSelect: 'none' }}>
            {zoomPct}%
          </span>
          <TbBtn label="+" onClick={() => zoomCenter(Math.min(MAX_ZOOM, zoomProp * 1.3))} />
          <TbDiv />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', userSelect: 'none', whiteSpace: 'nowrap' }}>
            Scroll to zoom
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Toolbar helpers ────────────────────────────────────────────────────────

function TbBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{ border: 'none', borderRadius: 4, background: 'transparent', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', padding: '2px 10px', fontSize: 12, fontWeight: 700, lineHeight: '22px' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {label}
    </button>
  );
}

function TbDiv() {
  return <div data-layout="toolbarDivider" style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />;
}
