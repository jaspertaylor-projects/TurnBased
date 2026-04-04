import { Minus, Plus } from 'lucide-react';
import {
  getBuiltInComponentManifest,
  resolveBoardAppearanceProperties,
} from '@turnbased/engine-components';
import type {
  BuiltInComponentType,
  ComponentInstanceModel,
} from '@turnbased/engine-components';
import { createPlayerId } from '@turnbased/shared-types';

import { NumericInput } from '../../../components/NumericInput';
import { InspectorAccordion, InspectorAppearanceControls } from '../../components/InspectorControls';
import { parsePropertyValue } from '../../helpers';
import { labelStyle, textareaStyle } from '../../styles';
import type { EditorProject } from '../../types';
import type { listProjectPaletteOptions } from '../../projectPalette';
import { compactInputStyle } from './boardEditorUtils';

const BOARD_SIZE_PRESETS = [
  { id: 'square', label: '400 × 400 mm', widthMm: 400, heightMm: 400 },
  { id: 'standard_landscape', label: '500 × 350 mm', widthMm: 500, heightMm: 350 },
  { id: 'wide_landscape', label: '620 × 360 mm', widthMm: 620, heightMm: 360 },
  { id: 'portrait', label: '350 × 500 mm', widthMm: 350, heightMm: 500 },
] as const;

function getBoardSizePresetId(widthMm: number | null, heightMm: number | null): string {
  if (widthMm == null || heightMm == null) {
    return 'custom';
  }

  const matchingPreset = BOARD_SIZE_PRESETS.find((preset) => (
    preset.widthMm === widthMm && preset.heightMm === heightMm
  ));

  return matchingPreset?.id ?? 'custom';
}

interface TopLevelInspectorProps {
  project: EditorProject;
  selectedTopLevelComponent: ComponentInstanceModel;
  selectedTopLevelComponentId: string;
  boardAppearance: ReturnType<typeof resolveBoardAppearanceProperties> | null;
  activeBoardId: string | null;
  paletteOptions: ReturnType<typeof listProjectPaletteOptions>;
  onUpdateComponent: (instanceId: string, updater: (instance: ComponentInstanceModel) => ComponentInstanceModel) => void;
  onAssignProjectPaletteColor: (paletteId: string, value: string) => void;
  updateBoardAppearanceProperty: (key: string, value: string | number) => void;
}

