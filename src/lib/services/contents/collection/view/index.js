import equal from 'fast-deep-equal';
import { derived, get, writable } from 'svelte/store';

import { appLocaleStore } from '$lib/services/app/i18n';
import { backend } from '$lib/services/backends';
import { allEntries } from '$lib/services/contents';
import { selectedCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection, selectedEntries } from '$lib/services/contents/collection/entries';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { filterEntries } from '$lib/services/contents/collection/view/filter';
import { groupEntries } from '$lib/services/contents/collection/view/group';
import { entryListSettings, initSettings } from '$lib/services/contents/collection/view/settings';
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
 * Threshold for when to show a warning about nearing the quota of entries in an entry collection.
 * This is used in the UI to provide feedback to users when they are close to reaching the maximum
 * number of entries allowed in a collection, based on the collection’s quota settings.
 * @type {number}
 */
const QUOTA_WARNING_THRESHOLD = 5;

/**
 * State of the selected collection, including permissions and quota information, used for
 * controlling the UI and providing feedback to users.
 * @type {Readable<{ isEntryCollection: boolean; canCreate: boolean; canDelete: boolean; quota:
 * number; remaining: number; nearingQuota: boolean, creationDisabled: boolean }>}
 */
export const collectionState = derived(
  [listedEntries, selectedCollection],
  ([_listedEntries, _selectedCollection]) => {
    if (_selectedCollection?._type === 'entry') {
      const canCreate = _selectedCollection.create ?? true;
      const canDelete = _selectedCollection.delete ?? true;
      const quota = _selectedCollection?.limit ?? Infinity;
      const remaining = quota < Infinity ? quota - _listedEntries.length : Infinity;

      return {
        isEntryCollection: true,
        canCreate,
        canDelete,
        quota,
        remaining,
        nearingQuota: remaining > 0 && remaining <= QUOTA_WARNING_THRESHOLD,
        creationDisabled: !canCreate || remaining <= 0,
      };
    }

    return {
      isEntryCollection: false,
      canCreate: false,
      canDelete: false,
      quota: Infinity,
      remaining: Infinity,
      nearingQuota: false,
      creationDisabled: false,
    };
  },
);

/**
 * Cache to avoid unnecessary re-processing in `entryGroups` derived store when only
 * `appLocale.current` changes (which is a dependency for localized sort/group labels).
 */
let lastListedEntries = /** @type {Entry[] | undefined} */ (undefined);
let lastCurrentView = /** @type {EntryListView | undefined} */ (undefined);

/**
 * Sorted, filtered and grouped entries for the selected entry collection.
 * @type {Readable<{ name: string, entries: Entry[] }[]>}
 */
export const entryGroups = derived(
  // Include `appLocale.current` as a dependency because `sortEntries()` and `groupEntries()` may
  // return localized labels
  [listedEntries, currentView, appLocaleStore],
  ([_listedEntries, _currentView], set) => {
    // Use reference equality: when only `appLocale.current` changes, `listedEntries` and
    // `currentView` retain the same references, so we can skip expensive re-computation.
    if (_listedEntries === lastListedEntries && _currentView === lastCurrentView) {
      return;
    }

    lastListedEntries = _listedEntries;
    lastCurrentView = _currentView;
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

backend.subscribe((_backend) => {
  if (_backend && !get(entryListSettings)) {
    initSettings(_backend);
  }
});

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
