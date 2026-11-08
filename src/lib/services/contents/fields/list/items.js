import { isObject } from '@sveltia/utils/object';

import {
  getRenewedUniqueValue,
  UNIQUE_VALUE_FIELD_TYPES,
} from '$lib/services/contents/draft/create/unique-values';
import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import { getInitialExpanderState } from '$lib/services/contents/editor/fields';
import { tagListItems } from '$lib/services/contents/fields/list/helpers';
import { getValueSubFields, mapSubValues } from '$lib/services/contents/fields/list/subfields';
import { getOrCreate } from '$lib/services/utils/cache';
import { unflattenKeys } from '$lib/services/utils/object';

/**
 * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * VariableFieldType,
 * } from '$lib/types/public';
 */

/**
 * New values given to the fields of a duplicated item, keyed by the field configuration and the
 * source item’s value, serialized as JSON.
 * @typedef {Map<Field, Map<string | undefined, any>>} RenewedValueMap
 */

/**
 * @typedef {object} RenewContext
 * @property {RenewedValueMap} renewedValues New values given to the fields of a duplicated item.
 * @property {InternalLocaleCode} locale Locale code.
 * @property {InternalLocaleCode} defaultLocale Default locale code.
 */

/**
 * Renew the unique values in the given field value of a duplicated list item, so the duplicate
 * doesn’t share them with its source, just like a duplicated entry. See
 * {@link getRenewedUniqueValue}. Object and List fields are walked down, and an object value is
 * modified in place.
 * @param {any} value Field value.
 * @param {Field} fieldConfig Field configuration.
 * @param {RenewContext} context Context.
 * @returns {any} Renewed value.
 */
const renewUniqueValue = (value, fieldConfig, context) => {
  const { widget: fieldType = 'string' } = fieldConfig;

  if (fieldType !== 'object' && fieldType !== 'list') {
    if (!UNIQUE_VALUE_FIELD_TYPES.includes(fieldType)) {
      return value;
    }

    // A value duplicated across the locales gets the same new one in each, while a translatable
    // one, which differs between the locales, gets one per locale
    const renewed = getOrCreate(
      getOrCreate(context.renewedValues, fieldConfig, () => new Map()),
      JSON.stringify(value),
      () => getRenewedUniqueValue({ ...context, fieldConfig, keyPath: fieldConfig.name, value }),
    );

    // An object or array, like a Hidden field’s default, is copied so the locales don’t share it
    return typeof renewed === 'object' && renewed !== null ? structuredClone(renewed) : renewed;
  }

  return mapSubValues(
    value,
    fieldConfig,
    (obj, fields) => {
      if (isObject(obj)) {
        // eslint-disable-next-line no-use-before-define
        renewUniqueValues(obj, fields, context);
      }

      return obj;
    },
    (item, field) => renewUniqueValue(item, field, context),
  );
};

/**
 * Renew the unique values in the given object, a duplicated list item or an Object field value, in
 * place. See {@link renewUniqueValue}.
 * @param {Record<string, any>} obj Object.
 * @param {Field[]} fields Subfields of the object.
 * @param {RenewContext} context Context.
 */
const renewUniqueValues = (obj, fields, context) => {
  fields.forEach((fieldConfig) => {
    const { name } = fieldConfig;

    if (name in obj) {
      obj[name] = renewUniqueValue(obj[name], fieldConfig, context);
    }
  });
};

/**
 * Remove the original key paths of the given duplicated list item and the items of the lists
 * nested in it, in place. A duplicated or pasted item is a new one, so it mustn’t keep the original
 * positions of its source, or a revert would treat it as the source item.
 * @param {any} value Item or a value in it.
 */
const removeOriginalKeyPaths = (value) => {
  if (Array.isArray(value)) {
    value.forEach(removeOriginalKeyPaths);
  } else if (isObject(value)) {
    delete value.__sc_item_original_key_path;
    Object.values(value).forEach(removeOriginalKeyPaths);
  }
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
 * Create an item to be added to a List field with subfield(s): a copy of an existing item or a
 * pasted one, or a new one filled with the default values.
 * @param {object} args Arguments.
 * @param {any[]} args.valueList Current items of the list. Unless the list has a single subfield,
 * the items are tagged with their original key paths in place, as they’re about to shift.
 * @param {FieldKeyPath} args.keyPath Key path of the list.
 * @param {number} [args.dupIndex] List index of the item to be duplicated, if any. If the list has
 * no item there, e.g. in another locale whose items don’t line up with the default locale’s, a new
 * item is created instead.
 * @param {any} [args.sourceItem] Item to be copied instead, e.g. one pasted from the clipboard,
 * conformed to the subfields.
 * @param {Field[]} args.subFields Subfields of the new item, used to fill in the default values.
 * @param {boolean} args.hasSingleSubField Whether the list has a single subfield, in which case the
 * items are the subfield values themselves rather than objects.
 * @param {Field} [args.field] Single subfield of the list, if any.
 * @param {string} [args.type] Variable type name of the new item, if the list has variable types.
 * @param {VariableFieldType[]} [args.types] Variable types of the list, if any, used to find the
 * subfields of a duplicated item.
 * @param {string} args.typeKey Property name holding the variable type name.
 * @param {RenewedValueMap} [args.renewedValues] New unique values given to a duplicated item, such
 * as UUIDs. An item is duplicated in every locale the list is written to, one call each, so pass
 * the same map to all of them: a value duplicated across the locales then gets the same new one in
 * each, while a translatable one, which differs between the locales, gets one per locale.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {InternalLocaleCode} args.defaultLocale Default locale code.
 * @returns {any} New item.
 */
export const createListItem = ({
  valueList,
  keyPath,
  dupIndex,
  sourceItem,
  subFields,
  hasSingleSubField,
  field,
  type,
  types,
  typeKey,
  renewedValues = new Map(),
  locale,
  defaultLocale,
}) => {
  const newItem = (() => {
    const context = { renewedValues, locale, defaultLocale };
    const isDuplicate = typeof dupIndex === 'number' && dupIndex in valueList;

    if (sourceItem !== undefined || isDuplicate) {
      const item = structuredClone(isDuplicate ? valueList[dupIndex] : sourceItem);

      removeOriginalKeyPaths(item);

      if (hasSingleSubField && field) {
        return renewUniqueValue(item, field, context);
      }

      if (isObject(item)) {
        renewUniqueValues(
          item,
          getValueSubFields({ value: item, fields: types ? undefined : subFields, types, typeKey }),
          context,
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

    // Track original key paths for existing items before they shift due to the insertion
    tagListItems(valueList, keyPath);
  }

  return newItem;
};
