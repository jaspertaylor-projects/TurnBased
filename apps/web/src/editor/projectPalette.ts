import type { EditorProject, ProjectColorPalette, ProjectPaletteColorId } from './types';

export const PROJECT_PALETTE_REFERENCE_PREFIX = 'palette:';

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

export function createProjectPaletteReference(id: ProjectPaletteColorId): string {
  return `${PROJECT_PALETTE_REFERENCE_PREFIX}${id}`;
}

export function readProjectPaletteReference(value: string | null | undefined): ProjectPaletteColorId | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith(PROJECT_PALETTE_REFERENCE_PREFIX)) {
    return null;
  }

  const candidate = trimmed.slice(PROJECT_PALETTE_REFERENCE_PREFIX.length) as ProjectPaletteColorId;
  return PROJECT_PALETTE_ORDER.includes(candidate) ? candidate : null;
}

export function resolveProjectPaletteColorValue(
  palette: ProjectColorPalette,
  value: string | null | undefined,
  visited = new Set<ProjectPaletteColorId>(),
): string | null {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const reference = readProjectPaletteReference(value);
  if (!reference) {
    return value;
  }

  if (visited.has(reference)) {
    return createDefaultProjectColorPalette()[reference];
  }

  visited.add(reference);
  return resolveProjectPaletteColorValue(
    palette,
    palette[reference] ?? createDefaultProjectColorPalette()[reference],
    visited,
  );
}

export function listProjectPaletteOptions(project: Pick<EditorProject, 'settings'>) {
  return PROJECT_PALETTE_ORDER.map((id) => ({
    id,
    label: PROJECT_PALETTE_LABELS[id],
    value: resolveProjectPaletteColorValue(project.settings.colorPalette, project.settings.colorPalette[id])
      ?? createDefaultProjectColorPalette()[id],
    referenceValue: createProjectPaletteReference(id),
  }));
}
