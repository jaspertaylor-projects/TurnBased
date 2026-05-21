import { generateId } from '@turnbased/shared-utils';

import type {
  EditorProject,
  ProjectAcknowledgedWarningId,
  ProjectAdvancedHook,
  ProjectAdvancedHookType,
  ProjectCapabilities,
  ProjectCapabilityMode,
  ProjectExperimentalOverrideId,
} from './types';

interface ProjectWarningDefinition {
  id: ProjectAcknowledgedWarningId;
  title: string;
  description: string;
  citation: string;
}

interface AdvancedHookTemplateDefinition {
  type: ProjectAdvancedHookType;
  label: string;
  description: string;
  citation: string;
}

interface ExperimentalOverrideDefinition {
  id: ProjectExperimentalOverrideId;
  label: string;
  risk: 'medium' | 'high';
  description: string;
}

interface ProjectModeSupportSummary {
  supportLabel: string;
  supportDescription: string;
  marketplaceEligible: boolean;
  aiGuidance: string;
  reducedGuarantees: string[];
  citations: string[];
}

const MODE_ORDER: ProjectCapabilityMode[] = ['standard', 'advanced', 'experimental'];

export const projectWarningCatalog: Record<ProjectAcknowledgedWarningId, ProjectWarningDefinition> = {
  'extension-boundaries': {
    id: 'extension-boundaries',
    title: 'Stay inside documented extension hooks',
    description: 'Advanced mode supports custom predicates, target generators, scoring helpers, derived views, AI hints, and affordance policies only.',
    citation: 'docs/future/engine/extension-points.md',
  },
  'browser-only-runtime': {
    id: 'browser-only-runtime',
    title: 'Custom behavior must remain browser-safe',
    description: 'Creators still cannot rely on arbitrary backend execution or side effects. Hook code must stay deterministic and serializable.',
    citation: 'docs/future/engine/experimental-engine-override.md',
  },
  'ai-degradation': {
    id: 'ai-degradation',
    title: 'AI assistance quality may degrade',
    description: 'Agents may not understand custom engine-adjacent behavior as reliably once overrides are enabled.',
    citation: 'docs/future/engine/experimental-engine-override.md',
  },
  'no-migration-guarantee': {
    id: 'no-migration-guarantee',
    title: 'Future engine upgrades may break overrides',
    description: 'Experimental projects do not receive compatibility or migration guarantees across engine changes.',
    citation: 'docs/future/engine/experimental-engine-override.md',
  },
  'marketplace-restriction': {
    id: 'marketplace-restriction',
    title: 'Marketplace publishing is restricted for experimental projects',
    description: 'Experimental projects can create release snapshots, but marketplace publication is disabled until override review lands.',
    citation: 'docs/future/engine/experimental-engine-override.md',
  },
  'irreversible-upgrade': {
    id: 'irreversible-upgrade',
    title: 'Experimental activation is permanent',
    description: 'Once a project is marked experimental it stays flagged as experimental so support and review tools can reason about it.',
    citation: 'docs/future/adr/0003-engine-override-policy.md',
  },
};

export const advancedHookCatalog: readonly AdvancedHookTemplateDefinition[] = [
  {
    type: 'predicate',
    label: 'Custom Predicate',
    description: 'Evaluate special rule conditions without touching core reducer behavior.',
    citation: 'docs/future/engine/extension-points.md',
  },
  {
    type: 'target-generator',
    label: 'Target Generator',
    description: 'Produce dynamic lists of legal targets for advanced actions.',
    citation: 'docs/future/engine/extension-points.md',
  },
  {
    type: 'scoring-helper',
    label: 'Scoring Helper',
    description: 'Compute custom scores or derived point totals.',
    citation: 'docs/future/engine/extension-points.md',
  },
  {
    type: 'derived-view',
    label: 'Derived View',
    description: 'Expose read-only computed state for players or spectators.',
    citation: 'docs/future/engine/extension-points.md',
  },
  {
    type: 'ai-hint',
    label: 'AI Hint',
    description: 'Add AI-facing hints while keeping AI input inside projected state boundaries.',
    citation: 'docs/future/engine/extension-points.md',
  },
  {
    type: 'affordance-policy',
    label: 'Affordance Policy',
    description: 'Adjust highlight and selection policy from the legal move tree instead of custom click logic.',
    citation: 'docs/future/engine/extension-points.md',
  },
] as const;

