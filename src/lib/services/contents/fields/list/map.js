import { isObject } from '@sveltia/utils/object';

import { getField } from '$lib/services/contents/entry/fields';
import { isNumeric } from '$lib/services/utils/number';

/**
 * @import { FlattenedEntryContent, GetFieldArgs } from '$lib/types/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * ListFieldWithSubFields,
 * ListFieldWithTypes,
 * RawEntryContent,
 * VariableFieldType,
 * } from '$lib/types/public';
 */

/**
 * Regular expression matching a canonical array index, which a JavaScript object enumerates before
 * any other key, in ascending order, whatever order it was added in. Larger numbers are ordinary
 * keys, see {@link isArrayIndexKey}.
 */
const ARRAY_INDEX_REGEX = /^(?:0|[1-9]\d*)$/;
/**
 * Regular expression matching the key path of a subfield of a List field item, e.g.
 * `references.0.key`, capturing the list’s key path and the subfield name.
 */
const ITEM_SUBFIELD_KEY_PATH_REGEX = /^(.+)\.\d+\.([^.]+)$/;

/**
 * Get the name of the subfield whose value becomes the key of each item of the given field, if
 * it’s a List field with subfields or variable types stored as a map with the `map_key_field`
 * option.
 * @param {Field} fieldConfig Field configuration.
 * @returns {string | undefined} Subfield name.
 * @see https://github.com/sveltia/sveltia-cms/issues/1077
 */
export const getMapKeyField = (fieldConfig) => {
  if (fieldConfig.widget !== 'list' || !('fields' in fieldConfig || 'types' in fieldConfig)) {
    return undefined;
  }

  const { map_key_field: keyField } = /** @type {ListFieldWithSubFields | ListFieldWithTypes} */ (
    fieldConfig
  );

  return typeof keyField === 'string' && keyField ? keyField : undefined;
};

/**
 * Check if the given map key is a canonical array index, which a JavaScript object, and therefore
 * every parsed file, moves to the front of the map, so the items wouldn’t keep their order.
 * @param {string} key Map key.
 * @returns {boolean} Result.
 */
export const isArrayIndexKey = (key) => ARRAY_INDEX_REGEX.test(key) && Number(key) < 2 ** 32 - 1;

/**
 * Convert a map of keys to items, as stored in a file, to the list items the editor works with,
 * adding each key to its item as the given subfield. An array, e.g. a list saved before the option
 * was added, is returned as is, and so is anything else that isn’t a map of objects, which the List
 * field can’t edit either way.
 * @param {any} value Stored value.
 * @param {string} keyField Name of the subfield holding the key.
 * @returns {any} List items, or the value as is.
 */
export const mapToItems = (value, keyField) => {
  if (!isObject(value) || !Object.values(value).every((item) => item === null || isObject(item))) {
    return value;
  }

  // The map key wins over a property of the same name, which can’t be saved anyway
  return Object.entries(value).map(([key, item]) => ({ ...item, [keyField]: key }));
};

/**
 * Convert list items to a map of keys to items for the file, taking each key from the given
 * subfield, which is left out of the item. Anything other than an array is returned as is.
 * @param {any} value List items.
 * @param {string} keyField Name of the subfield holding the key.
 * @returns {any} Map, or the value as is.
 */
export const itemsToMap = (value, keyField) => {
  if (!Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    value.map((item) => {
      const { [keyField]: key = '', ...rest } = isObject(item) ? item : {};

      return [String(key), rest];
    }),
  );
};

/**
 * Get the subfields of an Object field value or a List field item, which depend on the variable
 * type of the value if the field has the `types` option.
 * @param {any} value Value.
 * @param {Field} fieldConfig Field configuration.
 * @returns {Field[]} Subfields.
 */
const getValueSubFields = (value, fieldConfig) => {
  const {
    fields,
    types,
    typeKey = 'type',
  } = /** @type {{ fields?: Field[], types?: VariableFieldType[], typeKey?: string }} */ (
    fieldConfig
  );

  if (fields) {
    return fields;
  }

  return types?.find(({ name }) => name === value?.[typeKey])?.fields ?? [];
};

/**
 * Cache of whether a field is, or contains at any depth, a List field stored as a map.
 * @type {WeakMap<Field, boolean>}
 */
const mapListCache = new WeakMap();

/**
 * Check whether the given field is, or contains at any depth, a List field with the
 * `map_key_field` option, so content without any can skip the conversion entirely.
 * @param {Field} fieldConfig Field configuration.
 * @returns {boolean} Result.
 */
const hasMapList = (fieldConfig) => {
  let result = mapListCache.get(fieldConfig);

  if (result === undefined) {
    const {
      field,
      fields = [],
      types = [],
    } = /** @type {{ field?: Field, fields?: Field[], types?: VariableFieldType[] }} */ (
      fieldConfig
    );

    result =
      !!getMapKeyField(fieldConfig) ||
      [...(field ? [field] : []), ...fields, ...types.flatMap((type) => type.fields ?? [])].some(
        hasMapList,
      );

    mapListCache.set(fieldConfig, result);
  }

  return result;
};

