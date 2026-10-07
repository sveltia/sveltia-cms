import { getPathInfo } from '@sveltia/utils/file';
import { escapeRegExp } from '@sveltia/utils/string';

import { isInCmsFolder } from '$lib/services/assets/reserved';
import { lockedBranch } from '$lib/services/backends/branch-access';
import { ESCAPED_PLACEHOLDER_REGEX } from '$lib/services/common/template/constants';
import { getCustomComponentName } from '$lib/services/contents/fields/rich-text/components/definitions';
import {
  getLocaleFolderPattern,
  hasLocalePlaceholder,
} from '$lib/services/contents/i18n/placeholder';
import { memoizeOnSource } from '$lib/services/utils/cache';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';
import { openAuthoring } from '$lib/services/workflow/open-authoring';

/**
 * @import { Asset, AssetFolderInfo, TypedFieldKeyPath } from '$lib/types/private';
 */

/**
 * List of all asset folders.
 * @type {{ current: AssetFolderInfo[] }}
 */
export const allAssetFolders = createRawState([]);

/**
 * Global asset folder. A field-level folder in a custom editor component doesn’t belong to a
 * collection either, and comes first when the global `media_folder` option isn’t configured.
 */
export const globalAssetFolder = createDerivedState(
  () =>
    /** @type {AssetFolderInfo | undefined} */ (
      allAssetFolders.current.find(
        ({ collectionName, componentName, typedKeyPath, internalPath }) =>
          collectionName === undefined &&
          componentName === undefined &&
          typedKeyPath === undefined &&
          internalPath !== undefined,
      )
    ),
);

/**
 * Selected asset folder.
 * @type {{ current: AssetFolderInfo | undefined }}
 */
export const selectedAssetFolder = createRawState();

/**
 * Upload target asset folder.
 */
export const targetAssetFolder = createDerivedState(() => {
  const { current: _selectedAssetFolder } = selectedAssetFolder;

  // When selecting All Assets folder, the `internalPath` will be `undefined`
  return _selectedAssetFolder?.internalPath !== undefined
    ? _selectedAssetFolder
    : globalAssetFolder.current;
});

/**
 * Get an asset folder that matches the given conditions.
 * @param {object} cond Conditions.
 * @param {string} [cond.collectionName] Collection name.
 * @param {string} [cond.fileName] Collection file name. File/singleton collection only.
 * @param {string} [cond.componentName] Custom editor component name for a field-level asset folder.
 * @param {TypedFieldKeyPath} [cond.typedKeyPath] Field key path. Required for field-level media
 * folders.
 * @param {boolean} [cond.isIndexFile] Whether the asset folder is for the special index file used
 * specifically in Hugo. It works only for field-level media folders in an entry collection.
 * @returns {AssetFolderInfo | undefined} Asset folder information if found.
 */
export const getAssetFolder = (cond) => {
  const typedKeyPath =
    'typedKeyPath' in cond
      ? // Extract the actual key path, e.g. `body:c55:content` -> `content`
        cond.typedKeyPath?.match(/[^:]+$/)?.[0]
      : cond.typedKeyPath;

  return allAssetFolders.current.find((folder) => {
    if (!('typedKeyPath' in cond ? folder.typedKeyPath === typedKeyPath : !folder.typedKeyPath)) {
      return false;
    }

    // If the condition has a `componentName`, it is a field-level media folder for a custom editor
    // component. In that case, the `collectionName` and `fileName` are not relevant for the match.
    // The folder is registered with the component name, while the fields within the component get
    // the prefixed component ID, e.g. `x-youtube`, so resolve it first. Callers pass the key even
    // when there is no component, so check the value rather than the key
    if (cond.componentName) {
      return (
        folder.componentName === (getCustomComponentName(cond.componentName) ?? cond.componentName)
      );
    }

    // A field-level folder stores `isIndexFile: false`, while callers may pass `undefined`
    return (
      folder.collectionName === cond.collectionName &&
      folder.fileName === cond.fileName &&
      !!folder.isIndexFile === !!cond.isIndexFile
    );
  });
};

/**
 * Build a regular expression matching the paths below an entry-relative folder, which are the
 * collection’s own files and the assets stored alongside them. With the `multiple_root_folders`
 * i18n structure the collection folder sits below a folder named after the locale, so a locale name
 * is allowed in front of it — optionally, because `omit_default_locale_from_file_path` leaves the
 * default locale’s files where they would be without i18n. A collection `folder` with the
 * `{{locale}}` placeholder says where the locale name goes instead.
 * @param {AssetFolderInfo} folder Asset folder.
 * @returns {RegExp} Regular expression.
 */
