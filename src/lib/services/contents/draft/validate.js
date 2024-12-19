import { escapeRegExp } from '@sveltia/utils/string';
import { get } from 'svelte/store';
import { entryDraft } from '$lib/services/contents/draft';
import { getFieldConfig } from '$lib/services/contents/entry/fields';
import { validateStringField } from '$lib/services/contents/widgets/string/helper';

// cspell:disable-next-line
const fullRegexPattern = /^\/?(?<pattern>.+?)(?:\/(?<flags>[dgimsuvy]*))?$/;

/**
 * Validate the current entry draft, update the validity for all the fields, and return the final
 * results as a boolean. Mimic the native `ValidityState` API.
 * @returns {boolean} Whether the draft is valid.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ValidityState
 * @todo Rewrite this to better support list and object fields.
 */
export const validateEntry = () => {
  const { collection, collectionFile, fileName, currentLocales, currentValues, validities } =
    /** @type {EntryDraft} */ (get(entryDraft));

  const { i18nEnabled, defaultLocale } = (collectionFile ?? collection)._i18n;
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

    /**
     * Validate each field.
     * @param {string} keyPath - Field key path.
     * @param {any} value - Field value.
     */
    const validateField = (keyPath, value) => {
      const fieldConfig = getFieldConfig({
        collectionName: collection.name,
        fileName,
        valueMap,
        keyPath,
      });

      if (!fieldConfig) {
        return;
      }

      const {
        widget: widgetName = 'string',
        required = true,
        i18n = false,
        pattern: validation,
      } = fieldConfig;

      // Skip validation on non-editable fields
      if (locale !== defaultLocale && (!i18nEnabled || i18n === false || i18n === 'duplicate')) {
        return;
      }

      // Validate a list itself before the items
      if (!['select', 'relation'].includes(widgetName) && /\.\d+$/.test(keyPath)) {
        const listKeyPath = keyPath.replace(/\.\d+$/, '');

        if (!(listKeyPath in validities[locale])) {
          validateField(listKeyPath, undefined);
        }

        if (widgetName === 'list') {
          const { field, fields, types } = /** @type {ListField} */ (fieldConfig);

          if (!field && !fields && !types) {
            // Simple list field
            return;
          }
        }
      }

      const { multiple = false } = /** @type {RelationField | SelectField} */ (fieldConfig);

      const { min, max } = /** @type {ListField | NumberField | RelationField | SelectField} */ (
        fieldConfig
      );

      let valueMissing = false;
      let tooShort = false;
      let tooLong = false;
      let rangeUnderflow = false;
      let rangeOverflow = false;
      let patternMismatch = false;
      let typeMismatch = false;

      if (widgetName === 'list') {
        // Given that values for an array field are flatten into `field.0`, `field.1` ... `field.n`,
        // we should validate only once against all these values
        if (keyPath in validities[locale]) {
          return;
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
          valueMissing = true;
        } else if (typeof min === 'number' && values.length < min) {
          rangeUnderflow = true;
        } else if (typeof max === 'number' && values.length > max) {
          rangeOverflow = true;
        }
      }

      if (widgetName === 'object') {
        if (required && !value) {
          valueMissing = true;
        }
      }

      if (!['object', 'list', 'hidden', 'compute'].includes(widgetName)) {
        if (typeof value === 'string') {
          value = value.trim();
        }

        if (required && (value === undefined || value === '' || (multiple && !value.length))) {
          valueMissing = true;
        }

        if (Array.isArray(validation) && typeof validation[0] === 'string') {
          // Parse the regex to support simple pattern, e.g `.{12,}`, and complete expression, e.g.
          // `/^.{0,280}$/s`
          const { pattern, flags } = validation[0].match(fullRegexPattern)?.groups ?? {};
          const regex = new RegExp(pattern, flags);

          if (pattern && !regex.test(String(value))) {
            patternMismatch = true;
          }
        }

        // Check the number of characters
        if (['string', 'text'].includes(widgetName)) {
          ({ tooShort, tooLong } = validateStringField(
            /** @type {StringField | TextField} */ (fieldConfig),
            value,
          ));
        }

        // Check the URL or email with native form validation
        if (widgetName === 'string' && value) {
          const { type = 'text' } = /** @type {StringField} */ (fieldConfig);

          if (type !== 'text') {
            const inputElement = document.createElement('input');

            inputElement.type = type;
            inputElement.value = value;
            ({ typeMismatch } = inputElement.validity);
          }

          // Check if the email’s domain part contains a dot, because native validation marks
          // `me@example` valid but it’s not valid in the real world
          if (type === 'email' && !typeMismatch && !value.split('@')[1]?.includes('.')) {
            typeMismatch = true;
          }
        }
      }

      const validity = new Proxy(
        {
          valueMissing,
          tooShort,
          tooLong,
          rangeUnderflow,
          rangeOverflow,
          patternMismatch,
          typeMismatch,
        },
        {
          /**
           * Getter.
           * @param {Record<string, boolean>} obj - Object itself.
           * @param {string} prop - Property name.
           * @returns {boolean | undefined} Property value.
           */
          get: (obj, prop) => (prop === 'valid' ? !Object.values(obj).some(Boolean) : obj[prop]),
        },
      );

      validities[locale][keyPath] = validity;

      if (!validity.valid) {
        validated = false;
      }
    };

    valueEntries.forEach(([keyPath, value]) => {
      validateField(keyPath, value);
    });
  });

  /** @type {import('svelte/store').Writable<EntryDraft>} */ (entryDraft).update((_draft) => ({
    ..._draft,
    validities,
  }));

  return validated;
};
