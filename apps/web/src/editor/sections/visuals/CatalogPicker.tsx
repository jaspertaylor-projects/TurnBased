import type { ComponentInstanceModel } from '@turnbased/engine-components';

import type { EditorLengthUnit } from '../../types';
import {
  CatalogSelector,
  type CatalogSelection,
} from './CatalogSelector';
import { selectionFromProperties } from './catalogSelection';

interface CatalogPickerProps {
  componentType: 'tile' | 'board' | 'deck';
  instanceId: string;
  instance: ComponentInstanceModel;
  preferredUnits: EditorLengthUnit;
  onUpdateComponent: (
    instanceId: string,
    updater: (instance: ComponentInstanceModel) => ComponentInstanceModel,
  ) => void;
}

/**
 * Component-editor host for the shared {@link CatalogSelector}: binds the
 * thing → size → finish selectors to a component instance's properties.
 */
export function CatalogPicker({ componentType, instanceId, instance, preferredUnits, onUpdateComponent }: CatalogPickerProps) {
  const selection = selectionFromProperties(instance.properties);

  function onChange(updater: (selection: CatalogSelection) => CatalogSelection) {
    onUpdateComponent(instanceId, (inst) => {
      const next = updater(selectionFromProperties(inst.properties));
      return {
        ...inst,
        properties: {
          ...inst.properties,
          catalogSlug: next.catalogSlug,
          catalogVariantId: next.catalogVariantId,
          shape: next.shape,
          // Never overwrite a real measurement with null — selectors carry the
          // current dimensions forward when they aren't changing them.
          ...(next.physicalWidthMm != null ? { physicalWidthMm: next.physicalWidthMm } : {}),
          ...(next.physicalHeightMm != null ? { physicalHeightMm: next.physicalHeightMm } : {}),
        },
      };
    });
  }

  return (
    <CatalogSelector
      componentType={componentType}
      selection={selection}
      preferredUnits={preferredUnits}
      onChange={onChange}
    />
  );
}
