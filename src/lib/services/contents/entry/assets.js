import { unique } from '@sveltia/utils/array';
import { getPathInfo } from '@sveltia/utils/file';
import { escapeRegExp } from '@sveltia/utils/string';

import { getAssetByPath, isRelativePath } from '$lib/services/assets';
import { getAssetFolder, getAssetFoldersByPath } from '$lib/services/assets/folders';
import { revokeBlobURLIfNeeded } from '$lib/services/assets/info';
import { canCreateThumbnail } from '$lib/services/assets/kinds';
import { getMediaFieldSource, getMediaFieldURL } from '$lib/services/assets/media-field';
import { findEntriesByAssets } from '$lib/services/assets/references';
import { allAssets } from '$lib/services/assets/state';
import { allEntries } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { isArrayFileCollection } from '$lib/services/contents/collection/predicates';
import { getOwnedEntryFolderPath } from '$lib/services/contents/draft/save/assets';
import { fillEntryPathTemplate } from '$lib/services/contents/entry';
import { getField } from '$lib/services/contents/entry/fields';
import { getEntryDisplayLocale } from '$lib/services/contents/entry/paths';
import { MEDIA_FIELD_TYPES } from '$lib/services/contents/fields';
import { getOrCreate, memoizeOnSource } from '$lib/services/utils/cache';
import { getEntryAssetVersion } from '$lib/services/workflow/assets';

/**
 * @import { Asset, Entry, InternalCollection, InternalEntryCollection } from '$lib/types/private';
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
 * An entry’s thumbnail.
 * @typedef {object} EntryThumbnail
 * @property {string} src Image URL.
 * @property {boolean} owned Whether `src` is an object URL created for this thumbnail alone, which
 * the caller has to release once it’s no longer displayed. A URL found in a field value or the
 * asset’s public URL is not.
 */

/**
 * Get the given entry’s thumbnail.
 * @param {InternalEntryCollection} collection Entry’s collection.
 * @param {Entry} entry Entry.
 * @returns {Promise<EntryThumbnail | undefined>} Thumbnail. Use {@link loadEntryThumbnail} to
 * display it, which releases the object URL for you.
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
  const locale = /** @type {string} */ (getEntryDisplayLocale(locales, defaultLocale));
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

    // Support wildcards in the key path, e.g. `images.*.src` or `sections.*.images.*`
    if (name.includes('*')) {
      const regex = getOrCreate(
        thumbnailFieldRegexCache,
        name,
        () => new RegExp(`^${escapeRegExp(name).replaceAll('\\*', '.+')}$`),
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
    const args = { value, entry, collectionName, typedKeyPath: keyPath, locale };
    const { asset } = (value && getMediaFieldSource(args)) || {};

    // Skip a file without a thumbnail, like a document, rather than show it as a broken image, and
    // try the next candidate instead
    const src =
      value && (!asset || canCreateThumbnail(asset))
        ? // eslint-disable-next-line no-await-in-loop
          await getMediaFieldURL({ ...args, thumbnail: true })
        : undefined;

    if (src) {
      // For an asset, `getMediaFieldURL()` returns either a thumbnail object URL of its own, or the
      // asset’s public URL. For anything else, it returns the field value as is
      return { src, owned: !!asset && src.startsWith('blob:') };
    }
  }

  return undefined;
};

/**
 * Load the given entry’s thumbnail for display, and release it once it’s no longer needed. Every
 * thumbnail comes with an object URL of its own, so an entry list that renders its rows again, or
 * is left, would otherwise keep a thumbnail in memory for each time it was shown. Call it from an
 * effect and return the result, so the thumbnail is released when the effect reruns or is
 * destroyed:
 * `$effect(() => loadEntryThumbnail(collection, entry, (src) => { thumbnail = src; }))`.
 * @param {InternalEntryCollection} collection Entry’s collection.
 * @param {Entry} entry Entry.
 * @param {(src: string | undefined) => void} onLoad Function called with the thumbnail URL once
 * it’s loaded, and with `undefined` when it’s released, so the image stops pointing at it. It’s not
 * called for an entry without a thumbnail, or when the thumbnail can’t be loaded.
 * @returns {() => void} Function to release the thumbnail.
 */
