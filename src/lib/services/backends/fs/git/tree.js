/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

import { fromHex, hashObject } from '$lib/services/backends/fs/git/objects';
import { toHex } from '$lib/services/utils/crypto';

/**
 * @import { GitIndexEntry, GitTreeDirectory, GitTreeEntry, GitTreeNode } from '$lib/types/private';
 */

/**
 * Mode of a tree entry for a subtree, as Git writes it, without a leading zero.
 */
export const TREE_MODE = '40000';

/**
 * Mode of an index entry for a submodule, whose object ID is a commit in another repository.
 */
const GITLINK_MODE = 0o160000;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Compare two byte arrays.
 * @param {Uint8Array} a One.
 * @param {Uint8Array} b The other.
 * @returns {number} A negative number if `a` comes first, a positive number if `b` comes first, or
 * zero if they’re equal.
 */
const compareBytes = (a, b) => {
  const length = Math.min(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }

  return a.length - b.length;
};

/**
 * Sort tree entries in the order Git requires: by the UTF-8 bytes of the name, where the name of a
 * subtree is compared as if it ended with a slash.
 * @param {GitTreeEntry[]} entries Entries.
 * @returns {GitTreeEntry[]} Sorted entries.
 */
const sortTreeEntries = (entries) => {
  const keys = new Map(
    entries.map((entry) => [
      entry,
      textEncoder.encode(entry.type === 'tree' ? `${entry.path}/` : entry.path),
    ]),
  );

  return entries.toSorted((a, b) =>
    compareBytes(/** @type {Uint8Array} */ (keys.get(a)), /** @type {Uint8Array} */ (keys.get(b))),
  );
};

/**
 * Serialize tree entries into the content of a tree object.
 * @param {GitTreeEntry[]} entries Entries, in Git’s order.
 * @returns {Uint8Array} Content.
 * @see https://git-scm.com/book/en/v2/Git-Internals-Git-Objects#_tree_objects
 */
export const serializeTree = (entries) => {
  const parts = entries.flatMap(({ mode, path, oid }) => [
    textEncoder.encode(`${mode} ${path}\0`),
    fromHex(oid),
  ]);

  const content = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let position = 0;

  parts.forEach((part) => {
    content.set(part, position);
    position += part.length;
  });

  return content;
};

/**
 * Parse the content of a tree object.
 * @param {Uint8Array} content Content.
 * @returns {Map<string, { mode: string, oid: string }>} Entries, keyed by name.
 */
export const parseTree = (content) => {
  /** @type {Map<string, { mode: string, oid: string }>} */
  const entries = new Map();
  let position = 0;

  while (position < content.length) {
    const spaceIndex = content.indexOf(0x20, position);
    const nullIndex = content.indexOf(0, spaceIndex);

    entries.set(textDecoder.decode(content.subarray(spaceIndex + 1, nullIndex)), {
      mode: textDecoder.decode(content.subarray(position, spaceIndex)),
      oid: toHex(content.subarray(nullIndex + 1, nullIndex + 21)),
    });

    position = nullIndex + 21;
  }

  return entries;
};

/**
 * Get the tree object ID a commit points to.
 * @param {Uint8Array} content Content of the commit object.
 * @returns {string | undefined} Object ID.
 */
export const getCommitTree = (content) =>
  /^tree ([0-9a-f]{40})\n/.exec(textDecoder.decode(content))?.[1];

/**
 * Get the paths of the directories a file is in, from the root, which is an empty string.
 * @param {string} path File path.
 * @returns {string[]} Directory paths, e.g. `['', 'content', 'content/posts']` for
 * `content/posts/a.md`.
 */
const getAncestorDirs = (path) => {
  const segments = path.split('/').slice(0, -1);

  return ['', ...segments.map((_, index) => segments.slice(0, index + 1).join('/'))];
};

/**
 * Build the trees that the entries of an index make up, the way `git write-tree` does, and
 * calculate their object IDs, without writing anything. Hashing every directory is the costly part
 * in a large repository, so the trees of a previous build can be reused for the directories that
 * haven’t changed since.
 * @param {GitIndexEntry[]} indexEntries Index entries, all at stage 0.
 * @param {object} [options] Options.
 * @param {GitTreeNode} [options.previous] Tree built from the index before the given paths
 * changed.
 * @param {string[]} [options.changedPaths] Paths of the files added, updated or removed since. The
 * directories they’re in are built again, and the other directories are taken from `previous`.
 * @param {Map<string, string>} [options.cacheTree] Object IDs of the trees Git has cached in the
 * index the entries come from, keyed by directory path. A directory with one isn’t hashed again.
 * @returns {Promise<GitTreeNode>} Root tree.
 */
