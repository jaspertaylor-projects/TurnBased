import type { ComponentLayout } from '@turnbased/engine-components';
import type { EditorProject, RulesBuilderBrief } from './types';

export interface RulesBriefSuggestion {
  title: string;
  body: string;
}

export interface AIBuildPromptPack {
  brief: RulesBuilderBrief;
  engineGrounding: string[];
  componentCatalog: Array<{
    type: string;
    displayName: string;
    description: string;
    allowedParents: string[];
    allowedChildren: string[];
    keyProperties: string[];
    tags: string[];
  }>;
  acceptanceChecklist: string[];
  previewRuntimeContract: string[];
  workspacePolicy: string[];
}

export interface AIGameBlueprint {
  projectName?: string;
  description?: string;
  rulesText?: string;
  designerNotes?: string[];
  playerRange?: {
    min?: number;
    max?: number;
    hasDistinctSoloMode?: boolean;
    isCampaignGame?: boolean;
  };
  playerIdentities?: Array<{
    seatId?: string;
    badgeLabel?: string;
    iconKey?: string;
    color?: string;
    resourceLabel?: string;
    startingBlocks?: number;
  }>;
  views?: {
    defaultViewId?: string;
    selectedViewId?: string;
    sharedView?: {
      label?: string;
      description?: string;
    };
    playerViews?: Array<{
      seatId?: string;
      label?: string;
      description?: string;
    }>;
  };
  appLayout?: Partial<EditorProject['appLayout']>;
  board?: {
    label?: string;
    layout?: ComponentLayout;
    width?: number;
    height?: number;
    spaceCount?: number;
    spaceLabels?: string[];
    terrainPattern?: string[];
  };
  playerAreas?: Array<{
    ownerId?: string;
    resourceLabel?: string;
    reserveLabel?: string;
    startingPieces?: number;
    pieceLabelPrefix?: string;
    pieceType?: 'piece' | 'token';
    supplyMode?: 'finite' | 'infinite';
  }>;
  sharedZones?: Array<{
    label?: string;
    ownerId?: string | null;
    maxCapacity?: number | null;
    pieceCount?: number;
    pieceLabelPrefix?: string;
    pieceType?: 'piece' | 'token';
    supplyMode?: 'finite' | 'infinite';
  }>;
}

export const SIMPLE_EXAMPLE_BRIEF: RulesBuilderBrief = {
  name: 'Lantern Blocks',
  minPlayers: 2,
  maxPlayers: 4,
  hasDistinctSoloMode: true,
  isCampaignGame: false,
  theme: 'harbor lantern guilds',
  artStyle: 'cozy painted woodcut',
  minAge: 10,
  playtimeMinMinutes: 30,
  playtimeMaxMinutes: 60,
};

export const ENGINE_GROUNDING = [
  'Use built-in components and declarative rules whenever possible.',
  'Every generated starter project should open in a linked multi-view shell with one shared board view and one player-linked view per seat.',
  'A previewable project needs at least one public destination surface and at least one owned movable block resource per player.',
  'Prefer the reusable engine-ui linked-view assets for startup chrome: LinkedSeatSummaryStrip, LinkedViewStage, and PlayerLinkedViewStage.',
  'Generated projects should preserve the lightweight setup brief and stay easy to refine in the component editor.',
  'Prefer a minimal playable interpretation when the setup brief is underspecified.',
];

export const ACCEPTANCE_CHECKLIST = [
  'Project manifest and setup brief are preserved in project metadata.',
  'Requested player count range and solo/campaign flags are preserved.',
  'One shared board view exists and one linked player view exists per seat.',
  'Player summaries show seat identity, Lucide-first avatar fallback, and compact resource counts.',
  'Each player starts with 6 block resources unless the blueprint explicitly asks for a higher valid amount.',
  'Preview runtime compiles without blocking requirements.',
  'The active player has at least one legal move in the initial preview state.',
  'App layout fields exist for summary strip, linked view navigation, and resource presentation.',
];

export const PREVIEW_RUNTIME_CONTRACT = [
  'The shared shell keeps the player summary strip visible while the main content swaps between the board and player-linked views.',
  'Public spaces or zones become destination surfaces in preview.',
  'Owned block resources placed in a player resources area can move into open public destinations.',
  'Target score and turn cap should match the board size and pace.',
];

export const WORKSPACE_POLICY = [
  'Generate only project-workspace artifacts, never shared engine changes.',
  'Stay inside documented component and rules boundaries.',
  'Prefer a shared board plus player-owned resource areas plus one shared game supply for the first playable build.',
];
