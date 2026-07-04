/**
 * Content-addressed blob store (real-git semantics for the editor).
 *
 * Every file body and image data URL is stored exactly once in the `blobs`
 * object store, keyed by its sha-256. Commits and workspaces reference blobs
 * by hash, so an unchanged file across fifty commits costs one copy.
 */

import { BLOBS_STORE, idbDeleteMany, idbGetAll, idbPutMany, sha256Hex } from './idb';
import { getEditorDb } from './idb';

interface BlobRecord {
  hash: string;
  content: string;
}

export async function putBlob(content: string): Promise<string> {
  const hash = await sha256Hex(content);
  await idbPutMany(BLOBS_STORE, [{ hash, content } satisfies BlobRecord]);
  return hash;
}

export async function getBlob(hash: string): Promise<string | null> {
  const db = await getEditorDb();
  if (!db) return null;
  const record = await new Promise<BlobRecord | undefined>((resolve, reject) => {
    const request = db.transaction(BLOBS_STORE, 'readonly').objectStore(BLOBS_STORE).get(hash);
    request.onsuccess = () => resolve(request.result as BlobRecord | undefined);
    request.onerror = () => reject(request.error ?? new Error('Could not read blob.'));
  });
  return record?.content ?? null;
}

/** Store a file map; returns path → blob hash. Contents are deduped by hash. */
export async function putFiles(files: Record<string, string>): Promise<Record<string, string>> {
  const entries = await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const hash = await sha256Hex(content);
      return { path, hash, content };
    }),
  );

  const uniqueBlobs = new Map<string, BlobRecord>();
  entries.forEach(({ hash, content }) => uniqueBlobs.set(hash, { hash, content }));
  await idbPutMany(BLOBS_STORE, Array.from(uniqueBlobs.values()));

  return Object.fromEntries(entries.map(({ path, hash }) => [path, hash]));
}

/** Hydrate a path → hash map back into a path → content map. Missing blobs are dropped. */
export async function getFiles(fileHashes: Record<string, string>): Promise<Record<string, string>> {
  const entries = await Promise.all(
    Object.entries(fileHashes).map(async ([path, hash]) => {
      const content = await getBlob(hash);
      return content === null ? null : ([path, content] as const);
    }),
  );
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null));
}

/**
 * Delete every blob not referenced by the given hash set. Callers gather
 * references from all commits + workspaces + live projects before invoking.
 */
export async function garbageCollectBlobs(referencedHashes: Set<string>): Promise<number> {
  const all = await idbGetAll<BlobRecord>(BLOBS_STORE);
  const orphaned = all.filter((blob) => !referencedHashes.has(blob.hash)).map((blob) => blob.hash);
  await idbDeleteMany(BLOBS_STORE, orphaned);
  return orphaned.length;
}
