import { isObject } from '@sveltia/utils/object';

import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import { isFieldMultiple } from '$lib/services/contents/entry/fields';
import {
  MEDIA_FIELD_TYPES,
  MULTI_VALUE_FIELD_TYPES,
  SIMPLE_VALUE_FIELD_TYPES,
  STRING_VALUE_FIELD_TYPES,
} from '$lib/services/contents/fields';
import { getTypeSubFields } from '$lib/services/contents/fields/list/subfields';
import { getNumberFieldValue, parseNumber } from '$lib/services/contents/fields/number/helpers';
import { unflattenKeys } from '$lib/services/utils/object';

/**
 * @import { InternalLocaleCode } from '$lib/types/private';
 * @import { Field, NumberField, ObjectField } from '$lib/types/public';
 */

/**
 * Check if a pasted value is a string or a number, which most of the fields take.
 * @param {any} value Value.
 * @returns {boolean} Result.
 */
const isStringOrNumber = (value) => typeof value === 'string' || typeof value === 'number';

/**
 * Conform a pasted value to a Number field: a number or text that is one is cast like the editor
 * does with its input, while other text is left out.
 * @param {string | number} value Value.
 * @param {NumberField} fieldConfig Field configuration.
 * @returns {string | number | null | undefined} Conformed value, or `undefined` if the field
 * doesn’t take the value.
 */
const conformNumberValue = (value, fieldConfig) => {
  const number = parseNumber(value);

  return Number.isNaN(number)
    ? undefined
    : getNumberFieldValue({ inputValue: number, fieldConfig });
};

/**
 * Conform a pasted value to a field that doesn’t have subfields. A number is converted to the type
 * the field takes, like `normalizeContent()` does with a value read from a file: a field holding a
 * string, like a String, DateTime or Image field, calls string methods on its value.
 * @param {any} value Value.
 * @param {Field} fieldConfig Field configuration.
 * @returns {any} Conformed value, or `undefined` if the field doesn’t take the value.
 */
const conformPrimitiveValue = (value, fieldConfig) => {
  const { widget: fieldType = 'string' } = fieldConfig;

  if (value === null) {
    return null;
  }

  if (fieldType === 'boolean') {
    return typeof value === 'boolean' ? value : undefined;
  }

  if (fieldType === 'code') {
    return typeof value === 'string' || isObject(value) ? value : undefined;
  }

  if (fieldType === 'keyvalue') {
    return isObject(value) ? value : undefined;
  }

  if (
    !SIMPLE_VALUE_FIELD_TYPES.includes(fieldType) &&
    !MULTI_VALUE_FIELD_TYPES.includes(fieldType)
  ) {
    // Hidden field and custom field types, which can take anything
    return value;
  }

  if (!isStringOrNumber(value)) {
    return undefined;
  }

  if (fieldType === 'number') {
    return conformNumberValue(value, /** @type {NumberField} */ (fieldConfig));
  }

  // A Relation or Select field can hold a number, which an option value can be
  return STRING_VALUE_FIELD_TYPES.includes(fieldType) || MEDIA_FIELD_TYPES.includes(fieldType)
    ? String(value)
    : value;
};

/**
 * Options for conforming a pasted value to the fields it’s pasted into.
 * @typedef {object} ConformOptions
 * @property {InternalLocaleCode} locale Locale the value is pasted in, for default values.
 * @property {InternalLocaleCode} defaultLocale Default locale of the draft.
 * @property {{ dropped: number }} stats Number of the values left out because the fields they’re
 * pasted into don’t have them, or don’t take them.
 */

/**
 * Conform a pasted value to the field it’s pasted into. See {@link conformObject}.
 * @param {any} value Pasted value.
 * @param {Field} fieldConfig Field configuration.
 * @param {ConformOptions} options Options.
 * @returns {any} Conformed value, or `undefined` if the field doesn’t take the value.
 */
