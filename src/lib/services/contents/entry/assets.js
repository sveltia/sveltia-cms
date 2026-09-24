import { unique } from '@sveltia/utils/array';
import { getPathInfo } from '@sveltia/utils/file';
import { escapeRegExp } from '@sveltia/utils/string';

import { allAssets, getAssetByPath, isRelativePath } from '$lib/services/assets';
import { getAssetFolder, getAssetFoldersByPath } from '$lib/services/assets/folders';
import { getMediaFieldSource, getMediaFieldURL } from '$lib/services/assets/info';
import { canCreateThumbnail } from '$lib/services/assets/kinds';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { fillEntryPathTemplate } from '$lib/services/contents/entry';
import { getField } from '$lib/services/contents/entry/fields';
import { MEDIA_FIELD_TYPES } from '$lib/services/contents/fields';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { Asset, Entry, InternalEntryCollection } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Cache of the regular expressions matching a wildcard thumbnail field name, keyed by the name.
 * The entry list asks for a thumbnail once per row, so the pattern is compiled once per collection
 * rather than once per entry.
 * @type {Map<string, RegExp>}
 */
const thumbnailFieldRegexCache = new Map();

/**
 * A field value or filled file path to look for an entry thumbnail.
 * @typedef {object} ThumbnailCandidate
 * @property {any} value Field value or file path.
 * @property {FieldKeyPath} [keyPath] Field key path. Not available for a file path.
 */

/**
 * Check if the given `thumbnail` option item is a path template rather than a field key path.
 * @param {string} name Field key path or path template.
 * @returns {boolean} Result.
 */
export const isThumbnailPath = (name) => name.startsWith('/');

/**
 * Get the given entry’s thumbnail URL.
 * @param {InternalEntryCollection} collection Entry’s collection.
 * @param {Entry} entry Entry.
 * @returns {Promise<string | undefined>} URL.
 */
export const getEntryThumbnail = async (collection, entry) => {
  const {
    name: collectionName,
    fields = [],
    preview_path_date_field: dateFieldName,
    _i18n: { defaultLocale },
    _thumbnailFieldNames,
  } = collection;

  const { locales } = entry;
  const locale = defaultLocale in locales ? defaultLocale : Object.keys(locales)[0];
  const { content, slug, path: entryFilePath } = locales[locale] ?? {};

  if (!content) {
    return undefined;
  }

  const contentKeys = _thumbnailFieldNames.some((name) => name.includes('*'))
    ? Object.keys(content)
    : undefined;

  /** @type {ThumbnailCandidate[]} */
  const candidates = _thumbnailFieldNames.flatMap((name) => {
    // Fill in a path template like `/images/{{slug}}.webp`, which works like a field value
    if (isThumbnailPath(name)) {
      const value = fillEntryPathTemplate({
        pathTemplate: name,
        dateFieldName,
        fields,
        collection,
        locale,
        slug,
        entryFilePath,
        content,
        isIndexFile: isCollectionIndexFile(collection, entry),
      });

      return /** @type {ThumbnailCandidate[]} */ ([{ value }]);
    }

    // Support a wildcard in the key path, e.g. `images.*.src`
    if (name.includes('*')) {
      const regex = getOrCreate(
        thumbnailFieldRegexCache,
        name,
        () => new RegExp(`^${escapeRegExp(name).replace('\\*', '.+')}$`),
      );

      return /** @type {string[]} */ (contentKeys)
        .filter((keyPath) => regex.test(keyPath))
        .map((keyPath) => ({ value: content[keyPath], keyPath }));
    }

    return [{ value: content[name], keyPath: name }];
  });

  // Cannot use `Promise.all` or `Promise.any` here because we need the first available URL
  // eslint-disable-next-line no-restricted-syntax
  for (const { value, keyPath } of candidates) {
    const args = { value, entry, collectionName, typedKeyPath: keyPath };
    const { asset } = (value && getMediaFieldSource(args)) || {};

    // Skip a file without a thumbnail, like a document, rather than show it as a broken image, and
    // try the next candidate instead
    const url =
      value && (!asset || canCreateThumbnail(asset))
        ? // eslint-disable-next-line no-await-in-loop
          await getMediaFieldURL({ ...args, thumbnail: true })
        : undefined;

    if (url) {
      return url;
    }
  }

  return undefined;
};

/**
 * Cache of {@link getEntryIdsByFolder} results, keyed by a collection’s entry list, which keeps its
 * identity until the entries change.
 * @type {WeakMap<Entry[], Map<string, Set<string>>>}
 */
const entryIdsByFolderCache = new WeakMap();

/**
 * Index the entries of the given collection by the folders their files are stored in.
 * @param {string} collectionName Collection name.
 * @returns {Map<string, Set<string>>} IDs of the entries with a file in each folder.
 */
const getEntryIdsByFolder = (collectionName) => {
  const entries = getEntriesByCollection(collectionName);
  let index = entryIdsByFolderCache.get(entries);

  if (!index) {
    /** @type {Map<string, Set<string>>} */
    const map = new Map();

    entries.forEach(({ id, locales }) => {
      Object.values(locales).forEach(({ path }) => {
        const dirPath = getPathInfo(path).dirname;

        if (dirPath !== undefined) {
          getOrCreate(map, dirPath, () => new Set()).add(id);
        }
      });
    });

    index = map;
    entryIdsByFolderCache.set(entries, index);
  }

  return index;
};

