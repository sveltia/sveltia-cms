import { isObject } from '@sveltia/utils/object';

import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import { isFieldMultiple } from '$lib/services/contents/entry/fields';
import { MULTI_VALUE_FIELD_TYPES, SIMPLE_VALUE_FIELD_TYPES } from '$lib/services/contents/fields';
import { getTypeSubFields } from '$lib/services/contents/fields/list/subfields';
import { unflattenKeys } from '$lib/services/utils/object';

/**
 * @import { InternalLocaleCode } from '$lib/types/private';
 * @import { Field, ObjectField } from '$lib/types/public';
 */

/**
 * Check if a pasted value is a string or a number, which most of the fields take.
 * @param {any} value Value.
 * @returns {boolean} Result.
 */
const isStringOrNumber = (value) => typeof value === 'string' || typeof value === 'number';

/**
 * Check if a pasted value fits a field that doesn’t have subfields.
 * @param {any} value Value.
 * @param {string} fieldType Field type.
 * @returns {boolean} Result.
 */
const isPrimitiveValueCompatible = (value, fieldType) => {
  if (value === null) {
    return true;
  }

  if (fieldType === 'boolean') {
    return typeof value === 'boolean';
  }

  if (fieldType === 'code') {
    return typeof value === 'string' || isObject(value);
  }

  if (fieldType === 'keyvalue') {
    return isObject(value);
  }

  if (SIMPLE_VALUE_FIELD_TYPES.includes(fieldType) || MULTI_VALUE_FIELD_TYPES.includes(fieldType)) {
    return isStringOrNumber(value);
  }

  // Hidden field and custom field types, which can take anything
  return true;
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
    const values = Array.isArray(value) ? value : [value];

    return values.every((v) => isPrimitiveValueCompatible(v, fieldType)) ? values : undefined;
  }

  // A single value can be taken from a multiple-value field holding one value
  const _value =
    MULTI_VALUE_FIELD_TYPES.includes(fieldType) && Array.isArray(value) && value.length === 1
      ? value[0]
      : value;

  return isPrimitiveValueCompatible(_value, fieldType) ? _value : undefined;
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
  return list.filter((item) => {
    const compatible = isStringOrNumber(item);

    if (!compatible) {
      options.stats.dropped += 1;
    }

    return compatible;
  });
};
