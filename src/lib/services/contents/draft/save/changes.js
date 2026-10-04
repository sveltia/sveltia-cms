import { getBlobRegex } from '@sveltia/utils/file';
import { toRaw } from '@sveltia/utils/object';

import { callEventHooks } from '$lib/services/api/events';
import { globalAssetFolder } from '$lib/services/assets/folders';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { isNestedCollection } from '$lib/services/contents/collection/nested';
import { isArrayFileCollection } from '$lib/services/contents/collection/predicates';
import { addAlias } from '$lib/services/contents/draft/save/aliases';
import { replaceBlobURL } from '$lib/services/contents/draft/save/assets';
import { createEntryPath } from '$lib/services/contents/draft/save/entry-path';
import {
  buildEntryFileChanges,
  resolveCacheDB,
} from '$lib/services/contents/draft/save/file-changes';
import { getCanonicalSlug, getFillSlugOptions } from '$lib/services/contents/draft/slugs';
import { getField } from '$lib/services/contents/entry/fields';
import { RICH_TEXT_FIELD_TYPES } from '$lib/services/contents/fields';
import { resolveFileConfig } from '$lib/services/contents/file/config';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * Entry,
 * EntryDraft,
 * EntrySlugVariants,
 * FileChange,
 * FlattenedEntryContent,
 * GetFieldArgs,
 * InternalCollectionFile,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * LocalizedEntryMap,
 * } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 * @import { EntryFilePlan } from '$lib/services/contents/draft/save/file-changes';
 */

/**
 * Get the sub path of a file within the collection folder.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection | InternalCollectionFile} args.collection Entry collection, or
 * the collection file for a file/singleton collection, which is what holds the file configuration
 * in that case.
 * @param {string} args.path File path.
 * @param {string} args.fallback Sub path to fall back to if the path can’t be parsed.
 * @returns {string} Sub path.
 */
const getSubPath = ({ collection: { _file }, path, fallback }) =>
  _file.fullPathRegEx ? (path.match(_file.fullPathRegEx)?.groups?.subPath ?? fallback) : fallback;

/**
 * Get the canonical slug for an entry in a nested collection, where an entry is identified by its
 * path within the collection folder rather than by a bare slug. Linking the localized files by the
 * slug alone would take two entries with the same slug in different folders for one entry once
 * they’re read back from the repository, so it’s the default locale’s sub path that links them.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {EntrySlugVariants} args.slugs Entry slugs.
 * @returns {string | undefined} Canonical slug, or `undefined` if the collection is not nested or
 * the slugs aren’t localized, in which case the regular canonical slug applies.
 * @see https://github.com/sveltia/sveltia-cms/issues/962
 */
const getNestedCanonicalSlug = ({ draft, slugs: { defaultLocaleSlug, localizedSlugs } }) => {
  const { collection, defaultLocale } = draft;

  if (!localizedSlugs || !isNestedCollection(collection)) {
    return undefined;
  }

  const path = createEntryPath({ draft, locale: defaultLocale, slug: defaultLocaleSlug });

  const subPath = getSubPath({
    collection: /** @type {InternalEntryCollection} */ (collection),
    path,
    fallback: defaultLocaleSlug,
  });

  return getCanonicalSlug({
    draft,
    defaultLocaleSlug: subPath,
    localizedSlugs,
    fillSlugOptions: getFillSlugOptions({ draft }),
  });
};

/**
 * Arguments shared by the normalization of an entry’s content in every locale.
 * @typedef {object} NormalizeContentArgs
 * @property {EntryDraft} draft Entry draft.
 * @property {EntryDraft['files']} files Files attached to the draft, keyed by blob URL.
 * @property {string} defaultLocaleSlug Default locale’s entry slug.
 * @property {FileChange[]} changes File changeset, which saved assets are added to.
 * @property {Asset[]} savingAssets List of assets to be saved.
 * @property {GetFieldArgs} getFieldArgs Arguments to get a field configuration.
 * @property {boolean} encodingEnabled Whether the file path encoding is enabled.
 * @property {AssetFolderInfo | undefined} globalAssetFolder Global asset folder, which a file is
 * saved to unless it’s associated with another folder. `undefined` without the global
 * `media_folder` option.
 */

