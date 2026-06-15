import {
  getBuiltInComponentManifest,
  getGridCoordinateKey,
} from '@turnbased/engine-components';
import type {
  BoardComponentPresetFamily,
  BuiltInComponentType,
  ComponentInstanceModel,
  GridCellCoordinate,
} from '@turnbased/engine-components';

import { inputStyle } from '../../styles';
import {
  buildImageFilterCss,
  buildImageTintStyle,
  resolveImageAreaProperties,
} from '../../components/imageAreaStyle';
import type { EditorProject } from '../../types';

type GridComponentType = 'hex-grid' | 'square-grid' | 'checkerboard-grid';

export function getComponentLabel(project: EditorProject, instanceId: string): string {
  const instance = project.instances[instanceId];
  if (!instance) {
    return 'Unknown Component';
  }

  const manifest = getBuiltInComponentManifest(instance.componentType as BuiltInComponentType);
  return String(instance.properties.label ?? instance.displayName ?? manifest.displayName);
}

function getResolvedGridCellPrefix(kind: GridComponentType, prefix?: string): string {
  const trimmedPrefix = prefix?.trim();
  if (trimmedPrefix) {
    if (kind === 'hex-grid' && trimmedPrefix.toLowerCase() === 'hex') {
      return 'Hex Cell';
    }
    return trimmedPrefix;
  }

  return kind === 'hex-grid' ? 'Hex Cell' : 'Cell';
}

export function getGridCellDisplayLabel(
  kind: GridComponentType,
  coordinate: GridCellCoordinate,
  prefix?: string,
): string {
  const resolvedPrefix = getResolvedGridCellPrefix(kind, prefix);
  return `${resolvedPrefix} ${coordinate.x},${coordinate.y}`;
}

export function getGridCellSelectionLabel(
  project: EditorProject,
  gridInstance: ComponentInstanceModel,
  coordinate: GridCellCoordinate,
): string {
  const resolvedDefaultLabel = getGridCellDisplayLabel(
    gridInstance.componentType as GridComponentType,
    coordinate,
    typeof gridInstance.properties.cellLabelPrefix === 'string'
      ? gridInstance.properties.cellLabelPrefix
      : undefined,
  );
  const coordinateKey = getGridCoordinateKey(coordinate);
  const matchingChild = gridInstance.children
    .map(String)
    .map((childId) => project.instances[childId])
    .find((child) => {
      if (!child || child.componentType !== 'space') {
        return false;
      }

      return getGridCoordinateKey({
        x: typeof child.placement?.coordinates?.x === 'number' ? Math.trunc(child.placement.coordinates.x) : 0,
        y: typeof child.placement?.coordinates?.y === 'number' ? Math.trunc(child.placement.coordinates.y) : 0,
      }) === coordinateKey;
    });

  if (!matchingChild) {
    return resolvedDefaultLabel;
  }

  const storedLabel = String(matchingChild.properties.label ?? matchingChild.displayName ?? '').trim();
  if (!storedLabel) {
    return resolvedDefaultLabel;
  }

  const legacyGeneratedLabel = `${typeof gridInstance.properties.cellLabelPrefix === 'string' && gridInstance.properties.cellLabelPrefix.trim().length > 0
    ? gridInstance.properties.cellLabelPrefix.trim()
    : gridInstance.componentType === 'hex-grid'
      ? 'Hex'
      : 'Cell'} ${coordinate.x},${coordinate.y}`;

  return storedLabel === legacyGeneratedLabel ? resolvedDefaultLabel : storedLabel;
}

export function renderImageAreaContent(properties: Record<string, unknown>) {
  const resolved = resolveImageAreaProperties(properties);

  if (!resolved.imageUrl) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '0.82rem',
          lineHeight: 1.4,
          padding: '0.4rem',
        }}
      >
        Add an image from the Image panel →
      </div>
    );
  }

  const tint = buildImageTintStyle(resolved);

  return (
    // imageAreaContent — fills the item frame; rounds + clips the image and
    // overlays an optional tint wash. Positioned relative so the tint layer
    // can absolutely cover the same rounded box.
    <div
      data-layout="imageAreaContent"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: resolved.cornerRadius || undefined,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <img
        src={resolved.imageUrl}
        alt=""
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: resolved.objectFit,
          objectPosition: `${resolved.focalX * 100}% ${resolved.focalY * 100}%`,
          opacity: resolved.opacity,
          filter: buildImageFilterCss(resolved) || undefined,
        }}
      />
      {tint ? (
        // imageAreaTint — colour wash blended over the image for cohesion.
        <div
          data-layout="imageAreaTint"
          style={{ position: 'absolute', inset: 0, ...tint }}
        />
      ) : null}
    </div>
  );
}

