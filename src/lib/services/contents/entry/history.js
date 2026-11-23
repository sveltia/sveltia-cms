import { backend } from '$lib/services/backends';
import { getEarlierEntryPaths } from '$lib/services/contents/entry/earlier-paths';
import { getEntryPaths } from '$lib/services/contents/entry/paths';

/**
 * @import { Entry, FileCommit, InternalCollection } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

/**
 * @typedef {object} EntryHistory
 * @property {FileCommit[]} commits Fetched commits.
 * @property {boolean} loading Whether commits are being fetched.
 * @property {boolean} error Whether the fetch failed.
 */

/** @type {Map<string, EntryHistory>} */
const historyCache = new Map();

/**
 * Fetch the commit history for the current entry draft, using a cache to avoid redundant requests.
 * Returns immediately if the data is already cached for the same entry.
 * @param {Entry} entry The entry to fetch the history for.
 * @param {object} [options] Options.
 * @param {InternalCollection} [options.collection] Collection of the entry, to include the history
 * of the files it had before it was renamed outside the CMS, which the Git host doesn’t carry over;
 * see {@link getEarlierEntryPaths}.
 * @param {Field[]} [options.fields] Field list of the collection.
 * @returns {Promise<EntryHistory>} The commit history result.
 */
export const fetchEntryHistory = async (entry, { collection, fields } = {}) => {
  const { id } = entry;
  const cached = historyCache.get(id);

  if (cached) {
    return cached;
  }

  const _backend = backend.current;

  if (!_backend?.fetchFileCommits) {
    return { commits: [], loading: false, error: false };
  }

  const paths = [
    ...getEntryPaths(entry),
    ...(collection
      ? getEarlierEntryPaths({ collection, fields, entry }).flatMap((earlier) => earlier.paths)
      : []),
  ];

  try {
    const commits = await _backend.fetchFileCommits(paths);
    const result = { commits, loading: false, error: false };

    historyCache.set(id, result);

    return result;
  } catch {
    const result = { commits: [], loading: false, error: true };

    historyCache.set(id, result);

    return result;
  }
};

/**
 * Clear the cached commit history for the given entry ID, so that the next call to
 * {@link fetchEntryHistory} fetches fresh data.
 * @param {string} entryId The ID of the entry to clear from the cache.
 */
export const clearEntryHistoryCache = (entryId) => {
  historyCache.delete(entryId);
};