const getEntryRelativePathRegEx = ({ internalPath, localeFolderNames }) => {
  const localeMatcher = localeFolderNames?.length
    ? `(?:(?:${localeFolderNames.map(escapeRegExp).join('|')})\\/)?`
    : '';

  const folderPath = /** @type {string} */ (internalPath);

  if (hasLocalePlaceholder(folderPath)) {
    return new RegExp(`^${getLocaleFolderPattern(folderPath, localeMatcher)}`);
  }

  return new RegExp(`^${localeMatcher}${escapeRegExp(folderPath)}\\/`);
};

/**
 * Index of `allAssetFolders` for {@link getAssetFoldersByPath} to avoid recreating regexes on every
 * call, rebuilt when the store is replaced.
 * `items`: non-entry-relative folders with both regex variants pre-compiled.
 * `entryRelative`: folders whose paths are relative to their parent entry.
 * @type {() => {
 * items: Array<{ folder: AssetFolderInfo, regexSub: RegExp, regexExact: RegExp }>,
 * entryRelative: Array<{ folder: AssetFolderInfo, regex: RegExp }>,
 * }}
 */
const getAssetFolderPathCache = memoizeOnSource(
  () => allAssetFolders.current,
  (_allAssetFolders) => {
    /** @type {Array<{ folder: AssetFolderInfo, regexSub: RegExp, regexExact: RegExp }>} */
    const items = [];
    /** @type {Array<{ folder: AssetFolderInfo, regex: RegExp }>} */
    const entryRelative = [];

    _allAssetFolders.forEach((folder) => {
      const { internalPath, entryRelative: isRelative } = folder;

      if (internalPath === undefined) {
        return;
      }

      if (isRelative) {
        entryRelative.push({ folder, regex: getEntryRelativePathRegEx(folder) });
      } else {
        // Pre-compile both regex variants so we don’t recreate them on every path lookup.
        // The internal path can contain template tags like `{{slug}}`, which we normalize to `.+?`.
        const normalizedPath = escapeRegExp(internalPath).replace(ESCAPED_PLACEHOLDER_REGEX, '.+?');

        items.push({
          folder,
          // Match the end of the folder segment for sub-folder matching.
          regexSub: new RegExp(`^${normalizedPath}${internalPath ? '(?=\\/|$)' : '$'}`),
          regexExact: new RegExp(`^${normalizedPath}$`),
        });
      }
    });

    return { items, entryRelative };
  },
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
  const { filename, dirname } = getPathInfo(path);

  // Exclude files with a leading `+` sign, which are Svelte page/layout files
  if (filename.startsWith('+')) {
    return [];
  }

  const { items, entryRelative } = getAssetFolderPathCache();
  const dir = dirname ?? '';

  const results = [
    ...entryRelative.filter(({ regex }) => regex.test(path)).map(({ folder }) => folder),
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
 * saved at entry-relative paths, the asset folder contains template tags, or the folder is
 * read-only.
 * @param {AssetFolderInfo | undefined} assetFolder Asset folder.
 * @returns {boolean} Result.
 */
export const canCreateAsset = (assetFolder) =>
  !!assetFolder &&
  !assetFolder.entryRelative &&
  !assetFolder.hasTemplateTags &&
  !assetFolder.readonly;

/**
 * Whether the media library can’t be changed. Uploading, replacing, renaming, moving and deleting
 * assets, and creating folders, commit straight to the configured branch rather than going through
 * review, which neither an Open Authoring contributor nor a user who can’t push to the branch can
 * do. An asset attached to an entry is committed with that entry, so it’s unaffected.
 */
export const assetsLocked = createDerivedState(
  () => openAuthoring.current || !!lockedBranch.current,
);

/**
 * Check if any of the given assets is stored in a read-only folder, in which case none of them can
 * be changed, renamed, replaced or deleted along with the others. A file in a folder the CMS itself
 * is served from, such as `admin`, is read-only as well, wherever the media folder is.
 * @param {Asset[]} assets Assets.
 * @returns {boolean} Result.
 */
export const hasReadonlyAsset = (assets) =>
  assets.some(({ folder, path }) => !!folder?.readonly || isInCmsFolder(path));
