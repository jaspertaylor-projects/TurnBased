import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  getGridCoordinateKey,
} from '@turnbased/engine-components';
import type {
  ComponentInstanceModel,
  GridCellCoordinate,
} from '@turnbased/engine-components';
import { BoardGrid } from '@turnbased/engine-ui';
import type { BoardSurfaceItem } from '@turnbased/engine-ui';

import { renderComponentIcon } from '../../componentMeta';
import { TextBoxContent } from '../../components/TextBoxContent';
import {
  getGridCellAppearance,
  isBoardGridComponentType,
  isLeafComponentType,
  isMovableComponentType,
} from '../../boardLayout';
import type { CanonicalGeometry } from '../../boardLayout';
import type { EditorProject } from '../../types';

import { getComponentLabel, renderImageAreaContent } from './boardEditorUtils';
import { getGridCellSelectionLabel } from './boardEditorUtils';
import { InlineTextBoxEditor } from './InlineTextBoxEditor';

// ── Types ────────────────────────────────────────────────────────────

export interface BuildSurfaceItemParams {
  project: EditorProject;
  canonicalGeometries: Record<string, CanonicalGeometry>;
  activeSurfaceFrames: Record<string, { x: number; y: number; width: number; height: number }>;
  resolvedSelectedBoardChildId: string | null;
  selectedBoardChildId: string | null;
  editingTextBoxId: string | null;
  resolvedSelectedGridCell: GridCellCoordinate | null;
  selectedGridCells: GridCellCoordinate[];
  viewportMetrics: { left: number; top: number; width: number; height: number } | null;
  boardRenderWidth: number;
  boardRenderHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  resolvePaletteColor: (value: string | null | undefined) => string | null;
  setSelectedBoardChildId: (id: string | null) => void;
  setSelectedGridCellKey: (key: string | null | ((current: string | null) => string | null)) => void;
  setEditingTextBoxId: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setPanX: (panX: number) => void;
  setPanY: (panY: number) => void;
  onUpdateComponent: (instanceId: string, updater: (instance: ComponentInstanceModel) => ComponentInstanceModel) => void;
  handleBoardItemPointerDown: (args: {
    child: ComponentInstanceModel;
    childId: string;
    event: ReactMouseEvent<HTMLDivElement>;
    geom: CanonicalGeometry;
    frame: { x: number; y: number; width: number; height: number };
    forcedEdges?: { left: boolean; right: boolean; top: boolean; bottom: boolean };
  }) => void;
  handleBoardItemPointerMove: (args: {
    event: ReactMouseEvent<HTMLDivElement>;
    frame: { x: number; y: number; width: number; height: number };
  }) => void;
}

// ── buildSurfaceItem ─────────────────────────────────────────────────

/**
 * Build a single BoardSurfaceItem from a board descendant, attaching all
 * event handlers and content rendering.
 */
