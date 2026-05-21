import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, DragEventHandler, MouseEventHandler, ReactNode } from 'react';
import { getBoardSurfaceTextureStyle } from './board-surface-style';

export type BoardGridKind = 'hex-grid' | 'square-grid' | 'checkerboard-grid';

export interface BoardGridCell {
  id: string;
  row: number;
  column: number;
  label: string;
  content?: ReactNode;
  background?: string;
  textureId?: string | null;
  textureOpacity?: number;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  selected?: boolean;
  highlighted?: boolean;
  dropTarget?: boolean;
  onClick?: () => void;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
}

export interface BoardGridProps {
  kind: BoardGridKind;
  rows?: number;
  columns?: number;
  cells: readonly BoardGridCell[];
  editable?: boolean;
}

export interface BoardGridLayoutMetrics {
  totalWidth: number;
  totalHeight: number;
  getCellBounds: (row: number, column: number) => { x: number; y: number; width: number; height: number };
}

const HEX_CLIP_PATH = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
const HEX_POINTS = '50,0 100,25 100,75 50,100 0,75 0,25';

/** Small overlap factor (fraction of cell size) to eliminate sub-pixel gaps between hexes. */
const HEX_OVERLAP = 0.01;

function getDefaultCellBorderColor(kind: BoardGridKind): string {
  return kind === 'hex-grid'
    ? 'rgba(15,118,110,0.52)'
    : 'rgba(15,118,110,0.18)';
}

function getDefaultCellBorderWidth(kind: BoardGridKind): number {
  return kind === 'hex-grid' ? 2 : 1;
}

function getBoardGridMetrics(kind: BoardGridKind, rows: number, columns: number): BoardGridLayoutMetrics {
  const safeRows = Math.max(1, rows);
  const safeColumns = Math.max(1, columns);

  if (kind === 'square-grid' || kind === 'checkerboard-grid') {
    return {
      totalWidth: safeColumns,
      totalHeight: safeRows,
      getCellBounds: (row, column) => ({
        x: column,
        y: row,
        width: 1,
        height: 1,
      }),
    };
  }

  const hexWidth = 1;
  const hexHeight = 2 / Math.sqrt(3);
  const rowStep = hexHeight * 0.75;
  const columnOffset = safeRows > 1 ? 0.5 : 0;
  const totalWidth = safeColumns + columnOffset;
  const totalHeight = hexHeight + ((safeRows - 1) * rowStep);

  return {
    totalWidth,
    totalHeight,
    getCellBounds: (row, column) => ({
      x: column + (Math.abs(row) % 2 === 1 ? 0.5 : 0),
      y: row * rowStep,
      width: hexWidth,
      height: hexHeight,
    }),
  };
}

export function resolveBoardGridLayout(
  kind: BoardGridKind,
  cells: readonly Pick<BoardGridCell, 'row' | 'column'>[],
  rows = 1,
  columns = 1,
): BoardGridLayoutMetrics {
  const resolvedCells = cells.length > 0
    ? cells
    : Array.from({ length: Math.max(1, rows) * Math.max(1, columns) }, (_unused, index) => ({
      row: Math.floor(index / Math.max(1, columns)),
      column: index % Math.max(1, columns),
    }));

  const coordinateBounds = resolvedCells.reduce((bounds, cell) => {
    const metrics = getBoardGridMetrics(kind, 1, 1);
    const rawCellBounds = metrics.getCellBounds(cell.row, cell.column);

    return {
      minX: Math.min(bounds.minX, rawCellBounds.x),
      minY: Math.min(bounds.minY, rawCellBounds.y),
      maxX: Math.max(bounds.maxX, rawCellBounds.x + rawCellBounds.width),
      maxY: Math.max(bounds.maxY, rawCellBounds.y + rawCellBounds.height),
    };
  }, {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });

  return {
    totalWidth: Number.isFinite(coordinateBounds.minX) ? Math.max(1, coordinateBounds.maxX - coordinateBounds.minX) : 1,
    totalHeight: Number.isFinite(coordinateBounds.minY) ? Math.max(1, coordinateBounds.maxY - coordinateBounds.minY) : 1,
    getCellBounds: (row: number, column: number) => {
      const baseMetrics = getBoardGridMetrics(kind, 1, 1);
      const rawBounds = baseMetrics.getCellBounds(row, column);

      return {
        x: rawBounds.x - (Number.isFinite(coordinateBounds.minX) ? coordinateBounds.minX : 0),
        y: rawBounds.y - (Number.isFinite(coordinateBounds.minY) ? coordinateBounds.minY : 0),
        width: rawBounds.width,
        height: rawBounds.height,
      };
    },
  };
}

