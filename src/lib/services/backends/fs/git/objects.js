/* eslint-disable no-bitwise */
/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */

import { getHash } from '@sveltia/utils/crypto';

import { isMissingError } from '$lib/services/backends/fs/git/file-system';
import { isNotFoundError, readFile } from '$lib/services/backends/fs/shared/handles';
import { toHex } from '$lib/services/utils/crypto';

/**
 * @import {
 * GitFileSystem,
 * GitObject,
 * GitObjectType,
 * GitPack,
 * GitPackIndex,
 * } from '$lib/types/private';
 */

/**
 * Types of the objects in a pack file, by the number in an object header. 5 is reserved, and 6 and
 * 7 are deltas against another object, which has the actual type.
 * @type {Record<number, GitObjectType>}
 * @see https://git-scm.com/docs/gitformat-pack#_object_types
 */
const PACKED_OBJECT_TYPES = { 1: 'commit', 2: 'tree', 3: 'blob', 4: 'tag' };
const OFS_DELTA = 6;
const REF_DELTA = 7;
/**
 * How deep a chain of deltas is followed before it’s considered broken. Git’s default limit is 50,
 * and `git gc --aggressive` uses 50 as well, so a longer chain is unlikely to be legitimate.
 */
const MAX_DELTA_DEPTH = 1000;
/**
 * Size of the checksum at the end of a pack file.
 */
const PACK_TRAILER_SIZE = 20;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Convert a hexadecimal string to bytes.
 * @param {string} hex Hexadecimal string.
 * @returns {Uint8Array} Bytes.
 */
export const fromHex = (hex) =>
  Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));

/**
 * Prefix the content of an object with its header, as Git hashes and stores it.
 * @param {GitObjectType} type Object type.
 * @param {Uint8Array} content Object content.
 * @returns {Uint8Array} Header and content.
 */
const encodeObject = (type, content) => {
  const header = textEncoder.encode(`${type} ${content.length}\0`);
  const bytes = new Uint8Array(header.length + content.length);

  bytes.set(header);
  bytes.set(content, header.length);

  return bytes;
};

/**
 * Calculate the Git object ID of an object.
 * @param {GitObjectType} type Object type.
 * @param {Uint8Array} content Object content.
 * @returns {Promise<string>} Object ID: SHA-1 hash in hexadecimal.
 * @see https://git-scm.com/book/en/v2/Git-Internals-Git-Objects
 */
export const hashObject = (type, content) => getHash(encodeObject(type, content));

/**
 * Decompress zlib data, which Git objects are stored as.
 * @param {Uint8Array} bytes Compressed data.
 * @returns {Promise<Uint8Array>} Decompressed data.
 */
