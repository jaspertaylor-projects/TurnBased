import {
  readGridCellCoordinates,
  type BoardSurfaceTextureId,
  type ComponentFrame,
  type ComponentInstanceModel,
  type GridCellCoordinate,
} from '@turnbased/engine-components';

export interface CanonicalGeometry {
  localWidth: number;
  localHeight: number;
  localX: number;
  localY: number;
  absX: number;
  absY: number;
  absW: number;
  absH: number;
  renderedX: number;
  renderedY: number;
  renderedWidth: number;
  renderedHeight: number;
  clipPath?: string | null;
  background?: string | null;
  textureId?: BoardSurfaceTextureId | null;
  textureOpacity?: number | null;
  borderColor?: string | null;
  borderWidth?: number;
  borderRadius?: number;
}

export const BOARD_SURFACE_WIDTH = 760;
export const BOARD_SURFACE_HEIGHT = 520;
export const BOARD_SURFACE_BACKGROUND = 'linear-gradient(160deg, #d1fae5, #e0f2fe, #fef9c3)';
export const MIN_BOARD_ITEM_WIDTH = 24;
export const MIN_BOARD_ITEM_HEIGHT = 24;

export interface ZoomRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Walk a drill path and compute the absolute board-level rectangle of the
 * deepest drilled component. Each entry in the drill path is an instance id.
 * Uses exact logical computed geometry rather than approximations.
 */
export function computeZoomRect(
  drillPath: string[],
  geometries: Record<string, CanonicalGeometry>,
): ZoomRect {
  if (drillPath.length === 0) {
    return { x: 0, y: 0, width: BOARD_SURFACE_WIDTH, height: BOARD_SURFACE_HEIGHT };
  }
  
  const targetId = drillPath[drillPath.length - 1];
  const geometry = geometries[targetId];
  if (geometry) {
    return {
      x: geometry.absX,
      y: geometry.absY,
      width: geometry.absW,
      height: geometry.absH,
    };
  }

  return { x: 0, y: 0, width: BOARD_SURFACE_WIDTH, height: BOARD_SURFACE_HEIGHT };
}

export function computeCanonicalGeometries(
  instances: Record<string, ComponentInstanceModel>,
  rootBoardId: string,
  boardRenderWidth: number,
  boardRenderHeight: number,
): Record<string, CanonicalGeometry> {
  const result: Record<string, CanonicalGeometry> = {};
  const board = instances[rootBoardId];
  if (!board) return result;

  const boardRenderScaleX = boardRenderWidth / BOARD_SURFACE_WIDTH;
  const boardRenderScaleY = boardRenderHeight / BOARD_SURFACE_HEIGHT;

  function walk(instanceId: string, depth: number, parentAbsX: number, parentAbsY: number, parentAbsW: number, parentAbsH: number, parentLocalW: number, parentLocalH: number, childIndex: number) {
    const instance = instances[instanceId];
    if (!instance) return;

    const isDirect = depth === 0;
    const clampW = isDirect ? BOARD_SURFACE_WIDTH : parentLocalW;
    const clampH = isDirect ? BOARD_SURFACE_HEIGHT : parentLocalH;

    const localFrame = isDirect
      ? getResolvedBoardItemFrame(instance, childIndex)
      : getResolvedChildItemFrame(instance, childIndex, clampW, clampH);

    const absX = parentAbsX + (localFrame.x / clampW) * parentAbsW;
    const absY = parentAbsY + (localFrame.y / clampH) * parentAbsH;
    const absW = (localFrame.width / clampW) * parentAbsW;
    const absH = (localFrame.height / clampH) * parentAbsH;

    result[instanceId] = {
      localWidth: localFrame.width,
      localHeight: localFrame.height,
      localX: localFrame.x,
      localY: localFrame.y,
      absX,
      absY,
      absW,
      absH,
      renderedX: absX * boardRenderScaleX,
      renderedY: absY * boardRenderScaleY,
      renderedWidth: absW * boardRenderScaleX,
      renderedHeight: absH * boardRenderScaleY,
      clipPath: localFrame.clipPath ?? null,
      background: localFrame.background,
      textureId: localFrame.textureId,
      textureOpacity: localFrame.textureOpacity,
      borderColor: localFrame.borderColor,
      borderWidth: localFrame.borderWidth,
      borderRadius: localFrame.borderRadius,
    };

    let nextIndex = 0;
    instance.children.forEach((childIdStr) => {
      const childId = String(childIdStr);
      const child = instances[childId];
      if (child && !isMovableComponentType(child.componentType)) {
        walk(childId, depth + 1, absX, absY, absW, absH, localFrame.width, localFrame.height, nextIndex++);
      }
    });
  }

  let index = 0;
  board.children.forEach((childIdStr) => {
    const childId = String(childIdStr);
    const child = instances[childId];
    if (child && !isMovableComponentType(child.componentType)) {
      walk(childId, 0, 0, 0, BOARD_SURFACE_WIDTH, BOARD_SURFACE_HEIGHT, BOARD_SURFACE_WIDTH, BOARD_SURFACE_HEIGHT, index++);
    }
  });

  return result;
}

