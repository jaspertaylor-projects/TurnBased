import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // CORS Check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not Authenticated');

    const { templateId, projectName } = await req.json();
    if (!templateId || !projectName) throw new Error('Missing input');

    // Fetch Template
    const { data: template, error: templateError } = await supabaseClient
      .from('project_templates')
      .select('git_template_repo')
      .eq('id', templateId)
      .single();

    if (templateError || !template) throw new Error('Template not found');

    // Ensure they haven't passed quota (mocked logic for now)
    const { count } = await supabaseClient
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id);

    if (count !== null && count >= 5) {
      throw new Error('Project quota exceeded for this tier');
    }

    // Connect using Service Role to write the internal repo mapping
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Mock Git cloning logic for MVP phase / Phase 2 testing
    const newRepoRef = `user_${user.id.substring(0, 8)}/${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    // Insert Projects Table
    const { data: projectData, error: insertError } = await supabaseAdmin
      .from('projects')
      .insert({
        owner_id: user.id,
        name: projectName,
        template_id: templateId
      })
      .select()
      .single();

    if (insertError) throw new Error('Failed to create project: ' + insertError.message);

    // Insert Project Repos Table
    const { error: repoInsertError } = await supabaseAdmin
      .from('project_repos')
      .insert({
        project_id: projectData.id,
        git_repo_ref: newRepoRef,
        is_private: true
      });

    if (repoInsertError) {
        // Rollback project if repo failed
        await supabaseAdmin.from('projects').delete().eq('id', projectData.id);
        throw new Error('Failed to map repo: ' + repoInsertError.message);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      projectId: projectData.id, 
      gitRef: newRepoRef 
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
