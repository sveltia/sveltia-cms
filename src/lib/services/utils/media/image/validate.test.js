import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { isValidImage } from './validate';

/**
 * Leading bytes of a HEIC file: an ISO BMFF `ftyp` box with the `heic` major brand.
 * @type {Uint8Array<ArrayBuffer>}
 */
const HEIC_HEADER = new Uint8Array([
  0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0, 0x6d, 0x69, 0x66, 0x31,
  0x68, 0x65, 0x69, 0x63,
]);

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
    // A truncated JPEG declares `image/jpeg` but won’t decode
    vi.mocked(global.createImageBitmap).mockRejectedValue(new Error('Unsupported image format'));

    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'photo.jpg', {
      type: 'image/jpeg',
    });

    await expect(isValidImage(file)).resolves.toBe(false);
  });

  test('should accept a HEIC image saved with a `.jpg` extension if it’s converted', async () => {
    // It declares `image/jpeg` and the browser can’t decode it, but the library that converts it
    // reports a failure instead
    vi.mocked(global.createImageBitmap).mockRejectedValue(new Error('Unsupported image format'));

    const file = new File([HEIC_HEADER], 'IMG_0001.jpg', { type: 'image/jpeg' });

    await expect(isValidImage(file, { convertHEIC: true })).resolves.toBe(true);
    expect(global.createImageBitmap).not.toHaveBeenCalled();
  });

  test('should reject a HEIC image saved with a `.jpg` extension if it isn’t converted', async () => {
    // It declares `image/jpeg` but nothing could display it
    vi.mocked(global.createImageBitmap).mockRejectedValue(new Error('Unsupported image format'));

    const file = new File([HEIC_HEADER], 'IMG_0001.jpg', { type: 'image/jpeg' });

    await expect(isValidImage(file, { convertHEIC: false })).resolves.toBe(false);
    expect(global.createImageBitmap).not.toHaveBeenCalled();
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
    // Only Safari decodes HEIC; a declared HEIC image is uploaded as is, or converted, where a
    // decoding failure is reported by the library
    ['image/heic', 'IMG_0001.heic'],
    ['image/heif', 'IMG_0001.heif'],
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
