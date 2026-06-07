/**
 * @import { Entry, FlattenedEntryContent } from '$lib/types/private';
 * @import { RelationFieldFilterOptions } from '$lib/types/public';
 */

const FIELD_TEMPLATE_REGEX = /^{{fields\.(.+?)}}$/;

/**
 * Resolve `{{fields.fieldName}}` and `{{slug}}` template strings in filter values against the entry
 * currently being edited. Unresolvable templates are dropped from the values array so they do not
 * accidentally match `undefined` content fields.
 * @internal
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
      const resolved = currentLocaleValues?.[match[1]];

      // Drop unresolvable templates to avoid false matches
      return resolved !== undefined ? [resolved] : [];
    }),
  }));

/**
 * Filter entries based on file name and entry filters.
 * @internal
 * @param {Entry[]} refEntries Reference entries.
 * @param {string} locale Current locale.
 * @param {string} [fileName] File name to filter by.
 * @param {RelationFieldFilterOptions[]} [entryFilters] Entry filters to apply.
 * @returns {{ refEntry: Entry, content: FlattenedEntryContent }[]} Filtered entries with content.
 */
export const filterAndPrepareEntries = (
  refEntries,
  locale,
  fileName = undefined,
  entryFilters = [],
) =>
  refEntries
    .filter((refEntry) => !fileName || fileName === refEntry.slug)
    .map((refEntry) => {
      // Fall back to the default locale if needed
      const { content } = refEntry.locales[locale] ?? refEntry.locales._default ?? {};

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
          const fieldValue = isEntrySlug ? refEntry.slug : content[fieldKey];

          return exclude ? !values.includes(fieldValue) : values.includes(fieldValue);
        }),
    );
