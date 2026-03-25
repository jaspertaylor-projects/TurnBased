import { useEffect, useRef, useState } from 'react';
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
    background: cell.dropTarget ? '#f97316' : cell.borderColor ?? getDefaultCellBorderColor(kind),
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
  const inset = `${cell.borderWidth ?? getDefaultCellBorderWidth(kind)}px`;
  const resolvedInnerRadius = kind === 'hex-grid' ? '0' : `${Math.max(0, (cell.borderRadius ?? 10) - (cell.borderWidth ?? getDefaultCellBorderWidth(kind)))}px`;

  return {
    position: 'absolute',
    inset,
    borderRadius: resolvedInnerRadius,
    background: cell.background ?? 'rgba(255,255,255,0.88)',
    clipPath: kind === 'hex-grid' ? HEX_CLIP_PATH : undefined,
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

  const inset = `${cell.borderWidth ?? getDefaultCellBorderWidth(kind)}px`;
  const resolvedInnerRadius = kind === 'hex-grid' ? '0' : `${Math.max(0, (cell.borderRadius ?? 10) - (cell.borderWidth ?? getDefaultCellBorderWidth(kind)))}px`;

  return {
    position: 'absolute',
    inset,
    borderRadius: resolvedInnerRadius,
    clipPath: kind === 'hex-grid' ? HEX_CLIP_PATH : undefined,
    pointerEvents: 'none',
    ...textureStyle,
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

function renderCell(
  cell: BoardGridCell,
  kind: BoardGridKind,
  editable: boolean,
  bounds: { x: number; y: number; width: number; height: number },
) {
  const interactive = Boolean(cell.onClick || cell.onDragOver || cell.onDrop);
  const content = cell.content ?? null;
  const style = getCellStyle(cell, kind, bounds);
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

    function updateSize() {
      const element = rootRef.current;
      if (!element) {
        return;
      }

      const rect = element.getBoundingClientRect();
      setContainerSize({
        width: rect.width,
        height: rect.height,
      });
    }

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(rootRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const widthScale = containerSize.width > 0 ? containerSize.width / metrics.totalWidth : 0;
  const heightScale = containerSize.height > 0 ? containerSize.height / metrics.totalHeight : 0;
  const scale = Math.max(0, Math.min(widthScale, heightScale));
  const contentWidth = metrics.totalWidth * scale;
  const contentHeight = metrics.totalHeight * scale;
  const offsetX = Math.max(0, (containerSize.width - contentWidth) / 2);
  const offsetY = Math.max(0, (containerSize.height - contentHeight) / 2);

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
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
        }}
      >
        {scale > 0 ? resolvedCells.map((cell) => {
          const bounds = metrics.getCellBounds(cell.row, cell.column);
          return renderCell(
            cell,
            kind,
            editable,
            {
              x: offsetX + (bounds.x * scale),
              y: offsetY + (bounds.y * scale),
              width: bounds.width * scale,
              height: bounds.height * scale,
            },
          );
        }) : null}
      </div>
    </div>
  );
}
