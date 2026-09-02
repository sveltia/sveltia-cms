import { get } from 'svelte/store';

import { entryDraft } from '$lib/services/contents/draft';
import { validateCustomField } from '$lib/services/contents/draft/validate/custom-fields';
import { getFieldValidationMessages } from '$lib/services/contents/draft/validate/messages';
import { isRequiredEnforced } from '$lib/services/contents/draft/validate/required';
import {
  getField,
  getFieldKind,
  isFieldMultiple,
  isFieldRequired,
  LIST_KEY_PATH_REGEX,
} from '$lib/services/contents/entry/fields';
import { MEDIA_FIELD_TYPES, MIN_MAX_VALUE_FIELD_TYPES } from '$lib/services/contents/fields';
import { resolveCodeField } from '$lib/services/contents/fields/code/validate';
import { validateDateTimeField } from '$lib/services/contents/fields/date-time/validate';
import { validateKeyValueField } from '$lib/services/contents/fields/key-value/validate';
import { getListFieldInfo } from '$lib/services/contents/fields/list/helpers';
import { validateListField } from '$lib/services/contents/fields/list/validate';
import { validateNumberField } from '$lib/services/contents/fields/number/validate';
import { COMPONENT_NAME_PREFIX_REGEX } from '$lib/services/contents/fields/rich-text';
import { validateStringField } from '$lib/services/contents/fields/string/validate';
import { getRegex } from '$lib/services/utils/regex';

/**
 * @import {
 * DraftValueStoreKey,
 * EntryDraft,
 * EntryValidityState,
 * FlattenedEntryContent,
 * GetFieldArgs,
 * LocaleValidationMessagesMap,
 * LocaleValidityMap,
 * ValidateFieldFuncArgs,
 * } from '$lib/types/private';
 * @import {
 * CodeField,
 * Field,
 * FieldKeyPath,
 * ListField,
 * LocaleCode,
 * MinMaxValueField,
 * } from '$lib/types/public';
 */

/**
 * @typedef {object} ValidateFieldArgs
 * @property {EntryDraft} draft Entry draft.
 * @property {LocaleValidityMap} validities Validity state.
 * @property {LocaleCode} locale Current locale.
 * @property {FieldKeyPath} keyPath Field key path.
 * @property {FlattenedEntryContent} valueMap Entry values.
 * @property {any} value Field value.
 * @property {string} [componentName] Rich text editor component name.
 * @property {boolean} [enforceRequired] Whether an empty required field is marked as missing.
 */

/**
 * @typedef {object} ValidationResults
 * @property {boolean} valid Whether the entry draft is valid.
 * @property {LocaleValidityMap} validities Validity state for each field in each locale.
 * @property {LocaleValidationMessagesMap} validationMessages Validation messages for each field in
 * each locale.
 */

/**
 * Default validity state for a field.
 * @type {EntryValidityState}
 * @internal
 */
export const DEFAULT_VALIDITY = {
  valueMissing: false,
  tooShort: false,
  tooLong: false,
  rangeUnderflow: false,
  rangeOverflow: false,
  patternMismatch: false,
  typeMismatch: false,
  customError: false,
};

/**
 * Map of functions to validate different field types. Each function receives the field config and
 * the current value, and returns an object with the same properties as `EntryValidityState` except
 * `valid`.
 * @type {Record<string, (args: ValidateFieldFuncArgs) => { validity: EntryValidityState }>}
 * @internal
 */
export const VALIDATE_FIELD_FUNCTIONS = {
  datetime: validateDateTimeField,
  number: validateNumberField,
  string: validateStringField,
  text: validateStringField,
};

/**
 * Proxy handler for validity state. Exported for testing only.
 * @internal
 */
export const validityProxyHandler = {
  /**
   * Proxy getter.
   * @param {EntryValidityState} obj Object itself.
   * @param {string} prop Property name.
   * @returns {boolean | undefined} Property value.
   */
  get: (obj, prop) => (prop === 'valid' ? !Object.values(obj).some(Boolean) : obj[prop]),
};