export type BoardInteractionState =
  | null
  | {
    kind: 'move' | 'resize' | 'rotate';
    instanceId: string;
    pointerX: number;
    pointerY: number;
    boardUnitsPerPixelX: number;
    boardUnitsPerPixelY: number;
    surfaceWidth: number;
    surfaceHeight: number;
    startFrame: import('@turnbased/engine-components').ComponentFrame;
    resizeEdges?: {
      left: boolean;
      right: boolean;
      top: boolean;
      bottom: boolean;
    };
    /** Sibling items in the same parent, used for PowerPoint-style
     *  alignment snapping while dragging. Coordinates are in the parent's
     *  local board-unit space. */
    siblings?: readonly {
      x: number;
      y: number;
      width: number;
      height: number;
    }[];
    /** Parent instance id — used to place alignment guide overlays in
     *  screen space during a drag. */
    parentId?: string | null;
    /** Centre of the item in screen pixels — used for angle calculation
     *  during rotate interactions. */
    rotateCenterScreenX?: number;
    rotateCenterScreenY?: number;
    /** The angle (degrees) at the moment the rotate drag started. */
    startAngleDeg?: number;
    /** The item's rotation (degrees) when the rotate drag started. */
    startRotation?: number;
  };

/** An active alignment guide to visualize while dragging. Coordinates are
 *  parent-local board units; the renderer converts to screen px. */
export type AlignmentGuide =
  | { axis: 'x'; at: number; from: number; to: number }
  | { axis: 'y'; at: number; from: number; to: number };

export function getResizeEdgesForRect(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
) {
  return getResizeEdgesForBox(
    clientX - rect.left,
    clientY - rect.top,
    rect.width,
    rect.height,
  );
}

export function getResizeEdgesForBox(
  localX: number,
  localY: number,
  width: number,
  height: number,
) {
  const inset = Math.max(8, Math.min(16, Math.min(width, height) * 0.16));

  return {
    left: localX <= inset,
    right: localX >= width - inset,
    top: localY <= inset,
    bottom: localY >= height - inset,
  };
}

export function hasResizeEdge(edges: { left: boolean; right: boolean; top: boolean; bottom: boolean }) {
  return edges.left || edges.right || edges.top || edges.bottom;
}

export function getResizeCursor(edges: { left: boolean; right: boolean; top: boolean; bottom: boolean }) {
  if ((edges.left && edges.top) || (edges.right && edges.bottom)) {
    return 'nwse-resize';
  }

  if ((edges.right && edges.top) || (edges.left && edges.bottom)) {
    return 'nesw-resize';
  }

  if (edges.left || edges.right) {
    return 'ew-resize';
  }

  if (edges.top || edges.bottom) {
    return 'ns-resize';
  }

  return 'move';
}

export function getPresetFamily(componentType: BuiltInComponentType): BoardComponentPresetFamily | null {
  if (componentType === 'text-box') {
    return 'text';
  }

  if (componentType === 'image-area') {
    return 'image';
  }

  if (componentType === 'card') {
    return 'card';
  }

  if (componentType === 'hex-grid' || componentType === 'square-grid' || componentType === 'checkerboard-grid') {
    return 'grid';
  }

  if (componentType === 'space' || componentType === 'track') {
    return componentType;
  }

  return null;
}

export const compactInputStyle = {
  ...inputStyle,
  padding: '0.58rem 0.68rem',
  fontSize: '0.86rem',
};

export const BOARD_PRESET_FAMILY_ORDER: BoardComponentPresetFamily[] = ['space', 'track', 'grid', 'card', 'text', 'image'];

export const BOARD_PRESET_ICON_KEYS: Record<BoardComponentPresetFamily, string> = {
  network: 'network',
  space: 'space',
  track: 'track',
  grid: 'grid',
  card: 'card',
  text: 'text-box',
  image: 'image-area',
};

export const boardBorderWidthOptions = [0, 1, 2, 4, 6, 8];
