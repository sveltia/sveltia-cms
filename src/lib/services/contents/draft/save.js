/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-continue */

import { getHash } from '@sveltia/utils/crypto';
import { escapeRegExp } from '@sveltia/utils/string';
import { unflatten } from 'flat';
import { get } from 'svelte/store';
import { validateStringField } from '$lib/components/contents/details/widgets/string/helper';
import { allAssetFolders, allAssets, getAssetKind } from '$lib/services/assets';
import { backend, backendName } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { contentUpdatesToast } from '$lib/services/contents/data';
import { entryDraft } from '$lib/services/contents/draft';
import { deleteBackup } from '$lib/services/contents/draft/backup';
import { expandInvalidFields } from '$lib/services/contents/draft/editor';
import { getFieldConfig } from '$lib/services/contents/entry';
import { fillSlugTemplate } from '$lib/services/contents/slug';
import { formatEntryFile, getFileExtension } from '$lib/services/parser';
import { user } from '$lib/services/user';
import { createPath, renameIfNeeded, resolvePath } from '$lib/services/utils/file';

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

      const arrayMatch = keyPath.match(/\.(\d+)$/);
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

      // Given that values for an array field are flatten into `field.0`, `field.1` ... `field.n`,
      // we should validate only once against all these values
      if (widgetName === 'list' || arrayMatch) {
        if (arrayMatch) {
          keyPath = keyPath.replace(/\.\d+$/, '');
        }

        if (keyPath in validities[locale]) {
          return;
        }

        const keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`);
        const values =
          Array.isArray(value) && value.length
            ? value
            : valueEntries
                .filter(([_keyPath]) => _keyPath.match(keyPathRegex))
                .map(([, savedValue]) => savedValue)
                .filter((val) => val !== undefined) ?? [];

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
          // `/^.{0,280}$/s` // cspell:disable-next-line
          const [, pattern, flags] = validation[0].match(/^\/?(.+?)(?:\/([dgimsuvy]*))?$/) || [];

          if (pattern && !String(value).match(new RegExp(pattern, flags))) {
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

      const validity = {
        valueMissing,
        tooShort,
        tooLong,
        rangeUnderflow,
        rangeOverflow,
        patternMismatch,
        typeMismatch,
      };
      const valid = !Object.values(validity).some(Boolean);

      validities[locale][keyPath] = { ...validity, valid };

      if (!valid) {
        validated = false;
      }
    });
  });

  /** @type {import('svelte/store').Writable<EntryDraft>} */ (entryDraft).update((_draft) => ({
    ..._draft,
    validities,
  }));

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
 * @see https://decapcms.org/docs/i18n/
 */
const createEntryPath = (draft, locale, slug) => {
  const { collection, collectionFile, originalEntry, currentValues } = draft;

  if (collectionFile) {
    return collectionFile.file;
  }

  if (originalEntry?.locales[locale]) {
    return originalEntry.locales[locale].path;
  }

  const { defaultLocale, structure } = collection._i18n;
  const collectionFolder = collection.folder;
  /**
   * Support folder collections path.
   * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
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
    expandInvalidFields();

    throw new Error('validation_failed');
  }

  const _user = /** @type {User} */ (get(user));
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
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
  const {
    i18nEnabled,
    locales,
    defaultLocale,
    structure,
    canonicalSlug: { key: canonicalSlugKey, value: canonicalSlugTemplate },
  } = (collectionFile ?? collection)._i18n;
  const fillSlugOptions = { collection, content: currentValues[defaultLocale] };
  /**
   * The slug of the default locale.
   */
  const defaultLocaleSlug =
    fileName ?? originalEntry?.slug ?? fillSlugTemplate(slugTemplate, fillSlugOptions);
  /**
   * List of key paths that the value will be localized.
   */
  const localizingKeyPaths = [...slugTemplate.matchAll(/{{(?:fields\.)?(.+?) \| localize}}/g)].map(
    ([, keyPath]) => keyPath,
  );
  /**
   * Localized slug map. This only applies when the i18n structure is multiple files or folders, and
   * the slug template contains the `localize` flag, e.g. `{{title | localize}}`.
   */
  const localizedSlugs =
    structure === 'single_file' || !localizingKeyPaths.length
      ? undefined
      : Object.fromEntries(
          Object.entries(currentLocales)
            .filter(([, enabled]) => enabled)
            .map(([locale]) => [
              locale,
              locale === defaultLocale
                ? defaultLocaleSlug
                : fillSlugTemplate(slugTemplate, {
                    collection,
                    content: {
                      // Merge the default locale content and localized content
                      ...currentValues[defaultLocale],
                      ...Object.fromEntries(
                        localizingKeyPaths.map((keyPath) => [
                          keyPath,
                          currentValues[locale][keyPath],
                        ]),
                      ),
                    },
                  }),
            ]),
        );
  /**
   * A canonical slug to be added to the content of each file when the slug is localized. It helps
   * Sveltia CMS and some frameworks to link localized files. The default property name is
   * `translationKey` used in Hugo’s multilingual support, and the default value is the default
   * locale’s slug.
   * @see https://github.com/sveltia/sveltia-cms#localizing-entry-slugs
   * @see https://gohugo.io/content-management/multilingual/#bypassing-default-linking
   */
  // eslint-disable-next-line no-nested-ternary
  const canonicalSlug = !localizedSlugs
    ? undefined
    : canonicalSlugTemplate === '{{slug}}'
      ? defaultLocaleSlug
      : fillSlugTemplate(canonicalSlugTemplate, {
          ...fillSlugOptions,
          currentSlug: defaultLocaleSlug,
        });
  const { internalAssetFolder, publicAssetFolder } = getEntryAssetFolderPaths({
    ...fillSlugOptions,
    type: 'media_folder',
    currentSlug: defaultLocaleSlug,
    entryFilePath: createEntryPath(draft, defaultLocale, defaultLocaleSlug),
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
    commitAuthor: _user.email
      ? /** @type {CommitAuthor} */ ({ name: _user.name, email: _user.email })
      : undefined,
    commitDate: new Date(), // Use the current datetime
  };
  /**
   * @type {Record<LocaleCode, LocalizedEntry>}
   */
  const savingEntryLocales = Object.fromEntries(
    await Promise.all(
      Object.entries(currentValues).map(async ([locale, valueMap]) => {
        const localizedSlug = localizedSlugs?.[locale];
        const slug = localizedSlug ?? defaultLocaleSlug;
        const path = createEntryPath(draft, locale, slug);

        if (!currentLocales[locale]) {
          return [locale, { path }];
        }

        // Add the canonical slug if it doesn’t exist in the content
        if (!valueMap[canonicalSlugKey] && canonicalSlug) {
          valueMap[canonicalSlugKey] = canonicalSlug;
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

            const _fileName = renameIfNeeded(file.name.normalize(), [
              ...assetsInSameFolder,
              ...savingAssets.map((a) => a.name),
            ]);
            const assetPath = `${internalAssetFolder}/${_fileName}`;

            changes.push({ action: 'create', path: assetPath, data: file, base64 });

            savingAssets.push({
              ...savingAssetProps,
              blobURL: URL.createObjectURL(file),
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

        return [locale, { slug, path, sha, content }];
      }),
    ),
  );
  /**
   * @type {Entry}
   */
  const savingEntry = {
    id: `${collectionName}/${defaultLocaleSlug}`,
    collectionName,
    fileName,
    slug: defaultLocaleSlug,
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
      slug: defaultLocaleSlug,
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
      const { slug, path, content } = savingEntryLocales[locale];

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
    await /** @type {BackendService} */ (get(backend)).commitChanges(changes, {
      commitType: isNew ? 'create' : 'update',
      collection,
      skipCI,
    });
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    throw new Error('saving_failed', { cause: ex });
  }

  const savingAssetsPaths = savingAssets.map((a) => a.path);

  allEntries.update((entries) => [...entries.filter((e) => e.id !== savingEntry.id), savingEntry]);

  allAssets.update((assets) => [
    ...assets.filter((a) => !savingAssetsPaths.includes(a.path)),
    ...savingAssets,
  ]);

  entryDraft.set(null);

  const isLocal = get(backendName) === 'local';
  const { backend: { automatic_deployments: autoDeployEnabled = undefined } = {} } =
    get(siteConfig) ?? /** @type {SiteConfig} */ ({});

  contentUpdatesToast.set({
    count: 1,
    saved: true,
    published: !isLocal && (skipCI === undefined ? autoDeployEnabled === true : skipCI === false),
  });

  deleteBackup(collectionName, defaultLocaleSlug);
};
