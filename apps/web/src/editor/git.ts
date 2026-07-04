/**
 * Local version history for editor projects.
 *
 * History lives in IndexedDB (see editor/persistence/): commit records hold a
 * path → sha-256 map into the content-addressed blob store, so unchanged
 * files cost nothing across commits and there is no localStorage quota to
 * blow. Restores rebuild the project from the committed
 * `turnbased.project.json` blob — commits no longer duplicate a project
 * snapshot. When a commit syncs to Supabase it is marked `synced`, and older
 * synced commits beyond a local cap are pruned (the remote copy is the
 * durable one); orphaned blobs are garbage-collected afterwards.
 */

import { canonicalSerialize, generateId, hashValue } from '@turnbased/shared-utils';

import { supabase } from '../lib/supabaseClient';
import { ensureProjectManifest } from './manifest';
import { garbageCollectBlobs, getBlob, getFiles, putFiles } from './persistence/blobStore';
import {
  COMMITS_PROJECT_INDEX,
  COMMITS_STORE,
  PROJECT_STATES_STORE,
  WORKSPACES_STORE,
  idbDelete,
  idbDeleteMany,
  idbGet,
  idbGetAll,
  idbGetAllByIndex,
  idbPut,
} from './persistence/idb';
import { collectImageRefHashes, deflateProjectImages, inflateProjectImages } from './persistence/imageBlobs';
import { ensureStorageMigrated } from './persistence/migrate';
import { PROJECT_JSON_PATH } from './persistence/paths';
import type { ProjectVersionState, StoredCommitRecord, StoredWorkspaceRecord } from './persistence/records';
import { createWorkspaceFiles } from './shipping';
import type { EditorProject, PreviewRuntime } from './types';
import { loadProjectWorkspace, saveProjectWorkspace } from './workspace';

export type ProjectGitCommitRecord = StoredCommitRecord;
export type { ProjectVersionState };

/** How many commits per project stay local once they are safely synced. */
const MAX_LOCAL_COMMITS_PER_PROJECT = 50;

export interface ProjectGitStatus {
  changedPaths: string[];
  trackedPaths: string[];
  headCommitSha: string | null;
  hasChanges: boolean;
}

export interface CommitProjectVersionResult {
  project: EditorProject;
  commit: ProjectGitCommitRecord;
  remoteProjectId: string | null;
  remoteCommitted: boolean;
  remoteError: string | null;
}

export interface ProjectVersionGraph {
  activeBranchName: string;
  activeCommitSha: string | null;
  commits: ProjectGitCommitRecord[];
  branchNames: string[];
}

export const DEFAULT_VERSION_BRANCH_NAME = 'initial musings';

function toShortCommit(hash: number): string {
  return hash.toString(16).padStart(8, '0').slice(0, 8);
}

function diffPaths(nextFiles: Record<string, string>, previousFiles: Record<string, string> | null): string[] {
  const paths = new Set<string>([
    ...Object.keys(nextFiles),
    ...(previousFiles ? Object.keys(previousFiles) : []),
  ]);

  return Array.from(paths)
    .filter((path) => nextFiles[path] !== previousFiles?.[path])
    .sort((left, right) => left.localeCompare(right));
}

function normalizeBranchName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : DEFAULT_VERSION_BRANCH_NAME;
}

function branchSlug(name: string): string {
  const normalized = normalizeBranchName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'version';
}

function normalizeCommitRecord(commit: ProjectGitCommitRecord, index: number, projectCommits: ProjectGitCommitRecord[]): ProjectGitCommitRecord {
  const branchName = normalizeBranchName(commit.branchName ?? DEFAULT_VERSION_BRANCH_NAME);
  const olderOnBranch = projectCommits
    .filter((entry) => normalizeBranchName(entry.branchName ?? DEFAULT_VERSION_BRANCH_NAME) === branchName)
    .filter((entry) => entry.createdAt <= commit.createdAt);

  return {
    ...commit,
    branchName,
    versionNumber: commit.versionNumber ?? Math.max(1, olderOnBranch.length || projectCommits.length - index),
    parentCommitSha: commit.parentCommitSha ?? null,
    syncStatus: commit.syncStatus ?? 'local',
    remoteBranchName: commit.remoteBranchName ?? null,
    remoteCommitSha: commit.remoteCommitSha ?? null,
  };
}

