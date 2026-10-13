import { loadChunk } from '$lib/services/app/dependencies';
import { DIR, INDEX_LOCK_PATH, OPERATION_MARKERS } from '$lib/services/backends/fs/git/constants';
import { createGitFileSystem, exists } from '$lib/services/backends/fs/git/file-system';
import { hasRequiredExtension, parseIndex } from '$lib/services/backends/fs/git/index-file';
import { createObjectReader } from '$lib/services/backends/fs/git/objects';
import { buildTree, getCommitTree } from '$lib/services/backends/fs/git/tree';
import { isNotFoundError, readFile } from '$lib/services/backends/fs/shared/handles';
import { toHex } from '$lib/services/utils/crypto';

/**
 * @import {
 * GitFileSystem,
 * GitIndex,
 * GitTreeNode,
 * LocalGitInspection,
 * LocalGitOperation,
 * } from '$lib/types/private';
 */

/**
 * Index as of the last save, parsed, along with the tree built from it and the checksum the index
 * file ends with. Parsing the index and hashing every directory are the costly parts of a save in
 * a large repository, so they’re reused as long as the index hasn’t changed, e.g. between two saves
 * without any Git command in between. Both only depend on the index content, so they’re right for
 * any repository.
 * @type {{ checksum: string, index: GitIndex, tree?: GitTreeNode } | undefined}
 */
let indexCache;

/**
 * Forget the cached index and tree, e.g. once the user has signed out, so the memory they take in a
 * large repository is freed.
 */
export const clearLocalGitCache = () => {
  indexCache = undefined;
};

/**
 * Cache an index along with its tree, e.g. once the CMS has written it.
 * @param {{ checksum: string, index: GitIndex, tree: GitTreeNode }} cache Checksum of the index
 * file, parsed index and tree.
 */
export const setIndexCache = (cache) => {
  indexCache = cache;
};

/**
 * Get the checksum an index file ends with: the SHA-1 hash of the rest of the file.
 * @param {Uint8Array} bytes Content of the index file.
 * @returns {string} Checksum.
 */
export const getIndexChecksum = (bytes) => toHex(bytes.subarray(-20));

/**
 * Build the tree of an index, reusing the cached one if the index hasn’t changed, and cache it.
 * @param {GitIndex} index Index.
 * @param {string} checksum Checksum of the index file.
 * @returns {Promise<GitTreeNode>} Tree.
 */
const getIndexTree = async (index, checksum) => {
  if (indexCache?.checksum === checksum && indexCache.tree) {
    return indexCache.tree;
  }

  // The trees Git has cached in an index it wrote don’t have to be hashed again
  const tree = await buildTree(index.entries, { cacheTree: index.cacheTree });

  indexCache = { checksum, index, tree };

  return tree;
};

/**
 * Read the index of a repository, reusing the cached parsed index if it hasn’t changed.
 * @param {FileSystemDirectoryHandle} gitDirHandle Handle of the `.git` directory.
 * @returns {Promise<{ index: GitIndex, buffer?: ArrayBuffer, checksum: string }>} Parsed index,
 * which is empty if the repository doesn’t have one yet, the content of the file, if any, and its
 * checksum, which is an empty string without a file.
 * @throws {Error} If the file exists but can’t be read.
 */
const readIndex = async (gitDirHandle) => {
  /** @type {ArrayBuffer | undefined} */
  let buffer;

  try {
    buffer = await (await readFile(gitDirHandle, 'index')).arrayBuffer();
  } catch (ex) {
    if (!isNotFoundError(ex)) {
      throw ex;
    }
  }

  const checksum = buffer ? getIndexChecksum(new Uint8Array(buffer)) : '';

  if (indexCache?.checksum === checksum) {
    return { index: indexCache.index, buffer, checksum };
  }

  /** @type {GitIndex} */
  const index = buffer ? parseIndex(buffer) : { version: 2, entries: [], extensions: [] };

  // The index is only cached along with its tree, once it’s known to be one the CMS can work with
  return { index, buffer, checksum };
};

/**
 * Tell which operation a marker in `.git` is for, where it can be more than one.
 * @param {GitFileSystem} fs File system.
 * @param {string} marker Marker found.
 * @param {LocalGitOperation} operation Operation the marker usually stands for.
 * @returns {Promise<LocalGitOperation>} Operation.
 */
const identifyOperation = async (fs, marker, operation) => {
  // `git am` uses the same directory as the apply backend of `git rebase`, and marks it
  if (marker === 'rebase-apply' && (await exists(fs, '.git/rebase-apply/applying'))) {
    return 'am';
  }

  // A cherry-pick or revert of several commits leaves the rest of its list here once a conflict has
  // been resolved and committed, until the user continues it
  if (marker === 'sequencer' && (await exists(fs, '.git/sequencer/todo'))) {
    const todo = /** @type {string} */ (
      await fs.readFile('.git/sequencer/todo', { encoding: 'utf8' })
    );

    return todo.trimStart().startsWith('revert') ? 'revert' : 'cherry_pick';
  }

  return operation;
};

