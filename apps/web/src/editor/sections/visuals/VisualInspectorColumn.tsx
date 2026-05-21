import { ArrowLeft, Copy, Trash2 } from 'lucide-react';
import {
  BOARD_BORDER_STYLE_OPTIONS,
  resolveBoardAppearanceProperties,
} from '@turnbased/engine-components';
import type {
  BoardComponentPreset,
  BoardComponentPresetFamily,
  ComponentFrame,
  ComponentInstanceModel,
  GridCellCoordinate,
} from '@turnbased/engine-components';

import { renderComponentIcon } from '../../componentMeta';
import { InspectorAccordion, InspectorAppearanceControls } from '../../components/InspectorControls';
import { BOARD_SURFACE_HEIGHT, BOARD_SURFACE_WIDTH } from '../../boardLayout';
import type { CanonicalGeometry } from '../../boardLayout';
import { mutedTextStyle } from '../../styles';
import type { EditorProject } from '../../types';
import type { listProjectPaletteOptions } from '../../projectPalette';

import {
  boardBorderWidthOptions,
  compactInputStyle,
  BOARD_PRESET_ICON_KEYS,
  getComponentLabel,
  getGridCellSelectionLabel,
} from './boardEditorUtils';
import { BoardItemInspector } from './BoardItemInspector';
import { TopLevelInspector } from './TopLevelInspector';
import { getSurfaceDimensions } from './boardViewportHelpers';
import { applyPresetToInstance } from './boardPresetHelpers';

// ── Props ────────────────────────────────────────────────────────────

interface VisualInspectorColumnProps {
  project: EditorProject;
  activeBoardId: string | null;
  currentSurfaceId: string | null;
  boardRenderWidth: number;
  boardRenderHeight: number;
  boardAppearance: ReturnType<typeof resolveBoardAppearanceProperties> | null;
  canonicalGeometries: Record<string, CanonicalGeometry>;
  boardChildIds: string[];
  selectedBoardChild: ComponentInstanceModel | null;
  resolvedSelectedBoardChildId: string | null;
  selectedTopLevelComponent: ComponentInstanceModel | null;
  selectedTopLevelComponentId: string | null;
  resolvedSelectedGridCell: GridCellCoordinate | null;
  selectedGridCells: GridCellCoordinate[];
  showGridShapePopup: boolean;
  gridPopupComponentId: string | null;
  gridAllNeighborOptions: Array<{
    id: string;
    coordinate: GridCellCoordinate;
    label: string;
    available: boolean;
  }>;
  boardPresetGroups: Array<{
    family: BoardComponentPresetFamily;
    familyLabel: string;
    presets: BoardComponentPreset[];
  }>;
  selectedPresetIds: Partial<Record<BoardComponentPresetFamily, string>>;
  paletteOptions: ReturnType<typeof listProjectPaletteOptions>;
  onSetSelectedPresetIds: (
    updater: (
      current: Partial<Record<BoardComponentPresetFamily, string>>,
    ) => Partial<Record<BoardComponentPresetFamily, string>>,
  ) => void;
  onSetSelectedGridCellKey: (key: string | null) => void;
  setSelectedBoardChildId: (id: string | null) => void;
  onUpdateComponent: (instanceId: string, updater: (instance: ComponentInstanceModel) => ComponentInstanceModel) => void;
  onRemoveComponent: (instanceId: string) => void;
  onDuplicateComponent: (
    instanceId: string,
    options?: {
      targetParentId?: string | null;
      focus?: boolean;
      frameOffset?: { x: number; y: number };
    },
  ) => string | null;
  onAssignProjectPaletteColor: (paletteId: string, value: string) => void;
  updateBoardAppearanceProperty: (key: string, value: string | number) => void;
  updateBoardChildFrame: (instanceId: string, updater: (frame: ComponentFrame) => ComponentFrame) => void;
  updateGridCells: (instanceId: string, updater: (cells: GridCellCoordinate[]) => GridCellCoordinate[]) => void;
  addBoardItem: (preset: BoardComponentPreset, x?: number, y?: number) => void;
}

// ── Component ────────────────────────────────────────────────────────

