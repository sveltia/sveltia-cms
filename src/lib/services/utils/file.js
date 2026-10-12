import { getHash } from '@sveltia/utils/crypto';
import { getPathInfo } from '@sveltia/utils/file';
import { escapeRegExp } from '@sveltia/utils/string';
import sanitize from 'sanitize-filename';

import { getOrCreateAsync } from '$lib/services/utils/cache';
import { encodePathSegments, encodeRFC3986 } from '$lib/services/utils/url';

/**
 * Create a regular expression that matches the given path.
 * @param {string} path Path.
 * @param {(segment: string) => string} replacer Function to replace each path segment.
 * @returns {RegExp} Regular expression.
 */
export const createPathRegEx = (path, replacer) =>
  new RegExp(`^${path.split('/').map(replacer).join('\\/')}(?=\\/|$)`);

/**
 * Encode the given (partial) file path or file name segment by segment, keeping the slashes. Some
 * more characters than `encodeURIComponent()` does are encoded, including `!`, `(` and `)`, which
 * affect the Markdown syntax like images and links. The `@` prefix is an exception; it shouldn’t be
 * encoded.
 * @param {string} path Original path.
 * @returns {string} Encoded path.
 */
export const encodeFilePath = (path) => {
  const hasAtPrefix = path.startsWith('@');

  if (hasAtPrefix) {
    path = path.slice(1);
  }

  path = encodePathSegments(path, encodeRFC3986);

  if (hasAtPrefix) {
    return `@${path}`;
  }

  return path;
};

/**
 * Check if the given file name or slug is already taken in the other names. If so, rename it by
 * appending a number higher than any variant already used, like `summer-beach-2.jpg`. A name that
 * is free is returned as is, even if numbered variants of it exist.
 * @param {string} name Original name.
 * @param {string[]} otherNames Other names (of files in the same folder).
 * @returns {string} Determined name.
 */
export const renameIfNeeded = (name, otherNames) => {
  const lowerCaseName = name.toLowerCase();

  // Case-insensitive, since `Photo.jpg` and `photo.jpg` clash on a case-insensitive file system
  // like macOS’s or Windows’s
  if (!otherNames.some((otherName) => otherName.toLowerCase() === lowerCaseName)) {
    return name;
  }

  const { filename: slug, extension } = getPathInfo(name);
  const suffix = extension ? `\\.${extension}` : '';
  const regex = new RegExp(`^${escapeRegExp(slug)}-(?<num>\\d+)${suffix}$`, 'i');
  let highest = 0;

  // Only the highest number already taken matters, so the names are scanned once rather than
  // sorted. The caller’s array is left alone: it’s typically every name in the folder, reused for
  // each of the files being added
  otherNames.forEach((otherName) => {
    const match = otherName.match(regex);

    if (match) {
      highest = Math.max(highest, Number(/** @type {Record<string, string>} */ (match.groups).num));
    }
  });

  return `${slug}-${highest + 1}${extension ? `.${extension}` : ''}`;
};

/**
 * Sanitize a file or folder name: normalize it to NFC (composed characters), replace every kind of
 * whitespace — non-breaking spaces, tabs, newlines and so on — with a regular space, collapsing
 * consecutive ones, then drop the characters a file system won’t take.
 * @param {string} name Name.
 * @returns {string} Sanitized name.
 */
export const sanitizeFileName = (name) =>
  sanitize(name.normalize().replace(/[\s\u00A0\u202F]+/g, ' '));

/**
 * Groups of file extensions that refer to the same file format, meaning that replacing one with
 * another doesn’t change how the file is handled.
 * @type {string[][]}
 */
const EQUIVALENT_FILE_EXTENSIONS = [
  ['jpg', 'jpeg', 'jpe', 'jfif'],
  ['tif', 'tiff'],
  ['htm', 'html'],
  ['yml', 'yaml'],
  ['md', 'markdown'],
  ['mpg', 'mpeg'],
  ['mid', 'midi'],
  ['aif', 'aiff'],
];

/**
 * Check if the given two file extensions refer to the same file format. The comparison is
 * case-insensitive, so `PNG` and `png` are equivalent. Well-known aliases, such as `jpeg` and
 * `jpg`, are also considered equivalent.
 * @param {string} [a] File extension without a leading dot.
 * @param {string} [b] File extension without a leading dot.
 * @returns {boolean} Result. `true` if both extensions are omitted.
 */
