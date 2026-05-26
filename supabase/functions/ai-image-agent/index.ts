import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const IMAGE_MODEL_COST_CENTS: Record<string, number> = {
  'fal-diffusion-mock': 3,
  'fal-flux-schnell-mock': 3,
  'recraft-image-mock': 4,
};

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
      : 'fal-diffusion-mock';

    if (!prompt || !projectId) throw new Error('Missing input');

    const providerCostCents = IMAGE_MODEL_COST_CENTS[modelId] ?? IMAGE_MODEL_COST_CENTS['fal-diffusion-mock'];
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

    // MOCK: Fal.ai or Recraft request simulation
    await new Promise(r => setTimeout(r, 2000));
    
    // In reality, this downloads the image from Fal and uploads to R2 immediately
    const mockR2Key = `${projectId}/ai-gen-${Date.now()}.png`;

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseAdmin.from('ai_models').upsert({
        provider: 'fal',
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
        r2_key: mockR2Key,
        bytes: 1024 * 500, // mock 500kb
        mime: 'image/png',
        metadata: { ai_prompt: prompt }
    });
    
    // Log Ledger
    await supabaseAdmin.from('ai_usage_ledger').insert({
        user_id: user.id,
        provider: 'fal',
        model_id: modelId,
        modality: 'image',
        provider_cost_cents: providerCostCents,
        platform_fee_cents: platformFeeCents,
        total_charged_cents: totalChargedCents,
        request_meta: { prompt, surface: 'ai-image-agent' },
        response_meta: { mock: true, provider_cost_cents: providerCostCents },
    });

    return new Response(JSON.stringify({ 
      success: true, 
      r2Key: mockR2Key,
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
