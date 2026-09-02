import { escapeRegExp } from '@sveltia/utils/string';

import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import {
 * EntryValidityState,
 * FlattenedEntryContent,
 * LocaleValidityMap,
 * } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Cache of pre-compiled list key-path regexes, keyed by field key path.
 * @type {Map<FieldKeyPath, RegExp>}
 */
const listKeyPathRegexCache = new Map();

/**
 * Validate a list/multiple-value field, updating `validity` in place.
 * @param {object} args Arguments.
 * @param {string} args.keyPath Field key path.
 * @param {any} args.value Current field value.
 * @param {FlattenedEntryContent} args.valueMap Entry values. Only the keys are read, and only when
 * the item count cannot be taken from {@link value} directly.
 * @param {EntryValidityState} args.validity Validity state to update.
 * @param {LocaleValidityMap} args.validities Full validity map.
 * @param {string} args.locale Current locale.
 * @param {boolean} args.required Whether the field is required.
 * @param {string | number} args.min Minimum allowed items.
 * @param {string | number} args.max Maximum allowed items.
 * @returns {{ skip: boolean, empty?: boolean }} Whether the caller should skip further validation,
 * and whether the field holds no items at all.
 */
export const validateListField = ({
  keyPath,
  value,
  valueMap,
  validity,
  validities,
  locale,
  required,
  min,
  max,
}) => {
  // Given that values for an array field are flatten into `field.0`, `field.1` ... `field.N`, we
  // should validate only once against all these values
  if (keyPath in validities[locale]) {
    return { skip: true };
  }

  /**
   * Count the list items by scanning the flattened key paths.
   *
   * We need to check both the list itself and the items in the list because the list can be empty
   * but still have items in the list, depending on the flattening condition. It means the data
   * usually looks like `{ field.0: 'foo', field.1: 'bar' }`, but it can contain an empty list like
   * `{ field: [], field.0: 'foo', field.1: 'bar' }` in some cases. Or it can be a simple list field
   * like `{ field: ['foo', 'bar'] }` without the subfields.
   * @returns {number} Item count.
   */
  const countItems = () => {
    // Pre-compile and cache the regex — validateAnyField is called on every keystroke.
    const keyPathRegex = getOrCreate(
      listKeyPathRegexCache,
      keyPath,
      () => new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+`),
    );

    return new Set(
      Object.keys(valueMap)
        .map((key) => key.match(keyPathRegex)?.[0])
        .filter(Boolean),
    ).size;
  };

  const size = Array.isArray(value) && !!value.length ? value.length : countItems();

  if (required && !size) {
    validity.valueMissing = true;
  } else if (typeof min === 'number' && size < min) {
    validity.rangeUnderflow = true;
  } else if (typeof max === 'number' && size > max) {
    validity.rangeOverflow = true;
  }

  return { skip: false, empty: !size };
};
