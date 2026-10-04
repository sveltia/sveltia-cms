import equal from 'fast-deep-equal';
import { untrack } from 'svelte';

import { backend } from '$lib/services/backends';
import { lockedBranch } from '$lib/services/backends/branch-access';
import { getConditionKey, getGroupingKey, getViewConditions } from '$lib/services/common/view';
import { isReadonly } from '$lib/services/config/readonly';
import { allEntries } from '$lib/services/contents';
import { selectedCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection, selectedEntries } from '$lib/services/contents/collection/entries';
import { countQuotaEntries } from '$lib/services/contents/collection/entries/count';
import { isManuallyOrdered } from '$lib/services/contents/collection/entries/reorder/config';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { filterNestedEntries, nestedFilterPath } from '$lib/services/contents/collection/nested';
import { usesCurrentTime } from '$lib/services/contents/collection/view/conditions';
import { filterEntries, parseFilterConfig } from '$lib/services/contents/collection/view/filter';
import {
  getReorderGroupingConditions,
  groupEntries,
  parseGroupConfig,
} from '$lib/services/contents/collection/view/group';
import {
  currentView,
  entryListSettings,
  initSettings,
  viewBeforeReorder,
} from '$lib/services/contents/collection/view/settings';
import { sortEntries } from '$lib/services/contents/collection/view/sort';
import { getSortConfig } from '$lib/services/contents/collection/view/sort-keys';
import { prefs } from '$lib/services/user/prefs.svelte';
import {
  createDerivedState,
  createRawState,
  createRootEffect,
  createStableDerivedState,
} from '$lib/services/utils/state.svelte';
import { swapUnpublishedEntries, unpublishedEntries } from '$lib/services/workflow';
import { openAuthoring } from '$lib/services/workflow/open-authoring';

/**
 * @import {
 * Entry,
 * EntryListView,
 * GroupingConditions,
 * InternalEntryCollection,
 * } from '$lib/types/private';
 */

/**
 * @typedef {object} CollectionState
 * @property {boolean} isEntryCollection Whether the selected collection is an entry collection.
 * @property {boolean} readonly Whether the selected collection is read-only, because of its own or
 * the global `readonly` option. Nothing can be created, deleted or reordered in it then.
 * @property {boolean} canCreate Whether new entries can be created in the selected collection. It’s
 * `false` with the `create: false` option, and also with `limit: 0`, which forbids creating entries
 * the same way rather than being a quota to reach.
 * @property {boolean} canDelete Whether entries can be deleted from the selected collection.
 * @property {boolean} canReorder Whether entries in the selected collection can be reordered.
 * @property {number} quota The maximum number of entries allowed in the selected collection.
 * @property {number} remaining The number of additional entries that can be added to the selected
 * collection before reaching the quota.
 * @property {boolean} nearingQuota Whether the number of remaining entries is at or below the
 * warning threshold.
 * @property {boolean} creationDisabled Whether creating new entries is currently disabled, due to
 * permissions, because the collection is read-only or because the quota has been reached.
 */

/**
 * Whether the entry collection is in reorder mode, which allows users to reorder entries with a
 * drag-and-drop UI. This is used to control the UI state and behavior when reordering entries in a
 * collection. Use {@link setReorderMode} to change it, so the view is adjusted at the same time.
 */
export const reordering = createRawState(false);

/**
 * Pending reorder result while the entry collection is in reorder mode. The list contains the
 * collection’s entries in the order the user has arranged them in the UI. It is consumed when the
 * user confirms the reorder, then reset.
 * @type {{ current: Entry[] }}
 */
export const reorderedEntries = createRawState([]);

/**
 * Whether the user has actually moved an entry while in reorder mode. The toolbar Save button uses
 * this to stay disabled until at least one move has happened, so a simple Enter → Save round-trip
 * doesn’t cause a no-op commit.
 */
export const reorderDirty = createRawState(false);

/**
 * How often {@link viewTime} is updated while a time-based view filter or group is applied. A
 * minute keeps the list close to the clock without recomputing it for nothing.
 */
const VIEW_TIME_INTERVAL = 60000;

/**
 * Current date and time that the template tags in the view filters and groups resolve to, such as
 * `{{today}}` in an “Upcoming events” filter. It’s updated every minute while the current view has
 * such a condition, so that the list is recomputed as time goes by, e.g. when an event starts or
 * the day changes, and not only when the view or the entries change. See {@link viewUsesTime}.
 * @type {{ current: Date }}
 */
export const viewTime = createRawState(new Date());

