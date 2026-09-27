import { isObject } from '@sveltia/utils/object';

import { formatSummary as formatObjectSummary } from '$lib/services/contents/fields/object/helpers';

/**
 * @import { FlattenedEntryContent, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath, ListField } from '$lib/types/public';
 */

/**
 * @typedef {object} ListFieldInfo
 * @property {boolean} hasSingleSubField Whether the List field has the `field` (singular) option.
 * @property {boolean} hasMultiSubFields Whether the List field has the `fields` (plural) option.
 * @property {boolean} hasVariableTypes Whether the List field has the variable `types` option.
 * @property {boolean} hasSubFields Whether the List field has sub-fields.
 */

/**
 * Get information about the List field type.
 * @param {ListField} field Field.
 * @returns {ListFieldInfo} Field type information.
 */
export const getListFieldInfo = (field) => {
  const hasSingleSubField = 'field' in field;
  const hasMultiSubFields = 'fields' in field;
  const hasVariableTypes = 'types' in field;

  return {
    hasSingleSubField,
    hasMultiSubFields,
    hasVariableTypes,
    hasSubFields: hasSingleSubField || hasMultiSubFields || hasVariableTypes,
  };
};

/**
 * Check whether the editor should show a List field as a single item rather than as a list. That’s
 * the case for a field limited to one item with `max: 1`, as a developer may store a single object
 * in an array, so the user doesn’t need to see an item count, a list toggle or reorder controls. A
 * field holding more items than that, e.g. edited outside the CMS, is shown as a list, so the extra
 * items can be removed.
 * @param {object} args Arguments.
 * @param {ListField} args.fieldConfig Field configuration.
 * @param {number} args.itemCount Number of items the field holds.
 * @returns {boolean} Result.
 */
export const isSingleItemList = ({ fieldConfig, itemCount }) =>
  fieldConfig.max === 1 && itemCount <= 1;

/**
 * Format the summary template of a List field.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {FlattenedEntryContent} args.valueMap Entry content.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {string} [args.summaryTemplate] Summary template, e.g. `{{fields.slug}}`.
 * @param {boolean} args.hasSingleSubField Whether the field has a single `field` instead of
 * multiple `fields`.
 * @param {number} args.index List index.
 * @returns {string} Formatted summary.
 */
export const formatSummary = ({ index, ...args }) =>
  formatObjectSummary({ ...args, itemKeyPath: `${args.keyPath}.${index}` });

/**
 * Get the `each` block key that identifies a List field item. Object items carry a generated ID
 * that follows the item as the list is reordered; primitives can only be keyed by their position.
 * @param {any[]} items List items.
 * @param {number} index Target index.
 * @returns {string | number} Key.
 */
export const getListItemKey = (items, index) => {
  const item = items[index];

  return isObject(item) ? (item.__sc_item_id ?? index) : index;
};

/**
 * Tag the object items of a List field before they are added, removed or reordered, so that each
 * item remembers its original key path, which is used to revert changes correctly once the items
 * have shifted. Tags that are already set are kept, and primitive items are left alone.
 * @param {any[]} valueList List items, which are mutated in place.
 * @param {FieldKeyPath} keyPath Key path of the List field.
 * @param {object} [options] Options.
 * @param {boolean} [options.assignIds] Whether to also give each item a unique ID, so that a keyed
 * `each` block keeps following each item rather than its position.
 */
export const tagListItems = (valueList, keyPath, { assignIds = false } = {}) => {
  valueList.forEach((item, index) => {
    if (isObject(item)) {
      if (assignIds) {
        item.__sc_item_id ??= crypto.randomUUID();
      }

      item.__sc_item_original_key_path ??= `${keyPath}.${index}`;
    }
  });
};
