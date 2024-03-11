import { beforeAll, describe, expect, test, vi } from 'vitest';
import { generateUUID } from '$lib/services/utils/strings';

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