export function isMovableComponentType(componentType: string): boolean {
  return componentType === 'piece' || componentType === 'token';
}

export function isBoardGridComponentType(componentType: string): componentType is 'hex-grid' | 'square-grid' | 'checkerboard-grid' {
  return componentType === 'hex-grid' || componentType === 'square-grid' || componentType === 'checkerboard-grid';
}

export function isBoardAuthorableComponentType(componentType: string): boolean {
  return componentType === 'card'
    || componentType === 'image-area'
    || componentType === 'network'
    || componentType === 'space'
    || componentType === 'track'
    || componentType === 'text-box'
    || componentType === 'hex-grid'
    || componentType === 'square-grid';
}

export function defaultBoardItemFrame(componentType: string, index: number): ComponentFrame {
  const baseX = 28 + ((index % 3) * 128);
  const baseY = 28 + (Math.floor(index / 3) * 98);

  switch (componentType) {
    case 'card':
      return {
        x: baseX,
        y: baseY,
        width: 168,
        height: 236,
        background: 'rgba(255,255,255,0.96)',
        borderColor: 'rgba(15,118,110,0.18)',
        borderWidth: 1,
        borderRadius: 20,
      };
    case 'image-area':
      // An image layer is just the image by default — no card fill or frame
      // behind it. A frame can be added back via the inspector appearance
      // controls if the creator wants one.
      return {
        x: baseX,
        y: baseY,
        width: 180,
        height: 132,
        background: 'transparent',
        borderColor: 'rgba(15,118,110,0)',
        borderWidth: 0,
        borderRadius: 0,
      };
    case 'network':
      return {
        x: baseX,
        y: baseY,
        width: 260,
        height: 180,
        background: 'rgba(239,246,255,0.94)',
        borderColor: 'rgba(59,130,246,0.18)',
        borderWidth: 1,
        borderRadius: 22,
      };
    case 'space':
      return {
        x: baseX,
        y: baseY,
        width: 132,
        height: 96,
        background: 'rgba(255,255,255,0.94)',
        borderColor: 'rgba(15,118,110,0.18)',
        borderWidth: 1,
        borderRadius: 18,
      };
    case 'track':
      return {
        x: baseX,
        y: baseY,
        width: 208,
        height: 92,
        background: 'rgba(236,254,255,0.92)',
        borderColor: 'rgba(14,165,233,0.18)',
        borderWidth: 1,
        borderRadius: 22,
      };
    case 'text-box':
      return {
        x: baseX,
        y: baseY,
        width: 260,
        height: 148,
        background: 'rgba(255,255,255,0.92)',
        borderColor: 'rgba(15,118,110,0.18)',
        borderWidth: 1,
        borderRadius: 18,
      };
    case 'hex-grid': {
      // Default hex grid is 4 rows × 5 columns.
      // Compute tight frame from hex geometry so the bounding box fits snugly.
      const hh = 2 / Math.sqrt(3);
      const hTotalW = 5 + 0.5; // columns + offset for odd rows
      const hTotalH = hh + 3 * (hh * 0.75);
      const hCellW = 56; // ~56 board-units per hex cell width
      return {
        x: baseX,
        y: baseY,
        width: Math.round(hTotalW * hCellW),
        height: Math.round(hTotalH * hCellW),
        background: 'rgba(239,246,255,0.94)',
        borderColor: 'rgba(59,130,246,0.18)',
        borderWidth: 1,
        borderRadius: 22,
      };
    }
    case 'square-grid':
    case 'checkerboard-grid':
      return {
        x: baseX,
        y: baseY,
        width: 320,
        height: 320,
        background: 'rgba(254,249,195,0.9)',
        borderColor: 'rgba(202,138,4,0.24)',
        borderWidth: 1,
        borderRadius: 18,
      };
    case 'zone':
      return {
        x: baseX,
        y: baseY,
        width: 174,
        height: 124,
        background: 'rgba(240,253,244,0.92)',
        borderColor: 'rgba(16,185,129,0.18)',
        borderWidth: 1,
        borderRadius: 20,
      };
    case 'score-track':
      return {
        x: baseX,
        y: baseY,
        width: 220,
        height: 84,
        background: 'rgba(254,242,242,0.94)',
        borderColor: 'rgba(248,113,113,0.22)',
        borderWidth: 1,
        borderRadius: 20,
      };
    default:
      return {
        x: baseX,
        y: baseY,
        width: 150,
        height: 104,
        background: 'rgba(255,255,255,0.94)',
        borderColor: 'rgba(15,118,110,0.16)',
        borderWidth: 1,
        borderRadius: 18,
      };
  }
}
export interface GridCellAppearance {
  background: string;
  textureId: BoardSurfaceTextureId | null;
  textureOpacity: number;
  borderColor: string | null;
  borderWidth?: number;
  borderRadius?: number;
}

