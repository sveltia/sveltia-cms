import { isTextFileType } from '@sveltia/utils/file';
import { isURL } from '@sveltia/utils/string';
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
 * List of media kinds that support thumbnails.
 * @type {AssetKind[]}
 */
export const THUMBNAIL_KINDS = ['image', 'video'];

/**
 * Whether a thumbnail can be generated for a PDF document with the given name, by rendering its
 * first page with PDF.js. Not in the npm build, which doesn’t load PDF.js from a CDN and doesn’t
 * bundle it either, as the library comes with hundreds of files for character maps, fonts and
 * image decoders; `pdf.npm.js` replaces `pdf.js` there. A PDF is shown with a generic icon instead.
 * @param {string} fileName File name or path, e.g. `files/brochure.pdf`.
 * @returns {boolean} Result.
 */
export const hasPDFThumbnail = (fileName) =>
  !import.meta.env.NPM_BUILD && fileName.endsWith('.pdf');

/**
 * Whether a thumbnail can be generated for the given asset: an image, a video, or a PDF document
 * outside the npm build, see {@link hasPDFThumbnail}.
 * @param {Asset} asset Asset.
 * @returns {boolean} Result.
 */
export const canCreateThumbnail = (asset) =>
  THUMBNAIL_KINDS.includes(asset.kind) || hasPDFThumbnail(asset.name);

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
export const DOC_EXTENSION_REGEX = /\.(?:csv|docx?|odp|ods|odt|pdf|pptx?|rtf|xlsx?)$/i;

const MEDIA_TYPE_REGEX = /^(?<type>image|video|audio)\//;

/**
 * Check if the given asset kind is media.
 * @param {string} kind Kind, e.g. `image` or `video`.
 * @returns {boolean} Result.
 */
export const isMediaKind = (kind) => /** @type {string[]} */ (MEDIA_KINDS).includes(kind);

/**
 * Whether a file of the given kind and name can be previewed: a media file, a PDF document or a
 * plaintext file.
 * @param {string} kind Kind, e.g. `image` or `document`.
 * @param {string} fileName File name or path, e.g. `images/photo.jpg`.
 * @returns {boolean} Result.
 */
export const canPreviewFile = (kind, fileName) => {
  const type = mime.getType(fileName);

  return isMediaKind(kind) || type === 'application/pdf' || (!!type && isTextFileType(type));
};

/**
 * Whether the given asset is previewable.
 * @param {Asset} asset Asset.
 * @returns {boolean} Result.
 */
export const canPreviewAsset = (asset) => canPreviewFile(asset.kind, asset.path);

/**
 * Get the media kind of the given MIME type.
 * @param {string} mimeType MIME type, e.g. `image/png`.
 * @returns {AssetKind | undefined} Kind.
 */
export const getMediaKindFromType = (mimeType) => {
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
 * Get the media kind of the given path or URL from its extension, without loading anything.
 * @param {string} source Asset path, complete URL or data URL.
 * @returns {AssetKind | undefined} Kind.
 */
export const getMediaKindFromPath = (source) => {
  // A data URL carries its own MIME type, e.g. `data:image/png;base64,…`
  if (source.startsWith('data:')) {
    return getMediaKindFromType(source.slice(5).split(/[;,]/)[0]);
  }

  if (isURL(source)) {
    const { hostname, pathname } = new URL(source);

    // Handle common image CDN hostnames, e.g. images.unsplash.com
    if (hostname.startsWith('images.')) {
      return 'image';
    }

    // Remove query string and hash
    source = pathname;
  }

  return getMediaKindFromType(mime.getType(source) ?? '');
};

/**
 * Get the media type of the given blob or path.
 * @param {Blob | string} source Blob, blob URL, or asset path.
 * @returns {Promise<AssetKind | undefined>} Kind.
 */
export const getMediaKind = async (source) => {
  if (typeof source === 'string') {
    if (!source.startsWith('blob:')) {
      return getMediaKindFromPath(source);
    }

    try {
      return getMediaKindFromType((await (await fetch(source)).blob()).type);
    } catch {
      return undefined;
    }
  }

  if (source instanceof Blob) {
    return getMediaKindFromType(source.type);
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
    mime.getType(name)?.match(MEDIA_TYPE_REGEX)?.groups?.type ??
      (DOC_EXTENSION_REGEX.test(name) ? 'document' : 'other')
  );
