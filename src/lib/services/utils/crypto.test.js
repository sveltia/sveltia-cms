import { describe, expect, test } from 'vitest';

import { hmacSha256, toHex } from '$lib/services/utils/crypto';

describe('toHex()', () => {
  test('encodes a Uint8Array', () => {
    expect(toHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe('00010f10ff');
  });

  test('encodes an ArrayBuffer', () => {
    expect(toHex(new Uint8Array([0xab, 0xcd]).buffer)).toBe('abcd');
  });

  test('returns an empty string for no bytes', () => {
    expect(toHex(new Uint8Array())).toBe('');
  });
});

describe('hmacSha256()', () => {
  // RFC 4231 test case 2
  const expected = '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843';

  test('signs with a string key', async () => {
    expect(toHex(await hmacSha256('Jefe', 'what do ya want for nothing?'))).toBe(expected);
  });

  test('signs with a binary key', async () => {
    const key = new TextEncoder().encode('Jefe');

    expect(toHex(await hmacSha256(key, 'what do ya want for nothing?'))).toBe(expected);
  });

  test('returns raw bytes', async () => {
    const signature = await hmacSha256('key', 'data');

    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature).toHaveLength(32);
  });
});
