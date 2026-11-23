import { getHash } from '@sveltia/utils/crypto';
import { getPathInfo } from '@sveltia/utils/file';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';
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
 * Fold a file or folder name for a comparison that ignores case and the Unicode normalization form,
 * the way a case-insensitive file system like macOS’s or Windows’s does: `Photo.jpg` and
 * `photo.jpg` clash there, and so do names spelled in NFC and NFD, e.g. a name typed in the browser
 * and the same name read from a macOS disk.
 * @param {string} name File or folder name.
 * @returns {string} Folded name.
 */
export const foldFileName = (name) => name.normalize().toLowerCase();

/**
 * Fold a file or folder path like {@link foldFileName} does a name, after stripping the leading and
 * trailing slashes, to tell whether two paths can refer to the same file.
 * @param {string} path File or folder path.
 * @returns {string} Folded path.
 */
export const foldPath = (path) => foldFileName(stripSlashes(path));

/**
 * Remove a leading `./` from the given folder path, or turn `.` into an empty string, as both
 * mean the folder the path is relative to: `./images` becomes `images`, while `../images` and
 * `.images` are left alone.
 * @param {string} path Folder path.
 * @returns {string} Path without a leading `./`.
 */
export const stripLeadingDotSlash = (path) => path.replace(/^\.(?:\/|$)/, '');

/**
 * Normalize the given folder option by removing the leading and trailing slashes, then a leading
 * `./`, so an empty string, `/`, `.` and `./` all become an empty string, meaning the root folder,
 * and `./static/images/` becomes `static/images`.
 * @param {string} path Folder path.
 * @returns {string} Normalized path.
 */
export const normalizeFolderPath = (path) => stripLeadingDotSlash(stripSlashes(path));

/**
 * Check if the given file name or slug is already taken in the other names. If so, rename it by
 * appending a number higher than any variant already used, like `summer-beach-2.jpg`. A name that
 * is free is returned as is, even if numbered variants of it exist.
 * @param {string} name Original name.
 * @param {string[]} otherNames Other names (of files in the same folder).
 * @param {object} [options] Options.
 * @param {boolean} [options.hasExtension] Whether the name ends with a file extension, which the
 * number goes before. Pass `false` for a slug, whose dot is part of the name, so `release-2.0` is
 * renamed `release-2.0-1` rather than `release-2-1.0`.
 * @param {Set<string>} [options.foldedNames] `otherNames` folded with {@link foldFileName}, for a
 * caller naming many files against the same list, which would otherwise be folded for each file.
 * @returns {string} Determined name.
 */
export const renameIfNeeded = (name, otherNames, { hasExtension = true, foldedNames } = {}) => {
  const foldedName = foldFileName(name);

  // Case-insensitive and Unicode-normalized, since `Photo.jpg` and `photo.jpg` clash on a
  // case-insensitive file system like macOS’s or Windows’s, and a name read from disk may be
  // spelled in another normalization form than one typed in the browser
  const taken = foldedNames
    ? foldedNames.has(foldedName)
    : otherNames.some((otherName) => foldFileName(otherName) === foldedName);

  if (!taken) {
    return name;
  }

  const { filename: slug, extension } = hasExtension
    ? getPathInfo(name)
    : { filename: name, extension: undefined };

  const suffix = extension ? `\\.${extension.normalize()}` : '';
  const regex = new RegExp(`^${escapeRegExp(slug.normalize())}-(?<num>\\d+)${suffix}$`, 'i');
  let highest = 0;

  // Only the highest number already taken matters, so the names are scanned once rather than
  // sorted. The caller’s array is left alone: it’s typically every name in the folder, reused for
  // each of the files being added. The numbered variants are matched in either normalization form
  // as well
  otherNames.forEach((otherName) => {
    const match = otherName.normalize().match(regex);

    if (match) {
      highest = Math.max(highest, Number(/** @type {Record<string, string>} */ (match.groups).num));
    }
  });

  return `${slug}-${highest + 1}${extension ? `.${extension}` : ''}`;
};

