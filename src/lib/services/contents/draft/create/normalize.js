import { isObject } from '@sveltia/utils/object';

import { populateDefaultValue } from '$lib/services/contents/draft/defaults';
import {
  getItemIndexes,
  hasChildKeys,
  indexContent,
} from '$lib/services/contents/entry/content-index';
import { getFieldKind, isFieldMultiple } from '$lib/services/contents/entry/fields';
import { STRING_VALUE_FIELD_TYPES } from '$lib/services/contents/fields';
import { getListFieldInfo } from '$lib/services/contents/fields/list/helpers';
import { getLocalizedRelationValue } from '$lib/services/contents/fields/relation/helpers/locale';

/**
 * @import {
 * ContentIndex,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * NormalizeContentArgs,
 * } from '$lib/types/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * FieldWithSubFields,
 * FieldWithTypes,
 * ListField,
 * ListFieldWithSubField,
 * NumberField,
 * } from '$lib/types/public';
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
 * @property {boolean} [fillDefaults] Whether to fill in the values missing from the content.
 */

/**
 * @typedef {NormalizeFieldArgs & { fieldType: string }} ReconcileScalarValueArgs
 */

/**
 * @typedef {NormalizeFieldArgs & { hasSubFields: boolean }} ReconcileListValueArgs
 */

/**
 * Field types holding a value whose shape we can’t predict, so it’s taken as-is: the Hidden field
 * accepts anything, the KeyValue and Code fields have their own nested shape, and custom field
 * types are up to the developer.
 */
const OPAQUE_FIELD_TYPES = ['code', 'hidden', 'keyvalue'];

/**
 * Check whether the value is an empty object or array. The `flat` library uses these as
 * placeholders that its `unflatten()` fills in from the child key paths, so unlike any other value
 * stored alongside children, they are harmless.
 * @param {any} value Value to check.
 * @returns {boolean} Result.
 */
const isPlaceholder = (value) =>
  (Array.isArray(value) && !value.length) || (isObject(value) && !Object.keys(value).length);

/**
 * Delete a value stored at the given key path along with everything below it.
 * @param {FlattenedEntryContent} content Flattened entry content, modified in place.
 * @param {FieldKeyPath} keyPath Key path.
 */
const discardValue = (content, keyPath) => {
  const prefix = `${keyPath}.`;

  Object.keys(content).forEach((key) => {
    if (key === keyPath || key.startsWith(prefix)) {
      delete content[key];
    }
  });
};

/**
 * Drop a value stored at a key path that also has children. `unflatten()` lets such a value win and
 * silently throws the children away, so an Object field whose file value is a plain string would
 * lose everything the user typed into its sub-fields on the next save.
 * @param {FlattenedEntryContent} content Flattened entry content, modified in place.
 * @param {FieldKeyPath} keyPath Key path.
 */
const discardConflictingValue = (content, keyPath) => {
  if (keyPath in content && !isPlaceholder(content[keyPath])) {
    delete content[keyPath];
  }
};

/**
 * Reconcile the value of a scalar field with its configuration.
 * @param {ReconcileScalarValueArgs} args Arguments.
 * @returns {boolean} Whether the stored value can be kept, after coercion if needed. `false` means
 * it has been discarded and the caller should fill in the default value instead.
 */
