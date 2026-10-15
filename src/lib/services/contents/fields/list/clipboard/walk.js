import { isObject } from '@sveltia/utils/object';

import { isRelativePath } from '$lib/services/assets';
import { MEDIA_FIELD_TYPES, RICH_TEXT_FIELD_TYPES } from '$lib/services/contents/fields';
import { getTypeSubFields, getValueSubFields } from '$lib/services/contents/fields/list/subfields';
import { getTypedKeyPath } from '$lib/services/contents/fields/object/helpers';
import { getValueFormat } from '$lib/services/contents/fields/rich-text';

/**
 * @import { TypedFieldKeyPath } from '$lib/types/private';
 * @import {
 * ComplexListField,
 * Field,
 * ListFieldWithSubField,
 * ListFieldWithSubFields,
 * ListFieldWithTypes,
 * MarkdownField,
 * ObjectField,
 * RichTextField,
 * RichTextValueFormat,
 * } from '$lib/types/public';
 */

/**
 * Callback for each value that can reference an asset. `format` is the format of a Markdown or
 * RichText field value, and `undefined` for a File or Image field value.
 * @typedef {(args: {
 * value: string,
 * format?: RichTextValueFormat,
 * typedKeyPath: TypedFieldKeyPath,
 * set: (newValue: string) => void,
 * }) => void} AssetValueCallback
 */

/**
 * Get the subfields of a List or Object field value, and the typed key path the subfields are
 * under, resolving the variable type against the type name stored in the value.
 * @param {ComplexListField | ObjectField} fieldConfig Field configuration.
 * @param {Record<string, any>} value Object value or list item.
 * @param {TypedFieldKeyPath} typedKeyPath Typed key path of the value, e.g. `blocks.*`.
 * @returns {{ fields: Field[], typedKeyPath: TypedFieldKeyPath }} Subfields and typed key path.
 */
const resolveValueFields = (fieldConfig, value, typedKeyPath) => {
  const { fields } = /** @type {ListFieldWithSubFields} */ (fieldConfig);
  const { types, typeKey = 'type' } = /** @type {ListFieldWithTypes} */ (fieldConfig);
  const type = types ? value[typeKey] : undefined;

  return {
    fields: getValueSubFields({ value, fields, types, typeKey }),
    typedKeyPath: getTypedKeyPath(typedKeyPath, type),
  };
};

/**
 * Find the values that can reference an asset in a field value: the value of a File or Image
 * field, and the body of a Markdown or RichText field. Object and List fields are walked down.
 * @param {object} args Arguments.
 * @param {Record<string, any> | any[]} args.container Object or array holding the value.
 * @param {string | number} args.key Property name or index of the value.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {TypedFieldKeyPath} args.typedKeyPath Typed key path of the field.
 * @param {AssetValueCallback} args.callback Function called for each value.
 */
const walkFieldValue = ({ container, key, fieldConfig, typedKeyPath, callback }) => {
  const value = /** @type {any} */ (container)[key];
  const { widget: fieldType = 'string' } = fieldConfig;
  const isRichText = RICH_TEXT_FIELD_TYPES.includes(fieldType);

  if (isRichText || MEDIA_FIELD_TYPES.includes(fieldType)) {
    /** @type {[Record<string, any> | any[], string | number][]} */
    const targets =
      Array.isArray(value) && !isRichText
        ? value.map((_value, index) => [value, index])
        : [[container, key]];

    targets.forEach(([_container, _key]) => {
      const _value = /** @type {any} */ (_container)[_key];

      if (typeof _value === 'string' && _value) {
        callback({
          value: _value,
          format: isRichText
            ? getValueFormat(/** @type {MarkdownField | RichTextField} */ (fieldConfig))
            : undefined,
          typedKeyPath,
          /**
           * Replace the value.
           * @param {string} newValue New value.
           */
          set: (newValue) => {
            /** @type {any} */ (_container)[_key] = newValue;
          },
        });
      }
    });

    return;
  }

  if (fieldType === 'object' && isObject(value)) {
    // eslint-disable-next-line no-use-before-define
    walkObject({
      obj: value,
      ...resolveValueFields(/** @type {ObjectField} */ (fieldConfig), value, typedKeyPath),
      callback,
    });

    return;
  }

  if (fieldType === 'list' && Array.isArray(value)) {
    const { field } = /** @type {ListFieldWithSubField} */ (fieldConfig);

    value.forEach((item, index) => {
      if (field) {
        walkFieldValue({
          container: value,
          key: index,
          fieldConfig: field,
          typedKeyPath: `${typedKeyPath}.*.${field.name}`,
          callback,
        });
      } else if (isObject(item)) {
        // eslint-disable-next-line no-use-before-define
        walkObject({
          obj: item,
          ...resolveValueFields(
            /** @type {ComplexListField} */ (fieldConfig),
            item,
            `${typedKeyPath}.*`,
          ),
          callback,
        });
      }
    });
  }
};

/**
 * Find the values that can reference an asset in an object. See {@link walkFieldValue}.
 * @param {object} args Arguments.
 * @param {Record<string, any>} args.obj Object.
 * @param {Field[]} args.fields Subfields of the object.
 * @param {TypedFieldKeyPath} args.typedKeyPath Typed key path of the object.
 * @param {AssetValueCallback} args.callback Function called for each value.
 */
export const walkObject = ({ obj, fields, typedKeyPath, callback }) => {
  fields.forEach((fieldConfig) => {
    const { name } = fieldConfig;

    if (name in obj) {
      walkFieldValue({
        container: obj,
        key: name,
        fieldConfig,
        typedKeyPath: `${typedKeyPath}.${name}`,
        callback,
      });
    }
  });
};

/**
 * Check if the given asset reference is a path relative to the entry, which has to be rewritten
 * when the item is pasted into another entry. An absolute path, a URL or a blob URL isn’t.
 * @param {string} src Reference.
 * @returns {boolean} Result.
 */
export const isEntryRelativeReference = (src) =>
  isRelativePath(src) && !/^[a-z][a-z\d+.-]*:/i.test(src);

/**
 * Get the subfields of a list item as an object: those of its variable type, or the single subfield
 * of a list whose items are the subfield values themselves.
 * @param {ComplexListField} fieldConfig Field configuration.
 * @param {string} [type] Variable type name of the item, if the list has variable types.
 * @returns {Field[] | undefined} Subfields, or `undefined` if the list has variable types but no
 * such type.
 */
export const getItemSubFields = (fieldConfig, type) => {
  const { field } = /** @type {ListFieldWithSubField} */ (fieldConfig);
  const { fields } = /** @type {ListFieldWithSubFields} */ (fieldConfig);
  const { types } = /** @type {ListFieldWithTypes} */ (fieldConfig);

  if (types) {
    return getTypeSubFields(types, type);
  }

  return fields ?? [field];
};
