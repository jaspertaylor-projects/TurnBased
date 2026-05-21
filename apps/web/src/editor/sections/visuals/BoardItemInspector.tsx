import { Minus, Plus, RotateCw, Trash2 } from 'lucide-react';
import {
  getBoardComponentPreset,
  getGridCoordinateKey,
} from '@turnbased/engine-components';
import type {
  BoardComponentPreset,
  BoardComponentPresetFamily,
  BuiltInComponentType,
  ComponentFrame,
  ComponentInstanceModel,
  GridCellCoordinate,
} from '@turnbased/engine-components';

import { NumericInput } from '../../../components/NumericInput';
import { InspectorAccordion, InspectorAppearanceControls } from '../../components/InspectorControls';
import { TextBoxInspector } from '../../components/TextBoxInspector';
import {
  getBoardGridCells,
  getGridCellAppearance,
  getResolvedChildItemFrame,
  isBoardGridComponentType,
} from '../../boardLayout';
import { resolveBoardGridLayout } from '@turnbased/engine-ui';
import { labelStyle, textareaStyle } from '../../styles';
import type { EditorProject } from '../../types';
import type { listProjectPaletteOptions } from '../../projectPalette';
import { compactInputStyle, getPresetFamily } from './boardEditorUtils';

interface BoardItemInspectorProps {
  project: EditorProject;
  selectedBoardChild: ComponentInstanceModel;
  resolvedSelectedBoardChildId: string;
  currentSurfaceChildIds: string[];
  boardPresetGroups: Array<{
    family: BoardComponentPresetFamily;
    familyLabel: string;
    presets: BoardComponentPreset[];
  }>;
  selectedPresetIds: Partial<Record<BoardComponentPresetFamily, string>>;
  resolvedSelectedGridCell: GridCellCoordinate | null;
  selectedGridCells: GridCellCoordinate[];
  showGridShapePopup: boolean;
  gridPopupComponentId: string | null;
  gridAllNeighborOptions: Array<{
    id: string;
    label: string;
    coordinate: GridCellCoordinate;
    available: boolean;
  }>;
  paletteOptions: ReturnType<typeof listProjectPaletteOptions>;
  onSetSelectedPresetIds: (
    updater: (
      current: Partial<Record<BoardComponentPresetFamily, string>>,
    ) => Partial<Record<BoardComponentPresetFamily, string>>,
  ) => void;
  onSetSelectedGridCellKey: (key: string | null) => void;
  onUpdateComponent: (instanceId: string, updater: (instance: ComponentInstanceModel) => ComponentInstanceModel) => void;
  onAssignProjectPaletteColor: (paletteId: string, value: string) => void;
  applyPresetToInstance: (instance: ComponentInstanceModel, preset: BoardComponentPreset, childIndex: number) => ComponentInstanceModel;
  updateBoardChildFrame: (instanceId: string, updater: (frame: ComponentFrame) => ComponentFrame) => void;
  updateGridCells: (instanceId: string, updater: (cells: GridCellCoordinate[]) => GridCellCoordinate[]) => void;
  /** Parent surface dimensions for correct frame clamping. */
  parentSurfaceWidth: number;
  parentSurfaceHeight: number;
  parentRenderedWidth: number;
  parentRenderedHeight: number;
}

