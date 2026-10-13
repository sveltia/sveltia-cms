import { isObject } from '@sveltia/utils/object';

import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import { getInitialExpanderState } from '$lib/services/contents/editor/fields';
import { hasUuidTag } from '$lib/services/contents/fields/compute/helpers';
import { tagListItems } from '$lib/services/contents/fields/list/helpers';
import { getInitialValue as getInitialUuidValue } from '$lib/services/contents/fields/uuid/helpers';
import { getOrCreate } from '$lib/services/utils/cache';
import { unflattenKeys } from '$lib/services/utils/object';

/**
 * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import {
 * ComputeField,
 * Field,
 * FieldKeyPath,
 * ListFieldWithSubField,
 * ListFieldWithSubFields,
 * ListFieldWithTypes,
 * UuidField,
 * VariableFieldType,
 * } from '$lib/types/public';
 */

/**
 * Get the subfields of an Object field value or a list item, resolving the variable type against
 * the type name stored in the value.
 * @param {object} args Arguments.
 * @param {Record<string, any>} args.value Object value.
 * @param {Field[]} [args.fields] Subfields, if the field has them.
 * @param {VariableFieldType[]} [args.types] Variable types, if the field has them.
 * @param {string} [args.typeKey] Property name holding the variable type name.
 * @returns {Field[]} Subfields.
 */
const getValueSubFields = ({ value, fields, types, typeKey = 'type' }) =>
  fields ?? types?.find(({ name }) => name === value[typeKey])?.fields ?? [];

/**
 * Renew the unique values in the given field value of a duplicated list item, so the duplicate
 * doesn’t share them with its source, just like a duplicated entry: a UUID field gets a new UUID,
 * and a Compute field with a UUID tag is cleared so it’s resolved with new UUIDs. Object and List
 * fields are walked down, and an object or array value is modified in place.
 * @param {any} value Field value.
 * @param {Field} fieldConfig Field configuration.
 * @param {Map<string, string>} renewedUuids New UUIDs keyed by the source item’s UUIDs.
 * @returns {any} Renewed value.
 */
const renewUniqueValue = (value, fieldConfig, renewedUuids) => {
  const { widget: fieldType = 'string' } = fieldConfig;

  if (fieldType === 'uuid') {
    // An empty value is filled in by the field editor, as with a new item
    return typeof value === 'string' && value
      ? getOrCreate(renewedUuids, value, () =>
          getInitialUuidValue(/** @type {UuidField} */ (fieldConfig)),
        )
      : value;
  }

  if (fieldType === 'compute') {
    return hasUuidTag(/** @type {ComputeField} */ (fieldConfig).value) ? '' : value;
  }

  if (fieldType !== 'object' && fieldType !== 'list') {
    return value;
  }

  const { field } = /** @type {ListFieldWithSubField} */ (fieldConfig);
  const { fields } = /** @type {ListFieldWithSubFields} */ (fieldConfig);
  const { types, typeKey } = /** @type {ListFieldWithTypes} */ (fieldConfig);

  /**
   * Renew the unique values in the given object.
   * @param {any} obj Object value or list item.
   */
  const renewObject = (obj) => {
    if (isObject(obj)) {
      // eslint-disable-next-line no-use-before-define
      renewUniqueValues(
        obj,
        getValueSubFields({ value: obj, fields, types, typeKey }),
        renewedUuids,
      );
    }
  };

  if (fieldType === 'object') {
    renewObject(value);
  } else if (Array.isArray(value)) {
    if (field) {
      value.forEach((item, index) => {
        value[index] = renewUniqueValue(item, field, renewedUuids);
      });
    } else {
      value.forEach(renewObject);
    }
  }

  return value;
};

/**
 * Renew the unique values in the given object, a duplicated list item or an Object field value, in
 * place. See {@link renewUniqueValue}.
 * @param {Record<string, any>} obj Object.
 * @param {Field[]} fields Subfields of the object.
 * @param {Map<string, string>} renewedUuids New UUIDs keyed by the source item’s UUIDs.
 */
const renewUniqueValues = (obj, fields, renewedUuids) => {
  fields.forEach((fieldConfig) => {
    const { name } = fieldConfig;

    if (name in obj) {
      obj[name] = renewUniqueValue(obj[name], fieldConfig, renewedUuids);
    }
  });
};

