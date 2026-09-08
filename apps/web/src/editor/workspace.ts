/**
 * Per-project working-tree persistence, backed by IndexedDB.
 *
 * File bodies live once in the content-addressed blob store; the workspace
 * record only maps path → hash. The legacy localStorage key
 * (`turnbased.creator.workspaces`) is migrated on first use.
 */

import { getFiles, putFiles } from './persistence/blobStore';
import { WORKSPACES_STORE, idbDelete, idbGet, idbPut } from './persistence/idb';
import { ensureStorageMigrated } from './persistence/migrate';
import type { StoredWorkspaceRecord } from './persistence/records';

export interface ProjectWorkspaceRecord {
  projectId: string;
  files: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export async function loadProjectWorkspace(projectId: string): Promise<ProjectWorkspaceRecord | null> {
  await ensureStorageMigrated();
  const stored = await idbGet<StoredWorkspaceRecord>(WORKSPACES_STORE, projectId);
  if (!stored) {
    return null;
  }

  return {
    projectId: stored.projectId,
    files: await getFiles(stored.fileHashes),
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

async function writeProjectWorkspace(projectId: string, files: Record<string, string>): Promise<ProjectWorkspaceRecord> {
  await ensureStorageMigrated();
  const current = await idbGet<StoredWorkspaceRecord>(WORKSPACES_STORE, projectId);
  const now = new Date().toISOString();
  const record: StoredWorkspaceRecord = {
    projectId,
    fileHashes: await putFiles(files),
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  await idbPut(WORKSPACES_STORE, record);

  return { projectId, files, createdAt: record.createdAt, updatedAt: record.updatedAt };
}

// Workspace renders can hash different amounts of art. Keep their writes in
// request order so a slower older render never replaces a newer working tree.
const workspaceWrites = new Map<string, Promise<unknown>>();
export function saveProjectWorkspace(projectId: string, files: Record<string, string>): Promise<ProjectWorkspaceRecord> {
  const previous = workspaceWrites.get(projectId) ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(() => writeProjectWorkspace(projectId, files));
  workspaceWrites.set(projectId, task);
  void task.finally(() => {
    if (workspaceWrites.get(projectId) === task) workspaceWrites.delete(projectId);
  }).catch(() => undefined);
  return task;
}

export async function deleteProjectWorkspace(projectId: string): Promise<void> {
  await ensureStorageMigrated();
  await idbDelete(WORKSPACES_STORE, projectId);
}
