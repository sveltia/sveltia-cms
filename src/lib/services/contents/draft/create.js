import { generateRandomId, generateUUID } from '@sveltia/utils/crypto';
import { stripTags } from '@sveltia/utils/string';
import { flatten } from 'flat';
import { get } from 'svelte/store';
import { getDefaultValue as getDefaultDateTimeValue } from '$lib/components/contents/details/widgets/date-time/helper';
import { getCollection } from '$lib/services/contents';
import { entryDraft, i18nDuplicationEnabled } from '$lib/services/contents/draft';
import { restoreBackupIfNeeded } from '$lib/services/contents/draft/backup';
import { showDuplicateToast } from '$lib/services/contents/draft/editor';
import { getFieldConfig } from '$lib/services/contents/entry';

/**
 * Parse the given dynamic default value.
 * @param {object} args - Arguments.
 * @param {Field} args.fieldConfig - Field configuration.
 * @param {FieldKeyPath} args.keyPath - Field key path, e.g. `author.name`.
 * @param {FlattenedEntryContent} args.newContent - An object holding a content key-value map.
 * @param {string} args.value - Dynamic default value.
 * @see https://decapcms.org/docs/dynamic-default-values/
 * @todo Validate the value carefully before adding it to the content map.
 */
const parseDynamicDefaultValue = ({ fieldConfig, keyPath, newContent, value }) => {
  const { widget: widgetName = 'string' } = fieldConfig;

  /**
   * Parse the value as a list and add the items to the key-value map.
   */
  const fillList = () => {
    newContent[keyPath] = [];

    value.split(/,\s*/).forEach((val, index) => {
      newContent[`${keyPath}.${index}`] = val;
    });
  };

  if (widgetName === 'boolean') {
    newContent[keyPath] = value === 'true';

    return;
  }

  if (widgetName === 'list') {
    const { field: subField, fields: subFields, types } = /** @type {ListField} */ (fieldConfig);
    const hasSubFields = !!subField || !!subFields || !!types;

    // Handle simple list
    if (!hasSubFields) {
      fillList();

      return;
    }
  }

  if (widgetName === 'markdown') {
    // Sanitize the given value to prevent XSS attacks as the preview may not be sanitized
    newContent[keyPath] = stripTags(value);

    return;
  }

  if (widgetName === 'number') {
    const { value_type: valueType = 'int' } = /** @type {NumberField} */ (fieldConfig);

    newContent[keyPath] =
      // eslint-disable-next-line no-nested-ternary
      valueType === 'int'
        ? Number.parseInt(value, 10)
        : valueType === 'float'
          ? Number.parseFloat(value)
          : value;

    return;
  }

  if (widgetName === 'relation' || widgetName === 'select') {
    const { multiple = false } = /** @type {RelationField | SelectField} */ (fieldConfig);

    if (multiple) {
      fillList();

      return;
    }
  }

  // Just use the string as is
  newContent[keyPath] = value;
};

/**
 * Get the default values for the given fields. If dynamic default values are given, these values
 * take precedence over static default values defined with the site configuration.
 * @param {Field[]} fields - Field list of a collection.
 * @param {Record<string, string>} [dynamicValues] - Dynamic default values.
 * @returns {FlattenedEntryContent} Flattened entry content for creating a new draft content or
 * adding a new list item.
 * @todo Make this more diligent.
 */
