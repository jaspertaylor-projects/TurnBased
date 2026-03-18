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

export interface CommitProjectVersionResult {
  project: EditorProject;
  commit: ProjectGitCommitRecord;
  remoteProjectId: string | null;
  remoteCommitted: boolean;
  remoteError: string | null;
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
  return readStoredCommits()
    .filter((commit) => commit.projectId === projectId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
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
): ProjectGitCommitRecord {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new Error('Add a commit message before creating history.');
  }

  const commits = readStoredCommits();
  const projectCommits = listProjectGitCommits(project.id);
  const head = projectCommits[0] ?? null;
  const files = loadProjectWorkspace(project.id)?.files ?? createWorkspaceFiles(project, runtime);
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

export async function commitProjectVersion(
  project: EditorProject,
  runtime: PreviewRuntime,
  message: string,
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

  const commit = commitProjectToGit(nextProject, runtime, message);

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

export function restoreProjectFromCommit(projectId: string, commitSha: string): EditorProject {
  const commit = listProjectGitCommits(projectId).find((entry) => entry.commitSha === commitSha);
  if (!commit) {
    throw new Error('That commit could not be found.');
  }

  saveProjectWorkspace(projectId, commit.files);
  return ensureProjectManifest(commit.projectSnapshot);
}