/**
 * Whether the current view has a filter or group depending on the current time.
 * @type {{ readonly current: boolean }}
 */
export const viewUsesTime = createDerivedState(() => {
  const { filters = [], group } = currentView.current;

  return filters.some(usesCurrentTime) || usesCurrentTime(group);
});

/**
 * Sorting conditions of the current view. This and the other view conditions below are picked out
 * of {@link currentView} one by one, so replacing the view to switch between list and grid, or to
 * collapse a group, doesn’t sort, filter and group the entries all over again: each step only
 * reruns when the conditions it uses have actually changed.
 */
const sortConditions = createStableDerivedState(() => currentView.current.sort);
/**
 * Filtering conditions of the current view. See {@link sortConditions}.
 */
const filterConditions = createStableDerivedState(() => currentView.current.filters);
/**
 * Grouping conditions of the current view. See {@link sortConditions}.
 */
const groupConditions = createStableDerivedState(() => currentView.current.group);

/**
 * List of the entries shown in the entry list for the selected entry collection. For a nested
 * collection, only the entries in the folder the user is currently browsing are included; the
 * deeper ones are reachable through the collection tree in the primary sidebar.
 * @type {{ readonly current: Entry[] }}
 */
export const listedEntries = createDerivedState(() => {
  const { current: _allEntries } = allEntries;
  const { current: _collection } = selectedCollection;
  const { current: _nestedFilterPath } = nestedFilterPath;

  if (!_allEntries || !_collection) {
    return [];
  }

  /**
   * Limit the entries to the folder currently browsed in a nested collection.
   * @param {Entry[]} entries Entries to be filtered.
   * @returns {Entry[]} Filtered entries.
   */
  const filterNested = (entries) =>
    filterNestedEntries({ collection: _collection, entries, dirPath: _nestedFilterPath });

  const entries = getEntriesByCollection(_collection.name);

  // Don’t swap while reordering, because the reorder UI persists an order field on the published
  // entries, and the draft version must not leak into that commit
  if (reordering.current) {
    return filterNested(entries);
  }

  // Show the pending changes rather than what’s live, so the list sorts, filters and groups by
  // them
  return filterNested(
    swapUnpublishedEntries(
      entries,
      unpublishedEntries.current.filter(
        ({ workflow }) => workflow.collectionName === _collection.name,
      ),
    ),
  );
});

/**
 * List of unpublished entries for the selected entry collection that have never been published,
 * sorted and filtered with the same view settings as {@link entryGroups}. Unlike an update to an
 * existing entry, which replaces the published version in {@link listedEntries}, these are listed
 * in a separate group above the published entries.
 * @type {{ readonly current: Entry[] }}
 */
export const listedUnpublishedEntries = createDerivedState(() => {
  const { current: _collection } = selectedCollection;

  if (_collection?._type !== 'entry' || reordering.current) {
    return [];
  }

  // A draft that replaced a published entry is already in `listedEntries`, so match by identity
  // rather than by path, which a rename would break
  const swappedIn = new Set(listedEntries.current);

  /** @type {Entry[]} */
  let entries = filterNestedEntries({
    collection: _collection,
    entries: unpublishedEntries.current.filter(
      (entry) => entry.workflow.collectionName === _collection.name && !swappedIn.has(entry),
    ),
    dirPath: nestedFilterPath.current,
  });

  if (!entries.length) {
    return [];
  }

  const { current: sort } = sortConditions;
  const { current: filters } = filterConditions;

  if (sort) {
    entries = sortEntries(entries, _collection, sort);
  }

  if (filters) {
    entries = filterEntries(entries, _collection, filters, viewTime.current);
  }

  return entries;
});

/**
 * Map from entry ID to the entry’s index in {@link listedEntries}, used by list rows to resolve
 * their `aria-rowindex` in O(1). Rows are appended by an infinite scroller and never unmounted, so
 * once a large collection has been scrolled through, an `indexOf()` per row would make every
 * subsequent list update O(n²).
 */
