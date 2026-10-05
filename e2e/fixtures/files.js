// cspell:ignore IDAT IEND IHDR

import { crc32, deflateSync } from 'zlib';

/**
 * Create a PNG chunk.
 * @param {string} type Chunk type, e.g. `IHDR`.
 * @param {Buffer} data Chunk data.
 * @returns {Buffer} Chunk with its length and checksum.
 */
const createChunk = (type, data) => {
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);

  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, checksum]);
};

/**
 * Create a valid PNG image filled with a single color. The CMS decodes an uploaded image to make
 * its thumbnail, so a test needs a real image; give each upload its own color, as the CMS merges
 * files with the same content into one asset.
 * @param {object} [options] Options.
 * @param {number} [options.size] Width and height in pixels.
 * @param {number} [options.width] Width in pixels, for an image that isn’t square.
 * @param {number} [options.height] Height in pixels, for an image that isn’t square.
 * @param {[number, number, number]} [options.color] Red, green and blue values, 0–255.
 * @returns {Buffer} PNG file content.
 */
export const createPNG = ({ size = 32, width = size, height = size, color = [255, 0, 0] } = {}) => {
  const header = Buffer.alloc(13);

  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // color type: RGB

  // Each row starts with filter type 0 (none), followed by the pixels
  const row = Buffer.concat([Buffer.from([0]), ...Array(width).fill(Buffer.from(color))]);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    createChunk('IHDR', header),
    createChunk('IDAT', deflateSync(Buffer.concat(Array(height).fill(row)))),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
};
