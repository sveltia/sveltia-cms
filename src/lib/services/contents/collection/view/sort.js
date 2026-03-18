import { compare } from '@sveltia/utils/string';

import { getIndexFile } from '$lib/services/contents/collection/index-file';
import { getSortKeyType } from '$lib/services/contents/collection/view/sort-keys';
import { getField, getPropertyValue } from '$lib/services/contents/entry/fields';
import { getDate } from '$lib/services/contents/fields/date-time/helper';
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
export const markdownFieldKeys = ['title', 'summary', 'description'];

/**
 * Sort the given entries.
 * @param {Entry[]} entries Entry list.
 * @param {InternalCollection} collection Collection that the entries belong to.
 * @param {SortingConditions} [conditions] Sorting conditions.
 * @returns {Entry[]} Sorted entry list.
 * @see https://decapcms.org/docs/configuration-options/#sortable_fields
 * @see https://sveltiacms.app/en/docs/collections/entries#sorting
 */
export const sortEntries = (entries, collection, { key, order } = {}) => {
  const _entries = [...entries];

  if (key === undefined) {
    return _entries;
  }

  const {
    name: collectionName,
    _i18n: { defaultLocale: locale },
  } = collection;

  const fieldConfig = getField({ collectionName, keyPath: key });
  const type = getSortKeyType({ key, fieldConfig });

  const dateFieldConfig =
    fieldConfig?.widget === 'datetime' ? /** @type {DateTimeField} */ (fieldConfig) : undefined;

  // Check if the field is a Markdown-enabled field: we use both the field config and a hardcoded
  // key list to determine this, as some fields may be text fields that contain Markdown syntax.
  const isMarkdownField =
    fieldConfig?.widget === 'richtext' ||
    fieldConfig?.widget === 'markdown' ||
    markdownFieldKeys.includes(key);

  // Pre-compute sort keys once (O(n)) instead of re-computing inside the comparator (O(n log n)).
  // For date fields this avoids re-parsing the date string on every comparison; for markdown fields
  // it avoids repeatedly stripping syntax from the same value.
  const sortKeyMap = Object.fromEntries(
    _entries.map((entry) => {
      const raw = getPropertyValue({ entry, locale, collectionName, key });

      if (dateFieldConfig) {
        return [entry.slug, raw ? Number(getDate(raw, dateFieldConfig) ?? 0) : 0];
      }

      if (type === String) {
        const str = raw ? String(raw) : '';

        return [entry.slug, isMarkdownField ? removeMarkdownSyntax(str) : str];
      }

      return [entry.slug, Number(raw ?? 0)];
    }),
  );

  _entries.sort((a, b) => {
    const aKey = sortKeyMap[a.slug];
    const bKey = sortKeyMap[b.slug];

    if (dateFieldConfig || type !== String) {
      return /** @type {number} */ (aKey) - /** @type {number} */ (bKey);
    }

    return compare(/** @type {string} */ (aKey), /** @type {string} */ (bKey));
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