export const listedEntryIndexMap = createDerivedState(
  () => new Map(listedEntries.current.map((entry, index) => [entry.id, index])),
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
 * @type {{ readonly current: CollectionState }}
 */
export const collectionState = createDerivedState(() => {
  const { current: _selectedCollection } = selectedCollection;
  const readonly = !!_selectedCollection && isReadonly({ collection: _selectedCollection });

  if (_selectedCollection?._type === 'entry') {
    // `limit: 0` means no entries can ever be created, so it’s treated like `create: false`
    const canCreate = (_selectedCollection.create ?? true) && _selectedCollection.limit !== 0;
    const canDelete = !readonly && (_selectedCollection.delete ?? true);

    // Reordering writes the new order straight to the configured branch rather than going through
    // review, even in a collection using Editorial Workflow, so it’s not something an Open
    // Authoring contributor or a user who can’t push to the branch can do. An entry collection
    // storing all the entries in one file can always be reordered
    const canReorder =
      !readonly &&
      isManuallyOrdered(_selectedCollection) &&
      !openAuthoring.current &&
      !lockedBranch.current;

    const quota = _selectedCollection?.limit ?? Infinity;
    // The quota applies to the whole collection, including the entries that only exist in a pull
    // request, so it agrees with the count shown next to the collection in the sidebar
    const entryCount = countQuotaEntries(_selectedCollection.name);
    const remaining = quota < Infinity ? quota - entryCount : Infinity;

    return {
      isEntryCollection: true,
      readonly,
      canCreate,
      canDelete,
      canReorder,
      quota,
      remaining,
      nearingQuota: remaining > 0 && remaining <= QUOTA_WARNING_THRESHOLD,
      creationDisabled: !canCreate || readonly || remaining <= 0,
    };
  }

  return {
    isEntryCollection: false,
    readonly,
    canCreate: false,
    canDelete: false,
    canReorder: false,
    quota: Infinity,
    remaining: Infinity,
    nearingQuota: false,
    creationDisabled: false,
  };
});

/**
 * {@link listedEntries} sorted with the current view’s conditions. Sorting is the costliest step,
 * as it reads a value from every entry, so it comes first: changing a filter, or {@link viewTime}
 * ticking, then only reruns the cheaper steps below. `sortEntries()` reads the current app locale,
 * so this is also recomputed when the locale changes.
 * @type {{ readonly current: Entry[] }}
 */
const sortedEntries = createDerivedState(() => {
  const collection = /** @type {InternalEntryCollection} */ (selectedCollection.current);
  const { current: entries } = listedEntries;
  const { current: sort } = sortConditions;

  return sort ? sortEntries(entries, collection, sort) : entries;
});

/**
 * {@link sortedEntries} filtered with the current view’s conditions.
 * @type {{ readonly current: Entry[] }}
 */
const filteredEntries = createDerivedState(() => {
  const collection = /** @type {InternalEntryCollection} */ (selectedCollection.current);
  const { current: entries } = sortedEntries;
  const { current: filters } = filterConditions;

  return filters ? filterEntries(entries, collection, filters, viewTime.current) : entries;
});

/**
 * Sorted, filtered and grouped entries for the selected entry collection. `groupEntries()` may
 * return localized labels, as it reads the current app locale, so the groups are also recomputed
 * when the locale changes. They are also recomputed as {@link viewTime} ticks while a time-based
 * filter or group is applied.
 * @type {{ readonly current: { name: string, entries: Entry[] }[] }}
 */
export const entryGroups = createDerivedState(() => {
  const collection = /** @type {InternalEntryCollection} */ (selectedCollection.current);
  const { current: entries } = listedEntries;

  // Reset the groups if the current collection is empty or a file/singleton collection. This is
  // checked before the entries are sorted and filtered, so neither is done for nothing
  if (!entries.length || !!getCollectionFilesByEntry(collection, entries[0]).length) {
    return [];
  }

  const { current: group } = groupConditions;

  return groupEntries(filteredEntries.current, collection, group, viewTime.current);
});

/**
 * Restore the view settings of the given entry collection from {@link entryListSettings}, falling
 * back to the collection’s default sort, filter and grouping options where the saved view has none.
 * @param {InternalEntryCollection} collection Collection.
 * @param {Entry[]} _allEntries All the entries.
 */
const restoreView = (collection, _allEntries) => {
  const { view_filters: viewFilters, view_groups: viewGroups } = collection;
  /** @type {EntryListView} */
  const view = { ...(entryListSettings.current?.[collection.name] ?? { type: 'list' }) };

  const { default: defaultSort } = getSortConfig({
    collection,
    isCommitAuthorAvailable: _allEntries.some((entry) => !!entry.commitAuthor),
    isCommitDateAvailable: _allEntries.some((entry) => !!entry.commitDate),
  });

  // The commit metadata may arrive after the entries, so a saved sort key depending on it is
  // validated as if it were there, rather than dropped while it’s on its way
  const { keys: sortKeys } = getSortConfig({
    collection,
    isCommitAuthorAvailable: true,
    isCommitDateAvailable: true,
  });

  const { default: defaultFilter } = parseFilterConfig(viewFilters);
  const { options: groupOptions, default: defaultGroup } = parseGroupConfig(viewGroups);

  // Drop a saved sort key or group that has been removed from the configuration since the view was
  // saved, so the defaults apply instead. A stale group would otherwise stay applied while the menu
  // no longer offers a way to undo it. Stale filters are ignored by `filterEntries()` instead
  if (view.sort?.key !== undefined && !sortKeys.includes(view.sort.key)) {
    delete view.sort;
  }

  if (
    view.group &&
    !groupOptions.some(
      (option) =>
        getConditionKey(getViewConditions(option)) ===
        getConditionKey(/** @type {GroupingConditions} */ (view.group)),
    )
  ) {
    delete view.group;
  }

  if (view.sort === undefined && defaultSort) {
    view.sort = defaultSort;
  }

  if (view.filters === undefined && defaultFilter) {
    view.filters = [defaultFilter];
  }

  if (view.group === undefined && defaultGroup) {
    view.group = defaultGroup;
  }

  if (!equal(view, currentView.current)) {
    currentView.current = view;
  }
};

/**
 * Enter or exit reorder mode, updating the view accordingly. The view is updated synchronously,
 * before `reordering` is flipped, so that the components reacting to `reordering` — such as the
 * entry reorder list, which snapshots `entryGroups` on mount — always see the adjusted view rather
 * than depending on the order in which effects happen to run.
 * @param {boolean} value Whether to enter reorder mode.
 */
export const setReorderMode = (value) => {
  if (!value) {
    reorderedEntries.current = [];
    reorderDirty.current = false;

    // Restore the snapshot taken when entering reorder mode, if any.
    if (viewBeforeReorder.current) {
      currentView.current = viewBeforeReorder.current.view;
      viewBeforeReorder.current = undefined;
    }

    reordering.current = false;

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
  const view = currentView.current;
  const reorderGroup = getReorderGroupingConditions(selectedCollection.current);

  // Snapshot so we can restore on exit. The view settings save it in place of the reorder view, so
  // the user’s own view is kept even if reordering is never finished
  viewBeforeReorder.current = { collectionName: selectedCollection.current?.name, view };

  /** @type {Partial<EntryListView>} */
  const overrides = {};

  if (view.sort?.key !== '_manual') {
    overrides.sort = { key: '_manual', order: 'ascending' };
  }

  if (view.filters?.length) {
    overrides.filters = [];
  }

  if (reorderGroup) {
    if (getGroupingKey(view.group) !== getGroupingKey(reorderGroup)) {
      overrides.group = reorderGroup;
    }
  } else if (view.group) {
    overrides.group = null;
  }

  if (Object.keys(overrides).length) {
    currentView.current = { ...view, ...overrides };
  }

  reordering.current = true;
};

// Restore the view settings when a different entry collection is selected. The entries are also
// tracked, because the available sort keys depend on them
createRootEffect(() => {
  const collection = selectedCollection.current;
  const { current: _allEntries } = allEntries;

  if (collection?._type === 'entry') {
    untrack(() => {
      restoreView(collection, _allEntries);
    });
  }
});

// Keep the time-based view filters and groups up to date. The time is reset as soon as such a
// condition is applied, as the last tick may date from long ago
createRootEffect(() => {
  if (!viewUsesTime.current) {
    return undefined;
  }

  viewTime.current = new Date();

  const timer = setInterval(() => {
    viewTime.current = new Date();
  }, VIEW_TIME_INTERVAL);

  return () => {
    clearInterval(timer);
  };
});

createRootEffect(() => {
  const { current: _backend } = backend;

  if (_backend && !untrack(() => entryListSettings.current)) {
    initSettings(_backend);
  }
});

createRootEffect(() => {
  const entries = listedEntries.current;

  selectedEntries.current = [];

  if (untrack(() => prefs.devModeEnabled)) {
    // eslint-disable-next-line no-console
    console.info('listedEntries', entries);
  }
});

createRootEffect(() => {
  const collection = selectedCollection.current;

  // Reset the reorder state when switching collections, to avoid accidentally reordering entries in
  // the wrong collection or leaving the UI in a broken state if the new collection doesn’t support
  // reordering. Discard any view snapshot first so it isn’t restored against the wrong collection,
  // which would otherwise corrupt the new collection’s persisted view via `entryListSettings`.
  untrack(() => {
    viewBeforeReorder.current = undefined;

    if (reordering.current) {
      setReorderMode(false);
    }
  });

  if (collection && untrack(() => prefs.devModeEnabled)) {
    // eslint-disable-next-line no-console
    console.info('selectedCollection', collection);
  }
});
