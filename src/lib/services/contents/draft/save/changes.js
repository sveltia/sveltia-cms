import { getBlobRegex } from '@sveltia/utils/file';
import { toRaw } from '@sveltia/utils/object';
import { IndexedDB } from '@sveltia/utils/storage';
import { get } from 'svelte/store';

import { callEventHooks } from '$lib/services/api/events';
import { globalAssetFolder } from '$lib/services/assets/folders';
import { backend } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { isNestedCollection } from '$lib/services/contents/collection/nested';
import { addAlias } from '$lib/services/contents/draft/save/aliases';
import { replaceBlobURL } from '$lib/services/contents/draft/save/assets';
import { createEntryPath } from '$lib/services/contents/draft/save/entry-path';
import { serializeContent } from '$lib/services/contents/draft/save/serialize';
import { getCanonicalSlug, getFillSlugOptions } from '$lib/services/contents/draft/slugs';
import { getField } from '$lib/services/contents/entry/fields';
import { formatEntryFile } from '$lib/services/contents/file/format';

/**
 * @import {
 * Asset,
 * Entry,
 * EntryDraft,
 * EntrySlugVariants,
 * FileChange,
 * GetFieldArgs,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * LocalizedEntryMap,
 * RepositoryFileInfo,
 * } from '$lib/types/private';
 */

/**
 * Get the sub path of a file within the collection folder.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Entry collection.
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
 * Create base saving entry data.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {EntrySlugVariants} args.slugs Entry slugs.
 * @returns {Promise<{ localizedEntryMap: LocalizedEntryMap, changes: FileChange[], savingAssets:
 * Asset[] }>} Localized entry map, file changeset and asset list.
 */
