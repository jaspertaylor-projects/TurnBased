import type { CardStudioState } from './cardStudio/types';
import type { PlaytestLabState } from './playtest/types';
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
import type { ProjectAIModelSettings } from './aiModelCatalog';

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
  identity: {
    badgeLabel: string;
    iconKey: string;
    customAvatarUrl: string | null;
  };
  resources: {
    startingBlocks: number;
    resourceLabel: string;
  };
}

export type EditorProjectPhase = 'brief' | 'building' | 'ready';

export interface RulesBuilderBrief {
  name: string;
  minPlayers: number;
  maxPlayers: number;
  hasDistinctSoloMode: boolean;
  isCampaignGame: boolean;
  theme: string;
  artStyle: string;
  /* Marketing copy that shows on the side of a real board-game box. Used in
     the Stats section info panel AND fed into AI grounding so generated
     prose reflects the intended audience and pacing. */
  minAge: number;
  playtimeMinMinutes: number;
  playtimeMaxMinutes: number;
}

export type RulesChapterKind = 'standard' | 'components';

export interface RulesChapter {
  id: string;
  title: string;
  body: string;
  /* When `'components'`, the rulebook spread swaps the freeform textarea
     for the catalog picker + component list described in
     ComponentsChapterPage. Standard chapters keep the freeform body. */
  kind?: RulesChapterKind;
}

/* Rulebook-only component the user invented that does NOT exist in the
   supplier / engine catalog. Stays out of project.instances so the gallery
   stays clean; surfaces only inside the Components chapter. */
export interface CustomRulebookComponent {
  id: string;
  name: string;
  description: string;
}

export interface EditorRuleConfig {
  /* Legacy single-blob rules text. Kept for backward compatibility with old
     stored projects and AI grounding paths that still emit a single string.
     The Rules editor surfaces `chapters` instead — see storage.ts for the
     migration that turns a non-empty `rulesText` into a single chapter on
     first load. */
  rulesText: string;
  designerNotes: string;
  /* Ordered list of rulebook chapters surfaced by the Rules section. Each
     chapter is one "page" in the two-page-spread rulebook UI. */
  chapters: RulesChapter[];
  /* User-invented components that live only in the rulebook (no catalog
     match). Carry a warning in the UI that they cannot be shipped via the
     physical-prototype supplier. */
  customComponents: CustomRulebookComponent[];
}

export type EditorTimeControlMode = 'none' | 'per_turn' | 'per_match';
export type ProjectPaletteColorId =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'accent_1'
  | 'accent_2'
  | 'accent_3'
  | 'accent_4'
  | 'accent_5'
  | 'accent_6';

export type ProjectColorPalette = Record<ProjectPaletteColorId, string>;

/**
 * Display unit preference for physical dimensions (board/tile/deck sizes,
 * inspector read-outs, catalog size labels). Stored data stays in mm — this
 * only affects presentation. Lives in user settings (see `userSettings.ts`),
 * not project settings, because it's a personal UI preference that applies
 * across every project the user opens.
 */
export type EditorLengthUnit = 'mm' | 'inches';

export interface EditorSettings {
  timeControlMode: EditorTimeControlMode;
  timeControlSeconds: number;
  colorPalette: ProjectColorPalette;
  aiModels: ProjectAIModelSettings;
}

import type { BoardSurfaceTextureId } from '@turnbased/engine-components';

export interface EditorArtReference {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
}

export type EditorIconAssetMode = 'library' | 'custom';

export interface EditorIconAsset {
  id: string;
  mode: EditorIconAssetMode;
  name: string;
  iconKey: string;
  iconColor: string;
  iconFillColor: string;
  iconStrokeWidth: number;
  iconScale: number;
  backgroundColor: string;
  backgroundTextureId: BoardSurfaceTextureId;
  backgroundTextureOpacity: number;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  customSvgMarkup: string;
  inlineCode: string;
  description: string;
  tags: string[];
}

export interface EditorImageAsset {
  id: string;
  name: string;
  r2Key: string;
  imageDataUrl?: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  aiPrompt?: string;
  tags: string[];
  createdAt: string;
}

export interface EditorArtDirection {
  theme: string;
  definedArtStyles: EditorArtReference[];
  recurringAssets: EditorArtReference[];
  icons: EditorIconAsset[];
  images: EditorImageAsset[];
}

export type EditorProjectViewKind = 'shared' | 'player';

export interface EditorProjectView {
  id: string;
  kind: EditorProjectViewKind;
  label: string;
  linkedSeatId: string | null;
  parentViewId: string | null;
  description: string;
}

export interface EditorProjectViews {
  defaultViewId: string;
  selectedViewId: string;
  items: EditorProjectView[];
}

export interface EditorAppLayout {
  shellTitle: string;
  introText: string;
  hudItems: string[];
  sidePanels: string[];
  primaryActionLabel: string;
  summaryStripLabel: string;
  linkedViewLabel: string;
  resourceSummaryLabel: string;
  navigationMode: 'summary_strip';
  avatarStyle: 'lucide';
}

export interface EditorProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  phase: EditorProjectPhase;
  manifest: ProjectManifest;
  brief: RulesBuilderBrief;
  seats: EditorSeat[];
  views: EditorProjectViews;
  rootInstanceIds: string[];
  instances: Record<string, ComponentInstanceModel>;
  rules: EditorRuleConfig;
  settings: EditorSettings;
  art: EditorArtDirection;
  appLayout: EditorAppLayout;
  cardStudio?: CardStudioState;
  playtestLab?: PlaytestLabState;
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