export const loadEntryThumbnail = (collection, entry, onLoad) => {
  let released = false;
  /** @type {EntryThumbnail | undefined} */
  let thumbnail;

  getEntryThumbnail(collection, entry).then(
    (result) => {
      if (released) {
        // Nothing displays a thumbnail that arrives too late, so let it go right away
        if (result?.owned) {
          revokeBlobURLIfNeeded(result.src);
        }

        return;
      }

      thumbnail = result;

      if (result) {
        onLoad(result.src);
      }
    },
    () => {
      // A missing or undecodable image just leaves the entry without a thumbnail
    },
  );

  return () => {
    released = true;

    if (thumbnail) {
      onLoad(undefined);

      // The revocation waits for the next frame and skips a URL an element still displays, so an
      // image being removed along with the row doesn’t lose its source midway
      if (thumbnail.owned) {
        revokeBlobURLIfNeeded(thumbnail.src);
      }
    }
  };
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

  return getOrCreate(entryIdsByFolderCache, entries, () => {
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

    return map;
  });
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
const getAssetsByFolder = memoizeOnSource(
  () => allAssets.current,
  (_allAssets) => {
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

    return map;
  },
);

/**
 * Get the assets stored in the given folder or any of its subfolders. Every asset is indexed under
 * its own folder and each folder above it, so this is a lookup rather than a scan of the whole
 * asset library — which would otherwise be repeated for every entry being deleted at once.
 * @param {string} folderPath Folder path.
 * @returns {IndexedAsset[]} Assets, in the order of `allAssets`.
 */
const getAssetsBelowFolder = (folderPath) => getAssetsByFolder().get(folderPath) ?? [];

/**
 * Get a folder path for each of the given entry’s locale files, leaving out a file without one.
 * @param {Entry} entry Entry.
 * @param {(path: string) => string | undefined} getFolderPath Function returning the folder path
 * for a file path.
 * @returns {string[]} Folder paths.
 */
const mapEntryFolderPaths = ({ locales }, getFolderPath) =>
  Object.values(locales).flatMap(({ path }) => getFolderPath(path) ?? []);

/**
 * Get the folders the given entry occupies by itself. With the `multiple_folders` and
 * `multiple_root_folders` i18n structures, each locale has a folder of its own. When entries are
 * files sharing a folder, there is none.
 * @param {InternalCollection} collection Collection the entry belongs to.
 * @param {Entry} entry Entry.
 * @returns {string[]} Folder paths.
 */
const getOwnedEntryFolderPaths = (collection, entry) =>
  mapEntryFolderPaths(entry, (path) => getOwnedEntryFolderPath(collection, path));

/**
 * Get the folders the given entry’s files are stored in.
 * @param {Entry} entry Entry.
 * @returns {string[]} Folder paths.
 */
const getEntryFolderPaths = (entry) =>
  mapEntryFolderPaths(entry, (path) => getPathInfo(path).dirname);

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
      Object.entries(locales)
        .flatMap(([locale, { content }]) =>
          Object.entries(content ?? {}).map(([keyPath, value]) => {
            if (typeof value === 'string' && (relative ? isRelativePath(value) : true)) {
              const widget =
                getField({ collectionName, fileName, keyPath, isIndexFile })?.widget ?? 'string';

              if (!MEDIA_FIELD_TYPES.includes(widget)) {
                return undefined;
              }

              const asset = getAssetByPath({ value, entry, collectionName, fileName, locale });

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
    // folder of its own, so the entry’s assets are spread across all of them. Only a folder the
    // entry occupies by itself counts: when entries are files sharing a folder, the other files in
    // it can belong to any of them, so none of those is this entry’s to move or delete
    const entryFolderPaths = new Set(getOwnedEntryFolderPaths(collection, entry));
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

          // A set in the index is never empty, so it holds another entry unless it holds just this
          if (entryIds && (entryIds.size > 1 || !entryIds.has(entry.id))) {
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

/**
 * Get the versions of the relative assets associated with the given entry that the entry has.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry.
 * @param {string} args.collectionName Name of a collection that the entry belongs to.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @returns {Asset[]} Assets.
 */
const getEntryRelativeAssetVersions = ({ entry, collectionName, fileName }) =>
  /** @type {Asset[]} */ ([
    // Two versions of a file can map to the same asset, so the list is deduplicated again
    ...new Set(
      getAssociatedAssets({ entry, collectionName, fileName, relative: true })
        .map((asset) => getEntryAssetVersion(asset, entry))
        .filter(Boolean),
    ),
  ]);

/**
 * Collect the assets stored outside the folders their entry occupies by itself, which another
 * entry may refer to.
 * @param {InternalCollection} collection Collection the entries belong to.
 * @param {Entry[]} entries Entries.
 * @param {Asset[][]} assetLists Assets of each entry, in the order of the entries.
 * @returns {Asset[]} Assets, deduplicated by path.
 */
const collectSharedAssets = (collection, entries, assetLists) => {
  /** @type {Map<string, Asset>} */
  const sharedAssets = new Map();

  entries.forEach((entry, index) => {
    const folderPaths = getOwnedEntryFolderPaths(collection, entry);

    assetLists[index].forEach((asset) => {
      if (!folderPaths.some((folderPath) => asset.path.startsWith(`${folderPath}/`))) {
        sharedAssets.set(asset.path, asset);
      }
    });
  });

  return [...sharedAssets.values()];
};

/**
 * Find the entries referring to each of the given assets. One pass for all the assets, however many
 * entries are being deleted, over the collection and any other entry stored in the same folders as
 * the given entries, e.g. that of another collection filtering them.
 * @param {Asset[]} assets Assets.
 * @param {Entry[]} entries Entries the assets belong to.
 * @param {string} collectionName Name of a collection that the entries belong to.
 * @returns {Map<string, string[]>} IDs of the referring entries, keyed with the asset path.
 */
const getReferringEntryIds = (assets, entries, collectionName) => {
  const folderPaths = new Set(entries.flatMap(getEntryFolderPaths));

  const referringEntries = findEntriesByAssets(
    assets.map((asset) => ({ asset })),
    {
      entries: [
        ...new Set([
          ...getEntriesByCollection(collectionName),
          ...allEntries.current.filter((entry) =>
            getEntryFolderPaths(entry).some((dirPath) => folderPaths.has(dirPath)),
          ),
        ]),
      ],
    },
  );

  return new Map(
    assets.map((asset, index) => [asset.path, referringEntries[index].map(({ id }) => id)]),
  );
};

/**
 * Get the assets stored alongside each of the given entries, which are removed with it. Only a
 * collection whose asset folder is entry-relative stores assets with its entries.
 *
 * An asset outside the folders an entry occupies by itself, as when the entries are files sharing a
 * folder, is left out if another entry of the collection refers to it too: a duplicated entry keeps
 * referring to the original’s files there, and would be left with broken links. That includes
 * another of the given entries, so a file shared by two entries deleted together stays behind
 * rather than being deleted with either, which the other may still need, e.g. while its deletion
 * awaits review.
 * @param {object} args Arguments.
 * @param {Entry[]} args.entries Entries.
 * @param {string} args.collectionName Name of a collection that the entries belong to.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @returns {Asset[][]} Assets of each entry, in the order of the entries, or empty lists unless the
 * collection stores them with the entries. The entries of a collection storing all of them in one
 * file share the folder of the file, and an asset there can be used by any of them, so none of the
 * assets belongs to one entry alone. Only the versions an entry has are returned: a file another
 * pull request put at the same path isn’t the entry’s to remove.
 */
export const getEntriesRelativeAssets = ({ entries, collectionName, fileName }) => {
  const collection = getAssetFolder({ collectionName, fileName })?.entryRelative
    ? getCollection(collectionName)
    : undefined;

  if (!collection || isArrayFileCollection(collection)) {
    return entries.map(() => []);
  }

  const assetLists = entries.map((entry) =>
    getEntryRelativeAssetVersions({ entry, collectionName, fileName }),
  );

  const sharedAssets = collectSharedAssets(collection, entries, assetLists);

  if (!sharedAssets.length) {
    return assetLists;
  }

  const referringIds = getReferringEntryIds(sharedAssets, entries, collectionName);

  return assetLists.map((list, index) =>
    list.filter((asset) =>
      (referringIds.get(asset.path) ?? []).every((id) => id === entries[index].id),
    ),
  );
};

/**
 * Get the assets stored alongside the given entry, which are removed with it. See
 * {@link getEntriesRelativeAssets} for which ones.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry.
 * @param {string} args.collectionName Name of a collection that the entry belongs to.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @returns {Asset[]} Assets, or an empty list unless the collection stores them with the entry.
 */
export const getEntryRelativeAssets = ({ entry, collectionName, fileName }) =>
  getEntriesRelativeAssets({ entries: [entry], collectionName, fileName })[0];
