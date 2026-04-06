import { _ } from '@sveltia/i18n';
import { derived, get } from 'svelte/store';

import { buildGroupMap } from '$lib/services/common/view';
import { selectedCollection } from '$lib/services/contents/collection';
import { currentView } from '$lib/services/contents/collection/view';
import { parseViewOptions } from '$lib/services/contents/collection/view/utils';
import { getPropertyValue } from '$lib/services/contents/entry/fields';

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

  const sortCondition = get(currentView).sort;
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
 * Initialize view groups for the given collection.
 * @internal
 * @param {InternalCollection | undefined} collection Collection to initialize groups for.
 * @param {(value: ViewGroup[]) => void} set Function to set the groups.
 */
export const initializeViewGroups = (collection, set) => {
  // Disable grouping for file/singleton collection
  if (!collection || !('folder' in collection)) {
    set([]);

    return;
  }

  const { options, default: defaultGroup } = parseGroupConfig(collection.view_groups);

  set(options);

  currentView.update((_view) => ({
    ..._view,
    group: _view.group === undefined ? defaultGroup : _view.group,
  }));
};

/**
 * View groups for the selected entry collection.
 * @type {import('svelte/store').Readable<ViewGroup[]>}
 */
export const viewGroups = derived([selectedCollection], ([collection], set) => {
  initializeViewGroups(collection, set);
});
