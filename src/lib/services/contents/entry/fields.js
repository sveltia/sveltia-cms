import { isObject } from '@sveltia/utils/object';

import { customFieldTypeRegistry } from '$lib/services/api/registries';
import { getCollection } from '$lib/services/contents/collection';
import { getIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { getListItemKeys } from '$lib/services/contents/entry/key-paths';
import { getSubtree } from '$lib/services/contents/entry/subtree';
import {
  BUILTIN_FIELD_TYPES,
  MEDIA_FIELD_TYPES,
  MULTI_VALUE_FIELD_TYPES,
} from '$lib/services/contents/fields';
import { getComponentDef } from '$lib/services/contents/fields/rich-text/components/definitions';
import { isMultiple } from '$lib/services/integrations/media-libraries/multiple';
import { isNumeric } from '$lib/services/utils/number';

/**
 * @import {
 * FlattenedEntryContent,
 * GetFieldArgs,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * TypedFieldKeyPath,
 * } from '$lib/types/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * FieldWithSubFields,
 * FieldWithTypes,
 * ListFieldWithSubField,
 * MediaField,
 * MultiValueField,
 * ObjectFieldWithSubFields,
 * } from '$lib/types/public';
 */

const TYPE_MATCH_REGEX = /^(.*?)<([^>]+)>(.*)$/;

/**
 * Regular expression to match the list key path, e.g. `field.0`, `field.1`, etc.
 * @type {RegExp}
 */
export const LIST_KEY_PATH_REGEX = /\.\d+$/;

/**
 * @type {Map<string, Field | undefined>}
 */
export const fieldConfigCacheMap = new Map();

/**
 * Check if the given fields contain a single List or KeyValue field with the `root` option enabled.
 * @param {Field[]} fields Field list.
 * @param {'list' | 'keyvalue'} fieldType Field type to check.
 * @returns {boolean} Result.
 */
export const hasRootField = (fields, fieldType) => {
  if (fields.length !== 1) {
    return false;
  }

  const [field] = fields;

  return field.widget === fieldType && 'root' in field && field.root === true;
};

/**
 * Check if multi selection is enabled for the given field configuration.
 * @param {Field} fieldConfig Field configuration.
 * @returns {boolean} Result.
 */
export const isFieldMultiple = (fieldConfig) => {
  const fieldType = fieldConfig.widget ?? 'string';

  if (MEDIA_FIELD_TYPES.includes(fieldType)) {
    return isMultiple(/** @type {MediaField} */ (fieldConfig));
  }

  if (MULTI_VALUE_FIELD_TYPES.includes(fieldType)) {
    return !!(/** @type {MultiValueField} */ (fieldConfig).multiple);
  }

  return false;
};

/**
 * Extract explicit type from a key segment with syntax like `<typeName>` or `*<typeName>`.
 * @param {string} key The key segment to parse.
 * @returns {{ cleanKey: string; typeName?: string }} Object with cleaned key and optional type.
 */
const parseExplicitType = (key) => {
  // Match patterns like "*<type>", "<type>", or "0<type>" or "fieldName<type>"
  const match = key.match(TYPE_MATCH_REGEX);

  if (!match) {
    return { cleanKey: key };
  }

  const [, prefix, typeName, suffix] = match;

  // If there’s content after the closing bracket, it’s malformed
  if (suffix) {
    return { cleanKey: key };
  }

  // Return the prefix (which might be *, a number, or field name) and the type
  return { cleanKey: prefix || '', typeName };
};

/**
 * Advance the field traversal by one key-path segment.
 * @param {object} args Arguments.
 * @param {Field} args.field The current (parent) field being traversed.
 * @param {string} args.key Raw key-path segment (may contain `<typeName>` syntax).
 * @param {string[]} args.keyPathArray Full split key path.
 * @param {number} args.segmentIndex Index of the current segment in {@link keyPathArray}.
 * @param {string | undefined} args.pendingExplicitType Accumulated explicit type from a prior
 * segment.
 * @param {FlattenedEntryContent} args.valueMap Entry values (for variable-type lookup).
 * @returns {{ field: Field | undefined, explicitType: string | undefined }} The resolved child
 * field and updated explicit type.
 */
const resolveNextSegment = ({
  field,
  key,
  keyPathArray,
  segmentIndex,
  pendingExplicitType,
  valueMap,
}) => {
  const { cleanKey, typeName } = parseExplicitType(key);
  const { widget: fieldType = 'text' } = field;
  const explicitType = typeName != null ? typeName : pendingExplicitType;
  const isNumericKey = isNumeric(cleanKey);
  const isWildcardKey = cleanKey === '*';

  // Handle multi-value field types with numeric keys, e.g. `authors.0`
  if ((isNumericKey || isWildcardKey) && MULTI_VALUE_FIELD_TYPES.includes(fieldType)) {
    // For single value field, numeric access is not allowed
    return { field: isFieldMultiple(field) ? field : undefined, explicitType };
  }

  const { field: subField } = /** @type {ListFieldWithSubField} */ (field);
  const { fields: subFields } = /** @type {FieldWithSubFields} */ (field);
  const { types, typeKey = 'type' } = /** @type {FieldWithTypes} */ (field);

  if (subField) {
    const subFieldName = isNumericKey || isWildcardKey ? keyPathArray[segmentIndex + 1] : undefined;

    // It’s possible to get a single-subfield List field with or without a subfield name (e.g.
    // `image.0` or `image.0.src`), but when a subfield name is specified, check if it’s valid.
    // The field could be nested (object inside object), so check recursively.
    const validSubField =
      !subFieldName ||
      subField.name === subFieldName ||
      (subField.widget === 'object' &&
        'fields' in subField &&
        /** @type {ObjectFieldWithSubFields} */ (subField).fields?.some(
          (f) => f.name === subFieldName,
        ));

    return { field: validSubField ? subField : undefined, explicitType };
  }

  if (subFields && (isNumericKey || isWildcardKey)) {
    // For list field types with multiple fields, numeric keys (like "0") should be skipped.
    // Keep the current field (the list field type) and continue to the next part of the path.
    return { field, explicitType };
  }

  if (subFields && !isNumericKey && cleanKey !== '') {
    return { field: subFields.find(({ name }) => name === cleanKey), explicitType };
  }

  if (types && (isNumericKey || isWildcardKey)) {
    // List field type variable types - check for explicit type first, then fall back to valueMap
    const resolvedType =
      explicitType ??
      valueMap[[keyPathArray.slice(0, segmentIndex).join('.'), cleanKey, typeKey].join('.')];

    const nextField = /** @type {Field | undefined} */ (
      types.find(({ name }) => name === resolvedType)
    );

    // Clear explicit type after using it for wildcard
    return { field: nextField, explicitType: isWildcardKey ? undefined : explicitType };
  }

  if (types && key !== typeKey && cleanKey !== typeKey && cleanKey !== '') {
    // Object field variable types - check for explicit type first, then fall back to valueMap
    const resolvedType =
      explicitType ?? valueMap[[keyPathArray.slice(0, segmentIndex).join('.'), typeKey].join('.')];

    const nextField = types
      .find(({ name }) => name === resolvedType)
      ?.fields?.find(({ name }) => name === cleanKey);

    // Clear explicit type after using it
    return { field: nextField, explicitType: undefined };
  }

  // If we reach here, the list field is malformed (no `field`, `fields`, or `types`) and
  // we’re trying to access a nested path, so return undefined
  return { field: undefined, explicitType };
};

/**
 * Get a field’s config object that matches the given field name (key path).
 * @param {GetFieldArgs} args Arguments.
 * @returns {Field | undefined} Field configuration.
 */
export const getField = (args) => {
  const {
    collectionName,
    fileName = undefined,
    componentName = undefined,
    valueMap = {},
    keyPath,
    isIndexFile = false,
  } = args;

  const cacheKey = [
    collectionName,
    fileName ?? '',
    componentName ?? '',
    keyPath,
    isIndexFile ? '1' : '0',
  ].join('|');

  if (fieldConfigCacheMap.has(cacheKey)) {
    return fieldConfigCacheMap.get(cacheKey);
  }

  const collection = getCollection(collectionName);

  const collectionFile =
    collection && fileName ? getCollectionFile(collection, fileName) : undefined;

  // For entry collections, `fileName` is ignored and `collectionFile` will be `undefined`
  // Only fail if we explicitly need a file/singleton collection but can’t find the file
  if (!collection || (fileName && collection?._type !== 'entry' && !collectionFile)) {
    fieldConfigCacheMap.set(cacheKey, undefined);

    return undefined;
  }

  const { fields: regularFields = [] } =
    collectionFile ?? /** @type {InternalEntryCollection} */ (collection);

  const indexFile = isIndexFile ? getIndexFile(collection) : undefined;

  const fields = componentName
    ? (getComponentDef(componentName)?.fields ?? [])
    : (indexFile?.fields ?? regularFields);

  const keyPathArray = keyPath.split('.');
  /** @type {Field | undefined} */
  let field;
  /** @type {string | undefined} - Track explicit type for current nesting level */
  let currentExplicitType;
  let hasVariableTypeField = false;

  keyPathArray.forEach((key, index) => {
    if (index === 0) {
      // First, try to parse explicit type from the field name itself (for object fields like
      // "field<button>")
      const { cleanKey, typeName } = parseExplicitType(key);

      field = fields.find(({ name }) => name === cleanKey);

      // If using index file and field not found, try regular fields as fallback
      if (!field && indexFile?.fields) {
        field = regularFields.find(({ name }) => name === cleanKey);
      }

      // Store explicit type for later use
      if (typeName) {
        currentExplicitType = typeName;
      }
    } else if (field) {
      const result = resolveNextSegment({
        field,
        key,
        keyPathArray,
        segmentIndex: index,
        pendingExplicitType: currentExplicitType,
        valueMap,
      });

      field = result.field;
      currentExplicitType = result.explicitType;
    }

    if (field && 'types' in field) {
      hasVariableTypeField = true;
    }
  });

  // If we have an explicit type but haven’t applied it yet (e.g., for "field<button>" with no
  // further navigation), apply it now
  if (currentExplicitType && field && 'types' in field) {
    const { types } = /** @type {FieldWithTypes} */ (field);

    // @ts-ignore
    field = types.find(({ name }) => name === currentExplicitType);
  }

  // Cache the field config if no variable type list/object field is found
  if (!hasVariableTypeField) {
    fieldConfigCacheMap.set(cacheKey, field);
  }

  return field;
};

/**
 * Convert a field key path to the typed key path a field-level asset folder is registered under: a
 * list index becomes `*`, followed by the subfield name in a single-subfield List field, and a
 * variable type is spelled out. The index of a multi-value field, like an Image field with the
 * `multiple` option, is dropped, because the folder belongs to the field itself.
 * @param {GetFieldArgs} args Arguments. A `valueMap` is required to resolve variable types.
 * @returns {TypedFieldKeyPath} Typed key path.
 * @example
 * // A variable type List field, with `valueMap: { 'blocks.0.type': 'image' }`
 * getTypedKeyPath({ collectionName, keyPath: 'blocks.0.src', valueMap })
 * // => 'blocks.*<image>.src'
 * @example
 * // A variable type Object field, with `valueMap: { 'banner.type': 'hero' }`
 * getTypedKeyPath({ collectionName, keyPath: 'banner.src', valueMap })
 * // => 'banner<hero>.src'
 * @example
 * // A single-subfield List field, `field: { name: 'src', widget: 'image' }`
 * getTypedKeyPath({ collectionName, keyPath: 'photos.0' })
 * // => 'photos.*.src'
 * @example
 * // An Image field with the `multiple` option
 * getTypedKeyPath({ collectionName, keyPath: 'images.1' })
 * // => 'images'
 */
export const getTypedKeyPath = ({ keyPath, valueMap = {}, ...args }) => {
  const keyPathArray = keyPath.split('.');

  return keyPathArray
    .map((key, index) => {
      const parentKeyPath = keyPathArray.slice(0, index).join('.');
      const currentKeyPath = index ? `${parentKeyPath}.${key}` : key;

      if (isNumeric(key)) {
        const parentField = getField({ ...args, valueMap, keyPath: parentKeyPath });
        const { widget: parentFieldType = 'text' } = parentField ?? {};

        if (MULTI_VALUE_FIELD_TYPES.includes(parentFieldType)) {
          return undefined;
        }

        const { field: subField } = /** @type {ListFieldWithSubField} */ (parentField ?? {});
        const { types, typeKey = 'type' } = /** @type {FieldWithTypes} */ (parentField ?? {});

        if (subField) {
          return `*.${subField.name}`;
        }

        const type = types ? valueMap[`${currentKeyPath}.${typeKey}`] : undefined;

        return type ? `*<${type}>` : '*';
      }

      const field = getField({ ...args, valueMap, keyPath: currentKeyPath });
      const { types, typeKey = 'type' } = /** @type {FieldWithTypes} */ (field ?? {});

      const type =
        field?.widget === 'object' && types ? valueMap[`${currentKeyPath}.${typeKey}`] : undefined;

      return type ? `${key}<${type}>` : key;
    })
    .filter((segment) => segment !== undefined)
    .join('.');
};

/**
 * Determine the given field’s kind: one of the built-in field types, custom field type or unknown.
 * @param {Field} fieldConfig Field configuration.
 * @returns {'builtin' | 'custom' | 'unknown'} Result.
 */
export const getFieldKind = (fieldConfig) => {
  const fieldType = fieldConfig.widget ?? 'string';

  if (/** @type {string[]} */ (BUILTIN_FIELD_TYPES).includes(fieldType)) {
    return 'builtin';
  }

  if (customFieldTypeRegistry.has(fieldType)) {
    return 'custom';
  }

  return 'unknown';
};

/**
 * Check if the field requires data input (and data output if the `omit_empty_optional_fields`
 * option is `true`).
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {InternalLocaleCode} args.locale Current pane’s locale.
 * @returns {boolean} Result.
 */
// @ts-ignore Hidden field doesn’t have `required` property
export const isFieldRequired = ({ fieldConfig: { required = true }, locale }) =>
  Array.isArray(required) ? required.includes(locale) : !!required;

/**
 * Get the current value of a field, taking into account whether it’s a single or multi-value field.
 * Our internal representation of multi-value fields is a flattened object, so we need to gather all
 * the values for a given key path into an array.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.valueMap Flattened entry content.
 * @param {FieldKeyPath} args.keyPath Key path of the field.
 * @param {boolean} args.isList Whether the field is a list field.
 * @param {boolean} [args.isCustomFieldType] Whether the field is a custom field type. It may have
 * arbitrary data structures, so we can’t assume they are multi-value fields.
 * @returns {any} Current value of the field. For multi-value fields, returns an array of values;
 * for single-value fields, returns the value directly.
 */
export const getCurrentValue = ({ valueMap, keyPath, isList, isCustomFieldType = false }) => {
  const value = valueMap[keyPath];

  // Single value field: custom field requires the list check below as we don’t know the shape
  if (!isList && !isCustomFieldType) {
    // An object field stores an empty object placeholder at its own key path
    return isObject(value) ? (getSubtree(valueMap, keyPath) ?? value) : value;
  }

  // Multiple values are flattened in the value map object
  const itemKeys = getListItemKeys(valueMap, keyPath);

  // Multi-value field
  if (itemKeys.length) {
    return itemKeys.map((key) => valueMap[key]).filter((val) => val !== undefined);
  }

  // Single value custom field: an object value is stored under its child key paths, and the
  // placeholder at the field’s own key path can be missing, since `flatten()` doesn’t write one
  // when an entry is loaded or a list item is manipulated. Assemble the value from the children
  // either way rather than handing the control nothing
  // @see https://github.com/sveltia/sveltia-cms/issues/969
  if (isCustomFieldType) {
    return value === undefined || isObject(value)
      ? (getSubtree(valueMap, keyPath) ?? value)
      : value;
  }

  return [];
};
