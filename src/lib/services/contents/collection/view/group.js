import { isObject } from '@sveltia/utils/object';
import { compare } from '@sveltia/utils/string';
import { derived, get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { selectedCollection } from '$lib/services/contents/collection';
import { currentView } from '$lib/services/contents/collection/view';
import { getPropertyValue } from '$lib/services/contents/entry/fields';
import { getRegex } from '$lib/services/utils/misc';

/**
 * @import { Entry, GroupingConditions, InternalCollection } from '$lib/types/private';
 * @import { ViewGroup, ViewGroups } from '$lib/types/public';
 */

/**
 * Parse view filters configuration. This supports both an array, which is compatible with
 * Netlify/Decap CMS, and an object, which is compatible with Static CMS.
 * @param {ViewGroup[] | ViewGroups | undefined} filters View filters configuration.
 * @returns {{ options: ViewGroup[], default?: GroupingConditions }} Parsed view filters.
 * @see https://decapcms.org/docs/configuration-options/#view_groups
 * @see https://staticjscms.netlify.app/docs/collection-overview#view-groups
 */
export const parseGroupConfig = (filters) => {
  if (Array.isArray(filters)) {
    return { options: filters };
  }

  if (isObject(filters)) {
    const { groups: options, default: defaultGroupName } = /** @type {ViewGroups} */ (filters);

    if (Array.isArray(options)) {
      const defaultGroup = defaultGroupName
        ? options.find(({ name }) => name === defaultGroupName)
        : undefined;

      return {
        options,
        default: defaultGroup
          ? { field: defaultGroup.field, pattern: defaultGroup.pattern }
          : undefined,
      };
    }
  }

  return { options: [] };
};

/**
 * Group the given entries.
 * @param {Entry[]} entries Entry list.
 * @param {InternalCollection} collection Collection that the entries belong to.
 * @param {GroupingConditions} [conditions] Grouping conditions.
 * @returns {{ name: string, entries: Entry[] }[]} Grouped entries, where each group object contains
 * a name and an entry list. When ungrouped, there will still be one group object named `*`.
 * @see https://decapcms.org/docs/configuration-options/#view_groups
 */
export const groupEntries = (
  entries,
  collection,
  { field, pattern } = { field: '', pattern: undefined },
) => {
  if (!field) {
    return entries.length ? [{ name: '*', entries }] : [];
  }

  const {
    name: collectionName,
    _i18n: { defaultLocale: locale },
  } = collection;

  const sortCondition = get(currentView).sort;
  const regex = getRegex(pattern);
  /** @type {Record<string, Entry[]>} */
  const groups = {};
  const otherKey = get(_)('other');

  entries.forEach((entry) => {
    const value = getPropertyValue({ entry, locale, collectionName, key: field });

    const key =
      value === undefined
        ? otherKey
        : regex
          ? (String(value).match(regex)?.[0] ?? otherKey)
          : String(value);

    if (!(key in groups)) {
      groups[key] = [];
    }

    groups[key].push(entry);
  });

  // Sort groups by key
  const sortedGroups = Object.entries(groups)
    .map(([name, _entries]) => ({ name, entries: _entries }))
    .sort(({ name: aKey }, { name: bKey }) => compare(aKey, bKey));

  // Keep the descending order if already sorted, especially on the date field
  if (sortCondition?.key === field && sortCondition.order === 'descending') {
    sortedGroups.reverse();
  }

  return sortedGroups;
};

/**
 * View groups for the selected entry collection.
 * @type {import('svelte/store').Readable<ViewGroup[]>}
 */
export const viewGroups = derived([selectedCollection], ([_collection], set) => {
  // Disable sorting for file/singleton collection
  if (!_collection?.folder) {
    set([]);

    return;
  }

  const { options, default: defaultGroup } = parseGroupConfig(_collection.view_groups);

  set(options);

  currentView.update((_view) => ({
    ..._view,
    group: _view.group ?? defaultGroup,
  }));
});