export function getBoardGridCells(instance: ComponentInstanceModel): GridCellCoordinate[] {
  const fallbackRows = typeof instance.properties.rows === 'number' && Number.isFinite(instance.properties.rows)
    ? Math.max(1, Math.trunc(instance.properties.rows))
    : 1;
  const fallbackColumns = typeof instance.properties.columns === 'number' && Number.isFinite(instance.properties.columns)
    ? Math.max(1, Math.trunc(instance.properties.columns))
    : 1;

  return readGridCellCoordinates(instance.properties.cells, fallbackRows, fallbackColumns);
}

export function getGridCellAppearance(instance: ComponentInstanceModel): GridCellAppearance {
  return {
    background: typeof instance.properties.cellBackground === 'string' && instance.properties.cellBackground.trim().length > 0
      ? instance.properties.cellBackground
      : 'rgba(255,255,255,0.92)',
    textureId: typeof instance.properties.cellTextureId === 'string' && instance.properties.cellTextureId !== 'none'
      ? instance.properties.cellTextureId as BoardSurfaceTextureId
      : null,
    textureOpacity: typeof instance.properties.cellTextureOpacity === 'number'
      ? instance.properties.cellTextureOpacity
      : 0.3,
    borderColor: typeof instance.properties.cellBorderColor === 'string' && instance.properties.cellBorderColor.trim().length > 0
      ? instance.properties.cellBorderColor
      : null,
    borderWidth: typeof instance.properties.cellBorderWidth === 'number'
      ? instance.properties.cellBorderWidth
      : undefined,
    borderRadius: typeof instance.properties.cellBorderRadius === 'number'
      ? instance.properties.cellBorderRadius
      : undefined,
  };
}

export function clampBoardItemFrame(frame: ComponentFrame): ComponentFrame {
  const width = Math.max(MIN_BOARD_ITEM_WIDTH, Math.min(frame.width, BOARD_SURFACE_WIDTH));
  const height = Math.max(MIN_BOARD_ITEM_HEIGHT, Math.min(frame.height, BOARD_SURFACE_HEIGHT));

  return {
    ...frame,
    width,
    height,
    x: Math.max(0, Math.min(frame.x, BOARD_SURFACE_WIDTH - width)),
    y: Math.max(0, Math.min(frame.y, BOARD_SURFACE_HEIGHT - height)),
    borderWidth: Math.max(0, frame.borderWidth),
    borderRadius: Math.max(0, frame.borderRadius),
  };
}

export function clampItemFrame(frame: ComponentFrame, surfaceWidth: number, surfaceHeight: number): ComponentFrame {
  const minW = Math.min(MIN_BOARD_ITEM_WIDTH, surfaceWidth * 0.9);
  const minH = Math.min(MIN_BOARD_ITEM_HEIGHT, surfaceHeight * 0.9);
  const width = Math.max(minW, Math.min(frame.width, surfaceWidth));
  const height = Math.max(minH, Math.min(frame.height, surfaceHeight));
  return {
    ...frame,
    width,
    height,
    x: Math.max(0, Math.min(frame.x, surfaceWidth - width)),
    y: Math.max(0, Math.min(frame.y, surfaceHeight - height)),
    borderWidth: Math.max(0, frame.borderWidth),
    borderRadius: Math.max(0, frame.borderRadius),
  };
}

