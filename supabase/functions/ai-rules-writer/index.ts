/**
 * ai-rules-writer
 *
 * Generates rulebook prose for a single chapter (section) of a game.
 *
 * Defaults to `moonshotai/kimi-k2-0905` — Kimi K2 has strong prose quality
 * and a generous context window (256K) which lets us send the entire
 * rulebook as grounding without truncation. Falls back through env vars
 * (`OPENROUTER_RULES_MODEL`, then `OPENROUTER_DEFAULT_MODEL`) and finally
 * to `deepseek/deepseek-chat-v3-0324` as a Kimi-out-of-stock fallback.
 *
 * Returns plain prose for the active chapter. The client decides whether
 * to replace or append the result to the textarea.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parsePriceMeta(value: unknown): { inputPerMillionUsd: number; outputPerMillionUsd: number } | null {
  if (!isRecord(value)) return null;
  const inputPerMillionUsd = toFiniteNumber(
    value.input_per_million_usd
    ?? value.prompt_per_million_usd
    ?? value.inputUsdPerMillion,
  );
  const outputPerMillionUsd = toFiniteNumber(
    value.output_per_million_usd
    ?? value.completion_per_million_usd
    ?? value.outputUsdPerMillion,
  );
  if (inputPerMillionUsd === null || outputPerMillionUsd === null) return null;
  return { inputPerMillionUsd, outputPerMillionUsd };
}

function trimText(value: unknown, max = 8000): string {
  if (typeof value !== 'string') return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n[…truncated]`;
}

interface ChapterContext {
  title: string;
  body: string;
}

interface ContextWeights {
  rulebook: number;
  prompt: number;
  chips: number;
}

const DEFAULT_CONTEXT_WEIGHTS: ContextWeights = {
  rulebook: 70,
  prompt: 100,
  chips: 70,
};

function normalizeChapter(value: unknown): ChapterContext | null {
  if (!isRecord(value)) return null;
  const title = typeof value.title === 'string' ? value.title : '';
  const body = typeof value.body === 'string' ? value.body : '';
  if (!title.trim() && !body.trim()) return null;
  return { title, body };
}

interface ArtStyleDetail {
  name: string;
  description: string;
}

function normalizeArtStyleDetail(value: unknown): ArtStyleDetail | null {
  if (!isRecord(value)) return null;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  if (!name && !description) return null;
  return { name, description };
}

function clampWeight(value: unknown, fallback: number): number {
  const numeric = toFiniteNumber(value);
  if (numeric === null) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeContextWeights(value: unknown): ContextWeights {
  if (!isRecord(value)) return DEFAULT_CONTEXT_WEIGHTS;
  return {
    rulebook: clampWeight(value.rulebook, DEFAULT_CONTEXT_WEIGHTS.rulebook),
    prompt: clampWeight(value.prompt, DEFAULT_CONTEXT_WEIGHTS.prompt),
    chips: clampWeight(value.chips, DEFAULT_CONTEXT_WEIGHTS.chips),
  };
}

function buildContextBlock(payload: {
  gameName: string;
  theme: string;
  artStyle: string;
  artStyleDetails: ArtStyleDetail[];
  playerMin: number;
  playerMax: number;
  chapters: ChapterContext[];
  activeIndex: number;
  weights: ContextWeights;
}): string {
  const parts: string[] = [];
  parts.push(`GAME NAME: ${payload.gameName || 'Untitled game'}`);
  if (payload.weights.chips > 0 && payload.theme.trim()) parts.push(`THEMES: ${payload.theme}`);
  if (payload.weights.chips > 0 && payload.artStyle.trim()) parts.push(`ART STYLES: ${payload.artStyle}`);
  if (payload.weights.chips > 0 && payload.artStyleDetails.length > 0) {
    parts.push('');
    parts.push('ART DIRECTION (from the project\'s Art studio — match the language and references when describing visuals):');
    payload.artStyleDetails.forEach((style) => {
      const name = style.name || 'Untitled style';
      const desc = style.description ? ` — ${trimText(style.description, 500)}` : '';
      parts.push(`  - ${name}${desc}`);
    });
  }
  parts.push(`PLAYER COUNT: ${payload.playerMin}-${payload.playerMax}`);
  parts.push('');
  if (payload.weights.rulebook <= 0) {
    const active = payload.chapters[payload.activeIndex];
    parts.push('RULEBOOK SO FAR: ignored by user weighting. Active section only:');
    parts.push(`### ${(payload.activeIndex >= 0 ? payload.activeIndex : 0) + 1}. ${active?.title || 'Untitled section'} ← YOU ARE WRITING THIS SECTION`);
  } else {
    const bodyLimit = payload.weights.rulebook >= 70 ? 2000 : payload.weights.rulebook >= 35 ? 900 : 300;
    parts.push('RULEBOOK SO FAR (all sections, in order):');
    payload.chapters.forEach((chapter, index) => {
      const marker = index === payload.activeIndex ? ' ← YOU ARE WRITING THIS SECTION' : '';
      const body = chapter.body.trim() ? trimText(chapter.body, bodyLimit) : '(empty)';
      parts.push('');
      parts.push(`### ${index + 1}. ${chapter.title || 'Untitled section'}${marker}`);
      parts.push(body);
    });
  }
  return parts.join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      },
    );

    // Validate the user's JWT explicitly. Passing it as an argument bypasses
    // supabase-js's local session lookup (which is always empty on a server-
    // side client) and verifies the token directly. Calling getUser() with no
    // argument returns "Auth session missing!" even when the Authorization
    // header is present.
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!jwt) throw new Error('Not Authenticated');
    const { data: { user } } = await supabaseClient.auth.getUser(jwt);
    if (!user) throw new Error('Not Authenticated');

    const body = await req.json();
    if (!isRecord(body)) throw new Error('Invalid request body');

    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openRouterKey) throw new Error('OpenRouter API Key not configured');

    const resolvedModel = typeof body.modelId === 'string' && body.modelId.trim().length > 0
      ? body.modelId.trim()
      : Deno.env.get('OPENROUTER_RULES_MODEL')?.trim()
        || Deno.env.get('OPENROUTER_DEFAULT_MODEL')?.trim()
        || 'moonshotai/kimi-k2-0905';

    const gameName = typeof body.gameName === 'string' ? body.gameName : '';
    const theme = typeof body.theme === 'string' ? body.theme : '';
    const artStyle = typeof body.artStyle === 'string' ? body.artStyle : '';
    const playerMin = toFiniteNumber(body.playerMin) ?? 2;
    const playerMax = toFiniteNumber(body.playerMax) ?? 4;
    const chapters = Array.isArray(body.chapters)
      ? body.chapters.map(normalizeChapter).filter((c): c is ChapterContext => c !== null)
      : [];
    const artStyleDetails = Array.isArray(body.artStyleDetails)
      ? body.artStyleDetails.map(normalizeArtStyleDetail).filter((d): d is ArtStyleDetail => d !== null)
      : [];
    const activeChapterTitle = typeof body.activeChapterTitle === 'string' ? body.activeChapterTitle : '';
    const activeChapterBody = typeof body.activeChapterBody === 'string' ? body.activeChapterBody : '';
    const activeIndex = chapters.findIndex((c) => c.title === activeChapterTitle && c.body === activeChapterBody);
    const userPrompt = typeof body.userPrompt === 'string' ? body.userPrompt.trim() : '';
    const contextWeights = normalizeContextWeights(body.contextWeights);
    const mode = body.mode === 'rewrite' ? 'rewrite'
      : body.mode === 'expand' ? 'expand'
      : body.mode === 'brainstorm' ? 'brainstorm'
      : 'draft';

    if (!activeChapterTitle.trim()) {
      throw new Error('Active chapter title is required');
    }

    const contextBlock = buildContextBlock({
      gameName, theme, artStyle, artStyleDetails, playerMin, playerMax,
      chapters: chapters.length > 0 ? chapters : [{ title: activeChapterTitle, body: activeChapterBody }],
      activeIndex: activeIndex >= 0 ? activeIndex : chapters.length,
      weights: contextWeights,
    });

    const activeBodyTrim = activeChapterBody.trim();
    const hasExistingBody = activeBodyTrim.length > 0;

    let modeInstruction: string;
    if (mode === 'brainstorm') {
      modeInstruction = [
        'MODE: BRAINSTORM — produce a list of short candidates, typically names.',
        'Return ONLY a JSON array of 20 strings, no preamble, no markdown fences, no trailing prose. Example shape: ["First idea", "Second idea", "Third idea"].',
        'Each entry should be SHORT — at most a few words, ideally just a name or short phrase. No descriptions, no explanations inside the entries.',
        'Make the 20 entries varied — mix tones, syllable counts, vibes — so the user has real choice. Avoid duplicates and near-duplicates.',
        'Use the GENERATION PRIORITIES below to decide how strongly to honor the user prompt, chips, and existing rulebook. If the prompt has the highest weight, its style constraints win over the project flavor.',
        'If the user prompt names a kind of thing (e.g. "city names", "faction names", "starter items"), brainstorm that specifically.',
        'When brainstorming city/place names and the user asks for realistic, modern, map-like, or real-world names, avoid fantasy, gothic, mythic, medieval, and epic compound naming unless the prompt explicitly requests that style.',
      ].join('\n');
    } else if (mode === 'rewrite' && hasExistingBody) {
      modeInstruction = [
        `MODE: REWRITE the existing "${activeChapterTitle}" section.`,
        'You MUST preserve every concrete rule, term, value, and named entity from the existing draft verbatim.',
        'You MAY ONLY change wording, sentence structure, paragraph order, and flow.',
        'DO NOT add new rules, new examples, new entities, or new content beyond what the existing draft already says.',
        'DO NOT shorten by dropping rules; if you reorganize, every rule still appears somewhere.',
        'Length should stay within ±15% of the existing draft. Word count target: roughly the same as the input.',
        '',
        'EXISTING TEXT TO REWRITE (output a cleaner version that says the same things):',
        activeBodyTrim,
      ].join('\n');
    } else if (mode === 'expand' && hasExistingBody) {
      modeInstruction = [
        `MODE: EXPAND the existing "${activeChapterTitle}" section.`,
        'You MUST include the existing draft\'s text VERBATIM, word-for-word — every sentence currently in it must appear in your output unchanged.',
        'AFTER reproducing the existing text, ADD new material: missing details, clarifying examples, edge cases, an illustrative scenario, or a quick reference list.',
        'The output should be noticeably LONGER than the input — typically 1.5× to 2.5× the length.',
        'Do not contradict any existing rule. New material must be consistent with what is already there.',
        '',
        'EXISTING TEXT TO PRESERVE AND BUILD ON:',
        activeBodyTrim,
      ].join('\n');
    } else {
      // `draft` mode, or fallback when expand/rewrite were chosen but the
      // section is empty. Ignore any existing body so the user gets a
      // genuine fresh start instead of a near-duplicate.
      modeInstruction = [
        `MODE: FRESH DRAFT of the "${activeChapterTitle}" section.`,
        'IGNORE any text currently in this section. Write a clean, original first draft from scratch, grounded in the rulebook context above (themes, art direction, sibling sections, user guidance).',
        'Do not include or paraphrase the current body — it is a placeholder being replaced wholesale.',
        'Target a focused first draft: 2-4 short paragraphs unless the user asks for more.',
      ].join('\n');
    }

    const priorityBlock = [
      'GENERATION PRIORITIES (0 = ignore, 100 = decisive):',
      `- Rulebook so far: ${contextWeights.rulebook}/100`,
      `- User prompt: ${contextWeights.prompt}/100`,
      `- Theme/style chips: ${contextWeights.chips}/100`,
      'When these sources conflict, follow the higher-weighted source. At 0, treat that source as intentionally disabled.',
    ].join('\n');

    const userHint = userPrompt && contextWeights.prompt > 0
      ? `\n\nADDITIONAL USER GUIDANCE (importance ${contextWeights.prompt}/100):\n${userPrompt}`
      : '';

    const responseFormatInstruction = mode === 'brainstorm'
      ? 'For brainstorm mode, return ONLY the JSON array requested by the task. No preamble, no markdown, no closing remarks.'
      : 'Return ONLY the body text for the requested section. No preamble, no closing remarks, no JSON.';

    const systemPrompt = [
      'You are a co-designer helping a game creator write the rulebook for their tabletop board game.',
      'Write in clean, modern board-game-rulebook prose — concise, instructive, second-person ("you"), and unambiguous.',
      'Match the tone and any terminology already established in other sections of the rulebook.',
      'GROUND every reference to setting, characters, factions, locations, and visual flavor in the project\'s THEMES, ART STYLES, and ART DIRECTION listed in the context block. If the themes say "Cozy forest, Magical garden" the prose should evoke that, not generic fantasy.',
      'Respect the GENERATION PRIORITIES from the user message. User guidance with a higher weight can override project flavor; project flavor with a 0 chip weight should not influence the answer.',
      'PLACEHOLDER CONVENTION: any angle-bracket token containing a short hyphenated descriptor — e.g. <city-name>, <faction>, <character-archetype>, <sacred-item>, <evil-trinket>, <ritual-name> — is a placeholder. REPLACE each with a single specific value that fits the game\'s themes. The angle-bracket marker text must not appear in your output; only the chosen replacement does. Read the descriptor inside the brackets as a hint about what kind of thing to invent. (Do not treat real HTML/markup tokens like </p> or self-closing slashes as placeholders.)',
      'NEVER restate the section title in your output — the heading is already shown above your text.',
      'NEVER use markdown headings (#, ##) or fenced code blocks. Plain paragraphs only, with occasional bulleted lists where they aid clarity.',
      responseFormatInstruction,
    ].join('\n');

    const userMessage = [
      priorityBlock,
      '',
      contextBlock,
      '',
      '---',
      '',
      `TASK: ${modeInstruction}`,
      userHint,
    ].join('\n');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    await supabaseAdmin
      .from('ai_models')
      .upsert({
        provider: 'openrouter',
        model_id: resolvedModel,
        modality: 'text',
        enabled: true,
        tier_min: 'free',
      }, { onConflict: 'provider,model_id' });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: resolvedModel,
        temperature: 0.6,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter request failed (${response.status}): ${errorText.slice(0, 400)}`);
    }

    const responseJson = await response.json();
    const rawContent: string = responseJson?.choices?.[0]?.message?.content ?? '';
    if (!rawContent.trim()) {
      throw new Error('The model returned an empty response. Try again.');
    }

    const promptTokens = toFiniteNumber(responseJson?.usage?.prompt_tokens) ?? 0;
    const completionTokens = toFiniteNumber(responseJson?.usage?.completion_tokens) ?? 0;
    const totalTokens = toFiniteNumber(responseJson?.usage?.total_tokens) ?? (promptTokens + completionTokens);

    const { data: modelRow } = await supabaseAdmin
      .from('ai_models')
      .select('price_meta')
      .eq('provider', 'openrouter')
      .eq('model_id', resolvedModel)
      .maybeSingle();

    const pricing = parsePriceMeta(modelRow?.price_meta);
    const providerCostUsd = pricing
      ? ((promptTokens * pricing.inputPerMillionUsd) + (completionTokens * pricing.outputPerMillionUsd)) / 1_000_000
      : null;
    const providerCostCents = providerCostUsd === null ? 0 : Math.round(providerCostUsd * 100);

    await supabaseAdmin
      .from('ai_usage_ledger')
      .insert({
        user_id: user.id,
        provider: 'openrouter',
        model_id: resolvedModel,
        modality: 'text',
        provider_cost_cents: providerCostCents,
        platform_fee_cents: 0,
        total_charged_cents: providerCostCents,
        request_meta: {
          surface: 'ai-rules-writer',
          activeChapterTitle,
          mode,
          contextWeights,
          chapterCount: chapters.length,
        },
        response_meta: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          pricing_known: Boolean(pricing),
        },
      });

    return new Response(JSON.stringify({
      success: true,
      text: rawContent.trim(),
      model: resolvedModel,
      usage: { promptTokens, completionTokens, totalTokens },
      cost: {
        estimatedCostUsd: providerCostUsd,
        providerCostCents,
        totalChargedCents: providerCostCents,
        pricingKnown: Boolean(pricing),
        currency: 'USD',
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'AI rules writer failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
