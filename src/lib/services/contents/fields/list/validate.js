/**
 * @import {
 * EntryValidityState,
 * FlattenedEntryContent,
 * LocaleValidityMap,
 * } from '$lib/types/private';
 */

/**
 * Regular expression to match the item index at the start of a key path relative to its list, e.g.
 * `0` in `0` or `0.name`.
 */
const LEADING_INDEX_REGEX = /^\d+/;
/**
 * Regular expression to match a key path relative to its list that is an item index alone.
 */
const INDEX_REGEX = /^\d+$/;

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
    const prefix = `${keyPath}.`;
    /** @type {Set<string>} */
    const indexes = new Set();

    // This runs on every keystroke once the entry has been validated, against the draft’s live
    // values, so the cheap prefix test is done first and only the matching keys are parsed
    Object.keys(valueMap).forEach((key) => {
      if (key.startsWith(prefix)) {
        const index = key.slice(prefix.length).match(LEADING_INDEX_REGEX)?.[0];

        if (index !== undefined) {
          indexes.add(index);
        }
      }
    });

    return indexes.size;
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

/**
 * Get the items of a List field without subfields, which are stored as `field.0`, `field.1` …
 * `field.N`, unless the list itself holds them in an array.
 * @param {object} args Arguments.
 * @param {string} args.keyPath Field key path.
 * @param {any} args.value Current field value.
 * @param {FlattenedEntryContent} args.valueMap Entry values.
 * @returns {any[]} Items in list order.
 */
export const getListItems = ({ keyPath, value, valueMap }) => {
  if (Array.isArray(value) && !!value.length) {
    return value;
  }

  const prefix = `${keyPath}.`;

  return Object.keys(valueMap)
    .flatMap((key) => {
      const index = key.startsWith(prefix) ? key.slice(prefix.length) : undefined;

      return index !== undefined && INDEX_REGEX.test(index) ? [[Number(index), valueMap[key]]] : [];
    })
    .sort(([a], [b]) => a - b)
    .map(([, item]) => item);
};
