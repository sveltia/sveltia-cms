import { escapeRegExp } from '@sveltia/utils/string';
import {
  applyTransformations,
  DATE_TRANSFORMATION_REGEX,
} from '$lib/services/common/transformations';
import { getCollection } from '$lib/services/contents/collection';
import { isCollectionIndexFile } from '$lib/services/contents/collection/index-file';
import { getListFormatter } from '$lib/services/contents/i18n';
import { getDateTimeFieldDisplayValue } from '$lib/services/contents/widgets/date-time/helper';
import { getReferencedOptionLabel } from '$lib/services/contents/widgets/relation/helper';
import { getOptionLabel } from '$lib/services/contents/widgets/select/helper';

/**
 * @import {
 * Entry,
 * FileCollection,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import {
 * DateTimeField,
 * Field,
 * FieldKeyPath,
 * ListField,
 * RelationField,
 * SelectField,
 * } from '$lib/types/public';
 */

/**
 * @type {Map<string, Field | undefined>}
 */
export const fieldConfigCacheMap = new Map();

/**
 * Get a field’s config object that matches the given field name (key path).
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File collection only.
 * @param {FlattenedEntryContent} [args.valueMap] Object holding current entry values. This is
 * required when working with list/object widget variable types.
 * @param {FieldKeyPath} args.keyPath Key path, e.g. `author.name`.
 * @param {boolean} [args.isIndexFile] Whether the corresponding entry is the collection’s special
 * index file used specifically in Hugo.
 * @returns {Field | undefined} Field configuration.
 */
export const getField = ({
  collectionName,
  fileName = undefined,
  valueMap = {},
  keyPath,
  isIndexFile = false,
}) => {
  const cacheKey = JSON.stringify({ collectionName, fileName, valueMap, keyPath, isIndexFile });

  if (fieldConfigCacheMap.has(cacheKey)) {
    return fieldConfigCacheMap.get(cacheKey);
  }

  const collection = getCollection(collectionName);

  const collectionFile = fileName
    ? /** @type {FileCollection} */ (collection)?._fileMap?.[fileName]
    : undefined;

  // For entry collections, `fileName` is ignored and `collectionFile` will be `undefined`
  // Only fail if we explicitly need a file collection but can't find the file
  if (!collection || (fileName && collection?._type === 'file' && !collectionFile)) {
    fieldConfigCacheMap.set(cacheKey, undefined);

    return undefined;
  }

  const { index_file: { fields: indexFileFields } = {} } = collection;
  const { fields: regularFields = [] } = collectionFile ?? collection;
  const fields = isIndexFile ? (indexFileFields ?? regularFields) : regularFields;
  const keyPathArray = keyPath.split('.');
  /** @type {Field | undefined} */
  let field;

  keyPathArray.forEach((key, index) => {
    if (index === 0) {
      field = fields.find(({ name }) => name === key);

      // If using index file and field not found, try regular fields as fallback
      if (!field && isIndexFile && indexFileFields) {
        field = regularFields.find(({ name }) => name === key);
      }
    } else if (field) {
      const isNumericKey = /^\d+$/.test(key);
      const keyPathArraySub = keyPathArray.slice(0, index);
      const { widget = 'text' } = field;

      // Handle Select and Relation widgets with numeric keys, e.g. `authors.0`
      if (isNumericKey && ['select', 'relation'].includes(widget)) {
        // For single Select/Relation, numeric access is not allowed
        if (!(/** @type {SelectField | RelationField} */ (field).multiple)) {
          field = undefined;
        }

        return;
      }

      // Handle all other widgets (List, Object, etc.)
      const {
        field: subField,
        fields: subFields,
        types,
        typeKey = 'type',
      } = /** @type {ListField} */ (field);

      if (subField) {
        const subFieldName = isNumericKey ? keyPathArray[index + 1] : undefined;

        // It’s possible to get a single-subfield List field with or without a subfield name (e.g.
        // `image.0` or `image.0.src`), but when a subfield name is specified, check if it’s valid
        field = !subFieldName || subField.name === subFieldName ? subField : undefined;
      } else if (subFields && isNumericKey) {
        // For list widgets with multiple fields, numeric keys (like "0") should be skipped
        // Keep the current field (the list widget) and continue to the next part of the path field
        // remains unchanged
      } else if (subFields && !isNumericKey) {
        field = subFields.find(({ name }) => name === key);
      } else if (types && isNumericKey) {
        // List widget variable types
        field = types.find(
          ({ name }) => name === valueMap[[...keyPathArraySub, key, typeKey].join('.')],
        );
      } else if (types && key !== typeKey) {
        // Object widget variable types
        field = types
          .find(({ name }) => name === valueMap[[...keyPathArraySub, typeKey].join('.')])
          ?.fields?.find(({ name }) => name === key);
      } else {
        // If we reach here, the list field is malformed (no `field`, `fields`, or `types`) and
        // we’re trying to access a nested path, so return undefined
        field = undefined;
      }
    }
  });

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
export const isFieldRequired = ({ fieldConfig: { required = true }, locale }) =>
  Array.isArray(required) ? required.includes(locale) : !!required;

/**
 * Get a field’s display value that matches the given field name (key path).
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name. File collection only.
 * @param {FlattenedEntryContent} args.valueMap Object holding current entry values.
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
  valueMap,
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
    const { fields, types } = /** @type {ListField} */ (fieldConfig);

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

  if (Array.isArray(value)) {
    value = getListFormatter(locale).format(value);
  }

  if (transformations?.length) {
    value = applyTransformations({ fieldConfig, value, transformations });
  }

  return value ? String(value) : '';
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