/**
 * Convert the keyed List fields in the given value of a field, at any depth.
 * @param {any} value Field value.
 * @param {Field} fieldConfig Field configuration.
 * @param {boolean} toItems Whether to convert maps to list items, as when a file is loaded, rather
 * than list items to maps, as when it’s saved.
 * @returns {any} Converted value. It’s the same value if nothing has changed.
 */
const convertValue = (value, fieldConfig, toItems) => {
  const { widget: fieldType = 'string' } = fieldConfig;

  if (!hasMapList(fieldConfig)) {
    return value;
  }

  if (fieldType === 'object') {
    // eslint-disable-next-line no-use-before-define
    return convertMapLists(value, getValueSubFields(value, fieldConfig), toItems);
  }

  if (fieldType !== 'list') {
    return value;
  }

  const keyField = getMapKeyField(fieldConfig);
  const { field: subField } = /** @type {{ field?: Field }} */ (fieldConfig);
  let converted = keyField && toItems ? mapToItems(value, keyField) : value;

  if (Array.isArray(converted)) {
    const items = converted.map((item) =>
      subField
        ? convertValue(item, subField, toItems)
        : // eslint-disable-next-line no-use-before-define
          convertMapLists(item, getValueSubFields(item, fieldConfig), toItems),
    );

    if (items.some((item, index) => item !== /** @type {any[]} */ (converted)[index])) {
      converted = items;
    }
  }

  return keyField && !toItems ? itemsToMap(converted, keyField) : converted;
};

/**
 * Convert the List fields with the `map_key_field` option in the given content, at any depth: a
 * map of keys to items, as stored in a file, to the list items the editor works with, or the other
 * way around. The content isn’t modified; an object is copied only if something in it changes.
 * @param {RawEntryContent} content Unflattened entry content.
 * @param {Field[]} fields Fields the content is made of.
 * @param {boolean} toItems Whether to convert maps to list items, as when a file is loaded, rather
 * than list items to maps, as when it’s saved.
 * @returns {RawEntryContent} Converted content.
 * @see https://github.com/sveltia/sveltia-cms/issues/1077
 */
export const convertMapLists = (content, fields, toItems) => {
  if (!isObject(content)) {
    return content;
  }

  /** @type {RawEntryContent} */
  let result = content;

  fields.forEach((fieldConfig) => {
    const { name } = fieldConfig;

    if (!Object.hasOwn(content, name)) {
      return;
    }

    const value = convertValue(content[name], fieldConfig, toItems);

    if (value !== content[name]) {
      if (result === content) {
        result = { ...content };
      }

      result[name] = value;
    }
  });

  return result;
};

/**
 * Get the List field the given key path is the key subfield of, if any, e.g. `references` for
 * `references.0.key` when the list has `map_key_field: key`.
 * @param {GetFieldArgs} getFieldArgs Arguments for {@link getField}, with the key path of the
 * subfield.
 * @returns {{ listKeyPath: FieldKeyPath, keyField: string } | undefined} The list’s key path and
 * the subfield name, or `undefined` if the key path isn’t a key subfield.
 */
export const getMapKeyInfo = (getFieldArgs) => {
  // A List field in a rich text editor component is saved with the component, not as a map
  if (getFieldArgs.componentName) {
    return undefined;
  }

  const [, listKeyPath, name] = getFieldArgs.keyPath.match(ITEM_SUBFIELD_KEY_PATH_REGEX) ?? [];

  if (!listKeyPath) {
    return undefined;
  }

  const listField = getField({ ...getFieldArgs, keyPath: listKeyPath });

  if (!listField || getMapKeyField(listField) !== name) {
    return undefined;
  }

  return { listKeyPath, keyField: name };
};

/**
 * Get the key paths of the key subfield of every item of a keyed List field, e.g.
 * `references.0.key`, `references.1.key` and so on.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.valueMap Entry values.
 * @param {FieldKeyPath} args.listKeyPath Key path of the list.
 * @param {string} args.keyField Name of the key subfield.
 * @returns {FieldKeyPath[]} Key paths.
 */
export const getMapKeyPaths = ({ valueMap, listKeyPath, keyField }) => {
  const prefix = `${listKeyPath}.`;
  const suffix = `.${keyField}`;

  // This runs as the user types a key, so the cheap string tests are done first
  return Object.keys(valueMap).filter(
    (keyPath) =>
      keyPath.startsWith(prefix) &&
      keyPath.endsWith(suffix) &&
      isNumeric(keyPath.slice(prefix.length, -suffix.length)),
  );
};

/**
 * Check whether another item of the same keyed List field has the same key.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.valueMap Entry values.
 * @param {FieldKeyPath} args.keyPath Key path of the key subfield being checked.
 * @param {FieldKeyPath} args.listKeyPath Key path of the list.
 * @param {string} args.keyField Name of the key subfield.
 * @param {any} args.value Key.
 * @returns {boolean} Result.
 */
export const isMapKeyTaken = ({ valueMap, keyPath, listKeyPath, keyField, value }) =>
  getMapKeyPaths({ valueMap, listKeyPath, keyField }).some(
    (otherKeyPath) =>
      otherKeyPath !== keyPath &&
      valueMap[otherKeyPath] !== undefined &&
      valueMap[otherKeyPath] !== null &&
      String(valueMap[otherKeyPath]) === String(value),
  );
