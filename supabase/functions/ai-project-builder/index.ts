import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export const corsHeaders = {
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
  if (!isRecord(value)) {
    return null;
  }

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

  if (inputPerMillionUsd === null || outputPerMillionUsd === null) {
    return null;
  }

  return {
    inputPerMillionUsd,
    outputPerMillionUsd,
  };
}

function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('The AI response did not contain a JSON object.');
  }

  return text.slice(start, end + 1);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
      },
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not Authenticated');
    }

    const { brief, promptPack, modelId } = await req.json();
    if (!isRecord(brief) || !isRecord(promptPack)) {
      throw new Error('Missing brief or prompt pack');
    }

    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openRouterKey) {
      throw new Error('OpenRouter API Key not configured');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const resolvedModel = typeof modelId === 'string' && modelId.trim().length > 0
      ? modelId.trim()
      : Deno.env.get('OPENROUTER_BUILD_MODEL')?.trim()
        || Deno.env.get('OPENROUTER_DEFAULT_MODEL')?.trim()
        || 'openai/gpt-4o-mini';

    await supabaseAdmin
      .from('ai_models')
      .upsert({
        provider: 'openrouter',
        model_id: resolvedModel,
        modality: 'code',
        enabled: true,
        tier_min: 'free',
      }, {
        onConflict: 'provider,model_id',
      });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: resolvedModel,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content: [
              'You generate JSON blueprints for TurnBased engine-first game projects.',
              'Return JSON only. Do not use markdown fences.',
              'Follow the prompt pack exactly and prefer the simplest previewable interpretation.',
              'Use built-in components, a shared board view, a player summary strip, and one linked player view per seat unless the brief strongly suggests otherwise.',
              'Every seat should start with 6 block resources in a personal area and use a Lucide-first icon key when no custom avatar exists.',
              'The initial state must support at least one legal move for the active player.',
              'Allowed JSON shape:',
              JSON.stringify({
                projectName: 'string',
                description: 'string',
                rulesText: 'string',
                designerNotes: ['string'],
                playerRange: {
                  min: 2,
                  max: 4,
                  hasDistinctSoloMode: false,
                  isCampaignGame: false,
                },
                playerIdentities: [
                  {
                    seatId: 'player_1',
                    badgeLabel: '1',
                    iconKey: 'crown',
                    color: '#f97316',
                    resourceLabel: 'Blocks',
                    startingBlocks: 6,
                  },
                ],
                views: {
                  defaultViewId: 'view_shared_board',
                  selectedViewId: 'view_shared_board',
                  sharedView: {
                    label: 'Main Board',
                    description: 'Shared board shell with the player summary strip visible.',
                  },
                  playerViews: [
                    {
                      seatId: 'player_1',
                      label: 'Player 1 View',
                      description: 'Linked personal view for player 1.',
                    },
                  ],
                },
                appLayout: {
                  shellTitle: 'string',
                  introText: 'string',
                  hudItems: ['Turn tracker', 'Blocks', 'Active player'],
                  sidePanels: ['Rules', 'Players', 'Board context'],
                  primaryActionLabel: 'Place block',
                  summaryStripLabel: 'Players',
                  linkedViewLabel: 'Linked Views',
                  resourceSummaryLabel: 'Blocks',
                  navigationMode: 'summary_strip',
                  avatarStyle: 'lucide',
                },
                board: {
                  label: 'string',
                  layout: 'grid',
                  width: 3,
                  height: 3,
                  spaceCount: 9,
                  spaceLabels: ['North Grove', 'Center Grove'],
                  terrainPattern: ['plain', 'forest'],
                },
                playerAreas: [
                  {
                    ownerId: 'player_1',
                    reserveLabel: 'Player 1 Blocks',
                    startingPieces: 6,
                    pieceLabelPrefix: 'Block',
                    pieceType: 'piece',
                  },
                ],
                sharedZones: [
                  {
                    label: 'Market Row',
                    ownerId: null,
                    maxCapacity: 6,
                    pieceCount: 0,
                    pieceLabelPrefix: 'Market',
                    pieceType: 'token',
                  },
                ],
              }),
            ].join('\n'),
          },
          {
            role: 'user',
            content: JSON.stringify({
              brief,
              promptPack,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error('Upstream AI API error: ' + response.statusText);
    }

    const responseJson = await response.json();
    const rawContent = responseJson?.choices?.[0]?.message?.content;
    if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
      throw new Error('The AI provider returned an empty build response.');
    }

    const promptTokens = toFiniteNumber(responseJson?.usage?.prompt_tokens) ?? 0;
    const completionTokens = toFiniteNumber(responseJson?.usage?.completion_tokens) ?? 0;
    const totalTokens = toFiniteNumber(responseJson?.usage?.total_tokens) ?? (promptTokens + completionTokens);
    const blueprint = JSON.parse(extractJsonObject(rawContent));

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
    const platformFeeCents = 0;
    const totalChargedCents = providerCostCents + platformFeeCents;

    await supabaseAdmin
      .from('ai_usage_ledger')
      .insert({
        user_id: user.id,
        provider: 'openrouter',
        model_id: resolvedModel,
        modality: 'code',
        provider_cost_cents: providerCostCents,
        platform_fee_cents: platformFeeCents,
        total_charged_cents: totalChargedCents,
        request_meta: {
          promptPackSummary: {
            componentCount: Array.isArray(promptPack.componentCatalog) ? promptPack.componentCatalog.length : 0,
            acceptanceChecks: Array.isArray(promptPack.acceptanceChecklist) ? promptPack.acceptanceChecklist.length : 0,
          },
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
      blueprint,
      model: resolvedModel,
      rawResponse: rawContent,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
      },
      cost: {
        estimatedCostUsd: providerCostUsd,
        providerCostCents,
        platformFeeCents,
        totalChargedCents,
        pricingKnown: Boolean(pricing),
        currency: 'USD',
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
