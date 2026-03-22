import { get } from 'svelte/store';

import { backend } from '$lib/services/backends';

/**
 * @import { Entry, FileCommit } from '$lib/types/private';
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
 * @returns {Promise<EntryHistory>} The commit history result.
 */
export const fetchEntryHistory = async (entry) => {
  const { id, locales } = entry;
  const cached = historyCache.get(id);

  if (cached) {
    return cached;
  }

  const _backend = get(backend);

  if (!_backend?.fetchFileCommits) {
    return { commits: [], loading: false, error: false };
  }

  const paths = [...new Set(Object.values(locales).map((l) => l.path))];

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
 * Clear the cached commit history for the current entry so the next call to
 * {@link fetchEntryHistory} fetches fresh data.
 * @param {string} entryId The ID of the entry to clear from the cache.
 */
export const clearEntryHistoryCache = (entryId) => {
  historyCache.delete(entryId);
};