export const createBaseSavingEntryData = async ({ draft, slugs }) => {
  const { defaultLocaleSlug, localizedSlugs } = slugs;
  const _globalAssetFolder = get(globalAssetFolder);

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
  const { encode_file_path: encodingEnabled = false } = get(cmsConfig)?.output ?? {};
  /** @type {GetFieldArgs} */
  const getFieldArgs = { collectionName, fileName, keyPath: '', valueMap: {}, isIndexFile };
  const replaceBlobBaseArgs = { draft, defaultLocaleSlug, changes, savingAssets };
  const canonicalSlug = getNestedCanonicalSlug({ draft, slugs }) ?? slugs.canonicalSlug;

  const localizedEntryMap = Object.fromEntries(
    await Promise.all(
      Object.entries(currentValues).map(async ([locale, content]) => {
        const localizedSlug = localizedSlugs?.[locale];
        const slug = localizedSlug ?? defaultLocaleSlug;
        const path = createEntryPath({ draft, locale, slug });

        if (!currentLocales[locale]) {
          return [locale, { path }];
        }

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

            const field = getField({ ...getFieldArgs, valueMap: content, keyPath });

            const replaceBlobArgs = {
              ...replaceBlobBaseArgs,
              locale,
              slug,
              keyPath,
              content,
              // Enable encoding for markdown fields to support embedded images
              encodingEnabled:
                field?.widget === 'richtext' || field?.widget === 'markdown'
                  ? true
                  : encodingEnabled,
            };

            // Replace blob URLs in File/Image fields with asset paths
            await Promise.all(
              matches.map(async ([blobURL]) => {
                const { file, folder = _globalAssetFolder, replace } = files[blobURL] ?? {};

                if (file) {
                  await replaceBlobURL({ ...replaceBlobArgs, file, folder, replace, blobURL });
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
 * Get the previous SHA of the file from the cache database.
 * @param {object} args Arguments.
 * @param {string | undefined} args.previousPath Previous file path.
 * @param {IndexedDB | undefined} args.cacheDB Cache database for file info.
 * @returns {Promise<string | undefined>} Previous SHA or `undefined` if not found.
 */
export const getPreviousSha = async ({ previousPath, cacheDB }) => {
  if (!previousPath) {
    return undefined;
  }

  const cache = /** @type {RepositoryFileInfo | undefined} */ (await cacheDB?.get(previousPath));

  return cache?.sha;
};

/**
 * Get file change information for the entry draft, specifically for a single-file entry.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {Entry} args.savingEntry Entry to be saved.
 * @param {IndexedDB | undefined} args.cacheDB Cache database for file info.
 * @returns {Promise<FileChange>} File change information.
 */
export const getSingleFileChange = async ({ draft, savingEntry, cacheDB }) => {
  const { collection, isNew, originalEntry, collectionFile } = draft;

  const {
    _file,
    _i18n: { i18nEnabled, defaultLocale, structureMap: { i18nSingleFileDefaultRoot } = {} },
  } = collectionFile ?? /** @type {InternalEntryCollection} */ (collection);

  const { slug, path, content } = savingEntry.locales[defaultLocale];
  const previousPath = originalEntry?.locales[defaultLocale]?.path;
  // Comparing the paths rather than the slugs also catches an entry moved with the path editor,
  // which leaves the slug alone
  const renamed = !isNew && !!previousPath && previousPath !== path;

  /**
   * Build the serialized content for the file. For `single_file_default_root`, the default locale’s
   * fields are written at the root level and non-default locales are nested under their locale key.
   * @returns {object} Serialized content object.
   */
  const buildFileContent = () => {
    if (!i18nEnabled) {
      return serializeContent({ draft, locale: '_default', valueMap: content });
    }

    const localeContents = Object.fromEntries(
      Object.entries(savingEntry.locales)
        .filter(([, le]) => !!le.content)
        .map(([locale, le]) => [locale, serializeContent({ draft, locale, valueMap: le.content })]),
    );

    if (i18nSingleFileDefaultRoot) {
      // Remove `lang` from default content to avoid stale/duplicate values; it’s always
      // auto-generated from the configured locales.
      const { lang: _lang, ...defaultContent } = localeContents[defaultLocale] ?? {};

      const nonDefaultContent = Object.fromEntries(
        Object.entries(localeContents).filter(([locale]) => locale !== defaultLocale),
      );

      return {
        // Add `lang` field at the root level as per Lume’s convention for single-file i18n
        // @see https://lume.land/plugins/multilanguage/#multilanguage-pages-from-a-single-file
        lang: [defaultLocale, ...Object.keys(nonDefaultContent)],
        ...defaultContent,
        ...nonDefaultContent,
      };
    }

    return localeContents;
  };

  return {
    action: isNew ? 'create' : renamed ? 'move' : 'update',
    slug,
    path,
    previousPath: renamed ? previousPath : undefined,
    previousSha: await getPreviousSha({ cacheDB, previousPath }),
    data: await formatEntryFile({
      content: buildFileContent(),
      _file,
    }),
  };
};

/**
 * Get file change information for the entry draft, specifically for a multi-file entry.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {Entry} args.savingEntry Entry to be saved.
 * @param {IndexedDB | undefined} args.cacheDB Cache database for file info.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @returns {Promise<FileChange | undefined>} File change information.
 */
export const getMultiFileChange = async ({ draft, savingEntry, cacheDB, locale }) => {
  const { collection, isNew, originalLocales, currentLocales, originalEntry, collectionFile } =
    draft;

  const { _file } = collectionFile ?? /** @type {InternalEntryCollection} */ (collection);
  const { slug, path, content } = savingEntry.locales[locale] ?? {};
  const previousPath = originalEntry?.locales[locale]?.path;
  const previousSha = await getPreviousSha({ cacheDB, previousPath });

  if (currentLocales[locale]) {
    const renamed = !isNew && !!originalLocales[locale] && !!previousPath && previousPath !== path;

    return {
      action: isNew || !originalLocales[locale] ? 'create' : renamed ? 'move' : 'update',
      slug,
      path,
      previousPath: renamed ? previousPath : undefined,
      previousSha,
      data: await formatEntryFile({
        content: serializeContent({ draft, locale, valueMap: content }),
        _file,
      }),
    };
  }

  if (!isNew && originalLocales[locale]) {
    return {
      action: 'delete',
      slug,
      path,
      previousSha,
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

  const {
    _i18n: {
      i18nEnabled,
      allLocales,
      defaultLocale,
      structureMap: { i18nSingleFile, i18nSingleFileDefaultRoot },
    },
  } = collectionFile ?? /** @type {InternalEntryCollection} */ (collection);

  const { localizedEntryMap, changes, savingAssets } = await createBaseSavingEntryData({
    draft,
    slugs,
  });

  const entryCollection = /** @type {InternalEntryCollection} */ (collection);

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

  const databaseName = get(backend)?.repository?.databaseName;
  const cacheDB = databaseName ? new IndexedDB(databaseName, 'file-cache') : undefined;
  const getFileChangeArgs = { draft, savingEntry, cacheDB };

  if (!i18nEnabled || i18nSingleFile || i18nSingleFileDefaultRoot) {
    changes.push(await getSingleFileChange({ ...getFileChangeArgs }));
  } else {
    await Promise.all(
      allLocales.map(async (locale) => {
        const change = await getMultiFileChange({ ...getFileChangeArgs, locale });

        if (change) {
          changes.push(change);
        }
      }),
    );
  }

  return { savingEntry, savingAssets, changes };
};