export const inflate = async (bytes) => {
  const stream = new Blob([/** @type {Uint8Array<ArrayBuffer>} */ (bytes)])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'));

  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/**
 * Compress data with zlib, which Git objects are stored as, using the browser’s native
 * implementation.
 * @param {Uint8Array} bytes Data.
 * @returns {Promise<Uint8Array>} Compressed data.
 */
export const deflate = async (bytes) => {
  const { readable, writable } = new CompressionStream('deflate');
  const writer = writable.getWriter();

  // The data is written to the stream as it is rather than copied into a `Blob` first, which
  // matters for a large asset. It’s read at the same time, or the writing would wait forever
  const [, , compressed] = await Promise.all([
    writer.write(/** @type {Uint8Array<ArrayBuffer>} */ (bytes)),
    writer.close(),
    new Response(readable).arrayBuffer(),
  ]);

  return new Uint8Array(compressed);
};

/**
 * Write an object to the repository as a loose object, unless one with the same ID exists. The
 * hashing and compression are native, which matters for a large asset.
 * @param {GitFileSystem} fs File system.
 * @param {GitObjectType} type Object type.
 * @param {Uint8Array} content Object content.
 * @returns {Promise<string>} Object ID.
 */
export const writeLooseObject = async (fs, type, content) => {
  const bytes = encodeObject(type, content);
  const oid = await getHash(bytes);
  const dir = `.git/objects/${oid.slice(0, 2)}`;
  const path = `${dir}/${oid.slice(2)}`;
  let size = 0;

  try {
    ({ size } = await fs.stat(path));
  } catch (ex) {
    if (!isMissingError(ex)) {
      throw ex;
    }
  }

  // A file is created empty before its content is written, so a write cut short, e.g. by the tab
  // being closed, leaves an empty file behind. Git never writes an empty object, so it’s missing
  if (!size) {
    await fs.mkdir(dir);
    await fs.writeFile(path, await deflate(bytes));
  }

  return oid;
};

/**
 * Apply a delta to its base object, as found in a pack file.
 * @param {Uint8Array} base Content of the base object.
 * @param {Uint8Array} delta Delta.
 * @returns {Uint8Array} Content of the resulting object.
 * @throws {Error} If the delta doesn’t fit the base.
 * @see https://git-scm.com/docs/gitformat-pack#_deltified_representation
 */
export const applyDelta = (base, delta) => {
  let position = 0;

  /**
   * Read a size from the delta header, encoded in 7-bit groups, least significant first.
   * @returns {number} Size.
   */
  const readSize = () => {
    let size = 0;
    let factor = 1;
    let byte;

    do {
      byte = delta[position];
      position += 1;
      size += (byte & 0x7f) * factor;
      factor *= 128;
    } while (byte & 0x80);

    return size;
  };

  if (readSize() !== base.length) {
    throw new Error('Delta base size mismatch');
  }

  const result = new Uint8Array(readSize());
  let length = 0;

  while (position < delta.length) {
    const instruction = delta[position];

    position += 1;

    if (instruction & 0x80) {
      // Copy a range of the base: the bits say which bytes of the offset and size follow
      let offset = 0;
      let size = 0;

      for (let index = 0; index < 4; index += 1) {
        if (instruction & (1 << index)) {
          offset += delta[position] * 2 ** (8 * index);
          position += 1;
        }
      }

      for (let index = 0; index < 3; index += 1) {
        if (instruction & (0x10 << index)) {
          size += delta[position] * 2 ** (8 * index);
          position += 1;
        }
      }

      size ||= 0x10000;
      result.set(base.subarray(offset, offset + size), length);
      length += size;
    } else if (instruction) {
      // Insert the given number of bytes from the delta
      result.set(delta.subarray(position, position + instruction), length);
      position += instruction;
      length += instruction;
    } else {
      throw new Error('Invalid delta instruction');
    }
  }

  if (length !== result.length) {
    throw new Error('Delta result size mismatch');
  }

  return result;
};

/**
 * Parse a loose object file’s decompressed content.
 * @param {Uint8Array} bytes Decompressed content: a header followed by the object content.
 * @returns {GitObject} Object.
 * @throws {Error} If the header is invalid.
 */
export const parseLooseObject = (bytes) => {
  const nullIndex = bytes.indexOf(0);
  const [type, size] = textDecoder.decode(bytes.subarray(0, nullIndex)).split(' ');
  const content = bytes.subarray(nullIndex + 1);

  if (!Object.values(PACKED_OBJECT_TYPES).includes(/** @type {any} */ (type))) {
    throw new Error(`Invalid object type: ${type}`);
  }

  if (Number(size) !== content.length) {
    throw new Error('Object size mismatch');
  }

  return { type: /** @type {GitObjectType} */ (type), content };
};

/**
 * Parse a pack index file, version 2, which lists the objects in the pack file of the same name
 * along with their positions in it.
 * @param {ArrayBuffer} buffer Content of the index file.
 * @returns {GitPackIndex} Parsed index.
 * @throws {Error} If the file isn’t a version 2 pack index. Version 1 hasn’t been written by
 * default since Git 1.5.2.
 * @see https://git-scm.com/docs/gitformat-pack#_version_2_pack_idx_files_support_packs_larger_than_4_gib_and
 */
export const parsePackIndex = (buffer) => {
  const view = new DataView(buffer);

  // `\377tOc` followed by the version number
  if (view.getUint32(0) !== 0xff744f63 || view.getUint32(4) !== 2) {
    throw new Error('Unsupported pack index version');
  }

  const fanoutStart = 8;
  const count = view.getUint32(fanoutStart + 255 * 4);
  const oidsStart = fanoutStart + 256 * 4;
  const offsetsStart = oidsStart + count * 20 + count * 4;
  const largeOffsetsStart = offsetsStart + count * 4;
  const fanout = Array.from({ length: 256 }, (_, index) => view.getUint32(fanoutStart + index * 4));
  const offsets = new Float64Array(count);

  for (let index = 0; index < count; index += 1) {
    const value = view.getUint32(offsetsStart + index * 4);

    // A pack larger than 2 GiB has the offsets that don’t fit in 31 bits in a separate table
    offsets[index] =
      value & 0x80000000
        ? view.getUint32(largeOffsetsStart + (value & 0x7fffffff) * 8) * 2 ** 32 +
          view.getUint32(largeOffsetsStart + (value & 0x7fffffff) * 8 + 4)
        : value;
  }

  return { fanout, oids: new Uint8Array(buffer, oidsStart, count * 20), offsets };
};

/**
 * Find the position of an object in a pack file.
 * @param {GitPackIndex} index Pack index.
 * @param {Uint8Array} oid Object ID.
 * @returns {number | undefined} Offset of the object in the pack file, or `undefined` if the pack
 * doesn’t have it.
 */
export const findPackedObject = ({ fanout, oids, offsets }, oid) => {
  // The fanout table says how many objects have an ID starting with a byte up to the given one
  let low = oid[0] ? fanout[oid[0] - 1] : 0;
  let high = fanout[oid[0]];

  while (low < high) {
    const middle = (low + high) >>> 1;
    let comparison = 0;

    for (let byteIndex = 0; byteIndex < 20 && !comparison; byteIndex += 1) {
      comparison = oids[middle * 20 + byteIndex] - oid[byteIndex];
    }

    if (!comparison) {
      return offsets[middle];
    }

    if (comparison < 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return undefined;
};

/**
 * Get the position where the object at the given position ends in a pack file, which is where the
 * next object starts, or where the trailing checksum starts for the last object.
 * @param {GitPack} pack Pack.
 * @param {number} offset Offset of the object.
 * @returns {number} End offset.
 */
const getPackedObjectEnd = (pack, offset) => {
  pack.sortedOffsets ??= Float64Array.from(pack.index.offsets).sort();

  const { sortedOffsets } = pack;
  let low = 0;
  let high = sortedOffsets.length;

  // Find the first offset greater than the given one
  while (low < high) {
    const middle = (low + high) >>> 1;

    if (sortedOffsets[middle] <= offset) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low < sortedOffsets.length ? sortedOffsets[low] : pack.file.size - PACK_TRAILER_SIZE;
};

/**
 * Create a reader for the objects in a Git repository’s object database: the loose objects, and the
 * objects in pack files. A packed object is read by its position in the file, so a pack file is
 * never loaded as a whole, which matters for a repository with a long history of images. The
 * reader caches the pack indexes, so it’s meant for one operation; create another for the next one,
 * as `git gc` may have repacked the objects in the meantime.
 * @param {FileSystemDirectoryHandle} gitDirHandle Handle of the `.git` directory.
 * @returns {{ readObject: (oid: string) => Promise<GitObject | undefined> }} Reader.
 * `readObject` resolves with `undefined` if the object doesn’t exist.
 */
export const createObjectReader = (gitDirHandle) => {
  /** @type {Promise<GitPack[]> | undefined} */
  let packsPromise;

  /**
   * Load the pack indexes, along with the pack files they’re for.
   * @returns {Promise<GitPack[]>} Packs.
   */
  const loadPacks = async () => {
    /** @type {GitPack[]} */
    const packs = [];
    /** @type {FileSystemDirectoryHandle} */
    let packDirHandle;

    try {
      packDirHandle = await (
        await gitDirHandle.getDirectoryHandle('objects')
      ).getDirectoryHandle('pack');
    } catch {
      return packs;
    }

    for await (const [name, handle] of packDirHandle.entries()) {
      if (handle.kind !== 'file' || !name.endsWith('.idx')) {
        continue;
      }

      const indexFile = await /** @type {FileSystemFileHandle} */ (handle).getFile();
      const packHandle = await packDirHandle.getFileHandle(name.replace(/\.idx$/, '.pack'));

      packs.push({
        index: parsePackIndex(await indexFile.arrayBuffer()),
        file: await packHandle.getFile(),
      });
    }

    return packs;
  };

  /**
   * Find the pack containing an object.
   * @param {string} oid Object ID.
   * @returns {Promise<{ pack: GitPack, offset: number } | undefined>} Pack and the object’s offset
   * in it, or `undefined` if no pack has the object.
   */
  const findInPacks = async (oid) => {
    packsPromise ??= loadPacks();

    const oidBytes = fromHex(oid);

    for (const pack of await packsPromise) {
      const offset = findPackedObject(pack.index, oidBytes);

      if (offset !== undefined) {
        return { pack, offset };
      }
    }

    return undefined;
  };

  /**
   * Read a loose object.
   * @param {string} oid Object ID.
   * @returns {Promise<GitObject | undefined>} Object, or `undefined` if it’s not a loose object.
   */
  const readLooseObject = async (oid) => {
    /** @type {File} */
    let file;

    try {
      file = await readFile(gitDirHandle, `objects/${oid.slice(0, 2)}/${oid.slice(2)}`);
    } catch (ex) {
      if (isNotFoundError(ex)) {
        return undefined;
      }

      throw ex;
    }

    return parseLooseObject(await inflate(new Uint8Array(await file.arrayBuffer())));
  };

  /**
   * Read an object from a pack file.
   * @param {GitPack} pack Pack.
   * @param {number} offset Offset of the object in the pack file.
   * @param {number} depth How many deltas deep the object is.
   * @returns {Promise<GitObject>} Object.
   * @throws {Error} If the object is invalid, or its delta base is missing.
   */
  const readPackedObject = async (pack, offset, depth) => {
    if (depth > MAX_DELTA_DEPTH) {
      throw new Error('Delta chain too long');
    }

    const end = getPackedObjectEnd(pack, offset);
    const bytes = new Uint8Array(await pack.file.slice(offset, end).arrayBuffer());
    let position = 0;
    let byte = bytes[position];
    const typeNumber = (byte >> 4) & 0x7;

    // Skip the size, which the decompressed data tells anyway
    while (byte & 0x80) {
      position += 1;
      byte = bytes[position];
    }

    position += 1;

    /** @type {GitObject | undefined} */
    let base;

    if (typeNumber === OFS_DELTA) {
      // The base is at a negative offset from this object, encoded in 7-bit groups, most
      // significant first, with one added to every group but the last
      byte = bytes[position];
      position += 1;

      let distance = byte & 0x7f;

      while (byte & 0x80) {
        byte = bytes[position];
        position += 1;
        distance = (distance + 1) * 128 + (byte & 0x7f);
      }

      base = await readPackedObject(pack, offset - distance, depth + 1);
    } else if (typeNumber === REF_DELTA) {
      const baseOid = toHex(bytes.subarray(position, position + 20));

      position += 20;
      // eslint-disable-next-line no-use-before-define
      base = await readObjectAtDepth(baseOid, depth + 1);

      if (!base) {
        throw new Error(`Delta base not found: ${baseOid}`);
      }
    }

    const data = await inflate(bytes.subarray(position));

    if (base) {
      return { type: base.type, content: applyDelta(base.content, data) };
    }

    const type = PACKED_OBJECT_TYPES[typeNumber];

    if (!type) {
      throw new Error(`Invalid packed object type: ${typeNumber}`);
    }

    return { type, content: data };
  };

  /**
   * Read an object, loose or packed.
   * @param {string} oid Object ID.
   * @param {number} depth How many deltas deep the object is.
   * @returns {Promise<GitObject | undefined>} Object, or `undefined` if it doesn’t exist.
   */
  const readObjectAtDepth = async (oid, depth) => {
    const looseObject = await readLooseObject(oid);

    if (looseObject) {
      return looseObject;
    }

    const found = await findInPacks(oid);

    return found ? readPackedObject(found.pack, found.offset, depth) : undefined;
  };

  return {
    /**
     * Read an object, loose or packed.
     * @param {string} oid Object ID.
     * @returns {Promise<GitObject | undefined>} Object, or `undefined` if it doesn’t exist.
     */
    readObject: (oid) => readObjectAtDepth(oid, 0),
  };
};
