import { canonicalSerialize, generateId, hashValue } from '@turnbased/shared-utils';

import { ensureProjectManifest } from './manifest';
import { createWorkspaceFiles } from './shipping';
import type { PreviewRuntime } from './types';
import type { EditorProject } from './types';

const GIT_STORAGE_KEY = 'turnbased.creator.git';

export interface ProjectGitCommitRecord {
  id: string;
  projectId: string;
  commitSha: string;
  message: string;
  createdAt: string;
  changedPaths: string[];
  files: Record<string, string>;
  projectSnapshot: EditorProject;
}

interface StoredGitRecords {
  commits: ProjectGitCommitRecord[];
}

export interface ProjectGitStatus {
  changedPaths: string[];
  trackedPaths: string[];
  headCommitSha: string | null;
  hasChanges: boolean;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function readStoredCommits(): ProjectGitCommitRecord[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(GIT_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as StoredGitRecords;
    return parsed.commits ?? [];
  } catch {
    return [];
  }
}

function writeStoredCommits(commits: ProjectGitCommitRecord[]): void {
  const storage = getStorage();
  storage?.setItem(
    GIT_STORAGE_KEY,
    JSON.stringify({
      commits,
    } satisfies StoredGitRecords),
  );
}

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

export function listProjectGitCommits(projectId: string): ProjectGitCommitRecord[] {
  return readStoredCommits()
    .filter((commit) => commit.projectId === projectId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getProjectGitStatus(project: EditorProject, runtime: PreviewRuntime): ProjectGitStatus {
  const commits = listProjectGitCommits(project.id);
  const head = commits[0] ?? null;
  const files = createWorkspaceFiles(project, runtime);
  const changedPaths = diffPaths(files, head?.files ?? null);

  return {
    changedPaths,
    trackedPaths: Object.keys(files).sort((left, right) => left.localeCompare(right)),
    headCommitSha: head?.commitSha ?? null,
    hasChanges: changedPaths.length > 0 || !head,
  };
}

export function commitProjectToGit(
  project: EditorProject,
  runtime: PreviewRuntime,
  message: string,
): ProjectGitCommitRecord {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new Error('Add a commit message before creating history.');
  }

  const commits = readStoredCommits();
  const projectCommits = listProjectGitCommits(project.id);
  const head = projectCommits[0] ?? null;
  const files = createWorkspaceFiles(project, runtime);
  const changedPaths = diffPaths(files, head?.files ?? null);

  if (head && changedPaths.length === 0) {
    throw new Error('There are no workspace changes to commit yet.');
  }

  const createdAt = new Date().toISOString();
  const commit: ProjectGitCommitRecord = {
    id: generateId('commit'),
    projectId: project.id,
    commitSha: toShortCommit(hashValue({
      projectId: project.id,
      createdAt,
      message: trimmedMessage,
      files: canonicalSerialize(files),
    })),
    message: trimmedMessage,
    createdAt,
    changedPaths: changedPaths.length > 0 ? changedPaths : Object.keys(files).sort((left, right) => left.localeCompare(right)),
    files,
    projectSnapshot: ensureProjectManifest(project),
  };

  writeStoredCommits([commit, ...commits.filter((entry) => entry.id !== commit.id)]);
  return commit;
}

export function restoreProjectFromCommit(projectId: string, commitSha: string): EditorProject {
  const commit = listProjectGitCommits(projectId).find((entry) => entry.commitSha === commitSha);
  if (!commit) {
    throw new Error('That commit could not be found.');
  }

  return ensureProjectManifest(commit.projectSnapshot);
}
