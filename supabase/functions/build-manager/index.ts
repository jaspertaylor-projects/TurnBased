import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeBuildKind(value: unknown): 'preview' | 'release' {
  return value === 'release' ? 'release' : 'preview';
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
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not Authenticated');

    const body = await req.json();
    const {
      projectId,
      commitSha,
      notes,
      buildManifest,
      compatibilityWarnings,
      projectSnapshot,
      buildKind,
      releaseTitle,
      releaseDescription,
      publishToMarketplace,
      priceCents,
    } = body;

    if (!projectId || !commitSha) throw new Error('Missing input');

    // 1. Verify Project Ownership
    const { data: project, error: projErr } = await supabaseClient
      .from('projects')
      .select('id, name, engine_manifest')
      .eq('id', projectId)
      .eq('owner_id', user.id)
      .single();

    if (projErr || !project) throw new Error('Project not found or unauthorized');

    // 2. Mock R2 Bundling
    // In reality, this edge function would either trigger a build pipeline or accept an already bundled zip from the browser
    // and upload the uncompressed files to Cloudflare R2
    
    // Simulate build delay
    await new Promise(r => setTimeout(r, 2000));
    
    // Generate an R2 prefix path (where the immutable HTML/JS cache is kept)
    const mockR2Prefix = `builds/${projectId}/${commitSha}`;

    // 3. Register the Build inside Postgres via Service Role (to override strict user-insert limits if needed, 
    // though our current policy safely allows explicit inserts. We use service role here mapping the generic admin usage)
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const normalizedBuildKind = normalizeBuildKind(buildKind);
    const resolvedMode = projectSnapshot?.manifest?.capabilities?.mode
      ?? buildManifest?.capabilities?.mode
      ?? project?.engine_manifest?.capabilities?.mode
      ?? 'standard';

    if (normalizedBuildKind === 'release' && publishToMarketplace && resolvedMode === 'experimental') {
      throw new Error('Experimental projects can create release snapshots, but marketplace publishing is disabled for them right now.');
    }

    const { data: buildRecord, error: buildErr } = await supabaseAdmin
        .from('project_builds')
        .insert({
            project_id: projectId,
            commit_sha: commitSha,
            r2_prefix: mockR2Prefix,
            notes: notes || '',
            build_manifest: buildManifest ?? {},
            compatibility_warnings: compatibilityWarnings ?? [],
            project_snapshot: projectSnapshot ?? null,
            build_kind: normalizedBuildKind,
            published_at: normalizedBuildKind === 'release' ? new Date().toISOString() : null,
            release_title: releaseTitle ?? null,
            release_description: releaseDescription ?? null,
            created_by: user.id
        })
        .select()
        .single();

    if (buildErr || !buildRecord) {
        throw new Error('Failed to register build: ' + buildErr?.message);
    }

    let listingId: string | null = null;

    if (normalizedBuildKind === 'release' && publishToMarketplace) {
      const { data: listingRecord, error: listingErr } = await supabaseAdmin
        .from('listings')
        .insert({
          dev_id: user.id,
          project_id: projectId,
          build_id: buildRecord.id,
          title: releaseTitle || project.name,
          description: releaseDescription || notes || null,
          price_cents: Number.isFinite(priceCents) ? Math.max(0, Math.trunc(priceCents)) : 500,
          status: 'published',
        })
        .select('id')
        .single();

      if (listingErr) {
        throw new Error('Failed to create listing: ' + listingErr.message);
      }

      listingId = listingRecord?.id ?? null;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      buildUrl: `https://play.turnbased.dev/${mockR2Prefix}/index.html`,
      buildId: buildRecord.id,
      listingId
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