export function buildSurfaceItem(
  childId: string,
  _depth: number,
  params: BuildSurfaceItemParams,
): BoardSurfaceItem | null {
  const {
    project,
    canonicalGeometries,
    activeSurfaceFrames,
    resolvedSelectedBoardChildId,
    selectedBoardChildId,
    editingTextBoxId,
    resolvedSelectedGridCell,
    viewportMetrics,
    boardRenderWidth,
    boardRenderHeight,
    resolvePaletteColor,
    setSelectedBoardChildId,
    setSelectedGridCellKey,
    setEditingTextBoxId,
    setZoom,
    setPanX,
    setPanY,
    onUpdateComponent,
    handleBoardItemPointerDown,
    handleBoardItemPointerMove,
  } = params;

  const child = project.instances[childId];
  if (!child) return null;
  const geom = canonicalGeometries[childId];
  if (!geom) return null;
  const projectedFrame = activeSurfaceFrames[childId];
  if (!projectedFrame) return null;

  const isSelected = childId === resolvedSelectedBoardChildId;

  // An image layer is just the image — strip the legacy white "card" fill and
  // hairline border that older image-areas were created with, unless the
  // creator has deliberately chosen a different fill/border in the inspector.
  const isImageArea = child.componentType === 'image-area';
  const imageUsesLegacyDefaultFill = isImageArea && geom.background === 'rgba(255,255,255,0.92)';
  const imageUsesLegacyDefaultBorder = isImageArea && geom.borderWidth === 1
    && geom.borderColor === 'rgba(15,118,110,0.16)';

  return {
    id: childId,
    label: getComponentLabel(project, childId),
    typeLabel: '',
    icon: renderComponentIcon(child.componentType, { size: 16, style: { color: '#064e3b' } }),
    x: projectedFrame.x,
    y: projectedFrame.y,
    width: projectedFrame.width,
    height: projectedFrame.height,
    background: imageUsesLegacyDefaultFill ? 'transparent' : resolvePaletteColor(geom.background),
    textureId: geom.textureId ?? null,
    textureOpacity: geom.textureOpacity ?? 0.3,
    borderColor: resolvePaletteColor(geom.borderColor),
    borderWidth: imageUsesLegacyDefaultBorder ? 0 : geom.borderWidth,
    borderRadius: typeof geom.borderRadius === 'number'
      ? geom.borderRadius * Math.min(projectedFrame.width / Math.max(geom.localWidth, 1), projectedFrame.height / Math.max(geom.localHeight, 1))
      : geom.borderRadius,
    clipPath: geom.clipPath ?? null,
    rotation: child.frame?.rotation ?? 0,
    // Text boxes and images fill their frame edge-to-edge (no inset gutter
    // showing the item background around them). Grids keep a 12px inset so the
    // outermost hexes don't get clipped by the rounded frame corners.
    padding: child.componentType === 'text-box' || child.componentType === 'image-area'
      ? 0
      : isBoardGridComponentType(child.componentType) ? 12 : undefined,
    selected: isSelected,
    onClick: () => {
      if (selectedBoardChildId !== childId) {
        setEditingTextBoxId(null);
      }
      setSelectedBoardChildId(childId);
      if (!isBoardGridComponentType(child.componentType)) {
        setSelectedGridCellKey(null);
      }
    },
    onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => {
      handleBoardItemPointerDown({
        child,
        childId,
        event,
        geom,
        frame: projectedFrame,
      });
    },
    onMouseMove: (event: ReactMouseEvent<HTMLDivElement>) => {
      handleBoardItemPointerMove({
        event,
        frame: projectedFrame,
      });
    },
    onResizeHandle: (edges, event) => {
      handleBoardItemPointerDown({
        child,
        childId,
        event: event as unknown as ReactMouseEvent<HTMLDivElement>,
        geom,
        frame: projectedFrame,
        forcedEdges: edges,
      });
    },
    // Double-clicking a text-box enters inline editing mode.
    // Double-clicking any other non-leaf component zooms to fit it.
    onDoubleClick: child.componentType === 'text-box'
      ? () => { setEditingTextBoxId(childId); }
      : !isLeafComponentType(child.componentType) && !isBoardGridComponentType(child.componentType)
      ? () => {
        if (!viewportMetrics || !projectedFrame) return;
        const pad = 0.88;
        const bs = Math.min((viewportMetrics.width * pad) / boardRenderWidth, (viewportMetrics.height * pad) / boardRenderHeight);
        const fitZoomX = (viewportMetrics.width * pad) / (projectedFrame.width * bs);
        const fitZoomY = (viewportMetrics.height * pad) / (projectedFrame.height * bs);
        const newZoom = Math.min(fitZoomX, fitZoomY);
        const newScale = bs * newZoom;
        const compCenterBoardX = projectedFrame.x + projectedFrame.width / 2;
        const compCenterBoardY = projectedFrame.y + projectedFrame.height / 2;
        const vpCenterX = viewportMetrics.width / 2;
        const vpCenterY = viewportMetrics.height / 2;
        setPanX(vpCenterX - compCenterBoardX * newScale);
        setPanY(vpCenterY - compCenterBoardY * newScale);
        setZoom(newZoom);
        setSelectedBoardChildId(childId);
      }
      : undefined,
    showHeader: false,
    content: child.componentType === 'text-box'
      ? (editingTextBoxId === childId
        ? (
          <InlineTextBoxEditor
            project={project}
            properties={child.properties}
            onSave={(html) => {
              onUpdateComponent(childId, (current) => ({
                ...current,
                properties: { ...current.properties, contentHtml: html },
              }));
              setEditingTextBoxId(null);
            }}
            onBlur={(html) => {
              onUpdateComponent(childId, (current) => ({
                ...current,
                properties: { ...current.properties, contentHtml: html },
              }));
              setEditingTextBoxId(null);
            }}
          />
        )
        : (
          <TextBoxContent
            project={project}
            properties={child.properties}
            emptyPlaceholder="Double-click to edit"
          />
        )
      )
      : child.componentType === 'image-area'
      ? renderImageAreaContent(child.properties)
      : child.componentType === 'card'
      ? (
        /* cardPreviewContent — card title + subtitle preview on canvas */
        <div data-layout="cardPreviewContent" style={{ display: 'grid', gap: '0.45rem', color: '#064e3b' }}>
          <strong style={{ fontSize: '0.92rem' }}>{String(child.properties.title ?? child.properties.label ?? 'Card')}</strong>
          <span style={{ fontSize: '0.8rem', color: '#0f766e', lineHeight: 1.5 }}>
            {String(child.properties.subtitle ?? '')}
          </span>
        </div>
      )
      : isBoardGridComponentType(child.componentType)
      ? (() => {
        const cellIds = child.children.map(String).filter((cellId) => project.instances[cellId]?.componentType === 'space');

        return (
          <BoardGrid
            kind={child.componentType as 'hex-grid' | 'square-grid' | 'checkerboard-grid'}
            editable
            cells={cellIds.map((cellId, cellIndex) => {
              const cell = project.instances[cellId];
              const row = typeof cell?.placement?.coordinates?.y === 'number'
                ? Math.trunc(cell.placement.coordinates.y)
                : cellIndex;
              const column = typeof cell?.placement?.coordinates?.x === 'number'
                ? Math.trunc(cell.placement.coordinates.x)
                : 0;
              const cellKey = getGridCoordinateKey({ x: column, y: row });
              const gridCellAppearance = getGridCellAppearance(child);
              const cellCoordinate = { x: column, y: row };

              return {
                id: cellId,
                row,
                column,
                label: getGridCellSelectionLabel(project, child, cellCoordinate),
                background: resolvePaletteColor(gridCellAppearance.background) ?? gridCellAppearance.background,
                textureId: gridCellAppearance.textureId,
                textureOpacity: gridCellAppearance.textureOpacity,
                borderColor: resolvePaletteColor(gridCellAppearance.borderColor) ?? (child.componentType === 'hex-grid' ? undefined : 'rgba(15,118,110,0.18)'),
                borderWidth: gridCellAppearance.borderWidth,
                borderRadius: gridCellAppearance.borderRadius,
                selected: isSelected && cellKey === (resolvedSelectedGridCell ? getGridCoordinateKey(resolvedSelectedGridCell) : null),
                onClick: () => {
                  setSelectedBoardChildId(childId);
                  setSelectedGridCellKey((current: string | null) => (current === cellKey ? null : cellKey));
                },
              };
            })}
          />
        );
      })()
      : null,
  };
}

// ── collectSurfaceItems ──────────────────────────────────────────────

/**
 * Recursively collect all BoardSurfaceItems from the given child ids,
 * descending into non-leaf, non-grid containers.
 */
export function collectSurfaceItems(
  childIds: string[],
  depth: number,
  params: BuildSurfaceItemParams,
): BoardSurfaceItem[] {
  const items: BoardSurfaceItem[] = [];
  for (let i = 0; i < childIds.length; i++) {
    const childId = childIds[i];
    const item = buildSurfaceItem(childId, depth, params);
    if (!item) continue;
    items.push(item);

    // Recurse into non-leaf, non-grid children to render their descendants too.
    const child = params.project.instances[childId];
    if (child && !isLeafComponentType(child.componentType) && !isBoardGridComponentType(child.componentType)) {
      const grandchildIds = child.children.map(String).filter((gcId) => {
        const gc = params.project.instances[gcId];
        return gc && !isMovableComponentType(gc.componentType);
      });
      if (grandchildIds.length > 0) {
        items.push(...collectSurfaceItems(grandchildIds, depth + 1, params));
      }
    }
  }
  return items;
}
