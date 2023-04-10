/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-continue */

import equal from 'deep-is';
import { flatten, unflatten } from 'flat';
import { get, writable } from 'svelte/store';
import { allAssets, getAssetFolder, getAssetKind } from '$lib/services/assets';
import { user } from '$lib/services/auth';
import { backend } from '$lib/services/backends';
import { defaultContentLocale, siteConfig } from '$lib/services/config';
import { allEntries, getCollection, getEntries, getFieldByKeyPath } from '$lib/services/contents';
import { translator } from '$lib/services/integrations/translators';
import { formatEntryFile, getFileExtension } from '$lib/services/parser';
import { prefs } from '$lib/services/prefs';
import { getDateTimeParts } from '$lib/services/utils/datetime';
import { getHash, renameIfNeeded } from '$lib/services/utils/files';
import LocalStorage from '$lib/services/utils/local-storage';
import { escapeRegExp } from '$lib/services/utils/strings';

const storageKey = 'sveltia-cms.entry-view';

export const editorLeftPane = writable({});
export const editorRightPane = writable({});

export const entryViewSettings = writable({}, (set) => {
  (async () => {
    set((await LocalStorage.get(storageKey)) || { showPreview: true, syncScrolling: true });
  })();
});

/** @type {import('svelte/store').Writable<EntryDraft>} */
export const entryDraft = writable();

/**
 * Create a new entry content with default values populated.
 *
 * @param {object[]} fields Field list of a collection.
 * @returns {EntryContent} Entry content.
 */