export const getDefaultValues = (fields, dynamicValues = {}) => {
  /** @type {FlattenedEntryContent} */
  const newContent = {};

  /**
   * Get the default value for the given field. Check if a dynamic default value is specified, then
   * look for the field configuration’s `default` property.
   * @param {object} args - Arguments.
   * @param {Field} args.fieldConfig - Field configuration.
   * @param {FieldKeyPath} args.keyPath - Field key path, e.g. `author.name`.
   */
  const getDefaultValue = ({ fieldConfig, keyPath }) => {
    if (keyPath in dynamicValues) {
      parseDynamicDefaultValue({ fieldConfig, keyPath, newContent, value: dynamicValues[keyPath] });

      return;
    }

    const { widget: widgetName = 'string', default: defaultValue, required = true } = fieldConfig;
    const isArray = Array.isArray(defaultValue) && !!defaultValue.length;

    if (widgetName === 'list') {
      const { fields: subFields } = /** @type {ListField} */ (fieldConfig);

      if (!isArray) {
        newContent[keyPath] = [];

        return;
      }

      if (subFields) {
        defaultValue.forEach((items, index) => {
          Object.entries(items).forEach(([key, val]) => {
            newContent[[keyPath, index, key].join('.')] = val;
          });
        });

        return;
      }

      defaultValue.forEach((val, index) => {
        newContent[[keyPath, index].join('.')] = val;
      });

      return;
    }

    if (widgetName === 'object') {
      const { fields: subFields, types } = /** @type {ObjectField} */ (fieldConfig);

      if (!required || Array.isArray(types)) {
        // Enable validation
        newContent[keyPath] = null;
      } else {
        subFields?.forEach((_subField) => {
          getDefaultValue({
            keyPath: [keyPath, _subField.name].join('.'),
            fieldConfig: _subField,
          });
        });
      }

      return;
    }

    if (widgetName === 'boolean') {
      newContent[keyPath] = typeof defaultValue === 'boolean' ? defaultValue : false;

      return;
    }

    if (widgetName === 'relation' || widgetName === 'select') {
      const { multiple = false } = /** @type {RelationField | SelectField} */ (fieldConfig);

      if (multiple) {
        if (isArray) {
          defaultValue.forEach((value, index) => {
            newContent[[keyPath, index].join('.')] = value;
          });
        } else {
          newContent[keyPath] = [];
        }

        return;
      }
    }

    if (widgetName === 'datetime') {
      newContent[keyPath] = getDefaultDateTimeValue(/** @type {DateTimeField} */ (fieldConfig));

      return;
    }

    if (widgetName === 'uuid') {
      const { prefix, use_b32_encoding: useEncoding } = /** @type {UuidField} */ (fieldConfig);
      const value = useEncoding ? generateRandomId() : generateUUID();

      newContent[keyPath] = prefix ? `${prefix}${value}` : value;

      return;
    }

    newContent[keyPath] = defaultValue !== undefined ? defaultValue : '';
  };

  fields.forEach((_field) => {
    getDefaultValue({
      keyPath: _field.name,
      fieldConfig: _field,
    });
  });

  return newContent;
};

/**
 * Create a Proxy that automatically copies a field value to other locale if the field’s i18n
 * strategy is “duplicate.”.
 * @param {object} args - Arguments.
 * @param {EntryDraft | any} args.draft - Entry draft.
 * @param {'currentValues' | 'files'} [args.prop] - Property name in the {@link entryDraft} store
 * that contains a locale/Proxy map.
 * @param {string} args.locale - Source locale.
 * @param {object} [args.target] - Target object.
 * @param {() => FlattenedEntryContent} [args.getValueMap] - Optional function to get an object
 * holding the current entry values. It will be used for the `valueMap` argument of
 * {@link getFieldConfig}. If omitted, the proxy target will be used instead.
 * @returns {any} Created proxy.
 */
export const createProxy = ({
  draft: { collectionName, fileName },
  prop: entryDraftProp = 'currentValues',
  locale: sourceLocale,
  target = {},
  getValueMap = undefined,
}) => {
  const collection = getCollection(collectionName);

  if (!collection) {
    return undefined;
  }

  const collectionFile = fileName ? collection._fileMap?.[fileName] : undefined;
  const {
    defaultLocale,
    canonicalSlug: { key: canonicalSlugKey },
  } = (collectionFile ?? collection)._i18n;

  return new Proxy(/** @type {any} */ (target), {
    // eslint-disable-next-line jsdoc/require-jsdoc
    set: (obj, /** @type {FieldKeyPath} */ keyPath, value) => {
      // Just save the given value in some cases
      if ([canonicalSlugKey].includes(keyPath) || !get(i18nDuplicationEnabled)) {
        return Reflect.set(obj, keyPath, value);
      }

      const valueMap = typeof getValueMap === 'function' ? getValueMap() : obj;
      const fieldConfig = getFieldConfig({ collectionName, fileName, valueMap, keyPath });

      if (!fieldConfig) {
        return true;
      }

      // Copy value to other locales
      if (fieldConfig.i18n === 'duplicate' && sourceLocale === defaultLocale) {
        Object.entries(
          /** @type {Record<string, any>} */ (get(entryDraft))[entryDraftProp],
        ).forEach(([targetLocale, content]) => {
          // Don’t duplicate the value if the parent object doesn’t exist
          if (keyPath.includes('.')) {
            const [, parentKeyPath] = keyPath.match(/(.+)\.[^.]+$/) ?? [];

            if (
              !Object.keys(content).some((_keyPath) => _keyPath.startsWith(`${parentKeyPath}.`)) &&
              !getFieldConfig({ collectionName, fileName, valueMap, keyPath: parentKeyPath })
            ) {
              return;
            }
          }

          if (targetLocale !== sourceLocale && content[keyPath] !== value) {
            content[keyPath] = value;
          }
        });
      }

      return Reflect.set(obj, keyPath, value);
    },
  });
};

