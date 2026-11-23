import { describe, expect, it } from 'vitest';

import { compareBytes, concatBytes, textDecoder, textEncoder } from '$lib/services/utils/bytes';

describe('textEncoder / textDecoder', () => {
  it('should round-trip UTF-8 text', () => {
    expect(textDecoder.decode(textEncoder.encode('é日'))).toBe('é日');
  });
});

describe('compareBytes()', () => {
  it('should compare byte by byte, then by length', () => {
    expect(compareBytes(Uint8Array.of(1, 2), Uint8Array.of(1, 3))).toBeLessThan(0);
    expect(compareBytes(Uint8Array.of(2), Uint8Array.of(1, 9))).toBeGreaterThan(0);
    expect(compareBytes(Uint8Array.of(1), Uint8Array.of(1, 0))).toBeLessThan(0);
    expect(compareBytes(Uint8Array.of(1, 2), Uint8Array.of(1, 2))).toBe(0);
  });
});

describe('concatBytes()', () => {
  it('should join byte arrays', () => {
    expect([...concatBytes([Uint8Array.of(1), Uint8Array.of(), Uint8Array.of(2, 3)])]).toEqual([
      1, 2, 3,
    ]);
    expect([...concatBytes([])]).toEqual([]);
  });
});
