// Shared resolver + CSS builders for the `image-area` component so the board
// canvas render and the ImageInspector live preview always look identical.
// Keeping this in one place means a styling change (focal point, filters,
// shadow, tint) only has to be made once.

export type ImageObjectFit = 'cover' | 'contain' | 'fill';
export type ImageShadowPreset = 'none' | 'soft' | 'medium' | 'strong';

export interface ResolvedImageAreaProperties {
  imageUrl: string;
  opacity: number;
  objectFit: ImageObjectFit;
  focalX: number;
  focalY: number;
  cornerRadius: number;
  shadow: ImageShadowPreset;
  grayscale: number;
  sepia: number;
  brightness: number;
  tintColor: string;
  tintStrength: number;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

/** Coerce raw, possibly-partial component properties into a fully-resolved,
 *  bounds-checked image styling object. */
export function resolveImageAreaProperties(properties: Record<string, unknown>): ResolvedImageAreaProperties {
  const fit = properties.objectFit;
  const shadow = properties.shadow;
  return {
    imageUrl: typeof properties.imageUrl === 'string' ? properties.imageUrl.trim() : '',
    opacity: clamp(properties.opacity, 0, 1, 1),
    objectFit: fit === 'cover' || fit === 'fill' ? fit : 'contain',
    focalX: clamp(properties.focalX, 0, 1, 0.5),
    focalY: clamp(properties.focalY, 0, 1, 0.5),
    cornerRadius: clamp(properties.cornerRadius, 0, 9999, 0),
    shadow: shadow === 'soft' || shadow === 'medium' || shadow === 'strong' ? shadow : 'none',
    grayscale: clamp(properties.grayscale, 0, 1, 0),
    sepia: clamp(properties.sepia, 0, 1, 0),
    brightness: clamp(properties.brightness, 0.2, 2, 1),
    tintColor: typeof properties.tintColor === 'string' ? properties.tintColor : '',
    tintStrength: clamp(properties.tintStrength, 0, 1, 0),
  };
}

/** Drop-shadow CSS fragment for a shadow preset. Sizes are expressed in the
 *  board-unit (mm) coordinate space the canvas renders in. */
export function getImageShadowFilter(shadow: ImageShadowPreset): string {
  switch (shadow) {
    case 'soft':
      return 'drop-shadow(0 1px 3px rgba(0,0,0,0.28))';
    case 'medium':
      return 'drop-shadow(0 3px 7px rgba(0,0,0,0.36))';
    case 'strong':
      return 'drop-shadow(0 6px 14px rgba(0,0,0,0.46))';
    default:
      return '';
  }
}

/** Full CSS `filter` string combining colour adjustments + the shadow preset. */
export function buildImageFilterCss(resolved: ResolvedImageAreaProperties): string {
  const parts: string[] = [];
  if (resolved.grayscale > 0) parts.push(`grayscale(${resolved.grayscale})`);
  if (resolved.sepia > 0) parts.push(`sepia(${resolved.sepia})`);
  if (resolved.brightness !== 1) parts.push(`brightness(${resolved.brightness})`);
  const shadow = getImageShadowFilter(resolved.shadow);
  if (shadow) parts.push(shadow);
  return parts.join(' ');
}

/** Returns the tint overlay style, or null when no tint is configured. The
 *  overlay is a sibling above the image so it can use a blend mode without
 *  affecting the image's own filters. */
export function buildImageTintStyle(resolved: ResolvedImageAreaProperties): {
  background: string;
  opacity: number;
  mixBlendMode: 'soft-light';
} | null {
  if (!resolved.tintColor || resolved.tintStrength <= 0) return null;
  return {
    background: resolved.tintColor,
    opacity: resolved.tintStrength,
    mixBlendMode: 'soft-light',
  };
}
