import { supabase } from '../lib/supabaseClient';
import type { EditorProject, RulesChapter } from './types';

export type AIRulesMode = 'draft' | 'rewrite' | 'expand';

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
}): Promise<AIRulesAssistResult> {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase is not configured in this environment, so AI assist is unavailable.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.is_anonymous) {
    throw new Error('Sign in to use the AI rules writer.');
  }

  const { project, activeChapter, userPrompt, mode, themes, artStyles } = args;
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
