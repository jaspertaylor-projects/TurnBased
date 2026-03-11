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
    const { action, projectId, fileName, mime, sizeBytes, r2Key } = body;

    // Verify ownership over the project first
    if (!projectId) throw new Error('Missing project ID');
    const { data: project, error: projErr } = await supabaseClient
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_id', user.id)
      .single();

    if (projErr || !project) throw new Error('Project not found or unauthorized');

    switch (action) {
        case 'sign-upload':
            if (!fileName || !sizeBytes || !mime) throw new Error('Missing file metadata');
            
            // Check storage limit via RPC
            const { data: canUpload, error: rpcErr } = await supabaseClient
                .rpc('increment_storage_usage', { amount_bytes: sizeBytes });
                
            if (rpcErr || !canUpload) {
                throw new Error('Storage quota exceeded');
            }

            // Simulate signing an R2 URL securely
            const simulatedR2Key = `${projectId}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const mockSignedUrl = `https://mock-r2-bucket.play.domain/upload/${simulatedR2Key}?token=mock-sig`;

            return new Response(JSON.stringify({ 
                success: true, 
                uploadUrl: mockSignedUrl, 
                r2Key: simulatedR2Key 
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });

        case 'finalize-upload':
            if (!r2Key || !sizeBytes || !mime) throw new Error('Missing finalize metadata');
            
            // In a real app we would HEAD the object on R2 here to verify the bytes
            // Insert metadata record securely
            
            const supabaseAdmin = createClient(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );

            let kind = 'other';
            if (mime.startsWith('image/')) kind = 'image';
            else if (mime.startsWith('audio/')) kind = 'audio';

            const { data: assetData, error: insertErr } = await supabaseAdmin
                .from('assets')
                .insert({
                    owner_id: user.id,
                    project_id: projectId,
                    kind,
                    r2_key: r2Key,
                    bytes: sizeBytes,
                    mime,
                    visibility: 'private'
                })
                .select()
                .single();

            if (insertErr) throw new Error('Failed to save asset: ' + insertErr.message);

            return new Response(JSON.stringify({ success: true, asset: assetData }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });

        default:
            throw new Error('Unknown asset manager action');
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
