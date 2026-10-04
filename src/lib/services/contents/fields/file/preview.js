import { getMediaKind } from '$lib/services/assets/kinds';
import { getMediaFieldURL } from '$lib/services/assets/media-field';

/**
 * @import { AssetKind, Entry, TypedFieldKeyPath } from '$lib/types/private';
 * @import { MediaField } from '$lib/types/public';
 */

/**
 * Get the media kind and source URL to preview a File/Image field value with.
 * @param {object} args Arguments.
 * @param {string} args.value Field value. It can be an absolute path, entry-relative path, blob URL
 * or a complete/external URL.
 * @param {AssetKind} [args.kind] Media kind if it’s already known, e.g. for an Image field, so it
 * doesn’t have to be determined from the value, which is rather problematic if the path doesn’t
 * have an extension.
 * @param {Entry} [args.entry] Associated entry. Can be `undefined` when editing a new draft.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {string} [args.componentName] Custom editor component name for a field-level asset folder.
 * @param {MediaField} [args.fieldConfig] Field configuration.
 * @param {TypedFieldKeyPath} [args.typedKeyPath] Field key path for field-level media folders.
 * @param {boolean} [args.thumbnail] Whether to use a thumbnail of the image.
 * @returns {Promise<{ kind: AssetKind | undefined, src: string | undefined }>} Media kind and
 * source URL. Both are `undefined` if the value is not a media file, and the URL is `undefined` if
 * the file could not be found.
 */
export const getMediaFieldPreview = async ({ kind, ...urlArgs }) => {
  const mediaKind = kind ?? (await getMediaKind(urlArgs.value));
  const src = mediaKind ? await getMediaFieldURL(urlArgs) : undefined;

  return { kind: mediaKind, src };
};
