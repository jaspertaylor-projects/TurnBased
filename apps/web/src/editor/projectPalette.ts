import type { EditorProject, ProjectColorPalette, ProjectPaletteColorId } from './types';

export const PROJECT_PALETTE_ORDER: ProjectPaletteColorId[] = [
  'primary',
  'secondary',
  'tertiary',
  'accent_1',
  'accent_2',
  'accent_3',
  'accent_4',
  'accent_5',
  'accent_6',
];

export const PROJECT_PALETTE_LABELS: Record<ProjectPaletteColorId, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  tertiary: 'Tertiary',
  accent_1: 'Accent 1',
  accent_2: 'Accent 2',
  accent_3: 'Accent 3',
  accent_4: 'Accent 4',
  accent_5: 'Accent 5',
  accent_6: 'Accent 6',
};

export function createDefaultProjectColorPalette(): ProjectColorPalette {
  return {
    primary: 'rgba(6,78,59,1)',
    secondary: 'rgba(15,118,110,1)',
    tertiary: 'rgba(8,145,178,1)',
    accent_1: 'rgba(249,115,22,1)',
    accent_2: 'rgba(245,158,11,1)',
    accent_3: 'rgba(132,204,22,1)',
    accent_4: 'rgba(59,130,246,1)',
    accent_5: 'rgba(168,85,247,1)',
    accent_6: 'rgba(236,72,153,1)',
  };
}

export function listProjectPaletteOptions(project: Pick<EditorProject, 'settings'>) {
  return PROJECT_PALETTE_ORDER.map((id) => ({
    id,
    label: PROJECT_PALETTE_LABELS[id],
    value: project.settings.colorPalette[id],
  }));
}
