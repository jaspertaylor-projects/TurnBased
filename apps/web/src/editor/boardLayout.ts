import {
  readGridCellCoordinates,
  type ComponentFrame,
  type ComponentInstanceModel,
  type GridCellCoordinate,
} from '@turnbased/engine-components';

export const BOARD_SURFACE_WIDTH = 760;
export const BOARD_SURFACE_HEIGHT = 520;
export const BOARD_SURFACE_BACKGROUND = 'linear-gradient(160deg, rgba(16,185,129,0.16), rgba(14,165,233,0.08), rgba(250,204,21,0.12))';
export const MIN_BOARD_ITEM_WIDTH = 56;
export const MIN_BOARD_ITEM_HEIGHT = 48;

export function isMovableComponentType(componentType: string): boolean {
  return componentType === 'piece' || componentType === 'token';
}

export function isBoardGridComponentType(componentType: string): componentType is 'hex-grid' | 'square-grid' | 'checkerboard-grid' {
  return componentType === 'hex-grid' || componentType === 'square-grid' || componentType === 'checkerboard-grid';
}

export function isBoardAuthorableComponentType(componentType: string): boolean {
  return componentType === 'space'
    || componentType === 'track'
    || componentType === 'hex-grid'
    || componentType === 'square-grid';
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

export function defaultBoardItemFrame(componentType: string, index: number): ComponentFrame {
  const baseX = 28 + ((index % 3) * 128);
  const baseY = 28 + (Math.floor(index / 3) * 98);

  switch (componentType) {
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
    case 'hex-grid':
      return {
        x: baseX,
        y: baseY,
        width: 300,
        height: 236,
        background: 'rgba(239,246,255,0.94)',
        borderColor: 'rgba(59,130,246,0.18)',
        borderWidth: 1,
        borderRadius: 22,
      };
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
    case 'resource-pile':
      return {
        x: baseX,
        y: baseY,
        width: 190,
        height: 132,
        background: 'rgba(236,253,245,0.94)',
        borderColor: 'rgba(34,197,94,0.2)',
        borderWidth: 1,
        borderRadius: 22,
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

export function resizeBoardItemFrame(
  startFrame: ComponentFrame,
  dx: number,
  dy: number,
  edges: { left: boolean; right: boolean; top: boolean; bottom: boolean },
): ComponentFrame {
  let left = startFrame.x;
  let right = startFrame.x + startFrame.width;
  let top = startFrame.y;
  let bottom = startFrame.y + startFrame.height;

  if (edges.left) {
    left = Math.max(0, Math.min(startFrame.x + dx, right - MIN_BOARD_ITEM_WIDTH));
  }

  if (edges.right) {
    right = Math.min(BOARD_SURFACE_WIDTH, Math.max(startFrame.x + startFrame.width + dx, left + MIN_BOARD_ITEM_WIDTH));
  }

  if (edges.top) {
    top = Math.max(0, Math.min(startFrame.y + dy, bottom - MIN_BOARD_ITEM_HEIGHT));
  }

  if (edges.bottom) {
    bottom = Math.min(BOARD_SURFACE_HEIGHT, Math.max(startFrame.y + startFrame.height + dy, top + MIN_BOARD_ITEM_HEIGHT));
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
