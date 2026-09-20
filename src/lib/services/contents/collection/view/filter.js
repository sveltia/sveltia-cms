import { getConditionKey, getViewConditions } from '$lib/services/common/view';
import { selectedCollection } from '$lib/services/contents/collection';
import {
  matchesConditions,
  prepareConditions,
} from '$lib/services/contents/collection/view/conditions';
import { parseViewOptions } from '$lib/services/contents/collection/view/utils';
import { getField, getPropertyValue } from '$lib/services/contents/entry/fields';
import { createDerivedState } from '$lib/services/utils/state.svelte';

/**
 * @import { Entry, FilteringConditions, InternalEntryCollection } from '$lib/types/private';
 * @import { DateTimeField, ViewFilter, ViewFilters } from '$lib/types/public';
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

  // Resolve the template tags and compile the regexes once per filter instead of for every entry
  const preparedFilters = validFilters.map((conditions) => {
    const fieldConfig = getField({ collectionName, keyPath: conditions.field });

    const dateFieldConfig =
      fieldConfig?.widget === 'datetime' ? /** @type {DateTimeField} */ (fieldConfig) : undefined;

    return {
      field: conditions.field,
      conditions: prepareConditions(conditions, { dateFieldConfig, now }),
    };
  });

  return entries.filter((entry) =>
    preparedFilters.every(({ field, conditions }) => {
      // Check both the raw value and referenced value
      const args = { entry, locale, collectionName, key: field };
      const rawValue = getPropertyValue({ ...args, resolveRef: false });
      const refValue = getPropertyValue({ ...args });

      return matchesConditions({ rawValue, refValue, conditions });
    }),
  );
};

/**
 * View filters for the selected entry collection.
 * @type {{ readonly current: ViewFilter[] }}
 */
export const viewFilters = createDerivedState(() => {
  const collection = selectedCollection.current;

  // Disable filters for file/singleton collection
  if (!collection || !('folder' in collection)) {
    return [];
  }

  return parseFilterConfig(collection.view_filters).options;
});