/**
 * Create an entry draft.
 * @param {any} entry - Entry to be edited, or a partial {@link Entry} object containing at least
 * the collection name for a new entry.
 * @param {Record<string, string>} [dynamicValues] - Dynamic default values for a new entry passed
 * through URL parameters.
 */
export const createDraft = (entry, dynamicValues) => {
  const { id, slug, collectionName, fileName, locales } = entry;
  const isNew = id === undefined;
  const collection = getCollection(collectionName);

  if (!collection) {
    return;
  }

  const collectionFile = fileName ? collection._fileMap?.[fileName] : undefined;
  const { fields = [], _i18n } = collectionFile ?? collection;
  const { i18nEnabled, locales: allLocales } = _i18n;
  const newContent = getDefaultValues(fields, dynamicValues);
  const enabledLocales = isNew
    ? allLocales
    : allLocales.filter((locale) => !!locales?.[locale]?.content);
  const originalLocales = Object.fromEntries(
    allLocales.map((locale) => [locale, isNew || enabledLocales.includes(locale)]),
  );
  /** @type {Record<LocaleCode, FlattenedEntryContent>} */
  const originalValues = Object.fromEntries(
    enabledLocales.map((locale) => [
      locale,
      isNew ? newContent : flatten(locales?.[locale].content),
    ]),
  );

  entryDraft.set({
    isNew: isNew && !fileName,
    collectionName,
    collection,
    fileName,
    collectionFile,
    originalEntry: isNew ? undefined : entry,
    originalLocales,
    currentLocales: structuredClone(originalLocales),
    originalValues,
    currentValues: Object.fromEntries(
      enabledLocales.map((locale) => [
        locale,
        i18nEnabled
          ? createProxy({
              draft: { collectionName, fileName },
              locale,
              target: structuredClone(originalValues[locale]),
            })
          : structuredClone(originalValues[locale]),
      ]),
    ),
    files: Object.fromEntries(
      enabledLocales.map((locale) => [
        locale,
        i18nEnabled
          ? createProxy({
              draft: { collectionName, fileName },
              prop: 'files',
              locale,
              // eslint-disable-next-line jsdoc/require-jsdoc
              getValueMap: () => /** @type {EntryDraft} */ (get(entryDraft)).currentValues[locale],
            })
          : {},
      ]),
    ),
    validities: Object.fromEntries(allLocales.map((locale) => [locale, {}])),
    // Any locale-agnostic view states will be put under the `_` key
    expanderStates: { _: {} },
  });

  restoreBackupIfNeeded(collectionName, slug);
};

/**
 * Duplicate the current entry draft.
 */
export const duplicateDraft = () => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { collection, collectionFile, currentValues, validities } = draft;
  const {
    canonicalSlug: { key: canonicalSlugKey },
  } = (collectionFile ?? collection)._i18n;

  // Remove the canonical slug
  Object.keys(currentValues).forEach((locale) => {
    delete currentValues[locale][canonicalSlugKey];
  });

  // Reset the validities
  Object.keys(validities).forEach((locale) => {
    validities[locale] = {};
  });

  entryDraft.set({
    ...draft,
    isNew: true,
    originalEntry: undefined,
  });

  showDuplicateToast.set(true);
};
