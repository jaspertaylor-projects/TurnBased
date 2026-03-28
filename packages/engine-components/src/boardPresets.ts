import type { BoardComponentPreset, BuiltInComponentType } from './types';
import { createRectangularGridCellCoordinates } from './gridCells';

const BOARD_COMPONENT_PRESETS: BoardComponentPreset[] = [
  {
    id: 'space_round_space',
    family: 'space',
    familyLabel: 'Space',
    componentType: 'space',
    label: 'Round Space',
    description: 'A circular landing space for main board movement.',
    properties: {
      label: 'Space',
      terrain: 'plain',
      maxCapacity: null,
    },
    frame: {
      width: 122,
      height: 122,
      borderRadius: 999,
      background: 'rgba(255,255,255,0.96)',
      borderColor: 'rgba(15,118,110,0.18)',
      borderWidth: 1,
    },
  },
  {
    id: 'space_square_tile',
    family: 'space',
    familyLabel: 'Space',
    componentType: 'space',
    label: 'Square Tile',
    description: 'A square tile-like board space.',
    properties: {
      label: 'Tile',
      terrain: 'plain',
      maxCapacity: null,
    },
    frame: {
      width: 132,
      height: 132,
      borderRadius: 22,
      background: 'rgba(255,255,255,0.94)',
      borderColor: 'rgba(15,118,110,0.18)',
      borderWidth: 1,
    },
  },
  {
    id: 'space_action_slot',
    family: 'space',
    familyLabel: 'Space',
    componentType: 'space',
    label: 'Action Slot',
    description: 'A wider space for action or worker placement.',
    properties: {
      label: 'Action Space',
      terrain: 'plain',
      maxCapacity: 1,
    },
    frame: {
      width: 176,
      height: 92,
      borderRadius: 22,
      background: 'rgba(255,251,235,0.96)',
      borderColor: 'rgba(245,158,11,0.22)',
      borderWidth: 1,
    },
  },
  {
    id: 'track_linear_track',
    family: 'track',
    familyLabel: 'Track',
    componentType: 'track',
    label: 'Linear Track',
    description: 'A standard progress or race track.',
    properties: {
      label: 'Track',
      layout: 'linear',
      length: 10,
    },
    frame: {
      width: 240,
      height: 92,
      borderRadius: 22,
      background: 'rgba(236,254,255,0.94)',
      borderColor: 'rgba(14,165,233,0.18)',
      borderWidth: 1,
    },
  },
  {
    id: 'track_progress_strip',
    family: 'track',
    familyLabel: 'Track',
    componentType: 'track',
    label: 'Progress Strip',
    description: 'A compact progress strip for round or resource pacing.',
    properties: {
      label: 'Progress Track',
      layout: 'linear',
      length: 8,
    },
    frame: {
      width: 272,
      height: 74,
      borderRadius: 20,
      background: 'rgba(239,246,255,0.96)',
      borderColor: 'rgba(59,130,246,0.18)',
      borderWidth: 1,
    },
  },
  {
    id: 'track_loop_track',
    family: 'track',
    familyLabel: 'Track',
    componentType: 'track',
    label: 'Loop Track',
    description: 'A loop-like track frame for circular movement arcs.',
    properties: {
      label: 'Loop Track',
      layout: 'circular',
      length: 12,
    },
    frame: {
      width: 184,
      height: 184,
      borderRadius: 999,
      background: 'rgba(236,253,245,0.94)',
      borderColor: 'rgba(16,185,129,0.2)',
      borderWidth: 1,
    },
  },
  {
    id: 'track_score_race',
    family: 'track',
    familyLabel: 'Track',
    componentType: 'track',
    label: 'Score Race',
    description: 'A dedicated horizontal track for shared scoring or rounds.',
    properties: {
      label: 'Score Track',
      layout: 'linear',
      length: 20,
    },
    frame: {
      width: 280,
      height: 82,
      borderRadius: 20,
      background: 'rgba(254,242,242,0.96)',
      borderColor: 'rgba(248,113,113,0.24)',
      borderWidth: 1,
    },
  },
  {
    id: 'text_box_annotation',
    family: 'text',
    familyLabel: 'Text',
    componentType: 'text-box',
    label: 'Annotation Box',
    description: 'A draggable rich-text annotation box for rules reminders, flavor text, or board callouts.',
    properties: {
      label: 'Annotation',
      contentHtml: '<p><strong>Objective:</strong> Reach the relic before <em>nightfall</em>.</p><p>Spend 1 block to cross the bridge.</p>',
      fontFamily: 'sans',
      fontSize: 20,
      lineHeight: 1.4,
      textColor: '#064e3b',
      textAlign: 'left',
      verticalAlign: 'center',
      padding: 18,
    },
    frame: {
      width: 260,
      height: 148,
      borderRadius: 18,
      background: 'rgba(255,255,255,0.9)',
      borderColor: 'rgba(15,118,110,0.18)',
      borderWidth: 1,
    },
  },
  {
    id: 'grid_hex',
    family: 'grid',
    familyLabel: 'Grid',
    componentType: 'hex-grid',
    label: 'Hex Grid',
    description: 'A flexible hex region whose cells can be added or removed into custom map shapes.',
    properties: {
      label: 'Hex Grid',
      cells: createRectangularGridCellCoordinates(4, 5),
      cellLabelPrefix: 'Hex',
      maxCapacity: null,
    },
    frame: {
      width: 300,
      height: 236,
      borderRadius: 22,
      background: 'rgba(239,246,255,0.94)',
      borderColor: 'rgba(59,130,246,0.18)',
      borderWidth: 1,
    },
  },
  {
    id: 'grid_square',
    family: 'grid',
    familyLabel: 'Grid',
    componentType: 'square-grid',
    label: 'Square Grid',
    description: 'A flexible square-cell region whose cells can be added or removed into custom board shapes.',
    properties: {
      label: 'Square Grid',
      cells: createRectangularGridCellCoordinates(6, 6),
      cellLabelPrefix: 'Cell',
      maxCapacity: 1,
    },
    frame: {
      width: 280,
      height: 280,
      borderRadius: 18,
      background: 'rgba(254,249,195,0.9)',
      borderColor: 'rgba(202,138,4,0.24)',
      borderWidth: 1,
    },
  },
];

export function listBoardComponentPresets(componentType?: BuiltInComponentType): BoardComponentPreset[] {
  if (!componentType) {
    return [...BOARD_COMPONENT_PRESETS];
  }

  return BOARD_COMPONENT_PRESETS.filter((preset) => preset.componentType === componentType);
}

export function getBoardComponentPreset(presetId: string): BoardComponentPreset | null {
  return BOARD_COMPONENT_PRESETS.find((preset) => preset.id === presetId) ?? null;
}
