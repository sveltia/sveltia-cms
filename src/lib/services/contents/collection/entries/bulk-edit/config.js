import { isObject } from '@sveltia/utils/object';

import { isInlineComponentFieldList } from '$lib/services/config/parser/editor-components';
import { isAutoNowField } from '$lib/services/contents/fields/date-time/auto-now';

/**
 * @import { InternalEntryCollection } from '$lib/types/private';
 * @import { Field, NumberField } from '$lib/types/public';
 */

/**
 * Check whether a top-level field of an entry collection can be edited in the bulk editor. Only a
 * field holding a single simple value edited with a compact control fits in a table cell: the same
 * field types as a rich text editor component in the `inline` mode, without the `multiple` option.
 * A read-only field, and a field whose value is set on save — an auto-increment Number field or a
 * DateTime field with the `auto_now` option — don’t qualify either.
 * @param {Field} fieldConfig Field configuration.
 * @returns {boolean} Result.
 */
export const isBulkEditableField = (fieldConfig) =>
  isInlineComponentFieldList([fieldConfig]) &&
  !(/** @type {{ readonly?: boolean }} */ (fieldConfig).readonly) &&
  !(fieldConfig.widget === 'number' && /** @type {NumberField} */ (fieldConfig).auto_increment) &&
  !isAutoNowField(fieldConfig);

/**
 * Check whether the bulk editor is enabled for a collection with the `bulk_edit` option.
 * @param {any} collection Collection. Anything other than an entry collection returns `false`.
 * @returns {boolean} Result.
 */
export const isBulkEditEnabled = (collection) =>
  collection?._type === 'entry' && !!collection.bulk_edit;

/**
 * Get the fields of an entry collection that can be edited in the bulk editor. With the `fields`
 * sub-option, those are the listed fields in the listed order, leaving out any that can’t be edited
 * in bulk, which the configuration parser reports; otherwise, every eligible field in the
 * configured order.
 * @param {InternalEntryCollection | undefined} collection Entry collection.
 * @returns {Field[]} Fields. Empty if the bulk editor is not enabled.
 */
export const getBulkEditableFields = (collection) => {
  if (!collection || !isBulkEditEnabled(collection)) {
    return [];
  }

  const { bulk_edit: options } = collection;
  const names = isObject(options) && Array.isArray(options.fields) ? options.fields : undefined;

  const fields = names
    ? names.map((name) => collection.fields.find((field) => field.name === name))
    : collection.fields;

  return /** @type {Field[]} */ (fields.filter((field) => !!field && isBulkEditableField(field)));
};
