export type EditorSection = 'settings' | 'art' | 'component_editor' | 'versions' | 'app_layout';
export type ComponentEditorMode = 'edit' | 'create';

export interface EditorSectionOption {
  id: EditorSection;
  label: string;
  description: string;
}

export const SECTION_OPTIONS: EditorSectionOption[] = [
  {
    id: 'settings',
    label: 'Settings',
    description: 'Edit the game setup, player range, and project palette.',
  },
  {
    id: 'art',
    label: 'Art Studio',
    description: 'Manage theme, art styles, recurring visual assets, and first-class icon tokens.',
  },
  {
    id: 'component_editor',
    label: 'Component Editor',
    description: 'Browse top-level components from the left rail and edit or create focused components here.',
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
