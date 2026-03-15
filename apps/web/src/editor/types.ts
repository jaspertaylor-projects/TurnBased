import type {
  AIRulesSummarySource,
} from '@turnbased/engine-ai';
import type {
  GameDefinition,
  GameState,
  LegalMoveDefinition,
  ZoneId,
} from '@turnbased/engine-core';
import type {
  ComponentInstanceModel,
  ComponentValidationResult,
} from '@turnbased/engine-components';

export type PrototypeMode = 'territory';
export type ProjectCapabilityMode = 'standard' | 'advanced' | 'experimental';
export type ProjectAcknowledgedWarningId =
  | 'extension-boundaries'
  | 'browser-only-runtime'
  | 'ai-degradation'
  | 'no-migration-guarantee'
  | 'marketplace-restriction'
  | 'irreversible-upgrade';
export type ProjectAdvancedHookType =
  | 'predicate'
  | 'target-generator'
  | 'scoring-helper'
  | 'derived-view'
  | 'ai-hint'
  | 'affordance-policy';
export type ProjectAdvancedHookStatus = 'draft' | 'ready';
export type ProjectExperimentalOverrideId =
  | 'custom-trigger-order'
  | 'priority-rules'
  | 'visibility-projection'
  | 'reducer-middleware'
  | 'turn-flow'
  | 'entity-lifecycle';

export interface ProjectVersionPins {
  engineCore: string;
  engineComponents: string;
  engineUi: string;
  engineAi: string;
}

export interface ProjectCapabilities {
  mode: ProjectCapabilityMode;
  activatedAt: string | null;
  acknowledgedWarnings: ProjectAcknowledgedWarningId[];
  enabledOverrides: ProjectExperimentalOverrideId[];
}

export interface ProjectAdvancedHook {
  id: string;
  hookType: ProjectAdvancedHookType;
  name: string;
  description: string;
  filePath: string;
  status: ProjectAdvancedHookStatus;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectManifest {
  schemaVersion: number;
  projectKind: 'engine_first';
  versionPins: ProjectVersionPins;
  lastPinnedAt: string;
  remoteProjectId: string | null;
  lastBuildId: string | null;
  lastPublishedBuildId: string | null;
  capabilities: ProjectCapabilities;
  customHooks: ProjectAdvancedHook[];
}

export interface EditorSeat {
  id: string;
  name: string;
  color: string;
}

export interface EditorRuleConfig {
  prototypeMode: PrototypeMode;
  phases: string[];
  targetScore: number;
  maxTurns: number;
  rulesText: string;
  designerNotes: string;
}

export interface EditorProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  manifest: ProjectManifest;
  seats: EditorSeat[];
  rootInstanceIds: string[];
  instances: Record<string, ComponentInstanceModel>;
  rules: EditorRuleConfig;
}

export interface StoredEditorProjects {
  projects: EditorProject[];
}

export interface PreviewRuntime {
  initialState: GameState;
  gameDefinition: Pick<GameDefinition, 'name' | 'description' | 'priorityPolicy' | 'phases' | 'rulesText'>;
  legalMoveDefinitions: LegalMoveDefinition[];
  summarySource: AIRulesSummarySource;
  validation: ComponentValidationResult;
  requirements: string[];
  zoneIdsByType: Record<string, ZoneId[]>;
  scoringZoneIds: ZoneId[];
  destinationZoneIds: ZoneId[];
}