const createNewContent = (fields) => {
  const newContent = {};

  // eslint-disable-next-line jsdoc/require-jsdoc
  const getDefaultValue = ({ fieldConfig, keyPath }) => {
    const { widget, default: defaultValue, fields: subFields, field: subField } = fieldConfig;

    if (widget === 'list') {
      if (subFields || subField) {
        (defaultValue || []).forEach((items, index) => {
          Object.entries(items).forEach(([key, val]) => {
            newContent[[keyPath, index, key].join('.')] = val;
          });
        });
      } else {
        (defaultValue || []).forEach((val, index) => {
          newContent[[keyPath, index].join('.')] = val;
        });
      }
    } else if (widget === 'object') {
      subFields.forEach((_subField) => {
        getDefaultValue({
          keyPath: [keyPath, _subField.name].join('.'),
          fieldConfig: _subField,
        });
      });
      // @todo Figure out how to set the default
    } else {
      newContent[keyPath] = defaultValue;
    }
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
 *
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.prop Property name in the {@link entryDraft} store that contains a
 * locale/Proxy map.
 * @param {string} args.locale Source locale.
 * @param {object} [args.target] Target object.
 * @returns {Proxy.<object>} Created proxy.
 */
const createProxy = ({
  draft: { collectionName, fileName },
  prop: entryDraftProp,
  locale: sourceLocale,
  target = {},
}) => {
  const defaultLocale = get(defaultContentLocale);

  return new Proxy(target, {
    // eslint-disable-next-line jsdoc/require-jsdoc
    set: (obj, keyPath, value) => {
      const fieldConfig = getFieldByKeyPath(collectionName, fileName, keyPath, obj);

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
 *
 * @param {string} collectionName Collection name.
 * @param {Entry} [entry] Entry to be edited or `undefined` for a new entry.
 */
export const createDraft = (collectionName, entry) => {
  const { i18n } = get(siteConfig);
  const collection = getCollection(collectionName);
  const isNew = !entry;
  const { slug, fileName, locales } = entry || {};

  const collectionFile = fileName
    ? collection.files?.find(({ name }) => name === fileName)
    : undefined;

  const { fields } = collectionFile || collection;
  const newContent = createNewContent(fields);
  const allLocales = i18n?.locales || ['default'];

  entryDraft.set({
    isNew,
    slug,
    collectionName,
    collection,
    fileName,
    collectionFile,
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
            })
          : {},
      ]),
    ),
    validities: Object.fromEntries(allLocales.map((locale) => [locale, {}])),
  });
};

/**
 * Update the value in a list field.
 *
 * @param {LocaleCode} locale Target locale.
 * @param {string} keyPath Dot-connected field name.
 * @param {Function} manipulate A function to manipulate the list, which takes one argument of the
 * list itself. The typical usage is `list.splice()`.
 */
export const updateListField = (locale, keyPath, manipulate) => {
  const unflattenObj = unflatten(get(entryDraft).currentValues[locale]);

  // Traverse the object by decoding dot-connected `keyPath`
  const list = keyPath.split('.').reduce((obj, key) => {
    const _key = key.match(/^\d+$/) ? Number(key) : key;

    // Create a new array when adding a new item
    obj[_key] ||= [];

    return obj[_key];
  }, unflattenObj);

  manipulate(list);

  entryDraft.update((draft) => ({
    ...draft,
    currentValues: {
      ...draft.currentValues,
      // Flatten & proxify the object again
      [locale]: createProxy({
        draft,
        prop: 'currentValues',
        locale,
        target: flatten(unflattenObj),
      }),
    },
  }));
};

/**
 * Copy or translate field value(s) from another locale.
 *
 * @param {string} sourceLocale Source locale, e.g. `en`.
 * @param {string} targetLocale Target locale, e.g. `ja.
 * @param {string} [keyPath] Flatten (dot-connected) object keys that will be used for searching the
 * source values. Omit this if copying all the fields. If the triggered widget is List or Object,
 * this will likely match multiple fields.
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

      if (
        (keyPath && !_keyPath.startsWith(keyPath)) ||
        typeof value !== 'string' ||
        !['markdown', 'text', 'string', 'list'].includes(field?.widget) ||
        (field?.widget === 'list' && (field?.field || field?.fields)) ||
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
 *
 * @param {string} [locale] Target locale, e.g. `ja. Can be empty if reverting everything.
 * @param {string} [keyPath] Flatten (dot-connected) object keys that will be used for searching the
 * source values. Omit this if copying all the fields. If the triggered widget is List or Object,
 * this will likely match multiple fields.
 */
export const revertChanges = (locale = '', keyPath = '') => {
  const locales = locale ? [locale] : get(siteConfig).i18n?.locales || ['default'];
  const { currentValues, originalValues } = get(entryDraft);

  locales.forEach((_locale) => {
    Object.keys(currentValues[_locale]).forEach((_keyPath) => {
      if (!keyPath || _keyPath.startsWith(keyPath)) {
        currentValues[_locale][_keyPath] = undefined;
      }
    });

    Object.entries(originalValues[_locale]).forEach(([_keyPath, value]) => {
      if (!keyPath || _keyPath.startsWith(keyPath)) {
        currentValues[_locale][_keyPath] = value;
      }
    });
  });

  entryDraft.update((_entryDraft) => ({ ..._entryDraft, currentValues }));
};

/**
 * Validate the current entry draft, update the validity for all the fields, and return the final
 * results as a boolean. Mimic the native `ValidityState` API.
 *
 * @returns {boolean} Whether the draft is valid.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/ValidityState
 */
const validateEntry = () => {
  const { collectionName, fileName, currentValues, validities } = get(entryDraft);
  let validated = true;

  Object.entries(currentValues).forEach(([locale, valueMap]) => {
    const valueEntries = Object.entries(valueMap);

    valueEntries.forEach(([keyPath, value]) => {
      const fieldConfig = getFieldByKeyPath(collectionName, fileName, keyPath, valueMap);

      if (!fieldConfig) {
        return;
      }

      const arrayMatch = keyPath.match(/\.(\d+)$/);
      const { widget, required = true, pattern, min, max } = fieldConfig;
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

        if (required && !values.length) {
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
        if (required !== false && (value === undefined || value === '')) {
          valueMissing = true;
        }

        if (
          Array.isArray(pattern) &&
          pattern.length === 2 &&
          !String.value.match(new RegExp(escapeRegExp(pattern[0])))
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
 * Create a slug for the current entry draft.
 *
 * @param {object} collection Collection
 * @param {EntryDraft} draft Draft.
 * @returns {string} Slug.
 * @see https://www.netlifycms.org/docs/configuration-options/#slug-type
 * @see https://www.netlifycms.org/docs/configuration-options/#slug
 */
const createSlug = (collection, draft) => {
  const defaultLocale = get(defaultContentLocale);
  const { currentValues } = draft;

  const {
    slug: {
      encoding = 'unicode',
      clean_accents: cleanAccents = false,
      sanitize_replacement: sanitizeReplacement = '-',
    } = {},
  } = get(siteConfig);

  const { slug: slugTemplate = '{{title}}', identifier_field: identifierField = 'title' } =
    collection;

  const dateTimeParts = getDateTimeParts();

  /** @type {string} */
  let slug = slugTemplate.replaceAll(/{{(.+?)}}/g, (_match, tag) => {
    if (tag.startsWith('fields.')) {
      return currentValues[defaultLocale][tag.replace(/^fields\./, '')] || '';
    }

    if (['year', 'month', 'day', 'hour', 'minute', 'second'].includes(tag)) {
      return dateTimeParts[tag];
    }

    if (tag === 'slug') {
      return currentValues[defaultLocale][identifierField] || '';
    }

    if (tag === 'uuid') {
      return window.crypto.randomUUID();
    }

    if (tag === 'uuid_short') {
      return window.crypto.randomUUID().split('-').pop();
    }

    return currentValues[defaultLocale][tag] || '';
  });

  if (cleanAccents) {
    // Remove any accent @see https://stackoverflow.com/q/990904
    slug = slug.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  if (encoding === 'ascii') {
    slug = slug.replaceAll(/[^\w-~]/g, ' ');
  } else {
    // Allow Unicode letters and numbers @see https://stackoverflow.com/q/280712
    slug = slug.replaceAll(/[^\p{L}\p{N}]/gu, ' ');
  }

  // Make the string lowercase; replace all the spaces with replacers (hyphens by default)
  slug = slug.toLocaleLowerCase().trim().replaceAll(/\s+/g, sanitizeReplacement);

  if (!slug) {
    // Use a random slug as a fallback
    return window.crypto.randomUUID().split('-').pop();
  }

  return renameIfNeeded(
    slug,
    getEntries(collection.name).map((e) => e.slug),
  );
};

/**
 * Save the entry draft.
 *
 * @throws {Error} When the entry could not be validated or saved.
 */
export const saveEntry = async () => {
  if (!validateEntry()) {
    throw new Error('validation_failed');
  }

  const _user = get(user);
  const { i18n } = get(siteConfig);
  const hasLocales = Array.isArray(i18n?.locales);
  const defaultLocale = get(defaultContentLocale);
  const draft = get(entryDraft);

  const {
    collection,
    isNew,
    slug: originalSlug,
    collectionName,
    collectionFile,
    fileName,
    currentValues,
    files,
  } = draft;

  const collectionFolder = collection.folder?.replace(/\/$/, '');
  const slug = originalSlug || createSlug(collection, draft);
  const extension = getFileExtension(collection);

  const { internalPath: internalAssetFolder, publicPath: publicAssetFolder } =
    getAssetFolder(collectionName);

  const assetsInSameFolder = get(allAssets)
    .map((a) => a.path)
    .filter((p) => p.match(new RegExp(`^\\/${escapeRegExp(internalAssetFolder)}\\/[^\\/]+$`)));

  const savingFiles = [];
  /** @type {Asset[]} */
  const savingAssets = [];

  const savingAssetProps = {
    text: null,
    collectionName,
    folder: internalAssetFolder,
    commitAuthor: _user.email ? { name: _user.name, email: _user.email } : null,
    commitDate: new Date(), // Use the current datetime
  };

  /** @type {Object<LocaleCode, LocalizedEntry>} */
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

                return new File([blob], `${type}-${Date.now()}.${subtype}`, { type: mimeType });
              })());

            const sha = await getHash(file);
            const dupFile = savingAssets.find((f) => f.sha === sha);

            // Check if the file has already been added for other field or locale
            if (dupFile) {
              valueMap[keyPath] = `${publicAssetFolder}/${dupFile.name}`;

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
              name: _fileName,
              path,
              sha,
              size: file.size,
              kind: getAssetKind(_fileName),
              tempURL: URL.createObjectURL(file),
            });

            valueMap[keyPath] = `${publicAssetFolder}/${_fileName}`;
          }
        }

        const pathOptions = {
          multiple_folders: `${collectionFolder}/${locale}/${slug}.${extension}`,
          multiple_files: `${collectionFolder}/${slug}.${locale}.${extension}`,
          single_file: `${collectionFolder}/${slug}.${extension}`,
        };

        const content = unflatten(valueMap);
        const sha = await getHash(new Blob([content], { type: 'text/plain' }));

        const path =
          collectionFile?.file || pathOptions[i18n?.structure] || pathOptions.single_file;

        return [locale, { content, sha, path }];
      }),
    ),
  );

  /** @type {Entry} */
  const savingEntry = {
    collectionName,
    fileName,
    slug,
    sha: savingEntryLocales[defaultLocale].sha,
    locales: savingEntryLocales,
  };

  if (collectionFile || !hasLocales || i18n?.structure === 'single_file') {
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
        config: collectionFile
          ? { extension: (collectionFile?.file.match(/\.([a-zA-Z0-9]+)$/) || [])[1] }
          : collection,
      }),
    });
  } else {
    i18n?.locales.map(async (locale) => {
      const { path, content } = savingEntryLocales[locale];

      savingFiles.push({
        slug,
        path,
        data: formatEntryFile({
          content,
          path,
          config: collection,
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

if (import.meta.env.DEV) {
  entryDraft.subscribe((draft) => {
    // eslint-disable-next-line no-console
    console.info('entryDraft', draft);
  });
}

entryViewSettings.subscribe((settings) => {
  (async () => {
    try {
      if (settings && !equal(settings, LocalStorage.get(storageKey))) {
        await LocalStorage.set(storageKey, settings);
      }
    } catch {
      //
    }
  })();
});
