export type EditorSection = 'workshop' | 'rules' | 'stats' | 'art' | 'card_studio' | 'playtest' | 'print' | 'component_editor' | 'versions' | 'app_layout';
export type ComponentEditorMode = 'edit' | 'create';

export interface EditorSectionOption {
  id: EditorSection;
  label: string;
  description: string;
}

export const DEFAULT_EDITOR_SECTION: EditorSection = 'workshop';
export const SECTION_OPTIONS: EditorSectionOption[] = [
  { id: 'workshop', label: 'Workshop', description: 'Your next step from idea to a game on the table.' },
  { id: 'rules', label: 'Rulebook', description: 'Write the rules your playtesters will use.' },
  { id: 'card_studio', label: 'Card studio', description: 'One template, a table of ideas, a whole deck.' },
  { id: 'component_editor', label: 'Components', description: 'Design the physical pieces in your game.' },
  { id: 'art', label: 'Art studio', description: 'Give your game a consistent visual language.' },
  { id: 'playtest', label: 'Playtest lab', description: 'Try your design, test agents, and record what you learn.' },
  { id: 'versions', label: 'Version history', description: 'Keep checkpoints, compare changes, and explore alternatives.' },
  { id: 'print', label: 'Print & share', description: 'Make a paper prototype and share your design.' },
  { id: 'stats', label: 'Game details', description: 'Players, playtime, and your intended audience.' },
  { id: 'app_layout', label: 'Table layout', description: 'Arrange shared and player areas.' },
];

export function readEditorSection(hash: string): EditorSection {
  const requested = new URLSearchParams(hash.split('?')[1] ?? '').get('section');
  return SECTION_OPTIONS.find(({ id }) => id === requested)?.id ?? DEFAULT_EDITOR_SECTION;
}
