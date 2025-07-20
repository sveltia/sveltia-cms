import { IndexedDB } from '@sveltia/utils/storage';
import { get } from 'svelte/store';
import { allAssets } from '$lib/services/assets';
import { backend } from '$lib/services/backends';
import { allEntries } from '$lib/services/contents';
import { user } from '$lib/services/user';
import { prefs } from '$lib/services/user/prefs';
import { getBlob } from '$lib/services/utils/file';

/**
 * @import {
 * Asset,
 * BackendService,
 * ChangeResults,
 * CommitAuthor,
 * CommitOptions,
 * CommitResults,
 * Entry,
 * FileChange,
 * RepositoryFileInfo,
 * User,
 * } from '$lib/types/private';
 */

/**
 * Get the commit author information from the user store.
 * @returns {CommitAuthor | undefined} Commit author information including `name`, `email`, `id`,
 * and `login`. `undefined` for the local and test-repo backends.
 */
export const getCommitAuthor = () => {
  const userData = /** @type {User} */ (get(user));

  if (!userData) {
    return undefined;
  }

  const { name, email, id, login } = userData;

  if (!name || !email) {
    return undefined;
  }

  return { name, email, id, login };
};

/**
 * Update the file cache with the given changes. This will update the file cache with the latest
 * file content and metadata, such as SHA and size, for Git-based backends.
 * @param {object} args Arguments.
 * @param {FileChange[]} args.changes Committed changes.
 * @param {CommitResults} args.commit Commit results.
 */
export const updateCache = async ({ changes, commit }) => {
  const { databaseName } = get(backend)?.repository ?? {};

  if (!databaseName) {
    return;
  }

  const cacheDB = new IndexedDB(databaseName, 'file-cache');
  const { files, author: commitAuthor, date: commitDate } = commit;
  const meta = { commitAuthor, commitDate };

  await Promise.all(
    changes.map(async (change) => {
      const { action, slug, path, previousPath, data } = change;

      // Skip if the change is made to an asset; we only handle entries
      if (typeof data !== 'string' || !slug) {
        return;
      }

      // Delete the file from the cache if the action is `delete`
      if (action === 'delete') {
        await cacheDB.delete(path);
        return;
      }

      // Delete the previous file from the cache if the action is `move`
      if (action === 'move') {
        await cacheDB.delete(previousPath);
      }

      /** @type {RepositoryFileInfo} */
      const fileInfo = {
        sha: files[path]?.sha,
        size: getBlob(data).size,
        text: data,
        meta,
      };

      // Update the file cache with the new file content and metadata
      await cacheDB.set(path, fileInfo);
    }),
  );
};

/**
 * Update the entry and asset stores with the results of the commit changes.
 * @param {object} args Arguments.
 * @param {FileChange[]} args.changes Committed changes.
 * @param {Entry[]} args.savedEntries Entries that have been saved.
 * @param {Asset[]} args.savedAssets Assets that have been saved.
 */
export const updateStores = ({ changes, savedEntries, savedAssets }) => {
  const savedEntryIds = savedEntries.map((e) => e.id);

  allEntries.update((entries) => [
    ...entries.filter((e) => !savedEntryIds.includes(e.id)),
    ...savedEntries,
  ]);

  const savedAssetsPaths = savedAssets.map((a) => a.path);
  const movedAssetPaths = changes.filter((c) => c.action === 'move').map((c) => c.previousPath);
  const deletedAssetPaths = changes.filter((c) => c.action === 'delete').map((c) => c.path);
  const excludingPaths = [...savedAssetsPaths, ...movedAssetPaths, ...deletedAssetPaths];

  allAssets.update((assets) => [
    ...assets.filter((a) => !excludingPaths.includes(a.path)),
    ...savedAssets,
  ]);
};

/**
 * Save changes to the backend and update the file cache and stores with the results.
 * @param {object} args Arguments.
 * @param {FileChange[]} args.changes Changes to be committed.
 * @param {Entry[]} [args.savingEntries] Entries to be saved.
 * @param {Asset[]} [args.savingAssets] Assets to be saved.
 * @param {CommitOptions} args.options Options for committing changes, such as commit type.
 * @returns {Promise<ChangeResults>} Change results containing the commit information, saved
 * entries, and saved assets.
 */
export const saveChanges = async ({ changes, savingEntries = [], savingAssets = [], options }) => {
  const { commitChanges } = /** @type {BackendService} */ (get(backend));

  /** @type {CommitResults} */
  const commit = {
    ...(await commitChanges(changes, options)),
    author: getCommitAuthor(),
  };

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.debug('Commit changes:', changes);
    // eslint-disable-next-line no-console
    console.debug('Commit results:', commit);
  }

  const { files, author: commitAuthor, date: commitDate } = commit;

  const savedEntries = savingEntries.map(
    (entry) => /** @type {Entry} */ ({ ...entry, commitAuthor, commitDate }),
  );

  const savedAssets = savingAssets.map((asset) => {
    const { sha, file } = files[asset.path] ?? {};
    const blobURL = file ? URL.createObjectURL(file) : undefined;

    return /** @type {Asset} */ ({ ...asset, sha, blobURL, commitAuthor, commitDate });
  });

  await updateCache({ changes, commit });
  updateStores({ changes, savedEntries, savedAssets });

  return { commit, savedEntries, savedAssets };
};
