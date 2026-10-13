/**
 * @import { InternalCollection } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Regular expression matching the item index of a List field within a key path, e.g. `.0` in
 * `speakers.0.name` and `.3` in `tags.3`.
 */
const LIST_ITEM_INDEX_REGEX = /\.\d+(?=\.|$)/;

/**
 * Check whether a field holds exactly one value per entry of an entry collection, so its value can
 * be compared with the same field’s in the other entries, as the `unique` and `auto_increment`
 * options do. Every entry of an entry collection has the same fields, except the special index
 * file, which has fields of its own. A field in a List field or a rich text editor component can
 * appear any number of times in an entry, so it doesn’t count.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {boolean} [args.isIndexFile] Whether the entry is the collection’s special index file.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {boolean} [args.inEditorComponent] Whether the field is in a rich text editor component.
 * @returns {boolean} Result.
 */
export const isPerEntryField = ({
  collection,
  isIndexFile = false,
  keyPath,
  inEditorComponent = false,
}) =>
  collection._type === 'entry' &&
  !isIndexFile &&
  !inEditorComponent &&
  !LIST_ITEM_INDEX_REGEX.test(keyPath);
