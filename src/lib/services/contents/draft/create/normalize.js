import { populateDefaultValue } from '$lib/services/contents/draft/defaults';

/**
 * @import {
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * NormalizeContentArgs,
 * } from '$lib/types/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * FieldWithSubFields,
 * FieldWithTypes,
 * ListFieldWithSubField,
 * } from '$lib/types/public';
 */

/**
 * @typedef {object} ContentIndex
 * @property {Set<FieldKeyPath>} occupiedKeyPaths Every key path present in the content, including
 * the intermediate ones. For example, content holding only `colors.0.name` yields `colors`,
 * `colors.0` and `colors.0.name`.
 * @property {Map<FieldKeyPath, number[]>} itemIndexMap Indexes of the list items found under each
 * key path, in ascending order.
 */

/**
 * @typedef {object} NormalizeFieldArgs
 * @property {Field} field Field configuration.
 * @property {FieldKeyPath} keyPath Key path of the field within the content.
 * @property {FlattenedEntryContent} content Flattened entry content, modified in place.
 * @property {ContentIndex} index Index of the content as it was before normalization.
 * @property {InternalLocaleCode} locale Locale of the content.
 * @property {InternalLocaleCode} defaultLocale Default locale of the entry draft.
 * @property {FlattenedEntryContent} [defaultLocaleContent] Already normalized content for the
 * default locale, used as the source for fields with the `duplicate` i18n strategy.
 */

const NUMERIC_KEY_REGEX = /^\d+$/;

/**
 * Index the given content so that {@link normalizeField} can ask two questions in constant time:
 * whether a key path holds anything at all, and which list items exist under it. A plain scan would
 * be O(keys) per field, and normalization visits every configured field.
 * @param {FlattenedEntryContent} content Flattened entry content.
 * @returns {ContentIndex} Index of the content.
 */
const indexContent = (content) => {
  /** @type {Set<FieldKeyPath>} */
  const occupiedKeyPaths = new Set();
  /** @type {Map<FieldKeyPath, Set<number>>} */
  const itemIndexSetMap = new Map();

  Object.keys(content).forEach((key) => {
    const segments = key.split('.');
    let path = '';

    segments.forEach((segment, index) => {
      const parentPath = path;

      path = index === 0 ? segment : `${path}.${segment}`;
      occupiedKeyPaths.add(path);

      if (index > 0 && NUMERIC_KEY_REGEX.test(segment)) {
        const indexes = itemIndexSetMap.get(parentPath);

        if (indexes) {
          indexes.add(Number(segment));
        } else {
          itemIndexSetMap.set(parentPath, new Set([Number(segment)]));
        }
      }
    });
  });

  return {
    occupiedKeyPaths,
    itemIndexMap: new Map(
      [...itemIndexSetMap].map(([key, indexes]) => [key, [...indexes].sort((a, b) => a - b)]),
    ),
  };
};

/**
 * Copy a field’s entire subtree from the default locale’s content.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.content Flattened entry content, modified in place.
 * @param {FlattenedEntryContent} args.defaultLocaleContent Content for the default locale.
 * @param {FieldKeyPath} args.keyPath Key path of the field.
 * @returns {boolean} Whether anything was copied.
 */
const copyFromDefaultLocale = ({ content, defaultLocaleContent, keyPath }) => {
  const prefix = `${keyPath}.`;

  const keys = Object.keys(defaultLocaleContent).filter(
    (key) => key === keyPath || key.startsWith(prefix),
  );

  keys.forEach((key) => {
    content[key] = defaultLocaleContent[key];
  });

  return !!keys.length;
};

/**
 * Get the variable type configuration that matches the type name stored in the content.
 * @param {object} args Arguments.
 * @param {Field} args.field Field configuration with the `types` option.
 * @param {FlattenedEntryContent} args.content Flattened entry content.
 * @param {FieldKeyPath} args.keyPath Key path of the object or list item.
 * @returns {Field[] | undefined} Sub-fields of the matching type, if any.
 */
const getVariableTypeFields = ({ field, content, keyPath }) => {
  const { types, typeKey = 'type' } = /** @type {FieldWithTypes} */ (field);

  return types?.find(({ name }) => name === content[`${keyPath}.${typeKey}`])?.fields;
};

/**
 * Fill in the values missing from the given field, recursing into sub-fields.
 *
 * A field that holds nothing at all — the common case for a field added to the configuration after
 * the entry was written — gets the same default value a new entry would get. A field that does hold
 * something is left alone, but its sub-fields are visited so that a newly added sub-field shows up
 * in every existing object and list item.
 * @param {NormalizeFieldArgs} args Arguments.
 */
