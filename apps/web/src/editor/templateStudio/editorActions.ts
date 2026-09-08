import type { ComponentDesignDocument, TemplateFace, TemplateLayer } from './types';

export function updateTemplateFace(
  document: ComponentDesignDocument,
  faceId: string,
  updater: (face: TemplateFace) => TemplateFace,
): ComponentDesignDocument {
  return { ...document, faces: document.faces.map((face) => (face.id === faceId ? updater(face) : face)) };
}

export function updateTemplateLayers(
  document: ComponentDesignDocument,
  faceId: string,
  ids: string[],
  updater: (layer: TemplateLayer) => TemplateLayer,
): ComponentDesignDocument {
  return updateTemplateFace(document, faceId, (face) => ({
    ...face,
    layers: face.layers.map((layer) => (ids.includes(layer.id) && !layer.locked ? updater(layer) : layer)),
  }));
}

export function duplicateTemplateLayers(
  layers: TemplateLayer[],
  ids: string[],
  offset = 2,
): { layers: TemplateLayer[]; ids: string[] } {
  const copies = layers
    .filter((layer) => ids.includes(layer.id))
    .map((layer) => ({
      ...layer,
      id: crypto.randomUUID(),
      name: `${layer.name} copy`,
      x: layer.x + offset,
      y: layer.y + offset,
      locked: false,
    }));
  return { layers: [...layers, ...copies], ids: copies.map((layer) => layer.id) };
}

export function arrangeTemplateLayers(
  layers: TemplateLayer[],
  ids: string[],
  direction: 'front' | 'back' | 'up' | 'down',
): TemplateLayer[] {
  const selected = (layer: TemplateLayer) => ids.includes(layer.id) && !layer.locked;
  if (direction === 'front')
    return [...layers.filter((layer) => !selected(layer)), ...layers.filter(selected)];
  if (direction === 'back')
    return [...layers.filter(selected), ...layers.filter((layer) => !selected(layer))];
  const next = [...layers];
  if (direction === 'up') {
    for (let index = next.length - 2; index >= 0; index--)
      if (selected(next[index]) && !selected(next[index + 1]))
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
  } else {
    for (let index = 1; index < next.length; index++)
      if (selected(next[index]) && !selected(next[index - 1]))
        [next[index], next[index - 1]] = [next[index - 1], next[index]];
  }
  return next;
}

export type TemplateAlignment =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'distribute-x'
  | 'distribute-y';

export function alignTemplateLayers(
  layers: TemplateLayer[],
  ids: string[],
  alignment: TemplateAlignment,
  width: number,
  height: number,
): TemplateLayer[] {
  const selected = layers.filter((layer) => ids.includes(layer.id) && !layer.locked);
  if (!selected.length) return layers;
  const bounds =
    selected.length === 1
      ? { x: 0, y: 0, right: width, bottom: height }
      : {
          x: Math.min(...selected.map((layer) => layer.x)),
          y: Math.min(...selected.map((layer) => layer.y)),
          right: Math.max(...selected.map((layer) => layer.x + layer.width)),
          bottom: Math.max(...selected.map((layer) => layer.y + layer.height)),
        };
  if (alignment === 'distribute-x' || alignment === 'distribute-y') {
    if (selected.length < 3) return layers;
    const horizontal = alignment === 'distribute-x';
    const ordered = [...selected].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
    const total = ordered.reduce((sum, layer) => sum + (horizontal ? layer.width : layer.height), 0);
    const gap =
      ((horizontal ? bounds.right - bounds.x : bounds.bottom - bounds.y) - total) / (ordered.length - 1);
    let position = horizontal ? bounds.x : bounds.y;
    const changed = new Map(
      ordered.map((layer) => {
        const next = { ...layer, [horizontal ? 'x' : 'y']: position };
        position += (horizontal ? layer.width : layer.height) + gap;
        return [layer.id, next];
      }),
    );
    return layers.map((layer) => changed.get(layer.id) ?? layer);
  }
  return layers.map((layer) => {
    if (!ids.includes(layer.id) || layer.locked) return layer;
    if (alignment === 'left') return { ...layer, x: bounds.x };
    if (alignment === 'right') return { ...layer, x: bounds.right - layer.width };
    if (alignment === 'center') return { ...layer, x: (bounds.x + bounds.right - layer.width) / 2 };
    if (alignment === 'top') return { ...layer, y: bounds.y };
    if (alignment === 'bottom') return { ...layer, y: bounds.bottom - layer.height };
    return { ...layer, y: (bounds.y + bounds.bottom - layer.height) / 2 };
  });
}

export function templateLayersBounds(
  layers: TemplateLayer[],
): { x: number; y: number; width: number; height: number } | null {
  if (!layers.length) return null;
  const x = Math.min(...layers.map((layer) => layer.x));
  const y = Math.min(...layers.map((layer) => layer.y));
  return {
    x,
    y,
    width: Math.max(...layers.map((layer) => layer.x + layer.width)) - x,
    height: Math.max(...layers.map((layer) => layer.y + layer.height)) - y,
  };
}

export function snapTemplateValue(value: number, gridMm: number, enabled: boolean): number {
  return Math.round((enabled && gridMm > 0 ? Math.round(value / gridMm) * gridMm : value) * 100) / 100;
}
