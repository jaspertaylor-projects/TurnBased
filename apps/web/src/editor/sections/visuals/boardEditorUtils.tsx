import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  getBuiltInComponentManifest,
} from '@turnbased/engine-components';
import type {
  BoardComponentPresetFamily,
  BuiltInComponentType,
} from '@turnbased/engine-components';

import { inputStyle } from '../../styles';
import type { EditorProject } from '../../types';

export function getComponentLabel(project: EditorProject, instanceId: string): string {
  const instance = project.instances[instanceId];
  if (!instance) {
    return 'Unknown Component';
  }

  const manifest = getBuiltInComponentManifest(instance.componentType as BuiltInComponentType);
  return String(instance.properties.label ?? instance.displayName ?? manifest.displayName);
}

export function renderImageAreaContent(properties: Record<string, unknown>) {
  const imageUrl = typeof properties.imageUrl === 'string' ? properties.imageUrl.trim() : '';
  const opacity = typeof properties.opacity === 'number' ? properties.opacity : 1;
  const objectFit = properties.objectFit === 'cover' || properties.objectFit === 'fill' ? properties.objectFit : 'contain';

  if (!imageUrl) {
    return <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Set an image URL in the properties panel.</div>;
  }

  return (
    <img
      src={imageUrl}
      alt=""
      draggable={false}
      style={{
        width: '100%',
        height: '100%',
        objectFit,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
}

export type BoardInteractionState =
  | null
  | {
    kind: 'move' | 'resize';
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
  };

export function getResizeEdgesForPointer(event: ReactMouseEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const inset = 12;
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;

  return {
    left: localX <= inset,
    right: localX >= rect.width - inset,
    top: localY <= inset,
    bottom: localY >= rect.height - inset,
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

  if (componentType === 'network') {
    return 'network';
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

export const BOARD_PRESET_FAMILY_ORDER: BoardComponentPresetFamily[] = ['space', 'track', 'grid', 'card', 'network', 'text', 'image'];

export const BOARD_PRESET_ICON_KEYS: Record<BoardComponentPresetFamily, string> = {
  space: 'space',
  track: 'track',
  grid: 'grid',
  card: 'card',
  network: 'network',
  text: 'text-box',
  image: 'image-area',
};

export const boardBorderWidthOptions = [0, 1, 2, 4, 6, 8];
