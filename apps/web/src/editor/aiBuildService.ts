import type { EditorProject, RulesBuilderBrief } from './types';
import {
  type AIGameBlueprint,
  buildProjectFromAIBlueprint,
  buildProjectScaffoldFromBrief,
  createAIBuildPromptPack,
} from './aiBuilder';
import { supabase } from '../lib/supabaseClient';

interface AIBuildFunctionResponse {
  success?: boolean;
  blueprint?: unknown;
  model?: string | null;
  rawResponse?: string | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | null;
  cost?: {
    estimatedCostUsd?: number | null;
    providerCostCents?: number;
    platformFeeCents?: number;
    totalChargedCents?: number;
    pricingKnown?: boolean;
    currency?: string;
  } | null;
}

export interface AIBuildUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIBuildCost {
  estimatedCostUsd: number | null;
  providerCostCents: number;
  platformFeeCents: number;
  totalChargedCents: number;
  pricingKnown: boolean;
  currency: string;
}

export interface CreatorEnvironmentStatus {
  aiBuildMode: 'openrouter' | 'local';
  aiBuildLabel: string;
  versionControlMode: 'remote_backup' | 'browser_local';
  versionControlLabel: string;
}

export interface AIBuildResult {
  project: EditorProject;
  usedAI: boolean;
  model: string | null;
  fallbackReason: string | null;
  usage: AIBuildUsage | null;
  cost: AIBuildCost | null;
}

type AIBoardLayout = NonNullable<AIGameBlueprint['board']>['layout'];

function hasSupabaseConfig(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function coerceBoardLayout(value: unknown): AIBoardLayout {
  return value === 'grid'
    || value === 'hex'
    || value === 'graph'
    || value === 'freeform'
    || value === 'linear'
    || value === 'circular'
    || value === 'branching'
    || value === 'stack'
    || value === 'fan'
    || value === 'pile'
    ? value
    : undefined;
}

function coerceBlueprint(value: unknown): AIGameBlueprint | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    projectName: typeof value.projectName === 'string' ? value.projectName : undefined,
    description: typeof value.description === 'string' ? value.description : undefined,
    rulesText: typeof value.rulesText === 'string' ? value.rulesText : undefined,
    phases: toStringArray(value.phases),
    targetScore: typeof value.targetScore === 'number' ? value.targetScore : undefined,
    maxTurns: typeof value.maxTurns === 'number' ? value.maxTurns : undefined,
    designerNotes: toStringArray(value.designerNotes),
    playerRange: isRecord(value.playerRange) ? {
      min: typeof value.playerRange.min === 'number' ? value.playerRange.min : undefined,
      max: typeof value.playerRange.max === 'number' ? value.playerRange.max : undefined,
      hasDistinctSoloMode: typeof value.playerRange.hasDistinctSoloMode === 'boolean' ? value.playerRange.hasDistinctSoloMode : undefined,
      isCampaignGame: typeof value.playerRange.isCampaignGame === 'boolean' ? value.playerRange.isCampaignGame : undefined,
    } : undefined,
    playerIdentities: Array.isArray(value.playerIdentities)
      ? value.playerIdentities
        .filter(isRecord)
        .map((entry) => ({
          seatId: typeof entry.seatId === 'string' ? entry.seatId : undefined,
          badgeLabel: typeof entry.badgeLabel === 'string' ? entry.badgeLabel : undefined,
          iconKey: typeof entry.iconKey === 'string' ? entry.iconKey : undefined,
          color: typeof entry.color === 'string' ? entry.color : undefined,
          resourceLabel: typeof entry.resourceLabel === 'string' ? entry.resourceLabel : undefined,
          startingBlocks: typeof entry.startingBlocks === 'number' ? entry.startingBlocks : undefined,
        }))
      : undefined,
    views: isRecord(value.views) ? {
      defaultViewId: typeof value.views.defaultViewId === 'string' ? value.views.defaultViewId : undefined,
      selectedViewId: typeof value.views.selectedViewId === 'string' ? value.views.selectedViewId : undefined,
      sharedView: isRecord(value.views.sharedView) ? {
        label: typeof value.views.sharedView.label === 'string' ? value.views.sharedView.label : undefined,
        description: typeof value.views.sharedView.description === 'string' ? value.views.sharedView.description : undefined,
      } : undefined,
      playerViews: Array.isArray(value.views.playerViews)
        ? value.views.playerViews
          .filter(isRecord)
          .map((entry) => ({
            seatId: typeof entry.seatId === 'string' ? entry.seatId : undefined,
            label: typeof entry.label === 'string' ? entry.label : undefined,
            description: typeof entry.description === 'string' ? entry.description : undefined,
          }))
        : undefined,
    } : undefined,
    appLayout: isRecord(value.appLayout) ? {
      shellTitle: typeof value.appLayout.shellTitle === 'string' ? value.appLayout.shellTitle : undefined,
      introText: typeof value.appLayout.introText === 'string' ? value.appLayout.introText : undefined,
      hudItems: toStringArray(value.appLayout.hudItems),
      sidePanels: toStringArray(value.appLayout.sidePanels),
      primaryActionLabel: typeof value.appLayout.primaryActionLabel === 'string' ? value.appLayout.primaryActionLabel : undefined,
      summaryStripLabel: typeof value.appLayout.summaryStripLabel === 'string' ? value.appLayout.summaryStripLabel : undefined,
      linkedViewLabel: typeof value.appLayout.linkedViewLabel === 'string' ? value.appLayout.linkedViewLabel : undefined,
      resourceSummaryLabel: typeof value.appLayout.resourceSummaryLabel === 'string' ? value.appLayout.resourceSummaryLabel : undefined,
      navigationMode: value.appLayout.navigationMode === 'summary_strip' ? 'summary_strip' : undefined,
      avatarStyle: value.appLayout.avatarStyle === 'lucide' ? 'lucide' : undefined,
    } : undefined,
    board: isRecord(value.board) ? {
      label: typeof value.board.label === 'string' ? value.board.label : undefined,
      layout: coerceBoardLayout(value.board.layout),
      width: typeof value.board.width === 'number' ? value.board.width : undefined,
      height: typeof value.board.height === 'number' ? value.board.height : undefined,
      spaceCount: typeof value.board.spaceCount === 'number' ? value.board.spaceCount : undefined,
      spaceLabels: toStringArray(value.board.spaceLabels),
      terrainPattern: toStringArray(value.board.terrainPattern),
    } : undefined,
    playerAreas: Array.isArray(value.playerAreas)
      ? value.playerAreas
        .filter(isRecord)
        .map((area) => ({
          ownerId: typeof area.ownerId === 'string' ? area.ownerId : undefined,
          reserveLabel: typeof area.reserveLabel === 'string' ? area.reserveLabel : undefined,
          startingPieces: typeof area.startingPieces === 'number' ? area.startingPieces : undefined,
          pieceLabelPrefix: typeof area.pieceLabelPrefix === 'string' ? area.pieceLabelPrefix : undefined,
          pieceType: area.pieceType === 'token' ? 'token' : area.pieceType === 'piece' ? 'piece' : undefined,
        }))
      : undefined,
    sharedZones: Array.isArray(value.sharedZones)
      ? value.sharedZones
        .filter(isRecord)
        .map((zone) => ({
          label: typeof zone.label === 'string' ? zone.label : undefined,
          ownerId: typeof zone.ownerId === 'string' ? zone.ownerId : zone.ownerId === null ? null : undefined,
          maxCapacity: typeof zone.maxCapacity === 'number' ? zone.maxCapacity : zone.maxCapacity === null ? null : undefined,
          pieceCount: typeof zone.pieceCount === 'number' ? zone.pieceCount : undefined,
          pieceLabelPrefix: typeof zone.pieceLabelPrefix === 'string' ? zone.pieceLabelPrefix : undefined,
          pieceType: zone.pieceType === 'token' ? 'token' : zone.pieceType === 'piece' ? 'piece' : undefined,
        }))
      : undefined,
  };
}