async function readProjectState(projectId: string, commits: ProjectGitCommitRecord[]): Promise<ProjectVersionState> {
  const stored = await idbGet<ProjectVersionState>(PROJECT_STATES_STORE, projectId);
  const latest = commits[0] ?? null;
  return {
    projectId,
    activeBranchName: normalizeBranchName(stored?.activeBranchName ?? latest?.branchName ?? DEFAULT_VERSION_BRANCH_NAME),
    activeCommitSha: stored?.activeCommitSha ?? latest?.commitSha ?? null,
  };
}

function withVersionMarker(
  files: Record<string, string>,
  branchName: string,
  versionNumber: number,
  commitId: string,
  parentCommitSha: string | null,
): Record<string, string> {
  return {
    ...files,
    [`versions/${branchSlug(branchName)}.json`]: canonicalSerialize({
      branchName,
      versionNumber,
      commitId,
      parentCommitSha,
      savedAt: new Date().toISOString(),
    }),
  };
}

function hasSupabaseConfig(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

function slugifyProjectName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'turnbased-project';
}

function withRemoteProjectId(project: EditorProject, remoteProjectId: string): EditorProject {
  if (project.manifest.remoteProjectId === remoteProjectId) {
    return project;
  }

  return ensureProjectManifest({
    ...project,
    manifest: {
      ...project.manifest,
      remoteProjectId,
    },
  });
}

async function ensureRemoteProject(project: EditorProject): Promise<string | null> {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.is_anonymous) {
    return null;
  }

  if (project.manifest.remoteProjectId) {
    return project.manifest.remoteProjectId;
  }

  const { data: projectRow, error: projectError } = await supabase
    .from('projects')
    .insert({
      owner_id: session.user.id,
      name: project.name,
      description: project.description,
      template_id: null,
      project_kind: 'engine_first',
      engine_manifest: project.manifest,
      editor_snapshot: project,
    })
    .select('id')
    .single();

  if (projectError || !projectRow) {
    throw new Error(projectError?.message ?? 'Unable to create the remote project record.');
  }

  const { error: repoError } = await supabase
    .from('project_repos')
    .insert({
      project_id: projectRow.id,
      git_repo_ref: `user_${session.user.id.slice(0, 8)}/${slugifyProjectName(project.name)}-${projectRow.id.slice(0, 8)}`,
      is_private: true,
    });

  if (repoError) {
    throw new Error(repoError.message);
  }

  return projectRow.id;
}

