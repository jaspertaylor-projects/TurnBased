import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const IMAGE_MODEL_COST_CENTS: Record<string, number> = {
  'microsoft/mai-image-2.5': 2,
  'google/gemini-2.5-flash-image': 3,
  'black-forest-labs/flux.2-pro': 5,
};

const DEFAULT_IMAGE_MODEL_ID = 'microsoft/mai-image-2.5';
const OPENROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

function readImageDataUrl(result: Record<string, any>): string {
  const choices = Array.isArray(result?.choices) ? result.choices : [];
  const firstMessage = choices[0]?.message;
  const images = Array.isArray(firstMessage?.images) ? firstMessage.images : [];
  const imageUrl = images[0]?.image_url?.url ?? images[0]?.imageUrl?.url;
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('data:image/')) {
    throw new Error('OpenRouter did not return an image. Try another image model or prompt.');
  }
  return imageUrl;
}

function readDataUrlMetadata(dataUrl: string): { mime: string; sizeBytes: number } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return { mime: 'image/png', sizeBytes: 0 };
  }
  const base64 = match[2];
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const sizeBytes = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  return { mime: match[1], sizeBytes };
}

function getOpenRouterModalities(modelId: string): string[] {
  return modelId.startsWith('google/')
    ? ['image', 'text']
    : ['image'];
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!jwt) throw new Error('Not Authenticated');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser(jwt);
    if (!user) throw new Error('Not Authenticated');

    const body = await req.json();
    const { prompt, projectId } = body;
    const modelId = typeof body?.modelId === 'string' && body.modelId.trim().length > 0
      ? body.modelId.trim()
      : DEFAULT_IMAGE_MODEL_ID;

    if (!prompt || !projectId) throw new Error('Missing input');
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openRouterApiKey) throw new Error('Missing OPENROUTER_API_KEY for image generation.');

    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_id', user.id)
      .single();
    if (projectError || !project) throw new Error('Project not found or unauthorized');

    const providerCostCents = IMAGE_MODEL_COST_CENTS[modelId] ?? IMAGE_MODEL_COST_CENTS[DEFAULT_IMAGE_MODEL_ID];
    const platformFeeCents = providerCostCents;
    const totalChargedCents = providerCostCents + platformFeeCents;

    // MOCK: Require enough wallet balance for Images.
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
    if (!profile) throw new Error('Profile not found');

    if (profile.wallet_cents < totalChargedCents) {
       throw new Error(`Insufficient wallet balance to generate image ($${(totalChargedCents / 100).toFixed(2)}).`);
    }
    const { data: debited, error: debitError } = await supabaseClient.rpc('wallet_debit', {
      amount_cents: totalChargedCents,
    });
    if (debitError) throw new Error(debitError.message);
    if (!debited) {
      throw new Error(`Insufficient wallet balance to generate image ($${(totalChargedCents / 100).toFixed(2)}).`);
    }

    const openRouterResponse = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('PUBLIC_SITE_URL') ?? Deno.env.get('SITE_URL') ?? 'http://localhost:5173',
        'X-Title': 'TurnBased Art Studio',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: 'user',
            content: String(prompt),
          },
        ],
        modalities: getOpenRouterModalities(modelId),
        image_config: {
          aspect_ratio: typeof body?.aspectRatio === 'string' ? body.aspectRatio : '1:1',
          image_size: typeof body?.imageSize === 'string' ? body.imageSize : '1K',
        },
        stream: false,
      }),
    });

    const openRouterResult = await openRouterResponse.json().catch(() => null);
    if (!openRouterResponse.ok) {
      const message = typeof openRouterResult?.error?.message === 'string'
        ? openRouterResult.error.message
        : `OpenRouter image request failed (${openRouterResponse.status})`;
      throw new Error(message);
    }

    const imageDataUrl = readImageDataUrl(openRouterResult ?? {});
    const imageMeta = readDataUrlMetadata(imageDataUrl);
    const generatedR2Key = `${projectId}/openrouter-ai-gen-${Date.now()}.${imageMeta.mime.split('/')[1] ?? 'png'}`;

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseAdmin.from('ai_models').upsert({
        provider: 'openrouter',
        model_id: modelId,
        modality: 'image',
        enabled: true,
        tier_min: 'free',
        price_meta: { flat_cost_cents: providerCostCents },
    }, { onConflict: 'provider,model_id' });

    await supabaseAdmin.from('assets').insert({
        owner_id: user.id,
        project_id: projectId,
        kind: 'image',
        r2_key: generatedR2Key,
        bytes: imageMeta.sizeBytes,
        mime: imageMeta.mime,
        metadata: { ai_prompt: prompt, openrouter_model_id: modelId }
    });
    
    // Log Ledger
    await supabaseAdmin.from('ai_usage_ledger').insert({
        user_id: user.id,
        provider: 'openrouter',
        model_id: modelId,
        modality: 'image',
        provider_cost_cents: providerCostCents,
        platform_fee_cents: platformFeeCents,
        total_charged_cents: totalChargedCents,
        request_meta: { prompt, surface: 'ai-image-agent' },
        response_meta: {
          provider_cost_cents: providerCostCents,
          openrouter_usage: openRouterResult?.usage ?? null,
          image_count: 1,
        },
    });

    return new Response(JSON.stringify({ 
      success: true, 
      r2Key: generatedR2Key,
      imageDataUrl,
      mime: imageMeta.mime,
      sizeBytes: imageMeta.sizeBytes,
      model: modelId,
      cost: {
        providerCostCents,
        platformFeeCents,
        totalChargedCents,
      },
      message: 'Image generated successfully'
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
