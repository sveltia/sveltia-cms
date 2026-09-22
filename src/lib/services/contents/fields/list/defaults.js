import { isObject } from '@sveltia/utils/object';

import { isKeyPathWithin } from '$lib/services/contents/entry/key-paths';
import { getSubtreeEntries } from '$lib/services/contents/entry/subtree';

/**
 * @import { GetDefaultValueMapFuncArgs } from '$lib/types/private';
 * @import {
 * Field,
 * FieldKeyPath,
 * ListField,
 * ListFieldWithSubField,
 * ListFieldWithSubFields,
 * ListFieldWithTypes,
 * } from '$lib/types/public';
 */

/**
 * Fill in the subfields a default item leaves out, so that the item has the same shape as one
 * added in the editor: each missing subfield gets its own default value, or an empty value.
 * @param {object} args Arguments.
 * @param {Record<FieldKeyPath, any>} args.content Default value map being built.
 * @param {FieldKeyPath} args.itemKeyPath Key path of the item, e.g. `links.0`.
 * @param {Field[]} args.fields Subfields of the item.
 * @param {GetDefaultValueMapFuncArgs} args.funcArgs Arguments given to the field’s function.
 */
const populateMissingSubfields = ({ content, itemKeyPath, fields, funcArgs }) => {
  const { locale, defaultLocale, populateDefault } = funcArgs;
  const keys = Object.keys(content);

  fields.forEach((subfield) => {
    const subfieldKeyPath = `${itemKeyPath}.${subfield.name}`;

    // An Object or List subfield given in the item is held under its child key paths
    if (keys.some((key) => isKeyPathWithin(key, subfieldKeyPath))) {
      return;
    }

    populateDefault?.({
      content,
      keyPath: subfieldKeyPath,
      fieldConfig: subfield,
      locale,
      defaultLocale,
      dynamicValues: {},
    });
  });
};

/**
 * Get the default value map for a List field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, any>} Default value map.
 */
export const getDefaultValueMap = (args) => {
  const { fieldConfig, keyPath, dynamicValue } = args;
  const { default: defaultValue } = /** @type {ListField} */ (fieldConfig);
  const { field: subfield } = /** @type {ListFieldWithSubField} */ (fieldConfig);
  const { fields } = /** @type {ListFieldWithSubFields} */ (fieldConfig);
  const { types, typeKey = 'type' } = /** @type {ListFieldWithTypes} */ (fieldConfig);
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

  // A simple List field holds scalars only, so drop any object that snuck into the default. A list
  // with a single `field` holds whatever the subfield holds, so its default is taken as-is
  const items = subfield || fields || types ? value : value.filter((val) => !isObject(val));
  const content = getSubtreeEntries(keyPath, items);

  // A default item of a list with `fields` or `types` may leave out some subfields
  if (fields || types) {
    items.forEach((item, index) => {
      if (!isObject(item)) {
        return;
      }

      const itemFields = fields ?? types.find(({ name }) => name === item[typeKey])?.fields;

      if (itemFields) {
        populateMissingSubfields({
          content,
          itemKeyPath: `${keyPath}.${index}`,
          fields: itemFields,
          funcArgs: args,
        });
      }
    });
  }

  return content;
};
