/* eslint-disable no-bitwise */

import { getHash } from '@sveltia/utils/crypto';

import { fromHex } from '$lib/services/backends/fs/git/objects';
import { toHex } from '$lib/services/utils/crypto';

/**
 * @import { GitIndex, GitIndexEntry, GitTreeNode } from '$lib/types/private';
 */

/**
 * Size of an index entry before its path, in version 2: ten 32-bit stat fields, the object ID and
 * 16-bit flags.
 */
const ENTRY_HEADER_SIZE = 62;
/**
 * Size of the checksum at the end of the index file.
 */
const CHECKSUM_SIZE = 20;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Parse the cache tree extension of an index, where Git keeps the object IDs of the trees the
 * entries make up, as of when it last wrote them. A tree whose entries have changed since is
 * invalidated rather than updated, so only the valid ones are returned.
 * @param {Uint8Array} bytes Data of the extension.
 * @returns {Map<string, string>} Object IDs of the valid trees, keyed by directory path, which is
 * an empty string for the root.
 * @see https://git-scm.com/docs/index-format#_cache_tree
 */
export const parseCacheTree = (bytes) => {
  /** @type {Map<string, string>} */
  const trees = new Map();
  let position = 0;

  /**
   * Read the text up to the given byte, and move past it.
   * @param {number} terminator Byte the text ends with.
   * @returns {string} Text.
   */
  const readUntil = (terminator) => {
    const end = bytes.indexOf(terminator, position);
    const text = textDecoder.decode(bytes.subarray(position, end));

    position = end + 1;

    return text;
  };

  /**
   * Read a tree, followed by its subtrees, which are listed depth first.
   * @param {string | undefined} parentPath Path of the parent directory, or `undefined` for the
   * root.
   */
  const readTree = (parentPath) => {
    const name = readUntil(0);
    const path = parentPath ? `${parentPath}/${name}` : name;
    // The number of index entries the tree covers, or -1 if it’s invalid, and of its subtrees
    const [entryCount, subtreeCount] = readUntil(0x0a).split(' ').map(Number);

    if (entryCount >= 0) {
      trees.set(path, toHex(bytes.subarray(position, position + 20)));
      position += 20;
    }

    for (let index = 0; index < subtreeCount; index += 1) {
      readTree(path);
    }
  };

  if (bytes.length) {
    readTree(undefined);
  }

  return trees;
};

/**
 * Parse a Git index file, also known as the staging area, which lists the files in the next commit.
 * Only version 2 is parsed, as it’s the only version the CMS writes; a later version is used when a
 * feature that needs extended flags or path compression is in use, such as sparse-checkout, `git
 * add -N`, or `feature.manyFiles`, so the entries of one are left empty.
 * @param {ArrayBuffer} buffer Content of the index file.
 * @returns {GitIndex} Parsed index.
 * @throws {Error} If the file isn’t an index file.
 * @see https://git-scm.com/docs/index-format
 */
export const parseIndex = (buffer) => {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  if (textDecoder.decode(bytes.subarray(0, 4)) !== 'DIRC') {
    throw new Error('Invalid index file');
  }

  const version = view.getUint32(4);
  /** @type {GitIndexEntry[]} */
  const entries = [];
  /** @type {string[]} */
  const extensions = [];

  if (version !== 2) {
    return { version, entries, extensions };
  }

  const count = view.getUint32(8);
  let position = 12;

  for (let index = 0; index < count; index += 1) {
    const flags = view.getUint16(position + 60);
    const pathStart = position + ENTRY_HEADER_SIZE;

    // The flags have the path length, unless it’s too long to fit in 12 bits
    const pathLength =
      (flags & 0xfff) < 0xfff ? flags & 0xfff : bytes.indexOf(0, pathStart) - pathStart;

    // An entry is padded with 1 to 8 null bytes to a multiple of 8 bytes
    const end = position + ((ENTRY_HEADER_SIZE + pathLength + 8) & ~7);

    entries.push({
      path: textDecoder.decode(bytes.subarray(pathStart, pathStart + pathLength)),
      mode: view.getUint32(position + 24),
      oid: toHex(bytes.subarray(position + 40, position + 60)),
      stage: (flags >> 12) & 0x3,
      raw: bytes.subarray(position, end),
    });

    position = end;
  }

  /** @type {Map<string, string> | undefined} */
  let cacheTree;

  // Each extension has a 4-byte signature and a 32-bit size, followed by the data
  while (position < bytes.length - CHECKSUM_SIZE) {
    const signature = textDecoder.decode(bytes.subarray(position, position + 4));
    const size = view.getUint32(position + 4);

    extensions.push(signature);

    if (signature === 'TREE') {
      cacheTree = parseCacheTree(bytes.subarray(position + 8, position + 8 + size));
    }

    position += 8 + size;
  }

  return { version, entries, extensions, ...(cacheTree ? { cacheTree } : {}) };
};