/**
 * Get the initial expander states of a List field with subfield(s) and its items.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {FieldKeyPath} args.keyPath Key path of the list.
 * @param {number} args.itemCount Number of items in the list.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {boolean | 'auto'} [args.collapsed] The `collapsed` option of the field, which applies to
 * the items.
 * @param {boolean | 'auto'} [args.minimizeCollapsed] The `minimize_collapsed` option of the field,
 * which applies to the list itself. With `auto`, an empty list is expanded.
 * @returns {Record<string, boolean>} Map of key path and state. The list itself is keyed by its key
 * path with the `#` suffix.
 */
export const getInitialListExpanderStates = ({
  draft,
  keyPath,
  itemCount,
  locale,
  collapsed,
  minimizeCollapsed = false,
}) => ({
  [`${keyPath}#`]: minimizeCollapsed === 'auto' ? !itemCount : !minimizeCollapsed,
  ...Object.fromEntries(
    Array.from({ length: itemCount }, (__, index) => {
      const key = `${keyPath}.${index}`;

      return [key, getInitialExpanderState({ draft, key, locale, collapsed })];
    }),
  ),
});

/**
 * Create an item to be added to a List field with subfield(s): a copy of an existing item, or a new
 * one filled with the default values.
 * @param {object} args Arguments.
 * @param {any[]} args.valueList Current items of the list. Unless the list has a single subfield,
 * the items are tagged with their original key paths in place, as they’re about to shift.
 * @param {FieldKeyPath} args.keyPath Key path of the list.
 * @param {number} [args.dupIndex] List index of the item to be duplicated, if any. If the list has
 * no item there, e.g. in another locale whose items don’t line up with the default locale’s, a new
 * item is created instead.
 * @param {Field[]} args.subFields Subfields of the new item, used to fill in the default values.
 * @param {boolean} args.hasSingleSubField Whether the list has a single subfield, in which case the
 * items are the subfield values themselves rather than objects.
 * @param {Field} [args.field] Single subfield of the list, if any.
 * @param {string} [args.type] Variable type name of the new item, if the list has variable types.
 * @param {VariableFieldType[]} [args.types] Variable types of the list, if any, used to find the
 * subfields of a duplicated item.
 * @param {string} args.typeKey Property name holding the variable type name.
 * @param {Map<string, string>} [args.renewedUuids] New UUIDs given to a duplicated item, keyed
 * by the source item’s UUIDs. An item is duplicated in every locale the list is written to, one
 * call each, so pass the same map to all of them: a UUID duplicated across the locales then gets
 * the same new one in each, while a translatable one, which differs between the locales, gets one
 * per locale.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {InternalLocaleCode} args.defaultLocale Default locale code.
 * @returns {any} New item.
 */
export const createListItem = ({
  valueList,
  keyPath,
  dupIndex,
  subFields,
  hasSingleSubField,
  field,
  type,
  types,
  typeKey,
  renewedUuids = new Map(),
  locale,
  defaultLocale,
}) => {
  const newItem = (() => {
    if (typeof dupIndex === 'number' && dupIndex in valueList) {
      const item = structuredClone(valueList[dupIndex]);

      if (hasSingleSubField && field) {
        return renewUniqueValue(item, field, renewedUuids);
      }

      if (isObject(item)) {
        renewUniqueValues(
          item,
          getValueSubFields({ value: item, fields: types ? undefined : subFields, types, typeKey }),
          renewedUuids,
        );
      }

      return item;
    }

    const item = unflattenKeys(getDefaultValues({ fields: subFields, locale, defaultLocale }));

    return hasSingleSubField && field ? item[field.name] : item;
  })();

  if (type) {
    newItem[typeKey] = type;
  }

  if (!hasSingleSubField) {
    // Add a random ID to the new item to ensure it is unique. This is necessary for the `key`
    // attribute in the `each` block.
    newItem.__sc_item_id = crypto.randomUUID();
    // A duplicated item is a new one, so it mustn’t keep the original position of its source, or a
    // revert would treat it as the source item
    delete newItem.__sc_item_original_key_path;

    // Track original key paths for existing items before they shift due to the insertion
    tagListItems(valueList, keyPath);
  }

  return newItem;
};
