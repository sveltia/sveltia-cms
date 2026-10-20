/**
 * @import {
 * BooleanField,
 * Field,
 * NumberField,
 * StringField,
 * UuidField,
 * VisibleField,
 * } from '$lib/types/public';
 */

/**
 * @typedef {object} FieldInputLabels
 * @property {string | undefined} prefix Text shown right before the input, String field only.
 * @property {string | undefined} suffix Text shown right after the input, String field only.
 * @property {string | undefined} beforeInputLabel Label shown before the input, as Markdown.
 * @property {string | undefined} afterInputLabel Label shown after the input, as Markdown.
 * @property {boolean} hasExtraLabels Whether any of the above is set.
 */

/**
 * Field types that the Translate button in the field header supports: the ones holding text, or
 * subfields that hold text.
 * @type {string[]}
 */
export const TRANSLATABLE_FIELD_TYPES = [
  'richtext',
  'markdown',
  'string',
  'text',
  'list',
  'object',
];

/**
 * Get the extra labels shown around a field’s input. The `prefix` and `suffix` options apply to
 * the String field type only, and the `before_input` and `after_input` options to the Boolean,
 * Number and String field types.
 * @param {Field} fieldConfig Field configuration.
 * @returns {FieldInputLabels} Labels.
 */
export const getFieldInputLabels = (fieldConfig) => {
  const { widget: fieldType = 'string' } = fieldConfig;
  const allowPrefix = fieldType === 'string';
  const allowExtraLabels = ['boolean', 'number', 'string'].includes(fieldType);
  const { prefix, suffix } = allowPrefix ? /** @type {StringField} */ (fieldConfig) : {};

  const { before_input: beforeInputLabel, after_input: afterInputLabel } = allowExtraLabels
    ? /** @type {BooleanField | NumberField | StringField} */ (fieldConfig)
    : {};

  return {
    prefix,
    suffix,
    beforeInputLabel,
    afterInputLabel,
    hasExtraLabels: !!(prefix || suffix || beforeInputLabel || afterInputLabel),
  };
};

/**
 * Get whether a field is hidden from the editor and whether it can’t be edited.
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {boolean} args.autoSet Whether the field’s value is set on save, as with the `auto_now`
 * option of a DateTime field or the `auto_increment` option of a Number field.
 * @param {boolean} args.locked Whether the whole entry is shown for reference only, e.g. pending
 * deletion or in a read-only collection.
 * @param {boolean} args.isDuplicated Whether the field’s value follows the default locale.
 * @param {boolean} args.isNew Whether the entry is being created.
 * @param {boolean} [args.parentReadonly] Whether the field belongs to a List or Object field, or a
 * rich text editor component, that can’t be edited, which no subfield can opt out of.
 * @returns {{ hidden: boolean, readonly: boolean, subfieldsReadonly: boolean }} Flags. The last one
 * tells the subfields whether they can’t be edited because of this field. It leaves out whether
 * the value follows the default locale, as a subfield made translatable has a value of its own,
 * and whether the entry is locked, which each subfield works out itself.
 */
export const getFieldEditorFlags = ({
  fieldConfig,
  autoSet,
  locked,
  isDuplicated,
  isNew,
  parentReadonly = false,
}) => {
  const { widget: fieldType = 'string' } = fieldConfig;
  const { readonly: readonlyOption } = /** @type {VisibleField} */ (fieldConfig);
  const isCompute = fieldType === 'compute';
  const subfieldsReadonly = readonlyOption === true || parentReadonly;

  return {
    // A field set on save has no meaningful value until the entry is saved for the first time
    hidden: isCompute || (autoSet && isNew),
    readonly:
      // The `readonly` option defaults to `true` for the UUID field type, which can be unlocked,
      // also with the deprecated `read_only` option
      (readonlyOption ??
        (fieldType === 'uuid' && /** @type {UuidField} */ (fieldConfig).read_only !== false)) ||
      subfieldsReadonly ||
      autoSet ||
      locked ||
      isDuplicated ||
      isCompute,
    subfieldsReadonly,
  };
};

/**
 * Get the field configuration passed to a field’s editor. An inline Select or Relation field
 * always shows a dropdown list, as radio buttons wouldn’t fit within a line of text.
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {boolean} args.inline Whether the field is rendered inline.
 * @returns {Field} Field configuration, which is the given one unless it has to be changed.
 */
export const getEditorFieldConfig = ({ fieldConfig, inline }) => {
  const { widget: fieldType = 'string' } = fieldConfig;

  return /** @type {Field} */ (
    inline && ['select', 'relation'].includes(fieldType)
      ? { ...fieldConfig, dropdown_threshold: 0 }
      : fieldConfig
  );
};