/**
 * Validate a scalar field (all non-aggregate types), updating `validity` in place.
 * @param {object} args Arguments.
 * @param {any} args.value Current field value.
 * @param {boolean} args.required Whether the field is required.
 * @param {any} args.validation Pattern validation array or undefined.
 * @param {EntryValidityState} args.validity Validity state to update.
 * @returns {{ empty: boolean }} Whether the field holds no value at all.
 */
const validateScalarField = ({ value, required, validation, validity }) => {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  const empty = trimmed === undefined || trimmed === null || trimmed === '';

  if (required && empty) {
    validity.valueMissing = true;
  }

  if (Array.isArray(validation)) {
    const regex = getRegex(validation[0]);

    if (regex && !regex.test(String(trimmed))) {
      validity.patternMismatch = true;
    }
  }

  return { empty };
};

/**
 * Validate each field.
 * @internal
 * @param {ValidateFieldArgs} args Arguments.
 * @returns {EntryValidityState | undefined} Field validity.
 */
export const validateAnyField = (args) => {
  const { draft, locale, valueMap, componentName, validities, enforceRequired = true } = args;
  const { collection, collectionName, fileName, collectionFile, files, isIndexFile } = draft;
  let { keyPath, value } = args;

  /** @type {GetFieldArgs} */
  const getFieldArgs = {
    collectionName,
    fileName,
    componentName,
    valueMap,
    keyPath: keyPath.replace(COMPONENT_NAME_PREFIX_REGEX, ''), // Remove component name prefix
    isIndexFile,
  };

  const fieldConfig = getField({ ...getFieldArgs });

  if (!fieldConfig) {
    return undefined;
  }

  // @ts-ignore Some field types don’t have `pattern` property
  const { widget: fieldType = 'string', i18n = false, pattern: validation } = fieldConfig;

  const multiple =
    isFieldMultiple(fieldConfig) ||
    (getFieldKind(fieldConfig) === 'custom' && Array.isArray(value));

  const { min = 0, max = Infinity } = /** @type {MinMaxValueField} */ (
    MIN_MAX_VALUE_FIELD_TYPES.includes(fieldType) ? fieldConfig : {}
  );

  const { i18nEnabled, defaultLocale } = (collectionFile ?? collection)._i18n;

  // Skip validation on non-editable fields
  if (
    !componentName && // Don’t skip validation if the field is within a rich text editor component
    locale !== defaultLocale &&
    (!i18nEnabled || i18n === false || i18n === 'none' || i18n === 'duplicate')
  ) {
    return undefined;
  }

  const required = isFieldRequired({ fieldConfig, locale });
  /** @type {EntryValidityState} */
  const validity = { ...DEFAULT_VALIDITY };
  /** Whether the field holds no value at all, which each widget decides its own way. */
  let empty = false;

  if (fieldType === 'list' || multiple) {
    const { skip, empty: listEmpty } = validateListField({
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

    if (skip) return undefined;

    empty = !!listEmpty;
  }

  if (fieldType === 'object') {
    empty = !value;

    if (required && empty) {
      validity.valueMissing = true;
    }
  }

  if (fieldType === 'keyvalue') {
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

    if (result.skip) return undefined;

    keyPath = result.keyPath;
    empty = !!result.empty;
  }

  if (fieldType === 'code') {
    const result = resolveCodeField({
      keyPath,
      value,
      valueMap,
      fieldConfig: /** @type {CodeField} */ (fieldConfig),
      validities,
      locale,
    });

    if (result.skip) return undefined;
    keyPath = result.keyPath;
    value = result.value;
  }

  if (
    MEDIA_FIELD_TYPES.includes(fieldType) &&
    typeof value === 'string' &&
    value.startsWith('blob:')
  ) {
    // The stored `value` is a blob URL; get the original file name
    value = files[value]?.file?.name;
  }

  if (!(['object', 'list', 'hidden', 'compute', 'keyvalue'].includes(fieldType) || multiple)) {
    ({ empty } = validateScalarField({ value, required, validation, validity }));
  }

  const validateFieldFn = VALIDATE_FIELD_FUNCTIONS[fieldType];

  if (validateFieldFn) {
    Object.assign(validity, validateFieldFn({ fieldConfig, locale, value }).validity);
  }

  // Validate custom field if applicable (uses cached result)
  validateCustomField({ locale, keyPath, validity });

  // The remaining rules all describe a value, and an empty field has none: a pattern can’t be
  // matched by something that isn’t there, nothing is long enough to clear a minimum length, an
  // empty list is under any minimum item count, and a Number field with no number in it reports a
  // type mismatch. Whether the field is required is the only thing left worth saying about it,
  // which is what makes `required: false` mean anything for a field that also carries constraints.
  // `tooLong` and `rangeOverflow` are left alone — an empty field can’t trigger them — and
  // `customError` is a custom field component’s own call to make
  if (empty) {
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
  }

  return new Proxy(validity, validityProxyHandler);
};

/**
 * Validate a single field and update the validity state.
 * @internal
 * @param {ValidateFieldArgs} args Arguments.
 * @returns {boolean} Whether the field is valid.
 */
export const validateField = (args) => {
  const { validities, locale, keyPath } = args;
  const validity = validateAnyField(args);
  let valid = true;

  if (validity) {
    validities[locale][keyPath] = validity;

    if (!validity.valid) {
      valid = false;
    }
  }

  return valid;
};

/**
 * Re-validate a single field right after its value has been updated, so the error state and message
 * shown for the field reflect what the user has just typed. This is a no-op until the entry has
 * been validated once, which normally happens on a save attempt, because no error is displayed
 * before that.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft, modified in place.
 * @param {LocaleCode} args.locale Locale of the updated field.
 * @param {FieldKeyPath} args.keyPath Key path of the updated field.
 * @param {any} args.value Updated field value.
 * @param {FlattenedEntryContent} args.valueMap Entry values for the locale.
 */
export const revalidateField = ({ draft, locale, keyPath, value, valueMap }) => {
  const { collectionName, fileName, isIndexFile, validities, validationMessages } = draft;

  // Nothing is shown for the field yet, so there is nothing to update
  if (!validities?.[locale]?.[keyPath]) {
    return;
  }

  const validity = validateAnyField({
    draft,
    locale,
    keyPath,
    value,
    valueMap,
    // Match the last full validation, so a field the save deliberately left unmarked isn’t reported
    // as missing the moment the user types in it
    enforceRequired: isRequiredEnforced(draft),
    // The List, KeyValue and Code field validators skip a field that already has a validity state,
    // which is how {@link validateFields} validates such a field only once instead of once per
    // flattened key path. Here a single field is validated on its own, so hide the state from them
    validities: { [locale]: {} },
  });

  if (!validity) {
    return;
  }

  validities[locale][keyPath] = validity;

  // The field is known to be configured, as `validateAnyField` bails out otherwise
  const fieldConfig = /** @type {Field} */ (
    getField({ collectionName, fileName, isIndexFile, keyPath, valueMap })
  );

  validationMessages[locale][keyPath] = getFieldValidationMessages({ validity, fieldConfig });
};

/**
 * Validate an array-type field.
 * @internal
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {ValidateFieldArgs} args.validateArgs Arguments for field validation.
 * @returns {{ valid: boolean, validateItems: boolean }} Validation result.
 */
export const validateList = ({ fieldConfig, validateArgs }) => {
  const { validities, locale, keyPath } = validateArgs;
  const valid = validities[locale][keyPath]?.valid ?? validateField(validateArgs);
  const { widget: fieldType = 'string' } = fieldConfig;

  if (fieldType === 'list') {
    if (!getListFieldInfo(/** @type {ListField} */ (fieldConfig)).hasSubFields) {
      // Simple list field, so we don’t need to validate items
      return { valid, validateItems: false };
    }
  }

  if (isFieldMultiple(fieldConfig)) {
    // Same as a simple list field, so we don’t need to validate items
    return { valid, validateItems: false };
  }

  return { valid, validateItems: true };
};

/**
 * Validate the field values and return the results. Mimic the native `ValidityState` API.
 * @param {DraftValueStoreKey} valueStoreKey Key to store the values in {@link EntryDraft}.
 * @param {object} [options] Options.
 * @param {boolean} [options.enforceRequired] Whether an empty required field is an error. When
 * `false`, such a field is left unmarked, so nothing is shown for it in the editor either.
 * @param {EntryDraft} [options.draft] Draft to validate. Defaults to the one open in the editor.
 * @returns {ValidationResults} Validation results.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ValidityState
 */
export const validateFields = (valueStoreKey, options = {}) => {
  const { enforceRequired = true, draft = /** @type {EntryDraft} */ (get(entryDraft)) } = options;
  const { collectionName, fileName, isIndexFile, currentLocales } = draft;
  /** @type {LocaleValidityMap} */
  const validities = {};
  /** @type {LocaleValidationMessagesMap} */
  const validationMessages = {};
  /** @type {GetFieldArgs} */
  const getFieldArgs = { collectionName, fileName, isIndexFile, keyPath: '', valueMap: {} };
  let valid = true;

  Object.entries(draft[valueStoreKey]).forEach(([locale, valueMap]) => {
    const valueEntries = Object.entries(valueMap);

    // If the locale is disabled, skip the validation and mark all fields valid
    if (!currentLocales[locale]) {
      validities[locale] = Object.fromEntries(
        valueEntries.map(([keyPath]) => [keyPath, { valid: true }]),
      );
      validationMessages[locale] = Object.fromEntries(
        valueEntries.map(([keyPath]) => [keyPath, []]),
      );

      return;
    }

    const validateArgs = { draft, locale, valueMap, validities, enforceRequired };

    // Reset the state first
    validities[locale] = {};
    validationMessages[locale] = {};

    valueEntries.forEach(([keyPath, value]) => {
      const [prefix] = keyPath.match(COMPONENT_NAME_PREFIX_REGEX) ?? [];
      const componentName = prefix ? valueMap[`${prefix}__sc_component_name`] : undefined;

      const fieldConfig = getField({
        ...getFieldArgs,
        keyPath: keyPath.replace(COMPONENT_NAME_PREFIX_REGEX, ''), // Remove component name prefix
        valueMap,
        componentName,
      });

      if (!fieldConfig) {
        return;
      }

      // Skip unsupported field types: not built-in or custom
      if (getFieldKind(fieldConfig) === 'unknown') {
        return;
      }

      // Validate a list itself before the items
      if (LIST_KEY_PATH_REGEX.test(keyPath)) {
        const listKeyPath = keyPath.replace(LIST_KEY_PATH_REGEX, '');

        const { valid: listValid, validateItems } = validateList({
          fieldConfig,
          validateArgs: {
            ...validateArgs,
            keyPath: listKeyPath,
            value: '',
            componentName,
          },
        });

        if (!listValid) {
          valid = false;
        }

        // Compute messages for the list field itself (only on first item iteration)
        if (!(listKeyPath in validationMessages[locale])) {
          const listValidity = validities[locale][listKeyPath];

          if (listValidity) {
            validationMessages[locale][listKeyPath] = getFieldValidationMessages({
              validity: listValidity,
              fieldConfig,
            });
          }
        }

        if (!validateItems) {
          return;
        }
      }

      if (!validateField({ ...validateArgs, keyPath, value, componentName })) {
        valid = false;
      }

      const validity = validities[locale][keyPath];

      if (validity) {
        validationMessages[locale][keyPath] = getFieldValidationMessages({ validity, fieldConfig });
      }
    });
  });

  return { valid, validities, validationMessages };
};
