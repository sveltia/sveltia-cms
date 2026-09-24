import { getMediaFieldSource } from '$lib/services/assets/info';
import {
  canCreateThumbnail,
  getMediaKindFromPath,
  getMediaKindFromType,
} from '$lib/services/assets/kinds';
import { getField } from '$lib/services/contents/entry/fields';
import { MEDIA_FIELD_TYPES } from '$lib/services/contents/fields';
import { isMultiple } from '$lib/services/integrations/media-libraries/shared';

/**
 * @import {
 * Entry,
 * EntryFileMap,
 * FlattenedEntryContent,
 * MediaFieldSource,
 * TypedFieldKeyPath,
 * } from '$lib/types/private';
 * @import { FieldKeyPath, MediaField } from '$lib/types/public';
 */

/**
 * Get the thumbnail of a collapsed Object field or List field item, which is the file held by the
 * subfield named with the `thumbnail` option.
 * @param {object} args Arguments.
 * @param {string} [args.thumbnailFieldName] The `thumbnail` option: the name of a subfield, or the
 * key path of a nested one like `mobile.src`, optionally prefixed with `fields.` like a summary
 * template tag.
 * @param {FieldKeyPath} args.keyPath Key path of the object, e.g. `hero` or `gallery.0`.
 * @param {TypedFieldKeyPath} args.typedKeyPath Typed key path of the object, e.g. `hero`,
 * `gallery.*` or `sections.*<hero>`, used to find a field-level media folder.
 * @param {boolean} [args.hasSingleSubField] Whether the object is an item of a List field with the
 * `field` option, whose value is stored at the item key path itself rather than under the subfield
 * name.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {string} [args.componentName] Custom editor component name, if the object is part of a
 * rich text editor component.
 * @param {FlattenedEntryContent} args.valueMap Entry content.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {Entry} [args.entry] Entry being edited, used to locate an asset from a relative path.
 * @param {EntryFileMap} [args.files] Files uploaded in the draft but not saved yet, keyed by the
 * blob URL the field holds meanwhile.
 * @returns {MediaFieldSource | undefined} The file to preview, or `undefined` if the option is not
 * set, the subfield is not an Image/File field, it’s empty, or the file has no thumbnail.
 */
export const getObjectThumbnail = ({
  thumbnailFieldName,
  keyPath,
  typedKeyPath,
  hasSingleSubField = false,
  collectionName,
  fileName,
  componentName,
  valueMap,
  isIndexFile = false,
  entry,
  files,
}) => {
  if (!thumbnailFieldName) {
    return undefined;
  }

  const [subFieldName, ...nestedFieldNames] = thumbnailFieldName
    .replace(/^fields\./, '')
    .split('.');

  const getFieldArgs = { collectionName, fileName, componentName, valueMap, isIndexFile };

  // The single subfield of a list item is stored at the item key path itself, so the option has to
  // name that subfield, which `getField()` traverses into on its own
  if (hasSingleSubField && getField({ ...getFieldArgs, keyPath })?.name !== subFieldName) {
    return undefined;
  }

  const fieldNames = hasSingleSubField ? nestedFieldNames : [subFieldName, ...nestedFieldNames];
  const fieldKeyPath = [keyPath, ...fieldNames].join('.');
  const fieldTypedKeyPath = [typedKeyPath, ...fieldNames].join('.');
  const fieldConfig = getField({ ...getFieldArgs, keyPath: fieldKeyPath });
  const { widget: fieldType = 'string' } = fieldConfig ?? {};

  if (!fieldConfig || !MEDIA_FIELD_TYPES.includes(fieldType)) {
    return undefined;
  }

  const mediaFieldConfig = /** @type {MediaField} */ (fieldConfig);
  // A field holding several files is previewed with the first one
  const value = valueMap[isMultiple(mediaFieldConfig) ? `${fieldKeyPath}.0` : fieldKeyPath];

  if (typeof value !== 'string' || !value) {
    return undefined;
  }

  const source = getMediaFieldSource({
    value,
    entry,
    collectionName,
    fileName,
    componentName,
    fieldConfig: mediaFieldConfig,
    typedKeyPath: fieldTypedKeyPath,
  });

  if (!source) {
    return undefined;
  }

  const { asset, url } = source;

  // A File field can hold anything, but only some files have a thumbnail generated
  if (asset) {
    return canCreateThumbnail(asset) ? source : undefined;
  }

  // A file elsewhere is shown as it is, so it has to be an image: a file uploaded in the draft is
  // held as a blob URL until it’s saved, and its type is known; an external one has an extension
  const kind = /** @type {string} */ (url).startsWith('blob:')
    ? getMediaKindFromType(files?.[/** @type {string} */ (url)]?.file.type ?? '')
    : getMediaKindFromPath(/** @type {string} */ (url));

  return kind === 'image' ? source : undefined;
};
