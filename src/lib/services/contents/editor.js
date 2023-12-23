/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-continue */

import equal from 'fast-deep-equal';
import { flatten, unflatten } from 'flat';
import { get, writable } from 'svelte/store';
import { allAssetFolders, allAssets, getAssetKind } from '$lib/services/assets';
import { backend, backendName } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';
import { allEntries, getCollection } from '$lib/services/contents';
import { contentUpdatesToast } from '$lib/services/contents/data';
import { getFieldConfig } from '$lib/services/contents/entry';
import { fillSlugTemplate } from '$lib/services/contents/slug';
import { translator } from '$lib/services/integrations/translators';
import { formatEntryFile, getFileExtension } from '$lib/services/parser';
import { prefs } from '$lib/services/prefs';
import { user } from '$lib/services/user';
import { getDateTimeParts } from '$lib/services/utils/datetime';
import { createPath, getHash, renameIfNeeded, resolvePath } from '$lib/services/utils/files';
import LocalStorage from '$lib/services/utils/local-storage';
import { escapeRegExp } from '$lib/services/utils/strings';

const storageKey = 'sveltia-cms.entry-view';

/**
 * @type {import('svelte/store').Writable<?EntryEditorPane>}
 */
export const editorLeftPane = writable(null);

/**
 * @type {import('svelte/store').Writable<?EntryEditorPane>}
 */
export const editorRightPane = writable(null);

/**
 * View settings for the Select Assets dialog.
 * @type {import('svelte/store').Writable<SelectAssetsView>}
 */
export const selectAssetsView = writable({});

/**
 * @type {import('svelte/store').Writable<EntryEditorView>}
 */
export const entryEditorSettings = writable({}, (set) => {
  (async () => {
    try {
      const settings = {
        showPreview: true,
        syncScrolling: true,
        selectAssetsView: { type: 'grid' },
        ...((await LocalStorage.get(storageKey)) ?? {}),
      };

      set(settings);
      selectAssetsView.set(settings.selectAssetsView);
    } catch {
      //
    }
  })();
});

/**
 * @type {import('svelte/store').Writable<EntryDraft | null | undefined>}
 */
export const entryDraft = writable();

/**
 * Get the default values for the given fields. If dynamic default values are given, these values
 * take precedence over static default values defined with the site configuration.
 * @param {Field[]} fields - Field list of a collection.
 * @param {{ [key: string]: string }} [defaultValues] - Dynamic default values.
 * @returns {FlattenedEntryContent} Flattened entry content for creating a new draft content or
 * adding a new list item.
 * @todo Make this more diligent.
 */
