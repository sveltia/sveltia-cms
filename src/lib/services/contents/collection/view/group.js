import {
  buildGroupMap,
  getConditionKey,
  getViewConditions,
  hasComparison,
  OTHER_GROUP_NAME,
} from '$lib/services/common/view';
import { selectedCollection } from '$lib/services/contents/collection';
import { getReorderGroupName } from '$lib/services/contents/collection/entries/reorder/config';
import {
  matchesConditions,
  prepareConditions,
} from '$lib/services/contents/collection/view/conditions';
import { currentView } from '$lib/services/contents/collection/view/settings';
import { parseViewOptions } from '$lib/services/contents/collection/view/utils';
import { getField, getPropertyValue } from '$lib/services/contents/entry/fields';
import { createDerivedState } from '$lib/services/utils/state.svelte';

/**
 * @import {
 * Entry,
 * GroupingConditions,
 * InternalCollection,
 * InternalEntryCollection,
 * } from '$lib/types/private';
 * @import { DateTimeField, ViewGroup, ViewGroups } from '$lib/types/public';
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

  return group ? getViewConditions(group) : undefined;
};

/**
 * Split the given entries into the ones satisfying a group’s comparison conditions and the rest.
 * @param {Entry[]} entries Entry list.
 * @param {InternalEntryCollection} collection Collection that the entries belong to. Grouping is
 * only available for entry collections, which are the ones with `view_groups`.
 * @param {GroupingConditions} conditions Grouping conditions with a comparison operator.
 * @param {Date} now Current date and time, which the template tags in the conditions resolve to.
 * @returns {{ name: string, entries: Entry[] }[]} The group of matching entries, named after the
 * label of the view group the conditions came from, so that a group labelled “Upcoming” lists the
 * upcoming events under that heading, followed by the {@link OTHER_GROUP_NAME} group. An empty
 * group is left out.
 */
const groupEntriesByComparison = (entries, collection, conditions, now) => {
  const {
    name: collectionName,
    view_groups: viewGroups,
    _i18n: { defaultLocale: locale },
  } = collection;

  const { field } = conditions;
  const key = getConditionKey(conditions);
  const fieldConfig = getField({ collectionName, keyPath: field });

  const dateFieldConfig =
    fieldConfig?.widget === 'datetime' ? /** @type {DateTimeField} */ (fieldConfig) : undefined;

  const prepared = prepareConditions(conditions, { dateFieldConfig, now });

  // The conditions are what the view holds, so the label has to be looked up. It can be missing
  // from a group that has been removed from the configuration since the view was saved
  const label =
    parseGroupConfig(viewGroups).options.find(
      (option) => getConditionKey(getViewConditions(option)) === key,
    )?.label || field;

  /** @type {Entry[]} */
  const matched = [];
  /** @type {Entry[]} */
  const others = [];

  entries.forEach((entry) => {
    const args = { entry, locale, collectionName, key: field };
    const rawValue = getPropertyValue({ ...args, resolveRef: false });
    const refValue = getPropertyValue({ ...args });

    (matchesConditions({ rawValue, refValue, conditions: prepared }) ? matched : others).push(
      entry,
    );
  });

  return [
    { name: label, entries: matched },
    { name: OTHER_GROUP_NAME, entries: others },
  ].filter((group) => group.entries.length);
};

/**
 * Group the given entries.
 * @param {Entry[]} entries Entry list.
 * @param {InternalCollection} collection Collection that the entries belong to.
 * @param {GroupingConditions | null | undefined} conditions Grouping conditions.
 * @param {Date} [now] Current date and time, which the template tags in the conditions resolve to.
 * @returns {{ name: string, entries: Entry[] }[]} Grouped entries, where each group object contains
 * a name, displayed with `getGroupLabel()`, and an entry list. When ungrouped, there will still be
 * one group object named `*`.
 * @see https://decapcms.org/docs/configuration-options/#view_groups
 * @see https://sveltiacms.app/en/docs/collections/entries#grouping
 */
export const groupEntries = (entries, collection, conditions, now = new Date()) => {
  const { field, pattern } = conditions ?? { field: '', pattern: undefined };

  if (!field) {
    return entries.length ? [{ name: '*', entries }] : [];
  }

  if (hasComparison(conditions)) {
    return groupEntriesByComparison(
      entries,
      /** @type {InternalEntryCollection} */ (collection),
      /** @type {GroupingConditions} */ (conditions),
      now,
    );
  }

  const {
    name: collectionName,
    _i18n: { defaultLocale: locale },
  } = collection;

  const sortCondition = currentView.current.sort;

  const sortedGroups = buildGroupMap(entries, pattern, (entry) =>
    getPropertyValue({ entry, locale, collectionName, key: field }),
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
