import { escapeRegExp } from '@sveltia/utils/string';

/**
 * @import { InternalLocaleCode } from '$lib/types/private';
 */

/**
 * Placeholder for a locale code in the `folder` option of an entry collection or the `file` option
 * of a file/singleton collection. Where it sits in the path is where each locale’s folder or file
 * name goes, which the fixed i18n structures can’t always express: Hugo’s translation by content
 * directory, for example, keeps the locale folders below `content` but above the sections, as in
 * `content/{{locale}}/posts`.
 * @see https://sveltiacms.app/en/docs/i18n/structures
 * @see https://github.com/sveltia/sveltia-cms/issues/780
 */
export const LOCALE_PLACEHOLDER = '{{locale}}';

/**
 * Regular expression matching the `{{locale}}` placeholder as a whole path segment of a folder
 * path. A placeholder that shares a segment with other characters, like `content-{{locale}}`, isn’t
 * supported, because a locale folder is what the placeholder stands for.
 */
const LOCALE_FOLDER_REGEX = /(?:^|\/){{locale}}(?:\/|$)/;

/**
 * Check whether the given path includes the `{{locale}}` placeholder.
 * @param {string} path Path.
 * @returns {boolean} Result.
 */
export const hasLocalePlaceholder = (path) => path.includes(LOCALE_PLACEHOLDER);

/**
 * Check whether the `{{locale}}` placeholder in the given folder path is usable: it must appear
 * exactly once, as a whole path segment. A second occurrence would make the entry path matcher
 * declare a second `locale` capture group, which is a syntax error, and a partial segment has no
 * locale folder to stand for.
 * @param {string} folderPath Folder path with the placeholder.
 * @returns {boolean} Result.
 */
export const isValidLocaleFolderPath = (folderPath) =>
  folderPath.split(LOCALE_PLACEHOLDER).length === 2 && LOCALE_FOLDER_REGEX.test(folderPath);

/**
 * Fill the `{{locale}}` placeholder in the given path.
 * @param {object} args Arguments.
 * @param {string} args.path Path with the placeholder.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {boolean} [args.omitLocale] Whether to leave the locale out of the path altogether, as
 * the `omit_default_locale_from_file_path` i18n option does for the default locale.
 * @returns {string} Path with the locale.
 */
export const fillLocalePlaceholder = ({ path, locale, omitLocale = false }) => {
  if (omitLocale) {
    // Drop the placeholder along with the separator that follows it, or, for a placeholder at the
    // end of a folder path, the separator before it, so no double or trailing slash is left behind
    // @see https://github.com/sveltia/sveltia-cms/discussions/394
    path = path.replace(/{{locale}}[./]|\/?{{locale}}$/, '');
  }

  // The placeholder may appear multiple times in a file path
  // @see https://github.com/sveltia/sveltia-cms/issues/462
  return path.replaceAll(LOCALE_PLACEHOLDER, locale);
};

/**
 * Build a regular expression pattern matching the given folder path, where the `{{locale}}`
 * placeholder is replaced with the given matcher. The pattern ends with a slash, so the file path
 * below the folder can follow.
 * @param {string} folderPath Folder path with the placeholder, e.g. `content/{{locale}}/posts`.
 * @param {string} localeFolderMatcher Pattern matching a locale folder name and the slash after it,
 * e.g. `(?<locale>en|fr)\/`. It can make the folder optional if the default locale is omitted from
 * the file path.
 * @returns {string} Pattern, e.g. `content/(?<locale>en|fr)\/posts/`.
 */
export const getLocaleFolderPattern = (folderPath, localeFolderMatcher) =>
  `${folderPath}/`.split(`${LOCALE_PLACEHOLDER}/`).map(escapeRegExp).join(localeFolderMatcher);

/**
 * Strip the given folder path, and the slash after it, from the start of the given file path. The
 * `{{locale}}` placeholder in the folder path stands for any single folder, or none, because the
 * default locale may be omitted from the file path.
 * @param {string} filePath File path, e.g. `content/en/posts/2026/hello.md`.
 * @param {string} folderPath Folder path with the placeholder, e.g. `content/{{locale}}/posts`.
 * @returns {string} Path below the folder, e.g. `2026/hello.md`, or the file path as is if it’s not
 * below the folder.
 */
export const stripLocaleFolderPath = (filePath, folderPath) =>
  filePath.replace(new RegExp(`^${getLocaleFolderPattern(folderPath, '(?:[^/]+\\/)?')}`), '');
