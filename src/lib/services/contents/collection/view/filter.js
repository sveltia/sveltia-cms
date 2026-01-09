import { isObject } from '@sveltia/utils/object';
import { derived } from 'svelte/store';

import { selectedCollection } from '$lib/services/contents/collection';
import { currentView } from '$lib/services/contents/collection/view';
import { getPropertyValue } from '$lib/services/contents/entry/fields';
import { getRegex } from '$lib/services/utils/misc';

/**
 * @import { Entry, FilteringConditions, InternalEntryCollection } from '$lib/types/private';
 * @import { ViewFilter, ViewFilters } from '$lib/types/public';
 */

/**
 * Parse view filters configuration. This supports both an array, which is compatible with
 * Netlify/Decap CMS, and an object, which is compatible with Static CMS.
 * @param {ViewFilter[] | ViewFilters | undefined} filters View filters configuration.
 * @returns {{ options: ViewFilter[], default?: FilteringConditions }} Parsed view filters.
 * @see https://decapcms.org/docs/configuration-options/#view_filters
 * @see https://staticjscms.netlify.app/docs/collection-overview#view-filters
 * @see https://sveltiacms.app/en/docs/collections/entries#filtering
 */
export const parseFilterConfig = (filters) => {
  if (Array.isArray(filters)) {
    return { options: filters };
  }

  if (isObject(filters)) {
    const { filters: options, default: defaultFilterName } = filters;

    if (Array.isArray(options)) {
      const defaultFilter = defaultFilterName
        ? options.find(({ name }) => name === defaultFilterName)
        : undefined;

      return {
        options,
        default: defaultFilter
          ? { field: defaultFilter.field, pattern: defaultFilter.pattern }
          : undefined,
      };
    }
  }

  return { options: [] };
};

/**
 * Filter the given entries.
 * @param {Entry[]} entries Entry list.
 * @param {InternalEntryCollection} collection Collection that the entries belong to.
 * @param {FilteringConditions[]} filters One or more filtering conditions.
 * @returns {Entry[]} Filtered entry list.
 * @see https://decapcms.org/docs/configuration-options/#view_filters
 * @see https://sveltiacms.app/en/docs/collections/entries#filtering
 */
export const filterEntries = (entries, collection, filters) => {
  const {
    name: collectionName,
    view_filters: configuredFilters = [],
    _i18n: { defaultLocale: locale },
  } = collection;

  const { options } = parseFilterConfig(configuredFilters);

  // Ignore invalid filters
  const validFilters = filters.filter(
    ({ field, pattern }) =>
      field !== undefined &&
      pattern !== undefined &&
      options.some((f) => f.field === field && String(f.pattern) === String(pattern)),
  );

  return entries.filter((entry) =>
    validFilters.every(({ field, pattern }) => {
      // Check both the raw value and referenced value
      const args = { entry, locale, collectionName, key: field };
      const rawValue = getPropertyValue({ ...args, resolveRef: false });
      const refValue = getPropertyValue({ ...args });
      const regex = getRegex(pattern);

      if (rawValue === undefined || refValue === undefined) {
        return false;
      }

      if (regex) {
        return regex.test(String(rawValue)) || regex.test(String(refValue));
      }

      return rawValue === pattern || refValue === pattern;
    }),
  );
};

/**
 * Initialize view filters for a collection.
 * @internal
 * @param {any} collection Collection (entry or file).
 * @param {(options: ViewFilter[]) => void} set Callback to set the filter options.
 */
export const initializeViewFilters = (collection, set) => {
  // Disable filters for file/singleton collection
  if (!collection || !('folder' in collection)) {
    set([]);

    return;
  }

  const { options, default: defaultFilter } = parseFilterConfig(collection.view_filters);

  set(options);

  currentView.update((_view) => ({
    ..._view,
    filters: _view.filters ?? (defaultFilter ? [defaultFilter] : undefined),
  }));
};

/**
 * View filters for the selected entry collection.
 * @type {import('svelte/store').Readable<ViewFilter[]>}
 */
export const viewFilters = derived([selectedCollection], ([collection], set) => {
  initializeViewFilters(collection, set);
});
