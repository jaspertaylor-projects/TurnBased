import { useState } from 'react';
import {
  getBuiltInComponentManifest,
  getGridCoordinateKey,
} from '@turnbased/engine-components';
import type {
  BoardComponentPreset,
  BoardComponentPresetFamily,
  BuiltInComponentType,
  ComponentInstanceModel,
  GridCellCoordinate,
} from '@turnbased/engine-components';

import { renderComponentIcon } from '../../componentMeta';
import type { EditorProject } from '../../types';
import { getComponentLabel, BOARD_PRESET_ICON_KEYS } from './boardEditorUtils';

interface BoardPresetPickerProps {
  project: EditorProject;
  activeBoard: ComponentInstanceModel | null;
  boardChildIds: string[];
  resolvedSelectedBoardChildId: string | null;
  selectedBoardChild: ComponentInstanceModel | null;
  resolvedSelectedGridCell: GridCellCoordinate | null;
  selectedGridCells: GridCellCoordinate[];
  boardPresetGroups: Array<{
    family: BoardComponentPresetFamily;
    familyLabel: string;
    presets: BoardComponentPreset[];
  }>;
  selectedPresetIds: Partial<Record<BoardComponentPresetFamily, string>>;
  onSetSelectedBoardChildId: (id: string | null) => void;
  onSetSelectedPresetIds: (
    updater: (
      current: Partial<Record<BoardComponentPresetFamily, string>>,
    ) => Partial<Record<BoardComponentPresetFamily, string>>,
  ) => void;
  onSetSelectedGridCellKey: (key: string | null) => void;
  onClearBoardSelection: () => void;
  onAddBoardItem: (preset: BoardComponentPreset) => void;
  panelStyle: React.CSSProperties;
  drillPath: string[];
  onNavigateToDrillLevel: (level: number) => void;
}

