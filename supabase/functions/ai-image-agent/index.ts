import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not Authenticated');

    const body = await req.json();
    const { prompt, projectId } = body;

    if (!prompt || !projectId) throw new Error('Missing input');

    // MOCK: Require Pro tier or deduct wallet cents for Images
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
    if (!profile) throw new Error('Profile not found');

    if (profile.tier !== 'pro') {
       if (profile.wallet_cents < 5) {
           throw new Error('Insufficient wallet balance to generate image ($0.05).');
       }
       // Deduct 5 cents
       await supabaseClient.rpc('wallet_debit', { amount_cents: 5 });
    }

    // MOCK: Fal.ai or Recraft request simulation
    await new Promise(r => setTimeout(r, 2000));
    
    // In reality, this downloads the image from Fal and uploads to R2 immediately
    const mockR2Key = `${projectId}/ai-gen-${Date.now()}.png`;

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
        model_id: 'fal-diffusion-mock',
        modality: 'image',
        platform_fee_cents: 2,
        request_meta: { prompt }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      r2Key: mockR2Key,
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
