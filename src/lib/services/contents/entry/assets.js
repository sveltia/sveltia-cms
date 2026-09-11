import { getPathInfo } from '@sveltia/utils/file';
import { escapeRegExp } from '@sveltia/utils/string';

import { allAssets, getAssetByPath, isRelativePath } from '$lib/services/assets';
import { getAssetFolder, getAssetFoldersByPath } from '$lib/services/assets/folders';
import { getMediaFieldURL } from '$lib/services/assets/info';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getField } from '$lib/services/contents/entry/fields';

/**
 * @import { Asset, Entry, InternalEntryCollection } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Get the given entry’s thumbnail URL.
 * @param {InternalEntryCollection} collection Entry’s collection.
 * @param {Entry} entry Entry.
 * @returns {Promise<string | undefined>} URL.
 */
export const getEntryThumbnail = async (collection, entry) => {
  const {
    name: collectionName,
    _i18n: { defaultLocale },
    _thumbnailFieldNames,
  } = collection;

  const { locales } = entry;
  const { content } = locales[defaultLocale] ?? Object.values(locales)[0] ?? {};

  if (!content) {
    return undefined;
  }

  const contentKeys = _thumbnailFieldNames.some((name) => name.includes('*'))
    ? Object.keys(content)
    : undefined;

  /** @type {FieldKeyPath[]} */
  const keyPathList = _thumbnailFieldNames.flatMap((name) => {
    // Support a wildcard in the key path, e.g. `images.*.src`
    if (name.includes('*')) {
      const regex = new RegExp(`^${escapeRegExp(name).replace('\\*', '.+')}$`);

      return /** @type {string[]} */ (contentKeys).filter((keyPath) => regex.test(keyPath));
    }

    return name;
  });

  // Cannot use `Promise.all` or `Promise.any` here because we need the first available URL
  // eslint-disable-next-line no-restricted-syntax
  for (const keyPath of keyPathList) {
    const url = content[keyPath]
      ? // eslint-disable-next-line no-await-in-loop
        await getMediaFieldURL({
          value: content[keyPath],
          entry,
          collectionName,
          typedKeyPath: keyPath,
          thumbnail: true,
        })
      : undefined;

    if (url) {
      return url;
    }
  }

  return undefined;
};

/**
 * Collect the folders below the given one that hold an entry of their own. In a nested collection,
 * an entry can have others stored beneath it, and each of those keeps its media in its own folder,
 * so those files belong to the descendant rather than to the entry being looked at.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Name of the collection the entry belongs to.
 * @param {Entry} args.entry Entry being looked at.
 * @param {string} args.entryFolderPath Folder the entry is stored in.
 * @returns {Set<string>} Folder paths. A folder the entry shares with another one is not included,
 * because neither entry owns it.
 */
const getDescendantEntryFolderPaths = ({ collectionName, entry, entryFolderPath }) => {
  /** @type {Set<string>} */
  const paths = new Set();

  getEntriesByCollection(collectionName).forEach((otherEntry) => {
    if (otherEntry.id === entry.id) {
      return;
    }

    Object.values(otherEntry.locales).forEach(({ path }) => {
      const dirPath = getPathInfo(path).dirname;

      if (dirPath !== undefined && dirPath.startsWith(`${entryFolderPath}/`)) {
        paths.add(dirPath);
      }
    });
  });

  return paths;
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
  const seen = new Set();

  const assets = /** @type {Asset[]} */ (
    Object.values(locales)
      .flatMap(({ content }) =>
        Object.entries(content ?? {}).map(([keyPath, value]) => {
          if (typeof value === 'string' && (relative ? isRelativePath(value) : true)) {
            const widget = getField({ collectionName, keyPath, isIndexFile })?.widget ?? 'string';

            if (widget !== 'image' && widget !== 'file') {
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
      .filter((value) => !!value && !seen.has(value) && (seen.add(value), true))
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
    const _allAssets = allAssets.current;

    entryFolderPaths.forEach((entryFolderPath) => {
      const descendantFolderPaths = getDescendantEntryFolderPaths({
        collectionName,
        entry,
        entryFolderPath,
      });

      /**
       * Check whether the given folder belongs to an entry stored below this one, which owns the
       * files in it.
       * @param {string} assetFolderPath Folder holding an asset, at or below the entry folder.
       * @returns {boolean} Result.
       */
      const isDescendantEntryFolder = (assetFolderPath) => {
        // The entry folder is always an ancestor here, so there’s a slash to walk back to
        let dirPath = assetFolderPath;

        while (dirPath.length > entryFolderPath.length) {
          if (descendantFolderPaths.has(dirPath)) {
            return true;
          }

          dirPath = dirPath.slice(0, dirPath.lastIndexOf('/'));
        }

        return false;
      };

      _allAssets.forEach((asset) => {
        const assetFolderPath = getPathInfo(asset.path).dirname;

        if (
          assetFolderPath !== undefined &&
          // Include assets in the entry folder and its subfolders
          (assetFolderPath === entryFolderPath ||
            assetFolderPath.startsWith(`${entryFolderPath}/`)) &&
          !isDescendantEntryFolder(assetFolderPath) &&
          !existingPaths.has(asset.path)
        ) {
          assets.push(asset);
          existingPaths.add(asset.path);
        }
      });
    });
  }

  return assets;
};