/**
 * Replace the blob URLs found in a field value with the paths of the assets they point to.
 * @param {NormalizeContentArgs & {
 * locale: InternalLocaleCode, slug: string, content: FlattenedEntryContent, keyPath: FieldKeyPath,
 * matches: RegExpExecArray[] }} args Arguments. `content` is modified in place, and `matches` are
 * the blob URLs found in the value.
 */
const replaceBlobURLs = async ({
  draft,
  files,
  defaultLocaleSlug,
  changes,
  savingAssets,
  getFieldArgs,
  encodingEnabled,
  globalAssetFolder: _globalAssetFolder,
  locale,
  slug,
  content,
  keyPath,
  matches,
}) => {
  const field = getField({ ...getFieldArgs, valueMap: content, keyPath });

  const replaceBlobArgs = {
    draft,
    defaultLocaleSlug,
    changes,
    savingAssets,
    locale,
    slug,
    keyPath,
    content,
    // Enable encoding for markdown fields to support embedded images
    encodingEnabled: RICH_TEXT_FIELD_TYPES.includes(field?.widget ?? '') || encodingEnabled,
  };

  // Replace blob URLs in File/Image fields with asset paths
  await Promise.all(
    matches.map(async ([blobURL]) => {
      const {
        file,
        folder = _globalAssetFolder,
        replace,
        subfolderPath,
        nameTemplate,
      } = files[blobURL] ?? {};

      if (file) {
        // A file can only be cached without a folder, and there is no global folder either, when
        // only a cloud media library is configured. The file has nowhere to go in the repository
        if (!folder) {
          throw new Error(`There is no asset folder to save the file "${file.name}" to`);
        }

        await replaceBlobURL({
          ...replaceBlobArgs,
          file,
          folder,
          replace,
          subfolderPath,
          nameTemplate,
          blobURL,
        });
      }
    }),
  );
};

/**
 * Normalize a field value for saving: remove an undefined value, trim a string, and replace the
 * blob URLs in it with asset paths.
 * @param {NormalizeContentArgs & {
 * locale: InternalLocaleCode, slug: string, content: FlattenedEntryContent, keyPath: FieldKeyPath,
 * value: any }} args Arguments. `content` is modified in place.
 */
const normalizeFieldValue = async ({ keyPath, value, ...args }) => {
  const { content } = args;

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

  await replaceBlobURLs({ ...args, keyPath, matches });
};

/**
 * Normalize an entry’s content in a locale for saving: add the canonical slug and an alias, then
 * normalize each field value.
 * @param {NormalizeContentArgs & {
 * locale: InternalLocaleCode, slug: string, path: string, content: FlattenedEntryContent,
 * canonicalSlug: string | undefined, canonicalSlugKey: string }} args Arguments. `content` is
 * modified in place.
 */
const normalizeLocaleContent = async ({ path, canonicalSlug, canonicalSlugKey, ...args }) => {
  const { draft, locale, slug, content } = args;

  // Add the canonical slug only when it’s defined; if it’s undefined (e.g. the slug template
  // has no `| localize` filter), skip the assignment to avoid wiping a user-defined field
  // that happens to share the same key (e.g. `translationKey`).
  if (canonicalSlug !== undefined) {
    content[canonicalSlugKey] = canonicalSlug;
  }

  // Keep links to the entry’s previous path working after the slug has been edited
  addAlias({ draft, locale, content, slug, path });

  // Normalize data
  await Promise.all(
    Object.entries(content).map(([keyPath, value]) =>
      normalizeFieldValue({ ...args, keyPath, value }),
    ),
  );
};

/**
 * Create base saving entry data.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {EntrySlugVariants} args.slugs Entry slugs.
 * @returns {Promise<{ localizedEntryMap: LocalizedEntryMap, changes: FileChange[], savingAssets:
 * Asset[] }>} Localized entry map, file changeset and asset list.
 */
