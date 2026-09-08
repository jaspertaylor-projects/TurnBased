import { canonicalSerialize, generateId, hashValue } from '@turnbased/shared-utils';
import { listProjectDesignSets } from './componentStudio/model';

import { getProjectModeLabel, getProjectModeSupportSummary } from './capabilities';
import { pinProjectToCurrentVersions } from './manifest';
import type { PreviewRuntime } from './types';
import type { EditorProject } from './types';

const BUILD_STORAGE_KEY = 'turnbased.creator.builds';

export type BuildKind = 'preview' | 'release';
export type BuildWarningSeverity = 'info' | 'warning' | 'blocking';

export interface BuildCompatibilityWarning {
  code: string;
  severity: BuildWarningSeverity;
  message: string;
}

export interface ProjectBuildManifest {
  schemaVersion: number;
  projectId: string;
  projectName: string;
  buildId: string;
  buildKind: BuildKind;
  commitSha: string;
  createdAt: string;
  versionPins: EditorProject['manifest']['versionPins'];
  seats: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  runtime: {
    zoneCount: number;
    destinationZoneCount: number;
    scoringZoneCount: number;
    rootComponentCount: number;
  };
  capabilities: {
    mode: EditorProject['manifest']['capabilities']['mode'];
    customHookCount: number;
    enabledOverrides: EditorProject['manifest']['capabilities']['enabledOverrides'];
    marketplaceEligible: boolean;
  };
  projectFingerprint: string;
}

export interface LocalBuildRecord {
  id: string;
  projectId: string;
  projectName: string;
  kind: BuildKind;
  commitSha: string;
  createdAt: string;
  publishedAt: string | null;
  notes: string;
  releaseTitle: string | null;
  releaseDescription: string | null;
  manifest: ProjectBuildManifest;
  compatibilityWarnings: BuildCompatibilityWarning[];
  files: Record<string, string>;
  projectSnapshot: EditorProject;
}

