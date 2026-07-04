/**
 * Thin promise wrapper around IndexedDB for the editor's persistence layer.
 *
 * localStorage's ~5MB origin quota is far too small for version history and
 * image assets (see the QuotaExceededError on `turnbased.creator.git`), so
 * everything bulky lives here instead:
 *
 * - `blobs`      — content-addressed file/image contents, keyed by sha-256.
 * - `commits`    — version-history commit records (fileHashes, not contents).
 * - `projectStates` — per-project active branch/commit pointers.
 * - `workspaces` — per-project working-tree file maps (as fileHashes).
 *
 * Only small, hot metadata (the live project list, UI prefs) stays in
 * localStorage.
 */

export const EDITOR_DB_NAME = 'turnbased.creator';
const EDITOR_DB_VERSION = 1;

export const BLOBS_STORE = 'blobs';
export const COMMITS_STORE = 'commits';
export const PROJECT_STATES_STORE = 'projectStates';
export const WORKSPACES_STORE = 'workspaces';
export const COMMITS_PROJECT_INDEX = 'projectId';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openEditorDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(EDITOR_DB_NAME, EDITOR_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE, { keyPath: 'hash' });
      }
      if (!db.objectStoreNames.contains(COMMITS_STORE)) {
        const commits = db.createObjectStore(COMMITS_STORE, { keyPath: 'id' });
        commits.createIndex(COMMITS_PROJECT_INDEX, 'projectId', { unique: false });
      }
      if (!db.objectStoreNames.contains(PROJECT_STATES_STORE)) {
        db.createObjectStore(PROJECT_STATES_STORE, { keyPath: 'projectId' });
      }
      if (!db.objectStoreNames.contains(WORKSPACES_STORE)) {
        db.createObjectStore(WORKSPACES_STORE, { keyPath: 'projectId' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // A future schema bump in another tab closes us out; reopen lazily.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open the editor database.'));
  });
}

export function getEditorDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = openEditorDb().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

export async function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await getEditorDb();
  if (!db) return undefined;
  const store = db.transaction(storeName, 'readonly').objectStore(storeName);
  return requestToPromise(store.get(key) as IDBRequest<T | undefined>);
}

export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await getEditorDb();
  if (!db) return [];
  const store = db.transaction(storeName, 'readonly').objectStore(storeName);
  return requestToPromise(store.getAll() as IDBRequest<T[]>);
}

export async function idbGetAllByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
  const db = await getEditorDb();
  if (!db) return [];
  const index = db.transaction(storeName, 'readonly').objectStore(storeName).index(indexName);
  return requestToPromise(index.getAll(value) as IDBRequest<T[]>);
}

export async function idbPut(storeName: string, value: unknown): Promise<void> {
  const db = await getEditorDb();
  if (!db) return;
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(value);
  await transactionDone(transaction);
}

export async function idbPutMany(storeName: string, values: unknown[]): Promise<void> {
  if (values.length === 0) return;
  const db = await getEditorDb();
  if (!db) return;
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  values.forEach((value) => store.put(value));
  await transactionDone(transaction);
}

export async function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await getEditorDb();
  if (!db) return;
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).delete(key);
  await transactionDone(transaction);
}

export async function idbDeleteMany(storeName: string, keys: IDBValidKey[]): Promise<void> {
  if (keys.length === 0) return;
  const db = await getEditorDb();
  if (!db) return;
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  keys.forEach((key) => store.delete(key));
  await transactionDone(transaction);
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

/** Hex sha-256 of a UTF-8 string — the content address for blob storage. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
