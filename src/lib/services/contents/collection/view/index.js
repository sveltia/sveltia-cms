import { derived, get, writable } from 'svelte/store';

import { appLocaleStore } from '$lib/services/app/i18n';
import { backend } from '$lib/services/backends';
import { allEntries } from '$lib/services/contents';
import { selectedCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection, selectedEntries } from '$lib/services/contents/collection/entries';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { filterEntries } from '$lib/services/contents/collection/view/filter';
import {
  getReorderGroupingConditions,
  groupEntries,
} from '$lib/services/contents/collection/view/group';
import { entryListSettings, initSettings } from '$lib/services/contents/collection/view/settings';
import { sortEntries } from '$lib/services/contents/collection/view/sort';
import { prefs } from '$lib/services/user/prefs.svelte';
import { swapUnpublishedEntries, unpublishedEntries } from '$lib/services/workflow';
import { openAuthoring } from '$lib/services/workflow/open-authoring';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { Entry, EntryListView, InternalEntryCollection } from '$lib/types/private';
 */

/**
 * @typedef {object} CollectionState
 * @property {boolean} isEntryCollection Whether the selected collection is an entry collection.
 * @property {boolean} canCreate Whether new entries can be created in the selected collection.
 * @property {boolean} canDelete Whether entries can be deleted from the selected collection.
 * @property {boolean} canReorder Whether entries in the selected collection can be reordered.
 * @property {number} quota The maximum number of entries allowed in the selected collection.
 * @property {number} remaining The number of additional entries that can be added to the selected
 * collection before reaching the quota.
 * @property {boolean} nearingQuota Whether the number of remaining entries is at or below the
 * warning threshold.
 * @property {boolean} creationDisabled Whether creating new entries is currently disabled, either
 * due to permissions or because the quota has been reached.
 */

/**
 * View settings for the selected entry collection.
 * @type {Writable<EntryListView>}
 */
export const currentView = writable({ type: 'list' });

/**
 * Whether the entry collection is in reorder mode, which allows users to reorder entries with a
 * drag-and-drop UI. This is used to control the UI state and behavior when reordering entries in a
 * collection.
 * @type {Writable<boolean>}
 */
export const reordering = writable(false);

/**
 * Pending reorder result while the entry collection is in reorder mode. The list contains the
 * collection’s entries in the order the user has arranged them in the UI. It is consumed when the
 * user confirms the reorder, then reset.
 * @type {Writable<Entry[]>}
 */
export const reorderedEntries = writable([]);

/**
 * Whether the user has actually moved an entry while in reorder mode. The toolbar Save button uses
 * this to stay disabled until at least one move has happened, so a simple Enter → Save round-trip
 * doesn’t cause a no-op commit.
 * @type {Writable<boolean>}
 */
export const reorderDirty = writable(false);

/**
 * View snapshot taken when entering reorder mode, restored on exit so the user’s prior sort/filter/
 * grouping returns once they finish (or cancel) reordering. `undefined` while not in reorder mode.
 * @type {EntryListView | undefined}
 */
let viewBeforeReorder;

/**
 * List of all the entries for the selected entry collection.
 * @type {Readable<Entry[]>}
 */
export const listedEntries = derived(
  [allEntries, selectedCollection, unpublishedEntries, reordering],
  ([_allEntries, _collection, _unpublishedEntries, _reordering], set) => {
    if (!_allEntries || !_collection) {
      set([]);

      return;
    }

    const entries = getEntriesByCollection(_collection.name);

    // Don’t swap while reordering, because the reorder UI persists an order field on the published
    // entries, and the draft version must not leak into that commit
    if (_reordering) {
      set(entries);

      return;
    }

    // Show the pending changes rather than what’s live, so the list sorts, filters and groups by
    // them
    set(
      swapUnpublishedEntries(
        entries,
        _unpublishedEntries.filter(({ workflow }) => workflow.collectionName === _collection.name),
      ),
    );
  },
);

/**
 * List of unpublished entries for the selected entry collection that have never been published,
 * sorted and filtered with the same view settings as {@link entryGroups}. Unlike an update to an
 * existing entry, which replaces the published version in {@link listedEntries}, these are listed
 * in a separate group above the published entries.
 * @type {Readable<Entry[]>}
 */
export const listedUnpublishedEntries = derived(
  // Include `appLocale.current` as a dependency because `sortEntries()` may return localized labels
  [unpublishedEntries, listedEntries, selectedCollection, currentView, reordering, appLocaleStore],
  ([_unpublishedEntries, _listedEntries, _collection, _currentView, _reordering]) => {
    if (_collection?._type !== 'entry' || _reordering) {
      return [];
    }

    // A draft that replaced a published entry is already in `listedEntries`, so match by identity
    // rather than by path, which a rename would break
    const swappedIn = new Set(_listedEntries);

    /** @type {Entry[]} */
    let entries = _unpublishedEntries.filter(
      (entry) => entry.workflow.collectionName === _collection.name && !swappedIn.has(entry),
    );

    if (!entries.length) {
      return [];
    }

    if (_currentView.sort) {
      entries = sortEntries(entries, _collection, _currentView.sort);
    }

    if (_currentView.filters) {
      entries = filterEntries(entries, _collection, _currentView.filters);
    }

    return entries;
  },
);

