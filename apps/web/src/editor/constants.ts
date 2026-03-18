import type { UISelectionState } from '@turnbased/engine-ui';

export type EditorSection = 'visual' | 'preview' | 'versions' | 'components' | 'app_layout';

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
    id: 'visual',
    label: 'Visual',
    description: 'Arrange the board and main play surface.',
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
    id: 'components',
    label: 'Component Editor',
    description: 'Manage components, properties, and ownership.',
  },
  {
    id: 'app_layout',
    label: 'App Layout',
    description: 'Shape screens, HUD, and player-facing panels.',
  },
];
