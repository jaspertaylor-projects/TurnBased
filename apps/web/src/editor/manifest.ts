import engineAiPackage from '../../../../packages/engine-ai/package.json';
import engineComponentsPackage from '../../../../packages/engine-components/package.json';
import engineCorePackage from '../../../../packages/engine-core/package.json';
import engineUiPackage from '../../../../packages/engine-ui/package.json';

import { normalizeProjectCapabilities } from './capabilities';
import type { EditorProject, ProjectManifest, ProjectVersionPins } from './types';

const PROJECT_MANIFEST_SCHEMA_VERSION = 1;

function now(): string {
  return new Date().toISOString();
}

export const currentProjectVersionPins: ProjectVersionPins = Object.freeze({
  engineCore: engineCorePackage.version,
  engineComponents: engineComponentsPackage.version,
  engineUi: engineUiPackage.version,
  engineAi: engineAiPackage.version,
});

export function createDefaultProjectManifest(overrides: Partial<ProjectManifest> = {}): ProjectManifest {
  return {
    schemaVersion: PROJECT_MANIFEST_SCHEMA_VERSION,
    projectKind: 'engine_first',
    versionPins: { ...currentProjectVersionPins },
    lastPinnedAt: now(),
    remoteProjectId: null,
    lastBuildId: null,
    lastPublishedBuildId: null,
    capabilities: normalizeProjectCapabilities(undefined),
    customHooks: [],
    ...overrides,
  };
}

export function normalizeProjectManifest(manifest: Partial<ProjectManifest> | null | undefined): ProjectManifest {
  return createDefaultProjectManifest({
    schemaVersion: typeof manifest?.schemaVersion === 'number' ? manifest.schemaVersion : PROJECT_MANIFEST_SCHEMA_VERSION,
    projectKind: manifest?.projectKind === 'engine_first' ? manifest.projectKind : 'engine_first',
    versionPins: {
      ...currentProjectVersionPins,
      ...(manifest?.versionPins ?? {}),
    },
    lastPinnedAt: manifest?.lastPinnedAt ?? now(),
    remoteProjectId: manifest?.remoteProjectId ?? null,
    lastBuildId: manifest?.lastBuildId ?? null,
    lastPublishedBuildId: manifest?.lastPublishedBuildId ?? null,
    capabilities: normalizeProjectCapabilities(manifest?.capabilities),
    customHooks: manifest?.customHooks ?? [],
  });
}

export function ensureProjectManifest(project: Omit<EditorProject, 'manifest'> & { manifest?: Partial<ProjectManifest> | null }): EditorProject {
  return {
    ...project,
    manifest: normalizeProjectManifest(project.manifest),
  };
}

export function pinProjectToCurrentVersions(
  project: EditorProject,
  options: {
    buildId?: string | null;
    publishedBuildId?: string | null;
  } = {},
): EditorProject {
  return {
    ...project,
    manifest: {
      ...normalizeProjectManifest(project.manifest),
      versionPins: { ...currentProjectVersionPins },
      lastPinnedAt: now(),
      lastBuildId: options.buildId ?? project.manifest.lastBuildId,
      lastPublishedBuildId: options.publishedBuildId ?? project.manifest.lastPublishedBuildId,
    },
  };
}
