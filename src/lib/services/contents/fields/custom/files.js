import { getAssetByPath } from '$lib/services/assets';
import { getAssetBlob } from '$lib/services/assets/info';
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
 * MediaLibraryAssetKind,
 * MediaLibraryService,
 * SelectedResource,
 * TypedFieldKeyPath,
 * } from '$lib/types/private';
 * @import {
 * CustomField,
 * CustomFieldAddFileOptions,
 * CustomFieldPickFileOptions,
 * CustomFieldPickedFile,
 * DefaultMediaLibraryConfig,
 * } from '$lib/types/public';
 */

/**
 * @typedef {object} CustomFieldArgs
 * @property {EntryDraft} draft Entry draft.
 * @property {CustomField} fieldConfig Field configuration.
 * @property {TypedFieldKeyPath} typedKeyPath Typed key path to the field.
 * @property {string} [componentName] Name of the rich text editor component the field is part of,
 * if any.
 */

/**
 * @typedef {object} CustomFieldAssetOptions
 * @property {AssetLibraryFolderMap} folderMap Asset library folders available to the field.
 * @property {AssetFolderInfo | undefined} folder Folder a file added by the field is uploaded to.
 * @property {boolean} enabled Whether the default (repository) media library is enabled.
 * @property {DefaultMediaLibraryConfig} libraryConfig Default media library configuration.
 * @property {[string, MediaLibraryService][]} cloudServiceEntries Cloud storage services enabled
 * for the field.
 */

/**
 * @typedef {object} PickedResourcesResult
 * @property {CustomFieldPickedFile[]} files Usable resources, in the order they were selected.
 * @property {string[]} oversizedFileNames Names of the files that exceed the size limit.
 * @property {string[]} invalidFileNames Names of the files that cannot be decoded.
 */

/**
 * Get the asset folders and media library options that apply to a custom field. These are the same
 * a File/Image field in the same place would use: the field’s own `media_folder` and
 * `media_library` options if any, otherwise the collection’s or the global ones.
 * @param {CustomFieldArgs} args Arguments.
 * @returns {CustomFieldAssetOptions} Options.
 */
export const getCustomFieldAssetOptions = ({ draft, fieldConfig, typedKeyPath, componentName }) => {
  const { collectionName, fileName, isIndexFile } = draft;

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
 * Add a file to the entry draft on behalf of a custom field control, so that it’s committed along
 * with the entry when the entry is saved. The file is cached in the draft and referenced with a
 * temporary blob URL, exactly like a file picked in a built-in File/Image field, so everything
 * downstream — the target folder, file naming, deduplication, the backup and the editorial workflow
 * — works the same way. The target folder is the one a File/Image field in the same place would
 * upload to: the field’s own `media_folder` if any, otherwise the collection’s or the global one.
 * @param {CustomFieldArgs & { file: File | Blob, options?: CustomFieldAddFileOptions }} args
 * Arguments, including the file to be added and the options.
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

  const { folder, libraryConfig } = getCustomFieldAssetOptions({
    draft,
    fieldConfig,
    typedKeyPath,
    componentName,
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

/**
 * Get the asset kind the Select Assets dialog is opened for. The `kind` option wins; otherwise the
 * dialog is limited to images when every accepted type is an image type, so that a control can
 * simply ask for `image/*` the way it would with a file input.
 * @param {CustomFieldPickFileOptions} options Options given to `pickFile()`.
 * @returns {MediaLibraryAssetKind | undefined} Asset kind, or `undefined` for any file.
 */
export const getPickedAssetKind = ({ kind, accept }) => {
  if (kind) {
    return kind === 'image' ? 'image' : undefined;
  }

  const types = (accept ?? '')
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean);

  return types.length && types.every((type) => type.startsWith('image/')) ? 'image' : undefined;
};

/**
 * Get the bytes of a resource the user picked in the dialog, once the resource has been processed.
 * A file being uploaded is read back from the draft, where {@link processResource} caches the
 * processed (possibly transformed) file, and an existing asset is fetched from wherever it’s
 * available. A file that turned out to be an identical copy of an asset already in the repository
 * is resolved to that asset, so the bytes always match the value. Nothing is returned for a URL.
 * @param {CustomFieldArgs & { resource: SelectedResource, value: string }} args Arguments,
 * including the resource and the value {@link processResource} has resolved it to.
 * @returns {Promise<Blob | undefined>} Blob, if the resource has one.
 */
const getPickedBlob = async ({ draft, typedKeyPath, componentName, resource, value }) => {
  if (value.startsWith('blob:')) {
    return draft.files[value]?.file;
  }

  const { collectionName, fileName, originalEntry: entry } = draft;

  const asset =
    resource.asset ??
    (resource.file
      ? getAssetByPath({ value, entry, collectionName, fileName, componentName, typedKeyPath })
      : undefined);

  return asset ? getAssetBlob(asset) : undefined;
};

/**
 * Resolve the resources picked in the Select Assets dialog on behalf of a custom field control.
 * Each resource is processed the way a built-in File/Image field would: an existing asset is
 * resolved to its public path, a file to be uploaded is cached in the draft and given a temporary
 * blob URL, and a URL is used as is. Files that are oversized or cannot be decoded are reported
 * separately, so the caller can show them the way a File/Image field does.
 * @param {CustomFieldArgs & { resources: SelectedResource[] }} args Arguments, including the
 * resources picked in the dialog.
 * @returns {Promise<PickedResourcesResult>} Result.
 * @throws {Error} When the bytes of a picked asset cannot be retrieved.
 */
export const resolvePickedResources = async ({
  draft,
  fieldConfig,
  typedKeyPath,
  componentName,
  resources,
}) => {
  const { folder, libraryConfig } = getCustomFieldAssetOptions({
    draft,
    fieldConfig,
    typedKeyPath,
    componentName,
  });

  /** @type {PickedResourcesResult} */
  const result = { files: [], oversizedFileNames: [], invalidFileNames: [] };

  const results = await Promise.all(
    resources.map(async (resource) => {
      // Set the target folder for uploads and non-hotlinking stock assets from Pexels, etc.
      if (resource.file && !resource.folder) {
        resource.folder = folder;
      }

      const processed = await processResource({ draft, resource, libraryConfig });
      const { value } = processed;

      const file = value
        ? await getPickedBlob({ draft, fieldConfig, typedKeyPath, componentName, resource, value })
        : undefined;

      return { ...processed, file };
    }),
  );

  results.forEach(({ value, file, credit, oversizedFileName, invalidFileName }) => {
    if (value) {
      result.files.push({ value, file, credit: credit || undefined });
    }

    if (oversizedFileName) {
      result.oversizedFileNames.push(oversizedFileName);
    }

    if (invalidFileName) {
      result.invalidFileNames.push(invalidFileName);
    }
  });

  return result;
};
