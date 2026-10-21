import { compare } from '@sveltia/utils/string';

import { compareSortKeys } from '$lib/services/common/view';
import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder/config';
import { getOrderValueGetter } from '$lib/services/contents/collection/entries/reorder/sort';
import { getEntrySortKeyGetter } from '$lib/services/contents/collection/view/sort';

/**
 * @import {
 * Entry,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * RelationOption,
 * RelationOptionGroup,
 * } from '$lib/types/private';
 * @import { RelationFieldSortOptions } from '$lib/types/public';
 */

/**
 * Get a function that computes the sort key of a referenced entry. The value is read from the
 * locale the options are built from: the current locale, falling back to the collection’s default
 * locale as the option labels do, so the options are sorted by the values the user
 * sees. The `_manual` key and the collection’s reorder field sort by the manual order, which is
 * always a number.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Referenced collection.
 * @param {string} args.key Sort key field path, or one of the special sort keys.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @returns {{ getSortKey: (entry: Entry) => string | number | undefined, isStringType: boolean }}
 * Sort key getter, and whether the keys are compared as strings.
 */
const getRelationSortKeyGetter = ({ collection, key, locale }) => {
  if (key === '_manual' || key === getOrderFieldKey(collection)) {
    return { getSortKey: getOrderValueGetter(collection), isStringType: false };
  }

  const { defaultLocale } = collection._i18n;
  const current = getEntrySortKeyGetter({ collection, key, locale });

  const fallback =
    locale === defaultLocale
      ? current
      : getEntrySortKeyGetter({ collection, key, locale: defaultLocale });

  /**
   * Get the sort key of an entry from the current locale, or the default locale if the entry has no
   * content in the current locale.
   * @param {Entry} entry Referenced entry.
   * @returns {string | number | undefined} Sort key.
   */
  const getSortKey = (entry) =>
    entry.locales[locale] ? current.getSortKey(entry) : fallback.getSortKey(entry);

  return { getSortKey, isStringType: current.isStringType };
};

/**
 * Sort the options of a Relation field by a field of the referenced entries, as the `sort_by`
 * option defines. An entry without a value goes last in either direction, as in the entry list, and
 * options with the same value are sorted by label, so they don’t follow the arbitrary order of the
 * entries. The options generated from the same entry share its value.
 * @param {object} args Arguments.
 * @param {RelationOptionGroup[]} args.groups Options grouped by referenced entry.
 * @param {InternalEntryCollection} args.collection Referenced collection.
 * @param {RelationFieldSortOptions} args.sortBy Sort options.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @returns {RelationOption[]} Sorted options.
 * @see https://github.com/sveltia/sveltia-cms/issues/572
 */
export const sortOptions = ({ groups, collection, sortBy, locale }) => {
  const { field: key, direction } = sortBy;
  const { getSortKey, isStringType } = getRelationSortKeyGetter({ collection, key, locale });
  const sign = direction === 'descending' ? -1 : 1;

  // Compute the key once per entry rather than in the comparator
  const items = groups.flatMap(({ refEntry, options }) => {
    const sortKey = getSortKey(refEntry);

    return options.map((option) => ({ option, sortKey }));
  });

  items.sort((a, b) => {
    if (a.sortKey !== b.sortKey) {
      if (a.sortKey === undefined) return 1;
      if (b.sortKey === undefined) return -1;

      const diff = compareSortKeys(a.sortKey, b.sortKey, isStringType);

      if (diff) {
        return diff * sign;
      }
    }

    return compare(a.option.label, b.option.label);
  });

  return items.map(({ option }) => option);
};