/**
 * Map from entry ID to the entry’s index in {@link listedEntries}, used by list rows to resolve
 * their `aria-rowindex` in O(1). Rows are appended by an infinite scroller and never unmounted, so
 * once a large collection has been scrolled through, an `indexOf()` per row would make every
 * subsequent list update O(n²).
 * @type {Readable<Map<string, number>>}
 */
export const listedEntryIndexMap = derived(
  [listedEntries],
  ([_listedEntries]) => new Map(_listedEntries.map((entry, index) => [entry.id, index])),
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
 * @type {Readable<CollectionState>}
 */
export const collectionState = derived(
  [listedEntries, selectedCollection, openAuthoring],
  ([_listedEntries, _selectedCollection, _openAuthoring]) => {
    if (_selectedCollection?._type === 'entry') {
      const canCreate = _selectedCollection.create ?? true;
      const canDelete = _selectedCollection.delete ?? true;
      // Reordering writes the new order straight to the configured branch rather than going through
      // review, so it’s not something an Open Authoring contributor can do
      const canReorder = !!_selectedCollection.reorder && !_openAuthoring;
      const quota = _selectedCollection?.limit ?? Infinity;
      const remaining = quota < Infinity ? quota - _listedEntries.length : Infinity;

      return {
        isEntryCollection: true,
        canCreate,
        canDelete,
        canReorder,
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
      canReorder: false,
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

    const collection = /** @type {InternalEntryCollection} */ (get(selectedCollection));
    /** @type {Entry[]} */
    let entries = [..._listedEntries];

    // Reset the groups if the current collection is empty or a file/singleton collection
    if (!entries.length || !!getCollectionFilesByEntry(collection, entries[0]).length) {
      set([]);
      return;
    }

    if (_currentView.sort) {
      entries = sortEntries(entries, collection, _currentView.sort);
    }

    if (_currentView.filters) {
      entries = filterEntries(entries, collection, _currentView.filters);
    }

    set(groupEntries(entries, collection, _currentView.group));
  },
);

reordering.subscribe((value) => {
  if (!value) {
    reorderedEntries.set([]);
    reorderDirty.set(false);

    // Restore the snapshot taken when entering reorder mode, if any.
    if (viewBeforeReorder) {
      currentView.set(viewBeforeReorder);
      viewBeforeReorder = undefined;
    }

    return;
  }

  // When entering reorder mode, force the entry list to be sorted by the manual order so users see
  // and arrange entries in the same order they will be persisted. Also clear any active filters or
  // grouping: reordering operates on the visible entry list, and the order field is a single global
  // sequence. Filters would cause hidden entries to retain their old order values and collide with
  // the new 1..N numbering, while grouping splits the list into buckets that can’t be reordered
  // across, producing global numbers that don’t match user intent.
  //
  // A collection whose order field is only consumed within a group can opt into grouped reordering
  // with `reorder: { group: '…' }`. That group replaces whatever grouping the user has active, so
  // the buckets — and therefore the numbering, which runs group by group — are always the same.
  // Nothing is hidden either way, so what the user sees is still exactly what gets persisted.
  const view = get(currentView);
  const reorderGroup = getReorderGroupingConditions(get(selectedCollection));

  // Snapshot so we can restore on exit.
  viewBeforeReorder = view;

  /** @type {Partial<EntryListView>} */
  const overrides = {};

  if (view.sort?.key !== '_manual') {
    overrides.sort = { key: '_manual', order: 'ascending' };
  }

  if (view.filters?.length) {
    overrides.filters = [];
  }

  if (reorderGroup) {
    if (view.group?.field !== reorderGroup.field || view.group?.pattern !== reorderGroup.pattern) {
      overrides.group = reorderGroup;
    }
  } else if (view.group) {
    overrides.group = null;
  }

  if (Object.keys(overrides).length) {
    currentView.set({ ...view, ...overrides });
  }
});

backend.subscribe((_backend) => {
  if (_backend && !get(entryListSettings)) {
    initSettings(_backend);
  }
});

listedEntries.subscribe((entries) => {
  selectedEntries.set([]);

  if (prefs.devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('listedEntries', entries);
  }
});

selectedCollection.subscribe((collection) => {
  // Reset the reorder state when switching collections, to avoid accidentally reordering entries in
  // the wrong collection or leaving the UI in a broken state if the new collection doesn’t support
  // reordering. Discard any view snapshot first so it isn’t restored against the wrong collection,
  // which would otherwise corrupt the new collection’s persisted view via `entryListSettings`.
  viewBeforeReorder = undefined;
  reordering.set(false);

  if (collection && prefs.devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('selectedCollection', collection);
  }
});