export function VisualInspectorColumn({
  project,
  activeBoardId,
  currentSurfaceId,
  boardRenderWidth,
  boardRenderHeight,
  boardAppearance,
  canonicalGeometries,
  boardChildIds,
  selectedBoardChild,
  resolvedSelectedBoardChildId,
  selectedTopLevelComponent,
  selectedTopLevelComponentId,
  resolvedSelectedGridCell,
  selectedGridCells,
  showGridShapePopup,
  gridPopupComponentId,
  gridAllNeighborOptions,
  boardPresetGroups,
  selectedPresetIds,
  paletteOptions,
  onSetSelectedPresetIds,
  onSetSelectedGridCellKey,
  setSelectedBoardChildId,
  onUpdateComponent,
  onRemoveComponent,
  onDuplicateComponent,
  onAssignProjectPaletteColor,
  updateBoardAppearanceProperty,
  updateBoardChildFrame,
  updateGridCells,
  addBoardItem,
}: VisualInspectorColumnProps) {
  return (
    /* inspectorColumn — right sidebar with selection header + scrollable property editors */
    <div data-layout="inspectorColumn" style={{
      background: 'rgba(255,255,255,0.92)',
      border: '1px solid rgba(16,185,129,0.14)',
      borderRadius: 0,
      boxShadow: '0 18px 48px rgba(6,78,59,0.08)',
      backdropFilter: 'blur(12px)',
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      minHeight: 0,
      overflow: 'hidden',
    }}>
      {/* inspectorHeader — shows selected component name + action buttons */}
      <div data-layout="inspectorHeader" style={{
        padding: '0.5rem 0.75rem',
        background: 'linear-gradient(135deg, #064e3b 0%, #0f766e 100%)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.45rem',
      }}>
        {resolvedSelectedBoardChildId ? (
          <button
            type="button"
            onClick={() => setSelectedBoardChildId(null)}
            aria-label="Back to parent component"
            title="Back to parent component"
            style={{
              flex: '0 0 auto',
              display: 'inline-grid',
              placeItems: 'center',
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={14} />
          </button>
        ) : null}
        {(() => {
          const comp = selectedBoardChild ?? selectedTopLevelComponent;
          const compId = resolvedSelectedBoardChildId ?? selectedTopLevelComponentId;
          if (!comp || !compId) return null;
          const label = resolvedSelectedGridCell && selectedBoardChild && resolvedSelectedBoardChildId
            ? getGridCellSelectionLabel(project, selectedBoardChild, resolvedSelectedGridCell)
            : getComponentLabel(project, compId);
          return (
            <span title={label} style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', flex: '1 1 auto', minWidth: 0, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.25 }}>
              {label}
            </span>
          );
        })()}
        {resolvedSelectedBoardChildId ? (
          /* inspectorHeaderActions — duplicate + delete buttons for selected board child */
          <div data-layout="inspectorHeaderActions" style={{ display: 'contents' }}>
            <button
              type="button"
              onClick={() => {
                const sourceInstance = project.instances[resolvedSelectedBoardChildId];
                const parentId = currentSurfaceId ?? (sourceInstance?.parentId ? String(sourceInstance.parentId) : null);
                const newId = onDuplicateComponent(resolvedSelectedBoardChildId, {
                  targetParentId: parentId,
                  focus: false,
                  frameOffset: { x: 16, y: 16 },
                });
                if (newId) setSelectedBoardChildId(newId);
              }}
              aria-label="Duplicate component"
              title="Duplicate component (Cmd/Ctrl+D)"
              style={{
                flex: '0 0 auto',
                display: 'inline-grid',
                placeItems: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
              }}
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedBoardChildId(null);
                onRemoveComponent(resolvedSelectedBoardChildId);
              }}
              aria-label="Delete component"
              title="Delete component"
              style={{
                flex: '0 0 auto',
                display: 'inline-grid',
                placeItems: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : null}
      </div>

      {/* inspectorScrollArea — scrollable property editors and subcomponent palette */}
      <div data-layout="inspectorScrollArea" className="inspector-scroll-area" style={{ minHeight: 0, overflowY: 'scroll', overflowX: 'hidden', padding: '0 0.85rem 0.85rem 0.85rem', display: 'grid', gap: '0.45rem', alignContent: 'start', scrollbarGutter: 'stable', scrollbarColor: 'rgba(15,118,110,0.55) rgba(15,118,110,0.08)', scrollbarWidth: 'thin' }}>

      {selectedBoardChild && resolvedSelectedBoardChildId ? (() => {
        const selectedParent = selectedBoardChild.parentId ? project.instances[String(selectedBoardChild.parentId)] : null;
        const selectedParentDimensions = getSurfaceDimensions(selectedBoardChild.parentId ? String(selectedBoardChild.parentId) : null, activeBoardId, canonicalGeometries, project.instances);
        const selectedParentW = selectedParentDimensions.width ?? selectedParent?.frame?.width ?? BOARD_SURFACE_WIDTH;
        const selectedParentH = selectedParentDimensions.height ?? selectedParent?.frame?.height ?? BOARD_SURFACE_HEIGHT;
        const selectedParentRenderedW = !selectedBoardChild.parentId || String(selectedBoardChild.parentId) === activeBoardId
          ? boardRenderWidth
          : canonicalGeometries[String(selectedBoardChild.parentId)]?.renderedWidth ?? selectedParentW;
        const selectedParentRenderedH = !selectedBoardChild.parentId || String(selectedBoardChild.parentId) === activeBoardId
          ? boardRenderHeight
          : canonicalGeometries[String(selectedBoardChild.parentId)]?.renderedHeight ?? selectedParentH;
        return (
          <BoardItemInspector
            project={project}
            selectedBoardChild={selectedBoardChild}
            resolvedSelectedBoardChildId={resolvedSelectedBoardChildId}
            currentSurfaceChildIds={boardChildIds}
            boardPresetGroups={boardPresetGroups}
            selectedPresetIds={selectedPresetIds}
            resolvedSelectedGridCell={resolvedSelectedGridCell}
            selectedGridCells={selectedGridCells}
            showGridShapePopup={showGridShapePopup}
            gridPopupComponentId={gridPopupComponentId}
            gridAllNeighborOptions={gridAllNeighborOptions}
            paletteOptions={paletteOptions}
            onSetSelectedPresetIds={onSetSelectedPresetIds}
            onSetSelectedGridCellKey={onSetSelectedGridCellKey}
            onUpdateComponent={onUpdateComponent}
            onAssignProjectPaletteColor={onAssignProjectPaletteColor}
            applyPresetToInstance={(instance, preset, childIndex) => applyPresetToInstance(instance, preset, childIndex)}
            updateBoardChildFrame={updateBoardChildFrame}
            updateGridCells={updateGridCells}
            parentSurfaceWidth={selectedParentW}
            parentSurfaceHeight={selectedParentH}
            parentRenderedWidth={selectedParentRenderedW}
            parentRenderedHeight={selectedParentRenderedH}
          />
        );
      })() : selectedTopLevelComponent && selectedTopLevelComponentId ? (
        <TopLevelInspector
          project={project}
          selectedTopLevelComponent={selectedTopLevelComponent}
          selectedTopLevelComponentId={selectedTopLevelComponentId}
          boardAppearance={boardAppearance}
          activeBoardId={activeBoardId}
          paletteOptions={paletteOptions}
          onUpdateComponent={onUpdateComponent}
          onAssignProjectPaletteColor={onAssignProjectPaletteColor}
          updateBoardAppearanceProperty={updateBoardAppearanceProperty}
        />
      ) : (
        boardAppearance && activeBoardId ? (
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
              controls: (
                /* borderStyleControls — border style + thickness selects */
                <div data-layout="borderStyleControls" style={{ display: 'grid', gap: '0.6rem' }}>
                  {/* borderStyleInputRow — style and thickness inputs side by side */}
                  <div data-layout="borderStyleInputRow" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 112px', gap: '0.6rem' }}>
                    <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.86rem', color: '#064e3b', fontWeight: 600 }}>
                      Border Style
                      <select
                        value={boardAppearance.surfaceBorderStyle}
                        onChange={(event) => updateBoardAppearanceProperty('surfaceBorderStyle', event.target.value)}
                        style={compactInputStyle}
                      >
                        {BOARD_BORDER_STYLE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option[0].toUpperCase() + option.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.86rem', color: '#064e3b', fontWeight: 600 }}>
                      Thickness
                      <select
                        value={String(boardAppearance.surfaceBorderWidth)}
                        onChange={(event) => updateBoardAppearanceProperty('surfaceBorderWidth', Number(event.target.value))}
                        style={compactInputStyle}
                      >
                        {boardBorderWidthOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}px
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              ),
            }}
          />
        ) : (
          <p style={mutedTextStyle}>Select a top-level component or board item to edit its properties.</p>
        )
      )}

      {boardPresetGroups.length > 0 && selectedBoardChild?.componentType !== 'text-box' ? (
        <InspectorAccordion title="Add Subcomponent" defaultOpen>
          {/* presetGroupList — list of preset groups for adding subcomponents */}
          <div data-layout="presetGroupList" style={{ display: 'grid', gap: '0.35rem' }}>
            {boardPresetGroups.map((group) => {
              const iconKey = BOARD_PRESET_ICON_KEYS[group.family];
              if (group.presets.length === 1) {
                const preset = group.presets[0];
                return (
                  <button
                    key={group.family}
                    type="button"
                    title={preset.description}
                    onClick={() => addBoardItem(preset)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: 'rgba(248,250,252,0.85)',
                      border: '1px solid rgba(15,118,110,0.14)',
                      borderRadius: '8px',
                      padding: '0.4rem 0.55rem',
                      color: '#0f766e',
                      fontWeight: 600,
                      fontSize: '0.70rem',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                    }}
                  >
                    {renderComponentIcon(iconKey, { size: 14, style: { color: 'currentColor', flexShrink: 0 } })}
                    {group.familyLabel}
                  </button>
                );
              }
              return (
                /* presetGroupDropdown — multi-preset family with dropdown select */
                <div
                  data-layout="presetGroupDropdown"
                  key={group.family}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'rgba(248,250,252,0.85)',
                    border: '1px solid rgba(15,118,110,0.14)',
                    borderRadius: '8px',
                    padding: '0.4rem 0.55rem',
                    color: '#0f766e',
                    fontWeight: 600,
                    fontSize: '0.70rem',
                  }}
                >
                  {renderComponentIcon(iconKey, { size: 14, style: { color: 'currentColor', flexShrink: 0 } })}
                  <select
                    value=""
                    onChange={(event) => {
                      const preset = group.presets.find((p) => p.id === event.target.value);
                      if (preset) {
                        addBoardItem(preset);
                      }
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      color: '#0f766e',
                      fontWeight: 600,
                      fontSize: '0.70rem',
                      cursor: 'pointer',
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      padding: 0,
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%230f766e' opacity='0.5'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0 center',
                      paddingRight: '14px',
                    }}
                  >
                    <option value="" disabled>{group.familyLabel}</option>
                    {group.presets.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </InspectorAccordion>
      ) : null}
      </div>
    </div>
  );
}
