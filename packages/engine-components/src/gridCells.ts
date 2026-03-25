import type { BoardSurfaceTextureId, GridCellCoordinate, GridCellStyle } from './types';
import { BOARD_SURFACE_TEXTURE_OPTIONS } from './boardAppearance';

export type GridComponentType = 'hex-grid' | 'square-grid' | 'checkerboard-grid';

export interface GridNeighborOption {
  id: string;
  label: string;
  coordinate: GridCellCoordinate;
}

function toGridCoordinate(value: unknown): GridCellCoordinate | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as { x?: unknown; y?: unknown };
  if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number') {
    return null;
  }

  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) {
    return null;
  }

  return {
    x: Math.trunc(candidate.x),
    y: Math.trunc(candidate.y),
  };
}

export function getGridCoordinateKey(coordinate: GridCellCoordinate): string {
  return `${coordinate.x},${coordinate.y}`;
}

export function normalizeGridCellCoordinates(cells: readonly GridCellCoordinate[]): GridCellCoordinate[] {
  const unique = new Map<string, GridCellCoordinate>();

  for (const cell of cells) {
    const normalized = toGridCoordinate(cell);
    if (!normalized) {
      continue;
    }

    unique.set(getGridCoordinateKey(normalized), normalized);
  }

  return [...unique.values()].sort((left, right) => {
    if (left.y !== right.y) {
      return left.y - right.y;
    }

    return left.x - right.x;
  });
}

export function createRectangularGridCellCoordinates(rows: number, columns: number): GridCellCoordinate[] {
  const safeRows = Number.isFinite(rows) ? Math.max(1, Math.trunc(rows)) : 1;
  const safeColumns = Number.isFinite(columns) ? Math.max(1, Math.trunc(columns)) : 1;

  return normalizeGridCellCoordinates(
    Array.from({ length: safeRows * safeColumns }, (_unused, index) => ({
      x: index % safeColumns,
      y: Math.floor(index / safeColumns),
    })),
  );
}

export function readGridCellCoordinates(value: unknown, fallbackRows = 1, fallbackColumns = 1): GridCellCoordinate[] {
  if (Array.isArray(value)) {
    const normalized = normalizeGridCellCoordinates(
      value
        .map((entry) => toGridCoordinate(entry))
        .filter((entry): entry is GridCellCoordinate => Boolean(entry)),
    );

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return createRectangularGridCellCoordinates(fallbackRows, fallbackColumns);
}

export function getGridCellLabel(kind: GridComponentType, coordinate: GridCellCoordinate, prefix?: string): string {
  const resolvedPrefix = prefix?.trim() || (kind === 'hex-grid' ? 'Hex' : 'Cell');
  return `${resolvedPrefix} ${coordinate.x},${coordinate.y}`;
}

export function listGridNeighborOptions(kind: GridComponentType, coordinate: GridCellCoordinate): GridNeighborOption[] {
  if (kind === 'hex-grid') {
    const oddRow = Math.abs(coordinate.y) % 2 === 1;
    const offsets = oddRow
      ? [
        { id: 'northwest', label: 'Northwest', dx: 0, dy: -1 },
        { id: 'northeast', label: 'Northeast', dx: 1, dy: -1 },
        { id: 'west', label: 'West', dx: -1, dy: 0 },
        { id: 'east', label: 'East', dx: 1, dy: 0 },
        { id: 'southwest', label: 'Southwest', dx: 0, dy: 1 },
        { id: 'southeast', label: 'Southeast', dx: 1, dy: 1 },
      ]
      : [
        { id: 'northwest', label: 'Northwest', dx: -1, dy: -1 },
        { id: 'northeast', label: 'Northeast', dx: 0, dy: -1 },
        { id: 'west', label: 'West', dx: -1, dy: 0 },
        { id: 'east', label: 'East', dx: 1, dy: 0 },
        { id: 'southwest', label: 'Southwest', dx: -1, dy: 1 },
        { id: 'southeast', label: 'Southeast', dx: 0, dy: 1 },
      ];

    return offsets.map((offset) => ({
      id: offset.id,
      label: offset.label,
      coordinate: {
        x: coordinate.x + offset.dx,
        y: coordinate.y + offset.dy,
      },
    }));
  }

  return [
    { id: 'north', label: 'North', coordinate: { x: coordinate.x, y: coordinate.y - 1 } },
    { id: 'west', label: 'West', coordinate: { x: coordinate.x - 1, y: coordinate.y } },
    { id: 'east', label: 'East', coordinate: { x: coordinate.x + 1, y: coordinate.y } },
    { id: 'south', label: 'South', coordinate: { x: coordinate.x, y: coordinate.y + 1 } },
  ];
}

export function readGridCellStyle(value: unknown): GridCellStyle {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const source = value as Record<string, unknown>;
  const style: GridCellStyle = {};

  if (typeof source.background === 'string' && source.background.trim().length > 0) {
    style.background = source.background;
  }

  if (typeof source.textureId === 'string' && BOARD_SURFACE_TEXTURE_OPTIONS.some((opt) => opt.id === source.textureId)) {
    style.textureId = source.textureId as BoardSurfaceTextureId;
  }

  if (typeof source.textureOpacity === 'number' && Number.isFinite(source.textureOpacity)) {
    style.textureOpacity = Math.max(0, Math.min(1, source.textureOpacity));
  }

  if (typeof source.borderWidth === 'number' && Number.isFinite(source.borderWidth)) {
    style.borderWidth = Math.max(0, source.borderWidth);
  }

  if (typeof source.borderRadius === 'number' && Number.isFinite(source.borderRadius)) {
    style.borderRadius = Math.max(0, source.borderRadius);
  }

  return style;
}