/**
 * Check if an index has an extension that Git requires a reader to understand. Git marks such an
 * extension with a signature starting with a lowercase letter, e.g. `link` for a split index or
 * `sdir` for a sparse index, while the others, starting with an uppercase letter, are optional
 * caches that can be dropped, which {@link serializeIndex} does.
 * @param {GitIndex} index Parsed index.
 * @returns {boolean} Result.
 * @see https://git-scm.com/docs/index-format#_extensions
 */
export const hasRequiredExtension = ({ extensions }) =>
  extensions.some((signature) => /^[a-z]/.test(signature));

/**
 * Mode of an index entry for a regular file.
 */
export const REGULAR_FILE_MODE = 0o100644;
/**
 * Mode of an index entry for an executable file.
 */
export const EXECUTABLE_FILE_MODE = 0o100755;

/**
 * Create an index entry for a file, in the shape Git writes it in a version 2 index.
 * @param {object} args Arguments.
 * @param {string} args.path File path, relative to the repository root.
 * @param {number} args.mode File mode, e.g. {@link REGULAR_FILE_MODE}.
 * @param {string} args.oid Object ID of the file content.
 * @param {number} args.size File size in bytes.
 * @param {number} args.mtimeMs Last modified time. It also stands in for the time the file’s
 * status changed, which the File System API doesn’t tell; the other stats, like the device and
 * inode numbers, are zero. Git finds them different from the actual ones the next time it checks
 * the working tree, and hashes the file again to be sure, which takes a moment but gives the right
 * answer.
 * @returns {GitIndexEntry} Entry.
 * @see https://git-scm.com/docs/index-format
 */
export const createIndexEntry = ({ path, mode, oid, size, mtimeMs }) => {
  const pathBytes = textEncoder.encode(path);
  // The path is followed by 1 to 8 null bytes, to a multiple of 8 bytes
  const raw = new Uint8Array((ENTRY_HEADER_SIZE + pathBytes.length + 8) & ~7);
  const view = new DataView(raw.buffer);
  const seconds = Math.floor(mtimeMs / 1000);
  const nanoseconds = Math.round((mtimeMs - seconds * 1000) * 1e6);

  // The change time, then the modification time, in seconds and nanoseconds
  [0, 8].forEach((offset) => {
    view.setUint32(offset, seconds % 2 ** 32);
    view.setUint32(offset + 4, nanoseconds);
  });

  view.setUint32(24, mode);
  view.setUint32(36, size % 2 ** 32);
  raw.set(fromHex(oid), 40);
  // The flags have the path length, unless it’s too long to fit in 12 bits
  view.setUint16(60, Math.min(pathBytes.length, 0xfff));
  raw.set(pathBytes, ENTRY_HEADER_SIZE);

  return { path, mode, oid, stage: 0, raw };
};

/**
 * Compare two paths in the order Git sorts the index entries: by their UTF-8 bytes.
 * @param {string} a One.
 * @param {string} b The other.
 * @returns {number} A negative number if `a` comes first, a positive number if `b` comes first, or
 * zero if they’re equal.
 */
const comparePaths = (a, b) => {
  const x = textEncoder.encode(a);
  const y = textEncoder.encode(b);
  const length = Math.min(x.length, y.length);

  for (let index = 0; index < length; index += 1) {
    if (x[index] !== y[index]) {
      return x[index] - y[index];
    }
  }

  return x.length - y.length;
};

/**
 * Find where an entry for a path is, or would be, among the sorted entries of an index.
 * @param {GitIndexEntry[]} entries Entries, all at stage 0.
 * @param {string} path File path.
 * @returns {{ position: number, found: boolean }} Position of the entry, or where it would be
 * inserted, and whether there’s an entry for the path.
 */