function fallbackBuild(brief: RulesBuilderBrief, reason: string): AIBuildResult {
  return {
    project: buildProjectScaffoldFromBrief(brief),
    usedAI: false,
    model: null,
    fallbackReason: reason,
    usage: null,
    cost: null,
  };
}

export async function getCreatorEnvironmentStatus(): Promise<CreatorEnvironmentStatus> {
  if (!hasSupabaseConfig()) {
    return {
      aiBuildMode: 'local',
      aiBuildLabel: 'Local scaffold fallback. Add VITE Supabase config and sign in to use hosted AI builds.',
      versionControlMode: 'browser_local',
      versionControlLabel: 'Version history stays in this browser only.',
    };
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.is_anonymous) {
    return {
      aiBuildMode: 'local',
      aiBuildLabel: 'Local scaffold fallback until you sign in.',
      versionControlMode: 'browser_local',
      versionControlLabel: 'Version history stays in this browser until you sign in.',
    };
  }

  return {
    aiBuildMode: 'openrouter',
    aiBuildLabel: 'Hosted OpenRouter build available.',
    versionControlMode: 'remote_backup',
    versionControlLabel: 'Initial commits will be backed up to Supabase when the build succeeds.',
  };
}

export async function buildProjectWithAI(brief: RulesBuilderBrief): Promise<AIBuildResult> {
  if (!hasSupabaseConfig()) {
    return fallbackBuild(brief, 'Supabase is not configured in this environment.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.is_anonymous) {
    return fallbackBuild(brief, 'Sign in to use OpenRouter-backed builds. Falling back to the local scaffold.');
  }

  const promptPack = createAIBuildPromptPack(brief);
  const { data, error } = await supabase.functions.invoke<AIBuildFunctionResponse>('ai-project-builder', {
    body: {
      brief,
      promptPack,
    },
  });

  if (error) {
    return fallbackBuild(brief, error.message || 'The AI build service was unavailable.');
  }

  const blueprint = coerceBlueprint(data?.blueprint);
  if (!blueprint) {
    return fallbackBuild(brief, 'The AI response was malformed, so a safe local scaffold was generated instead.');
  }

  return {
    project: buildProjectFromAIBlueprint(brief, blueprint),
    usedAI: true,
    model: data?.model ?? null,
    fallbackReason: null,
    usage: data?.usage ? {
      promptTokens: toFiniteNumber(data.usage.promptTokens),
      completionTokens: toFiniteNumber(data.usage.completionTokens),
      totalTokens: toFiniteNumber(
        data.usage.totalTokens,
        toFiniteNumber(data.usage.promptTokens) + toFiniteNumber(data.usage.completionTokens),
      ),
    } : null,
    cost: data?.cost ? {
      estimatedCostUsd: typeof data.cost.estimatedCostUsd === 'number' ? data.cost.estimatedCostUsd : null,
      providerCostCents: toFiniteNumber(data.cost.providerCostCents),
      platformFeeCents: toFiniteNumber(data.cost.platformFeeCents),
      totalChargedCents: toFiniteNumber(data.cost.totalChargedCents),
      pricingKnown: Boolean(data.cost.pricingKnown),
      currency: typeof data.cost.currency === 'string' ? data.cost.currency : 'USD',
    } : null,
  };
}
