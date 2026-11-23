import { validatePattern } from '$lib/services/contents/draft/validate/scalar';
import { MEDIA_FIELD_TYPES, MULTI_VALUE_FIELD_TYPES } from '$lib/services/contents/fields';
import { resolveCodeField } from '$lib/services/contents/fields/code/validate';
import { validateKeyValueField } from '$lib/services/contents/fields/key-value/validate';
import { getListFieldInfo } from '$lib/services/contents/fields/list/helpers';
import { getListItems, validateListField } from '$lib/services/contents/fields/list/validate';

/**
 * @import {
 * EntryDraft,
 * EntryValidityState,
 * FlattenedEntryContent,
 * GetFieldArgs,
 * LocaleValidityMap,
 * } from '$lib/types/private';
 * @import {
 * CodeField,
 * Field,
 * FieldKeyPath,
 * ListField,
 * LocaleCode,
 * } from '$lib/types/public';
 */

/**
 * Arguments for the functions that prepare an aggregate or special field for validation.
 * @typedef {object} PrepareFieldArgs
 * @property {FieldKeyPath} keyPath Field key path.
 * @property {any} value Field value.
 * @property {FlattenedEntryContent} valueMap Entry values.
 * @property {Field} fieldConfig Field configuration.
 * @property {GetFieldArgs} getFieldArgs Arguments to get the field configuration.
 * @property {EntryDraft['files']} files Files attached to the draft.
 * @property {EntryValidityState} validity Validity state to update.
 * @property {LocaleValidityMap} validities Validity state of all the fields.
 * @property {LocaleCode} locale Current locale.
 * @property {boolean} required Whether the field is required.
 * @property {string | number} min Minimum value or item count.
 * @property {string | number} max Maximum value or item count.
 */

/**
 * Result of the preparation of a field for validation.
 * @typedef {object} PreparedField
 * @property {boolean} skip Whether the field is not validated any further, because it has been
 * validated already.
 * @property {FieldKeyPath} keyPath Key path to validate the field at.
 * @property {any} value Value to validate.
 * @property {boolean} empty Whether the field holds no value at all.
 */

/**
 * Get the value of a media field to validate. The stored value can be a blob URL, whose original
 * file name is validated instead.
 * @param {object} args Arguments.
 * @param {string} args.fieldType Field type.
 * @param {any} args.value Field value.
 * @param {EntryDraft['files']} args.files Files attached to the draft.
 * @returns {any} Value to validate.
 */
export const resolveMediaValue = ({ fieldType, value, files }) => {
  if (
    MEDIA_FIELD_TYPES.includes(fieldType) &&
    typeof value === 'string' &&
    value.startsWith('blob:')
  ) {
    // The stored `value` is a blob URL; get the original file name
    return files[value]?.file?.name;
  }

  return value;
};

/**
 * Prepare a List field, or a field that takes multiple values, for validation.
 * @param {PrepareFieldArgs} args Arguments.
 * @returns {PreparedField} Result.
 */
export const prepareListField = ({
  keyPath,
  value,
  valueMap,
  fieldConfig,
  files,
  validity,
  validities,
  locale,
  required,
  min,
  max,
}) => {
  const { skip, empty } = validateListField({
    keyPath,
    value,
    valueMap,
    validity,
    validities,
    locale,
    required,
    min,
    max,
  });

  // Like Decap CMS, test the pattern of a List field without subfields, or a multiple File, Image,
  // Relation or Select field, against its items joined with commas, e.g. `a,b,c`, rather than
  // against each item. A custom field taking an array, also prepared here, is left alone
  // @ts-ignore A List field with subfields doesn’t have the `pattern` option
  const { widget: fieldType = 'string', pattern: validation } = fieldConfig;

  if (
    !skip &&
    !empty &&
    Array.isArray(validation) &&
    (fieldType === 'list'
      ? !getListFieldInfo(/** @type {ListField} */ (fieldConfig)).hasSubFields
      : MULTI_VALUE_FIELD_TYPES.includes(fieldType))
  ) {
    validatePattern({
      // Like Decap’s Immutable `List.join()`, this converts a number to a string and `null` to an
      // empty string. A file just uploaded is tested by its name, as in a single File/Image field
      value: getListItems({ keyPath, value, valueMap })
        .map((item) => resolveMediaValue({ fieldType, value: item, files }))
        .join(','),
      validation,
      validity,
    });
  }

  return { skip, keyPath, value, empty: !!empty };
};

/**
 * Prepare an Object field for validation.
 * @param {PrepareFieldArgs} args Arguments.
 * @returns {PreparedField} Result.
 */
const prepareObjectField = ({ keyPath, value, valueMap, validity, required }) => {
  // An Object field holding subfields may have no value at its own key path, e.g. right after the
  // editor adds the subfields and deletes the `null` it stored while the object was removed, so
  // the subfields tell whether it’s there
  const empty =
    value === undefined
      ? !Object.keys(valueMap).some((key) => key.startsWith(`${keyPath}.`))
      : !value;

  if (required && empty) {
    validity.valueMissing = true;
  }

  return { skip: false, keyPath, value, empty };
};

/**
 * Prepare a KeyValue field for validation.
 * @param {PrepareFieldArgs} args Arguments.
 * @returns {PreparedField} Result.
 */
const prepareKeyValueField = ({
  keyPath,
  value,
  getFieldArgs,
  validity,
  validities,
  locale,
  required,
  min,
  max,
}) => {
  const result = validateKeyValueField({
    keyPath,
    getFieldArgs,
    validity,
    validities,
    locale,
    required,
    min,
    max,
  });

  return { skip: result.skip, keyPath: result.keyPath, value, empty: !!result.empty };
};

/**
 * Prepare a Code field for validation.
 * @param {PrepareFieldArgs} args Arguments.
 * @returns {PreparedField} Result.
 */
const prepareCodeField = ({ keyPath, value, valueMap, fieldConfig, validities, locale }) => {
  const result = resolveCodeField({
    keyPath,
    value,
    valueMap,
    fieldConfig: /** @type {CodeField} */ (fieldConfig),
    validities,
    locale,
  });

  return { skip: result.skip, keyPath: result.keyPath, value: result.value, empty: false };
};

/**
 * Map of functions to prepare different field types for validation, which run before the
 * functions in `VALIDATE_FIELD_FUNCTIONS` in the `scalar` module. List fields and fields that take
 * multiple values are prepared with {@link prepareListField} instead.
 * @type {Record<string, (args: PrepareFieldArgs) => PreparedField>}
 */
export const PREPARE_FIELD_FUNCTIONS = {
  object: prepareObjectField,
  keyvalue: prepareKeyValueField,
  code: prepareCodeField,
};

/**
 * Clear the constraint flags of an empty field, updating `validity` in place.
 * @param {EntryValidityState} validity Validity state to update.
 * @param {boolean} enforceRequired Whether an empty required field is marked as missing.
 */
export const relaxEmptyFieldValidity = (validity, enforceRequired) => {
  Object.assign(validity, {
    patternMismatch: false,
    tooShort: false,
    rangeUnderflow: false,
    typeMismatch: false,
  });

  // An Editorial Workflow draft that hasn’t been filled in yet can still be saved, so even a
  // required field left empty goes unmarked while the entry is in the drafting stage
  if (!enforceRequired) {
    validity.valueMissing = false;
  }
};
