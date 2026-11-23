/**
 * @import { RasterImageFormat } from '$lib/types/public';
 */

/**
 * Number of leading bytes to read. The ISO BMFF `ftyp` box Apple writes is 24 to 32 bytes; this
 * leaves room for a longer compatible brand list.
 */
const HEADER_LENGTH = 64;

/**
 * Brands of a HEIF file: single images, sequences, and the generic `mif1`/`msf1` brands some
 * Android phones use as the major brand, with `heic` only among the compatible brands.
 * @see https://github.com/strukturag/libheif/blob/master/libheif/file.cc
 */
const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'heim',
  'heis',
  'hevc',
  'hevx',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
]);

/** Brands of an AVIF file, which shares the container and typically lists `mif1` as well. */
const AVIF_BRANDS = new Set(['avif', 'avis']);

/**
 * Check if the bytes start with the given signature.
 * @param {Uint8Array} bytes Bytes.
 * @param {string} signature Signature, as a string of Latin-1 characters.
 * @param {number} [offset] Offset to check at.
 * @returns {boolean} Result.
 */
const startsWith = (bytes, signature, offset = 0) =>
  [...signature].every((char, index) => bytes[offset + index] === char.charCodeAt(0));

/**
 * Read a 4-character ASCII tag at the given offset.
 * @param {Uint8Array} bytes Bytes.
 * @param {number} offset Offset.
 * @returns {string} Tag.
 */
const readTag = (bytes, offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4));

/**
 * Get the brands listed in an ISO BMFF `ftyp` box: the major brand followed by the compatible
 * brands, up to the end of the box or of the bytes read.
 * @param {Uint8Array} bytes Leading bytes of the file.
 * @returns {string[]} Brands. Empty if the file doesn’t start with an `ftyp` box.
 */
const getBrands = (bytes) => {
  if (bytes.length < 12 || readTag(bytes, 4) !== 'ftyp') {
    return [];
  }

  const boxSize = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0);
  const end = Math.min(boxSize, bytes.length);
  // Major brand at 8, minor version at 12, compatible brands from 16
  const brands = [readTag(bytes, 8)];

  for (let offset = 16; offset + 4 <= end; offset += 4) {
    brands.push(readTag(bytes, offset));
  }

  return brands;
};

/**
 * Detect the format of a raster image from its content rather than its file name or declared MIME
 * type, both of which come from the file extension and are wrong for a photo that was renamed
 * rather than converted — most commonly a HEIC image saved with a `.jpg` extension.
 * @param {Blob} blob File or blob to be sniffed.
 * @returns {Promise<RasterImageFormat | undefined>} Format, or `undefined` if the content doesn’t
 * start with a known signature, or can’t be read. HEIF variants, including `.heif` files, are
 * reported as `heic`.
 * @see https://en.wikipedia.org/wiki/List_of_file_signatures
 */
export const sniffRasterImageFormat = async (blob) => {
  /** @type {Uint8Array} */
  let bytes;

  try {
    bytes = new Uint8Array(await blob.slice(0, HEADER_LENGTH).arrayBuffer());
  } catch {
    // The file was deleted or moved after being picked; the caller’s decoding check reports it
    // rather than failing the whole batch
    return undefined;
  }

  if (bytes.length < 12) {
    return undefined;
  }

  if (startsWith(bytes, '\xff\xd8\xff')) {
    return 'jpeg';
  }

  if (startsWith(bytes, '\x89PNG')) {
    return 'png';
  }

  if (startsWith(bytes, 'GIF8')) {
    return 'gif';
  }

  if (startsWith(bytes, 'RIFF') && startsWith(bytes, 'WEBP', 8)) {
    return 'webp';
  }

  const brands = getBrands(bytes);

  // AVIF first: an AVIF file usually lists the generic HEIF brand `mif1` as a compatible brand
  if (brands.some((brand) => AVIF_BRANDS.has(brand))) {
    return 'avif';
  }

  if (brands.some((brand) => HEIF_BRANDS.has(brand))) {
    return 'heic';
  }

  return undefined;
};
