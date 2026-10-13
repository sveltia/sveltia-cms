import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getOtherEntries } from '$lib/services/contents/draft/validate/slugs';
import { isFieldMultiple } from '$lib/services/contents/entry/fields';
import { MEDIA_FIELD_TYPES } from '$lib/services/contents/fields';

/**
 * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import { Field, FieldKeyPath, UniqueValueProps } from '$lib/types/public';
 */

/**
 * Field types that support the `unique` option. Each of them holds a single string or number,
 * unless it takes multiple values, which the option doesn’t support.
 */
export const UNIQUE_FIELD_TYPES = [
  'color',
  'datetime',
  'file',
  'image',
  'markdown',
  'number',
  'relation',
  'richtext',
  'select',
  'string',
  'text',
];

/**
 * Regular expression matching the item index of a List field within a key path, e.g. `.0` in
 * `speakers.0.name` and `.3` in `tags.3`.
 */
const LIST_ITEM_INDEX_REGEX = /\.\d+(?=\.|$)/;

/**
 * Normalize a field value so that values meaning the same thing compare equal: a number is compared
 * by its numeric value, so `1`, `'1'` and `'01'` are the same in a Number field, a color regardless
 * of case, so `#FF0000` and `#ff0000` are the same, and any other value as a string with its
 * surrounding whitespace trimmed. A file just uploaded to a File or Image field, stored as a blob
 * URL until the entry is saved, is a new file, so it can’t be the same as another entry’s.
 * @param {any} value Value.
 * @param {string} fieldType Field type.
 * @returns {string | number | undefined} Normalized value, or `undefined` if the value is empty or
 * can’t be compared.
 */
export const normalizeUniqueValue = (value, fieldType) => {
  if (value === undefined || value === null || typeof value === 'object') {
    return undefined;
  }

  const trimmed = String(value).trim();

  if (!trimmed) {
    return undefined;
  }

  if (fieldType === 'number') {
    const number = Number(trimmed);

    return Number.isFinite(number) ? number : undefined;
  }

  if (fieldType === 'color') {
    return trimmed.toLowerCase();
  }

  if (MEDIA_FIELD_TYPES.includes(fieldType) && trimmed.startsWith('blob:')) {
    return undefined;
  }

  return trimmed;
};

/**
 * Check whether the `unique` option applies to the given field. It’s only meaningful in an entry
 * collection, where every entry has the same fields, and for a field that holds one value per
 * entry: a field that takes multiple values holds a list, a field in a List field or a rich text
 * editor component can appear any number of times in an entry, and the special index file has
 * fields of its own.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {string} [args.componentName] Rich text editor component name.
 * @returns {boolean} Result.
 */
export const isUniqueField = ({ draft, fieldConfig, keyPath, componentName }) => {
  const { widget: fieldType = 'string' } = fieldConfig;

  return (
    UNIQUE_FIELD_TYPES.includes(fieldType) &&
    /** @type {UniqueValueProps} */ (fieldConfig).unique === true &&
    !isFieldMultiple(fieldConfig) &&
    draft.collection._type === 'entry' &&
    !draft.isIndexFile &&
    !componentName &&
    !LIST_ITEM_INDEX_REGEX.test(keyPath)
  );
};

/**
 * Check whether another entry in the same collection has the same value in the same field, like a
 * `UNIQUE` constraint in a relational database. Both the published and unpublished entries are
 * looked at, leaving out any version of the entry being edited, as well as the special index file.
 * An empty value never counts as a duplicate.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale of the value.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {any} args.value Field value.
 * @param {string} args.fieldType Field type.
 * @returns {boolean} Whether the value is taken by another entry.
 * @see https://github.com/decaporg/decap-cms/issues/1069
 */
export const isValueTaken = ({ draft, locale, keyPath, value, fieldType }) => {
  const normalized = normalizeUniqueValue(value, fieldType);

  if (normalized === undefined) {
    return false;
  }

  const { collection } = draft;

  return getOtherEntries(draft, { inFolder: false }).some(
    (entry) =>
      !isCollectionIndexFile(collection, entry) &&
      normalizeUniqueValue(entry.locales[locale]?.content[keyPath], fieldType) === normalized,
  );
};
