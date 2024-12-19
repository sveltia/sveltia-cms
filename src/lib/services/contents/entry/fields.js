import { escapeRegExp } from '@sveltia/utils/string';
import { getCollection } from '$lib/services/contents/collection';
import { applyTransformations } from '$lib/services/contents/entry/transformations';
import { getListFormatter } from '$lib/services/contents/i18n';
import { getReferencedOptionLabel } from '$lib/services/contents/widgets/relation/helper';
import { getOptionLabel } from '$lib/services/contents/widgets/select/helper';

/**
 * @type {Map<string, Field | undefined>}
 */
const fieldConfigCacheMap = new Map();

/**
 * Get a field’s config object that matches the given field name (key path).
 * @param {object} args - Arguments.
 * @param {string} args.collectionName - Collection name.
 * @param {string} [args.fileName] - File name if the collection is a file collection.
 * @param {FlattenedEntryContent} [args.valueMap] - Object holding current entry values. This is
 * required when working with list/object widget variable types.
 * @param {FieldKeyPath} args.keyPath - Key path, e.g. `author.name`.
 * @returns {Field | undefined} Field configuration.
 */
export const getFieldConfig = ({
  collectionName,
  fileName = undefined,
  valueMap = {},
  keyPath,
}) => {
  const cacheKey = JSON.stringify({ collectionName, fileName, valueMap, keyPath });
  const cache = fieldConfigCacheMap.get(cacheKey);

  if (cache) {
    return cache;
  }

  const collection = getCollection(collectionName);

  const collectionFile = fileName
    ? /** @type {FileCollection} */ (collection)?._fileMap[fileName]
    : undefined;

  if (!collection || (fileName && !collectionFile)) {
    fieldConfigCacheMap.set(cacheKey, undefined);

    return undefined;
  }

  const { fields = [] } = collectionFile ?? collection;
  const keyPathArray = keyPath.split('.');
  /**
   * @type {Field | undefined}
   */
  let field;

  keyPathArray.forEach((key, index) => {
    if (index === 0) {
      field = fields.find(({ name }) => name === key);
    } else if (field) {
      const isNumericKey = /^\d+$/.test(key);
      const keyPathArraySub = keyPathArray.slice(0, index);

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
      }
    }
  });

  fieldConfigCacheMap.set(cacheKey, field);

  return field;
};

/**
 * Get a field’s display value that matches the given field name (key path).
 * @param {object} args - Arguments.
 * @param {string} args.collectionName - Collection name.
 * @param {string} [args.fileName] - File name.
 * @param {FlattenedEntryContent} args.valueMap - Object holding current entry values.
 * @param {FieldKeyPath} args.keyPath - Key path, e.g. `author.name`.
 * @param {LocaleCode} args.locale - Locale.
 * @param {string[]} [args.transformations] - String transformations.
 * @returns {any | any[]} Resolved field value(s).
 */
export const getFieldDisplayValue = ({
  collectionName,
  fileName,
  valueMap,
  keyPath,
  locale,
  transformations,
}) => {
  const fieldConfig = getFieldConfig({ collectionName, fileName, valueMap, keyPath });
  let value = valueMap[keyPath];

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
 * @param {object} args - Arguments.
 * @param {Entry} args.entry - Entry.
 * @param {LocaleCode} args.locale - Locale code.
 * @param {string} args.collectionName - Name of a collection that the entry belongs to.
 * @param {FieldKeyPath | string} args.key - Field key path or one of other entry metadata property
 * keys: `slug`, `commit_author` and `commit_date`.
 * @param {boolean} [args.resolveRef] - Whether to resolve the referenced value if the target
 * field is a relation field.
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

  if (resolveRef) {
    const fieldConfig = getFieldConfig({ collectionName, keyPath: key });

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
