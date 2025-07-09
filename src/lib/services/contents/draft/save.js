import { generateUUID, getHash } from '@sveltia/utils/crypto';
import { getBlobRegex } from '@sveltia/utils/file';
import { isObject, toRaw } from '@sveltia/utils/object';
import { compare, escapeRegExp, stripSlashes } from '@sveltia/utils/string';
import { unflatten } from 'flat';
import { TomlDate } from 'smol-toml';
import { get } from 'svelte/store';
import {
  allAssets,
  getAssetKind,
  getAssetsByDirName,
  globalAssetFolder,
} from '$lib/services/assets';
import { getDefaultMediaLibraryOptions } from '$lib/services/assets/media-library';
import { backend, isLastCommitPublished } from '$lib/services/backends';
import { fillSlugTemplate } from '$lib/services/common/slug';
import { siteConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import {
  contentUpdatesToast,
  UPDATE_TOAST_DEFAULT_STATE,
} from '$lib/services/contents/collection/data';
import { getIndexFile } from '$lib/services/contents/collection/index-file';
import { entryDraft } from '$lib/services/contents/draft';
import { deleteBackup } from '$lib/services/contents/draft/backup';
import { expandInvalidFields } from '$lib/services/contents/draft/editor';
import { getFillSlugOptions, getSlugs } from '$lib/services/contents/draft/slugs';
import { validateEntry } from '$lib/services/contents/draft/validate';
import { getField, isFieldRequired } from '$lib/services/contents/entry/fields';
import { formatEntryFile } from '$lib/services/contents/file/format';
import { parseDateTimeConfig } from '$lib/services/contents/widgets/date-time/helper';
import { hasRootListField } from '$lib/services/contents/widgets/list/helper';
import { user } from '$lib/services/user';
import { FULL_DATE_TIME_REGEX } from '$lib/services/utils/date';
import { createPath, encodeFilePath, formatFileName, resolvePath } from '$lib/services/utils/file';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * BackendService,
 * CommitAuthor,
 * Entry,
 * EntryCollection,
 * EntryDraft,
 * EntrySlugVariants,
 * FileChange,
 * FillSlugTemplateOptions,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * LocalizedEntryMap,
 * RawEntryContent,
 * RepositoryFileMetadata,
 * User,
 * } from '$lib/types/private';
 * @import {
 * DateTimeField,
 * Field,
 * FieldKeyPath,
 * ListField,
 * ObjectField,
 * RelationField,
 * SelectField,
 * } from '$lib/types/public';
 */

/**
 * Resolved paths for entry assets.
 * @typedef {object} ResolvedAssetFolderPaths
 * @property {string} resolvedInternalPath Resolved `internalPath` with any template tags replaced.
 * May contain a sub path when assets are entry-relative.
 * @property {string} resolvedPublicPath Resolved `publicPath` with any template tags replaced.
 */

/**
 * Properties for a saving asset.
 * @typedef {object} SavingAssetProps
 * @property {string} collectionName Collection name.
 * @property {string} [text] Raw text for a plaintext file, like HTML or Markdown.
 * @property {AssetFolderInfo} folder Folder info.
 */

/**
 * Properties for a saving asset.
 * @typedef {SavingAssetProps & RepositoryFileMetadata} SavingAsset
 */

/**
 * Determine the file path for the given entry draft depending on the collection type, i18n config
 * and folder collections path.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {string} args.slug Entry slug.
 * @returns {string} Complete path, including the folder, slug, extension and possibly locale.
 * @see https://decapcms.org/docs/i18n/
 */
