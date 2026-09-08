import { beforeEach, describe, expect, it } from 'vitest';
import { createBlankProject } from '../../apps/web/src/editor/project';
import { createDefaultCardStudio, createCardRow } from '../../apps/web/src/editor/cardStudio/model';
import { buildPreviewRuntime } from '../../apps/web/src/editor/runtime';
import { saveEditorProject, loadEditorProject, deleteEditorProject } from '../../apps/web/src/editor/storage';
import { commitActiveProjectVersion, commitProjectToGit, createProjectVersionBranch, getProjectGitStatus, getProjectVersionGraph, listProjectGitCommits, loadCommitFiles, restoreProjectFromCommit, syncProjectWorkspace } from '../../apps/web/src/editor/git';
import { BLOBS_STORE, COMMITS_STORE, PROJECT_STATES_STORE, WORKSPACES_STORE, getEditorDb, idbDelete, idbGetAll, idbPut } from '../../apps/web/src/editor/persistence/idb';
import { putBlob } from '../../apps/web/src/editor/persistence/blobStore';
import { PROJECT_JSON_PATH } from '../../apps/web/src/editor/persistence/paths';
import { loadProjectWorkspace } from '../../apps/web/src/editor/workspace';
import type { EditorProject } from '../../apps/web/src/editor/types';
import { createDesignArchive, importDesignArchive } from '../../apps/web/src/editor/versions/archive';
import { compareDesigns } from '../../apps/web/src/editor/versions/compare';

