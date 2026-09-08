import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const remote = vi.hoisted(() => ({
  session: vi.fn(), invoke: vi.fn(), from: vi.fn(), project: vi.fn(), repo: vi.fn(),
}));
vi.mock('../../apps/web/src/lib/supabaseClient', () => ({
  supabase: { auth: { getSession: remote.session }, functions: { invoke: remote.invoke }, from: remote.from },
}));

import { createBlankProject } from '../../apps/web/src/editor/project';
import { createCardRow, createDefaultCardStudio } from '../../apps/web/src/editor/cardStudio/model';
import { buildPreviewRuntime } from '../../apps/web/src/editor/runtime';
import { commitProjectToGit, commitProjectVersion, getProjectGitStatus, getProjectVersionGraph, listProjectGitCommits, loadCommitFiles, REMOTE_CHECKPOINT_TIMEOUT_MS } from '../../apps/web/src/editor/git';
import { getEditorDb } from '../../apps/web/src/editor/persistence/idb';
import { loadEditorProject, saveEditorProject } from '../../apps/web/src/editor/storage';
import { createDesignArchive, importDesignArchive } from '../../apps/web/src/editor/versions/archive';
import { PROJECT_JSON_PATH } from '../../apps/web/src/editor/persistence/paths';
import type { EditorProject } from '../../apps/web/src/editor/types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const authenticated = { data: { session: { user: { id: 'designer', is_anonymous: false } } } };
const makeProject = (): EditorProject => ({ ...createBlankProject('Moonlit Market'), phase: 'ready' });
const save = (project: EditorProject, name = 'First playable prototype') => commitProjectVersion(project, buildPreviewRuntime(project), name, { forceVersionMarker: true });

beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://local.example');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
  window.localStorage.clear();
  const db = await getEditorDb();
  if (db) await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([...db.objectStoreNames], 'readwrite');
    [...db.objectStoreNames].forEach((store) => transaction.objectStore(store).clear());
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  remote.session.mockResolvedValue(authenticated);
  remote.invoke.mockResolvedValue({ error: null });
  remote.project.mockResolvedValue({ data: { id: 'remote-market' }, error: null });
  remote.repo.mockResolvedValue({ error: null });
  remote.from.mockImplementation((table: string) => table === 'projects' ? {
    insert: () => ({ select: () => ({ abortSignal: (signal: AbortSignal) => ({ single: () => remote.project(signal) }) }) }),
  } : { insert: () => ({ abortSignal: (signal: AbortSignal) => remote.repo(signal) }) });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('local checkpoints with optional remote synchronization', () => {
  it('secures artwork and card data before a never-settling authentication check, then returns within the deadline', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const entered = deferred<void>();
    const auth = deferred<typeof authenticated>();
    remote.session.mockImplementation(() => { entered.resolve(); return auth.promise; });
    const project = makeProject();
    const artUrl = `data:image/png;base64,${'a'.repeat(4096)}`;
    project.cardStudio = { ...createDefaultCardStudio(), rows: [createCardRow({ title: 'Velvet Lantern', cost: '4', copies: 18, artUrl, customFields: { points: '4' } })] };
    const pending = save(project);
    await entered.promise;
    const [local] = await listProjectGitCommits(project.id);
    expect(local.message).toBe('First playable prototype');
    const snapshot = JSON.parse((await loadCommitFiles(local))[PROJECT_JSON_PATH]);
    expect(snapshot.cardStudio.rows[0].copies).toBe(18);
    expect(snapshot.cardStudio.rows[0].artUrl).toMatch(/^idb-image:\/\//);
    await vi.advanceTimersByTimeAsync(REMOTE_CHECKPOINT_TIMEOUT_MS);
    const result = await pending;
    expect(result.project).toBe(project);
    expect(result.remoteCommitted).toBe(false);
    expect(result.remoteError).toContain('within 5 seconds');
    auth.resolve(authenticated);
    await Promise.resolve();
    await Promise.resolve();
    expect(remote.from).not.toHaveBeenCalled();
    expect(remote.invoke).not.toHaveBeenCalled();
    expect((await listProjectGitCommits(project.id))[0].syncStatus).toBe('sync_failed');
  });

  it('keeps a real local checkpoint when authentication is offline', async () => {
    remote.session.mockRejectedValue(new Error('Authentication is offline'));
    const project = makeProject();
    const result = await save(project);
    expect(result.remoteCommitted).toBe(false);
    expect(result.remoteError).toBe('Authentication is offline');
    expect((await getProjectVersionGraph(project.id)).activeCommitSha).toBe(result.commit.commitSha);
    expect(JSON.parse((await loadCommitFiles(result.commit))[PROJECT_JSON_PATH]).name).toBe(project.name);
    expect(remote.invoke).not.toHaveBeenCalled();
  });

  it('aborts slow remote commits and ignores late success without replacing a newer head or draft', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const entered = deferred<AbortSignal>();
    const invocation = deferred<{ error: null }>();
    remote.invoke.mockImplementation((_name, options) => { entered.resolve(options.signal); return invocation.promise; });
    const project = makeProject();
    project.manifest.remoteProjectId = 'existing-remote';
    const pending = save(project);
    const signal = await entered.promise;
    expect((await listProjectGitCommits(project.id))).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(REMOTE_CHECKPOINT_TIMEOUT_MS);
    const result = await pending;
    expect(signal.aborted).toBe(true);
    expect(result.remoteCommitted).toBe(false);
    const newer = { ...project, name: 'A newer local design' };
    const head = await commitProjectToGit(newer, buildPreviewRuntime(newer), 'After the timeout');
    const draft = { ...newer, description: 'A still newer working draft' };
    await saveEditorProject(draft);
    invocation.resolve({ error: null });
    await Promise.resolve();
    await Promise.resolve();
    expect((await getProjectVersionGraph(project.id)).activeCommitSha).toBe(head.commitSha);
    expect((await loadEditorProject(project.id))?.description).toBe(draft.description);
    const old = (await listProjectGitCommits(project.id)).find((entry) => entry.commitSha === result.commit.commitSha);
    expect(old?.syncStatus).toBe('sync_failed');
    expect(old?.remoteCommitSha).toBeNull();
  });

  it('shares one deadline across initialization and upload, retaining the discovered remote link for retry', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const authEntered = deferred<void>();
    const auth = deferred<typeof authenticated>();
    const uploadEntered = deferred<AbortSignal>();
    remote.session.mockImplementation(() => { authEntered.resolve(); return auth.promise; });
    remote.invoke.mockImplementation((_name, options) => { uploadEntered.resolve(options.signal); return new Promise(() => {}); });
    const project = makeProject();
    const pending = save(project);
    await authEntered.promise;
    await vi.advanceTimersByTimeAsync(4000);
    auth.resolve(authenticated);
    const signal = await uploadEntered.promise;
    await vi.advanceTimersByTimeAsync(1000);
    const result = await pending;
    expect(signal.aborted).toBe(true);
    expect(result.remoteProjectId).toBe('remote-market');
    expect(result.project.manifest.remoteProjectId).toBeNull();
    expect((await getProjectGitStatus(project, buildPreviewRuntime(project))).hasChanges).toBe(false);
    remote.invoke.mockResolvedValue({ error: null });
    const retry = await save(project, 'Try remote sync again');
    expect(retry.remoteCommitted).toBe(true);
    expect(remote.project).toHaveBeenCalledTimes(1);
    expect(remote.repo).toHaveBeenCalledTimes(1);
    expect(retry.commit.remoteProjectId).toBe('remote-market');
  });

  it('marks only confirmed remote success and leaves the saved design clean', async () => {
    const project = makeProject();
    const result = await save(project);
    expect(result.remoteCommitted).toBe(true);
    expect(result.remoteError).toBeNull();
    expect(result.project).toBe(project);
    expect(result.commit.syncStatus).toBe('synced');
    expect((await getProjectGitStatus(project, buildPreviewRuntime(project))).hasChanges).toBe(false);
    const [, request] = remote.invoke.mock.calls[0];
    expect(request.body.projectSnapshot).toBe(project);
    expect(request.body.projectId).toBe('remote-market');
    expect(request.body.commitSha).toBe(result.commit.commitSha);
  });

  it('detaches an imported archive from the original cloud project while preserving its design and history', async () => {
    const project = makeProject();
    await save(project);
    const imported = await importDesignArchive(await createDesignArchive(project));
    expect(imported.id).not.toBe(project.id);
    expect(imported.manifest.remoteProjectId).toBeNull();
    const importedCommits = await listProjectGitCommits(imported.id);
    expect(importedCommits).toHaveLength(1);
    expect(importedCommits[0].message).toBe('First playable prototype');
    expect(importedCommits[0].remoteProjectId).toBeUndefined();
    remote.project.mockResolvedValue({ data: { id: 'separate-imported-market' }, error: null });
    const result = await save(imported, 'The imported game can grow separately');
    expect(result.remoteProjectId).toBe('separate-imported-market');
    expect(remote.project).toHaveBeenCalledTimes(2);
    expect((await listProjectGitCommits(project.id))[0].remoteProjectId).toBe('remote-market');
  });
});
