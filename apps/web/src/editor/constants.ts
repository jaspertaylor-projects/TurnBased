import type { UISelectionState } from '@turnbased/engine-ui';

export type EditorSection = 'settings' | 'art' | 'component_editor' | 'preview' | 'versions' | 'app_layout';
export type ComponentEditorMode = 'edit' | 'create';

export interface EditorSectionOption {
  id: EditorSection;
  label: string;
  description: string;
}

export const EMPTY_SELECTION: UISelectionState = {
  selectedActionId: null,
  selectedEntityId: null,
  selectedZoneId: null,
  selectedTargetEntityId: null,
  dragEntityId: null,
  subChoiceSelections: {},
};

export const SECTION_OPTIONS: EditorSectionOption[] = [
  {
    id: 'settings',
    label: 'Settings',
    description: 'Edit the game setup, player range, and project palette.',
  },
  {
    id: 'art',
    label: 'Art',
    description: 'Manage theme, art styles, recurring visual assets, and first-class icon tokens.',
  },
  {
    id: 'component_editor',
    label: 'Component Editor',
    description: 'Browse top-level components from the left rail and edit or create focused components here.',
  },
  {
    id: 'preview',
    label: 'Preview',
    description: 'Playtest the generated prototype.',
  },
  {
    id: 'versions',
    label: 'Versions',
    description: 'Track workspace history and recover checkpoints.',
  },
  {
    id: 'app_layout',
    label: 'App Layout',
    description: 'Shape screens, HUD, and player-facing panels.',
  },
];
