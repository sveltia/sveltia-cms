/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */

import { DIR, INDEX_PATH, ZERO_OID } from '$lib/services/backends/fs/git/constants';
import { exists } from '$lib/services/backends/fs/git/file-system';
import {
  createIndexEntry,
  EXECUTABLE_FILE_MODE,
  findIndexEntry,
  REGULAR_FILE_MODE,
  serializeIndex,
  updateIndexEntries,
} from '$lib/services/backends/fs/git/index-file';
import { writeLooseObject } from '$lib/services/backends/fs/git/objects';
import { getIndexChecksum, setIndexCache } from '$lib/services/backends/fs/git/repository';
import { buildTree, serializeTree, writeChangedTrees } from '$lib/services/backends/fs/git/tree';
import { createCommitMessage } from '$lib/services/backends/git/shared/commits';
import { mapConcurrently } from '$lib/services/backends/git/shared/concurrency';

/**
 * @import {
 * CommitOptions,
 * FileChange,
 * GitFileSystem,
 * GitIndexEntry,
 * GitTreeEntry,
 * LocalGitRepository,
 * LocalGitSignature,
 * } from '$lib/types/private';
 */

/**
 * How many saved files are read, hashed and stored at the same time.
 */
const STAGING_CONCURRENCY = 4;

/**
 * Create a function that gives the path a file has, or would have, in the index. The CMS works with
 * paths in Unicode normalization form C, while Git keeps a path as it was added, which can be in
 * form D, e.g. a file added on Linux with a decomposed name. Using the index’s own spelling makes a
 * change update or remove the file’s entry rather than add another one next to it, and puts a new
 * file in the folder its siblings are in rather than in a second one that looks the same.
 * @param {GitIndexEntry[]} entries Index entries.
 * @returns {(path: string) => string} Function that takes a path in form C.
 */
const getIndexPathResolver = (entries) => {
  /**
   * Spelling in the index of each file or folder path that’s spelled differently in form C.
   * @type {Map<string, string>}
   */
  const spellings = new Map();

  entries.forEach(({ path }) => {
    if (path === path.normalize()) {
      return;
    }

    const segments = path.split('/');

    segments.forEach((_, index) => {
      const spelling = segments.slice(0, index + 1).join('/');

      if (spelling !== spelling.normalize()) {
        spellings.set(spelling.normalize(), spelling);
      }
    });
  });

  return (path) => {
    const segments = path.split('/');

    // Use the spelling of the longest leading part the index has, the whole path for a known file
    for (let index = segments.length; index > 0; index -= 1) {
      const spelling = spellings.get(segments.slice(0, index).join('/'));

      if (spelling) {
        return [spelling, ...segments.slice(index)].join('/');
      }
    }

    return path;
  };
};

/**
 * Get the paths of the files a list of changes adds or updates.
 * @param {FileChange[]} changes Changes, with paths relative to the repository root.
 * @returns {string[]} Paths.
 */
export const getAddedPaths = (changes) =>
  changes
    .filter(({ action }) => ['create', 'update', 'move'].includes(action))
    .map(({ path }) => path);

/**
 * Get the paths of the files a list of changes removes, including the old paths of moved files.
 * @param {FileChange[]} changes Changes, with paths relative to the repository root.
 * @returns {string[]} Paths.
 */
const getRemovedPaths = (changes) =>
  changes.flatMap(({ action, path, previousPath }) => {
    if (action === 'delete') {
      return [path];
    }

    if (action === 'move' && previousPath) {
      return [previousPath];
    }

    return [];
  });

/**
 * Convert CRLF line endings to LF, as Git does for text when `core.autocrlf` is `true` or `input`.
 * Content that isn’t valid UTF-8 is taken as binary and left as it is.
 * @param {Uint8Array} content File content.
 * @returns {Uint8Array} Converted content.
 */
export const convertToLF = (content) => {
  /** @type {string} */
  let text;

  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch {
    return content;
  }

  return new TextEncoder().encode(text.replaceAll('\r\n', '\n'));
};

