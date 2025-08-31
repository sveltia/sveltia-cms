import { escapeRegExp } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { entryDraft } from '$lib/services/contents/draft';
import { getField, isFieldRequired } from '$lib/services/contents/entry/fields';
import {
  MEDIA_WIDGETS,
  MIN_MAX_VALUE_WIDGETS,
  MULTI_VALUE_WIDGETS,
} from '$lib/services/contents/widgets';
import { getPairs } from '$lib/services/contents/widgets/key-value/helper';
import { getListFieldInfo } from '$lib/services/contents/widgets/list/helper';
import { COMPONENT_NAME_PREFIX_REGEX } from '$lib/services/contents/widgets/markdown';
import { validateStringField } from '$lib/services/contents/widgets/string/validate';
import { getRegex } from '$lib/services/utils/misc';

/**
 * @import { Writable } from 'svelte/store';
 * @import {
 * DraftValueStoreKey,
 * EntryDraft,
 * EntryValidityState,
 * FlattenedEntryContent,
 * GetFieldArgs,
 * LocaleValidityMap,
 * } from '$lib/types/private';
 * @import {
 * CodeField,
 * Field,
 * ListField,
 * LocaleCode,
 * MinMaxValueField,
 * MultiValueField,
 * NumberField,
 * StringField,
 * TextField,
 * } from '$lib/types/public';
 */

/**
 * @typedef {object} ValidateFieldArgs
 * @property {EntryDraft} draft Entry draft.
 * @property {LocaleValidityMap} validities Validity state.
 * @property {LocaleCode} locale Current locale.
 * @property {string} keyPath Field key path.
 * @property {FlattenedEntryContent} valueMap Entry values.
 * @property {any} value Field value.
 * @property {string} [componentName] Markdown editor component name.
 */

/**
 * Regular expression to match the list key path, e.g. `field.0`, `field.1`, etc.
 * @type {RegExp}
 */
const LIST_KEY_PATH_REGEX = /\.\d+$/;

/**
 * Default validity state for a field.
 * @type {EntryValidityState}
 */
const DEFAULT_VALIDITY = {
  valueMissing: false,
  tooShort: false,
  tooLong: false,
  rangeUnderflow: false,
  rangeOverflow: false,
  patternMismatch: false,
  typeMismatch: false,
};

const validityProxyHandler = {
  /**
   * Proxy getter.
   * @param {EntryValidityState} obj Object itself.
   * @param {string} prop Property name.
   * @returns {boolean | undefined} Property value.
   */
  get: (obj, prop) => (prop === 'valid' ? !Object.values(obj).some(Boolean) : obj[prop]),
};

/**
 * Validate each field.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {LocaleCode} args.locale Current locale.
 * @param {FlattenedEntryContent} args.valueMap Entry values.
 * @param {string} args.keyPath Field key path.
 * @param {any} args.value Field value.
 * @param {string} [args.componentName] Markdown editor component name.
 * @returns {EntryValidityState | undefined} Field validity.
 * @todo Refactor this function to reduce complexity and improve readability.
 */
