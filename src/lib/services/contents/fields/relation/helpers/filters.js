import { escapeRegExp } from '@sveltia/utils/string';

import { stripIndexFileName } from '$lib/services/contents/collection/nested';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { Entry, FlattenedEntryContent, InternalCollection } from '$lib/types/private';
 * @import { RelationFieldFilterOptions } from '$lib/types/public';
 */

const FIELD_TEMPLATE_REGEX = /^{{fields\.(.+?)}}$/;
/**
 * Cache of pre-compiled regexes matching the item keys of a list, keyed by field key path.
 * @type {Map<string, RegExp>}
 */
const listItemRegexCache = new Map();

/**
 * Get the value of a field from flattened entry content. A list value, such as that of a Select
 * field with `multiple: true` or a List field without subfields, is flattened into `field.0`,
 * `field.1` and so on, often next to an empty placeholder at `field`, so its items are collected
 * into an array. The content is only read, never written, as it can be the live state of an entry
 * draft, which the Relation field editor reads within `$derived()`.
 * @param {FlattenedEntryContent} content Flattened entry content.
 * @param {string} keyPath Field key path.
 * @returns {any} Field value, or an array of list items.
 */
const getFieldValue = (content, keyPath) => {
  const value = content[keyPath];

  // Return a plain value as is. Only a list, whose placeholder is an empty array, needs its item
  // keys looked up; reading the key names alone keeps a draft’s other values untracked
  if (value !== undefined && !Array.isArray(value)) {
    return value;
  }

  const regex = getOrCreate(
    listItemRegexCache,
    keyPath,
    () => new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`),
  );

  const items = Object.keys(content)
    .filter((key) => regex.test(key))
    .map((key) => content[key]);

  return items.length ? items : value;
};

/**
 * Resolve `{{fields.fieldName}}` and `{{slug}}` template strings in filter values against the entry
 * currently being edited. Unresolvable templates are dropped from the values array so they do not
 * accidentally match `undefined` content fields.
 * @param {RelationFieldFilterOptions[]} filters Entry filters.
 * @param {FlattenedEntryContent | undefined} currentLocaleValues Current locale field values of the
 * entry being edited, or `undefined` when not available (e.g. backlink resolution).
 * @param {string | undefined} currentSlug Current slug of the entry being edited, or `undefined`
 * when not yet determined (e.g. new entry draft).
 * @returns {RelationFieldFilterOptions[]} Filters with template values resolved.
 */
export const resolveFilterValues = (filters, currentLocaleValues, currentSlug = undefined) =>
  filters.map(({ field, values, exclude }) => ({
    field,
    exclude,
    values: values.flatMap((v) => {
      if (typeof v !== 'string') return [v];

      if (v === '{{slug}}') {
        // Drop if slug not yet determined (new entry draft)
        return currentSlug ? [currentSlug] : [];
      }

      const match = v.match(FIELD_TEMPLATE_REGEX);

      if (!match) return [v];

      // Template found — resolve against current entry values
      const resolved = currentLocaleValues
        ? getFieldValue(currentLocaleValues, match[1])
        : undefined;

      // Expand a list value into its items, so an entry matches when it shares any of them
      if (Array.isArray(resolved)) return resolved;

      // Drop unresolvable templates to avoid false matches
      return resolved !== undefined ? [resolved] : [];
    }),
  }));

/**
 * Filter entries based on file name and entry filters.
 * @param {object} args Arguments.
 * @param {Entry[]} args.refEntries Reference entries.
 * @param {InternalCollection} args.collection Collection the entries belong to.
 * @param {string} args.locale Current locale.
 * @param {string} [args.fileName] File name to filter by.
 * @param {RelationFieldFilterOptions[]} [args.entryFilters] Entry filters to apply.
 * @param {string} [args.defaultLocale] Default locale from collection’s i18n configuration.
 * @returns {{ refEntry: Entry, content: FlattenedEntryContent }[]} Filtered entries with content.
 */
export const filterAndPrepareEntries = ({
  refEntries,
  collection,
  locale,
  fileName = undefined,
  entryFilters = [],
  defaultLocale = undefined,
}) =>
  refEntries
    .filter((refEntry) => !fileName || fileName === refEntry.slug)
    .map((refEntry) => {
      // Fall back to the collection’s default locale, then `_default` (no i18n) as a final fallback
      const { content } =
        refEntry.locales[locale] ??
        (defaultLocale ? refEntry.locales[defaultLocale] : undefined) ??
        refEntry.locales._default ??
        {};

      return {
        refEntry,
        hasContent: !!content && Object.keys(content).length > 0,
        content: content ?? {},
      };
    })
    .filter(
      ({ hasContent, content, refEntry }) =>
        hasContent &&
        entryFilters.every(({ field, values, exclude = false }) => {
          // An empty values array means no constraint — skip this filter
          if (values.length === 0) return true;

          // `slug` refers to the entry’s slug, not a regular content field.
          // `fields.fieldName` strips the prefix so a field literally named `slug` can be
          // targeted via `fields.slug` without ambiguity.
          const isEntrySlug = field === 'slug';
          const fieldKey = field.replace(/^fields\./, '');

          // Match the slug in the same shape a reference to the entry uses
          const fieldValue = isEntrySlug
            ? stripIndexFileName(collection, refEntry.slug)
            : getFieldValue(content, fieldKey);

          // A list value matches when any of its items is included in the filter values
          const matches = Array.isArray(fieldValue)
            ? fieldValue.some((item) => values.includes(item))
            : values.includes(fieldValue);

          return exclude ? !matches : matches;
        }),
    );
