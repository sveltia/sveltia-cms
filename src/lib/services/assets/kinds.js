import { isTextFileType } from '@sveltia/utils/file';
import mime from 'mime';

/**
 * @import { Asset, AssetKind } from '$lib/types/private';
 */

/**
 * List of media kinds.
 * @type {AssetKind[]}
 */
export const MEDIA_KINDS = ['image', 'video', 'audio'];

/**
 * List of all asset kinds.
 * @type {AssetKind[]}
 */
export const ASSET_KINDS = [...MEDIA_KINDS, 'document', 'other'];

/**
 * Regular expression that matches common document file extensions.
 * @type {RegExp}
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
 */
export const DOC_EXTENSION_REGEX = /\.(?:csv|docx?|odp|ods|odt|pdf|pptx?|rtf|xslx?)$/i;

/**
 * Check if the given asset kind is media.
 * @param {string} kind Kind, e.g. `image` or `video`.
 * @returns {boolean} Result.
 */
export const isMediaKind = (kind) => /** @type {string[]} */ (MEDIA_KINDS).includes(kind);

/**
 * Whether the given asset is previewable.
 * @param {Asset} asset Asset.
 * @returns {boolean} Result.
 */
export const canPreviewAsset = (asset) => {
  const type = mime.getType(asset.path);

  return isMediaKind(asset.kind) || type === 'application/pdf' || (!!type && isTextFileType(type));
};

/**
 * Get the media type of the given blob or path.
 * @param {Blob | string} source Blob, blob URL, or asset path.
 * @returns {Promise<AssetKind | undefined>} Kind.
 */
export const getMediaKind = async (source) => {
  let mimeType = '';

  if (typeof source === 'string') {
    if (source.startsWith('blob:')) {
      try {
        mimeType = (await (await fetch(source)).blob()).type;
      } catch {
        //
      }
    } else {
      mimeType = mime.getType(source) ?? '';
    }
  } else if (source instanceof Blob) {
    mimeType = source.type;
  }

  if (!mimeType) {
    return undefined;
  }

  const [type, subType] = mimeType.split('/');

  if (isMediaKind(type) && !subType.startsWith('x-')) {
    return /** @type {AssetKind} */ (type);
  }

  return undefined;
};

/**
 * Whether the given asset is editable.
 * @param {Asset} asset Asset.
 * @returns {boolean} Result.
 * @todo Support image editing.
 */
export const canEditAsset = (asset) => {
  const type = mime.getType(asset.path);

  return !!type && isTextFileType(type);
};

/**
 * Determine the asset’s kind from the file extension.
 * @param {string} name File name or path.
 * @returns {AssetKind} One of {@link ASSET_KINDS}.
 */
export const getAssetKind = (name) =>
  /** @type {AssetKind} */ (
    mime.getType(name)?.match(/^(?<type>image|audio|video)\//)?.groups?.type ??
      (DOC_EXTENSION_REGEX.test(name) ? 'document' : 'other')
  );
