import {
  DEFAULT_AI_RULES_CONTEXT_WEIGHTS,
  type AIRulesContextWeights,
  type AIRulesMode,
} from './aiRulesService';
import { resolveRulesWriterModel } from './aiModelCatalog';
import { splitBriefList } from './project';
import type { AIDraftState } from './aiAssistTypes';
import type { EditorProject, RulesChapter } from './types';

/**
 * The subset of the rulebook AI-assist panel's state that we persist between
 * openings. Loaded when the user clicks the AI button on a chapter so the
 * panel comes back exactly as they left it; stored on every state change so
 * the saved copy stays current even if the user closes the panel without
 * running a generation.
 *
 * Persistent fields only — runtime-only things like `loading`, `error`,
 * `brainstormResults`, `chapterId`, and the derived `availableThemes`/
 * `availableArtStyles` are intentionally NOT stored.
 */
export interface AIAssistDraftSnapshot {
  prompt: string;
  mode: AIRulesMode;
  contextWeights: AIRulesContextWeights;
  selectedThemes: string[];
  selectedArtStyles: string[];
  /* Optional so legacy snapshots (saved before temperature was exposed)
     still load cleanly — buildInitialAIDraft picks a mode-appropriate
     default when this is missing. */
  temperature?: number;
  /* Optional so legacy snapshots still load — buildInitialAIDraft falls
     back to the project's rulesWriter setting when this is missing, and
     resolveRulesWriterModel drops any since-removed slug. */
  modelId?: string;
}

/* Per-mode temperature defaults. Brainstorm needs more variety to escape
   the compound-name basin; rulebook prose stays steadier. Kept in sync
   with the edge function's defaultTemperature so the slider opens at the
   same value the model would have used implicitly. */
export const DEFAULT_TEMPERATURE_BY_MODE: Record<AIRulesMode, number> = {
  draft: 0.6,
  rewrite: 0.6,
  expand: 0.6,
  brainstorm: 0.85,
};

export const TEMPERATURE_MIN = 0;
export const TEMPERATURE_MAX = 1.5;

function clampTemperature(value: number): number {
  return Math.max(TEMPERATURE_MIN, Math.min(TEMPERATURE_MAX, value));
}

const STORAGE_KEY_PREFIX = 'turnbased.creator.aiAssistDraft.';

const VALID_MODES: AIRulesMode[] = ['draft', 'rewrite', 'expand', 'brainstorm'];

function storageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function clampWeight(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sanitizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Load the saved snapshot for this project. Returns null when nothing's been
 * saved yet, or when the stored JSON is malformed (we don't try to repair
 * partial garbage — better to fall through to defaults).
 */
export function loadAIAssistDraft(projectId: string): AIAssistDraftSnapshot | null {
  const storage = getStorage();
  if (!storage || !projectId) return null;
  try {
    const raw = storage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const data = parsed as Record<string, unknown>;
    const prompt = typeof data.prompt === 'string' ? data.prompt : '';
    const mode = VALID_MODES.includes(data.mode as AIRulesMode) ? (data.mode as AIRulesMode) : 'draft';
    const rawWeights = (data.contextWeights ?? {}) as Record<string, unknown>;
    const contextWeights: AIRulesContextWeights = {
      rulebook: clampWeight(rawWeights.rulebook, DEFAULT_AI_RULES_CONTEXT_WEIGHTS.rulebook),
      prompt: clampWeight(rawWeights.prompt, DEFAULT_AI_RULES_CONTEXT_WEIGHTS.prompt),
      chips: clampWeight(rawWeights.chips, DEFAULT_AI_RULES_CONTEXT_WEIGHTS.chips),
    };
    const temperature =
      typeof data.temperature === 'number' && Number.isFinite(data.temperature)
        ? clampTemperature(data.temperature)
        : undefined;
    const modelId =
      typeof data.modelId === 'string' && data.modelId.trim().length > 0 ? data.modelId.trim() : undefined;
    return {
      prompt,
      mode,
      contextWeights,
      selectedThemes: sanitizeStringList(data.selectedThemes),
      selectedArtStyles: sanitizeStringList(data.selectedArtStyles),
      temperature,
      modelId,
    };
  } catch {
    return null;
  }
}

export function saveAIAssistDraft(projectId: string, snapshot: AIAssistDraftSnapshot): void {
  const storage = getStorage();
  if (!storage || !projectId) return;
  try {
    storage.setItem(storageKey(projectId), JSON.stringify(snapshot));
  } catch {
    // Quota / privacy mode — best-effort persistence; not worth surfacing
    // to the user since the panel still works without it.
  }
}

/**
 * Intersect a saved list of theme / art-style picks with the project's
 * current list. If the user removed a theme from the brief between sessions
 * the saved selection silently drops it; otherwise their previous picks
 * survive. New themes stay available but unselected until the user chooses them.
 */
export function reconcileSelections(saved: string[], available: string[]): string[] {
  const savedLower = new Set(saved.map((entry) => entry.toLowerCase()));
  // Preserve project-list ORDER, not saved-list order, so chips render in
  // the same order whether or not a draft exists.
  return available.filter((entry) => savedLower.has(entry.toLowerCase()));
}

/**
 * Build the initial AI assist panel state for a chapter, restoring from the
 * saved per-project snapshot when one exists. Falls back to first-open
 * defaults (every theme/art-style toggled on, default sliders, mode picked
 * from whether the chapter already has body text).
 *
 * `normalizeRulesBuilderBrief` stores the literal "none" placeholder when
 * the brief field was left empty at project creation — filtered out here
 * so the panel never renders an opaque "none" chip the user can't act on.
 */
export function buildInitialAIDraft(project: EditorProject, chapter: RulesChapter): AIDraftState {
  const availableThemes = splitBriefList(project.brief.theme).filter(
    (entry) => entry.toLowerCase() !== 'none',
  );
  const availableArtStyles = splitBriefList(project.brief.artStyle).filter(
    (entry) => entry.toLowerCase() !== 'none',
  );

  const saved = loadAIAssistDraft(project.id);
  const hasBody = chapter.body.trim().length > 0;
  // expand/rewrite need an existing body; if a saved mode wants body but
  // this chapter is empty, fall back to draft instead of dropping the user
  // into a mode that immediately disables itself.
  const savedNeedsBody = saved?.mode === 'expand' || saved?.mode === 'rewrite';
  const resolvedMode: AIRulesMode = saved
    ? savedNeedsBody && !hasBody
      ? 'draft'
      : saved.mode
    : hasBody
      ? 'expand'
      : 'draft';

  return {
    chapterId: chapter.id,
    prompt: saved?.prompt ?? '',
    mode: resolvedMode,
    loading: false,
    error: null,
    selectedThemes: saved ? reconcileSelections(saved.selectedThemes, availableThemes) : [...availableThemes],
    selectedArtStyles: saved
      ? reconcileSelections(saved.selectedArtStyles, availableArtStyles)
      : [...availableArtStyles],
    availableThemes,
    availableArtStyles,
    contextWeights: saved?.contextWeights ?? DEFAULT_AI_RULES_CONTEXT_WEIGHTS,
    temperature: saved?.temperature ?? DEFAULT_TEMPERATURE_BY_MODE[resolvedMode],
    // Prefer the user's last per-draft pick, else the project's configured
    // rules writer; resolveRulesWriterModel guarantees a valid catalog slug.
    modelId: resolveRulesWriterModel(saved?.modelId ?? project.settings.aiModels.rulesWriter),
    brainstormResults: [],
  };
}

/** Strip the persistent slice off the runtime AIDraftState. */
export function snapshotFromDraft(state: AIDraftState): AIAssistDraftSnapshot {
  return {
    prompt: state.prompt,
    mode: state.mode,
    contextWeights: state.contextWeights,
    selectedThemes: state.selectedThemes,
    selectedArtStyles: state.selectedArtStyles,
    temperature: state.temperature,
    modelId: state.modelId,
  };
}
