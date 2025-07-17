import { generateUUID } from '@sveltia/utils/crypto';
import { getBlobRegex } from '@sveltia/utils/file';
import { toRaw } from '@sveltia/utils/object';
import { IndexedDB } from '@sveltia/utils/storage';
import { get } from 'svelte/store';
import { globalAssetFolder } from '$lib/services/assets/folders';
import { getDefaultMediaLibraryOptions } from '$lib/services/assets/media-library';
import { backend } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';
import { replaceBlobURL } from '$lib/services/contents/draft/save/assets';
import { createEntryPath } from '$lib/services/contents/draft/save/entry-path';
import { serializeContent } from '$lib/services/contents/draft/save/serialize';
import { formatEntryFile } from '$lib/services/contents/file/format';

/**
 * @import {
 * Asset,
 * Entry,
 * EntryCollection,
 * EntryDraft,
 * EntrySlugVariants,
 * FileChange,
 * InternalLocaleCode,
 * LocalizedEntryMap,
 * RepositoryFileInfo,
 * } from '$lib/types/private';
 */

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
 * Get the previous SHA of the file from the cache database.
 * @param {object} args Arguments.
 * @param {string | undefined} args.previousPath Previous file path.
 * @param {IndexedDB | undefined} args.cacheDB Cache database for file info.
 * @returns {Promise<string | undefined>} Previous SHA or `undefined` if not found.
 */
const getPreviousSha = async ({ previousPath, cacheDB }) => {
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
const getSingleFileChange = async ({ draft, savingEntry, cacheDB }) => {
  const { collection, isNew, originalSlugs, originalEntry, collectionFile } = draft;

  const {
    _file,
    _i18n: { i18nEnabled, defaultLocale },
  } = collectionFile ?? /** @type {EntryCollection} */ (collection);

  const { slug, path, content } = savingEntry.locales[defaultLocale];
  const renamed = !isNew && (originalSlugs?.[defaultLocale] ?? originalSlugs?._) !== slug;
  const previousPath = originalEntry?.locales[defaultLocale]?.path;

  return {
    action: isNew ? 'create' : renamed ? 'move' : 'update',
    slug,
    path,
    previousPath: renamed ? previousPath : undefined,
    previousSha: await getPreviousSha({ cacheDB, previousPath }),
    data: await formatEntryFile({
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
const getMultiFileChange = async ({ draft, savingEntry, cacheDB, locale }) => {
  const {
    collection,
    isNew,
    originalLocales,
    currentLocales,
    originalSlugs,
    originalEntry,
    collectionFile,
  } = draft;

  const { _file } = collectionFile ?? /** @type {EntryCollection} */ (collection);
  const { slug, path, content } = savingEntry.locales[locale] ?? {};
  const previousPath = originalEntry?.locales[locale]?.path;
  const previousSha = await getPreviousSha({ cacheDB, previousPath });

  if (currentLocales[locale]) {
    const renamed =
      !isNew && originalLocales[locale] && (originalSlugs?.[locale] ?? originalSlugs?._) !== slug;

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
  const { collection, originalEntry, collectionFile } = draft;
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

  const databaseName = get(backend)?.repository?.databaseName;
  const cacheDB = databaseName ? new IndexedDB(databaseName, 'file-cache') : undefined;
  const getFileChangeArgs = { draft, savingEntry, cacheDB };

  if (!i18nEnabled || structure === 'single_file') {
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
