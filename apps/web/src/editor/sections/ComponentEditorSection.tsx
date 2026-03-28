import { getBuiltInComponentManifest, listBuiltInComponents } from '@turnbased/engine-components';
import type {
  BuiltInComponentType,
  ComponentInstanceModel,
} from '@turnbased/engine-components';
import { createPlayerId } from '@turnbased/shared-types';

import { NumericInput } from '../../components/NumericInput';
import { TreeItem } from '../TreeItem';
import { parsePropertyValue } from '../helpers';
import { inputStyle, labelStyle, mutedTextStyle, panelStyle, sectionTitleStyle } from '../styles';
import type { EditorProject } from '../types';

export function ComponentEditorSection({
  project,
  paletteOwnerId,
  onPaletteOwnerChange,
  selectedComponentId,
  selectedComponent,
  onSelectComponent,
  onAddComponent,
  onUpdateSelectedComponent,
  onRemoveSelectedComponent,
}: {
  project: EditorProject;
  paletteOwnerId: string | null;
  onPaletteOwnerChange: (ownerId: string | null) => void;
  selectedComponentId: string | null;
  selectedComponent: ComponentInstanceModel | null;
  onSelectComponent: (instanceId: string | null) => void;
  onAddComponent: (type: BuiltInComponentType) => void;
  onUpdateSelectedComponent: (updater: (instance: ComponentInstanceModel) => ComponentInstanceModel) => void;
  onRemoveSelectedComponent: () => void;
}) {
  const availablePalette = listBuiltInComponents();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', gap: '1rem' }}>
      <div style={{ display: 'grid', gap: '1rem', alignSelf: 'start' }}>
        <div style={panelStyle}>
          <p style={sectionTitleStyle}>Component Palette</p>
          <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>
            Owner for new pieces
            <select
              value={paletteOwnerId ?? ''}
              onChange={(event) => onPaletteOwnerChange(event.target.value || null)}
              style={inputStyle}
            >
              <option value="">No owner</option>
              {project.seats.map((seat) => <option key={seat.id} value={seat.id}>{seat.name}</option>)}
            </select>
          </label>

          <div style={{ display: 'grid', gap: '0.55rem' }}>
            {availablePalette.map((manifest) => (
              <button
                key={manifest.type}
                onClick={() => onAddComponent(manifest.type as BuiltInComponentType)}
                style={{
                  textAlign: 'left',
                  padding: '0.75rem 0.8rem',
                  borderRadius: '14px',
                  border: '1px solid rgba(15,118,110,0.12)',
                  background: 'rgba(255,255,255,0.82)',
                }}
              >
                <div style={{ fontWeight: 700, color: '#064e3b' }}>{manifest.displayName}</div>
                <div style={{ fontSize: '0.8rem', color: '#0f766e' }}>{manifest.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={panelStyle}>
          <p style={sectionTitleStyle}>Project Tree</p>
          {project.rootInstanceIds.length === 0 ? (
            <p style={mutedTextStyle}>No components yet. Add some from the palette.</p>
          ) : (
            project.rootInstanceIds.map((instanceId) => (
              <TreeItem
                key={instanceId}
                project={project}
                instanceId={instanceId}
                depth={0}
                selectedId={selectedComponentId}
                onSelect={(instanceId) => onSelectComponent(instanceId)}
              />
            ))
          )}
        </div>
      </div>

      <div style={panelStyle}>
        <p style={sectionTitleStyle}>Inspector</p>
        {selectedComponent ? (
          <>
            <h3 style={{ marginBottom: '0.8rem' }}>
              {selectedComponent.displayName ?? getBuiltInComponentManifest(selectedComponent.componentType as BuiltInComponentType).displayName}
            </h3>

            <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>
              Display name
              <input
                value={selectedComponent.displayName ?? ''}
                onChange={(event) => onUpdateSelectedComponent((instance) => ({
                  ...instance,
                  displayName: event.target.value,
                }))}
                style={inputStyle}
              />
            </label>

            {(selectedComponent.componentType === 'piece'
              || selectedComponent.componentType === 'token'
              || selectedComponent.componentType === 'zone'
              || selectedComponent.componentType === 'hand'
              || selectedComponent.componentType === 'deck') && (
              <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>
                Owner seat
                <select
                  value={selectedComponent.bindings.ownerId ?? ''}
                  onChange={(event) => onUpdateSelectedComponent((instance) => ({
                    ...instance,
                    bindings: {
                      ...instance.bindings,
                      ownerId: event.target.value ? createPlayerId(event.target.value) : undefined,
                    },
                  }))}
                  style={inputStyle}
                >
                  <option value="">No owner</option>
                  {project.seats.map((seat) => <option key={seat.id} value={seat.id}>{seat.name}</option>)}
                </select>
              </label>
            )}

            <div style={{ display: 'grid', gap: '0.7rem' }}>
              {Object.entries(getBuiltInComponentManifest(selectedComponent.componentType as BuiltInComponentType).propertyDefinitions).map(([key, definition]) => {
                const value = selectedComponent.properties[key];

                if (definition.kind === 'boolean') {
                  return (
                    <label key={key} style={labelStyle}>
                      {definition.label}
                      <select
                        value={String(Boolean(value))}
                        onChange={(event) => onUpdateSelectedComponent((instance) => ({
                          ...instance,
                          properties: {
                            ...instance.properties,
                            [key]: parsePropertyValue(definition, event.target.value),
                          },
                        }))}
                        style={inputStyle}
                      >
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    </label>
                  );
                }

                if (definition.kind === 'enum') {
                  return (
                    <label key={key} style={labelStyle}>
                      {definition.label}
                      <select
                        value={String(value ?? '')}
                        onChange={(event) => onUpdateSelectedComponent((instance) => ({
                          ...instance,
                          properties: {
                            ...instance.properties,
                            [key]: event.target.value,
                          },
                        }))}
                        style={inputStyle}
                      >
                        {(definition.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  );
                }

                return (
                  <label key={key} style={labelStyle}>
                    {definition.label}
                    {definition.kind === 'number' ? (
                      <NumericInput
                        value={typeof value === 'number' ? value : Number(value ?? 0)}
                        onValueChange={(nextValue) => onUpdateSelectedComponent((instance) => ({
                          ...instance,
                          properties: {
                            ...instance.properties,
                            [key]: parsePropertyValue(definition, String(nextValue)),
                          },
                        }))}
                        style={inputStyle}
                      />
                    ) : (
                      <input
                        type="text"
                        value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
                        onChange={(event) => onUpdateSelectedComponent((instance) => ({
                          ...instance,
                          properties: {
                            ...instance.properties,
                            [key]: parsePropertyValue(definition, event.target.value),
                          },
                        }))}
                        style={inputStyle}
                      />
                    )}
                  </label>
                );
              })}
            </div>

            <label style={{ ...labelStyle, marginTop: '0.8rem' }}>
              Placement index
              <NumericInput
                value={selectedComponent.placement?.index ?? 0}
                onValueChange={(value) => onUpdateSelectedComponent((instance) => ({
                  ...instance,
                  placement: {
                    ...instance.placement,
                    index: value,
                  },
                }))}
                style={inputStyle}
              />
            </label>

            <button
              onClick={onRemoveSelectedComponent}
              style={{
                width: '100%',
                marginTop: '0.85rem',
                borderRadius: '14px',
                border: '1px solid rgba(239,68,68,0.18)',
                background: 'rgba(254,226,226,0.82)',
                color: '#b91c1c',
                padding: '0.75rem 0.9rem',
              }}
            >
              Remove Component
            </button>
          </>
        ) : (
          <p style={mutedTextStyle}>Select a component from the tree or component surface to edit it here.</p>
        )}
      </div>
    </div>
  );
}
