import type { EditorLengthUnit } from './types';

export const MM_PER_INCH = 25.4;

/** Convert a millimeter measurement into the requested display unit. */
export function convertFromMm(valueMm: number, unit: EditorLengthUnit): number {
  return unit === 'inches' ? valueMm / MM_PER_INCH : valueMm;
}

/** Short suffix for labels / headings ("in" for inches, "mm" for millimeters). */
export function unitSuffix(unit: EditorLengthUnit): string {
  return unit === 'inches' ? 'in' : 'mm';
}

/**
 * Format a numeric length (stored in mm) for display in the user's preferred
 * unit. Picks a sensible precision: whole-number inches don't need decimals,
 * fractional ones get one decimal. Millimeters round to one decimal.
 */
export function formatLength(valueMm: number, unit: EditorLengthUnit): string {
  const converted = convertFromMm(valueMm, unit);
  if (unit === 'inches') {
    return Number.isInteger(converted) ? `${converted}″` : `${converted.toFixed(1)}″`;
  }
  const rounded = Math.round(converted * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} mm` : `${rounded.toFixed(1)} mm`;
}

/**
 * Format a width × height pair (both in mm) as a single "W × H" string in the
 * preferred unit, e.g. "18″ × 18″" or "457 mm × 457 mm".
 */
export function formatDimensions(widthMm: number, heightMm: number, unit: EditorLengthUnit): string {
  return `${formatLength(widthMm, unit)} × ${formatLength(heightMm, unit)}`;
}