/**
 * Prepare the index entries for files that have been saved, the way `git add` does: the content is
 * written as a blob, and an untracked file that Git ignores is skipped. A file that’s tracked
 * keeps its mode, so an executable file stays executable.
 * @param {LocalGitRepository} repository Repository.
 * @param {string[]} paths File paths, as spelled in the index.
 * @returns {Promise<GitIndexEntry[]>} Entries.
 * @throws {Error} If a file can’t be read.
 */
const stageFiles = async ({ git, fs, index, autocrlf }, paths) => {
  // A few files at a time, so a bulk upload isn’t read back into memory all at once
  const entries = await mapConcurrently(
    paths,
    async (path) => {
      const { position, found } = findIndexEntry(index.entries, path);

      if (!found && (await git.isIgnored({ fs, dir: DIR, filepath: path }))) {
        return undefined;
      }

      const { size, mtimeMs } = await fs.stat(path);
      /** @type {Uint8Array} */
      let content = await fs.readFile(path);

      // Store the text with LF line endings, like Git does with the option
      if (autocrlf) {
        content = convertToLF(content);
      }

      return createIndexEntry({
        path,
        mode:
          found && index.entries[position].mode === EXECUTABLE_FILE_MODE
            ? EXECUTABLE_FILE_MODE
            : REGULAR_FILE_MODE,
        oid: await writeLooseObject(fs, 'blob', content),
        size,
        mtimeMs,
      });
    },
    { concurrency: STAGING_CONCURRENCY },
  );

  return /** @type {GitIndexEntry[]} */ (entries.filter(Boolean));
};

/**
 * Format a time zone offset the way Git does, e.g. `+0900` for Japan.
 * @param {number} offset Offset in minutes, as returned by `Date.prototype.getTimezoneOffset()`,
 * which is positive for a time zone behind UTC.
 * @returns {string} Formatted offset.
 */
export const formatTimezoneOffset = (offset) => {
  const minutes = Math.abs(offset);
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');

  return `${offset > 0 ? '-' : '+'}${hours}${String(minutes % 60).padStart(2, '0')}`;
};

/**
 * Record a commit in the reflogs of `HEAD` and the branch, so the user can find it with `git
 * reflog`, like a commit made with Git. A reflog is only added to, not created: Git creates them
 * unless they’re disabled.
 * @param {GitFileSystem} fs File system.
 * @param {object} args Arguments.
 * @param {string} args.branch Full name of the branch.
 * @param {string | undefined} args.oldOid ID of the previous commit, if any.
 * @param {string} args.newOid ID of the new commit.
 * @param {LocalGitSignature} args.signature Author and time of the commit.
 * @param {string} args.message Commit message.
 */
const addToReflogs = async (fs, { branch, oldOid, newOid, signature, message }) => {
  const { name, email, timestamp, timezoneOffset } = signature;
  const action = oldOid ? 'commit' : 'commit (initial)';
  const subject = message.split('\n')[0];
  const identity = `${name} <${email}> ${timestamp} ${formatTimezoneOffset(timezoneOffset)}`;
  const line = `${oldOid ?? ZERO_OID} ${newOid} ${identity}\t${action}: ${subject}\n`;

  for (const path of ['.git/logs/HEAD', `.git/logs/${branch}`]) {
    if (await exists(fs, path)) {
      await fs.appendFile(path, line);
    }
  }
};

/**
 * Stage and commit changes that have been saved to the working tree.
 * @param {LocalGitRepository} repository Repository, as inspected before the changes were saved.
 * @param {FileChange[]} changes Changes, with paths relative to the repository root.
 * @param {CommitOptions} options Commit options.
 * @returns {Promise<{ oid: string, signature: LocalGitSignature, message: string } | undefined>}
 * ID, author, time and message of the new commit, or `undefined` if the changes didn’t change
 * anything Git tracks, e.g. a file saved without changes, or a file Git ignores.
 * @throws {Error} If the changes couldn’t be committed.
 */
