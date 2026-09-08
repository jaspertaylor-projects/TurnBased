import { supabase } from '../lib/supabaseClient';
import type { EditorProject, RulesChapter } from './types';
import { resolveRulesWriterModel } from './aiModelCatalog';

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

export interface AIRulesRequest {
  project: EditorProject;
  activeChapter: RulesChapter;
  userPrompt: string;
  themes: string[];
  artStyles: string[];
  contextWeights: AIRulesContextWeights;
  modelId: string;
  temperature?: number;
}

/** Share exactly the selected sources across prose and brainstorm requests. */
export function buildRulesRequestBody(args: AIRulesRequest, mode: AIRulesMode) {
  const { project, activeChapter, userPrompt, themes, artStyles, contextWeights, temperature } = args;
  const selectedStyles = new Set(artStyles.map((name) => name.trim().toLowerCase()));
  return {
    gameName: project.brief.name || project.name,
    theme: themes.join(', '),
    artStyle: artStyles.join(', '),
    temperature,
    artStyleDetails: (project.art?.definedArtStyles ?? [])
      .filter((style) => selectedStyles.has((style.name ?? '').trim().toLowerCase()))
      .map((style) => ({ name: style.name ?? '', description: style.description ?? '' })),
    playerMin: project.brief.minPlayers,
    playerMax: project.brief.maxPlayers,
    chapters: project.rules.chapters.map((chapter) => ({ title: chapter.title, body: chapter.body })),
    activeChapterTitle: activeChapter.title,
    activeChapterBody: activeChapter.body,
    userPrompt,
    mode,
    contextWeights,
    modelId: resolveRulesWriterModel(args.modelId),
  };
}

async function invokeRules(args: AIRulesRequest, mode: AIRulesMode): Promise<ServerResponse> {
  return requestRulesWriter(buildRulesRequestBody(args, mode));
}

export async function requestRulesWriter(body: Record<string, unknown>): Promise<ServerResponse> {
  if (!hasSupabaseConfig()) throw new Error('Supabase is not configured in this environment, so AI assist is unavailable.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.is_anonymous) throw new Error('Sign in to use the AI rules writer.');
  const { data, error } = await supabase.functions.invoke<ServerResponse>('ai-rules-writer', { body });
  if (error) {
    const detail = await extractFunctionError(error);
    throw new Error(detail || error.message || 'The AI rules service was unavailable.');
  }
  if (!data?.success || typeof data.text !== 'string' || !data.text.trim())
    throw new Error(data?.error || 'The AI returned no text. Try again or refine your prompt.');
  return data;
}

/** The caller decides whether to replace or append the returned chapter prose. */
export async function generateRulesChapterText(args: AIRulesRequest & { mode: AIRulesMode }): Promise<AIRulesAssistResult> {
  const data = await invokeRules(args, args.mode);
  return {
    text: data.text,
    model: data.model ?? null,
    usage: data.usage ? {
      promptTokens: data.usage.promptTokens ?? 0,
      completionTokens: data.usage.completionTokens ?? 0,
      totalTokens: data.usage.totalTokens ?? 0,
    } : null,
    cost: data.cost ? { estimatedCostUsd: data.cost.estimatedCostUsd ?? null, pricingKnown: Boolean(data.cost.pricingKnown) } : null,
  };
}

export function aiRulesAvailable(): boolean { return hasSupabaseConfig(); }

export interface AIRulesBrainstormResult {
  ideas: string[];
  model: string | null;
}

/** Accept JSON/fenced JSON, then recover short list entries without formatting debris. */
export function parseBrainstormIdeas(raw: string): string[] {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let entries: unknown[] = [];
  for (const candidate of [raw.trim(), fenced?.[1]?.trim()].filter((value): value is string => Boolean(value))) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (Array.isArray(parsed)) { entries = parsed; break; }
    } catch { /* Some providers return a plain list despite JSON instructions. */ }
  }
  if (!entries.length) entries = raw.split(/\r?\n+/).map((line) => {
    let value = line.trim().replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '');
    if (/^```|^[[\]]\s*,?$|:\s*$/.test(value)) return '';
    value = value.replace(/[,;]+$/, '').trim();
    return value.replace(/^(["'])(.*)\1$/, '$2').trim();
  });
  const seen = new Set<string>();
  return entries.filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (!entry || entry.length > 80 || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 20);
}

export async function brainstormRulesIdeas(args: AIRulesRequest): Promise<AIRulesBrainstormResult> {
  const data = await invokeRules(args, 'brainstorm');
  const ideas = parseBrainstormIdeas(data.text);
  if (!ideas.length) throw new Error('The AI returned no usable ideas. Try again or refine your prompt.');
  return { ideas, model: data.model ?? null };
}
