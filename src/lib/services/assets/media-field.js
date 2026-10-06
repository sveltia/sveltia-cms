import { getAssetByPath, isRelativePath } from '$lib/services/assets';
import { allAssetFolders } from '$lib/services/assets/folders';
import {
  getAssetBlobURL,
  getAssetPublicURL,
  getAssetThumbnailURL,
} from '$lib/services/assets/info';
import { getCustomComponentName } from '$lib/services/contents/fields/rich-text/components/definitions';
import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
import { getMergedLibraryOptions } from '$lib/services/integrations/media-libraries/cloud/cloudinary';

/**
 * @import { Entry, MediaFieldSource, TypedFieldKeyPath } from '$lib/types/private';
 * @import { MediaField } from '$lib/types/public';
 */

const URL_REGEX = /^(?:https?|data|blob):/;

/**
 * Get the base URL for assets stored in Cloudinary.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {string | undefined} Base URL or undefined if not applicable.
 */
export const getAssetBaseURL = (fieldConfig) => {
  if (allCloudStorageServices.cloudinary?.isEnabled?.(fieldConfig)) {
    const options = getMergedLibraryOptions(fieldConfig);

    if (options.output_filename_only && options.config?.cloud_name) {
      return `https://res.cloudinary.com/${options.config.cloud_name}`;
    }
  }

  return undefined;
};

/**
 * Resolve the given image/file entry field value to the file it points to, without loading it.
 * @param {object} args Arguments.
 * @param {string} args.value Saved field value. It can be an absolute path, entry-relative path, or
 * a complete/external URL.
 * @param {Entry} [args.entry] Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {string} [args.componentName] Custom editor component name for a field-level asset folder.
 * @param {MediaField} [args.fieldConfig] Field configuration.
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Field key path for field-level media folders.
 * @returns {MediaFieldSource | undefined} The URL of a file on an external location, or the asset
 * in the repository. `undefined` if the value is empty or the asset is not found.
 */
export const getMediaFieldSource = ({
  value,
  entry,
  collectionName,
  fileName,
  componentName,
  fieldConfig,
  typedKeyPath,
}) => {
  if (!value) {
    return undefined;
  }

  if (URL_REGEX.test(value)) {
    return { url: value };
  }

  // If the value is a relative path, try to get the asset base URL from the field config. This is a
  // special case for Cloudinary assets.
  if (isRelativePath(value)) {
    const assetBaseURL = getAssetBaseURL(fieldConfig);

    if (assetBaseURL) {
      return { url: `${assetBaseURL}/${value}` };
    }
  }

  const asset = getAssetByPath({
    value,
    entry,
    collectionName,
    fileName,
    componentName,
    typedKeyPath,
  });

  return asset ? { asset } : undefined;
};

/**
 * Get the URL of the given media field source.
 * @param {MediaFieldSource | undefined} source Source.
 * @param {boolean} [thumbnail] Whether to use a thumbnail of the image.
 * @returns {Promise<string | undefined>} Blob URL or public URL that can be used in the app UI.
 */
const getSourceURL = async (source, thumbnail = false) => {
  const { url, asset } = source ?? {};

  if (url) {
    return url;
  }

  if (!asset) {
    return undefined;
  }

  return (
    (thumbnail ? await getAssetThumbnailURL(asset) : await getAssetBlobURL(asset)) ??
    getAssetPublicURL(asset)
  );
};

/**
 * Get the blob or public URL from the given image/file entry field value.
 * @param {object} args Arguments.
 * @param {string} args.value Saved field value. It can be an absolute path, entry-relative path, or
 * a complete/external URL.
 * @param {Entry} [args.entry] Associated entry to be used to help locate an asset from a relative
 * path. Can be `undefined` when editing a new draft.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {string} [args.componentName] Custom editor component name for a field-level asset folder.
 * @param {MediaField} [args.fieldConfig] Field configuration.
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Field key path for field-level media folders.
 * @param {boolean} [args.thumbnail] Whether to use a thumbnail of the image.
 * @returns {Promise<string | undefined>} Blob URL or public URL that can be used in the app UI.
 */
export const getMediaFieldURL = async ({ thumbnail = false, ...args }) =>
  getSourceURL(getMediaFieldSource(args), thumbnail);

/**
 * Resolve a file referenced in a RichText field preview to the file it points to, without loading
 * it. The file may come from the preview of a custom editor component, whose fields can have their
 * own media folders. As the preview doesn’t tell which component a file comes from, the media
 * folders of the given components are searched if the file is not found for the RichText field
 * itself.
 * @param {object} args Arguments.
 * @param {string} args.value File path or URL, e.g. an image `src`.
 * @param {Entry} [args.entry] Associated entry. Can be `undefined` when editing a new draft.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Key path of the RichText field.
 * @param {string[]} args.componentNames Names or IDs of the components the field can contain.
 * @returns {MediaFieldSource | undefined} The URL of a file on an external location, or the asset
 * in the repository. `undefined` if the value is empty or the asset is not found.
 */
export const getRichTextMediaSource = ({ componentNames, ...args }) => {
  const customComponentNames = componentNames.map(getCustomComponentName).filter(Boolean);

  return (
    getMediaFieldSource(args) ??
    allAssetFolders.current
      .values()
      .filter(
        ({ componentName, typedKeyPath }) =>
          !!typedKeyPath && customComponentNames.includes(componentName),
      )
      .map(({ componentName, typedKeyPath }) =>
        getMediaFieldSource({ ...args, componentName, typedKeyPath }),
      )
      .find(Boolean)
  );
};

/**
 * Get the blob or public URL of an image, video or other file in a RichText field preview. See
 * {@link getRichTextMediaSource} for how the file is located.
 * @param {object} args Arguments.
 * @param {string} args.value File path or URL, e.g. an image `src`.
 * @param {Entry} [args.entry] Associated entry. Can be `undefined` when editing a new draft.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Key path of the RichText field.
 * @param {string[]} args.componentNames Names or IDs of the components the field can contain.
 * @returns {Promise<string | undefined>} Blob URL or public URL that can be used in the app UI.
 */
export const getRichTextMediaURL = async (args) => getSourceURL(getRichTextMediaSource(args));