export const experimentalOverrideCatalog: readonly ExperimentalOverrideDefinition[] = [
  {
    id: 'custom-trigger-order',
    label: 'Trigger Resolution Order',
    risk: 'medium',
    description: 'Customize how simultaneous triggers are ordered and resolved.',
  },
  {
    id: 'priority-rules',
    label: 'Priority Rules',
    risk: 'medium',
    description: 'Change response window and reaction priority behavior.',
  },
  {
    id: 'visibility-projection',
    label: 'Visibility Projection',
    risk: 'high',
    description: 'Override how player-visible state is projected.',
  },
  {
    id: 'reducer-middleware',
    label: 'Reducer Middleware',
    risk: 'high',
    description: 'Inject custom logic into the action pipeline before or after core reduction.',
  },
  {
    id: 'turn-flow',
    label: 'Turn Flow',
    risk: 'medium',
    description: 'Modify turn advancement and phase progression rules.',
  },
  {
    id: 'entity-lifecycle',
    label: 'Entity Lifecycle',
    risk: 'medium',
    description: 'Customize creation, destruction, or promotion behavior for engine entities.',
  },
] as const;

function now(): string {
  return new Date().toISOString();
}

function uniqueValues<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function modeIndex(mode: ProjectCapabilityMode): number {
  return MODE_ORDER.indexOf(mode);
}

function toTemplateName(hookType: ProjectAdvancedHookType, index: number): string {
  const base = hookType.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '');
  return `${base}${index}`;
}

function toHookFilePath(hookType: ProjectAdvancedHookType, index: number): string {
  return `extensions/${hookType}-${index}.ts`;
}

function createHookTemplate(hookType: ProjectAdvancedHookType, name: string): string {
  switch (hookType) {
    case 'predicate':
      return `export const ${name} = {\n  name: '${name}',\n  evaluate: (context) => {\n    // Inspect context.state and context.args.\n    return false;\n  },\n};\n`;
    case 'target-generator':
      return `export const ${name} = {\n  name: '${name}',\n  generateTargets: (context) => {\n    // Return entity or zone ids that satisfy this custom target rule.\n    return [];\n  },\n};\n`;
    case 'scoring-helper':
      return `export const ${name} = {\n  name: '${name}',\n  computeScore: (context) => {\n    // Return a numeric score contribution for the current player.\n    return 0;\n  },\n};\n`;
    case 'derived-view':
      return `export const ${name} = {\n  name: '${name}',\n  compute: (context) => {\n    // Return read-only derived data for UI or player helpers.\n    return {};\n  },\n};\n`;
    case 'ai-hint':
      return `export const ${name} = {\n  name: '${name}',\n  generateHints: (context) => {\n    // Return compact AI hints derived from projected state.\n    return {};\n  },\n};\n`;
    case 'affordance-policy':
      return `export const ${name} = {\n  name: '${name}',\n  computeAffordances: (context) => {\n    // Return affordance metadata that still respects the legal move tree.\n    return {};\n  },\n};\n`;
    default:
      return '';
  }
}

export function createDefaultProjectCapabilities(
  overrides: Partial<ProjectCapabilities> = {},
): ProjectCapabilities {
  const acknowledgedWarnings = uniqueValues(overrides.acknowledgedWarnings ?? []);
  const enabledOverrides = uniqueValues(overrides.enabledOverrides ?? []);

  return {
    mode: 'standard',
    activatedAt: null,
    acknowledgedWarnings,
    enabledOverrides,
    ...overrides,
  };
}

export function normalizeProjectCapabilities(
  capabilities: Partial<ProjectCapabilities> | null | undefined,
): ProjectCapabilities {
  return createDefaultProjectCapabilities({
    mode: capabilities?.mode ?? 'standard',
    activatedAt: capabilities?.activatedAt ?? null,
    acknowledgedWarnings: capabilities?.acknowledgedWarnings ?? [],
    enabledOverrides: capabilities?.enabledOverrides ?? [],
  });
}

export function getRequiredWarningsForMode(mode: ProjectCapabilityMode): ProjectAcknowledgedWarningId[] {
  if (mode === 'advanced') {
    return ['extension-boundaries', 'browser-only-runtime'];
  }

  if (mode === 'experimental') {
    return [
      'extension-boundaries',
      'browser-only-runtime',
      'ai-degradation',
      'no-migration-guarantee',
      'marketplace-restriction',
      'irreversible-upgrade',
    ];
  }

  return [];
}

export function getProjectModeLabel(mode: ProjectCapabilityMode): string {
  switch (mode) {
    case 'advanced':
      return 'Advanced Extension Mode';
    case 'experimental':
      return 'Experimental Override Mode';
    default:
      return 'Standard Mode';
  }
}

