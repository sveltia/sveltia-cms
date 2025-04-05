import { describe, expect, test } from 'vitest';
import { calculateResize } from '$lib/services/utils/media/image';

describe('Test calculateResize()', () => {
  test('scale-down', () => {
    const landscapeTarget = { width: 1024, height: 768 };
    const portraitTarget = { width: 768, height: 1024 };

    expect(
      calculateResize({ width: 1024, height: 768 }, { ...landscapeTarget, fit: 'scale-down' }),
    ).toEqual({
      scale: 1,
      width: 1024,
      height: 768,
    });
    expect(
      calculateResize({ width: 2048, height: 1536 }, { ...landscapeTarget, fit: 'scale-down' }),
    ).toEqual({
      scale: 0.5,
      width: 1024,
      height: 768,
    });
    expect(
      calculateResize({ width: 800, height: 600 }, { ...landscapeTarget, fit: 'scale-down' }),
    ).toEqual({
      scale: 1,
      width: 800,
      height: 600,
    });

    expect(
      calculateResize({ width: 1024, height: 768 }, { ...portraitTarget, fit: 'scale-down' }),
    ).toEqual({
      scale: 1,
      width: 1024,
      height: 768,
    });
    expect(
      calculateResize({ width: 2048, height: 1536 }, { ...portraitTarget, fit: 'scale-down' }),
    ).toEqual({
      scale: 0.5,
      width: 1024,
      height: 768,
    });
    expect(
      calculateResize({ width: 800, height: 600 }, { ...portraitTarget, fit: 'scale-down' }),
    ).toEqual({
      scale: 1,
      width: 800,
      height: 600,
    });
  });
});
