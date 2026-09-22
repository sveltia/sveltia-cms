import {
  getAssetLibraryFolderMap,
  getDefaultAssetFolder,
} from '$lib/services/contents/fields/file/helpers';
import { processResource } from '$lib/services/contents/fields/file/process';
import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';

/**
 * @import {
 * AssetFolderInfo,
 * AssetLibraryFolderMap,
 * EntryDraft,
 * MediaLibraryService,
 * SelectedResource,
 * TypedFieldKeyPath,
 * } from '$lib/types/private';
 * @import { DefaultMediaLibraryConfig, Field } from '$lib/types/public';
 * @import { ProcessResourceResult } from '$lib/services/contents/fields/file/process';
 */

/**
 * @typedef {object} MediaFieldAssetOptions
 * @property {AssetLibraryFolderMap} folderMap Asset library folders available to the field.
 * @property {AssetFolderInfo | undefined} folder Folder a file added by the field is uploaded to.
 * @property {boolean} enabled Whether the default (repository) media library is enabled.
 * @property {DefaultMediaLibraryConfig} libraryConfig Default media library configuration.
 * @property {[string, MediaLibraryService][]} cloudServiceEntries Cloud storage services enabled
 * for the field.
 */

/**
 * @typedef {object} RejectedFileNames
 * @property {string[]} oversizedFileNames Names of the files that exceed the size limit.
 * @property {string[]} invalidFileNames Names of the files that cannot be decoded.
 */

/**
 * Get the asset folders and media library options that apply to a field handling files: a
 * File/Image field, or a custom field that adds or picks files. They come from the field’s own
 * `media_folder` and `media_library` options if any, otherwise the collection’s or the global ones.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string | undefined} args.fileName Collection file name, if any.
 * @param {boolean} args.isIndexFile Whether the entry is the collection’s index file.
 * @param {string | undefined} args.componentName Name of the rich text editor component the field
 * is part of, if any.
 * @param {TypedFieldKeyPath} args.typedKeyPath Typed key path to the field.
 * @param {Field} args.fieldConfig Field configuration.
 * @returns {MediaFieldAssetOptions} Options.
 */
export const getMediaFieldAssetOptions = ({
  collectionName,
  fileName,
  isIndexFile,
  componentName,
  typedKeyPath,
  fieldConfig,
}) => {
  const folderMap = getAssetLibraryFolderMap({
    collectionName,
    fileName,
    componentName,
    typedKeyPath,
    isIndexFile,
  });

  const { enabled, config: libraryConfig } = getDefaultMediaLibraryOptions({
    fieldConfig: /** @type {any} */ (fieldConfig),
  });

  const cloudServiceEntries = Object.entries(allCloudStorageServices).filter(
    ([, { isEnabled }]) => isEnabled?.(/** @type {any} */ (fieldConfig)) ?? true,
  );

  return {
    folderMap,
    folder: getDefaultAssetFolder(folderMap),
    enabled,
    libraryConfig,
    cloudServiceEntries,
  };
};

/**
 * Process the resources selected in the Select Assets dialog, or dropped or pasted into a field.
 * A file to be uploaded that doesn’t come with a folder of its own, including a stock photo that
 * isn’t hotlinked, goes to the given folder.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {SelectedResource[]} args.resources Resources. A missing `folder` is filled in.
 * @param {AssetFolderInfo | undefined} args.folder Default folder for uploads.
 * @param {DefaultMediaLibraryConfig} args.libraryConfig Default media library configuration.
 * @returns {Promise<ProcessResourceResult[]>} Results, in the same order as the resources.
 */
export const processResources = ({ draft, resources, folder, libraryConfig }) =>
  Promise.all(
    resources.map((resource) => {
      if (resource.file && !resource.folder) {
        resource.folder = folder;
      }

      return processResource({ draft, resource, libraryConfig });
    }),
  );

/**
 * Collect the names of the files that couldn’t be used, so they can be reported to the user.
 * @param {ProcessResourceResult[]} results Results of {@link processResources}.
 * @returns {RejectedFileNames} File names.
 */
export const getRejectedFileNames = (results) => ({
  oversizedFileNames: results.flatMap(({ oversizedFileName }) => oversizedFileName ?? []),
  invalidFileNames: results.flatMap(({ invalidFileName }) => invalidFileName ?? []),
});

/**
 * Get the value to store in a field for a processed resource. Spaces are encoded as `%20` in a
 * rich text editor component, because some Markdown parsers don’t support unencoded spaces in URLs.
 * @param {string} value Value, e.g. an asset path.
 * @param {boolean} inEditorComponent Whether the field is part of a rich text editor component.
 * @returns {string} Value to store.
 */
export const toFieldValue = (value, inEditorComponent) =>
  inEditorComponent ? value.replaceAll(' ', '%20') : value;
