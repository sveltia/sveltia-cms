import { flatten } from 'flat';

import { getObjectThumbnail } from '$lib/services/contents/fields/object/thumbnail';

/**
 * @import { Entry, EntryFileMap, MediaFieldSource } from '$lib/types/private';
 * @import { RawEntryContent } from '$lib/types/public';
 */

/**
 * Get the thumbnail shown in the placeholder of a rich text editor component in `dialog` mode,
 * which is the image held by the field named with the component’s `thumbnail` option.
 * @param {object} args Arguments.
 * @param {string} [args.thumbnailFieldName] The `thumbnail` option: the name of a field, or the key
 * path of a nested one like `mobile.src`, optionally prefixed with `fields.`.
 * @param {RawEntryContent} [args.values] Component values (unflattened).
 * @param {string} args.componentName Component name, e.g. `x-icon`.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {Entry} [args.entry] Entry being edited, used to locate an asset from a relative path.
 * @param {EntryFileMap} [args.files] Files uploaded in the draft but not saved yet, keyed by the
 * blob URL the field holds meanwhile.
 * @returns {MediaFieldSource | undefined} The image to preview, or `undefined` if the option is not
 * set, the field is not an Image/File field, it’s empty, or the file is not an image.
 */
export const getComponentThumbnail = ({ thumbnailFieldName, values, ...args }) => {
  if (!thumbnailFieldName || !values) {
    return undefined;
  }

  // The component values are at the top level, so there is no key path to prefix
  return getObjectThumbnail({
    ...args,
    thumbnailFieldName,
    keyPath: '',
    typedKeyPath: '',
    valueMap: flatten(values),
  });
};