/**
 * An asset along with the folder it’s stored in.
 * @typedef {object} IndexedAsset
 * @property {Asset} asset Asset.
 * @property {string} dirPath Folder the asset is stored in.
 */

/**
 * Index of `allAssets` by folder, rebuilt when the store is replaced. See
 * {@link getAssetsBelowFolder}.
 */
const assetsByFolderCache = {
  source: /** @type {Asset[] | undefined} */ (undefined),
  /** @type {Map<string, IndexedAsset[]>} */
  map: new Map(),
};

/**
 * Get the assets stored in the given folder or any of its subfolders. Every asset is indexed under
 * its own folder and each folder above it, so this is a lookup rather than a scan of the whole
 * asset library — which would otherwise be repeated for every entry being deleted at once.
 * @param {string} folderPath Folder path.
 * @returns {IndexedAsset[]} Assets, in the order of `allAssets`.
 */
const getAssetsBelowFolder = (folderPath) => {
  const { current: _allAssets } = allAssets;

  if (_allAssets !== assetsByFolderCache.source) {
    /** @type {Map<string, IndexedAsset[]>} */
    const map = new Map();

    _allAssets.forEach((asset) => {
      const dirPath = getPathInfo(asset.path).dirname;

      if (dirPath === undefined) {
        return;
      }

      const item = { asset, dirPath };

      // Walk up to the top-level folder
      for (let path = dirPath; ; path = path.slice(0, path.lastIndexOf('/'))) {
        getOrCreate(map, path, () => []).push(item);

        if (!path.includes('/')) {
          break;
        }
      }
    });

    assetsByFolderCache.source = _allAssets;
    assetsByFolderCache.map = map;
  }

  return assetsByFolderCache.map.get(folderPath) ?? [];
};

/**
 * Get a list of assets associated with the given entry.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry.
 * @param {string} args.collectionName Name of a collection that the entry belongs to.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {boolean} [args.relative] Whether to only collect assets stored at a relative path.
 * @returns {Asset[]} Assets.
 */
export const getAssociatedAssets = ({ entry, collectionName, fileName, relative = false }) => {
  const { locales } = entry;
  const collection = getCollection(collectionName);

  if (!collection) {
    return [];
  }

  const isIndexFile = isCollectionIndexFile(collection, entry);

  const assets = /** @type {Asset[]} */ (
    unique(
      Object.values(locales)
        .flatMap(({ content }) =>
          Object.entries(content ?? {}).map(([keyPath, value]) => {
            if (typeof value === 'string' && (relative ? isRelativePath(value) : true)) {
              const widget = getField({ collectionName, keyPath, isIndexFile })?.widget ?? 'string';

              if (!MEDIA_FIELD_TYPES.includes(widget)) {
                return undefined;
              }

              const asset = getAssetByPath({ value, entry, collectionName, fileName });

              if (
                asset &&
                getAssetFoldersByPath(asset.path).some(
                  (f) =>
                    f.collectionName === collectionName &&
                    f.fileName === fileName &&
                    (relative ? f.entryRelative : true),
                )
              ) {
                return asset;
              }
            }

            return undefined;
          }),
        )
        .filter(Boolean),
    )
  );

  // Add orphaned/unused entry-relative assets
  if (relative && getAssetFolder({ collectionName, fileName })?.entryRelative) {
    // With the `multiple_folders` and `multiple_root_folders` i18n structures, each locale has a
    // folder of its own, so the entry’s assets are spread across all of them
    const entryFolderPaths = new Set(
      /** @type {string[]} */ (
        Object.values(entry.locales)
          .map(({ path }) => getPathInfo(path).dirname)
          .filter((dirPath) => dirPath !== undefined)
      ),
    );

    const existingPaths = new Set(assets.map(({ path }) => path));
    const entryIdsByFolder = getEntryIdsByFolder(collectionName);

    entryFolderPaths.forEach((entryFolderPath) => {
      /**
       * Check whether the given folder belongs to an entry stored below this one, which owns the
       * files in it. In a nested collection, an entry can have others stored beneath it, and each
       * of those keeps its media in its own folder.
       * @param {string} assetFolderPath Folder holding an asset, at or below the entry folder.
       * @returns {boolean} Result.
       */
      const isDescendantEntryFolder = (assetFolderPath) => {
        // The entry folder is always an ancestor here, so there’s a slash to walk back to
        let dirPath = assetFolderPath;

        while (dirPath.length > entryFolderPath.length) {
          const entryIds = entryIdsByFolder.get(dirPath);

          if (entryIds && [...entryIds].some((id) => id !== entry.id)) {
            return true;
          }

          dirPath = dirPath.slice(0, dirPath.lastIndexOf('/'));
        }

        return false;
      };

      // Include assets in the entry folder and its subfolders
      getAssetsBelowFolder(entryFolderPath).forEach(({ asset, dirPath }) => {
        if (!isDescendantEntryFolder(dirPath) && !existingPaths.has(asset.path)) {
          assets.push(asset);
          existingPaths.add(asset.path);
        }
      });
    });
  }

  return assets;
};
