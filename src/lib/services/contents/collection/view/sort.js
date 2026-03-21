import { sortItemsByKey } from '$lib/services/common/view';
import { getIndexFile } from '$lib/services/contents/collection/index-file';
import { getSortKeyType } from '$lib/services/contents/collection/view/sort-keys';
import { getField, getPropertyValue } from '$lib/services/contents/entry/fields';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
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

      return isMarkdownField ? removeMarkdownSyntax(str) : str;
    };
  }

  return (/** @type {Entry} */ entry) => {
    const raw = getPropertyValue({ entry, locale, collectionName, key });

    return Number(raw ?? 0);
  };
};

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

  const getSortKey = getSortKeyGetter({
    key,
    type,
    collection,
    locale,
    collectionName,
    dateFieldConfig,
    isMarkdownField,
  });

  const sortKeyMap = Object.fromEntries(_entries.map((entry) => [entry.slug, getSortKey(entry)]));

  sortItemsByKey(_entries, (e) => sortKeyMap[e.slug], !dateFieldConfig && type === String, order);

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
