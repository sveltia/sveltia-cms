import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getOtherEntries } from '$lib/services/contents/draft/validate/slugs';
import { isFieldMultiple } from '$lib/services/contents/entry/fields';
import { isPerEntryField } from '$lib/services/contents/entry/per-entry';
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
 * Check whether the `unique` option applies to the given field. It’s only meaningful for a field
 * that holds one value per entry of an entry collection. A field that takes multiple values doesn’t
 * qualify either, as it holds a list.
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
    isPerEntryField({
      collection: draft.collection,
      isIndexFile: draft.isIndexFile,
      keyPath,
      inEditorComponent: !!componentName,
    })
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
