import { locale as appLocale } from 'svelte-i18n';
import { get } from 'svelte/store';
import { escapeRegExp } from '$lib/services/utils/strings';

/**
 * Scan local files in nested folders and return them in a flat array, sorted by name.
 * @param {DataTransfer} dataTransfer - From `drop` event.
 * @param {object} [options] - Options.
 * @param {string} [options.accept] - Accepted file types, which is the same as the `accept`
 * property for HTML `<input type="file">`.
 * @returns {Promise<File[]>} Files.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/webkitGetAsEntry
 */
export const scanFiles = async ({ items }, { accept } = {}) => {
  const fileTypes = accept ? accept.trim().split(/,\s*/g) : [];

  /**
   * Read files recursively from the filesystem.
   * @param {FileSystemEntry} entry - Either a file or
   * directory entry.
   * @returns {Promise<File | File[] | null>} File.
   */
  const readEntry = (entry) =>
    new Promise((resolve) => {
      // Skip hidden files
      if (entry.name.startsWith('.')) {
        resolve(null);
      } else if (entry.isFile) {
        /** @type {FileSystemFileEntry} */ (entry).file(
          (file) => {
            const isValidType =
              !fileTypes.length ||
              fileTypes.some((mimeType) => {
                const [type, subtype] = mimeType.split('/');

                return subtype === '*' ? file.type.split('/')[0] === type : file.type === mimeType;
              });

            resolve(isValidType ? file : null);
          },
          // Skip inaccessible files
          () => {
            resolve(null);
          },
        );
      } else {
        /** @type {FileSystemDirectoryEntry} */ (entry).createReader().readEntries((entries) => {
          resolve(/** @type {Promise<File[]>} */ (Promise.all(entries.map(readEntry))));
        });
      }
    });

  return /** @type {File[]} */ (
    (
      await Promise.all(
        [...items].map((item) => {
          const entry = item.webkitGetAsEntry();

          return entry ? readEntry(entry) : null;
        }),
      )
    )
      .flat(100000)
      .filter(Boolean)
  ).sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Read the file as plaintext.
 * @param {File} file - File.
 * @returns {Promise<string>} Content.
 */
export const readAsText = async (file) => {
  const reader = new FileReader();

  return new Promise((resolve) => {
    /**
     * Return the result once the content is read. On Windows, the result may include CRLF line
     * breaks. Convert any CRLF to LF to parse entries properly.
     */
    reader.onload = () => {
      resolve(/** @type {string} */ (reader.result).replace(/\r\n/g, '\n'));
    };

    reader.readAsText(file);
  });
};

/**
 * Get the Base64 encoding of the given input.
 * @param {File | Blob | string} input - Input file or string.
 * @returns {Promise<string>} Data URL like `data:text/plain;base64,...`.
 */
export const getDataURL = async (input) => {
  const blob = typeof input === 'string' ? new Blob([input], { type: 'text/plain' }) : input;
  const reader = new FileReader();

  return new Promise((resolve) => {
    /**
     * Return the result once the content is read.
     */
    reader.onload = () => {
      resolve(/** @type {string} */ (reader.result));
    };

    reader.readAsDataURL(blob);
  });
};

/**
 * Get the data URL of the given input.
 * @param {File | Blob | string} input - Input file or string.
 * @returns {Promise<string>} Base64.
 */
export const getBase64 = async (input) => (await getDataURL(input)).split(',')[1];

/**
 * Format the given file size in bytes, KB, MB, GB or TB.
 * @param {number} size - File size.
 * @returns {string} Formatted size.
 */
export const formatSize = (size) => {
  const formatter = new Intl.NumberFormat(/** @type {string} */ (get(appLocale)));
  const kb = 1000;
  const mb = kb * 1000;
  const gb = mb * 1000;
  const tb = gb * 1000;

  if (size < kb) {
    return `${formatter.format(size)} bytes`;
  }

  if (size < mb) {
    return `${formatter.format(Number((size / kb).toFixed(1)))} KB`;
  }

  if (size < gb) {
    return `${formatter.format(Number((size / mb).toFixed(1)))} MB`;
  }

  if (size < tb) {
    return `${formatter.format(Number((size / gb).toFixed(1)))} GB`;
  }

  return `${formatter.format(Number((size / tb).toFixed(1)))} TB`;
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

  const [, slug, extension] = name.match(/(.+?)(?:\.([a-zA-Z0-9]+?))?$/) ?? [];

  const regex = new RegExp(
    `^${escapeRegExp(slug)}(?:-(\\d+?))?${extension ? `\\.${extension}` : ''}$`,
  );

  const dupName = otherNames
    .sort((a, b) => a.split('.')[0].localeCompare(b.split('.')[0]))
    .findLast((p) => p.match(regex));

  if (!dupName) {
    return name;
  }

  const number = Number((dupName.match(regex) ?? [])[1] ?? 0) + 1;

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

/**
 * Convert the given image file to PNG format.
 * @param {File | Blob} file - File to be converted, typically a JPEG file.
 * @returns {Promise<Blob>} PNG file.
 * @throws {Error} If the file is not an image.
 * @see https://stackoverflow.com/q/62909538
 */
export const convertToPNG = async (file) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Unsupported type');
  }

  const image = new Image();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const url = URL.createObjectURL(file);

  return new Promise((resolve) => {
    image.addEventListener('load', () => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context?.drawImage(image, 0, 0);

      canvas.toBlob((blob) => {
        resolve(/** @type {Blob} */ (blob));
      }, 'image/png');

      URL.revokeObjectURL(url);
    });

    image.src = /** @type {string} */ (url);
  });
};

/**
 * Save the given file locally.
 * @param {File | Blob} file - File to be saved.
 * @param {string} [name] - File name. Required if the `file` param is a `Blob`.
 */
export const saveFile = (file, name) => {
  const link = document.createElement('a');
  const url = URL.createObjectURL(file);

  link.download =
    name ?? /** @type {File} */ (file).name ?? `${Date.now()}.${file.type.split('/')[1]}`;
  link.href = url;
  link.click();

  URL.revokeObjectURL(url);
};
