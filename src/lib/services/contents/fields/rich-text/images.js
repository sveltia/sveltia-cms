import { getDateTimeParts } from '@sveltia/utils/datetime';

import {
  RASTER_IMAGE_EXTENSION_REGEX,
  SUPPORTED_IMAGE_TYPES,
  VECTOR_IMAGE_EXTENSION_REGEX,
} from '$lib/services/utils/media/image';

/**
 * An image to be inserted into the rich text editor.
 * @typedef {object} ImageEntry
 * @property {File} [file] Image file to be uploaded. `undefined` for a remote image that is linked
 * rather than downloaded.
 * @property {string} [src] Image URL. Used when there is no file to upload.
 * @property {string} [alt] Alternative text.
 */

/**
 * Regular expression matching a base64-encoded image data URL, capturing its MIME type.
 */
const DATA_URL_REGEX = /^data:(?<type>image\/.+?);base64,.+/;
/**
 * The name browsers give to an image pasted from the clipboard, which says nothing about the image.
 */
const GENERIC_PASTED_FILE_NAME = 'image.png';

/**
 * Check whether the given file name has a known image extension.
 * @param {string} name File name.
 * @returns {boolean} Result.
 */
const hasImageExtension = (name) =>
  RASTER_IMAGE_EXTENSION_REGEX.test(name) || VECTOR_IMAGE_EXTENSION_REGEX.test(name);

/**
 * Get a file name made of the current date and time, for an image that has no meaningful name of
 * its own, e.g. `20260912-103000.png`.
 * @param {string} extension File extension without a dot.
 * @param {string} [suffix] Suffix to be added before the extension, e.g. `-2`.
 * @returns {string} File name.
 */
export const getTimestampFileName = (extension, suffix = '') => {
  const { year, month, day, hour, minute, second } = getDateTimeParts();

  return `${year}${month}${day}-${hour}${minute}${second}${suffix}.${extension}`;
};

/**
 * Parse the given HTML and find the first image in it.
 * @param {string} html HTML string.
 * @returns {HTMLImageElement | null} Image element, if any.
 */
const findImageInHTML = (html) =>
  new DOMParser().parseFromString(html, 'text/html').querySelector('img');

/**
 * Get the images pasted into the rich text editor. A remote image copied within the browser comes
 * with both the file and HTML holding an `<img>`, so the file name and alternative text are scraped
 * from the HTML; the event is stopped in that case, so the editor doesn’t paste the HTML as well.
 * Images pasted as local files are used as they are. Either way, a file that has the generic name
 * browsers give to pasted images is renamed after the current date and time.
 * @param {ClipboardEvent} event `paste` event.
 * @returns {Promise<ImageEntry[]>} Images. Empty if nothing pasted is an image.
 */
export const getPastedImages = async (event) => {
  const { clipboardData } = event;
  const pastedItems = clipboardData?.items;

  if (!pastedItems) {
    return [];
  }

  /** @type {ImageEntry[]} */
  let images = [];

  const fileIndex = [...pastedItems].findIndex(
    ({ kind, type }) => kind === 'file' && SUPPORTED_IMAGE_TYPES.includes(type),
  );

  const htmlIndex = [...pastedItems].findIndex(
    ({ kind, type }) => kind === 'string' && type === 'text/html',
  );

  if (fileIndex > -1 && htmlIndex > -1) {
    const file = pastedItems[fileIndex].getAsFile();

    if (!file) {
      return [];
    }

    // Clear the clipboard to prevent the editor from pasting the HTML
    pastedItems.clear();
    event.stopPropagation();

    let alt = '';
    let fileName = file.name;

    /** @type {HTMLImageElement | null} */
    const img = await new Promise((resolve) => {
      pastedItems[htmlIndex].getAsString((str) => {
        resolve(findImageInHTML(str));
      });
    });

    if (img) {
      alt = img.alt;

      if (/^https?:/.test(img.src)) {
        // `split()` always yields at least one segment, so `pop()` never returns `undefined`
        const name = /** @type {string} */ (new URL(img.src).pathname.split('/').pop());

        if (hasImageExtension(name)) {
          fileName = name;
        }
      }
    }

    images = [{ file: new File([file], fileName, { type: file.type }), alt }];
  } else {
    images = [...clipboardData.files]
      .filter(({ type }) => SUPPORTED_IMAGE_TYPES.includes(type))
      .map((file) => ({ file }));
  }

  return images.map(({ file, alt }, index) => {
    if (file?.name === GENERIC_PASTED_FILE_NAME) {
      const suffix = images.length > 1 ? `-${index + 1}` : '';

      file = new File([file], getTimestampFileName('png', suffix), { type: file.type });
    }

    return { file, alt };
  });
};

/**
 * Get the images dropped onto the rich text editor. Local files are used as they are. A remote
 * image dragged from another page comes as HTML holding an `<img>` rather than a file, so its
 * `src` and `alt` are used to link it instead; the image is only downloaded when the `src` is a
 * data URL, because fetching it from another site would most likely fail due to its CORS policy.
 * @param {DragEvent} event `drop` event.
 * @returns {Promise<ImageEntry[]>} Images. Empty if nothing dropped is an image, or the dropped
 * data URL couldn’t be read.
 */
export const getDroppedImages = async (event) => {
  const { dataTransfer } = event;
  const droppedFiles = dataTransfer?.files;

  if (droppedFiles?.length) {
    return [...droppedFiles]
      .filter(({ type }) => SUPPORTED_IMAGE_TYPES.includes(type))
      .map((file) => ({ file }));
  }

  const html = dataTransfer?.getData('text/html');
  const img = html ? findImageInHTML(html) : null;

  if (!img) {
    return [];
  }

  const { src, alt } = img;
  const type = src.match(DATA_URL_REGEX)?.groups?.type ?? '';
  /** @type {File | undefined} */
  let file = undefined;

  if (SUPPORTED_IMAGE_TYPES.includes(type)) {
    try {
      const blob = await (await fetch(src)).blob();

      file = new File([blob], getTimestampFileName(type.split('/')[1]), { type });
    } catch {
      return [];
    }
  }

  return [{ file, src, alt }];
};
