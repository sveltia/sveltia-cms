import { getDroppedFileDestination } from '$lib/services/contents/fields/file/resources';
import { getPreferredLibraryNames } from '$lib/services/integrations/media-libraries/options';

/**
 * @import { EditorComponentDefinition, ImageField } from '$lib/types/public';
 * @import { MediaFieldAssetOptions } from '$lib/services/contents/fields/file/resources';
 * @import { ImageEntry } from '$lib/services/contents/fields/rich-text/images';
 */

/**
 * @typedef {object} SortedImages
 * @property {ImageEntry[]} inlineImages Images inserted right away: remote images linked by their
 * URL, and files saved to the repository along with the entry.
 * @property {File[]} uploadFiles Files to be uploaded to a cloud storage service in the Select
 * Assets dialog, which asks for the credentials if needed.
 * @property {boolean} rejected Whether some files have been left out, as no location can take them.
 */

/**
 * Get the `src` field of the image component, which holds the media library options that apply to
 * images dropped or pasted into the rich text editor.
 * @param {EditorComponentDefinition | undefined} component Image component.
 * @returns {ImageField | undefined} Field configuration.
 */
export const getImageSrcFieldConfig = (component) =>
  /** @type {ImageField | undefined} */ (component?.fields?.find(({ name }) => name === 'src'));

/**
 * Sort the images dropped or pasted into the rich text editor by how they’re inserted. A file goes
 * to the location marked with the `default` option, so it’s not saved to the repository when it
 * should go to a cloud storage service, or when the repository is disabled.
 * @param {object} args Arguments.
 * @param {ImageEntry[]} args.images Images.
 * @param {ImageField | undefined} args.srcFieldConfig Configuration of the image component’s `src`
 * field.
 * @param {MediaFieldAssetOptions} args.assetOptions Asset options for the field.
 * @returns {SortedImages} Sorted images.
 * @see https://github.com/sveltia/sveltia-cms/issues/1172
 */
export const sortDroppedImages = ({ images, srcFieldConfig, assetOptions }) => {
  const { enabled, folder, cloudServiceEntries } = assetOptions;

  const { destination } = getDroppedFileDestination({
    repositoryAvailable: enabled && !!folder,
    cloudServiceEntries,
    preferredLibraryNames: getPreferredLibraryNames(srcFieldConfig),
  });

  if (destination === 'repository') {
    return { inlineImages: images, uploadFiles: [], rejected: false };
  }

  const files = images.flatMap(({ file }) => file ?? []);

  return {
    inlineImages: images.filter(({ file }) => !file),
    uploadFiles: destination ? files : [],
    rejected: !destination && !!files.length,
  };
};
