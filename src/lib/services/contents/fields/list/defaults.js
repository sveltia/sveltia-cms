import { isObject } from '@sveltia/utils/object';

import { isFieldRequired } from '$lib/services/contents/entry/fields';
import { isKeyPathWithin } from '$lib/services/contents/entry/key-paths';
import { getSubtreeEntries } from '$lib/services/contents/entry/subtree';
import { getDefaultValueMap as getBooleanDefaultValueMap } from '$lib/services/contents/fields/boolean/defaults';
import { getDefaultValueMap as getNumberDefaultValueMap } from '$lib/services/contents/fields/number/defaults';
import { getDefaultValueMap as getRichTextDefaultValueMap } from '$lib/services/contents/fields/rich-text/defaults';

/**
 * @import { GetDefaultValueMapFuncArgs, InternalLocaleCode } from '$lib/types/private';
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
 * added in the editor: each missing subfield gets its own default value, or an empty value. Also
 * used for the `default` of an Object field, which is an item of the same kind.
 * @param {object} args Arguments.
 * @param {Record<FieldKeyPath, any>} args.content Default value map being built.
 * @param {FieldKeyPath} args.itemKeyPath Key path of the item, e.g. `links.0`, or of the Object
 * field, e.g. `author`.
 * @param {Field[]} args.fields Subfields of the item.
 * @param {GetDefaultValueMapFuncArgs} args.funcArgs Arguments given to the field’s function.
 */
export const populateMissingSubfields = ({ content, itemKeyPath, fields, funcArgs }) => {
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
 * Check whether a List field is to hold its one item from the start. A required field limited to
 * one item with `max: 1` can’t do without it, so the item is there for the user to fill in, like
 * the subfields of an Object field, rather than having to be added first. That doesn’t apply to a
 * list with variable types, as the user has to choose the type of the item, nor to a list without
 * subfields, whose editor always shows an input anyway.
 * @param {object} args Arguments.
 * @param {ListField} args.fieldConfig Field configuration.
 * @param {InternalLocaleCode} args.locale Locale.
 * @returns {boolean} Result.
 */
export const hasRequiredSingleItem = ({ fieldConfig, locale }) =>
  fieldConfig.max === 1 &&
  ('fields' in fieldConfig || 'field' in fieldConfig) &&
  isFieldRequired({ fieldConfig, locale });

/**
 * Functions converting a dynamic default value to the value of a field, for the field types whose
 * value isn’t the string given in the URL as is.
 * @type {Record<string, (args: GetDefaultValueMapFuncArgs) => Record<string, any>>}
 */
const DYNAMIC_ITEM_VALUE_FUNCTIONS = {
  boolean: getBooleanDefaultValueMap,
  number: getNumberDefaultValueMap,
  markdown: getRichTextDefaultValueMap,
  richtext: getRichTextDefaultValueMap,
};

/**
 * Convert an item of a dynamic default value, which comes as a string, to the value the single
 * subfield of a List field holds, the way the subfield’s own dynamic default value is converted,
 * e.g. a number for a Number subfield, `true` or `false` for a Boolean subfield, or the sanitized
 * string for a RichText subfield, as the preview may not be sanitized.
 * @param {string} token Item given in the URL, e.g. `1` in `?ratings=1,2`.
 * @param {Field | undefined} subfield Single subfield of the List field, if any.
 * @param {Omit<GetDefaultValueMapFuncArgs, 'fieldConfig' | 'keyPath' | 'dynamicValue'>} args Other
 * arguments for the subfield’s default value function.
 * @returns {any} Item value, or `undefined` if the subfield can’t take it, e.g. `abc` for a Number
 * subfield.
 */
const toDynamicItemValue = (token, subfield, args) => {
  const getValueMap = DYNAMIC_ITEM_VALUE_FUNCTIONS[subfield?.widget ?? 'string'];

  if (!getValueMap) {
    return token;
  }

  const fieldConfig = /** @type {Field} */ (subfield);
  const value = getValueMap({ ...args, fieldConfig, keyPath: '_', dynamicValue: token })._;

  return typeof value === 'string' ? value.trim() : value;
};

/**
 * Get the default value map for a List field.
 * @param {GetDefaultValueMapFuncArgs} args Arguments.
 * @returns {Record<FieldKeyPath, any>} Default value map.
 */
export const getDefaultValueMap = (args) => {
  const { fieldConfig, keyPath, dynamicValue, locale, defaultLocale, populateDefault } = args;
  const { default: defaultValue } = /** @type {ListField} */ (fieldConfig);
  const { field: subfield } = /** @type {ListFieldWithSubField} */ (fieldConfig);
  const { fields } = /** @type {ListFieldWithSubFields} */ (fieldConfig);
  const { types, typeKey = 'type' } = /** @type {ListFieldWithTypes} */ (fieldConfig);
  /** @type {any[]} */
  let value;

  if (dynamicValue !== undefined) {
    // Filter out empty strings (this handles the case where `dynamicValue` is ''), as well as the
    // items the subfield can’t take
    value = dynamicValue
      .split(/,\s*/)
      .map((val) => toDynamicItemValue(val.trim(), subfield, { locale, defaultLocale }))
      .filter((val) => val !== '' && val !== undefined);
  } else {
    value = Array.isArray(defaultValue) ? defaultValue : [];
  }

  const isArray = Array.isArray(value) && !!value.length;

  if (!isArray) {
    // Always return the main array, even if empty
    const content = getSubtreeEntries(keyPath, []);

    // Give a required single-item list its item, with the default values of the subfields
    if (hasRequiredSingleItem({ fieldConfig: /** @type {ListField} */ (fieldConfig), locale })) {
      const itemKeyPath = `${keyPath}.0`;

      if (subfield) {
        populateDefault?.({
          content,
          keyPath: itemKeyPath,
          fieldConfig: subfield,
          locale,
          defaultLocale,
          dynamicValues: {},
        });
      } else {
        populateMissingSubfields({ content, itemKeyPath, fields, funcArgs: args });
      }
    }

    return content;
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