export function BoardPresetPicker({
  project,
  activeBoard,
  boardChildIds,
  resolvedSelectedBoardChildId,
  selectedBoardChild,
  resolvedSelectedGridCell,
  selectedGridCells,
  boardPresetGroups,
  selectedPresetIds,
  onSetSelectedBoardChildId,
  onSetSelectedPresetIds,
  onSetSelectedGridCellKey,
  onClearBoardSelection,
  onAddBoardItem,
  panelStyle,
  drillPath,
  onNavigateToDrillLevel,
}: BoardPresetPickerProps) {
  const [hoveredChip, setHoveredChip] = useState<BoardComponentPresetFamily | null>(null);

  // Build path segments
  type Seg = { key: string; icon: React.ReactNode; label: string; onClick: (() => void) | null };
  const segments: Seg[] = [];

  if (activeBoard) {
    segments.push({
      key: 'board',
      icon: renderComponentIcon('board', { size: 12, style: { color: 'currentColor', flexShrink: 0 } }),
      label: String(activeBoard.displayName || activeBoard.properties.label || 'Board'),
      onClick: (drillPath.length > 0 || resolvedSelectedBoardChildId || resolvedSelectedGridCell) ? onClearBoardSelection : null,
    });
  }
  drillPath.forEach((id, i) => {
    const inst = project.instances[id];
    if (!inst) return;
    const cm = getBuiltInComponentManifest(inst.componentType as BuiltInComponentType);
    segments.push({
      key: `drill-${i}`,
      icon: renderComponentIcon(inst.componentType as Parameters<typeof renderComponentIcon>[0], { size: 12, style: { color: 'currentColor', flexShrink: 0 } }),
      label: getComponentLabel(project, id),
      onClick: (i < drillPath.length - 1 || resolvedSelectedBoardChildId || resolvedSelectedGridCell)
        ? () => onNavigateToDrillLevel(i + 1)
        : null,
    });
    void cm; // used for type check via getBuiltInComponentManifest
  });
  if (selectedBoardChild && resolvedSelectedBoardChildId && activeBoard) {
    segments.push({
      key: 'child',
      icon: renderComponentIcon(selectedBoardChild.componentType as Parameters<typeof renderComponentIcon>[0], { size: 12, style: { color: 'currentColor', flexShrink: 0 } }),
      label: String(selectedBoardChild.displayName || selectedBoardChild.properties.label || 'Component'),
      onClick: resolvedSelectedGridCell ? () => onSetSelectedGridCellKey(null) : null,
    });
  }
  if (resolvedSelectedGridCell) {
    segments.push({
      key: 'cell',
      icon: renderComponentIcon('space', { size: 12, style: { color: 'currentColor', flexShrink: 0 } }),
      label: `Cell (${resolvedSelectedGridCell.x}, ${resolvedSelectedGridCell.y})`,
      onClick: null,
    });
  }

  return (
    <div style={{ ...panelStyle, display: 'grid', gap: '0.7rem' }}>

      {/* Breadcrumb nav bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        background: 'linear-gradient(120deg, rgba(6,78,59,0.05) 0%, rgba(15,118,110,0.08) 100%)',
        border: '1px solid rgba(15,118,110,0.1)',
        borderRadius: '10px',
        padding: '0.28rem 0.5rem',
        overflow: 'hidden',
      }}>
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          return (
            <div key={seg.key} style={{ display: 'contents' }}>
              {i > 0 && (
                <span style={{ color: 'rgba(15,118,110,0.35)', fontSize: '0.8rem', margin: '0 0.12rem', flexShrink: 0, userSelect: 'none' }}>›</span>
              )}
              <button
                type="button"
                disabled={!seg.onClick}
                onClick={seg.onClick ?? undefined}
                title={seg.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.28rem',
                  background: isLast ? 'rgba(16,185,129,0.1)' : 'none',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.18rem 0.32rem',
                  fontSize: '0.78rem',
                  fontWeight: isLast ? 700 : 500,
                  color: isLast ? '#065f46' : '#64748b',
                  cursor: seg.onClick ? 'pointer' : 'default',
                  maxWidth: isLast ? 'none' : '130px',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  flexShrink: isLast ? 0 : 10,
                }}
              >
                {seg.icon}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.label}</span>
              </button>
            </div>
          );
        })}

        {/* Cell selector dropdown on child segment */}
        {selectedBoardChild && resolvedSelectedBoardChildId && !resolvedSelectedGridCell && selectedGridCells.length > 0 && (
          <div style={{ position: 'relative', marginLeft: '0.1rem', flexShrink: 0 }}>
            <span style={{ fontSize: '0.65rem', color: '#0f766e', cursor: 'pointer', padding: '0.15rem 0.2rem' }}>▾</span>
            <select
              value=""
              onChange={(event) => { if (event.target.value) onSetSelectedGridCellKey(event.target.value); }}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
              title="Jump to cell"
            >
              <option value="" disabled hidden>Jump to cell</option>
              {selectedGridCells.map((cell) => {
                const key = getGridCoordinateKey(cell);
                return <option key={key} value={key}>Cell ({cell.x}, {cell.y})</option>;
              })}
            </select>
          </div>
        )}

        {/* Board child selector dropdown on board segment (root level) */}
        {activeBoard && !resolvedSelectedBoardChildId && boardChildIds.length > 0 && (
          <div style={{ position: 'relative', marginLeft: '0.1rem', flexShrink: 0 }}>
            <span style={{ fontSize: '0.65rem', color: '#0f766e', cursor: 'pointer', padding: '0.15rem 0.2rem' }}>▾</span>
            <select
              value=""
              onChange={(event) => {
                const id = event.target.value;
                if (id) { onSetSelectedBoardChildId(id); onSetSelectedGridCellKey(null); }
              }}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
              title="Select sub-component"
            >
              <option value="" disabled hidden>Select sub-component</option>
              {boardChildIds.map((id) => {
                const child = project.instances[id];
                return (
                  <option key={id} value={id}>
                    {String(child?.displayName || child?.properties.label || 'Unnamed')}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* Preset chips */}
      {boardPresetGroups.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {boardPresetGroups.map((group) => {
            const selectedPresetId = selectedPresetIds[group.family];
            const selectedPreset = group.presets.find((p) => p.id === selectedPresetId) ?? group.presets[0] ?? null;
            const iconKey = BOARD_PRESET_ICON_KEYS[group.family];
            const isHovered = hoveredChip === group.family;

            if (!selectedPreset) return null;

            return (
              <div
                key={group.family}
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0,
                  borderRadius: '10px',
                  border: `1px solid ${isHovered ? 'rgba(16,185,129,0.45)' : 'rgba(15,118,110,0.14)'}`,
                  background: isHovered
                    ? 'rgba(240,253,244,0.98)'
                    : 'rgba(248,250,252,0.85)',
                  boxShadow: isHovered
                    ? '0 0 0 3px rgba(16,185,129,0.12), 0 2px 8px rgba(6,78,59,0.08)'
                    : 'none',
                  transition: 'all 120ms ease',
                  overflow: 'visible',
                }}
                onMouseEnter={() => setHoveredChip(group.family)}
                onMouseLeave={() => setHoveredChip(null)}
              >
                {/* Click to add */}
                <button
                  type="button"
                  title={`${selectedPreset.label} — ${selectedPreset.description}`}
                  onClick={() => onAddBoardItem(selectedPreset)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.38rem',
                    background: 'none',
                    border: 'none',
                    padding: '0.42rem 0.55rem 0.42rem 0.6rem',
                    color: isHovered ? '#064e3b' : '#0f766e',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'color 120ms ease',
                    borderRadius: group.presets.length > 1 ? '10px 0 0 10px' : '10px',
                  }}
                >
                  {renderComponentIcon(iconKey, { size: 14, style: { color: 'currentColor', flexShrink: 0 } })}
                  <span style={{ whiteSpace: 'nowrap' }}>{selectedPreset.label}</span>
                </button>

                {/* Variant selector (only when >1 preset) */}
                {group.presets.length > 1 && (
                  <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '22px',
                    height: '100%',
                    borderLeft: `1px solid ${isHovered ? 'rgba(16,185,129,0.3)' : 'rgba(15,118,110,0.12)'}`,
                    color: isHovered ? '#065f46' : '#94a3b8',
                    fontSize: '0.6rem',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                    flexShrink: 0,
                  }}>
                    ▾
                    <select
                      value={selectedPreset.id}
                      onChange={(event) => onSetSelectedPresetIds((current) => ({
                        ...current,
                        [group.family]: event.target.value,
                      }))}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        cursor: 'pointer',
                        width: '100%',
                        height: '100%',
                      }}
                      title="Choose variant"
                    >
                      {group.presets.map((preset) => (
                        <option key={preset.id} value={preset.id}>{preset.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
