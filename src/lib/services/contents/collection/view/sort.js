import { compare } from '@sveltia/utils/string';
import { getIndexFile } from '$lib/services/contents/collection/index-file';
import { getSortKeyType } from '$lib/services/contents/collection/view/sort-keys';
import { getField, getPropertyValue } from '$lib/services/contents/entry/fields';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import { getDate } from '$lib/services/contents/widgets/date-time/helper';
import { removeMarkdownSyntax } from '$lib/services/utils/markdown';

/**
 * @import { Entry, InternalCollection, SortingConditions } from '$lib/types/private';
 * @import { DateTimeField } from '$lib/types/public';
 */

/**
 * List of fields that may contain Markdown syntax and should be stripped before sorting. This
 * includes `title`, `summary`, and `description`, which are commonly used in entry collections.
 * @type {string[]}
 */
const markdownFieldKeys = ['title', 'summary', 'description'];

/**
 * Sort the given entries.
 * @param {Entry[]} entries Entry list.
 * @param {InternalCollection} collection Collection that the entries belong to.
 * @param {SortingConditions} [conditions] Sorting conditions.
 * @returns {Entry[]} Sorted entry list.
 * @see https://decapcms.org/docs/configuration-options/#sortable_fields
 */
export const sortEntries = (entries, collection, { key, order } = {}) => {
  const _entries = [...entries];

  const {
    name: collectionName,
    _i18n: { defaultLocale: locale },
  } = collection;

  if (key === undefined) {
    const options = { useTemplate: true, allowMarkdown: true };

    return _entries.sort((a, b) =>
      getEntrySummary(collection, a, options).localeCompare(
        getEntrySummary(collection, b, options),
      ),
    );
  }

  const fieldConfig = getField({ collectionName, keyPath: key });
  const type = getSortKeyType({ key, fieldConfig });

  const valueMap = Object.fromEntries(
    _entries.map((entry) => [entry.slug, getPropertyValue({ entry, locale, collectionName, key })]),
  );

  const dateFieldConfig =
    fieldConfig?.widget === 'datetime' ? /** @type {DateTimeField} */ (fieldConfig) : undefined;

  // Check if the field is a Markdown field: we use both the field config and a hardcoded key list
  // to determine this, as some fields may be text fields that contain Markdown syntax.
  const isMarkdownField = fieldConfig?.widget === 'markdown' || markdownFieldKeys.includes(key);

  _entries.sort((a, b) => {
    const aValue = valueMap[a.slug];
    const bValue = valueMap[b.slug];

    if (dateFieldConfig) {
      const aDate = aValue ? getDate(aValue, dateFieldConfig) : undefined;
      const bDate = bValue ? getDate(bValue, dateFieldConfig) : undefined;

      return Number(aDate ?? 0) - Number(bDate ?? 0);
    }

    if (type === String) {
      const aValueStr = aValue ? String(aValue) : '';
      const bValueStr = bValue ? String(bValue) : '';

      // Strip Markdown syntax from the values in case of some text fields
      if (isMarkdownField) {
        return compare(removeMarkdownSyntax(aValueStr), removeMarkdownSyntax(bValueStr));
      }

      return compare(aValueStr, bValueStr);
    }

    return Number(aValue ?? 0) - Number(bValue ?? 0);
  });

  if (order === 'descending') {
    _entries.reverse();
  }

  const indexFileName = getIndexFile(collection)?.name;

  // Index file should always be at the top
  if (indexFileName) {
    const index = _entries.findIndex((entry) => entry.slug === indexFileName);

    if (index > -1) {
      _entries.unshift(_entries.splice(index, 1)[0]);
    }
  }

  return _entries;
};