const stageAndCommit = async (repository, changes, options) => {
  const { git, fs, reader, branch, author, headOid, headTreeOid } = repository;
  let { index, indexTree: tree } = repository;
  const toIndexPath = getIndexPathResolver(index.entries);
  const removedPaths = new Set(getRemovedPaths(changes).map(toIndexPath));
  const addedPaths = getAddedPaths(changes).map(toIndexPath);
  const addedEntries = await stageFiles(repository, addedPaths);

  // The index is updated in memory and written once, rather than with `git.add()` and
  // `git.remove()`, which would read, verify and write the whole index for each call
  if (addedEntries.length || index.entries.some(({ path }) => removedPaths.has(path))) {
    const entries = updateIndexEntries(index.entries, { removedPaths, addedEntries });

    // Only the directories of the changed files have to be hashed again
    tree = await buildTree(entries, {
      previous: tree,
      changedPaths: [...removedPaths, ...addedPaths],
    });

    // The trees are written to the index as a cache tree, which Git and the next save can use
    const bytes = await serializeIndex(entries, { tree });

    await fs.writeFile(INDEX_PATH, bytes);
    index = { version: 2, entries, extensions: ['TREE'] };
    setIndexCache({ checksum: getIndexChecksum(bytes), index, tree });
  }

  if (headTreeOid ? tree.oid === headTreeOid : !index.entries.length) {
    return undefined;
  }

  // isomorphic-git would write every tree in the repository that isn’t a loose object, as it
  // doesn’t look into pack files, so the trees are written here, and only the changed ones
  await writeChangedTrees(tree, headTreeOid, {
    readObject: reader.readObject,
    /**
     * Write a tree object.
     * @param {GitTreeEntry[]} treeEntries Entries.
     * @returns {Promise<string>} Object ID.
     */
    writeTree: (treeEntries) => writeLooseObject(fs, 'tree', serializeTree(treeEntries)),
  });

  /** @type {string | undefined} */
  let currentHeadOid;

  try {
    currentHeadOid = await git.resolveRef({ fs, dir: DIR, ref: branch });
  } catch {
    //
  }

  // Git can’t update the branch while the index is locked, but a tool that doesn’t check the lock
  // could have, and the new commit would undo its commit
  if (currentHeadOid !== headOid) {
    throw new Error('The branch has been updated by another program.');
  }

  const timestamp = Math.floor(Date.now() / 1000);

  /** @type {LocalGitSignature} */
  const signature = {
    ...author,
    timestamp,
    timezoneOffset: new Date(timestamp * 1000).getTimezoneOffset(),
  };

  const message = createCommitMessage(changes, options);

  /** @type {string} */
  const oid = await git.commit({
    fs,
    dir: DIR,
    ref: branch,
    message,
    tree: tree.oid,
    author: signature,
    committer: signature,
  });

  return { oid, signature, message };
};

/**
 * Commit changes that have been saved to the working tree. If the commit fails, the index is put
 * back as it was, so the changes staged for it don’t look like the user’s own the next time and
 * stop every later commit.
 * @param {LocalGitRepository} repository Repository, as inspected before the changes were saved.
 * @param {FileChange[]} changes Changes, with paths relative to the repository root.
 * @param {CommitOptions} options Commit options.
 * @returns {Promise<{ oid: string, date: Date } | undefined>} ID and date of the new commit, or
 * `undefined` if the changes didn’t change anything Git tracks.
 * @throws {Error} If the changes couldn’t be committed.
 */
export const commitSavedChanges = async (repository, changes, options) => {
  const { fs, indexBuffer, branch, headOid } = repository;
  let commit;

  try {
    commit = await stageAndCommit(repository, changes, options);
  } catch (ex) {
    if (indexBuffer) {
      await fs.writeFile(INDEX_PATH, new Uint8Array(indexBuffer));
    } else if (await exists(fs, INDEX_PATH)) {
      await fs.unlink(INDEX_PATH);
    }

    throw ex;
  }

  if (!commit) {
    return undefined;
  }

  const { oid, signature, message } = commit;

  // The commit has been made by now, so the index mustn’t be put back if the reflogs can’t be
  // written: it would undo the commit the next time the user commits
  try {
    await addToReflogs(fs, { branch, oldOid: headOid, newOid: oid, signature, message });
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error(ex);
  }

  return { oid, date: new Date(signature.timestamp * 1000) };
};
