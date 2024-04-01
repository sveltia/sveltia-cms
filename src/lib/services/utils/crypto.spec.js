import { subtle } from 'crypto';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { generateUUID, getHash } from '$lib/services/utils/crypto';

describe('Test generateUUID()', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: vi.fn().mockReturnValue('9649bc30-4618-42eb-894e-c6441e7810d6') },
    });
  });

  test('variants', () => {
    expect(generateUUID()).toEqual('9649bc30-4618-42eb-894e-c6441e7810d6');
    expect(generateUUID('short')).toEqual('c6441e7810d6');
    expect(generateUUID('shorter')).toEqual('9649bc30');
    expect(generateUUID(12)).toEqual('9649bc304618');
    expect(generateUUID(20)).toEqual('9649bc30461842eb894e');
  });
});

describe('Test getHash()', () => {
  // The Web Crypto API is only available in secure contexts; we need to use the `node:crypto`
  // module to pass these tests
  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: { subtle },
    });
  });

  const string = 'Hello, World!';
  const blob = new Blob([string], { type: 'text/plain' });

  test('SHA-1', async () => {
    const hash = '0a0a9f2a6772942557ab5355d76af442f8f65e01';

    expect(await getHash(string)).toEqual(hash);
    expect(await getHash(blob)).toEqual(hash);
  });

  test('SHA-256', async () => {
    const hash = 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f';

    expect(await getHash(string, { algorithm: 'SHA-256' })).toEqual(hash);
    expect(await getHash(blob, { algorithm: 'SHA-256' })).toEqual(hash);
  });
});
