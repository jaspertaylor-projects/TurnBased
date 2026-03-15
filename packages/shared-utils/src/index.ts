// @turnbased/shared-utils
// Zod schemas, serialization helpers, ID generators, hashing utilities

import { z } from 'zod';

// ─── ID Generation ──────────────────────────────────────────────────

let counter = 0;

/**
 * Generate a unique ID with an optional prefix.
 * Uses a combination of timestamp, counter, and random bytes for uniqueness.
 */
export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const count = (counter++).toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}${count}_${random}` : `${timestamp}${count}_${random}`;
}

// ─── Zod Schema Helpers ─────────────────────────────────────────────

/** Zod schema for a non-empty trimmed string */
export const nonEmptyString = z.string().trim().min(1);

/** Zod schema for a branded ID string */
export const idSchema = z.string().trim().min(1);

/** Zod schema for a positive integer */
export const positiveInt = z.number().int().positive();

/** Zod schema for a non-negative integer */
export const nonNegativeInt = z.number().int().nonnegative();

// ─── Serialization ──────────────────────────────────────────────────

/**
 * Canonical JSON serialization — produces deterministic output by sorting keys.
 * Used for hashing and state comparison.
 */
export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val)
        .sort()
        .reduce<Record<string, unknown>>((sorted, key) => {
          sorted[key] = (val as Record<string, unknown>)[key];
          return sorted;
        }, {});
    }
    return val as unknown;
  });
}

/**
 * Parse canonical JSON into a typed value.
 * Useful for replay fixtures and deterministic snapshot loading.
 */
export function canonicalDeserialize<T>(value: string): T {
  return JSON.parse(value) as T;
}

/**
 * Simple deterministic hash of a string (djb2 algorithm).
 * Not cryptographic — used for state fingerprinting and debugging.
 */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Hash any serializable value by canonicalizing then hashing.
 */
export function hashValue(value: unknown): number {
  return hashString(canonicalSerialize(value));
}

// ─── Deep Clone ─────────────────────────────────────────────────────

/**
 * Deep clone a value using structured clone.
 * Falls back to JSON round-trip if structuredClone is not available.
 */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone !== 'undefined') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

// ─── Array Utilities ────────────────────────────────────────────────

/** Shuffle an array in place using the provided random function (for determinism) */
export function shuffleArray<T>(array: T[], randomFn: () => number = Math.random): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/** Remove the first occurrence of a value from an array, returns whether it was found */
export function removeFirst<T>(array: T[], value: T): boolean {
  const index = array.indexOf(value);
  if (index !== -1) {
    array.splice(index, 1);
    return true;
  }
  return false;
}