/**
 * Scale a default frame so it fits proportionally within a surface smaller than the board.
 * Returns the frame unchanged when the surface is board-sized or larger.
 */
export function scaleDefaultFrame(frame: ComponentFrame, surfaceWidth: number, surfaceHeight: number): ComponentFrame {
  if (surfaceWidth >= BOARD_SURFACE_WIDTH && surfaceHeight >= BOARD_SURFACE_HEIGHT) {
    return frame;
  }

  const scaleX = surfaceWidth / BOARD_SURFACE_WIDTH;
  const scaleY = surfaceHeight / BOARD_SURFACE_HEIGHT;
  const scale = Math.min(scaleX, scaleY);

  // Leave some padding (10%) so the item doesn't fill the entire parent
  const maxW = surfaceWidth * 0.8;
  const maxH = surfaceHeight * 0.8;
  const scaledWidth = Math.min(frame.width * scale, maxW);
  const scaledHeight = Math.min(frame.height * scale, maxH);

  // Center within the surface
  return {
    ...frame,
    x: Math.max(0, (surfaceWidth - scaledWidth) / 2),
    y: Math.max(0, (surfaceHeight - scaledHeight) / 2),
    width: Math.max(16, scaledWidth),
    height: Math.max(12, scaledHeight),
    borderRadius: frame.borderRadius >= Math.min(frame.width, frame.height) / 2
      ? 999
      : Math.max(0, Math.min(frame.borderRadius * scale, Math.min(scaledWidth, scaledHeight) / 2)),
  };
}

export function isLeafComponentType(componentType: string): boolean {
  return componentType === 'text-box'
    || componentType === 'image-area'
    || componentType === 'token'
    || componentType === 'counter'
    || componentType === 'score-track';
}

export function resizeBoardItemFrame(
  startFrame: ComponentFrame,
  dx: number,
  dy: number,
  edges: { left: boolean; right: boolean; top: boolean; bottom: boolean },
  surfaceWidth: number = BOARD_SURFACE_WIDTH,
  surfaceHeight: number = BOARD_SURFACE_HEIGHT,
): ComponentFrame {
  const minW = Math.min(MIN_BOARD_ITEM_WIDTH, surfaceWidth * 0.9);
  const minH = Math.min(MIN_BOARD_ITEM_HEIGHT, surfaceHeight * 0.9);
  let left = startFrame.x;
  let right = startFrame.x + startFrame.width;
  let top = startFrame.y;
  let bottom = startFrame.y + startFrame.height;

  if (edges.left) {
    left = Math.max(0, Math.min(startFrame.x + dx, right - minW));
  }

  if (edges.right) {
    right = Math.min(surfaceWidth, Math.max(startFrame.x + startFrame.width + dx, left + minW));
  }

  if (edges.top) {
    top = Math.max(0, Math.min(startFrame.y + dy, bottom - minH));
  }

  if (edges.bottom) {
    bottom = Math.min(surfaceHeight, Math.max(startFrame.y + startFrame.height + dy, top + minH));
  }

  return {
    ...startFrame,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    borderWidth: Math.max(0, startFrame.borderWidth),
    borderRadius: Math.max(0, startFrame.borderRadius),
  };
}

export function getResolvedBoardItemFrame(instance: ComponentInstanceModel, index: number): ComponentFrame {
  return clampBoardItemFrame(instance.frame ?? defaultBoardItemFrame(instance.componentType, index));
}

/**
 * Resolve a child item's frame clamped to the given parent surface dimensions
 * rather than the board-level defaults.  Used for items nested inside spaces,
 * cards, or other non-board containers.
 */
export function getResolvedChildItemFrame(
  instance: ComponentInstanceModel,
  index: number,
  parentSurfaceWidth: number,
  parentSurfaceHeight: number,
): ComponentFrame {
  const raw = instance.frame ?? scaleDefaultFrame(
    defaultBoardItemFrame(instance.componentType, index),
    parentSurfaceWidth,
    parentSurfaceHeight,
  );
  return clampItemFrame(raw, parentSurfaceWidth, parentSurfaceHeight);
}
