import type { CSSProperties } from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  resolveBoardAppearanceProperties,
} from '@turnbased/engine-components';
import type {
  ComponentInstanceModel,
} from '@turnbased/engine-components';
import { createPlayerId } from '@turnbased/shared-types';

import { InspectorAccordion, InspectorAppearanceControls } from '../../components/InspectorControls';
import { labelStyle, textareaStyle } from '../../styles';
import type { EditorProject } from '../../types';
import type { listProjectPaletteOptions } from '../../projectPalette';
import { formatLength } from '../../units';
import { useUserSettings } from '../../../userSettings';
import { CatalogPicker } from './CatalogPicker';
import { compactInputStyle } from './boardEditorUtils';

/** Visual match for `compactInputStyle` but non-interactive — used for read-only field values. */
const readonlyValueStyle: CSSProperties = {
  padding: '0.58rem 0.68rem',
  fontSize: '0.86rem',
  fontWeight: 700,
  color: '#064e3b',
  background: 'rgba(236,253,245,0.8)',
  border: '1px solid rgba(15,118,110,0.15)',
  borderRadius: '10px',
  userSelect: 'text',
};

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
  const componentType = selectedTopLevelComponent.componentType;
  const isBoardLike = componentType === 'board' || componentType === 'tile';
  const isDeck = componentType === 'deck';
  const hasCatalog = isBoardLike || isDeck;
  const hasQuantity = componentType === 'piece' || componentType === 'token';
  const currentQuantity = hasQuantity
    ? (typeof selectedTopLevelComponent.properties.quantity === 'number' && Number.isFinite(selectedTopLevelComponent.properties.quantity)
      ? Math.max(1, Math.trunc(selectedTopLevelComponent.properties.quantity as number))
      : 1)
    : 1;
  const physicalW = typeof selectedTopLevelComponent.properties.physicalWidthMm === 'number'
    ? selectedTopLevelComponent.properties.physicalWidthMm as number : null;
  const physicalH = typeof selectedTopLevelComponent.properties.physicalHeightMm === 'number'
    ? selectedTopLevelComponent.properties.physicalHeightMm as number : null;

  // Physical dimensions are always displayed read-only when a catalog-driven
  // component has them — the user changes them by picking a different catalog
  // size from the CatalogPicker, not by editing numbers here.
  const showDimensionsReadout = hasCatalog && physicalW != null && physicalH != null;
  // Units preference lives in user settings (top-bar Settings page), not the
  // per-project settings, so it applies uniformly across every project.
  const { preferredUnits } = useUserSettings();
  const supportsOwnerSeat = (
    componentType === 'piece'
    || componentType === 'token'
    || componentType === 'zone'
    || componentType === 'hand'
    || componentType === 'deck'
  );

  return (
    <>
      <InspectorAccordion title="Info" defaultOpen>
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

      {hasCatalog ? (
        <InspectorAccordion title="General" defaultOpen>
          <CatalogPicker
            componentType={componentType as 'tile' | 'board' | 'deck'}
            instanceId={selectedTopLevelComponentId}
            instance={selectedTopLevelComponent}
            preferredUnits={preferredUnits}
            onUpdateComponent={onUpdateComponent}
          />

          {showDimensionsReadout ? (
            <div
              data-layout="physicalDimensionsReadout"
              /* read-only width/height display — user changes dimensions via CatalogPicker */
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}
            >
              <div data-layout="physicalWidthReadoutCell" /* width column */ style={{ display: 'grid', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>Width</span>
                <div style={readonlyValueStyle}>{formatLength(physicalW!, preferredUnits)}</div>
              </div>
              <div data-layout="physicalHeightReadoutCell" /* height column */ style={{ display: 'grid', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>Height</span>
                <div style={readonlyValueStyle}>{formatLength(physicalH!, preferredUnits)}</div>
              </div>
            </div>
          ) : null}
        </InspectorAccordion>
      ) : null}


      {componentType === 'piece' ? (
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

      {isBoardLike && boardAppearance && activeBoardId ? (
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
