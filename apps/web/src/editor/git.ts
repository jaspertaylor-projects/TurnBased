import { canonicalSerialize, generateId, hashValue } from '@turnbased/shared-utils';

import { supabase } from '../lib/supabaseClient';
import { ensureProjectManifest } from './manifest';
import { createWorkspaceFiles } from './shipping';
import type { PreviewRuntime } from './types';
import type { EditorProject } from './types';
import { loadProjectWorkspace, saveProjectWorkspace } from './workspace';

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
  branchName?: string;
  versionNumber?: number;
  parentCommitSha?: string | null;
  syncStatus?: 'local' | 'synced' | 'sync_failed';
  remoteBranchName?: string | null;
  remoteCommitSha?: string | null;
}

interface StoredGitRecords {
  commits: ProjectGitCommitRecord[];
  projectStates?: ProjectVersionState[];
}

export interface ProjectVersionState {
  projectId: string;
  activeBranchName: string;
  activeCommitSha: string | null;
}

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

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function readStoredGitData(): StoredGitRecords {
  const storage = getStorage();
  if (!storage) {
    return { commits: [], projectStates: [] };
  }

  const raw = storage.getItem(GIT_STORAGE_KEY);
  if (!raw) {
    return { commits: [], projectStates: [] };
  }

  try {
    const parsed = JSON.parse(raw) as StoredGitRecords;
    return {
      commits: parsed.commits ?? [],
      projectStates: parsed.projectStates ?? [],
    };
  } catch {
    return { commits: [], projectStates: [] };
  }
}

function readStoredCommits(): ProjectGitCommitRecord[] {
  return readStoredGitData().commits;
}

function writeStoredGitData(data: StoredGitRecords): void {
  const storage = getStorage();
  storage?.setItem(
    GIT_STORAGE_KEY,
    JSON.stringify({
      commits: data.commits,
      projectStates: data.projectStates ?? [],
    } satisfies StoredGitRecords),
  );
}