export function TopLevelInspector({
  project,
  selectedTopLevelComponent,
  selectedTopLevelComponentId,
  boardAppearance,
  activeBoardId,
  paletteOptions,
  onUpdateComponent,
  onAssignProjectPaletteColor,
  updateBoardAppearanceProperty,
}: TopLevelInspectorProps) {
  const manifest = getBuiltInComponentManifest(selectedTopLevelComponent.componentType as BuiltInComponentType);
  const isBoard = selectedTopLevelComponent.componentType === 'board';
  const hasQuantity = selectedTopLevelComponent.componentType === 'piece' || selectedTopLevelComponent.componentType === 'token';
  const currentQuantity = hasQuantity
    ? (typeof selectedTopLevelComponent.properties.quantity === 'number' && Number.isFinite(selectedTopLevelComponent.properties.quantity)
      ? Math.max(1, Math.trunc(selectedTopLevelComponent.properties.quantity as number))
      : 1)
    : 1;
  const physicalW = typeof selectedTopLevelComponent.properties.physicalWidthMm === 'number'
    ? selectedTopLevelComponent.properties.physicalWidthMm as number : null;
  const physicalH = typeof selectedTopLevelComponent.properties.physicalHeightMm === 'number'
    ? selectedTopLevelComponent.properties.physicalHeightMm as number : null;
  const boardSizePresetId = isBoard ? getBoardSizePresetId(physicalW, physicalH) : null;
  const alwaysHidden = ['physicalWidthMm', 'physicalHeightMm'];
  const hiddenParameterKeys: string[] = selectedTopLevelComponent.componentType === 'board'
    ? [...alwaysHidden, 'surfaceColor', 'surfaceTexture', 'surfaceTextureOpacity', 'surfaceBorderColor', 'surfaceBorderWidth', 'surfaceBorderStyle']
    : selectedTopLevelComponent.componentType === 'piece'
    ? [...alwaysHidden, 'backgroundColor', 'borderColor', 'borderWidth', 'quantity']
    : hasQuantity
    ? [...alwaysHidden, 'quantity']
    : [...alwaysHidden];
  const parameterEntries = Object.entries(manifest.propertyDefinitions)
    .filter(([key]) => !hiddenParameterKeys.includes(key));
  const supportsOwnerSeat = (
    selectedTopLevelComponent.componentType === 'piece'
    || selectedTopLevelComponent.componentType === 'token'
    || selectedTopLevelComponent.componentType === 'zone'
    || selectedTopLevelComponent.componentType === 'hand'
    || selectedTopLevelComponent.componentType === 'deck'
  );

  return (
    <>
      <InspectorAccordion title="General">
        <label style={labelStyle}>
          Display Name
          <input
            value={selectedTopLevelComponent.displayName ?? ''}
            onChange={(event) => onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
              ...instance,
              displayName: event.target.value,
            }))}
            style={compactInputStyle}
          />
        </label>

        {isBoard ? (
          <label style={labelStyle}>
            Board Size
            <select
              value={boardSizePresetId ?? 'custom'}
              onChange={(event) => {
                const nextPresetId = event.target.value;
                const preset = BOARD_SIZE_PRESETS.find((entry) => entry.id === nextPresetId);
                if (!preset) {
                  return;
                }

                onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
                  ...instance,
                  properties: {
                    ...instance.properties,
                    physicalWidthMm: preset.widthMm,
                    physicalHeightMm: preset.heightMm,
                  },
                }));
              }}
              style={compactInputStyle}
            >
              {BOARD_SIZE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </label>
        ) : null}

        {physicalW != null && physicalH != null ? (
          boardSizePresetId === 'custom' || !isBoard ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <label style={labelStyle}>
                Width (mm)
                <NumericInput
                  value={physicalW}
                  onValueChange={(value) => onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
                    ...instance,
                    properties: { ...instance.properties, physicalWidthMm: Math.max(1, value) },
                  }))}
                  min={1}
                  step={1}
                  style={compactInputStyle}
                />
              </label>
              <label style={labelStyle}>
                Height (mm)
                <NumericInput
                  value={physicalH}
                  onValueChange={(value) => onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
                    ...instance,
                    properties: { ...instance.properties, physicalHeightMm: Math.max(1, value) },
                  }))}
                  min={1}
                  step={1}
                  style={compactInputStyle}
                />
              </label>
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
              {physicalW}mm × {physicalH}mm
            </div>
          )
        ) : null}

        <label style={labelStyle}>
          Notes
          <textarea
            value={selectedTopLevelComponent.notes ?? ''}
            onChange={(event) => onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
              ...instance,
              notes: event.target.value,
            }))}
            placeholder="Non-visual design notes for this component. These can later inform AI-generated rules and logic."
            style={{
              ...textareaStyle,
              minHeight: '96px',
              padding: '0.62rem 0.68rem',
              fontSize: '0.86rem',
            }}
          />
        </label>

        {supportsOwnerSeat ? (
          <label style={labelStyle}>
            Owner Seat
            <select
              value={selectedTopLevelComponent.bindings.ownerId ?? ''}
              onChange={(event) => onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
                ...instance,
                bindings: {
                  ...instance.bindings,
                  ownerId: event.target.value ? createPlayerId(event.target.value) : undefined,
                },
              }))}
              style={compactInputStyle}
            >
              <option value="">No owner</option>
              {project.seats.map((seat) => <option key={seat.id} value={seat.id}>{seat.name}</option>)}
            </select>
          </label>
        ) : null}

        {hasQuantity ? (
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>Quantity</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                type="button"
                disabled={currentQuantity <= 1}
                onClick={() => onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
                  ...instance,
                  properties: { ...instance.properties, quantity: Math.max(1, currentQuantity - 1) },
                }))}
                style={{
                  width: '30px',
                  height: '30px',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '8px',
                  border: '1px solid rgba(15,118,110,0.15)',
                  background: currentQuantity <= 1 ? 'rgba(248,250,252,0.6)' : 'rgba(240,253,244,0.96)',
                  color: currentQuantity <= 1 ? '#cbd5e1' : '#065f46',
                  cursor: currentQuantity <= 1 ? 'default' : 'pointer',
                  flex: '0 0 auto',
                }}
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                min={1}
                value={currentQuantity}
                onChange={(event) => {
                  const next = Math.max(1, Math.trunc(Number(event.target.value) || 1));
                  onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
                    ...instance,
                    properties: { ...instance.properties, quantity: next },
                  }));
                }}
                style={{
                  ...compactInputStyle,
                  textAlign: 'center',
                  width: '56px',
                  flex: '0 0 auto',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                }}
              />
              <button
                type="button"
                onClick={() => onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
                  ...instance,
                  properties: { ...instance.properties, quantity: currentQuantity + 1 },
                }))}
                style={{
                  width: '30px',
                  height: '30px',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '8px',
                  border: '1px solid rgba(15,118,110,0.15)',
                  background: 'rgba(240,253,244,0.96)',
                  color: '#065f46',
                  cursor: 'pointer',
                  flex: '0 0 auto',
                }}
              >
                <Plus size={14} />
              </button>
              {currentQuantity > 1 ? (
                <span style={{ fontSize: '0.74rem', color: '#6b7280', marginLeft: '0.2rem' }}>
                  {currentQuantity} copies in play
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </InspectorAccordion>

      {parameterEntries.length > 0 ? (
        <InspectorAccordion title="Parameters">
          {parameterEntries.map(([key, definition]) => {
            const value = selectedTopLevelComponent.properties[key];

            if (definition.kind === 'boolean') {
              return (
                <label key={key} style={labelStyle}>
                  {definition.label}
                  <select
                    value={String(Boolean(value))}
                    onChange={(event) => onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
                      ...instance,
                      properties: {
                        ...instance.properties,
                        [key]: parsePropertyValue(definition, event.target.value),
                      },
                    }))}
                    style={compactInputStyle}
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
                    onChange={(event) => onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
                      ...instance,
                      properties: {
                        ...instance.properties,
                        [key]: event.target.value,
                      },
                    }))}
                    style={compactInputStyle}
                  >
                    {(definition.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }

            return (
              <label key={key} style={labelStyle}>
                {definition.label}
                <input
                  type={definition.kind === 'number' ? 'number' : 'text'}
                  value={String(value ?? '')}
                  onChange={(event) => onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
                    ...instance,
                    properties: {
                      ...instance.properties,
                      [key]: parsePropertyValue(definition, event.target.value),
                    },
                  }))}
                  style={compactInputStyle}
                />
              </label>
            );
          })}
        </InspectorAccordion>
      ) : null}

      {selectedTopLevelComponent.componentType === 'piece' ? (
        <InspectorAppearanceControls
          scopeLabel="Piece"
          backgroundValue={String(selectedTopLevelComponent.properties.backgroundColor ?? '#10b981')}
          onBackgroundChange={(value) => onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
            ...instance,
            properties: { ...instance.properties, backgroundColor: value },
          }))}
          palette={paletteOptions}
          onAssignPaletteColor={onAssignProjectPaletteColor}
          border={{
            colorLabel: 'Border Color',
            colorValue: String(selectedTopLevelComponent.properties.borderColor ?? 'rgba(6,78,59,0.7)'),
            onColorChange: (value) => onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
              ...instance,
              properties: { ...instance.properties, borderColor: value },
            })),
            controls: (
              <label style={labelStyle}>
                Border Width
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={String(selectedTopLevelComponent.properties.borderWidth ?? 2)}
                  onChange={(event) => onUpdateComponent(selectedTopLevelComponentId, (instance) => ({
                    ...instance,
                    properties: { ...instance.properties, borderWidth: Number(event.target.value) },
                  }))}
                  style={compactInputStyle}
                />
              </label>
            ),
          }}
        />
      ) : null}

      {selectedTopLevelComponent.componentType === 'board' && boardAppearance && activeBoardId ? (
        <InspectorAppearanceControls
          scopeLabel="Surface"
          backgroundValue={boardAppearance.surfaceColor}
          onBackgroundChange={(value) => updateBoardAppearanceProperty('surfaceColor', value)}
          palette={paletteOptions}
          onAssignPaletteColor={onAssignProjectPaletteColor}
          texture={{
            value: boardAppearance.surfaceTexture,
            onChange: (value) => updateBoardAppearanceProperty('surfaceTexture', value),
            opacity: boardAppearance.surfaceTextureOpacity,
            onOpacityChange: (value) => updateBoardAppearanceProperty('surfaceTextureOpacity', value),
            previewBackground: boardAppearance.surfaceColor,
          }}
          border={{
            colorLabel: 'Border Color',
            colorValue: boardAppearance.surfaceBorderColor,
            onColorChange: (value) => updateBoardAppearanceProperty('surfaceBorderColor', value),
          }}
        />
      ) : null}
    </>
  );
}
