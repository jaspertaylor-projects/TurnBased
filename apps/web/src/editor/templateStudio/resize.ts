import type { ComponentDesignDocument } from './types';

/** Physical print margins stay in mm; optional artwork scaling follows the new surface. */
export function resizeTemplateDocument(
  document: ComponentDesignDocument,
  widthMm: number,
  heightMm: number,
  scaleArtwork: boolean,
): ComponentDesignDocument {
  const sx = widthMm / document.widthMm;
  const sy = heightMm / document.heightMm;
  const scale = Math.min(sx, sy);
  if (!scaleArtwork || (sx === 1 && sy === 1)) return { ...document, widthMm, heightMm };
  return {
    ...document,
    widthMm,
    heightMm,
    faces: document.faces.map((face) => ({
      ...face,
      layers: face.layers.map((layer) => ({
        ...layer,
        x: layer.x * sx,
        y: layer.y * sy,
        width: layer.width * sx,
        height: layer.height * sy,
        strokeWidth: layer.strokeWidth * scale,
        ...(layer.type === 'text' ? { fontSize: layer.fontSize * scale } : {}),
        ...(layer.type === 'shape' || layer.type === 'image' ? { radius: layer.radius * scale } : {}),
        ...(layer.type === 'grid' ? { gap: layer.gap * scale } : {}),
      })),
    })),
  };
}
