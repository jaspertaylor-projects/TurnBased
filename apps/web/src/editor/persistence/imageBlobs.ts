/**
 * Keeps bulky base64 `data:` URLs (AI-generated art, uploaded images pasted
 * into `imageDataUrl` / `properties.imageUrl` fields) OUT of every serialized
 * project snapshot.
 *
 * At rest, any large data URL is replaced by an `idb-image://<sha256>` ref and
 * the payload lives once in the content-addressed blob store. In memory the
 * project always carries the real data URLs — `inflateProjectImages` resolves
 * refs on load, so renderers and inspectors never see a ref.
 */

import type { EditorProject } from '../types';
import { getBlob, putBlob } from './blobStore';

const IMAGE_REF_PREFIX = 'idb-image://';
/** Below this size a data URL is left inline — not worth an indirection. */
const MIN_DEFLATE_LENGTH = 1024;

function isDeflatableDataUrl(value: string): boolean {
  return value.startsWith('data:') && value.length >= MIN_DEFLATE_LENGTH;
}

export function isImageBlobRef(value: string): boolean {
  return value.startsWith(IMAGE_REF_PREFIX);
}

type Replacer = (value: string) => Promise<string>;

/** Deep-walk any JSON-ish value, rewriting matching strings via `replace`. */
async function walkStrings<T>(value: T, matches: (value: string) => boolean, replace: Replacer): Promise<T> {
  if (typeof value === 'string') {
    return (matches(value) ? await replace(value) : value) as T;
  }
  if (Array.isArray(value)) {
    const next = await Promise.all(value.map((item) => walkStrings(item, matches, replace)));
    return next.every((item, index) => item === value[index]) ? value : (next as T);
  }
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(source)) {
      const nextEntry = await walkStrings(entry, matches, replace);
      if (nextEntry !== entry) changed = true;
      next[key] = nextEntry;
    }
    return changed ? (next as T) : value;
  }
  return value;
}

/** Replace large data URLs with blob refs; the payloads land in IndexedDB. */
export async function deflateProjectImages(project: EditorProject): Promise<EditorProject> {
  return walkStrings(project, isDeflatableDataUrl, async (dataUrl) => {
    const hash = await putBlob(dataUrl);
    return `${IMAGE_REF_PREFIX}${hash}`;
  });
}

/**
 * Resolve blob refs back into data URLs. A ref whose blob is gone (cleared
 * site data, another browser) resolves to '' so image surfaces fall back to
 * their empty states instead of rendering a broken ref string.
 */
export async function inflateProjectImages(project: EditorProject): Promise<EditorProject> {
  return walkStrings(project, isImageBlobRef, async (ref) => {
    const content = await getBlob(ref.slice(IMAGE_REF_PREFIX.length));
    return content ?? '';
  });
}

/** Hashes referenced by a serialized (deflated) project — input for blob GC. */
export function collectImageRefHashes(serialized: string, into: Set<string>): void {
  const pattern = /idb-image:\/\/([0-9a-f]{64})/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(serialized)) !== null) {
    into.add(match[1]);
  }
}
