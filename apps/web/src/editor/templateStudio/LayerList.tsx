import {
  Eye,
  EyeOff,
  GripVertical,
  Grid3X3,
  Image,
  Layers3,
  LockKeyhole,
  Route,
  Shapes,
  Type,
  UnlockKeyhole,
} from 'lucide-react';
import type { TemplateLayer } from './types';

const layerIcons = { text: Type, image: Image, shape: Shapes, grid: Grid3X3, track: Route };

export function LayerList({
  layers,
  selectedIds,
  onSelect,
  onChange,
}: {
  layers: TemplateLayer[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onChange: (layers: TemplateLayer[]) => void;
}) {
  const change = (id: string, patch: Partial<TemplateLayer>) =>
    onChange(layers.map((layer) => (layer.id === id ? ({ ...layer, ...patch } as TemplateLayer) : layer)));
  return (
    <div
      data-layout="templateLayerList"
      className="template-layer-list"
      role="listbox"
      aria-label="Template layers"
      aria-multiselectable="true"
    >
      {!layers.length && (
        <div data-layout="templateEmptyLayers" className="template-empty-layers">
          <Layers3 size={27} />
          <strong>A blank canvas.</strong>
          <p>Add text, artwork, or a shape to start your design.</p>
        </div>
      )}
      {[...layers].reverse().map((layer) => {
        const Icon = layerIcons[layer.type];
        return (
          <div
            key={layer.id}
            data-layout="templateLayerRow"
            className={`template-layer-row${selectedIds.includes(layer.id) ? ' is-selected' : ''}${!layer.visible ? ' is-hidden' : ''}`}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('application/x-turnbased-template-layer', layer.id);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes('application/x-turnbased-template-layer'))
                event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const draggedId = event.dataTransfer.getData('application/x-turnbased-template-layer');
              const dragged = layers.find((item) => item.id === draggedId);
              if (!dragged || dragged.locked || draggedId === layer.id) return;
              const next = layers.filter((item) => item.id !== draggedId);
              const index = next.findIndex((item) => item.id === layer.id);
              next.splice(index + 1, 0, dragged);
              onChange(next);
            }}
          >
            <GripVertical className="template-layer-grip" size={12} />
            <button
              role="option"
              aria-selected={selectedIds.includes(layer.id)}
              aria-label={`Select layer ${layer.name}`}
              className="template-layer-select"
              onClick={(event) =>
                onSelect(
                  event.shiftKey || event.metaKey || event.ctrlKey
                    ? selectedIds.includes(layer.id)
                      ? selectedIds.filter((id) => id !== layer.id)
                      : [...selectedIds, layer.id]
                    : [layer.id],
                )
              }
            >
              <Icon size={14} />
              <span>{layer.name}</span>
            </button>
            <button
              aria-label={`${layer.visible ? 'Hide' : 'Show'} layer ${layer.name}`}
              title={layer.visible ? 'Hide layer' : 'Show layer'}
              className="template-layer-toggle"
              onClick={() => change(layer.id, { visible: !layer.visible })}
            >
              {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <button
              aria-label={`${layer.locked ? 'Unlock' : 'Lock'} layer ${layer.name}`}
              title={layer.locked ? 'Unlock layer' : 'Lock layer'}
              className="template-layer-toggle"
              onClick={() => change(layer.id, { locked: !layer.locked })}
            >
              {layer.locked ? <LockKeyhole size={12} /> : <UnlockKeyhole size={12} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
