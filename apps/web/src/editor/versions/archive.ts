import { generateId } from '@turnbased/shared-utils';
import { getProjectVersionGraph, loadCommitFiles, commitProjectToGit, deleteProjectVersionData, restoreProjectFromCommit } from '../git';
import { collectImageRefHashes, deflateProjectImages, inflateProjectImages } from '../persistence/imageBlobs';
import { getBlob, putBlob } from '../persistence/blobStore';
import { sha256Hex } from '../persistence/idb';
import { PROJECT_JSON_PATH } from '../persistence/paths';
import { buildPreviewRuntime } from '../runtime';
import { saveEditorProject } from '../storage';
import type { EditorProject } from '../types';

const MAX_ARCHIVE_BYTES = 100_000_000;
interface ArchiveCheckpoint {
  project: EditorProject;
  name: string;
  branch?: string;
  sha?: string;
  parentSha?: string | null;
  savedAt?: string;
  versionNumber?: number;
}

export async function createDesignArchive(project: EditorProject): Promise<string> {
  const { commits, activeCommitSha } = await getProjectVersionGraph(project.id);
  if (commits.length > 2000) throw new Error('This export supports up to 2,000 checkpoints. Your history remains safely stored.');
  const checkpoints = await Promise.all(commits.map(async (commit) => {
    const files = await loadCommitFiles(commit);
    const raw = files[PROJECT_JSON_PATH];
    if (!raw) throw new Error(`Checkpoint “${commit.message}” is missing its design data.`);
    return { name: commit.message, branch: commit.branchName, savedAt: commit.createdAt, sha: commit.commitSha, parentSha: commit.parentCommitSha, versionNumber: commit.versionNumber, project: await deflateProjectImages(JSON.parse(raw) as EditorProject) };
  }));
  const deflated = await deflateProjectImages(project);
  const references = new Set<string>();
  collectImageRefHashes(JSON.stringify({ project: deflated, checkpoints }), references);
  const assets: Record<string, string> = {};
  for (const hash of references) {
    const content = await getBlob(hash);
    if (!content) throw new Error('Some artwork is missing from this browser. Restore that artwork before exporting.');
    assets[hash] = content;
  }
  // Artwork is stored once, even when hundreds of checkpoints reference it.
  const text = JSON.stringify({ format: 'turnbased-design-archive', version: 2, exportedAt: new Date().toISOString(), activeCommitSha, project: deflated, checkpoints, assets }, null, 2);
  if (new TextEncoder().encode(text).length > MAX_ARCHIVE_BYTES) throw new Error('The backup exceeds 100 MB. Download your card table and print files separately, or reduce large embedded artwork. Your saved history is unchanged.');
  return text;
}

function validateProject(value: unknown): asserts value is EditorProject {
  if (!value || typeof value !== 'object') throw new Error('The backup has no game design.');
  const p = value as Partial<EditorProject>;
  if (typeof p.name !== 'string' || !p.rules || !Array.isArray(p.rules.chapters) || !Array.isArray(p.rootInstanceIds) || !p.instances || !p.manifest || !Array.isArray(p.seats) || !p.brief || !p.settings || !p.views) {
    throw new Error('This file is not a complete TurnBased game backup.');
  }
}

export async function importDesignArchive(text: string): Promise<EditorProject> {
  if (new TextEncoder().encode(text).length > MAX_ARCHIVE_BYTES) throw new Error('This backup is larger than 100 MB.');
  const archive = JSON.parse(text) as { format?: string; version?: number; activeCommitSha?: string | null; project?: unknown; checkpoints?: ArchiveCheckpoint[]; assets?: Record<string, string> };
  if (archive.format !== 'turnbased-design-archive' || ![1, 2].includes(archive.version ?? 0)) throw new Error('Choose a TurnBased design archive (.json).');
  validateProject(archive.project);
  if (!Array.isArray(archive.checkpoints) || archive.checkpoints.length > 2000) throw new Error('The checkpoint list is missing or too large.');
  archive.checkpoints.forEach((checkpoint) => validateProject(checkpoint.project));
  const checkpointShas = archive.checkpoints.flatMap((checkpoint) => checkpoint.sha ? [checkpoint.sha] : []);
  if (new Set(checkpointShas).size !== checkpointShas.length) throw new Error('The backup contains duplicate checkpoint identifiers.');
  if (archive.activeCommitSha && !checkpointShas.includes(archive.activeCommitSha)) throw new Error('The backup is missing its active checkpoint.');
  const refs = new Set<string>();
  collectImageRefHashes(JSON.stringify({ project: archive.project, checkpoints: archive.checkpoints }), refs);
  for (const hash of refs) {
    const asset = archive.assets?.[hash];
    if (typeof asset !== 'string' || !asset.startsWith('data:') || await sha256Hex(asset) !== hash) throw new Error('The backup is missing artwork or an artwork checksum does not match.');
  }
  for (const hash of refs) await putBlob(archive.assets![hash]);
  const id = generateId('project');
  const detach = (snapshot: EditorProject): EditorProject => ({
    ...snapshot, id, phase: 'ready',
    manifest: { ...snapshot.manifest, remoteProjectId: null, lastBuildId: null, lastPublishedBuildId: null },
  });
  const project = { ...detach(await inflateProjectImages(archive.project)), name: `${archive.project.name} (imported)`, updatedAt: new Date().toISOString() };
  // Validate all executable snapshots before creating any history records.
  buildPreviewRuntime(project);
  const prepared = await Promise.all(archive.checkpoints.map(async (checkpoint) => {
    const snapshot = detach(await inflateProjectImages(checkpoint.project));
    return { checkpoint, snapshot, runtime: buildPreviewRuntime(snapshot) };
  }));
  const shaMap = new Map<string, string>();
  const remaining = [...prepared].reverse();
  try {
    while (remaining.length) {
      const index = remaining.findIndex(({ checkpoint }) => !checkpoint.parentSha || shaMap.has(checkpoint.parentSha));
      if (index < 0) throw new Error('The backup has a missing or circular parent checkpoint.');
      const { checkpoint, snapshot, runtime } = remaining.splice(index, 1)[0];
      const commit = await commitProjectToGit(snapshot, runtime, checkpoint.name || 'Imported checkpoint', {
        branchName: checkpoint.branch,
        parentCommitSha: checkpoint.parentSha ? shaMap.get(checkpoint.parentSha)! : null,
        versionNumber: checkpoint.versionNumber,
        createdAt: checkpoint.savedAt,
        forceVersionMarker: true,
      });
      if (checkpoint.sha) shaMap.set(checkpoint.sha, commit.commitSha);
    }
    if (archive.activeCommitSha) await restoreProjectFromCommit(id, shaMap.get(archive.activeCommitSha)!);
    await saveEditorProject(project);
    return project;
  } catch (error) {
    await deleteProjectVersionData(id);
    throw error;
  }
}
