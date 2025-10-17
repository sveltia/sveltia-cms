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
      scale: 0.25,
      width: 25,
      height: 50,
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
