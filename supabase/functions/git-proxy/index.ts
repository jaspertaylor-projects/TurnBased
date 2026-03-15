import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeFiles(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((accumulator, [path, content]) => {
    accumulator[path] = typeof content === 'string' ? content : JSON.stringify(content);
    return accumulator;
  }, {});
}

function diffPaths(nextFiles: Record<string, string>, previousFiles: Record<string, string>): string[] {
  const paths = new Set<string>([
    ...Object.keys(nextFiles),
    ...Object.keys(previousFiles),
  ]);

  return Array.from(paths)
    .filter((path) => nextFiles[path] !== previousFiles[path])
    .sort((left, right) => left.localeCompare(right));
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
      action,
      projectId,
      path,
      content,
      message,
      files: providedFiles,
      projectSnapshot,
      commitSha,
      limit,
    } = body;

    if (!projectId) throw new Error('Missing projectId');

    // Verify ownership
    const { data: project, error: projError } = await supabaseClient
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_id', user.id)
      .single();

    if (projError || !project) throw new Error('Unauthorized or Project not found');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const normalizedFiles = normalizeFiles(providedFiles);

    const { data: commitRows, error: commitErr } = await supabaseAdmin
      .from('project_git_commits')
      .select('commit_sha, message, changed_paths, files, project_snapshot, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(typeof limit === 'number' ? Math.min(Math.max(limit, 1), 50) : 20);

    if (commitErr) {
      throw new Error('Failed to load git history: ' + commitErr.message);
    }

    const history = commitRows ?? [];
    const head = history[0] ?? null;
    const headFiles = normalizeFiles(head?.files ?? {});

    switch (action) {
      case 'status': {
        const changedPaths = diffPaths(normalizedFiles, headFiles);

        return new Response(JSON.stringify({
          headCommitSha: head?.commit_sha ?? null,
          changedPaths,
          trackedPaths: Object.keys(normalizedFiles).sort((left, right) => left.localeCompare(right)),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'history':
        return new Response(JSON.stringify({
          commits: history.map((entry) => ({
            commitSha: entry.commit_sha,
            message: entry.message,
            changedPaths: entry.changed_paths ?? [],
            createdAt: entry.created_at,
          })),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'list-tree':
        return new Response(JSON.stringify({ files: Object.keys(headFiles).sort((left, right) => left.localeCompare(right)) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'read-file':
        if (!path || typeof headFiles[path] !== 'string') throw new Error('File not found');
        return new Response(JSON.stringify({ content: headFiles[path] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'write-file':
        if (!path || typeof content !== 'string') throw new Error('Invalid write arguments');
        return new Response(JSON.stringify({
          success: true,
          files: {
            ...headFiles,
            [path]: content,
          },
        }), {
           headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      case 'commit': {
        if (!message) throw new Error('Missing commit message');
        if (Object.keys(normalizedFiles).length === 0) throw new Error('Missing files for commit');
        if (!projectSnapshot) throw new Error('Missing project snapshot');

        const changedPaths = diffPaths(normalizedFiles, headFiles);
        if (head && changedPaths.length === 0) {
          throw new Error('No changes to commit.');
        }

        const nextCommitSha = typeof commitSha === 'string' && commitSha.trim().length > 0
          ? commitSha.trim()
          : `mock-sha-${Date.now()}`;

        const { error: insertErr } = await supabaseAdmin
          .from('project_git_commits')
          .insert({
            project_id: projectId,
            commit_sha: nextCommitSha,
            message,
            changed_paths: changedPaths.length > 0 ? changedPaths : Object.keys(normalizedFiles),
            files: normalizedFiles,
            project_snapshot: projectSnapshot,
            created_by: user.id,
          });

        if (insertErr) {
          throw new Error('Failed to store commit: ' + insertErr.message);
        }

        return new Response(JSON.stringify({
          success: true,
          commitSha: nextCommitSha,
          changedPaths,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'revert': {
        if (!commitSha) throw new Error('Missing commitSha');

        const target = history.find((entry) => entry.commit_sha === commitSha);
        if (!target) throw new Error('Commit not found');

        return new Response(JSON.stringify({
          success: true,
          commitSha: target.commit_sha,
          files: normalizeFiles(target.files ?? {}),
          projectSnapshot: target.project_snapshot,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

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
