import { getPathInfo } from '@sveltia/utils/file';
import { compare, escapeRegExp } from '@sveltia/utils/string';
import { _, locale as appLocale } from 'svelte-i18n';
import { get } from 'svelte/store';

/**
 * Check if the user’s browsing environment supports drag & drop operation. Assume drag & drop is
 * supported if the pointer is mouse (on desktop).
 * @returns {boolean} Result.
 */
export const canDragDrop = () =>
  (globalThis.matchMedia('(pointer: fine)')?.matches ?? false) && 'ondrop' in globalThis;

/**
 * Format the given file size in bytes, KB, MB, GB or TB.
 * @param {number} size - File size.
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
 * @param {string} name - Original name.
 * @param {string[]} otherNames - Other names (of files in the same folder).
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
 * Join the given path segments while ignoring any falsy value.
 * @param {(string | null | undefined)[]} segments - List of path segments.
 * @returns {string} Path.
 */
export const createPath = (segments) => segments.filter(Boolean).join('/');

/**
 * Resolve the given file path. This processes only dot(s) in the middle of the path; leading dots
 * like `../../foo/image.jpg` will be untouched.
 * @param {string} path - Unresolved path, e.g. `foo/bar/baz/../../image.jpg`.
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
