#!/usr/bin/env node
// Verify the authenticated checkpoint endpoint against the local development stack.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const env = parseEnv(await readFile(new URL('../.env', import.meta.url), 'utf8'));
const url = env.VITE_SUPABASE_URL;
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname), 'This check only uses the local development backend.');
const client = createClient(url, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: auth, error: authError } = await client.auth.signInWithPassword({ email: 'dev@turnbased.local', password: 'dev-local-only' });
assert.ifError(authError);
let projectId;
try {
  const { data: project, error } = await client.from('projects').insert({ owner_id: auth.user.id, name: 'Checkpoint endpoint verification', project_kind: 'engine_first' }).select('id').single();
  assert.ifError(error);
  projectId = project.id;
  const commitSha = 'release-verification-checkpoint';
  const snapshot = { name: 'Checkpoint endpoint verification', description: 'Temporary regression check', manifest: {} };
  const invoke = body => client.functions.invoke('git-proxy', { body });
  const committed = await invoke({ action: 'commit', projectId, commitSha, message: 'Verify authenticated checkpoint', files: { 'rules.md': 'Take one turn.' }, projectSnapshot: snapshot });
  assert.ifError(committed.error);
  assert.equal(committed.data.commitSha, commitSha);
  const history = await invoke({ action: 'history', projectId });
  assert.ifError(history.error);
  assert.equal(history.data.commits[0].commitSha, commitSha);
  const denied = await invoke({ action: 'history', projectId: '00000000-0000-0000-0000-000000000000' });
  assert.ok(denied.error, 'A project the caller does not own must be rejected.');
  const missing = await fetch(`${url}/functions/v1/git-proxy`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: env.VITE_SUPABASE_ANON_KEY }, body: '{}' });
  assert.equal(missing.status, 401);
  console.log('Cloud history API PASS: authenticated commit/history, ownership rejection, missing-auth rejection.');
} finally {
  if (projectId) {
    const { error } = await client.from('projects').delete().eq('id', projectId);
    assert.ifError(error);
  }
  await client.auth.signOut({ scope: 'local' });
}
