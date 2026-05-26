import { supabase } from '../lib/supabaseClient';
import type { EditorProject, RulesChapter } from './types';

export type AIRulesMode = 'draft' | 'rewrite' | 'expand' | 'brainstorm';

export interface AIRulesContextWeights {
  rulebook: number;
  prompt: number;
  chips: number;
}

export const DEFAULT_AI_RULES_CONTEXT_WEIGHTS: AIRulesContextWeights = {
  rulebook: 70,
  prompt: 100,
  chips: 70,
};

export interface AIRulesAssistResult {
  text: string;
  model: string | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  cost: { estimatedCostUsd: number | null; pricingKnown: boolean } | null;
}

function hasSupabaseConfig(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

/**
 * supabase-js's FunctionsHttpError swallows the function's response body and
 * gives back a generic message. The `context` field on the thrown error is
 * the raw Response object (verified against
 * @supabase/functions-js FunctionsClient — `throw new FunctionsHttpError(response)`).
 * Read it to surface the real cause (e.g. "OpenRouter API Key not configured",
 * "Not Authenticated") instead of "non-2xx status code".
 */
async function extractFunctionError(error: unknown): Promise<string | null> {
  if (!error || typeof error !== 'object') return null;
  const response = (error as { context?: Response }).context;
  if (!response || typeof response.clone !== 'function') return null;
  try {
    const cloned = response.clone();
    const text = await cloned.text();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      // Different layers use different keys. Kong returns { msg: ... }, our
      // edge function returns { error: ... }, and some Supabase paths return
      // { message: ... }. Try each.
      if (parsed && typeof parsed.error === 'string') return parsed.error;
      if (parsed && typeof parsed.msg === 'string') return parsed.msg;
      if (parsed && typeof parsed.message === 'string') return parsed.message;
    } catch {
      // Not JSON — fall through and return the raw text snippet.
    }
    return text.slice(0, 400);
  } catch {
    return null;
  }
}

interface ServerResponse {
  success: boolean;
  text: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  cost?: { estimatedCostUsd: number | null; pricingKnown: boolean };
  error?: string;
}

/**
 * Ask the AI rules writer to draft / expand / rewrite the active chapter.
 * Sends the whole rulebook as grounding so the model picks up established
 * voice and terminology from the user's other chapters.
 *
 * `themes` and `artStyles` let the caller send a *subset* of the project's
 * themes/art-styles instead of all of them — used by the AI panel's
 * theme/style chip toggles. Pass the full brief lists to match the
 * old behavior.
 */
export async function generateRulesChapterText(args: {
  project: EditorProject;
  activeChapter: RulesChapter;
  userPrompt: string;
  mode: AIRulesMode;
  themes: string[];
  artStyles: string[];
  contextWeights: AIRulesContextWeights;
  modelId: string;
}): Promise<AIRulesAssistResult> {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase is not configured in this environment, so AI assist is unavailable.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.is_anonymous) {
    throw new Error('Sign in to use the AI rules writer.');
  }

  const { project, activeChapter, userPrompt, mode, themes, artStyles, contextWeights, modelId } = args;
  const body = {
    gameName: project.brief.name || project.name,
    /* themes / artStyles come from the chip toggles in the AI panel — they
       may be a subset of the brief's full list. Sent to the server as
       comma-joined strings to match the existing edge function shape. */
    theme: themes.join(', '),
    artStyle: artStyles.join(', '),
    /* Art studio's richer per-style definitions — names + free-text
       descriptions. Keeps the prompt grounded in the user's actual art
       direction instead of only the shorter brief.artStyle string. */
    artStyleDetails: (project.art?.definedArtStyles ?? []).map((style) => ({
      name: style.name ?? '',
      description: style.description ?? '',
    })),
    playerMin: project.brief.minPlayers,
    playerMax: project.brief.maxPlayers,
    chapters: project.rules.chapters.map((chapter) => ({ title: chapter.title, body: chapter.body })),
    activeChapterTitle: activeChapter.title,
    activeChapterBody: activeChapter.body,
    userPrompt,
    mode,
    contextWeights,
    modelId,
  };

  const { data, error } = await supabase.functions.invoke<ServerResponse>('ai-rules-writer', { body });
  if (error) {
    // supabase.functions.invoke surfaces a generic "non-2xx status code" message
    // and stuffs the function's actual response on error.context.response. Pull
    // the JSON `error` field out so the user sees the real cause (missing API
    // key, not authenticated, etc.) instead of an opaque HTTP error.
    const detail = await extractFunctionError(error);
    throw new Error(detail || error.message || 'The AI rules service was unavailable.');
  }
  if (!data?.success || typeof data.text !== 'string' || data.text.trim().length === 0) {
    throw new Error(data?.error || 'The AI returned no text. Try again or refine your prompt.');
  }

  return {
    text: data.text,
    model: data.model ?? null,
    usage: data.usage
      ? {
        promptTokens: data.usage.promptTokens ?? 0,
        completionTokens: data.usage.completionTokens ?? 0,
        totalTokens: data.usage.totalTokens ?? 0,
      }
      : null,
    cost: data.cost
      ? { estimatedCostUsd: data.cost.estimatedCostUsd ?? null, pricingKnown: Boolean(data.cost.pricingKnown) }
      : null,
  };
}