export const getDefaultValues = (fields, defaultValues = {}) => {
  /** @type {FlattenedEntryContent} */
  const newContent = {};

  /**
   * Get the default value for the given field. Check if a dynamic default value is specified, then
   * look for the field configuration’s `default` property.
   * @param {object} args - Arguments.
   * @param {Field} args.fieldConfig - Field configuration.
   * @param {string} args.keyPath - Field key path, e.g. `author.name`.
   * @see https://decapcms.org/docs/beta-features/#dynamic-default-values
   */
  const getDefaultValue = ({ fieldConfig, keyPath }) => {
    if (keyPath in defaultValues) {
      newContent[keyPath] = defaultValues[keyPath];

      return;
    }

    const { widget: widgetName, default: defaultValue, required = true } = fieldConfig;
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
      // Skip optional objects
      if (!required) {
        return;
      }

      const { fields: subFields } = /** @type {ObjectField} */ (fieldConfig);

      subFields.forEach((_subField) => {
        getDefaultValue({
          keyPath: [keyPath, _subField.name].join('.'),
          fieldConfig: _subField,
        });
      });

      return;
    }

    if (widgetName === 'boolean') {
      newContent[keyPath] = typeof defaultValue === 'boolean' ? defaultValue : false;

      return;
    }

    if (widgetName === 'relation' || widgetName === 'select') {
      const { multiple = false } = /** @type {RelationField | SelectField} */ (fieldConfig);

      if (multiple) {
        newContent[keyPath] = isArray ? defaultValue : [];

        return;
      }
    }

    if (widgetName === 'date' || widgetName === 'datetime') {
      if (typeof defaultValue === 'string') {
        newContent[keyPath] = defaultValue;
      } else {
        const {
          date_format: dateFormat,
          time_format: timeFormat,
          picker_utc: pickerUTC = false,
        } = /** @type {DateTimeField} */ (fieldConfig);

        // Default to current date/time
        const { year, month, day, hour, minute } = getDateTimeParts({
          timeZone: pickerUTC ? 'UTC' : undefined,
        });

        if (timeFormat === false) {
          newContent[keyPath] = `${year}-${month}-${day}`;
        } else if (dateFormat === false) {
          newContent[keyPath] = `${hour}:${minute}`;
        } else {
          newContent[keyPath] = `${year}-${month}-${day}T${hour}:${minute}${pickerUTC ? 'Z' : ''}`;
        }
      }

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
  const collectionFile = fileName ? collection._fileMap[fileName] : undefined;
  const { defaultLocale } = (collectionFile ?? collection)._i18n;

  return new Proxy(/** @type {any} */ (target), {
    // eslint-disable-next-line jsdoc/require-jsdoc
    set: (obj, /** @type {string} */ keyPath, value) => {
      const valueMap = typeof getValueMap === 'function' ? getValueMap() : obj;
      const fieldConfig = getFieldConfig({ collectionName, fileName, valueMap, keyPath });

      if (!fieldConfig) {
        return true;
      }

      // Copy value to other locales
      if (fieldConfig.i18n === 'duplicate' && sourceLocale === defaultLocale) {
        Object.entries(
          /** @type {{ [key: string]: any }} */ (get(entryDraft))[entryDraftProp],
        ).forEach(([targetLocale, content]) => {
          // Don’t duplicate the value if the parent object doesn’t exist
          if (keyPath.includes('.')) {
            const [, parentKeyPath] = keyPath.match(/(.+)\.[^.]+$/);

            if (
              !Object.keys(content).some((_keyPath) => _keyPath.startsWith(`${parentKeyPath}.`))
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
 * @param {Entry} entry - Entry to be edited, or a partial `Entry` object containing at least the
 * collection name for a new entry.
 * @param {{ [key: string]: string }} [defaultValues] - Dynamic default values for a new entry
 * passed through URL parameters.
 */
export const createDraft = (entry, defaultValues) => {
  const { id, collectionName, fileName, locales } = entry;
  const isNew = id === undefined;
  const collection = getCollection(collectionName);
  const collectionFile = fileName ? collection._fileMap[fileName] : undefined;
  const { fields, _i18n } = collectionFile ?? collection;
  const { i18nEnabled, locales: allLocales } = _i18n;
  const newContent = getDefaultValues(fields, defaultValues);

  const enabledLocales = isNew
    ? allLocales
    : allLocales.filter((locale) => !!locales?.[locale]?.content);

  const originalLocales = Object.fromEntries(
    allLocales.map((locale) => [locale, isNew || enabledLocales.includes(locale)]),
  );

  /** @type {{ [locale: LocaleCode]: FlattenedEntryContent }} */
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
              getValueMap: () => get(entryDraft).currentValues[locale],
            })
          : {},
      ]),
    ),
    validities: Object.fromEntries(allLocales.map((locale) => [locale, {}])),
    viewStates: Object.fromEntries(allLocales.map((locale) => [locale, {}])),
  });
};

/**
 * Unproxify & unflatten the given object.
 * @param {Proxy | object} obj - Original proxy or object.
 * @returns {object} Processed object.
 */
const unflattenObj = (obj) => unflatten(JSON.parse(JSON.stringify(obj)));

/**
 * Traverse the given object by decoding dot-connected `keyPath`.
 * @param {any} obj - Unflatten object.
 * @param {string} keyPath - Dot-connected field name.
 * @returns {object[]} Values.
 */
const getItemList = (obj, keyPath) =>
  keyPath.split('.').reduce((_obj, key) => {
    const _key = key.match(/^\d+$/) ? Number(key) : key;

    // Create a new array when adding a new item
    _obj[_key] ??= [];

    return _obj[_key];
  }, obj);

/**
 * Update the value in a list field.
 * @param {LocaleCode} locale - Target locale.
 * @param {string} keyPath - Dot-connected field name.
 * @param {(arg: { valueList: object[], viewList: object[] }) => void} manipulate - A function to
 * manipulate the list, which takes one object argument containing the value list and view state
 * list. The typical usage is `list.splice()`.
 */
export const updateListField = (locale, keyPath, manipulate) => {
  const currentValues = unflattenObj(get(entryDraft).currentValues[locale]);
  const viewStates = unflattenObj(get(entryDraft).viewStates[locale]);

  manipulate({
    valueList: getItemList(currentValues, keyPath),
    viewList: getItemList(viewStates, keyPath),
  });

  entryDraft.update((draft) => ({
    ...draft,
    currentValues: {
      ...draft.currentValues,
      // Flatten & proxify the object again
      [locale]: createProxy({ draft, locale, target: flatten(currentValues) }),
    },
    viewStates: {
      ...draft.viewStates,
      [locale]: flatten(viewStates),
    },
  }));
};

/**
 * Populate the given localized content with values from the default locale if the corresponding
 * field’s i18n configuration is `duplicate`.
 * @param {FlattenedEntryContent} content - Original content.
 * @param {object} [options] - Options.
 * @param {'currentValues' | 'files'} [options.prop] - Property name in the {@link entryDraft} store
 * that contains a locale/Proxy map.
 * @returns {FlattenedEntryContent} Updated content.
 */
export const copyDefaultLocaleValues = (content, { prop = 'currentValues' } = {}) => {
  const draft = get(entryDraft);
  const { collectionName, fileName, collection, collectionFile } = draft;
  const { defaultLocale } = (collectionFile ?? collection)._i18n;
  const defaultLocaleValues = draft[prop][defaultLocale];
  const keys = [...new Set([...Object.keys(content), ...Object.keys(defaultLocaleValues)])];
  const newContent = /** @type {FlattenedEntryContent} */ ({});

  keys.forEach((keyPath) => {
    const canDuplicate =
      getFieldConfig({ collectionName, fileName, keyPath })?.i18n === 'duplicate';

    newContent[keyPath] =
      (canDuplicate ? defaultLocaleValues[keyPath] : undefined) ?? content[keyPath];
  });

  return newContent;
};

/**
 * Enable or disable the given locale’s content output for the current entry draft.
 * @param {LocaleCode} locale - Locale.
 */
export const toggleLocale = (locale) => {
  entryDraft.update((draft) => {
    const { currentLocales, currentValues } = draft;
    const enabled = !currentLocales[locale];

    // Initialize the content for the locale
    if (enabled && !currentValues[locale]) {
      const { collection, collectionName, collectionFile, fileName, originalValues, files } = draft;
      const { fields, _i18n } = collectionFile ?? collection;
      const { defaultLocale } = _i18n;
      const newContent = getDefaultValues(fields);

      return {
        ...draft,
        currentLocales: { ...currentLocales, [locale]: enabled },
        originalValues: { ...originalValues, [locale]: newContent },
        currentValues: {
          ...currentValues,
          [locale]: createProxy({
            draft: { collectionName, fileName },
            locale,
            target: copyDefaultLocaleValues(newContent),
          }),
        },
        files: {
          ...files,
          [locale]: createProxy({
            draft: { collectionName, fileName },
            prop: 'files',
            locale,
            target: copyDefaultLocaleValues(
              Object.fromEntries(Object.keys(files[defaultLocale]).map((key) => [key, undefined])),
              { prop: 'files' },
            ),
            // eslint-disable-next-line jsdoc/require-jsdoc
            getValueMap: () => get(entryDraft).currentValues[locale],
          }),
        },
      };
    }

    return {
      ...draft,
      currentLocales: { ...currentLocales, [locale]: enabled },
    };
  });
};

/**
 * Copy/translation toast state.
 * @type {import('svelte/store').Writable<{
 * id: number,
 * show: boolean,
 * status: 'info' | 'success' | 'error',
 * message: string,
 * count: number,
 * sourceLocale: LocaleCode,
 * }>}
 */
export const copyFromLocaleToast = writable({
  id: undefined,
  show: false,
  status: undefined,
  message: undefined,
  count: 1,
  sourceLocale: undefined,
});

/**
 * Copy or translate field value(s) from another locale.
 * @param {string} sourceLocale - Source locale, e.g. `en`.
 * @param {string} targetLocale - Target locale, e.g. `ja`.
 * @param {string} [keyPath] - Flattened (dot-connected) object keys that will be used for searching
 * the source values. Omit this if copying all the fields. If the triggered widget is List or
 * Object, this will likely match multiple fields.
 * @param {boolean} [translate] - Whether to translate the copied text fields.
 */
export const copyFromLocale = async (
  sourceLocale,
  targetLocale,
  keyPath = '',
  translate = false,
) => {
  const { collectionName, fileName, currentValues } = get(entryDraft);
  const valueMap = currentValues[sourceLocale];

  const copingFields = Object.fromEntries(
    Object.entries(valueMap).filter(([_keyPath, value]) => {
      const field = getFieldConfig({ collectionName, fileName, valueMap, keyPath: _keyPath });

      // prettier-ignore
      if (
        (keyPath && !_keyPath.startsWith(keyPath)) ||
        typeof value !== 'string' ||
        !['markdown', 'text', 'string', 'list'].includes(field?.widget) ||
        (field?.widget === 'list' &&
          (/** @type {ListField} */ (field).field ?? /** @type {ListField} */ (field).fields)) ||
        (!translate && value === currentValues[targetLocale][_keyPath])
      ) {
        return false;
      }

      return true;
    }),
  );

  const count = Object.keys(copingFields).length;
  const countType = count === 1 ? 'one' : 'many';
  const operationType = translate ? 'translation' : 'copy';

  /**
   * Update the toast notification.
   * @param {'info' | 'success' | 'error'} status - Status.
   * @param {string} message - Message key.
   */
  const updateToast = (status, message) => {
    copyFromLocaleToast.set({
      id: Date.now(),
      show: true,
      status,
      message,
      count,
      sourceLocale,
    });
  };

  if (!count) {
    updateToast('info', `${operationType}.none`);

    return;
  }

  if (translate) {
    const apiKey = get(prefs).apiKeys?.[get(translator)?.serviceId];

    if (!apiKey) {
      // This shouldn’t happen because the API key dialog will show up in advance
      return;
    }

    updateToast('info', 'translation.started');

    try {
      const translatedValues = await get(translator).translate(Object.values(copingFields), {
        apiKey,
        sourceLocale,
        targetLocale,
      });

      Object.keys(copingFields).forEach((_keyPath, index) => {
        currentValues[targetLocale][_keyPath] = translatedValues[index];
      });

      updateToast('success', `translation.complete.${countType}`);
    } catch {
      // @todo Show a detailed error message.
      // @see https://www.deepl.com/docs-api/api-access/error-handling/
      updateToast('error', 'translation.error');
    }
  } else {
    Object.entries(copingFields).forEach(([_keyPath, value]) => {
      currentValues[targetLocale][_keyPath] = value;
    });

    updateToast('success', `copy.complete.${countType}`);
  }

  entryDraft.update((_entryDraft) => ({ ..._entryDraft, currentValues }));
};

/**
 * Revert the changes made to the given field or all the fields to the default value(s).
 * @param {LocaleCode} [locale] - Target locale, e.g. `ja`. Can be empty if reverting everything.
 * @param {string} [keyPath] - Flattened (dot-connected) object keys that will be used for searching
 * the source values. Omit this if copying all the fields. If the triggered widget is List or
 * Object, this will likely match multiple fields.
 */
export const revertChanges = (locale = '', keyPath = '') => {
  const { collection, collectionFile, fileName, currentValues, originalValues } = get(entryDraft);
  const { locales: allLocales, defaultLocale } = (collectionFile ?? collection)._i18n;
  const locales = locale ? [locale] : allLocales;

  /**
   * Revert changes.
   * @param {LocaleCode} _locale - Iterating locale.
   * @param {FlattenedEntryContent} valueMap - Flattened entry content.
   * @param {boolean} reset - Whether ro remove the current value.
   */
  const revert = (_locale, valueMap, reset = false) => {
    Object.entries(valueMap).forEach(([_keyPath, value]) => {
      if (!keyPath || _keyPath.startsWith(keyPath)) {
        const fieldConfig = getFieldConfig({
          collectionName: collection.name,
          fileName,
          valueMap,
          keyPath: _keyPath,
        });

        if (_locale === defaultLocale || [true, 'translate'].includes(fieldConfig?.i18n)) {
          if (reset) {
            delete currentValues[_locale][_keyPath];
          } else {
            currentValues[_locale][_keyPath] = value;
          }
        }
      }
    });
  };

  locales.forEach((_locale) => {
    // Remove all the current values except for i18n-duplicate ones
    revert(_locale, currentValues[_locale], true);
    // Restore the original values
    revert(_locale, originalValues[_locale], false);
  });

  entryDraft.update((_entryDraft) => ({ ..._entryDraft, currentValues }));
};

/**
 * Validate the current entry draft, update the validity for all the fields, and return the final
 * results as a boolean. Mimic the native `ValidityState` API.
 * @returns {boolean} Whether the draft is valid.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ValidityState
 * @todo Rewrite this to better support list and object fields.
 */
const validateEntry = () => {
  const { collection, collectionFile, fileName, currentLocales, currentValues, validities } =
    get(entryDraft);

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

    valueEntries.forEach(([keyPath, value]) => {
      const fieldConfig = getFieldConfig({
        collectionName: collection.name,
        fileName,
        valueMap,
        keyPath,
      });

      if (!fieldConfig) {
        return;
      }

      const arrayMatch = keyPath.match(/\.(\d+)$/);
      const { widget: widgetName, required = true, i18n = false, pattern } = fieldConfig;
      const { multiple = false } = /** @type {RelationField | SelectField} */ (fieldConfig);

      const { min, max } = /** @type {ListField | NumberField | RelationField | SelectField} */ (
        fieldConfig
      );

      const canTranslate = i18nEnabled && i18n !== false;
      const _required = required !== false && (locale === defaultLocale || canTranslate);
      let valueMissing = false;
      let rangeUnderflow = false;
      let rangeOverflow = false;
      let patternMismatch = false;

      // Given that values for an array field are flatten into `field.0`, `field.1` ... `field.n`,
      // we should validate only once against all these values
      if (arrayMatch) {
        const index = Number(arrayMatch[1]);

        if (index > 0) {
          return;
        }

        keyPath = keyPath.replace(/\.\d+$/, '');

        const keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`);

        const values =
          valueEntries
            .filter(([_keyPath]) => _keyPath.match(keyPathRegex))
            .map(([, savedValue]) => savedValue)
            .filter((val) => val !== undefined) ?? [];

        if (_required && !values.length) {
          valueMissing = true;
        }

        if (typeof min === 'number' && Array.isArray(value) && value.length < min) {
          rangeUnderflow = true;
        }

        if (typeof max === 'number' && Array.isArray(value) && value.length > max) {
          rangeOverflow = true;
        }
      }

      if (widgetName === 'list' && Array.isArray(value)) {
        if (typeof min === 'number' && value.length < min) {
          rangeUnderflow = true;
        } else if (_required && !value.length) {
          valueMissing = true;
        }
      }

      if (!['object', 'list'].includes(widgetName)) {
        if (_required && (value === undefined || value === '' || (multiple && !value.length))) {
          valueMissing = true;
        }

        if (
          Array.isArray(pattern) &&
          pattern.length === 2 &&
          !String(value).match(escapeRegExp(pattern[0]))
        ) {
          patternMismatch = true;
        }
      }

      const validity = {
        valueMissing,
        rangeUnderflow,
        rangeOverflow,
        patternMismatch,
      };

      const valid = !Object.values(validity).some(Boolean);

      validities[locale][keyPath] = { ...validity, valid };

      if (!valid) {
        validated = false;
      }
    });
  });

  entryDraft.update((draft) => ({ ...draft, validities }));

  return validated;
};

/**
 * Get the internal/public asset path configuration for the entry assets.
 * @param {any} fillSlugOptions - Options to be passed to {@link fillSlugTemplate}.
 * @returns {{ internalAssetFolder: string, publicAssetFolder: string }} Determined paths.
 */
export const getEntryAssetFolderPaths = (fillSlugOptions) => {
  const {
    collection: {
      path: entryPath,
      _i18n: { structure },
      _assetFolder,
    },
  } = fillSlugOptions;

  const subPath = entryPath?.match(/(.+?)(?:\/[^/]+)?$/)[1];
  const isMultiFolders = structure === 'multiple_folders';
  const { entryRelative, internalPath, publicPath } = _assetFolder ?? get(allAssetFolders)[0];

  if (!entryRelative) {
    return {
      internalAssetFolder: internalPath,
      publicAssetFolder: publicPath,
    };
  }

  return {
    internalAssetFolder: resolvePath(
      fillSlugTemplate(
        createPath([internalPath, isMultiFolders || entryPath.includes('/') ? subPath : undefined]),
        fillSlugOptions,
      ),
    ),
    publicAssetFolder:
      !isMultiFolders && publicPath.match(/^\.?$/)
        ? // Dot-only public path is a special case; the final path stored as the field value will
          // be `./image.png` rather than `image.png`
          publicPath
        : resolvePath(
            fillSlugTemplate(
              isMultiFolders
                ? // When multiple folders are used for i18n, the file structure would look like
                  // `{collection}/{locale}/{slug}.md` or `{collection}/{locale}/{slug}/index.md`
                  // and the asset path would be `{collection}/{slug}/{file}.jpg`
                  createPath([
                    ...Array((entryPath?.match(/\//g) ?? []).length + 1).fill('..'),
                    publicPath,
                    subPath,
                  ])
                : publicPath,
              fillSlugOptions,
            ),
          ),
  };
};

/**
 * Determine the file path for the given entry draft depending on the collection type, i18n config
 * and folder collections path.
 * @param {EntryDraft} draft - Entry draft.
 * @param {LocaleCode} locale - Locale code.
 * @param {string} slug - Entry slug.
 * @returns {string} Complete path, including the folder, slug, extension and possibly locale.
 * @see https://decapcms.org/docs/beta-features/#i18n-support
 */
const createEntryPath = (draft, locale, slug) => {
  const { collection, collectionFile, originalEntry, currentValues } = draft;

  if (collectionFile) {
    return collectionFile.file;
  }

  if (originalEntry?.locales[locale]) {
    return originalEntry?.locales[locale].path;
  }

  const { defaultLocale, structure } = collection._i18n;
  const collectionFolder = collection.folder?.replace(/\/$/, '');

  /**
   * Support folder collections path.
   * @see https://decapcms.org/docs/beta-features/#folder-collections-path
   */
  const path = collection.path
    ? fillSlugTemplate(collection.path, {
        collection,
        content: currentValues[defaultLocale],
        currentSlug: slug,
      })
    : slug;

  const extension = getFileExtension({
    format: collection.format,
    extension: collection.extension,
  });

  const defaultOption = `${collectionFolder}/${path}.${extension}`;

  const pathOptions = {
    multiple_folders: `${collectionFolder}/${locale}/${path}.${extension}`,
    multiple_files: `${collectionFolder}/${path}.${locale}.${extension}`,
    single_file: defaultOption,
  };

  return pathOptions[structure] || pathOptions.single_file;
};

/**
 * Save the entry draft.
 * @param {object} [options] - Options.
 * @param {boolean} [options.skipCI] - Whether to disable automatic deployments for the change.
 * @throws {Error} When the entry could not be validated or saved.
 */
export const saveEntry = async ({ skipCI = undefined } = {}) => {
  if (!validateEntry()) {
    throw new Error('validation_failed');
  }

  const _user = get(user);
  const draft = get(entryDraft);

  const {
    collection,
    isNew,
    originalLocales,
    currentLocales,
    originalEntry,
    collectionName,
    collectionFile,
    fileName,
    currentValues,
    files,
  } = draft;

  const {
    identifier_field: identifierField = 'title',
    slug: slugTemplate = `{{${identifierField}}}`,
  } = collection;

  const { i18nEnabled, locales, defaultLocale, structure } = (collectionFile ?? collection)._i18n;
  const fillSlugOptions = { collection, content: currentValues[defaultLocale] };
  const slug = fileName || originalEntry?.slug || fillSlugTemplate(slugTemplate, fillSlugOptions);

  const { internalAssetFolder, publicAssetFolder } = getEntryAssetFolderPaths({
    ...fillSlugOptions,
    currentSlug: slug,
    isMediaFolder: true,
    entryFilePath: createEntryPath(draft, defaultLocale, slug),
  });

  const assetsInSameFolder = get(allAssets)
    .map((a) => a.path)
    .filter((p) => p.match(`^\\/${escapeRegExp(internalAssetFolder)}\\/[^\\/]+$`));

  /**
   * @type {FileChange[]}
   */
  const changes = [];
  /**
   * @type {Asset[]}
   */
  const savingAssets = [];

  const savingAssetProps = {
    /** @type {string | undefined} */
    text: undefined,
    collectionName,
    folder: internalAssetFolder,
    commitAuthor: _user.email ? { name: _user.name, email: _user.email } : undefined,
    commitDate: new Date(), // Use the current datetime
  };

  /**
   * @type {{ [locale: LocaleCode]: LocalizedEntry }}
   */
  const savingEntryLocales = Object.fromEntries(
    await Promise.all(
      Object.entries(currentValues).map(async ([locale, valueMap]) => {
        const path = createEntryPath(draft, locale, slug);

        if (!currentLocales[locale]) {
          return [locale, { path }];
        }

        // Normalize data
        for (const [keyPath, value] of Object.entries(valueMap)) {
          if (value === undefined) {
            delete valueMap[keyPath];
            continue;
          }

          if (typeof value !== 'string') {
            continue;
          }

          // Remove leading & trailing whitespace
          valueMap[keyPath] = value.trim();

          const [, mimeType, base64] = value.match(/^data:(.+?\/.+?);base64,(.+)/) ?? [];

          // Replace asset `data:` URLs with the final paths
          if (mimeType) {
            const file =
              files[locale][keyPath] ||
              // Temporary cache files will be lost once the browser session is ended, then restore
              // it from the data URL stored in the draft.
              (await (async () => {
                const response = await fetch(value);
                const blob = await response.blob();
                const [type, subtype] = mimeType.split('/');
                // MIME type can be `image/svg+xml`, then we only need `svg` as the file extension
                const [extension] = subtype.split('+');

                return new File([blob], `${type}-${Date.now()}.${extension}`, { type: mimeType });
              })());

            const sha = await getHash(file);
            const dupFile = savingAssets.find((f) => f.sha === sha);

            // Check if the file has already been added for other field or locale
            if (dupFile) {
              valueMap[keyPath] = publicAssetFolder
                ? `${publicAssetFolder}/${dupFile.name}`
                : dupFile.name;

              continue;
            }

            const _fileName = renameIfNeeded(file.name, [
              ...assetsInSameFolder,
              ...savingAssets.map((a) => a.name),
            ]);

            const assetPath = `${internalAssetFolder}/${_fileName}`;

            changes.push({ action: 'create', path: assetPath, data: file, base64 });

            savingAssets.push({
              ...savingAssetProps,
              url: URL.createObjectURL(file),
              name: _fileName,
              path: assetPath,
              sha,
              size: file.size,
              kind: getAssetKind(_fileName),
            });

            valueMap[keyPath] = publicAssetFolder ? `${publicAssetFolder}/${_fileName}` : _fileName;
          }
        }

        const content = unflatten(valueMap);
        const sha = await getHash(new Blob([content], { type: 'text/plain' }));

        return [locale, { content, sha, path }];
      }),
    ),
  );

  /**
   * @type {Entry}
   */
  const savingEntry = {
    id: `${collectionName}/${slug}`,
    collectionName,
    fileName,
    slug,
    sha: savingEntryLocales[defaultLocale].sha,
    locales: Object.fromEntries(
      Object.entries(savingEntryLocales).filter(([, { content }]) => !!content),
    ),
  };

  const {
    extension,
    format,
    frontmatter_delimiter: frontmatterDelimiter,
    yaml_quote: yamlQuote,
  } = collection;

  const config = { extension, format, frontmatterDelimiter, yamlQuote };

  if (collectionFile || !i18nEnabled || structure === 'single_file') {
    const { path, content } = savingEntryLocales[defaultLocale];

    changes.push({
      action: isNew ? 'create' : 'update',
      slug,
      path,
      data: formatEntryFile({
        content: i18nEnabled
          ? Object.fromEntries(
              Object.entries(savingEntryLocales).map(([locale, le]) => [locale, le.content]),
            )
          : content,
        path,
        config,
      }),
    });
  } else {
    locales.forEach((locale) => {
      const { path, content } = savingEntryLocales[locale];

      if (currentLocales[locale]) {
        changes.push({
          action: isNew || !originalLocales[locale] ? 'create' : 'update',
          slug,
          path,
          data: formatEntryFile({ content, path, config }),
        });
      } else if (originalLocales[locale]) {
        changes.push({ action: 'delete', slug, path });
      }
    });
  }

  try {
    await get(backend).commitChanges(changes, {
      commitType: isNew ? 'create' : 'update',
      collection,
      skipCI,
    });
  } catch {
    throw new Error('saving_failed');
  }

  const savingAssetsPaths = savingAssets.map((a) => a.path);

  allEntries.update((entries) => [...entries.filter((e) => e.id !== savingEntry.id), savingEntry]);

  allAssets.update((assets) => [
    ...assets.filter((a) => !savingAssetsPaths.includes(a.path)),
    ...savingAssets,
  ]);

  entryDraft.set(null);

  const isLocal = get(backendName) === 'local';
  const { automatic_deployments: autoDeployEnabled } = get(siteConfig).backend;

  contentUpdatesToast.set({
    count: 1,
    saved: true,
    published: !isLocal && (skipCI === undefined ? autoDeployEnabled === true : skipCI === false),
  });
};

entryDraft.subscribe((draft) => {
  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('entryDraft', draft);
  }
});

selectAssetsView.subscribe((view) => {
  const savedView = get(entryEditorSettings).selectAssetsView ?? {};

  if (!equal(view, savedView)) {
    entryEditorSettings.update((settings) => ({ ...settings, selectAssetsView: view }));
  }
});

entryEditorSettings.subscribe((settings) => {
  if (!settings || !Object.keys(settings).length) {
    return;
  }

  (async () => {
    try {
      if (!equal(settings, await LocalStorage.get(storageKey))) {
        await LocalStorage.set(storageKey, settings);
      }
    } catch {
      //
    }
  })();
});
