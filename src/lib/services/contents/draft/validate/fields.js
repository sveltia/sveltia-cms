import { validateCustomField } from '$lib/services/contents/draft/validate/custom-fields';
import { getFieldValidationMessages } from '$lib/services/contents/draft/validate/messages';
import {
  PREPARE_FIELD_FUNCTIONS,
  prepareListField,
  relaxEmptyFieldValidity,
  resolveMediaValue,
} from '$lib/services/contents/draft/validate/prepare';
import { isRequiredEnforced } from '$lib/services/contents/draft/validate/required';
import {
  VALIDATE_FIELD_FUNCTIONS,
  validateScalarField,
} from '$lib/services/contents/draft/validate/scalar';
import { DEFAULT_VALIDITY, finalizeValidity } from '$lib/services/contents/draft/validate/validity';
import {
  getField,
  getFieldKind,
  isFieldMultiple,
  isFieldRequired,
  LIST_KEY_PATH_REGEX,
} from '$lib/services/contents/entry/fields';
import { MIN_MAX_VALUE_FIELD_TYPES } from '$lib/services/contents/fields';
import { getCodeField } from '$lib/services/contents/fields/code/validate';
import { isAutoNowField } from '$lib/services/contents/fields/date-time/auto-now';
import {
  getKeyValueField,
  PAIR_KEY_PATH_REGEX,
} from '$lib/services/contents/fields/key-value/pairs';
import { getListFieldInfo } from '$lib/services/contents/fields/list/helpers';
import { COMPONENT_NAME_PREFIX_REGEX } from '$lib/services/contents/fields/rich-text';
import { isOptionValue } from '$lib/services/contents/fields/select/helpers';
import { isFieldI18nDisabled } from '$lib/services/contents/i18n/fields';

/**
 * @import {
 * DraftValueStoreKey,
 * EntryDraft,
 * EntryValidityState,
 * FlattenedEntryContent,
 * GetFieldArgs,
 * LocaleValidationMessagesMap,
 * LocaleValidityMap,
 * } from '$lib/types/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * ListField,
 * LocaleCode,
 * MinMaxValueField,
 * SelectField,
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
 * Regular expression matching the item index of a List field within a key path when a subfield
 * follows, e.g. `.0` in `speakers.0.name`. What comes before the match is the list’s key path.
 */
const LIST_ITEM_SUBFIELD_REGEX = /\.\d+(?=\.)/g;
/**
 * Regular expression matching the item index of a List field within a key path, whether a subfield
 * follows or not, e.g. `.0` in `speakers.0.name` and `.3` in `tags.3`. What comes before the match
 * is the list’s key path.
 */
const LIST_ITEM_INDEX_REGEX = /\.\d+(?=\.|$)/g;

/**
 * Validate each field.
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

  const fieldConfig =
    getField({ ...getFieldArgs }) ??
    // A KeyValue pair is stored under an arbitrary key, e.g. `metadata.color`, that `getField()`
    // can’t resolve. Without this, a KeyValue field holding pairs would never be validated, so its
    // `min` and `max` options wouldn’t be checked, and a required one holding only a blank pair
    // would pass
    getKeyValueField({ ...getFieldArgs });

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
    (!i18nEnabled || isFieldI18nDisabled(i18n) || i18n === 'duplicate')
  ) {
    return undefined;
  }

  // A DateTime field set automatically on save can’t be edited, and may be empty until then. The
  // option is ignored in a rich text editor component, whose values aren’t set on save
  if (!componentName && isAutoNowField(fieldConfig)) {
    return undefined;
  }

  const required = isFieldRequired({ fieldConfig, locale });
  /** @type {EntryValidityState} */
  const validity = { ...DEFAULT_VALIDITY };
  /** Whether the field holds no value at all, which each widget decides its own way. */
  let empty = false;

  const prepareField =
    fieldType === 'list' || multiple ? prepareListField : PREPARE_FIELD_FUNCTIONS[fieldType];

  if (prepareField) {
    const result = prepareField({
      keyPath,
      value,
      valueMap,
      fieldConfig,
      getFieldArgs,
      files,
      validity,
      validities,
      locale,
      required,
      min,
      max,
    });

    if (result.skip) return undefined;

    ({ keyPath, value, empty } = result);
  }

  value = resolveMediaValue({ fieldType, value, files });

  if (!(['object', 'list', 'hidden', 'compute', 'keyvalue'].includes(fieldType) || multiple)) {
    const selected =
      fieldType === 'select' &&
      isOptionValue({ fieldConfig: /** @type {SelectField} */ (fieldConfig), value });

    ({ empty } = validateScalarField({ value, required, validation, validity, selected }));
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
    relaxEmptyFieldValidity(validity, enforceRequired);
  }

  return finalizeValidity(validity);
};

