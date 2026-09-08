import type { Dispatch, SetStateAction } from 'react';
import type { BuiltInComponentType, ComponentInstanceModel } from '@turnbased/engine-components';
import type { EditorProject } from './types';
import type { EditorSection } from './constants';
import type { CatalogComponentSelection } from './sections/rules/ComponentPicker';
import type { NewComponentCatalog } from './sections/rules/NewComponentDialog';
import { addProjectComponent, duplicateComponentSubtree, listValidParents, removeComponentInstance, syncGeneratedBoardChildren, updateComponentInstance } from './project';

export function createEditorComponentActions({ project: currentProject, paletteOwnerId, selectedComponentId, setSelectedComponentId, setActiveSection, onChange: commitProject, setNotice: setEditorNotice }: {
  project: EditorProject;
  paletteOwnerId: string | null;
  selectedComponentId: string | null;
  setSelectedComponentId: Dispatch<SetStateAction<string | null>>;
  setActiveSection: Dispatch<SetStateAction<EditorSection>>;
  onChange: (project: EditorProject) => void;
  setNotice: Dispatch<SetStateAction<string | null>>;
}) {
  function handleAddComponent(
    type: BuiltInComponentType,
    preferredParentId?: string | null,
    options: {
      focusNewComponent?: boolean;
      initializeComponent?: (instance: ComponentInstanceModel) => ComponentInstanceModel;
    } = {},
  ) {
    const focusNewComponent = options.focusNewComponent ?? true;
    const initializeComponent = options.initializeComponent;
    const validParentIds = listValidParents(currentProject, type).map((instance) => String(instance.instanceId));
    const resolvedParentId = preferredParentId === undefined
      ? (
        selectedComponentId && validParentIds.includes(selectedComponentId)
          ? selectedComponentId
          : validParentIds[0] ?? null
      )
      : preferredParentId;
    const result = addProjectComponent(currentProject, type, resolvedParentId, paletteOwnerId);

    if (result.issue) {
      setEditorNotice(result.issue);
      return null;
    }

    const initializedProject = result.instanceId && initializeComponent
      ? updateComponentInstance(result.project, result.instanceId, initializeComponent)
      : result.project;
    const nextProject = result.instanceId
      ? syncGeneratedBoardChildren(initializedProject, result.instanceId)
      : initializedProject;

    commitProject(nextProject);
    if (result.instanceId && focusNewComponent) {
      setSelectedComponentId(result.instanceId);
    }
    return result.instanceId ?? null;
  }

  function handleAddCatalogComponent(selection: CatalogComponentSelection) {
    handleAddComponent(selection.type, null, {
      focusNewComponent: false,
      initializeComponent: (instance) => ({
        ...instance,
        displayName: selection.componentName,
        notes: selection.gameDescription,
        properties: {
          ...instance.properties,
          label: selection.componentName,
          catalogSlug: selection.productSlug,
          catalogVariantId: selection.variantId,
          catalogProductTitle: selection.productTitle,
          catalogVariantTitle: selection.variantTitle,
          ...(selection.physicalWidthMm ? { physicalWidthMm: selection.physicalWidthMm } : {}),
          ...(selection.physicalHeightMm ? { physicalHeightMm: selection.physicalHeightMm } : {}),
          ...(selection.maxCards ? { maxCards: selection.maxCards } : {}),
        },
      }),
    });
  }

  function handleUpdateCatalogComponent(instanceId: string, selection: CatalogComponentSelection) {
    const current = currentProject.instances[instanceId];
    if (!current) return;
    if (current.componentType !== selection.type) {
      setEditorNotice('Choose a catalog item from the same component genre.');
      return;
    }

    updateComponent(instanceId, (instance) => ({
      ...instance,
      displayName: selection.componentName,
      notes: selection.gameDescription,
      properties: {
        ...instance.properties,
        label: selection.componentName,
        catalogSlug: selection.productSlug,
        catalogVariantId: selection.variantId,
        catalogProductTitle: selection.productTitle,
        catalogVariantTitle: selection.variantTitle,
        ...(selection.physicalWidthMm ? { physicalWidthMm: selection.physicalWidthMm } : {}),
        ...(selection.physicalHeightMm ? { physicalHeightMm: selection.physicalHeightMm } : {}),
        ...(selection.maxCards ? { maxCards: selection.maxCards } : {}),
      },
    }));
  }

  function updateComponent(
    instanceId: string,
    updater: (instance: ComponentInstanceModel) => ComponentInstanceModel,
  ) {
    const nextProject = updateComponentInstance(currentProject, instanceId, updater);
    commitProject(syncGeneratedBoardChildren(nextProject, instanceId));
  }

  function removeComponent(instanceId: string) {
    commitProject(removeComponentInstance(currentProject, instanceId));
    if (selectedComponentId === instanceId) {
      setSelectedComponentId(null);
    }
  }

  function duplicateComponent(
    instanceId: string,
    options: {
      targetParentId?: string | null;
      focus?: boolean;
      frameOffset?: { x: number; y: number };
    } = {},
  ): string | null {
    const result = duplicateComponentSubtree(currentProject, instanceId, {
      targetParentId: options.targetParentId,
      displayNameSuffix: ' Copy',
    });
    if (result.issue) {
      setEditorNotice(result.issue);
      return null;
    }
    let nextProject = result.project;
    if (result.instanceId && options.frameOffset) {
      nextProject = updateComponentInstance(nextProject, result.instanceId, (instance) => {
        if (!instance.frame) return instance;
        return {
          ...instance,
          frame: {
            ...instance.frame,
            x: (instance.frame.x ?? 0) + (options.frameOffset?.x ?? 0),
            y: (instance.frame.y ?? 0) + (options.frameOffset?.y ?? 0),
          },
        };
      });
    }
    commitProject(nextProject);
    if (result.instanceId && options.focus) {
      setSelectedComponentId(result.instanceId);
    }
    return result.instanceId ?? null;
  }

  function openComponentEditor() {
    setActiveSection('component_editor');
    setSelectedComponentId(null);
  }

  function selectComponent(instanceId: string | null) {
    setActiveSection('component_editor');
    setSelectedComponentId(instanceId);
  }

  function createTopLevelComponent(type: BuiltInComponentType) {
    setActiveSection('component_editor');
    handleAddComponent(type, null, { focusNewComponent: true });
  }

  // Catalog-first creation from the gallery's "New component" dialog: the
  // component is born already tied to the chosen catalog item, then opened.
  function createCatalogTopLevelComponent(type: 'board' | 'deck' | 'tile', catalog: NewComponentCatalog) {
    setActiveSection('component_editor');
    handleAddComponent(type, null, {
      focusNewComponent: true,
      initializeComponent: (instance) => ({
        ...instance,
        properties: {
          ...instance.properties,
          catalogSlug: catalog.catalogSlug,
          catalogVariantId: catalog.catalogVariantId,
          ...(catalog.catalogProductTitle ? { catalogProductTitle: catalog.catalogProductTitle } : {}),
          ...(catalog.catalogVariantTitle ? { catalogVariantTitle: catalog.catalogVariantTitle } : {}),
          ...(catalog.physicalWidthMm != null ? { physicalWidthMm: catalog.physicalWidthMm } : {}),
          ...(catalog.physicalHeightMm != null ? { physicalHeightMm: catalog.physicalHeightMm } : {}),
          ...(catalog.maxCards != null ? { maxCards: catalog.maxCards } : {}),
        },
      }),
    });
  }

  return { handleAddComponent, handleAddCatalogComponent, handleUpdateCatalogComponent, updateComponent, removeComponent, duplicateComponent, openComponentEditor, selectComponent, createTopLevelComponent, createCatalogTopLevelComponent };
}