const createEntryPath = ({ draft, locale, slug }) => {
  const { collection, collectionFile, originalEntry, currentValues, isIndexFile } = draft;

  const {
    _i18n: { defaultLocale, structure, omitDefaultLocaleFromFileName },
  } = collectionFile ?? collection;

  const omitLocaleFromFileName = omitDefaultLocaleFromFileName && locale === defaultLocale;

  if (collectionFile) {
    const path = stripSlashes(collectionFile.file);

    return omitLocaleFromFileName
      ? path.replace('.{{locale}}', '')
      : path.replace('{{locale}}', locale);
  }

  if (originalEntry?.locales[locale]?.slug === slug) {
    return originalEntry.locales[locale].path;
  }

  const entryCollection = /** @type {EntryCollection} */ (collection);

  const {
    _file: { basePath, subPath, extension },
  } = entryCollection;

  /**
   * Support folder collections path.
   * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
   */
  const path = isIndexFile
    ? /** @type {string} */ (getIndexFile(entryCollection)?.name)
    : subPath
      ? fillSlugTemplate(subPath, {
          collection: entryCollection,
          locale,
          content: currentValues[defaultLocale],
          currentSlug: slug,
        })
      : slug;

  const pathOptions = {
    multiple_folders: `${basePath}/${locale}/${path}.${extension}`,
    multiple_folders_i18n_root: `${locale}/${basePath}/${path}.${extension}`,
    multiple_files: omitLocaleFromFileName
      ? `${basePath}/${path}.${extension}`
      : `${basePath}/${path}.${locale}.${extension}`,
    single_file: `${basePath}/${path}.${extension}`,
  };

  return pathOptions[structure] ?? pathOptions.single_file;
};

/**
 * Parse a field to generate a sorted key path list.
 * @param {object} args Arguments.
 * @param {Field} args.field Single field.
 * @param {FieldKeyPath} args.keyPath Key path of the field.
 * @param {FieldKeyPath[]} args.keyPathList Key path list.
 */
const parseField = ({ field, keyPath, keyPathList }) => {
  const { widget } = field;
  const isList = widget === 'list';

  keyPathList.push(keyPath);

  if (isList || widget === 'object') {
    const {
      fields: subFields,
      types,
      typeKey = 'type',
    } = /** @type {ListField | ObjectField} */ (field);

    if (subFields) {
      subFields.forEach((subField) => {
        parseField({
          field: subField,
          keyPath: isList ? `${keyPath}.*.${subField.name}` : `${keyPath}.${subField.name}`,
          keyPathList,
        });
      });
    } else if (types) {
      keyPathList.push(isList ? `${keyPath}.*.${typeKey}` : `${keyPath}.${typeKey}`);

      types.forEach((type) => {
        type.fields?.forEach((subField) => {
          parseField({
            field: subField,
            keyPath: isList ? `${keyPath}.*.${subField.name}` : `${keyPath}.${subField.name}`,
            keyPathList,
          });
        });
      });
    } else if (isList) {
      const { field: subField } = /** @type {ListField} */ (field);

      if (subField) {
        parseField({
          field: subField,
          keyPath: `${keyPath}.*`,
          keyPathList,
        });
      } else {
        keyPathList.push(`${keyPath}.*`);
      }
    }
  }

  if (widget === 'select' || widget === 'relation') {
    const { multiple = false } = /** @type {SelectField | RelationField} */ (field);

    keyPathList.push(multiple ? `${keyPath}.*` : keyPath);
  }
};

/**
 * Create a list of field names (flattened key path list) from the configured collection fields.
 * @param {Field[]} fields Field list of a collection or a file.
 * @returns {FieldKeyPath[]} Sorted key path list. List items are with `*`.
 * @example [`author.name`, `books.*.title`, `books.*.summary`, `publishDate`, `body`]
 */
const createKeyPathList = (fields) => {
  /** @type {FieldKeyPath[]} */
  const keyPathList = [];

  // Iterate over the top-level fields first
  fields.forEach((field) => {
    parseField({
      field,
      keyPath: field.name,
      keyPathList,
    });
  });

  return keyPathList;
};

