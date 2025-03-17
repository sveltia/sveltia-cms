import { generateUUID, getHash } from '@sveltia/utils/crypto';
import { getBlobRegex } from '@sveltia/utils/file';
import { isObject, toRaw } from '@sveltia/utils/object';
import { compare, escapeRegExp } from '@sveltia/utils/string';
import { unflatten } from 'flat';
import { TomlDate } from 'smol-toml';
import { get } from 'svelte/store';
import { allAssetFolders, allAssets, getAssetKind, getAssetsByDirName } from '$lib/services/assets';
import { backend, backendName, isLastCommitPublished } from '$lib/services/backends';
import { fillSlugTemplate } from '$lib/services/common/slug';
import { siteConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import {
  contentUpdatesToast,
  updatesToastDefaultState,
} from '$lib/services/contents/collection/data';
import { entryDraft } from '$lib/services/contents/draft';
import { deleteBackup } from '$lib/services/contents/draft/backup';
import { expandInvalidFields } from '$lib/services/contents/draft/editor';
import { validateEntry } from '$lib/services/contents/draft/validate';
import { getFieldConfig, isFieldRequired } from '$lib/services/contents/entry/fields';
import { formatEntryFile } from '$lib/services/contents/file/format';
import { hasRootListField } from '$lib/services/contents/widgets/list/helper';
import { user } from '$lib/services/user';
import { fullDateTimeRegEx } from '$lib/services/utils/date';
import {
  createPath,
  encodeFilePath,
  renameIfNeeded,
  resolvePath,
  sanitizeFileName,
} from '$lib/services/utils/file';

/**
 * @import {
 * Asset,
 * BackendService,
 * CommitAuthor,
 * Entry,
 * EntryCollection,
 * EntryDraft,
 * EntryFileMap,
 * FileChange,
 * FillSlugTemplateOptions,
 * FlattenedEntryContent,
 * LocaleCode,
 * LocaleSlugMap,
 * LocalizedEntryMap,
 * RawEntryContent,
 * RepositoryFileMetadata,
 * User,
 * } from '$lib/typedefs/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * ListField,
 * ObjectField,
 * RelationField,
 * SelectField,
 * } from '$lib/typedefs/public';
 */

/**
 * Entry slug variants.
 * @typedef {object} EntrySlugVariants
 * @property {string} defaultLocaleSlug Default locale’s entry slug.
 * @property {LocaleSlugMap | undefined} localizedSlugs Localized slug map.
 * @property {string | undefined} canonicalSlug Canonical slug.
 */

/**
 * Paths for entry assets.
 * @typedef {object} EntryAssetFolderPaths
 * @property {string} internalBaseAssetFolder Collection-defined path.
 * @property {string} internalAssetFolder May contain a sub path when assets are entry-relative.
 * @property {string} publicAssetFolder Collection-defined public path.
 */

/**
 * Properties for a saving asset.
 * @typedef {object} SavingAssetProps
 * @property {string} collectionName Collection name.
 * @property {string} [text] Raw text for a plaintext file, like HTML or Markdown.
 * @property {string} folder Path of a collection-specific folder that contains the file or global
 * media folder.
 */

/**
 * Properties for a saving asset.
 * @typedef {SavingAssetProps & RepositoryFileMetadata} SavingAsset
 */

/**
 * Get the internal/public asset path configuration for the entry assets.
 * @param {FillSlugTemplateOptions} fillSlugOptions Options for {@link fillSlugTemplate}.
 * @returns {EntryAssetFolderPaths} Determined paths.
 */
export const getEntryAssetFolderPaths = (fillSlugOptions) => {
  const { collection } = fillSlugOptions;

  const {
    _i18n: { structure },
    _assetFolder,
  } = collection;

  const subPath =
    collection._type === 'entry'
      ? /** @type {EntryCollection} */ (collection)._file.subPath
      : undefined;

  const subPathFirstPart = subPath?.match(/(?<path>.+?)(?:\/[^/]+)?$/)?.groups?.path ?? '';
  const isMultiFolders = ['multiple_folders', 'multiple_folders_i18n_root'].includes(structure);
  const { entryRelative, internalPath, publicPath } = _assetFolder ?? get(allAssetFolders)[0];

  if (!entryRelative) {
    return {
      internalBaseAssetFolder: internalPath,
      internalAssetFolder: fillSlugTemplate(internalPath, fillSlugOptions),
      publicAssetFolder: fillSlugTemplate(publicPath, fillSlugOptions),
    };
  }

  return {
    internalBaseAssetFolder: internalPath,
    internalAssetFolder: resolvePath(
      fillSlugTemplate(
        createPath([
          internalPath,
          isMultiFolders || subPath?.includes('/') ? subPathFirstPart : undefined,
        ]),
        fillSlugOptions,
      ),
    ),
    publicAssetFolder:
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
 * Determine the file path for the given entry draft depending on the collection type, i18n config
 * and folder collections path.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {LocaleCode} args.locale Locale code.
 * @param {string} args.slug Entry slug.
 * @returns {string} Complete path, including the folder, slug, extension and possibly locale.
 * @see https://decapcms.org/docs/i18n/
 */
const createEntryPath = ({ draft, locale, slug }) => {
  const { collection, collectionFile, originalEntry, currentValues } = draft;

  if (collectionFile) {
    return collectionFile.file.replace('{{locale}}', locale);
  }

  if (originalEntry?.locales[locale]?.slug === slug) {
    return originalEntry.locales[locale].path;
  }

  const _collection = /** @type {EntryCollection} */ (collection);

  const {
    _file: { basePath, subPath, extension },
    _i18n: { defaultLocale, structure },
  } = _collection;

  /**
   * Support folder collections path.
   * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
   */
  const path = subPath
    ? fillSlugTemplate(subPath, {
        collection: _collection,
        locale,
        content: currentValues[defaultLocale],
        currentSlug: slug,
      })
    : slug;

  const pathOptions = {
    multiple_folders: `${basePath}/${locale}/${path}.${extension}`,
    multiple_folders_i18n_root: `${locale}/${basePath}/${path}.${extension}`,
    multiple_files: `${basePath}/${path}.${locale}.${extension}`,
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
 * @param {LocaleCode} args.locale Locale code.
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

  // Use native date for TOML
  // @see https://github.com/squirrelchat/smol-toml?tab=readme-ov-file#dates
  // @see https://toml.io/en/v1.0.0#offset-date-time
  if (
    isTomlOutput &&
    typeof value === 'string' &&
    fullDateTimeRegEx.test(value) &&
    field?.widget === 'datetime'
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
 * @param {string} [args.fileName] File name.
 * @param {Field[]} args.fields Field list of a collection or a file.
 * @param {LocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.valueMap Flattened entry content.
 * @param {string} [args.canonicalSlugKey] Property name of a canonical slug.
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
  isTomlOutput = false,
}) => {
  /** @type {FlattenedEntryContent} */
  const unsortedMap = toRaw(valueMap);
  /** @type {FlattenedEntryContent} */
  const sortedMap = {};

  const { omit_empty_optional_fields: omitEmptyOptionalFields = false } =
    get(siteConfig)?.output ?? {};

  const copyArgs = { locale, unsortedMap, sortedMap, isTomlOutput, omitEmptyOptionalFields };

  // Add the slug first
  if (canonicalSlugKey && canonicalSlugKey in unsortedMap) {
    copyProperty({ key: canonicalSlugKey, ...copyArgs });
  }

  // Move the listed properties to a new object
  createKeyPathList(fields).forEach((keyPath) => {
    const field = getFieldConfig({ collectionName, fileName, valueMap, keyPath });

    if (keyPath in unsortedMap) {
      copyProperty({ key: keyPath, field, ...copyArgs });
    } else if (field?.widget === 'keyvalue') {
      // Work around a bug in the flat library where numeric property keys used for KeyValue fields
      // trigger a wrong conversion to an array instead of an object
      // @see https://github.com/hughsk/flat/issues/103
      sortedMap[keyPath] = {};

      // Copy key-value pairs
      Object.entries(unsortedMap)
        .filter(([_keyPath]) => _keyPath.startsWith(`${keyPath}.`))
        .forEach(([_keyPath]) => {
          copyProperty({ key: _keyPath, field, ...copyArgs });
        });
    } else {
      const regex = new RegExp(
        `^${escapeRegExp(keyPath.replaceAll('*', '\\d+')).replaceAll('\\\\d\\+', '\\d+')}$`,
      );

      Object.keys(unsortedMap)
        .filter((_keyPath) => regex.test(_keyPath))
        .sort(([a, b]) => compare(a, b))
        .forEach((_keyPath) => {
          copyProperty({ key: _keyPath, field, ...copyArgs });
        });
    }
  });

  // Move the remainder, if any, to a new object
  Object.keys(unsortedMap)
    .sort(([a, b]) => compare(a, b))
    .forEach((key) => {
      copyProperty({ key, ...copyArgs });
    });

  return unflatten(sortedMap);
};

/**
 * Serialize the content for the output.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {LocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.valueMap Original content.
 * @returns {RawEntryContent} Modified and unflattened content.
 */
const serializeContent = ({ draft, locale, valueMap }) => {
  const { collection, collectionFile } = draft;

  const {
    fields = [],
    _file,
    _i18n: {
      canonicalSlug: { key: canonicalSlugKey },
    },
  } = collectionFile ?? /** @type {EntryCollection} */ (collection);

  const content = finalizeContent({
    collectionName: collection.name,
    fileName: collectionFile?.name,
    fields,
    locale,
    valueMap,
    canonicalSlugKey,
    isTomlOutput: ['toml', 'toml-frontmatter'].includes(_file.format),
  });

  // Handle a special case: top-level list field
  if (hasRootListField(fields)) {
    return content[fields[0].name] ?? [];
  }

  return content;
};

/**
 * Get the localized slug map. This only applies when the i18n structure is multiple files or
 * folders, and the slug template contains the `localize` flag, e.g. `{{title | localize}}`.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @returns {LocaleSlugMap | undefined} Localized slug map.
 */
const getLocalizedSlugs = ({ draft, defaultLocaleSlug }) => {
  const { collection, collectionFile, currentLocales, currentSlugs, currentValues } = draft;

  const {
    identifier_field: identifierField = 'title',
    slug: slugTemplate = `{{${identifierField}}}`,
  } = collection;

  const {
    _i18n: { defaultLocale, structure },
  } = collectionFile ?? collection;

  /**
   * List of key paths that the value will be localized.
   */
  const localizingKeyPaths = [...slugTemplate.matchAll(/{{(?:fields\.)?(.+?)( \| localize)?}}/g)]
    .filter(([, , localize]) => !!localize)
    .map(([, keyPath]) => keyPath);

  if (structure === 'single_file' || !localizingKeyPaths.length) {
    return undefined;
  }

  const _collection = /** @type {EntryCollection} */ (collection);

  return Object.fromEntries(
    Object.entries(currentLocales).map(([locale]) => {
      const slug =
        locale === defaultLocale
          ? defaultLocaleSlug
          : (currentSlugs?.[locale] ??
            currentSlugs?._ ??
            fillSlugTemplate(slugTemplate, {
              collection: _collection,
              locale,
              content: {
                // Merge the default locale content and localized content
                ...currentValues[defaultLocale],
                ...Object.fromEntries(
                  localizingKeyPaths.map((keyPath) => [keyPath, currentValues[locale]?.[keyPath]]),
                ),
              },
            }));

      return [locale, slug];
    }),
  );
};

/**
 * Get the canonical slug to be added to the content of each file when the slug is localized. It
 * helps Sveltia CMS and some frameworks to link localized files. The default property name is
 * `translationKey` used in Hugo’s multilingual support, and the default value is the default
 * locale’s slug.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @param {LocaleSlugMap | undefined} args.localizedSlugs Localized
 * slug map.
 * @param {FillSlugTemplateOptions} args.fillSlugOptions Arguments
 * for {@link fillSlugTemplate}.
 * @returns {string | undefined} Canonical slug.
 * @see https://github.com/sveltia/sveltia-cms#localizing-entry-slugs
 * @see https://gohugo.io/content-management/multilingual/#bypassing-default-linking
 */
const getCanonicalSlug = ({ draft, defaultLocaleSlug, localizedSlugs, fillSlugOptions }) => {
  if (!localizedSlugs) {
    return undefined;
  }

  const { collection, collectionFile } = draft;

  const {
    _i18n: {
      canonicalSlug: { value: canonicalSlugTemplate },
    },
  } = collectionFile ?? collection;

  if (canonicalSlugTemplate === '{{slug}}') {
    return defaultLocaleSlug;
  }

  return fillSlugTemplate(canonicalSlugTemplate, {
    ...fillSlugOptions,
    currentSlug: defaultLocaleSlug,
  });
};

/**
 * Get base options for {@link fillSlugTemplate}.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @returns {FillSlugTemplateOptions} Options.
 */
const getFillSlugOptions = ({ draft }) => {
  const { collection, collectionFile, currentValues } = draft;

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? collection;

  return {
    // eslint-disable-next-line object-shorthand
    collection: /** @type {EntryCollection} */ (collection),
    content: currentValues[defaultLocale],
  };
};

/**
 * Determine entry slugs.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @returns {EntrySlugVariants} Slugs.
 */
export const getSlugs = ({ draft }) => {
  const { collection, collectionFile, fileName, currentSlugs } = draft;

  const {
    identifier_field: identifierField = 'title',
    slug: slugTemplate = `{{${identifierField}}}`,
  } = collection;

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? collection;

  const fillSlugOptions = getFillSlugOptions({ draft });

  const defaultLocaleSlug =
    fileName ??
    currentSlugs?.[defaultLocale] ??
    currentSlugs?._ ??
    fillSlugTemplate(slugTemplate, fillSlugOptions);

  const localizedSlugs = getLocalizedSlugs({ draft, defaultLocaleSlug });

  const canonicalSlug = getCanonicalSlug({
    draft,
    defaultLocaleSlug,
    localizedSlugs,
    fillSlugOptions,
  });

  return { defaultLocaleSlug, localizedSlugs, canonicalSlug };
};

/**
 * Get base arguments for {@link replaceBlobURL}.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @returns {{ assetFolderPaths: EntryAssetFolderPaths, assetNamesInSameFolder: string[],
 * savingAssetProps: SavingAsset }} Arguments.
 */
const getReplaceBlobArgs = ({ draft, defaultLocaleSlug }) => {
  const { collection, collectionName, collectionFile } = draft;
  const fillSlugOptions = getFillSlugOptions({ draft });

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? collection;

  const assetFolderPaths = getEntryAssetFolderPaths({
    ...fillSlugOptions,
    type: 'media_folder',
    currentSlug: defaultLocaleSlug,
    entryFilePath: createEntryPath({ draft, locale: defaultLocale, slug: defaultLocaleSlug }),
  });

  const { internalBaseAssetFolder, internalAssetFolder } = assetFolderPaths;

  const assetNamesInSameFolder = getAssetsByDirName(internalAssetFolder).map((a) =>
    a.name.normalize(),
  );

  const { email, name } = /** @type {User} */ (get(user));

  /** @type {SavingAsset} */
  const savingAssetProps = {
    text: undefined,
    collectionName,
    folder: internalBaseAssetFolder,
    commitAuthor: email ? /** @type {CommitAuthor} */ ({ name, email }) : undefined,
    commitDate: new Date(), // Use the current datetime
  };

  return { assetFolderPaths, assetNamesInSameFolder, savingAssetProps };
};

/**
 * Replace a blob URL with the final path, and add the file to the changeset.
 * @param {object} args Arguments.
 * @param {string} args.blobURL Blob URL.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {FlattenedEntryContent} args.content Localized content.
 * @param {FileChange[]} args.changes Changeset.
 * @param {EntryFileMap} args.files Files to be uploaded.
 * @param {Asset[]} args.savingAssets List of assets to be saved.
 * @param {SavingAsset} args.savingAssetProps Base properties for assets to be saved.
 * @param {string[]} args.assetNamesInSameFolder Name of assets stored in the same folder as the
 * target asset folder.
 * @param {EntryAssetFolderPaths} args.assetFolderPaths Path configuration for the entry assets.
 */
const replaceBlobURL = async ({
  blobURL,
  keyPath,
  content,
  changes,
  files,
  savingAssets,
  savingAssetProps,
  assetNamesInSameFolder,
  assetFolderPaths: { internalAssetFolder, publicAssetFolder },
}) => {
  const file = files[blobURL];

  if (!file) {
    return;
  }

  const sha = await getHash(file);
  const dupFile = savingAssets.find((f) => f.sha === sha);
  let assetName = '';

  // Check if the file has already been added for other field or locale
  if (dupFile) {
    assetName = dupFile.name;
  } else {
    assetName = renameIfNeeded(sanitizeFileName(file.name), assetNamesInSameFolder);

    const assetPath = internalAssetFolder ? `${internalAssetFolder}/${assetName}` : assetName;

    assetNamesInSameFolder.push(assetName);
    changes.push({ action: 'create', path: assetPath, data: file });

    savingAssets.push({
      ...savingAssetProps,
      blobURL: URL.createObjectURL(file),
      name: assetName,
      path: assetPath,
      sha,
      size: file.size,
      kind: getAssetKind(assetName),
    });
  }

  const publicURL = encodeFilePath(
    publicAssetFolder
      ? `${publicAssetFolder === '/' ? '' : publicAssetFolder}/${assetName}`
      : assetName,
  );

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

  const replaceBlobArgs = {
    files,
    changes,
    savingAssets,
    ...getReplaceBlobArgs({ draft, defaultLocaleSlug }),
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

            // Replace blob URLs in File/Image fields with asset paths
            await Promise.all(
              [...value.matchAll(getBlobRegex('g'))].map(([blobURL]) =>
                replaceBlobURL({ blobURL, keyPath, content, ...replaceBlobArgs }),
              ),
            );
          }),
        );

        return [locale, { slug, path, sha: '', content: toRaw(content) }];
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
    sha: '', // Populated later
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
            Object.entries(savingEntry.locales).map(([locale, le]) => [
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

    localizedEntry.sha = await getHash(new Blob([data], { type: 'text/plain' }));
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

          localizedEntry.sha = await getHash(new Blob([data], { type: 'text/plain' }));
        } else if (!isNew && originalLocales[locale]) {
          changes.push({ action: 'delete', slug, path });
        }

        return true;
      }),
    );
  }

  savingEntry.sha = savingEntry.locales[defaultLocale].sha;

  return { savingEntry, savingAssets, changes };
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

  const savingAssetsPaths = savingAssets.map((a) => a.path);

  allEntries.update((entries) => [...entries.filter((e) => e.id !== savingEntry.id), savingEntry]);

  allAssets.update((assets) => [
    ...assets.filter((a) => !savingAssetsPaths.includes(a.path)),
    ...savingAssets,
  ]);

  const isLocal = get(backendName) === 'local';
  const autoDeployEnabled = get(siteConfig)?.backend.automatic_deployments;

  const published =
    !isLocal && (skipCI === undefined ? autoDeployEnabled === true : skipCI === false);

  contentUpdatesToast.set({
    ...updatesToastDefaultState,
    saved: true,
    published,
    count: 1,
  });

  isLastCommitPublished.set(published);

  deleteBackup(collectionName, isNew ? '' : defaultLocaleSlug);

  return savingEntry;
};
