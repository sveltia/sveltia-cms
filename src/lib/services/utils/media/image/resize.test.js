import { describe, expect, test } from 'vitest';

import { calculateResize, resizeCanvas } from '$lib/services/utils/media/image/resize';

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
      scale: 0.75,
      width: 768,
      height: 576,
    });
    expect(
      calculateResize({ width: 2048, height: 1536 }, { ...portraitTarget, fit: 'scale-down' }),
    ).toEqual({
      scale: 0.375,
      width: 768,
      height: 576,
    });
    expect(
      calculateResize({ width: 800, height: 600 }, { ...portraitTarget, fit: 'scale-down' }),
    ).toEqual({
      scale: 0.96,
      width: 768,
      height: 576,
    });
  });

  test('contain fit option', () => {
    // Landscape image in landscape target
    expect(
      calculateResize({ width: 200, height: 100 }, { width: 100, height: 50, fit: 'contain' }),
    ).toEqual({
      scale: 0.5,
      width: 100,
      height: 50,
    });

    // Portrait image in portrait target
    expect(
      calculateResize({ width: 100, height: 200 }, { width: 50, height: 100, fit: 'contain' }),
    ).toEqual({
      scale: 0.5,
      width: 50,
      height: 100,
    });

    // Portrait image in landscape target (targetWidth > targetHeight)
    expect(
      calculateResize({ width: 100, height: 200 }, { width: 100, height: 50, fit: 'contain' }),
    ).toEqual({
      scale: 0.25,
      width: 25,
      height: 50,
    });
  });

  test('scale-down converted to contain', () => {
    // Larger landscape image with landscape target - fits scale-down to contain
    expect(
      calculateResize(
        { width: 2048, height: 1536 },
        { width: 1024, height: 768, fit: 'scale-down' },
      ),
    ).toEqual({
      scale: 0.5,
      width: 1024,
      height: 768,
    });

    // Larger portrait image with portrait target - fits scale-down to contain
    expect(
      calculateResize(
        { width: 1536, height: 2048 },
        { width: 768, height: 1024, fit: 'scale-down' },
      ),
    ).toEqual({
      scale: 0.5,
      width: 768,
      height: 1024,
    });

    // Larger portrait image in landscape target - scale-down converts to contain
    expect(
      calculateResize({ width: 200, height: 400 }, { width: 300, height: 100, fit: 'scale-down' }),
    ).toEqual({
      scale: 0.25,
      width: 50,
      height: 100,
    });
  });

  test('only width exceeds target (issue #701)', () => {
    // 4000x2000 with 2560x2560 target — only width exceeds, should still resize
    expect(
      calculateResize(
        { width: 4000, height: 2000 },
        { width: 2560, height: 2560, fit: 'scale-down' },
      ),
    ).toEqual({
      scale: 0.64,
      width: 2560,
      height: 1280,
    });
  });

  test('only height exceeds target', () => {
    // 2000x4000 with 2560x2560 target — only height exceeds, should still resize
    expect(
      calculateResize(
        { width: 2000, height: 4000 },
        { width: 2560, height: 2560, fit: 'scale-down' },
      ),
    ).toEqual({
      scale: 0.64,
      width: 1280,
      height: 2560,
    });
  });

  test('square target with non-square image', () => {
    // Landscape in square target
    expect(
      calculateResize({ width: 400, height: 200 }, { width: 100, height: 100, fit: 'contain' }),
    ).toEqual({
      scale: 0.25,
      width: 100,
      height: 50,
    });

    // Portrait in square target
    expect(
      calculateResize({ width: 200, height: 400 }, { width: 100, height: 100, fit: 'contain' }),
    ).toEqual({
      scale: 0.25,
      width: 50,
      height: 100,
    });
  });

  test('landscape image in portrait target with contain', () => {
    expect(
      calculateResize({ width: 400, height: 200 }, { width: 100, height: 300, fit: 'contain' }),
    ).toEqual({
      scale: 0.25,
      width: 100,
      height: 50,
    });
  });

  test('default parameters', () => {
    const source = { width: 100, height: 50 };

    // No target provided - should return original
    expect(calculateResize(source)).toEqual({
      scale: 1,
      width: 100,
      height: 50,
    });

    // Empty target - should use defaults
    expect(calculateResize(source, {})).toEqual({
      scale: 1,
      width: 100,
      height: 50,
    });

    // Unknown fit option - should return with scale 1 and newWidth/newHeight as 0
    expect(
      calculateResize(
        { width: 100, height: 50 },
        { width: 50, height: 25, fit: /** @type {'contain'} */ ('unknown') },
      ),
    ).toEqual({
      scale: 1,
      width: 0,
      height: 0,
    });
  });

  test('same dimensions check', () => {
    const source = { width: 100, height: 100 };
    const target = { width: 100, height: 100 };

    expect(calculateResize(source, target)).toEqual({
      scale: 1,
      width: 100,
      height: 100,
    });
  });
});

describe('Test resizeCanvas()', () => {
  test('should resize HTMLCanvasElement', () => {
    const mockCanvas = /** @type {any} */ ({
      width: 0,
      height: 0,
    });

    const source = { width: 200, height: 100 };
    const target = { width: 100, height: 50, fit: /** @type {'contain'} */ ('contain') };
    const result = resizeCanvas(mockCanvas, source, target);

    expect(mockCanvas.width).toBe(100);
    expect(mockCanvas.height).toBe(50);
    expect(result).toEqual({ scale: 0.5, width: 100, height: 50 });
  });

  test('should resize OffscreenCanvas', () => {
    const mockOffscreenCanvas = /** @type {any} */ ({
      width: 0,
      height: 0,
    });

    const source = { width: 400, height: 300 };
    const target = { width: 200, height: 150 };
    const result = resizeCanvas(mockOffscreenCanvas, source, target);

    expect(mockOffscreenCanvas.width).toBe(200);
    expect(mockOffscreenCanvas.height).toBe(150);
    expect(result.scale).toBeLessThan(1);
  });

  test('should handle no target dimensions', () => {
    const mockCanvas = /** @type {any} */ ({
      width: 0,
      height: 0,
    });

    const source = { width: 150, height: 100 };
    const result = resizeCanvas(mockCanvas, source);

    expect(mockCanvas.width).toBe(150);
    expect(mockCanvas.height).toBe(100);
    expect(result).toEqual({ scale: 1, width: 150, height: 100 });
  });
});