/**
 * Move a property name/value from a unsorted property map to a sorted property map.
 * @param {object} args Arguments.
 * @param {string} args.key Property name.
 * @param {Field} [args.field] Associated field.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.unsortedMap Unsorted property map.
 * @param {FlattenedEntryContent} args.sortedMap Sorted property map.
 * @param {boolean} args.isTomlOutput Whether the output it TOML format.
 * @param {boolean} args.omitEmptyOptionalFields Whether to prevent fields with `required: false`
 * and an empty value from being included in the data output.
 */
export const copyProperty = ({
  key,
  field,
  locale,
  unsortedMap,
  sortedMap,
  isTomlOutput,
  omitEmptyOptionalFields,
}) => {
  let value = unsortedMap[key];

  // Use native date for TOML if a custom format is not defined
  // @see https://github.com/squirrelchat/smol-toml?tab=readme-ov-file#dates
  // @see https://toml.io/en/v1.0.0#offset-date-time
  if (
    isTomlOutput &&
    typeof value === 'string' &&
    FULL_DATE_TIME_REGEX.test(value) &&
    field?.widget === 'datetime' &&
    !parseDateTimeConfig(/** @type {DateTimeField} */ (field)).format
  ) {
    try {
      value = new TomlDate(value);
    } catch {
      //
    }
  }

  if (
    omitEmptyOptionalFields &&
    field &&
    !isFieldRequired({ fieldConfig: field, locale }) &&
    !Object.keys(unsortedMap).some((_key) => _key.startsWith(`${key}.`)) &&
    (!value ||
      (Array.isArray(value) && !value.length) ||
      (isObject(value) && !Object.keys(value).length))
  ) {
    // Omit the empty value
  } else {
    sortedMap[key] = value;
  }

  delete unsortedMap[key];
};

/**
 * Finalize the content by sorting the entry draft content’s object properties by the order of the
 * configured collection fields. The result can be formatted as expected with `JSON.stringify()`, as
 * the built-in method uses insertion order for string key ordering.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {Field[]} args.fields Field list of a collection or a file.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.valueMap Flattened entry content.
 * @param {string} [args.canonicalSlugKey] Property name of a canonical slug.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {boolean} [args.isTomlOutput] Whether the output it TOML format.
 * @returns {RawEntryContent} Unflattened entry content sorted by fields.
 */
const finalizeContent = ({
  collectionName,
  fileName,
  fields,
  locale,
  valueMap,
  canonicalSlugKey,
  isIndexFile = false,
  isTomlOutput = false,
}) => {
  /** @type {FlattenedEntryContent} */
  const unsortedMap = toRaw(valueMap);
  /** @type {FlattenedEntryContent} */
  const sortedMap = {};

  const { omit_empty_optional_fields: omitEmptyOptionalFields = false } =
    get(siteConfig)?.output ?? {};

  const getFieldArgs = { collectionName, fileName, valueMap, isIndexFile };
  const copyArgs = { locale, unsortedMap, sortedMap, isTomlOutput, omitEmptyOptionalFields };

  // Add the slug first
  if (canonicalSlugKey && canonicalSlugKey in unsortedMap) {
    copyProperty({ ...copyArgs, key: canonicalSlugKey });
  }

  // Move the listed properties to a new object
  createKeyPathList(fields).forEach((keyPath) => {
    const field = getField({ ...getFieldArgs, keyPath });

    if (keyPath in unsortedMap) {
      copyProperty({ ...copyArgs, key: keyPath, field });
    } else if (field?.widget === 'keyvalue') {
      // Work around a bug in the flat library where numeric property keys used for KeyValue fields
      // trigger a wrong conversion to an array instead of an object
      // @see https://github.com/hughsk/flat/issues/103
      sortedMap[keyPath] = {};

      // Copy key-value pairs
      Object.entries(unsortedMap)
        .filter(([_keyPath]) => _keyPath.startsWith(`${keyPath}.`))
        .forEach(([_keyPath]) => {
          copyProperty({ ...copyArgs, key: _keyPath, field });
        });
    } else {
      const regex = new RegExp(
        `^${escapeRegExp(keyPath.replaceAll('*', '\\d+')).replaceAll('\\\\d\\+', '\\d+')}$`,
      );

      Object.keys(unsortedMap)
        .filter((_keyPath) => regex.test(_keyPath))
        .sort(([a, b]) => compare(a, b))
        .forEach((_keyPath) => {
          copyProperty({ ...copyArgs, key: _keyPath, field });
        });
    }
  });

  // Move the remainder, if any, to a new object
  Object.keys(unsortedMap)
    .sort(([a, b]) => compare(a, b))
    .forEach((key) => {
      copyProperty({ ...copyArgs, key });
    });

  return unflatten(sortedMap);
};

