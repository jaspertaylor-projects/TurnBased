import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mock local file state to simulate a Git repository for the MVP frontend
// In a real scenario, this would proxy HTTP requests to Forgejo
const MOCK_REPO_FILES: Record<string, Record<string, string>> = {
  '1': {
    'index.html': '<html><body><h1>My Game</h1></body></html>',
    'src/main.ts': 'console.log("Hello TurnBased");',
    'src/game/reducer.ts': 'export const reducer = (state, action) => state;'
  }
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
    const { action, projectId, path, content, message } = body;

    if (!projectId) throw new Error('Missing projectId');

    // Verify ownership
    const { data: project, error: projError } = await supabaseClient
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_id', user.id)
      .single();

    if (projError || !project) throw new Error('Unauthorized or Project not found');

    // Mock Git proxying logic
    const repo = MOCK_REPO_FILES[projectId] || MOCK_REPO_FILES['1']; // Fallback for mocking

    switch (action) {
      case 'list-tree':
        return new Response(JSON.stringify({ files: Object.keys(repo) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'read-file':
        if (!path || typeof repo[path] !== 'string') throw new Error('File not found');
        return new Response(JSON.stringify({ content: repo[path] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'write-file':
        if (!path || typeof content !== 'string') throw new Error('Invalid write arguments');
        repo[path] = content;
        return new Response(JSON.stringify({ success: true }), {
           headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'commit':
        if (!message) throw new Error('Missing commit message');
        console.log(`Commit simulated: ${message}`);
        return new Response(JSON.stringify({ success: true, commitSha: 'mock-sha-' + Date.now() }), {
           headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      default:
        throw new Error('Unknown action: ' + action);
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
