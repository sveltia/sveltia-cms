// cspell:ignore APNG IDAT
/* eslint-disable no-bitwise -- reading flags from binary headers */

/**
 * @import { RasterImageFormat } from '$lib/types/public';
 */

/**
 * Check if the bytes have the given ASCII tag at the given offset.
 * @param {Uint8Array} bytes Bytes.
 * @param {number} offset Offset.
 * @param {string} tag Tag, e.g. `acTL`.
 * @returns {boolean} Result.
 */
const hasTag = (bytes, offset, tag) =>
  [...tag].every((char, index) => bytes[offset + index] === char.charCodeAt(0));

/**
 * Get the size of a color table from the packed fields of a GIF screen or image descriptor.
 * @param {number} flags Packed fields.
 * @returns {number} Size in bytes, or `0` if there is no color table.
 */
const getGIFColorTableSize = (flags) => (flags & 0x80 ? 3 * 2 ** ((flags & 0x07) + 1) : 0);

/**
 * Skip the data sub-blocks of a GIF extension or image, which end with an empty block.
 * @param {Uint8Array} bytes Bytes.
 * @param {number} offset Offset of the first sub-block.
 * @returns {number} Offset right after the terminating empty block.
 */
const skipGIFSubBlocks = (bytes, offset) => {
  let position = offset;

  while (position < bytes.length && bytes[position] !== 0) {
    position += bytes[position] + 1;
  }

  return position + 1;
};

/**
 * Check if a GIF image has more than one frame, by counting its image descriptors.
 * @param {Uint8Array} bytes File content.
 * @returns {boolean} Result.
 * @see https://www.w3.org/Graphics/GIF/spec-gif89a.txt
 */
const isAnimatedGIF = (bytes) => {
  // Header (6 bytes) and logical screen descriptor (7 bytes), followed by a global color table
  let position = 13 + getGIFColorTableSize(bytes[10]);
  let frameCount = 0;

  while (position < bytes.length) {
    const introducer = bytes[position];

    if (introducer === 0x21) {
      // Extension: introducer, label, then sub-blocks
      position = skipGIFSubBlocks(bytes, position + 2);
    } else if (introducer === 0x2c) {
      frameCount += 1;

      if (frameCount > 1) {
        return true;
      }

      // Image descriptor (10 bytes), local color table, LZW minimum code size, then sub-blocks
      position = skipGIFSubBlocks(
        bytes,
        position + 10 + getGIFColorTableSize(bytes[position + 9]) + 1,
      );
    } else {
      // Trailer or unknown data
      break;
    }
  }

  return false;
};

/**
 * Check if a WebP image is animated, which is flagged in the extended (`VP8X`) header and comes
 * with an `ANIM` chunk.
 * @param {Uint8Array} bytes File content.
 * @returns {boolean} Result.
 * @see https://developers.google.com/speed/webp/docs/riff_container#extended_file_format
 */
const isAnimatedWebP = (bytes) => hasTag(bytes, 12, 'VP8X') && (bytes[20] & 0x02) !== 0;

/**
 * Check if a PNG image is animated (APNG), which comes with an `acTL` chunk before the image data.
 * @param {Uint8Array} bytes File content.
 * @returns {boolean} Result.
 * @see https://wiki.mozilla.org/APNG_Specification
 */
const isAnimatedPNG = (bytes) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Skip the 8-byte signature
  let position = 8;

  // Each chunk: length (4 bytes), type (4 bytes), data, CRC (4 bytes)
  while (position + 8 <= bytes.length) {
    if (hasTag(bytes, position + 4, 'acTL')) {
      return true;
    }

    if (hasTag(bytes, position + 4, 'IDAT')) {
      return false;
    }

    position += view.getUint32(position) + 12;
  }

  return false;
};

/**
 * Check if the given image is animated: a GIF with more than one frame, an animated WebP or an
 * APNG. Transforming such an image would only keep its first frame, as the browser decodes no more.
 * @param {Blob} blob File or blob.
 * @param {RasterImageFormat | undefined} format Format sniffed from the content.
 * @returns {Promise<boolean>} Result. `false` for any other format, or if the file can’t be read.
 */
export const isAnimatedImage = async (blob, format) => {
  if (format !== 'gif' && format !== 'webp' && format !== 'png') {
    return false;
  }

  /** @type {Uint8Array} */
  let bytes;

  try {
    bytes = new Uint8Array(await blob.arrayBuffer());
  } catch {
    return false;
  }

  if (format === 'gif') {
    return isAnimatedGIF(bytes);
  }

  if (format === 'webp') {
    return isAnimatedWebP(bytes);
  }

  return isAnimatedPNG(bytes);
};