/**
 * Serialize the content for the output.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.valueMap Original content.
 * @returns {RawEntryContent} Modified and unflattened content.
 */
const serializeContent = ({ draft, locale, valueMap }) => {
  const { collection, collectionName, collectionFile, fields, isIndexFile } = draft;

  const {
    _file,
    _i18n: {
      canonicalSlug: { key: canonicalSlugKey },
    },
  } = collectionFile ?? /** @type {EntryCollection} */ (collection);

  const content = finalizeContent({
    collectionName,
    fileName: collectionFile?.name,
    fields,
    locale,
    valueMap,
    canonicalSlugKey,
    isIndexFile,
    isTomlOutput: ['toml', 'toml-frontmatter'].includes(_file.format),
  });

  // Handle a special case: top-level list field
  if (hasRootListField(fields)) {
    return content[fields[0].name] ?? [];
  }

  return content;
};

/**
 * Get the internal/public asset path configuration for the entry assets.
 * @param {object} args Arguments.
 * @param {AssetFolderInfo} args.folder Asset folder associated with a new file.
 * @param {FillSlugTemplateOptions} args.fillSlugOptions Arguments for {@link fillSlugTemplate}.
 * @returns {ResolvedAssetFolderPaths} Determined paths.
 */
export const resolveAssetFolderPaths = ({ folder, fillSlugOptions }) => {
  const { entryRelative, internalPath, publicPath } = folder;

  if (internalPath === undefined || publicPath === undefined) {
    // This shouldn’t happen, but avoids type errors in the following code
    return { resolvedInternalPath: '', resolvedPublicPath: '' };
  }

  if (!entryRelative) {
    return {
      resolvedInternalPath: fillSlugTemplate(internalPath, fillSlugOptions),
      resolvedPublicPath: fillSlugTemplate(publicPath, fillSlugOptions),
    };
  }

  const { collection } = fillSlugOptions;

  const isMultiFolders = ['multiple_folders', 'multiple_folders_i18n_root'].includes(
    collection._i18n.structure,
  );

  const subPath =
    collection._type === 'entry'
      ? /** @type {EntryCollection} */ (collection)._file.subPath
      : undefined;

  const subPathFirstPart = subPath?.match(/(?<path>.+?)(?:\/[^/]+)?$/)?.groups?.path ?? '';

  return {
    resolvedInternalPath: resolvePath(
      fillSlugTemplate(
        createPath([
          internalPath,
          isMultiFolders || subPath?.includes('/') ? subPathFirstPart : undefined,
        ]),
        fillSlugOptions,
      ),
    ),
    resolvedPublicPath:
      !isMultiFolders && /^\.?$/.test(publicPath)
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
                    ...Array((subPath?.match(/\//g) ?? []).length + 1).fill('..'),
                    publicPath,
                    subPathFirstPart,
                  ])
                : publicPath,
              fillSlugOptions,
            ),
          ),
  };
};

/**
 * Get the information required to save an asset.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @param {AssetFolderInfo} args.folder Asset folder associated with a new file.
 * @returns {{ assetFolderPaths: ResolvedAssetFolderPaths, assetNamesInSameFolder: string[],
 * savingAssetProps: SavingAsset }} Arguments.
 */
