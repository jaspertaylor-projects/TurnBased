/** Shapes of the records persisted in the editor's IndexedDB stores. */

import type { EditorProject } from '../types';

/**
 * A version-history commit at rest. Unlike the legacy localStorage record it
 * carries NO file contents and NO project snapshot — `fileHashes` points into
 * the content-addressed blob store, and the project snapshot is derivable
 * from the `turnbased.project.json` blob.
 */
export interface StoredCommitRecord {
  id: string;
  projectId: string;
  commitSha: string;
  message: string;
  createdAt: string;
  changedPaths: string[];
  /** path → sha-256 of the file body in the blob store. */
  fileHashes: Record<string, string>;
  branchName?: string;
  versionNumber?: number;
  parentCommitSha?: string | null;
  syncStatus?: 'local' | 'synced' | 'sync_failed';
  remoteBranchName?: string | null;
  remoteCommitSha?: string | null;
}

export interface StoredWorkspaceRecord {
  projectId: string;
  /** path → sha-256 of the file body in the blob store. */
  fileHashes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectVersionState {
  projectId: string;
  activeBranchName: string;
  activeCommitSha: string | null;
}

/** The legacy localStorage commit shape (pre-IndexedDB), used by migration. */
export interface LegacyGitCommitRecord {
  id: string;
  projectId: string;
  commitSha: string;
  message: string;
  createdAt: string;
  changedPaths: string[];
  files: Record<string, string>;
  projectSnapshot: EditorProject;
  branchName?: string;
  versionNumber?: number;
  parentCommitSha?: string | null;
  syncStatus?: 'local' | 'synced' | 'sync_failed';
  remoteBranchName?: string | null;
  remoteCommitSha?: string | null;
}