export const findIndexEntry = (entries, path) => {
  let low = 0;
  let high = entries.length;

  while (low < high) {
    const middle = (low + high) >>> 1;
    const comparison = comparePaths(entries[middle].path, path);

    if (!comparison) {
      return { position: middle, found: true };
    }

    if (comparison < 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return { position: low, found: false };
};

/**
 * Update the entries of an index, keeping them in Git’s order.
 * @param {GitIndexEntry[]} entries Entries, all at stage 0, in Git’s order.
 * @param {object} changes Changes.
 * @param {Set<string>} changes.removedPaths Paths of the files to remove.
 * @param {GitIndexEntry[]} changes.addedEntries Entries to add, or to replace the existing entry
 * for the same path with.
 * @returns {GitIndexEntry[]} New entries. The given array is left as it was.
 */
export const updateIndexEntries = (entries, { removedPaths, addedEntries }) => {
  const result = entries.filter(({ path }) => !removedPaths.has(path));

  addedEntries.forEach((entry) => {
    const { position, found } = findIndexEntry(result, entry.path);

    result.splice(position, found ? 1 : 0, entry);
  });

  return result;
};

/**
 * Serialize a tree into the data of the cache tree extension of an index, so Git and the next save
 * can use the object IDs rather than hash the trees again. Each tree is followed by its subtrees,
 * depth first, and says how many index entries it covers: its files and those of its subtrees.
 * @param {GitTreeNode} tree Root tree built from the entries of the index.
 * @returns {Uint8Array} Data.
 * @see https://git-scm.com/docs/index-format#_cache_tree
 */
export const serializeCacheTree = (tree) => {
  /** @type {Map<GitTreeNode, number>} */
  const entryCounts = new Map();

  /**
   * Count the index entries a tree covers.
   * @param {GitTreeNode} node Tree.
   * @returns {number} Count.
   */
  const count = (node) => {
    let entryCount = node.entries.filter(({ type }) => type !== 'tree').length;

    node.subtrees.forEach((subtree) => {
      entryCount += count(subtree);
    });

    entryCounts.set(node, entryCount);

    return entryCount;
  };

  /** @type {Uint8Array[]} */
  const parts = [];

  /**
   * Write a tree, followed by its subtrees.
   * @param {GitTreeNode} node Tree.
   * @param {string} name Directory name, which is empty for the root.
   */
  const write = (node, name) => {
    parts.push(
      textEncoder.encode(`${name}\0${entryCounts.get(node)} ${node.subtrees.size}\n`),
      fromHex(node.oid),
    );

    node.subtrees.forEach((subtree, subtreeName) => {
      write(subtree, subtreeName);
    });
  };

  count(tree);
  write(tree, '');

  const data = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let position = 0;

  parts.forEach((part) => {
    data.set(part, position);
    position += part.length;
  });

  return data;
};

/**
 * Serialize index entries into the content of a version 2 index file. Each entry is written as it
 * was read, stats included, so only the entries left out change. The extensions of the index read
 * are dropped, as they’re optional caches that Git rebuilds, apart from the cache tree, which is
 * written from the given tree.
 * @param {GitIndexEntry[]} entries Entries, in the order they were read.
 * @param {object} [options] Options.
 * @param {GitTreeNode} [options.tree] Tree built from the entries, to write the cache tree from.
 * @returns {Promise<Uint8Array>} Content of the index file.
 * @see https://git-scm.com/docs/index-format
 */
export const serializeIndex = async (entries, { tree } = {}) => {
  const cacheTree = tree ? serializeCacheTree(tree) : undefined;
  const entriesSize = entries.reduce((total, { raw }) => total + raw.length, 12);
  const size = entriesSize + (cacheTree ? 8 + cacheTree.length : 0);
  const bytes = new Uint8Array(size + CHECKSUM_SIZE);
  const view = new DataView(bytes.buffer);
  let position = 12;

  bytes.set(textEncoder.encode('DIRC'));
  view.setUint32(4, 2);
  view.setUint32(8, entries.length);

  entries.forEach(({ raw }) => {
    bytes.set(raw, position);
    position += raw.length;
  });

  if (cacheTree) {
    bytes.set(textEncoder.encode('TREE'), position);
    view.setUint32(position + 4, cacheTree.length);
    bytes.set(cacheTree, position + 8);
  }

  // The file ends with the SHA-1 hash of everything before it
  bytes.set(fromHex(await getHash(bytes.subarray(0, size))), size);

  return bytes;
};
