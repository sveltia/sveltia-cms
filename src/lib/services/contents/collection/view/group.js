import { _ } from '@sveltia/i18n';

import { buildGroupMap } from '$lib/services/common/view';
import { selectedCollection } from '$lib/services/contents/collection';
import { getReorderGroupName } from '$lib/services/contents/collection/entries/reorder';
import { currentView } from '$lib/services/contents/collection/view';
import { parseViewOptions } from '$lib/services/contents/collection/view/utils';
import { getPropertyValue } from '$lib/services/contents/entry/fields';
import { createDerivedState } from '$lib/services/utils/state.svelte';

/**
 * @import { Entry, GroupingConditions, InternalCollection } from '$lib/types/private';
 * @import { ViewGroup, ViewGroups } from '$lib/types/public';
 */

/**
 * Parse view groups configuration. This supports both an array, which is compatible with
 * Netlify/Decap CMS, and an object, which is compatible with Static CMS.
 * @param {ViewGroup[] | ViewGroups | undefined} filters View groups configuration.
 * @returns {{ options: ViewGroup[], default?: GroupingConditions }} Parsed view groups.
 * @see https://decapcms.org/docs/configuration-options/#view_groups
 * @see https://staticjscms.netlify.app/docs/collection-overview#view-groups
 * @see https://sveltiacms.app/en/docs/collections/entries#grouping
 */
export const parseGroupConfig = (filters) =>
  /** @type {{ options: ViewGroup[], default?: GroupingConditions }} */
  (parseViewOptions(filters, 'groups'));

/**
 * Get the grouping conditions to be applied while the given collection is in reorder mode, by
 * resolving the group named with the collection’s `reorder.group` option against its `view_groups`
 * definitions. Entries are then reordered within their own group, which is useful when the order
 * field is only consumed per group.
 * @param {InternalCollection | undefined} collection Collection.
 * @returns {GroupingConditions | undefined} Conditions, or `undefined` if reorder grouping is not
 * configured or the named group is not defined in `view_groups`.
 * @see https://sveltiacms.app/en/docs/collections/entries#grouping
 */
export const getReorderGroupingConditions = (collection) => {
  // Grouping is only available for entry collections
  if (!collection || !('folder' in collection)) {
    return undefined;
  }

  const name = getReorderGroupName(collection);

  if (!name) {
    return undefined;
  }

  const group = parseGroupConfig(collection.view_groups).options.find((g) => g.name === name);

  return group ? { field: group.field, pattern: group.pattern } : undefined;
};

/**
 * Group the given entries.
 * @param {Entry[]} entries Entry list.
 * @param {InternalCollection} collection Collection that the entries belong to.
 * @param {GroupingConditions | null | undefined} conditions Grouping conditions.
 * @returns {{ name: string, entries: Entry[] }[]} Grouped entries, where each group object contains
 * a name and an entry list. When ungrouped, there will still be one group object named `*`.
 * @see https://decapcms.org/docs/configuration-options/#view_groups
 * @see https://sveltiacms.app/en/docs/collections/entries#grouping
 */
export const groupEntries = (entries, collection, conditions) => {
  const { field, pattern } = conditions ?? { field: '', pattern: undefined };

  if (!field) {
    return entries.length ? [{ name: '*', entries }] : [];
  }

  const {
    name: collectionName,
    _i18n: { defaultLocale: locale },
  } = collection;

  const sortCondition = currentView.current.sort;
  const otherKey = _('other');

  const sortedGroups = buildGroupMap(
    entries,
    pattern,
    (entry) => getPropertyValue({ entry, locale, collectionName, key: field }),
    otherKey,
  ).map(([name, _entries]) => ({ name, entries: _entries }));

  // Keep the descending order if already sorted, especially on the date field
  if (sortCondition?.key === field && sortCondition.order === 'descending') {
    sortedGroups.reverse();
  }

  return sortedGroups;
};

/**
 * View groups for the selected entry collection.
 * @type {{ readonly current: ViewGroup[] }}
 */
export const viewGroups = createDerivedState(() => {
  const collection = selectedCollection.current;

  // Disable grouping for file/singleton collection
  if (!collection || !('folder' in collection)) {
    return [];
  }

  return parseGroupConfig(collection.view_groups).options;
});
