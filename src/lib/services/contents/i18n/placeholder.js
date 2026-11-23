import { escapeRegExp } from '@sveltia/utils/string';

import { getOrCreate } from '$lib/services/utils/cache';

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
 * Remove the first `{{locale}}` placeholder from the given path, as the
 * `omit_default_locale_from_file_path` and `omit_default_locale_from_preview_path` i18n options do
 * for the default locale. That’s only possible where the placeholder can go without breaking the
 * rest of the path. As a whole path segment, it’s dropped along with the slash after it, or the
 * slash before it at the end of the path: `content/{{locale}}/about.md` → `content/about.md`,
 * `content/{{locale}}` → `content`, `/{{locale}}` → `/`. As a dot-separated part of a segment after
 * the first one, it’s dropped along with the dot before it: `about.{{locale}}.md` → `about.md`,
 * `about.{{locale}}` → `about`. As the first dot-separated part of a segment, it’s dropped along
 * with the dot after it, as long as a name is left in front of an extension, or another template
 * placeholder follows: `{{locale}}.about.md` → `about.md`, `/posts/{{locale}}.{{slug}}` →
 * `/posts/{{slug}}`. Anywhere else, the rest of the path would turn into something else:
 * `i18n/{{locale}}.yaml` would become `i18n/yaml`, and `settings_{{locale}}.json` would become
 * `settings_json`. Any other occurrence of the placeholder is left as is.
 * @param {string} path Path with the placeholder.
 * @returns {string | undefined} Path without the placeholder, or `undefined` if the path has no
 * placeholder or the first one can’t be removed.
 */
export const omitLocalePlaceholder = (path) => {
  const index = path.indexOf(LOCALE_PLACEHOLDER);

  if (index === -1) {
    return undefined;
  }

  const before = path.slice(0, index);
  const after = path.slice(index + LOCALE_PLACEHOLDER.length);

  if (before === '' || before.endsWith('/')) {
    // A whole path segment
    if (after.startsWith('/')) {
      return `${before}${after.slice(1)}`;
    }

    if (after === '') {
      // A host name, like in the `https://{{locale}}` preview path, can’t be removed
      if (before.endsWith('//')) {
        return undefined;
      }

      // Keep a root slash, so a preview path like `/{{locale}}` points at the root
      return before.length > 1 ? before.slice(0, -1) : before;
    }

    // The first part of a segment, followed by a name and an extension, or by another template
    // placeholder standing for a name, like `{{slug}}` in a preview path
    if (/^\.(?:[^./][^/]*\.|{{)/.test(after)) {
      return `${before}${after.slice(1)}`;
    }

    return undefined;
  }

  // A later part of a segment, like a locale suffix in a file name
  if (/[^/]\.$/.test(before) && /^(?:[./]|$)/.test(after)) {
    return `${before.slice(0, -1)}${after}`;
  }

  return undefined;
};

/**
 * Check whether the first `{{locale}}` placeholder in the given path can be removed for the
 * default locale. See {@link omitLocalePlaceholder} for the supported positions.
 * @param {string} path Path with the placeholder.
 * @returns {boolean} Result.
 */
export const canOmitLocalePlaceholder = (path) => omitLocalePlaceholder(path) !== undefined;

/**
 * Fill the `{{locale}}` placeholder in the given path.
 * @param {object} args Arguments.
 * @param {string} args.path Path with the placeholder.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {boolean} [args.omitLocale] Whether to leave the locale out of the path altogether, as
 * the `omit_default_locale_from_file_path` i18n option does for the default locale. The locale is
 * filled in anyway if the placeholder isn’t in a position where it can be removed, which the config
 * parser warns about.
 * @returns {string} Path with the locale.
 */
export const fillLocalePlaceholder = ({ path, locale, omitLocale = false }) => {
  if (omitLocale) {
    // @see https://github.com/sveltia/sveltia-cms/discussions/394
    path = omitLocalePlaceholder(path) ?? path;
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
 * Cache of the regular expressions used by {@link stripLocaleFolderPath}, keyed by folder path. A
 * folder path comes from the configuration, so the cache stays small.
 * @type {Map<string, RegExp>}
 */
const localeFolderPrefixRegExpCache = new Map();

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
  filePath.replace(
    getOrCreate(
      localeFolderPrefixRegExpCache,
      folderPath,
      () => new RegExp(`^${getLocaleFolderPattern(folderPath, '(?:[^/]+\\/)?')}`),
    ),
    '',
  );
