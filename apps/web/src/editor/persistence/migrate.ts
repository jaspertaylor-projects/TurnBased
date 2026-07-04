/**
 * One-time migration of the editor's bulky localStorage keys into IndexedDB.
 *
 * The legacy layout stored every commit of every project — each with a full
 * file map AND a full project snapshot — under one localStorage key, which
 * blew the ~5MB origin quota once a project carried base64 images. This
 * migration moves that data into the content-addressed IndexedDB layout and
 * deletes the legacy keys. It runs lazily before the first version-store or
 * workspace operation and is memoized, so concurrent callers share one pass.
 */

import { canonicalSerialize } from '@turnbased/shared-utils';

import { PROJECT_JSON_PATH } from './paths';
import { putFiles } from './blobStore';
import { deflateProjectImages } from './imageBlobs';
import { COMMITS_STORE, PROJECT_STATES_STORE, WORKSPACES_STORE, idbPutMany } from './idb';
import type {
  LegacyGitCommitRecord,
  ProjectVersionState,
  StoredCommitRecord,
  StoredWorkspaceRecord,
} from './records';
import type { EditorProject } from '../types';

const LEGACY_GIT_KEY = 'turnbased.creator.git';
const LEGACY_WORKSPACES_KEY = 'turnbased.creator.workspaces';
const PROJECTS_KEY = 'turnbased.creator.projects';

let migrationPromise: Promise<void> | null = null;

export function ensureStorageMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigration().catch((error) => {
      // Leave the promise memoized: a broken migration should not retry on
      // every storage call, and the new stores still work for new writes.
      console.error('[turnbased] storage migration failed', error);
    });
  }
  return migrationPromise;
}

async function runMigration(): Promise<void> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return;
  }

  await migrateGitHistory();
  await migrateWorkspaces();
  await deflateLiveProjects();
}

async function migrateGitHistory(): Promise<void> {
  const raw = window.localStorage.getItem(LEGACY_GIT_KEY);
  if (!raw) return;

  let parsed: { commits?: LegacyGitCommitRecord[]; projectStates?: ProjectVersionState[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    // The payload is unreadable garbage; nothing to salvage.
    window.localStorage.removeItem(LEGACY_GIT_KEY);
    return;
  }

  const commits: StoredCommitRecord[] = [];
  for (const legacy of parsed.commits ?? []) {
    const files = { ...(legacy.files ?? {}) };
    // New restore reads the project from the project.json blob; ancient
    // commits that somehow lack it get one synthesized from their snapshot.
    if (!files[PROJECT_JSON_PATH] && legacy.projectSnapshot) {
      files[PROJECT_JSON_PATH] = canonicalSerialize(legacy.projectSnapshot);
    }
    const fileHashes = await putFiles(files);
    commits.push({
      id: legacy.id,
      projectId: legacy.projectId,
      commitSha: legacy.commitSha,
      message: legacy.message,
      createdAt: legacy.createdAt,
      changedPaths: legacy.changedPaths ?? [],
      fileHashes,
      branchName: legacy.branchName,
      versionNumber: legacy.versionNumber,
      parentCommitSha: legacy.parentCommitSha ?? null,
      syncStatus: legacy.syncStatus ?? 'local',
      remoteBranchName: legacy.remoteBranchName ?? null,
      remoteCommitSha: legacy.remoteCommitSha ?? null,
    });
  }

  await idbPutMany(COMMITS_STORE, commits);
  await idbPutMany(PROJECT_STATES_STORE, parsed.projectStates ?? []);
  window.localStorage.removeItem(LEGACY_GIT_KEY);
}

async function migrateWorkspaces(): Promise<void> {
  const raw = window.localStorage.getItem(LEGACY_WORKSPACES_KEY);
  if (!raw) return;

  let parsed: { workspaces?: Array<{ projectId: string; files: Record<string, string>; createdAt: string; updatedAt: string }> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(LEGACY_WORKSPACES_KEY);
    return;
  }

  const records: StoredWorkspaceRecord[] = [];
  for (const workspace of parsed.workspaces ?? []) {
    records.push({
      projectId: workspace.projectId,
      fileHashes: await putFiles(workspace.files ?? {}),
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    });
  }

  await idbPutMany(WORKSPACES_STORE, records);
  window.localStorage.removeItem(LEGACY_WORKSPACES_KEY);
}

/**
 * Rewrite the live projects key with image payloads deflated to blob refs so
 * localStorage immediately drops back under quota (the base64 originals move
 * into IndexedDB). Loading inflates them back — see editor/storage.ts.
 */
async function deflateLiveProjects(): Promise<void> {
  const raw = window.localStorage.getItem(PROJECTS_KEY);
  if (!raw || !raw.includes('data:')) return;

  let parsed: { projects?: EditorProject[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  const projects = await Promise.all((parsed.projects ?? []).map((project) => deflateProjectImages(project)));
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify({ projects }));
}
