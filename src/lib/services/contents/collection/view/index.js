import equal from 'fast-deep-equal';
import { derived, get, writable } from 'svelte/store';
import { locale as appLocale } from 'svelte-i18n';

import { allEntries } from '$lib/services/contents';
import { selectedCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection, selectedEntries } from '$lib/services/contents/collection/entries';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { filterEntries } from '$lib/services/contents/collection/view/filter';
import { groupEntries } from '$lib/services/contents/collection/view/group';
import { sortEntries } from '$lib/services/contents/collection/view/sort';
import { prefs } from '$lib/services/user/prefs';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { Entry, EntryListView, InternalEntryCollection } from '$lib/types/private';
 */

/**
 * View settings for the selected entry collection.
 * @type {Writable<EntryListView>}
 */
export const currentView = writable({ type: 'list' });

/**
 * List of all the entries for the selected entry collection.
 * @type {Readable<Entry[]>}
 */
export const listedEntries = derived(
  [allEntries, selectedCollection],
  ([_allEntries, _collection], set) => {
    if (_allEntries && _collection) {
      set(getEntriesByCollection(_collection.name));
    } else {
      set([]);
    }
  },
);

/**
 * Cache key to avoid unnecessary re-processing in `entryGroups` derived store.
 */
let cacheKey = '';

/**
 * Sorted, filtered and grouped entries for the selected entry collection.
 * @type {Readable<{ name: string, entries: Entry[] }[]>}
 */
export const entryGroups = derived(
  // Include `appLocale` as a dependency because `sortEntries()` and `groupEntries()` may return
  // localized labels
  [listedEntries, currentView, appLocale],
  ([_listedEntries, _currentView], set) => {
    const newCacheKey = JSON.stringify({ _listedEntries, _currentView });

    if (newCacheKey === cacheKey) {
      return;
    }

    cacheKey = newCacheKey;
    set([]);

    const collection = /** @type {InternalEntryCollection} */ (get(selectedCollection));
    /** @type {Entry[]} */
    let entries = [..._listedEntries];

    // Reset the groups if the current collection is empty or a file/singleton collection
    if (!entries.length || !!getCollectionFilesByEntry(collection, entries[0]).length) {
      return;
    }

    if (_currentView.sort) {
      entries = sortEntries(entries, collection, _currentView.sort);
    }

    if (_currentView.filters) {
      entries = filterEntries(entries, collection, _currentView.filters);
    }

    const groups = groupEntries(entries, collection, _currentView.group);

    if (!equal(get(entryGroups), groups)) {
      set(groups);
    }
  },
);

listedEntries.subscribe((entries) => {
  selectedEntries.set([]);

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('listedEntries', entries);
  }
});

selectedCollection.subscribe((collection) => {
  if (collection && get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('selectedCollection', collection);
  }
});
