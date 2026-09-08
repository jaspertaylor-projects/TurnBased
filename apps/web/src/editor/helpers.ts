import type { ComponentPropertyDefinition } from '@turnbased/engine-components';

import type { EditorProject } from './types';

export function readProjectIdFromHash(): string | null {
  const hash = window.location.hash.split('?')[0];
  const parts = hash.split('/');
  return parts.length > 2 ? parts[2] ?? null : null;
}

export function parsePropertyValue(definition: ComponentPropertyDefinition, rawValue: string): string | number | boolean | string[] {
  if (definition.kind === 'number') {
    return rawValue === '' ? 0 : Number(rawValue);
  }

  if (definition.kind === 'boolean') {
    return rawValue === 'true';
  }

  if (definition.kind === 'string_array') {
    return rawValue.split(',').map((value) => value.trim()).filter(Boolean);
  }

  return rawValue;
}

export function getOwnerColor(project: EditorProject, ownerId: string | null | undefined): string {
  return project.seats.find((seat) => seat.id === ownerId)?.color ?? '#94a3b8';
}

export function createPreviewSignature(project: EditorProject): string {
  return JSON.stringify({
    rootInstanceIds: project.rootInstanceIds,
    instances: project.instances,
    rules: project.rules,
    seats: project.seats,
  });
}