/**
 * Check whether the CMS can commit to a repository on the user’s computer right now, and gather
 * what it needs to do so. It can if it understands the repository’s format, knows who the author
 * is, and the index, the files staged for the next commit, matches the current commit: a commit
 * includes everything in the index, so anything the user has staged themselves would end up in the
 * CMS’s commit. Changes that aren’t staged don’t matter, as the CMS only stages the files it saves.
 * @param {FileSystemDirectoryHandle} repoRootDirHandle Handle of the repository’s root directory.
 * @param {object} [options] Options.
 * @param {(fs: GitFileSystem) => void} [options.onLock] Function to call once the index has been
 * locked. If given, the index is locked as soon as it’s known not to be, so the rest of the
 * inspection and anything after it see an index no other Git process can change. The caller has to
 * remove the lock.
 * @returns {Promise<LocalGitInspection>} Result.
 */
export const inspectRepository = async (repoRootDirHandle, { onLock } = {}) => {
  /** @type {FileSystemDirectoryHandle} */
  let gitDirHandle;

  try {
    gitDirHandle = await repoRootDirHandle.getDirectoryHandle('.git');
  } catch (ex) {
    // `.git` is a file in a linked worktree or a submodule, pointing to a directory elsewhere, out
    // of reach of the browser
    if (/** @type {DOMException} */ (ex)?.name === 'TypeMismatchError') {
      return { ready: false, reason: 'unsupported_repository' };
    }

    throw ex;
  }

  const git = await loadChunk('git');
  const fs = createGitFileSystem(repoRootDirHandle, { Buffer: git.Buffer });

  // isomorphic-git only reads the repository’s own configuration, not the user’s global one
  const [objectFormat, refStorage, name, email, autocrlf] = await Promise.all(
    [
      'extensions.objectformat',
      'extensions.refstorage',
      'user.name',
      'user.email',
      'core.autocrlf',
    ].map((path) => git.getConfig({ fs, dir: DIR, path })),
  );

  if ((objectFormat && objectFormat !== 'sha1') || (refStorage && refStorage !== 'files')) {
    return { ready: false, reason: 'unsupported_repository' };
  }

  if (!name || !email) {
    return { ready: false, reason: 'missing_identity' };
  }

  const author = { name, email };

  if (await exists(fs, INDEX_LOCK_PATH)) {
    return { ready: false, reason: 'locked', author };
  }

  if (onLock) {
    await fs.writeFile(INDEX_LOCK_PATH, '');
    onLock(fs);
  }

  const markers = await Promise.all(
    OPERATION_MARKERS.map(([marker]) => exists(fs, `.git/${marker}`)),
  );

  const foundMarker = OPERATION_MARKERS.find((_, index) => markers[index]);

  if (foundMarker) {
    return {
      ready: false,
      reason: 'operation_in_progress',
      detail: await identifyOperation(fs, ...foundMarker),
      author,
    };
  }

  /** @type {string | undefined} */
  const branch = await git.currentBranch({ fs, dir: DIR, fullname: true });

  if (!branch) {
    return { ready: false, reason: 'detached_head', author };
  }

  const { index, buffer: indexBuffer, checksum: indexChecksum } = await readIndex(gitDirHandle);

  if (index.version !== 2 || hasRequiredExtension(index)) {
    return { ready: false, reason: 'unsupported_repository', author, branch };
  }

  // A file with a conflict has an entry for each side of the merge
  if (index.entries.some(({ stage }) => stage)) {
    return {
      ready: false,
      reason: 'operation_in_progress',
      detail: 'conflict',
      author,
      branch,
    };
  }

  const reader = createObjectReader(gitDirHandle);
  /** @type {string | undefined} */
  let headOid;
  /** @type {string | undefined} */
  let headTreeOid;

  try {
    headOid = await git.resolveRef({ fs, dir: DIR, ref: branch });
  } catch (ex) {
    // The branch has no commits yet
    if (/** @type {any} */ (ex)?.code !== 'NotFoundError') {
      throw ex;
    }
  }

  if (headOid) {
    const commit = await reader.readObject(headOid);

    headTreeOid = commit?.type === 'commit' ? getCommitTree(commit.content) : undefined;

    // The commit may be in another repository whose objects this one borrows, or not downloaded
    // yet in a partial clone
    if (!headTreeOid) {
      return { ready: false, reason: 'unsupported_repository', author, branch };
    }
  }

  const indexTree = await getIndexTree(index, indexChecksum);

  if (headTreeOid ? indexTree.oid !== headTreeOid : index.entries.length > 0) {
    return { ready: false, reason: 'staged_changes', author, branch };
  }

  return {
    ready: true,
    author,
    branch,
    repository: {
      git,
      fs,
      gitDirHandle,
      reader,
      branch,
      author,
      headOid,
      headTreeOid,
      index,
      indexBuffer,
      indexTree,
      // Git converts the line endings when adding a file with both values
      autocrlf: ['true', 'input'].includes(String(autocrlf)),
    },
  };
};
