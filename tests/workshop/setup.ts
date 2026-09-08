import 'fake-indexeddb/auto';
import { vi } from 'vitest';

const data = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => { data.set(key, String(value)); },
  removeItem: (key: string) => { data.delete(key); },
  clear: () => data.clear(),
  key: (index: number) => [...data.keys()][index] ?? null,
  get length() { return data.size; },
};
vi.stubGlobal('window', { localStorage, addEventListener() {}, removeEventListener() {} });
vi.mock('../../apps/web/src/lib/supabaseClient', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));