const conformValue = (value, fieldConfig, options) => {
  const { widget: fieldType = 'string' } = fieldConfig;

  if (fieldType === 'object') {
    return isObject(value)
      ? // eslint-disable-next-line no-use-before-define
        conformObjectField(value, /** @type {ObjectField} */ (fieldConfig), options)
      : undefined;
  }

  if (fieldType === 'list') {
    // eslint-disable-next-line no-use-before-define
    return Array.isArray(value) ? conformList(value, fieldConfig, options) : undefined;
  }

  if (isFieldMultiple(fieldConfig) && value !== null) {
    const values = (Array.isArray(value) ? value : [value]).map((v) =>
      conformPrimitiveValue(v, fieldConfig),
    );

    return values.includes(undefined) ? undefined : values;
  }

  // A single value can be taken from a multiple-value field holding one value
  const _value =
    MULTI_VALUE_FIELD_TYPES.includes(fieldType) && Array.isArray(value) && value.length === 1
      ? value[0]
      : value;

  return conformPrimitiveValue(_value, fieldConfig);
};

/**
 * Conform a pasted object to the subfields it’s pasted into: a property the subfields don’t have,
 * or don’t take the value of, is left out, while a subfield the object doesn’t have gets its
 * default value.
 * @param {Record<string, any>} obj Pasted object.
 * @param {Field[]} fields Subfields.
 * @param {ConformOptions} options Options.
 * @returns {{ value: Record<string, any>, matched: number }} Conformed object and the number of
 * the properties taken.
 */
export const conformObject = (obj, fields, options) => {
  const { locale, defaultLocale, stats } = options;
  /** @type {Record<string, any>} */
  const value = {};
  let matched = 0;

  fields.forEach((fieldConfig) => {
    const { name } = fieldConfig;

    if (name in obj) {
      const conformed = conformValue(obj[name], fieldConfig, options);

      if (conformed !== undefined) {
        value[name] = conformed;
        matched += 1;

        return;
      }
    }

    const defaults = unflattenKeys(
      getDefaultValues({ fields: [fieldConfig], locale, defaultLocale }),
    );

    if (name in defaults) {
      value[name] = defaults[name];
    }
  });

  stats.dropped += Object.keys(obj).length - matched;

  return { value, matched };
};

/**
 * Conform a pasted Object field value. See {@link conformObject}.
 * @param {Record<string, any>} obj Pasted object.
 * @param {ObjectField} fieldConfig Field configuration.
 * @param {ConformOptions} options Options.
 * @returns {Record<string, any> | undefined} Conformed object, or `undefined` if the field has
 * variable types but not the one of the object.
 */
const conformObjectField = (obj, fieldConfig, options) => {
  const { fields, types, typeKey = 'type' } = /** @type {any} */ (fieldConfig);

  if (!types) {
    return conformObject(obj, fields ?? [], options).value;
  }

  const { [typeKey]: type, ...rest } = obj;
  const typeFields = getTypeSubFields(types, type);

  if (!typeFields) {
    return undefined;
  }

  return { ...conformObject(rest, typeFields, options).value, [typeKey]: type };
};

/**
 * Conform a pasted List field value: an item that doesn’t fit is left out.
 * @param {any[]} list Pasted list.
 * @param {Field} fieldConfig Field configuration.
 * @param {ConformOptions} options Options.
 * @returns {any[]} Conformed list.
 */
const conformList = (list, fieldConfig, options) => {
  const { field, fields, types } = /** @type {any} */ (fieldConfig);

  if (field) {
    return list.flatMap((item) => {
      const conformed = conformValue(item, field, options);

      if (conformed === undefined) {
        options.stats.dropped += 1;

        return [];
      }

      return [conformed];
    });
  }

  if (fields || types) {
    return list.flatMap((item) => {
      const conformed = isObject(item)
        ? conformObjectField(item, /** @type {ObjectField} */ (fieldConfig), options)
        : undefined;

      if (conformed === undefined) {
        options.stats.dropped += 1;

        return [];
      }

      return [conformed];
    });
  }

  // A simple list of strings
  return list.flatMap((item) => {
    if (!isStringOrNumber(item)) {
      options.stats.dropped += 1;

      return [];
    }

    return [String(item)];
  });
};
