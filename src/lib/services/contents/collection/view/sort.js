import { sortItemsByKey } from '$lib/services/common/view';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder/config';
import { sortEntriesByOrderField } from '$lib/services/contents/collection/entries/reorder/sort';
import { getSortKeyType } from '$lib/services/contents/collection/view/sort-keys';
import { getField } from '$lib/services/contents/entry/fields';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import { getPropertyValue } from '$lib/services/contents/entry/values';
import { RICH_TEXT_FIELD_TYPES } from '$lib/services/contents/fields';
import { getDate } from '$lib/services/contents/fields/date-time/parse';
import { removeMarkdownSyntax } from '$lib/services/utils/markdown';

/**
 * @import {
 * Entry,
 * InternalCollection,
 * InternalEntryCollection,
 * SortingConditions,
 * } from '$lib/types/private';
 * @import { DateTimeField } from '$lib/types/public';
 */

/**
 * Maximum length of a Markdown value used as a sort key, before its syntax is removed.
 */
const MARKDOWN_SORT_KEY_LENGTH = 1000;

/**
 * List of fields that may contain Markdown syntax and should be stripped before sorting. This
 * includes `title`, `summary`, and `description`, which are commonly used in entry collections.
 * @type {string[]}
 */
export const MARKDOWN_FIELD_KEYS = ['title', 'summary', 'description'];

/**
 * Get a function that computes the sort key for a single entry. Pre-computing this once (O(n))
 * instead of re-computing inside the comparator (O(n log n)) avoids re-parsing dates and stripping
 * Markdown syntax on every comparison.
 * @param {object} args Arguments.
 * @param {string} args.key Sort key field path.
 * @param {StringConstructor | NumberConstructor | DateConstructor | BooleanConstructor} args.type
 * Sort key type.
 * @param {InternalCollection} args.collection Collection.
 * @param {string} args.locale Locale.
 * @param {string} args.collectionName Collection name.
 * @param {DateTimeField | undefined} args.dateFieldConfig DateTime field config, or `undefined` if
 * the field is not a DateTime field.
 * @param {boolean} args.isMarkdownField Whether the field may contain Markdown syntax.
 * @returns {(entry: Entry) => string | number} Sort key getter for one entry.
 */
export const getSortKeyGetter = ({
  key,
  type,
  collection,
  locale,
  collectionName,
  dateFieldConfig,
  isMarkdownField,
}) => {
  // Special handling for summary, which uses a generated value instead of a raw field value
  if (key === '_summary') {
    return (/** @type {Entry} */ entry) =>
      getEntrySummary(collection, entry, { locale, useTemplate: true });
  }

  if (dateFieldConfig) {
    return (/** @type {Entry} */ entry) => {
      const raw = getPropertyValue({ entry, locale, collectionName, key });

      return raw ? Number(getDate(raw, dateFieldConfig) ?? 0) : 0;
    };
  }

  if (type === String) {
    return (/** @type {Entry} */ entry) => {
      const raw = getPropertyValue({ entry, locale, collectionName, key });
      const str = raw ? String(raw) : '';

      // Only the beginning of a long Markdown value tells entries apart, and stripping the syntax
      // takes time that grows faster than the length on a value crafted to be nested deeply
      return isMarkdownField ? removeMarkdownSyntax(str.slice(0, MARKDOWN_SORT_KEY_LENGTH)) : str;
    };
  }

  return (/** @type {Entry} */ entry) => {
    const raw = getPropertyValue({ entry, locale, collectionName, key });

    return Number(raw ?? 0);
  };
};

/**
 * Move the collection’s index file to the top of the sorted entries, where it should always be.
 * It’s told by its path rather than by its slug, because another collection’s index file within
 * this collection’s folder carries the same slug.
 * @param {Entry[]} entries Sorted entries, which are modified in place.
 * @param {InternalCollection} collection Collection that the entries belong to.
 * @returns {Entry[]} The given entries.
 */
const moveIndexFileToTop = (entries, collection) => {
  const index = entries.findIndex((entry) => isCollectionIndexFile(collection, entry));

  if (index > -1) {
    entries.unshift(entries.splice(index, 1)[0]);
  }

  return entries;
};

/**
 * Sort the given entries.
 * @param {Entry[]} entries Entry list.
 * @param {InternalCollection} collection Collection that the entries belong to.
 * @param {SortingConditions} [conditions] Sorting conditions.
 * @returns {Entry[]} Sorted entry list.
 * @see https://decapcms.org/docs/configuration-options/#sortable_fields
 * @see https://sveltiacms.app/en/docs/collections/entries/views#sorting
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

  // The `_manual` special key sorts by the collection’s reorder field, or by the position in the
  // array. Either way, the entries are sorted the same as in the reorder UI and when they are
  // renumbered: an entry without a valid number goes last, keeping its place among the others. The
  // field may not be defined under the collection’s `fields`, so it would otherwise default to a
  // string sort, and a missing value would come first
  if (key === '_manual' || key === getOrderFieldKey(collection)) {
    const sorted = sortEntriesByOrderField(
      entries,
      /** @type {InternalEntryCollection} */ (collection),
    );

    if (order === 'descending') {
      sorted.reverse();
    }

    return moveIndexFileToTop(sorted, collection);
  }

  const fieldConfig = getField({ collectionName, keyPath: key });
  const type = getSortKeyType({ key, fieldConfig });

  const dateFieldConfig =
    fieldConfig?.widget === 'datetime' ? /** @type {DateTimeField} */ (fieldConfig) : undefined;

  // Check if the field is a Markdown-enabled field: we use both the field config and a hardcoded
  // key list to determine this, as some fields may be text fields that contain Markdown syntax.
  const isMarkdownField =
    RICH_TEXT_FIELD_TYPES.includes(fieldConfig?.widget ?? '') || MARKDOWN_FIELD_KEYS.includes(key);

  const getSortKey = getSortKeyGetter({
    key,
    type,
    collection,
    locale,
    collectionName,
    dateFieldConfig,
    isMarkdownField,
  });

  // `sortItemsByKey()` computes the key once per entry, so there’s no need for a lookup table here
  sortItemsByKey(_entries, getSortKey, !dateFieldConfig && type === String, order);

  return moveIndexFileToTop(_entries, collection);
};
