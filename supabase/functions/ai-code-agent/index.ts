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
    const { prompt, modelId, contextFiles } = body;

    if (!prompt || !modelId) throw new Error('Missing input');

    // 1. Verify Model + Tier
    const { data: modelObj, error: modelErr } = await supabaseClient
      .from('ai_models')
      .select('*')
      .eq('model_id', modelId)
      .eq('enabled', true)
      .single();

    if (modelErr || !modelObj) throw new Error('Model not found or disabled');

    // 2. Consume quota (simulating a call to Postgres RPC)
    const { data: quotaAllowed, error: quotaErr } = await supabaseClient.rpc('consume_daily_prompt');
    if (quotaErr || !quotaAllowed) {
       throw new Error('Daily AI prompt quota exceeded. Upgrade to Pro!');
    }

    // 3. Make the OpenRouter API Call
    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openRouterKey) throw new Error('OpenRouter API Key not configured');

    const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: modelObj.model_id,
            messages: [
                { role: 'system', content: 'You are an AI coding agent for a web-based game engine. Return code changes format. Context: ' + JSON.stringify(contextFiles) },
                { role: 'user', content: prompt }
            ]
        })
    });

    if (!apiResponse.ok) {
        throw new Error('Upstream AI API error: ' + apiResponse.statusText);
    }

    const aiData = await apiResponse.json();

    // 4. Log Usage Ledger (via Service Role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Platform fee logic can go here based on tokens in aiData.usage
    await supabaseAdmin.from('ai_usage_ledger').insert({
        user_id: user.id,
        provider: modelObj.provider,
        model_id: modelObj.model_id,
        modality: modelObj.modality,
        platform_fee_cents: 1, // $0.01 fixed markup testing
        request_meta: { tokens_prompt: aiData.usage.prompt_tokens },
        response_meta: { tokens_completion: aiData.usage.completion_tokens }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      suggestion: aiData.choices[0].message.content
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