export function BoardItemInspector({
  project,
  selectedBoardChild,
  resolvedSelectedBoardChildId,
  currentSurfaceChildIds,
  boardPresetGroups,
  selectedPresetIds,
  resolvedSelectedGridCell,
  selectedGridCells,
  showGridShapePopup,
  gridPopupComponentId,
  gridAllNeighborOptions,
  paletteOptions,
  onSetSelectedPresetIds,
  onSetSelectedGridCellKey,
  onUpdateComponent,
  onAssignProjectPaletteColor,
  applyPresetToInstance,
  updateBoardChildFrame,
  updateGridCells,
  parentSurfaceWidth,
  parentSurfaceHeight,
  parentRenderedWidth,
  parentRenderedHeight,
}: BoardItemInspectorProps) {
  return (
    <>
      {showGridShapePopup ? (
        <InspectorAccordion title={selectedBoardChild.componentType === 'hex-grid' ? 'Hex Tools' : 'Grid Tools'}>
          {/* Bulk extend buttons — add full row or column */}
          {selectedGridCells.length > 0 && gridPopupComponentId && (
            <div data-layout="gridBulkExtend" style={{
              display: 'flex',
              gap: 6,
              paddingBottom: '0.5rem',
              marginBottom: '0.5rem',
              borderBottom: '1px solid rgba(15,118,110,0.1)',
            }}>
              <button
                type="button"
                onClick={() => {
                  if (!gridPopupComponentId) return;
                  const maxRow = selectedGridCells.reduce((m, c) => Math.max(m, c.y), 0);
                  const minCol = selectedGridCells.reduce((m, c) => Math.min(m, c.x), Infinity);
                  const maxCol = selectedGridCells.reduce((m, c) => Math.max(m, c.x), 0);
                  const newCells: GridCellCoordinate[] = [];
                  for (let x = minCol; x <= maxCol; x++) {
                    newCells.push({ x, y: maxRow + 1 });
                  }
                  updateGridCells(gridPopupComponentId, (cells) => [...cells, ...newCells]);
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(15,118,110,0.15)',
                  background: 'rgba(240,253,244,0.96)',
                  color: '#065f46',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} /> Row
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!gridPopupComponentId) return;
                  const maxCol = selectedGridCells.reduce((m, c) => Math.max(m, c.x), 0);
                  const minRow = selectedGridCells.reduce((m, c) => Math.min(m, c.y), Infinity);
                  const maxRow = selectedGridCells.reduce((m, c) => Math.max(m, c.y), 0);
                  const newCells: GridCellCoordinate[] = [];
                  for (let y = minRow; y <= maxRow; y++) {
                    newCells.push({ x: maxCol + 1, y });
                  }
                  updateGridCells(gridPopupComponentId, (cells) => [...cells, ...newCells]);
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(15,118,110,0.15)',
                  background: 'rgba(240,253,244,0.96)',
                  color: '#065f46',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} /> Column
              </button>
            </div>
          )}

          {resolvedSelectedGridCell ? (
            <>
              {gridAllNeighborOptions.map((option) => (
                <div
                  key={option.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.4rem 0.1rem',
                    borderBottom: '1px solid rgba(15,118,110,0.06)',
                  }}
                >
                  <span style={{
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: option.available ? '#064e3b' : '#94a3b8',
                  }}>
                    {option.label}
                  </span>
                  <button
                    type="button"
                    disabled={!option.available}
                    onClick={() => {
                      if (!gridPopupComponentId || !option.available) {
                        return;
                      }
                      updateGridCells(gridPopupComponentId, (cells) => [...cells, option.coordinate]);
                      onSetSelectedGridCellKey(getGridCoordinateKey(option.coordinate));
                    }}
                    style={{
                      display: 'inline-grid',
                      placeItems: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      border: option.available ? '1px solid rgba(15,118,110,0.15)' : '1px solid rgba(148,163,184,0.18)',
                      background: option.available ? 'rgba(240,253,244,0.96)' : 'rgba(248,250,252,0.6)',
                      color: option.available ? '#065f46' : '#cbd5e1',
                      cursor: option.available ? 'pointer' : 'default',
                    }}
                    title={option.available ? `Add cell ${option.label.toLowerCase()}` : `${option.label} already occupied`}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              ))}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0.1rem',
                  marginTop: '0.15rem',
                }}
              >
                <span style={{
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: selectedGridCells.length > 1 ? '#b91c1c' : '#94a3b8',
                }}>
                  Delete Cell
                </span>
                <button
                  type="button"
                  disabled={selectedGridCells.length <= 1}
                  onClick={() => {
                    const fallbackCell = selectedGridCells.find((cell) => getGridCoordinateKey(cell) !== getGridCoordinateKey(resolvedSelectedGridCell)) ?? null;
                    if (!gridPopupComponentId) {
                      return;
                    }
                    updateGridCells(gridPopupComponentId, (cells) => (
                      cells.filter((cell) => getGridCoordinateKey(cell) !== getGridCoordinateKey(resolvedSelectedGridCell))
                    ));
                    onSetSelectedGridCellKey(fallbackCell ? getGridCoordinateKey(fallbackCell) : null);
                  }}
                  style={{
                    display: 'inline-grid',
                    placeItems: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    border: selectedGridCells.length > 1 ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(148,163,184,0.18)',
                    background: selectedGridCells.length > 1 ? 'rgba(254,242,242,0.96)' : 'rgba(248,250,252,0.6)',
                    color: selectedGridCells.length > 1 ? '#b91c1c' : '#cbd5e1',
                    cursor: selectedGridCells.length > 1 ? 'pointer' : 'default',
                  }}
                  title={selectedGridCells.length > 1 ? 'Delete this cell' : 'Cannot delete the last cell'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.4rem 0.1rem',
              }}
            >
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#064e3b' }}>
                Add First Cell
              </span>
              <button
                type="button"
                onClick={() => {
                  const origin = { x: 0, y: 0 };
                  if (!gridPopupComponentId) {
                    return;
                  }
                  updateGridCells(gridPopupComponentId, () => [origin]);
                  onSetSelectedGridCellKey(getGridCoordinateKey(origin));
                }}
                style={{
                  display: 'inline-grid',
                  placeItems: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  border: '1px solid rgba(15,118,110,0.15)',
                  background: 'rgba(240,253,244,0.96)',
                  color: '#065f46',
                  cursor: 'pointer',
                }}
                title="Add the first cell"
              >
                <Plus size={15} />
              </button>
            </div>
          )}
        </InspectorAccordion>
      ) : null}

      {!resolvedSelectedGridCell ? (() => {
        const componentType = selectedBoardChild.componentType as BuiltInComponentType;
        const isTextBox = componentType === 'text-box';
        const presetFamily = getPresetFamily(componentType);
        const presets = presetFamily
          ? boardPresetGroups.find((group) => group.family === presetFamily)?.presets ?? []
          : [];
        const activePresetId = presetFamily ? selectedPresetIds[presetFamily] : undefined;
        const selectedPreset = activePresetId
          ? presets.find((preset) => preset.id === activePresetId)
          : null;
        const childIndex = currentSurfaceChildIds.indexOf(resolvedSelectedBoardChildId);
        const frame = getResolvedChildItemFrame(selectedBoardChild, Math.max(childIndex, 0), parentSurfaceWidth, parentSurfaceHeight);
        const hasQuantity = componentType === 'piece' || componentType === 'token';
        const currentQuantity = hasQuantity
          ? (typeof selectedBoardChild.properties.quantity === 'number' && Number.isFinite(selectedBoardChild.properties.quantity)
            ? Math.max(1, Math.trunc(selectedBoardChild.properties.quantity as number))
            : 1)
          : 1;
        const cellAppearance = isBoardGridComponentType(selectedBoardChild.componentType)
          ? getGridCellAppearance(selectedBoardChild)
          : null;
        const cellBorderWidth = cellAppearance?.borderWidth
          ?? (selectedBoardChild.componentType === 'hex-grid' ? 2 : 1);
        const cellBorderRadius = cellAppearance?.borderRadius
          ?? (selectedBoardChild.componentType === 'hex-grid' ? 0 : 10);
        const cellBorderColor = cellAppearance?.borderColor
          ?? (selectedBoardChild.componentType === 'hex-grid' ? 'rgba(15,118,110,0.52)' : 'rgba(15,118,110,0.18)');

        const isGrid = isBoardGridComponentType(componentType);
        const gridCells = isGrid ? getBoardGridCells(selectedBoardChild) : [];
        const gridCellCount = gridCells.length;
        const gridBounds = gridCells.reduce((bounds, cell) => ({
          minX: Math.min(bounds.minX, cell.x),
          maxX: Math.max(bounds.maxX, cell.x),
          minY: Math.min(bounds.minY, cell.y),
          maxY: Math.max(bounds.maxY, cell.y),
        }), {
          minX: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        });
        const gridRows = Number.isFinite(gridBounds.minY)
          ? (gridBounds.maxY - gridBounds.minY) + 1
          : 1;
        const gridColumns = Number.isFinite(gridBounds.minX)
          ? (gridBounds.maxX - gridBounds.minX) + 1
          : 1;
        const gridLayoutMetrics = isGrid
          ? resolveBoardGridLayout(
            componentType,
            gridCells.map((cell) => ({ row: cell.y, column: cell.x })),
          )
          : null;
        const gridScaleRatio = parentRenderedWidth > 0 && parentRenderedHeight > 0
          ? (parentRenderedWidth / Math.max(parentSurfaceWidth, 1)) / (parentRenderedHeight / Math.max(parentSurfaceHeight, 1))
          : 1;

        function updateGridFrameByCellSize(cellSize: number) {
          if (!gridLayoutMetrics) {
            return;
          }

          const nextCellSize = Math.max(1, cellSize);
          updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
            ...current,
            width: Math.round(nextCellSize * gridLayoutMetrics.totalWidth),
            height: Math.round(nextCellSize * gridLayoutMetrics.totalHeight * gridScaleRatio),
          }));
        }

        return (
          <>
            <InspectorAccordion title="Info" defaultOpen>
              {presets.length > 0 ? (
                <label style={labelStyle}>
                  Type
                  <select
                    value={selectedPreset?.id ?? presets[0]?.id ?? ''}
                    onChange={(event) => {
                      const preset = getBoardComponentPreset(event.target.value);
                      if (!preset) {
                        return;
                      }

                      onSetSelectedPresetIds((current) => ({
                        ...current,
                        ...(presetFamily ? { [presetFamily]: preset.id } : {}),
                      }));
                      onUpdateComponent(resolvedSelectedBoardChildId, (instance) => applyPresetToInstance(
                        instance,
                        preset,
                        currentSurfaceChildIds.indexOf(resolvedSelectedBoardChildId),
                      ));
                    }}
                    style={compactInputStyle}
                  >
                    {presets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label style={labelStyle}>
                Name
                <input
                  value={String(selectedBoardChild.properties.label ?? selectedBoardChild.displayName ?? '')}
                  onChange={(event) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                    ...instance,
                    displayName: event.target.value,
                    properties: {
                      ...instance.properties,
                      label: event.target.value,
                    },
                  }))}
                  style={compactInputStyle}
                />
              </label>

              <label style={labelStyle}>
                Notes
                <textarea
                  value={selectedBoardChild.notes ?? ''}
                  onChange={(event) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
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

              {hasQuantity ? (
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>Quantity</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      disabled={currentQuantity <= 1}
                      onClick={() => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
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
                        onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
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
                      onClick={() => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
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

            {isGrid ? (() => {
              const isHex = componentType === 'hex-grid';
              const cellW = gridLayoutMetrics
                ? Math.max(1, Math.round(frame.width / Math.max(gridLayoutMetrics.totalWidth, 1)))
                : 1;

              return (
                <InspectorAccordion title="Size" defaultOpen>
                  <label style={labelStyle}>
                    Cell Size
                    <NumericInput
                      value={cellW}
                      min={8}
                      max={200}
                      onValueChange={updateGridFrameByCellSize}
                      style={compactInputStyle}
                    />
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                    {gridRows} × {gridColumns} footprint · {gridCellCount} {isHex ? 'hexes' : 'cells'}
                  </span>
                </InspectorAccordion>
              );
            })() : null}

            <InspectorAccordion title="Layout">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' }}>
                <label style={labelStyle}>
                  X
                  <NumericInput
                    value={Math.round(frame.x)}
                    onValueChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                      ...current,
                      x: value,
                    }))}
                    style={compactInputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Y
                  <NumericInput
                    value={Math.round(frame.y)}
                    onValueChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                      ...current,
                      y: value,
                    }))}
                    style={compactInputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Width
                  <NumericInput
                    value={Math.round(frame.width)}
                    onValueChange={(value) => {
                      if (isGrid && gridLayoutMetrics) {
                        updateGridFrameByCellSize(value / Math.max(gridLayoutMetrics.totalWidth, 1));
                        return;
                      }

                      updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                        ...current,
                        width: value,
                      }));
                    }}
                    style={compactInputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Height
                  <NumericInput
                    value={Math.round(frame.height)}
                    onValueChange={(value) => {
                      if (isGrid && gridLayoutMetrics) {
                        updateGridFrameByCellSize(value / Math.max(gridLayoutMetrics.totalHeight * gridScaleRatio, 1));
                        return;
                      }

                      updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                        ...current,
                        height: value,
                      }));
                    }}
                    style={compactInputStyle}
                  />
                </label>
              </div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <RotateCw size={13} style={{ color: '#0f766e', flexShrink: 0 }} />
                Rotation
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, minWidth: 0 }}>
                  <NumericInput
                    value={Math.round(frame.rotation ?? 0)}
                    onValueChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                      ...current,
                      rotation: value,
                    }))}
                    style={{ ...compactInputStyle, flex: 1, minWidth: 0 }}
                  />
                  <span style={{ fontSize: '0.78rem', color: '#6b7280', flexShrink: 0 }}>°</span>
                </div>
              </label>
            </InspectorAccordion>

            {isTextBox ? (
              <TextBoxInspector
                key={resolvedSelectedBoardChildId}
                project={project}
                properties={selectedBoardChild.properties}
                paletteOptions={paletteOptions}
                onAssignProjectPaletteColor={onAssignProjectPaletteColor}
                onUpdateProperties={(updater) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                  ...instance,
                  properties: updater(instance.properties),
                }))}
              />
            ) : null}

            <InspectorAppearanceControls
              backgroundLabel="Fill"
              backgroundValue={frame.background ?? 'rgba(255,255,255,0.94)'}
              onBackgroundChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                ...current,
                background: value || null,
              }))}
              palette={paletteOptions}
              onAssignPaletteColor={onAssignProjectPaletteColor}
              texture={{
                value: frame.textureId ?? 'none',
                onChange: (value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                  ...current,
                  textureId: value,
                })),
                opacity: frame.textureOpacity ?? 0.3,
                onOpacityChange: (value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                  ...current,
                  textureOpacity: value,
                })),
                previewBackground: frame.background ?? 'rgba(255,255,255,0.94)',
              }}
              border={{
                colorLabel: 'Border Color',
                colorValue: frame.borderColor ?? 'rgba(15,118,110,0.18)',
                onColorChange: (value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                  ...current,
                  borderColor: value || null,
                })),
                controls: (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' }}>
                    <label style={labelStyle}>
                      Width
                      <NumericInput
                        value={frame.borderWidth}
                        onValueChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                          ...current,
                          borderWidth: value,
                        }))}
                        min={0}
                        step={1}
                        style={compactInputStyle}
                      />
                    </label>
                    <label style={labelStyle}>
                      Radius
                      <NumericInput
                        value={frame.borderRadius}
                        onValueChange={(value) => updateBoardChildFrame(resolvedSelectedBoardChildId, (current) => ({
                          ...current,
                          borderRadius: value,
                        }))}
                        min={0}
                        step={1}
                        style={compactInputStyle}
                      />
                    </label>
                  </div>
                ),
              }}
            />

            {cellAppearance ? (
              <InspectorAppearanceControls
                scopeLabel="Cell"
                backgroundLabel="Fill"
                backgroundValue={cellAppearance.background}
                onBackgroundChange={(value) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                  ...instance,
                  properties: {
                    ...instance.properties,
                    cellBackground: value || null,
                  },
                }))}
                palette={paletteOptions}
                onAssignPaletteColor={onAssignProjectPaletteColor}
                texture={{
                  value: cellAppearance.textureId ?? 'none',
                  onChange: (value) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                    ...instance,
                    properties: {
                      ...instance.properties,
                      cellTextureId: value,
                    },
                  })),
                  opacity: cellAppearance.textureOpacity,
                  onOpacityChange: (value) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                    ...instance,
                    properties: {
                      ...instance.properties,
                      cellTextureOpacity: value,
                    },
                  })),
                  previewBackground: cellAppearance.background,
                }}
                border={{
                  colorValue: cellBorderColor,
                  onColorChange: (value) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                    ...instance,
                    properties: {
                      ...instance.properties,
                      cellBorderColor: value || null,
                    },
                  })),
                  controls: (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' }}>
                      <label style={labelStyle}>
                        Width
                        <NumericInput
                          value={cellBorderWidth}
                          onValueChange={(value) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                            ...instance,
                            properties: {
                              ...instance.properties,
                              cellBorderWidth: value,
                            },
                          }))}
                          min={0}
                          step={1}
                          style={compactInputStyle}
                        />
                      </label>
                      <label style={labelStyle}>
                        Radius
                        <NumericInput
                          value={cellBorderRadius}
                          onValueChange={(value) => onUpdateComponent(resolvedSelectedBoardChildId, (instance) => ({
                            ...instance,
                            properties: {
                              ...instance.properties,
                              cellBorderRadius: value,
                            },
                          }))}
                          min={0}
                          step={1}
                          style={compactInputStyle}
                        />
                      </label>
                    </div>
                  ),
                }}
              />
            ) : null}

          </>
        );
      })() : null}
    </>
  );
}