const validateAnyField = ({ draft, locale, valueMap, keyPath, value, componentName }) => {
  const { collection, collectionName, fileName, collectionFile, files, validities, isIndexFile } =
    draft;

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

  const { widget: widgetName = 'string', i18n = false, pattern: validation } = fieldConfig;

  const { multiple = false } = /** @type {MultiValueField} */ (
    MULTI_VALUE_WIDGETS.includes(widgetName) ? fieldConfig : {}
  );

  const { min = 0, max = Infinity } = /** @type {MinMaxValueField} */ (
    MIN_MAX_VALUE_WIDGETS.includes(widgetName) ? fieldConfig : {}
  );

  const { i18nEnabled, defaultLocale } = (collectionFile ?? collection)._i18n;

  // Skip validation on non-editable fields
  if (
    !componentName && // Don’t skip validation if the field is within a Markdown editor component
    locale !== defaultLocale &&
    (!i18nEnabled || i18n === false || i18n === 'none' || i18n === 'duplicate')
  ) {
    return undefined;
  }

  const valueEntries = Object.entries(valueMap);
  const required = isFieldRequired({ fieldConfig, locale });
  /** @type {EntryValidityState} */
  const validity = { ...DEFAULT_VALIDITY };

  if (widgetName === 'list' || multiple) {
    // Given that values for an array field are flatten into `field.0`, `field.1` ... `field.N`,
    // we should validate only once against all these values
    if (keyPath in validities[locale]) {
      return undefined;
    }

    const keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+`);

    // We need to check both the list itself and the items in the list because the list can be empty
    // but still have items in the list, depending on the flattening condition. It means the data
    // usually looks like `{ field.0: 'foo', field.1: 'bar' }`, but it can contain an empty list
    // like `{ field: [], field.0: 'foo', field.1: 'bar' }` in some cases. Or it can be a simple
    // list field like `{ field: ['foo', 'bar'] }` without the subfields.
    const size =
      Array.isArray(value) && !!value.length
        ? value.length
        : new Set(valueEntries.map(([key]) => key.match(keyPathRegex)?.[0]).filter(Boolean)).size;

    if (required && !size) {
      validity.valueMissing = true;
    } else if (typeof min === 'number' && size < min) {
      validity.rangeUnderflow = true;
    } else if (typeof max === 'number' && size > max) {
      validity.rangeOverflow = true;
    }
  }

  if (widgetName === 'object') {
    if (required && !value) {
      validity.valueMissing = true;
    }
  }

  if (widgetName === 'keyvalue') {
    // Given that values for a KeyValue field are flatten into `field.key1`, `field.key2` ...
    // `field.keyN`, we should validate only once against all these values. The key can be
    // empty, so use `.*` in the regex instead of `.+`
    const _keyPath = /** @type {string} */ (keyPath.match(/(.+?)(?:\.[^.]*)?$/)?.[1]);

    const parentFieldConfig = getField({
      ...getFieldArgs,
      keyPath: _keyPath.replace(COMPONENT_NAME_PREFIX_REGEX, ''), // Remove component name prefix
    });

    if (_keyPath in validities[locale] || parentFieldConfig?.widget !== 'keyvalue') {
      return undefined;
    }

    keyPath = _keyPath;

    const _entryDraft = /** @type {Writable<EntryDraft>} */ (entryDraft);
    const pairs = getPairs({ entryDraft: _entryDraft, keyPath: _keyPath, locale });

    if (required && !pairs.length) {
      validity.valueMissing = true;
    } else if (typeof min === 'number' && pairs.length < min) {
      validity.rangeUnderflow = true;
    } else if (typeof max === 'number' && pairs.length > max) {
      validity.rangeOverflow = true;
    }
  }

  if (widgetName === 'code') {
    const {
      output_code_only: outputCodeOnly = false,
      keys: outputKeys = { code: 'code', lang: 'lang' },
    } = /** @type {CodeField} */ (fieldConfig);

    const _keyPath = keyPath.match(`(.+)\\.(?:${outputKeys.code}|${outputKeys.lang})$`)?.[1] ?? '';

    if (_keyPath) {
      keyPath = _keyPath;
    }

    if (keyPath in validities[locale]) {
      return undefined;
    }

    if (!outputCodeOnly) {
      value = valueMap[`${keyPath}.${outputKeys.code}`];
    }
  }

  if (
    MEDIA_WIDGETS.includes(widgetName) &&
    typeof value === 'string' &&
    value.startsWith('blob:')
  ) {
    // The stored `value` is a blob URL; get the original file name
    value = files[value]?.file?.name;
  }

  if (!(['object', 'list', 'hidden', 'compute', 'keyvalue'].includes(widgetName) || multiple)) {
    if (typeof value === 'string') {
      value = value.trim();
    }

    if (
      required &&
      (value === undefined || value === null || value === '' || (multiple && !value.length))
    ) {
      validity.valueMissing = true;
    }

    if (Array.isArray(validation)) {
      const regex = getRegex(validation[0]);

      if (regex && !regex.test(String(value))) {
        validity.patternMismatch = true;
      }
    }
  }

  // Check the number of characters
  if (['string', 'text'].includes(widgetName)) {
    const result = validateStringField({
      // eslint-disable-next-line object-shorthand
      fieldConfig: /** @type {StringField | TextField} */ (fieldConfig),
      value,
    });

    validity.tooShort = result.tooShort;
    validity.tooLong = result.tooLong;
  }

  // Check the URL or email with native form validation
  if (widgetName === 'string' && value) {
    const { type = 'text' } = /** @type {StringField} */ (fieldConfig);

    if (type !== 'text') {
      const inputElement = Object.assign(document.createElement('input'), { type, value });

      validity.typeMismatch = inputElement.validity.typeMismatch;
    }

    // Check if the email’s domain part contains a dot, because native validation marks
    // `me@example` valid but it’s not valid in the real world
    if (type === 'email' && !validity.typeMismatch && !value.split('@')[1]?.includes('.')) {
      validity.typeMismatch = true;
    }
  }

  if (widgetName === 'number') {
    const { value_type: valueType = 'int' } = /** @type {NumberField} */ (fieldConfig);

    if (typeof min === 'number' && value !== null && Number(value) < min) {
      validity.rangeUnderflow = true;
    } else if (typeof max === 'number' && value !== null && Number(value) > max) {
      validity.rangeOverflow = true;
    }

    if (valueType === 'int' || valueType === 'float') {
      if (required && value === null) {
        validity.typeMismatch = true;
      }
    }
  }

  return new Proxy(validity, validityProxyHandler);
};

/**
 * Validate a single field and update the validity state.
 * @param {ValidateFieldArgs} args Arguments.
 * @returns {boolean} Whether the field is valid.
 */
const validateField = (args) => {
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
 * Validate an array-type field.
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {ValidateFieldArgs} args.validateArgs Arguments for field validation.
 * @returns {{ valid: boolean, validateItems: boolean }} Validation result.
 */
const validateList = ({ fieldConfig, validateArgs }) => {
  const { validities, locale, keyPath } = validateArgs;
  let valid = true;

  if (!(keyPath in validities[locale])) {
    valid = validateField(validateArgs);
  }

  const { widget: widgetName = 'string' } = fieldConfig;

  if (widgetName === 'list') {
    if (!getListFieldInfo(/** @type {ListField} */ (fieldConfig)).hasSubFields) {
      // Simple list field, so we don’t need to validate items
      return { valid, validateItems: false };
    }
  }

  const { multiple = false } = /** @type {MultiValueField} */ (
    MULTI_VALUE_WIDGETS.includes(widgetName) ? fieldConfig : {}
  );

  if (multiple) {
    // Same as a simple list field, so we don’t need to validate items
    return { valid, validateItems: false };
  }

  return { valid, validateItems: true };
};

/**
 * Validate the field values and return the results. Mimic the native `ValidityState` API.
 * @param {DraftValueStoreKey} valueStoreKey Key to store the values in {@link EntryDraft}.
 * @returns {{ valid: boolean, validities: LocaleValidityMap }} Validation results.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ValidityState
 */
export const validateFields = (valueStoreKey) => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { collectionName, fileName, isIndexFile, currentLocales } = draft;
  /** @type {LocaleValidityMap} */
  const validities = {};
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

      return;
    }

    const validateArgs = { draft, locale, valueMap, validities };

    // Reset the state first
    validities[locale] = {};

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

      // Validate a list itself before the items
      if (LIST_KEY_PATH_REGEX.test(keyPath)) {
        const { valid: listValid, validateItems } = validateList({
          fieldConfig,
          validateArgs: {
            ...validateArgs,
            keyPath: keyPath.replace(LIST_KEY_PATH_REGEX, ''),
            value: '',
            componentName,
          },
        });

        if (!listValid) {
          valid = false;
        }

        if (!validateItems) {
          return;
        }
      }

      if (!validateField({ ...validateArgs, keyPath, value, componentName })) {
        valid = false;
      }
    });
  });

  return { valid, validities };
};

/**
 * Validate the slugs and return the results. At this time, we only check if the slug is empty
 * when the slug editor is shown. A pattern check can be added later if needed.
 * @returns {{ valid: boolean, validities: LocaleValidityMap }} Validation results.
 */
const validateSlugs = () => {
  const { currentSlugs, slugEditor } = /** @type {EntryDraft} */ (get(entryDraft));
  /** @type {LocaleValidityMap} */
  const validities = {};
  let valid = true;

  Object.entries(currentSlugs).forEach(([locale, slug]) => {
    const valueMissing = !!slugEditor[locale] && !slug?.trim();

    if (valueMissing) {
      valid = false;
    }

    validities[locale] = { _slug: { valueMissing, valid: !valueMissing } };
  });

  return { valid, validities };
};

/**
 * Validate the field values, update the validity for all the fields, and return the final results
 * as a boolean.
 * @returns {boolean} Whether the entry draft is valid.
 */
export const validateEntry = () => {
  const { valid: currentValuesValid, validities: currentValuesValidities } =
    validateFields('currentValues');

  const { valid: extraValuesValid, validities: extraValuesValidities } =
    validateFields('extraValues');

  const { valid: slugsValid, validities: slugsValidities } = validateSlugs();

  /** @type {Writable<EntryDraft>} */ (entryDraft).update((_draft) => ({
    ..._draft,
    validities: Object.fromEntries(
      Object.keys(currentValuesValidities).map((locale) => [
        locale,
        {
          ...currentValuesValidities[locale],
          ...extraValuesValidities[locale],
          ...slugsValidities[locale],
        },
      ]),
    ),
  }));

  return currentValuesValid && extraValuesValid && slugsValid;
};
