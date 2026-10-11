import { describe, expect, it, vi } from 'vitest';

import { isAnimatedImage } from '$lib/services/utils/media/image/animation';

/**
 * Convert a string of Latin-1 characters to bytes.
 * @param {string} str String.
 * @returns {number[]} Bytes.
 */
const ascii = (str) => [...str].map((char) => char.charCodeAt(0));
/**
 * Create a blob from the given byte lists.
 * @param {number[][]} parts Byte lists.
 * @returns {Blob} Blob.
 */
const toBlob = (...parts) => new Blob([new Uint8Array(parts.flat())]);
// GIF building blocks: a 1×1 image with a 2-color global color table
const GIF_HEADER = [...ascii('GIF89a'), 1, 0, 1, 0, 0x80, 0, 0];
const GIF_HEADER_WITHOUT_COLOR_TABLE = [...ascii('GIF89a'), 1, 0, 1, 0, 0, 0, 0];
const GIF_COLOR_TABLE = [0, 0, 0, 255, 255, 255];
const GIF_LOOP = [0x21, 0xff, 11, ...ascii('NETSCAPE2.0'), 3, 1, 0, 0, 0];
const GIF_GRAPHIC_CONTROL = [0x21, 0xf9, 4, 0, 10, 0, 0, 0];
const GIF_IMAGE_DATA = [2, 2, 0x44, 0x01, 0];
const GIF_FRAME = [0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, ...GIF_IMAGE_DATA];

// A frame with a local 2-color table
const GIF_FRAME_WITH_COLOR_TABLE = [
  0x2c,
  0,
  0,
  0,
  0,
  1,
  0,
  1,
  0,
  0x80,
  ...GIF_COLOR_TABLE,
  ...GIF_IMAGE_DATA,
];

const GIF_TRAILER = [0x3b];

/**
 * Create the bytes of a WebP file starting with the given chunk.
 * @param {string} chunk Chunk name.
 * @param {number} flags Flags byte of a `VP8X` chunk.
 * @returns {number[]} Bytes.
 */
const createWebP = (chunk, flags = 0) => [
  ...ascii('RIFF'),
  30,
  0,
  0,
  0,
  ...ascii('WEBP'),
  ...ascii(chunk),
  10,
  0,
  0,
  0,
  flags,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
];

/**
 * Create the bytes of a PNG chunk, with a dummy CRC.
 * @param {string} type Chunk type.
 * @param {number} length Data length.
 * @returns {number[]} Bytes.
 */
const createPNGChunk = (type, length) => [
  0,
  0,
  0,
  length,
  ...ascii(type),
  ...Array(length).fill(0),
  0,
  0,
  0,
  0,
];

const PNG_SIGNATURE = [0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_IHDR = createPNGChunk('IHDR', 13);
const PNG_IDAT = createPNGChunk('IDAT', 10);
const PNG_IEND = createPNGChunk('IEND', 0);

describe('isAnimatedImage()', () => {
  describe('GIF', () => {
    it('should detect a GIF with more than one frame', async () => {
      const blob = toBlob(
        GIF_HEADER,
        GIF_COLOR_TABLE,
        GIF_LOOP,
        GIF_GRAPHIC_CONTROL,
        GIF_FRAME,
        GIF_GRAPHIC_CONTROL,
        GIF_FRAME_WITH_COLOR_TABLE,
        GIF_TRAILER,
      );

      await expect(isAnimatedImage(blob, 'gif')).resolves.toBe(true);
    });

    it('should detect frames after a local color table, without a global one', async () => {
      const blob = toBlob(
        GIF_HEADER_WITHOUT_COLOR_TABLE,
        GIF_FRAME_WITH_COLOR_TABLE,
        GIF_FRAME_WITH_COLOR_TABLE,
        GIF_TRAILER,
      );

      await expect(isAnimatedImage(blob, 'gif')).resolves.toBe(true);
    });

    it('should not report a single-frame GIF as animated', async () => {
      await expect(
        isAnimatedImage(
          toBlob(GIF_HEADER, GIF_COLOR_TABLE, GIF_GRAPHIC_CONTROL, GIF_FRAME, GIF_TRAILER),
          'gif',
        ),
      ).resolves.toBe(false);
      // Even with the looping extension
      await expect(
        isAnimatedImage(
          toBlob(GIF_HEADER, GIF_COLOR_TABLE, GIF_LOOP, GIF_FRAME_WITH_COLOR_TABLE, GIF_TRAILER),
          'gif',
        ),
      ).resolves.toBe(false);
    });

    it('should stop at the end of a truncated GIF', async () => {
      await expect(
        isAnimatedImage(toBlob(GIF_HEADER, GIF_COLOR_TABLE, GIF_FRAME), 'gif'),
      ).resolves.toBe(false);
      await expect(
        isAnimatedImage(toBlob(GIF_HEADER, GIF_COLOR_TABLE, [0x21, 0xf9, 4, 0, 10]), 'gif'),
      ).resolves.toBe(false);
    });
  });

  describe('WebP', () => {
    it('should detect an animated WebP', async () => {
      await expect(isAnimatedImage(toBlob(createWebP('VP8X', 0x02)), 'webp')).resolves.toBe(true);
      // With an alpha channel as well
      await expect(isAnimatedImage(toBlob(createWebP('VP8X', 0x12)), 'webp')).resolves.toBe(true);
    });

    it('should not report a still WebP as animated', async () => {
      await expect(isAnimatedImage(toBlob(createWebP('VP8X', 0x10)), 'webp')).resolves.toBe(false);
      await expect(isAnimatedImage(toBlob(createWebP('VP8 ')), 'webp')).resolves.toBe(false);
      await expect(isAnimatedImage(toBlob(createWebP('VP8L')), 'webp')).resolves.toBe(false);
    });
  });

  describe('PNG', () => {
    it('should detect an APNG', async () => {
      const blob = toBlob(PNG_SIGNATURE, PNG_IHDR, createPNGChunk('acTL', 8), PNG_IDAT, PNG_IEND);

      await expect(isAnimatedImage(blob, 'png')).resolves.toBe(true);
    });

    it('should not report a still PNG as animated', async () => {
      await expect(
        isAnimatedImage(toBlob(PNG_SIGNATURE, PNG_IHDR, PNG_IDAT, PNG_IEND), 'png'),
      ).resolves.toBe(false);
      // An `acTL` chunk after the image data doesn’t count
      await expect(
        isAnimatedImage(
          toBlob(PNG_SIGNATURE, PNG_IHDR, PNG_IDAT, createPNGChunk('acTL', 8), PNG_IEND),
          'png',
        ),
      ).resolves.toBe(false);
      // Truncated before the image data
      await expect(isAnimatedImage(toBlob(PNG_SIGNATURE, PNG_IHDR), 'png')).resolves.toBe(false);
    });
  });

  it('should not check other formats', async () => {
    // The bytes of an animated GIF don’t matter for a JPEG
    const blob = toBlob(GIF_HEADER, GIF_COLOR_TABLE, GIF_FRAME, GIF_FRAME, GIF_TRAILER);

    await expect(isAnimatedImage(blob, 'jpeg')).resolves.toBe(false);
    await expect(isAnimatedImage(blob, undefined)).resolves.toBe(false);
  });

  it('should return `false` if the file can’t be read', async () => {
    const blob = new Blob([]);

    vi.spyOn(blob, 'arrayBuffer').mockRejectedValue(new DOMException('Gone', 'NotFoundError'));

    await expect(isAnimatedImage(blob, 'gif')).resolves.toBe(false);
  });
});
