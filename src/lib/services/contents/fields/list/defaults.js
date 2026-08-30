import { isObject } from '@sveltia/utils/object';

import { getSubtreeEntries } from '$lib/services/contents/entry/subtree';

/**
 * @import { GetDefaultValueMapFuncArgs } from '$lib/types/private';
 * @import {
 * FieldKeyPath,
 * ListField,
 * ListFieldWithSubFields,
 * ListFieldWithTypes,
 * } from '$lib/types/public';
 */

/**
 * Get the default value map for a List field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, any>} Default value map.
 */
export const getDefaultValueMap = ({ fieldConfig, keyPath, dynamicValue }) => {
  const { default: defaultValue } = /** @type {ListField} */ (fieldConfig);
  const { fields } = /** @type {ListFieldWithSubFields} */ (fieldConfig);
  const { types } = /** @type {ListFieldWithTypes} */ (fieldConfig);
  /** @type {any[]} */
  let value;

  if (dynamicValue !== undefined) {
    // Filter out empty strings (this handles the case where `dynamicValue` is '')
    value = dynamicValue
      .split(/,\s*/)
      .map((val) => val.trim())
      .filter((val) => val !== '');
  } else {
    value = Array.isArray(defaultValue) ? defaultValue : [];
  }

  const isArray = Array.isArray(value) && !!value.length;

  // Always return the main array, even if empty
  if (!isArray) {
    return getSubtreeEntries(keyPath, []);
  }

  // A simple List field holds scalars only, so drop any object that snuck into the default
  const items = fields || types ? value : value.filter((val) => !isObject(val));

  return getSubtreeEntries(keyPath, items);
};
