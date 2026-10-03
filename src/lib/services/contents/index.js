import { memoizeOnSource } from '$lib/services/utils/cache';
import { createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import {
 * Entry,
 * EntryFolderInfo,
 * } from '$lib/types/private';
 */

/**
 * Whether the entries and assets have been loaded from the backend.
 * @type {{ current: boolean }}
 */
export const dataLoaded = createRawState(false);

/**
 * Number of files loaded so far, if the backend reports the loading progress.
 * @type {{ current: number | undefined }}
 */
export const dataLoadedProgress = createRawState();

/**
 * @type {{ current: EntryFolderInfo[] }}
 */
export const allEntryFolders = createRawState([]);

/**
 * @type {{ current: Entry[] }}
 */
export const allEntries = createRawState([]);

/**
 * Index of {@link allEntries} by locale file path, rebuilt when the store is replaced. Each path
 * points to the first entry holding a file there, along with its position in the store.
 */
const getEntriesByPath = memoizeOnSource(
  () => allEntries.current,
  (entries) => {
    /** @type {Map<string, { entry: Entry, index: number }>} */
    const map = new Map();

    entries.forEach((entry, index) => {
      Object.values(entry.locales).forEach(({ path }) => {
        if (!map.has(path)) {
          map.set(path, { entry, index });
        }
      });
    });

    return map;
  },
);

/**
 * Find the first entry in {@link allEntries} that has a locale file at any of the given paths. The
 * Editorial Workflow looks up the published version of every unpublished entry this way, once per
 * pull request and once per card on the board, so the store is indexed rather than scanned.
 * @param {Iterable<string>} paths File paths.
 * @returns {Entry | undefined} Entry, or `undefined` if none is found.
 */
export const findEntryByPaths = (paths) => {
  const entriesByPath = getEntriesByPath();
  /** @type {{ entry: Entry, index: number } | undefined} */
  let found;

  // The entry that comes first in the store wins, whichever path it was found by
  [...paths].forEach((path) => {
    const item = entriesByPath.get(path);

    if (item && (!found || item.index < found.index)) {
      found = item;
    }
  });

  return found?.entry;
};

/**
 * @type {{ current: Error[] }}
 */
export const entryParseErrors = createRawState([]);