export const createBaseSavingEntryData = async ({ draft, slugs }) => {
  const { defaultLocaleSlug, localizedSlugs } = slugs;
  const _globalAssetFolder = globalAssetFolder.current;

  const {
    collection,
    collectionName,
    collectionFile,
    fileName,
    isIndexFile,
    currentLocales,
    currentValues,
    files,
  } = draft;

  const {
    _i18n: {
      canonicalSlug: { key: canonicalSlugKey },
    },
  } = collectionFile ?? collection;

  /** @type {FileChange[]} */
  const changes = [];
  /** @type {Asset[]} */
  const savingAssets = [];
  const { encode_file_path: encodingEnabled = false } = cmsConfig.current?.output ?? {};
  /** @type {GetFieldArgs} */
  const getFieldArgs = { collectionName, fileName, keyPath: '', valueMap: {}, isIndexFile };
  const canonicalSlug = getNestedCanonicalSlug({ draft, slugs }) ?? slugs.canonicalSlug;

  /** @type {NormalizeContentArgs} */
  const normalizeArgs = {
    draft,
    files,
    defaultLocaleSlug,
    changes,
    savingAssets,
    getFieldArgs,
    encodingEnabled,
    globalAssetFolder: _globalAssetFolder,
  };

  const localizedEntryMap = Object.fromEntries(
    await Promise.all(
      Object.entries(currentValues).map(async ([locale, valueMap]) => {
        // Normalize a copy, so the draft keeps its blob URLs until the save has gone through. If
        // the commit fails, a retry then saves the files again, rather than committing the entry
        // with paths to files that never reached the repository
        // @see https://github.com/sveltia/sveltia-cms/issues/1012
        const content = { ...valueMap };
        const localizedSlug = localizedSlugs?.[locale];
        const slug = localizedSlug ?? defaultLocaleSlug;
        const path = createEntryPath({ draft, locale, slug });

        if (!currentLocales[locale]) {
          return [locale, { path }];
        }

        await normalizeLocaleContent({
          ...normalizeArgs,
          locale,
          slug,
          path,
          content,
          canonicalSlug,
          canonicalSlugKey,
        });

        return [locale, { slug, path, content: toRaw(content) }];
      }),
    ),
  );

  return { localizedEntryMap, changes, savingAssets };
};

/**
 * Get the item that a change to an entry applies to, if the entry is stored in a file with the
 * other entries of an entry collection. The item is identified by its position, and by the content
 * the user has seen, so that the change doesn’t apply to another item if the array has changed.
 * The content is taken from the entry in the store, as the given entry can be a copy with the
 * change already made to it, e.g. a reference to a renamed asset or entry. Without one, the given
 * entry stands in, which the item then has to match.
 * @param {Entry | undefined} entry Existing entry. `undefined` for a new entry, which is added to
 * the end of the array.
 * @returns {Pick<FileChange, 'arrayItem'>} Properties to add to the change.
 */
export const getArrayItemTarget = (entry) => {
  if (entry?.arrayIndex === undefined) {
    return {};
  }

  const { locales } = allEntries.current.find(({ id }) => id === entry.id) ?? entry;

  return { arrayItem: { index: entry.arrayIndex, locales } };
};

/**
 * Plan the file change for the entry draft, specifically for a single-file entry.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {Entry} args.savingEntry Entry to be saved.
 * @returns {EntryFilePlan} Planned change.
 */
export const planSingleFileChange = ({ draft, savingEntry }) => {
  const { collection, isNew, originalEntry, collectionFile } = draft;

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? /** @type {InternalEntryCollection} */ (collection);

  const { slug, path } = savingEntry.locales[defaultLocale];
  const previousPath = originalEntry?.locales[defaultLocale]?.path;
  // Comparing the paths rather than the slugs also catches an entry moved with the path editor,
  // which leaves the slug alone
  const renamed = !isNew && !!previousPath && previousPath !== path;

  return {
    action: isNew ? 'create' : renamed ? 'move' : 'update',
    slug,
    path,
    previousPath: renamed ? previousPath : undefined,
    currentPath: previousPath,
    ...(isArrayFileCollection(collection) && !isNew ? getArrayItemTarget(originalEntry) : {}),
  };
};

