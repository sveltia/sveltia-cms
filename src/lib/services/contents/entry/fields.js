import { escapeRegExp } from '@sveltia/utils/string';

import {
  applyTransformations,
  DATE_TRANSFORMATION_REGEX,
} from '$lib/services/common/transformations';
import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { getIndexFile, isCollectionIndexFile } from '$lib/services/contents/collection/index-file';
import { MEDIA_FIELD_TYPES, MULTI_VALUE_FIELD_TYPES } from '$lib/services/contents/fields';
import { getDateTimeFieldDisplayValue } from '$lib/services/contents/fields/date-time/helper';
import { getComponentDef } from '$lib/services/contents/fields/markdown/components/definitions';
import { getReferencedOptionLabel } from '$lib/services/contents/fields/relation/helper';
import { getOptionLabel } from '$lib/services/contents/fields/select/helper';
import { getCanonicalLocale, getListFormatter } from '$lib/services/contents/i18n';
import { isMultiple } from '$lib/services/integrations/media-libraries/shared';

/**
 * @import {
 * Entry,
 * FlattenedEntryContent,
 * GetFieldArgs,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import {
 * DateTimeField,
 * Field,
 * FieldKeyPath,
 * FieldWithSubFields,
 * FieldWithTypes,
 * ListFieldWithSubField,
 * ListFieldWithSubFields,
 * ListFieldWithTypes,
 * MediaField,
 * MultiValueField,
 * NumberField,
 * ObjectFieldWithSubFields,
 * RelationField,
 * SelectField,
 * } from '$lib/types/public';
 */

/**
 * @type {Map<string, Field | undefined>}
 */
export const fieldConfigCacheMap = new Map();

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
  const match = key.match(/^(.*?)<([^>]+)>(.*)$/);

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
 * Get a field’s config object that matches the given field name (key path).
 * @param {GetFieldArgs} args Arguments.
 * @returns {Field | undefined} Field configuration.
 */
