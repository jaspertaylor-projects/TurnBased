import type {
  BoardAppearanceProperties,
  BoardBorderStyle,
  BoardSurfaceTextureId,
} from './types';

export const BOARD_BORDER_STYLE_OPTIONS: readonly BoardBorderStyle[] = ['solid', 'dashed', 'dotted', 'double'] as const;
export const BOARD_SURFACE_TEXTURE_OPTIONS: ReadonlyArray<{
  id: BoardSurfaceTextureId;
  label: string;
  description: string;
}> = [
  {
    id: 'none',
    label: 'Flat',
    description: 'A clean flat color with no extra texture.',
  },
  {
    id: 'felt',
    label: 'Felt',
    description: 'A tabletop casino felt surface.',
  },
  {
    id: 'water',
    label: 'Water',
    description: 'A stylized blue ocean water texture.',
  },
  {
    id: 'grass',
    label: 'Grass',
    description: 'A rich green grass lawn surface.',
  },
  {
    id: 'wood',
    label: 'Wood',
    description: 'A rich, polished wood panel texture.',
  },
  {
    id: 'marble',
    label: 'Marble',
    description: 'An elegant white marble texture with fine veins.',
  },
  {
    id: 'leather',
    label: 'Leather',
    description: 'A dark genuine leather texture for classic games.',
  },
  {
    id: 'stone',
    label: 'Stone',
    description: 'A rough grey slate stone surface.',
  },
  {
    id: 'sand',
    label: 'Sand',
    description: 'A golden desert sand texture.',
  },
  {
    id: 'metal',
    label: 'Metal',
    description: 'A clean brushed steel scifi texture.',
  },
] as const;

const DEFAULT_BOARD_APPEARANCE: BoardAppearanceProperties = {
  surfaceColor: 'rgba(248,250,252,0.98)',
  surfaceTexture: 'none',
  surfaceTextureOpacity: 0.3,
  surfaceBorderColor: 'rgba(15,118,110,0.18)',
  surfaceBorderWidth: 1,
  surfaceBorderStyle: 'solid',
};

function isBoardBorderStyle(value: unknown): value is BoardBorderStyle {
  return typeof value === 'string' && BOARD_BORDER_STYLE_OPTIONS.includes(value as BoardBorderStyle);
}

function isBoardSurfaceTextureId(value: unknown): value is BoardSurfaceTextureId {
  return typeof value === 'string' && BOARD_SURFACE_TEXTURE_OPTIONS.some((option) => option.id === value);
}

export function createDefaultBoardAppearanceProperties(): BoardAppearanceProperties {
  return {
    ...DEFAULT_BOARD_APPEARANCE,
  };
}

export function resolveBoardAppearanceProperties(properties: Record<string, unknown> | null | undefined): BoardAppearanceProperties {
  const source = properties ?? {};

  return {
    surfaceColor: typeof source.surfaceColor === 'string' && source.surfaceColor.trim().length > 0
      ? source.surfaceColor
      : DEFAULT_BOARD_APPEARANCE.surfaceColor,
    surfaceTexture: isBoardSurfaceTextureId(source.surfaceTexture)
      ? source.surfaceTexture
      : DEFAULT_BOARD_APPEARANCE.surfaceTexture,
    surfaceTextureOpacity: typeof source.surfaceTextureOpacity === 'number' && Number.isFinite(source.surfaceTextureOpacity)
      ? Math.max(0, Math.min(1, source.surfaceTextureOpacity))
      : DEFAULT_BOARD_APPEARANCE.surfaceTextureOpacity,
    surfaceBorderColor: typeof source.surfaceBorderColor === 'string' && source.surfaceBorderColor.trim().length > 0
      ? source.surfaceBorderColor
      : DEFAULT_BOARD_APPEARANCE.surfaceBorderColor,
    surfaceBorderWidth: typeof source.surfaceBorderWidth === 'number' && Number.isFinite(source.surfaceBorderWidth)
      ? Math.max(0, source.surfaceBorderWidth)
      : DEFAULT_BOARD_APPEARANCE.surfaceBorderWidth,
    surfaceBorderStyle: isBoardBorderStyle(source.surfaceBorderStyle)
      ? source.surfaceBorderStyle
      : DEFAULT_BOARD_APPEARANCE.surfaceBorderStyle,
  };
}
