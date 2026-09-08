import type { EditorProject } from "../types";
import { getBlob, putBlob } from "./blobStore";
import { getEditorDb } from "./idb";
import { deflateProjectImages } from "./imageBlobs";
import { ensureStorageMigrated } from "./migrate";

export const LIVE_PROJECTS_KEY = "turnbased.creator.projects";
interface ProjectPointer {
  storageVersion: 2;
  id: string;
  name: string;
  updatedAt: string;
  snapshotHash: string;
}
export class ProjectReadError extends Error {
  constructor(
    readonly projectId: string | null,
    readonly projectName: string,
    cause: unknown,
  ) {
    const detail = cause instanceof Error ? cause.message : "Its saved data could not be read.";
    super(
      `“${projectName}” could not be opened. ${detail} The saved entry has been kept. Import a backup to recover this game.`,
    );
    this.name = "ProjectReadError";
  }
}

export type ProjectReadErrorHandler = (error: ProjectReadError) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function entryId(entry: unknown): string | null {
  return isRecord(entry) && typeof entry.id === "string" ? entry.id : null;
}

function entryError(entry: unknown, index: number, cause: unknown): ProjectReadError {
  const id = entryId(entry);
  const name =
    isRecord(entry) && typeof entry.name === "string" && entry.name.trim()
      ? entry.name
      : id
        ? `Game ${id}`
        : `Saved game ${index + 1}`;
  return new ProjectReadError(id, name, cause);
}

export function reportProjectReadError(error: ProjectReadError, onError?: ProjectReadErrorHandler): void {
  if (onError) onError(error);
  else console.error("[turnbased] saved game unavailable", error);
}

function isPointer(entry: unknown): entry is ProjectPointer {
  return isRecord(entry) && entry.storageVersion === 2 && typeof entry.snapshotHash === "string";
}

function readEntries(): unknown[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LIVE_PROJECTS_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || !Array.isArray(parsed.projects))
    throw new Error("The saved game index could not be read.");
  return parsed.projects;
}

async function readEntry(entry: unknown): Promise<EditorProject> {
  if (!isRecord(entry) || !entryId(entry)) throw new Error("Its entry in the game index is invalid.");
  let snapshot: unknown = entry;
  if (entry.storageVersion === 2) {
    if (!isPointer(entry) || !entry.snapshotHash) throw new Error("Its saved snapshot reference is invalid.");
    const json = await getBlob(entry.snapshotHash);
    if (!json) throw new Error("Its saved snapshot is missing from this browser.");
    try {
      snapshot = JSON.parse(json);
    } catch {
      throw new Error("Its saved snapshot contains unreadable JSON.");
    }
  }
  if (
    !isRecord(snapshot) ||
    snapshot.id !== entry.id ||
    typeof snapshot.name !== "string" ||
    typeof snapshot.updatedAt !== "string"
  ) {
    throw new Error("Its saved snapshot is not a valid game design.");
  }
  return snapshot as unknown as EditorProject;
}

/** Failed games remain indexed for recovery; intact games can still open. */
export async function readLiveProjects(onError?: ProjectReadErrorHandler): Promise<EditorProject[]> {
  await ensureStorageMigrated();
  const entries = readEntries();
  const results = await Promise.allSettled(entries.map(readEntry));
  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    reportProjectReadError(entryError(entries[index], index, result.reason), onError);
    return [];
  });
}

/** Opening one game never resolves unrelated snapshots. */
export async function readLiveProject(projectId: string): Promise<EditorProject | null> {
  await ensureStorageMigrated();
  const entries = readEntries();
  const index = entries.findIndex((entry) => entryId(entry) === projectId);
  if (index === -1) return null;
  try {
    return await readEntry(entries[index]);
  } catch (cause) {
    throw entryError(entries[index], index, cause);
  }
}

export async function writeLiveProject(project: EditorProject): Promise<void> {
  await ensureStorageMigrated();
  if (!(await getEditorDb()))
    throw new Error("Browser storage is unavailable. Enable site storage to save this game.");
  const deflated = await deflateProjectImages(project);
  const pointer: ProjectPointer = {
    storageVersion: 2,
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    snapshotHash: await putBlob(JSON.stringify(deflated)),
  };
  // Persist the snapshot first; only then replace the small, discoverable index.
  // Old inline projects migrate one at a time without losing other games.
  const entries = readEntries().filter((entry) => entryId(entry) !== project.id);
  window.localStorage.setItem(LIVE_PROJECTS_KEY, JSON.stringify({ projects: [pointer, ...entries] }));
}

export function removeLiveProject(projectId: string): void {
  window.localStorage.setItem(
    LIVE_PROJECTS_KEY,
    JSON.stringify({ projects: readEntries().filter((entry) => entryId(entry) !== projectId) }),
  );
}

export function collectLiveProjectRoots(into: Set<string>): void {
  for (const entry of readEntries()) {
    if (isPointer(entry)) into.add(entry.snapshotHash);
  }
}