export async function listProjectGitCommits(projectId: string): Promise<ProjectGitCommitRecord[]> {
  await ensureStorageMigrated();
  const projectCommits = (await idbGetAllByIndex<StoredCommitRecord>(COMMITS_STORE, COMMITS_PROJECT_INDEX, projectId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return projectCommits.map((commit, index) => normalizeCommitRecord(commit, index, projectCommits));
}

/** Hydrate the full file map of a commit from the blob store. */
export async function loadCommitFiles(commit: ProjectGitCommitRecord): Promise<Record<string, string>> {
  return getFiles(commit.fileHashes);
}

/** The current workspace files, falling back to a fresh (image-deflated) render of the project. */
async function resolveWorkspaceFiles(project: EditorProject, runtime: PreviewRuntime): Promise<Record<string, string>> {
  const workspace = await loadProjectWorkspace(project.id);
  if (workspace) {
    return workspace.files;
  }
  return createWorkspaceFiles(await deflateProjectImages(project), runtime);
}

/** Render the project to workspace files (image-deflated) and persist them. */
export async function syncProjectWorkspace(project: EditorProject, runtime: PreviewRuntime): Promise<void> {
  const deflated = await deflateProjectImages(project);
  await saveProjectWorkspace(project.id, createWorkspaceFiles(deflated, runtime));
}

export async function getProjectGitStatus(project: EditorProject, runtime: PreviewRuntime): Promise<ProjectGitStatus> {
  const commits = await listProjectGitCommits(project.id);
  const head = commits[0] ?? null;
  const files = await resolveWorkspaceFiles(project, runtime);
  const changedPaths = diffPaths(files, head ? await loadCommitFiles(head) : null);

  return {
    changedPaths,
    trackedPaths: Object.keys(files).sort((left, right) => left.localeCompare(right)),
    headCommitSha: head?.commitSha ?? null,
    hasChanges: changedPaths.length > 0 || !head,
  };
}

async function getNextBranchVersionNumber(projectId: string, branchName: string): Promise<number> {
  const normalized = normalizeBranchName(branchName);
  const existing = (await listProjectGitCommits(projectId))
    .filter((commit) => normalizeBranchName(commit.branchName ?? DEFAULT_VERSION_BRANCH_NAME) === normalized)
    .map((commit) => commit.versionNumber ?? 0);
  return Math.max(0, ...existing) + 1;
}

export async function commitProjectToGit(
  project: EditorProject,
  runtime: PreviewRuntime,
  message: string,
  options: {
    branchName?: string;
    versionNumber?: number;
    parentCommitSha?: string | null;
    forceVersionMarker?: boolean;
  } = {},
): Promise<ProjectGitCommitRecord> {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new Error('Add a commit message before creating history.');
  }

  const projectCommits = await listProjectGitCommits(project.id);
  const state = await readProjectState(project.id, projectCommits);
  const parentCommitSha = options.parentCommitSha ?? state.activeCommitSha ?? projectCommits[0]?.commitSha ?? null;
  const parent = projectCommits.find((commit) => commit.commitSha === parentCommitSha) ?? projectCommits[0] ?? null;
  const branchName = normalizeBranchName(options.branchName ?? state.activeBranchName);
  const versionNumber = options.versionNumber ?? await getNextBranchVersionNumber(project.id, branchName);
  const commitId = generateId('commit');
  const baseFiles = await resolveWorkspaceFiles(project, runtime);
  const files = options.forceVersionMarker
    ? withVersionMarker(baseFiles, branchName, versionNumber, commitId, parentCommitSha)
    : baseFiles;
  const changedPaths = diffPaths(files, parent ? await loadCommitFiles(parent) : null);

  if (parent && changedPaths.length === 0) {
    throw new Error('There are no workspace changes to commit yet.');
  }

  const fileHashes = await putFiles(files);
  const createdAt = new Date().toISOString();
  const commit: ProjectGitCommitRecord = {
    id: commitId,
    projectId: project.id,
    commitSha: toShortCommit(hashValue({
      projectId: project.id,
      createdAt,
      message: trimmedMessage,
      files: canonicalSerialize(fileHashes),
    })),
    message: trimmedMessage,
    createdAt,
    changedPaths: changedPaths.length > 0 ? changedPaths : Object.keys(files).sort((left, right) => left.localeCompare(right)),
    fileHashes,
    branchName,
    versionNumber,
    parentCommitSha,
    syncStatus: 'local',
    remoteBranchName: null,
    remoteCommitSha: null,
  };

  await idbPut(COMMITS_STORE, commit);
  await idbPut(PROJECT_STATES_STORE, {
    projectId: project.id,
    activeBranchName: branchName,
    activeCommitSha: commit.commitSha,
  } satisfies ProjectVersionState);
  await saveProjectWorkspace(project.id, files);
  return commit;
}

export async function commitProjectVersion(
  project: EditorProject,
  runtime: PreviewRuntime,
  message: string,
  options: {
    branchName?: string;
    versionNumber?: number;
    parentCommitSha?: string | null;
    forceVersionMarker?: boolean;
  } = {},
): Promise<CommitProjectVersionResult> {
  let nextProject = project;
  let remoteProjectId: string | null = project.manifest.remoteProjectId;
  let remoteError: string | null = null;

  try {
    const resolvedRemoteProjectId = await ensureRemoteProject(project);
    if (resolvedRemoteProjectId) {
      remoteProjectId = resolvedRemoteProjectId;
      nextProject = withRemoteProjectId(project, resolvedRemoteProjectId);
      const deflated = await deflateProjectImages(nextProject);
      await saveProjectWorkspace(nextProject.id, createWorkspaceFiles(deflated, runtime));
    }
  } catch (error) {
    remoteError = error instanceof Error ? error.message : 'Unable to initialize the remote git project.';
  }

  const commit = await commitProjectToGit(nextProject, runtime, message, options);

  if (remoteProjectId) {
    try {
      // The remote copy must be self-contained: re-inline the project JSON
      // from the in-memory (image-inflated) project so no idb-image:// refs
      // — resolvable only by this browser's IndexedDB — leak into Supabase.
      const files = {
        ...await loadCommitFiles(commit),
        [PROJECT_JSON_PATH]: canonicalSerialize(nextProject),
      };
      const { error } = await supabase.functions.invoke('git-proxy', {
        body: {
          action: 'commit',
          projectId: remoteProjectId,
          message,
          files,
          projectSnapshot: nextProject,
          commitSha: commit.commitSha,
        },
      });

      if (error) {
        throw error;
      }

      commit.syncStatus = 'synced';
      commit.remoteBranchName = commit.branchName ?? null;
      commit.remoteCommitSha = commit.commitSha;
      await idbPut(COMMITS_STORE, commit);
      await pruneSyncedCommits(nextProject.id);
    } catch (error) {
      remoteError = error instanceof Error ? error.message : 'Unable to sync the remote git commit.';
    }
  }

  return {
    project: nextProject,
    commit,
    remoteProjectId,
    remoteCommitted: Boolean(remoteProjectId) && !remoteError,
    remoteError,
  };
}

export async function commitActiveProjectVersion(
  project: EditorProject,
  runtime: PreviewRuntime,
): Promise<CommitProjectVersionResult> {
  const commits = await listProjectGitCommits(project.id);
  const state = await readProjectState(project.id, commits);
  const branchName = normalizeBranchName(state.activeBranchName);
  const versionNumber = await getNextBranchVersionNumber(project.id, branchName);
  return commitProjectVersion(project, runtime, `${branchName} ${versionNumber}`, {
    branchName,
    versionNumber,
    parentCommitSha: state.activeCommitSha,
    forceVersionMarker: true,
  });
}

export async function createProjectVersionBranch(
  project: EditorProject,
  runtime: PreviewRuntime,
  branchName: string,
): Promise<CommitProjectVersionResult> {
  const commits = await listProjectGitCommits(project.id);
  const state = await readProjectState(project.id, commits);
  const normalizedBranchName = normalizeBranchName(branchName);
  return commitProjectVersion(project, runtime, `${normalizedBranchName} 1`, {
    branchName: normalizedBranchName,
    versionNumber: 1,
    parentCommitSha: state.activeCommitSha,
    forceVersionMarker: true,
  });
}

export async function getProjectVersionGraph(projectId: string): Promise<ProjectVersionGraph> {
  const commits = await listProjectGitCommits(projectId);
  const state = await readProjectState(projectId, commits);
  const branchNames = Array.from(new Set([
    state.activeBranchName,
    DEFAULT_VERSION_BRANCH_NAME,
    ...commits.map((commit) => normalizeBranchName(commit.branchName ?? DEFAULT_VERSION_BRANCH_NAME)),
  ]));

  return {
    activeBranchName: state.activeBranchName,
    activeCommitSha: state.activeCommitSha,
    commits,
    branchNames,
  };
}

export async function restoreProjectFromCommit(projectId: string, commitSha: string): Promise<EditorProject> {
  const commit = (await listProjectGitCommits(projectId)).find((entry) => entry.commitSha === commitSha);
  if (!commit) {
    throw new Error('That commit could not be found.');
  }

  const files = await loadCommitFiles(commit);
  const projectJson = files[PROJECT_JSON_PATH];
  if (!projectJson) {
    throw new Error('That commit is missing its project snapshot.');
  }

  await saveProjectWorkspace(projectId, files);
  await idbPut(PROJECT_STATES_STORE, {
    projectId,
    activeBranchName: normalizeBranchName(commit.branchName ?? DEFAULT_VERSION_BRANCH_NAME),
    activeCommitSha: commit.commitSha,
  } satisfies ProjectVersionState);

  const snapshot = JSON.parse(projectJson) as EditorProject;
  return ensureProjectManifest(await inflateProjectImages(snapshot));
}

/** Remove all local version data for a deleted project, then GC blobs. */
export async function deleteProjectVersionData(projectId: string): Promise<void> {
  await ensureStorageMigrated();
  const commits = await idbGetAllByIndex<StoredCommitRecord>(COMMITS_STORE, COMMITS_PROJECT_INDEX, projectId);
  await idbDeleteMany(COMMITS_STORE, commits.map((commit) => commit.id));
  await idbDelete(PROJECT_STATES_STORE, projectId);
  await idbDelete(WORKSPACES_STORE, projectId);
  await garbageCollectOrphanedBlobs();
}

/**
 * Supabase is the durable store once a commit syncs; locally we keep the
 * newest MAX_LOCAL_COMMITS_PER_PROJECT and drop older *synced* commits —
 * never branch heads and never the active commit, so every version in the
 * switcher stays restorable offline.
 */
async function pruneSyncedCommits(projectId: string): Promise<void> {
  const commits = await listProjectGitCommits(projectId);
  if (commits.length <= MAX_LOCAL_COMMITS_PER_PROJECT) {
    return;
  }

  const state = await readProjectState(projectId, commits);
  // Commits arrive newest-first, so the first commit seen per branch is its head.
  const headByBranch = new Map<string, string>();
  commits.forEach((commit) => {
    const branch = normalizeBranchName(commit.branchName ?? DEFAULT_VERSION_BRANCH_NAME);
    if (!headByBranch.has(branch)) {
      headByBranch.set(branch, commit.commitSha);
    }
  });
  const protectedShas = new Set(headByBranch.values());
  if (state.activeCommitSha) {
    protectedShas.add(state.activeCommitSha);
  }

  const prunable = commits
    .slice(MAX_LOCAL_COMMITS_PER_PROJECT)
    .filter((commit) => commit.syncStatus === 'synced' && !protectedShas.has(commit.commitSha));

  if (prunable.length === 0) {
    return;
  }

  await idbDeleteMany(COMMITS_STORE, prunable.map((commit) => commit.id));
  await garbageCollectOrphanedBlobs();
}

/**
 * Delete blobs no longer reachable from any commit, workspace, or the live
 * projects key. Image blobs are referenced indirectly (idb-image:// refs
 * inside serialized project JSON), so root blob contents are scanned one
 * level deep — image blobs themselves are data URLs and contain no refs.
 */
async function garbageCollectOrphanedBlobs(): Promise<void> {
  const referenced = new Set<string>();

  const commits = await idbGetAll<StoredCommitRecord>(COMMITS_STORE);
  commits.forEach((commit) => Object.values(commit.fileHashes).forEach((hash) => referenced.add(hash)));
  const workspaces = await idbGetAll<StoredWorkspaceRecord>(WORKSPACES_STORE);
  workspaces.forEach((workspace) => Object.values(workspace.fileHashes).forEach((hash) => referenced.add(hash)));

  const rootHashes = Array.from(referenced);
  await Promise.all(rootHashes.map(async (hash) => {
    const content = await getBlob(hash);
    if (content) {
      collectImageRefHashes(content, referenced);
    }
  }));

  if (typeof window !== 'undefined') {
    const liveProjects = window.localStorage.getItem('turnbased.creator.projects');
    if (liveProjects) {
      collectImageRefHashes(liveProjects, referenced);
    }
  }

  await garbageCollectBlobs(referenced);
}