const reconcileScalarValue = ({ field, fieldType, keyPath, content, index }) => {
  if (hasChildKeys(index, keyPath)) {
    const [firstItemIndex] = getItemIndexes(index, keyPath);

    // The file holds a list where a single value is expected, which happens when a field is changed
    // from multiple to single. Keep the first item and drop the rest
    if (firstItemIndex !== undefined) {
      const firstItem = content[`${keyPath}.${firstItemIndex}`];

      discardValue(content, keyPath);
      content[keyPath] = firstItem;
    } else {
      // The file holds an object where a single value is expected; there is nothing to salvage
      discardValue(content, keyPath);

      return false;
    }
  }

  const value = content[keyPath];

  // An empty object or array is as good as no value at all
  if (isObject(value) || Array.isArray(value)) {
    discardValue(content, keyPath);

    return false;
  }

  if (STRING_VALUE_FIELD_TYPES.includes(fieldType)) {
    if (typeof value !== 'string') {
      // A number, boolean or null read from the file: stringify it rather than dropping it, which
      // is also what the field editor would end up writing back
      content[keyPath] = String(value ?? '');
    }

    return true;
  }

  if (fieldType === 'boolean') {
    if (typeof value !== 'boolean') {
      const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value;

      if (normalized !== 'true' && normalized !== 'false') {
        return false;
      }

      content[keyPath] = normalized === 'true';
    }

    return true;
  }

  if (fieldType === 'number') {
    const { value_type: valueType = 'int' } = /** @type {NumberField} */ (field);

    // The `int` and `float` value types are stored as a number or `null`; the string variants keep
    // whatever the user typed, so any primitive will do
    if (valueType !== 'int' && valueType !== 'float') {
      return true;
    }

    if (typeof value === 'number' || value === null) {
      return true;
    }

    const parsedValue = typeof value === 'string' ? Number(value.trim()) : Number.NaN;

    if (value === '' || Number.isNaN(parsedValue)) {
      return false;
    }

    content[keyPath] = parsedValue;
  }

  return true;
};

/**
 * Reconcile the value of a List or other multi-value field with its configuration.
 * @param {ReconcileListValueArgs} args Arguments.
 * @returns {boolean} Whether the stored value can be kept, after coercion if needed.
 */
const reconcileListValue = ({ keyPath, content, index, hasSubFields }) => {
  if (getItemIndexes(index, keyPath).length) {
    discardConflictingValue(content, keyPath);

    return true;
  }

  // Non-numeric children: the file holds an object where a list is expected
  if (hasChildKeys(index, keyPath)) {
    discardValue(content, keyPath);

    return false;
  }

  const value = content[keyPath];

  if (Array.isArray(value)) {
    return true;
  }

  // The file holds a single value where a list is expected, which happens when a field is changed
  // from single to multiple. Keep it as the sole item, unless the items are objects, in which case
  // a scalar can’t be turned into one
  if (!hasSubFields && value !== null && value !== undefined && !isObject(value)) {
    delete content[keyPath];
    content[`${keyPath}.0`] = value;

    return true;
  }

  discardValue(content, keyPath);

  return false;
};

/**
 * Reconcile the value of an Object field with its configuration.
 * @param {NormalizeFieldArgs} args Arguments.
 * @returns {boolean} Whether the stored value can be kept, after coercion if needed.
 */
const reconcileObjectValue = ({ keyPath, content, index }) => {
  if (hasChildKeys(index, keyPath)) {
    discardConflictingValue(content, keyPath);

    return true;
  }

  // A `null` value means the optional Object field is collapsed
  if (content[keyPath] === null) {
    return true;
  }

  // A scalar or an empty object where sub-values are expected
  discardValue(content, keyPath);

  return false;
};

/**
 * Reconcile the stored value with the field configuration, coercing what can be coerced and
 * discarding what can’t.
 *
 * Entries aren’t necessarily written by the CMS, and a field’s type can change after the fact, so
 * the value map may hold a shape no editor for that field type can render. Left alone, the mismatch
 * either shows up as an empty editor or, worse, silently destroys data on the next save, because
 * `unflatten()` lets a value stored at a key path win over everything below it.
 * @param {NormalizeFieldArgs} args Arguments.
 * @returns {boolean} Whether the stored value can be kept, after coercion if needed. `false` means
 * it has been discarded and the caller should fill in the default value instead.
 * @see https://github.com/decaporg/decap-cms/issues/836
 * @see https://github.com/decaporg/decap-cms/issues/3524
 */
const reconcileValue = (args) => {
  const { field, keyPath, content, index } = args;
  const { widget: fieldType = 'string' } = field;

  // Custom field types may hold anything, so leave them alone apart from a value that would destroy
  // its own children
  if (OPAQUE_FIELD_TYPES.includes(fieldType) || getFieldKind(field) !== 'builtin') {
    if (hasChildKeys(index, keyPath)) {
      discardConflictingValue(content, keyPath);
    }

    return true;
  }

  if (fieldType === 'object') {
    return reconcileObjectValue(args);
  }

  if (fieldType === 'list') {
    const { hasSubFields } = getListFieldInfo(/** @type {ListField} */ (field));

    return reconcileListValue({ ...args, hasSubFields });
  }

  if (isFieldMultiple(field)) {
    return reconcileListValue({ ...args, hasSubFields: false });
  }

  return reconcileScalarValue({ ...args, fieldType });
};

