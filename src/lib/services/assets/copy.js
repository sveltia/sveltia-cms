import { createDisplayBlobURL, getAssetBlob } from '$lib/services/assets/info';
import {
  getRichTextMediaSources,
  replaceRichTextMediaSources,
} from '$lib/services/contents/fields/rich-text/previews/media-sources';

/**
 * @import { Asset, AssetFolderInfo, EntryFileMap } from '$lib/types/private';
 * @import { RichTextValueFormat } from '$lib/types/public';
 */

/**
 * Get a copy of the given asset as a file, so it can be uploaded as a new asset.
 * @param {Asset} asset Asset.
 * @returns {Promise<File>} File.
 * @throws {Error} When the blob of the asset cannot be retrieved.
 */
export const getAssetFile = async (asset) => {
  const blob = await getAssetBlob(asset);

  return new File([blob], asset.name, { type: blob.type });
};

/**
 * Create a function that adds files to an entry as pending uploads, the same as if the user had
 * picked them for a field, so saving the entry writes them alongside it. A file is added once per
 * key, so one referenced more than once, e.g. from another locale or field, shares the blob URL.
 * @param {object} args Arguments.
 * @param {EntryFileMap} args.files Files to be uploaded, where the pending files are added.
 * @param {(file: File, folder: AssetFolderInfo) => Promise<string | undefined>} [args.findExisting]
 * Function to find the blob URL of the file if it’s already pending, so it isn’t added again.
 * @returns {(
 * key: string,
 * getFile: () => Promise<File | undefined>,
 * folder: AssetFolderInfo,
 * ) => Promise<string | undefined>} Function that takes the key of the file, e.g. the asset path
 * it comes from, a function to get the file, and the folder the file is saved to, and returns the
 * blob URL of the pending file, or `undefined` if there’s no file. An error thrown while getting or
 * adding the file is not handled, and the same error is returned for the same key.
 */
export const createPendingFileAdder = ({ files, findExisting }) => {
  /** @type {Map<string, Promise<string | undefined>>} */
  const copies = new Map();

  return (key, getFile, folder) => {
    let copy = copies.get(key);

    if (!copy) {
      copy = (async () => {
        const file = await getFile();

        if (!file) {
          return undefined;
        }

        const existingBlobURL = await findExisting?.(file, folder);

        if (existingBlobURL) {
          return existingBlobURL;
        }

        // The file may come from the repository, so its URL must not let an SVG image run script
        const blobURL = await createDisplayBlobURL(file);

        files[blobURL] = { file, folder, replace: false };

        return blobURL;
      })();

      copies.set(key, copy);
    }

    return copy;
  };
};

/**
 * Get the asset references in a field value: the value itself for a File or Image field, or the
 * media URLs in a Markdown or HTML body.
 * @param {string} value Field value.
 * @param {RichTextValueFormat} [format] Format of a Markdown or RichText field value.
 * @returns {string[]} References.
 */
export const getFieldMediaSources = (value, format) =>
  format ? getRichTextMediaSources(value, format) : [value];

/**
 * Rewrite the asset references in a field value.
 * @param {object} args Arguments.
 * @param {string} args.value Field value.
 * @param {RichTextValueFormat} [args.format] Format of a Markdown or RichText field value, or
 * `undefined` for a File or Image field value.
 * @param {(src: string) => Promise<string | undefined>} args.rewrite Function to get the new
 * reference for each reference in the value, or `undefined` to leave it as is.
 * @returns {Promise<string | undefined>} New value: the whole value of a Markdown or RichText
 * field, or `undefined` for a File or Image field value that is not rewritten.
 */
export const rewriteAssetReferences = async ({ value, format, rewrite }) => {
  const newSources = new Map(
    await Promise.all(
      getFieldMediaSources(value, format).map(
        async (src) => /** @type {[string, string | undefined]} */ ([src, await rewrite(src)]),
      ),
    ),
  );

  return format ? replaceRichTextMediaSources(value, newSources, format) : newSources.get(value);
};
