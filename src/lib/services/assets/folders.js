import { getPathInfo } from '@sveltia/utils/file';
import { derived, get, writable } from 'svelte/store';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { AssetFolderInfo, TypedFieldKeyPath } from '$lib/types/private';
 */

/**
 * List of all asset folders.
 * @type {Writable<AssetFolderInfo[]>}
 */
export const allAssetFolders = writable([]);

/**
 * Global asset folder.
 * @type {Readable<AssetFolderInfo>}
 */

export const globalAssetFolder = derived([allAssetFolders], ([_allAssetFolders], set) => {
  set(
    /** @type {AssetFolderInfo} */ (
      _allAssetFolders.find(
        ({ collectionName, internalPath }) =>
          collectionName === undefined && internalPath !== undefined,
      )
    ),
  );
});

/**
 * Selected asset folder.
 * @type {Writable<AssetFolderInfo | undefined>}
 */
export const selectedAssetFolder = writable();

/**
 * Upload target asset folder.
 * @type {Readable<AssetFolderInfo>}
 */
export const targetAssetFolder = derived(
  [selectedAssetFolder, globalAssetFolder],
  ([_selectedAssetFolder, _globalAssetFolder]) =>
    // When selecting All Assets folder, the `internalPath` will be `undefined`
    _selectedAssetFolder?.internalPath !== undefined ? _selectedAssetFolder : _globalAssetFolder,
);

/**
 * Get an asset folder that matches the given conditions.
 * @param {object} cond Conditions.
 * @param {string | undefined} cond.collectionName Collection name.
 * @param {string} [cond.fileName] Collection file name. File/singleton collection only.
 * @param {TypedFieldKeyPath} [cond.typedKeyPath] Field key path. Required for field-level media
 * folders.
 * @param {boolean} [cond.isIndexFile] Whether the asset folder is for the special index file used
 * specifically in Hugo. It works only for field-level media folders in an entry collection.
 * @returns {AssetFolderInfo | undefined} Asset folder information if found.
 */
export const getAssetFolder = (cond) =>
  get(allAssetFolders).find(
    (folder) =>
      folder.collectionName === cond.collectionName &&
      folder.fileName === cond.fileName &&
      ('typedKeyPath' in cond ? folder.typedKeyPath === cond.typedKeyPath : !folder.typedKeyPath) &&
      ('isIndexFile' in cond ? folder.isIndexFile === cond.isIndexFile : !folder.isIndexFile),
  );

/**
 * Cache for {@link getAssetFoldersByPath} to avoid recreating regexes on every call.
 * `items`: non-entry-relative folders with both regex variants pre-compiled.
 * `entryRelative`: folders whose paths are relative to their parent entry.
 */
const assetFoldersByPathCache = {
  source: /** @type {AssetFolderInfo[] | undefined} */ (undefined),
  /** @type {Array<{ folder: AssetFolderInfo, regexSub: RegExp, regexExact: RegExp }>} */
  items: [],
  /** @type {AssetFolderInfo[]} */
  entryRelative: [],
};

/**
 * Rebuild {@link assetFoldersByPathCache} when `allAssetFolders` changes.
 * @returns {typeof assetFoldersByPathCache} Cache object.
 */
const getAssetFolderPathCache = () => {
  const _allAssetFolders = get(allAssetFolders);

  if (_allAssetFolders === assetFoldersByPathCache.source) {
    return assetFoldersByPathCache;
  }

  /** @type {Array<{ folder: AssetFolderInfo, regexSub: RegExp, regexExact: RegExp }>} */
  const items = [];
  /** @type {AssetFolderInfo[]} */
  const entryRelative = [];

  _allAssetFolders.forEach((folder) => {
    const { internalPath, entryRelative: isRelative } = folder;

    if (internalPath === undefined) {
      return;
    }

    if (isRelative) {
      entryRelative.push(folder);
    } else {
      // Pre-compile both regex variants so we don’t recreate them on every path lookup.
      // The internal path can contain template tags like `{{slug}}`, which we normalize to `.+?`.
      const normalizedPath = internalPath.replace(/{{.+?}}/g, '.+?');

      items.push({
        folder,
        // `\b` anchors the match at the end of the folder segment (sub-folder matching).
        // When `internalPath` is empty (root), fall back to `$` to avoid a bare `\b` anchor.
        regexSub: new RegExp(`^${normalizedPath}${internalPath ? '\\b' : '$'}`),
        regexExact: new RegExp(`^${normalizedPath}$`),
      });
    }
  });

  assetFoldersByPathCache.source = _allAssetFolders;
  assetFoldersByPathCache.items = items;
  assetFoldersByPathCache.entryRelative = entryRelative;

  return assetFoldersByPathCache;
};

/**
 * Get collection asset folders that match the given path.
 * @param {string} path Asset path.
 * @param {object} [options] Options.
 * @param {boolean} [options.matchSubFolders] Whether to match assets stored in the subfolders of a
 * global/collection internal path. Default: `true`. If `false`, for example, if the given `path` is
 * `images/products/image.jpg`, it matches the `images/products` folder but not `images`.
 * @returns {AssetFolderInfo[]} Asset folders.
 */
export const getAssetFoldersByPath = (path, { matchSubFolders = true } = {}) => {
  const { filename, dirname } = getPathInfo(path);

  // Exclude files with a leading `+` sign, which are Svelte page/layout files
  if (filename.startsWith('+')) {
    return [];
  }

  const { items, entryRelative } = getAssetFolderPathCache();
  const dir = dirname ?? '';

  const results = [
    ...entryRelative.filter(({ internalPath }) => path.startsWith(`${internalPath}/`)),
    // Compare that the enclosing directory is exactly the same as the internal path, and ignore
    // any subdirectories, unless the `matchSubFolders` option is specified.
    ...items
      .filter(({ regexSub, regexExact }) => (matchSubFolders ? regexSub : regexExact).test(dir))
      .map(({ folder }) => folder),
  ];

  // `internalPath` is always a string for items in results (entry-relative items are filtered to
  // those with defined `internalPath`, and global-folder items always have `internalPath` set).
  return results.sort((a, b) =>
    /** @type {string} */ (b.internalPath).localeCompare(/** @type {string} */ (a.internalPath)),
  );
};

/**
 * Check if asset creation is allowed in the folder. Can’t upload assets if collection assets are
 * saved at entry-relative paths or the asset folder contains template tags.
 * @param {AssetFolderInfo | undefined} assetFolder Asset folder.
 * @returns {boolean} Result.
 */
export const canCreateAsset = (assetFolder) =>
  !!assetFolder && !assetFolder.entryRelative && !assetFolder.hasTemplateTags;
