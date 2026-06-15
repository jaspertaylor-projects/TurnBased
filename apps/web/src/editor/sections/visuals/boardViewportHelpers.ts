import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ComponentInstanceModel } from '@turnbased/engine-components';
import { FIT_PADDING, TOOLBAR_H, SCROLLBAR_THICKNESS, SCROLLBAR_INSET } from '@turnbased/engine-ui';

import {
  BOARD_SURFACE_HEIGHT,
  BOARD_SURFACE_WIDTH,
  isBoardGridComponentType,
  isLeafComponentType,
  isMovableComponentType,
} from '../../boardLayout';

// Safe-area insets, kept identical to KonvaBoardSurface so pointer-mapping and
// centering match the actual render exactly.
const SAFE_RIGHT_INSET = SCROLLBAR_THICKNESS + SCROLLBAR_INSET * 2;
const SAFE_BOTTOM_INSET = TOOLBAR_H + SCROLLBAR_THICKNESS + SCROLLBAR_INSET * 2;
import type { CanonicalGeometry } from '../../boardLayout';
import { getResizeEdgesForBox } from './boardEditorUtils';

// ── Viewport metric types ────────────────────────────────────────────

export interface ViewportMetrics {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface EffectiveScale {
  scale: number;
  originX: number;
  originY: number;
}

// ── Pure pointer helpers ─────────────────────────────────────────────

/**
 * Extract client-pixel coordinates from either a React mouse event or a
 * Konva-style event with an `evt` property.
 */
export function getPointerClientPosition(
  event: { clientX?: number; clientY?: number; evt?: MouseEvent },
): { x: number; y: number } | null {
  const nativeEvent = event.evt ?? event;
  if (typeof nativeEvent.clientX !== 'number' || typeof nativeEvent.clientY !== 'number') {
    return null;
  }

  return {
    x: nativeEvent.clientX,
    y: nativeEvent.clientY,
  };
}

/**
 * Get resize-edge detection based on the pointer position within a rendered
 * item. Falls back to null if the event target doesn't expose
 * getRelativePointerPosition (i.e. non-Konva DOM events).
 */
export function getPointerPositionWithinRenderedItem(
  event: ReactMouseEvent<HTMLDivElement>,
  frame: { width: number; height: number },
) {
  const currentTarget = (
    event as unknown as {
      currentTarget?: {
        getRelativePointerPosition?: () => { x: number; y: number } | null;
      };
    }
  ).currentTarget;

  const relativePointer = currentTarget?.getRelativePointerPosition?.();
  if (!relativePointer) {
    return null;
  }

  return getResizeEdgesForBox(
    relativePointer.x,
    relativePointer.y,
    frame.width,
    frame.height,
  );
}

/**
 * Cancel and stop propagation of a pointer event — works for both React
 * and Konva event wrappers.
 */
export function preventPointerEvent(event: {
  evt?: MouseEvent;
  preventDefault?: () => void;
  stopPropagation?: () => void;
  cancelBubble?: boolean;
}) {
  event.preventDefault?.();
  event.stopPropagation?.();
  event.evt?.preventDefault();
  event.evt?.stopPropagation();
  if ('cancelBubble' in event) {
    event.cancelBubble = true;
  }
}

// ── Scale / viewport geometry ────────────────────────────────────────

/**
 * Compute the effective scale the KonvaBoardSurface uses internally so
 * we can map board-mm frames to screen-pixel rects for pointer handling.
 *
 * Matches KonvaBoardSurface's coordinate system: panX/panY are the
 * absolute origin of the board group, 0,0 means auto-centered with
 * FIT_PADDING.
 */
export function getEffectiveScale(
  viewportMetrics: ViewportMetrics | null,
  boardRenderWidth: number,
  boardRenderHeight: number,
  zoom: number,
  panX: number,
  panY: number,
): EffectiveScale | null {
  if (!viewportMetrics || boardRenderWidth <= 0 || boardRenderHeight <= 0) return null;
  // Must match KonvaBoardSurface's safe-area math: it reserves space for
  // the bottom toolbar + horizontal scrollbar and the right vertical
  // scrollbar, then fits the board inside safeW x safeH at FIT_PADDING.
  const safeW = Math.max(1, viewportMetrics.width - SAFE_RIGHT_INSET);
  const safeH = Math.max(1, viewportMetrics.height - SAFE_BOTTOM_INSET);
  const bs = Math.min((safeW * FIT_PADDING) / boardRenderWidth, (safeH * FIT_PADDING) / boardRenderHeight);
  const eff = bs * zoom;
  return { scale: eff, originX: viewportMetrics.left + panX, originY: viewportMetrics.top + panY };
}

/**
 * Convert a board-space frame (x/y/width/height in mm) to a screen-space
 * rect (left/top/width/height in px).
 */
export function getViewportRectForSurfaceFrame(
  frame: { x: number; y: number; width: number; height: number },
  eff: EffectiveScale | null,
) {
  if (!eff) return null;
  return {
    left: eff.originX + frame.x * eff.scale,
    top: eff.originY + frame.y * eff.scale,
    width: frame.width * eff.scale,
    height: frame.height * eff.scale,
  };
}

/**
 * Get the screen-space viewport rect for a specific board descendant
 * (or the full board if instanceId is null or equals activeBoardId).
 */
export function getSurfaceViewportRect(
  instanceId: string | null,
  activeBoardId: string | null,
  viewportMetrics: ViewportMetrics | null,
  boardRenderWidth: number,
  boardRenderHeight: number,
  activeSurfaceFrames: Record<string, { x: number; y: number; width: number; height: number }>,
  eff: EffectiveScale | null,
) {
  if (!viewportMetrics) return null;

  if (!instanceId || instanceId === activeBoardId) {
    // The full board rect in screen space
    return getViewportRectForSurfaceFrame(
      { x: 0, y: 0, width: boardRenderWidth, height: boardRenderHeight },
      eff,
    );
  }

  const surfaceFrame = activeSurfaceFrames[instanceId] ?? null;
  return surfaceFrame ? getViewportRectForSurfaceFrame(surfaceFrame, eff) : null;
}

/**
 * Get the local dimensions (board units) of a surface — board root uses
 * the configured board dimensions, descendants use their canonical geometry.
 */
export function getSurfaceDimensions(
  instanceId: string | null,
  activeBoardId: string | null,
  canonicalGeometries: Record<string, CanonicalGeometry>,
  instances: Record<string, ComponentInstanceModel>,
) {
  if (!instanceId || instanceId === activeBoardId) {
    return {
      width: BOARD_SURFACE_WIDTH,
      height: BOARD_SURFACE_HEIGHT,
    };
  }

  const geometry = canonicalGeometries[instanceId];
  if (geometry) {
    return {
      width: geometry.localWidth,
      height: geometry.localHeight,
    };
  }

  const instance = instances[instanceId];
  return {
    width: instance?.frame?.width ?? BOARD_SURFACE_WIDTH,
    height: instance?.frame?.height ?? BOARD_SURFACE_HEIGHT,
  };
}

/**
 * Compute the activeSurfaceFrames mapping — for every non-movable descendant
 * of the surface, produces board-level rendered coordinates from canonical
 * geometry.
 */
export function computeActiveSurfaceFrames(
  currentSurface: ComponentInstanceModel | null,
  canonicalGeometries: Record<string, CanonicalGeometry>,
  instances: Record<string, ComponentInstanceModel>,
): Record<string, { x: number; y: number; width: number; height: number }> {
  if (!currentSurface) {
    return {};
  }

  const frames: Record<string, { x: number; y: number; width: number; height: number }> = {};

  const walk = (childIds: string[]) => {
    for (const childId of childIds) {
      const child = instances[childId];
      const geometry = canonicalGeometries[childId];
      if (!child || !geometry || isMovableComponentType(child.componentType)) {
        continue;
      }

      frames[childId] = {
        x: geometry.renderedX,
        y: geometry.renderedY,
        width: geometry.renderedWidth,
        height: geometry.renderedHeight,
      };

      if (!isLeafComponentType(child.componentType) && !isBoardGridComponentType(child.componentType)) {
        walk(child.children.map(String));
      }
    }
  };

  walk(currentSurface.children.map(String));

  return frames;
}

/**
 * Compute the centered pan origin for a reset-zoom (zoom=1) operation,
 * matching KonvaBoardSurface's toolbar + scrollbar safe-area insets.
 */
export function computeCenteredPan(
  viewportMetrics: ViewportMetrics,
  boardRenderWidth: number,
  boardRenderHeight: number,
): { panX: number; panY: number } {
  const safeW = Math.max(1, viewportMetrics.width - SAFE_RIGHT_INSET);
  const safeH = Math.max(1, viewportMetrics.height - SAFE_BOTTOM_INSET);
  const bs = Math.min((safeW * FIT_PADDING) / boardRenderWidth, (safeH * FIT_PADDING) / boardRenderHeight);
  return {
    panX: (safeW - boardRenderWidth * bs) / 2,
    // Center within the full viewport height (not just safe area) so the
    // board doesn't appear biased toward the top.
    panY: (viewportMetrics.height - boardRenderHeight * bs) / 2,
  };
}