/**
 * Validate a single field and update the validity state.
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
 * Re-validate a single field, if it has been validated already, and update its validity state and
 * validation messages.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft, modified in place.
 * @param {LocaleCode} args.locale Locale of the field.
 * @param {FieldKeyPath} args.keyPath Key path of the field.
 * @param {any} args.value Field value.
 * @param {FlattenedEntryContent} args.valueMap Entry values for the locale.
 */
const revalidateSingleField = ({ draft, locale, keyPath, value, valueMap }) => {
  const { collectionName, fileName, isIndexFile, validities, validationMessages } = draft;
  const getFieldArgs = { collectionName, fileName, isIndexFile, keyPath, valueMap };
  // A KeyValue pair is validated as part of its field, whose state is kept under the field’s own
  // key path, where the editor shows it. See `validateFields()`
  const keyValueField = getField(getFieldArgs) ? undefined : getKeyValueField(getFieldArgs);
  const stateKeyPath = keyValueField ? keyPath.replace(PAIR_KEY_PATH_REGEX, '') : keyPath;

  // Nothing is shown for the field yet, so there is nothing to update
  if (!validities?.[locale]?.[stateKeyPath]) {
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

  validities[locale][stateKeyPath] = validity;

  // The field is known to be configured, as `validateAnyField` bails out otherwise
  const fieldConfig = /** @type {Field} */ (keyValueField ?? getField(getFieldArgs));

  validationMessages[locale][stateKeyPath] = getFieldValidationMessages({ validity, fieldConfig });
};

/**
 * Re-validate a single field right after its value has been updated or deleted, so the error state
 * and message shown for the field reflect what the user has just done. The List fields the value is
 * an item of, or is in an item of, are re-validated as well, since their item count may have
 * changed, e.g. `tags` for `tags.3` and `speakers` for `speakers.0.name`. This is a no-op until the
 * entry has been validated once, which normally happens on a save attempt, because no error is
 * displayed before that.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft, modified in place.
 * @param {LocaleCode} args.locale Locale of the updated field.
 * @param {FieldKeyPath} args.keyPath Key path of the updated field.
 * @param {any} args.value Updated field value, or `undefined` if the value has been deleted.
 * @param {FlattenedEntryContent} args.valueMap Entry values for the locale.
 */
export const revalidateField = ({ draft, locale, keyPath, value, valueMap }) => {
  const { collectionName, fileName, isIndexFile } = draft;

  revalidateSingleField({ draft, locale, keyPath, value, valueMap });

  [...keyPath.matchAll(LIST_ITEM_INDEX_REGEX)].forEach(({ index }) => {
    const listKeyPath = keyPath.slice(0, index);
    const getFieldArgs = { collectionName, fileName, isIndexFile, keyPath: listKeyPath, valueMap };
    const listFieldConfig = getField(getFieldArgs);

    // A multiple-value Select or Relation field stores its values like a List field without
    // subfields, e.g. `categories.0`, and keeps its validity state under its own key path
    if (
      listFieldConfig &&
      (listFieldConfig.widget === 'list' || isFieldMultiple(listFieldConfig))
    ) {
      revalidateSingleField({
        draft,
        locale,
        keyPath: listKeyPath,
        value: valueMap[listKeyPath],
        valueMap,
      });
    }
  });
};

/**
 * Validate an array-type field.
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
 * @param {object} options Options.
 * @param {EntryDraft} options.draft Draft to validate.
 * @param {boolean} [options.enforceRequired] Whether an empty required field is an error. When
 * `false`, such a field is left unmarked, so nothing is shown for it in the editor either.
 * @returns {ValidationResults} Validation results.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ValidityState
 */
export const validateFields = (valueStoreKey, { draft, enforceRequired = true }) => {
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

      // A value left behind by a rich text editor component that has since been removed has
      // nothing to be validated against. Without the component name, its field would be looked up
      // among the entry’s own fields instead, e.g. an image’s `title` as the entry title, and fail
      // validation with no field to show the error in
      if (prefix && !componentName) {
        return;
      }

      /**
       * Get the configuration of a field in the value map.
       * @param {FieldKeyPath} _keyPath Key path, which may have a component name prefix.
       * @returns {Field | undefined} Field configuration.
       */
      const getConfig = (_keyPath) =>
        getField({
          ...getFieldArgs,
          keyPath: _keyPath.replace(COMPONENT_NAME_PREFIX_REGEX, ''), // Remove component name prefix
          valueMap,
          componentName,
        });

      /**
       * Validate a List field itself, e.g. its item count, and compute its messages. The list is
       * validated only once, however many of its items are in the value map.
       * @param {object} args Arguments.
       * @param {FieldKeyPath} args.listKeyPath Key path of the list.
       * @param {Field} args.fieldConfig Configuration to validate the list with: the list’s own, or
       * the item’s for a list with `field`.
       * @param {Field} args.listFieldConfig The list’s own configuration, for the messages.
       * @returns {boolean} Whether the list’s items have to be validated too.
       */
      const validateListItself = ({ listKeyPath, fieldConfig, listFieldConfig }) => {
        const { valid: listValid, validateItems } = validateList({
          fieldConfig,
          validateArgs: { ...validateArgs, keyPath: listKeyPath, value: '', componentName },
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
              fieldConfig: listFieldConfig,
            });
          }
        }

        return validateItems;
      };

      /**
       * Validate the KeyValue field the value belongs to, if it’s a pair. A pair is stored under an
       * arbitrary key, e.g. `metadata.color`, that has no field configuration of its own, so the
       * field is validated through its first pair and the result is recorded for the field, where
       * the editor shows it. Without this, a KeyValue field holding pairs would never be validated.
       */
      const validateKeyValuePair = () => {
        const keyValueField = getKeyValueField({
          ...getFieldArgs,
          keyPath: keyPath.replace(COMPONENT_NAME_PREFIX_REGEX, ''),
          valueMap,
          componentName,
        });

        const fieldKeyPath = keyPath.replace(PAIR_KEY_PATH_REGEX, '');

        if (!keyValueField || fieldKeyPath in validities[locale]) {
          return;
        }

        if (!validateField({ ...validateArgs, keyPath, value, componentName })) {
          valid = false;
        }

        const validity = validities[locale][keyPath];

        // A field that can’t be edited in the locale isn’t validated
        if (!validity) {
          return;
        }

        delete validities[locale][keyPath];
        validities[locale][fieldKeyPath] = validity;
        validationMessages[locale][fieldKeyPath] = getFieldValidationMessages({
          validity,
          fieldConfig: keyValueField,
        });
      };

      /**
       * Validate the Code field the value belongs to, if it’s the code or language of one that
       * stores an object, e.g. `snippet.code`. Like a KeyValue pair, such a key path has no field
       * configuration of its own, and an existing entry has no value at the field’s own key path,
       * so the field is validated through its sub-keys, only once, at the field’s key path.
       */
      const validateCodeSubKey = () => {
        const codeField = getCodeField({
          ...getFieldArgs,
          keyPath: keyPath.replace(COMPONENT_NAME_PREFIX_REGEX, ''),
          valueMap,
          componentName,
        });

        const fieldKeyPath = keyPath.replace(PAIR_KEY_PATH_REGEX, '');

        if (!codeField || fieldKeyPath in validities[locale]) {
          return;
        }

        if (
          !validateField({
            ...validateArgs,
            keyPath: fieldKeyPath,
            value: valueMap[fieldKeyPath],
            componentName,
          })
        ) {
          valid = false;
        }

        const validity = validities[locale][fieldKeyPath];

        if (validity) {
          validationMessages[locale][fieldKeyPath] = getFieldValidationMessages({
            validity,
            fieldConfig: codeField,
          });
        }
      };

      // The items of a List field with subfields or types are flattened to their own subfields,
      // e.g. `speakers.0.name`, so no key path stands for such a list. Validate each list the value
      // is in through the path of its items, or its item count would never be checked
      [...keyPath.matchAll(LIST_ITEM_SUBFIELD_REGEX)].forEach(({ index }) => {
        const ancestorKeyPath = keyPath.slice(0, index);
        const ancestorConfig = getConfig(ancestorKeyPath);

        if (ancestorConfig?.widget === 'list') {
          validateListItself({
            listKeyPath: ancestorKeyPath,
            fieldConfig: ancestorConfig,
            listFieldConfig: ancestorConfig,
          });
        }
      });

      const listKeyPath = LIST_KEY_PATH_REGEX.test(keyPath)
        ? keyPath.replace(LIST_KEY_PATH_REGEX, '')
        : undefined;

      const listFieldConfig = listKeyPath === undefined ? undefined : getConfig(listKeyPath);

      // An item of a List field without subfields has no config of its own, so the list stands in
      // for it: the list is validated as a whole, while the items, plain strings, are left alone
      const fieldConfig =
        getConfig(keyPath) ??
        (listFieldConfig?.widget === 'list' &&
        !getListFieldInfo(/** @type {ListField} */ (listFieldConfig)).hasSubFields
          ? listFieldConfig
          : undefined);

      if (!fieldConfig) {
        validateKeyValuePair();
        validateCodeSubKey();

        return;
      }

      // Skip unsupported field types: not built-in or custom
      if (getFieldKind(fieldConfig) === 'unknown') {
        return;
      }

      // Validate a list itself before the items. The item’s config is the subfield of a list with
      // `field`, so the list’s own config has to be used for the list’s messages, such as the
      // minimum item count
      if (
        listKeyPath !== undefined &&
        !validateListItself({
          listKeyPath,
          fieldConfig,
          listFieldConfig: /** @type {Field} */ (listFieldConfig),
        })
      ) {
        return;
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
