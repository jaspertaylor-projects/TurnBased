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
 * gives back a generic message. This pulls the JSON `error` field off the
 * response so we can surface the real cause (e.g. "OpenRouter API Key not
 * configured", "Not Authenticated") instead of "non-2xx status code".
 */
async function extractFunctionError(error: unknown): Promise<string | null> {
  if (!error || typeof error !== 'object') return null;
  const ctx = (error as { context?: { response?: Response } }).context;
  const response = ctx?.response;
  if (!response) return null;
  try {
    const cloned = response.clone();
    const text = await cloned.text();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.error === 'string') return parsed.error;
    } catch {
      // Not JSON — return the raw text snippet.
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
 */
export async function generateRulesChapterText(args: {
  project: EditorProject;
  activeChapter: RulesChapter;
  userPrompt: string;
  mode: AIRulesMode;
}): Promise<AIRulesAssistResult> {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase is not configured in this environment, so AI assist is unavailable.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.is_anonymous) {
    throw new Error('Sign in to use the AI rules writer.');
  }

  const { project, activeChapter, userPrompt, mode } = args;
  const body = {
    gameName: project.brief.name || project.name,
    theme: project.brief.theme ?? '',
    artStyle: project.brief.artStyle ?? '',
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
