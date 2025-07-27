import { getPathInfo } from '@sveltia/utils/file';
import { escapeRegExp } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { allAssets, getAssetByPath } from '$lib/services/assets';
import { getAssetFolder, getAssetFoldersByPath } from '$lib/services/assets/folders';
import { getMediaFieldURL } from '$lib/services/assets/info';
import { getCollection } from '$lib/services/contents/collection';
import { isCollectionIndexFile } from '$lib/services/contents/collection/index-file';
import { getField } from '$lib/services/contents/entry/fields';

/**
 * @import { Asset, Entry, EntryCollection } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Get the given entry’s thumbnail URL.
 * @param {EntryCollection} collection Entry’s collection.
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

  /** @type {FieldKeyPath[]} */
  const keyPathList = _thumbnailFieldNames
    .map((name) => {
      // Support a wildcard in the key path, e.g. `images.*.src`
      if (name.includes('*')) {
        const regex = new RegExp(`^${escapeRegExp(name).replace('\\*', '.+')}$`);

        return Object.keys(content).filter((keyPath) => regex.test(keyPath));
      }

      return name;
    })
    .flat(1);

  // Cannot use `Promise.all` or `Promise.any` here because we need the first available URL
  // eslint-disable-next-line no-restricted-syntax
  for (const keyPath of keyPathList) {
    const url = content[keyPath]
      ? // eslint-disable-next-line no-await-in-loop
        await getMediaFieldURL({ value: content[keyPath], entry, collectionName, thumbnail: true })
      : undefined;

    if (url) {
      return url;
    }
  }

  return undefined;
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
    Object.values(locales)
      .map(({ content }) =>
        Object.entries(content).map(([keyPath, value]) => {
          if (
            typeof value === 'string' &&
            (relative ? !/^[/@]/.test(value) : true) &&
            ['image', 'file'].includes(
              getField({ collectionName, keyPath, isIndexFile })?.widget ?? 'string',
            )
          ) {
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
      .flat(1)
      .filter((value, index, array) => !!value && array.indexOf(value) === index)
  );

  // Add orphaned/unused entry-relative assets
  if (relative && getAssetFolder({ collectionName, fileName })?.entryRelative) {
    const entryDirName = getPathInfo(Object.values(entry.locales)[0].path).dirname;

    get(allAssets).forEach((asset) => {
      if (
        getPathInfo(asset.path).dirname === entryDirName &&
        !assets.find(({ path }) => path === asset.path)
      ) {
        assets.push(asset);
      }
    });
  }

  return assets;
};
