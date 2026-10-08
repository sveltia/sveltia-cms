import { _ } from '@sveltia/i18n';

import { getRootDir } from '$lib/services/backends/root-dir';

/**
 * @import {
 * AssetFolderInfo,
 * ConfigParserCollectors,
 * EntryFolderInfo,
 * InternalCmsConfig,
 * } from '$lib/types/private';
 */

/**
 * Count how many levels the given path climbs above the folder it starts from with `..` segments.
 * @param {string} path Path, e.g. `content/../../shared`.
 * @returns {number} Number of levels, e.g. `1`, or `0` if it stays within the folder.
 */
const countLevelsUp = (path) => {
  let depth = 0;
  let lowest = 0;

  path.split('/').forEach((segment) => {
    if (segment === '..') {
      depth -= 1;
      lowest = Math.min(lowest, depth);
    } else if (segment && segment !== '.') {
      depth += 1;
    }
  });

  return -lowest;
};

/**
 * Get how many levels below its base folder the deepest entry of a collection can be, which an
 * entry-relative media folder can climb back up from.
 * @param {InternalCmsConfig} config CMS configuration.
 * @param {AssetFolderInfo} folder Asset folder.
 * @returns {number | undefined} Number of levels, or `undefined` if it can’t be told, as for a
 * nested collection, or for an editor component used anywhere.
 */
const getEntryDepth = (config, { collectionName, fileName }) => {
  // A file is where it’s configured to be
  if (fileName || collectionName === '_singletons') {
    return 0;
  }

  const collection = config.collections?.find(
    (c) => !('divider' in c) && 'name' in c && c.name === collectionName,
  );

  if (!collection || !('folder' in collection) || collection.nested) {
    return undefined;
  }

  // An entry path like `{{slug}}/index` puts the entry in a subfolder, and so does a folder for
  // each locale. Count it in whenever i18n may be on, so a valid folder is never refused
  const pathDepth = (collection.path ?? '').split('/').length - 1;
  const localeDepth = collection.i18n || config.i18n ? 1 : 0;

  return pathDepth + localeDepth;
};

/**
 * Check that no folder or file path in the configuration leads outside the directory set with the
 * `root_dir` backend option. The CMS only lists the files in the directory, so anything saved
 * outside it would seem to disappear.
 * @param {object} args Arguments.
 * @param {InternalCmsConfig} args.config CMS configuration.
 * @param {EntryFolderInfo[]} args.entryFolders All entry folders.
 * @param {AssetFolderInfo[]} args.assetFolders All asset folders.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const checkRootDirPaths = ({ config, entryFolders, assetFolders, collectors }) => {
  if (!getRootDir()) {
    return;
  }

  /** @type {Set<string>} */
  const paths = new Set();

  entryFolders.forEach(({ folderPath, folderPathMap, filePathMap }) => {
    [folderPath, ...Object.values(folderPathMap ?? {}), ...Object.values(filePathMap ?? {})]
      .filter((path) => path !== undefined && countLevelsUp(path) > 0)
      .forEach((path) => paths.add(/** @type {string} */ (path)));
  });

  assetFolders.forEach((folder) => {
    const { internalPath, internalSubPath, entryRelative } = folder;

    if (internalPath === undefined) {
      return;
    }

    if (!entryRelative) {
      if (countLevelsUp(internalPath) > 0) {
        paths.add(internalPath);
      }

      return;
    }

    const entryDepth = getEntryDepth(config, folder);
    const path = [internalPath, internalSubPath].filter(Boolean).join('/');

    if (entryDepth !== undefined && countLevelsUp(path) > entryDepth) {
      paths.add(path);
    }
  });

  paths.forEach((path) => {
    collectors.errors.add(_('config.error.path_outside_root_dir', { values: { path } }));
  });
};
