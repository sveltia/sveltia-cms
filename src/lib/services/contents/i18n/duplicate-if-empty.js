import { isFieldMultiple } from '$lib/services/contents/entry/fields';
import { isValueEmpty } from '$lib/services/utils/object';

/**
 * @import { CodeField, Field, FieldKeyPath } from '$lib/types/public';
 * @import { FlattenedEntryContent } from '$lib/types/private';
 */

/**
 * Field types supporting the `duplicate_if_empty` i18n strategy: those holding a single, simple
 * value. A File or Image field only supports it when it doesn’t accept multiple files.
 */
export const DUPLICATE_IF_EMPTY_FIELD_TYPES = [
  'code',
  'datetime',
  'file',
  'image',
  'markdown',
  'number',
  'richtext',
  'string',
  'text',
];

/**
 * Check if the given field uses the `duplicate_if_empty` i18n strategy, which copies the default
 * locale’s value to the other locales where the value is empty, while leaving it editable there.
 * The strategy only applies to the field types listed in {@link DUPLICATE_IF_EMPTY_FIELD_TYPES};
 * any other field with the option works like a translatable field.
 * @param {Field} fieldConfig Field configuration.
 * @returns {boolean} Result.
 * @see https://github.com/sveltia/sveltia-cms/issues/120
 */
export const isDuplicateIfEmptyField = (fieldConfig) =>
  fieldConfig.i18n === 'duplicate_if_empty' &&
  DUPLICATE_IF_EMPTY_FIELD_TYPES.includes(fieldConfig.widget ?? 'string') &&
  !isFieldMultiple(fieldConfig);

/**
 * Get the key path holding the main value of the given field, which tells whether the field is
 * empty. That’s the field’s own key path, except for a Code field that outputs the language along
 * with the code, whose value is an object holding the code under a key of its own.
 * @param {Field} fieldConfig Field configuration.
 * @param {FieldKeyPath} keyPath Key path of the field.
 * @returns {FieldKeyPath} Key path.
 */
export const getMainValueKeyPath = (fieldConfig, keyPath) => {
  if (fieldConfig.widget !== 'code') {
    return keyPath;
  }

  const { output_code_only: outputCodeOnly = false, keys: outputKeys = { code: 'code' } } =
    /** @type {CodeField} */ (fieldConfig);

  return outputCodeOnly ? keyPath : `${keyPath}.${outputKeys.code}`;
};

/**
 * Check if the given field is empty in the given locale’s content, so that the default locale’s
 * value takes its place.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.content Content of a locale.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Key path of the field.
 * @returns {boolean} Result.
 */
export const isFieldEmpty = ({ content, fieldConfig, keyPath }) =>
  isValueEmpty(content[getMainValueKeyPath(fieldConfig, keyPath)]);

/**
 * Find the field using the `duplicate_if_empty` i18n strategy that the given key path belongs to.
 * That’s the field at the key path, or, for a Code field that outputs the language along with the
 * code, the field above the `code` or `lang` key.
 * @param {FieldKeyPath} keyPath Key path of the value.
 * @param {(keyPath: FieldKeyPath) => Field | undefined} getFieldConfig Function to look up the
 * field configuration for a key path.
 * @returns {{ fieldConfig: Field, fieldKeyPath: FieldKeyPath } | undefined} Field and its key path,
 * or `undefined` if the key path doesn’t belong to such a field.
 */
export const findDuplicateIfEmptyField = (keyPath, getFieldConfig) => {
  const fieldConfig = getFieldConfig(keyPath);

  if (fieldConfig) {
    return isDuplicateIfEmptyField(fieldConfig)
      ? { fieldConfig, fieldKeyPath: keyPath }
      : undefined;
  }

  const index = keyPath.lastIndexOf('.');

  if (index < 0) {
    return undefined;
  }

  const fieldKeyPath = keyPath.slice(0, index);
  const parentFieldConfig = getFieldConfig(fieldKeyPath);

  return parentFieldConfig?.widget === 'code' &&
    isDuplicateIfEmptyField(parentFieldConfig) &&
    getMainValueKeyPath(parentFieldConfig, fieldKeyPath) !== fieldKeyPath
    ? { fieldConfig: parentFieldConfig, fieldKeyPath }
    : undefined;
};
