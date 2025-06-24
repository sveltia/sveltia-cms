import { escapeRegExp } from '@sveltia/utils/string';
import { get } from 'svelte/store';
import { entryDraft } from '$lib/services/contents/draft';
import { getField, isFieldRequired } from '$lib/services/contents/entry/fields';
import { getPairs } from '$lib/services/contents/widgets/key-value/helper';
import { validateStringField } from '$lib/services/contents/widgets/string/helper';
import { getRegex } from '$lib/services/utils/misc';

/**
 * @import { Writable } from 'svelte/store';
 * @import { EntryDraft, EntryValidityState, FlattenedEntryContent } from '$lib/types/private';
 * @import {
 * CodeField,
 * ListField,
 * LocaleCode,
 * NumberField,
 * RelationField,
 * SelectField,
 * StringField,
 * TextField,
 * } from '$lib/types/public';
 */

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
 * @returns {EntryValidityState | undefined} Field validity.
 */
const validateField = ({ draft, locale, valueMap, keyPath, value }) => {
  const { collection, collectionName, collectionFile, files, validities, isIndexFile } = draft;

  const getFieldArgs = {
    collectionName,
    fileName: collectionFile?.name,
    valueMap,
    isIndexFile,
  };

  const fieldConfig = getField({ ...getFieldArgs, keyPath });

  if (!fieldConfig) {
    return undefined;
  }

  const { widget: widgetName = 'string', i18n = false, pattern: validation } = fieldConfig;
  const { i18nEnabled, defaultLocale } = (collectionFile ?? collection)._i18n;

  // Skip validation on non-editable fields
  if (
    locale !== defaultLocale &&
    (!i18nEnabled || i18n === false || i18n === 'none' || i18n === 'duplicate')
  ) {
    return undefined;
  }

  // Validate a list itself before the items
  if (/\.\d+$/.test(keyPath)) {
    const listKeyPath = keyPath.replace(/\.\d+$/, '');

    if (!(listKeyPath in validities[locale])) {
      validateField({ keyPath: listKeyPath, value: undefined, draft, locale, valueMap });
    }

    if (widgetName === 'list') {
      const { field, fields, types } = /** @type {ListField} */ (fieldConfig);

      if (!field && !fields && !types) {
        // Simple list field
        return undefined;
      }
    } else {
      // `select` or `relation` field with `multiple: true`, same as a simple list field
      return undefined;
    }
  }

  const valueEntries = Object.entries(valueMap);
  const required = isFieldRequired({ fieldConfig, locale });
  const { multiple = false } = /** @type {RelationField | SelectField} */ (fieldConfig);
  const isMultiSelection = ['select', 'relation'].includes(widgetName) && multiple;

  const { min, max } = /** @type {ListField | NumberField | RelationField | SelectField} */ (
    fieldConfig
  );

  /** @type {EntryValidityState} */
  const validity = {
    valueMissing: false,
    tooShort: false,
    tooLong: false,
    rangeUnderflow: false,
    rangeOverflow: false,
    patternMismatch: false,
    typeMismatch: false,
  };

  if (widgetName === 'list' || isMultiSelection) {
    // Given that values for an array field are flatten into `field.0`, `field.1` ... `field.N`,
    // we should validate only once against all these values
    if (keyPath in validities[locale]) {
      return undefined;
    }

    const keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`);

    const values =
      Array.isArray(value) && value.length
        ? value
        : (valueEntries
            .filter(([_keyPath]) => keyPathRegex.test(_keyPath))
            .map(([, savedValue]) => savedValue)
            .filter((val) => val !== undefined) ?? []);

    if (required && !values.length) {
      validity.valueMissing = true;
    } else if (typeof min === 'number' && values.length < min) {
      validity.rangeUnderflow = true;
    } else if (typeof max === 'number' && values.length > max) {
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
    const parentFieldConfig = getField({ ...getFieldArgs, keyPath: _keyPath });

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
    ['file', 'image'].includes(widgetName) &&
    typeof value === 'string' &&
    value.startsWith('blob:')
  ) {
    // The stored `value` is a blob URL; get the original file name
    value = files[value]?.file?.name;
  }

  if (
    !(['object', 'list', 'hidden', 'compute', 'keyvalue'].includes(widgetName) || isMultiSelection)
  ) {
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
 * Validate the current entry draft, update the validity for all the fields, and return the final
 * results as a boolean. Mimic the native `ValidityState` API.
 * @returns {boolean} Whether the draft is valid.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ValidityState
 */
export const validateEntry = () => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { currentValues, currentLocales, validities } = draft;
  let validated = true;

  Object.entries(currentValues).forEach(([locale, valueMap]) => {
    const valueEntries = Object.entries(valueMap);

    // If the locale is disabled, skip the validation and mark all fields valid
    if (!currentLocales[locale]) {
      validities[locale] = Object.fromEntries(
        valueEntries.map(([keyPath]) => [keyPath, { valid: true }]),
      );

      return;
    }

    // Reset the state first
    validities[locale] = {};

    valueEntries.forEach(([keyPath, value]) => {
      const validity = validateField({ draft, locale, valueMap, keyPath, value });

      if (validity) {
        validities[locale][keyPath] = validity;

        if (!validity.valid) {
          validated = false;
        }
      }
    });
  });

  /** @type {Writable<EntryDraft>} */ (entryDraft).update((_draft) => ({ ..._draft, validities }));

  return validated;
};
