/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-continue */

import equal from 'fast-deep-equal';
import { flatten, unflatten } from 'flat';
import { get, writable } from 'svelte/store';
import { allAssets, getAssetFolder, getAssetKind } from '$lib/services/assets';
import { user } from '$lib/services/auth';
import { backend } from '$lib/services/backends';
import { allEntries, getCollection, getFieldByKeyPath } from '$lib/services/contents';
import { fillSlugTemplate } from '$lib/services/contents/slug';
import { translator } from '$lib/services/integrations/translators';
import { formatEntryFile, getFileExtension } from '$lib/services/parser';
import { prefs } from '$lib/services/prefs';
import { getHash, renameIfNeeded } from '$lib/services/utils/files';
import LocalStorage from '$lib/services/utils/local-storage';
import { escapeRegExp } from '$lib/services/utils/strings';

const storageKey = 'sveltia-cms.entry-view';

/**
 * @type {import('svelte/store').Writable<{ locale?: string, mode?: string }>}
 */
export const editorLeftPane = writable({});

/**
 * @type {import('svelte/store').Writable<{ locale?: string, mode?: string }>}
 */
export const editorRightPane = writable({});

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
        ...((await LocalStorage.get(storageKey)) || {}),
      };

      set(settings);
      selectAssetsView.set(settings.selectAssetsView);
    } catch {
      //
    }
  })();
});

/**
 * @type {import('svelte/store').Writable<EntryDraft?>}
 */
export const entryDraft = writable();

/**
 * Create a new entry content with default values populated.
 * @param {Field[]} fields Field list of a collection.
 * @param {{ [key: string]: string }} [defaultValues] Dynamic default values for a new entry passed
 * through URL parameters.
 * @returns {EntryContent} Entry content.
 * @todo Make this more diligent.
 */