/**
 * Copy a field’s entire subtree from the default locale’s content.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.content Flattened entry content, modified in place.
 * @param {FlattenedEntryContent} args.defaultLocaleContent Content for the default locale.
 * @param {Field} args.field Field configuration.
 * @param {FieldKeyPath} args.keyPath Key path of the field.
 * @param {InternalLocaleCode} args.locale Locale of the content.
 * @param {InternalLocaleCode} args.defaultLocale Default locale of the entry draft.
 * @returns {boolean} Whether anything was copied.
 */
const copyFromDefaultLocale = ({
  content,
  defaultLocaleContent,
  field,
  keyPath,
  locale,
  defaultLocale,
}) => {
  const prefix = `${keyPath}.`;

  const keys = Object.keys(defaultLocaleContent).filter(
    (key) => key === keyPath || key.startsWith(prefix),
  );

  keys.forEach((key) => {
    // The copied value may be a Relation field value holding the source locale as a prefix, which
    // has to be replaced with the target locale. A `multiple` Relation field stores each value
    // under a numbered key path, so every copied key is localized the same way
    content[key] = getLocalizedRelationValue({
      fieldConfig: field,
      value: defaultLocaleContent[key],
      sourceLocale: defaultLocale,
      targetLocale: locale,
    });
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
 * Fill in the values missing from the given field and reconcile the ones that are there, recursing
 * into sub-fields.
 *
 * A field that holds nothing at all — the common case for a field added to the configuration after
 * the entry was written — gets the same default value a new entry would get. A field that does hold
 * something keeps it, as long as its shape matches the field type, but its sub-fields are visited
 * so that a newly added sub-field shows up in every existing object and list item.
 * @param {NormalizeFieldArgs} args Arguments.
 */
const normalizeField = (args) => {
  const { field, keyPath, content, index, locale, defaultLocale, defaultLocaleContent } = args;
  const { fillDefaults = true } = args;
  const occupied = keyPath in content || hasChildKeys(index, keyPath);

  if (!occupied || !reconcileValue(args)) {
    if (!fillDefaults) {
      return;
    }

    // A `duplicate` field mirrors the default locale, so take the value from there rather than
    // filling in the configured default, which may not be what the default locale actually holds
    if (
      locale !== defaultLocale &&
      field.i18n === 'duplicate' &&
      defaultLocaleContent &&
      copyFromDefaultLocale({
        content,
        defaultLocaleContent,
        field,
        keyPath,
        locale,
        defaultLocale,
      })
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

  getItemIndexes(index, keyPath).forEach((itemIndex) => {
    const itemKeyPath = `${keyPath}.${itemIndex}`;

    // A single-subfield List field stores the item itself at the item key path, so hand the item
    // over to the sub-field as-is; it recurses further only if the sub-field is an Object or List
    if (subField) {
      normalizeField({ ...args, field: subField, keyPath: itemKeyPath });

      return;
    }

    // The file holds a scalar where an object is expected. It can’t be salvaged, and leaving it in
    // place would make `unflatten()` drop every sub-field value on save
    discardConflictingValue(content, itemKeyPath);

    const fields = subFields ?? getVariableTypeFields({ field, content, keyPath: itemKeyPath });

    fields?.forEach((itemField) => {
      normalizeField({ ...args, field: itemField, keyPath: `${itemKeyPath}.${itemField.name}` });
    });
  });
};

/**
 * Fill in the values missing from an existing entry’s content and reconcile the ones that don’t
 * match the field configuration, so that the draft holds one well-shaped key path per configured
 * field just like a new entry does.
 *
 * Entries written before a field was added to the collection configuration — or before an optional
 * field was made required — lack that field entirely, and anything keyed by the content’s own key
 * paths then skips it: the editor renders no value for it, and the validator never checks it.
 * Entries not written by the CMS at all may hold a value of the wrong type for the field editing
 * it. Both are fixed by normalizing the content up front.
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
  fillDefaults = true,
}) => {
  const index = indexContent(content);

  fields.forEach((field) => {
    normalizeField({
      field,
      keyPath: field.name,
      fillDefaults,
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