const getAssetSavingInfo = ({ draft, defaultLocaleSlug, folder }) => {
  const { collection, collectionName, collectionFile, isIndexFile } = draft;

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? collection;

  const assetFolderPaths = resolveAssetFolderPaths({
    folder,
    fillSlugOptions: {
      ...getFillSlugOptions({ draft }),
      type: 'media_folder',
      currentSlug: defaultLocaleSlug,
      entryFilePath: createEntryPath({ draft, locale: defaultLocale, slug: defaultLocaleSlug }),
      isIndexFile,
    },
  });

  const { resolvedInternalPath } = assetFolderPaths;
  const { email, name } = /** @type {User} */ (get(user));

  return {
    assetFolderPaths,
    assetNamesInSameFolder: getAssetsByDirName(resolvedInternalPath).map((a) => a.name.normalize()),
    savingAssetProps: {
      text: undefined,
      collectionName,
      folder,
      commitAuthor: email ? /** @type {CommitAuthor} */ ({ name, email }) : undefined,
      commitDate: new Date(), // Use the current datetime
    },
  };
};

/**
 * Replace a blob URL with the final path, and add the file to the changeset.
 * @param {object} args Arguments.
 * @param {File} args.file Raw file.
 * @param {AssetFolderInfo} args.folder Asset folder associated with the new file.
 * @param {string} args.blobURL Blob URL of the file.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {FlattenedEntryContent} args.content Localized content.
 * @param {FileChange[]} args.changes Changeset.
 * @param {Asset[]} args.savingAssets List of assets to be saved.
 * @param {boolean} args.slugificationEnabled Whether the file name slugification is enabled.
 * @param {boolean} args.encodingEnabled Whether the file path encoding is enabled.
 */
const replaceBlobURL = async ({
  file,
  folder,
  blobURL,
  draft,
  defaultLocaleSlug,
  keyPath,
  content,
  changes,
  savingAssets,
  slugificationEnabled,
  encodingEnabled,
}) => {
  const sha = await getHash(file);
  const dupFile = savingAssets.find((f) => f.sha === sha);

  const {
    savingAssetProps,
    assetNamesInSameFolder,
    assetFolderPaths: { resolvedInternalPath, resolvedPublicPath },
  } = getAssetSavingInfo({ draft, defaultLocaleSlug, folder });

  let fileName = '';

  // Check if the file has already been added for other field or locale
  if (dupFile) {
    fileName = dupFile.name;
  } else {
    fileName = formatFileName(file.name, { slugificationEnabled, assetNamesInSameFolder });

    const assetPath = resolvedInternalPath ? `${resolvedInternalPath}/${fileName}` : fileName;

    assetNamesInSameFolder.push(fileName);
    changes.push({ action: 'create', path: assetPath, data: file });

    savingAssets.push({
      ...savingAssetProps,
      blobURL,
      name: fileName,
      path: assetPath,
      sha,
      size: file.size,
      kind: getAssetKind(fileName),
    });
  }

  let publicURL = resolvedPublicPath
    ? `${resolvedPublicPath === '/' ? '' : resolvedPublicPath}/${fileName}`
    : fileName;

  if (encodingEnabled) {
    publicURL = encodeFilePath(publicURL);
  }

  content[keyPath] = /** @type {string} */ (content[keyPath]).replaceAll(blobURL, publicURL);
};

/**
 * Create base saving entry data.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {EntrySlugVariants} args.slugs Entry slugs.
 * @returns {Promise<{ localizedEntryMap: LocalizedEntryMap, changes: FileChange[], savingAssets:
 * Asset[] }>} Localized entry map, file changeset and asset list.
 */
