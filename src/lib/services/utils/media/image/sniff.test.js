import { describe, expect, test, vi } from 'vitest';

import { sniffRasterImageFormat } from './sniff';

/**
 * Encode an ASCII tag.
 * @param {string} str Tag, like `ftyp`.
 * @returns {number[]} Bytes.
 */
const tag = (str) => [...str].map((char) => char.charCodeAt(0));

/**
 * Build the leading bytes of an ISO BMFF file: an `ftyp` box with the given brands.
 * @param {string} majorBrand Major brand.
 * @param {string[]} [compatibleBrands] Compatible brands.
 * @param {number} [boxSize] Declared box size. Defaults to the actual size.
 * @returns {Uint8Array<ArrayBuffer>} Bytes.
 */
const ftyp = (majorBrand, compatibleBrands = [], boxSize = undefined) => {
  const size = boxSize ?? 16 + compatibleBrands.length * 4;
  const sizeBytes = new Uint8Array(4);

  new DataView(sizeBytes.buffer).setUint32(0, size);

  return new Uint8Array([
    ...sizeBytes,
    ...tag('ftyp'),
    ...tag(majorBrand),
    0,
    0,
    0,
    0,
    ...compatibleBrands.flatMap(tag),
  ]);
};

describe('sniffRasterImageFormat', () => {
  test.each([
    ['jpeg', [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...tag('JFIF'), 0, 1, 1, 0]],
    ['png', [0x89, ...tag('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, ...tag('IHDR')]],
    ['gif', [...tag('GIF89a'), 1, 0, 1, 0, 0, 0, 0]],
    ['webp', [...tag('RIFF'), 0x24, 0, 0, 0, ...tag('WEBP'), ...tag('VP8 ')]],
  ])('should detect %s from its signature', async (format, bytes) => {
    const blob = new Blob([new Uint8Array(bytes)]);

    await expect(sniffRasterImageFormat(blob)).resolves.toBe(format);
  });

  test('should detect a HEIC image by its major brand', async () => {
    // What an iPhone writes
    const blob = new Blob([ftyp('heic', ['mif1', 'miaf', 'MiHB', 'heic'])]);

    await expect(sniffRasterImageFormat(blob)).resolves.toBe('heic');
  });

  test.each(['heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1'])(
    'should detect a HEIF image with the %s brand',
    async (brand) => {
      await expect(sniffRasterImageFormat(new Blob([ftyp(brand)]))).resolves.toBe('heic');
    },
  );

  test('should detect a HEIC image by a compatible brand', async () => {
    // Some Android phones write a generic major brand that isn’t HEIF-specific
    const blob = new Blob([ftyp('isom', ['isom', 'heic'])]);

    await expect(sniffRasterImageFormat(blob)).resolves.toBe('heic');
  });

  test('should detect an AVIF image, which lists a HEIF brand as compatible', async () => {
    const blob = new Blob([ftyp('avif', ['avif', 'miaf', 'mif1'])]);

    await expect(sniffRasterImageFormat(blob)).resolves.toBe('avif');
  });

  test('should detect an AVIF image sequence', async () => {
    await expect(sniffRasterImageFormat(new Blob([ftyp('avis')]))).resolves.toBe('avif');
  });

  test('should only read brands within the box', async () => {
    // A box that ends before the compatible brand list
    const blob = new Blob([ftyp('isom', ['heic'], 16)]);

    await expect(sniffRasterImageFormat(blob)).resolves.toBeUndefined();
  });

  test('should only read brands within the bytes read', async () => {
    // A box longer than the header read, with the HEIF brand beyond it
    const bytes = ftyp('isom', [...Array(20).fill('isom'), 'heic']);

    expect(bytes.length).toBeGreaterThan(64);
    await expect(sniffRasterImageFormat(new Blob([bytes]))).resolves.toBeUndefined();
    // The same box with the brand within the bytes read
    await expect(
      sniffRasterImageFormat(new Blob([ftyp('isom', ['heic', ...Array(20).fill('isom')])])),
    ).resolves.toBe('heic');
  });

  test('should return undefined for an ISO BMFF file that is neither', async () => {
    // A QuickTime video, say
    const blob = new Blob([ftyp('qt  ', ['qt  '])]);

    await expect(sniffRasterImageFormat(blob)).resolves.toBeUndefined();
  });

  test('should return undefined for an unknown signature', async () => {
    const blob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>']);

    await expect(sniffRasterImageFormat(blob)).resolves.toBeUndefined();
  });

  test('should return undefined for a file too short to have a signature', async () => {
    await expect(sniffRasterImageFormat(new Blob([]))).resolves.toBeUndefined();
    await expect(sniffRasterImageFormat(new Blob(['GIF89a']))).resolves.toBeUndefined();
  });

  test('should return undefined for a file that cannot be read', async () => {
    // The file was deleted or moved after being picked
    const blob = new Blob([ftyp('heic')]);
    const error = new DOMException('Not readable', 'NotReadableError');
    const unreadable = /** @type {any} */ ({ arrayBuffer: vi.fn().mockRejectedValue(error) });

    vi.spyOn(blob, 'slice').mockReturnValue(unreadable);

    await expect(sniffRasterImageFormat(blob)).resolves.toBeUndefined();
  });

  test('should ignore the file name and type', async () => {
    const file = new File([ftyp('heic', ['mif1', 'heic'])], 'IMG_0001.jpg', {
      type: 'image/jpeg',
    });

    await expect(sniffRasterImageFormat(file)).resolves.toBe('heic');
  });
});
