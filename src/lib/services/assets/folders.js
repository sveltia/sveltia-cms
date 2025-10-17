import { getPathInfo } from '@sveltia/utils/file';
import { derived, get, writable } from 'svelte/store';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { AssetFolderInfo } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
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
 * Get an asset folder that matches the given condition.
 * @param {object} args Arguments.
 * @param {string | undefined} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {FieldKeyPath} [args.keyPath] Field key path.
 * @returns {AssetFolderInfo | undefined} Asset folder information.
 */
export const getAssetFolder = ({ collectionName, fileName, keyPath }) =>
  get(allAssetFolders).find(
    (f) => f.collectionName === collectionName && f.fileName === fileName && f.keyPath === keyPath,
  );

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
  const { filename } = getPathInfo(path);

  // Exclude files with a leading `+` sign, which are Svelte page/layout files
  if (filename.startsWith('+')) {
    return [];
  }

  return get(allAssetFolders)
    .filter(({ internalPath, entryRelative }) => {
      if (internalPath === undefined) {
        return false;
      }

      if (entryRelative) {
        return path.startsWith(`${internalPath}/`);
      }

      // Compare that the enclosing directory is exactly the same as the internal path, and ignore
      // any subdirectories, unless the `matchSubFolders` option is specified. The internal path can
      // contain template tags like `{{slug}}` so that we have to take it into account.
      const normalizedPath = internalPath.replace(/{{.+?}}/g, '.+?');
      const anchor = internalPath && matchSubFolders ? '\\b' : '$';
      const regex = new RegExp(`^${normalizedPath}${anchor}`);

      return regex.test(getPathInfo(path).dirname ?? '');
    })
    .sort((a, b) => (b.internalPath ?? '').localeCompare(a.internalPath ?? '') ?? 0);
};

/**
 * Check if asset creation is allowed in the folder. Can’t upload assets if collection assets are
 * saved at entry-relative paths or the asset folder contains template tags.
 * @param {AssetFolderInfo | undefined} assetFolder Asset folder.
 * @returns {boolean} Result.
 */
export const canCreateAsset = (assetFolder) =>
  !!assetFolder && !assetFolder.entryRelative && !assetFolder.hasTemplateTags;