const createBaseSavingEntryData = async ({
  draft,
  slugs: { defaultLocaleSlug, canonicalSlug, localizedSlugs },
}) => {
  const _globalAssetFolder = get(globalAssetFolder);
  const { collection, currentLocales, collectionFile, currentValues, files } = draft;

  const {
    _i18n: {
      canonicalSlug: { key: canonicalSlugKey },
    },
  } = collectionFile ?? collection;

  /** @type {FileChange[]} */
  const changes = [];
  /** @type {Asset[]} */
  const savingAssets = [];
  const { slugify_filename: slugificationEnabled = false } = getDefaultMediaLibraryOptions().config;
  const { encode_file_path: encodingEnabled = false } = get(siteConfig)?.output ?? {};

  const replaceBlobBaseArgs = {
    draft,
    defaultLocaleSlug,
    changes,
    savingAssets,
    slugificationEnabled,
    encodingEnabled,
  };

  const localizedEntryMap = Object.fromEntries(
    await Promise.all(
      Object.entries(currentValues).map(async ([locale, content]) => {
        const localizedSlug = localizedSlugs?.[locale];
        const slug = localizedSlug ?? defaultLocaleSlug;
        const path = createEntryPath({ draft, locale, slug });

        if (!currentLocales[locale]) {
          return [locale, { path }];
        }

        // Add the canonical slug
        content[canonicalSlugKey] = canonicalSlug;

        // Normalize data
        await Promise.all(
          Object.entries(content).map(async ([keyPath, value]) => {
            if (value === undefined) {
              delete content[keyPath];

              return;
            }

            if (typeof value !== 'string') {
              return;
            }

            // Remove leading & trailing whitespace
            content[keyPath] = value.trim();

            const matches = [...value.matchAll(getBlobRegex('g'))];

            if (!matches.length) {
              return;
            }

            const replaceBlobArgs = { ...replaceBlobBaseArgs, keyPath, content };

            // Replace blob URLs in File/Image fields with asset paths
            await Promise.all(
              matches.map(async ([blobURL]) => {
                const { file, folder = _globalAssetFolder } = files[blobURL] ?? {};

                if (file) {
                  await replaceBlobURL({ ...replaceBlobArgs, file, folder, blobURL });
                }
              }),
            );
          }),
        );

        return [locale, { slug, path, content: toRaw(content) }];
      }),
    ),
  );

  return { localizedEntryMap, changes, savingAssets };
};

/**
 * Create saving entry data.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {EntrySlugVariants} args.slugs Entry slugs.
 * @returns {Promise<{ savingEntry: Entry, savingAssets: Asset[], changes: FileChange[] }>} Saving
 * entry, assets and file changes.
 */
