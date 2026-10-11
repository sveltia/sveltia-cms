import { stripSlashes } from '@sveltia/utils/string';

import {
  hasLocalePlaceholder,
  stripLocaleFolderPath,
} from '$lib/services/contents/i18n/placeholder';
import { getDirName, stripPathPrefix } from '$lib/services/utils/file';

/**
 * @import { Entry, FileConfig, UnpublishedEntry } from '$lib/types/private';
 */

/**
 * List the distinct paths of the files an entry is made of. A single-file i18n entry lists the same
 * path under every locale.
 * @param {Entry | UnpublishedEntry} entry Entry.
 * @param {object} [options] Options.
 * @param {boolean} [options.includePrevious] Whether to also include the paths an unpublished entry
 * occupied before its pull request renamed it, which is where the published version still lives.
 * @returns {string[]} Paths.
 */
export const getEntryPaths = (entry, { includePrevious = false } = {}) => [
  ...new Set([
    ...Object.values(entry.locales).map(({ path }) => path),
    ...((includePrevious && /** @type {UnpublishedEntry} */ (entry).workflow?.previousPaths) || []),
  ]),
];

/**
 * Get the folder an entry’s file is stored in. For a multi-file i18n entry, the first locale’s file
 * is used.
 * @param {Entry | UnpublishedEntry} entry Entry.
 * @returns {string} Folder path, or an empty string if the entry is at the repository root.
 */
export const getEntryFolderPath = (entry) => getDirName(Object.values(entry.locales)[0].path);

/**
 * Get the folder an entry file is stored in, relative to the collection folder, which is what the
 * `{{dirname}}` template tag stands for. The locale folder added by the `multiple_folders` and
 * `multiple_root_folders` i18n structures, or by the `{{locale}}` placeholder in the `folder`
 * option, isn’t part of it, so the value is the same for every locale of an entry. The collection’s
 * entry path matcher knows where the locale folder goes, and whether the default locale is omitted
 * from the path, so the folder is taken from the sub path it captures. A path the matcher doesn’t
 * cover, like a file collection’s, falls back to removing the base path from the start.
 * @param {string} entryPath Entry file path, e.g. `content/posts/en/2024/hello.md`.
 * @param {Pick<FileConfig, 'basePath' | 'fullPathRegEx'>} [fileConfig] Entry collection’s file
 * configuration: the normalized `folder` option and the entry path matcher.
 * @returns {string} Folder path, e.g. `2024`, or an empty string if the entry is right under the
 * collection folder.
 */
export const getEntryDirName = (entryPath, { basePath, fullPathRegEx } = {}) => {
  const subPath = fullPathRegEx ? entryPath.match(fullPathRegEx)?.groups?.subPath : undefined;

  if (subPath !== undefined) {
    return getDirName(subPath);
  }

  const _basePath = stripSlashes(basePath ?? '');

  // The placeholder stands for any locale folder, or none if the default locale is omitted
  return getDirName(
    hasLocalePlaceholder(_basePath)
      ? stripLocaleFolderPath(entryPath, _basePath)
      : stripPathPrefix(entryPath, _basePath),
  );
};
