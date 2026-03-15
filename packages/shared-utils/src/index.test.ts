import { describe, expect, it } from 'vitest';

import {
  canonicalDeserialize,
  canonicalSerialize,
  hashValue,
  nonNegativeInt,
} from './index';

describe('canonical serialization', () => {
  it('sorts nested object keys deterministically', () => {
    const value = {
      z: 1,
      a: {
        b: 2,
        a: 1,
      },
    };

    expect(canonicalSerialize(value)).toBe('{"a":{"a":1,"b":2},"z":1}');
  });

  it('produces the same hash for equivalent objects with different key order', () => {
    const left = { a: 1, b: { c: 2, d: 3 } };
    const right = { b: { d: 3, c: 2 }, a: 1 };

    expect(hashValue(left)).toBe(hashValue(right));
  });

  it('round-trips canonical JSON payloads', () => {
    const serialized = canonicalSerialize({ b: 2, a: 1 });

    expect(canonicalDeserialize<Record<string, number>>(serialized)).toEqual({ a: 1, b: 2 });
  });
});

describe('schema helpers', () => {
  it('accepts non-negative integers', () => {
    expect(nonNegativeInt.parse(0)).toBe(0);
  });
});