export const createSavingEntryData = async ({ draft, slugs }) => {
  const {
    collection,
    isNew,
    originalLocales,
    currentLocales,
    originalSlugs,
    originalEntry,
    collectionFile,
  } = draft;

  const { defaultLocaleSlug } = slugs;

  const {
    _file,
    _i18n: { i18nEnabled, allLocales, defaultLocale, structure },
  } = collectionFile ?? /** @type {EntryCollection} */ (collection);

  const { localizedEntryMap, changes, savingAssets } = await createBaseSavingEntryData({
    draft,
    slugs,
  });

  /** @type {Entry} */
  const savingEntry = {
    id: originalEntry?.id ?? generateUUID(),
    slug: defaultLocaleSlug,
    subPath: _file.fullPathRegEx
      ? (localizedEntryMap[defaultLocale].path.match(_file.fullPathRegEx)?.groups?.subPath ??
        defaultLocaleSlug)
      : defaultLocaleSlug,
    locales: Object.fromEntries(Object.entries(localizedEntryMap)),
  };

  if (!i18nEnabled || structure === 'single_file') {
    const localizedEntry = savingEntry.locales[defaultLocale];
    const { slug, path, content } = localizedEntry;
    const renamed = !isNew && (originalSlugs?.[defaultLocale] ?? originalSlugs?._) !== slug;

    const data = await formatEntryFile({
      content: i18nEnabled
        ? Object.fromEntries(
            Object.entries(savingEntry.locales)
              .filter(([, le]) => !!le.content)
              .map(([locale, le]) => [
                locale,
                serializeContent({ draft, locale, valueMap: le.content }),
              ]),
          )
        : serializeContent({ draft, locale: '_default', valueMap: content }),
      _file,
    });

    changes.push({
      action: isNew ? 'create' : renamed ? 'move' : 'update',
      slug,
      path,
      previousPath: renamed ? originalEntry?.locales[defaultLocale].path : undefined,
      data,
    });
  } else {
    await Promise.all(
      allLocales.map(async (locale) => {
        const localizedEntry = savingEntry.locales[locale];
        const { slug, path, content } = localizedEntry ?? {};

        if (currentLocales[locale]) {
          const renamed =
            !isNew &&
            originalLocales[locale] &&
            (originalSlugs?.[locale] ?? originalSlugs?._) !== slug;

          const data = await formatEntryFile({
            content: serializeContent({ draft, locale, valueMap: content }),
            _file,
          });

          changes.push({
            action: isNew || !originalLocales[locale] ? 'create' : renamed ? 'move' : 'update',
            slug,
            path,
            previousPath: renamed ? originalEntry?.locales[locale]?.path : undefined,
            data,
          });
        } else if (!isNew && originalLocales[locale]) {
          changes.push({ action: 'delete', slug, path });
        }

        return true;
      }),
    );
  }

  return { savingEntry, savingAssets, changes };
};

/**
 * Update the application stores with the provided saving assets, entry, and deployment settings.
 * @param {object} args Arguments.
 * @param {Entry} args.savingEntry The entry object being saved.
 * @param {Asset[]} args.savingAssets An array of asset objects being saved.
 * @param {boolean | undefined} args.skipCI Whether to disable automatic deployments for the change.
 */
const updateStores = ({ savingEntry, savingAssets, skipCI }) => {
  allEntries.update((entries) => [...entries.filter((e) => e.id !== savingEntry.id), savingEntry]);

  const savingAssetsPaths = savingAssets.map((a) => a.path);

  allAssets.update((assets) => [
    ...assets.filter((a) => !savingAssetsPaths.includes(a.path)),
    ...savingAssets,
  ]);

  const autoDeployEnabled = get(siteConfig)?.backend.automatic_deployments;

  const published =
    !!get(backend)?.isGit && (skipCI === undefined ? autoDeployEnabled === true : skipCI === false);

  contentUpdatesToast.set({
    ...UPDATE_TOAST_DEFAULT_STATE,
    saved: true,
    published,
    count: 1,
  });

  isLastCommitPublished.set(published);
};

/**
 * Save the entry draft.
 * @param {object} [options] Options.
 * @param {boolean} [options.skipCI] Whether to disable automatic deployments for the change.
 * @returns {Promise<Entry>} Saved entry.
 * @throws {Error} When the entry could not be validated or saved.
 */
export const saveEntry = async ({ skipCI = undefined } = {}) => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { collection, isNew, collectionName, fileName, currentValues } = draft;

  if (!validateEntry()) {
    expandInvalidFields({ collectionName, fileName, currentValues });

    throw new Error('validation_failed');
  }

  const slugs = getSlugs({ draft });
  const { defaultLocaleSlug } = slugs;
  const { savingEntry, changes, savingAssets } = await createSavingEntryData({ draft, slugs });

  try {
    await /** @type {BackendService} */ (get(backend)).commitChanges(changes, {
      commitType: isNew ? 'create' : 'update',
      collection,
      skipCI,
    });
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex.cause ?? ex);

    throw new Error('saving_failed', { cause: ex.cause ?? ex });
  }

  updateStores({ savingEntry, savingAssets, skipCI });
  deleteBackup(collectionName, isNew ? '' : defaultLocaleSlug);

  return savingEntry;
};