async function clearBrowserStorage() {
  window.localStorage.clear();
  const db = await getEditorDb();
  if (db) await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([...db.objectStoreNames], 'readwrite');
    [...db.objectStoreNames].forEach((store) => transaction.objectStore(store).clear());
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

beforeEach(clearBrowserStorage);

const makeProject = () => ({ ...createBlankProject('Woodland workshop'), phase: 'ready' as const });

interface TestArchive {
  version: number;
  activeCommitSha?: string | null;
  project: EditorProject;
  checkpoints: {
    project: EditorProject; name: string; branch: string; savedAt: string;
    sha: string; parentSha: string | null; versionNumber: number;
  }[];
  assets: Record<string, string>;
}

const parseArchive = (text: string) => JSON.parse(text) as TestArchive;
// Persistence treats image bytes as opaque; use the same accepted raster data-URL shape as uploads.
const artwork = (color: string) => `data:image/png;base64,${Buffer.from(color.repeat(900)).toString('base64')}`;
const withArtwork = (project: EditorProject, artUrl: string): EditorProject => ({
  ...project,
  cardStudio: { ...createDefaultCardStudio(), rows: [createCardRow({ title: 'Fox', artUrl }), createCardRow({ title: 'Owl', artUrl })] },
});

async function visibleStorageState() {
  return {
    index: window.localStorage.getItem('turnbased.creator.projects'),
    commits: await idbGetAll(COMMITS_STORE),
    projectStates: await idbGetAll(PROJECT_STATES_STORE),
    workspaces: await idbGetAll(WORKSPACES_STORE),
  };
}

describe('design checkpoint integrity', () => {
  it('captures the live design even while the autosaved workspace is stale', async () => {
    const old = makeProject();
    await syncProjectWorkspace(old, buildPreviewRuntime(old));
    const current = { ...old, name: 'Changed right before Save', cardStudio: { ...createDefaultCardStudio(), rows: [createCardRow({ title: 'Fox', copies: 4 })] } };
    const result = await commitActiveProjectVersion(current, buildPreviewRuntime(current), 'Four fox cards');
    const files = await loadCommitFiles(result.commit);
    const snapshot = JSON.parse(files['turnbased.project.json']);
    expect(snapshot.name).toBe(current.name);
    expect(snapshot.cardStudio.rows[0].copies).toBe(4);
    expect((await getProjectGitStatus(current, buildPreviewRuntime(current))).hasChanges).toBe(false);
  });

  it('compares against the active checkpoint after restoring an older experiment', async () => {
    const first = makeProject();
    const a = await commitActiveProjectVersion(first, buildPreviewRuntime(first), 'Original');
    const second = { ...first, name: 'Alternative design' };
    await createProjectVersionBranch(second, buildPreviewRuntime(second), 'Alternative');
    const restored = await restoreProjectFromCommit(first.id, a.commit.commitSha);
    expect((await getProjectGitStatus(restored, buildPreviewRuntime(restored))).hasChanges).toBe(false);
    expect((await listProjectGitCommits(first.id))).toHaveLength(2);
    await expect(createProjectVersionBranch(restored, buildPreviewRuntime(restored), 'alternative')).rejects.toThrow('already exists');
  });

  it('backs up and imports all checkpoints without replacing the original game', async () => {
    const project = makeProject();
    await saveEditorProject(project);
    await commitActiveProjectVersion(project, buildPreviewRuntime(project), 'First playtest');
    const revised = { ...project, name: 'Revised woodland' };
    await commitActiveProjectVersion(revised, buildPreviewRuntime(revised), 'After feedback');
    const archive = await createDesignArchive(revised);
    const imported = await importDesignArchive(archive);
    expect(imported.id).not.toBe(project.id);
    expect((await listProjectGitCommits(imported.id)).map((entry) => entry.message)).toEqual(['After feedback', 'First playtest']);
    expect((await loadEditorProject(project.id))?.name).toBe(project.name);
    expect((await loadEditorProject(imported.id))?.name).toBe('Revised woodland (imported)');
  });
});

describe('portable artwork and history archives', () => {
  it('preserves the active older checkpoint separately from a dirty working draft', async () => {
    const original = makeProject();
    const first = await commitActiveProjectVersion(original, buildPreviewRuntime(original), 'First idea');
    const alternative = { ...original, description: 'A later alternative' };
    await createProjectVersionBranch(alternative, buildPreviewRuntime(alternative), 'Alternative');
    const restored = await restoreProjectFromCommit(original.id, first.commit.commitSha);
    const draft = { ...restored, description: 'Unsaved improvements to the older idea' };
    await saveEditorProject(draft);
    const archive = await createDesignArchive(draft);
    expect(parseArchive(archive).activeCommitSha).toBe(first.commit.commitSha);
    const imported = await importDesignArchive(archive);
    const graph = await getProjectVersionGraph(imported.id);
    expect(graph.commits.find((commit) => commit.commitSha === graph.activeCommitSha)?.message).toBe('First idea');
    expect(graph.activeBranchName).toBe(first.commit.branchName);
    expect(imported.description).toBe(draft.description);
    expect((await loadEditorProject(imported.id))?.description).toBe(draft.description);
    expect((await getProjectGitStatus(imported, buildPreviewRuntime(imported))).hasChanges).toBe(true);
    const checkpoint = await restoreProjectFromCommit(imported.id, graph.activeCommitSha!);
    expect(checkpoint.description).toBe(original.description);
    expect((await loadEditorProject(original.id))?.description).toBe(draft.description);
  });

  it('deduplicates artwork and restores artwork, dates, branches and independent roots in an empty browser', async () => {
    const green = artwork('green');
    const amber = artwork('goldenrod');
    const original = withArtwork(makeProject(), green);
    const first = await commitProjectToGit(original, buildPreviewRuntime(original), 'Original green cards', {
      branchName: 'main', parentCommitSha: null, createdAt: '2025-01-02T03:04:05.000Z', versionNumber: 1, forceVersionMarker: true,
    });
    const revised = { ...original, cardStudio: { ...original.cardStudio!, rows: original.cardStudio!.rows.map((row, index) => index === 0 ? { ...row, artUrl: amber } : row) } };
    const second = await commitProjectToGit(revised, buildPreviewRuntime(revised), 'Try an amber fox', {
      branchName: 'main', parentCommitSha: first.commitSha, createdAt: '2025-02-03T04:05:06.000Z', versionNumber: 2, forceVersionMarker: true,
    });
    const independent = await commitProjectToGit(original, buildPreviewRuntime(original), 'Independent experiment', {
      branchName: 'fresh-start', parentCommitSha: null, createdAt: '2025-03-04T05:06:07.000Z', versionNumber: 1, forceVersionMarker: true,
    });
    expect(independent.parentCommitSha).toBeNull();
    await saveEditorProject(revised);
    const archiveText = await createDesignArchive(revised);
    const archive = parseArchive(archiveText);
    expect(archive.version).toBe(2);
    expect(Object.values(archive.assets).sort()).toEqual([green, amber].sort());
    expect(archiveText.split(green)).toHaveLength(2);
    expect(archiveText.split(amber)).toHaveLength(2);
    expect(archive.project.cardStudio!.rows.every((row) => row.artUrl.startsWith('idb-image://'))).toBe(true);
    // Accept oldest-first history too: parent links cannot depend on export ordering.
    archive.checkpoints.reverse();
    await clearBrowserStorage();
    const imported = await importDesignArchive(JSON.stringify(archive));
    expect(imported.cardStudio!.rows.map((row) => row.artUrl)).toEqual([amber, green]);
    expect((await loadEditorProject(imported.id))?.cardStudio?.rows.map((row) => row.artUrl)).toEqual([amber, green]);
    const importedCommits = await listProjectGitCommits(imported.id);
    expect(importedCommits).toHaveLength(3);
    for (const old of [first, second, independent]) {
      const checkpoint = importedCommits.find((entry) => entry.message === old.message)!;
      expect(checkpoint.createdAt).toBe(old.createdAt);
      expect(checkpoint.branchName).toBe(old.branchName);
      expect(checkpoint.versionNumber).toBe(old.versionNumber);
      const restored = await restoreProjectFromCommit(imported.id, checkpoint.commitSha);
      expect(restored.cardStudio!.rows.map((row) => row.artUrl)).toEqual(old.message === second.message ? [amber, green] : [green, green]);
    }
    const byName = new Map(importedCommits.map((entry) => [entry.message, entry]));
    expect(byName.get(first.message)!.parentCommitSha).toBeNull();
    expect(byName.get(independent.message)!.parentCommitSha).toBeNull();
    expect(byName.get(second.message)!.parentCommitSha).toBe(byName.get(first.message)!.commitSha);
  });

  it.each(['missing asset', 'changed checksum', 'invalid asset value'] as const)('rejects a %s without adding a visible game or history', async (problem) => {
    const project = withArtwork(makeProject(), artwork('green'));
    await saveEditorProject(project);
    await commitActiveProjectVersion(project, buildPreviewRuntime(project), 'Protected original');
    const archive = parseArchive(await createDesignArchive(project));
    const [hash] = Object.keys(archive.assets);
    if (problem === 'missing asset') delete archive.assets[hash];
    if (problem === 'changed checksum') archive.assets[hash] = artwork('purple');
    if (problem === 'invalid asset value') archive.assets[hash] = 'not an image';
    const before = await visibleStorageState();
    const blobsBefore = await idbGetAll(BLOBS_STORE);
    await expect(importDesignArchive(JSON.stringify(archive))).rejects.toThrow(/artwork|checksum/);
    expect(await visibleStorageState()).toEqual(before);
    expect(await idbGetAll(BLOBS_STORE)).toEqual(blobsBefore);
    expect((await loadEditorProject(project.id))?.cardStudio?.rows[0].artUrl).toBe(project.cardStudio!.rows[0].artUrl);
  });

  it.each(['missing parent', 'parent cycle'] as const)('rolls back an import with a %s even after a valid root was processed', async (problem) => {
    const project = makeProject();
    await saveEditorProject(project);
    await commitActiveProjectVersion(project, buildPreviewRuntime(project), 'Keep this game');
    const archive = parseArchive(await createDesignArchive(project));
    const base = archive.checkpoints[0];
    archive.checkpoints = [
      { ...base, name: 'Valid imported root', sha: 'root', parentSha: null },
      { ...base, name: 'Invalid descendant', sha: 'cycle-a', parentSha: problem === 'missing parent' ? 'absent' : 'cycle-b' },
      ...(problem === 'parent cycle' ? [{ ...base, name: 'Cycle return', sha: 'cycle-b', parentSha: 'cycle-a' }] : []),
    ];
    archive.activeCommitSha = 'root';
    const before = await visibleStorageState();
    await expect(importDesignArchive(JSON.stringify(archive))).rejects.toThrow(/missing|circular/);
    expect(await visibleStorageState()).toEqual(before);
    expect((await loadEditorProject(project.id))?.name).toBe(project.name);
  });

  it.each(['duplicate checkpoint identity', 'invalid active checkpoint'] as const)('rejects %s without changing existing games', async (problem) => {
    const project = makeProject();
    await saveEditorProject(project);
    await commitActiveProjectVersion(project, buildPreviewRuntime(project), 'Original history');
    const archive = parseArchive(await createDesignArchive(project));
    if (problem === 'duplicate checkpoint identity') archive.checkpoints.push({ ...archive.checkpoints[0], name: 'Conflicting duplicate' });
    else archive.activeCommitSha = 'checkpoint-not-in-this-archive';
    const before = await visibleStorageState();
    await expect(importDesignArchive(JSON.stringify(archive))).rejects.toThrow();
    expect(await visibleStorageState()).toEqual(before);
  });

  it('refuses to export a checkpoint whose artwork is absent from browser storage', async () => {
    const project = withArtwork(makeProject(), artwork('green'));
    await commitActiveProjectVersion(project, buildPreviewRuntime(project), 'Art checkpoint');
    const archive = parseArchive(await createDesignArchive(project));
    await idbDelete(BLOBS_STORE, Object.keys(archive.assets)[0]);
    // The live design no longer contains this art, so export must find it in history.
    const current = { ...project, cardStudio: createDefaultCardStudio() };
    await expect(createDesignArchive(current)).rejects.toThrow(/artwork is missing/);
  });
});

describe('failed checkpoint restoration', () => {
  it.each(['missing snapshot', 'invalid JSON', 'wrong game', 'missing seat state'] as const)('keeps the head and workspace unchanged for a %s', async (problem) => {
    const project = makeProject();
    const first = await commitActiveProjectVersion(project, buildPreviewRuntime(project), 'Old checkpoint');
    const latest = { ...project, name: 'Current design' };
    await commitActiveProjectVersion(latest, buildPreviewRuntime(latest), 'Current checkpoint');
    if (problem === 'missing snapshot') {
      const files = { ...first.commit.fileHashes };
      delete files[PROJECT_JSON_PATH];
      await idbPut(COMMITS_STORE, { ...first.commit, fileHashes: files });
    } else {
      const corrupted = problem === 'invalid JSON' ? '{broken JSON' : JSON.stringify(problem === 'wrong game' ? { ...project, id: 'another-game' } : { ...project, seats: null });
      await idbPut(COMMITS_STORE, { ...first.commit, fileHashes: { ...first.commit.fileHashes, [PROJECT_JSON_PATH]: await putBlob(corrupted) } });
    }
    const graphBefore = await getProjectVersionGraph(project.id);
    const workspaceBefore = await loadProjectWorkspace(project.id);
    await expect(restoreProjectFromCommit(project.id, first.commit.commitSha)).rejects.toThrow();
    expect((await getProjectVersionGraph(project.id)).activeCommitSha).toBe(graphBefore.activeCommitSha);
    expect((await getProjectVersionGraph(project.id)).activeBranchName).toBe(graphBefore.activeBranchName);
    expect(await loadProjectWorkspace(project.id)).toEqual(workspaceBefore);
  });

  it('does not replace the current design with a historical snapshot missing its artwork', async () => {
    const project = withArtwork(makeProject(), artwork('green'));
    const first = await commitActiveProjectVersion(project, buildPreviewRuntime(project), 'Original artwork');
    const originalArchive = parseArchive(await createDesignArchive(project));
    const latest = withArtwork(project, artwork('amber'));
    await commitActiveProjectVersion(latest, buildPreviewRuntime(latest), 'Current artwork');
    await idbDelete(BLOBS_STORE, Object.keys(originalArchive.assets)[0]);
    const graphBefore = await getProjectVersionGraph(project.id);
    const workspaceBefore = await loadProjectWorkspace(project.id);
    await expect(restoreProjectFromCommit(project.id, first.commit.commitSha)).rejects.toThrow();
    expect((await getProjectVersionGraph(project.id)).activeCommitSha).toBe(graphBefore.activeCommitSha);
    expect(await loadProjectWorkspace(project.id)).toEqual(workspaceBefore);
  });
});

describe('large game data', () => {
  it('keeps bulk card tables out of localStorage and preserves them on reload', async () => {
    const project = { ...makeProject(), cardStudio: { ...createDefaultCardStudio(), rows: Array.from({ length: 600 }, (_, index) => createCardRow({ title: `Card ${index}`, body: 'A long card description. '.repeat(500) })) } };
    await saveEditorProject(project);
    expect(window.localStorage.getItem('turnbased.creator.projects')!.length).toBeLessThan(1000);
    const loaded = await loadEditorProject(project.id);
    expect(loaded?.cardStudio?.rows).toEqual(project.cardStudio.rows);
  });

  it('reads legacy inline projects and keeps another live game’s images during deletion', async () => {
    const first = makeProject();
    window.localStorage.setItem('turnbased.creator.projects', JSON.stringify({ projects: [first] }));
    expect((await loadEditorProject(first.id))?.name).toBe(first.name);
    const art = `data:image/png;base64,${'a'.repeat(3000)}`;
    const second = { ...makeProject(), cardStudio: { ...createDefaultCardStudio(), rows: [createCardRow({ title: 'Art card', artUrl: art })] } };
    await saveEditorProject(second);
    await deleteEditorProject(first.id);
    expect((await loadEditorProject(second.id))?.cardStudio?.rows[0].artUrl).toBe(art);
    expect(await loadEditorProject(first.id)).toBeNull();
  });

  it('describes real design changes without treating autosave timestamps as changes', () => {
    const project = makeProject();
    expect(compareDesigns(project, { ...project, updatedAt: 'later' })).toEqual([]);
    expect(compareDesigns(project, { ...project, name: 'New name' })[0]).toMatchObject({ area: 'Game', label: 'Name', before: project.name, after: 'New name' });
  });

  it('ignores object key ordering introduced by checkpoint serialization', () => {
    const project = makeProject();
    const reorder = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reorder);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorder(item)]));
      return value;
    };
    expect(compareDesigns(project, reorder(project) as typeof project)).toEqual([]);
  });
});