export function aiRulesAvailable(): boolean {
  return hasSupabaseConfig();
}

export interface AIRulesBrainstormResult {
  ideas: string[];
  model: string | null;
}

/* Quoted-list parsing fallback — strips bullets / numbering / quotes /
   stray commas so a model that ignored "JSON only" still produces a clean
   list. Drops anything > 80 chars (likely prose, not a name). */
function parseLooseList(raw: string): string[] {
  const lines = raw.split(/\r?\n+/);
  const cleaned: string[] = [];
  for (const line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;
    trimmed = trimmed.replace(/^[\s]*[-*•]\s*/, '');
    trimmed = trimmed.replace(/^[\s]*\d+[.)]\s*/, '');
    trimmed = trimmed.replace(/^[\s]*"|"[\s]*$/g, '');
    trimmed = trimmed.replace(/^[\s]*'|'[\s]*$/g, '');
    trimmed = trimmed.replace(/[,;]+\s*$/, '');
    if (!trimmed) continue;
    if (trimmed.length > 80) continue;
    cleaned.push(trimmed);
  }
  return cleaned;
}

/**
 * Ask the AI for ~20 short ideas, typically used for naming things — cities,
 * factions, items, characters, anything where the user wants a list to pick
 * from rather than a paragraph. The model is asked to return a JSON array;
 * if that fails to parse we fall back to line-by-line cleanup so the user
 * still gets usable output.
 */
export async function brainstormRulesIdeas(args: {
  project: EditorProject;
  activeChapter: RulesChapter;
  userPrompt: string;
  themes: string[];
  artStyles: string[];
  contextWeights: AIRulesContextWeights;
  modelId: string;
}): Promise<AIRulesBrainstormResult> {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase is not configured in this environment, so AI brainstorm is unavailable.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.is_anonymous) {
    throw new Error('Sign in to use the AI brainstorm.');
  }

  const { project, activeChapter, userPrompt, themes, artStyles, contextWeights, modelId } = args;
  const body = {
    gameName: project.brief.name || project.name,
    theme: themes.join(', '),
    artStyle: artStyles.join(', '),
    artStyleDetails: (project.art?.definedArtStyles ?? []).map((style) => ({
      name: style.name ?? '',
      description: style.description ?? '',
    })),
    playerMin: project.brief.minPlayers,
    playerMax: project.brief.maxPlayers,
    chapters: project.rules.chapters.map((chapter) => ({ title: chapter.title, body: chapter.body })),
    activeChapterTitle: activeChapter.title,
    activeChapterBody: activeChapter.body,
    userPrompt,
    mode: 'brainstorm' as const,
    contextWeights,
    modelId,
  };

  const { data, error } = await supabase.functions.invoke<ServerResponse>('ai-rules-writer', { body });
  if (error) {
    const detail = await extractFunctionError(error);
    throw new Error(detail || error.message || 'The AI rules service was unavailable.');
  }
  if (!data?.success || typeof data.text !== 'string' || data.text.trim().length === 0) {
    throw new Error(data?.error || 'The AI returned no ideas. Try again or refine your prompt.');
  }

  // Strict JSON first — the edge function tells the model to return a JSON
  // array. Fall back to line-based cleanup when the model emits prose.
  let ideas: string[] = [];
  const rawText = data.text.trim();
  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) {
      ideas = parsed
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && entry.length <= 80);
    }
  } catch {
    // Some models wrap JSON in markdown fences — strip and retry once.
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        const parsed = JSON.parse(fenceMatch[1].trim());
        if (Array.isArray(parsed)) {
          ideas = parsed
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0 && entry.length <= 80);
        }
      } catch {
        // fall through to line parsing
      }
    }
  }

  if (ideas.length === 0) {
    ideas = parseLooseList(rawText);
  }

  if (ideas.length === 0) {
    throw new Error('The AI returned no usable ideas. Try again or refine your prompt.');
  }

  return { ideas, model: data.model ?? null };
}