/**
 * Plan the file change for the entry draft, specifically for a multi-file entry.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {Entry} args.savingEntry Entry to be saved.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @returns {EntryFilePlan | undefined} Planned change, or `undefined` if there’s no file to save
 * or delete for the locale.
 */
export const planMultiFileChange = ({ draft, savingEntry, locale }) => {
  const { isNew, originalLocales, currentLocales, originalEntry } = draft;
  const { slug, path } = savingEntry.locales[locale] ?? {};
  const previousPath = originalEntry?.locales[locale]?.path;

  if (currentLocales[locale]) {
    const renamed = !isNew && !!originalLocales[locale] && !!previousPath && previousPath !== path;

    return {
      action: isNew || !originalLocales[locale] ? 'create' : renamed ? 'move' : 'update',
      slug,
      path,
      previousPath: renamed ? previousPath : undefined,
      currentPath: previousPath,
    };
  }

  if (!isNew && originalLocales[locale]) {
    // Delete the file where it is now. The path built for the disabled locale follows the new slug
    // and folder, so it points elsewhere once the entry is renamed or moved in the same save
    return {
      action: 'delete',
      slug: originalEntry?.locales[locale]?.slug ?? slug,
      path: /** @type {string} */ (previousPath),
      currentPath: previousPath,
    };
  }

  return undefined;
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
  const { id, collection, collectionFile } = draft;
  const { defaultLocaleSlug } = slugs;
  // A file/singleton collection keeps its file configuration on the collection file
  const entryCollection = collectionFile ?? /** @type {InternalEntryCollection} */ (collection);
  const { defaultLocale } = entryCollection._i18n;

  const { localizedEntryMap, changes, savingAssets } = await createBaseSavingEntryData({
    draft,
    slugs,
  });

  const subPath = getSubPath({
    collection: entryCollection,
    path: localizedEntryMap[defaultLocale].path,
    fallback: defaultLocaleSlug,
  });

  // In a nested collection, an entry is identified by its path within the collection folder rather
  // than by a file name, so that’s also the slug the entry gets when it’s read back from the
  // repository. Use it here as well, or the entry saved in this session would differ from the same
  // entry after a reload.
  const nested = isNestedCollection(collection);

  /** @type {Entry} */
  const savingEntry = {
    id,
    slug: nested ? subPath : defaultLocaleSlug,
    subPath,
    // An entry stored in a file with the other entries keeps its position, while a new one gets
    // one once the file is saved
    ...(draft.isNew || draft.originalEntry?.arrayIndex === undefined
      ? {}
      : { arrayIndex: draft.originalEntry.arrayIndex }),
    locales: Object.fromEntries(
      Object.entries(localizedEntryMap).map(([locale, localizedEntry]) => [
        locale,
        nested
          ? {
              ...localizedEntry,
              slug: getSubPath({
                collection: entryCollection,
                path: localizedEntry.path,
                fallback: defaultLocaleSlug,
              }),
            }
          : localizedEntry,
      ]),
    ),
  };

  await callEventHooks({
    type: 'preSave',
    entry: savingEntry,
    collection,
    collectionFile,
    isNew: draft.isNew,
  });

  changes.push(
    ...(await buildEntryFileChanges({
      draft,
      config: entryCollection,
      _file: resolveFileConfig({ collection, collectionFile, isIndexFile: draft.isIndexFile }),
      entry: savingEntry,
      cacheDB: resolveCacheDB(),
      /**
       * Plan the change to a file of the entry.
       * @param {InternalLocaleCode} [locale] Locale of the file, or `undefined` for the single
       * file.
       * @returns {EntryFilePlan | undefined} Planned change.
       */
      planChange: (locale) =>
        locale === undefined
          ? planSingleFileChange({ draft, savingEntry })
          : planMultiFileChange({ draft, savingEntry, locale }),
    })),
  );

  return { savingEntry, savingAssets, changes };
};