export const isEquivalentFileExtension = (a, b) => {
  const _a = a?.toLowerCase() ?? '';
  const _b = b?.toLowerCase() ?? '';

  if (_a === _b) {
    return true;
  }

  return EQUIVALENT_FILE_EXTENSIONS.some((group) => group.includes(_a) && group.includes(_b));
};

/**
 * Join the given path segments while ignoring any falsy value.
 * @param {(string | null | undefined)[]} segments List of path segments.
 * @returns {string} Path.
 */
export const createPath = (segments) => segments.filter(Boolean).join('/');

/**
 * Get the directory part of a file path. Unlike `getPathInfo()`, which has no directory for a file
 * at the root, this is always a string, so a root file’s directory compares equal to the root path.
 * @param {string} path File path.
 * @returns {string} Directory path, which is an empty string for a file at the root.
 */
export const getDirName = (path) => getPathInfo(path).dirname ?? '';

/**
 * Remove the given directory from the start of a path, if the path sits below it.
 * @param {string} path Path, e.g. `images/photo.jpg`.
 * @param {string | undefined} dir Directory path, e.g. `images`. An empty string or `undefined`
 * leaves the path as is.
 * @returns {string} Path relative to the directory, e.g. `photo.jpg`, or the original path if it
 * doesn’t sit below the directory.
 */
export const stripPathPrefix = (path, dir) =>
  dir && path.startsWith(`${dir}/`) ? path.slice(dir.length + 1) : path;

/**
 * Sanitize a path by removing potentially dangerous path traversal segments (`.` and `..`). This
 * prevents path traversal attacks when paths are constructed from user input.
 * @param {string} path Path to sanitize, e.g. `../../../secret` or `images/../config`.
 * @returns {string} Sanitized path with `.` and `..` segments removed, e.g. `secret` or
 * `images/config`.
 */
export const sanitizePath = (path) =>
  path
    .split('/')
    .filter((segment) => segment !== '.' && segment !== '..')
    .join('/');

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

/**
 * Get the Blob object from the given file or blob input. If the input is a string, it is treated as
 * the file content and converted to a Blob with `text/plain` MIME type.
 * @param {File | Blob | string} input File or Blob object, or a string representing the file
 * content.
 * @returns {Blob} Blob object representing the file.
 */
export const getBlob = (input) =>
  typeof input === 'string' ? new Blob([input], { type: 'text/plain' }) : input;

/**
 * Get the size of the given file or blob in bytes. A string is measured as UTF-8, the encoding a
 * `Blob` created from it would use.
 * @param {File | Blob | string} input File or Blob object, or a string representing the file
 * content.
 * @returns {number} Size in bytes.
 */
export const getByteSize = (input) =>
  typeof input === 'string' ? new TextEncoder().encode(input).length : input.size;

/**
 * Compute the Git object ID (SHA-1 hash) of the given blob.
 * @param {Blob} blob File or Blob object.
 * @returns {Promise<string>} Git object ID (SHA-1 hash) of the blob.
 * @see https://stackoverflow.com/a/68806436
 * @see https://github.com/Richienb/git-hash-object/blob/master/index.js
 */
const computeGitHash = async (blob) => {
  const buffer = await blob.arrayBuffer();

  return getHash(new Blob([`blob ${buffer.byteLength}\0`, buffer]));
};

/**
 * Git object IDs of the blobs hashed so far. A `File` picked by the user is hashed for every
 * duplicate check, listing and save it takes part in, and each hash reads the whole file again, so
 * a batch of uploads would otherwise read every file once per file in the batch. That many reads
 * in flight at once make Chrome fail them with `NotReadableError`. A blob’s content never changes,
 * so the promise is kept for the blob’s lifetime, and concurrent callers share the one read.
 * @type {WeakMap<Blob, Promise<string>>}
 */
const gitHashCache = new WeakMap();

/**
 * Get the Git object ID (SHA-1 hash) of the given file or blob.
 * @param {File | Blob | string} input File or Blob object, or a string representing the file
 * content.
 * @returns {Promise<string>} Git object ID (SHA-1 hash) of the file.
 */
export const getGitHash = (input) => {
  if (typeof input === 'string') {
    return computeGitHash(getBlob(input));
  }

  // A failure isn’t remembered, leaving room for a retry, e.g. once the file is readable again
  return getOrCreateAsync(gitHashCache, input, () => computeGitHash(input));
};
