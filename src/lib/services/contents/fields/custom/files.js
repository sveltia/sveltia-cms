import {
  getAssetLibraryFolderMap,
  getDefaultAssetFolder,
} from '$lib/services/contents/fields/file/helpers';
import { processResource } from '$lib/services/contents/fields/file/process';
import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';

/**
 * @import { EntryDraft, TypedFieldKeyPath } from '$lib/types/private';
 * @import { CustomField, CustomFieldAddFileOptions } from '$lib/types/public';
 */

/**
 * Add a file to the entry draft on behalf of a custom field control, so that it’s committed along
 * with the entry when the entry is saved. The file is cached in the draft and referenced with a
 * temporary blob URL, exactly like a file picked in a built-in File/Image field, so everything
 * downstream — the target folder, file naming, deduplication, the backup and the editorial workflow
 * — works the same way. The target folder is the one a File/Image field in the same place would
 * upload to: the field’s own `media_folder` if any, otherwise the collection’s or the global one.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {CustomField} args.fieldConfig Field configuration.
 * @param {TypedFieldKeyPath} args.typedKeyPath Typed key path to the field.
 * @param {string} [args.componentName] Name of the rich text editor component the field is part of,
 * if any.
 * @param {File | Blob} args.file File to be added.
 * @param {CustomFieldAddFileOptions} [args.options] Options.
 * @returns {Promise<string>} Blob URL to be stored in the field value. It’s replaced with the
 * public path of the uploaded file when the entry is saved. If an identical file has already been
 * uploaded, the public path of the existing asset is returned instead.
 * @throws {TypeError} When the file is not a `File`, or is a `Blob` given without a name.
 * @throws {Error} When the file cannot be decoded or exceeds the size limit configured for the
 * media library.
 */
export const addFileToDraft = async ({
  draft,
  fieldConfig,
  typedKeyPath,
  componentName,
  file,
  options = {},
}) => {
  const name = options.name ?? (file instanceof File ? file.name : '');

  if (!(file instanceof Blob) || !name) {
    throw new TypeError('addFile() expects a File, or a Blob along with the `name` option');
  }

  const namedFile =
    file instanceof File && file.name === name ? file : new File([file], name, { type: file.type });

  const { collectionName, fileName, isIndexFile } = draft;

  const folderMap = getAssetLibraryFolderMap({
    collectionName,
    fileName,
    componentName,
    typedKeyPath,
    isIndexFile,
  });

  const folder = getDefaultAssetFolder(folderMap);

  const { config: libraryConfig } = getDefaultMediaLibraryOptions({
    fieldConfig: /** @type {any} */ (fieldConfig),
  });

  const { value, oversizedFileName, invalidFileName } = await processResource({
    draft,
    resource: { file: namedFile, folder },
    libraryConfig,
  });

  if (invalidFileName) {
    throw new Error(`The file "${invalidFileName}" is corrupt or mislabeled and cannot be used`);
  }

  if (oversizedFileName) {
    const { max_file_size: maxSize } = libraryConfig;

    throw new Error(`The file "${oversizedFileName}" exceeds the maximum size of ${maxSize} bytes`);
  }

  return /** @type {string} */ (value);
};
