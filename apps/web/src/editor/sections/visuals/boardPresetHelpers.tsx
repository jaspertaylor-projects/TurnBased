import type React from 'react';
import {
  getBuiltInComponentManifest,
} from '@turnbased/engine-components';
import type {
  BoardComponentPreset,
  ComponentInstanceModel,
} from '@turnbased/engine-components';

import {
  BOARD_SURFACE_HEIGHT,
  BOARD_SURFACE_WIDTH,
  clampItemFrame,
  defaultBoardItemFrame,
  getResolvedBoardItemFrame,
  scaleDefaultFrame,
} from '../../boardLayout';

// ── applyPresetToInstance ────────────────────────────────────────────

/**
 * Apply a board component preset to an existing instance, returning a new
 * instance model with the preset's type, properties and frame merged.
 *
 * When the instance already has the same componentType as the preset, only
 * shape/visual properties are swapped (borderRadius, clipPath, background,
 * etc.) and the user's current position/size is preserved.
 */
export function applyPresetToInstance(
  instance: ComponentInstanceModel,
  preset: BoardComponentPreset,
  childIndex: number,
  options: {
    x?: number;
    y?: number;
    preservePosition?: boolean;
    targetSurfaceWidth?: number;
    targetSurfaceHeight?: number;
  } = {},
): ComponentInstanceModel {
  const sw = options.targetSurfaceWidth ?? BOARD_SURFACE_WIDTH;
  const sh = options.targetSurfaceHeight ?? BOARD_SURFACE_HEIGHT;
  const baseFrame = getResolvedBoardItemFrame(instance, childIndex);
  const nextManifest = getBuiltInComponentManifest(preset.componentType);

  // When switching presets on an existing component of the same type,
  // treat the change as a *shape* swap: keep the user's current position
  // and size, and only adopt the preset's visual properties.
  const isSameType = instance.componentType === preset.componentType;
  if (isSameType && instance.frame) {
    const shapeFrame: ComponentInstanceModel['frame'] = {
      ...instance.frame,
      borderRadius: preset.frame.borderRadius ?? instance.frame.borderRadius,
      clipPath: preset.frame.clipPath ?? null,
      background: preset.frame.background ?? instance.frame.background,
      borderColor: preset.frame.borderColor ?? instance.frame.borderColor,
      borderWidth: preset.frame.borderWidth ?? instance.frame.borderWidth,
    };

    return {
      ...instance,
      properties: {
        ...instance.properties,
        ...preset.properties,
      },
      frame: shapeFrame,
    };
  }

  // Scale the default frame to fit proportionally within smaller-than-board surfaces.
  const rawDefault = defaultBoardItemFrame(preset.componentType, childIndex);
  const scaledDefault = scaleDefaultFrame(rawDefault, sw, sh);
  const presetFrame = clampItemFrame({
    ...scaledDefault,
    ...preset.frame,
    ...(preset.frame.width != null || preset.frame.height != null
      ? scaleDefaultFrame({ ...rawDefault, ...preset.frame } as typeof rawDefault, sw, sh)
      : {}),
    x: options.preservePosition === false
      ? (typeof options.x === 'number' ? options.x : scaledDefault.x)
      : (typeof options.x === 'number' ? options.x : baseFrame.x),
    y: options.preservePosition === false
      ? (typeof options.y === 'number' ? options.y : scaledDefault.y)
      : (typeof options.y === 'number' ? options.y : baseFrame.y),
  }, sw, sh);

  return {
    ...instance,
    componentType: preset.componentType,
    category: nextManifest.category,
    displayName: String(preset.properties.label ?? preset.label),
    properties: {
      ...instance.properties,
      ...preset.properties,
    },
    frame: presetFrame,
  };
}

// ── getComponentDesignBounds ─────────────────────────────────────────

/**
 * Compute proportional bounds for the design area when a non-board
 * component is selected. Returns the w/h ratio and border radius.
 */
export function getComponentDesignBounds(componentType: string): { width: number; height: number; borderRadius: string } {
  switch (componentType) {
    case 'card':
      return { width: 286, height: 400, borderRadius: '18px' };
    case 'piece':
      return { width: 300, height: 300, borderRadius: '999px' };
    case 'token':
      return { width: 220, height: 220, borderRadius: '999px' };
    default:
      return { width: 380, height: 280, borderRadius: '18px' };
  }
}

// ── renderPieceShape ─────────────────────────────────────────────────

/**
 * Renders the piece shape as an SVG so all shapes (including triangle,
 * hexagon, meeple) get consistent border handling. Size is in px; the
 * viewBox is always 100x100.
 */
export function renderPieceShape(
  shape: string,
  bgColor: string,
  strokeColor: string,
  strokeWidth: number,
  sizePx: number,
  innerContent?: React.ReactNode,
) {
  const sw = Math.max(0, strokeWidth) * (100 / sizePx);
  const half = sw / 2;

  let pathEl: React.ReactNode;
  switch (shape) {
    case 'square':
      pathEl = (
        <rect
          x={half} y={half}
          width={100 - sw} height={100 - sw}
          rx={6} ry={6}
          fill={bgColor} stroke={strokeColor} strokeWidth={sw}
        />
      );
      break;
    case 'triangle':
      pathEl = (
        <polygon
          points={`50,${half + 2} ${100 - half},${100 - half} ${half},${100 - half}`}
          fill={bgColor} stroke={strokeColor} strokeWidth={sw}
        />
      );
      break;
    case 'hexagon': {
      const r = 50 - half - 1;
      const cx = 50;
      const cy = 50;
      const pts = [0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (Math.PI / 180) * (60 * i - 30);
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
      }).join(' ');
      pathEl = (
        <polygon
          points={pts}
          fill={bgColor} stroke={strokeColor} strokeWidth={sw}
        />
      );
      break;
    }
    case 'meeple':
      pathEl = (
        <path
          d="M50 4 C59 4 65 13 61 22 L73 27 C82 29 82 46 73 49 L64 49 L67 96 L33 96 L36 49 L27 49 C18 46 18 29 27 27 L39 22 C35 13 41 4 50 4 Z"
          fill={bgColor} stroke={strokeColor} strokeWidth={sw}
        />
      );
      break;
    default: // circle
      pathEl = (
        <circle
          cx={50} cy={50} r={50 - half - 1}
          fill={bgColor} stroke={strokeColor} strokeWidth={sw}
        />
      );
  }

  return (
    <div style={{ position: 'relative', width: sizePx, height: sizePx, flexShrink: 0 }}>
      <svg
        width={sizePx}
        height={sizePx}
        viewBox="0 0 100 100"
        style={{ display: 'block' }}
      >
        {pathEl}
      </svg>
      {innerContent ? (
        /* pieceShapeInnerOverlay — absolutely positioned overlay for piece inner content */
        <div data-layout="pieceShapeInnerOverlay" style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          overflow: 'hidden',
        }}>
          {innerContent}
        </div>
      ) : null}
    </div>
  );
}