const normalizeField = (args) => {
  const { field, keyPath, content, index, locale, defaultLocale, defaultLocaleContent } = args;

  if (!index.occupiedKeyPaths.has(keyPath)) {
    // A `duplicate` field mirrors the default locale, so take the value from there rather than
    // filling in the configured default, which may not be what the default locale actually holds
    if (
      locale !== defaultLocale &&
      field.i18n === 'duplicate' &&
      defaultLocaleContent &&
      copyFromDefaultLocale({ content, defaultLocaleContent, keyPath })
    ) {
      return;
    }

    populateDefaultValue({
      content,
      keyPath,
      fieldConfig: field,
      locale,
      defaultLocale,
      dynamicValues: {},
    });

    return;
  }

  const { widget: fieldType = 'string' } = field;

  if (fieldType === 'object') {
    // A `null` value means the optional Object field is collapsed, so it has no sub-values to fill
    if (content[keyPath] === null) {
      return;
    }

    const { fields: subFields } = /** @type {FieldWithSubFields} */ (field);
    const fields = subFields ?? getVariableTypeFields({ field, content, keyPath });

    fields?.forEach((subField) => {
      normalizeField({ ...args, field: subField, keyPath: `${keyPath}.${subField.name}` });
    });

    return;
  }

  if (fieldType !== 'list') {
    return;
  }

  const { field: subField } = /** @type {ListFieldWithSubField} */ (field);
  const { fields: subFields } = /** @type {FieldWithSubFields} */ (field);
  const { types } = /** @type {FieldWithTypes} */ (field);

  // A simple List field holds scalars only, so there is nothing to recurse into
  if (!subField && !subFields && !types) {
    return;
  }

  (index.itemIndexMap.get(keyPath) ?? []).forEach((itemIndex) => {
    const itemKeyPath = `${keyPath}.${itemIndex}`;

    // A single-subfield List field stores the item itself at the item key path, so hand the item
    // over to the sub-field as-is; it recurses further only if the sub-field is an Object or List
    if (subField) {
      normalizeField({ ...args, field: subField, keyPath: itemKeyPath });

      return;
    }

    const fields = subFields ?? getVariableTypeFields({ field, content, keyPath: itemKeyPath });

    fields?.forEach((itemField) => {
      normalizeField({ ...args, field: itemField, keyPath: `${itemKeyPath}.${itemField.name}` });
    });
  });
};

/**
 * Fill in the values missing from an existing entry’s content, so that the draft holds one key path
 * per configured field just like a new entry does.
 *
 * Entries written before a field was added to the collection configuration — or before an optional
 * field was made required — lack that field entirely, and anything keyed by the content’s own key
 * paths then skips it: the editor renders no value for it, and the validator never checks it. Both
 * are fixed by normalizing the content up front.
 * @param {NormalizeContentArgs} args Arguments.
 * @returns {FlattenedEntryContent} The same `content` object, modified in place.
 * @see https://github.com/sveltia/sveltia-cms/issues/395
 * @see https://github.com/sveltia/sveltia-cms/issues/650
 */
export const normalizeContent = ({
  fields,
  content,
  locale,
  defaultLocale,
  defaultLocaleContent,
}) => {
  const index = indexContent(content);

  fields.forEach((field) => {
    normalizeField({
      field,
      keyPath: field.name,
      content,
      index,
      locale,
      defaultLocale,
      defaultLocaleContent,
    });
  });

  return content;
};

/**
 * Normalize the content of every enabled locale. The default locale is normalized first so that
 * fields using the `duplicate` i18n strategy can be mirrored from it.
 * @param {object} args Arguments.
 * @param {Field[]} args.fields Field list of a collection, collection file or index file.
 * @param {Record<InternalLocaleCode, FlattenedEntryContent>} args.contentMap Flattened entry
 * content for each enabled locale, modified in place.
 * @param {InternalLocaleCode} args.defaultLocale Default locale of the entry draft.
 * @returns {Record<InternalLocaleCode, FlattenedEntryContent>} The same `contentMap` object.
 */
export const normalizeContentMap = ({ fields, contentMap, defaultLocale }) => {
  const defaultLocaleContent = contentMap[defaultLocale];

  if (defaultLocaleContent) {
    normalizeContent({
      fields,
      content: defaultLocaleContent,
      locale: defaultLocale,
      defaultLocale,
    });
  }

  Object.entries(contentMap).forEach(([locale, content]) => {
    if (locale !== defaultLocale) {
      normalizeContent({ fields, content, locale, defaultLocale, defaultLocaleContent });
    }
  });

  return contentMap;
};
