import { processResource } from '$lib/services/contents/fields/file/process';
import {
  getDroppedFileDestination,
  processResources,
} from '$lib/services/contents/fields/file/resources';
import { getPreferredLibraryNames } from '$lib/services/integrations/media-libraries/options';

/**
 * @import {
 * AssetFolderInfo,
 * EntryDraft,
 * InternalLocaleCode,
 * SelectedResource,
 * } from '$lib/types/private';
 * @import {
 * DefaultMediaLibraryConfig,
 * EditorComponentDefinition,
 * ImageField,
 * } from '$lib/types/public';
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
 * @typedef {object} ImageInsertionArgs
 * @property {EntryDraft} draft Entry draft the images are inserted into.
 * @property {AssetFolderInfo | undefined} folder Folder to save a file to.
 * @property {DefaultMediaLibraryConfig} libraryConfig Default media library configuration.
 * @property {InternalLocaleCode} locale Locale the images are inserted for.
 * @property {() => boolean} isCurrent Function to check whether the editor still shows the content
 * the images are inserted into. The editor is reused when the pane switches to another locale or
 * another entry is opened, so an image would otherwise be inserted into the content it shows then,
 * with a path resolved for the one it was meant for.
 * @property {(src: string, alt: string) => void} insertImage Function to insert an image into the
 * editor.
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

/**
 * Insert the images dropped or pasted into the rich text editor that go in right away, in order. A
 * file is saved to the repository along with the entry first, and a remote image is linked by its
 * URL. Nothing more is inserted once the editor shows other content.
 * @param {ImageInsertionArgs & { images: ImageEntry[] }} args Arguments.
 * @returns {Promise<boolean>} Whether every image has been handled, `false` if the editor has
 * moved on to other content in the meantime.
 */
export const insertInlineImages = async ({
  draft,
  images,
  folder,
  libraryConfig,
  locale,
  isCurrent,
  insertImage,
}) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const { file, src: externalSrc, alt = '' } of images) {
    let src = externalSrc;

    if (file) {
      // eslint-disable-next-line no-await-in-loop
      const { value } = await processResource({
        draft,
        resource: { file, folder },
        libraryConfig,
        locale,
      });

      if (!isCurrent()) {
        return false;
      }

      src = value;
    }

    if (src) {
      insertImage(src, alt);
    }
  }

  return true;
};

/**
 * Insert the images selected in the Select Assets dialog, which uploads the files to a cloud
 * storage service. Nothing is inserted if the editor shows other content once they’re processed.
 * @param {ImageInsertionArgs & { resources: SelectedResource[] }} args Arguments.
 */
export const insertSelectedImages = async ({
  draft,
  resources,
  folder,
  libraryConfig,
  locale,
  isCurrent,
  insertImage,
}) => {
  const results = await processResources({ draft, resources, folder, libraryConfig, locale });

  if (isCurrent()) {
    results.forEach(({ value }) => {
      if (value) {
        insertImage(value, '');
      }
    });
  }
};
