import { stripSlashes } from '@sveltia/utils/string';

import {
  hasLocalePlaceholder,
  stripLocaleFolderPath,
} from '$lib/services/contents/i18n/placeholder';
import { getDirName, stripPathPrefix } from '$lib/services/utils/file';

/**
 * @import {
 * Entry,
 * FileConfig,
 * InternalLocaleCode,
 * LocalizedEntry,
 * UnpublishedEntry,
 * } from '$lib/types/private';
 */

/**
 * Get the given locale’s file of an entry. Falls back to the default locale’s file if a default
 * locale is given, then to the first file, when no locale is given or the entry doesn’t have the
 * locale yet. A multi-file i18n entry can be missing its default locale file, e.g. when only
 * `hello.fr.md` exists, in which case another locale stands in for it.
 * @param {Entry | UnpublishedEntry} entry Entry.
 * @param {object} [options] Options.
 * @param {InternalLocaleCode} [options.locale] Locale.
 * @param {InternalLocaleCode} [options.defaultLocale] Default locale of the entry’s collection.
 * @returns {LocalizedEntry | undefined} Localized entry, including the file path and content, or
 * `undefined` if the entry has no files at all.
 */
export const getEntryLocaleFile = (entry, { locale, defaultLocale } = {}) =>
  (locale ? entry.locales[locale] : undefined) ??
  (defaultLocale ? entry.locales[defaultLocale] : undefined) ??
  Object.values(entry.locales)[0];

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
 * Get the folder an entry’s file is stored in. For a multi-file i18n entry, the given locale’s file
 * is used, as each locale has a folder of its own with the `multiple_folders` and
 * `multiple_root_folders` i18n structures. The first locale’s file is used if no locale is given,
 * or the entry doesn’t have the locale yet.
 * @param {Entry | UnpublishedEntry} entry Entry.
 * @param {InternalLocaleCode} [locale] Locale.
 * @returns {string} Folder path, or an empty string if the entry is at the repository root.
 */
export const getEntryFolderPath = (entry, locale) =>
  getDirName(/** @type {LocalizedEntry} */ (getEntryLocaleFile(entry, { locale })).path);

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