function getCellStyle(
  cell: BoardGridCell,
  kind: BoardGridKind,
  bounds: { x: number; y: number; width: number; height: number },
): CSSProperties {
  const resolvedBorderRadius = kind === 'hex-grid' ? '0' : `${cell.borderRadius ?? 10}px`;

  return {
    position: 'absolute',
    left: `${bounds.x}px`,
    top: `${bounds.y}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
    minWidth: 0,
    minHeight: 0,
    borderRadius: resolvedBorderRadius,
    background: kind === 'hex-grid'
      ? 'transparent'
      : cell.dropTarget ? '#f97316' : cell.borderColor ?? getDefaultCellBorderColor(kind),
    clipPath: kind === 'hex-grid' ? HEX_CLIP_PATH : undefined,
    boxShadow: cell.selected
      ? '0 0 0 2px rgba(249,115,22,0.22)'
      : cell.highlighted
        ? '0 0 0 1px rgba(14,165,233,0.16)'
        : 'none',
    display: 'grid',
    overflow: 'hidden',
    cursor: cell.onClick ? 'pointer' : 'default',
    transition: 'box-shadow 140ms ease, background 140ms ease',
  };
}

function getCellInnerStyle(
  cell: BoardGridCell,
  kind: BoardGridKind,
  editable: boolean,
): CSSProperties {
  const borderW = Math.max(0, cell.borderWidth ?? getDefaultCellBorderWidth(kind));
  const inset = `${borderW}px`;
  const resolvedInnerRadius = `${Math.max(0, (cell.borderRadius ?? 10) - borderW)}px`;

  return {
    position: 'absolute',
    inset,
    borderRadius: resolvedInnerRadius,
    background: cell.background ?? 'rgba(255,255,255,0.88)',
    display: 'grid',
    placeItems: 'center',
    padding: editable ? '0.18rem' : '0.14rem',
    overflow: 'hidden',
  };
}

function getCellTextureOverlayStyle(
  cell: BoardGridCell,
  kind: BoardGridKind,
): CSSProperties | null {
  if (!cell.textureId || cell.textureId === 'none') {
    return null;
  }

  const textureStyle = getBoardSurfaceTextureStyle(
    cell.textureId as Parameters<typeof getBoardSurfaceTextureStyle>[0],
    cell.textureOpacity ?? 0.3,
  );

  if (!textureStyle.backgroundImage) {
    return null;
  }

  const borderW = Math.max(0, cell.borderWidth ?? getDefaultCellBorderWidth(kind));
  const inset = `${borderW}px`;
  const resolvedInnerRadius = `${Math.max(0, (cell.borderRadius ?? 10) - borderW)}px`;

  return {
    position: 'absolute',
    inset,
    borderRadius: resolvedInnerRadius,
    pointerEvents: 'none',
    ...textureStyle,
  };
}

function getHexCellFillStyle(): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    overflow: 'visible',
  };
}

function getHexCellContentStyle(
  cell: BoardGridCell,
  editable: boolean,
): CSSProperties {
  const borderWidth = Math.max(0, cell.borderWidth ?? getDefaultCellBorderWidth('hex-grid'));
  const contentPadding = borderWidth + (editable ? 3 : 2);

  return {
    position: 'absolute',
    inset: 0,
    boxSizing: 'border-box',
    display: 'grid',
    placeItems: 'center',
    padding: `${contentPadding}px`,
    clipPath: HEX_CLIP_PATH,
    overflow: 'hidden',
  };
}

function getCellSelectionOverlayStyle(kind: BoardGridKind): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    borderRadius: kind === 'hex-grid' ? '0' : '8px',
    background: 'rgba(0,0,0,0.2)',
    clipPath: kind === 'hex-grid' ? HEX_CLIP_PATH : undefined,
    pointerEvents: 'none',
  };
}

type HexPoint = { x: number; y: number };

interface HexEdgeSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

function roundHexCoordinate(value: number): string {
  return value.toFixed(3);
}

function getHexPointsForBounds(bounds: { x: number; y: number; width: number; height: number }): HexPoint[] {
  return [
    { x: bounds.x + (bounds.width * 0.5), y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + (bounds.height * 0.25) },
    { x: bounds.x + bounds.width, y: bounds.y + (bounds.height * 0.75) },
    { x: bounds.x + (bounds.width * 0.5), y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + (bounds.height * 0.75) },
    { x: bounds.x, y: bounds.y + (bounds.height * 0.25) },
  ];
}

function getHexEdgeKey(start: HexPoint, end: HexPoint): string {
  const startKey = `${roundHexCoordinate(start.x)},${roundHexCoordinate(start.y)}`;
  const endKey = `${roundHexCoordinate(end.x)},${roundHexCoordinate(end.y)}`;
  return startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function getHexGridEdgeSegments(
  cellsWithBounds: Array<{
    cell: BoardGridCell;
    bounds: { x: number; y: number; width: number; height: number };
  }>,
): HexEdgeSegment[] {
  const edgeMap = new Map<string, HexEdgeSegment>();

  for (const { cell, bounds } of cellsWithBounds) {
    const strokeWidth = Math.max(0, cell.borderWidth ?? getDefaultCellBorderWidth('hex-grid'));
    if (strokeWidth <= 0) {
      continue;
    }

    const strokeColor = cell.dropTarget ? '#f97316' : cell.borderColor ?? getDefaultCellBorderColor('hex-grid');
    const points = getHexPointsForBounds(bounds);

    for (let index = 0; index < points.length; index += 1) {
      const start = points[index];
      const end = points[(index + 1) % points.length];
      const edgeKey = getHexEdgeKey(start, end);
      const current = edgeMap.get(edgeKey);

      if (!current || strokeWidth > current.width) {
        edgeMap.set(edgeKey, {
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y,
          color: strokeColor,
          width: strokeWidth,
        });
      }
    }
  }

  return [...edgeMap.values()];
}

function getHexGridOverlayStyle(): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    overflow: 'visible',
  };
}

function renderHexCellBody(
  cell: BoardGridCell,
  editable: boolean,
) {
  const textureOverlay = getBoardSurfaceTextureStyle(
    cell.textureId as Parameters<typeof getBoardSurfaceTextureStyle>[0],
    cell.textureOpacity ?? 0.3,
  );
  const hasTexture = Boolean(cell.textureId && cell.textureId !== 'none' && textureOverlay.backgroundImage);

  return (
    <>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={getHexCellFillStyle()}>
        <polygon
          points={HEX_POINTS}
          fill={cell.background ?? 'rgba(255,255,255,0.88)'}
        />
        {cell.selected ? (
          <polygon
            points={HEX_POINTS}
            fill="rgba(0,0,0,0.2)"
          />
        ) : null}
      </svg>
      {hasTexture ? (
        <div
          style={{
            ...getHexCellContentStyle(cell, editable),
            ...textureOverlay,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {cell.content ? (
        <div style={getHexCellContentStyle(cell, editable)}>
          {cell.content}
        </div>
      ) : null}
    </>
  );
}

function renderCell(
  cell: BoardGridCell,
  kind: BoardGridKind,
  editable: boolean,
  bounds: { x: number; y: number; width: number; height: number },
) {
  const interactive = Boolean(cell.onClick || cell.onDragOver || cell.onDrop);
  const content = cell.content ?? null;
  const style = getCellStyle(cell, kind, bounds);

  // Interactive cells get pointerEvents: 'auto' so they're clickable
  // even though the grid root has pointerEvents: 'none'.
  if (interactive) {
    style.pointerEvents = 'auto';
  }

  if (kind === 'hex-grid') {
    const body = renderHexCellBody(cell, editable);

    if (!interactive) {
      return (
        <div key={cell.id} style={style}>
          {body}
        </div>
      );
    }

    return (
      <div
        key={cell.id}
        role={cell.onClick ? 'button' : undefined}
        aria-label={cell.label}
        tabIndex={cell.onClick ? 0 : undefined}
        onClick={cell.onClick}
        onMouseDown={cell.onMouseDown}
        onDragOver={cell.onDragOver}
        onDrop={cell.onDrop}
        onKeyDown={cell.onClick
          ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              cell.onClick?.();
            }
          }
          : undefined}
        title={cell.label}
        style={style}
      >
        {body}
      </div>
    );
  }

  const innerStyle = getCellInnerStyle(cell, kind, editable);

  if (!interactive) {
    const textureOverlay = getCellTextureOverlayStyle(cell, kind);

    return (
      <div key={cell.id} style={style}>
        <div style={innerStyle}>
          {textureOverlay ? <div style={textureOverlay} /> : null}
          {content}
          {cell.selected ? <div style={getCellSelectionOverlayStyle(kind)} /> : null}
        </div>
      </div>
    );
  }

  return (
    <div
      key={cell.id}
      role={cell.onClick ? 'button' : undefined}
      aria-label={cell.label}
      tabIndex={cell.onClick ? 0 : undefined}
      onClick={cell.onClick}
      onMouseDown={cell.onMouseDown}
      onDragOver={cell.onDragOver}
      onDrop={cell.onDrop}
      onKeyDown={cell.onClick
        ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            cell.onClick?.();
          }
        }
        : undefined}
      title={cell.label}
      style={style}
    >
      <div style={innerStyle}>
        {(() => {
          const textureOverlay = getCellTextureOverlayStyle(cell, kind);
          return textureOverlay ? <div style={textureOverlay} /> : null;
        })()}
        {content}
        {cell.selected ? <div style={getCellSelectionOverlayStyle(kind)} /> : null}
      </div>
    </div>
  );
}

export function BoardGrid({
  kind,
  rows = 1,
  columns = 1,
  cells,
  editable = false,
}: BoardGridProps) {
  const resolvedCells = cells.length > 0
    ? cells
    : Array.from({ length: Math.max(1, rows) * Math.max(1, columns) }, (_unused, index) => {
      const row = Math.floor(index / Math.max(1, columns));
      const column = index % Math.max(1, columns);

      return {
        id: `placeholder-${kind}-${row}-${column}`,
        row,
        column,
        label: kind === 'checkerboard-grid' ? `${String.fromCharCode(65 + (row % 26))}${column + 1}` : `${row + 1}-${column + 1}`,
        background: 'rgba(255,255,255,0.92)',
        borderColor: getDefaultCellBorderColor(kind),
      };
    });
  const metrics = resolveBoardGridLayout(kind, resolvedCells, rows, columns);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!rootRef.current) {
      return undefined;
    }

    let frameA: number | null = null;
    let frameB: number | null = null;

    function readSize(element: HTMLDivElement) {
      const width = element.clientWidth || element.offsetWidth;
      const height = element.clientHeight || element.offsetHeight;
      if (width > 0 || height > 0) {
        return { width, height };
      }

      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
      };
    }

    function updateSize() {
      const element = rootRef.current;
      if (!element) {
        return;
      }

      const nextSize = readSize(element);
      setContainerSize({
        width: nextSize.width,
        height: nextSize.height,
      });
    }

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(rootRef.current);
    if (rootRef.current.parentElement) {
      observer.observe(rootRef.current.parentElement);
    }

    // The editor renders grids through react-konva's detached Html bridge.
    // Measure again over the next couple of frames so percentage sizing can
    // settle after the bridge attaches the node into the live DOM.
    frameA = window.requestAnimationFrame(() => {
      updateSize();
      frameB = window.requestAnimationFrame(() => {
        updateSize();
      });
    });

    return () => {
      observer.disconnect();
      if (frameA !== null) {
        window.cancelAnimationFrame(frameA);
      }
      if (frameB !== null) {
        window.cancelAnimationFrame(frameB);
      }
    };
  }, []);

  const overlapUnits = kind === 'hex-grid' ? HEX_OVERLAP * 2 : 0;
  const safetyInsetPx = kind === 'hex-grid' ? 2 : 0;
  const effectiveTotalWidth = metrics.totalWidth + overlapUnits;
  const effectiveTotalHeight = metrics.totalHeight + overlapUnits;
  const availableWidth = Math.max(0, containerSize.width - safetyInsetPx * 2);
  const availableHeight = Math.max(0, containerSize.height - safetyInsetPx * 2);
  const widthScale = availableWidth > 0 ? availableWidth / effectiveTotalWidth : 0;
  const heightScale = availableHeight > 0 ? availableHeight / effectiveTotalHeight : 0;
  const scale = Math.max(0, Math.min(widthScale, heightScale));
  const contentOverlap = kind === 'hex-grid' ? HEX_OVERLAP * scale : 0;
  const contentWidth = effectiveTotalWidth * scale;
  const contentHeight = effectiveTotalHeight * scale;
  const offsetX = Math.max(0, (containerSize.width - contentWidth) / 2) + contentOverlap;
  const offsetY = Math.max(0, (containerSize.height - contentHeight) / 2) + contentOverlap;
  const resolvedCellRenderData = scale > 0
    ? resolvedCells.map((cell) => {
      const bounds = metrics.getCellBounds(cell.row, cell.column);
      const overlap = kind === 'hex-grid' ? HEX_OVERLAP * bounds.width * scale : 0;
      const baseBounds = {
        x: offsetX + (bounds.x * scale),
        y: offsetY + (bounds.y * scale),
        width: bounds.width * scale,
        height: bounds.height * scale,
      };

      return {
        cell,
        bounds: {
          x: baseBounds.x - overlap,
          y: baseBounds.y - overlap,
          width: baseBounds.width + overlap * 2,
          height: baseBounds.height + overlap * 2,
        },
        baseBounds,
      };
    })
    : [];
  const hexEdgeSegments = useMemo(
    () => (kind === 'hex-grid' ? getHexGridEdgeSegments(
      resolvedCellRenderData.map(({ cell, baseBounds }) => ({ cell, bounds: baseBounds })),
    ) : []),
    [kind, resolvedCellRenderData],
  );

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        // Let pointer events pass through gaps between cells to the canvas beneath
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
        }}
      >
        {resolvedCellRenderData.map(({ cell, bounds }) => renderCell(
          cell,
          kind,
          editable,
          bounds,
        ))}
        {kind === 'hex-grid' && hexEdgeSegments.length > 0 ? (
          <svg style={getHexGridOverlayStyle()}>
            {hexEdgeSegments.map((segment, index) => (
              <line
                key={`hex-edge-${index}`}
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                stroke={segment.color}
                strokeWidth={segment.width}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
              />
            ))}
          </svg>
        ) : null}
      </div>
    </div>
  );
}