function writeStoredCommits(commits: ProjectGitCommitRecord[]): void {
  const current = readStoredGitData();
  writeStoredGitData({ ...current, commits });
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

function readProjectState(projectId: string, commits: ProjectGitCommitRecord[]): ProjectVersionState {
  const data = readStoredGitData();
  const stored = data.projectStates?.find((state) => state.projectId === projectId);
  const latest = commits[0] ?? null;
  return {
    projectId,
    activeBranchName: normalizeBranchName(stored?.activeBranchName ?? latest?.branchName ?? DEFAULT_VERSION_BRANCH_NAME),
    activeCommitSha: stored?.activeCommitSha ?? latest?.commitSha ?? null,
  };
}

function writeProjectState(nextState: ProjectVersionState): void {
  const data = readStoredGitData();
  const nextStates = [
    nextState,
    ...(data.projectStates ?? []).filter((state) => state.projectId !== nextState.projectId),
  ];
  writeStoredGitData({ ...data, projectStates: nextStates });
}

function getNextBranchVersionNumber(projectId: string, branchName: string): number {
  const normalized = normalizeBranchName(branchName);
  const existing = listProjectGitCommits(projectId)
    .filter((commit) => normalizeBranchName(commit.branchName ?? DEFAULT_VERSION_BRANCH_NAME) === normalized)
    .map((commit) => commit.versionNumber ?? 0);
  return Math.max(0, ...existing) + 1;
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

export function listProjectGitCommits(projectId: string): ProjectGitCommitRecord[] {
  const projectCommits = readStoredCommits()
    .filter((commit) => commit.projectId === projectId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return projectCommits.map((commit, index) => normalizeCommitRecord(commit, index, projectCommits));
}

export function getProjectGitStatus(project: EditorProject, runtime: PreviewRuntime): ProjectGitStatus {
  const commits = listProjectGitCommits(project.id);
  const head = commits[0] ?? null;
  const files = loadProjectWorkspace(project.id)?.files ?? createWorkspaceFiles(project, runtime);
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
  options: {
    branchName?: string;
    versionNumber?: number;
    parentCommitSha?: string | null;
    forceVersionMarker?: boolean;
  } = {},
): ProjectGitCommitRecord {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new Error('Add a commit message before creating history.');
  }

  const commits = readStoredCommits();
  const projectCommits = listProjectGitCommits(project.id);
  const state = readProjectState(project.id, projectCommits);
  const parentCommitSha = options.parentCommitSha ?? state.activeCommitSha ?? projectCommits[0]?.commitSha ?? null;
  const parent = projectCommits.find((commit) => commit.commitSha === parentCommitSha) ?? projectCommits[0] ?? null;
  const branchName = normalizeBranchName(options.branchName ?? state.activeBranchName);
  const versionNumber = options.versionNumber ?? getNextBranchVersionNumber(project.id, branchName);
  const commitId = generateId('commit');
  const baseFiles = loadProjectWorkspace(project.id)?.files ?? createWorkspaceFiles(project, runtime);
  const files = options.forceVersionMarker
    ? withVersionMarker(baseFiles, branchName, versionNumber, commitId, parentCommitSha)
    : baseFiles;
  const changedPaths = diffPaths(files, parent?.files ?? null);

  if (parent && changedPaths.length === 0) {
    throw new Error('There are no workspace changes to commit yet.');
  }

  const createdAt = new Date().toISOString();
  const commit: ProjectGitCommitRecord = {
    id: commitId,
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
    branchName,
    versionNumber,
    parentCommitSha,
    syncStatus: 'local',
    remoteBranchName: null,
    remoteCommitSha: null,
  };

  writeStoredCommits([commit, ...commits.filter((entry) => entry.id !== commit.id)]);
  writeProjectState({
    projectId: project.id,
    activeBranchName: branchName,
    activeCommitSha: commit.commitSha,
  });
  saveProjectWorkspace(project.id, files);
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
      saveProjectWorkspace(nextProject.id, createWorkspaceFiles(nextProject, runtime));
    }
  } catch (error) {
    remoteError = error instanceof Error ? error.message : 'Unable to initialize the remote git project.';
  }

  const commit = commitProjectToGit(nextProject, runtime, message, options);

  if (remoteProjectId) {
    try {
      const files = loadProjectWorkspace(nextProject.id)?.files ?? createWorkspaceFiles(nextProject, runtime);
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
  const commits = listProjectGitCommits(project.id);
  const state = readProjectState(project.id, commits);
  const branchName = normalizeBranchName(state.activeBranchName);
  const versionNumber = getNextBranchVersionNumber(project.id, branchName);
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
  const commits = listProjectGitCommits(project.id);
  const state = readProjectState(project.id, commits);
  const normalizedBranchName = normalizeBranchName(branchName);
  return commitProjectVersion(project, runtime, `${normalizedBranchName} 1`, {
    branchName: normalizedBranchName,
    versionNumber: 1,
    parentCommitSha: state.activeCommitSha,
    forceVersionMarker: true,
  });
}

export function getProjectVersionGraph(projectId: string): ProjectVersionGraph {
  const commits = listProjectGitCommits(projectId);
  const state = readProjectState(projectId, commits);
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

export function restoreProjectFromCommit(projectId: string, commitSha: string): EditorProject {
  const commit = listProjectGitCommits(projectId).find((entry) => entry.commitSha === commitSha);
  if (!commit) {
    throw new Error('That commit could not be found.');
  }

  saveProjectWorkspace(projectId, commit.files);
  writeProjectState({
    projectId,
    activeBranchName: normalizeBranchName(commit.branchName ?? DEFAULT_VERSION_BRANCH_NAME),
    activeCommitSha: commit.commitSha,
  });
  return ensureProjectManifest(commit.projectSnapshot);
}