const createNewContent = (fields, defaultValues = {}) => {
  const newContent = {};

  /**
   * Get the default value for the given field. Check if a dynamic default value is specified, then
   * look for the field configuration’s `default` property.
   * @param {object} args Arguments.
   * @param {Field} args.fieldConfig Field configuration.
   * @param {string} args.keyPath Field key path, e.g. `author.name`.
   * @see https://decapcms.org/docs/beta-features/#dynamic-default-values
   */
  const getDefaultValue = ({ fieldConfig, keyPath }) => {
    if (keyPath in defaultValues) {
      newContent[keyPath] = defaultValues[keyPath];

      return;
    }

    const { widget, default: defaultValue } = fieldConfig;
    const isArray = Array.isArray(defaultValue) && !!defaultValue.length;

    if (widget === 'list') {
      const { fields: subFields, field: subField } = /** @type {ListField} */ (fieldConfig);

      if (!isArray) {
        newContent[keyPath] = [];

        return;
      }

      if (subFields || subField) {
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

    if (widget === 'object') {
      const { fields: subFields } = /** @type {ObjectField} */ (fieldConfig);

      subFields.forEach((_subField) => {
        getDefaultValue({
          keyPath: [keyPath, _subField.name].join('.'),
          fieldConfig: _subField,
        });
      });

      return;
    }

    if (widget === 'boolean') {
      newContent[keyPath] = typeof defaultValue === 'boolean' ? defaultValue : false;

      return;
    }

    if (widget === 'relation' || widget === 'select') {
      const { multiple = false } = /** @type {RelationField | SelectField} */ (fieldConfig);

      if (multiple) {
        newContent[keyPath] = isArray ? defaultValue : [];

        return;
      }
    }

    newContent[keyPath] = defaultValue !== undefined ? defaultValue : '';
  };

  fields.forEach((_field) => {
    getDefaultValue({
      keyPath: _field.name,
      fieldConfig: _field,
    });
  });

  return unflatten(newContent);
};

/**
 * Create a Proxy that automatically copies a field value to other locale if the field’s i18n
 * strategy is “duplicate.”
 * @param {object} args Arguments.
 * @param {EntryDraft | any} args.draft Entry draft.
 * @param {string} args.prop Property name in the {@link entryDraft} store that contains a
 * locale/Proxy map.
 * @param {string} args.locale Source locale.
 * @param {object} [args.target] Target object.
 * @param {() => FlattenedEntryContent} [args.getValueMap] Optional function to get an object
 * holding the current entry values. It will be used for the `valueMap` argument of
 * {@link getFieldByKeyPath}. If omitted, the proxy target will be used instead.
 * @returns {Proxy<object>} Created proxy.
 */
const createProxy = ({
  draft: { collectionName, fileName },
  prop: entryDraftProp,
  locale: sourceLocale,
  target = {},
  getValueMap = undefined,
}) => {
  const collection = getCollection(collectionName);
  const { defaultLocale = 'default' } = collection._i18n;

  return new Proxy(target, {
    // eslint-disable-next-line jsdoc/require-jsdoc
    set: (obj, /** @type {string} */ keyPath, value) => {
      const valueMap = typeof getValueMap === 'function' ? getValueMap() : obj;
      const fieldConfig = getFieldByKeyPath(collectionName, fileName, keyPath, valueMap);

      if (!fieldConfig) {
        return true;
      }

      // Copy value to other locales
      if (fieldConfig.i18n === 'duplicate' && sourceLocale === defaultLocale) {
        Object.entries(get(entryDraft)[entryDraftProp]).forEach(([targetLocale, content]) => {
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
 * @param {Entry | object} entry Entry to be edited, or a partial `Entry` object containing at least
 * the collection name for a new entry.
 * @param {{ [key: string]: string }} [defaultValues] Dynamic default values for a new entry passed
 * through URL parameters.
 */
export const createDraft = (entry, defaultValues) => {
  const { id, collectionName, fileName, locales } = entry;
  const isNew = id === undefined;
  const collection = getCollection(collectionName);
  const { hasLocales, locales: collectionLocales } = collection._i18n;

  const collectionFile = fileName
    ? collection.files?.find(({ name }) => name === fileName)
    : undefined;

  const { fields } = collectionFile || collection;
  const newContent = createNewContent(fields, defaultValues);
  const allLocales = hasLocales ? collectionLocales : ['default'];

  entryDraft.set({
    isNew: isNew && !fileName,
    collectionName,
    collection,
    fileName,
    collectionFile,
    originalEntry: isNew ? undefined : entry,
    originalValues: Object.fromEntries(
      allLocales.map((locale) => [locale, flatten(locales?.[locale]?.content || newContent)]),
    ),
    currentValues: Object.fromEntries(
      allLocales.map((locale) => [
        locale,
        allLocales.length
          ? createProxy({
              draft: { collectionName, fileName },
              prop: 'currentValues',
              locale,
              target: flatten(locales?.[locale]?.content || newContent),
            })
          : flatten(locales?.[locale]?.content || newContent),
      ]),
    ),
    files: Object.fromEntries(
      allLocales.map((locale) => [
        locale,
        allLocales.length
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
 * @param {Proxy | object} obj Original proxy or object.
 * @returns {object} Processed object.
 */
const unflattenObj = (obj) => unflatten(JSON.parse(JSON.stringify(obj)));

/**
 * Traverse the given object by decoding dot-connected `keyPath`.
 * @param {object} obj Unflatten object.
 * @param {string} keyPath Dot-connected field name.
 * @returns {object[]} Values.
 */
const getItemList = (obj, keyPath) =>
  keyPath.split('.').reduce((_obj, key) => {
    const _key = key.match(/^\d+$/) ? Number(key) : key;

    // Create a new array when adding a new item
    _obj[_key] ||= [];

    return _obj[_key];
  }, obj);

/**
 * Update the value in a list field.
 * @param {LocaleCode} locale Target locale.
 * @param {string} keyPath Dot-connected field name.
 * @param {({ valueList, viewList }) => void} manipulate A function to manipulate the list, which
 * takes one object argument containing the value list and view state list. The typical usage is
 * `list.splice()`.
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
      [locale]: createProxy({
        draft,
        prop: 'currentValues',
        locale,
        target: flatten(currentValues),
      }),
    },
    viewStates: {
      ...draft.viewStates,
      [locale]: flatten(viewStates),
    },
  }));
};

/**
 * Copy or translate field value(s) from another locale.
 * @param {string} sourceLocale Source locale, e.g. `en`.
 * @param {string} targetLocale Target locale, e.g. `ja`.
 * @param {string} [keyPath] Flattened (dot-connected) object keys that will be used for searching
 * the source values. Omit this if copying all the fields. If the triggered widget is List or
 * Object, this will likely match multiple fields.
 * @param {boolean} [translate] Whether to translate the copied text fields.
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
      const field = getFieldByKeyPath(collectionName, fileName, _keyPath, valueMap);

      // prettier-ignore
      if (
        (keyPath && !_keyPath.startsWith(keyPath)) ||
        typeof value !== 'string' ||
        !['markdown', 'text', 'string', 'list'].includes(field?.widget) ||
        (field?.widget === 'list' &&
          (/** @type {ListField} */ (field).field || /** @type {ListField} */ (field).fields)) ||
        (!translate && value === currentValues[targetLocale][_keyPath])
      ) {
        return false;
      }

      return true;
    }),
  );

  if (!Object.keys(copingFields).length) {
    return;
  }

  if (translate) {
    const apiKey = get(prefs).apiKeys?.[get(translator)?.serviceId];

    if (!apiKey) {
      return;
    }

    try {
      const translatedValues = await get(translator).translate(Object.values(copingFields), {
        apiKey,
        sourceLocale,
        targetLocale,
      });

      Object.keys(copingFields).forEach((_keyPath, index) => {
        currentValues[targetLocale][_keyPath] = translatedValues[index];
      });
    } catch {
      // @todo Show an error message.
      // @see https://www.deepl.com/docs-api/api-access/error-handling/
    }
  } else {
    Object.entries(copingFields).forEach(([_keyPath, value]) => {
      currentValues[targetLocale][_keyPath] = value;
    });
  }

  entryDraft.update((_entryDraft) => ({ ..._entryDraft, currentValues }));
};

/**
 * Revert the changes made to the given field or all the fields to the default value(s).
 * @param {string} [locale] Target locale, e.g. `ja`. Can be empty if reverting everything.
 * @param {string} [keyPath] Flattened (dot-connected) object keys that will be used for searching
 * the source values. Omit this if copying all the fields. If the triggered widget is List or
 * Object, this will likely match multiple fields.
 */
export const revertChanges = (locale = '', keyPath = '') => {
  const { collection, fileName, currentValues, originalValues } = get(entryDraft);
  const { hasLocales, locales: collectionLocales, defaultLocale = 'default' } = collection._i18n;
  // eslint-disable-next-line no-nested-ternary
  const locales = locale ? [locale] : hasLocales ? collectionLocales : ['default'];

  /**
   * Revert changes.
   * @param {LocaleCode} _locale Iterating locale.
   * @param {FlattenedEntryContent} valueMap Flattened entry content.
   * @param {boolean} reset Whether ro remove the current value.
   */
  const revert = (_locale, valueMap, reset = false) => {
    Object.entries(valueMap).forEach(([_keyPath, value]) => {
      if (!keyPath || _keyPath.startsWith(keyPath)) {
        const fieldConfig = getFieldByKeyPath(collection.name, fileName, _keyPath, valueMap);

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
 */
const validateEntry = () => {
  const { collection, fileName, currentValues, validities } = get(entryDraft);
  const { hasLocales, defaultLocale = 'default' } = collection._i18n;
  let validated = true;

  Object.entries(currentValues).forEach(([locale, valueMap]) => {
    const valueEntries = Object.entries(valueMap);

    valueEntries.forEach(([keyPath, value]) => {
      const fieldConfig = getFieldByKeyPath(collection.name, fileName, keyPath, valueMap);

      if (!fieldConfig) {
        return;
      }

      const arrayMatch = keyPath.match(/\.(\d+)$/);
      // @ts-ignore
      const { widget, required = true, i18n = false, pattern, min, max } = fieldConfig;
      const canTranslate = hasLocales && (i18n === true || i18n === 'translate');
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
            .filter((val) => val !== undefined) || [];

        if (_required && !values.length) {
          valueMissing = true;
        }

        if (min && Array.isArray(value) && value.length < min) {
          rangeUnderflow = true;
        }

        if (max && Array.isArray(value) && value.length > max) {
          rangeOverflow = true;
        }
      }

      if (!['object', 'list'].includes(widget)) {
        if (_required && (value === undefined || value === '')) {
          valueMissing = true;
        }

        if (
          Array.isArray(pattern) &&
          pattern.length === 2 &&
          !String(value).match(new RegExp(escapeRegExp(pattern[0])))
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
 * Determine the file path for the given entry draft depending on the collection type, i18n config
 * and folder collections path.
 * @param {EntryDraft} draft Entry draft.
 * @param {LocaleCode} locale Locale code.
 * @param {string} slug Entry slug.
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

  const { structure, defaultLocale } = collection._i18n;
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

  const extension = getFileExtension(collection);
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
 * @throws {Error} When the entry could not be validated or saved.
 */
export const saveEntry = async () => {
  if (!validateEntry()) {
    throw new Error('validation_failed');
  }

  const _user = get(user);
  const draft = get(entryDraft);

  const {
    collection,
    isNew,
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
    _i18n: { structure, hasLocales, locales, defaultLocale = 'default' },
  } = collection;

  const fillSlugOptions = { collection, content: currentValues[defaultLocale] };
  const slug = fileName || originalEntry?.slug || fillSlugTemplate(slugTemplate, fillSlugOptions);

  const { internalAssetFolder, publicAssetFolder } = getAssetFolder(collection, {
    ...fillSlugOptions,
    currentSlug: slug,
    isMediaFolder: true,
    entryFilePath: createEntryPath(draft, defaultLocale, slug),
  });

  const assetsInSameFolder = get(allAssets)
    .map((a) => a.path)
    .filter((p) => p.match(new RegExp(`^\\/${escapeRegExp(internalAssetFolder)}\\/[^\\/]+$`)));

  /**
   * @type {SavingFile[]}
   */
  const savingFiles = [];
  /**
   * @type {Asset[]}
   */
  const savingAssets = [];

  const savingAssetProps = {
    text: null,
    collectionName,
    folder: internalAssetFolder,
    commitAuthor: _user.email ? { name: _user.name, email: _user.email } : null,
    commitDate: new Date(), // Use the current datetime
  };

  /**
   * @type {{ [key: LocaleCode]: LocalizedEntry }}
   */
  const savingEntryLocales = Object.fromEntries(
    await Promise.all(
      Object.entries(currentValues).map(async ([locale, valueMap]) => {
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

          const [, mimeType, base64] = value.match(/^data:(.+?\/.+?);base64,(.+)/) || [];

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

            const path = `${internalAssetFolder}/${_fileName}`;

            savingFiles.push({ path, data: file, base64 });

            savingAssets.push({
              ...savingAssetProps,
              url: URL.createObjectURL(file),
              name: _fileName,
              path,
              sha,
              size: file.size,
              kind: getAssetKind(_fileName),
            });

            valueMap[keyPath] = publicAssetFolder ? `${publicAssetFolder}/${_fileName}` : _fileName;
          }
        }

        const content = unflatten(valueMap);
        const sha = await getHash(new Blob([content], { type: 'text/plain' }));
        const path = createEntryPath(draft, locale, slug);

        return [locale, { content, sha, path }];
      }),
    ),
  );

  /**
   * @type {Entry}
   */
  const savingEntry = {
    id: `${collectionName}/${fileName}/${slug}`,
    collectionName,
    fileName,
    slug,
    sha: savingEntryLocales[defaultLocale].sha,
    locales: savingEntryLocales,
  };

  const {
    extension,
    format,
    frontmatter_delimiter: frontmatterDelimiter,
    yaml_quote: yamlQuote,
  } = collection;

  const config = { extension, format, frontmatterDelimiter, yamlQuote };

  if (collectionFile || !hasLocales || structure === 'single_file') {
    const { path, content } = savingEntryLocales[defaultLocale];

    savingFiles.push({
      slug,
      path,
      data: formatEntryFile({
        content: hasLocales
          ? Object.fromEntries(
              Object.entries(savingEntryLocales).map(([locale, le]) => [locale, le.content]),
            )
          : content,
        path,
        config,
      }),
    });
  } else {
    locales.map(async (locale) => {
      const { path, content } = savingEntryLocales[locale];

      savingFiles.push({
        slug,
        path,
        data: formatEntryFile({
          content,
          path,
          config,
        }),
      });
    });
  }

  try {
    await get(backend).saveFiles(savingFiles, {
      commitType: isNew ? 'create' : 'update',
      collection: collectionName,
    });
  } catch {
    throw new Error('saving_failed');
  }

  const savingAssetsPaths = savingAssets.map((a) => a.path);

  allEntries.update((entries) => [
    ...entries.filter((e) => !(e.collectionName === collectionName && e.slug === slug)),
    savingEntry,
  ]);

  allAssets.update((assets) => [
    ...assets.filter((a) => !savingAssetsPaths.includes(a.path)),
    ...savingAssets,
  ]);

  entryDraft.set(null);
};

entryDraft.subscribe((draft) => {
  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('entryDraft', draft);
  }
});

selectAssetsView.subscribe((view) => {
  const savedView = get(entryEditorSettings).selectAssetsView || {};

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