interface StoredBuildRecords {
  builds: LocalBuildRecord[];
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function readStoredBuilds(): LocalBuildRecord[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(BUILD_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as StoredBuildRecords;
    return parsed.builds ?? [];
  } catch {
    return [];
  }
}

function writeStoredBuilds(builds: LocalBuildRecord[]): void {
  const storage = getStorage();
  storage?.setItem(
    BUILD_STORAGE_KEY,
    JSON.stringify({
      builds,
    } satisfies StoredBuildRecords),
  );
}

function toShortCommit(hash: number): string {
  return hash.toString(16).padStart(8, '0').slice(0, 8);
}

function escapeInlineJson(value: string): string {
  return value.replace(/</g, '\\u003c');
}

export function createCompatibilityWarnings(project: EditorProject, runtime: PreviewRuntime): BuildCompatibilityWarning[] {
  const warnings: BuildCompatibilityWarning[] = [];

  for (const requirement of runtime.requirements) {
    warnings.push({
      code: 'runtime_requirement',
      severity: 'blocking',
      message: requirement,
    });
  }

  for (const issue of runtime.validation.issues) {
    warnings.push({
      code: issue.code,
      severity: 'blocking',
      message: issue.message,
    });
  }

  if (project.seats.length < 2) {
    warnings.push({
      code: 'seat_count_low',
      severity: 'warning',
      message: 'At least two seats are recommended before publishing a multiplayer snapshot.',
    });
  }

  if (runtime.destinationZoneIds.length === 0) {
    warnings.push({
      code: 'no_destinations',
      severity: 'warning',
      message: 'The current rules do not expose any legal destination zones, so players may get stuck quickly.',
    });
  }

  if (project.description.trim().length === 0) {
    warnings.push({
      code: 'missing_description',
      severity: 'info',
      message: 'Add a project description so published builds explain the prototype clearly.',
    });
  }

  if (project.manifest.capabilities.mode === 'advanced' && project.manifest.customHooks.length > 0) {
    warnings.push({
      code: 'advanced_hooks_present',
      severity: 'info',
      message: `Advanced mode is active with ${project.manifest.customHooks.length} custom hook stub${project.manifest.customHooks.length === 1 ? '' : 's'}. Keep hook behavior inside documented extension points.`,
    });
  }

  if (project.manifest.capabilities.mode === 'experimental') {
    warnings.push({
      code: 'experimental_support_scope',
      severity: 'warning',
      message: 'Experimental override mode reduces AI assistance quality and forward-compatibility guarantees.',
    });
    warnings.push({
      code: 'experimental_marketplace_restriction',
      severity: 'warning',
      message: 'Experimental projects can create release snapshots, but marketplace publishing is disabled for them right now.',
    });

    if (project.manifest.capabilities.enabledOverrides.length === 0) {
      warnings.push({
        code: 'experimental_override_missing',
        severity: 'blocking',
        message: 'Experimental mode requires at least one named override surface so support tooling can reason about the project.',
      });
    }
  }

  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.message}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function createWorkspaceFiles(project: EditorProject, runtime: PreviewRuntime): Record<string, string> {
  const manifestFile = canonicalSerialize(project.manifest);
  const projectFile = canonicalSerialize(project);
  const briefFile = canonicalSerialize(project.brief);
  const viewsFile = canonicalSerialize(project.views);
  const appLayoutFile = canonicalSerialize(project.appLayout);
  const support = getProjectModeSupportSummary(project);
  const capabilitiesFile = canonicalSerialize({
    phase: project.phase,
    mode: project.manifest.capabilities.mode,
    label: getProjectModeLabel(project.manifest.capabilities.mode),
    acknowledgedWarnings: project.manifest.capabilities.acknowledgedWarnings,
    enabledOverrides: project.manifest.capabilities.enabledOverrides,
    supportLabel: support.supportLabel,
    marketplaceEligible: support.marketplaceEligible,
  });
  const extensionsFile = canonicalSerialize(project.manifest.customHooks);
  const runtimeSummary = canonicalSerialize({
    validation: runtime.validation,
    requirements: runtime.requirements,
    legalMoveDefinitionIds: runtime.legalMoveDefinitions.map((definition) => definition.id),
    destinationZoneIds: runtime.destinationZoneIds,
    scoringZoneIds: runtime.scoringZoneIds,
  });
  const readme = [
    `# ${project.name}`,
    '',
    project.description || 'No description provided.',
    '',
    '## Project Mode',
    getProjectModeLabel(project.manifest.capabilities.mode),
    '',
    support.supportDescription,
    '',
    '## Seats',
    ...project.seats.map((seat) => `- ${seat.name} (${seat.id}) · ${seat.resources.startingBlocks} ${seat.resources.resourceLabel.toLowerCase()} · icon ${seat.identity.iconKey}`),
    '',
    '## Views',
    ...project.views.items.map((view) => `- ${view.label} (${view.kind}${view.linkedSeatId ? ` -> ${view.linkedSeatId}` : ''})`),
    '',
    '## Rules',
    project.rules.chapters.map((chapter) => `### ${chapter.title}\n\n${chapter.body}`).join('\n\n') || project.rules.rulesText,
  ].join('\n');

  const hookFiles = Object.fromEntries(project.manifest.customHooks.map((hook) => [hook.filePath, hook.code]));

  return {
    'turnbased.project.json': projectFile,
    ...(project.cardStudio ? { 'design/card-studio.json': canonicalSerialize(project.cardStudio) } : {}),
    'design/components.json': canonicalSerialize(listProjectDesignSets(project)),
    ...(project.playtestLab ? { 'playtest/lab.json': canonicalSerialize(project.playtestLab) } : {}),
    'turnbased.brief.json': briefFile,
    'turnbased.views.json': viewsFile,
    'turnbased.app-layout.json': appLayoutFile,
    'turnbased.manifest.json': manifestFile,
    'turnbased.capabilities.json': capabilitiesFile,
    'turnbased.extensions.json': extensionsFile,
    'turnbased.runtime.json': runtimeSummary,
    'README.md': readme,
    ...hookFiles,
  };
}

function createBuildFiles(build: Omit<LocalBuildRecord, 'files'>): Record<string, string> {
  const manifestJson = canonicalSerialize(build.manifest);
  const projectJson = canonicalSerialize(build.projectSnapshot);
  const warningsJson = canonicalSerialize(build.compatibilityWarnings);
  const capabilitiesJson = canonicalSerialize({
    mode: build.manifest.capabilities.mode,
    enabledOverrides: build.manifest.capabilities.enabledOverrides,
    marketplaceEligible: build.manifest.capabilities.marketplaceEligible,
    customHookCount: build.manifest.capabilities.customHookCount,
  });
  const extensionsJson = canonicalSerialize(build.projectSnapshot.manifest.customHooks);
  const header = escapeInlineJson(manifestJson);
  const warningsInline = escapeInlineJson(warningsJson);
  const capabilityInline = escapeInlineJson(capabilitiesJson);
  const hookFiles = Object.fromEntries(build.projectSnapshot.manifest.customHooks.map((hook) => [hook.filePath, hook.code]));

  return {
    'manifest.json': manifestJson,
    'project-snapshot.json': projectJson,
    'compatibility-warnings.json': warningsJson,
    'capabilities.json': capabilitiesJson,
    'extensions.json': extensionsJson,
    'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${build.projectName}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      background: #f4fbf6;
      color: #083344;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top, rgba(16, 185, 129, 0.18), transparent 32rem),
        linear-gradient(180deg, #f4fbf6, #ecfeff);
      display: grid;
      place-items: center;
      padding: 2rem;
      box-sizing: border-box;
    }
    main {
      width: min(720px, 100%);
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(8, 51, 68, 0.08);
      border-radius: 28px;
      box-shadow: 0 24px 64px rgba(8, 51, 68, 0.12);
      padding: 2rem;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.12);
      color: #065f46;
      margin: 0 0.4rem 0.4rem 0;
      font-size: 0.85rem;
    }
    pre {
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 18px;
      padding: 1rem;
      overflow: auto;
      font-size: 0.82rem;
    }
  </style>
</head>
<body>
  <main>
    <p>Immutable TurnBased snapshot</p>
    <h1>${build.releaseTitle ?? build.projectName}</h1>
    <p>${build.releaseDescription ?? build.projectSnapshot.description}</p>
    <div id="summary"></div>
    <h2>Build manifest</h2>
    <pre id="manifest"></pre>
    <h2>Compatibility warnings</h2>
    <pre id="warnings"></pre>
  </main>
  <script type="application/json" id="turnbased-manifest">${header}</script>
  <script type="application/json" id="turnbased-warnings">${warningsInline}</script>
  <script type="application/json" id="turnbased-capabilities">${capabilityInline}</script>
  <script>
    const manifest = JSON.parse(document.getElementById('turnbased-manifest').textContent);
    const warnings = JSON.parse(document.getElementById('turnbased-warnings').textContent);
    const capabilities = JSON.parse(document.getElementById('turnbased-capabilities').textContent);
    document.getElementById('manifest').textContent = JSON.stringify(manifest, null, 2);
    document.getElementById('warnings').textContent = JSON.stringify(warnings, null, 2);
    document.getElementById('summary').innerHTML = [
      '<span class="pill">' + manifest.buildKind + ' build</span>',
      '<span class="pill">commit ' + manifest.commitSha + '</span>',
      '<span class="pill">' + capabilities.mode + ' mode</span>',
      '<span class="pill">' + manifest.runtime.destinationZoneCount + ' playable destinations</span>'
    ].join('');
  </script>
</body>
</html>`,
    ...hookFiles,
  };
}

export function createLocalBuildRecord(
  project: EditorProject,
  runtime: PreviewRuntime,
  options: {
    kind: BuildKind;
    notes?: string;
    releaseTitle?: string;
    releaseDescription?: string;
  },
): { project: EditorProject; build: LocalBuildRecord } {
  const buildId = generateId('build');
  const pinnedProject = pinProjectToCurrentVersions(project, {
    buildId,
    publishedBuildId: options.kind === 'release' ? buildId : undefined,
  });
  const modeSupport = getProjectModeSupportSummary(pinnedProject);
  const createdAt = new Date().toISOString();
  const commitSha = toShortCommit(hashValue({
    projectId: pinnedProject.id,
    createdAt,
    kind: options.kind,
    fingerprint: hashValue(pinnedProject),
  }));
  const compatibilityWarnings = createCompatibilityWarnings(pinnedProject, runtime);
  const manifest: ProjectBuildManifest = {
    schemaVersion: 1,
    projectId: pinnedProject.id,
    projectName: pinnedProject.name,
    buildId,
    buildKind: options.kind,
    commitSha,
    createdAt,
    versionPins: pinnedProject.manifest.versionPins,
    seats: pinnedProject.seats.map((seat) => ({
      id: seat.id,
      name: seat.name,
      color: seat.color,
    })),
    runtime: {
      zoneCount: Object.keys(runtime.initialState.zones).length,
      destinationZoneCount: runtime.destinationZoneIds.length,
      scoringZoneCount: runtime.scoringZoneIds.length,
      rootComponentCount: pinnedProject.rootInstanceIds.length,
    },
    capabilities: {
      mode: pinnedProject.manifest.capabilities.mode,
      customHookCount: pinnedProject.manifest.customHooks.length,
      enabledOverrides: pinnedProject.manifest.capabilities.enabledOverrides,
      marketplaceEligible: modeSupport.marketplaceEligible,
    },
    projectFingerprint: toShortCommit(hashValue(pinnedProject)),
  };
  const baseBuild: Omit<LocalBuildRecord, 'files'> = {
    id: buildId,
    projectId: pinnedProject.id,
    projectName: pinnedProject.name,
    kind: options.kind,
    commitSha,
    createdAt,
    publishedAt: options.kind === 'release' ? createdAt : null,
    notes: options.notes?.trim() ?? '',
    releaseTitle: options.releaseTitle?.trim() || null,
    releaseDescription: options.releaseDescription?.trim() || null,
    manifest,
    compatibilityWarnings,
    projectSnapshot: pinnedProject,
  };

  return {
    project: pinnedProject,
    build: {
      ...baseBuild,
      files: createBuildFiles(baseBuild),
    },
  };
}

export function saveLocalBuildRecord(build: LocalBuildRecord): void {
  const builds = readStoredBuilds().filter((entry) => entry.id !== build.id);
  builds.unshift(build);
  writeStoredBuilds(builds);
}

export function loadLocalBuildRecord(buildId: string): LocalBuildRecord | null {
  return readStoredBuilds().find((build) => build.id === buildId) ?? null;
}

export function listProjectBuilds(projectId: string): LocalBuildRecord[] {
  return readStoredBuilds()
    .filter((build) => build.projectId === projectId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listAllBuilds(): LocalBuildRecord[] {
  return readStoredBuilds()
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getLatestBuild(projectId: string, kind?: BuildKind): LocalBuildRecord | null {
  return listProjectBuilds(projectId).find((build) => !kind || build.kind === kind) ?? null;
}
