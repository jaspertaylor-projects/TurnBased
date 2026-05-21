export type EditorSection = 'rules' | 'art' | 'component_editor' | 'versions' | 'app_layout';
export type ComponentEditorMode = 'edit' | 'create';

export interface EditorSectionOption {
  id: EditorSection;
  label: string;
  description: string;
}

export const DEFAULT_EDITOR_SECTION: EditorSection = 'rules';

export const SECTION_OPTIONS: EditorSectionOption[] = [
  {
    id: 'rules',
    label: 'Rules',
    description: 'Author the game rules, designer notes, phases, and scoring structure.',
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