export function getProjectModeSupportSummary(project: EditorProject): ProjectModeSupportSummary {
  const mode = project.manifest.capabilities.mode;

  if (mode === 'advanced') {
    return {
      supportLabel: 'Supported within documented extension boundaries',
      supportDescription: 'Use documented hooks for custom predicates, scoring helpers, target generation, derived views, AI hints, and affordance policies.',
      marketplaceEligible: true,
      aiGuidance: 'AI should prefer documented extension hooks and avoid suggesting engine overrides.',
      reducedGuarantees: [
        'Extensions must stay inside documented hook contracts.',
        'No reducer, turn flow, or visibility overrides are supported here.',
      ],
      citations: ['docs/future/engine/extension-points.md', 'docs/future/adr/0003-engine-override-policy.md'],
    };
  }

  if (mode === 'experimental') {
    return {
      supportLabel: 'Reduced guarantees',
      supportDescription: 'Engine-adjacent overrides are allowed, but support, AI reliability, and compatibility guarantees are intentionally narrower.',
      marketplaceEligible: false,
      aiGuidance: 'AI must warn about override risk, reduced guarantees, and marketplace restrictions before proposing engine-adjacent changes.',
      reducedGuarantees: [
        'AI assistance quality may degrade.',
        'Future engine updates may break custom overrides.',
        'Marketplace publishing is disabled for experimental projects right now.',
        'Save compatibility across engine upgrades is not guaranteed.',
      ],
      citations: ['docs/future/engine/experimental-engine-override.md', 'docs/future/adr/0003-engine-override-policy.md'],
    };
  }

  return {
    supportLabel: 'Full platform support',
    supportDescription: 'Recommended for most creators. Use built-in components, declarative rules, and standard engine policies.',
    marketplaceEligible: true,
    aiGuidance: 'AI can assume standard engine semantics and should prefer built-in components and declarative rules.',
    reducedGuarantees: [],
    citations: ['docs/future/adr/0003-engine-override-policy.md'],
  };
}

export function canUpgradeProjectMode(
  currentMode: ProjectCapabilityMode,
  nextMode: ProjectCapabilityMode,
): boolean {
  if (currentMode === 'experimental' && nextMode !== 'experimental') {
    return false;
  }

  return modeIndex(nextMode) >= modeIndex(currentMode);
}

export function setProjectMode(
  project: EditorProject,
  nextMode: ProjectCapabilityMode,
  options: {
    acknowledgedWarnings?: ProjectAcknowledgedWarningId[];
    enabledOverrides?: ProjectExperimentalOverrideId[];
  } = {},
): EditorProject {
  const currentCapabilities = normalizeProjectCapabilities(project.manifest.capabilities);
  if (!canUpgradeProjectMode(currentCapabilities.mode, nextMode)) {
    return project;
  }

  const nextWarnings = uniqueValues([
    ...currentCapabilities.acknowledgedWarnings,
    ...(options.acknowledgedWarnings ?? []),
  ]);
  const nextOverrides = nextMode === 'experimental'
    ? uniqueValues(options.enabledOverrides ?? currentCapabilities.enabledOverrides)
    : [];

  return {
    ...project,
    updatedAt: now(),
    manifest: {
      ...project.manifest,
      capabilities: normalizeProjectCapabilities({
        mode: nextMode,
        activatedAt: currentCapabilities.mode === nextMode ? currentCapabilities.activatedAt : now(),
        acknowledgedWarnings: nextWarnings,
        enabledOverrides: nextOverrides,
      }),
    },
  };
}

export function createProjectAdvancedHookDraft(
  hookType: ProjectAdvancedHookType,
  existingCount: number,
): ProjectAdvancedHook {
  const hookIndex = existingCount + 1;
  const hookName = toTemplateName(hookType, hookIndex);
  const timestamp = now();

  return {
    id: generateId('hook'),
    hookType,
    name: hookName,
    description: '',
    filePath: toHookFilePath(hookType, hookIndex),
    status: 'draft',
    code: createHookTemplate(hookType, hookName),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function addProjectAdvancedHook(
  project: EditorProject,
  hookType: ProjectAdvancedHookType,
): { project: EditorProject; hook: ProjectAdvancedHook } {
  const hook = createProjectAdvancedHookDraft(hookType, project.manifest.customHooks.length);

  return {
    hook,
    project: {
      ...project,
      updatedAt: now(),
      manifest: {
        ...project.manifest,
        customHooks: [...project.manifest.customHooks, hook],
      },
    },
  };
}

export function updateProjectAdvancedHook(
  project: EditorProject,
  hookId: string,
  updater: (hook: ProjectAdvancedHook) => ProjectAdvancedHook,
): EditorProject {
  return {
    ...project,
    updatedAt: now(),
    manifest: {
      ...project.manifest,
      customHooks: project.manifest.customHooks.map((hook) => {
        if (hook.id !== hookId) {
          return hook;
        }

        return {
          ...updater(hook),
          updatedAt: now(),
        };
      }),
    },
  };
}

export function removeProjectAdvancedHook(project: EditorProject, hookId: string): EditorProject {
  return {
    ...project,
    updatedAt: now(),
    manifest: {
      ...project.manifest,
      customHooks: project.manifest.customHooks.filter((hook) => hook.id !== hookId),
    },
  };
}