/**
 * Regular expression matching the start of a file or folder name that Windows reserves for a
 * device, like `con` or `aux.png`: the reserved word followed by nothing or a dot, as Windows only
 * looks at the part before the first dot. The list is the one `sanitize-filename` uses, including
 * the superscript digits.
 */
const WINDOWS_RESERVED_NAME_REGEX =
  /^(?:con|prn|aux|nul|com[0-9\u00B9\u00B2\u00B3]|lpt[0-9\u00B9\u00B2\u00B3])(?=\.|$)/i;

/**
 * Rename a file or folder name that Windows reserves for a device, like `aux.png`, by numbering it
 * the way a duplicate name is numbered, as `aux-1.png`, so it can be checked out on Windows while
 * keeping its extension. Any other name is returned as is.
 * @param {string} name Name.
 * @returns {string} Name that isn’t reserved.
 */
export const renameReservedFileName = (name) => name.replace(WINDOWS_RESERVED_NAME_REGEX, '$&-1');

/**
 * Sanitize a file or folder name: normalize it to NFC (composed characters), replace every kind of
 * whitespace — non-breaking spaces, tabs, newlines and so on — with a regular space, collapsing
 * consecutive ones, then drop the characters a file system won’t take. A name Windows reserves for
 * a device is renamed with {@link renameReservedFileName}.
 * @param {string} name Name.
 * @returns {string} Sanitized name. An empty string if nothing usable is left.
 */
export const sanitizeFileName = (name) => {
  const normalizedName = name.normalize().replace(/[\s\u00A0\u202F]+/g, ' ');

  // `sanitize-filename` reduces a reserved name to an empty string, extension included, so
  // `aux.png` would leave nothing to name the file with. When nothing is left, sanitize the name
  // again with a character in front, which keeps the package from seeing a reserved name: without
  // that character, what comes back is the reserved name, if it is one, with the unsafe characters
  // dropped, which can be what makes a name reserved, as in `aux?.png`. It’s then renamed, and
  // sanitized once more to stay within the length limit
  return (
    sanitize(normalizedName) ||
    sanitize(renameReservedFileName(sanitize(`_${normalizedName}`).slice(1)))
  );
};

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
 * Get the last segment of a path, e.g. the file name of a file path. Unlike `getPathInfo()`, which
 * ignores trailing slashes, this is an empty string for a path ending with a slash.
 * @param {string} path Path.
 * @returns {string} Last path segment, or the path itself if it has no slash.
 */
export const getBaseName = (path) => path.slice(path.lastIndexOf('/') + 1);

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
 * like `../../foo/image.jpg` will be untouched. A `..` that goes up past the named segments before
 * it is kept as well, so the path still points outside the starting folder: `a/../../b` resolves to
 * `../b`, and `../a/../../b` to `../../b`. Empty segments are dropped.
 * @param {string} path Unresolved path, e.g. `foo/bar/baz/../../image.jpg`.
 * @returns {string} Resolved path, e.g. `foo/image.jpg`.
 */
export const resolvePath = (path) => {
  /** @type {string[]} */
  const segments = [];
  let nameFound = false;

  path.split('/').forEach((segment) => {
    if (!segment) {
      return;
    }

    if (!nameFound || (segment !== '.' && segment !== '..')) {
      nameFound ||= segment !== '.' && segment !== '..';
      segments.push(segment);

      return;
    }

    if (segment === '..') {
      const last = segments.at(-1);

      // Only a named segment can be cancelled out; a leading dot stays, and the `..` with it
      if (last !== undefined && last !== '.' && last !== '..') {
        segments.pop();
      } else {
        segments.push(segment);
      }
    }
  });

  return segments.join('/');
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

/**
 * Read a blob into a new file of the given name, with its bytes read up front. A blob backed by the
 * file system, like an asset in a local repository, points at a file that may be moved or deleted
 * before the new file is read, e.g. to be written elsewhere or hashed, and can’t be read then.
 * @param {Blob} blob Blob.
 * @param {string} name File name.
 * @returns {Promise<File>} File.
 */
export const readBlobAsFile = async (blob, name) =>
  new File([await blob.arrayBuffer()], name, { type: blob.type });