export const buildTree = async (indexEntries, { previous, changedPaths = [], cacheTree } = {}) => {
  const changedDirs = new Set(changedPaths.flatMap(getAncestorDirs));
  /** @type {GitTreeDirectory} */
  const root = { files: [], dirs: new Map() };

  indexEntries.forEach(({ path, mode, oid }) => {
    const segments = path.split('/');
    const name = /** @type {string} */ (segments.pop());
    let dir = root;

    segments.forEach((segment) => {
      let subdir = dir.dirs.get(segment);

      if (!subdir) {
        subdir = { files: [], dirs: new Map() };
        dir.dirs.set(segment, subdir);
      }

      dir = subdir;
    });

    dir.files.push({
      mode: mode.toString(8),
      path: name,
      oid,
      type: mode === GITLINK_MODE ? 'commit' : 'blob',
    });
  });

  /**
   * Build the tree for a directory, or reuse the previous one if the directory hasn’t changed.
   * @param {GitTreeDirectory} dir Directory.
   * @param {string} dirPath Directory path, or an empty string for the root.
   * @param {GitTreeNode | undefined} previousTree Previous tree of the directory, if any.
   * @returns {Promise<GitTreeNode>} Tree.
   */
  const build = async ({ files, dirs }, dirPath, previousTree) => {
    if (previousTree && !changedDirs.has(dirPath)) {
      return previousTree;
    }

    // The subtrees are hashed concurrently, as hashing is asynchronous
    /** @type {Map<string, GitTreeNode>} */
    const subtrees = new Map(
      await Promise.all(
        [...dirs].map(
          async ([name, subdir]) =>
            /** @type {[string, GitTreeNode]} */ ([
              name,
              await build(
                subdir,
                dirPath ? `${dirPath}/${name}` : name,
                previousTree?.subtrees.get(name),
              ),
            ]),
        ),
      ),
    );

    const entries = sortTreeEntries([
      ...files,
      ...[...subtrees].map(([name, { oid }]) => ({
        mode: TREE_MODE,
        path: name,
        oid,
        type: /** @type {const} */ ('tree'),
      })),
    ]);

    const oid = cacheTree?.get(dirPath) ?? (await hashObject('tree', serializeTree(entries)));

    return { oid, entries, subtrees };
  };

  return build(root, '', previous);
};

/**
 * Write the trees that don’t exist in the repository yet. A tree is compared with the one at the
 * same path in the current commit, and only a tree that differs is written, along with the
 * subtrees that differ in turn, so a commit only writes the trees on the paths to the changed
 * files, like Git does. The trees of the current commit are read one by one, so a pack file is
 * never loaded as a whole.
 * @param {GitTreeNode} tree Tree to write.
 * @param {string | undefined} baseOid ID of the tree at the same path in the current commit, if
 * any.
 * @param {object} context Context.
 * @param {(oid: string) => Promise<{ type: string, content: Uint8Array } | undefined>}
 * context.readObject Function to read an object.
 * @param {(entries: GitTreeEntry[]) => Promise<string>} context.writeTree Function to write a tree
 * object, which returns its ID.
 * @throws {Error} If a written tree doesn’t have the expected ID, which would mean the commit
 * doesn’t have the content of the index.
 */
export const writeChangedTrees = async (tree, baseOid, { readObject, writeTree }) => {
  if (tree.oid === baseOid) {
    return;
  }

  const baseObject = baseOid ? await readObject(baseOid) : undefined;
  const baseEntries = baseObject?.type === 'tree' ? parseTree(baseObject.content) : new Map();

  for (const [name, subtree] of tree.subtrees) {
    const baseEntry = baseEntries.get(name);

    await writeChangedTrees(subtree, baseEntry?.mode === TREE_MODE ? baseEntry.oid : undefined, {
      readObject,
      writeTree,
    });
  }

  const oid = await writeTree(tree.entries);

  if (oid !== tree.oid) {
    throw new Error(`Tree object ID mismatch: expected ${tree.oid}, got ${oid}`);
  }
};
