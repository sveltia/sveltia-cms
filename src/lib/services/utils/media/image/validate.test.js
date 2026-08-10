import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { isValidImage } from './validate';

describe('isValidImage', () => {
  /** @type {any} */
  let close;

  beforeEach(() => {
    close = vi.fn();
    global.createImageBitmap = vi.fn().mockResolvedValue({ close });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should accept a decodable raster image', async () => {
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });

    await expect(isValidImage(file)).resolves.toBe(true);
    expect(global.createImageBitmap).toHaveBeenCalledWith(file);
    // The bitmap is released rather than leaked
    expect(close).toHaveBeenCalled();
  });

  test('should reject a raster image the browser cannot decode', async () => {
    // A HEIC photo saved with a `.jpg` extension declares `image/jpeg` but won’t decode
    vi.mocked(global.createImageBitmap).mockRejectedValue(new Error('Unsupported image format'));

    const file = new File(['ftypheic'], 'IMG_0001.jpg', { type: 'image/jpeg' });

    await expect(isValidImage(file)).resolves.toBe(false);
  });

  test.each(['image/avif', 'image/gif', 'image/png', 'image/webp'])(
    'should check %s as a raster image format',
    async (type) => {
      vi.mocked(global.createImageBitmap).mockRejectedValue(new Error('Corrupt'));

      const file = new File(['data'], `photo.${type.split('/')[1]}`, { type });

      await expect(isValidImage(file)).resolves.toBe(false);
    },
  );

  test.each([
    ['image/svg+xml', 'icon.svg'],
    ['image/tiff', 'scan.tiff'],
    ['image/heic', 'IMG_0001.heic'],
    ['video/quicktime', 'clip.mov'],
    ['audio/mpeg', 'song.mp3'],
    ['application/pdf', 'doc.pdf'],
    ['', 'unknown.bin'],
  ])('should skip %s, which the browser isn’t expected to decode', async (type, name) => {
    const file = new File(['data'], name, { type });

    await expect(isValidImage(file)).resolves.toBe(true);
    expect(global.createImageBitmap).not.toHaveBeenCalled();
  });
});
