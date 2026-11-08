import { getConditionKey, getViewConditions } from '$lib/services/common/view';
import { selectedCollection } from '$lib/services/contents/collection';
import {
  matchesConditions,
  prepareConditions,
} from '$lib/services/contents/collection/view/conditions';
import { parseViewOptions } from '$lib/services/contents/collection/view/options';
import { getListedEntryValue } from '$lib/services/contents/collection/view/values';
import { getField } from '$lib/services/contents/entry/fields';
import { createDerivedState } from '$lib/services/utils/state.svelte';

/**
 * @import {
 * Entry,
 * FilteringConditions,
 * GroupingConditions,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { DateTimeField, ViewFilter, ViewFilters, ViewGroup } from '$lib/types/public';
 */

/**
 * Parse view filters configuration. This supports both an array, which is compatible with
 * Netlify/Decap CMS, and an object, which is compatible with Static CMS.
 * @param {ViewFilter[] | ViewFilters | undefined} filters View filters configuration.
 * @returns {{ options: ViewFilter[], default?: FilteringConditions }} Parsed view filters.
 * @see https://decapcms.org/docs/configuration-options/#view_filters
 * @see https://staticjscms.netlify.app/docs/collection-overview#view-filters
 * @see https://sveltiacms.app/en/docs/collections/entries/views#filtering
 */
export const parseFilterConfig = (filters) =>
  /** @type {{ options: ViewFilter[], default?: FilteringConditions }} */
  (parseViewOptions(filters, 'filters'));

/**
 * Create a function that checks if an entry satisfies the given filtering or grouping conditions.
 * The template tags are resolved and the regexes compiled once, rather than for every entry. Both
 * the raw value of the field and the value it references are checked.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {InternalLocaleCode} args.locale Locale to get the values in.
 * @param {FilteringConditions | GroupingConditions} args.conditions Conditions.
 * @param {Date} args.now Current date and time, which the template tags in the conditions resolve
 * to.
 * @returns {(entry: Entry) => boolean} Function returning whether an entry matches.
 */
export const createEntryMatcher = ({ collectionName, locale, conditions, now }) => {
  const { field: key } = conditions;
  const fieldConfig = getField({ collectionName, keyPath: key });

  const dateFieldConfig =
    fieldConfig?.widget === 'datetime' ? /** @type {DateTimeField} */ (fieldConfig) : undefined;

  const prepared = prepareConditions(conditions, { dateFieldConfig, now, locale });

  return (entry) => {
    const args = { entry, locale, collectionName, key };

    return matchesConditions({
      rawValue: getListedEntryValue({ ...args, resolveRef: false }),
      refValue: getListedEntryValue(args),
      conditions: prepared,
    });
  };
};

/**
 * Create the view filters or groups for the selected entry collection.
 * @template {ViewFilter | ViewGroup} T
 * @param {'filters' | 'groups'} type Option type.
 * @returns {{ readonly current: T[] }} Options. Empty for a file/singleton collection.
 */
export const createViewOptionsState = (type) =>
  createDerivedState(() => {
    const collection = selectedCollection.current;

    return collection?._type === 'entry'
      ? /** @type {T[]} */ (parseViewOptions(collection[`view_${type}`], type).options)
      : [];
  });

/**
 * Filter the given entries.
 * @param {Entry[]} entries Entry list.
 * @param {InternalEntryCollection} collection Collection that the entries belong to.
 * @param {FilteringConditions[]} filters One or more filtering conditions.
 * @param {Date} [now] Current date and time, which the template tags in the conditions resolve to.
 * @returns {Entry[]} Filtered entry list.
 * @see https://decapcms.org/docs/configuration-options/#view_filters
 * @see https://sveltiacms.app/en/docs/collections/entries/views#filtering
 */
export const filterEntries = (entries, collection, filters, now = new Date()) => {
  const {
    name: collectionName,
    view_filters: configuredFilters = [],
    _i18n: { defaultLocale: locale },
  } = collection;

  const { options } = parseFilterConfig(configuredFilters);
  const optionKeys = options.map((option) => getConditionKey(getViewConditions(option)));

  // Ignore invalid filters, such as one saved in the view settings and removed from the
  // configuration since
  const validFilters = filters.filter(
    (conditions) =>
      conditions.field !== undefined && optionKeys.includes(getConditionKey(conditions)),
  );

  const matchers = validFilters.map((conditions) =>
    createEntryMatcher({ collectionName, locale, conditions, now }),
  );

  return entries.filter((entry) => matchers.every((matches) => matches(entry)));
};

/**
 * View filters for the selected entry collection.
 * @type {{ readonly current: ViewFilter[] }}
 */
export const viewFilters = createViewOptionsState('filters');
