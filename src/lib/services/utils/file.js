import { getPathInfo } from '@sveltia/utils/file';
import { compare, escapeRegExp } from '@sveltia/utils/string';
import sanitize from 'sanitize-filename';
import { get } from 'svelte/store';
import { _, locale as appLocale } from 'svelte-i18n';
import { slugify } from '$lib/services/common/slug';

/**
 * Create a regular expression that matches the given path.
 * @param {string} path Path.
 * @param {(segment: string) => string} replacer Function to replace each path segment.
 * @returns {RegExp} Regular expression.
 */
export const createPathRegEx = (path, replacer) =>
  new RegExp(`^${path.split('/').map(replacer).join('\\/')}\\b`);

/**
 * Encode the given (partial) file path or file name. Since {@link encodeURIComponent} encodes
 * slashes, we need to split and join. Also, encode some more characters, including `!`, `(` and
 * `)`, which affect the Markdown syntax like images and links. The `@` prefix is an exception; it
 * shouldn’t be encoded.
 * @param {string} path Original path.
 * @returns {string} Encoded path.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent#encoding_for_rfc3986
 */
export const encodeFilePath = (path) => {
  const hasAtPrefix = path.startsWith('@');

  if (hasAtPrefix) {
    path = path.slice(1);
  }

  path = path
    .split('/')
    .map((str) =>
      encodeURIComponent(str).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/');

  if (hasAtPrefix) {
    return `@${path}`;
  }

  return path;
};

/**
 * Encode the given (partial) file path or file name. We can use {@link decodeURIComponent} as is.
 * @param {string} path Original path.
 * @returns {string} Decoded path.
 */
export const decodeFilePath = (path) => decodeURIComponent(path);

/**
 * Format the given file size in bytes, KB, MB, GB or TB.
 * @param {number} size File size.
 * @returns {string} Formatted size.
 */
export const formatSize = (size) => {
  const formatter = new Intl.NumberFormat(/** @type {string} */ (get(appLocale)), {
    maximumFractionDigits: 1,
  });

  const kb = 1000;
  const mb = kb * 1000;
  const gb = mb * 1000;
  const tb = gb * 1000;

  if (size < kb) {
    return get(_)('file_size_units.b', { values: { size: formatter.format(size) } });
  }

  if (size < mb) {
    return get(_)('file_size_units.kb', { values: { size: formatter.format(size / kb) } });
  }

  if (size < gb) {
    return get(_)('file_size_units.mb', { values: { size: formatter.format(size / mb) } });
  }

  if (size < tb) {
    return get(_)('file_size_units.gb', { values: { size: formatter.format(size / gb) } });
  }

  return get(_)('file_size_units.tb', { values: { size: formatter.format(size / tb) } });
};

/**
 * Check if the given file name or slug has duplicate(s) or its variant in the other names. If
 * found, rename it by prepending a number like `summer-beach-2.jpg`.
 * @param {string} name Original name.
 * @param {string[]} otherNames Other names (of files in the same folder).
 * @returns {string} Determined name.
 */
export const renameIfNeeded = (name, otherNames) => {
  if (!otherNames.length) {
    return name;
  }

  const { filename: slug, extension } = getPathInfo(name);

  const regex = new RegExp(
    `^${escapeRegExp(slug)}(?:-(?<num>\\d+?))?${extension ? `\\.${extension}` : ''}$`,
  );

  const dupName = otherNames
    .sort((a, b) => compare(a.split('.')[0], b.split('.')[0]))
    .findLast((p) => regex.test(p));

  if (!dupName) {
    return name;
  }

  const number = Number(dupName.match(regex)?.groups?.num ?? 0) + 1;

  return `${slug}-${number}${extension ? `.${extension}` : ''}`;
};

/**
 * Format the file name for uploading, ensuring it is sanitized and optionally slugified.
 * @param {string} originalName The original file name.
 * @param {object} [options] Options.
 * @param {boolean} [options.slugificationEnabled] Whether to slugify the file name.
 * @param {string[]} [options.assetNamesInSameFolder] List of asset names in the same folder to
 * avoid name conflicts.
 * @returns {string} The formatted file name, sanitized and possibly slugified.
 */
export const formatFileName = (
  originalName,
  { slugificationEnabled = false, assetNamesInSameFolder = [] } = {},
) => {
  let fileName = sanitize(originalName.normalize());

  if (slugificationEnabled) {
    const { filename, extension } = getPathInfo(fileName);

    fileName = `${slugify(filename)}${extension ? `.${extension}` : ''}`;
  }

  return renameIfNeeded(fileName, assetNamesInSameFolder);
};

/**
 * Join the given path segments while ignoring any falsy value.
 * @param {(string | null | undefined)[]} segments List of path segments.
 * @returns {string} Path.
 */
export const createPath = (segments) => segments.filter(Boolean).join('/');

/**
 * Resolve the given file path. This processes only dot(s) in the middle of the path; leading dots
 * like `../../foo/image.jpg` will be untouched.
 * @param {string} path Unresolved path, e.g. `foo/bar/baz/../../image.jpg`.
 * @returns {string} Resolved path, e.g. `foo/image.jpg`.
 */
export const resolvePath = (path) => {
  /** @type {(string | null)[]} */
  const segments = path.split('/');
  let nameFound = false;

  segments.forEach((segment, index) => {
    if (segment === '.' || segment === '..') {
      if (nameFound) {
        segments[index] = null;

        if (segment === '..') {
          const lastIndex = segments.findLastIndex((s, i) => !!s && i < index);

          if (lastIndex > -1) {
            segments[lastIndex] = null;
          }
        }
      }
    } else {
      nameFound = true;
    }
  });

  return createPath(segments);
};