export const getField = (args) => {
  const cacheKey = JSON.stringify(args);

  if (fieldConfigCacheMap.has(cacheKey)) {
    return fieldConfigCacheMap.get(cacheKey);
  }

  const {
    collectionName,
    fileName = undefined,
    componentName = undefined,
    valueMap = {},
    keyPath,
    isIndexFile = false,
  } = args;

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
      const { cleanKey, typeName } = parseExplicitType(key);
      const { widget: fieldType = 'text' } = field;

      // Update explicit type if provided in this segment
      if (typeName) {
        currentExplicitType = typeName;
      }

      const isNumericKey = /^\d+$/.test(cleanKey);
      const isWildcardKey = cleanKey === '*';

      // Handle multi-value field types with numeric keys, e.g. `authors.0`
      if ((isNumericKey || isWildcardKey) && MULTI_VALUE_FIELD_TYPES.includes(fieldType)) {
        // For single value field, numeric access is not allowed
        if (!isFieldMultiple(field)) {
          field = undefined;
        }

        return;
      }

      const { field: subField } = /** @type {ListFieldWithSubField} */ (field);
      const { fields: subFields } = /** @type {FieldWithSubFields} */ (field);
      const { types, typeKey = 'type' } = /** @type {FieldWithTypes} */ (field);

      // Handle all other field types (List, Object, etc.)
      if (subField) {
        const subFieldName = isNumericKey || isWildcardKey ? keyPathArray[index + 1] : undefined;

        // It’s possible to get a single-subfield List field with or without a subfield name (e.g.
        // `image.0` or `image.0.src`), but when a subfield name is specified, check if it’s valid.
        // The field could be nested (object inside object), so check recursively.
        if (
          !subFieldName ||
          subField.name === subFieldName ||
          (subField.widget === 'object' &&
            'fields' in subField &&
            /** @type {ObjectFieldWithSubFields} */ (subField).fields?.some(
              (f) => f.name === subFieldName,
            ))
        ) {
          field = subField;
        } else {
          field = undefined;
        }
      } else if (subFields && (isNumericKey || isWildcardKey)) {
        // For list field types with multiple fields, numeric keys (like "0") should be skipped.
        // Keep the current field (the list field type) and continue to the next part of the path
        // field remains unchanged.
      } else if (subFields && !isNumericKey && cleanKey !== '') {
        field = subFields.find(({ name }) => name === cleanKey);
      } else if (types && (isNumericKey || isWildcardKey)) {
        // List field type variable types - check for explicit type first, then fall back to
        // valueMap
        const resolvedType =
          currentExplicitType ??
          valueMap[[keyPathArray.slice(0, index).join('.'), cleanKey, typeKey].join('.')];

        // @ts-ignore
        field = types.find(({ name }) => name === resolvedType);

        // Clear explicit type after using it
        if (isWildcardKey) {
          currentExplicitType = undefined;
        }
      } else if (types && key !== typeKey && cleanKey !== typeKey && cleanKey !== '') {
        // Object field variable types - check for explicit type first, then fall back to valueMap
        const resolvedType =
          currentExplicitType ??
          valueMap[[keyPathArray.slice(0, index).join('.'), typeKey].join('.')];

        field = types
          .find(({ name }) => name === resolvedType)
          ?.fields?.find(({ name }) => name === cleanKey);

        // Clear explicit type after using it
        if (currentExplicitType) {
          currentExplicitType = undefined;
        }
      } else {
        // If we reach here, the list field is malformed (no `field`, `fields`, or `types`) and
        // we’re trying to access a nested path, so return undefined
        field = undefined;
      }
    }
  });

  // If we have an explicit type but haven’t applied it yet (e.g., for "field<button>" with no
  // further navigation), apply it now
  if (currentExplicitType && field && 'types' in field) {
    const { types } = /** @type {FieldWithTypes} */ (field);

    // @ts-ignore
    field = types.find(({ name }) => name === currentExplicitType);
  }

  fieldConfigCacheMap.set(cacheKey, field);

  return field;
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
 * Get a field’s display value that matches the given field name (key path).
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File/singleton collection only.
 * @param {FlattenedEntryContent} [args.valueMap] Object holding current entry values.
 * @param {FieldKeyPath} args.keyPath Key path, e.g. `author.name`.
 * @param {InternalLocaleCode} args.locale Locale.
 * @param {string[]} [args.transformations] String transformations.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @returns {string} Resolved display value.
 */
export const getFieldDisplayValue = ({
  collectionName,
  fileName,
  valueMap = {},
  keyPath,
  locale,
  transformations,
  isIndexFile = false,
}) => {
  const fieldConfig = getField({ collectionName, fileName, valueMap, keyPath, isIndexFile });
  let value = valueMap[keyPath];

  // If the field doesn’t exist in `valueMap` and transformations are applied, return empty string
  if (value === undefined && transformations?.length) {
    return '';
  }

  if (fieldConfig?.widget === 'datetime') {
    // If the `date` transformation is provided, do nothing; it should be used instead of the field
    // `format` option, so the keep the original value for `applyTransformations()`
    if (!transformations?.some((tf) => DATE_TRANSFORMATION_REGEX.test(tf))) {
      value = getDateTimeFieldDisplayValue({
        locale,
        // eslint-disable-next-line object-shorthand
        fieldConfig: /** @type {DateTimeField} */ (fieldConfig),
        currentValue: value,
      });
    }
  }

  if (fieldConfig?.widget === 'relation') {
    value = getReferencedOptionLabel({
      // eslint-disable-next-line object-shorthand
      fieldConfig: /** @type {RelationField} */ (fieldConfig),
      valueMap,
      keyPath,
      locale,
    });
  }

  if (fieldConfig?.widget === 'select') {
    value = getOptionLabel({
      // eslint-disable-next-line object-shorthand
      fieldConfig: /** @type {SelectField} */ (fieldConfig),
      valueMap,
      keyPath,
    });
  }

  if (fieldConfig?.widget === 'list') {
    const { fields } = /** @type {ListFieldWithSubFields} */ (fieldConfig);
    const { types } = /** @type {ListFieldWithTypes} */ (fieldConfig);

    if (fields || types) {
      // Ignore
    } else {
      // Concat values of single field list or simple list
      value = getListFormatter(locale).format(
        Object.entries(valueMap)
          .filter(
            ([key, val]) =>
              key.match(`^${escapeRegExp(keyPath)}\\.\\d+$`) && typeof val === 'string' && !!val,
          )
          .map(([, val]) => val),
      );
    }
  }

  if (fieldConfig?.widget === 'number') {
    const { value_type: valueType = 'int' } = /** @type {NumberField} */ (fieldConfig);

    if (valueType === 'int' || valueType === 'float') {
      value = Intl.NumberFormat(getCanonicalLocale(locale)).format(Number(value));
    }
  }

  if (Array.isArray(value)) {
    value = getListFormatter(locale).format(value);
  }

  if (transformations?.length) {
    value = applyTransformations({ fieldConfig, value, transformations });
  }

  // Return an empty string if the value is null or undefined
  return String(value ?? '');
};

/**
 * Get the display value of the first visible field that has a non-empty value.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.valueMap Entry content.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {GetFieldArgs} args.getFieldArgs Arguments for `getField`.
 * @param {RegExp} args.keyPathRegex Regular expression to match the key path prefix.
 * @returns {string} Display value of the first visible field that has a non-empty value. If no such
 * field is found, returns an empty string.
 */
export const getVisibleFieldDisplayValue = ({
  valueMap,
  locale,
  keyPath,
  keyPathRegex,
  getFieldArgs,
}) => {
  // Find the first visible item key path that has a non-empty value
  const visibleItemKeyPath = [`${keyPath}.title`, `${keyPath}.name`, ...Object.keys(valueMap)].find(
    (_keyPath) => {
      const value = valueMap[_keyPath];

      if (
        !keyPathRegex.test(_keyPath) ||
        !(
          (typeof value === 'string' && value.trim()) ||
          (typeof value === 'number' && !Number.isNaN(value))
        )
      ) {
        return false;
      }

      const fieldConfig = getField({ ...getFieldArgs, keyPath: _keyPath });

      return !!fieldConfig && fieldConfig.widget !== 'hidden';
    },
  );

  if (visibleItemKeyPath) {
    return getFieldDisplayValue({ ...getFieldArgs, keyPath: visibleItemKeyPath, locale });
  }

  return '';
};

/**
 * Get an entry’s field value by locale and key.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {string} args.collectionName Name of a collection that the entry belongs to.
 * @param {FieldKeyPath | string} args.key Field key path or one of other entry metadata property
 * keys: `slug`, `commit_author` and `commit_date`.
 * @param {boolean} [args.resolveRef] Whether to resolve the referenced value if the target field is
 * a relation field.
 * @returns {any} Value.
 */
export const getPropertyValue = ({ entry, locale, collectionName, key, resolveRef = true }) => {
  const { slug, locales, commitAuthor: { name, login, email } = {}, commitDate } = entry;

  if (key === 'slug') {
    return slug;
  }

  if (key === 'commit_author') {
    return name || login || email;
  }

  if (key === 'commit_date') {
    return commitDate;
  }

  const { content } = locales[locale] ?? {};

  if (content === undefined) {
    return undefined;
  }

  const collection = getCollection(collectionName);

  if (!collection) {
    return undefined;
  }

  if (resolveRef) {
    const isIndexFile = isCollectionIndexFile(collection, entry);
    const fieldConfig = getField({ collectionName, keyPath: key, isIndexFile });

    // Resolve the displayed value for a relation field
    if (fieldConfig?.widget === 'relation') {
      return getReferencedOptionLabel({
        // eslint-disable-next-line object-shorthand
        fieldConfig: /** @type {RelationField} */ (fieldConfig),
        valueMap: content,
        keyPath: key,
        locale,
      });
    }
  }

  return content[key];
};
